import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/index.js';
import { generateToken } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { signupSchema, loginSchema, googleAuthSchema } from '@facefit/shared';
import type { User } from '@facefit/shared';

const router = Router();

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// POST /auth/signup
router.post('/signup', validate(signupSchema), async (req, res: Response) => {
  try {
    const { email, password, name } = req.body;

    // Check if user exists
    const existingUser = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'An account with this email already exists',
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);
    const userId = uuidv4();

    // Create user
    const result = await query<User>(
      `INSERT INTO users (id, email, password_hash, name, credits_balance, subscription_tier)
       VALUES ($1, $2, $3, $4, 0, 'FREE')
       RETURNING id, email, name, phone, avatar_url, google_id, credits_balance, subscription_tier, created_at`,
      [userId, email.toLowerCase(), passwordHash, name || null]
    );

    const user = result.rows[0];
    const token = generateToken(user.id, user.email);

    res.status(201).json({ user, token });
  } catch (error: any) {
    console.error('Signup error:', error);
    // Provide more specific error message
    let message = 'Failed to create account';
    if (error.code === '42P01') {
      message = 'Database tables not set up. Please run migrations.';
    } else if (error.code === '23505') {
      message = 'An account with this email already exists';
    } else if (error.message) {
      message = error.message;
    }
    res.status(500).json({ error: 'Server error', message });
  }
});

// POST /auth/login
router.post('/login', validate(loginSchema), async (req, res: Response) => {
  try {
    const { email, password } = req.body;

    // Find user
    const result = await query<User & { password_hash: string }>(
      `SELECT id, email, name, phone, avatar_url, google_id, credits_balance,
              subscription_tier, created_at, password_hash
       FROM users WHERE email = $1`,
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect',
      });
    }

    const user = result.rows[0];

    // Check if user has password (OAuth users don't)
    if (!user.password_hash) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'This account uses Google sign-in',
      });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect',
      });
    }

    // Remove password hash from response
    const { password_hash: _, ...safeUser } = user;
    const token = generateToken(safeUser.id, safeUser.email);

    res.json({ user: safeUser, token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to log in' });
  }
});

// POST /auth/google
router.post('/google', validate(googleAuthSchema), async (req, res: Response) => {
  try {
    const { credential } = req.body;

    // Verify Google token
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      return res.status(401).json({
        error: 'Invalid credential',
        message: 'Failed to verify Google token',
      });
    }

    const { sub: googleId, email, name, picture } = payload;

    if (!email) {
      return res.status(400).json({
        error: 'Missing email',
        message: 'Google account must have an email address',
      });
    }

    // Check if user exists by Google ID or email
    let result = await query<User>(
      `SELECT id, email, name, phone, avatar_url, google_id, credits_balance,
              subscription_tier, created_at
       FROM users WHERE google_id = $1 OR email = $2`,
      [googleId, email.toLowerCase()]
    );

    let user: User;

    if (result.rows.length === 0) {
      // Create new user
      const userId = uuidv4();
      result = await query<User>(
        `INSERT INTO users (id, email, name, avatar_url, google_id, credits_balance, subscription_tier, email_verified)
         VALUES ($1, $2, $3, $4, $5, 0, 'FREE', true)
         RETURNING id, email, name, phone, avatar_url, google_id, credits_balance, subscription_tier, created_at`,
        [userId, email.toLowerCase(), name, picture, googleId]
      );
      user = result.rows[0];
    } else {
      user = result.rows[0];
      // Update Google ID if not set
      if (!user.google_id) {
        await query(
          'UPDATE users SET google_id = $1, email_verified = true WHERE id = $2',
          [googleId, user.id]
        );
        user.google_id = googleId;
      }
    }

    const token = generateToken(user.id, user.email);
    res.json({ user, token });
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to authenticate with Google' });
  }
});

export default router;
