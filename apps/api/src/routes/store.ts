import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';
import { query, withTransaction } from '../db/index.js';
import { authenticate } from '../middleware/auth.js';
import {
  Store,
  StoreZone,
  StoreProduct,
  StoreSession,
  StoreCart,
  StoreCartItem,
  StoreOrder,
  StoreOrderItem,
  PickupPass,
  StoreStaff,
  StorePlanogram,
  StoreQRCode,
  StoreCoupon,
  StoreAnalyticsEvent,
  StoreDailyMetrics,
} from '@mrrx/shared';

const router = Router();

// ==========================================
// MIDDLEWARE
// ==========================================

// Store Session Authentication
async function authenticateStoreSession(req: Request, res: Response, next: NextFunction) {
  const sessionToken = (req.headers['x-store-session'] as string) || req.body.session_token;

  if (!sessionToken) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Store session token required',
    });
  }

  const result = await query<StoreSession>(
    `SELECT * FROM store_sessions
     WHERE session_token = $1 AND status = 'ACTIVE' AND expires_at > NOW()`,
    [sessionToken]
  );

  if (result.rows.length === 0) {
    return res.status(401).json({
      error: 'Session expired',
      message: 'Your store session has expired. Please scan the QR code again.',
    });
  }

  const session = result.rows[0];

  // Update last active timestamp
  await query(
    'UPDATE store_sessions SET last_active_at = NOW() WHERE id = $1',
    [session.id]
  );

  (req as any).storeSession = session;
  next();
}

// Merchant Store Access
async function authenticateMerchantStore(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Merchant API key required',
    });
  }

  const keyPrefix = apiKey.substring(0, 8);

  const result = await query<{
    id: string;
    merchant_id: string;
    key_hash: string;
  }>(
    `SELECT mak.id, mak.merchant_id, mak.key_hash
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

  (req as any).merchantId = keyRecord.merchant_id;
  next();
}

// Staff Authentication
async function authenticateStaff(req: Request, res: Response, next: NextFunction) {
  const staffToken = req.headers['x-staff-token'] as string;

  if (!staffToken) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Staff authentication required',
    });
  }

  // Decode staff token (simple JWT-like structure for demo)
  try {
    const decoded = JSON.parse(Buffer.from(staffToken, 'base64').toString());
    const staff = await query<StoreStaff>(
      'SELECT * FROM store_staff WHERE id = $1 AND is_active = true',
      [decoded.staffId]
    );

    if (staff.rows.length === 0) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid staff credentials',
      });
    }

    (req as any).staff = staff.rows[0];
    next();
  } catch {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid staff token',
    });
  }
}

// Track analytics event
async function trackEvent(
  storeId: string,
  eventType: string,
  eventData: Record<string, unknown> = {},
  sessionId?: string,
  userId?: string,
  zoneId?: string,
  productId?: string,
  deviceType?: string
) {
  try {
    await query(
      `INSERT INTO store_analytics_events
       (store_id, session_id, user_id, event_type, event_data, zone_id, product_id, device_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [storeId, sessionId, userId, eventType, JSON.stringify(eventData), zoneId, productId, deviceType]
    );
  } catch (error) {
    console.error('Failed to track event:', error);
  }
}

// ==========================================
// QR CODE SCAN & SESSION MANAGEMENT
// ==========================================

// POST /store/session - Create store session from QR scan
router.post('/session', async (req: Request, res: Response) => {
  try {
    const { qr_code_id, device_info } = req.body;

    if (!qr_code_id) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'QR code ID required',
      });
    }

    // Find QR code and get store/zone/product context
    const qrResult = await query<StoreQRCode>(
      `SELECT * FROM store_qr_codes WHERE qr_code_id = $1 AND is_active = true`,
      [qr_code_id as string]
    );

    if (qrResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Invalid or inactive QR code',
      });
    }

    const qrCode = qrResult.rows[0];

    // Update scan count
    await query(
      'UPDATE store_qr_codes SET scan_count = scan_count + 1, last_scanned_at = NOW() WHERE id = $1',
      [qrCode.id]
    );

    // Get store
    const storeResult = await query<Store>(
      `SELECT * FROM stores WHERE id = $1 AND status = 'ACTIVE'`,
      [qrCode.store_id]
    );

    if (storeResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Store unavailable',
        message: 'This store is currently not available',
      });
    }

    const store = storeResult.rows[0];

    // Generate session token
    const sessionToken = crypto.randomBytes(32).toString('hex');

    // Create session
    const sessionId = uuidv4();
    await query(
      `INSERT INTO store_sessions
       (id, store_id, session_token, status, device_info, entry_qr_type, entry_qr_id, expires_at)
       VALUES ($1, $2, $3, 'ACTIVE', $4, $5, $6, NOW() + INTERVAL '4 hours')`,
      [sessionId, store.id, sessionToken, JSON.stringify(device_info || {}), qrCode.qr_type, qrCode.qr_code_id]
    );

    // Track QR scan event
    await trackEvent(store.id, 'qr_scan', { qr_type: qrCode.qr_type }, sessionId);
    await trackEvent(store.id, 'session_start', {}, sessionId);

    // Get initial context based on QR type
    let initialZone: StoreZone | undefined;
    let initialProduct: StoreProduct | undefined;

    if (qrCode.qr_type === 'zone') {
      const zoneResult = await query<StoreZone>(
        'SELECT * FROM store_zones WHERE id = $1',
        [qrCode.reference_id]
      );
      if (zoneResult.rows.length > 0) {
        initialZone = zoneResult.rows[0];
      }
    } else if (qrCode.qr_type === 'product') {
      const productResult = await query<StoreProduct>(
        'SELECT * FROM store_products WHERE id = $1',
        [qrCode.reference_id]
      );
      if (productResult.rows.length > 0) {
        initialProduct = productResult.rows[0];
        // Also get the zone
        if (productResult.rows[0].zone_id) {
          const zoneResult = await query<StoreZone>(
            'SELECT * FROM store_zones WHERE id = $1',
            [productResult.rows[0].zone_id]
          );
          if (zoneResult.rows.length > 0) {
            initialZone = zoneResult.rows[0];
          }
        }
      }
    }

    // Get all zones for navigation
    const zonesResult = await query<StoreZone>(
      'SELECT * FROM store_zones WHERE store_id = $1 AND is_active = true ORDER BY display_order',
      [store.id]
    );

    res.status(201).json({
      session_token: sessionToken,
      store,
      zones: zonesResult.rows,
      initial_zone: initialZone,
      initial_product: initialProduct,
      settings: store.settings,
    });
  } catch (error) {
    console.error('Create session error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to create session' });
  }
});

// POST /store/session/selfie - Upload selfie for try-on
router.post('/session/selfie', authenticateStoreSession, async (req: Request, res: Response) => {
  try {
    const session = (req as any).storeSession as StoreSession;
    const { selfie_image, consent_given } = req.body;

    if (!selfie_image) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Selfie image required',
      });
    }

    // Store selfie (temporarily for session duration)
    // and record consent reference
    await query(
      'UPDATE store_sessions SET selfie_image_url = $1, last_active_at = NOW() WHERE id = $2',
      [selfie_image, session.id]
    );

    // Track event with consent reference
    await trackEvent(session.store_id, 'selfie_upload', { consent_given: !!consent_given }, session.id);

    res.json({
      success: true,
      message: 'Selfie uploaded successfully',
    });
  } catch (error) {
    console.error('Upload selfie error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to upload selfie' });
  }
});

