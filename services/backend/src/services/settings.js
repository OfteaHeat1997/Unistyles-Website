// ===========================================
// OPERATIONAL SETTINGS
// Reads the `settings` table (JSONB values) with code defaults.
// Defaults follow the owner decisions in PM-DEC-002 v1.1 (28 Oct 2026); keys listed in
// pending_approval are still open. The owner edits them in Admin → Settings.
// ===========================================

const db = require('../utils/db');

const DEFAULTS = {
    store_currency: 'XCG',
    free_delivery_threshold: 100,       // DEC-001 (approved)
    free_delivery_rule: 'gte',          // 'gte' => subtotal >= threshold, 'gt' => subtotal > threshold
    pickup_enabled: false,              // DEC-004: hidden until address/hours are authorised
    delivery_enabled: true,
    delivery_cutoff_hour: 14,           // orders after this local hour cannot get next-day delivery
    booking_days_ahead: 7,
    payment_expiry_minutes: 30,
    bank_transfer_expiry_hours: 48,
    payment_methods: ['cod', 'bank_transfer'],   // DEC-013 (proposed): Sentoo hidden until validated
    support_whatsapp: '59996736285',
    bank_details: {
        bankName: 'MCB Bank Curacao',
        accountName: 'Unistyles Curacao',
        accountNumber: 'PENDING',
        swift: 'MCBKCWCU'
    },
    return_policy: {
        // DEC-003 approved; DEC-005 (bras, shapewear, perfume, beauty) still open → no text
        panties: 'For hygiene reasons panties cannot be exchanged voluntarily. Defective, damaged or wrongly delivered items are always accepted — contact us on WhatsApp.',
        default: null
    },
    pending_approval: []
};

// Keys an admin may change through the API (anything else is rejected).
const EDITABLE_KEYS = Object.keys(DEFAULTS);

/**
 * Load all settings, merged over DEFAULTS.
 * @param {object} [client] - optional pg client (to read inside a transaction)
 */
async function getSettings(client) {
    const runner = client || db;
    const result = await runner.query('SELECT key, value FROM settings');
    const settings = { ...DEFAULTS };
    for (const row of result.rows) {
        settings[row.key] = row.value;
    }
    // JSONB numbers can arrive as strings from older seeds ('80')
    settings.free_delivery_threshold = Number(settings.free_delivery_threshold);
    settings.delivery_cutoff_hour = Number(settings.delivery_cutoff_hour);
    settings.booking_days_ahead = Number(settings.booking_days_ahead);
    settings.payment_expiry_minutes = Number(settings.payment_expiry_minutes);
    settings.bank_transfer_expiry_hours = Number(settings.bank_transfer_expiry_hours);
    return settings;
}

async function updateSettings(changes) {
    const keys = Object.keys(changes).filter(k => EDITABLE_KEYS.includes(k));
    for (const key of keys) {
        await db.query(
            `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2::jsonb, NOW())
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
            [key, JSON.stringify(changes[key])]
        );
    }
    return keys;
}

module.exports = { DEFAULTS, EDITABLE_KEYS, getSettings, updateSettings };
