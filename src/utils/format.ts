/**
 * Format number to fixed decimal places
 */
export function formatNumber(
  value: number | null | undefined,
  decimals: number = 2,
  minDecimals?: number
): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '0';
  }

  const formatted = value.toFixed(decimals);
  if (minDecimals !== undefined && minDecimals < decimals) {
    // Remove trailing zeros but keep at least minDecimals
    const parts = formatted.split('.');
    if (parts.length === 2) {
      let decimal = parts[1];
      while (decimal.length > minDecimals && decimal.endsWith('0')) {
        decimal = decimal.slice(0, -1);
      }
      return decimal.length > 0 ? `${parts[0]}.${decimal}` : parts[0];
    }
  }
  return formatted;
}

/**
 * 智能价格格式化：根据价格大小自动调整精度
 * - 价格 >= 1000: 2位小数
 * - 价格 >= 1: 2-4位小数
 * - 价格 >= 0.01: 4位小数
 * - 价格 >= 0.0001: 6位小数
 * - 价格 < 0.0001: 8位小数
 */
export function formatSmartPrice(price: number | null | undefined): string {
  if (price === null || price === undefined || isNaN(price) || price === 0) {
    return '0';
  }

  const absPrice = Math.abs(price);
  let decimals: number;

  if (absPrice >= 1000) {
    decimals = 2;
  } else if (absPrice >= 1) {
    decimals = 4;
  } else if (absPrice >= 0.01) {
    decimals = 4;
  } else if (absPrice >= 0.0001) {
    decimals = 6;
  } else {
    decimals = 8;
  }

  // 格式化并移除尾随的零
  const formatted = price.toFixed(decimals);
  return formatted.replace(/\.?0+$/, '');
}

/**
 * Format price according to tick size
 */
export function formatPrice(price: number | null | undefined, tickSize: string): string {
  if (price === null || price === undefined || isNaN(price)) {
    return '0';
  }
  const precision = getDecimalPlaces(tickSize);
  return price.toFixed(precision);
}

/**
 * Format quantity according to step size
 */
export function formatQuantity(quantity: number | null | undefined, stepSize: string): string {
  if (quantity === null || quantity === undefined || isNaN(quantity)) {
    return '0';
  }
  const precision = getDecimalPlaces(stepSize);
  return quantity.toFixed(precision);
}

/**
 * Get decimal places from a step/tick size string
 */
export function getDecimalPlaces(stepSize: string): number {
  const parts = stepSize.split('.');
  if (parts.length === 1) return 0;
  // Count significant digits after decimal
  const decimal = parts[1];
  let count = 0;
  for (let i = 0; i < decimal.length; i++) {
    if (decimal[i] !== '0' || count > 0) {
      count = i + 1;
    }
  }
  return count || decimal.length;
}

/**
 * Format currency with symbol
 */
export function formatCurrency(
  value: number | null | undefined,
  currency: string = 'USDT',
  decimals: number = 2
): string {
  if (value === null || value === undefined || isNaN(value)) {
    return `0 ${currency}`;
  }
  const formatted = formatNumber(Math.abs(value), decimals);
  const sign = value < 0 ? '-' : value > 0 ? '+' : '';
  return `${sign}${formatted} ${currency}`;
}

/**
 * Format percentage
 */
export function formatPercent(value: number | null | undefined, decimals: number = 2): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '0%';
  }
  const formatted = formatNumber(Math.abs(value), decimals);
  const sign = value < 0 ? '-' : value > 0 ? '+' : '';
  return `${sign}${formatted}%`;
}

/**
 * Format large numbers with K, M, B suffixes
 */
export function formatCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '0';
  }
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(2)}K`;
  return value.toFixed(2);
}

/**
 * Format timestamp to date string
 */
export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString();
}

/**
 * Format timestamp to time string
 */
export function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString();
}

/**
 * Format timestamp to datetime string
 */
export function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

/**
 * Truncate string with ellipsis
 */
export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

/**
 * Format address (e.g., 0x1234...5678)
 */
export function formatAddress(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
