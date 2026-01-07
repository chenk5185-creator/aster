/**
 * Format number to fixed decimal places
 */
export function formatNumber(
  value: number,
  decimals: number = 2,
  minDecimals?: number
): string {
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
 * Format price according to tick size
 */
export function formatPrice(price: number, tickSize: string): string {
  const precision = getDecimalPlaces(tickSize);
  return price.toFixed(precision);
}

/**
 * Format quantity according to step size
 */
export function formatQuantity(quantity: number, stepSize: string): string {
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
  value: number,
  currency: string = 'USDT',
  decimals: number = 2
): string {
  const formatted = formatNumber(Math.abs(value), decimals);
  const sign = value < 0 ? '-' : value > 0 ? '+' : '';
  return `${sign}${formatted} ${currency}`;
}

/**
 * Format percentage
 */
export function formatPercent(value: number, decimals: number = 2): string {
  const formatted = formatNumber(Math.abs(value), decimals);
  const sign = value < 0 ? '-' : value > 0 ? '+' : '';
  return `${sign}${formatted}%`;
}

/**
 * Format large numbers with K, M, B suffixes
 */
export function formatCompact(value: number): string {
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
