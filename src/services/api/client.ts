import axios from 'axios';
import type { AxiosInstance, AxiosRequestConfig } from 'axios';
import CryptoJS from 'crypto-js';

const BASE_URL = 'https://sapi.asterdex.com';

export interface ApiCredentials {
  apiKey: string;
  apiSecret: string;
}

export interface ApiClientConfig {
  credentials?: ApiCredentials;
  recvWindow?: number;
}

/**
 * Generate HMAC SHA256 signature
 */
function generateSignature(queryString: string, apiSecret: string): string {
  return CryptoJS.HmacSHA256(queryString, apiSecret).toString(CryptoJS.enc.Hex);
}

/**
 * Build query string from params
 */
function buildQueryString(params: Record<string, unknown>): string {
  return Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
    .join('&');
}

/**
 * ASTER Spot API Client
 */
export class ApiClient {
  private axios: AxiosInstance;
  private credentials?: ApiCredentials;
  private recvWindow: number;
  private serverTimeOffset: number = 0;

  constructor(config: ApiClientConfig = {}) {
    this.credentials = config.credentials;
    this.recvWindow = config.recvWindow || 5000;

    this.axios = axios.create({
      baseURL: BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    // Add API key header if credentials exist
    this.axios.interceptors.request.use((config) => {
      if (this.credentials) {
        config.headers['X-MBX-APIKEY'] = this.credentials.apiKey;
      }
      return config;
    });

    // Response error handler
    this.axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response) {
          const { status, data } = error.response;
          const message = data?.msg || data?.message || 'Unknown error';
          const code = data?.code;
          throw new ApiError(message, status, code);
        }
        throw error;
      }
    );
  }

  /**
   * Set API credentials
   */
  setCredentials(credentials: ApiCredentials): void {
    this.credentials = credentials;
  }

  /**
   * Clear API credentials
   */
  clearCredentials(): void {
    this.credentials = undefined;
  }

  /**
   * Check if credentials are set
   */
  hasCredentials(): boolean {
    return !!this.credentials;
  }

  /**
   * Sync server time and calculate offset
   */
  async syncServerTime(): Promise<void> {
    const localTime = Date.now();
    const response = await this.get<{ serverTime: number }>('/api/v1/time');
    const serverTime = response.serverTime;
    this.serverTimeOffset = serverTime - localTime;
  }

  /**
   * Get current timestamp adjusted for server time
   */
  private getTimestamp(): number {
    return Date.now() + this.serverTimeOffset;
  }

  /**
   * Sign request params
   */
  private signParams(params: Record<string, unknown>): Record<string, unknown> {
    if (!this.credentials) {
      throw new Error('API credentials not set');
    }

    const signedParams = {
      ...params,
      timestamp: this.getTimestamp(),
      recvWindow: this.recvWindow,
    };

    const queryString = buildQueryString(signedParams);
    const signature = generateSignature(queryString, this.credentials.apiSecret);

    return {
      ...signedParams,
      signature,
    };
  }

  /**
   * Public GET request (no auth)
   */
  async get<T>(endpoint: string, params?: Record<string, unknown>): Promise<T> {
    const config: AxiosRequestConfig = {};
    if (params) {
      config.params = params;
    }
    const response = await this.axios.get<T>(endpoint, config);
    return response.data;
  }

  /**
   * Signed GET request (USER_DATA)
   */
  async signedGet<T>(endpoint: string, params: Record<string, unknown> = {}): Promise<T> {
    const signedParams = this.signParams(params);
    const response = await this.axios.get<T>(endpoint, { params: signedParams });
    return response.data;
  }

  /**
   * Signed POST request (TRADE)
   */
  async signedPost<T>(endpoint: string, params: Record<string, unknown> = {}): Promise<T> {
    const signedParams = this.signParams(params);
    const queryString = buildQueryString(signedParams);
    const response = await this.axios.post<T>(endpoint, queryString);
    return response.data;
  }

  /**
   * Signed DELETE request (TRADE)
   */
  async signedDelete<T>(endpoint: string, params: Record<string, unknown> = {}): Promise<T> {
    const signedParams = this.signParams(params);
    const response = await this.axios.delete<T>(endpoint, { params: signedParams });
    return response.data;
  }
}

/**
 * API Error class
 */
export class ApiError extends Error {
  status: number;
  code?: number;

  constructor(message: string, status: number, code?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

// Default client instance (without credentials)
export const apiClient = new ApiClient();
