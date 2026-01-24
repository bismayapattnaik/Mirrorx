import { Router, Response } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { query } from '../db/index.js';
import {
  analyzeStyleDNA,
  getWardrobeRecommendations,
  generateOutfitSuggestions,
  predictSize,
  styleGarmentForUser,
  getTrendingForUser,
  StyleDNA
} from '../services/ai-tailor.js';

const router = Router();

// Configure multer for image uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images are allowed'));
    }
  },
});

// Process and compress image
async function processImage(buffer: Buffer): Promise<string> {
  const processed = await sharp(buffer)
    .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
  return processed.toString('base64');
}

// Ensure tables exist
async function ensureTablesExist() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS user_style_profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL UNIQUE REFERENCES users(id),
        style_dna JSONB,
        photo_data TEXT,
        gender VARCHAR(10),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS user_measurements (
        user_id UUID PRIMARY KEY REFERENCES users(id),
        height INTEGER,
        weight INTEGER,
        chest INTEGER,
        waist INTEGER,
        hips INTEGER,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS size_feedback (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id),
        product_category VARCHAR(50),
        brand VARCHAR(100),
        size_ordered VARCHAR(20),
        fit_feedback VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
  } catch (e) {
    // Tables might already exist
  }
}

// Initialize tables
ensureTablesExist();

/**
 * POST /api/tailor/style-dna - Create Style DNA from photo
 */
router.post('/style-dna', authenticate, upload.single('photo'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const photoFile = req.file;
    const { gender = 'female', photo } = req.body;

    let photoBase64: string;

    if (photoFile) {
      photoBase64 = await processImage(photoFile.buffer);
    } else if (photo) {
      photoBase64 = photo.replace(/^data:image\/\w+;base64,/, '');
    } else {
      res.status(400).json({ error: 'Photo is required' });
      return;
    }

    const validGender = gender === 'male' ? 'male' : 'female';
    const styleDNA = await analyzeStyleDNA(photoBase64, validGender);

    await query(
      `INSERT INTO user_style_profiles (user_id, style_dna, photo_data, gender, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         style_dna = $2, photo_data = $3, gender = $4, updated_at = NOW()`,
      [userId, JSON.stringify(styleDNA), photoBase64, validGender]
    );

    res.json({
      success: true,
      styleDNA,
      message: 'Your Style DNA has been created!'
    });
  } catch (error) {
    console.error('Style DNA analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze style', message: (error as Error).message });
  }
});

/**
 * GET /api/tailor/style-dna - Get saved Style DNA
 */
