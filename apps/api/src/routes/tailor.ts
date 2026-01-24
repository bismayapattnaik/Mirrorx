import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { query } from '../db';
import {
  analyzeUserProfile,
  getPersonalizedRecommendations,
  getSizeRecommendation,
  getComplementarySuggestions,
  getTrendingOutfits,
  ProfileAnalysis,
} from '../services/tailor';

const router = Router();

// Extend Request type for authenticated requests
interface AuthRequest extends Request {
  userId?: string;
}

// POST /tailor/analyze-profile - Analyze user's profile from photo
router.post('/analyze-profile', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { photo, gender = 'female' } = req.body;

    if (!photo) {
      return res.status(400).json({ error: 'Photo is required' });
    }

    const validGender = gender === 'male' ? 'male' : 'female';
    const profile = await analyzeUserProfile(photo, validGender);

    // Store profile in database for future use
    try {
      await query(
        `INSERT INTO user_profiles (user_id, gender, profile_data, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (user_id) DO UPDATE SET
         gender = $2, profile_data = $3, updated_at = NOW()`,
        [req.userId, validGender, JSON.stringify(profile)]
      );
    } catch (dbError) {
      // Create table if it doesn't exist
      await query(`
        CREATE TABLE IF NOT EXISTS user_profiles (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL UNIQUE REFERENCES users(id),
          gender VARCHAR(10),
          profile_data JSONB,
          height_cm INTEGER,
          weight_kg INTEGER,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);
      // Retry insert
      await query(
        `INSERT INTO user_profiles (user_id, gender, profile_data, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (user_id) DO UPDATE SET
         gender = $2, profile_data = $3, updated_at = NOW()`,
        [req.userId, validGender, JSON.stringify(profile)]
      );
    }

    res.json({
      success: true,
      profile,
    });
  } catch (error) {
    console.error('Profile analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze profile' });
  }
});

// GET /tailor/profile - Get user's saved profile
router.get('/profile', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query<{ profile_data: ProfileAnalysis; gender: string }>(
      'SELECT profile_data, gender FROM user_profiles WHERE user_id = $1',
      [req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found. Please analyze your profile first.' });
    }

    res.json({
      success: true,
      profile: result.rows[0].profile_data,
      gender: result.rows[0].gender,
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// POST /tailor/recommendations - Get personalized style recommendations
router.post('/recommendations', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { occasion, season } = req.body;

    // Get user's profile
    const profileResult = await query<{ profile_data: ProfileAnalysis; gender: string }>(
      'SELECT profile_data, gender FROM user_profiles WHERE user_id = $1',
      [req.userId]
    );

    if (profileResult.rows.length === 0) {
      return res.status(400).json({
        error: 'Profile not found. Please analyze your profile first.',
        needsProfile: true
      });
    }

    const { profile_data: profile, gender } = profileResult.rows[0];
    const validGender = gender === 'male' ? 'male' : 'female';

    const recommendations = await getPersonalizedRecommendations(
      profile,
      validGender,
      occasion,
      season
    );

    res.json({
      success: true,
      profile,
      recommendations,
    });
  } catch (error) {
    console.error('Recommendations error:', error);
    res.status(500).json({ error: 'Failed to get recommendations' });
  }
});

// POST /tailor/size-recommendation - Get size recommendation for a product
router.post('/size-recommendation', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { photo, productCategory, height, weight } = req.body;

    if (!photo || !productCategory) {
      return res.status(400).json({ error: 'Photo and product category are required' });
    }

    // Get user's profile for gender
    const profileResult = await query<{ gender: string }>(
      'SELECT gender FROM user_profiles WHERE user_id = $1',
      [req.userId]
    );

    const gender = profileResult.rows[0]?.gender === 'male' ? 'male' : 'female';

    // Get past size feedback
    let pastFeedback: Array<{ size: string; fit: string }> = [];
    try {
      const feedbackResult = await query<{ size_ordered: string; fit_feedback: string }>(
        `SELECT size_ordered, fit_feedback FROM size_feedback
         WHERE user_id = $1 AND product_category = $2
         ORDER BY created_at DESC LIMIT 5`,
        [req.userId, productCategory]
      );
      pastFeedback = feedbackResult.rows.map(r => ({
        size: r.size_ordered,
        fit: r.fit_feedback,
      }));
    } catch {
      // Table might not exist yet
    }

    const sizeRecommendation = await getSizeRecommendation(
      photo,
      gender,
      productCategory,
      height,
      weight,
      pastFeedback
    );

    res.json({
      success: true,
      sizeRecommendation,
      basedOnPastFeedback: pastFeedback.length > 0,
    });
  } catch (error) {
    console.error('Size recommendation error:', error);
    res.status(500).json({ error: 'Failed to get size recommendation' });
  }
});

// POST /tailor/size-feedback - Submit feedback on size recommendation
router.post('/size-feedback', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { productCategory, sizeOrdered, fitFeedback } = req.body;

    if (!productCategory || !sizeOrdered || !fitFeedback) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Create table if not exists
    await query(`
      CREATE TABLE IF NOT EXISTS size_feedback (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id),
        product_category VARCHAR(50),
        size_ordered VARCHAR(20),
        fit_feedback VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await query(
      `INSERT INTO size_feedback (user_id, product_category, size_ordered, fit_feedback)
       VALUES ($1, $2, $3, $4)`,
      [req.userId, productCategory, sizeOrdered, fitFeedback]
    );

    res.json({
      success: true,
      message: 'Size feedback saved. This will improve future recommendations.',
    });
  } catch (error) {
    console.error('Size feedback error:', error);
    res.status(500).json({ error: 'Failed to save size feedback' });
  }
});

// POST /tailor/complementary - Get complementary item suggestions
router.post('/complementary', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { clothingImage, clothingType } = req.body;

    if (!clothingImage || !clothingType) {
      return res.status(400).json({ error: 'Clothing image and type are required' });
    }

    // Get user's profile if available
    let profile: ProfileAnalysis | undefined;
    let gender: 'male' | 'female' = 'female';

    try {
      const profileResult = await query<{ profile_data: ProfileAnalysis; gender: string }>(
        'SELECT profile_data, gender FROM user_profiles WHERE user_id = $1',
        [req.userId]
      );
      if (profileResult.rows.length > 0) {
        profile = profileResult.rows[0].profile_data;
        gender = profileResult.rows[0].gender === 'male' ? 'male' : 'female';
      }
    } catch {
      // Profile not available
    }

    const suggestions = await getComplementarySuggestions(
      clothingImage,
      clothingType,
      profile,
      gender
    );

    res.json({
      success: true,
      ...suggestions,
    });
  } catch (error) {
    console.error('Complementary suggestions error:', error);
    res.status(500).json({ error: 'Failed to get complementary suggestions' });
  }
});

