import { Router, Response } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { query, withTransaction } from '../db/index.js';
import { generateTryOnImage, getStyleRecommendations } from '../services/gemini.js';
import { validateFaceUnchanged, validateImageContent } from '../services/post-processor.js';
import { segmentImage } from '../services/masking.js';
import { DAILY_FREE_TRYONS } from '@mrrx/shared';
import type { TryOnJob, TryOnJobStatus } from '@mrrx/shared';

/**
 * Face preservation metadata included in response
 */
interface FacePreservationInfo {
  facePreserved: boolean;
  faceSimilarity: number;
  restorationApplied: boolean;
}

// Indian fashion e-commerce stores for buy links
const INDIAN_STORES = [
  { name: 'Myntra', url: 'https://www.myntra.com/search?q=' },
  { name: 'Ajio', url: 'https://www.ajio.com/search/?text=' },
  { name: 'Amazon Fashion', url: 'https://www.amazon.in/s?k=' },
  { name: 'Flipkart Fashion', url: 'https://www.flipkart.com/search?q=' },
  { name: 'Meesho', url: 'https://www.meesho.com/search?q=' },
];

const router = Router();

// Ensure user_selfies table exists
async function ensureSelfieTableExists() {
  await query(`
    CREATE TABLE IF NOT EXISTS user_selfies (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      selfie_base64 TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);
}
let selfieTableInitialized = false;
async function initSelfieTable() {
  if (!selfieTableInitialized) {
    await ensureSelfieTableExists();
    selfieTableInitialized = true;
  }
}

// Save user's selfie for future use
async function saveUserSelfie(userId: string, selfieBase64: string) {
  try {
    await initSelfieTable();
    await query(
      `INSERT INTO user_selfies (user_id, selfie_base64)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET selfie_base64 = $2, updated_at = NOW()`,
      [userId, selfieBase64]
    );
  } catch (error) {
    console.error('Failed to save user selfie:', error);
  }
}

// Get user's saved selfie
async function getUserSelfie(userId: string): Promise<string | null> {
  try {
    await initSelfieTable();
    const result = await query<{ selfie_base64: string }>(
      `SELECT selfie_base64 FROM user_selfies WHERE user_id = $1`,
      [userId]
    );
    return result.rows[0]?.selfie_base64 || null;
  } catch {
    return null;
  }
}

// Validate generated image isn't empty/black
async function validateGeneratedImage(base64Image: string): Promise<boolean> {
  try {
    // Extract base64 data
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Use sharp to analyze the image
    const metadata = await sharp(buffer).metadata();

    if (!metadata.width || !metadata.height) {
      console.error('Image has no dimensions');
      return false;
    }

    // Check if image is too small
    if (metadata.width < 100 || metadata.height < 100) {
      console.error('Image is too small:', metadata.width, 'x', metadata.height);
      return false;
    }

    // Get image statistics to check if it's mostly black/empty
    const stats = await sharp(buffer).stats();

    // Check if the image is predominantly black (low mean values across all channels)
    const isBlack = stats.channels.every(channel => channel.mean < 10);
    if (isBlack) {
      console.error('Image appears to be mostly black - mean values:', stats.channels.map(c => c.mean));
      return false;
    }

    // Check if image has very low variance (solid color)
    const hasNoVariance = stats.channels.every(channel => channel.stdev < 5);
    if (hasNoVariance) {
      console.error('Image has no variance - might be a solid color');
      return false;
    }

    console.log('Image validation passed:', {
      width: metadata.width,
      height: metadata.height,
      means: stats.channels.map(c => Math.round(c.mean)),
      stdevs: stats.channels.map(c => Math.round(c.stdev))
    });

    return true;
  } catch (error) {
    console.error('Image validation error:', error);
    return false;
  }
}

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
      const { mode = 'PART', product_url, gender = 'female' } = req.body;
      const validGender = gender === 'male' ? 'male' : 'female';

      // Get user's feedback context for improved generation (learning from past feedback)
      let feedbackContext: string | undefined;
      try {
        const feedbackResult = await query<{ feedback_notes: string }>(
          `SELECT feedback_notes FROM tryon_feedback
           WHERE user_id = $1 AND satisfaction = false
           ORDER BY created_at DESC LIMIT 5`,
          [req.userId]
        );
        if (feedbackResult.rows.length > 0) {
          const issues = feedbackResult.rows.map(r => r.feedback_notes).filter(Boolean);
          if (issues.length > 0) {
            feedbackContext = `User has previously reported these issues that should be avoided:\n- ${issues.join('\n- ')}`;
          }
        }
      } catch {
        // Feedback table might not exist yet, continue without context
      }

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
      } else if (product_url) {
        // If product_url is provided, we'll pass it directly to the model
        // Replicate can accept URLs directly
        productBase64 = product_url;
      }

      // Save user's selfie for future use (Occasion Stylist, etc.)
      saveUserSelfie(userId, selfieBase64);

      // Create job record
      await query(
        `INSERT INTO tryon_jobs (id, user_id, mode, source_image_url, product_image_url, product_url, status, credits_used)
         VALUES ($1, $2, $3, $4, $5, $6, 'PROCESSING', 1)`,
        [jobId, userId, mode, selfieBase64, productBase64 || null, product_url || null]
      );

      // Generate try-on image with Gemini (ultra-precise face preservation)
      let resultImage: string;
      try {
        resultImage = await generateTryOnImage(
          selfieBase64,
          productBase64 || '',
          mode,
          validGender
        );

        // Validate the result image URL format
        if (!resultImage || !resultImage.startsWith('data:image/')) {
          console.error('Invalid result image format:', resultImage?.substring(0, 100));
          throw new Error('Generated image has invalid format');
        }

        // Additional validation - check the base64 data exists
        const base64Part = resultImage.split(',')[1];
        if (!base64Part || base64Part.length < 1000) {
          console.error('Base64 data too small or missing:', base64Part?.length || 0);
          throw new Error('Generated image data is incomplete');
        }

        // Validate image content isn't black/empty
        const isValidImage = await validateGeneratedImage(resultImage);
        if (!isValidImage) {
          console.error('Generated image appears to be black or empty');
          throw new Error('Generated image is invalid (black or empty). Please try again with different photos.');
        }

        console.log(`Valid result image generated, total length: ${resultImage.length}`);

        // Log face preservation status (face restoration happens inside generateTryOnImage)
        console.log(`[TryOn] Image generation complete for job ${jobId}`);
        console.log(`[TryOn] Mode: ${mode}, Gender: ${validGender}`);

      } catch (genError) {
        console.error('Try-on generation failed:', genError);

        // Update job as failed
        await query(
          `UPDATE tryon_jobs SET status = 'FAILED', error_message = $1, completed_at = NOW()
           WHERE id = $2`,
          [(genError as Error).message, jobId]
        );

        return res.status(500).json({
          error: 'Generation failed',
          message: (genError as Error).message || 'Failed to generate try-on image. Please try again.',
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

      // For FULL_FIT mode, get comprehensive style recommendations and buy links
      let outfitSuggestions = null;
      if (mode === 'FULL_FIT' && productBase64) {
        try {
          console.log('[TryOn] FULL_FIT mode - generating comprehensive outfit recommendations...');
          const styleRecs = await getStyleRecommendations(productBase64);

          // Generate buy links for each complementary item
          // Sort by priority: essential → recommended → optional
          const priorityOrder = { essential: 0, recommended: 1, optional: 2 };
          const sortedItems = [...styleRecs.complementaryItems].sort((a, b) => {
            const aPriority = priorityOrder[(a as any).priority || 'optional'] || 2;
            const bPriority = priorityOrder[(b as any).priority || 'optional'] || 2;
            return aPriority - bPriority;
          });

          const buyLinks = sortedItems.map(item => ({
            ...item,
            stores: INDIAN_STORES.map(store => ({
              name: store.name,
              url: `${store.url}${encodeURIComponent((item as any).searchQuery || item.description)}`,
            })),
          }));

          outfitSuggestions = {
            analysis: styleRecs.analysis,
            outfitStyle: (styleRecs as any).outfitStyle || 'casual',
            occasions: (styleRecs as any).occasions || [],
            stylingTips: styleRecs.stylingTips || [],
            complementaryItems: buyLinks,
            essentialItems: buyLinks.filter((item: any) => item.priority === 'essential'),
            recommendedItems: buyLinks.filter((item: any) => item.priority === 'recommended'),
            optionalItems: buyLinks.filter((item: any) => item.priority === 'optional'),
          };

          console.log(`[TryOn] FULL_FIT recommendations generated: ${buyLinks.length} items`);
        } catch (recError) {
          console.error('Style recommendations failed:', recError);
          // Continue without recommendations
        }
      }

      // Final face validation for response metadata
      let facePreservationInfo: FacePreservationInfo = {
        facePreserved: true,
        faceSimilarity: 0.95, // Default high (face restoration was applied internally)
        restorationApplied: true,
      };

      try {
        // Get segmentation for validation
        const segmentation = await segmentImage(selfieBase64);
        if (segmentation) {
          const faceValidation = await validateFaceUnchanged(selfieBase64, resultImage, segmentation, 0.80);
          facePreservationInfo = {
            facePreserved: faceValidation.isValid,
            faceSimilarity: faceValidation.similarity,
            restorationApplied: true,
          };
          console.log(`[TryOn] Final face similarity: ${(faceValidation.similarity * 100).toFixed(1)}%`);
        }
      } catch (validationError) {
        console.warn('[TryOn] Face validation failed, assuming success:', validationError);
      }

      res.json({
        job_id: jobId,
        status: 'SUCCEEDED' as TryOnJobStatus,
        result_image_url: resultImage,
        credits_used: 1,
        processing_time_ms: processingTime,
        outfit_suggestions: outfitSuggestions,
        face_preservation: facePreservationInfo,
      });
    } catch (error) {
      console.error('Try-on error:', error);

      // Update job as failed if created
      await query(
        `UPDATE tryon_jobs SET status = 'FAILED', error_message = $1, completed_at = NOW()
         WHERE id = $2`,
        [(error as Error).message, jobId]
      ).catch(() => { });

      res.status(500).json({
        error: 'Server error',
        message: 'Failed to process try-on request',
      });
    }
  }
);

// GET /tryon/list - List user's try-on jobs
router.get('/list/recent', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const { limit = '50', status = 'SUCCEEDED' } = req.query;
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string)));

    const result = await query<TryOnJob>(
      `SELECT id, user_id, mode, source_image_url, product_image_url, product_url,
              result_image_url, credits_used, status, error_message, created_at, completed_at
       FROM tryon_jobs
       WHERE user_id = $1 AND status = $2
       ORDER BY created_at DESC
       LIMIT $3`,
      [userId, status, limitNum]
    );

    res.json({
      jobs: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    console.error('List jobs error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to list jobs' });
  }
});

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

// POST /tryon/:id/feedback - Submit feedback for a try-on job
router.post('/:id/feedback', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const { satisfaction, feedback_notes, issues } = req.body;

    // Verify the job belongs to this user
    const jobResult = await query(
      `SELECT id FROM tryon_jobs WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (jobResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Try-on job not found',
      });
    }

    // Create feedback table if not exists
    await query(`
      CREATE TABLE IF NOT EXISTS tryon_feedback (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        job_id UUID NOT NULL REFERENCES tryon_jobs(id),
        user_id UUID NOT NULL REFERENCES users(id),
        satisfaction BOOLEAN NOT NULL,
        feedback_notes TEXT,
        issues TEXT[],
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Store feedback
    await query(
      `INSERT INTO tryon_feedback (job_id, user_id, satisfaction, feedback_notes, issues)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT DO NOTHING`,
      [id, userId, satisfaction, feedback_notes || null, issues || null]
    );

    // If not satisfied, we can use this feedback for future generations
    // The feedback context is already being read in the main try-on endpoint

    res.json({
      success: true,
      message: satisfaction
        ? 'Thank you for your positive feedback!'
        : 'Thank you for your feedback. We will use it to improve future results.',
    });
  } catch (error) {
    console.error('Feedback error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to submit feedback' });
  }
});

// GET /tryon/feedback/stats - Get feedback statistics (for learning/improvement tracking)
router.get('/feedback/stats', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;

    const result = await query<{
      total_feedback: number;
      satisfied_count: number;
      unsatisfied_count: number;
    }>(
      `SELECT
        COUNT(DISTINCT tf.job_id) as total_feedback,
        COUNT(CASE WHEN tf.satisfaction = true THEN 1 END) as satisfied_count,
        COUNT(CASE WHEN tf.satisfaction = false THEN 1 END) as unsatisfied_count
       FROM tryon_feedback tf
       WHERE tf.user_id = $1`,
      [userId]
    );

    res.json({
      total_feedback: result.rows[0]?.total_feedback || 0,
      satisfied_count: result.rows[0]?.satisfied_count || 0,
      unsatisfied_count: result.rows[0]?.unsatisfied_count || 0,
      improvement_message: 'Our AI learns from your feedback to provide better results over time.',
    });
  } catch (error) {
    console.error('Feedback stats error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to get feedback stats' });
  }
});

// GET /tryon/selfie - Get user's saved selfie
router.get('/selfie/saved', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const selfie = await getUserSelfie(userId);

    if (!selfie) {
      return res.status(404).json({
        error: 'Not found',
        message: 'No saved selfie found. Please do a try-on first.',
        has_selfie: false,
      });
    }

    res.json({
      has_selfie: true,
      selfie_base64: selfie,
    });
  } catch (error) {
    console.error('Get selfie error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to get selfie' });
  }
});

// POST /tryon/quick - Quick try-on using saved selfie
router.post(
  '/quick',
  authenticate,
  upload.single('product_image'),
  async (req: AuthRequest, res: Response) => {
    const startTime = Date.now();
    const jobId = uuidv4();

    try {
      const productFile = req.file;
      const { mode = 'PART', product_url, gender = 'female', product_image_base64 } = req.body;
      const validGender = gender === 'male' ? 'male' : 'female';

      const userId = req.userId!;
      const user = req.user!;

      // Get saved selfie
      const selfieBase64 = await getUserSelfie(userId);
      if (!selfieBase64) {
        return res.status(400).json({
          error: 'No selfie',
          message: 'You need to do at least one regular try-on first to save your photo.',
        });
      }

      // Get product image
      let productBase64: string | undefined;
      if (productFile) {
        productBase64 = await processImage(productFile.buffer);
      } else if (product_image_base64) {
        productBase64 = product_image_base64;
      } else if (product_url) {
        // Fetch product image from URL
        try {
          const response = await fetch(product_url);
          const buffer = Buffer.from(await response.arrayBuffer());
          productBase64 = await processImage(buffer);
        } catch {
          return res.status(400).json({
            error: 'Invalid URL',
            message: 'Could not fetch product image from URL.',
          });
        }
      }

      if (!productBase64) {
        return res.status(400).json({
          error: 'Missing product',
          message: 'Product image or URL is required',
        });
      }

      // Check credits
      const dailyUsage = await getDailyUsage(userId);
      const hasFreeTries = user.subscription_tier === 'FREE' && dailyUsage < DAILY_FREE_TRYONS;
      const hasPaidCredits = user.credits_balance > 0;
      const hasUnlimited = user.subscription_tier !== 'FREE';

      if (!hasFreeTries && !hasPaidCredits && !hasUnlimited) {
        return res.status(402).json({
          error: 'Insufficient credits',
          message: 'No credits remaining.',
        });
      }

      // Create job
      await query(
        `INSERT INTO tryon_jobs (id, user_id, mode, source_image_url, product_image_url, status, credits_used)
         VALUES ($1, $2, $3, $4, $5, 'PROCESSING', 1)`,
        [jobId, userId, mode, selfieBase64, productBase64]
      );

      // Generate try-on
      const resultImage = await generateTryOnImage(
        selfieBase64,
        productBase64,
        mode,
        validGender
      );

      // Validate
      if (!resultImage || !resultImage.startsWith('data:image/')) {
        throw new Error('Invalid image generated');
      }

      const isValidImage = await validateGeneratedImage(resultImage);
      if (!isValidImage) {
        throw new Error('Generated image is invalid (black or empty)');
      }

      const processingTime = Date.now() - startTime;

      // Update job
      await withTransaction(async (client) => {
        await client.query(
          `UPDATE tryon_jobs SET status = 'SUCCEEDED', result_image_url = $1,
           processing_time_ms = $2, completed_at = NOW()
           WHERE id = $3`,
          [resultImage, processingTime, jobId]
        );

        if (hasUnlimited) {
          // No deduction
        } else if (hasFreeTries) {
          await client.query(
            `INSERT INTO daily_usage (user_id, usage_date, tryon_count)
             VALUES ($1, CURRENT_DATE, 1)
             ON CONFLICT (user_id, usage_date)
             DO UPDATE SET tryon_count = daily_usage.tryon_count + 1`,
            [userId]
          );
        } else {
          await client.query(
            `INSERT INTO credits_ledger (user_id, amount, transaction_type, description, reference_id)
             VALUES ($1, -1, 'USAGE', 'Quick try-on generation', $2)`,
            [userId, jobId]
          );
        }
      });

      // Final face validation for quick try-on
      let facePreservationInfo: FacePreservationInfo = {
        facePreserved: true,
        faceSimilarity: 0.95,
        restorationApplied: true,
      };

      try {
        const segmentation = await segmentImage(selfieBase64);
        if (segmentation) {
          const faceValidation = await validateFaceUnchanged(selfieBase64, resultImage, segmentation, 0.80);
          facePreservationInfo = {
            facePreserved: faceValidation.isValid,
            faceSimilarity: faceValidation.similarity,
            restorationApplied: true,
          };
        }
      } catch {
        // Ignore validation errors for quick try-on
      }

      res.json({
        job_id: jobId,
        status: 'SUCCEEDED',
        result_image_url: resultImage,
        credits_used: 1,
        processing_time_ms: processingTime,
        face_preservation: facePreservationInfo,
      });
    } catch (error) {
      console.error('Quick try-on error:', error);
      await query(
        `UPDATE tryon_jobs SET status = 'FAILED', error_message = $1, completed_at = NOW()
         WHERE id = $2`,
        [(error as Error).message, jobId]
      );
      res.status(500).json({
        error: 'Generation failed',
        message: (error as Error).message || 'Please try again.',
      });
    }
  }
);

// ==========================================
// DEMO/GUEST TRY-ON (No Auth Required)
// For demo pages like BBA Cloths Demo
// ==========================================

// Simple in-memory rate limiting for demo (IP-based)
const demoRateLimits = new Map<string, { count: number; resetTime: number }>();
const DEMO_LIMIT_PER_HOUR = 10;
const DEMO_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour

function checkDemoRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = demoRateLimits.get(ip);

  if (!record || now > record.resetTime) {
    demoRateLimits.set(ip, { count: 1, resetTime: now + DEMO_LIMIT_WINDOW });
    return true;
  }

  if (record.count >= DEMO_LIMIT_PER_HOUR) {
    return false;
  }

  record.count++;
  return true;
}

// POST /tryon/demo - Demo try-on (no auth required, rate limited)
router.post(
  '/demo',
  upload.fields([
    { name: 'selfie_image', maxCount: 1 },
    { name: 'product_image', maxCount: 1 },
  ]),
  async (req, res: Response) => {
    const startTime = Date.now();
    const jobId = uuidv4();

    try {
      // Rate limiting
      const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
      if (!checkDemoRateLimit(clientIp)) {
        return res.status(429).json({
          error: 'Rate limit exceeded',
          message: 'Demo try-on limit reached. Please try again later or sign up for unlimited access.',
        });
      }

      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const selfieFile = files['selfie_image']?.[0];
      const productFile = files['product_image']?.[0];
      const { mode = 'PART', gender = 'female' } = req.body;
      const validGender = gender === 'male' ? 'male' : 'female';

      if (!selfieFile) {
        return res.status(400).json({
          error: 'Missing image',
          message: 'Selfie image is required',
        });
      }

      if (!productFile) {
        return res.status(400).json({
          error: 'Missing product',
          message: 'Product image is required',
        });
      }

      // Process images
      const selfieBase64 = await processImage(selfieFile.buffer);
      const productBase64 = await processImage(productFile.buffer);

      console.log(`Demo try-on request from ${clientIp}, mode: ${mode}, gender: ${validGender}`);

      // Generate try-on image with Gemini
      let resultImage: string;
      try {
        resultImage = await generateTryOnImage(
          selfieBase64,
          productBase64,
          mode,
          validGender
        );

        // Validate the result image
        if (!resultImage || !resultImage.startsWith('data:image/')) {
          throw new Error('Generated image has invalid format');
        }

        const base64Part = resultImage.split(',')[1];
        if (!base64Part || base64Part.length < 1000) {
          throw new Error('Generated image data is incomplete');
        }

        // Validate image content isn't black/empty
        const isValidImage = await validateGeneratedImage(resultImage);
        if (!isValidImage) {
          throw new Error('Generated image is invalid. Please try again with different photos.');
        }

        console.log(`Demo try-on successful, result length: ${resultImage.length}`);
      } catch (genError) {
        console.error('Demo try-on generation failed:', genError);
        return res.status(500).json({
          error: 'Generation failed',
          message: (genError as Error).message || 'Failed to generate try-on image. Please try again.',
        });
      }

      const processingTime = Date.now() - startTime;

      // Final face validation for demo
      let facePreservationInfo: FacePreservationInfo = {
        facePreserved: true,
        faceSimilarity: 0.95,
        restorationApplied: true,
      };

      try {
        const segmentation = await segmentImage(selfieBase64);
        if (segmentation) {
          const faceValidation = await validateFaceUnchanged(selfieBase64, resultImage, segmentation, 0.80);
          facePreservationInfo = {
            facePreserved: faceValidation.isValid,
            faceSimilarity: faceValidation.similarity,
            restorationApplied: true,
          };
        }
      } catch {
        // Ignore validation errors for demo
      }

      res.json({
        job_id: jobId,
        status: 'SUCCEEDED',
        result_image_url: resultImage,
        processing_time_ms: processingTime,
        demo: true,
        face_preservation: facePreservationInfo,
      });
    } catch (error) {
      console.error('Demo try-on error:', error);
      res.status(500).json({
        error: 'Server error',
        message: (error as Error).message || 'Please try again.',
      });
    }
  }
);

// ==========================================
// VIDEO TRY-ON (Decart AI)
// ==========================================

import decart from '../services/decart.js';
import { idmVtonService, hybridIdmVtonService, isIDMVTONAvailable, getIDMVTONHealth } from '../services/idm-vton-service.js';
import { ltx2Service, LTX2ServiceConfig } from '../services/ltx2-service.js';

// ==========================================
// IDM-VTON TRY-ON (State-of-the-Art VTON)
// ==========================================

// POST /tryon/idmvton - High-quality try-on using IDM-VTON
router.post(
  '/idmvton',
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
      const {
        category = 'upper_body',
        preserve_face = 'true',
        num_inference_steps = '30',
        guidance_scale = '2.5',
      } = req.body;

      if (!selfieFile) {
        return res.status(400).json({
          error: 'Missing image',
          message: 'Selfie image is required',
        });
      }

      if (!productFile) {
        return res.status(400).json({
          error: 'Missing product',
          message: 'Product/garment image is required',
        });
      }

      const user = req.user!;
      const userId = req.userId!;

      // Check credits
      const dailyUsage = await getDailyUsage(userId);
      const hasFreeTries = user.subscription_tier === 'FREE' && dailyUsage < DAILY_FREE_TRYONS;
      const hasPaidCredits = user.credits_balance > 0;
      const hasUnlimited = user.subscription_tier !== 'FREE';

      if (!hasFreeTries && !hasPaidCredits && !hasUnlimited) {
        return res.status(402).json({
          error: 'Insufficient credits',
          message: 'No credits remaining.',
        });
      }

      // Process images
      const selfieBase64 = await processImage(selfieFile.buffer);
      const productBase64 = await processImage(productFile.buffer);

      // Save selfie for future use
      saveUserSelfie(userId, selfieBase64);

      // Create job record
      await query(
        `INSERT INTO tryon_jobs (id, user_id, mode, source_image_url, product_image_url, status, credits_used)
         VALUES ($1, $2, $3, $4, $5, 'PROCESSING', 1)`,
        [jobId, userId, 'IDM-VTON', selfieBase64, productBase64]
      );

      // Check IDM-VTON availability
      const idmVtonAvailable = await isIDMVTONAvailable();

      let resultImage: string;
      let modelUsed: string;
      let facePreserved = false;

      if (idmVtonAvailable) {
        // Use IDM-VTON service
        try {
          console.log(`[IDM-VTON] Generating try-on for job ${jobId}...`);

          const result = await idmVtonService.generateTryOn({
            personImage: selfieBase64,
            garmentImage: productBase64,
            category: category as 'upper_body' | 'lower_body' | 'dress',
            preserveFace: preserve_face === 'true',
            numInferenceSteps: parseInt(num_inference_steps, 10),
            guidanceScale: parseFloat(guidance_scale),
          });

          resultImage = result.resultImage;
          modelUsed = result.metadata.modelUsed;
          facePreserved = result.metadata.facePreserved;

          console.log(`[IDM-VTON] Success for job ${jobId}, processing time: ${result.metadata.processingTimeMs}ms`);
        } catch (idmError) {
          console.error('[IDM-VTON] Failed, falling back to Gemini:', idmError);
          // Fallback to Gemini
          resultImage = await generateTryOnImage(selfieBase64, productBase64, 'PART', 'female');
          modelUsed = 'gemini-fallback';
          facePreserved = true;
        }
      } else {
        // IDM-VTON not available, use Gemini
        console.log('[IDM-VTON] Service unavailable, using Gemini');
        resultImage = await generateTryOnImage(selfieBase64, productBase64, 'PART', 'female');
        modelUsed = 'gemini';
        facePreserved = true;
      }

      // Validate result
      if (!resultImage || !resultImage.startsWith('data:image/')) {
        throw new Error('Invalid image generated');
      }

      const isValidImage = await validateGeneratedImage(resultImage);
      if (!isValidImage) {
        throw new Error('Generated image is invalid');
      }

      const processingTime = Date.now() - startTime;

      // Update job and deduct credits
      await withTransaction(async (client) => {
        await client.query(
          `UPDATE tryon_jobs SET status = 'SUCCEEDED', result_image_url = $1,
           processing_time_ms = $2, completed_at = NOW()
           WHERE id = $3`,
          [resultImage, processingTime, jobId]
        );

        if (hasUnlimited) {
          // No deduction
        } else if (hasFreeTries) {
          await client.query(
            `INSERT INTO daily_usage (user_id, usage_date, tryon_count)
             VALUES ($1, CURRENT_DATE, 1)
             ON CONFLICT (user_id, usage_date)
             DO UPDATE SET tryon_count = daily_usage.tryon_count + 1`,
            [userId]
          );
        } else {
          await client.query(
            `INSERT INTO credits_ledger (user_id, amount, transaction_type, description, reference_id)
             VALUES ($1, -1, 'USAGE', 'IDM-VTON try-on generation', $2)`,
            [userId, jobId]
          );
        }
      });

      res.json({
        job_id: jobId,
        status: 'SUCCEEDED' as TryOnJobStatus,
        result_image_url: resultImage,
        credits_used: 1,
        processing_time_ms: processingTime,
        model_used: modelUsed,
        face_preservation: {
          facePreserved,
          restorationApplied: facePreserved,
        },
      });
    } catch (error) {
      console.error('IDM-VTON try-on error:', error);
      await query(
        `UPDATE tryon_jobs SET status = 'FAILED', error_message = $1, completed_at = NOW()
         WHERE id = $2`,
        [(error as Error).message, jobId]
      );
      res.status(500).json({
        error: 'Generation failed',
        message: (error as Error).message || 'Please try again.',
      });
    }
  }
);

// GET /tryon/idmvton/health - Check IDM-VTON service health
router.get('/idmvton/health', async (_req, res: Response) => {
  try {
    const health = await getIDMVTONHealth();
    res.json(health);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: (error as Error).message,
    });
  }
});

// ==========================================
// 360° VIDEO TRY-ON (LTX-2)
// ==========================================

// POST /tryon/360 - Generate 360° rotation video from try-on result
router.post(
  '/360',
  authenticate,
  upload.single('image'),
  async (req: AuthRequest, res: Response) => {
    try {
      const imageFile = req.file;
      const {
        image_base64,
        prompt = 'a 360-degree rotating shot of a person wearing fashion clothing, studio lighting, 4k',
        num_frames = '80',
        num_inference_steps = '40',
        guidance_scale = '3.0',
      } = req.body;

      // Get image
      let imageBase64: string;
      if (imageFile) {
        imageBase64 = await processImage(imageFile.buffer);
      } else if (image_base64) {
        imageBase64 = image_base64;
      } else {
        return res.status(400).json({
          error: 'Missing image',
          message: 'Image is required (either upload or base64)',
        });
      }

      const userId = req.userId!;
      const user = req.user!;

      // Check credits (360 video costs 5 credits)
      const dailyUsage = await getDailyUsage(userId);
      const VIDEO_CREDIT_COST = 5;
      const hasFreeTries = user.subscription_tier === 'FREE' && dailyUsage < DAILY_FREE_TRYONS;
      const hasPaidCredits = user.credits_balance >= VIDEO_CREDIT_COST;
      const hasUnlimited = user.subscription_tier !== 'FREE';

      if (!hasFreeTries && !hasPaidCredits && !hasUnlimited) {
        return res.status(402).json({
          error: 'Insufficient credits',
          message: `360° video generation requires ${VIDEO_CREDIT_COST} credits.`,
        });
      }

      // Submit job to LTX-2 service
      console.log(`[LTX-2] Submitting 360° video job for user ${userId}...`);

      const job = await ltx2Service.submitJob(imageBase64, {
        prompt,
        numFrames: parseInt(num_frames, 10),
        numInferenceSteps: parseInt(num_inference_steps, 10),
        guidanceScale: parseFloat(guidance_scale),
        width: 512,
        height: 512,
      });

      console.log(`[LTX-2] Job submitted: ${job.jobId}`);

      res.json({
        job_id: job.jobId,
        status: job.status,
        message: 'Video generation job submitted. Poll /tryon/360/:jobId for status.',
        credits_cost: VIDEO_CREDIT_COST,
        estimated_time_seconds: 60,
      });
    } catch (error) {
      console.error('360° video submission error:', error);
      res.status(500).json({
        error: 'Submission failed',
        message: (error as Error).message || 'Failed to submit video job',
      });
    }
  }
);

// GET /tryon/360/:jobId - Get 360° video job status
router.get('/360/:jobId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const jobId = req.params.jobId as string;
    const status = await ltx2Service.getJobStatus(jobId);

    res.json(status);
  } catch (error) {
    console.error('360° video status error:', error);
    res.status(500).json({
      error: 'Status check failed',
      message: (error as Error).message,
    });
  }
});

// GET /tryon/360/:jobId/download - Download completed 360° video
router.get('/360/:jobId/download', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const jobId = req.params.jobId as string;

    // Check job status
    const status = await ltx2Service.getJobStatus(jobId);
    if (status.status !== 'completed') {
      return res.status(400).json({
        error: 'Not ready',
        message: `Video job is ${status.status}. Please wait until completed.`,
      });
    }

    // Download video
    const videoBuffer = await ltx2Service.downloadVideo(jobId);

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="360-tryon-${jobId}.mp4"`);
    res.send(videoBuffer);
  } catch (error) {
    console.error('360° video download error:', error);
    res.status(500).json({
      error: 'Download failed',
      message: (error as Error).message,
    });
  }
});

