import { apiClient, ApiClient } from './client';
import type { AccountInfo, AccountBalance, FeeInfo } from '../../types';

/**
 * Account API
 */
export class AccountApi {
  private client: ApiClient;

  constructor(client: ApiClient = apiClient) {
    this.client = client;
  }

  /**
   * Get account information
   */
  async getAccountInfo(): Promise<AccountInfo> {
    return this.client.signedGet<AccountInfo>('/api/v1/account');
  }

  /**
   * Get all balances
   */
  async getBalances(): Promise<AccountBalance[]> {
    const info = await this.getAccountInfo();
    return info.balances;
  }

  /**
   * Get balance for a specific asset
   */
  async getBalance(asset: string): Promise<AccountBalance | undefined> {
    const balances = await this.getBalances();
    return balances.find((b) => b.asset === asset);
  }

  /**
   * Get available (free) balance for an asset
   */
  async getAvailableBalance(asset: string): Promise<number> {
    const balance = await this.getBalance(asset);
    return balance ? parseFloat(balance.free) : 0;
  }

  /**
   * Get trading fees for a symbol
   */
  async getTradingFees(symbol: string): Promise<FeeInfo> {
    // Note: This endpoint might vary based on ASTER's actual API
    // Using the standard format from the documentation
    const info = await this.getAccountInfo();
    return {
      symbol,
      makerCommission: (info.makerCommission / 10000).toString(),
      takerCommission: (info.takerCommission / 10000).toString(),
    };
  }

  /**
   * Get maker and taker fee rates
   */
  async getFeeRates(): Promise<{ maker: number; taker: number }> {
    const info = await this.getAccountInfo();
    return {
      maker: info.makerCommission / 10000,
      taker: info.takerCommission / 10000,
    };
  }

  /**
   * Check if trading is enabled
   */
  async canTrade(): Promise<boolean> {
    const info = await this.getAccountInfo();
    return info.canTrade;
  }
}

export const accountApi = new AccountApi();
