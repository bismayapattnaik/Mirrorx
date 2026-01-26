-- MirrorX Database Schema
-- Migration 003: Store Mode (B2B Offline Retail)
-- Run with: psql -d mirrorx -f 003_store_mode.sql

-- ==================================
-- ENUM TYPES FOR STORE MODE
-- ==================================

CREATE TYPE store_status AS ENUM ('PENDING', 'ACTIVE', 'PAUSED', 'SUSPENDED');
CREATE TYPE store_order_status AS ENUM ('PENDING', 'CONFIRMED', 'READY_FOR_PICKUP', 'PICKED_UP', 'CANCELLED', 'REFUNDED');
CREATE TYPE pickup_pass_status AS ENUM ('ACTIVE', 'USED', 'EXPIRED', 'CANCELLED');
CREATE TYPE store_staff_role AS ENUM ('ADMIN', 'MANAGER', 'ASSOCIATE', 'CASHIER');
CREATE TYPE store_session_status AS ENUM ('ACTIVE', 'EXPIRED', 'CONVERTED');
CREATE TYPE store_product_category AS ENUM (
    'tops', 'shirts', 'tshirts', 'blouses', 'kurtas',
    'bottoms', 'jeans', 'trousers', 'skirts', 'leggings',
    'dresses', 'sarees', 'lehengas', 'suits',
    'outerwear', 'jackets', 'blazers', 'sweaters',
    'ethnicwear', 'westernwear', 'sportswear', 'loungewear',
    'accessories', 'footwear', 'other'
);
CREATE TYPE gender_type AS ENUM ('male', 'female', 'unisex');

-- ==================================
-- STORES TABLE
-- ==================================

CREATE TABLE stores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(100) NOT NULL, -- URL-friendly identifier
    description TEXT,
    address_line1 VARCHAR(255) NOT NULL,
    address_line2 VARCHAR(255),
    city VARCHAR(100) NOT NULL DEFAULT 'Bangalore',
    state VARCHAR(100) NOT NULL DEFAULT 'Karnataka',
    pincode VARCHAR(6) NOT NULL CHECK (pincode ~ '^[1-9][0-9]{5}$'),
    country VARCHAR(50) NOT NULL DEFAULT 'India',
    phone VARCHAR(10) CHECK (phone ~ '^[6-9][0-9]{9}$'),
    email VARCHAR(255),
    status store_status NOT NULL DEFAULT 'PENDING',
    logo_url TEXT,
    banner_url TEXT,
    opening_hours JSONB DEFAULT '{"monday": {"open": "10:00", "close": "21:00"}, "tuesday": {"open": "10:00", "close": "21:00"}, "wednesday": {"open": "10:00", "close": "21:00"}, "thursday": {"open": "10:00", "close": "21:00"}, "friday": {"open": "10:00", "close": "21:00"}, "saturday": {"open": "10:00", "close": "21:00"}, "sunday": {"open": "10:00", "close": "21:00"}}',
    settings JSONB DEFAULT '{"allow_guest_checkout": true, "require_selfie": true, "enable_try_on": true, "enable_find_in_store": true, "pickup_time_minutes": 15}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(merchant_id, slug)
);

CREATE INDEX idx_stores_merchant ON stores(merchant_id);
CREATE INDEX idx_stores_slug ON stores(slug);
CREATE INDEX idx_stores_city ON stores(city);
CREATE INDEX idx_stores_status ON stores(status) WHERE status = 'ACTIVE';

-- ==================================
-- STORE ZONES TABLE
-- ==================================

CREATE TABLE store_zones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(50) NOT NULL,
    description TEXT,
    floor VARCHAR(20), -- e.g., 'Ground', '1st', '2nd'
    section VARCHAR(50), -- e.g., 'Men', 'Women', 'Kids'
    category store_product_category,
    display_order INTEGER NOT NULL DEFAULT 0,
    qr_code_id VARCHAR(50) UNIQUE, -- unique QR identifier for zone
    image_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(store_id, slug)
);

CREATE INDEX idx_store_zones_store ON store_zones(store_id);
CREATE INDEX idx_store_zones_qr ON store_zones(qr_code_id) WHERE qr_code_id IS NOT NULL;

