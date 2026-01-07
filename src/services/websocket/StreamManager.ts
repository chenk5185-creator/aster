const WS_BASE_URL = 'wss://sstream.asterdex.com/ws';

type MessageCallback = (data: unknown) => void;
type ConnectionCallback = () => void;

interface Subscription {
  stream: string;
  callbacks: Set<MessageCallback>;
}

/**
 * WebSocket Stream Manager for real-time market data
 */
export class StreamManager {
  private ws: WebSocket | null = null;
  private subscriptions: Map<string, Subscription> = new Map();
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private isConnecting: boolean = false;

  private onConnectCallbacks: Set<ConnectionCallback> = new Set();
  private onDisconnectCallbacks: Set<ConnectionCallback> = new Set();
  private baseUrl: string;

  constructor(baseUrl: string = WS_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Connect to WebSocket server
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      if (this.isConnecting) {
        // Wait for existing connection attempt
        const checkConnection = setInterval(() => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            clearInterval(checkConnection);
            resolve();
          }
        }, 100);
        return;
      }

      this.isConnecting = true;

      try {
        this.ws = new WebSocket(this.baseUrl);

        this.ws.onopen = () => {
          console.log('[WS] Connected');
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.startPingInterval();
          this.resubscribeAll();
          this.onConnectCallbacks.forEach((cb) => cb());
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (e) {
            console.error('[WS] Failed to parse message:', e);
          }
        };

        this.ws.onerror = (error) => {
          console.error('[WS] Error:', error);
          this.isConnecting = false;
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('[WS] Disconnected');
          this.isConnecting = false;
          this.stopPingInterval();
          this.onDisconnectCallbacks.forEach((cb) => cb());
          this.handleReconnect();
        };
      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    this.stopPingInterval();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.subscriptions.clear();
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(data: Record<string, unknown>): void {
    // Handle stream data
    const stream = data.stream as string | undefined;
    if (stream && this.subscriptions.has(stream)) {
      const subscription = this.subscriptions.get(stream)!;
      subscription.callbacks.forEach((callback) => {
        callback(data.data || data);
      });
    }

    // Handle combined stream format
    if (data.e) {
      // Event type based routing
      const eventType = data.e as string;
      const symbol = (data.s as string)?.toLowerCase();

      if (eventType && symbol) {
        // Try to find matching subscription
        const possibleStreams = [
          `${symbol}@${eventType}`,
          `${symbol}@ticker`,
          `${symbol}@aggTrade`,
          `${symbol}@trade`,
        ];

        for (const streamName of possibleStreams) {
          if (this.subscriptions.has(streamName)) {
            const subscription = this.subscriptions.get(streamName)!;
            subscription.callbacks.forEach((callback) => {
              callback(data);
            });
            break;
          }
        }
      }
    }
  }

  /**
   * Handle reconnection with exponential backoff
   */
  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WS] Max reconnection attempts reached');
      return;
    }

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

    console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      this.connect().catch((e) => {
        console.error('[WS] Reconnection failed:', e);
      });
    }, delay);
  }

  /**
   * Start ping interval to keep connection alive
   */
  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ method: 'ping' }));
      }
    }, 30000);
  }

  /**
   * Stop ping interval
   */
  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Subscribe to a stream
   */
  subscribe(stream: string, callback: MessageCallback): () => void {
    const normalizedStream = stream.toLowerCase();

    if (!this.subscriptions.has(normalizedStream)) {
      this.subscriptions.set(normalizedStream, {
        stream: normalizedStream,
        callbacks: new Set(),
      });
      this.sendSubscribe(normalizedStream);
    }

    this.subscriptions.get(normalizedStream)!.callbacks.add(callback);

    // Return unsubscribe function
    return () => {
      this.unsubscribe(normalizedStream, callback);
    };
  }

  /**
   * Unsubscribe from a stream
   */
  private unsubscribe(stream: string, callback: MessageCallback): void {
    const subscription = this.subscriptions.get(stream);
    if (!subscription) return;

    subscription.callbacks.delete(callback);

    if (subscription.callbacks.size === 0) {
      this.sendUnsubscribe(stream);
      this.subscriptions.delete(stream);
    }
  }

  /**
   * Send subscribe message to server
   */
  private sendSubscribe(stream: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          method: 'SUBSCRIBE',
          params: [stream],
          id: Date.now(),
        })
      );
    }
  }

  /**
   * Send unsubscribe message to server
   */
  private sendUnsubscribe(stream: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          method: 'UNSUBSCRIBE',
          params: [stream],
          id: Date.now(),
        })
      );
    }
  }

  /**
   * Resubscribe to all streams after reconnection
   */
  private resubscribeAll(): void {
    const streams = Array.from(this.subscriptions.keys());
    if (streams.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          method: 'SUBSCRIBE',
          params: streams,
          id: Date.now(),
        })
      );
    }
  }

  /**
   * Subscribe to ticker updates
   */
  subscribeToTicker(symbol: string, callback: (data: TickerData) => void): () => void {
    return this.subscribe(`${symbol.toLowerCase()}@ticker`, callback as MessageCallback);
  }

  /**
   * Subscribe to trade updates
   */
  subscribeToTrades(symbol: string, callback: (data: TradeData) => void): () => void {
    return this.subscribe(`${symbol.toLowerCase()}@aggTrade`, callback as MessageCallback);
  }

  /**
   * Subscribe to order book updates
   */
  subscribeToOrderBook(
    symbol: string,
    callback: (data: OrderBookData) => void,
    levels: number = 10
  ): () => void {
    return this.subscribe(
      `${symbol.toLowerCase()}@depth${levels}`,
      callback as MessageCallback
    );
  }

  /**
   * Subscribe to kline/candlestick updates
   */
  subscribeToKlines(
    symbol: string,
    interval: string,
    callback: (data: KlineData) => void
  ): () => void {
    return this.subscribe(
      `${symbol.toLowerCase()}@kline_${interval}`,
      callback as MessageCallback
    );
  }

  /**
   * Add connection callback
   */
  onConnect(callback: ConnectionCallback): () => void {
    this.onConnectCallbacks.add(callback);
    return () => this.onConnectCallbacks.delete(callback);
  }

  /**
   * Add disconnection callback
   */
  onDisconnect(callback: ConnectionCallback): () => void {
    this.onDisconnectCallbacks.add(callback);
    return () => this.onDisconnectCallbacks.delete(callback);
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// WebSocket data types
export interface TickerData {
  e: '24hrTicker';
  s: string; // Symbol
  p: string; // Price change
  P: string; // Price change percent
  w: string; // Weighted average price
  c: string; // Last price
  Q: string; // Last quantity
  o: string; // Open price
  h: string; // High price
  l: string; // Low price
  v: string; // Volume
  q: string; // Quote volume
}

export interface TradeData {
  e: 'aggTrade';
  s: string; // Symbol
  p: string; // Price
  q: string; // Quantity
  T: number; // Trade time
  m: boolean; // Is buyer maker
}

export interface OrderBookData {
  lastUpdateId: number;
  bids: [string, string][];
  asks: [string, string][];
}

export interface KlineData {
  e: 'kline';
  s: string; // Symbol
  k: {
    t: number; // Kline start time
    T: number; // Kline close time
    s: string; // Symbol
    i: string; // Interval
    o: string; // Open
    c: string; // Close
    h: string; // High
    l: string; // Low
    v: string; // Volume
    x: boolean; // Is closed
  };
}

// Default instance
export const streamManager = new StreamManager();
