import { useState, useMemo, useRef, useEffect } from 'react';
import { useMarketStore } from '../../stores';
import { formatNumber } from '../../utils/format';
import { Search, ChevronDown, Star, TrendingUp, TrendingDown } from 'lucide-react';

interface SymbolSelectorProps {
  onSymbolChange?: (symbol: string) => void;
}

export const SymbolSelector: React.FC<SymbolSelectorProps> = ({ onSymbolChange }) => {
  const { symbols, currentSymbol, ticker, setCurrentSymbol, isLoadingSymbols } = useMarketStore();

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
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

  const filteredSymbols = useMemo(() => {
    if (!searchQuery.trim()) {
      // Show favorites first, then other popular symbols
      const favoriteSymbols = symbols.filter((s) => favorites.includes(s.symbol));
      const otherSymbols = symbols.filter((s) => !favorites.includes(s.symbol));
      return [...favoriteSymbols, ...otherSymbols.slice(0, 20)];
    }

    const query = searchQuery.toUpperCase();
    return symbols.filter(
      (s) =>
        s.symbol.includes(query) ||
        s.baseAsset.includes(query)
    );
  }, [symbols, searchQuery, favorites]);

  const handleSelect = (symbol: string) => {
    setCurrentSymbol(symbol);
    onSymbolChange?.(symbol);
    setIsOpen(false);
    setSearchQuery('');
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
                {formatNumber(parseFloat(ticker.lastPrice), 2)}
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
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search symbol..."
                className="w-full pl-10 pr-4 py-2 bg-surface-light rounded-lg border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* Symbol List */}
          <div className="max-h-80 overflow-y-auto">
            {isLoadingSymbols ? (
              <div className="p-4 text-center text-text-muted">Loading symbols...</div>
            ) : filteredSymbols.length === 0 ? (
              <div className="p-4 text-center text-text-muted">No symbols found</div>
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
                            {symbol.status === 'TRADING' ? 'Trading' : symbol.status}
                          </div>
                        </div>
                      </div>
                      {isSelected && (
                        <div className="text-primary text-sm">Selected</div>
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