-- ==================================
-- STORE PRODUCTS (SKUs) TABLE
-- ==================================

CREATE TABLE store_products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    zone_id UUID REFERENCES store_zones(id) ON DELETE SET NULL,
    sku VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    brand VARCHAR(100),
    category store_product_category NOT NULL,
    gender gender_type NOT NULL DEFAULT 'unisex',
    price INTEGER NOT NULL CHECK (price > 0), -- in paise (INR)
    original_price INTEGER CHECK (original_price IS NULL OR original_price >= price), -- MRP in paise
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    image_url TEXT NOT NULL, -- Primary product image for try-on
    additional_images TEXT[] DEFAULT '{}',
    sizes TEXT[] DEFAULT '{}', -- e.g., ['S', 'M', 'L', 'XL']
    colors JSONB DEFAULT '[]', -- e.g., [{"name": "Black", "hex": "#000000"}]
    material VARCHAR(100),
    care_instructions TEXT,
    tags TEXT[] DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_try_on_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    low_stock_threshold INTEGER NOT NULL DEFAULT 5,
    qr_code_id VARCHAR(50) UNIQUE, -- unique QR identifier for individual product
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(store_id, sku)
);

CREATE INDEX idx_store_products_store ON store_products(store_id);
CREATE INDEX idx_store_products_zone ON store_products(zone_id);
CREATE INDEX idx_store_products_sku ON store_products(sku);
CREATE INDEX idx_store_products_category ON store_products(store_id, category);
CREATE INDEX idx_store_products_brand ON store_products(store_id, brand) WHERE brand IS NOT NULL;
CREATE INDEX idx_store_products_gender ON store_products(store_id, gender);
CREATE INDEX idx_store_products_qr ON store_products(qr_code_id) WHERE qr_code_id IS NOT NULL;
CREATE INDEX idx_store_products_active ON store_products(store_id, is_active) WHERE is_active = TRUE;

-- ==================================
-- STORE PLANOGRAM (Location Mapping)
-- ==================================

CREATE TABLE store_planogram (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES store_products(id) ON DELETE CASCADE,
    zone_id UUID REFERENCES store_zones(id) ON DELETE SET NULL,
    aisle VARCHAR(20), -- e.g., 'A', 'B', '1', '2'
    row VARCHAR(20), -- e.g., '1', '2', 'Top', 'Middle', 'Bottom'
    shelf VARCHAR(20), -- e.g., '1', '2', 'Left', 'Center', 'Right'
    rack VARCHAR(20), -- rack identifier
    facing INTEGER DEFAULT 1, -- number of product facings
    position_notes TEXT, -- additional location details
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(store_id, product_id)
);

CREATE INDEX idx_store_planogram_store ON store_planogram(store_id);
CREATE INDEX idx_store_planogram_product ON store_planogram(product_id);
CREATE INDEX idx_store_planogram_zone ON store_planogram(zone_id);
CREATE INDEX idx_store_planogram_location ON store_planogram(store_id, aisle, row, shelf);

-- ==================================
-- STORE SESSIONS (Guest Shopping Sessions)
-- ==================================

CREATE TABLE store_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- NULL for guest users
    session_token VARCHAR(64) NOT NULL UNIQUE, -- for guest sessions
    selfie_image_url TEXT, -- stored temporarily for try-on
    status store_session_status NOT NULL DEFAULT 'ACTIVE',
    device_info JSONB, -- user agent, screen size, etc.
    entry_qr_type VARCHAR(20), -- 'store', 'zone', 'product'
    entry_qr_id VARCHAR(50), -- the QR code that started the session
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_active_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW() + INTERVAL '4 hours'
);

CREATE INDEX idx_store_sessions_store ON store_sessions(store_id);
CREATE INDEX idx_store_sessions_user ON store_sessions(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_store_sessions_token ON store_sessions(session_token);
CREATE INDEX idx_store_sessions_status ON store_sessions(status) WHERE status = 'ACTIVE';
CREATE INDEX idx_store_sessions_expires ON store_sessions(expires_at);

-- ==================================
-- STORE CARTS TABLE
-- ==================================

CREATE TABLE store_carts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES store_sessions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    subtotal INTEGER NOT NULL DEFAULT 0 CHECK (subtotal >= 0), -- in paise
    discount INTEGER NOT NULL DEFAULT 0 CHECK (discount >= 0), -- in paise
    tax INTEGER NOT NULL DEFAULT 0 CHECK (tax >= 0), -- in paise (GST)
    total INTEGER NOT NULL DEFAULT 0 CHECK (total >= 0), -- in paise
    coupon_code VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(session_id)
);

