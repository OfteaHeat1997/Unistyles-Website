# Unistyles E-Commerce

E-commerce platform for **Unistyles Curaçao** — Colombian beauty products (lingerie, perfumes, skincare, accessories) for the Caribbean market.

## Production

| Service | URL |
|---|---|
| Storefront | `unistylescuracao.com` |
| API | `api.unistylescuracao.com` |
| CMS (Directus admin) | `cms.unistylescuracao.com` |

Hosting: Coolify (Docker Compose, Traefik + Let's Encrypt). License: private — proprietary to Unistyles Curaçao.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite, Tailwind CSS, React Query, React Router, Socket.IO client |
| Backend | Node 20 / Express, Socket.IO, Helmet, JWT, bcrypt |
| CMS | Directus 11 (REST + admin UI on the shared Postgres) |
| Data | PostgreSQL 16, Redis 7 |
| Hosting | Coolify (Traefik routing, auto-SSL) |
| Payments | Sentoo (Curaçao), Cash on Delivery, Bank Transfer |
| Messaging | WhatsApp Business / Cloud API, SMTP for order email |

## Architecture

```
                          ┌──────── Coolify (Traefik + Let's Encrypt) ────────┐
        Internet ──HTTPS──▶                                                    │
                          │  unistylescuracao.com    →  frontend  (Nginx :80) │
                          │  api.unistylescuracao.com →  backend  (:3000)     │
                          │  cms.unistylescuracao.com →  directus (:8055)     │
                          └──────────┬─────────────────┬───────────┬──────────┘
                                     │ HTTP            │ HTTP      │ HTTP
                                     ▼                 ▼           ▼
                              ┌──────────────┐  ┌──────────┐  ┌──────────┐
                              │   frontend   │  │ backend  │  │ directus │
                              │  Vite SPA +  │  │ Express  │  │   CMS    │
                              │    Nginx     │  │ + WS /ws │  │  REST    │
                              └──────────────┘  └────┬─────┘  └────┬─────┘
                                                     │             │
                                          ┌──────────┴─────────────┴──────────┐
                                          │  Postgres 16          Redis 7    │
                                          │  (shared schema)     (cache)     │
                                          └──────────────────────────────────┘
```

- **Frontend** serves the SPA. The browser hits `api.*` and `cms.*` directly (no internal proxy in production).
- **Backend** owns auth, cart, checkout, orders, payments, admin. Reads catalog data from the same Postgres tables Directus manages.
- **Directus** is the content/catalog admin layer. Schema lives in code (`services/directus/bootstrap.js`).
- **Postgres** is shared: backend's own tables (orders, users, payments…) plus Directus-managed tables (products, categories, brands…).
- **Redis** is used for cart sessions (backend) and schema/permissions cache (Directus).

## Repository layout

```
unistyles-website-v2/
├── docker-compose.yml          # Source of truth for the Coolify stack
├── services/                   # Runtime services
│   ├── backend/                # Express API + Socket.IO  (:3000)
│   ├── frontend/               # Vite SPA served by Nginx (:80)
│   └── directus/               # bootstrap.js + future custom extensions
├── database/
│   ├── init.sql                # Auto-loaded by Postgres on first boot
│   ├── migrations/             # SQL migrations (manual run via npm run db:migrate)
│   └── seed-data.json          # Source for the Directus content migration
├── deploy/
│   ├── README.md               # Coolify deployment runbook
│   └── scripts/
│       ├── backup-db.sh
│       └── migrate-strapi-to-directus.js
├── archive/                    # Legacy assets kept for historical reference
├── backups/                    # Runtime: db backups (gitignored)
├── docs/
├── .github/workflows/ci.yml
├── .env.example                # Local dev env template
├── .env.coolify.example        # Production env checklist
└── README.md
```

## Getting started

### Prerequisites
- Docker + Docker Compose
- Node.js 20+ (only needed for native dev mode)
- A `.env` file (copy from `.env.example` and fill in)

### Quickest path — full Docker stack

```bash
cp .env.example .env                                         # fill in secrets first
docker compose up -d --build                                 # build & boot all 5 services
node services/directus/bootstrap.js                          # one-time CMS schema
node deploy/scripts/migrate-strapi-to-directus.js            # one-time seed import
```

Open http://localhost — frontend at root.

### Native dev mode (hot reload)

Better for active frontend/backend work. Run the data + CMS in Docker, the apps natively:

```bash
docker compose up -d postgres redis directus
node services/directus/bootstrap.js                          # one-time

cd services/backend  && npm install && npm run dev           # nodemon  :3000
cd services/frontend && npm install && npm run dev           # vite     :5173
```

The Vite dev server proxies `/api` to backend and `/items` /  `/assets` to Directus, so the SPA at `localhost:5173` "just works" without CORS.

## Environment variables

`.env.example` lists every variable. The required ones for local dev:

| Variable | Notes |
|---|---|
| `DB_PASSWORD` | Postgres user password |
| `REDIS_PASSWORD` | Redis password |
| `JWT_SECRET` | Auth signing key — 64+ chars |
| `DIRECTUS_KEY`, `DIRECTUS_SECRET` | Directus internal — UUID v4 each |
| `DIRECTUS_ADMIN_EMAIL`, `DIRECTUS_ADMIN_PASSWORD` | First admin login |
| `FRONTEND_URL`, `BACKEND_URL`, `DIRECTUS_URL` | Public URLs (CORS allowlist) |

Generate secrets:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"   # JWT_SECRET
node -e "console.log(require('crypto').randomUUID())"                      # DIRECTUS_KEY / SECRET
```

For production: copy `.env.coolify.example` and paste each var into Coolify's UI (mark secrets with the eye icon).

## Deployment

See [`deploy/README.md`](deploy/README.md) for the full Coolify runbook. Summary:

1. Push this repo to GitHub.
2. Coolify → New Resource → Docker Compose → point at the repo.
3. Set env vars from `.env.coolify.example`. Set the `FRONTEND_VITE_*` ones as **build-time** vars (Vite bakes them in).
4. Per-service domains: `frontend → unistylescuracao.com`, `backend → api.*`, `directus → cms.*`. Postgres and Redis stay internal.
5. Deploy. Once Directus is healthy, run `node services/directus/bootstrap.js` to create the schema.
6. Run `node deploy/scripts/migrate-strapi-to-directus.js` to import the catalog from `database/seed-data.json`.

## API surface

Backend (`api.unistylescuracao.com`):

| Group | Endpoints |
|---|---|
| Auth | `POST /api/auth/{register,login,logout,refresh}` |
| Catalog (read) | `GET /api/{products,perfumes,skincare,categories,brands,variants}` |
| Cart & orders | `GET\|POST /api/cart`, `POST /api/orders`, `GET /api/orders/track/:orderNumber` |
| Payments | `POST /api/payments/{cod,sentoo,bank-transfer}` + Sentoo webhook |
| Customer ops | `/api/users`, `/api/reviews`, `/api/coupons`, `/api/newsletter`, `/api/delivery` |
| Admin | `/api/admin/*` (JWT-gated, `role = admin`) |
| WhatsApp | `/api/whatsapp/webhook` (Meta Cloud API verification + inbound) |
| Health | `GET /health`, `GET /metrics` (admin-only) |
| Real-time | Socket.IO at `wss://api.unistylescuracao.com/ws` |

CMS (`cms.unistylescuracao.com`):

| Group | Endpoints |
|---|---|
| Public read | `GET /items/{products,categories,brands,pages,homepage,business_settings}` |
| Assets | `GET /assets/{file_uuid}` |
| Admin UI | `/admin` (Directus Data Studio) |

## Operations

| Task | Command |
|---|---|
| Tail logs | `docker compose logs -f <service>` |
| Backup database | `./deploy/scripts/backup-db.sh` (writes to `backups/`, 30-day retention) |
| Run SQL migrations | `cd services/backend && npm run db:migrate` |
| Re-import catalog | `node deploy/scripts/migrate-strapi-to-directus.js` (idempotent on `legacy_id`) |
| Reapply Directus schema | `node services/directus/bootstrap.js` (idempotent) |
| Force frontend rebuild | Coolify → frontend service → **Force Rebuild** (needed when `VITE_*` build args change) |

## CI

`.github/workflows/ci.yml` runs on every push/PR to `master`:

- **Backend** — lint + Postgres/Redis integration boot + `/health` smoke
- **Frontend** — `npm ci` + `vite build`
- **Docker** — builds both images to validate Dockerfiles

## License

Private — Unistyles Curaçao. All rights reserved.
