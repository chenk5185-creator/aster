import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type {
  GridConfig,
  GridInstance,
  GridStatus,
  GridProfit,
  GridLevel,
  SymbolInfo,
} from '../types';
import { GridCalculator, GridOrderManager } from '../services/grid';
import { tradingApi, accountApi, marketApi } from '../services/api';

interface GridState {
  // Data
  activeGrids: GridInstance[];
  currentConfig: Partial<GridConfig>;
  managers: Map<string, GridOrderManager>;

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
  removeGrid: (gridId: string) => void;
  updateGridStatus: (gridId: string, status: GridStatus) => void;
  updateGridProfit: (gridId: string, profit: GridProfit) => void;
  loadGrids: () => void;
}

const defaultConfig: Partial<GridConfig> = {
  gridType: 'ARITHMETIC',
  gridCount: 10,
  cancelOrdersOnStop: true,
  sellAllOnStop: false,
};

export const useGridStore = create<GridState>()(
  persist(
    (set, get) => ({
      activeGrids: [],
      currentConfig: { ...defaultConfig },
      managers: new Map(),
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
          // Get fee rates
          const fees = await accountApi.getFeeRates();

          // Get current price
          const currentPrice = await marketApi.getPrice(config.symbol);

          // Validate configuration
          const balance = await accountApi.getAvailableBalance(
            symbolInfo.quoteAsset
          );
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

          // Create grid instance
          const gridId = uuidv4().slice(0, 8);
          const levels = GridCalculator.calculateLevels(
            config.upperPrice,
            config.lowerPrice,
            config.gridCount,
            config.gridType
          );

          const gridLevels: GridLevel[] = levels.map((price, index) => ({
            index,
            price,
            status: 'EMPTY' as const,
          }));

          const gridInstance: GridInstance = {
            id: gridId,
            config,
            status: 'PENDING',
            createdAt: Date.now(),
            gridLevels,
            orders: [],
            profit: {
              realizedProfit: 0,
              unrealizedProfit: 0,
              totalProfit: 0,
              profitRate: 0,
              tradingCount: 0,
              totalFees: 0,
            },
            baseAssetHolding: 0,
          };

          // Create order manager
          const manager = new GridOrderManager(
            gridInstance,
            symbolInfo,
            tradingApi,
            marketApi,
            fees
          );

          // Subscribe to events
          manager.onEvent((event) => {
            const { activeGrids } = get();
            const gridIndex = activeGrids.findIndex((g) => g.id === gridId);
            if (gridIndex === -1) return;

            const updatedInstance = manager.getInstance();
            const newGrids = [...activeGrids];
            newGrids[gridIndex] = updatedInstance;
            set({ activeGrids: newGrids });

            if (event.type === 'ERROR') {
              set({ error: event.message });
            }
          });

          // Store manager
          const { managers } = get();
          managers.set(gridId, manager);

          // Add to active grids
          set((state) => ({
            activeGrids: [...state.activeGrids, gridInstance],
            currentConfig: { ...defaultConfig },
          }));

          return gridId;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          set({ error: message });
          throw error;
        } finally {
          set({ isCreating: false });
        }
      },

      startGrid: async (gridId: string) => {
        const { managers, activeGrids } = get();
        const manager = managers.get(gridId);

        if (!manager) {
          throw new Error('Grid manager not found');
        }

        try {
          await manager.start();

          // Get updated instance from manager (includes RUNNING status)
          const updatedInstance = manager.getInstance();
          const updatedGrids = activeGrids.map((g) =>
            g.id === gridId ? updatedInstance : g
          );
          set({ activeGrids: updatedGrids });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          set({ error: message });
          throw error;
        }
      },

      stopGrid: async (gridId: string, sellHoldings: boolean = false) => {
        const { managers, activeGrids } = get();
        const manager = managers.get(gridId);

        if (!manager) {
          throw new Error('Grid manager not found');
        }

        try {
          await manager.stop(sellHoldings);

          // Update grid status
          const updatedInstance = manager.getInstance();
          const updatedGrids = activeGrids.map((g) =>
            g.id === gridId ? updatedInstance : g
          );
          set({ activeGrids: updatedGrids });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          set({ error: message });
          throw error;
        }
      },

      removeGrid: (gridId: string) => {
        const { managers } = get();

        // Stop and remove manager
        const manager = managers.get(gridId);
        if (manager && manager.getIsRunning()) {
          manager.stop().catch(console.error);
        }
        managers.delete(gridId);

        // Remove from active grids
        set((state) => ({
          activeGrids: state.activeGrids.filter((g) => g.id !== gridId),
        }));
      },

      updateGridStatus: (gridId: string, status: GridStatus) => {
        set((state) => ({
          activeGrids: state.activeGrids.map((g) =>
            g.id === gridId ? { ...g, status } : g
          ),
        }));
      },

      updateGridProfit: (gridId: string, profit: GridProfit) => {
        set((state) => ({
          activeGrids: state.activeGrids.map((g) =>
            g.id === gridId ? { ...g, profit } : g
          ),
        }));
      },

      loadGrids: () => {
        // Called on app init to restore managers for persisted grids
        // Note: Running grids cannot be automatically resumed
        // They need to be manually restarted
        set((state) => ({
          activeGrids: state.activeGrids.map((g) => ({
            ...g,
            status: g.status === 'RUNNING' ? 'STOPPED' : g.status,
          })),
        }));
      },
    }),
    {
      name: 'aster-spot-grid-storage',
      partialize: (state) => ({
        activeGrids: state.activeGrids,
      }),
    }
  )
);
