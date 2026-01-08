// Grid Trading Types (shared with frontend)

export type GridType = 'ARITHMETIC' | 'GEOMETRIC';
export type GridStatus = 'PENDING' | 'RUNNING' | 'STOPPED' | 'COMPLETED';
export type OrderStatus = 'NEW' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELED' | 'REJECTED';
export type OrderSide = 'BUY' | 'SELL';
export type GridLevelStatus = 'EMPTY' | 'BUY_PENDING' | 'HOLDING' | 'SELL_PENDING';

export interface GridConfig {
  symbol: string;
  gridType: GridType;
  upperPrice: number;
  lowerPrice: number;
  gridCount: number;
  investmentAmount: number;
  stopUpperPrice?: number;
  stopLowerPrice?: number;
  cancelOrdersOnStop: boolean;
  sellAllOnStop: boolean;
}

export interface GridLevel {
  index: number;
  price: number;
  status: GridLevelStatus;
  buyOrderId?: string;
  sellOrderId?: string;
  quantity?: number;
}

export interface GridOrder {
  orderId: string;
  clientOrderId: string;
  gridIndex: number;
  side: OrderSide;
  price: number;
  quantity: number;
  executedQty: number;
  status: OrderStatus;
  createdAt: number;
  filledAt?: number;
}

export interface GridProfit {
  realizedProfit: number;
  unrealizedProfit: number;
  totalProfit: number;
  profitRate: number;
  tradingCount: number;
  totalFees: number;
}

export interface GridInstance {
  id: string;
  config: GridConfig;
  status: GridStatus;
  createdAt: number;
  startedAt?: number;
  stoppedAt?: number;
  gridLevels: GridLevel[];
  orders: GridOrder[];
  profit: GridProfit;
  baseAssetHolding: number;
}

export interface GridValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  estimatedGridProfit: number;
  minInvestmentRequired: number;
}

// API Credentials
export interface ApiCredentials {
  apiKey: string;
  apiSecret: string;
}

export interface User {
  id: string;
  encryptedCredentials: string;
  createdAt: number;
  lastLoginAt: number;
}

// Database Models
export interface DbGrid {
  id: string;
  user_id: string;
  config: string; // JSON
  status: GridStatus;
  created_at: number;
  started_at: number | null;
  stopped_at: number | null;
  grid_levels: string; // JSON
  orders: string; // JSON
  profit: string; // JSON
  base_asset_holding: number;
}

export interface DbUser {
  id: string;
  encrypted_credentials: string;
  created_at: number;
  last_login_at: number;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface GridListResponse {
  grids: GridInstance[];
}

export interface GridDetailResponse {
  grid: GridInstance;
}

// ASTER API Types
export interface SymbolInfo {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  filters: Array<PriceFilter | LotSizeFilter | MinNotionalFilter>;
}

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

export interface OrderResponse {
  orderId: number;
  clientOrderId: string;
  symbol: string;
  status: string;
  executedQty: string;
  price: string;
}

export interface Order {
  orderId: number;
  clientOrderId: string;
  symbol: string;
  side: OrderSide;
  type: string;
  price: string;
  origQty: string;
  executedQty: string;
  status: string;
  time: number;
}