// DELETE /store/session - End session and delete ephemeral data (DPDP compliance)
router.delete('/session', authenticateStoreSession, async (req: Request, res: Response) => {
  try {
    const session = (req as any).storeSession as StoreSession;

    await withTransaction(async (client) => {
      // 1. Clear cart
      const cartResult = await client.query('SELECT id FROM store_carts WHERE session_id = $1', [session.id]);
      if (cartResult.rows.length > 0) {
        await client.query('DELETE FROM store_cart_items WHERE cart_id = $1', [cartResult.rows[0].id]);
        await client.query('DELETE FROM store_carts WHERE id = $1', [cartResult.rows[0].id]);
      }

      // 2. Mark session as ended and clear selfie
      await client.query(
        "UPDATE store_sessions SET status = 'EXPIRED', ended_at = NOW(), selfie_image_url = NULL WHERE id = $1",
        [session.id]
      );

      // 3. Track event
      await trackEvent(session.store_id, 'session_end', { reason: 'user_requested' }, session.id);
    });

    res.json({
      success: true,
      message: 'Session ended and personal data (selfie) removed.',
    });
  } catch (error) {
    console.error('End session error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to end session' });
  }
});

// GET /store/session - Get current session info
router.get('/session', authenticateStoreSession, async (req: Request, res: Response) => {
  try {
    const session = (req as any).storeSession as StoreSession;

    // Get store
    const storeResult = await query<Store>(
      'SELECT * FROM stores WHERE id = $1',
      [session.store_id]
    );

    // Get cart if exists
    const cartResult = await query<StoreCart>(
      'SELECT * FROM store_carts WHERE session_id = $1',
      [session.id]
    );

    let cart = null;
    if (cartResult.rows.length > 0) {
      const cartItemsResult = await query<StoreCartItem & { product: StoreProduct }>(
        `SELECT sci.*,
         json_build_object(
           'id', sp.id, 'name', sp.name, 'brand', sp.brand, 'price', sp.price,
           'image_url', sp.image_url, 'sizes', sp.sizes, 'colors', sp.colors
         ) as product
         FROM store_cart_items sci
         JOIN store_products sp ON sp.id = sci.product_id
         WHERE sci.cart_id = $1`,
        [cartResult.rows[0].id]
      );

      cart = {
        ...cartResult.rows[0],
        items: cartItemsResult.rows,
      };
    }

    res.json({
      session,
      store: storeResult.rows[0],
      cart,
      has_selfie: !!session.selfie_image_url,
    });
  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to get session' });
  }
});

// ==========================================
// STORE BROWSING
// ==========================================

// GET /store/:storeId/zones - Get store zones
router.get('/:storeId/zones', async (req: Request, res: Response) => {
  try {
    const { storeId } = req.params;

    const result = await query<StoreZone>(
      `SELECT * FROM store_zones
       WHERE store_id = $1 AND is_active = true
       ORDER BY display_order`,
      [storeId]
    );

    res.json({ zones: result.rows });
  } catch (error) {
    console.error('Get zones error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to get zones' });
  }
});

// GET /store/:storeId/products - Get store products
router.get('/:storeId/products', async (req: Request, res: Response) => {
  try {
    const { storeId } = req.params;
    const {
      zone_id,
      category,
      gender,
      brand,
      min_price,
      max_price,
      search,
      page = '1',
      limit = '20',
    } = req.query;

    let whereClause = 'WHERE sp.store_id = $1 AND sp.is_active = true';
    const params: any[] = [storeId];
    let paramIndex = 2;

    if (zone_id) {
      whereClause += ` AND sp.zone_id = $${paramIndex++}`;
      params.push(zone_id);
    }
    if (category) {
      whereClause += ` AND sp.category = $${paramIndex++}`;
      params.push(category);
    }
    if (gender) {
      whereClause += ` AND (sp.gender = $${paramIndex++} OR sp.gender = 'unisex')`;
      params.push(gender);
    }
    if (brand) {
      whereClause += ` AND sp.brand ILIKE $${paramIndex++}`;
      params.push(`%${brand}%`);
    }
    if (min_price) {
      whereClause += ` AND sp.price >= $${paramIndex++}`;
      params.push(parseInt(min_price as string) * 100); // Convert to paise
    }
    if (max_price) {
      whereClause += ` AND sp.price <= $${paramIndex++}`;
      params.push(parseInt(max_price as string) * 100);
    }
    if (search) {
      whereClause += ` AND (sp.name ILIKE $${paramIndex} OR sp.brand ILIKE $${paramIndex} OR sp.description ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Count total
    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) FROM store_products sp ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Get paginated products with planogram info
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    const productsResult = await query<StoreProduct & { location: StorePlanogram | null }>(
      `SELECT sp.*,
       json_build_object(
         'aisle', spl.aisle, 'row', spl.row, 'shelf', spl.shelf, 'rack', spl.rack
       ) as location
       FROM store_products sp
       LEFT JOIN store_planogram spl ON spl.product_id = sp.id
       ${whereClause}
       ORDER BY sp.created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...params, parseInt(limit as string), offset]
    );

    res.json({
      products: productsResult.rows,
      total,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to get products' });
  }
});

// GET /store/product/:productId - Get single product with location
router.get('/product/:productId', async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;

    const result = await query<StoreProduct & { location: StorePlanogram | null; zone: StoreZone | null }>(
      `SELECT sp.*,
       json_build_object(
         'id', spl.id, 'aisle', spl.aisle, 'row', spl.row, 'shelf', spl.shelf,
         'rack', spl.rack, 'position_notes', spl.position_notes
       ) as location,
       json_build_object(
         'id', sz.id, 'name', sz.name, 'floor', sz.floor, 'section', sz.section
       ) as zone
       FROM store_products sp
       LEFT JOIN store_planogram spl ON spl.product_id = sp.id
       LEFT JOIN store_zones sz ON sz.id = sp.zone_id
       WHERE sp.id = $1`,
      [productId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Product not found',
      });
    }

    // Track product view if session exists
    const sessionToken = req.headers['x-store-session'];
    if (sessionToken) {
      const sessionResult = await query<StoreSession>(
        'SELECT * FROM store_sessions WHERE session_token = $1',
        [sessionToken as string]
      );
      if (sessionResult.rows.length > 0) {
        await trackEvent(
          sessionResult.rows[0].store_id,
          'product_view',
          { product_id: productId },
          sessionResult.rows[0].id,
          undefined,
          (result.rows[0].zone_id as string) || undefined,
          productId as string
        );
      }
    }

    res.json({ product: result.rows[0] });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to get product' });
  }
});

// ==========================================
// STORE TRY-ON
// ==========================================

