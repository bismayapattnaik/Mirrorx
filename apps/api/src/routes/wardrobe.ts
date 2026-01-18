import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { validate, validateQuery } from '../middleware/validate.js';
import { query } from '../db/index.js';
import { wardrobeQuerySchema, saveToWardrobeSchema } from '@facefit/shared';
import type { WardrobeItem } from '@facefit/shared';

const router = Router();

// GET /wardrobe - List wardrobe items
router.get(
  '/',
  authenticate,
  validateQuery(wardrobeQuerySchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId;
      const { search, category, sort, page, limit } = req.query as {
        search?: string;
        category?: string;
        sort: string;
        page: number;
        limit: number;
      };

      const offset = (page - 1) * limit;
      const conditions: string[] = ['user_id = $1'];
      const params: unknown[] = [userId];
      let paramIndex = 2;

      if (search) {
        conditions.push(`(brand ILIKE $${paramIndex} OR $${paramIndex} = ANY(tags))`);
        params.push(`%${search}%`);
        paramIndex++;
      }

      if (category) {
        conditions.push(`category = $${paramIndex}`);
        params.push(category);
        paramIndex++;
      }

      let orderBy = 'created_at DESC';
      if (sort === 'oldest') {
        orderBy = 'created_at ASC';
      } else if (sort === 'brand') {
        orderBy = 'brand ASC NULLS LAST, created_at DESC';
      }

      const whereClause = conditions.join(' AND ');

      const result = await query<WardrobeItem>(
        `SELECT id, user_id, tryon_image_url, product_image_url, product_url,
                brand, category, tags, created_at
         FROM wardrobe
         WHERE ${whereClause}
         ORDER BY ${orderBy}
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, limit, offset]
      );

      const countResult = await query<{ count: string }>(
        `SELECT COUNT(*) FROM wardrobe WHERE ${whereClause}`,
        params
      );

      const total = parseInt(countResult.rows[0].count, 10);

      res.json({
        items: result.rows,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      });
    } catch (error) {
      console.error('List wardrobe error:', error);
      res.status(500).json({ error: 'Server error', message: 'Failed to get wardrobe items' });
    }
  }
);

// POST /wardrobe/save - Save try-on result to wardrobe
router.post(
  '/save',
  authenticate,
  validate(saveToWardrobeSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId;
      const { tryon_job_id, brand, category, tags, product_url } = req.body;

      // Get try-on job result
      const jobResult = await query<{ result_image_url: string; product_image_url: string }>(
        `SELECT result_image_url, product_image_url FROM tryon_jobs
         WHERE id = $1 AND user_id = $2 AND status = 'SUCCEEDED'`,
        [tryon_job_id, userId]
      );

      if (jobResult.rows.length === 0) {
        return res.status(404).json({
          error: 'Job not found',
          message: 'Try-on job not found or not completed',
        });
      }

      const job = jobResult.rows[0];

      // Save to wardrobe
      const result = await query<WardrobeItem>(
        `INSERT INTO wardrobe (user_id, tryon_image_url, product_image_url, product_url, brand, category, tags)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, user_id, tryon_image_url, product_image_url, product_url, brand, category, tags, created_at`,
        [userId, job.result_image_url, job.product_image_url, product_url, brand, category, tags || []]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Save to wardrobe error:', error);
      res.status(500).json({ error: 'Server error', message: 'Failed to save to wardrobe' });
    }
  }
);

// DELETE /wardrobe/:id - Delete wardrobe item
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const result = await query(
      'DELETE FROM wardrobe WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Wardrobe item not found',
      });
    }

    res.json({ success: true, message: 'Item deleted' });
  } catch (error) {
    console.error('Delete wardrobe item error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to delete item' });
  }
});

export default router;
