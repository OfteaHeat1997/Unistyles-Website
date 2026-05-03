// ===========================================
// WHATSAPP WEBHOOK + CHATBOT ROUTES
// ===========================================

const express = require('express');
const router = express.Router();
const whatsapp = require('../services/whatsapp');
const db = require('../utils/db');
const redis = require('../utils/redis');

const SITE_URL = process.env.SITE_URL || 'https://unistylescuracao.com';

// Order number pattern: UNI-YYMMDD-XXXX
const ORDER_NUMBER_REGEX = /UNI-\d{6}-\d{4}/i;

// Conversation state TTL: 1 hour (auto-expires stale conversations)
const CONVO_TTL = 60 * 60;

// Redis-backed conversation state (survives server restarts)
async function getConversationState(phone) {
    try {
        const state = await redis.get(`wa_convo:${phone}`);
        return state ? JSON.parse(state) : null;
    } catch {
        return null;
    }
}

async function setConversationState(phone, state) {
    try {
        await redis.setex(`wa_convo:${phone}`, CONVO_TTL, JSON.stringify(state));
    } catch (err) {
        console.error('Failed to save conversation state:', err.message);
    }
}

async function clearConversationState(phone) {
    try {
        await redis.del(`wa_convo:${phone}`);
    } catch { /* ignore */ }
}

// ===========================================
// GET /api/whatsapp/webhook — Meta verification
// ===========================================
router.get('/webhook', (req, res) => {
    const { valid, challenge } = whatsapp.verifyWebhook(req);
    if (valid) {
        console.log('[WhatsApp Webhook] Verified successfully');
        return res.status(200).send(challenge);
    }
    console.warn('[WhatsApp Webhook] Verification failed');
    return res.status(403).send('Forbidden');
});

// ===========================================
// POST /api/whatsapp/webhook — Receive messages
// ===========================================
router.post('/webhook', async (req, res) => {
    // Respond 200 immediately (Meta requires <5s response)
    res.status(200).send('EVENT_RECEIVED');

    // Verify signature
    if (!whatsapp.verifySignature(req)) {
        console.warn('[WhatsApp Webhook] Invalid signature');
        return;
    }

    try {
        const { messages, statuses } = whatsapp.parseWebhookPayload(req.body);

        // Handle status updates
        for (const status of statuses) {
            await handleStatusUpdate(status);
        }

        // Handle incoming messages
        for (const message of messages) {
            await handleIncomingMessage(message);
        }
    } catch (err) {
        console.error('[WhatsApp Webhook] Error processing:', err);
    }
});

/**
 * Handle delivery status updates from Meta
 */
async function handleStatusUpdate(status) {
    try {
        const statusMap = { sent: 'sent', delivered: 'delivered', read: 'read', failed: 'failed' };
        const newStatus = statusMap[status.status];
        if (!newStatus || !status.wamid) return;

        await db.query(
            `UPDATE whatsapp_messages SET status = $1, status_timestamp = to_timestamp($2) WHERE wamid = $3`,
            [newStatus, parseInt(status.timestamp), status.wamid]
        );
    } catch (err) {
        console.error('[WhatsApp] Status update error:', err.message);
    }
}

/**
 * Handle incoming message — chatbot logic
 */
