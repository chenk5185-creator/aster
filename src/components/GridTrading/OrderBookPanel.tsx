import React, { useEffect, useState } from 'react';
import { useMarketStore } from '../../stores';
import { marketApi } from '../../services/api';
import { formatSmartPrice, formatNumber } from '../../utils/format';
import type { OrderBook } from '../../types';
import { TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';

export const OrderBookPanel: React.FC = () => {
  const { currentSymbol } = useMarketStore();
  const [orderBook, setOrderBook] = useState<OrderBook | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOrderBook = async () => {
    if (!currentSymbol) return;

    setIsLoading(true);
    setError(null);
    try {
      const data = await marketApi.getOrderBook(currentSymbol, 20);
      setOrderBook(data);
    } catch (e) {
      setError('加载盘口数据失败');
      console.error('Failed to load order book:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOrderBook();
    // 定时刷新盘口数据
    const interval = setInterval(loadOrderBook, 5000);
    return () => clearInterval(interval);
  }, [currentSymbol]);

  if (isLoading && !orderBook) {
    return (
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-text-primary">盘口</h3>
        </div>
        <div className="flex justify-center py-8 text-text-muted text-sm">
          加载中...
        </div>
      </div>
    );
  }

  if (error || !orderBook) {
    return (
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-text-primary">盘口</h3>
          <button
            onClick={loadOrderBook}
            className="p-1 hover:bg-surface-light rounded transition-colors"
          >
            <RefreshCw className="h-4 w-4 text-text-muted" />
          </button>
        </div>
        <div className="flex justify-center py-8 text-text-muted text-sm">
          {error || '暂无数据'}
        </div>
      </div>
    );
  }

  // 取前10档买卖盘
  const asks = orderBook.asks.slice(0, 10).reverse();
  const bids = orderBook.bids.slice(0, 10);

  // 计算最大数量用于进度条
  const maxQty = Math.max(
    ...asks.map((a) => parseFloat(a[1])),
    ...bids.map((b) => parseFloat(b[1]))
  );

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-text-primary">盘口</h3>
        <button
          onClick={loadOrderBook}
          className="p-1 hover:bg-surface-light rounded transition-colors"
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 text-text-muted ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="space-y-1">
        {/* 卖盘 (Asks) - 从上到下价格递减 */}
        <div className="space-y-0.5">
          {asks.map((ask, i) => {
            const price = parseFloat(ask[0]);
            const qty = parseFloat(ask[1]);
            const percentage = (qty / maxQty) * 100;

            return (
              <div key={`ask-${i}`} className="relative h-5 flex items-center text-xs">
                {/* 背景条 */}
                <div
                  className="absolute right-0 h-full bg-error/10"
                  style={{ width: `${percentage}%` }}
                />
                {/* 内容 */}
                <div className="relative z-10 w-full flex justify-between px-2">
                  <span className="text-error font-medium">
                    <TrendingDown className="inline h-3 w-3 mr-0.5" />
                    {formatSmartPrice(price)}
                  </span>
                  <span className="text-text-muted">{formatNumber(qty, 4)}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* 中间分隔 */}
        <div className="border-t border-border my-2" />

        {/* 买盘 (Bids) - 从上到下价格递减 */}
        <div className="space-y-0.5">
          {bids.map((bid, i) => {
            const price = parseFloat(bid[0]);
            const qty = parseFloat(bid[1]);
            const percentage = (qty / maxQty) * 100;

            return (
              <div key={`bid-${i}`} className="relative h-5 flex items-center text-xs">
                {/* 背景条 */}
                <div
                  className="absolute right-0 h-full bg-success/10"
                  style={{ width: `${percentage}%` }}
                />
                {/* 内容 */}
                <div className="relative z-10 w-full flex justify-between px-2">
                  <span className="text-success font-medium">
                    <TrendingUp className="inline h-3 w-3 mr-0.5" />
                    {formatSmartPrice(price)}
                  </span>
                  <span className="text-text-muted">{formatNumber(qty, 4)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-border flex justify-between text-xs text-text-muted">
        <span>价格</span>
        <span>数量</span>
      </div>
    </div>
  );
};
