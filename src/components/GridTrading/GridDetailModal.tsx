import { useState } from 'react';
import { Modal, Button } from '../common';
import { useGridStore, useMarketStore } from '../../stores';
import { formatNumber, formatPercent, formatDateTime } from '../../utils/format';
import type { GridInstance, GridLevel } from '../../types';
import { Play, Square, Trash2, ArrowDown, ArrowUp } from 'lucide-react';

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
  const { startGrid, stopGrid, removeGrid } = useGridStore();
  const { prices } = useMarketStore();
  const [isLoading, setIsLoading] = useState(false);
  const [sellOnStop, setSellOnStop] = useState(false);

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
    if (confirm('Are you sure you want to remove this grid?')) {
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
        return 'Buy Order';
      case 'HOLDING':
        return 'Holding';
      case 'SELL_PENDING':
        return 'Sell Order';
      default:
        return 'Empty';
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Grid: ${grid.config.symbol}`} size="lg">
      <div className="space-y-6">
        {/* Status Bar */}
        <div className="flex items-center justify-between p-4 bg-surface-light rounded-lg">
          <div>
            <span className="text-text-muted text-sm">Status</span>
            <div className="text-lg font-semibold text-text-primary">{grid.status}</div>
          </div>
          <div>
            <span className="text-text-muted text-sm">Current Price</span>
            <div className="text-lg font-semibold text-text-primary">
              {currentPrice > 0 ? formatNumber(currentPrice, 2) : '-'} USDT
            </div>
          </div>
          <div>
            <span className="text-text-muted text-sm">Total Profit</span>
            <div className={`text-lg font-semibold ${profitColor}`}>
              {formatNumber(grid.profit.totalProfit, 2)} USDT
            </div>
          </div>
        </div>

        {/* Configuration */}
        <div>
          <h3 className="text-sm font-medium text-text-secondary mb-3">Configuration</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <span className="text-text-muted text-sm block">Upper Price</span>
              <span className="text-text-primary">{formatNumber(grid.config.upperPrice, 2)} USDT</span>
            </div>
            <div>
              <span className="text-text-muted text-sm block">Lower Price</span>
              <span className="text-text-primary">{formatNumber(grid.config.lowerPrice, 2)} USDT</span>
            </div>
            <div>
              <span className="text-text-muted text-sm block">Grid Count</span>
              <span className="text-text-primary">{grid.config.gridCount}</span>
            </div>
            <div>
              <span className="text-text-muted text-sm block">Grid Type</span>
              <span className="text-text-primary">{grid.config.gridType}</span>
            </div>
            <div>
              <span className="text-text-muted text-sm block">Investment</span>
              <span className="text-text-primary">{formatNumber(grid.config.investmentAmount, 2)} USDT</span>
            </div>
            <div>
              <span className="text-text-muted text-sm block">Created</span>
              <span className="text-text-primary">{formatDateTime(grid.createdAt)}</span>
            </div>
          </div>
        </div>

        {/* Profit Statistics */}
        <div>
          <h3 className="text-sm font-medium text-text-secondary mb-3">Profit Statistics</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 bg-surface-light rounded-lg">
            <div>
              <span className="text-text-muted text-sm block">Realized Profit</span>
              <span className={grid.profit.realizedProfit >= 0 ? 'text-success' : 'text-error'}>
                {formatNumber(grid.profit.realizedProfit, 4)} USDT
              </span>
            </div>
            <div>
              <span className="text-text-muted text-sm block">Unrealized Profit</span>
              <span className={grid.profit.unrealizedProfit >= 0 ? 'text-success' : 'text-error'}>
                {formatNumber(grid.profit.unrealizedProfit, 4)} USDT
              </span>
            </div>
            <div>
              <span className="text-text-muted text-sm block">Profit Rate</span>
              <span className={grid.profit.profitRate >= 0 ? 'text-success' : 'text-error'}>
                {formatPercent(grid.profit.profitRate)}
              </span>
            </div>
            <div>
              <span className="text-text-muted text-sm block">Total Trades</span>
              <span className="text-text-primary">{grid.profit.tradingCount}</span>
            </div>
            <div>
              <span className="text-text-muted text-sm block">Total Fees</span>
              <span className="text-text-primary">{formatNumber(grid.profit.totalFees, 4)} USDT</span>
            </div>
            <div>
              <span className="text-text-muted text-sm block">Holdings</span>
              <span className="text-text-primary">
                {formatNumber(grid.baseAssetHolding, 6)} {grid.config.symbol.replace('USDT', '')}
              </span>
            </div>
          </div>
        </div>

        {/* Grid Levels */}
        <div>
          <h3 className="text-sm font-medium text-text-secondary mb-3">Grid Levels</h3>
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
                        {formatNumber(level.price, 4)} USDT
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
              Sell all holdings when stopping
            </label>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-border">
          {grid.status === 'PENDING' && (
            <Button onClick={handleStart} isLoading={isLoading}>
              <Play className="h-4 w-4 mr-2" />
              Start Grid
            </Button>
          )}
          {grid.status === 'RUNNING' && (
            <Button variant="outline" onClick={handleStop} isLoading={isLoading}>
              <Square className="h-4 w-4 mr-2" />
              Stop Grid
            </Button>
          )}
          {(grid.status === 'STOPPED' || grid.status === 'COMPLETED') && (
            <Button variant="outline" onClick={handleRemove}>
              <Trash2 className="h-4 w-4 mr-2" />
              Remove Grid
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
