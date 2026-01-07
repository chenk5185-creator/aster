import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import CryptoJS from 'crypto-js';
import { apiClient, type ApiCredentials } from '../services/api';

interface CredentialsState {
  isUnlocked: boolean;
  hasCredentials: boolean;
  encryptedCredentials: string | null;

  // Actions
  saveCredentials: (credentials: ApiCredentials, password: string) => void;
  unlockCredentials: (password: string) => boolean;
  lockCredentials: () => void;
  clearCredentials: () => void;
  getCredentials: () => ApiCredentials | null;
}

// In-memory storage for unlocked credentials
let unlockedCredentials: ApiCredentials | null = null;

/**
 * Encrypt credentials with password
 */
function encryptCredentials(credentials: ApiCredentials, password: string): string {
  const data = JSON.stringify(credentials);
  return CryptoJS.AES.encrypt(data, password).toString();
}

/**
 * Decrypt credentials with password
 */
function decryptCredentials(encrypted: string, password: string): ApiCredentials | null {
  try {
    const bytes = CryptoJS.AES.decrypt(encrypted, password);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    if (!decrypted) return null;
    return JSON.parse(decrypted);
  } catch {
    return null;
  }
}

export const useCredentialsStore = create<CredentialsState>()(
  persist(
    (set, get) => ({
      isUnlocked: false,
      hasCredentials: false,
      encryptedCredentials: null,

      saveCredentials: (credentials: ApiCredentials, password: string) => {
        const encrypted = encryptCredentials(credentials, password);
        unlockedCredentials = credentials;
        apiClient.setCredentials(credentials);

        set({
          encryptedCredentials: encrypted,
          hasCredentials: true,
          isUnlocked: true,
        });
      },

      unlockCredentials: (password: string): boolean => {
        const { encryptedCredentials } = get();
        if (!encryptedCredentials) return false;

        const credentials = decryptCredentials(encryptedCredentials, password);
        if (!credentials) return false;

        unlockedCredentials = credentials;
        apiClient.setCredentials(credentials);

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
    }),
    {
      name: 'aster-grid-credentials',
      partialize: (state) => ({
        encryptedCredentials: state.encryptedCredentials,
        hasCredentials: state.hasCredentials,
      }),
    }
  )
);
