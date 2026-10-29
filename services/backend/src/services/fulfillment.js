// ===========================================
// FULFILLMENT — pickup vs delivery, zones, slots.
// Pure functions at the top (unit-tested in test/fulfillment.test.js),
// DB loaders at the bottom. The server never trusts a zone or fee sent by
// the browser: the zone comes from the pin (lat/lng) or, as a fallback,
// from the neighborhood name.
// ===========================================

// Curaçao is UTC-4 all year (no DST).
const CURACAO_OFFSET_MINUTES = -4 * 60;

// --- Geometry ---------------------------------------------------------------

// Ray casting. ring = [[lng, lat], ...] (GeoJSON order)
function pointInRing(lng, lat, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i];
        const [xj, yj] = ring[j];
        const intersect = (yi > lat) !== (yj > lat) &&
            lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
        if (intersect) inside = !inside;
    }
    return inside;
}

function pointInPolygonCoords(lng, lat, polygonCoords) {
    // polygonCoords[0] = outer ring, the rest = holes
    if (!polygonCoords?.length || !pointInRing(lng, lat, polygonCoords[0])) return false;
    for (let h = 1; h < polygonCoords.length; h++) {
        if (pointInRing(lng, lat, polygonCoords[h])) return false;
    }
    return true;
}

function pointInGeometry(lng, lat, geometry) {
    if (!geometry) return false;
    if (geometry.type === 'Polygon') return pointInPolygonCoords(lng, lat, geometry.coordinates);
    if (geometry.type === 'MultiPolygon') {
        return geometry.coordinates.some(poly => pointInPolygonCoords(lng, lat, poly));
    }
    return false;
}

/**
 * @param {Array} zones - rows with { polygon, sort_order, ... }
 * @returns the first matching zone (lowest sort_order) or null
 */
function findZoneByPoint(zones, lat, lng) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const ordered = [...zones].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    return ordered.find(z => pointInGeometry(lng, lat, z.polygon)) || null;
}

// "Santa María" and "santa maria" are the same neighbourhood.
const normalizeName = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

function findZoneByArea(zones, area) {
    if (!area) return null;
    const needle = normalizeName(area);
    return zones.find(z => (z.neighborhoods || []).some(n => normalizeName(n.name) === needle)) || null;
}

// --- Dates & slots ----------------------------------------------------------

/** Local Curaçao wall-clock parts for a JS Date */
function curacaoParts(date = new Date()) {
    const local = new Date(date.getTime() + CURACAO_OFFSET_MINUTES * 60000);
    return {
        date: local.toISOString().slice(0, 10),
        hour: local.getUTCHours(),
        minutes: local.getUTCHours() * 60 + local.getUTCMinutes(),
        weekday: local.getUTCDay()
    };
}

