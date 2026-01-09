import type {
  GridInstance,
  GridOrder,
  GridProfit,
  SymbolInfo,
  PriceFilter,
  LotSizeFilter,
} from '../types/index.js';
import { AsterApiClient } from './AsterApiClient.js';
import { GridCalculator } from './GridCalculator.js';
import { gridQueries } from '../database/db.js';
import { retryWithBackoff, Logger } from '../utils/retry.js';

/**
 * Grid Order Manager (Backend Version)
 * Manages grid trading lifecycle on the server
 */
export class GridOrderManager {
  private gridInstance: GridInstance;
  private apiClient: AsterApiClient;
  private tickSize: number;
  private stepSize: number;
  private makerFee: number;
  private takerFee: number;
  private isRunning: boolean = false;
  private pollingInterval: NodeJS.Timeout | null = null;
  private lastActivityTime: number = Date.now();
  private lastErrorTime: number | null = null;
  private errorCount: number = 0;
  private logger: Logger;

  constructor(
    gridInstance: GridInstance,
    symbolInfo: SymbolInfo,
    apiClient: AsterApiClient,
    fees: { maker: number; taker: number }
  ) {
    this.gridInstance = gridInstance;
    this.apiClient = apiClient;
    this.makerFee = fees.maker;
    this.takerFee = fees.taker;
    this.logger = new Logger(`Grid-${gridInstance.id}`);

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
   * Start the grid
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log(`[Grid ${this.gridInstance.id}] Already running`);
      return;
    }