async function handleIncomingMessage(message) {
    const { from, wamid, type, text, interactive, button, name } = message;

    // Log inbound message
    await whatsapp.logMessage({
        direction: 'inbound',
        phone: from,
        wamid,
        messageType: type,
        content: text || JSON.stringify(interactive || button || {}),
        metadata: name ? { contactName: name } : null
    });

    // Determine user intent
    let userText = '';
    let buttonId = null;

    if (type === 'text' && text) {
        userText = text.toLowerCase().trim();
    } else if (type === 'interactive') {
        if (interactive?.button_reply) {
            buttonId = interactive.button_reply.id;
            userText = interactive.button_reply.title?.toLowerCase() || '';
        } else if (interactive?.list_reply) {
            buttonId = interactive.list_reply.id;
            userText = interactive.list_reply.title?.toLowerCase() || '';
        }
    } else if (type === 'button' && button) {
        userText = button.text?.toLowerCase() || '';
    } else {
        // Unsupported message type — send help
        await sendHelpMenu(from);
        return;
    }

    // Route to appropriate handler
    const state = await getConversationState(from);

    // Check for button replies first
    if (buttonId) {
        return await handleButtonReply(from, buttonId);
    }

    // Check if user is providing an order number (after being asked)
    if (state === 'awaiting_order_number') {
        await clearConversationState(from);
        const orderMatch = userText.match(ORDER_NUMBER_REGEX);
        if (orderMatch) {
            return await lookupOrder(from, orderMatch[0].toUpperCase());
        }
        // Try the whole text as order number
        if (/^uni-/i.test(userText)) {
            return await lookupOrder(from, userText.toUpperCase());
        }
        await whatsapp.sendTextMessage(from, '❌ E number di order no ta balido. Por fabor manda e number den formato: UNI-XXXXXX-XXXX');
        return;
    }

    // Check for order number in message
    const orderMatch = userText.match(ORDER_NUMBER_REGEX);
    if (orderMatch) {
        return await lookupOrder(from, orderMatch[0].toUpperCase());
    }

    // Greeting patterns
    if (/^(bon\s*(dia|tardi|nochi)|hola|hello|hi|hey|buenos?\s*dias?|good\s*(morning|afternoon|evening)|saludu)/.test(userText)) {
        return await sendWelcomeMenu(from, name);
    }

    // Status / order inquiry
    if (/\b(status|order|pedido|besteling)\b/.test(userText)) {
        await setConversationState(from, 'awaiting_order_number');
        return await whatsapp.sendTextMessage(from, '📦 Pa chèk bo status di order, manda bo number di order.\n\nEhempel: *UNI-260115-1234*');
    }

    // Catalog / products
    if (/\b(catalog|katalogo|product|produkto|tienda|shop|kòmpra)\b/.test(userText)) {
        return await sendCategoryList(from);
    }

    // Help
    if (/\b(help|yudansa|ayuda|informashon|pregunta)\b/.test(userText)) {
        return await sendHelpMenu(from);
    }

    // Price / cost inquiry
    if (/\b(preis|prijs|price|kòst|kosta|kuantu)\b/.test(userText)) {
        return await whatsapp.sendTextMessage(from, `💰 Pa mira nos preisnan, bishitá nos katalogo online:\n${SITE_URL}\n\nÒf manda nos e nomber di e produkto i nos lo duna bo e preis.`);
    }

    // Thank you
    if (/\b(danki|gracias|thanks?|thank you|dank)\b/.test(userText)) {
        return await whatsapp.sendTextMessage(from, '🙏 Ku plaser! Si bo tin mas pregunta, nos ta aki pa yudabo.');
    }

    // Default — send welcome menu for unrecognized messages
    return await sendWelcomeMenu(from, name);
}

/**
 * Handle button reply callbacks
 */
async function handleButtonReply(from, buttonId) {
    switch (buttonId) {
        case 'btn_catalog':
            return await sendCategoryList(from);
        case 'btn_order_status':
            await setConversationState(from, 'awaiting_order_number');
            return await whatsapp.sendTextMessage(from, '📦 Pa chèk bo status di order, manda bo number di order.\n\nEhempel: *UNI-260115-1234*');
        case 'btn_help':
            return await sendHelpMenu(from);
        // Category selections
        case 'cat_perfume':
            return await whatsapp.sendTextMessage(from, `🌸 *Pèrfùm*\nMira nos kolekshon kompletu di pèrfùm:\n${SITE_URL}/perfume`);
        case 'cat_cremas':
            return await whatsapp.sendTextMessage(from, `✨ *Krema*\nMira nos kolekshon di krema:\n${SITE_URL}/cremas`);
        case 'cat_bloqueador':
            return await whatsapp.sendTextMessage(from, `☀️ *Blokeador*\nMira nos protekshon solar:\n${SITE_URL}/bloqueador`);
        case 'cat_desodorantes':
            return await whatsapp.sendTextMessage(from, `🧴 *Kuido Personal*\nMira nos produktonan di kuido personal:\n${SITE_URL}/desodorantes`);
        case 'cat_accesorios':
            return await whatsapp.sendTextMessage(from, `💎 *Aksesorio*\nMira nos aksesorio i hòyas:\n${SITE_URL}/accesorios`);
        case 'cat_lingerie':
            return await whatsapp.sendTextMessage(from, `👙 *Lingerie Leonisa*\nMira nos kolekshon Leonisa:\n${SITE_URL}/bras`);
        default:
            return await sendWelcomeMenu(from);
    }
}

/**
 * Send welcome menu with buttons
 */
