// Unit tests — server-side money math (services/pricing.js)
const test = require('node:test');
const assert = require('node:assert/strict');
const { computeTotals, evaluateCoupon, toCents } = require('../src/services/pricing');

const zone1 = { fee: 5, free_threshold: 75 };
const zoneNoOverride = { fee: 10, free_threshold: null };
const line = (price, quantity = 1) => ({ unitPriceCents: toCents(price), quantity });

test('subtotal sums lines in cents without float drift', () => {
    const t = computeTotals({ lines: [line(19.99, 3), line(0.1, 3)], method: 'pickup', globalThreshold: 80 });
    assert.equal(t.subtotalCents, 6027);
    assert.equal(t.totalCents, 6027);
});

test('pickup never pays a delivery fee', () => {
    const t = computeTotals({ lines: [line(10)], method: 'pickup', zone: zone1, globalThreshold: 80 });
    assert.equal(t.deliveryFeeCents, 0);
    assert.equal(t.freeDelivery, null);
});

test('global threshold boundaries 79.99 / 80 / 80.01 with gte rule', () => {
    const at = (amount) => computeTotals({ lines: [line(amount)], method: 'delivery', zone: zoneNoOverride, globalThreshold: 80, rule: 'gte' });
    assert.equal(at(79.99).deliveryFeeCents, 1000);
    assert.equal(at(79.99).freeDelivery.remaining, 0.01);
    assert.equal(at(80).deliveryFeeCents, 0);
    assert.equal(at(80.01).deliveryFeeCents, 0);
});

test('gt rule: exactly the threshold still pays', () => {
    const t = computeTotals({ lines: [line(80)], method: 'delivery', zone: zoneNoOverride, globalThreshold: 80, rule: 'gt' });
    assert.equal(t.deliveryFeeCents, 1000);
    assert.equal(t.freeDelivery.remaining, 0.01);
});

test('per-zone threshold overrides the global one (74.99 / 75)', () => {
    const at = (amount) => computeTotals({ lines: [line(amount)], method: 'delivery', zone: zone1, globalThreshold: 100 });
    assert.equal(at(74.99).deliveryFeeCents, 500);
    assert.equal(at(75).deliveryFeeCents, 0);
});

test('free delivery is judged on the subtotal after discount', () => {
    const t = computeTotals({ lines: [line(85)], discountCents: 1000, method: 'delivery', zone: zoneNoOverride, globalThreshold: 80 });
    assert.equal(t.deliveryFeeCents, 1000);           // 85 - 10 = 75 < 80
    assert.equal(t.totalCents, 8500 - 1000 + 1000);
});

test('unknown zone: no fee charged, coverage flagged', () => {
    const t = computeTotals({ lines: [line(30)], method: 'delivery', zone: null, globalThreshold: 80 });
    assert.equal(t.coverage, 'unknown');
    assert.equal(t.deliveryFeeCents, 0);
});

test('discount can never exceed the subtotal', () => {
    const t = computeTotals({ lines: [line(5)], discountCents: 2000, method: 'pickup', globalThreshold: 80 });
    assert.equal(t.discountCents, 500);
    assert.equal(t.totalCents, 0);
});

test('total = subtotal - discount + delivery (matches the DB CHECK)', () => {
    const t = computeTotals({ lines: [line(33.33, 2)], discountCents: 667, method: 'delivery', zone: zoneNoOverride, globalThreshold: 200 });
    assert.equal(t.totalCents, t.subtotalCents - t.discountCents + t.deliveryFeeCents);
});

const coupon = (over = {}) => ({
    code: 'TEST', is_active: true, discount_type: 'percentage', discount_value: 10,
    min_order_amount: null, max_discount: null, max_uses: null, max_uses_per_user: 1,
    times_used: 0, valid_from: null, valid_until: null, ...over
});

test('percentage coupon with cap', () => {
    const r = evaluateCoupon(coupon({ discount_value: 50, max_discount: 15 }), { subtotalCents: 10000 });
    assert.deepEqual(r, { valid: true, discountCents: 1500 });
});

test('fixed coupon', () => {
    const r = evaluateCoupon(coupon({ discount_type: 'fixed', discount_value: 20 }), { subtotalCents: 10000 });
    assert.equal(r.discountCents, 2000);
});

test('coupon minimum order', () => {
    const r = evaluateCoupon(coupon({ min_order_amount: 30 }), { subtotalCents: 2999 });
    assert.equal(r.valid, false);
    assert.match(r.error, /Minimum order/);
});

test('coupon expired / not yet active / exhausted / already used', () => {
    const now = new Date('2026-10-25T12:00:00Z');
    assert.equal(evaluateCoupon(coupon({ valid_until: '2026-10-01' }), { subtotalCents: 5000, now }).valid, false);
    assert.equal(evaluateCoupon(coupon({ valid_from: '2026-11-01' }), { subtotalCents: 5000, now }).valid, false);
    assert.equal(evaluateCoupon(coupon({ max_uses: 5, times_used: 5 }), { subtotalCents: 5000, now }).valid, false);
    assert.equal(evaluateCoupon(coupon(), { subtotalCents: 5000, now, userUses: 1 }).valid, false);
});

test('missing or inactive coupon is invalid', () => {
    assert.equal(evaluateCoupon(null, { subtotalCents: 5000 }).valid, false);
    assert.equal(evaluateCoupon(coupon({ is_active: false }), { subtotalCents: 5000 }).valid, false);
});

// DEC-001 (approved 24 Oct 2026): free from XCG 100 inclusive, after discounts;
// near XCG 10, far XCG 20; unknown zone = to be confirmed, never charged.
const near = { fee: 10, free_threshold: null };
const far = { fee: 20, free_threshold: null };
const dec001 = (amount, zone, discountCents = 0) =>
    computeTotals({ lines: [line(amount)], discountCents, method: 'delivery', zone, globalThreshold: 100, rule: 'gte' });

test('DEC-001 table: 80 near → 90, 80 far → 100', () => {
    assert.equal(dec001(80, near).totalCents, 9000);
    assert.equal(dec001(80, far).totalCents, 10000);
});

test('DEC-001 boundaries 99.99 / 100.00 / 100.01 in both zones', () => {
    for (const [zone, fee] of [[near, 1000], [far, 2000]]) {
        assert.equal(dec001(99.99, zone).deliveryFeeCents, fee);
        assert.equal(dec001(99.99, zone).freeDelivery.remaining, 0.01);
        assert.equal(dec001(100, zone).deliveryFeeCents, 0);
        assert.equal(dec001(100.01, zone).deliveryFeeCents, 0);
        assert.equal(dec001(120, zone).totalCents, 12000);
    }
});

test('DEC-001: a coupon that drops the subtotal below 100 brings the fee back', () => {
    const t = dec001(110, near, 1500);
    assert.equal(t.deliveryFeeCents, 1000);
    assert.equal(t.totalCents, 10500);
});

test('DEC-001: unknown zone below 100 is "to confirm" and charges nothing; above 100 is simply free', () => {
    const below = dec001(80, null);
    assert.equal(below.deliveryFeeCents, 0);
    assert.equal(below.deliveryFeeToConfirm, true);
    assert.equal(below.freeDelivery.remaining, 20);
    const above = dec001(100, null);
    assert.equal(above.deliveryFeeToConfirm, false);
    assert.equal(above.freeDelivery.qualifies, true);
});
