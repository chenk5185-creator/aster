import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import CryptoJS from 'crypto-js';
import { userQueries } from '../database/db.js';
import type { ApiCredentials } from '../types/index.js';

const router = Router();

/**
 * Encrypt credentials using PBKDF2 + AES (same as frontend)
 */
function encryptCredentials(credentials: ApiCredentials, password: string): string {
  const salt = CryptoJS.lib.WordArray.random(128 / 8);
  const key = CryptoJS.PBKDF2(password, salt, {
    keySize: 256 / 32,
    iterations: 100000,
    hasher: CryptoJS.algo.SHA256,
  });
  const iv = CryptoJS.lib.WordArray.random(128 / 8);
  const encrypted = CryptoJS.AES.encrypt(JSON.stringify(credentials), key, {
    iv: iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });

  const result = {
    version: '2.0',
    salt: CryptoJS.enc.Base64.stringify(salt),
    iv: CryptoJS.enc.Base64.stringify(iv),
    ciphertext: encrypted.toString(),
  };

  return JSON.stringify(result);
}

/**
 * POST /api/user/setup
 * Setup user credentials on the backend
 */
router.post('/setup', async (req, res) => {
  try {
    const { apiKey, apiSecret, password } = req.body;

    if (!apiKey || !apiSecret || !password) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: apiKey, apiSecret, password'
      });
    }

    // Generate or use existing user ID from localStorage
    let userId = req.body.userId;
    if (!userId) {
      userId = uuidv4();
    }

    const credentials: ApiCredentials = { apiKey, apiSecret };
    const encryptedCredentials = encryptCredentials(credentials, password);

    // Check if user exists
    const existingUser = userQueries.findById.get(userId) as any;

    if (existingUser) {
      // Update existing user
      userQueries.updateCredentials.run(encryptedCredentials, userId);
      userQueries.updateLastLogin.run(Date.now(), userId);
    } else {
      // Create new user
      userQueries.create.run({
        id: userId,
        encrypted_credentials: encryptedCredentials,
        created_at: Date.now(),
        last_login_at: Date.now(),
      });
    }

    res.json({
      success: true,
      data: { userId }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
