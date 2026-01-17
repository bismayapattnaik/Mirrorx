-- MirrorX Database Schema
-- Migration 001: Initial Schema
-- Run with: psql -d mirrorx -f 001_initial_schema.sql

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==================================
-- ENUM TYPES
-- ==================================

CREATE TYPE subscription_tier AS ENUM ('FREE', 'PRO', 'ELITE');
CREATE TYPE subscription_status AS ENUM ('ACTIVE', 'PAUSED', 'CANCELLED', 'EXPIRED');
CREATE TYPE transaction_type AS ENUM ('PURCHASE', 'USAGE', 'ADJUSTMENT', 'REFUND');
CREATE TYPE order_status AS ENUM ('CREATED', 'PAID', 'FAILED', 'REFUNDED');
CREATE TYPE tryon_mode AS ENUM ('PART', 'FULL_FIT');
CREATE TYPE tryon_job_status AS ENUM ('QUEUED', 'PROCESSING', 'SUCCEEDED', 'FAILED');
CREATE TYPE merchant_status AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED');

-- ==================================
-- USERS TABLE
-- ==================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255), -- NULL for OAuth users
    name VARCHAR(100),
    phone VARCHAR(10) CHECK (phone IS NULL OR (phone ~ '^[6-9][0-9]{9}$')),
    avatar_url TEXT,
    google_id VARCHAR(255) UNIQUE,
    credits_balance INTEGER NOT NULL DEFAULT 0 CHECK (credits_balance >= 0),
    subscription_tier subscription_tier NOT NULL DEFAULT 'FREE',
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL;
CREATE INDEX idx_users_created_at ON users(created_at DESC);

-- ==================================
-- WARDROBE TABLE
-- ==================================

CREATE TABLE wardrobe (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tryon_image_url TEXT NOT NULL,
    product_image_url TEXT,
    product_url TEXT,
    brand VARCHAR(100),
    category VARCHAR(50),
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wardrobe_user_id ON wardrobe(user_id);
CREATE INDEX idx_wardrobe_user_created ON wardrobe(user_id, created_at DESC);
CREATE INDEX idx_wardrobe_category ON wardrobe(user_id, category) WHERE category IS NOT NULL;

-- ==================================
-- CREDITS LEDGER TABLE
-- ==================================

CREATE TABLE credits_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL, -- positive for credits, negative for usage
    transaction_type transaction_type NOT NULL,
    description TEXT,
    reference_id UUID, -- can reference order_id, tryon_job_id, etc.
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_credits_ledger_user_id ON credits_ledger(user_id);
CREATE INDEX idx_credits_ledger_user_created ON credits_ledger(user_id, created_at DESC);

-- ==================================
-- SUBSCRIPTIONS TABLE
-- ==================================

CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_type subscription_tier NOT NULL,
    status subscription_status NOT NULL DEFAULT 'ACTIVE',
    start_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    end_date TIMESTAMP WITH TIME ZONE,
    razorpay_subscription_id VARCHAR(255) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status) WHERE status = 'ACTIVE';
CREATE INDEX idx_subscriptions_razorpay ON subscriptions(razorpay_subscription_id) WHERE razorpay_subscription_id IS NOT NULL;

-- ==================================
-- ORDERS TABLE
-- ==================================

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL CHECK (amount > 0), -- in paise
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    status order_status NOT NULL DEFAULT 'CREATED',
    order_type VARCHAR(50) NOT NULL, -- 'CREDITS_PACK' or 'SUBSCRIPTION'
    sku VARCHAR(50) NOT NULL,
    razorpay_order_id VARCHAR(255) UNIQUE,
    razorpay_payment_id VARCHAR(255),
    payment_method VARCHAR(50),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_user_created ON orders(user_id, created_at DESC);
CREATE INDEX idx_orders_razorpay_order ON orders(razorpay_order_id) WHERE razorpay_order_id IS NOT NULL;
CREATE INDEX idx_orders_status ON orders(status);

-- ==================================
-- TRYON JOBS TABLE
-- ==================================

CREATE TABLE tryon_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    processing_time_ms INTEGER, -- track performance
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_tryon_jobs_user_id ON tryon_jobs(user_id);
CREATE INDEX idx_tryon_jobs_user_created ON tryon_jobs(user_id, created_at DESC);
CREATE INDEX idx_tryon_jobs_status ON tryon_jobs(status) WHERE status IN ('QUEUED', 'PROCESSING');

-- ==================================
-- MERCHANTS TABLE (B2B)
-- ==================================

CREATE TABLE merchants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    website TEXT,
    status merchant_status NOT NULL DEFAULT 'PENDING',
    api_requests_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_merchants_email ON merchants(email);
CREATE INDEX idx_merchants_status ON merchants(status);

-- ==================================
-- MERCHANT API KEYS TABLE
-- ==================================

CREATE TABLE merchant_api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    key_prefix VARCHAR(8) NOT NULL, -- first 8 chars for identification
    key_hash VARCHAR(255) NOT NULL, -- bcrypt hash of full key
    name VARCHAR(100), -- optional label for the key
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_used_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_merchant_api_keys_merchant ON merchant_api_keys(merchant_id);
CREATE INDEX idx_merchant_api_keys_prefix ON merchant_api_keys(key_prefix);

-- ==================================
-- DAILY FREE USAGE TRACKING
-- ==================================

CREATE TABLE daily_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
    tryon_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, usage_date)
);

CREATE INDEX idx_daily_usage_user_date ON daily_usage(user_id, usage_date DESC);

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

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_merchants_updated_at
    BEFORE UPDATE ON merchants
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ==================================
-- TRIGGER: Maintain credits_balance consistency
-- ==================================

CREATE OR REPLACE FUNCTION update_credits_balance()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE users
    SET credits_balance = credits_balance + NEW.amount
    WHERE id = NEW.user_id;

    -- Ensure balance doesn't go negative
    IF (SELECT credits_balance FROM users WHERE id = NEW.user_id) < 0 THEN
        RAISE EXCEPTION 'Insufficient credits balance';
    END IF;

    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER credits_ledger_balance_trigger
    AFTER INSERT ON credits_ledger
    FOR EACH ROW
    EXECUTE FUNCTION update_credits_balance();

-- ==================================
-- COMMENTS
-- ==================================

COMMENT ON TABLE users IS 'User accounts for MirrorX platform';
COMMENT ON TABLE wardrobe IS 'Saved try-on results in user virtual wardrobe';
COMMENT ON TABLE credits_ledger IS 'Immutable log of all credit transactions';
COMMENT ON TABLE subscriptions IS 'User subscription records';
COMMENT ON TABLE orders IS 'Payment orders for credits and subscriptions';
COMMENT ON TABLE tryon_jobs IS 'AI try-on job queue and history';
COMMENT ON TABLE merchants IS 'B2B merchant accounts';
COMMENT ON TABLE merchant_api_keys IS 'API keys for merchant integrations';
COMMENT ON TABLE daily_usage IS 'Track daily free tier usage per user';
