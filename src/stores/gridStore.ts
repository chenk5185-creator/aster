import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  GridConfig,
  GridInstance,
  SymbolInfo,
} from '../types';
import { GridCalculator } from '../services/grid';
import { accountApi, marketApi } from '../services/api';
import { backendApi } from '../services/api/backend';

interface GridState {
  // Data
  activeGrids: GridInstance[];
  currentConfig: Partial<GridConfig>;

  // UI State
  isCreating: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  setConfig: (config: Partial<GridConfig>) => void;
  resetConfig: () => void;
  createGrid: (config: GridConfig, symbolInfo: SymbolInfo) => Promise<string>;
  startGrid: (gridId: string) => Promise<void>;
  stopGrid: (gridId: string, sellHoldings?: boolean) => Promise<void>;
  removeGrid: (gridId: string) => Promise<void>;
  loadGrids: () => Promise<void>;
  refreshGrid: (gridId: string) => Promise<void>;
}

const defaultConfig: Partial<GridConfig> = {
  gridType: 'ARITHMETIC',
  gridCount: 10,
  cancelOrdersOnStop: true,
  sellAllOnStop: false,
};

export const useGridStore = create<GridState>()(
  persist(
    (set) => ({
      activeGrids: [],
      currentConfig: { ...defaultConfig },
      isCreating: false,
      isLoading: false,
      error: null,

      setConfig: (config: Partial<GridConfig>) => {
        set((state) => ({
          currentConfig: { ...state.currentConfig, ...config },
        }));
      },

      resetConfig: () => {
        set({ currentConfig: { ...defaultConfig } });
      },

      createGrid: async (config: GridConfig, symbolInfo: SymbolInfo): Promise<string> => {
        set({ isCreating: true, error: null });

        try {
          // Get fee rates and validate locally first
          const fees = await accountApi.getFeeRates();
          const currentPrice = await marketApi.getPrice(config.symbol);
          const balance = await accountApi.getAvailableBalance(symbolInfo.quoteAsset);

          const validation = GridCalculator.validate(
            config,
            symbolInfo,
            currentPrice,
            balance,
            fees.maker
          );

          if (!validation.isValid) {
            throw new Error(validation.errors.join('; '));
          }

          // Create grid on backend
          const { gridId, grid } = await backendApi.createGrid(config);

          // Add to local state
          set((state) => ({
            activeGrids: [...state.activeGrids, grid],
            currentConfig: { ...defaultConfig },
            isCreating: false,
          }));

          return gridId;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          set({ error: message, isCreating: false });
          throw error;
        }
      },

      startGrid: async (gridId: string) => {
        try {
          // Start grid on backend
          const grid = await backendApi.startGrid(gridId);

          // Update local state
          set((state) => ({
            activeGrids: state.activeGrids.map((g) =>
              g.id === gridId ? grid : g
            ),
          }));
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          set({ error: message });
          throw error;
        }
      },

      stopGrid: async (gridId: string, sellHoldings: boolean = false) => {
        try {
          // Stop grid on backend
          const grid = await backendApi.stopGrid(gridId, sellHoldings);

          // Update local state
          set((state) => ({
            activeGrids: state.activeGrids.map((g) =>
              g.id === gridId ? grid : g
            ),
          }));
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          set({ error: message });
          throw error;
        }
      },

      removeGrid: async (gridId: string) => {
        try {
          // Delete grid on backend
          await backendApi.deleteGrid(gridId);

          // Remove from local state
          set((state) => ({
            activeGrids: state.activeGrids.filter((g) => g.id !== gridId),
          }));
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          set({ error: message });
          throw error;
        }
      },

      loadGrids: async () => {
        set({ isLoading: true, error: null });
        try {
          // Load grids from backend
          const grids = await backendApi.getGrids();
          set({ activeGrids: grids, isLoading: false });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          set({ error: message, isLoading: false });
        }
      },

      refreshGrid: async (gridId: string) => {
        try {
          // Refresh single grid from backend
          const grid = await backendApi.getGrid(gridId);

          set((state) => ({
            activeGrids: state.activeGrids.map((g) =>
              g.id === gridId ? grid : g
            ),
          }));
        } catch (error) {
          console.error('Failed to refresh grid:', error);
        }
      },
    }),
    {
      name: 'aster-spot-grid-storage',
      partialize: (state) => ({
        // Don't persist grids - load from backend
        currentConfig: state.currentConfig,
      }),
    }
  )
);