// POST /store/tryon - Create try-on job in store context
router.post('/tryon', authenticateStoreSession, async (req: Request, res: Response) => {
  try {
    const session = (req as any).storeSession as StoreSession;
    const { product_id, mode = 'PART' } = req.body;

    if (!product_id) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Product ID required',
      });
    }

    // Check if selfie is available
    if (!session.selfie_image_url) {
      return res.status(400).json({
        error: 'Selfie required',
        message: 'Please upload a selfie first to try on clothes',
      });
    }

    // Get product
    const productResult = await query<StoreProduct>(
      'SELECT * FROM store_products WHERE id = $1 AND is_try_on_enabled = true',
      [product_id]
    );

    if (productResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Product not available for try-on',
      });
    }

    const product = productResult.rows[0];

    // Track try-on start
    await trackEvent(session.store_id, 'tryon_start', { product_id, mode }, session.id, undefined, product.zone_id || undefined, product_id);

    // Cost Optimization: Check for existing successful try-on for this selfie + product combo
    const existingJob = await query<{
      tryon_job_id: string;
      result_image_url: string;
    }>(
      `SELECT stj.tryon_job_id, tj.result_image_url
       FROM store_tryon_jobs stj
       JOIN tryon_jobs tj ON tj.id = stj.tryon_job_id
       WHERE stj.store_id = $1 AND stj.product_id = $2
       AND tj.source_image_url = $3 AND tj.status = 'SUCCEEDED' AND tj.mode = $4
       ORDER BY stj.created_at DESC LIMIT 1`,
      [session.store_id, product_id, session.selfie_image_url as string, mode]
    );

    if (existingJob.rows.length > 0) {
      const cacheResult = existingJob.rows[0];
      await trackEvent(session.store_id, 'tryon_cache_hit', { product_id, job_id: cacheResult.tryon_job_id }, session.id);

      // Get location info
      const locationResult = await query<StorePlanogram>(
        'SELECT * FROM store_planogram WHERE product_id = $1',
        [product_id]
      );

      return res.json({
        job_id: cacheResult.tryon_job_id,
        status: 'SUCCEEDED',
        result_image_url: cacheResult.result_image_url,
        product,
        location: locationResult.rows[0] || null,
        cached: true
      });
    }

    // Create try-on job (using existing try-on infrastructure)
    const jobId = uuidv4();
    const guestUserId = uuidv4(); // Guest user for store session

    await query(
      `INSERT INTO tryon_jobs (id, user_id, mode, source_image_url, product_image_url, status, credits_used)
       VALUES ($1, $2, $3, $4, $5, 'QUEUED', 0)`,
      [jobId, guestUserId, mode, session.selfie_image_url, product.image_url]
    );

    // Link to store context
    await query(
      `INSERT INTO store_tryon_jobs (tryon_job_id, store_id, session_id, product_id, zone_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [jobId, session.store_id, session.id, product_id, product.zone_id]
    );

    // Process try-on (simplified - in production, this would be async/queue-based)
    // For now, we'll call the Gemini service directly
    try {
      const { processStoreTryOn } = await import('../services/gemini.js');
      const resultUrl = await processStoreTryOn(session.selfie_image_url, product.image_url, mode);

      await query(
        `UPDATE tryon_jobs SET status = 'SUCCEEDED', result_image_url = $1, completed_at = NOW() WHERE id = $2`,
        [resultUrl, jobId]
      );

      await trackEvent(session.store_id, 'tryon_complete', { product_id, job_id: jobId }, session.id);

      // Get location info
      const locationResult = await query<StorePlanogram>(
        'SELECT * FROM store_planogram WHERE product_id = $1',
        [product_id]
      );

      res.json({
        job_id: jobId,
        status: 'SUCCEEDED',
        result_image_url: resultUrl,
        product,
        location: locationResult.rows[0] || null,
      });
    } catch (tryOnError) {
      await query(
        `UPDATE tryon_jobs SET status = 'FAILED', error_message = $1 WHERE id = $2`,
        [(tryOnError as Error).message, jobId]
      );

      await trackEvent(session.store_id, 'tryon_fail', { product_id, error: (tryOnError as Error).message }, session.id);

      res.status(500).json({
        error: 'Try-on failed',
        message: 'Failed to generate try-on. Please try again.',
      });
    }
  } catch (error) {
    console.error('Store try-on error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to process try-on' });
  }
});

// GET /store/tryon/:jobId - Get try-on result
router.get('/tryon/:jobId', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;

    const result = await query<{
      id: string;
      status: string;
      result_image_url: string | null;
      error_message: string | null;
      product: StoreProduct;
      location: StorePlanogram | null;
    }>(
      `SELECT tj.id, tj.status, tj.result_image_url, tj.error_message,
       json_build_object(
         'id', sp.id, 'name', sp.name, 'brand', sp.brand, 'price', sp.price,
         'image_url', sp.image_url, 'sizes', sp.sizes, 'colors', sp.colors
       ) as product,
       json_build_object(
         'aisle', spl.aisle, 'row', spl.row, 'shelf', spl.shelf, 'rack', spl.rack
       ) as location
       FROM tryon_jobs tj
       JOIN store_tryon_jobs stj ON stj.tryon_job_id = tj.id
       JOIN store_products sp ON sp.id = stj.product_id
       LEFT JOIN store_planogram spl ON spl.product_id = sp.id
       WHERE tj.id = $1`,
      [jobId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Try-on job not found',
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get try-on error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to get try-on result' });
  }
});

// ==========================================
// CART MANAGEMENT
// ==========================================

// POST /store/cart/add - Add item to cart
router.post('/cart/add', authenticateStoreSession, async (req: Request, res: Response) => {
  try {
    const session = (req as any).storeSession as StoreSession;
    const { product_id, quantity = 1, size, color, tryon_job_id } = req.body;

    if (!product_id) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Product ID required',
      });
    }

    // Get product
    const productResult = await query<StoreProduct>(
      'SELECT * FROM store_products WHERE id = $1 AND is_active = true',
      [product_id]
    );

    if (productResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Product not found',
      });
    }

    const product = productResult.rows[0];

    // Check stock
    if (product.stock_quantity < quantity) {
      return res.status(400).json({
        error: 'Out of stock',
        message: 'Insufficient stock available',
      });
    }

    // Get or create cart
    let cartResult = await query<StoreCart>(
      'SELECT * FROM store_carts WHERE session_id = $1',
      [session.id]
    );

    let cartId: string;
    if (cartResult.rows.length === 0) {
      cartId = uuidv4();
      await query(
        `INSERT INTO store_carts (id, store_id, session_id, user_id)
         VALUES ($1, $2, $3, $4)`,
        [cartId, session.store_id, session.id, session.user_id]
      );
    } else {
      cartId = cartResult.rows[0].id;
    }

    // Check if item already in cart with same size/color
    const existingItem = await query<StoreCartItem>(
      `SELECT * FROM store_cart_items
       WHERE cart_id = $1 AND product_id = $2 AND
       COALESCE(size, '') = COALESCE($3, '') AND COALESCE(color, '') = COALESCE($4, '')`,
      [cartId, product_id, size, color]
    );

    if (existingItem.rows.length > 0) {
      // Update quantity
      await query(
        `UPDATE store_cart_items
         SET quantity = quantity + $1, total_price = (quantity + $1) * unit_price
         WHERE id = $2`,
        [quantity, existingItem.rows[0].id]
      );
    } else {
      // Add new item
      await query(
        `INSERT INTO store_cart_items
         (cart_id, product_id, tryon_job_id, quantity, size, color, unit_price, total_price)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [cartId, product_id, tryon_job_id, quantity, size, color, product.price, product.price * quantity]
      );
    }

    // Mark try-on as added to cart
    if (tryon_job_id) {
      await query(
        'UPDATE store_tryon_jobs SET added_to_cart = true WHERE tryon_job_id = $1',
        [tryon_job_id]
      );
    }

    // Track event
    await trackEvent(session.store_id, 'add_to_cart', { product_id, quantity, size, color }, session.id, undefined, undefined, product_id);

    // Get updated cart
    const updatedCart = await getCartWithItems(cartId);

    res.json({
      success: true,
      cart: updatedCart,
    });
  } catch (error) {
    console.error('Add to cart error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to add to cart' });
  }
});

