import { apiClient, ApiClient } from './client';
import type {
  PlaceOrderParams,
  OrderResponse,
  Order,
  CancelOrderResponse,
  UserTrade,
} from '../../types';

/**
 * Trading API
 */
export class TradingApi {
  private client: ApiClient;

  constructor(client: ApiClient = apiClient) {
    this.client = client;
  }

  /**
   * Place a new order
   */
  async placeOrder(params: PlaceOrderParams): Promise<OrderResponse> {
    const orderParams: Record<string, unknown> = {
      symbol: params.symbol,
      side: params.side,
      type: params.type,
      quantity: params.quantity,
    };

    if (params.timeInForce) {
      orderParams.timeInForce = params.timeInForce;
    }

    if (params.price !== undefined) {
      orderParams.price = params.price;
    }

    if (params.stopPrice !== undefined) {
      orderParams.stopPrice = params.stopPrice;
    }

    if (params.newClientOrderId) {
      orderParams.newClientOrderId = params.newClientOrderId;
    }

    return this.client.signedPost<OrderResponse>('/api/v1/order', orderParams);
  }

  /**
   * Place a limit buy order
   */
  async placeLimitBuy(
    symbol: string,
    quantity: number,
    price: number,
    clientOrderId?: string
  ): Promise<OrderResponse> {
    return this.placeOrder({
      symbol,
      side: 'BUY',
      type: 'LIMIT',
      timeInForce: 'GTC',
      quantity,
      price,
      newClientOrderId: clientOrderId,
    });
  }

  /**
   * Place a limit sell order
   */
  async placeLimitSell(
    symbol: string,
    quantity: number,
    price: number,
    clientOrderId?: string
  ): Promise<OrderResponse> {
    return this.placeOrder({
      symbol,
      side: 'SELL',
      type: 'LIMIT',
      timeInForce: 'GTC',
      quantity,
      price,
      newClientOrderId: clientOrderId,
    });
  }

  /**
   * Place a market buy order
   */
  async placeMarketBuy(
    symbol: string,
    quantity: number,
    clientOrderId?: string
  ): Promise<OrderResponse> {
    return this.placeOrder({
      symbol,
      side: 'BUY',
      type: 'MARKET',
      quantity,
      newClientOrderId: clientOrderId,
    });
  }

  /**
   * Place a market sell order
   */
  async placeMarketSell(
    symbol: string,
    quantity: number,
    clientOrderId?: string
  ): Promise<OrderResponse> {
    return this.placeOrder({
      symbol,
      side: 'SELL',
      type: 'MARKET',
      quantity,
      newClientOrderId: clientOrderId,
    });
  }

  /**
   * Cancel an order
   */
  async cancelOrder(
    symbol: string,
    orderId?: number,
    origClientOrderId?: string
  ): Promise<CancelOrderResponse> {
    const params: Record<string, unknown> = { symbol };

    if (orderId !== undefined) {
      params.orderId = orderId;
    }

    if (origClientOrderId) {
      params.origClientOrderId = origClientOrderId;
    }

    return this.client.signedDelete<CancelOrderResponse>('/api/v1/order', params);
  }

  /**
   * Cancel all open orders for a symbol
   */
  async cancelAllOrders(symbol: string): Promise<CancelOrderResponse[]> {
    return this.client.signedDelete<CancelOrderResponse[]>('/api/v1/allOpenOrders', {
      symbol,
    });
  }

  /**
   * Get order status
   */
  async getOrder(
    symbol: string,
    orderId?: number,
    origClientOrderId?: string
  ): Promise<Order> {
    const params: Record<string, unknown> = { symbol };

    if (orderId !== undefined) {
      params.orderId = orderId;
    }

    if (origClientOrderId) {
      params.origClientOrderId = origClientOrderId;
    }

    return this.client.signedGet<Order>('/api/v1/order', params);
  }

  /**
   * Get all open orders
   */
  async getOpenOrders(symbol?: string): Promise<Order[]> {
    const params: Record<string, unknown> = {};
    if (symbol) {
      params.symbol = symbol;
    }
    return this.client.signedGet<Order[]>('/api/v1/openOrders', params);
  }

  /**
   * Get all orders (including filled and cancelled)
   */
  async getAllOrders(
    symbol: string,
    options?: {
      orderId?: number;
      startTime?: number;
      endTime?: number;
      limit?: number;
    }
  ): Promise<Order[]> {
    return this.client.signedGet<Order[]>('/api/v1/allOrders', {
      symbol,
      ...options,
    });
  }

  /**
   * Get user trades
   */
  async getUserTrades(
    symbol: string,
    options?: {
      orderId?: number;
      startTime?: number;
      endTime?: number;
      fromId?: number;
      limit?: number;
    }
  ): Promise<UserTrade[]> {
    return this.client.signedGet<UserTrade[]>('/api/v1/userTrades', {
      symbol,
      ...options,
    });
  }
}

export const tradingApi = new TradingApi();
