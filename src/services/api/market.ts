import { apiClient, ApiClient } from './client';
import type {
  SymbolInfo,
  Ticker,
  OrderBook,
  Kline,
  Trade,
} from '../../types';

interface ExchangeInfoResponse {
  timezone: string;
  serverTime: number;
  rateLimits: Array<{
    rateLimitType: string;
    interval: string;
    intervalNum: number;
    limit: number;
  }>;
  symbols: Array<{
    symbol: string;
    status: string;
    baseAsset: string;
    quoteAsset: string;
    filters: Array<Record<string, string>>;
  }>;
}

/**
 * Market Data API
 */
export class MarketApi {
  private client: ApiClient;

  constructor(client: ApiClient = apiClient) {
    this.client = client;
  }

  /**
   * Test connectivity
   */
  async ping(): Promise<boolean> {
    await this.client.get('/api/v1/ping');
    return true;
  }

  /**
   * Get server time
   */
  async getServerTime(): Promise<number> {
    const response = await this.client.get<{ serverTime: number }>('/api/v1/time');
    return response.serverTime;
  }

  /**
   * Get exchange info (trading rules and symbol info)
   */
  async getExchangeInfo(symbol?: string): Promise<ExchangeInfoResponse> {
    const params = symbol ? { symbol } : undefined;
    return this.client.get<ExchangeInfoResponse>('/api/v1/exchangeInfo', params);
  }

  /**
   * Get symbol info
   */
  async getSymbolInfo(symbol: string): Promise<SymbolInfo | undefined> {
    const info = await this.getExchangeInfo(symbol);
    const symbolData = info.symbols.find((s) => s.symbol === symbol);
    if (!symbolData) return undefined;

    return {
      symbol: symbolData.symbol,
      baseAsset: symbolData.baseAsset,
      quoteAsset: symbolData.quoteAsset,
      status: symbolData.status as SymbolInfo['status'],
      filters: symbolData.filters.map((f) => ({
        filterType: f.filterType,
        ...f,
      })) as SymbolInfo['filters'],
    };
  }

  /**
   * Get all trading symbols
   */
  async getSymbols(): Promise<SymbolInfo[]> {
    const info = await this.getExchangeInfo();
    return info.symbols
      .filter((s) => s.status === 'TRADING')
      .map((s) => ({
        symbol: s.symbol,
        baseAsset: s.baseAsset,
        quoteAsset: s.quoteAsset,
        status: s.status as SymbolInfo['status'],
        filters: s.filters.map((f) => ({
          filterType: f.filterType,
          ...f,
        })) as SymbolInfo['filters'],
      }));
  }

  /**
   * Get order book depth
   */
  async getOrderBook(symbol: string, limit: number = 100): Promise<OrderBook> {
    return this.client.get<OrderBook>('/api/v1/depth', { symbol, limit });
  }

  /**
   * Get recent trades
   */
  async getRecentTrades(symbol: string, limit: number = 500): Promise<Trade[]> {
    return this.client.get<Trade[]>('/api/v1/trades', { symbol, limit });
  }

  /**
   * Get kline/candlestick data
   */
  async getKlines(
    symbol: string,
    interval: string,
    options?: {
      startTime?: number;
      endTime?: number;
      limit?: number;
    }
  ): Promise<Kline[]> {
    const params = {
      symbol,
      interval,
      ...options,
    };

    const response = await this.client.get<Array<
      [number, string, string, string, string, string, number, string, number, string, string, string]
    >>('/api/v1/klines', params);

    return response.map((k) => ({
      openTime: k[0],
      open: k[1],
      high: k[2],
      low: k[3],
      close: k[4],
      volume: k[5],
      closeTime: k[6],
      quoteVolume: k[7],
      trades: k[8],
    }));
  }

  /**
   * Get 24hr ticker price change statistics
   */
  async get24hrTicker(symbol?: string): Promise<Ticker | Ticker[]> {
    const params = symbol ? { symbol } : undefined;
    return this.client.get('/api/v1/ticker/24hr', params);
  }

  /**
   * Get latest price for a symbol
   */
  async getPrice(symbol: string): Promise<number> {
    const response = await this.client.get<{ symbol: string; price: string }>(
      '/api/v1/ticker/price',
      { symbol }
    );
    return parseFloat(response.price);
  }

  /**
   * Get all latest prices
   */
  async getAllPrices(): Promise<Map<string, number>> {
    const response = await this.client.get<Array<{ symbol: string; price: string }>>(
      '/api/v1/ticker/price'
    );
    const prices = new Map<string, number>();
    response.forEach((p) => {
      prices.set(p.symbol, parseFloat(p.price));
    });
    return prices;
  }

  /**
   * Get best bid/ask price
   */
  async getBookTicker(symbol: string): Promise<{
    symbol: string;
    bidPrice: number;
    bidQty: number;
    askPrice: number;
    askQty: number;
  }> {
    const response = await this.client.get<{
      symbol: string;
      bidPrice: string;
      bidQty: string;
      askPrice: string;
      askQty: string;
    }>('/api/v1/ticker/bookTicker', { symbol });

    return {
      symbol: response.symbol,
      bidPrice: parseFloat(response.bidPrice),
      bidQty: parseFloat(response.bidQty),
      askPrice: parseFloat(response.askPrice),
      askQty: parseFloat(response.askQty),
    };
  }
}

export const marketApi = new MarketApi();
