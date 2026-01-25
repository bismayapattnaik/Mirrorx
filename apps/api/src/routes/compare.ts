import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { query } from '../db/index.js';
import { TIER_ENTITLEMENTS } from '@mrrx/shared';

const router = Router();

// Ensure tables exist
async function ensureTablesExist() {
  await query(`
    CREATE TABLE IF NOT EXISTS compare_sets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(100),
      description TEXT,
      is_favorite BOOLEAN DEFAULT false,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS compare_set_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      compare_set_id UUID NOT NULL REFERENCES compare_sets(id) ON DELETE CASCADE,
      tryon_job_id UUID NOT NULL REFERENCES tryon_jobs(id) ON DELETE CASCADE,
      position INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      is_winner BOOLEAN DEFAULT false,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(compare_set_id, tryon_job_id)
    )
  `);

  // Create indexes if they don't exist
  await query(`CREATE INDEX IF NOT EXISTS idx_compare_sets_user ON compare_sets(user_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_compare_items_set ON compare_set_items(compare_set_id)`);
}

// Initialize tables on first request
let tablesInitialized = false;
async function initTables() {
  if (!tablesInitialized) {
    await ensureTablesExist();
    tablesInitialized = true;
  }
}

/**
 * POST /compare-sets - Create a new compare set
 */
router.post('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await initTables();
    const userId = req.userId;
    const user = req.user;
    const { name, description, job_ids } = req.body;

    if (!job_ids || !Array.isArray(job_ids) || job_ids.length < 2) {
      res.status(400).json({ error: 'At least 2 job IDs are required' });
      return;
    }

    // Check entitlements
    const entitlements = TIER_ENTITLEMENTS[user.subscription_tier];
    if (job_ids.length > entitlements.max_compare_items) {
      res.status(403).json({
        error: 'Compare limit exceeded',
        message: `Your plan allows comparing up to ${entitlements.max_compare_items} items. Upgrade to PRO for more.`,
        max_allowed: entitlements.max_compare_items,
      });
      return;
    }

    // Verify all jobs belong to user
    const jobCheck = await query(
      `SELECT id FROM tryon_jobs WHERE id = ANY($1) AND user_id = $2`,
      [job_ids, userId]
    );

    if (jobCheck.rows.length !== job_ids.length) {
      res.status(400).json({ error: 'One or more jobs not found or unauthorized' });
      return;
    }

    // Create compare set
    const setResult = await query(
      `INSERT INTO compare_sets (user_id, name, description)
       VALUES ($1, $2, $3)
       RETURNING id, user_id, name, description, is_favorite, created_at, updated_at`,
      [userId, name || null, description || null]
    );

    const compareSet = setResult.rows[0];

    // Add items to compare set
    for (let i = 0; i < job_ids.length; i++) {
      await query(
        `INSERT INTO compare_set_items (compare_set_id, tryon_job_id, position)
         VALUES ($1, $2, $3)`,
        [compareSet.id, job_ids[i], i]
      );
    }

    // Fetch items with job details
    const itemsResult = await query(
      `SELECT csi.*, tj.result_image_url, tj.mode, tj.status
       FROM compare_set_items csi
       JOIN tryon_jobs tj ON csi.tryon_job_id = tj.id
       WHERE csi.compare_set_id = $1
       ORDER BY csi.position`,
      [compareSet.id]
    );

    res.status(201).json({
      ...compareSet,
      items: itemsResult.rows,
    });
  } catch (error) {
    console.error('Create compare set error:', error);
    res.status(500).json({ error: 'Failed to create compare set' });
  }
});

/**
 * GET /compare-sets - List user's compare sets
 */
router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await initTables();
    const userId = req.userId;
    const { page = '1', limit = '20' } = req.query;

    const pageNum = Math.max(1, parseInt(page as string));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string)));
    const offset = (pageNum - 1) * limitNum;

    const countResult = await query(
      `SELECT COUNT(*) FROM compare_sets WHERE user_id = $1`,
      [userId]
    );

    const setsResult = await query(
      `SELECT cs.*,
        (SELECT COUNT(*) FROM compare_set_items WHERE compare_set_id = cs.id) as item_count
       FROM compare_sets cs
       WHERE cs.user_id = $1
       ORDER BY cs.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limitNum, offset]
    );

    res.json({
      sets: setsResult.rows,
      total: parseInt(countResult.rows[0].count),
      page: pageNum,
      limit: limitNum,
    });
  } catch (error) {
    console.error('List compare sets error:', error);
    res.status(500).json({ error: 'Failed to list compare sets' });
  }
});

/**
 * GET /compare-sets/:id - Get a specific compare set with items
 */
router.get('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    const setResult = await query(
      `SELECT * FROM compare_sets WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (setResult.rows.length === 0) {
      res.status(404).json({ error: 'Compare set not found' });
      return;
    }

    const itemsResult = await query(
      `SELECT csi.*,
        tj.result_image_url, tj.mode, tj.status, tj.product_image_url,
        tj.background_mode, tj.quality_tier, tj.created_at as job_created_at
       FROM compare_set_items csi
       JOIN tryon_jobs tj ON csi.tryon_job_id = tj.id
       WHERE csi.compare_set_id = $1
       ORDER BY csi.position`,
      [id]
    );

    res.json({
      ...setResult.rows[0],
      items: itemsResult.rows,
    });
  } catch (error) {
    console.error('Get compare set error:', error);
    res.status(500).json({ error: 'Failed to get compare set' });
  }
});

