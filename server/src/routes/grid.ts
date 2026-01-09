import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import CryptoJS from 'crypto-js';
import { gridQueries, userQueries } from '../database/db.js';
import { AsterApiClient } from '../services/AsterApiClient.js';
import { GridOrderManager } from '../services/GridOrderManager.js';
import { GridCalculator } from '../services/GridCalculator.js';
import type { GridConfig, GridInstance, ApiCredentials, DbGrid } from '../types/index.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// Store active grid managers
const gridManagers = new Map<string, GridOrderManager>();

/**
 * Helper: Convert DB grid to GridInstance
 */
function dbGridToInstance(dbGrid: DbGrid): GridInstance {
  return {
    id: dbGrid.id,
    config: JSON.parse(dbGrid.config),
    status: dbGrid.status,
    createdAt: dbGrid.created_at,
    startedAt: dbGrid.started_at || undefined,
    stoppedAt: dbGrid.stopped_at || undefined,
    gridLevels: JSON.parse(dbGrid.grid_levels),
    orders: JSON.parse(dbGrid.orders),
    profit: JSON.parse(dbGrid.profit),
    baseAssetHolding: dbGrid.base_asset_holding,
  };
}

/**
 * Helper: Decrypt user credentials
 */
function decryptCredentials(encryptedData: string, password: string): ApiCredentials | null {
  try {
    const data = JSON.parse(encryptedData);
    const salt = CryptoJS.enc.Base64.parse(data.salt);
    const iv = CryptoJS.enc.Base64.parse(data.iv);

    const key = CryptoJS.PBKDF2(password, salt, {
      keySize: 256 / 32,
      iterations: 100000,
      hasher: CryptoJS.algo.SHA256,
    });

    const decrypted = CryptoJS.AES.decrypt(data.ciphertext, key, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });

    const plaintext = decrypted.toString(CryptoJS.enc.Utf8);
    if (!plaintext) return null;

    return JSON.parse(plaintext);
  } catch {
    return null;
  }
}

/**
 * POST /api/grids/create
 * Create a new grid
 */
