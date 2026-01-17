import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../db/index.js';
import type { User } from '@mirrorx/shared';

export interface AuthRequest extends Request {
  user?: User;
  userId?: string;
}

interface JWTPayload {
  userId: string;
  email: string;
  iat: number;
  exp: number;
}

export async function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing or invalid authorization header',
      });
    }

    const token = authHeader.substring(7);
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      console.error('JWT_SECRET not configured');
      return res.status(500).json({
        error: 'Configuration error',
        message: 'Server authentication not configured',
      });
    }

    let payload: JWTPayload;
    try {
      payload = jwt.verify(token, secret) as JWTPayload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return res.status(401).json({
          error: 'Token expired',
          message: 'Your session has expired. Please log in again.',
        });
      }
      return res.status(401).json({
        error: 'Invalid token',
        message: 'Authentication failed',
      });
    }

    // Fetch user from database
    const result = await query<User>(
      `SELECT id, email, name, phone, avatar_url, google_id, credits_balance,
              subscription_tier, email_verified, created_at, updated_at
       FROM users WHERE id = $1`,
      [payload.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: 'User not found',
        message: 'The authenticated user no longer exists',
      });
    }

    req.user = result.rows[0];
    req.userId = payload.userId;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      error: 'Authentication error',
      message: 'An error occurred during authentication',
    });
  }
}

export function optionalAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return next();
  }

  return authenticate(req, res, next);
}

export function generateToken(userId: string, email: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET not configured');
  }

  return jwt.sign({ userId, email }, secret, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}