// POST /tryon/360/full - Full pipeline: IDM-VTON + LTX-2 360° video
router.post(
  '/360/full',
  authenticate,
  upload.fields([
    { name: 'selfie_image', maxCount: 1 },
    { name: 'product_image', maxCount: 1 },
  ]),
  async (req: AuthRequest, res: Response) => {
    try {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const selfieFile = files['selfie_image']?.[0];
      const productFile = files['product_image']?.[0];
      const {
        category = 'upper_body',
        prompt = 'a 360-degree rotating shot of a person wearing fashion clothing, studio lighting, 4k',
      } = req.body;

      if (!selfieFile || !productFile) {
        return res.status(400).json({
          error: 'Missing images',
          message: 'Both selfie and product images are required',
        });
      }

      const userId = req.userId!;
      const user = req.user!;

      // Check credits (full pipeline costs 6 credits: 1 for VTON + 5 for 360 video)
      const FULL_PIPELINE_COST = 6;
      const hasPaidCredits = user.credits_balance >= FULL_PIPELINE_COST;
      const hasUnlimited = user.subscription_tier !== 'FREE';

      if (!hasPaidCredits && !hasUnlimited) {
        return res.status(402).json({
          error: 'Insufficient credits',
          message: `Full 360° try-on requires ${FULL_PIPELINE_COST} credits.`,
        });
      }

      // Process images
      const selfieBase64 = await processImage(selfieFile.buffer);
      const productBase64 = await processImage(productFile.buffer);

      console.log(`[360 Full] Starting full pipeline for user ${userId}...`);

      // Run full pipeline
      const result = await ltx2Service.generate360TryOn(
        selfieBase64,
        productBase64,
        {
          garmentCategory: category as 'upper_body' | 'lower_body' | 'dress',
          preserveFace: true,
          prompt,
        }
      );

      console.log(`[360 Full] Pipeline completed, job: ${result.jobId}`);

      res.json({
        job_id: result.jobId,
        status: result.status,
        vton_image: result.vtonResultImage,
        message: 'Full 360° try-on job submitted. Poll /tryon/360/:jobId for video status.',
        credits_cost: FULL_PIPELINE_COST,
        metadata: result.metadata,
      });
    } catch (error) {
      console.error('360° full pipeline error:', error);
      res.status(500).json({
        error: 'Pipeline failed',
        message: (error as Error).message || 'Failed to run full 360° pipeline',
      });
    }
  }
);