function addDays(isoDate, days) {
    const d = new Date(`${isoDate}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}

function weekdayOf(isoDate) {
    return new Date(`${isoDate}T00:00:00Z`).getUTCDay();
}

function timeToMinutes(t) {
    const [h, m] = String(t).split(':').map(Number);
    return h * 60 + (m || 0);
}

/**
 * Earliest bookable date for a method.
 * Delivery: next day if ordered before the cut-off hour, otherwise the day after.
 * Pickup: same day is allowed (slot must start at least 2 hours from now).
 */
function earliestDate(method, now, cutoffHour) {
    const local = curacaoParts(now);
    if (method === 'pickup') return local.date;
    return addDays(local.date, local.hour < cutoffHour ? 1 : 2);
}

/**
 * Compute the slot calendar.
 * @param {object} p
 * @param {'pickup'|'delivery'} p.method
 * @param {Array} p.slots      - fulfillment_slots rows {id, method, weekday, start_time, end_time, capacity, is_active}
 * @param {Array} p.blocked    - blocked_dates rows {date:'YYYY-MM-DD', method|null}
 * @param {Object} p.occupancy - { 'YYYY-MM-DD|slotId': count }
 * @param {Date}   p.now
 * @param {number} p.days      - how many days to return starting at the earliest date
 * @param {number} p.cutoffHour
 * @returns [{date, weekday, blocked, slots:[{id, label, start, end, capacity, remaining, available}]}]
 */
function computeAvailability({ method, slots, blocked, occupancy, now = new Date(), days = 7, cutoffHour = 14 }) {
    const start = earliestDate(method, now, cutoffHour);
    const local = curacaoParts(now);
    const blockedSet = new Set(
        (blocked || [])
            .filter(b => !b.method || b.method === method)
            .map(b => (b.date instanceof Date ? b.date.toISOString().slice(0, 10) : String(b.date).slice(0, 10)))
    );
    const methodSlots = (slots || []).filter(s => s.method === method && s.is_active !== false);

    const calendar = [];
    for (let i = 0; i < days; i++) {
        const date = addDays(start, i);
        const weekday = weekdayOf(date);
        const isBlocked = blockedSet.has(date);
        const daySlots = methodSlots
            .filter(s => Number(s.weekday) === weekday)
            .sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time))
            .map(s => {
                const used = occupancy?.[`${date}|${s.id}`] || 0;
                const remaining = Math.max(0, Number(s.capacity) - used);
                const startMin = timeToMinutes(s.start_time);
                const tooSoon = date === local.date && startMin < local.minutes + 120;
                return {
                    id: s.id,
                    start: String(s.start_time).slice(0, 5),
                    end: String(s.end_time).slice(0, 5),
                    label: `${String(s.start_time).slice(0, 5)}–${String(s.end_time).slice(0, 5)}`,
                    capacity: Number(s.capacity),
                    remaining,
                    available: !isBlocked && !tooSoon && remaining > 0
                };
            });
        calendar.push({ date, weekday, blocked: isBlocked, slots: daySlots });
    }
    return calendar;
}

/** Validate one chosen date+slot against the computed calendar. Returns null or an error string. */
function validateSlotChoice(calendar, date, slotId) {
    const day = calendar.find(d => d.date === date);
    if (!day) return 'The selected date is not available.';
    if (day.blocked) return 'We are closed on the selected date.';
    const slot = day.slots.find(s => Number(s.id) === Number(slotId));
    if (!slot) return 'The selected time window does not exist for that date.';
    if (!slot.available) return slot.remaining === 0
        ? 'That time window is fully booked. Please choose another one.'
        : 'That time window is no longer available.';
    return null;
}

// --- DB loaders -------------------------------------------------------------

const getDb = () => require('../utils/db');

async function loadZones(client) {
    const runner = client || getDb();
    const result = await runner.query(
        `SELECT id, slug, name, fee, free_threshold, estimated_days, color, sort_order, polygon, neighborhoods
         FROM delivery_zones WHERE is_active = true ORDER BY sort_order, id`
    );
    return result.rows;
}

async function loadCalendar(method, { client, now = new Date(), days, cutoffHour } = {}) {
    const runner = client || getDb();
    const start = earliestDate(method, now, cutoffHour);
    const end = addDays(start, days);
    const [slots, blocked, occupancy] = await Promise.all([
        runner.query('SELECT * FROM fulfillment_slots WHERE method = $1 AND is_active = true', [method]),
        runner.query(
            `SELECT to_char(date, 'YYYY-MM-DD') AS date, method FROM blocked_dates WHERE date BETWEEN $1 AND $2`,
            [start, end]
        ),
        runner.query(
            `SELECT to_char(delivery_date, 'YYYY-MM-DD') AS date, fulfillment_slot_id AS slot_id, COUNT(*)::int AS n
             FROM orders
             WHERE fulfillment_method = $1 AND delivery_date BETWEEN $2 AND $3
               AND fulfillment_slot_id IS NOT NULL
               AND status NOT IN ('cancelled','expired')
             GROUP BY 1, 2`,
            [method, start, end]
        )
    ]);
    const occ = {};
    for (const r of occupancy.rows) occ[`${r.date}|${r.slot_id}`] = r.n;
    return computeAvailability({
        method, slots: slots.rows, blocked: blocked.rows, occupancy: occ, now, days, cutoffHour
    });
}

async function loadPickupLocations(client) {
    const runner = client || getDb();
    const result = await runner.query(
        'SELECT id, name, address, latitude, longitude, hours, instructions FROM pickup_locations WHERE is_active = true ORDER BY id'
    );
    return result.rows.map(l => ({
        id: l.id,
        name: l.name,
        address: l.address,
        lat: l.latitude !== null ? parseFloat(l.latitude) : null,
        lng: l.longitude !== null ? parseFloat(l.longitude) : null,
        hours: l.hours,
        instructions: l.instructions
    }));
}

module.exports = {
    pointInGeometry,
    findZoneByPoint,
    findZoneByArea,
    curacaoParts,
    addDays,
    earliestDate,
    computeAvailability,
    validateSlotChoice,
    loadZones,
    loadCalendar,
    loadPickupLocations
};
