# Unistyles on Coolify — SEPARATED Setup (each service on its own)

> **Goal:** stop having the 5 services squeezed into a single block
> (`docker-compose.yml`) and move to **5 independent resources** in Coolify,
> grouped by type — just like the tidy panel you liked (Applications /
> Databases). If one goes down, the others keep running. The database lives
> separately, with automatic backups, and **never gets deleted on its own again.**

> **22 Aug 2026 — Phases 1, 2 and 3 done.** The exact remaining clicks
> (Phase 4 backend, Phase 4-bis tables, Phase 5 frontend) are in
> [COOLIFY-PHASE4-5-STEP-BY-STEP.md](COOLIFY-PHASE4-5-STEP-BY-STEP.md).

## What your store looks like (modelled on the panel you liked)

```
DATABASES                         (se crean PRIMERO — son las que protegemos)
  ● unistyles-postgres            pgsql interno  ·  backups automáticos ON
  ● unistyles-redis               redis interno

APPLICATIONS
  ● unistyles-directus  (CMS)     https://cms.unistylescuracao.com
  ● unistyles-backend   (API)     https://api.unistylescuracao.com
  ● unistyles-frontend  (Tienda)  https://unistylescuracao.com
```

> The example panel (AetherCorp) also had a *Services* section
> (Auth, Email, Image-Resizer, Analytics…). **You do NOT need those yet** —
> in your case login lives inside the backend, email is the backend's SMTP, and
> image resizing is done by Directus. They are extras for the future, not for now.

## Important clarification: "localhost" is NOT a problem

In Coolify, your server is called **"localhost"** simply because Coolify is
installed on that same server. **It does not mean your website is only local** — your
site really is on the internet, on the "Unistyles Server"
(157.173.193.90, Ubuntu 24.04, 6 cores, 11.7 GB RAM). The 5 separate resources
run on that same server. "Separated" = independent containers, **not**
different servers. A single, well-organised server is the right and cheaper choice.

---

## Work order (phases)

Do it in this exact order. Do not move on to the next phase until the previous one
is green.

### Phase 0 — Before touching anything
- [ ] Have your password manager at hand with the 7 generated secrets
      (`DB_PASSWORD`, `REDIS_PASSWORD`, `JWT_SECRET`, `DIRECTUS_KEY`,
      `DIRECTUS_SECRET`, `DIRECTUS_ADMIN_PASSWORD`, `WHATSAPP_VERIFY_TOKEN`).
- [ ] **Do NOT delete** the old 5-in-1 block yet. We shut it down at the end,
      once the new setup works. That way you are never left with nothing along the way.

### Phase 1 — PostgreSQL database (separate)
Follow `deploy/separated/01-databases-notes.md` (PostgreSQL section).
- [ ] Create resource `unistyles-postgres` (user `unistyles`, db `unistyles_db`).
- [ ] Enable **automatic backups** (daily).
- [ ] Run `database/init.sql` once (backend tables).
- [ ] Copy the **Postgres URL (Internal)**.

### Phase 2 — Redis (separate)
Follow `deploy/separated/01-databases-notes.md` (Redis section).
- [ ] Create resource `unistyles-redis` (with `REDIS_PASSWORD`).
- [ ] Copy the **Redis URL (Internal)**.

### Phase 3 — Directus / CMS (separate)
- [ ] **+ New Resource → Docker Image** → `directus/directus:11`.
- [ ] Name: `unistyles-directus`.
- [ ] Paste the variables from `deploy/separated/directus.env.example`
      (filling in the `REEMPLAZAR_…` placeholders with your secrets and the internal
      Postgres/Redis hosts).
- [ ] Domain: `cms.unistylescuracao.com` · Container port: `8055`.
- [ ] Persistent volume: `/directus/uploads` (so photos are not lost).
- [ ] Deploy. Wait until you see `Server started at http://0.0.0.0:8055`.

### Phase 4 — Backend / API (separate)
- [ ] **+ New Resource → Application → Public/Private Repository** (your Git repo).
- [ ] Base Directory: `/services/backend` · Dockerfile: `Dockerfile`.
- [ ] Name: `unistyles-backend`.
- [ ] Paste the variables from `deploy/separated/backend.env.example` (with the
      internal `DATABASE_URL` and `REDIS_URL` you copied).
- [ ] Domain: `api.unistylescuracao.com` · Container port: `3000`.
- [ ] Deploy. Check `https://api.unistylescuracao.com/health` → JSON `healthy`.

### Phase 5 — Frontend / Store (separate)
- [ ] **+ New Resource → Application → your Git repo**.
- [ ] Base Directory: `/services/frontend` · Dockerfile: `Dockerfile`.
- [ ] Name: `unistyles-frontend`.
- [ ] Paste the 3 variables from `deploy/separated/frontend.build-args.example`
      into **Build-time Environment Variables** (not the regular ones!).
- [ ] Domain: `unistylescuracao.com` · Container port: `80`.
- [ ] Deploy.

### Phase 6 — Restore the 285 products
With Directus up, from your laptop:
```bash
DIRECTUS_URL=https://cms.unistylescuracao.com \
DIRECTUS_ADMIN_EMAIL=admin@unistylescuracao.com \
DIRECTUS_ADMIN_PASSWORD=<tu DIRECTUS_ADMIN_PASSWORD> \
node services/directus/bootstrap.js          # crea las colecciones

DIRECTUS_URL=https://cms.unistylescuracao.com \
DIRECTUS_ADMIN_EMAIL=admin@unistylescuracao.com \
DIRECTUS_ADMIN_PASSWORD=<tu DIRECTUS_ADMIN_PASSWORD> \
node deploy/scripts/migrate-strapi-to-directus.js   # carga los 285 productos
```

### Phase 7 — Test everything
- [ ] `https://unistylescuracao.com` → store loads with products.
- [ ] `https://api.unistylescuracao.com/health` → `healthy`.
- [ ] `https://cms.unistylescuracao.com/admin` → you can log in to Directus.

### Phase 8 — Shut down the old block
Only when EVERYTHING above is green:
- [ ] In Coolify, stop and delete the old "Docker Compose" resource (the 5-in-1 one).
- [ ] Also delete the orphaned `postgresql-database` resource from the false start.

---

## What is still needed to give you the exact clicks?

To fill in the real internal hosts (`REEMPLAZAR_HOST_POSTGRES`,
`REEMPLAZAR_HOST_REDIS`) I need a screenshot of your actual panel at
`cloud.unistylescuracao.com` showing the resources already created. With that I can give you
the exact internal URLs, ready to copy and paste.
