# Separate databases (PostgreSQL + Redis) in Coolify

> These two are Coolify **managed resources** (*Databases* section).
> They are the pieces that must **never** be deleted again. That is why they come first.

## 1) PostgreSQL (resource "unistyles-postgres")

When creating it in Coolify (**+ New Resource → Databases → PostgreSQL**), configure:

| Field in Coolify | Value |
|---|---|
| Name | `unistyles-postgres` |
| Username (Postgres User) | `unistyles` |
| Password | *(your `DB_PASSWORD` from the password manager)* |
| Database (Initial DB) | `unistyles_db` |
| Image / Version | `postgres:16-alpine` |

After creating it:
- **Enable automatic backups** (*Backups* tab → schedule a daily one).
  This is what was missing before and what prevents losing the products again.
- Copy the **"Postgres URL (Internal)"** that Coolify shows — you need it
  for the backend and for Directus. The internal host is NOT `postgres` or
  `localhost`; it is a name like `xxxxxxxx` that Coolify assigns.

### ⚠️ Mandatory step: load the backend schema once

The `database/init.sql` file creates the backend tables (users, orders,
payments, coupons…). It used to run automatically; now it has to be run once
against the new database. From your laptop (or over SSH on the server):

```bash
# Option A — from your laptop, using Coolify's temporary PUBLIC URL
#   (enable "Make it publicly available" on the Postgres resource, copy the host and port)
psql "postgresql://unistyles:<DB_PASSWORD>@<PUBLIC_HOST>:<PORT>/unistyles_db" \
  -f database/init.sql

# Option B — over SSH inside the server (safer, no public port opened)
ssh root@157.173.193.90
docker exec -i $(docker ps --format '{{.Names}}' | grep unistyles-postgres) \
  psql -U unistyles -d unistyles_db < database/init.sql
```

If you see it say `already exists` when running it again, that is fine: it means it was already there.

## 2) Redis (resource "unistyles-redis")

**+ New Resource → Databases → Redis**:

| Field in Coolify | Value |
|---|---|
| Name | `unistyles-redis` |
| Password | *(your `REDIS_PASSWORD` from the password manager)* |
| Image / Version | `redis:7-alpine` |

Afterwards: copy the **"Redis URL (Internal)"**. It is used by the backend (`REDIS_URL`)
and Directus (`REDIS`).

---

## Reminder: everything on ONE server is fine

Your 5 separate resources run on the **same** server ("Unistyles Server",
157.173.193.90 — 6 cores, 11.7 GB RAM). That is correct and sufficient.

- "Separate" = **independent resources/containers**, not different servers.
- If one resource goes down, the others keep running because each one is its own container.
- You do not need to pay for several servers. A single one, well organised, is enough.
