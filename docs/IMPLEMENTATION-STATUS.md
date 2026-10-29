# Implementation status — 25 Oct 2026

Spec: `docs/PROMPT-FULL-IMPLEMENTATION.md`. States: **Verified** (test or run proves it) · **Implemented** (code exists,
not exercised by a test yet) · **Pending** (needs a decision, credentials or production access).

## Defects from the spec (§3)

| # | Fix | State | Evidence |
|---|---|---|---|
| D01/D02 | Single API client `src/utils/api.js` (`VITE_API_URL`); all relative `/api` calls replaced; nginx returns JSON 502 for `/api` on the storefront origin | Verified | `vite build` bundle contains no origin-less fetch; dev server served all pages against `http://localhost:3000` |
| D03/D04 | `users.role` (customer/admin/driver) + `requireRole()` re-checked in DB; `/api/auth/me` works | Verified | integration test "roles…" |
| D05 | `bank` → `bank_transfer` | Implemented | `src/config.js` |
| D06 | Pickup option end to end (location, slot, fee 0, pay at pickup) | Verified | integration "pickup + cash…" |
| D07 | Zone from the map pin, server-side polygons (`delivery_zones.polygon`) | Verified | unit `fulfillment.test.js`, integration "quote: pin…" |
| D08 | Server quote `POST /api/checkout/quote`; order recomputes it inside the transaction | Verified | integration "online payment…" checks total |
| D09 | Slots: capacity, cut-off, blocked days, same-day pickup rule; capacity re-checked under row lock | Verified (logic) | unit `fulfillment.test.js` |
| D10 | Real variants on the product page; variant owns stock; variant required when it exists | Verified | integration "variant product…", "last unit…" |
| D11 | `Idempotency-Key` on order creation (unique index + race handling) | Verified | integration "…submitted twice" |
| D12 | Expiry job releases stock of unpaid online orders (advisory lock, every 5 min) | Verified | integration "unpaid online order expires…" |
| D13 | Payment confirmed exactly once (row lock, provider re-fetch, amount/currency check, `payment_events` log) | Verified | unit `paymentConfirm.test.js`, integration 3 parallel approvals → 1 paid |
| D14 | Order read/cancel only for owner, admin or tracking token | Implemented | `routes/orders.js#canAccess` |
| D15 | Tracking needs order number + phone last 4 (or token); rate limited | Verified | integration "tracking…" |
| D16 | State machine with pickup/delivery states; no preparation without payment | Verified | unit `orderState.test.js`, integration 422 on impossible jump |
| D17 | Coupon id/code snapshot, `coupon_redemptions`, per-user limit | Implemented | `services/pricing.js`, `routes/orders.js` |
| D18 | No invented fee fallback | Implemented | `hooks/useDeliveryZones.js`, checkout error state |
| D19 | No popup: same-tab redirect to the payment page | Implemented | `pages/PaymentCallback.jsx` |
| D20 | Catalog data quality (perfume slug, pagination, stock fields) | Pending | owned by the database rebuild (`docs/PROMPT-REBUILD-DATABASE.md`) |
| D21 | Dead code cleanup | Partly | `utils/api.js` is now the live client; old backup file and unused product routes still there |
| D22 | Tests | Verified | 45 unit + 9 integration, `npm test`, `npm run test:integration` |

## New screens

Checkout (4 steps, all states), payment page (processing / paid / declined + retry / expired), mock gateway, order
confirmation & tracking with timeline and cancel, track-order lookup, admin (dashboard, orders + detail drawer,
schedule, inventory + stock history, payments + CSV, settings with "pending approval", users/roles), driver app.

Built and served by Vite without errors; **not yet clicked through in a real browser** in this session (the Chrome
extension was not connected). Do one manual pass with `deploy/LOCAL-DEMO.md` §5 before an interview.

## Pending — decisions / access (cannot be closed in code)

- Owner approval of every value marked *pending approval* (threshold 80 vs 100, `>=`, cut-off 14:00, zones/fees, slots,
  payment window, bank account number, support number, return policy). Change them in Admin → Settings.
- Sentoo: merchant credentials, sandbox run, confirm whether the status response includes amount/currency
  (`SENTOO_VERIFY_AMOUNT=false` disables the check if it does not), real low-value transaction, refund procedure.
- Production database is still v1 (`init.sql`). Target is `init.v2.sql` + `migrations/004` (the rebuild prompt). Run
  `node database/migrate.js` after the v2 schema exists; it baselines 001–003 automatically.
- Coolify: set `VITE_API_URL` build arg on the frontend; add `PAYMENTS_MODE` only for a demo environment (never in production).
- Legal review (Curaçao) of privacy/returns text; WhatsApp templates for the new statuses (free-text fallback exists).
- Playwright browser E2E suite (spec §5.17) not written yet.
