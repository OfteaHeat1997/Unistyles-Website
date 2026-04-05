-- ===========================================
-- Migration 001: Add coupons and product_variants tables
-- ===========================================

-- Coupons table
CREATE TABLE IF NOT EXISTS coupons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
    discount_value DECIMAL(10,2) NOT NULL,
    min_order_amount DECIMAL(10,2),
    max_discount DECIMAL(10,2),
    max_uses INTEGER,
    times_used INTEGER DEFAULT 0,
    valid_from TIMESTAMP WITH TIME ZONE,
    valid_until TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(UPPER(code));

-- Product variants table
CREATE TABLE IF NOT EXISTS product_variants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id INTEGER NOT NULL,
    size VARCHAR(20),
    color VARCHAR(50),
    sku VARCHAR(50),
    stock_quantity INTEGER DEFAULT 0,
    price_adjustment DECIMAL(10,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id);

-- Add trigger for updated_at on product_variants
CREATE TRIGGER update_product_variants_updated_at
    BEFORE UPDATE ON product_variants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Seed sample coupons
INSERT INTO coupons (code, description, discount_type, discount_value, min_order_amount, valid_until) VALUES
('WELCOME10', '10% off your first order', 'percentage', 10, 30, NOW() + INTERVAL '1 year'),
('BEAUTY20', 'XCG 20 off beauty products', 'fixed', 20, 80, NOW() + INTERVAL '6 months'),
('FREESHIP', '100% off delivery (apply to delivery fee separately)', 'fixed', 10, 0, NOW() + INTERVAL '3 months')
ON CONFLICT (code) DO NOTHING;
