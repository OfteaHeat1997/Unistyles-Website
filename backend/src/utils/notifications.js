// ===========================================
// NOTIFICATION UTILITIES
// With retry logic for reliable delivery
// ===========================================

const nodemailer = require('nodemailer');
const whatsapp = require('../services/whatsapp');

/**
 * Retry a function with exponential backoff.
 * Used for email/WhatsApp notifications that may fail transiently.
 */
async function withRetry(fn, label, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (err) {
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
            console.warn(`[${label}] Attempt ${attempt}/${maxRetries} failed: ${err.message}`);
            if (attempt === maxRetries) {
                console.error(`[${label}] All ${maxRetries} attempts failed. Giving up.`);
                throw err;
            }
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

// Email transporter
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
    }
});

/**
 * Send order confirmation email
 */
async function sendOrderConfirmation(order, items) {
    const email = order.user_id ? null : order.guest_email;

    if (!email && !order.user_id) {
        console.log('No email address for order confirmation');
        return;
    }

    // Get user email if logged in
    let toEmail = email;
    if (order.user_id && !toEmail) {
        const db = require('./db');
        const result = await db.query('SELECT email FROM users WHERE id = $1', [order.user_id]);
        toEmail = result.rows[0]?.email;
    }

    if (!toEmail) return;

    const itemsList = items.map(item =>
        `- ${item.productName} (${item.size || 'N/A'}, ${item.color || 'N/A'}) x${item.quantity} - XCG ${(item.price * item.quantity).toFixed(2)}`
    ).join('\n');

    const mailOptions = {
        from: process.env.EMAIL_FROM || 'Unistyles <info@unistylescuracao.com>',
        to: toEmail,
        subject: `Order Confirmed - ${order.order_number}`,
        text: `
Thank you for your order!

Order Number: ${order.order_number}
Status: ${order.status}
Payment Method: ${order.payment_method}

Items:
${itemsList}

Subtotal: XCG ${parseFloat(order.subtotal).toFixed(2)}
Delivery: XCG ${parseFloat(order.delivery_fee).toFixed(2)}
Total: XCG ${parseFloat(order.total).toFixed(2)}

Delivery Address:
${JSON.parse(order.shipping_address).name}
${JSON.parse(order.shipping_address).street}
${JSON.parse(order.shipping_address).area || ''}
${JSON.parse(order.shipping_address).city}

${order.delivery_date ? `Delivery Date: ${order.delivery_date}` : ''}
${order.delivery_time_slot ? `Time Slot: ${order.delivery_time_slot}` : ''}

If you have any questions, contact us via WhatsApp: ${process.env.WHATSAPP_NUMBER}

Thank you for shopping with Unistyles!
        `,
        html: `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .header { background: #1A1A1A; color: #C5A55A; padding: 20px; text-align: center; }
        .content { padding: 30px; }
        .order-box { background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .total { font-size: 24px; font-weight: bold; color: #1A1A1A; }
        .whatsapp { background: #25D366; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>UNISTYLES</h1>
        <p>Order Confirmation</p>
    </div>
    <div class="content">
        <h2>Thank you for your order!</h2>
        <div class="order-box">
            <p><strong>Order Number:</strong> ${order.order_number}</p>
            <p><strong>Payment Method:</strong> ${order.payment_method}</p>
            <hr>
            <p><strong>Items:</strong></p>
            ${items.map(item => `
                <p>- ${item.productName} (${item.size || 'N/A'}, ${item.color || 'N/A'}) x${item.quantity} - XCG ${(item.price * item.quantity).toFixed(2)}</p>
            `).join('')}
            <hr>
            <p>Subtotal: XCG ${parseFloat(order.subtotal).toFixed(2)}</p>
            <p>Delivery: XCG ${parseFloat(order.delivery_fee).toFixed(2)}</p>
            <p class="total">Total: XCG ${parseFloat(order.total).toFixed(2)}</p>
        </div>
        <a href="https://wa.me/${process.env.WHATSAPP_NUMBER?.replace('+', '')}" class="whatsapp">Contact us on WhatsApp</a>
    </div>
</body>
</html>
        `
    };

    try {
        await withRetry(
            () => transporter.sendMail(mailOptions),
            `Email to ${toEmail}`
        );
        console.log(`Order confirmation sent to ${toEmail}`);
    } catch (error) {
        console.error('Failed to send order confirmation email after retries:', error.message);
    }
}

/**
 * Send password reset email
 */
