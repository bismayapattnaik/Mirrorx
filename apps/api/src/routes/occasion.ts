import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { query } from '../db/index.js';
import { GoogleGenAI } from '@google/genai';
import type { Occasion, OccasionLook, OccasionLookItem } from '@mrrx/shared';

const router = Router();

const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
const TEXT_MODEL = 'gemini-2.0-flash';

// Ensure tables exist
async function ensureTablesExist() {
  await query(`
    CREATE TABLE IF NOT EXISTS stylist_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      occasion VARCHAR(50) NOT NULL,
      budget_min INTEGER DEFAULT 0,
      budget_max INTEGER DEFAULT 50000,
      style_slider_value INTEGER DEFAULT 50,
      color_preferences TEXT[] DEFAULT '{}',
      use_style_dna BOOLEAN DEFAULT true,
      gender VARCHAR(20) DEFAULT 'female',
      status VARCHAR(20) DEFAULT 'PENDING',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      completed_at TIMESTAMP WITH TIME ZONE
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS stylist_results (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      stylist_request_id UUID NOT NULL REFERENCES stylist_requests(id) ON DELETE CASCADE,
      look_rank INTEGER NOT NULL,
      look_name VARCHAR(100),
      look_description TEXT,
      look_payload JSONB NOT NULL,
      total_price INTEGER,
      user_rating INTEGER,
      is_saved BOOLEAN DEFAULT false,
      tryon_job_id UUID REFERENCES tryon_jobs(id),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);

  // Create indexes
  await query(`CREATE INDEX IF NOT EXISTS idx_stylist_requests_user ON stylist_requests(user_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_stylist_results_request ON stylist_results(stylist_request_id)`);
}

// Initialize tables on first request
let tablesInitialized = false;
async function initTables() {
  if (!tablesInitialized) {
    await ensureTablesExist();
    tablesInitialized = true;
  }
}

// Indian e-commerce stores for buy links
const INDIAN_STORES = [
  { name: 'Myntra', baseUrl: 'https://www.myntra.com/search?q=' },
  { name: 'Ajio', baseUrl: 'https://www.ajio.com/search/?text=' },
  { name: 'Amazon', baseUrl: 'https://www.amazon.in/s?k=' },
  { name: 'Flipkart', baseUrl: 'https://www.flipkart.com/search?q=' },
  { name: 'Meesho', baseUrl: 'https://www.meesho.com/search?q=' },
];

/**
 * Generate occasion-based outfit suggestions using AI
 */
async function generateOccasionLooks(
  occasion: Occasion,
  budgetMin: number,
  budgetMax: number,
  styleSlider: number, // 0-100 (Modest to Bold)
  colorPreferences: string[],
  gender: 'male' | 'female',
  styleDNA?: Record<string, unknown>
): Promise<OccasionLook[]> {
  const styleLevel = styleSlider < 33 ? 'modest and conservative' :
                     styleSlider < 66 ? 'balanced and versatile' : 'bold and fashion-forward';

  const genderWord = gender === 'female' ? 'woman' : 'man';
  const occasionNames: Record<Occasion, string> = {
    office: 'Office/Work',
    interview: 'Job Interview',
    date_night: 'Date Night',
    wedding_day: 'Wedding Guest (Daytime)',
    wedding_night: 'Wedding Guest (Evening)',
    festive: 'Festive/Diwali/Puja',
    vacation: 'Vacation/Travel',
    casual: 'Casual Outing',
    college: 'College/Campus',
    party: 'Party/Club Night',
    formal: 'Formal Event',
    ethnic: 'Traditional/Ethnic Wear',
  };

  const styleDNAContext = styleDNA ? `
USER'S STYLE DNA:
- Body Type: ${styleDNA.bodyType || 'Not specified'}
- Skin Tone: ${styleDNA.skinTone || 'Not specified'}
- Color Season: ${styleDNA.colorSeason || 'Not specified'}
- Best Colors: ${(styleDNA.bestColors as string[])?.join(', ') || 'Not specified'}
- Style Personality: ${(styleDNA.stylePersonality as string[])?.join(', ') || 'Not specified'}
` : '';

  const colorContext = colorPreferences.length > 0
    ? `Preferred colors: ${colorPreferences.join(', ')}`
    : 'No specific color preference';

  const prompt = `You are an expert Indian fashion stylist. Create 4-5 complete outfit looks for a ${genderWord} for the occasion: ${occasionNames[occasion] || occasion}.

REQUIREMENTS:
- Budget range: ₹${budgetMin.toLocaleString()} - ₹${budgetMax.toLocaleString()}
- Style preference: ${styleLevel}
- ${colorContext}
${styleDNAContext}

For each look, provide:
1. A catchy look name (e.g., "Power Player", "Ethnic Elegance")
2. Description (2-3 sentences)
3. Complete items list with:
   - type (top/bottom/footwear/accessory/outerwear)
   - specific item name
   - brand suggestion (Indian brands preferred: FabIndia, Manyavar, W, AND, Allen Solly, Van Heusen, Peter England, Global Desi, Biba, etc.)
   - price estimate in INR
   - search query for e-commerce
4. Why this outfit works for the occasion
5. Total estimated price

Focus on items available on Indian e-commerce (Myntra, Ajio, Amazon India, Flipkart).

Return ONLY valid JSON array:
[{
  "name": "Look Name",
  "description": "2-3 sentence description",
  "items": [
    {"type": "top", "title": "Specific Item Name", "brand": "Brand", "price": 1999, "search_query": "search term"}
  ],
  "total_price": 5999,
  "rationale": "Why this works for the occasion",
  "palette_match": 85
}]`;

  try {
    const response = await client.models.generateContent({
      model: TEXT_MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const jsonMatch = text.match(/\[[\s\S]*\]/);

    if (jsonMatch) {
      const looks = JSON.parse(jsonMatch[0]);

      // Add buy links to each item
      return looks.map((look: any, index: number) => ({
        id: `look_${Date.now()}_${index}`,
        rank: index + 1,
        name: look.name,
        description: look.description,
        items: (look.items || []).map((item: any): OccasionLookItem => ({
          type: item.type,
          title: item.title,
          brand: item.brand,
          price: item.price,
          image_url: null,
          search_query: item.search_query || item.title,
          buy_links: INDIAN_STORES.map(store => ({
            store: store.name,
            url: `${store.baseUrl}${encodeURIComponent(item.search_query || item.title)}`,
          })),
        })),
        total_price: look.total_price,
        rationale: look.rationale,
        palette_match: look.palette_match || 80,
        tryon_job_id: null,
        is_saved: false,
      }));
    }
  } catch (error) {
    console.error('Occasion looks generation error:', error);
  }

  // Return fallback looks
  return [{
    id: `look_${Date.now()}_0`,
    rank: 1,
    name: 'Classic Choice',
    description: `A versatile outfit perfect for ${occasionNames[occasion] || occasion}.`,
    items: [
      {
        type: 'top',
        title: gender === 'female' ? 'Elegant Blouse' : 'Smart Casual Shirt',
        brand: gender === 'female' ? 'W' : 'Van Heusen',
        price: 1999,
        image_url: null,
        search_query: gender === 'female' ? 'elegant blouse women' : 'smart casual shirt men',
        buy_links: INDIAN_STORES.map(store => ({
          store: store.name,
          url: `${store.baseUrl}${encodeURIComponent(gender === 'female' ? 'elegant blouse women' : 'smart casual shirt men')}`,
        })),
      },
      {
        type: 'bottom',
        title: gender === 'female' ? 'Tailored Trousers' : 'Slim Fit Chinos',
        brand: gender === 'female' ? 'AND' : 'Allen Solly',
        price: 1799,
        image_url: null,
        search_query: gender === 'female' ? 'tailored trousers women' : 'slim fit chinos men',
        buy_links: INDIAN_STORES.map(store => ({
          store: store.name,
          url: `${store.baseUrl}${encodeURIComponent(gender === 'female' ? 'tailored trousers women' : 'slim fit chinos men')}`,
        })),
      },
    ],
    total_price: 3798,
    rationale: 'A timeless combination that works for most occasions.',
    palette_match: 75,
    tryon_job_id: null,
    is_saved: false,
  }];
}

/**
 * POST /occasion-stylist - Generate occasion-based looks
 */
router.post('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await initTables();
    const userId = req.userId;
    const {
      occasion,
      budget_min = 0,
      budget_max = 50000,
      style_slider = 50,
      color_preferences = [],
      use_style_dna = true,
      gender = 'female',
    } = req.body;

    if (!occasion) {
      res.status(400).json({ error: 'Occasion is required' });
      return;
    }

    // Get user's Style DNA if requested
    let styleDNA: Record<string, unknown> | undefined;
    if (use_style_dna) {
      const profileResult = await query(
        `SELECT style_dna FROM user_style_profiles WHERE user_id = $1`,
        [userId]
      );
      if (profileResult.rows.length > 0 && profileResult.rows[0].style_dna) {
        styleDNA = profileResult.rows[0].style_dna;
      }
    }

    // Create request record
    const requestResult = await query(
      `INSERT INTO stylist_requests (
        user_id, occasion, budget_min, budget_max, style_slider_value,
        color_preferences, use_style_dna, gender, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PROCESSING')
      RETURNING id`,
      [userId, occasion, budget_min, budget_max, style_slider, color_preferences, use_style_dna, gender]
    );

    const requestId = requestResult.rows[0].id;

    // Generate looks
    const looks = await generateOccasionLooks(
      occasion as Occasion,
      budget_min,
      budget_max,
      style_slider,
      color_preferences,
      gender,
      styleDNA
    );

    // Save results
    for (const look of looks) {
      await query(
        `INSERT INTO stylist_results (
          stylist_request_id, look_rank, look_name, look_description, look_payload, total_price
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [requestId, look.rank, look.name, look.description, JSON.stringify(look), look.total_price]
      );
    }

    // Update request status
    await query(
      `UPDATE stylist_requests SET status = 'COMPLETED', completed_at = NOW() WHERE id = $1`,
      [requestId]
    );

    res.json({
      request_id: requestId,
      occasion,
      looks,
      generated_at: new Date(),
    });
  } catch (error) {
    console.error('Occasion stylist error:', error);
    res.status(500).json({ error: 'Failed to generate looks' });
  }
});

