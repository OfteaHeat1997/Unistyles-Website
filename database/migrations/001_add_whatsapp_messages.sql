-- ===========================================
-- Migration 001: Add WhatsApp Messages Table
-- For existing deployments that already have the base schema
-- ===========================================

CREATE TABLE IF NOT EXISTS whatsapp_messages (
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

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_phone ON whatsapp_messages(phone);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_wamid ON whatsapp_messages(wamid);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_order ON whatsapp_messages(order_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_created ON whatsapp_messages(created_at DESC);
