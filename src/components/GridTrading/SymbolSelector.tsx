import { useState, useMemo, useRef, useEffect } from 'react';
import { useMarketStore } from '../../stores';
import { formatSmartPrice } from '../../utils/format';
import { Search, ChevronDown, Star, TrendingUp, TrendingDown } from 'lucide-react';

interface SymbolSelectorProps {
  onSymbolChange?: (symbol: string) => void;
}

export const SymbolSelector: React.FC<SymbolSelectorProps> = ({ onSymbolChange }) => {
  const { symbols, currentSymbol, ticker, setCurrentSymbol, isLoadingSymbols } = useMarketStore();

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedQuoteAsset, setSelectedQuoteAsset] = useState<string>('ALL');
  const [favorites, setFavorites] = useState<string[]>(() => {
    const saved = localStorage.getItem('aster-favorite-symbols');
    return saved ? JSON.parse(saved) : ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'];
  });

  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when opening
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Save favorites to localStorage
  useEffect(() => {
    localStorage.setItem('aster-favorite-symbols', JSON.stringify(favorites));
  }, [favorites]);

  // 获取所有可用的计价货币
  const availableQuoteAssets = useMemo(() => {
    const assets = new Set(symbols.map((s) => s.quoteAsset));
    return ['ALL', ...Array.from(assets).sort()];
  }, [symbols]);

  const filteredSymbols = useMemo(() => {
    let filtered = symbols;

    // 按计价货币筛选
    if (selectedQuoteAsset !== 'ALL') {
      filtered = filtered.filter((s) => s.quoteAsset === selectedQuoteAsset);
    }

    // 按搜索关键词筛选
    if (searchQuery.trim()) {
      const query = searchQuery.toUpperCase();
      filtered = filtered.filter(
        (s) =>
          s.symbol.includes(query) ||
          s.baseAsset.includes(query) ||
          s.quoteAsset.includes(query)
      );
    }

    // 如果没有搜索，显示收藏+热门
    if (!searchQuery.trim()) {
      const favoriteSymbols = filtered.filter((s) => favorites.includes(s.symbol));
      const otherSymbols = filtered.filter((s) => !favorites.includes(s.symbol));
      return [...favoriteSymbols, ...otherSymbols.slice(0, 30)];
    }

    return filtered;
  }, [symbols, searchQuery, selectedQuoteAsset, favorites]);

  const handleSelect = (symbol: string) => {
    setCurrentSymbol(symbol);
    onSymbolChange?.(symbol);
    setIsOpen(false);
    setSearchQuery('');
    setSelectedQuoteAsset('ALL');
  };

  const toggleFavorite = (e: React.MouseEvent, symbol: string) => {
    e.stopPropagation();
    setFavorites((prev) =>
      prev.includes(symbol)
        ? prev.filter((s) => s !== symbol)
        : [...prev, symbol]
    );
  };

  const priceChange = ticker ? parseFloat(ticker.priceChangePercent) : 0;
  const PriceIcon = priceChange >= 0 ? TrendingUp : TrendingDown;
  const priceColor = priceChange >= 0 ? 'text-success' : 'text-error';

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 px-4 py-2 bg-surface rounded-lg border border-border hover:border-primary transition-colors"
      >
        <div className="text-left">
          <div className="font-semibold text-text-primary">{currentSymbol}</div>
          {ticker && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-text-secondary">
                {formatSmartPrice(parseFloat(ticker.lastPrice))}
              </span>
              <span className={`flex items-center gap-0.5 ${priceColor}`}>
                <PriceIcon className="h-3 w-3" />
                {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
              </span>
            </div>
          )}
        </div>
        <ChevronDown className={`h-4 w-4 text-text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-surface border border-border rounded-lg shadow-lg z-50">
          {/* Search */}
          <div className="p-3 border-b border-border space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索交易对..."
                className="w-full pl-10 pr-4 py-2 bg-surface-light rounded-lg border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Quote Asset Filter */}
            <div className="flex gap-1 flex-wrap">
              {availableQuoteAssets.map((asset) => (
                <button
                  key={asset}
                  onClick={() => setSelectedQuoteAsset(asset)}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    selectedQuoteAsset === asset
                      ? 'bg-primary text-white'
                      : 'bg-surface-light text-text-secondary hover:bg-surface hover:text-text-primary'
                  }`}
                >
                  {asset === 'ALL' ? '全部' : asset}
                </button>
              ))}
            </div>
          </div>

          {/* Symbol List */}
          <div className="max-h-80 overflow-y-auto">
            {isLoadingSymbols ? (
              <div className="p-4 text-center text-text-muted">加载交易对中...</div>
            ) : filteredSymbols.length === 0 ? (
              <div className="p-4 text-center text-text-muted">未找到交易对</div>
            ) : (
              <div className="py-2">
                {filteredSymbols.map((symbol) => {
                  const isFavorite = favorites.includes(symbol.symbol);
                  const isSelected = symbol.symbol === currentSymbol;

                  return (
                    <button
                      key={symbol.symbol}
                      onClick={() => handleSelect(symbol.symbol)}
                      className={`w-full flex items-center justify-between px-4 py-2 hover:bg-surface-light transition-colors ${
                        isSelected ? 'bg-primary/10' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <button
                          onClick={(e) => toggleFavorite(e, symbol.symbol)}
                          className={`p-1 rounded hover:bg-surface ${
                            isFavorite ? 'text-warning' : 'text-text-muted'
                          }`}
                        >
                          <Star className={`h-4 w-4 ${isFavorite ? 'fill-current' : ''}`} />
                        </button>
                        <div className="text-left">
                          <div className="font-medium text-text-primary">
                            {symbol.baseAsset}
                            <span className="text-text-muted font-normal">/{symbol.quoteAsset}</span>
                          </div>
                          <div className="text-xs text-text-muted">
                            {symbol.status === 'TRADING' ? '交易中' : symbol.status}
                          </div>
                        </div>
                      </div>
                      {isSelected && (
                        <div className="text-primary text-sm">已选择</div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