async function sendWelcomeMenu(from, name) {
    const greeting = name ? `Bon bini ${name}!` : 'Bon bini!';
    return await whatsapp.sendInteractiveMessage(from, {
        type: 'button',
        body: {
            text: `🌟 *Unistyles Curacao*\n\n${greeting} Kon nos por yudabo?`
        },
        action: {
            buttons: [
                { type: 'reply', reply: { id: 'btn_catalog', title: '📋 Katalogo' } },
                { type: 'reply', reply: { id: 'btn_order_status', title: '📦 Status di order' } },
                { type: 'reply', reply: { id: 'btn_help', title: '💬 Yudansa' } }
            ]
        }
    });
}

/**
 * Send category list menu
 */
async function sendCategoryList(from) {
    return await whatsapp.sendInteractiveMessage(from, {
        type: 'list',
        body: {
            text: '📋 *Nos Kategorias*\n\nSkohe un kategoria pa mira nos produktonan:'
        },
        action: {
            button: 'Mira kategorias',
            sections: [
                {
                    title: 'Kategorias',
                    rows: [
                        { id: 'cat_perfume', title: '🌸 Pèrfùm', description: 'Kolekshon kompletu di fragransia' },
                        { id: 'cat_lingerie', title: '👙 Lingerie Leonisa', description: 'BH, panty i shapewear' },
                        { id: 'cat_cremas', title: '✨ Krema', description: 'Krema pa kara i kurpa' },
                        { id: 'cat_bloqueador', title: '☀️ Blokeador', description: 'Protekshon solar' },
                        { id: 'cat_desodorantes', title: '🧴 Kuido Personal', description: 'Desodorante i talko' },
                        { id: 'cat_accesorios', title: '💎 Aksesorio', description: 'Hòyas i aksesorio' }
                    ]
                }
            ]
        }
    });
}

/**
 * Send help menu with business hours
 */
async function sendHelpMenu(from) {
    return await whatsapp.sendTextMessage(from,
        `💬 *Yudansa - Unistyles Curacao*\n\n` +
        `📞 *Telefòn:* +5999 673 6285\n` +
        `📧 *Email:* info@unistylescuracao.com\n` +
        `🌐 *Website:* ${SITE_URL}\n\n` +
        `🕐 *Orario di atencion:*\n` +
        `Dialuna - Diabièrnè: 9:00 - 18:00\n` +
        `Diasabra: 10:00 - 14:00\n` +
        `Diadumingu: Será\n\n` +
        `Pa bo order: manda e number di order (UNI-XXXXXX-XXXX)\n` +
        `Pa nos katalogo: manda "katalogo"\n\n` +
        `Un representante lo respondebo durante orario di trabou. 🙏`
    );
}

/**
 * Look up order by number and reply with status
 */
async function lookupOrder(from, orderNumber) {
    try {
        const result = await db.query(
            `SELECT order_number, status, payment_method, payment_status, total, delivery_date, delivery_time_slot, created_at
             FROM orders WHERE order_number = $1`,
            [orderNumber]
        );

        if (result.rows.length === 0) {
            return await whatsapp.sendTextMessage(from,
                `❌ Nos no por haña order *${orderNumber}*.\n\nPor fabor verifiká e number i purba atrobe, òf kontaktanos pa yudansa.`
            );
        }

        const order = result.rows[0];
        const statusLabels = {
            pending: '⏳ Pendiente',
            confirmed: '✅ Konfirmá',
            processing: '📦 Preparando',
            shipped: '🚚 Na kaminda',
            delivered: '🎉 Entregá',
            cancelled: '❌ Kanselá'
        };

        const statusLabel = statusLabels[order.status] || order.status;
        const date = new Date(order.created_at).toLocaleDateString('nl-CW', { day: '2-digit', month: '2-digit', year: 'numeric' });

        let message = `📋 *Order ${order.order_number}*\n\n` +
            `📌 *Status:* ${statusLabel}\n` +
            `💰 *Total:* XCG ${parseFloat(order.total).toFixed(2)}\n` +
            `💳 *Pago:* ${order.payment_method}\n` +
            `📅 *Fecha:* ${date}`;

        if (order.delivery_date) {
            message += `\n🚚 *Entrega:* ${order.delivery_date}`;
        }
        if (order.delivery_time_slot) {
            message += ` (${order.delivery_time_slot})`;
        }

        message += `\n\nSi bo tin pregunta tokante bo order, nos ta aki pa yudabo! 💬`;

        return await whatsapp.sendTextMessage(from, message);
    } catch (err) {
        console.error('[WhatsApp] Order lookup error:', err);
        return await whatsapp.sendTextMessage(from, '⚠️ Tin un eror buskando bo order. Por fabor purba mas laat.');
    }
}

module.exports = router;
