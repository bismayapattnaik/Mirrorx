-- MirrorX Database Schema for Supabase
-- Run this in Supabase SQL Editor

-- ==================================
-- ENUM TYPES (if not exist)
-- ==================================

DO $$ BEGIN
    CREATE TYPE subscription_tier AS ENUM ('FREE', 'PRO', 'ELITE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE subscription_status AS ENUM ('ACTIVE', 'PAUSED', 'CANCELLED', 'EXPIRED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE transaction_type AS ENUM ('PURCHASE', 'USAGE', 'ADJUSTMENT', 'REFUND');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE order_status AS ENUM ('CREATED', 'PAID', 'FAILED', 'REFUNDED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE tryon_mode AS ENUM ('PART', 'FULL_FIT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE tryon_job_status AS ENUM ('QUEUED', 'PROCESSING', 'SUCCEEDED', 'FAILED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE merchant_status AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ==================================
-- USERS TABLE
-- ==================================

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255),
    name VARCHAR(100),
    phone VARCHAR(20),
    avatar_url TEXT,
    google_id VARCHAR(255) UNIQUE,
    credits_balance INTEGER NOT NULL DEFAULT 0,
    subscription_tier subscription_tier NOT NULL DEFAULT 'FREE',
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL;

-- ==================================
-- WARDROBE TABLE
-- ==================================

CREATE TABLE IF NOT EXISTS wardrobe (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tryon_image_url TEXT NOT NULL,
    product_image_url TEXT,
    product_url TEXT,
    brand VARCHAR(100),
    category VARCHAR(50),
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wardrobe_user_id ON wardrobe(user_id);

-- ==================================
-- CREDITS LEDGER TABLE
-- ==================================

CREATE TABLE IF NOT EXISTS credits_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    transaction_type transaction_type NOT NULL,
    description TEXT,
    reference_id UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credits_ledger_user_id ON credits_ledger(user_id);

-- ==================================
-- SUBSCRIPTIONS TABLE
-- ==================================

CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_type subscription_tier NOT NULL,
    status subscription_status NOT NULL DEFAULT 'ACTIVE',
    start_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    end_date TIMESTAMP WITH TIME ZONE,
    razorpay_subscription_id VARCHAR(255) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);

-- ==================================
-- ORDERS TABLE
-- ==================================

CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    status order_status NOT NULL DEFAULT 'CREATED',
    order_type VARCHAR(50) NOT NULL,
    sku VARCHAR(50) NOT NULL,
    razorpay_order_id VARCHAR(255) UNIQUE,
    razorpay_payment_id VARCHAR(255),
    payment_method VARCHAR(50),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);

-- ==================================
-- TRYON JOBS TABLE
-- ==================================

CREATE TABLE IF NOT EXISTS tryon_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mode tryon_mode NOT NULL,
    source_image_url TEXT NOT NULL,
    product_image_url TEXT,
    product_url TEXT,
    result_image_url TEXT,
    credits_used INTEGER NOT NULL DEFAULT 1,
    status tryon_job_status NOT NULL DEFAULT 'QUEUED',
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    processing_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_tryon_jobs_user_id ON tryon_jobs(user_id);

-- ==================================
-- MERCHANTS TABLE (B2B)
-- ==================================

CREATE TABLE IF NOT EXISTS merchants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    website TEXT,
    status merchant_status NOT NULL DEFAULT 'PENDING',
    api_requests_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ==================================
-- MERCHANT API KEYS TABLE
-- ==================================

CREATE TABLE IF NOT EXISTS merchant_api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    key_prefix VARCHAR(8) NOT NULL,
    key_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_used_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ==================================
-- DAILY FREE USAGE TRACKING
-- ==================================

CREATE TABLE IF NOT EXISTS daily_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
    tryon_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, usage_date)
);

-- ==================================
-- TRIGGER: Update updated_at timestamp
-- ==================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_merchants_updated_at ON merchants;
CREATE TRIGGER update_merchants_updated_at
    BEFORE UPDATE ON merchants
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Success message
SELECT 'MirrorX database setup complete!' as message;
