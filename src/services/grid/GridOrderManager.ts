import type {
  GridInstance,
  GridOrder,
  GridProfit,
  SymbolInfo,
  PriceFilter,
  LotSizeFilter,
} from '../../types';
import { TradingApi } from '../api/trading';
import { MarketApi } from '../api/market';
import { GridCalculator } from './GridCalculator';


type GridEventCallback = (event: GridEvent) => void;

export type GridEvent =
  | { type: 'ORDER_PLACED'; gridIndex: number; side: 'BUY' | 'SELL'; orderId: string }
  | { type: 'ORDER_FILLED'; gridIndex: number; side: 'BUY' | 'SELL'; orderId: string }
  | { type: 'ORDER_CANCELLED'; gridIndex: number; orderId: string }
  | { type: 'GRID_STARTED'; gridId: string }
  | { type: 'GRID_STOPPED'; gridId: string; reason: string }
  | { type: 'PROFIT_UPDATED'; profit: GridProfit }
  | { type: 'ERROR'; message: string };

/**
 * Grid Order Manager
 * Manages the lifecycle of grid trading orders
 */
export class GridOrderManager {
  private gridInstance: GridInstance;
  private tradingApi: TradingApi;
  private marketApi: MarketApi;
  private tickSize: number;
  private stepSize: number;
  private makerFee: number;
  private takerFee: number;
  private eventCallbacks: Set<GridEventCallback> = new Set();
  private isRunning: boolean = false;
  private pollingInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    gridInstance: GridInstance,
    symbolInfo: SymbolInfo,
    tradingApi: TradingApi,
    marketApi: MarketApi,
    fees: { maker: number; taker: number }
  ) {
    this.gridInstance = gridInstance;
    this.tradingApi = tradingApi;
    this.marketApi = marketApi;
    this.makerFee = fees.maker;
    this.takerFee = fees.taker; // Used for profit calculation

    // Extract tick and step size from filters
    const priceFilter = symbolInfo.filters.find(
      (f) => f.filterType === 'PRICE_FILTER'
    ) as PriceFilter | undefined;
    const lotFilter = symbolInfo.filters.find(
      (f) => f.filterType === 'LOT_SIZE'
    ) as LotSizeFilter | undefined;

    this.tickSize = priceFilter ? parseFloat(priceFilter.tickSize) : 0.01;
    this.stepSize = lotFilter ? parseFloat(lotFilter.stepSize) : 0.00001;
  }

  /**
   * Subscribe to grid events
   */
  onEvent(callback: GridEventCallback): () => void {
    this.eventCallbacks.add(callback);
    return () => this.eventCallbacks.delete(callback);
  }

  /**
   * Emit grid event
   */
  private emit(event: GridEvent): void {
    this.eventCallbacks.forEach((cb) => cb(event));
  }

  /**
   * Start the grid
   */
  async start(): Promise<void> {
    if (this.isRunning) return;

    try {
      // Get current price
      const currentPrice = await this.marketApi.getPrice(this.gridInstance.config.symbol);

      // Calculate initial buy orders
      const buyOrders = GridCalculator.calculateInitialBuyOrders(
        this.gridInstance.config,
        currentPrice,
        this.tickSize,
        this.stepSize
      );

      // Place all buy orders
      for (const order of buyOrders) {
        await this.placeBuyOrder(order.gridIndex, order.price, order.quantity);
      }

      this.isRunning = true;
      this.gridInstance.status = 'RUNNING';
      this.gridInstance.startedAt = Date.now();

      this.emit({ type: 'GRID_STARTED', gridId: this.gridInstance.id });

      // Start order monitoring
      this.startOrderPolling();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.emit({ type: 'ERROR', message: `Failed to start grid: ${message}` });
      throw error;
    }
  }

  /**
   * Stop the grid
   */
  async stop(sellHoldings: boolean = false): Promise<void> {
    if (!this.isRunning) return;

    this.stopOrderPolling();

    try {
      // Cancel all open orders if configured
      if (this.gridInstance.config.cancelOrdersOnStop) {
        await this.cancelAllOrders();
      }

      // Sell all holdings if configured and requested
      if (sellHoldings && this.gridInstance.config.sellAllOnStop) {
        await this.sellAllHoldings();
      }

      this.isRunning = false;
      this.gridInstance.status = 'STOPPED';
      this.gridInstance.stoppedAt = Date.now();

      this.emit({ type: 'GRID_STOPPED', gridId: this.gridInstance.id, reason: 'manual' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.emit({ type: 'ERROR', message: `Failed to stop grid: ${message}` });
      throw error;
    }
  }

  /**
   * Place a buy order at a grid level
   */
  private async placeBuyOrder(
    gridIndex: number,
    price: number,
    quantity: number
  ): Promise<void> {
    const clientOrderId = GridCalculator.generateOrderId(
      this.gridInstance.id,
      gridIndex,
      'BUY'
    );

    try {
      const response = await this.tradingApi.placeLimitBuy(
        this.gridInstance.config.symbol,
        quantity,
        price,
        clientOrderId
      );

      // Update grid level
      const level = this.gridInstance.gridLevels[gridIndex];
      level.buyOrderId = response.orderId.toString();
      level.status = 'BUY_PENDING';
      level.quantity = quantity;

      // Add to orders list
      this.gridInstance.orders.push({
        orderId: response.orderId.toString(),
        clientOrderId,
        gridIndex,
        side: 'BUY',
        price,
        quantity,
        executedQty: 0,
        status: 'NEW',
        createdAt: Date.now(),
      });

      this.emit({
        type: 'ORDER_PLACED',
        gridIndex,
        side: 'BUY',
        orderId: response.orderId.toString(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.emit({ type: 'ERROR', message: `Failed to place buy order: ${message}` });
      throw error;
    }
  }

  /**
   * Place a sell order at a grid level
   */
  private async placeSellOrder(
    gridIndex: number,
    _price: number,
    quantity: number
  ): Promise<void> {
    // Sell at the grid level above (price param is the buy price, not used directly)
    const sellGridIndex = gridIndex + 1;
    const sellPrice = this.gridInstance.gridLevels[sellGridIndex]?.price;

    if (!sellPrice) {
      console.warn(`No sell grid level for index ${sellGridIndex}`);
      return;
    }

    const adjustedPrice = GridCalculator.adjustToTickSize(sellPrice, this.tickSize);
    const clientOrderId = GridCalculator.generateOrderId(
      this.gridInstance.id,
      gridIndex,
      'SELL'
    );

    try {
      const response = await this.tradingApi.placeLimitSell(
        this.gridInstance.config.symbol,
        quantity,
        adjustedPrice,
        clientOrderId
      );

      // Update grid level
      const level = this.gridInstance.gridLevels[gridIndex];
      level.sellOrderId = response.orderId.toString();
      level.status = 'SELL_PENDING';

      // Add to orders list
      this.gridInstance.orders.push({
        orderId: response.orderId.toString(),
        clientOrderId,
        gridIndex,
        side: 'SELL',
        price: adjustedPrice,
        quantity,
        executedQty: 0,
        status: 'NEW',
        createdAt: Date.now(),
      });

      this.emit({
        type: 'ORDER_PLACED',
        gridIndex,
        side: 'SELL',
        orderId: response.orderId.toString(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.emit({ type: 'ERROR', message: `Failed to place sell order: ${message}` });
      throw error;
    }
  }

  /**
   * Handle order fill
   */
  private async handleOrderFilled(order: GridOrder): Promise<void> {
    const level = this.gridInstance.gridLevels[order.gridIndex];

    if (order.side === 'BUY') {
      // Buy order filled - place corresponding sell order
      level.status = 'HOLDING';
      level.buyOrderId = undefined;
      this.gridInstance.baseAssetHolding += order.quantity;

      await this.placeSellOrder(order.gridIndex, level.price, order.quantity);
    } else {
      // Sell order filled - place new buy order at this level
      level.status = 'EMPTY';
      level.sellOrderId = undefined;
      this.gridInstance.baseAssetHolding -= order.quantity;

      // Calculate profit for this round trip
      const buyOrder = this.findMatchingBuyOrder(order);
      if (buyOrder) {
        const profit = GridCalculator.calculateGridProfit(
          buyOrder.price,
          order.price,
          order.quantity,
          this.makerFee,
          this.takerFee
        );

        this.gridInstance.profit.realizedProfit += profit;
        this.gridInstance.profit.tradingCount += 1;
        this.gridInstance.profit.totalFees +=
          (buyOrder.price + order.price) * order.quantity * this.makerFee;

        this.updateTotalProfit();
      }

      // Place new buy order at this level
      const amountPerGrid = GridCalculator.calculateAmountPerGrid(
        this.gridInstance.config.investmentAmount,
        level.price,
        this.gridInstance.gridLevels.map((l) => l.price)
      );
      const quantity = GridCalculator.adjustToStepSize(
        amountPerGrid / level.price,
        this.stepSize
      );

      if (quantity > 0) {
        await this.placeBuyOrder(
          order.gridIndex,
          GridCalculator.adjustToTickSize(level.price, this.tickSize),
          quantity
        );
      }
    }

    this.emit({
      type: 'ORDER_FILLED',
      gridIndex: order.gridIndex,
      side: order.side,
      orderId: order.orderId,
    });
  }

  /**
   * Find matching buy order for a sell order
   */
  private findMatchingBuyOrder(sellOrder: GridOrder): GridOrder | undefined {
    return this.gridInstance.orders.find(
      (o) =>
        o.gridIndex === sellOrder.gridIndex &&
        o.side === 'BUY' &&
        o.status === 'FILLED'
    );
  }

  /**
   * Update total profit calculation
   */
  private updateTotalProfit(): void {
    // Unrealized profit would need current price
    // For now, just use realized profit
    this.gridInstance.profit.totalProfit = this.gridInstance.profit.realizedProfit;
    this.gridInstance.profit.profitRate =
      (this.gridInstance.profit.totalProfit / this.gridInstance.config.investmentAmount) * 100;

    this.emit({ type: 'PROFIT_UPDATED', profit: { ...this.gridInstance.profit } });
  }

  /**
   * Cancel all open orders
   */
  private async cancelAllOrders(): Promise<void> {
    const openOrders = this.gridInstance.orders.filter(
      (o) => o.status === 'NEW' || o.status === 'PARTIALLY_FILLED'
    );

    for (const order of openOrders) {
      try {
        await this.tradingApi.cancelOrder(
          this.gridInstance.config.symbol,
          parseInt(order.orderId)
        );

        order.status = 'CANCELED';
        const level = this.gridInstance.gridLevels[order.gridIndex];
        if (order.side === 'BUY') {
          level.buyOrderId = undefined;
        } else {
          level.sellOrderId = undefined;
        }
        level.status = 'EMPTY';

        this.emit({
          type: 'ORDER_CANCELLED',
          gridIndex: order.gridIndex,
          orderId: order.orderId,
        });
      } catch (error) {
        console.error(`Failed to cancel order ${order.orderId}:`, error);
      }
    }
  }

  /**
   * Sell all holdings at market price
   */
  private async sellAllHoldings(): Promise<void> {
    if (this.gridInstance.baseAssetHolding <= 0) return;

    try {
      const quantity = GridCalculator.adjustToStepSize(
        this.gridInstance.baseAssetHolding,
        this.stepSize
      );

      if (quantity > 0) {
        await this.tradingApi.placeMarketSell(
          this.gridInstance.config.symbol,
          quantity
        );

        this.gridInstance.baseAssetHolding = 0;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.emit({ type: 'ERROR', message: `Failed to sell holdings: ${message}` });
    }
  }

  /**
   * Start polling for order updates
   */
  private startOrderPolling(): void {
    this.pollingInterval = setInterval(() => {
      this.checkOrderUpdates();
    }, 3000);
  }

  /**
   * Stop polling for order updates
   */
  private stopOrderPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  /**
   * Check for order updates
   */
  private async checkOrderUpdates(): Promise<void> {
    if (!this.isRunning) return;

    try {
      const openOrders = await this.tradingApi.getOpenOrders(
        this.gridInstance.config.symbol
      );

      const openOrderIds = new Set(openOrders.map((o) => o.orderId.toString()));

      // Find orders that were filled (no longer in open orders)
      const pendingOrders = this.gridInstance.orders.filter(
        (o) => o.status === 'NEW' || o.status === 'PARTIALLY_FILLED'
      );

      for (const order of pendingOrders) {
        if (!openOrderIds.has(order.orderId)) {
          // Order is no longer open - check if it was filled
          const orderStatus = await this.tradingApi.getOrder(
            this.gridInstance.config.symbol,
            parseInt(order.orderId)
          );

          if (orderStatus.status === 'FILLED') {
            order.status = 'FILLED';
            order.executedQty = parseFloat(orderStatus.executedQty);
            order.filledAt = Date.now();

            await this.handleOrderFilled(order);
          } else if (orderStatus.status === 'CANCELED') {
            order.status = 'CANCELED';
          }
        }
      }

      // Check stop conditions
      await this.checkStopConditions();
    } catch (error) {
      console.error('Error checking order updates:', error);
    }
  }

  /**
   * Check stop conditions (price limits)
   */
  private async checkStopConditions(): Promise<void> {
    const config = this.gridInstance.config;

    // Skip if no stop prices are set
    if (!config.stopUpperPrice && !config.stopLowerPrice) return;

    try {
      const currentPrice = await this.marketApi.getPrice(config.symbol);

      if (config.stopUpperPrice && currentPrice >= config.stopUpperPrice) {
        await this.stop(config.sellAllOnStop);
        this.emit({
          type: 'GRID_STOPPED',
          gridId: this.gridInstance.id,
          reason: 'stop_upper_triggered',
        });
      } else if (config.stopLowerPrice && currentPrice <= config.stopLowerPrice) {
        await this.stop(config.sellAllOnStop);
        this.emit({
          type: 'GRID_STOPPED',
          gridId: this.gridInstance.id,
          reason: 'stop_lower_triggered',
        });
      }
    } catch (error) {
      console.error('Error checking stop conditions:', error);
    }
  }

  /**
   * Get current grid instance
   */
  getInstance(): GridInstance {
    return this.gridInstance;
  }

  /**
   * Check if grid is running
   */
  getIsRunning(): boolean {
    return this.isRunning;
  }
}
