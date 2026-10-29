// Unit tests — zones, cut-off, slot capacity (services/fulfillment.js)
const test = require('node:test');
const assert = require('node:assert/strict');
const f = require('../src/services/fulfillment');

// Same geometry as database/migrations/004
const zones = [
    { id: 1, slug: 'zone-1-centro', sort_order: 1, neighborhoods: [{ name: 'Punda' }],
      polygon: { type: 'Polygon', coordinates: [[[-68.965, 12.135], [-68.910, 12.135], [-68.895, 12.115], [-68.890, 12.085], [-68.940, 12.080], [-68.965, 12.100], [-68.965, 12.135]]] } },
    { id: 2, slug: 'zone-2-east', sort_order: 2, neighborhoods: [{ name: 'Jan Thiel' }],
      polygon: { type: 'Polygon', coordinates: [[[-68.910, 12.135], [-68.825, 12.140], [-68.785, 12.080], [-68.830, 12.045], [-68.890, 12.080], [-68.895, 12.115], [-68.910, 12.135]]] } },
    { id: 3, slug: 'zone-3-west-north', sort_order: 3, neighborhoods: [{ name: 'Banda Abou' }],
      polygon: { type: 'MultiPolygon', coordinates: [
          [[[-69.165, 12.385], [-68.985, 12.395], [-68.965, 12.140], [-68.965, 12.135], [-68.965, 12.100], [-68.985, 12.080], [-69.080, 12.085], [-69.170, 12.155], [-69.165, 12.385]]],
          [[[-68.785, 12.080], [-68.745, 12.095], [-68.745, 12.045], [-68.830, 12.045], [-68.785, 12.080]]]
      ] } }
];

test('pin in Punda resolves to zone 1', () => {
    assert.equal(f.findZoneByPoint(zones, 12.105, -68.930)?.id, 1);
});

test('pin east (Jan Thiel area) resolves to zone 2', () => {
    assert.equal(f.findZoneByPoint(zones, 12.08, -68.85)?.id, 2);
});

test('pin west (Banda Abou) resolves to zone 3 via MultiPolygon', () => {
    assert.equal(f.findZoneByPoint(zones, 12.30, -69.10)?.id, 3);
});

test('pin in the sea is out of coverage', () => {
    assert.equal(f.findZoneByPoint(zones, 11.90, -68.90), null);
});

test('invalid coordinates return null', () => {
    assert.equal(f.findZoneByPoint(zones, NaN, -68.9), null);
});

test('area fallback is case-insensitive', () => {
    assert.equal(f.findZoneByArea(zones, 'jan thiel')?.id, 2);
    assert.equal(f.findZoneByArea(zones, 'Atlantis'), null);
});

// 2026-10-26 is a Monday. Curaçao = UTC-4.
const at = (localIso) => new Date(new Date(`${localIso}Z`).getTime() + 4 * 3600 * 1000);

test('delivery cut-off: 13:59 local -> next day, 14:00 -> day after', () => {
    assert.equal(f.earliestDate('delivery', at('2026-10-26T13:59:00'), 14), '2026-10-27');
    assert.equal(f.earliestDate('delivery', at('2026-10-26T14:00:00'), 14), '2026-10-28');
});

test('pickup may be same day', () => {
    assert.equal(f.earliestDate('pickup', at('2026-10-26T09:00:00'), 14), '2026-10-26');
});

const slots = [
    { id: 1, method: 'delivery', weekday: 2, start_time: '10:00', end_time: '13:00', capacity: 2, is_active: true },
    { id: 2, method: 'delivery', weekday: 2, start_time: '14:00', end_time: '18:00', capacity: 2, is_active: true },
    { id: 3, method: 'pickup', weekday: 1, start_time: '10:00', end_time: '13:00', capacity: 5, is_active: true },
    { id: 4, method: 'pickup', weekday: 1, start_time: '14:00', end_time: '17:00', capacity: 5, is_active: true }
];

test('full slot is not available, other slot is', () => {
    const cal = f.computeAvailability({
        method: 'delivery', slots, blocked: [], occupancy: { '2026-10-27|1': 2 },
        now: at('2026-10-26T10:00:00'), days: 3, cutoffHour: 14
    });
    const tuesday = cal.find(d => d.date === '2026-10-27');
    assert.equal(tuesday.slots.find(s => s.id === 1).available, false);
    assert.equal(tuesday.slots.find(s => s.id === 2).remaining, 2);
    assert.match(f.validateSlotChoice(cal, '2026-10-27', 1), /fully booked/);
    assert.equal(f.validateSlotChoice(cal, '2026-10-27', 2), null);
});

test('blocked date makes every slot unavailable', () => {
    const cal = f.computeAvailability({
        method: 'delivery', slots, blocked: [{ date: '2026-10-27', method: null }], occupancy: {},
        now: at('2026-10-26T10:00:00'), days: 2, cutoffHour: 14
    });
    assert.equal(cal[0].blocked, true);
    assert.match(f.validateSlotChoice(cal, '2026-10-27', 2), /closed/);
});

test('blocked for pickup only does not block delivery', () => {
    const cal = f.computeAvailability({
        method: 'delivery', slots, blocked: [{ date: '2026-10-27', method: 'pickup' }], occupancy: {},
        now: at('2026-10-26T10:00:00'), days: 1, cutoffHour: 14
    });
    assert.equal(cal[0].blocked, false);
});

test('same-day pickup slot starting within 2 hours is not offered', () => {
    const cal = f.computeAvailability({
        method: 'pickup', slots, blocked: [], occupancy: {},
        now: at('2026-10-26T11:30:00'), days: 1, cutoffHour: 14
    });
    const today = cal[0];
    assert.equal(today.slots.find(s => s.id === 3).available, false);   // 10:00 already passed
    assert.equal(today.slots.find(s => s.id === 4).available, true);    // 14:00 >= 11:30 + 2h
    const later = f.computeAvailability({ method: 'pickup', slots, blocked: [], occupancy: {}, now: at('2026-10-26T12:30:00'), days: 1, cutoffHour: 14 });
    assert.equal(later[0].slots.find(s => s.id === 4).available, false);  // 14:00 < 12:30 + 2h
});

test('slot id from another date is rejected', () => {
    const cal = f.computeAvailability({ method: 'delivery', slots, blocked: [], occupancy: {}, now: at('2026-10-26T10:00:00'), days: 7, cutoffHour: 14 });
    assert.match(f.validateSlotChoice(cal, '2026-10-29', 1), /does not exist/);   // Thursday has no slot 1
    assert.match(f.validateSlotChoice(cal, '2027-01-01', 1), /not available/);
});
