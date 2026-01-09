import React, { useState, useMemo, useEffect } from 'react';
import { Button, NumberInput, Select } from '../common';
import { useGridStore, useMarketStore, useCredentialsStore } from '../../stores';
import { GridCalculator } from '../../services/grid';
import { accountApi } from '../../services/api';
import type { GridConfig, GridType } from '../../types';
import { formatNumber, formatPercent, formatSmartPrice } from '../../utils/format';
import { ChevronDown, ChevronUp, AlertTriangle, Info } from 'lucide-react';

export const GridConfigPanel: React.FC = () => {
  const { currentConfig, setConfig, createGrid, isCreating, error } = useGridStore();
  const { currentSymbol, symbolInfo, price } = useMarketStore();
  const { isUnlocked } = useCredentialsStore();

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [balance, setBalance] = useState(0);
  // Fixed MAKER fee rate: 0.05% = 0.0005
  const feeRate = 0.0005;
  const fees = { maker: 0.0005, taker: 0.0005 };

  // Load balance
  useEffect(() => {
    if (!isUnlocked || !symbolInfo) return;

    const loadData = async () => {
      try {
        const bal = await accountApi.getAvailableBalance(symbolInfo.quoteAsset);
        setBalance(bal);
      } catch (e) {
        console.error('Failed to load account data:', e);
      }
    };

    loadData();
  }, [isUnlocked, symbolInfo]);

  // Update symbol in config when it changes
  useEffect(() => {
    setConfig({ symbol: currentSymbol });
  }, [currentSymbol, setConfig]);

  // Calculate grid preview
  const gridPreview = useMemo(() => {
    const { upperPrice, lowerPrice, gridCount, gridType, investmentAmount } = currentConfig;

    if (!upperPrice || !lowerPrice || !gridCount || !price) {
      return null;
    }

    const levels = GridCalculator.calculateLevels(
      upperPrice,
      lowerPrice,
      gridCount,
      gridType || 'ARITHMETIC'
    );

    const buyGrids = GridCalculator.countBuyGrids(levels, price);
    const profitStats = GridCalculator.calculateProfitRate(levels, feeRate);
    const amountPerGrid = investmentAmount ? investmentAmount / Math.max(buyGrids, 1) : 0;

    return {
      levels,
      buyGrids,
      sellGrids: gridCount - buyGrids,
      profitStats,
      amountPerGrid,
    };
  }, [currentConfig, price, feeRate]);

  // Validation
  const validation = useMemo(() => {
    if (!symbolInfo || !price) return null;

    const config = currentConfig as GridConfig;
    if (!config.upperPrice || !config.lowerPrice || !config.gridCount || !config.investmentAmount) {
      return null;
    }

    return GridCalculator.validate(config, symbolInfo, price, balance, feeRate);
  }, [currentConfig, symbolInfo, price, balance, feeRate]);

  const handleCreate = async () => {
    if (!symbolInfo || !validation?.isValid) return;

    const config: GridConfig = {
      symbol: currentSymbol,
      upperPrice: currentConfig.upperPrice!,
      lowerPrice: currentConfig.lowerPrice!,
      gridCount: currentConfig.gridCount!,
      gridType: currentConfig.gridType || 'ARITHMETIC',
      investmentAmount: currentConfig.investmentAmount!,
      triggerPrice: currentConfig.triggerPrice,
      stopUpperPrice: currentConfig.stopUpperPrice,
      stopLowerPrice: currentConfig.stopLowerPrice,
      cancelOrdersOnStop: currentConfig.cancelOrdersOnStop ?? true,
      sellAllOnStop: currentConfig.sellAllOnStop ?? false,
    };

    try {
      const gridId = await createGrid(config, symbolInfo);
      console.log('Grid created:', gridId);
    } catch (e) {
      console.error('Failed to create grid:', e);
    }
  };

  const gridTypeOptions = [
    { value: 'ARITHMETIC', label: '等差网格' },
    { value: 'GEOMETRIC', label: '等比网格' },
  ];

  if (!isUnlocked) {
    return (
      <div className="card">
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <AlertTriangle className="h-12 w-12 text-warning mb-4" />
          <h3 className="text-lg font-medium text-text-primary mb-2">需要配置 API 凭证</h3>
          <p className="text-text-secondary text-sm">
            请先配置您的 API 凭证以开始网格交易。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card space-y-4">
      <h2 className="text-lg font-semibold text-text-primary">网格配置</h2>

      {/* Price Range */}
      <div className="grid grid-cols-2 gap-3">
        <NumberInput
          label="价格上限"
          value={currentConfig.upperPrice ?? ''}
          onChange={(v) => setConfig({ upperPrice: v })}
          min={0}
          step={0.01}
          placeholder="0.00"
          rightAddon={<span className="text-xs">USDT</span>}
        />
        <NumberInput
          label="价格下限"
          value={currentConfig.lowerPrice ?? ''}
          onChange={(v) => setConfig({ lowerPrice: v })}
          min={0}
          step={0.01}
          placeholder="0.00"
          rightAddon={<span className="text-xs">USDT</span>}
        />
      </div>

      {/* Current Price Info */}
      {price > 0 && (
        <div className="flex items-center gap-2 text-sm">
          <Info className="h-4 w-4 text-text-muted" />
          <span className="text-text-secondary">
            当前价格：<span className="text-text-primary font-medium">{formatSmartPrice(price)}</span> {symbolInfo?.quoteAsset || 'USDT'}
          </span>
        </div>
      )}

      {/* Grid Settings */}
      <div className="grid grid-cols-2 gap-3">
        <NumberInput
          label="网格数量"
          value={currentConfig.gridCount ?? ''}
          onChange={(v) => setConfig({ gridCount: Math.round(v) })}
          min={2}
          max={200}
          step={1}
          placeholder="10"
        />
        <Select
          label="网格类型"
          value={currentConfig.gridType || 'ARITHMETIC'}
          onValueChange={(v) => setConfig({ gridType: v as GridType })}
          options={gridTypeOptions}
        />
      </div>

      {/* Investment Amount */}
      <NumberInput
        label="投资金额"
        value={currentConfig.investmentAmount ?? ''}
        onChange={(v) => setConfig({ investmentAmount: v })}
        min={0}
        step={1}
        placeholder="1000"
        rightAddon={<span className="text-xs">USDT</span>}
        hint={`可用余额：${formatNumber(balance, 2)} USDT`}
      />

      {/* Fee Rates Info */}
      {fees && (
        <div className="bg-surface-light rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <Info className="h-4 w-4 text-text-muted" />
            <span className="text-sm font-medium text-text-primary">交易费率</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">Maker 费率（挂单）</span>
            <span className="text-text-primary font-medium">{formatPercent(fees.maker * 100)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">Taker 费率（吃单）</span>
            <span className="text-text-primary font-medium">{formatPercent(fees.taker * 100)}</span>
          </div>
        </div>
      )}

      {/* Grid Preview */}
      {gridPreview && (
        <div className="bg-surface-light rounded-lg p-3 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">买入订单</span>
            <span className="text-primary">{gridPreview.buyGrids}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">卖出订单</span>
            <span className="text-text-muted">{gridPreview.sellGrids} (待挂单)</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">每格投资</span>
            <span className="text-text-primary">
              {formatNumber(gridPreview.amountPerGrid, 2)} USDT
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">预估单格利润</span>
            <span className={gridPreview.profitStats.avgProfitRate > 0 ? 'text-success' : 'text-error'}>
              {formatPercent(gridPreview.profitStats.avgProfitRate)}
            </span>
          </div>
        </div>
      )}

      {/* Advanced Settings */}
      <div>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          高级设置
        </button>

        {showAdvanced && (
          <div className="mt-3 space-y-3 pt-3 border-t border-border">
            <NumberInput
              label="触发价格（可选）"
              value={currentConfig.triggerPrice ?? ''}
              onChange={(v) => setConfig({ triggerPrice: v || undefined })}
              min={0}
              step={0.01}
              placeholder="价格到达此价位时启动网格"
              rightAddon={<span className="text-xs">USDT</span>}
            />

            <div className="grid grid-cols-2 gap-3">
              <NumberInput
                label="止损上限"
                value={currentConfig.stopUpperPrice ?? ''}
                onChange={(v) => setConfig({ stopUpperPrice: v || undefined })}
                min={0}
                step={0.01}
                placeholder="价格超过时停止"
                rightAddon={<span className="text-xs">USDT</span>}
              />
              <NumberInput
                label="止损下限"
                value={currentConfig.stopLowerPrice ?? ''}
                onChange={(v) => setConfig({ stopLowerPrice: v || undefined })}
                min={0}
                step={0.01}
                placeholder="价格跌破时停止"
                rightAddon={<span className="text-xs">USDT</span>}
              />
            </div>

            <div className="flex items-center justify-between py-2">
              <label className="text-sm text-text-secondary">停止时取消所有订单</label>
              <input
                type="checkbox"
                checked={currentConfig.cancelOrdersOnStop ?? true}
                onChange={(e) => setConfig({ cancelOrdersOnStop: e.target.checked })}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
              />
            </div>

            <div className="flex items-center justify-between py-2">
              <label className="text-sm text-text-secondary">停止时卖出所有持仓</label>
              <input
                type="checkbox"
                checked={currentConfig.sellAllOnStop ?? false}
                onChange={(e) => setConfig({ sellAllOnStop: e.target.checked })}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
              />
            </div>
          </div>
        )}
      </div>

      {/* Validation Errors/Warnings */}
      {validation && (
        <div className="space-y-2">
          {validation.errors.map((err, i) => (
            <div key={i} className="flex items-start gap-2 text-sm text-error">
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{err}</span>
            </div>
          ))}
          {validation.warnings.map((warn, i) => (
            <div key={i} className="flex items-start gap-2 text-sm text-warning">
              <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{warn}</span>
            </div>
          ))}
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="p-3 bg-error/10 border border-error/30 rounded-lg text-sm text-error">
          {error}
        </div>
      )}

      {/* Create Button */}
      <Button
        onClick={handleCreate}
        disabled={!validation?.isValid || isCreating}
        isLoading={isCreating}
        className="w-full"
      >
        创建网格
      </Button>
    </div>
  );
};
