import React from 'react';
import { useGridStore, useMarketStore } from '../../stores';
import { Button } from '../common';
import { formatNumber, formatPercent, formatDateTime } from '../../utils/format';
import type { GridInstance, GridStatus } from '../../types';
import { Play, Square, Trash2, TrendingUp, TrendingDown, Clock, Grid3X3 } from 'lucide-react';

interface ActiveGridListProps {
  onSelectGrid: (grid: GridInstance) => void;
}

const statusColors: Record<GridStatus, string> = {
  PENDING: 'text-warning',
  RUNNING: 'text-success',
  STOPPED: 'text-text-muted',
  COMPLETED: 'text-primary',
};

const statusLabels: Record<GridStatus, string> = {
  PENDING: 'Pending',
  RUNNING: 'Running',
  STOPPED: 'Stopped',
  COMPLETED: 'Completed',
};

export const ActiveGridList: React.FC<ActiveGridListProps> = ({ onSelectGrid }) => {
  const { activeGrids, startGrid, stopGrid, removeGrid } = useGridStore();
  const { prices } = useMarketStore();

  if (activeGrids.length === 0) {
    return (
      <div className="card">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Grid3X3 className="h-12 w-12 text-text-muted mb-4" />
          <h3 className="text-lg font-medium text-text-primary mb-2">No Active Grids</h3>
          <p className="text-text-secondary text-sm">
            Create a new grid to start automated trading.
          </p>
        </div>
      </div>
    );
  }

  const handleStart = async (e: React.MouseEvent, gridId: string) => {
    e.stopPropagation();
    try {
      await startGrid(gridId);
    } catch (error) {
      console.error('Failed to start grid:', error);
    }
  };

  const handleStop = async (e: React.MouseEvent, gridId: string) => {
    e.stopPropagation();
    try {
      await stopGrid(gridId);
    } catch (error) {
      console.error('Failed to stop grid:', error);
    }
  };

  const handleRemove = (e: React.MouseEvent, gridId: string) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to remove this grid?')) {
      removeGrid(gridId);
    }
  };

  return (
    <div className="card">
      <h2 className="text-lg font-semibold text-text-primary mb-4">Active Grids</h2>

      <div className="space-y-3">
        {activeGrids.map((grid) => {
          const currentPrice = prices.get(grid.config.symbol) || 0;
          const profitColor = grid.profit.totalProfit >= 0 ? 'text-success' : 'text-error';
          const ProfitIcon = grid.profit.totalProfit >= 0 ? TrendingUp : TrendingDown;

          return (
            <div
              key={grid.id}
              onClick={() => onSelectGrid(grid)}
              className="bg-surface-light rounded-lg p-4 cursor-pointer hover:bg-surface-light/80 transition-colors border border-border"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-text-primary">{grid.config.symbol}</span>
                  <span className={`text-sm ${statusColors[grid.status]}`}>
                    ● {statusLabels[grid.status]}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {grid.status === 'PENDING' && (
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={(e) => handleStart(e, grid.id)}
                    >
                      <Play className="h-3 w-3 mr-1" />
                      Start
                    </Button>
                  )}
                  {grid.status === 'RUNNING' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => handleStop(e, grid.id)}
                    >
                      <Square className="h-3 w-3 mr-1" />
                      Stop
                    </Button>
                  )}
                  {(grid.status === 'STOPPED' || grid.status === 'COMPLETED') && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => handleRemove(e, grid.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Grid Info */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <span className="text-text-muted block">Price Range</span>
                  <span className="text-text-primary">
                    {formatNumber(grid.config.lowerPrice, 2)} - {formatNumber(grid.config.upperPrice, 2)}
                  </span>
                </div>
                <div>
                  <span className="text-text-muted block">Grids</span>
                  <span className="text-text-primary">
                    {grid.config.gridCount} ({grid.config.gridType.toLowerCase()})
                  </span>
                </div>
                <div>
                  <span className="text-text-muted block">Investment</span>
                  <span className="text-text-primary">
                    {formatNumber(grid.config.investmentAmount, 2)} USDT
                  </span>
                </div>
                <div>
                  <span className="text-text-muted block">Current Price</span>
                  <span className="text-text-primary">
                    {currentPrice > 0 ? formatNumber(currentPrice, 2) : '-'}
                  </span>
                </div>
              </div>

              {/* Profit Stats */}
              <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    <ProfitIcon className={`h-4 w-4 ${profitColor}`} />
                    <span className={`font-medium ${profitColor}`}>
                      {formatNumber(grid.profit.totalProfit, 2)} USDT
                    </span>
                    <span className={`text-sm ${profitColor}`}>
                      ({formatPercent(grid.profit.profitRate)})
                    </span>
                  </div>
                  <div className="text-text-muted text-sm">
                    {grid.profit.tradingCount} trades
                  </div>
                </div>
                <div className="flex items-center gap-1 text-text-muted text-sm">
                  <Clock className="h-3 w-3" />
                  <span>{formatDateTime(grid.createdAt)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
