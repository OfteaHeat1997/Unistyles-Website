// Unit tests — payment decisions (services/paymentConfirm.js#decide)
const test = require('node:test');
const assert = require('node:assert/strict');
const { decide } = require('../src/services/paymentConfirm');

const order = (over = {}) => ({ status: 'awaiting_payment', payment_status: 'pending', total: '45.50', currency: 'XCG', ...over });
const payment = (over = {}) => ({ status: 'pending', ...over });

test('success with matching amount marks paid', () => {
    const r = decide({ providerStatus: 'success', payment: payment(), order: order(), providerData: { amount: 4550, currency: 'XCG' } });
    assert.equal(r.action, 'mark_paid');
});

test('replayed success after paid is ignored (exactly once)', () => {
    const r = decide({ providerStatus: 'success', payment: payment({ status: 'paid' }), order: order({ payment_status: 'paid', status: 'confirmed' }) });
    assert.deepEqual(r, { action: 'ignore', reason: 'already_paid' });
});

test('amount mismatch never marks paid', () => {
    const r = decide({ providerStatus: 'success', payment: payment(), order: order(), providerData: { amount: 100 } });
    assert.equal(r.action, 'amount_mismatch');
});

test('currency mismatch never marks paid', () => {
    const r = decide({ providerStatus: 'success', payment: payment(), order: order(), providerData: { amount: 4550, currency: 'USD' } });
    assert.equal(r.action, 'amount_mismatch');
});

test('success without amount data is accepted (provider did not send it)', () => {
    assert.equal(decide({ providerStatus: 'success', payment: payment(), order: order(), providerData: null }).action, 'mark_paid');
});

test('late success on an expired order is kept and flagged for review', () => {
    const r = decide({ providerStatus: 'success', payment: payment({ status: 'expired' }), order: order({ status: 'expired', payment_status: 'expired' }) });
    assert.equal(r.action, 'flag_late_payment');
});

test('cancelled / expired from provider marks failed once', () => {
    assert.equal(decide({ providerStatus: 'cancelled', payment: payment(), order: order() }).action, 'mark_failed');
    assert.equal(decide({ providerStatus: 'expired', payment: payment({ status: 'failed' }), order: order() }).action, 'ignore');
});

test('non-terminal statuses do nothing', () => {
    for (const s of ['issued', 'pending', 'failed']) {
        assert.equal(decide({ providerStatus: s, payment: payment(), order: order() }).action, 'ignore', s);
    }
});