// GET /store/cart - Get cart
router.get('/cart', authenticateStoreSession, async (req: Request, res: Response) => {
  try {
    const session = (req as any).storeSession as StoreSession;

    const cartResult = await query<StoreCart>(
      'SELECT * FROM store_carts WHERE session_id = $1',
      [session.id]
    );

    if (cartResult.rows.length === 0) {
      return res.json({
        cart: null,
        items: [],
      });
    }

    const cart = await getCartWithItems(cartResult.rows[0].id);
    res.json({ cart });
  } catch (error) {
    console.error('Get cart error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to get cart' });
  }
});

// PATCH /store/cart/item/:itemId - Update cart item
router.patch('/cart/item/:itemId', authenticateStoreSession, async (req: Request, res: Response) => {
  try {
    const session = (req as any).storeSession as StoreSession;
    const { itemId } = req.params;
    const { quantity, size, color } = req.body;

    // Verify item belongs to session's cart
    const itemResult = await query<StoreCartItem & { cart_session_id: string }>(
      `SELECT sci.*, sc.session_id as cart_session_id
       FROM store_cart_items sci
       JOIN store_carts sc ON sc.id = sci.cart_id
       WHERE sci.id = $1`,
      [itemId]
    );

    if (itemResult.rows.length === 0 || itemResult.rows[0].cart_session_id !== session.id) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Cart item not found',
      });
    }

    const item = itemResult.rows[0];

    if (quantity !== undefined) {
      if (quantity <= 0) {
        // Remove item
        await query('DELETE FROM store_cart_items WHERE id = $1', [itemId]);
      } else {
        await query(
          'UPDATE store_cart_items SET quantity = $1, total_price = $1 * unit_price WHERE id = $2',
          [quantity, itemId]
        );
      }
    }

    if (size !== undefined) {
      await query('UPDATE store_cart_items SET size = $1 WHERE id = $2', [size, itemId]);
    }

    if (color !== undefined) {
      await query('UPDATE store_cart_items SET color = $1 WHERE id = $2', [color, itemId]);
    }

    const cart = await getCartWithItems(item.cart_id);
    res.json({ cart });
  } catch (error) {
    console.error('Update cart item error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to update cart item' });
  }
});

// DELETE /store/cart/item/:itemId - Remove item from cart
router.delete('/cart/item/:itemId', authenticateStoreSession, async (req: Request, res: Response) => {
  try {
    const session = (req as any).storeSession as StoreSession;
    const { itemId } = req.params;

    // Verify and delete
    const result = await query<{ cart_id: string }>(
      `DELETE FROM store_cart_items sci
       USING store_carts sc
       WHERE sci.cart_id = sc.id AND sci.id = $1 AND sc.session_id = $2
       RETURNING sci.cart_id`,
      [itemId, session.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Cart item not found',
      });
    }

    // Track event
    await trackEvent(session.store_id, 'remove_from_cart', { item_id: itemId }, session.id);

    const cart = await getCartWithItems(result.rows[0].cart_id);
    res.json({ cart });
  } catch (error) {
    console.error('Remove cart item error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to remove item' });
  }
});

// POST /store/cart/coupon - Apply coupon
router.post('/cart/coupon', authenticateStoreSession, async (req: Request, res: Response) => {
  try {
    const session = (req as any).storeSession as StoreSession;
    const { coupon_code } = req.body;

    // Get cart
    const cartResult = await query<StoreCart>(
      'SELECT * FROM store_carts WHERE session_id = $1',
      [session.id]
    );

    if (cartResult.rows.length === 0) {
      return res.status(400).json({
        error: 'No cart',
        message: 'No items in cart',
      });
    }

    const cart = cartResult.rows[0];

    // Find coupon
    const couponResult = await query<StoreCoupon>(
      `SELECT * FROM store_coupons
       WHERE store_id = $1 AND code = $2 AND is_active = true
       AND valid_from <= NOW() AND (valid_until IS NULL OR valid_until >= NOW())
       AND (usage_limit IS NULL OR usage_count < usage_limit)`,
      [session.store_id, coupon_code.toUpperCase()]
    );

    if (couponResult.rows.length === 0) {
      return res.status(400).json({
        error: 'Invalid coupon',
        message: 'This coupon code is invalid or expired',
      });
    }

    const coupon = couponResult.rows[0];

    // Check minimum order
    if (cart.subtotal < coupon.min_order_amount) {
      return res.status(400).json({
        error: 'Minimum not met',
        message: `Minimum order of ₹${coupon.min_order_amount / 100} required`,
      });
    }

    // Calculate discount
    let discount = 0;
    if (coupon.discount_type === 'percentage') {
      discount = Math.round(cart.subtotal * (coupon.discount_value / 100));
      if (coupon.max_discount && discount > coupon.max_discount) {
        discount = coupon.max_discount;
      }
    } else {
      discount = coupon.discount_value;
    }

    // Update cart
    const tax = Math.round((cart.subtotal - discount) * 0.18);
    await query(
      `UPDATE store_carts SET coupon_code = $1, discount = $2, tax = $3, total = subtotal - $2 + $3 WHERE id = $4`,
      [coupon.code, discount, tax, cart.id]
    );

    const updatedCart = await getCartWithItems(cart.id);
    res.json({
      success: true,
      discount_applied: discount,
      cart: updatedCart,
    });
  } catch (error) {
    console.error('Apply coupon error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to apply coupon' });
  }
});

// Helper function to get cart with items
async function getCartWithItems(cartId: string): Promise<StoreCart> {
  const cartResult = await query<StoreCart>(
    'SELECT * FROM store_carts WHERE id = $1',
    [cartId]
  );

  if (cartResult.rows.length === 0) {
    throw new Error('Cart not found');
  }

  const itemsResult = await query<StoreCartItem & { product: StoreProduct }>(
    `SELECT sci.*,
     json_build_object(
       'id', sp.id, 'name', sp.name, 'brand', sp.brand, 'price', sp.price,
       'original_price', sp.original_price, 'image_url', sp.image_url,
       'sizes', sp.sizes, 'colors', sp.colors, 'stock_quantity', sp.stock_quantity
     ) as product
     FROM store_cart_items sci
     JOIN store_products sp ON sp.id = sci.product_id
     WHERE sci.cart_id = $1`,
    [cartId]
  );

  return {
    ...cartResult.rows[0],
    items: itemsResult.rows,
  };
}

// ==========================================
// CHECKOUT & PAYMENT
// ==========================================