router.post('/create', authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const userPassword = (req as any).userPassword;
    const config: GridConfig = req.body;

    // Get user and decrypt credentials
    const user = userQueries.findById.get(userId) as any;
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const credentials = decryptCredentials(user.encrypted_credentials as string, userPassword);
    if (!credentials) {
      return res.status(401).json({ success: false, error: 'Failed to decrypt credentials' });
    }

    // Create API client
    const apiClient = new AsterApiClient(credentials);
    await apiClient.syncServerTime();

    // Get symbol info and validate
    const symbolInfo = await apiClient.getSymbolInfo(config.symbol);
    const currentPrice = await apiClient.getPrice(config.symbol);
    const balance = await apiClient.getBalance(symbolInfo.quoteAsset);
    const fees = await apiClient.getFeeRates();

    const validation = GridCalculator.validate(config, symbolInfo, currentPrice, balance, fees.maker);

    if (!validation.isValid) {
      return res.status(400).json({ success: false, error: validation.errors.join('; ') });
    }

    // Create grid instance
    const gridId = uuidv4().slice(0, 8);
    const levels = GridCalculator.calculateLevels(
      config.upperPrice,
      config.lowerPrice,
      config.gridCount,
      config.gridType
    );

    const gridInstance: GridInstance = {
      id: gridId,
      config,
      status: 'PENDING',
      createdAt: Date.now(),
      gridLevels: levels.map((price, index) => ({
        index,
        price,
        status: 'EMPTY',
      })),
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

    // Save to database
    gridQueries.create.run({
      id: gridId,
      user_id: userId,
      config: JSON.stringify(config),
      status: 'PENDING',
      created_at: gridInstance.createdAt,
      started_at: null,
      stopped_at: null,
      grid_levels: JSON.stringify(gridInstance.gridLevels),
      orders: JSON.stringify([]),
      profit: JSON.stringify(gridInstance.profit),
      base_asset_holding: 0,
    });

    // Create manager (but don't start yet)
    const manager = new GridOrderManager(gridInstance, symbolInfo, apiClient, fees);
    gridManagers.set(gridId, manager);

    res.json({ success: true, data: { gridId, grid: gridInstance } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Error] Failed to create grid:', error);
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * POST /api/grids/:gridId/start
 * Start a grid
 */
router.post('/:gridId/start', authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const userPassword = (req as any).userPassword;
    const { gridId } = req.params;

    let manager = gridManagers.get(gridId);

    // If manager doesn't exist, try to recreate it from database
    if (!manager) {
      const dbGrid = gridQueries.findById.get(gridId) as DbGrid | undefined;
      if (!dbGrid) {
        return res.status(404).json({ success: false, error: 'Grid not found' });
      }

      // Check if grid belongs to this user
      if (dbGrid.user_id !== userId) {
        return res.status(403).json({ success: false, error: 'Unauthorized' });
      }

      // Get user credentials
      const user = userQueries.findById.get(userId) as any;
      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      const credentials = decryptCredentials(user.encrypted_credentials as string, userPassword);
      if (!credentials) {
        return res.status(401).json({ success: false, error: 'Failed to decrypt credentials' });
      }

      // Recreate manager
      const apiClient = new AsterApiClient(credentials);
      await apiClient.syncServerTime();

      const gridInstance = dbGridToInstance(dbGrid);
      const symbolInfo = await apiClient.getSymbolInfo(gridInstance.config.symbol);
      const fees = await apiClient.getFeeRates();

      manager = new GridOrderManager(gridInstance, symbolInfo, apiClient, fees);
      gridManagers.set(gridId, manager);
    }

    await manager.start();

    res.json({ success: true, data: { grid: manager.getInstance() } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Error] Failed to start grid ${req.params.gridId}:`, error);
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * POST /api/grids/:gridId/stop
 * Stop a grid
 */
router.post('/:gridId/stop', authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const userPassword = (req as any).userPassword;
    const { gridId } = req.params;
    const { sellHoldings } = req.body;

    let manager = gridManagers.get(gridId);

    // If manager doesn't exist, try to recreate it from database
    if (!manager) {
      const dbGrid = gridQueries.findById.get(gridId) as DbGrid | undefined;
      if (!dbGrid) {
        return res.status(404).json({ success: false, error: 'Grid not found' });
      }

      // Check if grid belongs to this user
      if (dbGrid.user_id !== userId) {
        return res.status(403).json({ success: false, error: 'Unauthorized' });
      }

      // Get user credentials
      const user = userQueries.findById.get(userId) as any;
      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      const credentials = decryptCredentials(user.encrypted_credentials as string, userPassword);
      if (!credentials) {
        return res.status(401).json({ success: false, error: 'Failed to decrypt credentials' });
      }

      // Recreate manager
      const apiClient = new AsterApiClient(credentials);
      await apiClient.syncServerTime();

      const gridInstance = dbGridToInstance(dbGrid);
      const symbolInfo = await apiClient.getSymbolInfo(gridInstance.config.symbol);
      const fees = await apiClient.getFeeRates();

      manager = new GridOrderManager(gridInstance, symbolInfo, apiClient, fees);
      gridManagers.set(gridId, manager);
    }

    await manager.stop(sellHoldings || false);

    res.json({ success: true, data: { grid: manager.getInstance() } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Error] Failed to stop grid ${req.params.gridId}:`, error);
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * DELETE /api/grids/:gridId
 * Delete a grid
 */
router.delete('/:gridId', authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const userPassword = (req as any).userPassword;
    const { gridId } = req.params;

    // Check if grid exists in database
    const dbGrid = gridQueries.findById.get(gridId) as DbGrid | undefined;
    if (!dbGrid) {
      return res.status(404).json({ success: false, error: 'Grid not found' });
    }

    // Check if grid belongs to this user
    if (dbGrid.user_id !== userId) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    let manager = gridManagers.get(gridId);

    // If grid is running but manager doesn't exist, recreate it
    if (!manager && dbGrid.status === 'RUNNING') {
      // Get user credentials
      const user = userQueries.findById.get(userId) as any;
      if (user) {
        const credentials = decryptCredentials(user.encrypted_credentials as string, userPassword);
        if (credentials) {
          try {
            const apiClient = new AsterApiClient(credentials);
            await apiClient.syncServerTime();

            const gridInstance = dbGridToInstance(dbGrid);
            const symbolInfo = await apiClient.getSymbolInfo(gridInstance.config.symbol);
            const fees = await apiClient.getFeeRates();

            manager = new GridOrderManager(gridInstance, symbolInfo, apiClient, fees);
          } catch (error) {
            console.error(`[Error] Failed to recreate manager for deletion:`, error);
          }
        }
      }
    }

    // Stop manager if running
    if (manager && manager.getIsRunning()) {
      await manager.stop();
    }
    gridManagers.delete(gridId);

    // Delete from database
    gridQueries.delete.run(gridId);

    res.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * Helper: Restore running grids for a user
 */
async function restoreRunningGrids(userId: string, userPassword: string): Promise<void> {
  try {
    // Get all RUNNING grids for this user
    const dbGrids = gridQueries.findByUserId.all(userId) as DbGrid[];
    const runningGrids = dbGrids.filter(g => g.status === 'RUNNING');

    if (runningGrids.length === 0) {
      return;
    }

    console.log(`[Recovery] Found ${runningGrids.length} running grids for user ${userId}`);

    // Get user credentials
    const user = userQueries.findById.get(userId) as any;
    if (!user) {
      console.error(`[Recovery] User ${userId} not found`);
      return;
    }

    const credentials = decryptCredentials(user.encrypted_credentials as string, userPassword);
    if (!credentials) {
      console.error(`[Recovery] Failed to decrypt credentials for user ${userId}`);
      return;
    }

    // Create API client
    const apiClient = new AsterApiClient(credentials);
    await apiClient.syncServerTime();

    // Restore each grid
    for (const dbGrid of runningGrids) {
      try {
        // Skip if manager already exists
        if (gridManagers.has(dbGrid.id)) {
          console.log(`[Recovery] Grid ${dbGrid.id} manager already exists, skipping`);
          continue;
        }

        const gridInstance = dbGridToInstance(dbGrid);
        const symbolInfo = await apiClient.getSymbolInfo(gridInstance.config.symbol);
        const fees = await apiClient.getFeeRates();

        const manager = new GridOrderManager(gridInstance, symbolInfo, apiClient, fees);

        // Don't call start() - grid is already running on exchange
        // Just restore the manager to resume monitoring
        manager.resumeMonitoring();

        gridManagers.set(dbGrid.id, manager);
        console.log(`[Recovery] Grid ${dbGrid.id} restored and monitoring resumed`);
      } catch (error) {
        console.error(`[Recovery] Failed to restore grid ${dbGrid.id}:`, error);
      }
    }

    console.log(`[Recovery] Restored ${runningGrids.length} running grids for user ${userId}`);
  } catch (error) {
    console.error(`[Recovery] Error restoring grids for user ${userId}:`, error);
  }
}

/**
 * GET /api/grids
 * Get all grids for user (and auto-restore running grids)
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const userPassword = (req as any).userPassword;

    // Auto-restore running grids on first access
    await restoreRunningGrids(userId, userPassword);

    const dbGrids = gridQueries.findByUserId.all(userId) as DbGrid[];
    const grids = dbGrids.map(dbGridToInstance);

    res.json({ success: true, data: { grids } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * GET /api/grids/:gridId
 * Get grid details
 */
router.get('/:gridId', authMiddleware, async (req, res) => {
  try {
    const { gridId } = req.params;

    // Try to get from manager first (most up-to-date)
    const manager = gridManagers.get(gridId);
    if (manager) {
      return res.json({ success: true, data: { grid: manager.getInstance() } });
    }

    // Fall back to database
    const dbGrid = gridQueries.findById.get(gridId) as DbGrid | undefined;
    if (!dbGrid) {
      return res.status(404).json({ success: false, error: 'Grid not found' });
    }

    const grid = dbGridToInstance(dbGrid);
    res.json({ success: true, data: { grid } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * GET /api/grids/health
 * Get health status of all running grids
 */
router.get('/health', authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).userId;

    // Get all grids for this user
    const dbGrids = gridQueries.findByUserId.all(userId) as DbGrid[];
    const runningGrids = dbGrids.filter(g => g.status === 'RUNNING');

    const healthStatus = runningGrids.map(dbGrid => {
      const manager = gridManagers.get(dbGrid.id);

      if (!manager) {
        return {
          gridId: dbGrid.id,
          isHealthy: false,
          warnings: ['Manager not found in memory'],
          lastActivityTime: null,
          lastErrorTime: null,
          errorCount: 0,
          timeSinceActivity: null,
        };
      }

      const health = manager.getHealthStatus();
      return {
        gridId: dbGrid.id,
        ...health,
      };
    });

    const overallHealthy = healthStatus.every(h => h.isHealthy);

    res.json({
      success: true,
      data: {
        overallHealthy,
        gridCount: runningGrids.length,
        healthyCount: healthStatus.filter(h => h.isHealthy).length,
        unhealthyCount: healthStatus.filter(h => !h.isHealthy).length,
        grids: healthStatus,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
