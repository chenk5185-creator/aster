import { useEffect, useState } from 'react';
import { Header } from './components/Layout';
import { GridConfigPanel, ActiveGridList, GridDetailModal } from './components/GridTrading';
import { useMarketStore, useGridStore } from './stores';
import type { GridInstance } from './types';

function App() {
  const { loadSymbols, currentSymbol, subscribeToPrice } = useMarketStore();
  const { loadGrids } = useGridStore();

  const [selectedGrid, setSelectedGrid] = useState<GridInstance | null>(null);

  // Initialize app
  useEffect(() => {
    // Load symbols on mount
    loadSymbols();

    // Load saved grids
    loadGrids();
  }, [loadSymbols, loadGrids]);

  // Subscribe to price updates when symbol changes
  useEffect(() => {
    if (!currentSymbol) return;

    const unsubscribe = subscribeToPrice(currentSymbol);
    return () => unsubscribe();
  }, [currentSymbol, subscribeToPrice]);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Grid Configuration Panel */}
          <div className="lg:col-span-1">
            <GridConfigPanel />
          </div>

          {/* Active Grids List */}
          <div className="lg:col-span-2">
            <ActiveGridList onSelectGrid={setSelectedGrid} />
          </div>
        </div>
      </main>

      {/* Grid Detail Modal */}
      {selectedGrid && (
        <GridDetailModal
          grid={selectedGrid}
          isOpen={!!selectedGrid}
          onClose={() => setSelectedGrid(null)}
        />
      )}
    </div>
  );
}

export default App;
