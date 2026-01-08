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
  PENDING: '待启动',
  RUNNING: '运行中',
  STOPPED: '已停止',
  COMPLETED: '已完成',
};

export const ActiveGridList: React.FC<ActiveGridListProps> = ({ onSelectGrid }) => {
  const { activeGrids, startGrid, stopGrid, removeGrid } = useGridStore();
  const { prices } = useMarketStore();

  if (activeGrids.length === 0) {
    return (
      <div className="card">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Grid3X3 className="h-12 w-12 text-text-muted mb-4" />
          <h3 className="text-lg font-medium text-text-primary mb-2">暂无活跃网格</h3>
          <p className="text-text-secondary text-sm">
            创建一个新网格来开始自动交易。
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
    if (confirm('确定要删除这个网格吗？')) {
      removeGrid(gridId);
    }
  };

  return (
    <div className="card">
      <h2 className="text-lg font-semibold text-text-primary mb-4">活跃网格</h2>

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
                      启动
                    </Button>
                  )}
                  {grid.status === 'RUNNING' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => handleStop(e, grid.id)}
                    >
                      <Square className="h-3 w-3 mr-1" />
                      停止
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
                  <span className="text-text-muted block">价格区间</span>
                  <span className="text-text-primary">
                    {formatNumber(grid.config.lowerPrice, 2)} - {formatNumber(grid.config.upperPrice, 2)}
                  </span>
                </div>
                <div>
                  <span className="text-text-muted block">网格数</span>
                  <span className="text-text-primary">
                    {grid.config.gridCount} ({grid.config.gridType === 'ARITHMETIC' ? '等差' : '等比'})
                  </span>
                </div>
                <div>
                  <span className="text-text-muted block">投资金额</span>
                  <span className="text-text-primary">
                    {formatNumber(grid.config.investmentAmount, 2)} USDT
                  </span>
                </div>
                <div>
                  <span className="text-text-muted block">当前价格</span>
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
                    {grid.profit.tradingCount} 笔交易
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
