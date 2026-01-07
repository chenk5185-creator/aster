import type { GridType, GridConfig, SymbolInfo, PriceFilter, LotSizeFilter, MinNotionalFilter } from '../types';

/**
 * Calculate grid price levels
 */
export function calculateGridLevels(
  upperPrice: number,
  lowerPrice: number,
  gridCount: number,
  gridType: GridType
): number[] {
  const levels: number[] = [];

  if (gridType === 'ARITHMETIC') {
    const step = (upperPrice - lowerPrice) / gridCount;
    for (let i = 0; i <= gridCount; i++) {
      levels.push(lowerPrice + step * i);
    }
  } else {
    const ratio = Math.pow(upperPrice / lowerPrice, 1 / gridCount);
    for (let i = 0; i <= gridCount; i++) {
      levels.push(lowerPrice * Math.pow(ratio, i));
    }
  }

  return levels;
}

/**
 * Calculate profit per grid (without fees)
 */
export function calculateGridProfitPerLevel(
  levels: number[]
): number[] {
  const profits: number[] = [];

  for (let i = 0; i < levels.length - 1; i++) {
    const buyPrice = levels[i];
    const sellPrice = levels[i + 1];
    profits.push(sellPrice - buyPrice);
  }

  return profits;
}

/**
 * Calculate expected profit rate per grid
 */
export function calculateGridProfitRate(
  levels: number[],
  feeRate: number
): number[] {
  const rates: number[] = [];

  for (let i = 0; i < levels.length - 1; i++) {
    const buyPrice = levels[i];
    const sellPrice = levels[i + 1];
    const grossProfitRate = (sellPrice - buyPrice) / buyPrice;
    // Fee is charged on both buy and sell
    const netProfitRate = grossProfitRate - feeRate * 2;
    rates.push(netProfitRate * 100);
  }

  return rates;
}

/**
 * Find grid index for a given price
 */
export function findGridIndex(levels: number[], price: number): number {
  for (let i = 0; i < levels.length; i++) {
    if (levels[i] > price) {
      return i;
    }
  }
  return levels.length;
}

/**
 * Calculate investment amount per grid
 */
export function calculateAmountPerGrid(
  investmentAmount: number,
  currentPrice: number,
  levels: number[]
): number {
  const buyGridCount = findGridIndex(levels, currentPrice);
  if (buyGridCount <= 0) return 0;
  return investmentAmount / buyGridCount;
}

/**
 * Calculate quantity for a grid level
 */
export function calculateGridQuantity(
  amountPerGrid: number,
  price: number
): number {
  return amountPerGrid / price;
}

/**
 * Adjust price to tick size
 */
export function adjustToTickSize(price: number, tickSize: number): number {
  return Math.round(price / tickSize) * tickSize;
}

/**
 * Adjust quantity to step size
 */
export function adjustToStepSize(quantity: number, stepSize: number): number {
  return Math.floor(quantity / stepSize) * stepSize;
}

/**
 * Get filter from symbol info
 */
export function getFilter<T extends { filterType: string }>(
  symbolInfo: SymbolInfo,
  filterType: string
): T | undefined {
  return symbolInfo.filters.find((f) => f.filterType === filterType) as T | undefined;
}

/**
 * Validate grid configuration
 */
export function validateGridConfig(
  config: GridConfig,
  symbolInfo: SymbolInfo,
  currentPrice: number,
  availableBalance: number
): { isValid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Price range validation
  if (config.upperPrice <= config.lowerPrice) {
    errors.push('Upper price must be greater than lower price');
  }

  if (currentPrice < config.lowerPrice || currentPrice > config.upperPrice) {
    warnings.push('Current price is outside the grid range');
  }

  // Grid count validation
  if (config.gridCount < 2) {
    errors.push('Grid count must be at least 2');
  }
  if (config.gridCount > 200) {
    errors.push('Grid count cannot exceed 200');
  }

  // Investment validation
  if (config.investmentAmount <= 0) {
    errors.push('Investment amount must be greater than 0');
  }
  if (config.investmentAmount > availableBalance) {
    errors.push(`Insufficient balance. Available: ${availableBalance}`);
  }

  // Check min notional
  const minNotionalFilter = getFilter<MinNotionalFilter>(symbolInfo, 'MIN_NOTIONAL');
  if (minNotionalFilter) {
    const minNotional = parseFloat(minNotionalFilter.minNotional);
    const levels = calculateGridLevels(
      config.upperPrice,
      config.lowerPrice,
      config.gridCount,
      config.gridType
    );
    const buyGridCount = findGridIndex(levels, currentPrice);
    if (buyGridCount > 0) {
      const amountPerGrid = config.investmentAmount / buyGridCount;
      if (amountPerGrid < minNotional) {
        errors.push(
          `Amount per grid (${amountPerGrid.toFixed(2)}) is below minimum notional (${minNotional}). Reduce grid count or increase investment.`
        );
      }
    }
  }

  // Check lot size
  const lotSizeFilter = getFilter<LotSizeFilter>(symbolInfo, 'LOT_SIZE');
  if (lotSizeFilter) {
    const minQty = parseFloat(lotSizeFilter.minQty);
    const levels = calculateGridLevels(
      config.upperPrice,
      config.lowerPrice,
      config.gridCount,
      config.gridType
    );
    const buyGridCount = findGridIndex(levels, currentPrice);
    if (buyGridCount > 0) {
      const amountPerGrid = config.investmentAmount / buyGridCount;
      // Check at highest price (lowest quantity)
      const minQuantity = amountPerGrid / config.upperPrice;
      if (minQuantity < minQty) {
        warnings.push(
          `Some grid orders may be below minimum quantity (${minQty})`
        );
      }
    }
  }

  // Price filter
  const priceFilter = getFilter<PriceFilter>(symbolInfo, 'PRICE_FILTER');
  if (priceFilter) {
    const minPrice = parseFloat(priceFilter.minPrice);
    const maxPrice = parseFloat(priceFilter.maxPrice);
    if (config.lowerPrice < minPrice) {
      errors.push(`Lower price cannot be below ${minPrice}`);
    }
    if (config.upperPrice > maxPrice) {
      errors.push(`Upper price cannot exceed ${maxPrice}`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Calculate estimated profit per round trip
 */
export function calculateEstimatedProfit(
  config: GridConfig,
  makerFee: number,
  _takerFee?: number
): { perGrid: number; perGridPercent: number } {
  const levels = calculateGridLevels(
    config.upperPrice,
    config.lowerPrice,
    config.gridCount,
    config.gridType
  );

  // Average profit per grid
  let totalProfit = 0;
  for (let i = 0; i < levels.length - 1; i++) {
    const buyPrice = levels[i];
    const sellPrice = levels[i + 1];
    const spread = sellPrice - buyPrice;
    // Assuming limit orders (maker fee)
    const fee = (buyPrice + sellPrice) * makerFee;
    totalProfit += spread - fee;
  }

  const avgProfit = totalProfit / (levels.length - 1);
  const avgPrice = (config.upperPrice + config.lowerPrice) / 2;
  const avgPercent = (avgProfit / avgPrice) * 100;

  return {
    perGrid: avgProfit,
    perGridPercent: avgPercent,
  };
}
