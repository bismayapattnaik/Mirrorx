import pg from 'pg';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function seed() {
  console.log('🌱 Starting database seed...\n');

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Create test user
    const testUserId = uuidv4();
    const passwordHash = await bcrypt.hash('password123', 12);

    await client.query(
      `INSERT INTO users (id, email, password_hash, name, phone, credits_balance, subscription_tier, email_verified)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (email) DO NOTHING`,
      [testUserId, 'test@mirrorx.co.in', passwordHash, 'Test User', '9876543210', 50, 'FREE', true]
    );
    console.log('✅ Created test user: test@mirrorx.co.in / password123');

    // Create pro user
    const proUserId = uuidv4();
    await client.query(
      `INSERT INTO users (id, email, password_hash, name, credits_balance, subscription_tier, email_verified)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (email) DO NOTHING`,
      [proUserId, 'pro@mirrorx.co.in', passwordHash, 'Pro User', 500, 'PRO', true]
    );
    console.log('✅ Created pro user: pro@mirrorx.co.in / password123');

    // Add initial credits ledger entry for test user
    await client.query(
      `INSERT INTO credits_ledger (user_id, amount, transaction_type, description)
       SELECT $1, 50, 'ADJUSTMENT', 'Welcome bonus credits'
       WHERE NOT EXISTS (
         SELECT 1 FROM credits_ledger WHERE user_id = $1 AND description = 'Welcome bonus credits'
       )`,
      [testUserId]
    );

    // Create active subscription for pro user
    await client.query(
      `INSERT INTO subscriptions (user_id, plan_type, status, start_date, end_date)
       SELECT $1, 'PRO', 'ACTIVE', NOW(), NOW() + INTERVAL '1 month'
       WHERE NOT EXISTS (
         SELECT 1 FROM subscriptions WHERE user_id = $1 AND status = 'ACTIVE'
       )`,
      [proUserId]
    );
    console.log('✅ Created pro subscription');

    // Create test merchant
    const merchantId = uuidv4();
    await client.query(
      `INSERT INTO merchants (id, name, email, website, status)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO NOTHING`,
      [merchantId, 'Test Fashion Store', 'merchant@example.com', 'https://testfashion.com', 'ACTIVE']
    );
    console.log('✅ Created test merchant');

    // Create sample wardrobe items for test user
    const wardrobeItems = [
      {
        id: uuidv4(),
        userId: testUserId,
        tryonImageUrl: 'https://placehold.co/600x800/1a1a1a/D4AF37?text=Look+1',
        brand: 'Fabindia',
        category: 'ethnic',
        tags: ['kurta', 'cotton', 'summer'],
      },
      {
        id: uuidv4(),
        userId: testUserId,
        tryonImageUrl: 'https://placehold.co/600x800/1a1a1a/D4AF37?text=Look+2',
        brand: 'Allen Solly',
        category: 'formal',
        tags: ['shirt', 'office', 'blue'],
      },
      {
        id: uuidv4(),
        userId: testUserId,
        tryonImageUrl: 'https://placehold.co/600x800/1a1a1a/D4AF37?text=Look+3',
        brand: 'Levis',
        category: 'casual',
        tags: ['jeans', 'denim', 'casual'],
      },
    ];

    for (const item of wardrobeItems) {
      await client.query(
        `INSERT INTO wardrobe (id, user_id, tryon_image_url, brand, category, tags)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT DO NOTHING`,
        [item.id, item.userId, item.tryonImageUrl, item.brand, item.category, item.tags]
      );
    }
    console.log('✅ Created sample wardrobe items');

    // Create sample tryon job
    await client.query(
      `INSERT INTO tryon_jobs (user_id, mode, source_image_url, status, credits_used)
       SELECT $1, 'PART', 'https://placehold.co/400x600/1a1a1a/D4AF37?text=Selfie', 'SUCCEEDED', 1
       WHERE NOT EXISTS (
         SELECT 1 FROM tryon_jobs WHERE user_id = $1 LIMIT 1
       )`,
      [testUserId]
    );
    console.log('✅ Created sample tryon job');

    await client.query('COMMIT');
    console.log('\n✨ Database seeded successfully!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Seed error:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
