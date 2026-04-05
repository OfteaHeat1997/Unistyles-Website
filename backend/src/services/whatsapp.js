// ===========================================
// WHATSAPP CLOUD API SERVICE
// Meta Graph API v21.0
// ===========================================

const axios = require('axios');
const crypto = require('crypto');

const GRAPH_API_URL = 'https://graph.facebook.com/v21.0';

const config = {
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN,
    appSecret: process.env.WHATSAPP_APP_SECRET
};

/**
 * Check if WhatsApp Cloud API is configured
 */
function isConfigured() {
    return !!(config.accessToken && config.phoneNumberId);
}

/**
 * Get axios instance for Graph API
 */
function getClient() {
    return axios.create({
        baseURL: `${GRAPH_API_URL}/${config.phoneNumberId}`,
        headers: {
            'Authorization': `Bearer ${config.accessToken}`,
            'Content-Type': 'application/json'
        },
        timeout: 10000
    });
}

/**
 * Log message to whatsapp_messages table
 */
async function logMessage({ direction, phone, wamid, messageType, content, templateName, status, orderId, metadata }) {
    try {
        const db = require('../utils/db');
        await db.query(`
            INSERT INTO whatsapp_messages (direction, phone, wamid, message_type, content, template_name, status, order_id, metadata)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [direction, phone, wamid || null, messageType || 'text', content || null, templateName || null, status || 'sent', orderId || null, metadata ? JSON.stringify(metadata) : null]);
    } catch (err) {
        console.error('[WhatsApp] Failed to log message:', err.message);
    }
}

/**
 * Normalize Curacao phone number to E.164 format
 * Handles: +5999XXXXXXX, 5999XXXXXXX, 09XXXXXXX, 9XXXXXXX, 7-digit local
 */
function normalizePhone(phone) {
    if (!phone) return null;
    let cleaned = phone.replace(/[\s\-\(\)]/g, '');

    // Already in full international format
    if (/^\+5999\d{7}$/.test(cleaned)) return cleaned;
    if (/^5999\d{7}$/.test(cleaned)) return '+' + cleaned;

    // Local format with 09 prefix
    if (/^09\d{7}$/.test(cleaned)) return '+5999' + cleaned.slice(2);

    // Local format with 9 prefix
    if (/^9\d{7}$/.test(cleaned)) return '+5999' + cleaned.slice(1);

    // 7-digit local number
    if (/^\d{7}$/.test(cleaned)) return '+5999' + cleaned;

    // Other international formats — return as-is with + prefix
    if (/^\+\d{10,15}$/.test(cleaned)) return cleaned;
    if (/^\d{10,15}$/.test(cleaned)) return '+' + cleaned;

    return cleaned;
}

/**
 * Send a text message
 */
async function sendTextMessage(to, text) {
    if (!isConfigured()) {
        console.log('[WhatsApp] API not configured, skipping sendTextMessage');
        return null;
    }

    const phone = normalizePhone(to);
    if (!phone) return null;

    try {
        const client = getClient();
        const response = await client.post('/messages', {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: phone.replace('+', ''),
            type: 'text',
            text: { preview_url: false, body: text }
        });

        const wamid = response.data?.messages?.[0]?.id;
        await logMessage({ direction: 'outbound', phone, wamid, messageType: 'text', content: text, status: 'sent' });
        console.log(`[WhatsApp] Text sent to ${phone}, wamid: ${wamid}`);
        return { wamid, phone };
    } catch (err) {
        console.error('[WhatsApp] sendTextMessage error:', err.response?.data || err.message);
        return null;
    }
}

/**
 * Send an interactive message (buttons or list)
 */
async function sendInteractiveMessage(to, interactive) {
    if (!isConfigured()) {
        console.log('[WhatsApp] API not configured, skipping sendInteractiveMessage');
        return null;
    }

    const phone = normalizePhone(to);
    if (!phone) return null;

    try {
        const client = getClient();
        const response = await client.post('/messages', {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: phone.replace('+', ''),
            type: 'interactive',
            interactive
        });

        const wamid = response.data?.messages?.[0]?.id;
        await logMessage({ direction: 'outbound', phone, wamid, messageType: 'interactive', content: JSON.stringify(interactive), status: 'sent' });
        console.log(`[WhatsApp] Interactive sent to ${phone}, wamid: ${wamid}`);
        return { wamid, phone };
    } catch (err) {
        console.error('[WhatsApp] sendInteractiveMessage error:', err.response?.data || err.message);
        return null;
    }
}

/**
 * Send a template message (pre-approved by Meta)
 */
async function sendTemplateMessage(to, templateName, components) {
    if (!isConfigured()) {
        console.log('[WhatsApp] API not configured, skipping sendTemplateMessage');
        return null;
    }

    const phone = normalizePhone(to);
    if (!phone) return null;

    try {
        const client = getClient();
        const payload = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: phone.replace('+', ''),
            type: 'template',
            template: {
                name: templateName,
                language: { code: 'en' },
                ...(components ? { components } : {})
            }
        };

        const response = await client.post('/messages', payload);
        const wamid = response.data?.messages?.[0]?.id;
        await logMessage({ direction: 'outbound', phone, wamid, messageType: 'template', templateName, status: 'sent' });
        console.log(`[WhatsApp] Template '${templateName}' sent to ${phone}, wamid: ${wamid}`);
        return { wamid, phone };
    } catch (err) {
        console.error('[WhatsApp] sendTemplateMessage error:', err.response?.data || err.message);
        return null;
    }
}

/**
 * Send a media message (image, video, document)
 */
async function sendMediaMessage(to, type, url, caption) {
    if (!isConfigured()) {
        console.log('[WhatsApp] API not configured, skipping sendMediaMessage');
        return null;
    }

    const phone = normalizePhone(to);
    if (!phone) return null;

    try {
        const client = getClient();
        const mediaPayload = { link: url };
        if (caption) mediaPayload.caption = caption;

        const response = await client.post('/messages', {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: phone.replace('+', ''),
            type,
            [type]: mediaPayload
        });

        const wamid = response.data?.messages?.[0]?.id;
        await logMessage({ direction: 'outbound', phone, wamid, messageType: type, content: caption || url, status: 'sent' });
        console.log(`[WhatsApp] ${type} sent to ${phone}, wamid: ${wamid}`);
        return { wamid, phone };
    } catch (err) {
        console.error('[WhatsApp] sendMediaMessage error:', err.response?.data || err.message);
        return null;
    }
}

/**
 * Verify webhook GET request (Meta challenge/response)
 */
function verifyWebhook(req) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === config.verifyToken) {
        return { valid: true, challenge };
    }
    return { valid: false };
}

/**
 * Verify webhook POST signature (HMAC-SHA256)
 */
function verifySignature(req) {
    if (!config.appSecret) return true; // Skip if not configured

    const signature = req.headers['x-hub-signature-256'];
    if (!signature) return false;

    const rawBody = req.rawBody;
    if (!rawBody) return false;

    const expectedSignature = 'sha256=' + crypto
        .createHmac('sha256', config.appSecret)
        .update(rawBody)
        .digest('hex');

    return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
    );
}

/**
 * Parse webhook payload — extract messages and status updates
 */
function parseWebhookPayload(body) {
    const result = { messages: [], statuses: [] };

    if (!body?.entry) return result;

    for (const entry of body.entry) {
        for (const change of entry.changes || []) {
            if (change.field !== 'messages') continue;
            const value = change.value;
            if (!value) continue;

            // Extract messages
            if (value.messages) {
                for (const msg of value.messages) {
                    result.messages.push({
                        from: msg.from,
                        wamid: msg.id,
                        timestamp: msg.timestamp,
                        type: msg.type,
                        text: msg.text?.body || null,
                        interactive: msg.interactive || null,
                        button: msg.button || null,
                        context: msg.context || null,
                        name: value.contacts?.[0]?.profile?.name || null
                    });
                }
            }

            // Extract status updates
            if (value.statuses) {
                for (const status of value.statuses) {
                    result.statuses.push({
                        wamid: status.id,
                        recipientId: status.recipient_id,
                        status: status.status,
                        timestamp: status.timestamp
                    });
                }
            }
        }
    }

    return result;
}

module.exports = {
    isConfigured,
    sendTextMessage,
    sendInteractiveMessage,
    sendTemplateMessage,
    sendMediaMessage,
    verifyWebhook,
    verifySignature,
    parseWebhookPayload,
    normalizePhone,
    logMessage
};