router.get('/style-dna', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;

    const result = await query<{
      style_dna: StyleDNA;
      photo_data: string;
      gender: string;
      created_at: Date;
    }>(
      `SELECT style_dna, photo_data, gender, created_at FROM user_style_profiles WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'No Style DNA found', needsProfile: true });
      return;
    }

    res.json({
      success: true,
      styleDNA: result.rows[0].style_dna,
      photoData: result.rows[0].photo_data ? `data:image/jpeg;base64,${result.rows[0].photo_data}` : null,
      gender: result.rows[0].gender,
      createdAt: result.rows[0].created_at
    });
  } catch (error) {
    console.error('Get Style DNA error:', error);
    res.status(500).json({ error: 'Failed to get Style DNA' });
  }
});

/**
 * POST /api/tailor/recommendations - Get wardrobe recommendations
 */
router.post('/recommendations', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const { budget = 'mid-range', occasion, season } = req.body;

    const profile = await query<{
      style_dna: StyleDNA;
      photo_data: string;
      gender: 'male' | 'female';
    }>(
      `SELECT style_dna, photo_data, gender FROM user_style_profiles WHERE user_id = $1`,
      [userId]
    );

    if (profile.rows.length === 0) {
      res.status(400).json({ error: 'No Style DNA found', needsProfile: true });
      return;
    }

    const { style_dna, photo_data, gender } = profile.rows[0];
    const recommendations = await getWardrobeRecommendations(photo_data, style_dna, gender, budget);

    res.json({
      success: true,
      styleDNA: style_dna,
      recommendations
    });
  } catch (error) {
    console.error('Recommendations error:', error);
    res.status(500).json({ error: 'Failed to get recommendations' });
  }
});

/**
 * POST /api/tailor/outfits - Get outfit suggestions for occasions
 */
router.post('/outfits', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const { occasions = ['casual', 'office', 'party', 'festive', 'date night'] } = req.body;

    const profile = await query<{
      style_dna: StyleDNA;
      photo_data: string;
      gender: 'male' | 'female';
    }>(
      `SELECT style_dna, photo_data, gender FROM user_style_profiles WHERE user_id = $1`,
      [userId]
    );

    if (profile.rows.length === 0) {
      res.status(400).json({ error: 'No Style DNA found', needsProfile: true });
      return;
    }

    const { style_dna, photo_data, gender } = profile.rows[0];
    const outfits = await generateOutfitSuggestions(photo_data, style_dna, gender, occasions);

    res.json({
      success: true,
      outfits
    });
  } catch (error) {
    console.error('Outfits error:', error);
    res.status(500).json({ error: 'Failed to generate outfit suggestions' });
  }
});

/**
 * POST /api/tailor/size-predict - Predict sizes across brands
 */
router.post('/size-predict', authenticate, upload.single('photo'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const { height, weight, chest, waist, hips, category = 'tops', photo } = req.body;

    let photoBase64: string;
    let gender: 'male' | 'female';

    if (req.file) {
      photoBase64 = await processImage(req.file.buffer);
      gender = req.body.gender || 'female';
    } else if (photo) {
      photoBase64 = photo.replace(/^data:image\/\w+;base64,/, '');
      gender = req.body.gender || 'female';
    } else {
      const profile = await query<{ photo_data: string; gender: 'male' | 'female' }>(
        `SELECT photo_data, gender FROM user_style_profiles WHERE user_id = $1`,
        [userId]
      );

      if (profile.rows.length === 0) {
        res.status(400).json({ error: 'Please provide a photo or create your Style DNA first' });
        return;
      }

      photoBase64 = profile.rows[0].photo_data;
      gender = profile.rows[0].gender;
    }

    const measurements = {
      height: height ? parseInt(height) : undefined,
      weight: weight ? parseInt(weight) : undefined,
      chest: chest ? parseInt(chest) : undefined,
      waist: waist ? parseInt(waist) : undefined,
      hips: hips ? parseInt(hips) : undefined,
    };

    const sizePredictions = await predictSize(photoBase64, measurements, gender, category);

    if (Object.values(measurements).some(v => v)) {
      await query(
        `INSERT INTO user_measurements (user_id, height, weight, chest, waist, hips, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (user_id) DO UPDATE SET
           height = COALESCE($2, user_measurements.height),
           weight = COALESCE($3, user_measurements.weight),
           chest = COALESCE($4, user_measurements.chest),
           waist = COALESCE($5, user_measurements.waist),
           hips = COALESCE($6, user_measurements.hips),
           updated_at = NOW()`,
        [userId, measurements.height, measurements.weight, measurements.chest, measurements.waist, measurements.hips]
      );
    }

    res.json({
      success: true,
      sizePredictions,
      measurements
    });
  } catch (error) {
    console.error('Size prediction error:', error);
    res.status(500).json({ error: 'Failed to predict sizes' });
  }
});

/**
 * POST /api/tailor/analyze-garment - Analyze if a garment suits the user
 */
router.post('/analyze-garment', authenticate, upload.single('garment'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const { garmentPhoto } = req.body;

    let garmentBase64: string;

    if (req.file) {
      garmentBase64 = await processImage(req.file.buffer);
    } else if (garmentPhoto) {
      garmentBase64 = garmentPhoto.replace(/^data:image\/\w+;base64,/, '');
    } else {
      res.status(400).json({ error: 'Garment photo is required' });
      return;
    }

    const profile = await query<{
      style_dna: StyleDNA;
      photo_data: string;
      gender: 'male' | 'female';
    }>(
      `SELECT style_dna, photo_data, gender FROM user_style_profiles WHERE user_id = $1`,
      [userId]
    );

    if (profile.rows.length === 0) {
      res.status(400).json({ error: 'Please create your Style DNA first', needsProfile: true });
      return;
    }

    const { style_dna, photo_data, gender } = profile.rows[0];
    const analysis = await styleGarmentForUser(photo_data, garmentBase64, style_dna, gender);

    res.json({
      success: true,
      analysis
    });
  } catch (error) {
    console.error('Garment analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze garment' });
  }
});

/**
 * GET /api/tailor/trending - Get trending styles personalized for user
 */
router.get('/trending', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;

    const profile = await query<{
      style_dna: StyleDNA;
      gender: 'male' | 'female';
    }>(
      `SELECT style_dna, gender FROM user_style_profiles WHERE user_id = $1`,
      [userId]
    );

    if (profile.rows.length === 0) {
      res.status(400).json({ error: 'Please create your Style DNA first', needsProfile: true });
      return;
    }

    const { style_dna, gender } = profile.rows[0];
    const trends = await getTrendingForUser(style_dna, gender);

    res.json({
      success: true,
      trends
    });
  } catch (error) {
    console.error('Trending error:', error);
    res.status(500).json({ error: 'Failed to get trending styles' });
  }
});

/**
 * POST /api/tailor/size-feedback - Submit feedback on size
 */
router.post('/size-feedback', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const { productCategory, brand, sizeOrdered, fitFeedback } = req.body;

    if (!productCategory || !sizeOrdered || !fitFeedback) {
      res.status(400).json({ error: 'All fields are required' });
      return;
    }

    await query(
      `INSERT INTO size_feedback (user_id, product_category, brand, size_ordered, fit_feedback)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, productCategory, brand || null, sizeOrdered, fitFeedback]
    );

    res.json({
      success: true,
      message: 'Size feedback saved. This will improve future recommendations.'
    });
  } catch (error) {
    console.error('Size feedback error:', error);
    res.status(500).json({ error: 'Failed to save size feedback' });
  }
});

