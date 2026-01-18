import { Router, Response } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { query, withTransaction } from '../db/index.js';
import { generateTryOnImage, getStyleRecommendations } from '../services/gemini.js';
import { DAILY_FREE_TRYONS } from '@mirrorx/shared';
import type { TryOnJob, TryOnJobStatus } from '@mirrorx/shared';

// Indian fashion e-commerce stores for buy links
const INDIAN_STORES = [
  { name: 'Myntra', url: 'https://www.myntra.com/search?q=' },
  { name: 'Ajio', url: 'https://www.ajio.com/search/?text=' },
  { name: 'Amazon Fashion', url: 'https://www.amazon.in/s?k=' },
  { name: 'Flipkart Fashion', url: 'https://www.flipkart.com/search?q=' },
  { name: 'Meesho', url: 'https://www.meesho.com/search?q=' },
];

const router = Router();

// Configure multer for image uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.'));
    }
  },
});

// Process image with Sharp
async function processImage(buffer: Buffer): Promise<string> {
  const processed = await sharp(buffer)
    .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();

  return `data:image/jpeg;base64,${processed.toString('base64')}`;
}

// Check daily free usage
async function getDailyUsage(userId: string): Promise<number> {
  const result = await query<{ tryon_count: number }>(
    `SELECT tryon_count FROM daily_usage
     WHERE user_id = $1 AND usage_date = CURRENT_DATE`,
    [userId]
  );
  return result.rows[0]?.tryon_count || 0;
}

// POST /tryon - Create new try-on
router.post(
  '/',
  authenticate,
  upload.fields([
    { name: 'selfie_image', maxCount: 1 },
    { name: 'product_image', maxCount: 1 },
  ]),
  async (req: AuthRequest, res: Response) => {
    const startTime = Date.now();
    const jobId = uuidv4();

    try {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const selfieFile = files['selfie_image']?.[0];
      const productFile = files['product_image']?.[0];
      const { mode = 'PART', product_url } = req.body;

      if (!selfieFile) {
        return res.status(400).json({
          error: 'Missing image',
          message: 'Selfie image is required',
        });
      }

      if (!productFile && !product_url) {
        return res.status(400).json({
          error: 'Missing product',
          message: 'Product image or URL is required',
        });
      }

      const user = req.user!;
      const userId = req.userId!;

      // Check credits or daily free allowance
      const dailyUsage = await getDailyUsage(userId);
      const hasFreeTries = user.subscription_tier === 'FREE' && dailyUsage < DAILY_FREE_TRYONS;
      const hasPaidCredits = user.credits_balance > 0;
      const hasUnlimited = user.subscription_tier !== 'FREE';

      if (!hasFreeTries && !hasPaidCredits && !hasUnlimited) {
        return res.status(402).json({
          error: 'Insufficient credits',
          message: 'You have no credits remaining. Please purchase more or wait until tomorrow.',
          daily_used: dailyUsage,
          daily_limit: DAILY_FREE_TRYONS,
        });
      }

      // Process images
      const selfieBase64 = await processImage(selfieFile.buffer);
      let productBase64: string | undefined;

      if (productFile) {
        productBase64 = await processImage(productFile.buffer);
      }

      // Create job record
      await query(
        `INSERT INTO tryon_jobs (id, user_id, mode, source_image_url, product_image_url, product_url, status, credits_used)
         VALUES ($1, $2, $3, $4, $5, $6, 'PROCESSING', 1)`,
        [jobId, userId, mode, selfieBase64, productBase64 || null, product_url || null]
      );

      // Generate try-on image
      let resultImage: string;
      try {
        resultImage = await generateTryOnImage(selfieBase64, productBase64 || '', mode);
      } catch (genError) {
        // Update job as failed
        await query(
          `UPDATE tryon_jobs SET status = 'FAILED', error_message = $1, completed_at = NOW()
           WHERE id = $2`,
          [(genError as Error).message, jobId]
        );

        return res.status(500).json({
          error: 'Generation failed',
          message: 'Failed to generate try-on image. Please try again.',
          job_id: jobId,
        });
      }

      const processingTime = Date.now() - startTime;

      // Update job and deduct credits in transaction
      await withTransaction(async (client) => {
        // Update job with result
        await client.query(
          `UPDATE tryon_jobs SET status = 'SUCCEEDED', result_image_url = $1,
           processing_time_ms = $2, completed_at = NOW()
           WHERE id = $3`,
          [resultImage, processingTime, jobId]
        );

        // Deduct credits or update daily usage
        if (hasUnlimited) {
          // No credit deduction for paid subscribers
        } else if (hasFreeTries) {
          // Update daily usage
          await client.query(
            `INSERT INTO daily_usage (user_id, usage_date, tryon_count)
             VALUES ($1, CURRENT_DATE, 1)
             ON CONFLICT (user_id, usage_date)
             DO UPDATE SET tryon_count = daily_usage.tryon_count + 1`,
            [userId]
          );
        } else {
          // Deduct from credits
          await client.query(
            `INSERT INTO credits_ledger (user_id, amount, transaction_type, description, reference_id)
             VALUES ($1, -1, 'USAGE', 'Try-on generation', $2)`,
            [userId, jobId]
          );
        }
      });

      // For FULL_FIT mode, get style recommendations and buy links
      let outfitSuggestions = null;
      if (mode === 'FULL_FIT' && productBase64) {
        try {
          const styleRecs = await getStyleRecommendations(productBase64);

          // Generate buy links for each complementary item
          const buyLinks = styleRecs.complementaryItems.map(item => ({
            ...item,
            stores: INDIAN_STORES.map(store => ({
              name: store.name,
              url: `${store.url}${encodeURIComponent((item as any).searchQuery || item.description)}`,
            })),
          }));

          outfitSuggestions = {
            analysis: styleRecs.analysis,
            stylingTips: styleRecs.stylingTips || (styleRecs as any).suggestions || [],
            complementaryItems: buyLinks,
          };
        } catch (recError) {
          console.error('Style recommendations failed:', recError);
          // Continue without recommendations
        }
      }

      res.json({
        job_id: jobId,
        status: 'SUCCEEDED' as TryOnJobStatus,
        result_image_url: resultImage,
        credits_used: 1,
        processing_time_ms: processingTime,
        outfit_suggestions: outfitSuggestions,
      });
    } catch (error) {
      console.error('Try-on error:', error);

      // Update job as failed if created
      await query(
        `UPDATE tryon_jobs SET status = 'FAILED', error_message = $1, completed_at = NOW()
         WHERE id = $2`,
        [(error as Error).message, jobId]
      ).catch(() => {});

      res.status(500).json({
        error: 'Server error',
        message: 'Failed to process try-on request',
      });
    }
  }
);

// GET /tryon/:id - Get job status
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const result = await query<TryOnJob>(
      `SELECT id, user_id, mode, source_image_url, product_image_url, product_url,
              result_image_url, credits_used, status, error_message, retry_count,
              processing_time_ms, created_at, completed_at
       FROM tryon_jobs WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Try-on job not found',
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get job error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to get job status' });
  }
});

export default router;