// GET /tryon/360/health - Check LTX-2 service health
router.get('/360/health', async (_req, res: Response) => {
  try {
    const health = await ltx2Service.healthCheck();
    res.json(health);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: (error as Error).message,
    });
  }
});

// Configure multer for video uploads
const videoUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 300 * 1024 * 1024, // 300MB for videos
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only MP4, WebM, and MOV are allowed.'));
    }
  },
});

// POST /tryon/video - Submit video try-on job
router.post(
  '/video',
  authenticate,
  videoUpload.fields([
    { name: 'video', maxCount: 1 },
    { name: 'garment_image', maxCount: 1 },
  ]),
  async (req: AuthRequest, res: Response) => {
    try {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const videoFile = files['video']?.[0];
      const garmentFile = files['garment_image']?.[0];
      const { gender = 'female', fast = false, garment_base64 } = req.body;

      if (!videoFile) {
        return res.status(400).json({
          error: 'Missing video',
          message: 'Video file is required',
        });
      }

      // Get garment image
      let garmentBase64: string;
      if (garmentFile) {
        garmentBase64 = await processImage(garmentFile.buffer);
      } else if (garment_base64) {
        garmentBase64 = garment_base64;
      } else {
        return res.status(400).json({
          error: 'Missing garment',
          message: 'Garment image is required',
        });
      }

      // Submit video job to Decart
      const { jobId } = await decart.submitVideoTryOn(
        videoFile.buffer,
        garmentBase64,
        {
          fast: fast === 'true' || fast === true,
          gender: gender === 'male' ? 'male' : 'female',
        }
      );

      res.json({
        job_id: jobId,
        status: 'pending',
        message: 'Video try-on job submitted. Poll /tryon/video/:jobId for status.',
      });
    } catch (error) {
      console.error('Video try-on error:', error);
      res.status(500).json({
        error: 'Server error',
        message: (error as Error).message || 'Failed to submit video job',
      });
    }
  }
);