CREATE INDEX idx_store_carts_store ON store_carts(store_id);
CREATE INDEX idx_store_carts_session ON store_carts(session_id);
CREATE INDEX idx_store_carts_user ON store_carts(user_id) WHERE user_id IS NOT NULL;

-- ==================================
-- STORE CART ITEMS TABLE
-- ==================================

CREATE TABLE store_cart_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cart_id UUID NOT NULL REFERENCES store_carts(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES store_products(id) ON DELETE CASCADE,
    tryon_job_id UUID REFERENCES tryon_jobs(id) ON DELETE SET NULL, -- linked try-on result
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    size VARCHAR(20),
    color VARCHAR(50),
    unit_price INTEGER NOT NULL CHECK (unit_price > 0), -- price at time of adding
    total_price INTEGER NOT NULL CHECK (total_price > 0), -- unit_price * quantity
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(cart_id, product_id, size, color)
);

CREATE INDEX idx_store_cart_items_cart ON store_cart_items(cart_id);
CREATE INDEX idx_store_cart_items_product ON store_cart_items(product_id);

-- ==================================
-- STORE ORDERS TABLE
-- ==================================

CREATE TABLE store_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number VARCHAR(20) NOT NULL UNIQUE, -- e.g., 'MX-BLR-001234'
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    session_id UUID REFERENCES store_sessions(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    customer_name VARCHAR(100),
    customer_phone VARCHAR(10) CHECK (customer_phone IS NULL OR customer_phone ~ '^[6-9][0-9]{9}$'),
    customer_email VARCHAR(255),
    subtotal INTEGER NOT NULL CHECK (subtotal > 0), -- in paise
    discount INTEGER NOT NULL DEFAULT 0 CHECK (discount >= 0),
    tax INTEGER NOT NULL DEFAULT 0 CHECK (tax >= 0), -- GST
    total INTEGER NOT NULL CHECK (total > 0), -- final amount
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    status store_order_status NOT NULL DEFAULT 'PENDING',
    payment_method VARCHAR(50), -- 'razorpay', 'upi', 'card', 'cash'
    razorpay_order_id VARCHAR(255),
    razorpay_payment_id VARCHAR(255),
    payment_verified_at TIMESTAMP WITH TIME ZONE,
    pickup_time_estimate TIMESTAMP WITH TIME ZONE,
    picked_up_at TIMESTAMP WITH TIME ZONE,
    staff_id UUID, -- staff who processed the order
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_store_orders_store ON store_orders(store_id);
CREATE INDEX idx_store_orders_user ON store_orders(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_store_orders_session ON store_orders(session_id) WHERE session_id IS NOT NULL;
CREATE INDEX idx_store_orders_number ON store_orders(order_number);
CREATE INDEX idx_store_orders_status ON store_orders(store_id, status);
CREATE INDEX idx_store_orders_razorpay ON store_orders(razorpay_order_id) WHERE razorpay_order_id IS NOT NULL;
CREATE INDEX idx_store_orders_created ON store_orders(store_id, created_at DESC);

-- ==================================
-- STORE ORDER ITEMS TABLE
-- ==================================

CREATE TABLE store_order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES store_orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES store_products(id) ON DELETE CASCADE,
    tryon_job_id UUID REFERENCES tryon_jobs(id) ON DELETE SET NULL,
    product_snapshot JSONB NOT NULL, -- snapshot of product at time of order
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    size VARCHAR(20),
    color VARCHAR(50),
    unit_price INTEGER NOT NULL CHECK (unit_price > 0),
    total_price INTEGER NOT NULL CHECK (total_price > 0),
    location_info JSONB, -- aisle/row/shelf from planogram
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_store_order_items_order ON store_order_items(order_id);
CREATE INDEX idx_store_order_items_product ON store_order_items(product_id);

-- ==================================
-- PICKUP PASSES TABLE
-- ==================================

CREATE TABLE pickup_passes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES store_orders(id) ON DELETE CASCADE,
    pass_code VARCHAR(12) NOT NULL UNIQUE, -- e.g., 'MX-ABC123'
    qr_data TEXT NOT NULL, -- encoded QR content
    status pickup_pass_status NOT NULL DEFAULT 'ACTIVE',
    generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW() + INTERVAL '24 hours',
    used_at TIMESTAMP WITH TIME ZONE,
    scanned_by_staff_id UUID
);

CREATE INDEX idx_pickup_passes_order ON pickup_passes(order_id);
CREATE INDEX idx_pickup_passes_code ON pickup_passes(pass_code);
CREATE INDEX idx_pickup_passes_status ON pickup_passes(status) WHERE status = 'ACTIVE';

-- ==================================
-- STORE STAFF TABLE
-- ==================================

CREATE TABLE store_staff (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- optional link to user account
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(10) CHECK (phone ~ '^[6-9][0-9]{9}$'),
    role store_staff_role NOT NULL DEFAULT 'ASSOCIATE',
    pin_hash VARCHAR(255), -- for quick staff login (4-6 digit PIN)
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(store_id, email)
);

CREATE INDEX idx_store_staff_store ON store_staff(store_id);
CREATE INDEX idx_store_staff_email ON store_staff(email);
CREATE INDEX idx_store_staff_active ON store_staff(store_id, is_active) WHERE is_active = TRUE;

-- ==================================
-- STORE TRY-ON JOBS (Extended for Store Context)
-- ==================================

CREATE TABLE store_tryon_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tryon_job_id UUID NOT NULL REFERENCES tryon_jobs(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    session_id UUID REFERENCES store_sessions(id) ON DELETE SET NULL,
    product_id UUID REFERENCES store_products(id) ON DELETE SET NULL,
    zone_id UUID REFERENCES store_zones(id) ON DELETE SET NULL,
    added_to_cart BOOLEAN NOT NULL DEFAULT FALSE,
    purchased BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(tryon_job_id)
);

CREATE INDEX idx_store_tryon_jobs_store ON store_tryon_jobs(store_id);
CREATE INDEX idx_store_tryon_jobs_session ON store_tryon_jobs(session_id);
CREATE INDEX idx_store_tryon_jobs_product ON store_tryon_jobs(product_id);

-- ==================================
-- STORE ANALYTICS EVENTS
-- ==================================

CREATE TABLE store_analytics_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    session_id UUID REFERENCES store_sessions(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL, -- see event taxonomy below
    event_data JSONB DEFAULT '{}',
    zone_id UUID REFERENCES store_zones(id) ON DELETE SET NULL,
    product_id UUID REFERENCES store_products(id) ON DELETE SET NULL,
    device_type VARCHAR(20), -- 'mobile', 'tablet', 'kiosk'
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Event types:
-- qr_scan, session_start, selfie_upload, zone_browse, product_view,
-- tryon_start, tryon_complete, tryon_fail, add_to_cart, remove_from_cart,
-- checkout_start, payment_success, payment_fail, pickup_pass_generated,
-- pickup_complete, session_end

CREATE INDEX idx_store_analytics_store ON store_analytics_events(store_id);
CREATE INDEX idx_store_analytics_session ON store_analytics_events(session_id);
CREATE INDEX idx_store_analytics_type ON store_analytics_events(store_id, event_type);
CREATE INDEX idx_store_analytics_created ON store_analytics_events(store_id, created_at DESC);
CREATE INDEX idx_store_analytics_product ON store_analytics_events(product_id) WHERE product_id IS NOT NULL;

-- ==================================
-- STORE COUPONS TABLE
-- ==================================

CREATE TABLE store_coupons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    description TEXT,
    discount_type VARCHAR(20) NOT NULL DEFAULT 'percentage', -- 'percentage', 'fixed'
    discount_value INTEGER NOT NULL CHECK (discount_value > 0), -- percentage (0-100) or paise
    min_order_amount INTEGER DEFAULT 0, -- minimum order in paise
    max_discount INTEGER, -- max discount in paise (for percentage type)
    usage_limit INTEGER, -- total uses allowed
    usage_count INTEGER NOT NULL DEFAULT 0,
    per_user_limit INTEGER DEFAULT 1,
    valid_from TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    valid_until TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(store_id, code)
);

CREATE INDEX idx_store_coupons_store ON store_coupons(store_id);
CREATE INDEX idx_store_coupons_code ON store_coupons(code);
CREATE INDEX idx_store_coupons_active ON store_coupons(store_id, is_active) WHERE is_active = TRUE;

-- ==================================
-- STORE QR CODES TABLE
-- ==================================

CREATE TABLE store_qr_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    qr_type VARCHAR(20) NOT NULL, -- 'store', 'zone', 'product'
    reference_id UUID NOT NULL, -- store_id, zone_id, or product_id
    qr_code_id VARCHAR(50) NOT NULL UNIQUE, -- unique identifier in QR
    deep_link_url TEXT NOT NULL, -- full URL encoded in QR
    short_code VARCHAR(10) UNIQUE, -- short code for easy typing
    scan_count INTEGER NOT NULL DEFAULT 0,
    last_scanned_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_store_qr_codes_store ON store_qr_codes(store_id);
CREATE INDEX idx_store_qr_codes_qr_id ON store_qr_codes(qr_code_id);
CREATE INDEX idx_store_qr_codes_short ON store_qr_codes(short_code) WHERE short_code IS NOT NULL;
CREATE INDEX idx_store_qr_codes_type ON store_qr_codes(store_id, qr_type);

-- ==================================
-- STORE DAILY METRICS (Aggregated)
-- ==================================

CREATE TABLE store_daily_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    metric_date DATE NOT NULL,
    total_sessions INTEGER NOT NULL DEFAULT 0,
    total_qr_scans INTEGER NOT NULL DEFAULT 0,
    total_tryons INTEGER NOT NULL DEFAULT 0,
    successful_tryons INTEGER NOT NULL DEFAULT 0,
    failed_tryons INTEGER NOT NULL DEFAULT 0,
    total_cart_adds INTEGER NOT NULL DEFAULT 0,
    total_orders INTEGER NOT NULL DEFAULT 0,
    total_revenue INTEGER NOT NULL DEFAULT 0, -- in paise
    average_order_value INTEGER, -- in paise
    conversion_rate_browse_to_tryon DECIMAL(5,2),
    conversion_rate_tryon_to_cart DECIMAL(5,2),
    conversion_rate_cart_to_purchase DECIMAL(5,2),
    median_decision_time_seconds INTEGER, -- from session start to order
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(store_id, metric_date)
);

