// ===========================================
// PRICING — the single server-side calculation of an order's money.
// Used by POST /api/checkout/quote (what the customer sees) and by
// POST /api/orders (what is charged), so both always agree.
// All math is done in integer cents.
// ===========================================

const fulfillment = require('./fulfillment');

const toCents = (n) => Math.round(Number(n) * 100);
const fromCents = (c) => Math.round(c) / 100;

/**
 * Evaluate a coupon against a subtotal. Pure.
 * @param {object|null} coupon - coupons row
 * @param {object} ctx - { subtotalCents, now, userUses }
 * @returns {{ valid:boolean, discountCents:number, error?:string }}
 */
function evaluateCoupon(coupon, { subtotalCents, now = new Date(), userUses = 0 }) {
    if (!coupon || coupon.is_active === false) return { valid: false, discountCents: 0, error: 'Invalid coupon code' };
    if (coupon.valid_from && new Date(coupon.valid_from) > now) {
        return { valid: false, discountCents: 0, error: 'Coupon is not active yet' };
    }
    if (coupon.valid_until && new Date(coupon.valid_until) < now) {
        return { valid: false, discountCents: 0, error: 'Coupon has expired' };
    }
    if (coupon.max_uses && Number(coupon.times_used) >= Number(coupon.max_uses)) {
        return { valid: false, discountCents: 0, error: 'Coupon has reached its usage limit' };
    }
    if (coupon.max_uses_per_user && userUses >= Number(coupon.max_uses_per_user)) {
        return { valid: false, discountCents: 0, error: 'You have already used this coupon' };
    }
    const minCents = coupon.min_order_amount ? toCents(coupon.min_order_amount) : 0;
    if (subtotalCents < minCents) {
        return {
            valid: false,
            discountCents: 0,
            error: `Minimum order for this coupon is XCG ${fromCents(minCents).toFixed(2)}`
        };
    }

    let discountCents;
    if (coupon.discount_type === 'percentage') {
        discountCents = Math.round(subtotalCents * Number(coupon.discount_value) / 100);
        if (coupon.max_discount) discountCents = Math.min(discountCents, toCents(coupon.max_discount));
    } else {
        discountCents = toCents(coupon.discount_value);
    }
    discountCents = Math.max(0, Math.min(discountCents, subtotalCents));
    return { valid: true, discountCents };
}

/**
 * Compute totals. Pure.
 * Free delivery is judged on the subtotal AFTER discount (pending approval, C01).
 * @param {object} p
 * @param {Array<{unitPriceCents:number, quantity:number}>} p.lines
 * @param {number} p.discountCents
 * @param {'pickup'|'delivery'} p.method
 * @param {object|null} p.zone - { fee, free_threshold }
 * @param {number} p.globalThreshold
 * @param {'gte'|'gt'} p.rule
 */
function computeTotals({ lines, discountCents = 0, method, zone, globalThreshold, rule = 'gte' }) {
    const subtotalCents = lines.reduce((sum, l) => sum + l.unitPriceCents * l.quantity, 0);
    const discount = Math.min(discountCents, subtotalCents);
    const basisCents = subtotalCents - discount;

    let thresholdCents = null;
    let deliveryFeeCents = 0;
    let qualifies = false;
    let coverage = 'not_applicable';

    if (method === 'delivery') {
        coverage = zone ? 'covered' : 'unknown';
        const threshold = zone && zone.free_threshold !== null && zone.free_threshold !== undefined
            ? Number(zone.free_threshold)
            : Number(globalThreshold);
        thresholdCents = toCents(threshold);
        qualifies = rule === 'gt' ? basisCents > thresholdCents : basisCents >= thresholdCents;
        // Unknown zone: fee is confirmed by WhatsApp, never charged automatically (DEC-001)
        deliveryFeeCents = qualifies || !zone ? 0 : toCents(zone.fee);
    }

    const totalCents = basisCents + deliveryFeeCents;
    return {
        subtotalCents,
        discountCents: discount,
        deliveryFeeCents,
        totalCents,
        coverage,
        deliveryFeeToConfirm: method === 'delivery' && !zone && !qualifies,
        freeDelivery: method === 'delivery' && thresholdCents !== null
            ? {
                threshold: fromCents(thresholdCents),
                qualifies,
                remaining: qualifies ? 0 : fromCents(Math.max(0, thresholdCents - basisCents + (rule === 'gt' ? 1 : 0)))
            }
            : null
    };
}

