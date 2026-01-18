import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { query } from '../db/index.js';
import { DAILY_FREE_TRYONS } from '@mrrx/shared';
import type { CreditLedgerEntry, CreditsBalanceResponse } from '@mrrx/shared';

const router = Router();

// GET /credits/balance - Get current credits balance
router.get('/balance', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const userId = req.userId!;

    // Get daily usage
    const usageResult = await query<{ tryon_count: number }>(
      `SELECT tryon_count FROM daily_usage
       WHERE user_id = $1 AND usage_date = CURRENT_DATE`,
      [userId]
    );

    const dailyUsed = usageResult.rows[0]?.tryon_count || 0;
    const dailyFreeRemaining = Math.max(0, DAILY_FREE_TRYONS - dailyUsed);

    const response: CreditsBalanceResponse = {
      balance: user.credits_balance,
      daily_free_remaining: user.subscription_tier === 'FREE' ? dailyFreeRemaining : DAILY_FREE_TRYONS,
      subscription_tier: user.subscription_tier,
    };

    res.json(response);
  } catch (error) {
    console.error('Get balance error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to get credits balance' });
  }
});

// GET /credits/history - Get credits transaction history
router.get('/history', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const offset = (page - 1) * limit;

    const result = await query<CreditLedgerEntry>(
      `SELECT id, user_id, amount, transaction_type, description, reference_id, created_at
       FROM credits_ledger
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    const countResult = await query<{ count: string }>(
      'SELECT COUNT(*) FROM credits_ledger WHERE user_id = $1',
      [userId]
    );

    const total = parseInt(countResult.rows[0].count, 10);

    res.json({
      transactions: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to get transaction history' });
  }
});

export default router;
