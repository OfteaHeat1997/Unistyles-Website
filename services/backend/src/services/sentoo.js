// ===========================================
// SENTOO MERCHANT API SERVICE
// API v1 — https://docs.sentoo.io
// ===========================================

const axios = require('axios');
const querystring = require('querystring');

const config = {
    secret: process.env.SENTOO_API_KEY,
    merchantId: process.env.SENTOO_MERCHANT_ID,
    sandbox: process.env.SENTOO_SANDBOX !== 'false' // default to sandbox
};

const API_BASE = config.sandbox
    ? 'https://api.sandbox.sentoo.io'
    : 'https://api.sentoo.io';

const PAY_BASE = config.sandbox
    ? 'https://pay.sandbox.sentoo.io'
    : 'https://pay.sentoo.io';

/**
 * Check if Sentoo is configured
 */
function isConfigured() {
    return !!(config.secret && config.merchantId);
}

/**
 * Get axios instance for Sentoo API
 */
function getClient() {
    return axios.create({
        baseURL: API_BASE,
        headers: {
            'X-SENTOO-SECRET': config.secret
        },
        timeout: 15000
    });
}

/**
 * Create a new Sentoo transaction
 * @param {Object} params
 * @param {number} params.amount - Amount in cents (min 100)
 * @param {string} params.description - Max 50 chars
 * @param {string} params.currency - ISO 4217 (e.g. 'XCG')
 * @param {string} params.returnUrl - URL where Sentoo redirects payer (attempt status appended)
 * @param {string} [params.customer] - Optional customer reference
 * @param {string} [params.expires] - Optional ISO 8601 expiry date
 * @returns {{ transactionId: string, paymentUrl: string, qrCodeUrl: string }}
 */
async function createTransaction({ amount, description, currency, returnUrl, customer, expires }) {
    if (!isConfigured()) {
        throw new Error('Sentoo is not configured. Set SENTOO_API_KEY and SENTOO_MERCHANT_ID.');
    }

    const client = getClient();

    const formData = {
        sentoo_merchant: config.merchantId,
        sentoo_amount: String(amount),
        sentoo_description: description.substring(0, 50),
        sentoo_currency: currency || 'XCG',
        sentoo_return_url: returnUrl
    };

    if (customer) {
        formData.sentoo_customer = String(customer).substring(0, 50);
    }

    if (expires) {
        // Replace + with %2B for form encoding (+ is reserved in forms)
        formData.sentoo_expires = expires;
    }

    const response = await client.post(
        '/v1/payment/new',
        querystring.stringify(formData),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const body = response.data;

    if (body.error) {
        const err = new Error(body.error.message || 'Sentoo transaction creation failed');
        err.sentooCode = body.error.code;
        err.sentooReference = body.error.reference;
        throw err;
    }

    const transactionId = body.success.message;

    return {
        transactionId,
        paymentUrl: body.success.data?.url || `${PAY_BASE}/p/${transactionId}`,
        qrCodeUrl: body.success.data?.qr_code || `${PAY_BASE}/qr/${transactionId}`
    };
}

/**
 * Fetch transaction status from Sentoo
 * Note: max 10 calls per 60 minutes per transaction
 * @param {string} transactionId
 * @returns {{ status: string, data: Object|null }}
 */
async function fetchStatus(transactionId) {
    if (!isConfigured()) {
        throw new Error('Sentoo is not configured.');
    }

    const client = getClient();

    const response = await client.get(
        `/v1/payment/status/${config.merchantId}/${transactionId}`
    );

    const body = response.data;

    if (body.error) {
        const err = new Error(body.error.message || 'Failed to fetch Sentoo transaction status');
        err.sentooCode = body.error.code;
        err.sentooReference = body.error.reference;
        throw err;
    }

    return {
        status: body.success.message, // issued, pending, failed, cancelled, expired, success
        data: body.success.data || null
    };
}

/**
 * Cancel a Sentoo transaction
 * @param {string} transactionId
 */
async function cancelTransaction(transactionId) {
    if (!isConfigured()) {
        throw new Error('Sentoo is not configured.');
    }

    const client = getClient();

    const response = await client.get(
        `/v1/payment/cancel/${config.merchantId}/${transactionId}`
    );

    const body = response.data;

    if (body.error) {
        const err = new Error(body.error.message || 'Failed to cancel Sentoo transaction');
        err.sentooCode = body.error.code;
        err.sentooReference = body.error.reference;
        throw err;
    }

    return { success: true };
}

module.exports = {
    isConfigured,
    createTransaction,
    fetchStatus,
    cancelTransaction,
    config,
    PAY_BASE
};
