import { Request, Response, NextFunction } from 'express';
import CryptoJS from 'crypto-js';
import { userQueries } from '../database/db.js';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-change-in-production';

/**
 * Simple auth middleware - decrypts user credentials from header
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'No authorization token provided' });
  }

  try {
    const token = authHeader.substring(7);

    // Token format: userId:encryptedPassword
    const [userId, encryptedPassword] = token.split(':');

    if (!userId || !encryptedPassword) {
      return res.status(401).json({ success: false, error: 'Invalid token format' });
    }

    // Verify user exists
    const user = userQueries.findById.get(userId);
    if (!user) {
      return res.status(401).json({ success: false, error: 'User not found' });
    }

    // Decrypt and verify password
    try {
      const decrypted = CryptoJS.AES.decrypt(encryptedPassword, ENCRYPTION_KEY).toString(CryptoJS.enc.Utf8);

      // Attach user to request
      (req as any).userId = userId;
      (req as any).userPassword = decrypted;

      next();
    } catch {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Authentication failed' });
  }
}