CREATE INDEX idx_store_daily_metrics_store ON store_daily_metrics(store_id);
CREATE INDEX idx_store_daily_metrics_date ON store_daily_metrics(store_id, metric_date DESC);

-- ==================================
-- TRIGGERS FOR UPDATED_AT
-- ==================================

CREATE TRIGGER update_stores_updated_at
    BEFORE UPDATE ON stores
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_store_zones_updated_at
    BEFORE UPDATE ON store_zones
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_store_products_updated_at
    BEFORE UPDATE ON store_products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_store_planogram_updated_at
    BEFORE UPDATE ON store_planogram
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_store_carts_updated_at
    BEFORE UPDATE ON store_carts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_store_cart_items_updated_at
    BEFORE UPDATE ON store_cart_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_store_orders_updated_at
    BEFORE UPDATE ON store_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_store_staff_updated_at
    BEFORE UPDATE ON store_staff
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_store_coupons_updated_at
    BEFORE UPDATE ON store_coupons
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ==================================
-- FUNCTION: Generate Order Number
-- ==================================

CREATE OR REPLACE FUNCTION generate_store_order_number(store_city VARCHAR)
RETURNS VARCHAR AS $$
DECLARE
    city_code VARCHAR(3);
    seq_num INTEGER;
    order_num VARCHAR(20);
