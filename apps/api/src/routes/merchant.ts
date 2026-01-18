import { Router, Response, Request } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/index.js';
import { validate } from '../middleware/validate.js';
import { merchantRegisterSchema } from '@mrrx/shared';

const router = Router();

// Merchant auth middleware
async function authenticateMerchant(req: Request, res: Response, next: Function) {
  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'API key required',
    });
  }

  const keyPrefix = apiKey.substring(0, 8);

  const result = await query<{
    id: string;
    merchant_id: string;
    key_hash: string;
    is_active: boolean;
  }>(
    `SELECT mak.id, mak.merchant_id, mak.key_hash, mak.is_active, m.status
     FROM merchant_api_keys mak
     JOIN merchants m ON m.id = mak.merchant_id
     WHERE mak.key_prefix = $1 AND mak.is_active = true AND m.status = 'ACTIVE'`,
    [keyPrefix]
  );

  if (result.rows.length === 0) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid API key',
    });
  }

  const keyRecord = result.rows[0];
  const validKey = await bcrypt.compare(apiKey, keyRecord.key_hash);

  if (!validKey) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid API key',
    });
  }

  // Update last used timestamp
  await query(
    'UPDATE merchant_api_keys SET last_used_at = NOW() WHERE id = $1',
    [keyRecord.id]
  );

  (req as any).merchantId = keyRecord.merchant_id;
  next();
}

// POST /merchant/register - Register new merchant
router.post('/register', validate(merchantRegisterSchema), async (req, res: Response) => {
  try {
    const { name, email, website } = req.body;

    // Check if merchant exists
    const existing = await query('SELECT id FROM merchants WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'A merchant with this email already exists',
      });
    }

    // Create merchant (pending status)
    const merchantId = uuidv4();
    await query(
      `INSERT INTO merchants (id, name, email, website, status)
       VALUES ($1, $2, $3, $4, 'PENDING')`,
      [merchantId, name, email.toLowerCase(), website]
    );

    res.status(201).json({
      merchant_id: merchantId,
      status: 'PENDING',
      message: 'Registration received. We will review and contact you within 24-48 hours.',
    });
  } catch (error) {
    console.error('Merchant register error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to register merchant' });
  }
});

// POST /merchant/api-keys - Generate new API key (authenticated)
router.post('/api-keys', authenticateMerchant, async (req, res: Response) => {
  try {
    const merchantId = (req as any).merchantId;
    const { name } = req.body;

    // Generate API key
    const apiKey = `mx_${crypto.randomBytes(32).toString('hex')}`;
    const keyPrefix = apiKey.substring(0, 8);
    const keyHash = await bcrypt.hash(apiKey, 12);

    await query(
      `INSERT INTO merchant_api_keys (merchant_id, key_prefix, key_hash, name)
       VALUES ($1, $2, $3, $4)`,
      [merchantId, keyPrefix, keyHash, name || null]
    );

    res.status(201).json({
      api_key: apiKey, // Only shown once!
      key_prefix: keyPrefix,
      message: 'Save this API key securely. It will not be shown again.',
    });
  } catch (error) {
    console.error('Create API key error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to create API key' });
  }
});

// GET /merchant/analytics - Get usage analytics
router.get('/analytics', authenticateMerchant, async (req, res: Response) => {
  try {
    const merchantId = (req as any).merchantId;

    const merchantResult = await query<{
      name: string;
      api_requests_count: number;
      created_at: string;
    }>(
      'SELECT name, api_requests_count, created_at FROM merchants WHERE id = $1',
      [merchantId]
    );

    if (merchantResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Merchant not found',
      });
    }

    const keysResult = await query<{ key_prefix: string; last_used_at: string }>(
      `SELECT key_prefix, last_used_at FROM merchant_api_keys
       WHERE merchant_id = $1 AND is_active = true`,
      [merchantId]
    );

    res.json({
      merchant: merchantResult.rows[0],
      api_keys: keysResult.rows,
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to get analytics' });
  }
});

export default router;