async function sendPasswordResetEmail(user, resetUrl) {
    const mailOptions = {
        from: process.env.EMAIL_FROM || 'Unistyles <info@unistylescuracao.com>',
        to: user.email,
        subject: 'Reset Your Password - Unistyles',
        html: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background: #1A1A1A; color: #C5A55A; padding: 20px; text-align: center;">
        <h1>UNISTYLES</h1>
    </div>
    <div style="padding: 30px;">
        <h2>Password Reset</h2>
        <p>Hi ${user.first_name},</p>
        <p>We received a request to reset your password. Click the button below to set a new password:</p>
        <p style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background: #C5A55A; color: #1A1A1A; padding: 14px 30px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">Reset Password</a>
        </p>
        <p style="color: #666; font-size: 13px;">This link expires in 15 minutes. If you didn't request this, you can ignore this email.</p>
    </div>
</div>`
    };

    await withRetry(
        () => transporter.sendMail(mailOptions),
        `Password reset email to ${user.email}`
    );
}

/**
 * Send email verification link
 */
async function sendVerificationEmail(user, verifyUrl) {
    const mailOptions = {
        from: process.env.EMAIL_FROM || 'Unistyles <info@unistylescuracao.com>',
        to: user.email,
        subject: 'Verify Your Email - Unistyles',
        html: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background: #1A1A1A; color: #C5A55A; padding: 20px; text-align: center;">
        <h1>UNISTYLES</h1>
    </div>
    <div style="padding: 30px;">
        <h2>Welcome to Unistyles!</h2>
        <p>Hi ${user.first_name},</p>
        <p>Please verify your email address by clicking the button below:</p>
        <p style="text-align: center; margin: 30px 0;">
            <a href="${verifyUrl}" style="background: #C5A55A; color: #1A1A1A; padding: 14px 30px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">Verify Email</a>
        </p>
        <p style="color: #666; font-size: 13px;">This link expires in 7 days.</p>
    </div>
</div>`
    };

    await withRetry(
        () => transporter.sendMail(mailOptions),
        `Verification email to ${user.email}`
    );
}

// WhatsApp Business number
const WHATSAPP_NUMBER = process.env.WHATSAPP_NUMBER || '+59996736285';

/**
 * Send WhatsApp notification for a new order
 * If Cloud API is configured: sends to both store owner AND customer
 * If not: falls back to wa.me link generation (no breaking change)
 */
async function sendWhatsAppNotification(order, items) {
    const itemsList = items.map(item =>
        `• ${item.productName} x${item.quantity} - XCG ${(item.price * item.quantity).toFixed(2)}`
    ).join('\n');

    const shippingAddress = typeof order.shipping_address === 'string'
        ? JSON.parse(order.shipping_address)
        : order.shipping_address;

    // Owner notification message
    const ownerMessage = `🛒 *NUEVO PEDIDO*

📋 *Order:* ${order.order_number}
💳 *Pago:* ${order.payment_method}
💰 *Total:* XCG ${parseFloat(order.total).toFixed(2)}

*Productos:*
${itemsList}

👤 *Cliente:* ${order.guest_name || shippingAddress.name || 'Registered User'}
📞 *Teléfono:* ${order.guest_phone || shippingAddress.phone || 'Check account'}

📍 *Entregar en:*
${shippingAddress.street}
${shippingAddress.area || ''}
${shippingAddress.city}
${order.delivery_date ? `\n📅 Fecha: ${order.delivery_date}` : ''}${order.delivery_time_slot ? `\n🕐 Horario: ${order.delivery_time_slot}` : ''}${order.notes ? `\n📝 Notas: ${order.notes}` : ''}`.trim();

    // Log the notification for server records
    console.log(`[WhatsApp] New order notification for ${order.order_number}`);

    // If Cloud API is configured, send programmatically
    if (whatsapp.isConfigured()) {
        console.log('[WhatsApp] Sending via Cloud API...');

        // Send to store owner (free-form is fine for internal messages)
        await whatsapp.sendTextMessage(WHATSAPP_NUMBER, ownerMessage);

        // Send confirmation to customer using template message (higher delivery rate)
        const customerPhone = order.guest_phone || shippingAddress.phone;
        if (customerPhone) {
            // Try template first, fall back to free-form
            const templateSent = await whatsapp.sendTemplateMessage(customerPhone, 'order_confirmation', [
                {
                    type: 'body',
                    parameters: [
                        { type: 'text', text: order.order_number },
                        { type: 'text', text: `XCG ${parseFloat(order.total).toFixed(2)}` },
                        { type: 'text', text: `${shippingAddress.street}, ${shippingAddress.city}` }
                    ]
                }
            ]);

            // Fallback to free-form if template not approved yet
            if (!templateSent) {
                const customerMessage = `✅ *Unistyles Curacao*\n\nBo order *#${order.order_number}* a wordo konfirmá!\n\n📦 *Produktonan:*\n${itemsList}\n\n💰 *Total:* XCG ${parseFloat(order.total).toFixed(2)}\n📍 *Entrega na:* ${shippingAddress.street}, ${shippingAddress.city}\n\nDanki pa bo kompra! Nos lo kontaktabo pronto pa konfirmá entrega. 🙏`;
                await whatsapp.sendTextMessage(customerPhone, customerMessage);
            }
        }

        return { message: ownerMessage, sent: true };
    }

    // Fallback: generate wa.me link (original behavior)
    console.log(`[WhatsApp] API not configured, falling back to wa.me link`);
    console.log(`[WhatsApp] Business number: ${WHATSAPP_NUMBER}`);

    const encodedMessage = encodeURIComponent(ownerMessage);
    const whatsappLink = `https://wa.me/${WHATSAPP_NUMBER.replace('+', '')}?text=${encodedMessage}`;
    console.log(`[WhatsApp] Quick link: ${whatsappLink}`);

    return { message: ownerMessage, whatsappLink };
}