// GET /tailor/trending - Get trending outfits
router.get('/trending', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { occasion, season } = req.query;

    // Get user's profile if available
    let profile: ProfileAnalysis | undefined;
    let gender: 'male' | 'female' = 'female';

    try {
      const profileResult = await query<{ profile_data: ProfileAnalysis; gender: string }>(
        'SELECT profile_data, gender FROM user_profiles WHERE user_id = $1',
        [req.userId]
      );
      if (profileResult.rows.length > 0) {
        profile = profileResult.rows[0].profile_data;
        gender = profileResult.rows[0].gender === 'male' ? 'male' : 'female';
      }
    } catch {
      // Profile not available
    }

    const trending = await getTrendingOutfits(
      gender,
      occasion as string | undefined,
      season as string | undefined,
      profile
    );

    res.json({
      success: true,
      ...trending,
    });
  } catch (error) {
    console.error('Trending outfits error:', error);
    res.status(500).json({ error: 'Failed to get trending outfits' });
  }
});

// POST /tailor/update-measurements - Update user measurements
router.post('/update-measurements', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { height, weight } = req.body;

    await query(
      `UPDATE user_profiles SET height_cm = $2, weight_kg = $3, updated_at = NOW()
       WHERE user_id = $1`,
      [req.userId, height || null, weight || null]
    );

    res.json({
      success: true,
      message: 'Measurements updated',
    });
  } catch (error) {
    console.error('Update measurements error:', error);
    res.status(500).json({ error: 'Failed to update measurements' });
  }
});

export default router;