/**
 * POST /api/tailor/quick-analysis - Quick analysis without auth (limited)
 */
router.post('/quick-analysis', upload.single('photo'), async (req, res: Response): Promise<void> => {
  try {
    const { gender = 'female', photo } = req.body;

    let photoBase64: string;

    if (req.file) {
      photoBase64 = await processImage(req.file.buffer);
    } else if (photo) {
      photoBase64 = photo.replace(/^data:image\/\w+;base64,/, '');
    } else {
      res.status(400).json({ error: 'Photo is required' });
      return;
    }

    const validGender = gender === 'male' ? 'male' : 'female';
    const styleDNA = await analyzeStyleDNA(photoBase64, validGender);

    res.json({
      success: true,
      styleDNA,
      message: 'Sign up to save your Style DNA and get full personalized recommendations!'
    });
  } catch (error) {
    console.error('Quick analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze' });
  }
});

/**
 * POST /api/tailor/complementary - Get complementary items for a garment
 * (Legacy endpoint for backward compatibility)
 */
router.post('/complementary', authenticate, upload.single('garment'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const { clothingImage, clothingType } = req.body;

    let garmentBase64: string;

    if (req.file) {
      garmentBase64 = await processImage(req.file.buffer);
    } else if (clothingImage) {
      garmentBase64 = clothingImage.replace(/^data:image\/\w+;base64,/, '');
    } else {
      res.status(400).json({ error: 'Clothing image is required' });
      return;
    }

    const profile = await query<{
      style_dna: StyleDNA;
      photo_data: string;
      gender: 'male' | 'female';
    }>(
      `SELECT style_dna, photo_data, gender FROM user_style_profiles WHERE user_id = $1`,
      [userId]
    );

    if (profile.rows.length === 0) {
      res.status(400).json({ error: 'Please create your Style DNA first', needsProfile: true });
      return;
    }

    const { style_dna, photo_data, gender } = profile.rows[0];
    const analysis = await styleGarmentForUser(photo_data, garmentBase64, style_dna, gender);

    res.json({
      success: true,
      complementaryItems: analysis.complementaryItems,
      stylingTips: analysis.howToWear,
      compatibility: analysis.compatibility
    });
  } catch (error) {
    console.error('Complementary suggestions error:', error);
    res.status(500).json({ error: 'Failed to get complementary suggestions' });
  }
});

export default router;
