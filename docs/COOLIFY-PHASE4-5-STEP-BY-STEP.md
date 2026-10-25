# Coolify — Phase 4 (Backend/API) and Phase 5 (Frontend/Store)

> Continuation of `docs/COOLIFY-SEPARATED-SETUP.md`.
> The real values (passwords, internal hosts) are in
> **`COOLIFY-SECRETOS-produccion.txt`** (repo root, NOT pushed to GitHub).

## Status verified on 22 Aug 2026

| Service | Coolify resource | Actual status (checked from outside) |
|---|---|---|
| PostgreSQL | `unistyles-postgres` | ✅ Running (Directus connects to it) |
| Redis | `redis-database-dzmrnt3yx4godrkflyvv5rqf` | ✅ Running |
| Directus / CMS | `unistyles-directus` | ✅ `https://cms.unistylescuracao.com/server/health` → `{"status":"ok"}` |
| Store | `unistyles`? (to be identified) | ⚠️ `https://unistylescuracao.com` → 200 and shows the store, but we need to confirm WHICH resource serves it |
| API / Backend | — | ❌ Does NOT exist. `https://api.unistylescuracao.com` does not respond (DNS does point to 157.173.193.90) |

**Conclusion:** Phase 4 (backend) is missing, and Phase 5 (frontend) needs to be confirmed or redone.

---

## Phase 4 — Backend / API  (`unistyles-backend`)

### 4.1 Create the resource

1. Coolify → project **Unistyles** → environment **production**.
2. **+ New** → **Application** → **Public Repository**.
3. Repository URL: `https://github.com/OfteaHeat1997/Unistyles-Website`
   · Branch: `master` → **Check repository** → **Continue**.
4. Build Pack: **Dockerfile**.

### 4.2 Configuration (*Configuration → General* tab)

| Field | Exact value |
|---|---|
| Name | `unistyles-backend` |
| Base Directory | `/services/backend` |
| Dockerfile Location | `/Dockerfile` |
| Ports Exposes | `3000` |
| Domains | `https://api.unistylescuracao.com` |

Click **Save** before continuing.

### 4.3 Environment variables

*Configuration → Environment Variables* → **Developer view** (paste as a block) →
copy the block from the **FASE 4 — BACKEND** section of
`COOLIFY-SECRETOS-produccion.txt` → **Save**.

Required for startup (if any is missing, the container shuts itself down):
`DATABASE_URL`, `REDIS_URL`, `JWT_SECRET` (at least 32 characters).

### 4.4 Deploy

**Deploy** → watch the *Logs*. Success signal:

```
UNISTYLES E-COMMERCE API SERVER
Status:  Running
Port:    3000
```

### 4.5 Verify

```bash
curl https://api.unistylescuracao.com/health
# esperado: {"status":"healthy","timestamp":"...","uptime":...}
```

---

## Phase 4-bis — Create the backend tables (IMPORTANT!)

With Coolify's managed database, `database/init.sql` **no longer runs
automatically** (docker-compose used to do it). Without this step, `/health` responds
fine but sign-up, cart, orders and payments fail.

1. Coolify → resource **`unistyles-postgres`** → **Terminal** button.
2. Check which tables exist:

```bash
psql -U unistyles -d unistyles_db -c '\dt'
```

- If `users`, `orders`, `payments`, `carts`… already appear → **do nothing else**.
- If only tables starting with `directus_` appear → run:

```bash
wget -qO- https://raw.githubusercontent.com/OfteaHeat1997/Unistyles-Website/master/database/init.sql | psql -U unistyles -d unistyles_db
```

3. Check again with the `\dt` from step 2: 12 new tables should appear
   (`users`, `addresses`, `orders`, `order_items`, `payments`, `carts`,
   `reviews`, `newsletter_subscribers`, `settings`, `coupons`,
   `product_variants`, `whatsapp_messages`).

---

## Phase 5 — Frontend / Store  (`unistyles-frontend`)

**Before creating anything:** find out which resource currently serves `unistylescuracao.com`
(in the panel, the resource named `unistyles`). Two paths:

- **If that resource is already a Git-based Application with Base Directory
  `/services/frontend`** → just rename it to `unistyles-frontend`,
  review the 3 build variables and redeploy (steps 5.2 and 5.3).
- **If it is the old block (5-in-1 Docker Compose)** → create the new resource
  as below and shut down the old one at the end (Phase 8).

### 5.1 Create the resource

**+ New** → **Application** → **Public Repository** → same repo and branch
`master` → Build Pack **Dockerfile**.

| Field | Exact value |
|---|---|
| Name | `unistyles-frontend` |
| Base Directory | `/services/frontend` |
| Dockerfile Location | `/Dockerfile` |
| Ports Exposes | `80` |
| Domains | `https://unistylescuracao.com` |

### 5.2 Variables — BUILD variables, not regular ones!

*Environment Variables* → add these 3, ticking the
**“Is Build Variable?”** checkbox on each one:

```
VITE_API_URL=https://api.unistylescuracao.com
VITE_DIRECTUS_URL=https://cms.unistylescuracao.com
VITE_USE_CMS=true
```

Vite “bakes” them into the bundle at build time. If they are not marked as
build variables, the store loads but keeps spinning.

### 5.3 Deploy and verify

- `https://unistylescuracao.com` → the store loads and shows products.
- Open the cart / log in → there should no longer be a network error
  (that is what Phase 4 fixes).

---

## Next: Phases 6, 7 and 8

- **Phase 6** — restore the 285 products (`bootstrap.js` + `migrate-strapi-to-directus.js`).
- **Phase 7** — test the 3 URLs.
- **Phase 8** — delete the old Docker Compose resource and the orphaned `postgresql-database`.
