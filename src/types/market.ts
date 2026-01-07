// Market Data Types

export interface SymbolInfo {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  status: 'TRADING' | 'HALT' | 'BREAK';
  filters: SymbolFilter[];
}

export type SymbolFilter =
  | PriceFilter
  | LotSizeFilter
  | MinNotionalFilter
  | MarketLotSizeFilter;

export interface PriceFilter {
  filterType: 'PRICE_FILTER';
  minPrice: string;
  maxPrice: string;
  tickSize: string;
}

export interface LotSizeFilter {
  filterType: 'LOT_SIZE';
  minQty: string;
  maxQty: string;
  stepSize: string;
}

export interface MinNotionalFilter {
  filterType: 'MIN_NOTIONAL';
  minNotional: string;
}

export interface MarketLotSizeFilter {
  filterType: 'MARKET_LOT_SIZE';
  minQty: string;
  maxQty: string;
  stepSize: string;
}

export interface Ticker {
  symbol: string;
  lastPrice: string;
  priceChange: string;
  priceChangePercent: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
}

export interface OrderBook {
  lastUpdateId: number;
  bids: [string, string][]; // [price, quantity]
  asks: [string, string][]; // [price, quantity]
}

export interface Kline {
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTime: number;
  quoteVolume: string;
  trades: number;
}

export interface Trade {
  id: number;
  price: string;
  qty: string;
  quoteQty: string;
  time: number;
  isBuyerMaker: boolean;
}

export interface AccountBalance {
  asset: string;
  free: string;
  locked: string;
}

export interface AccountInfo {
  makerCommission: number;
  takerCommission: number;
  canTrade: boolean;
  canWithdraw: boolean;
  canDeposit: boolean;
  balances: AccountBalance[];
}

export interface FeeInfo {
  symbol: string;
  makerCommission: string;
  takerCommission: string;
}