// POST /store/checkout - Create checkout order
router.post('/checkout', authenticateStoreSession, async (req: Request, res: Response) => {
  try {
    const session = (req as any).storeSession as StoreSession;
    const { customer_name, customer_phone, customer_email, notes } = req.body;

    // Get cart
    const cart = await query<StoreCart>(
      'SELECT * FROM store_carts WHERE session_id = $1',
      [session.id]
    );

    if (cart.rows.length === 0 || cart.rows[0].total === 0) {
      return res.status(400).json({
        error: 'Empty cart',
        message: 'Your cart is empty',
      });
    }

    const cartData = cart.rows[0];

    // Get store for order number generation
    const store = await query<Store>(
      'SELECT * FROM stores WHERE id = $1',
      [session.store_id]
    );

    // Generate order number
    const orderNumberResult = await query<{ generate_store_order_number: string }>(
      'SELECT generate_store_order_number($1)',
      [store.rows[0].city]
    );
    const orderNumber = orderNumberResult.rows[0].generate_store_order_number;

    // Create Razorpay order
    const Razorpay = (await import('razorpay')).default;
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    });

    const razorpayOrder = await razorpay.orders.create({
      amount: cartData.total,
      currency: 'INR',
      receipt: orderNumber,
      notes: {
        store_id: session.store_id,
        session_id: session.id,
      },
    });

    // Create store order
    const orderId = uuidv4();
    const pickupTime = new Date(Date.now() + (store.rows[0].settings.pickup_time_minutes || 15) * 60 * 1000);

    await query(
      `INSERT INTO store_orders
       (id, order_number, store_id, session_id, user_id, customer_name, customer_phone, customer_email,
        subtotal, discount, tax, total, status, razorpay_order_id, pickup_time_estimate, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'PENDING', $13, $14, $15)`,
      [
        orderId, orderNumber, session.store_id, session.id, session.user_id,
        customer_name, customer_phone, customer_email,
        cartData.subtotal, cartData.discount, cartData.tax, cartData.total,
        razorpayOrder.id, pickupTime, notes
      ]
    );

    // Copy cart items to order items
    const cartItems = await query<StoreCartItem & { product_snapshot: StoreProduct }>(
      `SELECT sci.*,
       row_to_json(sp.*) as product_snapshot
       FROM store_cart_items sci
       JOIN store_products sp ON sp.id = sci.product_id
       WHERE sci.cart_id = $1`,
      [cartData.id]
    );

    for (const item of cartItems.rows) {
      // Get location info
      const location = await query<StorePlanogram>(
        'SELECT * FROM store_planogram WHERE product_id = $1',
        [item.product_id]
      );

      await query(
        `INSERT INTO store_order_items
         (order_id, product_id, tryon_job_id, product_snapshot, quantity, size, color, unit_price, total_price, location_info)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          orderId, item.product_id, item.tryon_job_id,
          JSON.stringify(item.product_snapshot),
          item.quantity, item.size, item.color,
          item.unit_price, item.total_price,
          location.rows.length > 0 ? JSON.stringify(location.rows[0]) : null
        ]
      );
    }

    // Track checkout start
    await trackEvent(session.store_id, 'checkout_start', { order_id: orderId, total: cartData.total }, session.id);

    res.json({
      order_id: orderId,
      order_number: orderNumber,
      razorpay_order_id: razorpayOrder.id,
      amount: cartData.total,
      currency: 'INR',
      key_id: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to create checkout' });
  }
});

// POST /store/payment/verify - Verify payment and generate pickup pass
router.post('/payment/verify', authenticateStoreSession, async (req: Request, res: Response) => {
  try {
    const session = (req as any).storeSession as StoreSession;
    const { order_id, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    // Verify signature
    const crypto = await import('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      await trackEvent(session.store_id, 'payment_fail', { order_id, reason: 'signature_mismatch' }, session.id);
      return res.status(400).json({
        error: 'Payment verification failed',
        message: 'Invalid payment signature',
      });
    }

    // Update order
    await query(
      `UPDATE store_orders
       SET status = 'CONFIRMED', razorpay_payment_id = $1, payment_verified_at = NOW(), payment_method = 'razorpay'
       WHERE id = $2 AND session_id = $3`,
      [razorpay_payment_id, order_id, session.id]
    );

    // Generate pickup pass
    const passCodeResult = await query<{ generate_pickup_pass_code: string }>(
      'SELECT generate_pickup_pass_code()'
    );
    const passCode = passCodeResult.rows[0].generate_pickup_pass_code;

    // Create QR data
    const qrData = JSON.stringify({
      type: 'pickup',
      pass_code: passCode,
      order_id: order_id,
      store_id: session.store_id,
    });

    const passId = uuidv4();
    await query(
      `INSERT INTO pickup_passes (id, order_id, pass_code, qr_data, status, expires_at)
       VALUES ($1, $2, $3, $4, 'ACTIVE', NOW() + INTERVAL '24 hours')`,
      [passId, order_id, passCode, qrData]
    );

    // Update coupon usage if used
    const order = await query<StoreOrder>(
      'SELECT * FROM store_orders WHERE id = $1',
      [order_id]
    );

    // Clear cart
    const cart = await query<StoreCart>(
      'SELECT id FROM store_carts WHERE session_id = $1',
      [session.id]
    );
    if (cart.rows.length > 0) {
      await query('DELETE FROM store_cart_items WHERE cart_id = $1', [cart.rows[0].id]);
      await query('DELETE FROM store_carts WHERE id = $1', [cart.rows[0].id]);
    }

    // Update session status
    await query(
      "UPDATE store_sessions SET status = 'CONVERTED' WHERE id = $1",
      [session.id]
    );

    // Update try-on jobs as purchased
    await query(
      `UPDATE store_tryon_jobs SET purchased = true
       WHERE session_id = $1 AND added_to_cart = true`,
      [session.id]
    );

    // Track events
    await trackEvent(session.store_id, 'payment_success', { order_id, amount: order.rows[0].total }, session.id);
    await trackEvent(session.store_id, 'pickup_pass_generated', { pass_code: passCode }, session.id);

    // Get full order with items
    const fullOrder = await getOrderWithItems(order_id);
    const pickupPass = await query<PickupPass>(
      'SELECT * FROM pickup_passes WHERE id = $1',
      [passId]
    );
    const store = await query<Store>(
      'SELECT * FROM stores WHERE id = $1',
      [session.store_id]
    );

    res.json({
      success: true,
      order: fullOrder,
      pickup_pass: pickupPass.rows[0],
      store: store.rows[0],
    });
  } catch (error) {
    console.error('Payment verify error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to verify payment' });
  }
});

// GET /store/pickup/:passCode - Get pickup pass details
router.get('/pickup/:passCode', async (req: Request, res: Response) => {
  try {
    const { passCode } = req.params;

    const result = await query<PickupPass & { order: StoreOrder; store: Store }>(
      `SELECT pp.*,
       row_to_json(so.*) as order,
       row_to_json(s.*) as store
       FROM pickup_passes pp
       JOIN store_orders so ON so.id = pp.order_id
       JOIN stores s ON s.id = so.store_id
       WHERE pp.pass_code = $1`,
      [passCode]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Invalid pickup pass',
      });
    }

    const data = result.rows[0];
    const orderWithItems = await getOrderWithItems(data.order_id);

    res.json({
      pickup_pass: {
        id: data.id,
        pass_code: data.pass_code,
        qr_data: data.qr_data,
        status: data.status,
        generated_at: data.generated_at,
        expires_at: data.expires_at,
      },
      order: orderWithItems,
      store: data.store,
    });
  } catch (error) {
    console.error('Get pickup pass error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to get pickup pass' });
  }
});

// Helper to get order with items
async function getOrderWithItems(orderId: string): Promise<StoreOrder> {
  const orderResult = await query<StoreOrder>(
    'SELECT * FROM store_orders WHERE id = $1',
    [orderId]
  );

  if (orderResult.rows.length === 0) {
    throw new Error('Order not found');
  }

  const itemsResult = await query<StoreOrderItem>(
    'SELECT * FROM store_order_items WHERE order_id = $1',
    [orderId]
  );

  return {
    ...orderResult.rows[0],
    items: itemsResult.rows,
  };
}

// ==========================================
// STAFF OPERATIONS
// ==========================================

// POST /store/staff/login - Staff login
router.post('/staff/login', async (req: Request, res: Response) => {
  try {
    const { store_id, email, pin } = req.body;

    const staffResult = await query<StoreStaff & { pin_hash: string }>(
      'SELECT * FROM store_staff WHERE store_id = $1 AND email = $2 AND is_active = true',
      [store_id, email.toLowerCase()]
    );

    if (staffResult.rows.length === 0) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid credentials',
      });
    }

    const staff = staffResult.rows[0];
    const validPin = await bcrypt.compare(pin, staff.pin_hash);

    if (!validPin) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid PIN',
      });
    }

    // Update last login
    await query(
      'UPDATE store_staff SET last_login_at = NOW() WHERE id = $1',
      [staff.id]
    );

    // Generate simple token
    const token = Buffer.from(JSON.stringify({
      staffId: staff.id,
      storeId: staff.store_id,
      exp: Date.now() + 8 * 60 * 60 * 1000, // 8 hours
    })).toString('base64');

    res.json({
      staff: {
        id: staff.id,
        name: staff.name,
        email: staff.email,
        role: staff.role,
        store_id: staff.store_id,
      },
      token,
    });
  } catch (error) {
    console.error('Staff login error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to login' });
  }
});

// GET /store/staff/orders - Get pending orders for staff
router.get('/staff/orders', authenticateStaff, async (req: Request, res: Response) => {
  try {
    const staff = (req as any).staff as StoreStaff;
    const { status = 'CONFIRMED' } = req.query;

    const ordersResult = await query<StoreOrder>(
      `SELECT so.*,
       (SELECT COUNT(*) FROM store_order_items WHERE order_id = so.id) as item_count
       FROM store_orders so
       WHERE so.store_id = $1 AND so.status = $2
       ORDER BY so.created_at DESC`,
      [staff.store_id, status]
    );

    const orders = await Promise.all(
      ordersResult.rows.map(async (order) => {
        const items = await query<StoreOrderItem>(
          'SELECT * FROM store_order_items WHERE order_id = $1',
          [order.id]
        );
        return { ...order, items: items.rows };
      })
    );

    res.json({ orders });
  } catch (error) {
    console.error('Get staff orders error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to get orders' });
  }
});

// POST /store/staff/scan-pickup - Scan pickup pass
router.post('/staff/scan-pickup', authenticateStaff, async (req: Request, res: Response) => {
  try {
    const staff = (req as any).staff as StoreStaff;
    const { pass_code } = req.body;

    // Find pickup pass
    const passResult = await query<PickupPass>(
      `SELECT pp.* FROM pickup_passes pp
       JOIN store_orders so ON so.id = pp.order_id
       WHERE pp.pass_code = $1 AND so.store_id = $2`,
      [pass_code, staff.store_id]
    );

    if (passResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Invalid pickup pass for this store',
      });
    }

    const pass = passResult.rows[0];

    if (pass.status !== 'ACTIVE') {
      return res.status(400).json({
        error: 'Invalid pass',
        message: `This pickup pass has already been ${pass.status.toLowerCase()}`,
      });
    }

    if (new Date(pass.expires_at) < new Date()) {
      return res.status(400).json({
        error: 'Expired',
        message: 'This pickup pass has expired',
      });
    }

    // Get order with items and locations
    const order = await getOrderWithItems(pass.order_id);
    const itemsWithLocations = await Promise.all(
      order.items.map(async (item) => {
        const location = item.location_info;
        return { item, location };
      })
    );

    res.json({
      order,
      items_with_locations: itemsWithLocations,
      pass: pass,
    });
  } catch (error) {
    console.error('Scan pickup error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to scan pickup pass' });
  }
});

// POST /store/staff/complete-pickup - Mark order as picked up
router.post('/staff/complete-pickup', authenticateStaff, async (req: Request, res: Response) => {
  try {
    const staff = (req as any).staff as StoreStaff;
    const { order_id } = req.body;

    // Update order
    await query(
      `UPDATE store_orders
       SET status = 'PICKED_UP', picked_up_at = NOW(), staff_id = $1
       WHERE id = $2 AND store_id = $3`,
      [staff.id, order_id, staff.store_id]
    );

    // Update pickup pass
    await query(
      `UPDATE pickup_passes
       SET status = 'USED', used_at = NOW(), scanned_by_staff_id = $1
       WHERE order_id = $2`,
      [staff.id, order_id]
    );

    // Update stock
    const items = await query<StoreOrderItem>(
      'SELECT * FROM store_order_items WHERE order_id = $1',
      [order_id]
    );

    for (const item of items.rows) {
      await query(
        'UPDATE store_products SET stock_quantity = stock_quantity - $1 WHERE id = $2',
        [item.quantity, item.product_id]
      );
    }

    // Track event
    await trackEvent(staff.store_id, 'pickup_complete', { order_id, staff_id: staff.id });

    res.json({
      success: true,
      message: 'Order marked as picked up',
    });
  } catch (error) {
    console.error('Complete pickup error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to complete pickup' });
  }
});

// POST /store/staff/ready-for-pickup - Mark order ready
router.post('/staff/ready-for-pickup', authenticateStaff, async (req: Request, res: Response) => {
  try {
    const staff = (req as any).staff as StoreStaff;
    const { order_id } = req.body;

    await query(
      `UPDATE store_orders SET status = 'READY_FOR_PICKUP' WHERE id = $1 AND store_id = $2`,
      [order_id, staff.store_id]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Ready for pickup error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to update order' });
  }
});

// ==========================================
// MERCHANT STORE MANAGEMENT
// ==========================================

// POST /store/merchant/stores - Create new store
router.post('/merchant/stores', authenticateMerchantStore, async (req: Request, res: Response) => {
  try {
    const merchantId = (req as any).merchantId;
    const {
      name, slug, description, address_line1, address_line2,
      city = 'Bangalore', state = 'Karnataka', pincode,
      phone, email, logo_url, banner_url, settings
    } = req.body;

    // Check slug uniqueness
    const existing = await query(
      'SELECT id FROM stores WHERE merchant_id = $1 AND slug = $2',
      [merchantId, slug]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'A store with this slug already exists',
      });
    }

    const storeId = uuidv4();
    await query(
      `INSERT INTO stores
       (id, merchant_id, name, slug, description, address_line1, address_line2,
        city, state, pincode, phone, email, logo_url, banner_url, settings, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'PENDING')`,
      [
        storeId, merchantId, name, slug, description, address_line1, address_line2,
        city, state, pincode, phone, email, logo_url, banner_url,
        JSON.stringify(settings || {})
      ]
    );

    // Generate store QR code
    const qrCodeId = `store_${storeId.slice(0, 8)}`;
    const deepLinkUrl = `https://mirrorx.co.in/store/${slug}?qr=${qrCodeId}`;

    await query(
      `INSERT INTO store_qr_codes (store_id, qr_type, reference_id, qr_code_id, deep_link_url)
       VALUES ($1, 'store', $1, $2, $3)`,
      [storeId, qrCodeId, deepLinkUrl]
    );

    const store = await query<Store>(
      'SELECT * FROM stores WHERE id = $1',
      [storeId]
    );

    res.status(201).json({
      store: store.rows[0],
      message: 'Store created. It will be reviewed and activated within 24-48 hours.',
    });
  } catch (error) {
    console.error('Create store error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to create store' });
  }
});

