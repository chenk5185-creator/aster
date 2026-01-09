import { useState, useEffect } from 'react';
import { Modal, Button } from '../common';
import { useGridStore, useMarketStore } from '../../stores';
import { formatNumber, formatPercent, formatDateTime, formatSmartPrice } from '../../utils/format';
import type { GridInstance, GridLevel } from '../../types';
import { Play, Square, Trash2, ArrowDown, ArrowUp } from 'lucide-react';
import { ProfitHistoryChart } from './ProfitHistoryChart';

interface GridDetailModalProps {
  grid: GridInstance;
  isOpen: boolean;
  onClose: () => void;
}

export const GridDetailModal: React.FC<GridDetailModalProps> = ({
  grid,
  isOpen,
  onClose,
}) => {
  const { startGrid, stopGrid, removeGrid, refreshGrid } = useGridStore();
  const { prices } = useMarketStore();
  const [isLoading, setIsLoading] = useState(false);
  const [sellOnStop, setSellOnStop] = useState(false);

  // Auto-refresh grid data every 3 seconds when modal is open
  useEffect(() => {
    if (!isOpen) return;

    const refreshInterval = setInterval(() => {
      refreshGrid(grid.id);
    }, 3000);

    return () => clearInterval(refreshInterval);
  }, [isOpen, grid.id, refreshGrid]);

  const currentPrice = prices.get(grid.config.symbol) || 0;
  const profitColor = grid.profit.totalProfit >= 0 ? 'text-success' : 'text-error';

  const handleStart = async () => {
    setIsLoading(true);
    try {
      await startGrid(grid.id);
    } catch (error) {
      console.error('Failed to start grid:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStop = async () => {
    setIsLoading(true);
    try {
      await stopGrid(grid.id, sellOnStop);
    } catch (error) {
      console.error('Failed to stop grid:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemove = () => {
    if (confirm('确定要删除这个网格吗？此操作无法撤销。')) {
      removeGrid(grid.id);
      onClose();
    }
  };

  const getLevelStatusColor = (level: GridLevel): string => {
    switch (level.status) {
      case 'BUY_PENDING':
        return 'bg-primary/20 border-primary';
      case 'HOLDING':
        return 'bg-success/20 border-success';
      case 'SELL_PENDING':
        return 'bg-warning/20 border-warning';
      default:
        return 'bg-surface-light border-border';
    }
  };

  const getLevelStatusLabel = (level: GridLevel): string => {
    switch (level.status) {
      case 'BUY_PENDING':
        return '买单挂单中';
      case 'HOLDING':
        return '已持有';
      case 'SELL_PENDING':
        return '卖单挂单中';
      default:
        return '空仓';
    }
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'PENDING': return '待启动';
      case 'RUNNING': return '运行中';
      case 'STOPPED': return '已停止';
      case 'COMPLETED': return '已完成';
      default: return status;
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`网格交易：${grid.config.symbol}`} size="lg">
      <div className="space-y-6">
        {/* Status Bar */}
        <div className="flex items-center justify-between p-4 bg-surface-light rounded-lg">
          <div>
            <span className="text-text-muted text-sm">状态</span>
            <div className="text-lg font-semibold text-text-primary">{getStatusLabel(grid.status)}</div>
          </div>
          <div>
            <span className="text-text-muted text-sm">当前价格</span>
            <div className="text-lg font-semibold text-text-primary">
              {currentPrice > 0 ? formatSmartPrice(currentPrice) : '-'} {grid.config.symbol.replace(/USDT|USDC|BTC|ETH|BNB/, (m) => m)}
            </div>
          </div>
          <div>
            <span className="text-text-muted text-sm">总盈亏</span>
            <div className={`text-lg font-semibold ${profitColor}`}>
              {formatNumber(grid.profit.totalProfit, 4)} USDT
            </div>
          </div>
        </div>

        {/* Configuration */}
        <div>
          <h3 className="text-sm font-medium text-text-secondary mb-3">网格配置</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <span className="text-text-muted text-sm block">价格上限</span>
              <span className="text-text-primary">{formatSmartPrice(grid.config.upperPrice)}</span>
            </div>
            <div>
              <span className="text-text-muted text-sm block">价格下限</span>
              <span className="text-text-primary">{formatSmartPrice(grid.config.lowerPrice)}</span>
            </div>
            <div>
              <span className="text-text-muted text-sm block">网格数量</span>
              <span className="text-text-primary">{grid.config.gridCount}</span>
            </div>
            <div>
              <span className="text-text-muted text-sm block">网格类型</span>
              <span className="text-text-primary">{grid.config.gridType === 'ARITHMETIC' ? '等差' : '等比'}</span>
            </div>
            <div>
              <span className="text-text-muted text-sm block">投资金额</span>
              <span className="text-text-primary">{formatNumber(grid.config.investmentAmount, 2)} USDT</span>
            </div>
            <div>
              <span className="text-text-muted text-sm block">创建时间</span>
              <span className="text-text-primary">{formatDateTime(grid.createdAt)}</span>
            </div>
          </div>
        </div>

        {/* Profit Statistics */}
        <div>
          <h3 className="text-sm font-medium text-text-secondary mb-3">盈亏统计</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 bg-surface-light rounded-lg">
            <div>
              <span className="text-text-muted text-sm block">已实现盈亏</span>
              <span className={grid.profit.realizedProfit >= 0 ? 'text-success' : 'text-error'}>
                {formatNumber(grid.profit.realizedProfit, 4)} USDT
              </span>
            </div>
            <div>
              <span className="text-text-muted text-sm block">未实现盈亏</span>
              <span className={grid.profit.unrealizedProfit >= 0 ? 'text-success' : 'text-error'}>
                {formatNumber(grid.profit.unrealizedProfit, 4)} USDT
              </span>
            </div>
            <div>
              <span className="text-text-muted text-sm block">盈亏率</span>
              <span className={grid.profit.profitRate >= 0 ? 'text-success' : 'text-error'}>
                {formatPercent(grid.profit.profitRate)}
              </span>
            </div>
            <div>
              <span className="text-text-muted text-sm block">成交笔数</span>
              <span className="text-text-primary">{grid.profit.tradingCount}</span>
            </div>
            <div>
              <span className="text-text-muted text-sm block">总手续费</span>
              <span className="text-text-primary">{formatNumber(grid.profit.totalFees, 4)} USDT</span>
            </div>
            <div>
              <span className="text-text-muted text-sm block">持仓数量</span>
              <span className="text-text-primary">
                {formatNumber(grid.baseAssetHolding, 6)} {grid.config.symbol.replace(/USDT|USDC|BTC|ETH|BNB/, '')}
              </span>
            </div>
          </div>
        </div>

        {/* Profit History Chart */}
        {grid.profit.tradingCount > 0 && (
          <div>
            <ProfitHistoryChart gridId={grid.id} />
          </div>
        )}

        {/* Grid Levels */}
        <div>
          <h3 className="text-sm font-medium text-text-secondary mb-3">网格层级</h3>
          <div className="max-h-64 overflow-y-auto space-y-2">
            {grid.gridLevels
              .slice()
              .reverse()
              .map((level) => {
                const isAbovePrice = currentPrice > 0 && level.price > currentPrice;
                return (
                  <div
                    key={level.index}
                    className={`flex items-center justify-between p-2 rounded border ${getLevelStatusColor(level)}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-text-muted text-xs">#{level.index + 1}</span>
                      <span className="text-text-primary font-mono">
                        {formatSmartPrice(level.price)}
                      </span>
                      {isAbovePrice ? (
                        <ArrowUp className="h-3 w-3 text-success" />
                      ) : (
                        <ArrowDown className="h-3 w-3 text-error" />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-text-secondary">
                        {getLevelStatusLabel(level)}
                      </span>
                      {level.quantity && (
                        <span className="text-xs text-text-muted">
                          {formatNumber(level.quantity, 6)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Stop Options (only when running) */}
        {grid.status === 'RUNNING' && (
          <div className="flex items-center gap-2 p-3 bg-warning/10 rounded-lg">
            <input
              type="checkbox"
              id="sellOnStop"
              checked={sellOnStop}
              onChange={(e) => setSellOnStop(e.target.checked)}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
            />
            <label htmlFor="sellOnStop" className="text-sm text-text-secondary">
              停止时卖出所有持仓
            </label>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-border">
          {grid.status === 'PENDING' && (
            <Button onClick={handleStart} isLoading={isLoading}>
              <Play className="h-4 w-4 mr-2" />
              启动网格
            </Button>
          )}
          {grid.status === 'RUNNING' && (
            <Button variant="outline" onClick={handleStop} isLoading={isLoading}>
              <Square className="h-4 w-4 mr-2" />
              停止网格
            </Button>
          )}
          {(grid.status === 'STOPPED' || grid.status === 'COMPLETED') && (
            <Button variant="outline" onClick={handleRemove}>
              <Trash2 className="h-4 w-4 mr-2" />
              删除网格
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            关闭
          </Button>
        </div>
      </div>
    </Modal>
  );
};
