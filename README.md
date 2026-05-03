# Unistyles E-Commerce

E-commerce platform for Unistyles Curacao — Colombian beauty products for the Caribbean market.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite, Tailwind CSS, React Query, React Router |
| Backend | Node.js / Express, Postgres, Redis, JWT, Socket.IO |
| CMS | Directus 11 (admin UI on top of the shared Postgres) |
| Hosting | Coolify (Docker Compose stack, Traefik for routing + SSL) |
| Payments | Sentoo (Curaçao), Cash on Delivery, Bank Transfer |
| Messaging | WhatsApp Business / Cloud API |

## Repository layout

```
unistyles-website-v2/
├── docker-compose.yml          # Source of truth for the deployment
├── services/                   # Runtime services built into images
│   ├── backend/                # Express API + Socket.IO (port 3000)
│   ├── frontend/               # Vite SPA served by Nginx (port 80)
│   └── directus/               # bootstrap.js + future Directus extensions
├── database/                   # Schema and seed data
│   ├── init.sql                # Auto-loaded by Postgres on first boot
│   ├── migrations/             # SQL migrations (manual run)
│   └── seed-data.json          # Source for the Directus content migration
├── deploy/                     # Operations artifacts
│   ├── README.md               # Coolify deployment runbook
│   └── scripts/                # backup-db.sh, migrate-strapi-to-directus.js
├── archive/                    # Legacy assets kept for reference (pre-migration)
├── .github/workflows/          # CI: lint, test, Docker build
├── .env.example                # Local development env template
└── .env.coolify.example        # Production env checklist for Coolify
```

## Getting started

### Local development (without Docker)

```bash
# 1. Copy env template
cp .env.example .env  # then fill in values

# 2. Start Postgres + Redis (lightest path: Docker for the data stack only)
docker compose up -d postgres redis

# 3. Backend
cd services/backend
npm install
npm run db:migrate
npm run dev          # nodemon, port 3000

# 4. Directus (in another shell)
docker compose up -d directus
node services/directus/bootstrap.js   # one-time schema setup

# 5. Frontend (in another shell)
cd services/frontend
npm install
npm run dev          # Vite dev server, port 5173
```

### Full stack with Docker

```bash
docker compose up -d
```

| URL | Service |
|---|---|
| http://localhost (port 80) | Frontend |
| http://localhost:3000 | Backend (when port-forwarded for local dev) |
| http://localhost:8055 | Directus admin |

## Deployment to Coolify

See [deploy/README.md](deploy/README.md) for the full runbook. Summary:

1. Push the repo to GitHub.
2. In Coolify: **New Resource → Docker Compose**, point at this repo.
3. Set env vars from `.env.coolify.example` (mark secrets).
4. Configure per-service domains: frontend → `unistylescuracao.com`, backend → `api.*`, directus → `cms.*`.
5. Deploy. Run `node services/directus/bootstrap.js` to create the CMS schema.
6. Run `node deploy/scripts/migrate-strapi-to-directus.js` to import seed data.

## API

Backend exposes `/api/auth`, `/api/products`, `/api/perfumes`, `/api/skincare`, `/api/categories`, `/api/cart`, `/api/orders`, `/api/payments`, `/api/users`, `/api/admin`, `/api/whatsapp`, `/api/newsletter`, `/api/reviews`, `/api/coupons`, `/api/variants`, `/api/delivery`. Health check at `/health`. Real-time order updates via Socket.IO at `/ws`.

## License

Private — Unistyles Curacao.
