import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import CryptoJS from 'crypto-js';
import { apiClient, type ApiCredentials } from '../services/api';
import { backendApi } from '../services/api/backend';

interface CredentialsState {
  isUnlocked: boolean;
  hasCredentials: boolean;
  encryptedCredentials: string | null;
  userId: string | null;

  // Actions
  saveCredentials: (credentials: ApiCredentials, password: string) => Promise<void>;
  unlockCredentials: (password: string) => Promise<boolean>;
  lockCredentials: () => void;
  clearCredentials: () => void;
  getCredentials: () => ApiCredentials | null;
  isLegacyFormat: () => boolean;
}

// In-memory storage for unlocked credentials
let unlockedCredentials: ApiCredentials | null = null;

/**
 * Encrypted data structure
 */
interface EncryptedData {
  version: string;    // Encryption version for future upgrades
  salt: string;       // Base64 encoded salt
  iv: string;         // Base64 encoded IV
  ciphertext: string; // Base64 encoded ciphertext
}

/**
 * Encrypt credentials with password using PBKDF2 + AES-256-CBC
 *
 * Security improvements:
 * - Uses PBKDF2 key derivation (100,000 iterations)
 * - Random salt per encryption
 * - Random IV per encryption
 * - Resistant to dictionary and rainbow table attacks
 */
function encryptCredentials(credentials: ApiCredentials, password: string): string {
  // 1. Generate random salt (128 bits)
  const salt = CryptoJS.lib.WordArray.random(128 / 8);

  // 2. Derive key from password using PBKDF2
  const key = CryptoJS.PBKDF2(password, salt, {
    keySize: 256 / 32,           // 256-bit key
    iterations: 100000,          // 100k iterations (OWASP recommended)
    hasher: CryptoJS.algo.SHA256,
  });

  // 3. Generate random IV (128 bits)
  const iv = CryptoJS.lib.WordArray.random(128 / 8);

  // 4. Encrypt using AES-256-CBC
  const encrypted = CryptoJS.AES.encrypt(
    JSON.stringify(credentials),
    key,
    {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    }
  );

  // 5. Package all components
  const result: EncryptedData = {
    version: '2.0',
    salt: CryptoJS.enc.Base64.stringify(salt),
    iv: CryptoJS.enc.Base64.stringify(iv),
    ciphertext: encrypted.toString(),
  };

  return JSON.stringify(result);
}

/**
 * Decrypt credentials with password
 */
function decryptCredentials(encrypted: string, password: string): ApiCredentials | null {
  try {
    // Try to parse as v2.0 format
    const data: EncryptedData = JSON.parse(encrypted);

    // Check version
    if (data.version !== '2.0') {
      // Legacy format (v1.0) - not supported, user needs to re-enter credentials
      console.warn('Legacy encryption format detected. Please re-enter your API credentials.');
      return null;
    }

    // Parse salt and IV
    const salt = CryptoJS.enc.Base64.parse(data.salt);
    const iv = CryptoJS.enc.Base64.parse(data.iv);

    // Derive key (same as encryption)
    const key = CryptoJS.PBKDF2(password, salt, {
      keySize: 256 / 32,
      iterations: 100000,
      hasher: CryptoJS.algo.SHA256,
    });

    // Decrypt
    const decrypted = CryptoJS.AES.decrypt(
      data.ciphertext,
      key,
      {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
      }
    );

    const plaintext = decrypted.toString(CryptoJS.enc.Utf8);
    if (!plaintext) return null;

    return JSON.parse(plaintext);
  } catch (error) {
    // Failed to decrypt - wrong password or corrupted data
    console.error('Failed to decrypt credentials:', error);
    return null;
  }
}

export const useCredentialsStore = create<CredentialsState>()(
  persist(
    (set, get) => ({
      isUnlocked: false,
      hasCredentials: false,
      encryptedCredentials: null,
      userId: null,

      saveCredentials: async (credentials: ApiCredentials, password: string) => {
        const encrypted = encryptCredentials(credentials, password);
        unlockedCredentials = credentials;
        apiClient.setCredentials(credentials);

        try {
          // Sync to backend
          const existingUserId = get().userId;
          const userId = await backendApi.setupUser(
            credentials.apiKey,
            credentials.apiSecret,
            password,
            existingUserId || undefined
          );

          set({
            encryptedCredentials: encrypted,
            hasCredentials: true,
            isUnlocked: true,
            userId,
          });
        } catch (error) {
          console.error('Failed to sync credentials to backend:', error);
          // Still save locally even if backend sync fails
          set({
            encryptedCredentials: encrypted,
            hasCredentials: true,
            isUnlocked: true,
          });
        }
      },

      unlockCredentials: async (password: string): Promise<boolean> => {
        const { encryptedCredentials, userId } = get();
        if (!encryptedCredentials) return false;

        const credentials = decryptCredentials(encryptedCredentials, password);
        if (!credentials) return false;

        unlockedCredentials = credentials;
        apiClient.setCredentials(credentials);

        // Try to use existing userId if available
        if (userId) {
          backendApi.setCredentials(userId, password);

          // Verify userId is valid by testing backend connection
          try {
            await backendApi.getGrids();
            // Success - userId is valid
            set({ isUnlocked: true });
            return true;
          } catch (error) {
            // Failed - userId might be invalid, try to re-migrate
            console.warn('Existing userId failed, attempting re-migration...');
          }
        }

        // No userId or userId is invalid - migrate credentials to backend
        try {
          console.log('Migrating legacy credentials to backend...');
          const newUserId = await backendApi.setupUser(
            credentials.apiKey,
            credentials.apiSecret,
            password,
            userId || undefined
          );
          backendApi.setCredentials(newUserId, password);
          set({ userId: newUserId });
          console.log('Legacy credentials migrated successfully');
        } catch (error) {
          console.error('Failed to migrate legacy credentials to backend:', error);
          // Continue anyway - at least local API calls will work
        }

        set({ isUnlocked: true });
        return true;
      },

      lockCredentials: () => {
        unlockedCredentials = null;
        apiClient.clearCredentials();
        set({ isUnlocked: false });
      },

      clearCredentials: () => {
        unlockedCredentials = null;
        apiClient.clearCredentials();
        set({
          encryptedCredentials: null,
          hasCredentials: false,
          isUnlocked: false,
        });
      },

      getCredentials: (): ApiCredentials | null => {
        return unlockedCredentials;
      },

      isLegacyFormat: (): boolean => {
        const { encryptedCredentials } = get();
        if (!encryptedCredentials) return false;

        try {
          const data = JSON.parse(encryptedCredentials);
          // v2.0 format has version field
          return !data.version || data.version !== '2.0';
        } catch {
          // Not JSON - definitely legacy format
          return true;
        }
      },
    }),
    {
      name: 'aster-grid-credentials',
      partialize: (state) => ({
        encryptedCredentials: state.encryptedCredentials,
        hasCredentials: state.hasCredentials,
        userId: state.userId,
      }),
    }
  )
);