// GET /store/merchant/stores - List merchant stores
router.get('/merchant/stores', authenticateMerchantStore, async (req: Request, res: Response) => {
  try {
    const merchantId = (req as any).merchantId;

    const stores = await query<Store>(
      'SELECT * FROM stores WHERE merchant_id = $1 ORDER BY created_at DESC',
      [merchantId]
    );

    res.json({ stores: stores.rows });
  } catch (error) {
    console.error('List stores error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to list stores' });
  }
});

// POST /store/merchant/stores/:storeId/zones - Create zone
router.post('/merchant/stores/:storeId/zones', authenticateMerchantStore, async (req: Request, res: Response) => {
  try {
    const merchantId = (req as any).merchantId;
    const { storeId } = req.params;
    const { name, slug, description, floor, section, category, display_order, image_url } = req.body;

    // Verify store ownership
    const store = await query(
      'SELECT id FROM stores WHERE id = $1 AND merchant_id = $2',
      [storeId, merchantId]
    );

    if (store.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Store not found',
      });
    }

    const zoneId = uuidv4();
    const qrCodeId = `zone_${zoneId.slice(0, 8)}`;

    await query(
      `INSERT INTO store_zones
       (id, store_id, name, slug, description, floor, section, category, display_order, qr_code_id, image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [zoneId, storeId, name, slug, description, floor, section, category, display_order || 0, qrCodeId, image_url]
    );

    // Create QR code record
    const storeSlug = await query<{ slug: string }>(
      'SELECT slug FROM stores WHERE id = $1',
      [storeId]
    );
    const deepLinkUrl = `https://mirrorx.co.in/store/${storeSlug.rows[0].slug}?qr=${qrCodeId}&zone=${slug}`;

    await query(
      `INSERT INTO store_qr_codes (store_id, qr_type, reference_id, qr_code_id, deep_link_url)
       VALUES ($1, 'zone', $2, $3, $4)`,
      [storeId, zoneId, qrCodeId, deepLinkUrl]
    );

    const zone = await query<StoreZone>(
      'SELECT * FROM store_zones WHERE id = $1',
      [zoneId]
    );

    res.status(201).json({ zone: zone.rows[0] });
  } catch (error) {
    console.error('Create zone error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to create zone' });
  }
});

