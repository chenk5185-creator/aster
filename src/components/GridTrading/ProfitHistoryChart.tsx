import { useState, useEffect, useRef } from 'react';
import { createChart, ColorType, type IChartApi, type ISeriesApi, type LineData } from 'lightweight-charts';
import { backendApi, type ProfitHistoryRecord } from '../../services/api/backend';
import { formatNumber, formatDateTime } from '../../utils/format';

interface ProfitHistoryChartProps {
  gridId: string;
}

export const ProfitHistoryChart: React.FC<ProfitHistoryChartProps> = ({ gridId }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profitHistory, setProfitHistory] = useState<ProfitHistoryRecord[]>([]);
  const [totalProfit, setTotalProfit] = useState(0);

  useEffect(() => {
    const fetchProfitHistory = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const history = await backendApi.getGridProfitHistory(gridId);
        setProfitHistory(history);

        // Calculate cumulative profit
        let cumulative = 0;
        history.forEach(record => {
          cumulative += record.profit;
        });
        setTotalProfit(cumulative);
      } catch (err) {
        setError(err instanceof Error ? err.message : '获取盈亏历史失败');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfitHistory();
  }, [gridId]);

  useEffect(() => {
    if (!chartContainerRef.current || profitHistory.length === 0) return;

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#9CA3AF',
      },
      grid: {
        vertLines: { color: '#374151' },
        horzLines: { color: '#374151' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 300,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: '#374151',
      },
      crosshair: {
        mode: 1,
      },
    });

    chartRef.current = chart;

    // Create line series for cumulative profit
    const lineSeries = chart.addLineSeries({
      color: '#10B981',
      lineWidth: 2,
      priceFormat: {
        type: 'price',
        precision: 4,
        minMove: 0.0001,
      },
    });

    seriesRef.current = lineSeries;

    // Prepare data: calculate cumulative profit over time
    const sortedHistory = [...profitHistory].sort((a, b) => a.created_at - b.created_at);
    let cumulative = 0;
    const chartData: LineData[] = sortedHistory.map(record => {
      cumulative += record.profit;
      return {
        time: Math.floor(record.created_at / 1000) as any, // Convert to seconds
        value: cumulative,
      };
    });

    lineSeries.setData(chartData);

    // Fit content
    chart.timeScale().fitContent();

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [profitHistory]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-text-muted">加载中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-error">{error}</div>
      </div>
    );
  }

  if (profitHistory.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-text-muted">暂无交易记录</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-text-secondary">盈亏曲线</h3>
        <div className="flex items-center gap-4">
          <div>
            <span className="text-text-muted text-xs">总交易次数：</span>
            <span className="text-text-primary text-sm font-medium">{profitHistory.length}</span>
          </div>
          <div>
            <span className="text-text-muted text-xs">累计盈亏：</span>
            <span className={`text-sm font-medium ${totalProfit >= 0 ? 'text-success' : 'text-error'}`}>
              {formatNumber(totalProfit, 4)} USDT
            </span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div ref={chartContainerRef} className="w-full bg-surface-light rounded-lg" />

      {/* Trade history table */}
      <div className="mt-4">
        <h4 className="text-xs font-medium text-text-secondary mb-2">最近交易记录</h4>
        <div className="max-h-48 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-surface-dark">
              <tr className="text-text-muted border-b border-border">
                <th className="text-left py-2 px-2">时间</th>
                <th className="text-right py-2 px-2">买入价</th>
                <th className="text-right py-2 px-2">卖出价</th>
                <th className="text-right py-2 px-2">数量</th>
                <th className="text-right py-2 px-2">盈亏</th>
                <th className="text-right py-2 px-2">手续费</th>
              </tr>
            </thead>
            <tbody>
              {profitHistory.slice().reverse().map((record) => (
                <tr key={record.id} className="border-b border-border/50 hover:bg-surface-light/50">
                  <td className="py-2 px-2 text-text-secondary">
                    {formatDateTime(record.created_at)}
                  </td>
                  <td className="py-2 px-2 text-right text-text-primary font-mono">
                    {formatNumber(record.buy_price, 6)}
                  </td>
                  <td className="py-2 px-2 text-right text-text-primary font-mono">
                    {formatNumber(record.sell_price, 6)}
                  </td>
                  <td className="py-2 px-2 text-right text-text-muted">
                    {formatNumber(record.quantity, 6)}
                  </td>
                  <td className={`py-2 px-2 text-right font-medium ${record.profit >= 0 ? 'text-success' : 'text-error'}`}>
                    {formatNumber(record.profit, 4)}
                  </td>
                  <td className="py-2 px-2 text-right text-text-muted">
                    {formatNumber(record.fees, 4)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
