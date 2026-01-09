import axios, { type AxiosInstance } from 'axios';
import type { GridConfig, GridInstance } from '../../types';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Backend API Client
 * Communicates with the Railway backend server
 */
class BackendApiClient {
  private axios: AxiosInstance;
  private userId: string = 'default-user';
  private userPassword: string = '';

  constructor() {
    this.axios = axios.create({
      baseURL: API_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Set user credentials for authentication
   */
  setCredentials(userId: string, password: string) {
    this.userId = userId;
    this.userPassword = password;
  }

  /**
   * Setup user credentials on backend
   */
  async setupUser(apiKey: string, apiSecret: string, password: string, userId?: string): Promise<string> {
    const response = await this.axios.post<ApiResponse<{ userId: string }>>(
      '/api/user/setup',
      { apiKey, apiSecret, password, userId }
    );

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to setup user');
    }

    const newUserId = response.data.data.userId;
    this.setCredentials(newUserId, password);
    return newUserId;
  }

  /**
   * Get authorization header
   */
  private getAuthHeader(): string {
    // Simple token format: userId:password
    return `Bearer ${this.userId}:${this.userPassword}`;
  }

  /**
   * Create a new grid
   */
  async createGrid(config: GridConfig): Promise<{ gridId: string; grid: GridInstance }> {
    const response = await this.axios.post<ApiResponse<{ gridId: string; grid: GridInstance }>>(
      '/api/grids/create',
      config,
      {
        headers: {
          Authorization: this.getAuthHeader(),
        },
      }
    );

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to create grid');
    }

    return response.data.data;
  }

  /**
   * Start a grid
   */
  async startGrid(gridId: string): Promise<GridInstance> {
    const response = await this.axios.post<ApiResponse<{ grid: GridInstance }>>(
      `/api/grids/${gridId}/start`,
      {},
      {
        headers: {
          Authorization: this.getAuthHeader(),
        },
      }
    );

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to start grid');
    }

    return response.data.data.grid;
  }

  /**
   * Stop a grid
   */
  async stopGrid(gridId: string, sellHoldings: boolean = false): Promise<GridInstance> {
    const response = await this.axios.post<ApiResponse<{ grid: GridInstance }>>(
      `/api/grids/${gridId}/stop`,
      { sellHoldings },
      {
        headers: {
          Authorization: this.getAuthHeader(),
        },
      }
    );

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to stop grid');
    }

    return response.data.data.grid;
  }

  /**
   * Get all grids
   */
  async getGrids(): Promise<GridInstance[]> {
    const response = await this.axios.get<ApiResponse<{ grids: GridInstance[] }>>(
      '/api/grids',
      {
        headers: {
          Authorization: this.getAuthHeader(),
        },
      }
    );

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to get grids');
    }

    return response.data.data.grids;
  }

  /**
   * Get grid details
   */
  async getGrid(gridId: string): Promise<GridInstance> {
    const response = await this.axios.get<ApiResponse<{ grid: GridInstance }>>(
      `/api/grids/${gridId}`,
      {
        headers: {
          Authorization: this.getAuthHeader(),
        },
      }
    );

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to get grid');
    }

    return response.data.data.grid;
  }

  /**
   * Delete a grid
   */
  async deleteGrid(gridId: string): Promise<void> {
    const response = await this.axios.delete<ApiResponse<void>>(
      `/api/grids/${gridId}`,
      {
        headers: {
          Authorization: this.getAuthHeader(),
        },
      }
    );

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to delete grid');
    }
  }

  /**
   * Get profit history for a specific grid
   */
  async getGridProfitHistory(
    gridId: string,
    startDate?: number,
    endDate?: number
  ): Promise<ProfitHistoryRecord[]> {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate.toString());
    if (endDate) params.append('endDate', endDate.toString());

    const response = await this.axios.get<
      ApiResponse<{ history: ProfitHistoryRecord[]; totalRecords: number }>
    >(`/api/grids/${gridId}/profit-history${params.toString() ? `?${params}` : ''}`, {
      headers: {
        Authorization: this.getAuthHeader(),
      },
    });

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to get profit history');
    }

    return response.data.data.history;
  }
}

export interface ProfitHistoryRecord {
  id: number;
  grid_id: string;
  user_id: string;
  buy_order_id: string;
  sell_order_id: string;
  buy_price: number;
  sell_price: number;
  quantity: number;
  profit: number;
  fees: number;
  created_at: number;
}

export const backendApi = new BackendApiClient();
