import { Request, Response, NextFunction } from 'express';
import CryptoJS from 'crypto-js';
import { userQueries } from '../database/db.js';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-change-in-production';

/**
 * Simple auth middleware - extracts user credentials from header
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'No authorization token provided' });
  }

  try {
    const token = authHeader.substring(7);

    // Token format: userId:password (password is plain text, transmitted over HTTPS)
    const [userId, userPassword] = token.split(':');

    if (!userId || !userPassword) {
      return res.status(401).json({ success: false, error: 'Invalid token format' });
    }

    // Verify user exists
    const user = userQueries.findById.get(userId);
    if (!user) {
      return res.status(401).json({ success: false, error: 'User not found' });
    }

    // Attach user info to request
    (req as any).userId = userId;
    (req as any).userPassword = userPassword;

    next();
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Authentication failed' });
  }
}