/**
 * GET /occasion-stylist/:requestId - Get a specific stylist request with results
 */
router.get('/:requestId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const { requestId } = req.params;

    const requestResult = await query(
      `SELECT * FROM stylist_requests WHERE id = $1 AND user_id = $2`,
      [requestId, userId]
    );

    if (requestResult.rows.length === 0) {
      res.status(404).json({ error: 'Request not found' });
      return;
    }

    const resultsResult = await query(
      `SELECT * FROM stylist_results WHERE stylist_request_id = $1 ORDER BY look_rank`,
      [requestId]
    );

    const looks = resultsResult.rows.map(row => ({
      ...JSON.parse(row.look_payload),
      id: row.id,
      user_rating: row.user_rating,
      is_saved: row.is_saved,
      tryon_job_id: row.tryon_job_id,
    }));

    res.json({
      ...requestResult.rows[0],
      looks,
    });
  } catch (error) {
    console.error('Get stylist request error:', error);
    res.status(500).json({ error: 'Failed to get request' });
  }
});

/**
 * GET /occasion-stylist - List user's stylist requests
 */
router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await initTables();
    const userId = req.userId;
    const { page = '1', limit = '10' } = req.query;

    const pageNum = Math.max(1, parseInt(page as string));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string)));
    const offset = (pageNum - 1) * limitNum;

    const countResult = await query(
      `SELECT COUNT(*) FROM stylist_requests WHERE user_id = $1`,
      [userId]
    );

    const requestsResult = await query(
      `SELECT sr.*,
        (SELECT COUNT(*) FROM stylist_results WHERE stylist_request_id = sr.id) as looks_count
       FROM stylist_requests sr
       WHERE sr.user_id = $1
       ORDER BY sr.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limitNum, offset]
    );

    res.json({
      requests: requestsResult.rows,
      total: parseInt(countResult.rows[0].count),
      page: pageNum,
      limit: limitNum,
    });
  } catch (error) {
    console.error('List stylist requests error:', error);
    res.status(500).json({ error: 'Failed to list requests' });
  }
});

/**
 * POST /occasion-stylist/:requestId/feedback - Rate a look
 */
router.post('/:requestId/feedback', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const { requestId } = req.params;
    const { look_id, rating, save_to_wardrobe } = req.body;

    // Verify ownership
    const verifyResult = await query(
      `SELECT sr.id FROM stylist_results sr
       JOIN stylist_requests sreq ON sr.stylist_request_id = sreq.id
       WHERE sr.id = $1 AND sreq.id = $2 AND sreq.user_id = $3`,
      [look_id, requestId, userId]
    );

    if (verifyResult.rows.length === 0) {
      res.status(404).json({ error: 'Look not found' });
      return;
    }

    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (rating !== undefined) {
      updates.push(`user_rating = $${paramIndex++}`);
      values.push(rating);
    }
    if (save_to_wardrobe !== undefined) {
      updates.push(`is_saved = $${paramIndex++}`);
      values.push(save_to_wardrobe);
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No feedback provided' });
      return;
    }

    values.push(look_id);
    await query(
      `UPDATE stylist_results SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
      values
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Feedback error:', error);
    res.status(500).json({ error: 'Failed to save feedback' });
  }
});

/**
 * GET /occasions - List available occasions
 */
router.get('/meta/occasions', async (_req, res: Response): Promise<void> => {
  res.json({
    occasions: [
      { id: 'office', name: 'Office/Work', icon: '💼' },
      { id: 'interview', name: 'Job Interview', icon: '🤝' },
      { id: 'date_night', name: 'Date Night', icon: '💕' },
      { id: 'wedding_day', name: 'Wedding Guest (Day)', icon: '👰' },
      { id: 'wedding_night', name: 'Wedding Guest (Evening)', icon: '🌙' },
      { id: 'festive', name: 'Festive/Diwali', icon: '🪔' },
      { id: 'vacation', name: 'Vacation/Travel', icon: '✈️' },
      { id: 'casual', name: 'Casual Outing', icon: '☕' },
      { id: 'college', name: 'College/Campus', icon: '📚' },
      { id: 'party', name: 'Party Night', icon: '🎉' },
      { id: 'formal', name: 'Formal Event', icon: '🎩' },
      { id: 'ethnic', name: 'Traditional Wear', icon: '🪷' },
    ],
  });
});

export default router;
