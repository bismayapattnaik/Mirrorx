import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
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

// Supabase JWKS client - caches keys automatically
const supabaseUrl = process.env.SUPABASE_URL || 'https://koulcpulbzmagtjbazro.supabase.co';
const jwksUri = `${supabaseUrl}/auth/v1/.well-known/jwks.json`;

const client = jwksClient({
  jwksUri,
  cache: true,
  cacheMaxAge: 600000, // 10 minutes
  rateLimit: true,
  jwksRequestsPerMinute: 10,
});

// Get signing key from JWKS
function getKey(header: jwt.JwtHeader, callback: jwt.SigningKeyCallback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      callback(err);
      return;
    }
    const signingKey = key?.getPublicKey();
    callback(null, signingKey);
  });
}

// Promisified JWT verification with JWKS
function verifyWithJwks(token: string): Promise<SupabaseJWTPayload> {
  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      getKey,
      { algorithms: ['ES256', 'RS256'] },
      (err, decoded) => {
        if (err) {
          reject(err);
        } else {
          resolve(decoded as SupabaseJWTPayload);
        }
      }
    );
  });
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
    const legacyJwtSecret = process.env.JWT_SECRET;

    let userId: string;
    let email: string | undefined;
    let userMetadata: SupabaseJWTPayload['user_metadata'] | undefined;
    let verified = false;

    // Try Supabase JWKS verification first
    try {
      const payload = await verifyWithJwks(token);
      userId = payload.sub;
      email = payload.email;
      userMetadata = payload.user_metadata;
      verified = true;
    } catch (supabaseError) {
      // Supabase verification failed, try legacy JWT if available
      if (legacyJwtSecret) {
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
        }
      }

      // If still not verified, check error type
      if (!verified) {
        if (supabaseError instanceof jwt.TokenExpiredError) {
          return res.status(401).json({
            error: 'Token expired',
            message: 'Your session has expired. Please log in again.',
          });
        }
        console.error('JWT verification failed:', supabaseError);
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
        // User exists with different ID - just use the existing user
        // Don't try to update the ID as it may have foreign key references
        result = emailResult;
        // Use the existing database user ID, not the Supabase ID
        userId = emailResult.rows[0].id;
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