BEGIN
    -- Get city code (first 3 letters uppercase)
    city_code := UPPER(LEFT(store_city, 3));

    -- Get next sequence number for today
    SELECT COALESCE(MAX(
        CAST(SUBSTRING(order_number FROM '[0-9]+$') AS INTEGER)
    ), 0) + 1
    INTO seq_num
    FROM store_orders
    WHERE order_number LIKE 'MX-' || city_code || '-%'
    AND DATE(created_at) = CURRENT_DATE;

    -- Format: MX-BLR-YYMMDD-NNNN
    order_num := 'MX-' || city_code || '-' || TO_CHAR(CURRENT_DATE, 'YYMMDD') || '-' || LPAD(seq_num::TEXT, 4, '0');

    RETURN order_num;
END;
$$ LANGUAGE plpgsql;

-- ==================================
-- FUNCTION: Generate Pickup Pass Code
-- ==================================

CREATE OR REPLACE FUNCTION generate_pickup_pass_code()
RETURNS VARCHAR AS $$
DECLARE
    chars VARCHAR := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- no I, O, 0, 1 for clarity
    code VARCHAR := 'MX-';
    i INTEGER;
BEGIN
    FOR i IN 1..6 LOOP
        code := code || SUBSTR(chars, FLOOR(RANDOM() * LENGTH(chars) + 1)::INTEGER, 1);
    END LOOP;
    RETURN code;
