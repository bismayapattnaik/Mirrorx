import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { query } from '../db/index.js';
import { TIER_ENTITLEMENTS, Platform } from '@mrrx/shared';
import * as cheerio from 'cheerio';

const router = Router();

// Ensure tables exist
async function ensureTablesExist() {
  await query(`
    CREATE TABLE IF NOT EXISTS wishlist_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      platform VARCHAR(50) NOT NULL,
      product_url TEXT NOT NULL,
      title TEXT,
      brand VARCHAR(100),
      image_url TEXT,
      current_price NUMERIC(10,2),
      original_price NUMERIC(10,2),
      lowest_price NUMERIC(10,2),
      target_price NUMERIC(10,2),
      occasion_tags TEXT[] DEFAULT '{}',
      is_on_sale BOOLEAN DEFAULT false,
      has_tried_on BOOLEAN DEFAULT false,
      last_price_check TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS wishlist_price_checks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      wishlist_item_id UUID NOT NULL REFERENCES wishlist_items(id) ON DELETE CASCADE,
      price NUMERIC(10,2),
      was_available BOOLEAN DEFAULT true,
      checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      status VARCHAR(50) DEFAULT 'OK'
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS notification_preferences (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      price_drop_alerts BOOLEAN DEFAULT true,
      weekly_digest BOOLEAN DEFAULT true,
      style_tips BOOLEAN DEFAULT true,
      new_features BOOLEAN DEFAULT true,
      email_notifications BOOLEAN DEFAULT true,
      push_notifications BOOLEAN DEFAULT false,
      digest_day VARCHAR(20) DEFAULT 'monday',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);

  // Create indexes
  await query(`CREATE INDEX IF NOT EXISTS idx_wishlist_user ON wishlist_items(user_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_wishlist_platform ON wishlist_items(user_id, platform)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_wishlist_sale ON wishlist_items(user_id, is_on_sale)`);
}

// Initialize tables on first request
let tablesInitialized = false;
async function initTables() {
  if (!tablesInitialized) {
    await ensureTablesExist();
    tablesInitialized = true;
  }
}

// Platform detection patterns
const PLATFORM_PATTERNS: Record<Platform, RegExp> = {
  myntra: /myntra\.com/i,
  ajio: /ajio\.com/i,
  amazon: /amazon\.in/i,
  flipkart: /flipkart\.com/i,
  meesho: /meesho\.com/i,
  nykaa: /nykaa(fashion)?\.com/i,
  tatacliq: /tatacliq\.com/i,
  other: /.*/,
};

/**
 * Detect platform from URL
 */
function detectPlatform(url: string): Platform {
  for (const [platform, pattern] of Object.entries(PLATFORM_PATTERNS)) {
    if (platform !== 'other' && pattern.test(url)) {
      return platform as Platform;
    }
  }
  return 'other';
}

/**
 * Extract product details from URL
 */
async function extractProductDetails(url: string, platform: Platform): Promise<{
  title: string | null;
  brand: string | null;
  image_url: string | null;
  current_price: number | null;
  original_price: number | null;
}> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });

    if (!response.ok) {
      return { title: null, brand: null, image_url: null, current_price: null, original_price: null };
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    let title: string | null = null;
    let brand: string | null = null;
    let image_url: string | null = null;
    let current_price: number | null = null;
    let original_price: number | null = null;

    // Platform-specific extraction
    switch (platform) {
      case 'myntra':
        title = $('h1.pdp-title').text().trim() || $('h1').first().text().trim();
        brand = $('h1.pdp-name').text().trim() || $('.pdp-brand-name').text().trim();
        image_url = $('img.image-grid-image').first().attr('src') || $('meta[property="og:image"]').attr('content');
        current_price = parsePrice($('.pdp-price strong').text() || $('.pdp-discount-container .pdp-price').text());
        original_price = parsePrice($('.pdp-mrp s').text());
        break;

      case 'ajio':
        title = $('h1.prod-name').text().trim() || $('h1').first().text().trim();
        brand = $('h2.brand-name').text().trim();
        image_url = $('img.rilrtl-lazy-img').first().attr('src') || $('meta[property="og:image"]').attr('content');
        current_price = parsePrice($('.prod-sp').text());
        original_price = parsePrice($('.prod-cp').text());
        break;

      case 'amazon':
        title = $('#productTitle').text().trim() || $('h1').first().text().trim();
        brand = $('#bylineInfo').text().trim().replace(/^(Visit the |Brand: )/, '');
        image_url = $('#landingImage').attr('src') || $('meta[property="og:image"]').attr('content');
        current_price = parsePrice($('.a-price-whole').first().text());
        original_price = parsePrice($('.a-text-strike').first().text());
        break;

      case 'flipkart':
        title = $('h1._6EBuvT span').text().trim() || $('h1').first().text().trim();
        brand = $('._6EBuvT span').first().text().trim();
        image_url = $('img._396cs4').first().attr('src') || $('meta[property="og:image"]').attr('content');
        current_price = parsePrice($('div._30jeq3').first().text());
        original_price = parsePrice($('div._3I9_wc').first().text());
        break;

      case 'meesho':
        title = $('h1').first().text().trim();
        brand = $('.sc-eDvSVe').first().text().trim();
        image_url = $('img').first().attr('src') || $('meta[property="og:image"]').attr('content');
        current_price = parsePrice($('.sc-eDvSVe').text());
        break;

      default:
        title = $('h1').first().text().trim() || $('meta[property="og:title"]').attr('content');
        brand = $('meta[property="og:site_name"]').attr('content');
        image_url = $('meta[property="og:image"]').attr('content');
        current_price = parsePrice($('[class*="price"]').first().text());
    }

    return { title, brand, image_url, current_price, original_price };
  } catch (error) {
    console.error('Product extraction error:', error);
    return { title: null, brand: null, image_url: null, current_price: null, original_price: null };
  }
}

/**
 * Parse price string to number
 */
function parsePrice(priceStr: string | undefined): number | null {
  if (!priceStr) return null;
  const cleaned = priceStr.replace(/[^\d.]/g, '');
  const price = parseFloat(cleaned);
  return isNaN(price) ? null : price;
}

/**
 * POST /wishlist - Add item to wishlist
 */
router.post('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await initTables();
    const userId = req.userId;
    const user = req.user;
    const { product_url, occasion_tags } = req.body;

    if (!product_url) {
      res.status(400).json({ error: 'product_url is required' });
      return;
    }

    // Check entitlements
    const entitlements = TIER_ENTITLEMENTS[user.subscription_tier];
    if (entitlements.max_wishlist_items !== 'unlimited') {
      const countResult = await query(
        `SELECT COUNT(*) FROM wishlist_items WHERE user_id = $1`,
        [userId]
      );
      if (parseInt(countResult.rows[0].count) >= entitlements.max_wishlist_items) {
        res.status(403).json({
          error: 'Wishlist limit reached',
          message: `Your plan allows up to ${entitlements.max_wishlist_items} wishlist items. Upgrade to PRO for unlimited.`,
        });
        return;
      }
    }

    // Detect platform and extract details
    const platform = detectPlatform(product_url);
    const details = await extractProductDetails(product_url, platform);

    // Check for existing item
    const existingResult = await query(
      `SELECT id FROM wishlist_items WHERE user_id = $1 AND product_url = $2`,
      [userId, product_url]
    );

    if (existingResult.rows.length > 0) {
      res.status(400).json({ error: 'Item already in wishlist' });
      return;
    }

    // Calculate if on sale
    const is_on_sale = details.original_price && details.current_price
      ? details.current_price < details.original_price
      : false;

    // Insert item
    const result = await query(
      `INSERT INTO wishlist_items (
        user_id, platform, product_url, title, brand, image_url,
        current_price, original_price, occasion_tags, is_on_sale, last_price_check
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      RETURNING *`,
      [
        userId, platform, product_url, details.title, details.brand, details.image_url,
        details.current_price, details.original_price, occasion_tags || [], is_on_sale
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Add wishlist error:', error);
    res.status(500).json({ error: 'Failed to add to wishlist' });
  }
});

/**
 * GET /wishlist - List wishlist items
 */
router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await initTables();
    const userId = req.userId;
    const {
      page = '1',
      limit = '20',
      platform,
      on_sale,
      sort = 'created_at',
      order = 'desc'
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string)));
    const offset = (pageNum - 1) * limitNum;

    let whereClause = 'WHERE user_id = $1';
    const params: unknown[] = [userId];
    let paramIndex = 2;

    if (platform) {
      whereClause += ` AND platform = $${paramIndex++}`;
      params.push(platform);
    }

    if (on_sale === 'true') {
      whereClause += ` AND is_on_sale = true`;
    }

    const validSorts = ['created_at', 'current_price', 'title'];
    const sortField = validSorts.includes(sort as string) ? sort : 'created_at';
    const sortOrder = order === 'asc' ? 'ASC' : 'DESC';

    const countResult = await query(
      `SELECT COUNT(*) FROM wishlist_items ${whereClause}`,
      params
    );

    params.push(limitNum, offset);
    const itemsResult = await query(
      `SELECT * FROM wishlist_items ${whereClause}
       ORDER BY ${sortField} ${sortOrder}
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      params
    );

    res.json({
      items: itemsResult.rows,
      total: parseInt(countResult.rows[0].count),
      page: pageNum,
      limit: limitNum,
    });
  } catch (error) {
    console.error('List wishlist error:', error);
    res.status(500).json({ error: 'Failed to list wishlist' });
  }
});