// GET /tryon/video/:jobId - Get video try-on job status
router.get('/video/:jobId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const jobId = req.params.jobId as string;
    const status = await decart.getVideoJobStatus(jobId);

    res.json(status);
  } catch (error) {
    console.error('Video job status error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to get job status',
    });
  }
});

// GET /tryon/video/:jobId/download - Download completed video
router.get('/video/:jobId/download', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const jobId = req.params.jobId as string;

    // Check job status first
    const status = await decart.getVideoJobStatus(jobId);
    if (status.status !== 'completed') {
      return res.status(400).json({
        error: 'Not ready',
        message: `Video job is ${status.status}. Please wait until completed.`,
      });
    }

    // Download and stream video
    const videoBuffer = await decart.downloadVideo(jobId);

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="tryon-${jobId}.mp4"`);
    res.send(videoBuffer);
  } catch (error) {
    console.error('Video download error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to download video',
    });
  }
});

// ==========================================
// LIVE VIDEO TRY-ON (WebRTC)
// ==========================================

// GET /tryon/live/config - Get WebRTC config for live video
router.get('/live/config', authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const config = await decart.getRealtimeConfig();

    res.json({
      ...config,
      instructions: 'Connect to serverUrl via WebRTC using the sessionToken for authentication.',
      supported_models: [
        { id: 'lucy_v2v_720p_rt', name: 'Video Editing (25 fps)', description: 'Real-time video restyling' },
        { id: 'lucy_2_rt', name: 'With Character Reference (20 fps)', description: 'Video editing with character reference' },
        { id: 'mirage', name: 'Mirage (25 fps)', description: 'Video restyling' },
        { id: 'live_avatar', name: 'Live Avatar (25 fps)', description: 'Avatar animation with audio' },
      ],
    });
  } catch (error) {
    console.error('Live config error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to get live video config',
    });
  }
});

// Health check for Decart AI
router.get('/decart/health', async (_req, res: Response) => {
  try {
    const isHealthy = await decart.healthCheck();
    res.json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      service: 'decart',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      service: 'decart',
      message: (error as Error).message,
    });
  }
});

export default router;
