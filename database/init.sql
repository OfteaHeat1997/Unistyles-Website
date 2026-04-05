-- ===========================================
-- UNISTYLES E-COMMERCE DATABASE SCHEMA
-- PostgreSQL 16
-- ===========================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===========================================
-- USERS TABLE
-- ===========================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(20),
    is_admin BOOLEAN DEFAULT FALSE,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);

-- ===========================================
-- ADDRESSES TABLE
-- ===========================================
CREATE TABLE addresses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    label VARCHAR(50) DEFAULT 'Home',
    street VARCHAR(255) NOT NULL,
    area VARCHAR(100),
    city VARCHAR(100) DEFAULT 'Willemstad',
    country VARCHAR(50) DEFAULT 'Curacao',
    landmark TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_addresses_user ON addresses(user_id);

-- ===========================================
-- NOTE: Categories and Products are managed by Strapi CMS.
-- Do NOT create those tables here to avoid conflicts.
-- ===========================================

-- ===========================================
-- ORDERS TABLE
-- ===========================================
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number VARCHAR(20) UNIQUE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    guest_email VARCHAR(255),
    guest_phone VARCHAR(20),
    guest_name VARCHAR(200),
    status VARCHAR(50) DEFAULT 'pending',
    payment_method VARCHAR(50) NOT NULL,
    payment_status VARCHAR(50) DEFAULT 'pending',
    subtotal DECIMAL(10,2) NOT NULL,
    delivery_fee DECIMAL(10,2) DEFAULT 0,
    discount DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'XCG',
    shipping_address JSONB NOT NULL,
    delivery_date DATE,
    delivery_time_slot VARCHAR(50),
    notes TEXT,
    admin_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_orders_number ON orders(order_number);
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_payment_status ON orders(payment_status);
CREATE INDEX idx_orders_created ON orders(created_at DESC);

-- ===========================================
-- ORDER ITEMS TABLE
-- ===========================================
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER,
    variant_id INTEGER,
    product_name VARCHAR(255) NOT NULL,
    product_sku VARCHAR(50) NOT NULL,
    quantity INTEGER NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    size VARCHAR(20),
    color VARCHAR(50),
    image_url VARCHAR(500)
);

CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);

-- ===========================================
-- PAYMENTS TABLE
-- ===========================================
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    method VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'XCG',
    transaction_id VARCHAR(255),
    provider_response JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_payments_order ON payments(order_id);
CREATE INDEX idx_payments_transaction ON payments(transaction_id);

-- ===========================================
-- CART TABLE (for logged-in users)
-- ===========================================
CREATE TABLE carts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    items JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_carts_user ON carts(user_id);

-- ===========================================
-- REVIEWS TABLE
-- ===========================================
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    title VARCHAR(200),
    comment TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    is_approved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_reviews_product ON reviews(product_id);
CREATE INDEX idx_reviews_user ON reviews(user_id);

-- ===========================================
-- NEWSLETTER SUBSCRIBERS
-- ===========================================
CREATE TABLE newsletter_subscribers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    subscribed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    unsubscribed_at TIMESTAMP WITH TIME ZONE
);

-- ===========================================
-- SETTINGS TABLE
-- ===========================================
CREATE TABLE settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===========================================
-- NOTE: Category seed data is managed via Strapi CMS.
-- ===========================================

-- ===========================================
-- ADMIN ACCOUNT
-- ===========================================
INSERT INTO users (email, password_hash, first_name, last_name, is_admin, is_verified) VALUES
('admin@unistylescuracao.com', '$2a$12$X1HG4kDGkCFrVOjEAv0lyuqNZo8HhinhkU/eXKHw.jIpu9ZoIKC/a', 'Admin', 'Unistyles', TRUE, TRUE);

-- ===========================================
-- INITIAL SETTINGS
-- ===========================================
INSERT INTO settings (key, value) VALUES
('store_name', '"Unistyles Curacao"'),
('store_currency', '"XCG"'),
('store_phone', '"+59996736285"'),
('store_email', '"info@unistylescuracao.com"'),
('store_address', '{"city": "Willemstad", "country": "Curacao"}'),
('delivery_fee', '0'),
('free_delivery_threshold', '80'),
('delivery_areas', '["Willemstad", "Otrobanda", "Punda", "Pietermaai", "Scharloo", "Salinja", "Emmastad"]'),
('business_hours', '{"monday": "9:00-18:00", "tuesday": "9:00-18:00", "wednesday": "9:00-18:00", "thursday": "9:00-18:00", "friday": "9:00-18:00", "saturday": "10:00-14:00", "sunday": "closed"}'),
('payment_methods', '["cod", "sentoo", "bank_transfer"]');

-- ===========================================
-- COUPONS TABLE
-- ===========================================
CREATE TABLE coupons (
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

CREATE INDEX idx_coupons_code ON coupons(UPPER(code));

-- ===========================================
-- PRODUCT VARIANTS TABLE
-- ===========================================
CREATE TABLE product_variants (
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

CREATE INDEX idx_variants_product ON product_variants(product_id);

-- ===========================================
-- WHATSAPP MESSAGES TABLE
-- ===========================================
CREATE TABLE whatsapp_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    direction VARCHAR(10) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    phone VARCHAR(20) NOT NULL,
    wamid VARCHAR(255),
    message_type VARCHAR(20) DEFAULT 'text',
    content TEXT,
    template_name VARCHAR(100),
    status VARCHAR(20) DEFAULT 'sent',
    status_timestamp TIMESTAMP WITH TIME ZONE,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_whatsapp_messages_phone ON whatsapp_messages(phone);
CREATE INDEX idx_whatsapp_messages_wamid ON whatsapp_messages(wamid);
CREATE INDEX idx_whatsapp_messages_order ON whatsapp_messages(order_id);
CREATE INDEX idx_whatsapp_messages_created ON whatsapp_messages(created_at DESC);

-- ===========================================
-- FUNCTION: Update timestamp
-- ===========================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_carts_updated_at BEFORE UPDATE ON carts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_product_variants_updated_at BEFORE UPDATE ON product_variants FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ===========================================
-- FUNCTION: Generate order number
-- ===========================================
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
    NEW.order_number = 'UNI-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_order_number BEFORE INSERT ON orders FOR EACH ROW EXECUTE FUNCTION generate_order_number();

-- ===========================================
-- SEED COUPONS
-- ===========================================
INSERT INTO coupons (code, description, discount_type, discount_value, min_order_amount, valid_until) VALUES
('WELCOME10', '10% off your first order', 'percentage', 10, 30, NOW() + INTERVAL '1 year'),
('BEAUTY20', 'XCG 20 off beauty products', 'fixed', 20, 80, NOW() + INTERVAL '6 months'),
('FREESHIP', 'Free standard delivery', 'fixed', 10, 0, NOW() + INTERVAL '3 months');
