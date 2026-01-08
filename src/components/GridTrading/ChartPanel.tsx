import React, { useEffect, useRef, useState } from 'react';
import { useMarketStore } from '../../stores';
import { marketApi } from '../../services/api';
import { createChart } from 'lightweight-charts';
import type { IChartApi, ISeriesApi, CandlestickData } from 'lightweight-charts';
import type { Kline } from '../../types';
import { RefreshCw } from 'lucide-react';

const INTERVALS = [
  { label: '1分', value: '1m' },
  { label: '5分', value: '5m' },
  { label: '15分', value: '15m' },
  { label: '1时', value: '1h' },
  { label: '4时', value: '4h' },
  { label: '1天', value: '1d' },
];

export const ChartPanel: React.FC = () => {
  const { currentSymbol } = useMarketStore();
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | any>(null);

  const [interval, setInterval] = useState('15m');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadKlines = async () => {
    if (!currentSymbol) return;

    setIsLoading(true);
    setError(null);
    try {
      const klines = await marketApi.getKlines(currentSymbol, interval, { limit: 500 });

      if (klines.length === 0) {
        setError('暂无K线数据');
        return;
      }

      // 转换为 lightweight-charts 格式
      const chartData: CandlestickData[] = klines.map((k: Kline) => ({
        time: (k.openTime / 1000) as any, // 转换为秒
        open: parseFloat(k.open),
        high: parseFloat(k.high),
        low: parseFloat(k.low),
        close: parseFloat(k.close),
      }));

      if (seriesRef.current) {
        seriesRef.current.setData(chartData);
      }
    } catch (e) {
      setError('加载K线数据失败');
      console.error('Failed to load klines:', e);
    } finally {
      setIsLoading(false);
    }
  };

  // 初始化图表
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 400,
      layout: {
        background: { color: '#1a1b1e' as any },
        textColor: '#d1d4dc',
      },
      grid: {
        vertLines: { color: '#2b2b43' },
        horzLines: { color: '#2b2b43' },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: '#2b2b43',
      },
      rightPriceScale: {
        borderColor: '#2b2b43',
      },
    });

    const candlestickSeries = (chart as any).addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });

    chartRef.current = chart;
    seriesRef.current = candlestickSeries;

    // 响应式调整大小
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  // 加载K线数据
  useEffect(() => {
    loadKlines();
  }, [currentSymbol, interval]);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-text-primary">K线图</h3>
        <div className="flex items-center gap-2">
          {/* 时间周期选择 */}
          <div className="flex gap-1">
            {INTERVALS.map((int) => (
              <button
                key={int.value}
                onClick={() => setInterval(int.value)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  interval === int.value
                    ? 'bg-primary text-white'
                    : 'bg-surface-light text-text-secondary hover:bg-surface hover:text-text-primary'
                }`}
              >
                {int.label}
              </button>
            ))}
          </div>
          <button
            onClick={loadKlines}
            className="p-1 hover:bg-surface-light rounded transition-colors"
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 text-text-muted ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error ? (
        <div className="flex justify-center items-center h-[400px] text-text-muted text-sm">
          {error}
        </div>
      ) : (
        <div ref={chartContainerRef} className="w-full" />
      )}
    </div>
  );
};
