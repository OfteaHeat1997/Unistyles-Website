// ===========================================
// BACKEND CONSTANTS
// Single source of truth for magic numbers and enums
// ===========================================

// Cart
const CART_TTL = 60 * 60 * 24 * 7; // 7 days in seconds
const MAX_CART_ITEMS = 50;
const MAX_ITEM_QUANTITY = 99;

// Pagination defaults
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// Order statuses
const ORDER_STATUS = {
    PENDING: 'pending',
    CONFIRMED: 'confirmed',
    PROCESSING: 'processing',
    SHIPPED: 'shipped',
    DELIVERED: 'delivered',
    CANCELLED: 'cancelled',
    AWAITING_PAYMENT: 'awaiting_payment'
};

// Payment statuses
const PAYMENT_STATUS = {
    PENDING: 'pending',
    PAID: 'paid',
    FAILED: 'failed',
    REFUNDED: 'refunded',
    PENDING_DELIVERY: 'pending_delivery'
};

// Payment methods
const PAYMENT_METHOD = {
    COD: 'cod',
    SENTOO: 'sentoo',
    BANK_TRANSFER: 'bank_transfer',
    CARD: 'card',
    WHATSAPP: 'whatsapp'
};

// Cancellable order statuses
const CANCELLABLE_STATUSES = [
    ORDER_STATUS.PENDING,
    ORDER_STATUS.CONFIRMED,
    ORDER_STATUS.AWAITING_PAYMENT
];

// Token blacklist TTL prefix
const BLACKLIST_PREFIX = 'blacklist:';

// WhatsApp conversation TTL
const WHATSAPP_CONVO_TTL = 60 * 60; // 1 hour

// Sentoo status cache TTL
const SENTOO_CACHE_TTL = 30000; // 30 seconds in ms

module.exports = {
    CART_TTL,
    MAX_CART_ITEMS,
    MAX_ITEM_QUANTITY,
    DEFAULT_PAGE,
    DEFAULT_LIMIT,
    MAX_LIMIT,
    ORDER_STATUS,
    PAYMENT_STATUS,
    PAYMENT_METHOD,
    CANCELLABLE_STATUSES,
    BLACKLIST_PREFIX,
    WHATSAPP_CONVO_TTL,
    SENTOO_CACHE_TTL
};