/**
 * POST /compare-sets/:id/items - Add item to compare set
 */
router.post('/:id/items', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const user = req.user;
    const { id } = req.params;
    const { job_id, notes } = req.body;

    if (!job_id) {
      res.status(400).json({ error: 'job_id is required' });
      return;
    }

    // Verify compare set belongs to user
    const setResult = await query(
      `SELECT * FROM compare_sets WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (setResult.rows.length === 0) {
      res.status(404).json({ error: 'Compare set not found' });
      return;
    }

    // Check current item count
    const countResult = await query(
      `SELECT COUNT(*) FROM compare_set_items WHERE compare_set_id = $1`,
      [id]
    );

    const entitlements = TIER_ENTITLEMENTS[user.subscription_tier];
    if (parseInt(countResult.rows[0].count) >= entitlements.max_compare_items) {
      res.status(403).json({
        error: 'Compare limit exceeded',
        message: `Your plan allows up to ${entitlements.max_compare_items} items per compare set.`,
      });
      return;
    }

    // Verify job belongs to user
    const jobResult = await query(
      `SELECT id FROM tryon_jobs WHERE id = $1 AND user_id = $2`,
      [job_id, userId]
    );

    if (jobResult.rows.length === 0) {
      res.status(400).json({ error: 'Job not found or unauthorized' });
      return;
    }

    // Get next position
    const posResult = await query(
      `SELECT COALESCE(MAX(position), -1) + 1 as next_pos FROM compare_set_items WHERE compare_set_id = $1`,
      [id]
    );

    // Add item
    const itemResult = await query(
      `INSERT INTO compare_set_items (compare_set_id, tryon_job_id, position, notes)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (compare_set_id, tryon_job_id) DO NOTHING
       RETURNING *`,
      [id, job_id, posResult.rows[0].next_pos, notes || null]
    );

    if (itemResult.rows.length === 0) {
      res.status(400).json({ error: 'Item already in compare set' });
      return;
    }

    res.status(201).json(itemResult.rows[0]);
  } catch (error) {
    console.error('Add compare item error:', error);
    res.status(500).json({ error: 'Failed to add item' });
  }
});

/**
 * PATCH /compare-sets/:id/items/:itemId - Update item (set winner, add notes)
 */
router.patch('/:id/items/:itemId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const { id, itemId } = req.params;
    const { is_winner, notes } = req.body;

    // Verify ownership
    const verifyResult = await query(
      `SELECT csi.id FROM compare_set_items csi
       JOIN compare_sets cs ON csi.compare_set_id = cs.id
       WHERE csi.id = $1 AND cs.id = $2 AND cs.user_id = $3`,
      [itemId, id, userId]
    );

    if (verifyResult.rows.length === 0) {
      res.status(404).json({ error: 'Item not found' });
      return;
    }

    // If setting as winner, clear other winners first
    if (is_winner === true) {
      await query(
        `UPDATE compare_set_items SET is_winner = false WHERE compare_set_id = $1`,
        [id]
      );
    }

    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (is_winner !== undefined) {
      updates.push(`is_winner = $${paramIndex++}`);
      values.push(is_winner);
    }
    if (notes !== undefined) {
      updates.push(`notes = $${paramIndex++}`);
      values.push(notes);
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No updates provided' });
      return;
    }

    values.push(itemId);
    const updateResult = await query(
      `UPDATE compare_set_items SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    res.json(updateResult.rows[0]);
  } catch (error) {
    console.error('Update compare item error:', error);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

/**
 * DELETE /compare-sets/:id - Delete compare set
 */
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    const result = await query(
      `DELETE FROM compare_sets WHERE id = $1 AND user_id = $2 RETURNING id`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Compare set not found' });
      return;
    }

    res.json({ success: true, deleted_id: id });
  } catch (error) {
    console.error('Delete compare set error:', error);
    res.status(500).json({ error: 'Failed to delete compare set' });
  }
});

/**
 * DELETE /compare-sets/:id/items/:itemId - Remove item from compare set
 */
router.delete('/:id/items/:itemId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const { id, itemId } = req.params;

    const result = await query(
      `DELETE FROM compare_set_items csi
       USING compare_sets cs
       WHERE csi.id = $1 AND csi.compare_set_id = cs.id AND cs.id = $2 AND cs.user_id = $3
       RETURNING csi.id`,
      [itemId, id, userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Item not found' });
      return;
    }

    res.json({ success: true, deleted_id: itemId });
  } catch (error) {
    console.error('Delete compare item error:', error);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

export default router;
