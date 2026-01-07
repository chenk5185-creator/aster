import type {
  GridConfig,
  GridType,
  GridLevel,
  GridValidation,
  SymbolInfo,
  PriceFilter,
  LotSizeFilter,
  MinNotionalFilter,
} from '../../types';

/**
 * Grid Calculator Service
 * Handles all grid-related calculations
 */
export class GridCalculator {
  /**
   * Calculate grid price levels
   */
  static calculateLevels(
    upperPrice: number,
    lowerPrice: number,
    gridCount: number,
    gridType: GridType
  ): number[] {
    const levels: number[] = [];

    if (gridType === 'ARITHMETIC') {
      // Arithmetic: equal price difference between grids
      const step = (upperPrice - lowerPrice) / gridCount;
      for (let i = 0; i <= gridCount; i++) {
        levels.push(lowerPrice + step * i);
      }
    } else {
      // Geometric: equal ratio between grids
      const ratio = Math.pow(upperPrice / lowerPrice, 1 / gridCount);
      for (let i = 0; i <= gridCount; i++) {
        levels.push(lowerPrice * Math.pow(ratio, i));
      }
    }

    return levels;
  }

  /**
   * Initialize grid levels with status
   */
  static initializeGridLevels(
    config: GridConfig,
    currentPrice: number
  ): GridLevel[] {
    const levels = this.calculateLevels(
      config.upperPrice,
      config.lowerPrice,
      config.gridCount,
      config.gridType
    );

    return levels.map((price, index) => ({
      index,
      price,
      status: price < currentPrice ? 'EMPTY' : 'EMPTY',
    }));
  }

  /**
   * Find grid index for a given price
   */
  static findGridIndex(levels: number[], price: number): number {
    for (let i = 0; i < levels.length; i++) {
      if (levels[i] > price) {
        return i;
      }
    }
    return levels.length;
  }

  /**
   * Calculate how many buy grids are below current price
   */
  static countBuyGrids(levels: number[], currentPrice: number): number {
    return this.findGridIndex(levels, currentPrice);
  }

  /**
   * Calculate investment amount per grid
   */
  static calculateAmountPerGrid(
    investmentAmount: number,
    currentPrice: number,
    levels: number[]
  ): number {
    const buyGridCount = this.countBuyGrids(levels, currentPrice);
    if (buyGridCount <= 0) return 0;
    return investmentAmount / buyGridCount;
  }

  /**
   * Calculate quantity for a grid level
   */
  static calculateGridQuantity(
    amountPerGrid: number,
    gridPrice: number
  ): number {
    return amountPerGrid / gridPrice;
  }

  /**
   * Calculate all initial buy orders
   */
  static calculateInitialBuyOrders(
    config: GridConfig,
    currentPrice: number,
    tickSize: number,
    stepSize: number
  ): Array<{ gridIndex: number; price: number; quantity: number }> {
    const levels = this.calculateLevels(
      config.upperPrice,
      config.lowerPrice,
      config.gridCount,
      config.gridType
    );

    const buyGridCount = this.countBuyGrids(levels, currentPrice);
    if (buyGridCount <= 0) return [];

    const amountPerGrid = config.investmentAmount / buyGridCount;
    const orders: Array<{ gridIndex: number; price: number; quantity: number }> = [];

    for (let i = 0; i < buyGridCount; i++) {
      const rawPrice = levels[i];
      const price = this.adjustToTickSize(rawPrice, tickSize);
      const rawQuantity = amountPerGrid / price;
      const quantity = this.adjustToStepSize(rawQuantity, stepSize);

      if (quantity > 0) {
        orders.push({
          gridIndex: i,
          price,
          quantity,
        });
      }
    }

    return orders;
  }

  /**
   * Calculate profit per grid (in quote currency)
   */
  static calculateGridProfit(
    buyPrice: number,
    sellPrice: number,
    quantity: number,
    makerFee: number,
    takerFee: number
  ): number {
    const buyFee = buyPrice * quantity * takerFee; // Limit orders are usually maker
    const sellFee = sellPrice * quantity * makerFee;
    const grossProfit = (sellPrice - buyPrice) * quantity;
    return grossProfit - buyFee - sellFee;
  }

  /**
   * Calculate estimated profit rate per grid
   */
  static calculateProfitRate(
    levels: number[],
    feeRate: number
  ): { avgProfitRate: number; minProfitRate: number; maxProfitRate: number } {
    const rates: number[] = [];

    for (let i = 0; i < levels.length - 1; i++) {
      const buyPrice = levels[i];
      const sellPrice = levels[i + 1];
      const spread = (sellPrice - buyPrice) / buyPrice;
      const netRate = spread - feeRate * 2; // Fee on both sides
      rates.push(netRate * 100);
    }

    return {
      avgProfitRate: rates.reduce((a, b) => a + b, 0) / rates.length,
      minProfitRate: Math.min(...rates),
      maxProfitRate: Math.max(...rates),
    };
  }

