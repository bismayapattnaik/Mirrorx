import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { query, withTransaction } from '../db/index.js';
import { updateProfileSchema } from '@facefit/shared';

const router = Router();

// GET /me - Get current user profile
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  res.json(req.user);
});

// PATCH /me - Update profile
router.patch(
  '/',
  authenticate,
  validate(updateProfileSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { name, phone, avatar_url } = req.body;
      const userId = req.userId;

      const updates: string[] = [];
      const values: unknown[] = [];
      let paramIndex = 1;

      if (name !== undefined) {
        updates.push(`name = $${paramIndex++}`);
        values.push(name);
      }
      if (phone !== undefined) {
        updates.push(`phone = $${paramIndex++}`);
        values.push(phone);
      }
      if (avatar_url !== undefined) {
        updates.push(`avatar_url = $${paramIndex++}`);
        values.push(avatar_url);
      }

      if (updates.length === 0) {
        return res.json(req.user);
      }

      values.push(userId);
      const result = await query(
        `UPDATE users SET ${updates.join(', ')}
         WHERE id = $${paramIndex}
         RETURNING id, email, name, phone, avatar_url, google_id, credits_balance, subscription_tier, created_at`,
        values
      );

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({ error: 'Server error', message: 'Failed to update profile' });
    }
  }
);

// DELETE /me - Delete account (DPDP Act compliance)
router.delete('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;

    await withTransaction(async (client) => {
      // Delete all user data
      await client.query('DELETE FROM wardrobe WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM credits_ledger WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM subscriptions WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM orders WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM tryon_jobs WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM daily_usage WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM users WHERE id = $1', [userId]);
    });

    res.json({ success: true, message: 'Account and all associated data deleted' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to delete account' });
  }
});

export default router;
