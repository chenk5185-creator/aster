import Database, { type Database as DatabaseType, type Statement } from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import type { DbGrid, DbUser } from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Database path
const dbPath = process.env.DATABASE_PATH || join(__dirname, '../../data/aster.db');
const dbDir = dirname(dbPath);

// Ensure data directory exists
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}

// Initialize database
const db: DatabaseType = new Database(dbPath);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Create tables
function initDatabase() {
  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      encrypted_credentials TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      last_login_at INTEGER NOT NULL
    )
  `);

  // Grids table
  db.exec(`
    CREATE TABLE IF NOT EXISTS grids (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      config TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      started_at INTEGER,
      stopped_at INTEGER,
      grid_levels TEXT NOT NULL,
      orders TEXT NOT NULL,
      profit TEXT NOT NULL,
      base_asset_holding REAL NOT NULL DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Create indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_grids_user_id ON grids(user_id);
    CREATE INDEX IF NOT EXISTS idx_grids_status ON grids(status);
  `);

  console.log('[DB] Database initialized successfully');
}

// Initialize on import
initDatabase();

// User queries
export const userQueries: {
  create: Statement<DbUser>;
  findById: Statement<[string]>;
  updateLastLogin: Statement<[number, string]>;
  updateCredentials: Statement<[string, string]>;
} = {
  create: db.prepare<DbUser>(`
    INSERT INTO users (id, encrypted_credentials, created_at, last_login_at)
    VALUES (@id, @encrypted_credentials, @created_at, @last_login_at)
  `),

  findById: db.prepare<[string]>(`
    SELECT * FROM users WHERE id = ?
  `),

  updateLastLogin: db.prepare<[number, string]>(`
    UPDATE users SET last_login_at = ? WHERE id = ?
  `),

  updateCredentials: db.prepare<[string, string]>(`
    UPDATE users SET encrypted_credentials = ? WHERE id = ?
  `),
};

// Grid queries
export const gridQueries: {
  create: Statement<DbGrid>;
  findById: Statement<[string]>;
  findByUserId: Statement<[string]>;
  update: Statement<DbGrid & { id: string }>;
  delete: Statement<[string]>;
  findRunning: Statement;
} = {
  create: db.prepare<DbGrid>(`
    INSERT INTO grids (
      id, user_id, config, status, created_at, started_at, stopped_at,
      grid_levels, orders, profit, base_asset_holding
    )
    VALUES (
      @id, @user_id, @config, @status, @created_at, @started_at, @stopped_at,
      @grid_levels, @orders, @profit, @base_asset_holding
    )
  `),

  findById: db.prepare<[string]>(`
    SELECT * FROM grids WHERE id = ?
  `),

  findByUserId: db.prepare<[string]>(`
    SELECT * FROM grids WHERE user_id = ? ORDER BY created_at DESC
  `),

  update: db.prepare<DbGrid & { id: string }>(`
    UPDATE grids SET
      config = @config,
      status = @status,
      started_at = @started_at,
      stopped_at = @stopped_at,
      grid_levels = @grid_levels,
      orders = @orders,
      profit = @profit,
      base_asset_holding = @base_asset_holding
    WHERE id = @id
  `),

  delete: db.prepare<[string]>(`
    DELETE FROM grids WHERE id = ?
  `),

  findRunning: db.prepare(`
    SELECT * FROM grids WHERE status = 'RUNNING'
  `),
};

export { db };
export type { DatabaseType, Statement };