/**
 * Send order status update to customer via WhatsApp
 */
async function sendOrderStatusUpdate(order, newStatus) {
    if (!whatsapp.isConfigured()) {
        console.log('[WhatsApp] API not configured, skipping status update notification');
        return null;
    }

    const shippingAddress = typeof order.shipping_address === 'string'
        ? JSON.parse(order.shipping_address)
        : order.shipping_address;

    const customerPhone = order.guest_phone || shippingAddress?.phone;
    if (!customerPhone) {
        console.log('[WhatsApp] No customer phone for status update');
        return null;
    }

    // Try template messages first for status updates (higher delivery rate)
    const templateMap = {
        confirmed: 'order_confirmed',
        processing: 'order_processing',
        shipped: 'order_shipped',
        delivered: 'order_delivered',
        cancelled: 'order_cancelled'
    };

    const templateName = templateMap[newStatus];
    if (!templateName) return null;

    // Try template first
    const templateSent = await whatsapp.sendTemplateMessage(customerPhone, templateName, [
        {
            type: 'body',
            parameters: [
                { type: 'text', text: order.order_number }
            ]
        }
    ]);

    // Fallback to free-form if template not approved
    if (!templateSent) {
        const statusMessages = {
            confirmed: `✅ *Unistyles Curacao*\n\nBo order *#${order.order_number}* a wordo konfirmá! Nos ta preparando bo pakete. 📦`,
            processing: `📦 *Unistyles Curacao*\n\nBo order *#${order.order_number}* ta wordo preparé. Nos lo avisabo ora e ta kla pa entrega!`,
            shipped: `🚚 *Unistyles Curacao*\n\nBo order *#${order.order_number}* ta kaminda! Nos ta bin entregá pronto.`,
            delivered: `🎉 *Unistyles Curacao*\n\nBo order *#${order.order_number}* a wordo entregá! Danki pa bo kompra. Nos ta spera bo ta disfrutá! 💛`,
            cancelled: `❌ *Unistyles Curacao*\n\nBo order *#${order.order_number}* a wordo kanselá. Si bo tin pregunta, kontaktanos via WhatsApp.`
        };

        const message = statusMessages[newStatus];
        if (message) return await whatsapp.sendTextMessage(customerPhone, message);
    }

    return templateSent;
}

/**
 * Send welcome message to new customer
 */
async function sendWelcomeMessage(phone) {
    if (!whatsapp.isConfigured()) return null;

    return await whatsapp.sendInteractiveMessage(phone, {
        type: 'button',
        body: {
            text: '🌟 *Bon bini na Unistyles Curacao!*\n\nDanki pa kontaktanos. Kon nos por yudabo?'
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
 * Get WhatsApp link for customer contact
 */
function getWhatsAppLink(customMessage) {
    const number = WHATSAPP_NUMBER.replace('+', '');
    const message = customMessage || 'Hola! Me interesa conocer más sobre sus productos.';
    return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

module.exports = {
    sendOrderConfirmation,
    sendWhatsAppNotification,
    sendOrderStatusUpdate,
    sendWelcomeMessage,
    sendPasswordResetEmail,
    sendVerificationEmail,
    getWhatsAppLink,
    WHATSAPP_NUMBER
};