/**
 * GET /wishlist/:id - Get wishlist item details
 */
router.get('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    const result = await query(
      `SELECT * FROM wishlist_items WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Item not found' });
      return;
    }

    // Get price history
    const historyResult = await query(
      `SELECT price, checked_at, was_available
       FROM wishlist_price_checks
       WHERE wishlist_item_id = $1
       ORDER BY checked_at DESC
       LIMIT 30`,
      [id]
    );

    res.json({
      ...result.rows[0],
      price_history: historyResult.rows,
    });
  } catch (error) {
    console.error('Get wishlist item error:', error);
    res.status(500).json({ error: 'Failed to get item' });
  }
});

/**
 * POST /wishlist/:id/check - Manually check price
 */
router.post('/:id/check', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    const itemResult = await query(
      `SELECT * FROM wishlist_items WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (itemResult.rows.length === 0) {
      res.status(404).json({ error: 'Item not found' });
      return;
    }

    const item = itemResult.rows[0];
    const oldPrice = item.current_price;

    // Re-extract details
    const details = await extractProductDetails(item.product_url, item.platform);

    // Record price check
    await query(
      `INSERT INTO wishlist_price_checks (wishlist_item_id, price, was_available, status)
       VALUES ($1, $2, $3, 'OK')`,
      [id, details.current_price, details.current_price !== null]
    );

    // Update item
    const is_on_sale = details.original_price && details.current_price
      ? details.current_price < details.original_price
      : item.is_on_sale;

    await query(
      `UPDATE wishlist_items SET
        current_price = COALESCE($1, current_price),
        original_price = COALESCE($2, original_price),
        title = COALESCE($3, title),
        image_url = COALESCE($4, image_url),
        is_on_sale = $5,
        last_price_check = NOW()
       WHERE id = $6`,
      [details.current_price, details.original_price, details.title, details.image_url, is_on_sale, id]
    );

    // Check for price drop
    const priceDropped = oldPrice && details.current_price && details.current_price < oldPrice;

    res.json({
      success: true,
      price_dropped: priceDropped,
      old_price: oldPrice,
      new_price: details.current_price,
      discount_percentage: priceDropped
        ? Math.round(((oldPrice - details.current_price!) / oldPrice) * 100)
        : 0,
    });
  } catch (error) {
    console.error('Price check error:', error);
    res.status(500).json({ error: 'Failed to check price' });
  }
});

