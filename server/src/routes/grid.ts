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
    const { gridId } = req.params;

    const manager = gridManagers.get(gridId);
    if (!manager) {
      return res.status(404).json({ success: false, error: 'Grid manager not found' });
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
    const { gridId } = req.params;
    const { sellHoldings } = req.body;

    const manager = gridManagers.get(gridId);
    if (!manager) {
      return res.status(404).json({ success: false, error: 'Grid manager not found' });
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
    const { gridId } = req.params;

    // Stop manager if running
    const manager = gridManagers.get(gridId);
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
 * GET /api/grids
 * Get all grids for user
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).userId;

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

export default router;
