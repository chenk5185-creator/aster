import axios, { AxiosInstance } from 'axios';
import CryptoJS from 'crypto-js';
import type { ApiCredentials, SymbolInfo, OrderResponse, Order } from '../types/index.js';

const BASE_URL = 'https://sapi.asterdex.com';

/**
 * Generate HMAC SHA256 signature
 */
function generateSignature(queryString: string, apiSecret: string): string {
  return CryptoJS.HmacSHA256(queryString, apiSecret).toString(CryptoJS.enc.Hex);
}

/**
 * Build query string from params
 */
function buildQueryString(params: Record<string, unknown>): string {
  return Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
    .join('&');
}

/**
 * ASTER Spot API Client (Backend Version)
 */
export class AsterApiClient {
  private axios: AxiosInstance;
  private credentials: ApiCredentials;
  private recvWindow: number;
  private serverTimeOffset: number = 0;

  constructor(credentials: ApiCredentials) {
    this.credentials = credentials;
    this.recvWindow = 5000;

    this.axios = axios.create({
      baseURL: BASE_URL,
      timeout: 30000,
      // Remove global Content-Type header - it should only be set for POST requests
    });

    // Add headers dynamically using interceptor
    this.axios.interceptors.request.use((config) => {
      // Public endpoints don't need API key
      const publicEndpoints = ['/api/v1/time', '/api/v1/exchangeInfo', '/api/v1/ticker/price'];
      const isPublicEndpoint = publicEndpoints.some(endpoint => config.url?.includes(endpoint));

      if (!isPublicEndpoint && this.credentials) {
        config.headers['X-MBX-APIKEY'] = this.credentials.apiKey;
      }

      // Only add Content-Type for POST requests
      if (config.method?.toUpperCase() === 'POST') {
        config.headers['Content-Type'] = 'application/x-www-form-urlencoded';
      }

      return config;
    });
  }

  /**
   * Sync server time
   */
  async syncServerTime(): Promise<void> {
    const localTime = Date.now();
    const response = await this.axios.get<{ serverTime: number }>('/api/v1/time');
    this.serverTimeOffset = response.data.serverTime - localTime;
  }

  /**
   * Get current timestamp
   */
  private getTimestamp(): number {
    return Date.now() + this.serverTimeOffset;
  }

  /**
   * Sign request params
   */
  private signParams(params: Record<string, unknown>): Record<string, unknown> {
    const signedParams = {
      ...params,
      timestamp: this.getTimestamp(),
      recvWindow: this.recvWindow,
    };

    const queryString = buildQueryString(signedParams);
    const signature = generateSignature(queryString, this.credentials.apiSecret);

    return { ...signedParams, signature };
  }

  // Market Data APIs

  async getSymbolInfo(symbol: string): Promise<SymbolInfo> {
    const response = await this.axios.get<{ symbols: SymbolInfo[] }>('/api/v1/exchangeInfo');
    const symbolInfo = response.data.symbols.find(s => s.symbol === symbol);
    if (!symbolInfo) {
      throw new Error(`Symbol ${symbol} not found`);
    }
    return symbolInfo;
  }

  async getPrice(symbol: string): Promise<number> {
    const response = await this.axios.get<{ price: string }>('/api/v1/ticker/price', {
      params: { symbol },
    });
    return parseFloat(response.data.price);
  }

  // Account APIs

  async getBalance(asset: string): Promise<number> {
    const signedParams = this.signParams({});
    const response = await this.axios.get<{ balances: Array<{ asset: string; free: string }> }>(
      '/api/v1/account',
      { params: signedParams }
    );
    const balance = response.data.balances.find(b => b.asset === asset);
    return balance ? parseFloat(balance.free) : 0;
  }

  async getFeeRates(): Promise<{ maker: number; taker: number }> {
    const signedParams = this.signParams({});
    const response = await this.axios.get<{ makerCommission: number; takerCommission: number }>(
      '/api/v1/account',
      { params: signedParams }
    );
    // Convert from basis points to decimal (e.g., 10 -> 0.001)
    return {
      maker: response.data.makerCommission / 10000,
      taker: response.data.takerCommission / 10000,
    };
  }

  // Trading APIs

  async placeLimitOrder(
    symbol: string,
    side: 'BUY' | 'SELL',
    quantity: number,
    price: number,
    clientOrderId?: string
  ): Promise<OrderResponse> {
    const params: Record<string, unknown> = {
      symbol,
      side,
      type: 'LIMIT',
      timeInForce: 'GTC',
      quantity,
      price,
    };

    if (clientOrderId) {
      params.newClientOrderId = clientOrderId;
    }

    const signedParams = this.signParams(params);
    const queryString = buildQueryString(signedParams);
    const response = await this.axios.post<OrderResponse>('/api/v1/order', queryString);
    return response.data;
  }

  async placeMarketOrder(
    symbol: string,
    side: 'BUY' | 'SELL',
    quantity: number
  ): Promise<OrderResponse> {
    const params = {
      symbol,
      side,
      type: 'MARKET',
      quantity,
    };

    const signedParams = this.signParams(params);
    const queryString = buildQueryString(signedParams);
    const response = await this.axios.post<OrderResponse>('/api/v1/order', queryString);
    return response.data;
  }

  async cancelOrder(symbol: string, orderId: number): Promise<void> {
    const signedParams = this.signParams({ symbol, orderId });
    await this.axios.delete('/api/v1/order', { params: signedParams });
  }

  async getOrder(symbol: string, orderId: number): Promise<Order> {
    const signedParams = this.signParams({ symbol, orderId });
    const response = await this.axios.get<Order>('/api/v1/order', { params: signedParams });
    return response.data;
  }

  async getOpenOrders(symbol: string): Promise<Order[]> {
    const signedParams = this.signParams({ symbol });
    const response = await this.axios.get<Order[]>('/api/v1/openOrders', { params: signedParams });
    return response.data;
  }

  async getAllOrders(symbol: string, limit: number = 500): Promise<Order[]> {
    const signedParams = this.signParams({ symbol, limit });
    const response = await this.axios.get<Order[]>('/api/v1/allOrders', { params: signedParams });
    return response.data;
  }
}