/**
 * PATCH /wishlist/:id - Update wishlist item
 */
router.patch('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const { id } = req.params;
    const { occasion_tags } = req.body;

    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (occasion_tags !== undefined) {
      updates.push(`occasion_tags = $${paramIndex++}`);
      values.push(occasion_tags);
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No updates provided' });
      return;
    }

    values.push(id, userId);
    const result = await query(
      `UPDATE wishlist_items SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND user_id = $${paramIndex}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Item not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update wishlist error:', error);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

/**
 * DELETE /wishlist/:id - Remove from wishlist
 */
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    const result = await query(
      `DELETE FROM wishlist_items WHERE id = $1 AND user_id = $2 RETURNING id`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Item not found' });
      return;
    }

    res.json({ success: true, deleted_id: id });
  } catch (error) {
    console.error('Delete wishlist error:', error);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

/**
 * GET /wishlist/alerts/settings - Get notification preferences
 */
router.get('/alerts/settings', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;

    const result = await query(
      `SELECT * FROM notification_preferences WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      // Return defaults
      res.json({
        price_drop_alerts: true,
        weekly_digest: true,
        style_tips: true,
        new_features: true,
        email_notifications: true,
        push_notifications: false,
        digest_day: 'monday',
      });
      return;
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get alert settings error:', error);
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

/**
 * POST /wishlist/alerts/settings - Update notification preferences
 */
router.post('/alerts/settings', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const {
      price_drop_alerts,
      weekly_digest,
      style_tips,
      new_features,
      email_notifications,
      push_notifications,
      digest_day,
    } = req.body;

    const result = await query(
      `INSERT INTO notification_preferences (
        user_id, price_drop_alerts, weekly_digest, style_tips, new_features,
        email_notifications, push_notifications, digest_day
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (user_id) DO UPDATE SET
        price_drop_alerts = COALESCE(EXCLUDED.price_drop_alerts, notification_preferences.price_drop_alerts),
        weekly_digest = COALESCE(EXCLUDED.weekly_digest, notification_preferences.weekly_digest),
        style_tips = COALESCE(EXCLUDED.style_tips, notification_preferences.style_tips),
        new_features = COALESCE(EXCLUDED.new_features, notification_preferences.new_features),
        email_notifications = COALESCE(EXCLUDED.email_notifications, notification_preferences.email_notifications),
        push_notifications = COALESCE(EXCLUDED.push_notifications, notification_preferences.push_notifications),
        digest_day = COALESCE(EXCLUDED.digest_day, notification_preferences.digest_day)
      RETURNING *`,
      [userId, price_drop_alerts, weekly_digest, style_tips, new_features, email_notifications, push_notifications, digest_day]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update alert settings error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

export default router;
