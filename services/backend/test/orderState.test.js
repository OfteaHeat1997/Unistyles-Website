// Unit tests — order state machine (services/orderState.js)
const test = require('node:test');
const assert = require('node:assert/strict');
const { checkTransition, allowedNext, TRANSITIONS } = require('../src/services/orderState');

const paid = { paymentStatus: 'paid' };

test('happy path: delivery', () => {
    const ctx = { fulfillmentMethod: 'delivery', ...paid };
    for (const [from, to] of [['confirmed', 'processing'], ['processing', 'out_for_delivery'], ['out_for_delivery', 'delivered']]) {
        assert.equal(checkTransition(from, to, ctx).ok, true, `${from} -> ${to}`);
    }
});

test('happy path: pickup', () => {
    const ctx = { fulfillmentMethod: 'pickup', ...paid };
    for (const [from, to] of [['confirmed', 'processing'], ['processing', 'ready_for_pickup'], ['ready_for_pickup', 'picked_up']]) {
        assert.equal(checkTransition(from, to, ctx).ok, true, `${from} -> ${to}`);
    }
});

test('pickup states are refused for delivery orders and vice versa', () => {
    assert.equal(checkTransition('processing', 'ready_for_pickup', { fulfillmentMethod: 'delivery', ...paid }).ok, false);
    assert.equal(checkTransition('processing', 'out_for_delivery', { fulfillmentMethod: 'pickup', ...paid }).ok, false);
});

test('no preparation without confirmed payment', () => {
    const r = checkTransition('confirmed', 'processing', { fulfillmentMethod: 'delivery', paymentStatus: 'pending' });
    assert.equal(r.ok, false);
    assert.match(r.reason, /Payment must be confirmed/);
});

test('cash on delivery counts as payment ok for preparation', () => {
    assert.equal(checkTransition('confirmed', 'processing', { fulfillmentMethod: 'delivery', paymentStatus: 'pending_delivery' }).ok, true);
});

test('failed delivery can be retried or returned', () => {
    const ctx = { fulfillmentMethod: 'delivery', ...paid };
    assert.equal(checkTransition('out_for_delivery', 'delivery_failed', ctx).ok, true);
    assert.equal(checkTransition('delivery_failed', 'out_for_delivery', ctx).ok, true);
    assert.equal(checkTransition('delivery_failed', 'returned', ctx).ok, true);
});

test('impossible jumps are refused', () => {
    assert.equal(checkTransition('pending', 'delivered', paid).ok, false);
    assert.equal(checkTransition('delivered', 'processing', paid).ok, false);
    assert.equal(checkTransition('cancelled', 'confirmed', paid).ok, false);
    assert.equal(checkTransition('confirmed', 'confirmed', paid).ok, false);
    assert.equal(checkTransition('out_for_delivery', 'cancelled', paid).ok, false);
});

test('terminal states have no exits', () => {
    for (const s of ['picked_up', 'returned', 'cancelled', 'expired']) {
        assert.deepEqual(TRANSITIONS[s], []);
    }
});

test('allowedNext filters by context', () => {
    assert.deepEqual(allowedNext('processing', { fulfillmentMethod: 'pickup', ...paid }), ['ready_for_pickup', 'cancelled']);
    assert.deepEqual(allowedNext('awaiting_payment', { fulfillmentMethod: 'delivery', paymentStatus: 'pending' }), ['confirmed', 'cancelled', 'expired']);
});

test('every transition target is a known status', () => {
    for (const targets of Object.values(TRANSITIONS)) {
        for (const t of targets) assert.ok(TRANSITIONS[t], t);
    }
});
