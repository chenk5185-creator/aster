import { create } from 'zustand';
import type { SymbolInfo, Ticker } from '../types';
import { marketApi } from '../services/api';
import { streamManager, type TickerData } from '../services/websocket';

interface MarketState {
  // Data
  symbols: SymbolInfo[];
  currentSymbol: string;
  symbolInfo: SymbolInfo | null;
  price: number;
  ticker: Ticker | null;
  prices: Map<string, number>;

  // Loading states
  isLoadingSymbols: boolean;
  isLoadingPrice: boolean;

  // Actions
  loadSymbols: () => Promise<void>;
  setCurrentSymbol: (symbol: string) => Promise<void>;
  subscribeToPrice: (symbol: string) => () => void;
  refreshPrice: (symbol: string) => Promise<void>;
}

export const useMarketStore = create<MarketState>((set, get) => ({
  symbols: [],
  currentSymbol: 'BTCUSDT',
  symbolInfo: null,
  price: 0,
  ticker: null,
  prices: new Map(),
  isLoadingSymbols: false,
  isLoadingPrice: false,

  loadSymbols: async () => {
    set({ isLoadingSymbols: true });
    try {
      const symbols = await marketApi.getSymbols();
      // 支持所有现货交易对，按计价货币排序：USDT > USDC > BTC > ETH > BNB > 其他
      const quoteAssetOrder = ['USDT', 'USDC', 'BTC', 'ETH', 'BNB'];
      const sortedSymbols = symbols.sort((a, b) => {
        const orderA = quoteAssetOrder.indexOf(a.quoteAsset);
        const orderB = quoteAssetOrder.indexOf(b.quoteAsset);

        // 如果在排序列表中，按照列表顺序排序
        if (orderA !== -1 && orderB !== -1) {
          return orderA - orderB;
        }
        // 列表中的排在前面
        if (orderA !== -1) return -1;
        if (orderB !== -1) return 1;
        // 都不在列表中，按字母顺序
        return a.quoteAsset.localeCompare(b.quoteAsset);
      });

      set({ symbols: sortedSymbols });

      // Set default symbol info if current symbol exists
      const { currentSymbol } = get();
      const symbolInfo = sortedSymbols.find((s) => s.symbol === currentSymbol);
      if (symbolInfo) {
        set({ symbolInfo });
      }
    } catch (error) {
      console.error('Failed to load symbols:', error);
    } finally {
      set({ isLoadingSymbols: false });
    }
  },

  setCurrentSymbol: async (symbol: string) => {
    const { symbols } = get();
    const symbolInfo = symbols.find((s) => s.symbol === symbol);

    set({
      currentSymbol: symbol,
      symbolInfo: symbolInfo || null,
      price: 0,
      ticker: null,
    });

    // Fetch current price
    await get().refreshPrice(symbol);
  },

  subscribeToPrice: (symbol: string) => {
    // Connect WebSocket if not connected
    if (!streamManager.isConnected()) {
      streamManager.connect().catch(console.error);
    }

    // Subscribe to ticker
    const unsubscribe = streamManager.subscribeToTicker(symbol, (data: TickerData) => {
      const price = parseFloat(data.c);
      const { currentSymbol, prices } = get();

      // Update prices map
      const newPrices = new Map(prices);
      newPrices.set(symbol, price);

      // Update current price if this is the selected symbol
      if (symbol === currentSymbol) {
        const ticker: Ticker = {
          symbol: data.s,
          lastPrice: data.c,
          priceChange: data.p,
          priceChangePercent: data.P,
          highPrice: data.h,
          lowPrice: data.l,
          volume: data.v,
          quoteVolume: data.q,
        };

        set({ price, ticker, prices: newPrices });
      } else {
        set({ prices: newPrices });
      }
    });

    return unsubscribe;
  },

  refreshPrice: async (symbol: string) => {
    set({ isLoadingPrice: true });
    try {
      const price = await marketApi.getPrice(symbol);
      const { currentSymbol, prices } = get();

      const newPrices = new Map(prices);
      newPrices.set(symbol, price);

      if (symbol === currentSymbol) {
        set({ price, prices: newPrices });
      } else {
        set({ prices: newPrices });
      }
    } catch (error) {
      console.error('Failed to refresh price:', error);
    } finally {
      set({ isLoadingPrice: false });
    }
  },
}));