// --- DB-backed quote --------------------------------------------------------

/**
 * Load priced cart lines. With lock=true the product / variant rows are
 * locked FOR UPDATE (order creation), so two checkouts cannot both take
 * the last unit.
 */
async function loadLines(client, items, { lock = false } = {}) {
    const lockSql = lock ? ' FOR UPDATE' : '';
    const productIds = [...new Set(items.map(i => Number(i.productId)).filter(Number.isFinite))];
    const variantIds = [...new Set(items.map(i => i.variantId).filter(Boolean))];

    const products = productIds.length
        ? (await client.query(
            `SELECT id, ref, name, price, in_stock, stock_quantity, legacy_image
             FROM products WHERE id = ANY($1::int[])${lockSql}`, [productIds])).rows
        : [];
    const variants = variantIds.length
        ? (await client.query(
            `SELECT id, product_id, size, color, sku, stock_quantity, price_adjustment, is_active
             FROM product_variants WHERE id = ANY($1::uuid[])${lockSql}`, [variantIds])).rows
        : [];
    // Which products sell by variant (they cannot be bought without one)
    const withVariants = productIds.length
        ? new Set((await client.query(
            'SELECT DISTINCT product_id FROM product_variants WHERE product_id = ANY($1::int[]) AND is_active = true',
            [productIds])).rows.map(r => r.product_id))
        : new Set();

    const productMap = new Map(products.map(p => [p.id, p]));
    const variantMap = new Map(variants.map(v => [v.id, v]));

    const lines = [];
    const issues = [];

    // Merge duplicates (same product+variant twice) so stock is checked on the total quantity
    const merged = new Map();
    for (const item of items) {
        const key = `${item.productId}|${item.variantId || ''}`;
        const prev = merged.get(key);
        merged.set(key, { ...item, quantity: (prev?.quantity || 0) + Number(item.quantity) });
    }

    for (const item of merged.values()) {
        const product = productMap.get(Number(item.productId));
        if (!product) {
            issues.push({ type: 'not_found', productId: item.productId, message: 'This product is no longer available.' });
            continue;
        }
        let variant = null;
        if (item.variantId) {
            variant = variantMap.get(item.variantId);
            if (!variant || variant.product_id !== product.id || !variant.is_active) {
                issues.push({ type: 'variant_not_found', productId: product.id, variantId: item.variantId, message: `${product.name}: the selected size/colour is no longer available.` });
                continue;
            }
        } else if (withVariants.has(product.id)) {
            issues.push({ type: 'variant_required', productId: product.id, message: `${product.name}: please choose a size and colour.` });
            continue;
        }

        const available = variant
            ? Number(variant.stock_quantity)
            : (product.stock_quantity === null ? null : Number(product.stock_quantity));
        const quantity = Number(item.quantity);

        if (!variant && product.in_stock === false) {
            issues.push({ type: 'out_of_stock', productId: product.id, message: `${product.name} is out of stock.`, available: 0 });
        } else if (available !== null && available < quantity) {
            issues.push({
                type: available === 0 ? 'out_of_stock' : 'insufficient_stock',
                productId: product.id,
                variantId: variant?.id || null,
                available,
                message: available === 0
                    ? `${product.name}${variant ? ` (${[variant.size, variant.color].filter(Boolean).join(' / ')})` : ''} is out of stock.`
                    : `Only ${available} left of ${product.name}${variant ? ` (${[variant.size, variant.color].filter(Boolean).join(' / ')})` : ''}.`
            });
        }

        const unitPriceCents = toCents(product.price) + (variant ? toCents(variant.price_adjustment || 0) : 0);
        lines.push({
            productId: product.id,
            variantId: variant?.id || null,
            name: product.name,
            sku: variant?.sku || product.ref || '',
            size: variant?.size || item.size || null,
            color: variant?.color || item.color || null,
            image: product.legacy_image || null,
            quantity,
            unitPriceCents,
            available,
            clientPrice: item.price !== undefined ? Number(item.price) : undefined
        });
    }

    for (const line of lines) {
        if (line.clientPrice !== undefined && toCents(line.clientPrice) !== line.unitPriceCents) {
            issues.push({
                type: 'price_changed',
                blocking: false,
                productId: line.productId,
                variantId: line.variantId,
                message: `The price of ${line.name} is now XCG ${fromCents(line.unitPriceCents).toFixed(2)}.`
            });
        }
    }
    return { lines, issues };
}