// POST /store/merchant/stores/:storeId/products/import - Bulk import products
router.post('/merchant/stores/:storeId/products/import', authenticateMerchantStore, async (req: Request, res: Response) => {
  try {
    const merchantId = (req as any).merchantId;
    const { storeId } = req.params;
    const { products } = req.body;

    // Verify store ownership
    const store = await query(
      'SELECT id FROM stores WHERE id = $1 AND merchant_id = $2',
      [storeId, merchantId]
    );

    if (store.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Store not found',
      });
    }

    let imported = 0;
    let updated = 0;
    let failed = 0;
    const errors: Array<{ sku: string; error: string }> = [];

    // Get zone mapping
    const zones = await query<StoreZone>(
      'SELECT id, slug FROM store_zones WHERE store_id = $1',
      [storeId]
    );
    const zoneMap = new Map(zones.rows.map(z => [z.slug, z.id]));

    for (const product of products) {
      try {
        const zoneId = product.zone_slug ? zoneMap.get(product.zone_slug) : null;

        // Check if product exists
        const existing = await query<{ id: string }>(
          'SELECT id FROM store_products WHERE store_id = $1 AND sku = $2',
          [storeId, product.sku]
        );

        const productId = existing.rows.length > 0 ? existing.rows[0].id : uuidv4();

        if (existing.rows.length > 0) {
          // Update existing
          await query(
            `UPDATE store_products SET
             name = $1, description = $2, brand = $3, category = $4, gender = $5,
             price = $6, original_price = $7, image_url = $8, additional_images = $9,
             sizes = $10, colors = $11, material = $12, tags = $13, zone_id = $14,
             stock_quantity = COALESCE($15, stock_quantity), updated_at = NOW()
             WHERE id = $16`,
            [
              product.name, product.description, product.brand, product.category,
              product.gender || 'unisex', product.price, product.original_price,
              product.image_url, product.additional_images || [],
              product.sizes || [], JSON.stringify(product.colors || []),
              product.material, product.tags || [], zoneId,
              product.stock_quantity, productId
            ]
          );
          updated++;
        } else {
          // Insert new
          const qrCodeId = `prod_${productId.slice(0, 8)}`;
          await query(
            `INSERT INTO store_products
             (id, store_id, zone_id, sku, name, description, brand, category, gender,
              price, original_price, image_url, additional_images, sizes, colors,
              material, tags, qr_code_id, stock_quantity)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
            [
              productId, storeId, zoneId, product.sku, product.name, product.description,
              product.brand, product.category, product.gender || 'unisex',
              product.price, product.original_price, product.image_url,
              product.additional_images || [], product.sizes || [],
              JSON.stringify(product.colors || []), product.material, product.tags || [],
              qrCodeId, product.stock_quantity || 0
            ]
          );
          imported++;
        }

        // Update/create planogram if location provided
        if (product.aisle || product.row || product.shelf || product.rack) {
          await query(
            `INSERT INTO store_planogram (store_id, product_id, zone_id, aisle, row, shelf, rack)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (store_id, product_id) DO UPDATE SET
             zone_id = EXCLUDED.zone_id, aisle = EXCLUDED.aisle, row = EXCLUDED.row,
             shelf = EXCLUDED.shelf, rack = EXCLUDED.rack, updated_at = NOW()`,
            [storeId, productId, zoneId, product.aisle, product.row, product.shelf, product.rack]
          );
        }
      } catch (err) {
        failed++;
        errors.push({ sku: product.sku, error: (err as Error).message });
      }
    }

    res.json({ imported, updated, failed, errors });
  } catch (error) {
    console.error('Import products error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to import products' });
  }
});

// POST /store/merchant/stores/:storeId/staff - Add staff member
router.post('/merchant/stores/:storeId/staff', authenticateMerchantStore, async (req: Request, res: Response) => {
  try {
    const merchantId = (req as any).merchantId;
    const { storeId } = req.params;
    const { name, email, phone, role, pin } = req.body;

    // Verify store ownership
    const store = await query(
      'SELECT id FROM stores WHERE id = $1 AND merchant_id = $2',
      [storeId, merchantId]
    );

    if (store.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Store not found',
      });
    }

    const pinHash = await bcrypt.hash(pin, 12);
    const staffId = uuidv4();

    await query(
      `INSERT INTO store_staff (id, store_id, name, email, phone, role, pin_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [staffId, storeId, name, email.toLowerCase(), phone, role || 'ASSOCIATE', pinHash]
    );

    res.status(201).json({
      staff: { id: staffId, name, email, role: role || 'ASSOCIATE' },
    });
  } catch (error) {
    console.error('Add staff error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to add staff' });
  }
});

// GET /store/merchant/stores/:storeId/analytics - Get store analytics
router.get('/merchant/stores/:storeId/analytics', authenticateMerchantStore, async (req: Request, res: Response) => {
  try {
    const merchantId = (req as any).merchantId;
    const { storeId } = req.params;
    const { date_from, date_to } = req.query;

    // Verify store ownership
    const store = await query(
      'SELECT id FROM stores WHERE id = $1 AND merchant_id = $2',
      [storeId, merchantId]
    );

    if (store.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Store not found',
      });
    }

    // Get daily metrics
    const metrics = await query<StoreDailyMetrics>(
      `SELECT * FROM store_daily_metrics
       WHERE store_id = $1 AND metric_date >= $2 AND metric_date <= $3
       ORDER BY metric_date DESC`,
      [storeId, date_from || '2024-01-01', date_to || new Date().toISOString().split('T')[0]]
    );

    // Calculate summary
    const summaryResult = await query<{
      total_sessions: number;
      total_tryons: number;
      total_orders: number;
      total_revenue: number;
    }>(
      `SELECT
       COUNT(DISTINCT ss.id) as total_sessions,
       COUNT(DISTINCT stj.id) as total_tryons,
       COUNT(DISTINCT so.id) as total_orders,
       COALESCE(SUM(so.total), 0) as total_revenue
       FROM store_sessions ss
       LEFT JOIN store_tryon_jobs stj ON stj.session_id = ss.id
       LEFT JOIN store_orders so ON so.session_id = ss.id AND so.status = 'PICKED_UP'
       WHERE ss.store_id = $1
       AND ss.started_at >= $2 AND ss.started_at <= $3`,
      [storeId, date_from || '2024-01-01', date_to || new Date().toISOString()]
    );

    const summary = summaryResult.rows[0];
    const avgOrderValue = summary.total_orders > 0
      ? Math.round(summary.total_revenue / summary.total_orders)
      : 0;
    const conversionRate = summary.total_sessions > 0
      ? ((summary.total_orders / summary.total_sessions) * 100).toFixed(2)
      : 0;

    res.json({
      metrics: metrics.rows,
      summary: {
        ...summary,
        average_order_value: avgOrderValue,
        overall_conversion_rate: parseFloat(conversionRate as string),
      },
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to get analytics' });
  }
});

// POST /store/merchant/stores/:storeId/qr-codes/generate - Generate QR codes
router.post('/merchant/stores/:storeId/qr-codes/generate', authenticateMerchantStore, async (req: Request, res: Response) => {
  try {
    const merchantId = (req as any).merchantId;
    const { storeId } = req.params;
    const { type, ids } = req.body;

    // Verify store ownership
    const store = await query<Store>(
      'SELECT * FROM stores WHERE id = $1 AND merchant_id = $2',
      [storeId, merchantId]
    );

    if (store.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Store not found',
      });
    }

    const qrCodes: Array<{ qr_code: StoreQRCode; qr_image_base64: string }> = [];

    if (type === 'store') {
      const qrResult = await query<StoreQRCode>(
        'SELECT * FROM store_qr_codes WHERE store_id = $1 AND qr_type = $2',
        [storeId, 'store']
      );

      for (const qr of qrResult.rows) {
        const qrImage = await QRCode.toDataURL(qr.deep_link_url, {
          width: 512,
          margin: 2,
          color: { dark: '#1a1a2e', light: '#ffffff' },
        });
        qrCodes.push({ qr_code: qr, qr_image_base64: qrImage });
      }
    } else if (type === 'zone') {
      const whereClause = ids?.length > 0 ? 'AND sz.id = ANY($2)' : '';
      const params: any[] = [storeId];
      if (ids?.length > 0) params.push(ids);

      const zones = await query<StoreZone>(
        `SELECT sz.* FROM store_zones sz WHERE sz.store_id = $1 ${whereClause}`,
        params
      );

      for (const zone of zones.rows) {
        const qrResult = await query<StoreQRCode>(
          'SELECT * FROM store_qr_codes WHERE reference_id = $1 AND qr_type = $2',
          [zone.id, 'zone']
        );

        if (qrResult.rows.length > 0) {
          const qrImage = await QRCode.toDataURL(qrResult.rows[0].deep_link_url, {
            width: 512,
            margin: 2,
            color: { dark: '#1a1a2e', light: '#ffffff' },
          });
          qrCodes.push({ qr_code: qrResult.rows[0], qr_image_base64: qrImage });
        }
      }
    } else if (type === 'product') {
      const whereClause = ids?.length > 0 ? 'AND sp.id = ANY($2)' : '';
      const params: any[] = [storeId];
      if (ids?.length > 0) params.push(ids);

      const products = await query<StoreProduct>(
        `SELECT sp.* FROM store_products sp WHERE sp.store_id = $1 ${whereClause}`,
        params
      );

      for (const product of products.rows) {
        // Create QR code if doesn't exist
        let qrResult = await query<StoreQRCode>(
          'SELECT * FROM store_qr_codes WHERE reference_id = $1 AND qr_type = $2',
          [product.id, 'product']
        );

        if (qrResult.rows.length === 0) {
          const qrCodeId = `prod_${product.id.slice(0, 8)}`;
          const deepLinkUrl = `https://mirrorx.co.in/store/${store.rows[0].slug}?qr=${qrCodeId}&product=${product.id}`;

          await query(
            `INSERT INTO store_qr_codes (store_id, qr_type, reference_id, qr_code_id, deep_link_url)
             VALUES ($1, 'product', $2, $3, $4)`,
            [storeId, product.id, qrCodeId, deepLinkUrl]
          );

          qrResult = await query<StoreQRCode>(
            'SELECT * FROM store_qr_codes WHERE reference_id = $1 AND qr_type = $2',
            [product.id, 'product']
          );
        }

        const qrImage = await QRCode.toDataURL(qrResult.rows[0].deep_link_url, {
          width: 512,
          margin: 2,
          color: { dark: '#1a1a2e', light: '#ffffff' },
        });
        qrCodes.push({ qr_code: qrResult.rows[0], qr_image_base64: qrImage });
      }
    }

    res.json({ qr_codes: qrCodes });
  } catch (error) {
    console.error('Generate QR codes error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to generate QR codes' });
  }
});

export default router;
