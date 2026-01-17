import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../db/index.js';
import type { User } from '@mirrorx/shared';

export interface AuthRequest extends Request {
  user?: User;
  userId?: string;
}

// Legacy JWT payload structure
interface LegacyJWTPayload {
  userId: string;
  email: string;
  iat: number;
  exp: number;
}

// Supabase JWT payload structure
interface SupabaseJWTPayload {
  sub: string;  // User ID
  email?: string;
  phone?: string;
  app_metadata?: {
    provider?: string;
    providers?: string[];
  };
  user_metadata?: {
    name?: string;
    full_name?: string;
    avatar_url?: string;
    picture?: string;
  };
  iat: number;
  exp: number;
  aud: string;
  role?: string;
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
    const supabaseJwtSecret = process.env.SUPABASE_JWT_SECRET;
    const legacyJwtSecret = process.env.JWT_SECRET;

    if (!supabaseJwtSecret && !legacyJwtSecret) {
      console.error('No JWT secret configured (SUPABASE_JWT_SECRET or JWT_SECRET)');
      return res.status(500).json({
        error: 'Configuration error',
        message: 'Server authentication not configured',
      });
    }

    let userId: string;
    let email: string | undefined;
    let userMetadata: SupabaseJWTPayload['user_metadata'] | undefined;

    // Try Supabase JWT first, then fall back to legacy
    let verified = false;

    if (supabaseJwtSecret) {
      try {
        const payload = jwt.verify(token, supabaseJwtSecret) as SupabaseJWTPayload;
        userId = payload.sub;
        email = payload.email;
        userMetadata = payload.user_metadata;
        verified = true;
      } catch (supabaseError) {
        // Supabase verification failed, try legacy if available
        if (!legacyJwtSecret) {
          if (supabaseError instanceof jwt.TokenExpiredError) {
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
      }
    }

    // Try legacy JWT if Supabase verification failed or not configured
    if (!verified && legacyJwtSecret) {
      try {
        const payload = jwt.verify(token, legacyJwtSecret) as LegacyJWTPayload;
        userId = payload.userId;
        email = payload.email;
        verified = true;
      } catch (legacyError) {
        if (legacyError instanceof jwt.TokenExpiredError) {
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
    }

    if (!verified) {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'Authentication failed',
      });
    }

    // Fetch user from database
    let result = await query<User>(
      `SELECT id, email, name, phone, avatar_url, google_id, credits_balance,
              subscription_tier, email_verified, created_at, updated_at
       FROM users WHERE id = $1`,
      [userId!]
    );

    // If user not found but we have a valid Supabase token, auto-create the user
    if (result.rows.length === 0 && email) {
      // Check if user exists by email (might have been created with different ID)
      const emailResult = await query<User>(
        `SELECT id, email, name, phone, avatar_url, google_id, credits_balance,
                subscription_tier, email_verified, created_at, updated_at
         FROM users WHERE email = $1`,
        [email]
      );

      if (emailResult.rows.length > 0) {
        // User exists with different ID, update their ID to match Supabase
        await query(
          `UPDATE users SET id = $1 WHERE email = $2`,
          [userId!, email]
        );
        result = await query<User>(
          `SELECT id, email, name, phone, avatar_url, google_id, credits_balance,
                  subscription_tier, email_verified, created_at, updated_at
           FROM users WHERE id = $1`,
          [userId!]
        );
      } else {
        // Create new user from Supabase auth
        const name = userMetadata?.name || userMetadata?.full_name || email.split('@')[0];
        const avatarUrl = userMetadata?.avatar_url || userMetadata?.picture;

        await query(
          `INSERT INTO users (id, email, name, avatar_url, email_verified, credits_balance, subscription_tier)
           VALUES ($1, $2, $3, $4, true, 0, 'FREE')`,
          [userId!, email, name, avatarUrl || null]
        );

        result = await query<User>(
          `SELECT id, email, name, phone, avatar_url, google_id, credits_balance,
                  subscription_tier, email_verified, created_at, updated_at
           FROM users WHERE id = $1`,
          [userId!]
        );
      }
    }

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: 'User not found',
        message: 'The authenticated user no longer exists',
      });
    }

    req.user = result.rows[0];
    req.userId = userId!;
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