async function loadCoupon(client, code, { lock = false, userId, email } = {}) {
    if (!code) return { coupon: null, userUses: 0 };
    const result = await client.query(
        `SELECT * FROM coupons WHERE UPPER(code) = UPPER($1)${lock ? ' FOR UPDATE' : ''}`,
        [code]
    );
    const coupon = result.rows[0] || null;
    let userUses = 0;
    if (coupon && (userId || email)) {
        const uses = await client.query(
            `SELECT COUNT(*)::int AS n FROM coupon_redemptions
             WHERE coupon_id = $1 AND (($2::uuid IS NOT NULL AND user_id = $2::uuid)
                                   OR ($3::text IS NOT NULL AND LOWER(guest_email) = LOWER($3::text)))`,
            [coupon.id, userId || null, email || null]
        );
        userUses = uses.rows[0].n;
    }
    return { coupon, userUses };
}

/**
 * Build a complete quote.
 * @param {object} client - pg client or pool
 * @param {object} input  - { items, fulfillment:{method, lat, lng, area, pickupLocationId, date, slotId}, couponCode, email }
 * @param {object} opts   - { settings, userId, lock, requireComplete, now }
 */
async function buildQuote(client, input, { settings, userId = null, lock = false, requireComplete = false, now = new Date() }) {
    const method = input.fulfillment?.method === 'pickup' ? 'pickup' : 'delivery';
    const f = input.fulfillment || {};
    const issues = [];

    if (method === 'pickup' && settings.pickup_enabled === false) {
        issues.push({ type: 'method_disabled', message: 'Pickup is currently not available.' });
    }
    if (method === 'delivery' && settings.delivery_enabled === false) {
        issues.push({ type: 'method_disabled', message: 'Delivery is currently not available.' });
    }

    const { lines, issues: lineIssues } = await loadLines(client, input.items || [], { lock });
    issues.push(...lineIssues);

    // Zone: pin first, neighborhood name as fallback.
    // DEC-001: an address we cannot place is "to be confirmed by WhatsApp" — the order
    // can still be placed, the delivery fee is never charged automatically.
    let zone = null;
    let zoneSource = null;
    if (method === 'delivery') {
        const zones = await fulfillment.loadZones(client);
        const lat = f.lat !== undefined && f.lat !== null ? Number(f.lat) : NaN;
        const lng = f.lng !== undefined && f.lng !== null ? Number(f.lng) : NaN;
        const hasPin = Number.isFinite(lat) && Number.isFinite(lng);
        if (hasPin) {
            zone = fulfillment.findZoneByPoint(zones, lat, lng);
            zoneSource = zone ? 'pin' : null;
        }
        if (!zone && f.area) {
            zone = fulfillment.findZoneByArea(zones, f.area);
            zoneSource = zone ? 'area' : null;
        }
        if (!zone && (hasPin || f.area)) {
            issues.push({
                type: 'zone_to_confirm',
                blocking: false,
                message: 'We will confirm the delivery fee for your address on WhatsApp. Nothing is charged for delivery until then.'
            });
        } else if (!zone && requireComplete) {
            issues.push({ type: 'location_required', message: 'Please tell us your neighbourhood or set your location on the map.' });
        }
    }

    // Pickup location
    let pickupLocation = null;
    if (method === 'pickup') {
        const locations = await fulfillment.loadPickupLocations(client);
        pickupLocation = locations.find(l => Number(l.id) === Number(f.pickupLocationId)) || null;
        if (!pickupLocation && locations.length === 1 && !f.pickupLocationId) pickupLocation = locations[0];
        if (!pickupLocation && requireComplete) {
            issues.push({ type: 'pickup_location_required', message: 'Please choose a pickup location.' });
        }
    }

    // Date + slot
    let slot = null;
    if (f.date && f.slotId) {
        const calendar = await fulfillment.loadCalendar(method, {
            client, now, days: settings.booking_days_ahead, cutoffHour: settings.delivery_cutoff_hour
        });
        const error = fulfillment.validateSlotChoice(calendar, f.date, f.slotId);
        if (error) {
            issues.push({ type: 'slot_unavailable', message: error });
        } else {
            const day = calendar.find(d => d.date === f.date);
            slot = { date: f.date, ...day.slots.find(s => Number(s.id) === Number(f.slotId)) };
        }
    } else if (requireComplete) {
        issues.push({ type: 'slot_required', message: `Please choose a ${method} date and time window.` });
    }

    // Coupon
    const subtotalCents = lines.reduce((s, l) => s + l.unitPriceCents * l.quantity, 0);
    let couponResult = null;
    let coupon = null;
    if (input.couponCode) {
        const loaded = await loadCoupon(client, input.couponCode, { lock, userId, email: input.email });
        coupon = loaded.coupon;
        couponResult = evaluateCoupon(coupon, { subtotalCents, now, userUses: loaded.userUses });
    }

    const totals = computeTotals({
        lines,
        discountCents: couponResult?.valid ? couponResult.discountCents : 0,
        method,
        zone,
        globalThreshold: settings.free_delivery_threshold,
        rule: settings.free_delivery_rule
    });

    if (lines.length === 0 && (input.items || []).length === 0) {
        issues.push({ type: 'empty_cart', message: 'Your cart is empty.' });
    }

    const blockingIssues = issues.filter(i => i.blocking !== false);

    return {
        currency: settings.store_currency || 'XCG',
        method,
        lines: lines.map(l => ({
            productId: l.productId,
            variantId: l.variantId,
            name: l.name,
            sku: l.sku,
            size: l.size,
            color: l.color,
            image: l.image,
            quantity: l.quantity,
            unitPrice: fromCents(l.unitPriceCents),
            lineTotal: fromCents(l.unitPriceCents * l.quantity),
            available: l.available
        })),
        subtotal: fromCents(totals.subtotalCents),
        discount: fromCents(totals.discountCents),
        deliveryFee: fromCents(totals.deliveryFeeCents),
        deliveryFeeToConfirm: totals.deliveryFeeToConfirm,
        total: fromCents(totals.totalCents),
        freeDelivery: totals.freeDelivery,
        zone: zone ? {
            id: zone.id,
            slug: zone.slug,
            name: zone.name,
            fee: parseFloat(zone.fee),
            estimatedDays: zone.estimated_days,
            color: zone.color,
            source: zoneSource
        } : null,
        pickupLocation,
        slot,
        coupon: input.couponCode ? {
            code: coupon?.code || input.couponCode,
            valid: !!couponResult?.valid,
            discount: couponResult?.valid ? fromCents(couponResult.discountCents) : 0,
            error: couponResult?.valid ? null : couponResult?.error
        } : null,
        issues,
        canPlaceOrder: blockingIssues.length === 0 && lines.length > 0,
        // internal — never sent to the browser
        _internal: { lines, zone, coupon, couponResult, totals, slot, pickupLocation }
    };
}

function publicQuote(quote) {
    const { _internal, ...rest } = quote;
    return rest;
}

module.exports = { toCents, fromCents, evaluateCoupon, computeTotals, loadLines, buildQuote, publicQuote };
