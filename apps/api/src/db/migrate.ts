import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function createMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `);
}

async function getExecutedMigrations(): Promise<string[]> {
  const result = await pool.query('SELECT name FROM migrations ORDER BY id');
  return result.rows.map((row) => row.name);
}

async function runMigration(name: string, sql: string) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('INSERT INTO migrations (name) VALUES ($1)', [name]);
    await client.query('COMMIT');
    console.log(`✅ Migration applied: ${name}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`❌ Migration failed: ${name}`);
    throw error;
  } finally {
    client.release();
  }
}

async function migrate() {
  console.log('🚀 Starting database migrations...\n');

  try {
    await createMigrationsTable();
    const executedMigrations = await getExecutedMigrations();

    const migrationsDir = join(__dirname, 'migrations');
    const migrationFiles = readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    let migrationsRun = 0;

    for (const file of migrationFiles) {
      if (!executedMigrations.includes(file)) {
        const sql = readFileSync(join(migrationsDir, file), 'utf-8');
        await runMigration(file, sql);
        migrationsRun++;
      } else {
        console.log(`⏭️  Skipping (already applied): ${file}`);
      }
    }

    if (migrationsRun === 0) {
      console.log('\n✨ Database is up to date. No new migrations to run.');
    } else {
      console.log(`\n✨ Successfully applied ${migrationsRun} migration(s).`);
    }
  } catch (error) {
    console.error('\n❌ Migration error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
