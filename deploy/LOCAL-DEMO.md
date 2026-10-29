# Local demo (for interviews)

Runs the whole store on your machine: real catalog (285 products), pickup/delivery,
server-side pricing, simulated online payment, admin and driver apps.

## 1. Start the services (Docker Desktop running)

```bash
docker compose -f docker-compose.local.yml up -d
# wait until http://localhost:8055/server/health answers 200
```

## 2. Database (first time only)

```bash
PG="docker exec -i unistyles-website-v2-postgres-1 psql -U unistyles -d unistyles_db -v ON_ERROR_STOP=1 -q"
$PG < database/init.v2.sql
DIRECTUS_URL=http://127.0.0.1:8055 DIRECTUS_ADMIN_EMAIL=admin@example.com DIRECTUS_ADMIN_PASSWORD='Demo1234!' node services/directus/bootstrap.js
$PG < database/init.v2.sql          # second run installs the catalog foreign keys
cd services/backend && npm ci
DATABASE_URL=postgresql://unistyles:localdev@localhost:5433/unistyles_db NODE_PATH=$(pwd)/node_modules node ../../database/migrate.js
cd ../..
DATABASE_URL=postgresql://unistyles:localdev@localhost:5433/unistyles_db node database/seed-demo.js
```

## 3. Run the apps

```bash
# backend (terminal 1)
cd services/backend && cp .env.demo.example .env && npm run dev
# frontend (terminal 2)
cd services/frontend && npm ci
VITE_API_URL=http://localhost:3000 VITE_DIRECTUS_URL=http://localhost:8055 npm run dev
```

Open http://localhost:5173

| Account | Email | Password |
|---|---|---|
| Owner (admin) | admin@example.com | Demo1234! |
| Delivery person | driver@example.com | Demo1234! |
| Customer | cliente@example.com | Demo1234! |

Directus (catalog CMS): http://localhost:8055 — admin@example.com / Demo1234!

## 4. Tests

```bash
cd services/backend
npm test                       # 45 unit tests: pricing, zones/slots, state machine, payment decisions
TEST_API_URL=http://localhost:3000 \
TEST_DATABASE_URL=postgresql://unistyles:localdev@localhost:5433/unistyles_db \
npm run test:integration       # 9 end-to-end API scenarios against the real database
```

## 5. Demo script (≈5 minutes)

1. **Product** — open a Leonisa bra: sizes/colours come from real variants; sold-out combinations are crossed out; size guide.
2. **Cart** — free-delivery progress bar uses the threshold from the server.
3. **Checkout** — guest. Choose *Delivery*, tap the map in Punda → zone + fee appear (decided by the server from the pin).
   Tap the sea → "outside our delivery zones" → switch to pickup. Pick a day and time window (capacity shown).
4. **Pay online** — mock gateway: *Decline* → "payment not completed" → *Try again* → *Approve* → confirmation page with timeline.
5. **Admin** (admin@example.com) — Dashboard → Orders → open the order → *Being prepared* → *Out for delivery* is refused for a
   pickup order (state machine). Schedule tab shows the day's windows. Inventory: register a WhatsApp sale. Settings: rules marked
   *pending owner approval*.
6. **Driver** (driver@example.com) — assign a delivery order to the driver in admin; on /driver: *Start*, *Delivered* requires the
   cash checkbox for cash-on-delivery.
7. **Track** — /track-order with order number + last 4 phone digits.

Talking points: server is the only source of truth for money; idempotent order creation; payment marked paid exactly once
(row lock + provider re-check + amount check); stock reserved per variant and released on expiry; every stock change logged
(`inventory_movements`); unapproved business rules are configurable, not hardcoded.

## Reset

```bash
docker compose -f docker-compose.local.yml down -v
```
