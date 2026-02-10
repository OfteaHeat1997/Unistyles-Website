// ===========================================
// NOTIFICATION UTILITIES
// ===========================================

const nodemailer = require('nodemailer');

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
        `- ${item.productName} (${item.size || 'N/A'}, ${item.color || 'N/A'}) x${item.quantity} - ANG ${(item.price * item.quantity).toFixed(2)}`
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

Subtotal: ANG ${parseFloat(order.subtotal).toFixed(2)}
Delivery: ANG ${parseFloat(order.delivery_fee).toFixed(2)}
Total: ANG ${parseFloat(order.total).toFixed(2)}

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
                <p>- ${item.productName} (${item.size || 'N/A'}, ${item.color || 'N/A'}) x${item.quantity} - ANG ${(item.price * item.quantity).toFixed(2)}</p>
            `).join('')}
            <hr>
            <p>Subtotal: ANG ${parseFloat(order.subtotal).toFixed(2)}</p>
            <p>Delivery: ANG ${parseFloat(order.delivery_fee).toFixed(2)}</p>
            <p class="total">Total: ANG ${parseFloat(order.total).toFixed(2)}</p>
        </div>
        <a href="https://wa.me/${process.env.WHATSAPP_NUMBER?.replace('+', '')}" class="whatsapp">Contact us on WhatsApp</a>
    </div>
</body>
</html>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Order confirmation sent to ${toEmail}`);
    } catch (error) {
        console.error('Failed to send order confirmation email:', error);
    }
}

/**
 * Send WhatsApp notification to store owner
 */
async function sendWhatsAppNotification(order, items) {
    // In production, you would use WhatsApp Business API
    // For now, we just log the notification

    const itemsList = items.map(item =>
        `• ${item.productName} x${item.quantity}`
    ).join('\n');

    const message = `
NEW ORDER!

Order: ${order.order_number}
Payment: ${order.payment_method}
Total: ANG ${parseFloat(order.total).toFixed(2)}

Items:
${itemsList}

Customer: ${order.guest_name || 'Registered User'}
Phone: ${order.guest_phone || 'Check account'}

Deliver to:
${JSON.parse(order.shipping_address).street}
${JSON.parse(order.shipping_address).city}
    `.trim();

    console.log('WhatsApp notification:', message);

    // TODO: Implement WhatsApp Business API integration
    // Example with Twilio:
    // const twilio = require('twilio');
    // const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);
    // await client.messages.create({
    //     from: 'whatsapp:+14155238886',
    //     to: `whatsapp:${process.env.OWNER_WHATSAPP}`,
    //     body: message
    // });
}

module.exports = {
    sendOrderConfirmation,
    sendWhatsAppNotification
};