END;
$$ LANGUAGE plpgsql;

-- ==================================
-- FUNCTION: Calculate Cart Totals
-- ==================================

CREATE OR REPLACE FUNCTION recalculate_store_cart_totals()
RETURNS TRIGGER AS $$
DECLARE
    cart_subtotal INTEGER;
    cart_discount INTEGER;
    cart_tax INTEGER;
BEGIN
    -- Calculate subtotal from items
    SELECT COALESCE(SUM(total_price), 0)
    INTO cart_subtotal
    FROM store_cart_items
    WHERE cart_id = COALESCE(NEW.cart_id, OLD.cart_id);

    -- Get existing discount (coupon applied separately)
    SELECT discount INTO cart_discount
    FROM store_carts
    WHERE id = COALESCE(NEW.cart_id, OLD.cart_id);

    -- Calculate GST (18% on clothing in India)
    cart_tax := ROUND((cart_subtotal - COALESCE(cart_discount, 0)) * 0.18);

    -- Update cart
    UPDATE store_carts
    SET subtotal = cart_subtotal,
        tax = cart_tax,
        total = cart_subtotal - COALESCE(discount, 0) + cart_tax,
        updated_at = NOW()
    WHERE id = COALESCE(NEW.cart_id, OLD.cart_id);

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER recalculate_cart_on_item_change
    AFTER INSERT OR UPDATE OR DELETE ON store_cart_items
    FOR EACH ROW
    EXECUTE FUNCTION recalculate_store_cart_totals();

-- ==================================
-- COMMENTS
-- ==================================

COMMENT ON TABLE stores IS 'Physical retail stores enrolled in MirrorX Store Mode';
COMMENT ON TABLE store_zones IS 'Zones/sections within a store (e.g., Men, Women, Kids)';
COMMENT ON TABLE store_products IS 'Product catalog for each store with SKU mapping';
COMMENT ON TABLE store_planogram IS 'Physical location mapping for products (aisle/row/shelf)';
COMMENT ON TABLE store_sessions IS 'Shopping sessions started via QR scan';
COMMENT ON TABLE store_carts IS 'Shopping carts for store sessions';
COMMENT ON TABLE store_cart_items IS 'Items added to store carts';
COMMENT ON TABLE store_orders IS 'Completed orders in store mode';
COMMENT ON TABLE store_order_items IS 'Items in completed orders';
COMMENT ON TABLE pickup_passes IS 'QR passes for order pickup';
COMMENT ON TABLE store_staff IS 'Store staff accounts for order management';
COMMENT ON TABLE store_tryon_jobs IS 'Try-on jobs in store context';
COMMENT ON TABLE store_analytics_events IS 'Analytics events for store sessions';
COMMENT ON TABLE store_coupons IS 'Store-specific discount coupons';
COMMENT ON TABLE store_qr_codes IS 'QR codes for stores, zones, and products';
COMMENT ON TABLE store_daily_metrics IS 'Aggregated daily metrics per store';
