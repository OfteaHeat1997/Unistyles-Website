# Coolify Deployment Runbook

This is the operations runbook for deploying the Unistyles e-commerce stack to a Coolify v4 host. The repo is already structured for it (`docker-compose.yml` is the source of truth, no host port bindings, healthchecks on every service, env-driven configuration).

The stack is **frontend + backend + Directus + Postgres + Redis**, exposed under three subdomains:

| Service | Domain | Coolify routing |
|---|---|---|
| Frontend (Vite + Nginx) | `unistylescuracao.com` | port 80 |
| Backend (Node/Express + Socket.IO) | `api.unistylescuracao.com` | port 3000 |
| Directus CMS | `cms.unistylescuracao.com` | port 8055 |
| Postgres | — (internal only) | — |
| Redis | — (internal only) | — |

---

## 1. Prerequisites

- A Coolify v4 instance with a public IP and Traefik enabled (default).
- DNS control over `unistylescuracao.com`.
- The repo pushed to a GitHub remote that Coolify can reach.

## 2. DNS

Create three A records (or CNAMEs through Cloudflare) pointing at the Coolify host:

```
unistylescuracao.com           A   <coolify_ip>
api.unistylescuracao.com       A   <coolify_ip>
cms.unistylescuracao.com       A   <coolify_ip>
```

Wait for propagation (usually <5 min) before the first deploy — Let's Encrypt will need to resolve them.

## 3. Generate secrets

Run locally and copy the outputs into Coolify env vars in step 5:

```bash
# JWT_SECRET (64 hex chars)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# DIRECTUS_KEY and DIRECTUS_SECRET (one UUID each)
node -e "console.log(require('crypto').randomUUID())"

# DB_PASSWORD, REDIS_PASSWORD, DIRECTUS_ADMIN_PASSWORD
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"

# WHATSAPP_VERIFY_TOKEN (random opaque string)
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

## 4. Create the Coolify resource

1. In Coolify, **New Resource → Docker Compose**.
2. Source: connect the GitHub repo, branch `master`, root directory `/`.
3. Build pack: **Docker Compose**.
4. Compose location: `docker-compose.yml` (default).

## 5. Set environment variables

Use `.env.coolify.example` at the repo root as the checklist. Paste each into Coolify → **Environment Variables** for the resource. Mark every secret-looking value as **Secret** (the eye icon) so it's redacted in logs.

**Build-time vars** (must also be set under "Build-time Environment Variables"):

```
FRONTEND_VITE_API_URL=https://api.unistylescuracao.com
FRONTEND_VITE_DIRECTUS_URL=https://cms.unistylescuracao.com
FRONTEND_VITE_USE_CMS=true
```

These are passed to the frontend `Dockerfile` as ARGs and baked into the bundle. Changing them later requires a frontend rebuild.

## 6. Configure per-service domains

In Coolify, open each service in the resource and set its public domain:

| Service | Domain | Port |
|---|---|---|
| `frontend` | `https://unistylescuracao.com` | 80 |
| `backend` | `https://api.unistylescuracao.com` | 3000 |
| `directus` | `https://cms.unistylescuracao.com` | 8055 |

`postgres` and `redis` — leave domain blank (internal only).

## 7. First deploy

Click **Deploy**. Watch the logs in this order:

1. `postgres` reaches healthy (usually <30s on first init).
2. `redis` reaches healthy.
3. `backend` healthy at `/health`.
4. `directus` healthy at `/server/health` — first boot takes ~60s because it runs its own initial migration into Postgres.
5. `frontend` healthy.

If `directus` keeps restarting, the most common cause is a missing `DIRECTUS_KEY` or `DIRECTUS_SECRET` (both are required, even on first run).

## 8. Bootstrap Directus schema

Once `directus` is healthy, create the 7 collections (products, categories, brands, customers, business_settings, pages, homepage):