  /**
   * Adjust price to tick size
   */
  static adjustToTickSize(price: number, tickSize: number): number {
    return Math.round(price / tickSize) * tickSize;
  }

  /**
   * Adjust quantity to step size (floor)
   */
  static adjustToStepSize(quantity: number, stepSize: number): number {
    return Math.floor(quantity / stepSize) * stepSize;
  }

  /**
   * Get filter value from symbol info
   */
  private static getFilter<T extends { filterType: string }>(
    symbolInfo: SymbolInfo,
    filterType: string
  ): T | undefined {
    return symbolInfo.filters.find(
      (f) => f.filterType === filterType
    ) as T | undefined;
  }

  /**
   * Validate grid configuration
   */
  static validate(
    config: GridConfig,
    symbolInfo: SymbolInfo,
    currentPrice: number,
    availableBalance: number,
    feeRate: number
  ): GridValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Price range validation
    if (config.upperPrice <= config.lowerPrice) {
      errors.push('Upper price must be greater than lower price');
    }

    if (config.upperPrice <= 0 || config.lowerPrice <= 0) {
      errors.push('Prices must be positive');
    }

    // Current price warning
    if (currentPrice < config.lowerPrice) {
      warnings.push('Current price is below the grid range - no buy orders will be placed initially');
    }
    if (currentPrice > config.upperPrice) {
      warnings.push('Current price is above the grid range');
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
      errors.push(`Insufficient balance. Available: ${availableBalance.toFixed(2)}`);
    }

    const levels = this.calculateLevels(
      config.upperPrice,
      config.lowerPrice,
      config.gridCount,
      config.gridType
    );

    const buyGridCount = this.countBuyGrids(levels, currentPrice);

    // Check min notional
    const minNotionalFilter = this.getFilter<MinNotionalFilter>(
      symbolInfo,
      'MIN_NOTIONAL'
    );
    let minInvestmentRequired = 0;

    if (minNotionalFilter && buyGridCount > 0) {
      const minNotional = parseFloat(minNotionalFilter.minNotional);
      const amountPerGrid = config.investmentAmount / buyGridCount;
      minInvestmentRequired = minNotional * buyGridCount;

      if (amountPerGrid < minNotional) {
        errors.push(
          `Amount per grid (${amountPerGrid.toFixed(2)}) is below minimum (${minNotional}). ` +
          `Reduce grids to ${Math.floor(config.investmentAmount / minNotional)} or ` +
          `increase investment to ${minInvestmentRequired.toFixed(2)}`
        );
      }
    }

    // Check lot size
    const lotSizeFilter = this.getFilter<LotSizeFilter>(symbolInfo, 'LOT_SIZE');
    if (lotSizeFilter && buyGridCount > 0) {
      const minQty = parseFloat(lotSizeFilter.minQty);
      const amountPerGrid = config.investmentAmount / buyGridCount;
      const minQuantityAtHighPrice = amountPerGrid / config.upperPrice;

      if (minQuantityAtHighPrice < minQty) {
        warnings.push(
          `Some orders may be below min quantity (${minQty})`
        );
      }
    }

    // Price filter validation
    const priceFilter = this.getFilter<PriceFilter>(symbolInfo, 'PRICE_FILTER');
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

    // Calculate estimated profit
    const profitStats = this.calculateProfitRate(levels, feeRate);

    if (profitStats.minProfitRate <= 0) {
      warnings.push(
        `Some grids may not be profitable after fees (min: ${profitStats.minProfitRate.toFixed(2)}%)`
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      estimatedGridProfit: profitStats.avgProfitRate,
      minInvestmentRequired,
    };
  }

  /**
   * Generate client order ID for grid orders
   */
  static generateOrderId(gridId: string, gridIndex: number, side: 'BUY' | 'SELL'): string {
    return `GRID_${gridId}_${gridIndex}_${side}_${Date.now()}`;
  }

  /**
   * Parse grid info from client order ID
   */
  static parseOrderId(clientOrderId: string): {
    gridId: string;
    gridIndex: number;
    side: 'BUY' | 'SELL';
  } | null {
    const match = clientOrderId.match(/^GRID_(.+)_(\d+)_(BUY|SELL)_\d+$/);
    if (!match) return null;

    return {
      gridId: match[1],
      gridIndex: parseInt(match[2]),
      side: match[3] as 'BUY' | 'SELL',
    };
  }
}