    try {
      console.log(`[Grid ${this.gridInstance.id}] Starting...`);

      // Get current price
      const currentPrice = await this.apiClient.getPrice(this.gridInstance.config.symbol);

      // Calculate initial buy orders
      const buyOrders = GridCalculator.calculateInitialBuyOrders(
        this.gridInstance.config,
        currentPrice,
        this.tickSize,
        this.stepSize
      );

      console.log(`[Grid ${this.gridInstance.id}] Placing ${buyOrders.length} buy orders`);

      // Place all buy orders
      for (const order of buyOrders) {
        await this.placeBuyOrder(order.gridIndex, order.price, order.quantity);
      }

      this.isRunning = true;
      this.gridInstance.status = 'RUNNING';
      this.gridInstance.startedAt = Date.now();

      // Save to database
      this.saveToDatabase();

      console.log(`[Grid ${this.gridInstance.id}] Started successfully`);

      // Start order monitoring
      this.startOrderPolling();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[Grid ${this.gridInstance.id}] Failed to start:`, message);
      throw error;
    }
  }

  /**
   * Stop the grid
   */
  async stop(sellHoldings: boolean = false): Promise<void> {
    // Check if already stopped based on instance status, not just isRunning flag
    if (this.gridInstance.status === 'STOPPED') {
      console.log(`[Grid ${this.gridInstance.id}] Already stopped`);
      return;
    }

    console.log(`[Grid ${this.gridInstance.id}] Stopping...`);

    this.stopOrderPolling();

    try {
      // Cancel all open orders
      if (this.gridInstance.config.cancelOrdersOnStop) {
        await this.cancelAllOrders();
      }

      // Sell all holdings if requested
      if (sellHoldings && this.gridInstance.config.sellAllOnStop) {
        await this.sellAllHoldings();
      }

      this.isRunning = false;
      this.gridInstance.status = 'STOPPED';
      this.gridInstance.stoppedAt = Date.now();

      // Save to database
      this.saveToDatabase();

      console.log(`[Grid ${this.gridInstance.id}] Stopped successfully`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[Grid ${this.gridInstance.id}] Failed to stop:`, message);
      throw error;
    }
  }

  /**
   * Place a buy order
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
      const response = await this.apiClient.placeLimitOrder(
        this.gridInstance.config.symbol,
        'BUY',
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

      console.log(`[Grid ${this.gridInstance.id}] Buy order placed at ${price} for ${quantity}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[Grid ${this.gridInstance.id}] Failed to place buy order:`, message);
      throw error;
    }
  }

  /**
   * Place a sell order
   */
  private async placeSellOrder(
    gridIndex: number,
    quantity: number
  ): Promise<void> {
    const sellGridIndex = gridIndex + 1;
    const sellPrice = this.gridInstance.gridLevels[sellGridIndex]?.price;

    if (!sellPrice) {
      console.warn(`[Grid ${this.gridInstance.id}] No sell grid level for index ${sellGridIndex}`);
      return;
    }

    const adjustedPrice = GridCalculator.adjustToTickSize(sellPrice, this.tickSize);
    const clientOrderId = GridCalculator.generateOrderId(
      this.gridInstance.id,
      gridIndex,
      'SELL'
    );

    try {
      const response = await this.apiClient.placeLimitOrder(
        this.gridInstance.config.symbol,
        'SELL',
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

      console.log(`[Grid ${this.gridInstance.id}] Sell order placed at ${adjustedPrice} for ${quantity}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[Grid ${this.gridInstance.id}] Failed to place sell order:`, message);
      throw error;
    }
  }

  /**
   * Handle order filled
   */
  private async handleOrderFilled(order: GridOrder): Promise<void> {
    const level = this.gridInstance.gridLevels[order.gridIndex];

    if (order.side === 'BUY') {
      // Buy order filled - place sell order
      level.status = 'HOLDING';
      level.buyOrderId = undefined;
      this.gridInstance.baseAssetHolding += order.quantity;

      await this.placeSellOrder(order.gridIndex, order.quantity);
    } else {
      // Sell order filled - place new buy order
      level.status = 'EMPTY';
      level.sellOrderId = undefined;
      this.gridInstance.baseAssetHolding -= order.quantity;

      // Calculate profit
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

        console.log(`[Grid ${this.gridInstance.id}] Trade completed. Profit: ${profit.toFixed(4)}`);
      }

      // Place new buy order
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

    // Save to database after each trade
    this.saveToDatabase();
  }

  /**
   * Find matching buy order
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
   * Update total profit
   */
  private updateTotalProfit(): void {
    this.gridInstance.profit.totalProfit = this.gridInstance.profit.realizedProfit;
    this.gridInstance.profit.profitRate =
      (this.gridInstance.profit.totalProfit / this.gridInstance.config.investmentAmount) * 100;
  }

  /**
   * Cancel all open orders
   */
  private async cancelAllOrders(): Promise<void> {
    const openOrders = this.gridInstance.orders.filter(
      (o) => o.status === 'NEW' || o.status === 'PARTIALLY_FILLED'
    );

    console.log(`[Grid ${this.gridInstance.id}] Cancelling ${openOrders.length} open orders`);

    for (const order of openOrders) {
      try {
        await this.apiClient.cancelOrder(
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
      } catch (error) {
        console.error(`[Grid ${this.gridInstance.id}] Failed to cancel order ${order.orderId}:`, error);
      }
    }
  }

  /**
   * Sell all holdings
   */
  private async sellAllHoldings(): Promise<void> {
    if (this.gridInstance.baseAssetHolding <= 0) return;

    try {
      const quantity = GridCalculator.adjustToStepSize(
        this.gridInstance.baseAssetHolding,
        this.stepSize
      );

      if (quantity > 0) {
        await this.apiClient.placeMarketOrder(
          this.gridInstance.config.symbol,
          'SELL',
          quantity
        );

        this.gridInstance.baseAssetHolding = 0;
        console.log(`[Grid ${this.gridInstance.id}] Sold all holdings: ${quantity}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[Grid ${this.gridInstance.id}] Failed to sell holdings:`, message);
    }
  }

  /**
   * Start polling for order updates
   */
  private startOrderPolling(): void {
    this.pollingInterval = setInterval(() => {
      this.checkOrderUpdates().catch((error) => {
        console.error(`[Grid ${this.gridInstance.id}] Error checking order updates:`, error);
      });
    }, 3000);

    console.log(`[Grid ${this.gridInstance.id}] Order polling started`);
  }

  /**
   * Stop polling
   */
  private stopOrderPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      console.log(`[Grid ${this.gridInstance.id}] Order polling stopped`);
    }
  }

  /**
   * Check for order updates
   */
  private async checkOrderUpdates(): Promise<void> {
    if (!this.isRunning) return;

    try {
      const openOrders = await this.apiClient.getOpenOrders(this.gridInstance.config.symbol);
      const openOrderIds = new Set(openOrders.map((o) => o.orderId.toString()));

      // Find filled orders
      const pendingOrders = this.gridInstance.orders.filter(
        (o) => o.status === 'NEW' || o.status === 'PARTIALLY_FILLED'
      );

      for (const order of pendingOrders) {
        if (!openOrderIds.has(order.orderId)) {
          // Order is no longer open - check if filled
          const orderStatus = await this.apiClient.getOrder(
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

      // Update activity time on successful check
      this.lastActivityTime = Date.now();
      this.errorCount = 0; // Reset error count on success
    } catch (error) {
      // Track errors for health monitoring
      this.lastErrorTime = Date.now();
      this.errorCount++;
      console.error(`[Grid ${this.gridInstance.id}] Error in checkOrderUpdates (count: ${this.errorCount}):`, error);

      // If too many consecutive errors, log warning
      if (this.errorCount >= 5) {
        console.error(`[Grid ${this.gridInstance.id}] ⚠️ HIGH ERROR COUNT: ${this.errorCount} consecutive errors`);
      }
    }
  }

  /**
   * Check stop conditions
   */
  private async checkStopConditions(): Promise<void> {
    const config = this.gridInstance.config;

    if (!config.stopUpperPrice && !config.stopLowerPrice) return;

    try {
      const currentPrice = await this.apiClient.getPrice(config.symbol);

      if (config.stopUpperPrice && currentPrice >= config.stopUpperPrice) {
        console.log(`[Grid ${this.gridInstance.id}] Stop upper price triggered`);
        await this.stop(config.sellAllOnStop);
      } else if (config.stopLowerPrice && currentPrice <= config.stopLowerPrice) {
        console.log(`[Grid ${this.gridInstance.id}] Stop lower price triggered`);
        await this.stop(config.sellAllOnStop);
      }
    } catch (error) {
      console.error(`[Grid ${this.gridInstance.id}] Error checking stop conditions:`, error);
    }
  }

  /**
   * Save grid state to database
   */
  private saveToDatabase(): void {
    try {
      gridQueries.update.run({
        id: this.gridInstance.id,
        user_id: '', // Will be set by caller
        config: JSON.stringify(this.gridInstance.config),
        status: this.gridInstance.status,
        created_at: this.gridInstance.createdAt,
        started_at: this.gridInstance.startedAt || null,
        stopped_at: this.gridInstance.stoppedAt || null,
        grid_levels: JSON.stringify(this.gridInstance.gridLevels),
        orders: JSON.stringify(this.gridInstance.orders),
        profit: JSON.stringify(this.gridInstance.profit),
        base_asset_holding: this.gridInstance.baseAssetHolding,
      });
    } catch (error) {
      console.error(`[Grid ${this.gridInstance.id}] Failed to save to database:`, error);
    }
  }

  /**
   * Get current grid instance
   */
  getInstance(): GridInstance {
    return this.gridInstance;
  }

  /**
   * Check if running
   */
  getIsRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Resume monitoring for a recovered grid
   * Used when restoring grids after backend restart
   */
  resumeMonitoring(): void {
    if (this.isRunning) {
      console.log(`[Grid ${this.gridInstance.id}] Already monitoring`);
      return;
    }

    console.log(`[Grid ${this.gridInstance.id}] Resuming monitoring...`);
    this.isRunning = true;
    this.startOrderPolling();
    console.log(`[Grid ${this.gridInstance.id}] Monitoring resumed`);
  }

  /**
   * Get health status of this grid
   */
  getHealthStatus(): {
    isHealthy: boolean;
    lastActivityTime: number;
    lastErrorTime: number | null;
    errorCount: number;
    timeSinceActivity: number;
    warnings: string[];
  } {
    const now = Date.now();
    const timeSinceActivity = now - this.lastActivityTime;
    const warnings: string[] = [];

    // Check if activity is stale (no updates for 1 minute)
    if (this.isRunning && timeSinceActivity > 60000) {
      warnings.push(`No activity for ${Math.floor(timeSinceActivity / 1000)}s`);
    }

    // Check error count
    if (this.errorCount > 0) {
      warnings.push(`${this.errorCount} consecutive errors`);
    }

    // Check if error count is critical
    if (this.errorCount >= 10) {
      warnings.push('⚠️ CRITICAL: Too many errors');
    }

    const isHealthy = warnings.length === 0 || (this.errorCount < 5 && timeSinceActivity < 120000);

    return {
      isHealthy,
      lastActivityTime: this.lastActivityTime,
      lastErrorTime: this.lastErrorTime,
      errorCount: this.errorCount,
      timeSinceActivity,
      warnings,
    };
  }
}