```bash
DIRECTUS_URL=https://cms.unistylescuracao.com \
DIRECTUS_ADMIN_EMAIL=admin@unistylescuracao.com \
DIRECTUS_ADMIN_PASSWORD=<your_admin_password> \
node services/directus/bootstrap.js
```

The script is idempotent — re-running it is safe. Output should be a list of `+ collection`, `+ field`, `+ relation` lines for the first run; subsequent runs print `·` (already exists) for everything.

You can run it from your laptop (the script just hits the public Directus URL) or from inside any Coolify-attached shell.

## 9. Migrate seed data

```bash
DIRECTUS_URL=https://cms.unistylescuracao.com \
DIRECTUS_ADMIN_EMAIL=admin@unistylescuracao.com \
DIRECTUS_ADMIN_PASSWORD=<your_admin_password> \
node deploy/scripts/migrate-strapi-to-directus.js
```

This reads `database/seed-data.json` and upserts categories, brands, and products into Directus. Idempotent on `legacy_id`. Images stay as `legacy_image` paths (`/images/bra/...`) — they're served by the frontend container, so the URLs continue to work without uploading anything to Directus.

To populate proper Directus media later: log into `https://cms.unistylescuracao.com/admin`, upload images to the relevant product, and the `image` UUID column will be set. The frontend prefers `image` over `legacy_image` automatically.

## 10. Smoke tests

```bash
# Health
curl -I https://unistylescuracao.com/
curl -I https://api.unistylescuracao.com/health
curl -I https://cms.unistylescuracao.com/server/health

# Backend → Directus tables
curl https://api.unistylescuracao.com/api/categories | jq '.categories | length'
curl https://api.unistylescuracao.com/api/products?limit=3 | jq '.products | length'

# Directus public read
curl 'https://cms.unistylescuracao.com/items/categories?fields=slug&limit=20' | jq '.data | length'
```

Then in a browser:

- Home page renders, hero slider loads (will be empty until you add hero slides in Directus).
- Category page (e.g., `/perfume`) shows products.
- Product detail page renders an image (legacy path) and price.
- Add to cart → cart shows the item with image.
- Checkout reaches the payment selector (verifies backend reachability + CORS).
- Browser devtools → Network: confirm `wss://api.unistylescuracao.com/ws` connects (Socket.IO).

## 11. Database backups

The repo's `deploy/scripts/backup-db.sh` works under Coolify too — pass the Coolify-prefixed container name:

```bash
POSTGRES_CONTAINER=$(docker ps --format '{{.Names}}' | grep postgres)
./deploy/scripts/backup-db.sh
```

Schedule it via Coolify's built-in **Scheduled Tasks** (cron) feature pointing at the resource, or run it from the host shell.

## 12. Retire Vercel

After the smoke tests pass and you're confident in the new setup:

1. In Vercel: pause production deployments on the unistyles project.
2. In your DNS: point `unistylescuracao.com` away from Vercel (the records from step 2 supersede it).
3. Keep the Vercel project for ~1 week as a rollback path. Delete after.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Frontend 502 | Check the `frontend` container logs in Coolify — usually a stale build cache. Trigger a fresh deploy with **Force Rebuild**. |
| Frontend loads but API calls 404 | `VITE_API_URL` build arg is wrong. It's baked in at build, so re-trigger the build with the correct value. |
| Backend `cors` error in browser console | `FRONTEND_URL` env var on the backend doesn't match the actual origin. Restart the backend after fixing. |
| Directus 500 on `/items/products` | Public role doesn't have read permission. Re-run `services/directus/bootstrap.js`, or set it manually under Settings → Roles → Public. |
| Images render as broken icons | `legacy_image` paths point at `/images/...` which the frontend container serves. If they 404, the frontend image folder didn't make it into the build — check `services/frontend/.dockerignore`. |
| Sentoo webhook fails | Check `SITE_URL` env var on the backend matches the public domain so the redirect URL Sentoo sends users to is correct. |
| Strapi-prefixed container names referenced anywhere | Search the repo for `unistyles-strapi` and remove — those are leftovers from the old compose layout. |
