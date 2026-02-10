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
-- CATEGORIES TABLE
-- ===========================================
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    name_es VARCHAR(100),
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    image_url VARCHAR(500),
    parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_categories_slug ON categories(slug);
CREATE INDEX idx_categories_parent ON categories(parent_id);

-- ===========================================
-- PRODUCTS TABLE
-- ===========================================
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    name_es VARCHAR(255),
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    description_es TEXT,
    price DECIMAL(10,2) NOT NULL,
    compare_price DECIMAL(10,2),
    cost DECIMAL(10,2),
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    brand VARCHAR(100),
    images JSONB DEFAULT '[]',
    sizes JSONB DEFAULT '[]',
    colors JSONB DEFAULT '[]',
    stock INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    is_featured BOOLEAN DEFAULT FALSE,
    meta_title VARCHAR(255),
    meta_description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_brand ON products(brand);
CREATE INDEX idx_products_active ON products(is_active);
CREATE INDEX idx_products_featured ON products(is_featured);

-- ===========================================
-- PRODUCT VARIANTS TABLE
-- ===========================================
CREATE TABLE product_variants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    sku VARCHAR(50) UNIQUE NOT NULL,
    size VARCHAR(20),
    color VARCHAR(50),
    price DECIMAL(10,2),
    stock INTEGER DEFAULT 0,
    image_url VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_variants_product ON product_variants(product_id);

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
    currency VARCHAR(3) DEFAULT 'ANG',
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
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
    product_name VARCHAR(255) NOT NULL,
    product_sku VARCHAR(50) NOT NULL,
    quantity INTEGER NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    size VARCHAR(20),
    color VARCHAR(50),
    image_url VARCHAR(500)
);

CREATE INDEX idx_order_items_order ON order_items(order_id);

-- ===========================================
-- PAYMENTS TABLE
-- ===========================================
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    method VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'ANG',
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
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
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
-- INITIAL DATA - CATEGORIES
-- ===========================================
INSERT INTO categories (name, name_es, slug, sort_order) VALUES
('Lingerie', 'Lenceria', 'lingerie', 1),
('Beauty', 'Belleza', 'beauty', 2),
('Accessories', 'Accesorios', 'accessories', 3);

-- Sub-categories for Lingerie
INSERT INTO categories (name, name_es, slug, parent_id, sort_order) VALUES
('Bras', 'Brasier', 'bras', (SELECT id FROM categories WHERE slug = 'lingerie'), 1),
('Panties', 'Pantys', 'panties', (SELECT id FROM categories WHERE slug = 'lingerie'), 2),
('Shapewear', 'Fajas', 'shapewear', (SELECT id FROM categories WHERE slug = 'lingerie'), 3);

-- Sub-categories for Beauty
INSERT INTO categories (name, name_es, slug, parent_id, sort_order) VALUES
('Fragrances', 'Colonias', 'fragrances', (SELECT id FROM categories WHERE slug = 'beauty'), 1),
('Creams', 'Cremas', 'creams', (SELECT id FROM categories WHERE slug = 'beauty'), 2),
('Sunscreen', 'Bloqueador', 'sunscreen', (SELECT id FROM categories WHERE slug = 'beauty'), 3),
('Deodorants', 'Desodorantes', 'deodorants', (SELECT id FROM categories WHERE slug = 'beauty'), 4),
('Facial Cleansers', 'Limpieza Facial', 'facial-cleansers', (SELECT id FROM categories WHERE slug = 'beauty'), 5);

-- Sub-categories for Accessories
INSERT INTO categories (name, name_es, slug, parent_id, sort_order) VALUES
('Earrings', 'Aretes', 'earrings', (SELECT id FROM categories WHERE slug = 'accessories'), 1),
('Necklaces', 'Collares', 'necklaces', (SELECT id FROM categories WHERE slug = 'accessories'), 2),
('Bracelets', 'Pulseras', 'bracelets', (SELECT id FROM categories WHERE slug = 'accessories'), 3),
('Rings', 'Anillos', 'rings', (SELECT id FROM categories WHERE slug = 'accessories'), 4),
('Sets', 'Sets', 'jewelry-sets', (SELECT id FROM categories WHERE slug = 'accessories'), 5);

-- ===========================================
-- INITIAL SETTINGS
-- ===========================================
INSERT INTO settings (key, value) VALUES
('store_name', '"Unistyles Curacao"'),
('store_currency', '"ANG"'),
('store_phone', '"+59990000425"'),
('store_email', '"info@unistylescuracao.com"'),
('store_address', '{"city": "Willemstad", "country": "Curacao"}'),
('delivery_fee', '0'),
('free_delivery_threshold', '80'),
('delivery_areas', '["Willemstad", "Otrobanda", "Punda", "Pietermaai", "Scharloo", "Salinja", "Emmastad"]'),
('business_hours', '{"monday": "9:00-18:00", "tuesday": "9:00-18:00", "wednesday": "9:00-18:00", "thursday": "9:00-18:00", "friday": "9:00-18:00", "saturday": "10:00-14:00", "sunday": "closed"}'),
('payment_methods', '["cod", "sentoo", "bank_transfer"]');

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
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_carts_updated_at BEFORE UPDATE ON carts FOR EACH ROW EXECUTE FUNCTION update_updated_at();

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
