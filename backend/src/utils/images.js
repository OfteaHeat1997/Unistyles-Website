// ===========================================
// SHARED IMAGE UTILITIES
// Used by products, perfumes, skincare, cart routes
// ===========================================

const db = require('./db');

/**
 * Get uploaded image URLs for products from Strapi's file system.
 * Returns a map: { productId: uploadUrl }
 */
async function getUploadedImages(productIds) {
    if (!productIds || productIds.length === 0) return {};
    try {
        const result = await db.query(`
            SELECT frm.related_id as product_id, f.url as upload_url
            FROM files f
            JOIN files_related_morphs frm ON f.id = frm.file_id
            WHERE frm.related_id = ANY($1)
              AND frm.related_type = 'api::product.product'
              AND frm.field = 'image'
            ORDER BY frm."order" ASC
        `, [productIds]);
        const map = {};
        result.rows.forEach(r => {
            if (!map[r.product_id]) map[r.product_id] = r.upload_url;
        });
        return map;
    } catch {
        return {};
    }
}

/**
 * Resolve image - prefer uploaded, fall back to legacy path.
 */
function resolveImage(productId, legacyImage, uploadMap) {
    return uploadMap[productId] || legacyImage || null;
}

module.exports = { getUploadedImages, resolveImage };
