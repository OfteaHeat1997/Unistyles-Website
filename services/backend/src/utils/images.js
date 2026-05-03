// ===========================================
// SHARED IMAGE UTILITIES
// Used by products, perfumes, skincare, cart routes.
//
// Directus stores image FKs as UUIDs on the products table directly
// (`products.image`). Public URLs are `${DIRECTUS_URL}/assets/{uuid}`.
// ===========================================

const db = require('./db');

const DIRECTUS_URL = (process.env.DIRECTUS_URL || 'http://directus:8055').replace(/\/$/, '');

function assetUrl(uuid) {
    return uuid ? `${DIRECTUS_URL}/assets/${uuid}` : null;
}

/**
 * Get uploaded image URLs for products.
 * Returns a map: { productId: assetUrl }
 */
async function getUploadedImages(productIds) {
    if (!productIds || productIds.length === 0) return {};
    try {
        const result = await db.query(
            `SELECT id, image FROM products WHERE id = ANY($1) AND image IS NOT NULL`,
            [productIds]
        );
        const map = {};
        result.rows.forEach(r => {
            const url = assetUrl(r.image);
            if (url) map[r.id] = url;
        });
        return map;
    } catch {
        return {};
    }
}

/**
 * Resolve image — prefer uploaded, fall back to legacy path stored on the row.
 */
function resolveImage(productId, legacyImage, uploadMap) {
    return uploadMap[productId] || legacyImage || null;
}

module.exports = { getUploadedImages, resolveImage, assetUrl };
