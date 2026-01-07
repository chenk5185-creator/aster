// Grid Types

export type GridType = 'ARITHMETIC' | 'GEOMETRIC';

export type GridStatus = 'PENDING' | 'RUNNING' | 'STOPPED' | 'COMPLETED';

export interface GridConfig {
  symbol: string;
  upperPrice: number;
  lowerPrice: number;
  gridCount: number;
  gridType: GridType;
  investmentAmount: number;
  triggerPrice?: number;
  stopUpperPrice?: number;
  stopLowerPrice?: number;
  cancelOrdersOnStop: boolean;
  sellAllOnStop: boolean;
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

export interface GridLevel {
  index: number;
  price: number;
  buyOrderId?: string;
  sellOrderId?: string;
  status: 'EMPTY' | 'BUY_PENDING' | 'HOLDING' | 'SELL_PENDING';
  quantity?: number;
}

export interface GridOrder {
  orderId: string;
  clientOrderId: string;
  gridIndex: number;
  side: 'BUY' | 'SELL';
  price: number;
  quantity: number;
  executedQty: number;
  status: OrderStatus;
  createdAt: number;
  filledAt?: number;
}

export type OrderStatus =
  | 'NEW'
  | 'PARTIALLY_FILLED'
  | 'FILLED'
  | 'CANCELED'
  | 'REJECTED'
  | 'EXPIRED';

export interface GridProfit {
  realizedProfit: number;
  unrealizedProfit: number;
  totalProfit: number;
  profitRate: number;
  tradingCount: number;
  totalFees: number;
}

export interface GridValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  estimatedGridProfit: number;
  minInvestmentRequired: number;
}
