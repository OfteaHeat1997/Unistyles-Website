# Prompt: rebuild the Unistyles database from scratch

> To paste into the AI of the developer who will rebuild the database.
> Written on 25 Oct 2026. Repo: github.com/OfteaHeat1997/Unistyles-Website (branch `master`).
> Copy everything below the line.

---

## Role

You are a senior software engineer specialising in data modelling, PostgreSQL and Docker deployment.
You will help me **redesign and implement the database from scratch** for a real online store (this is not an
academic project). Work with the actual code in the repository. If you cannot confirm something in the code,
say so explicitly instead of making it up.

## 1. The business

Unistyles Curaçao: an online store run by an owner in Curaçao. It sells 9 categories: bras, panties, shapewear,
colognes (perfumes), creams, sunscreen, deodorants, facial cleansing and accessories/jewellery.
Current inventory: **285 products**. Only bras have variants (size + colour, 77 SKUs).
Currency: XCG/ANG. Payments via **Sentoo** (local payment gateway). Notifications via **WhatsApp** and email. Delivery by island zones.

The sources of truth for the inventory live **outside the repo**: Word catalogue documents and photos on Google Drive.
I will send them to you separately. The repo has a derived version in `database/seed-data.json`.

## 2. Current stack

- **Frontend**: React + Vite, served by nginx (`services/frontend`). Uses React Query.
- **Backend**: Node/Express (`services/backend`). Routes in `src/routes/*.js`; the `controllers/` folder is empty.
- **CMS**: Directus 11 (`services/directus/bootstrap.js` creates its collections). **Stay on Directus 11, not 12.**
- **Database**: PostgreSQL **16** (not 18, for compatibility with Directus 11). A single DB `unistyles_db`,
  user `unistyles`, shared between Directus and the backend.
- **Redis**: sessions and cache.
- **Infra**: a Contabo VPS (Ubuntu 24.04, 6 cores, 11.7 GB RAM) with **Coolify v4.3.x** installed.
  Cloudflare in front of the domain.

## 3. Coolify deployment: current status

Chosen architecture (“Plan A”): **each service is a separate Coolify resource**, with no docker-compose.
The reason is that a redeploy of the compose stack wiped the Postgres volume and the DB was lost.
If one service goes down, the others keep running.

| Resource | Type | Status | Domain |
|---|---|---|---|
| `unistyles-postgres` | Database (postgres:16-alpine, automatic backups) | Running | internal |
| redis (`redis-database-dzmrnt…`) | Database | Running | internal |
| `unistyles-directus` | App, Docker image, port 8055, volume `/directus/uploads` | Running | cms.unistylescuracao.com |
| backend (`unistyles--website:main-pl7f…`) | App, Dockerfile, base dir `/services/backend`, port 3000 | Running | api.unistylescuracao.com |
| frontend | App, Dockerfile, base dir `/services/frontend` | Pending: confirm which resource serves the root domain | unistylescuracao.com |

There are leftover resources that will be deleted once everything is green: the old compose (`unistyles--website:main-t8jw…`, Exited),
an unidentified `unistyles` app, a `Frontend/service` and a `Unistyles n8n`.

Deployment phases: 1 Postgres ✅ · 2 Redis ✅ · 3 Directus ✅ · 4 backend ✅ · 4-bis tables ✅ (with `init.sql` **v1**) ·
**5 frontend ⏳ · 6 load catalogue ⏳ (half done) · 7 verification · 8 delete old resources**.

Coolify gotchas already confirmed:
- A managed DB **does not run** `docker-entrypoint-initdb.d`. The schema is applied manually with `psql` from the resource's Terminal.
- In Coolify 4.3.10+ the Branch field is locked to `main` when creating the resource; you have to change it to `master` afterwards under Git Source.
- Domain with port: `api.unistylescuracao.com:3000` (Coolify's syntax for routing to the container port).
- Frontend build environment variables: `VITE_API_URL`, `VITE_DIRECTUS_URL`, `VITE_USE_CMS`.
- Secrets are **not** in the repo (it is public). I will send them separately. Never write them into any versioned file.

Existing documentation in the repo: `docs/COOLIFY-SEPARATED-SETUP.md`, `docs/COOLIFY-PHASE4-5-STEP-BY-STEP.md`,
`deploy/separated/*.env.example`, `docs/DATABASE_ARCHITECTURE.md`, `docs/research/05-database.html`.

## 4. Current database: why it needs to be rebuilt

Today there are **two data owners in the same DB**:
- **Directus** owns the catalogue: `products, categories, brands, pages, customers, business_settings, homepage, directus_files`.
- **Custom SQL** owns commerce: `users, addresses, carts, orders, order_items, payments, coupons,
  product_variants, reviews, newsletter_subscribers, settings, whatsapp_messages` (+ in v2: `delivery_zones,
  order_status_history, coupon_redemptions`).

Verified defects:
1. **Two schemas**: `database/init.sql` (v1, the one applied in production) and `database/init.v2.sql`
   (v2, better: CHECK constraints, prices frozen in `order_items`, FKs to Directus added at the end with guards,
   idempotent). v2 uses `IF NOT EXISTS`, so it **does not fix tables already created by v1**.
2. **`reviews.product_id` is a UUID in v1**, but Directus products have an integer id → `GET /api/reviews/product/:id` returns 500.
3. **The `users.role` column does not exist**, but `routes/auth.js` (~l.295) does `SELECT … role …` and `pages/Admin.jsx`
   checks `user.role === 'admin'`. The table has `is_admin BOOLEAN`, which is what `middleware/auth.js` uses.
   Result: `/api/auth/me` fails and the admin area is inaccessible.
4. **Duplicated variants and stock**: `products.variants` is a **JSON** field in Directus and there is also a
   `product_variants` table that nobody syncs. `products.stock_quantity` and `in_stock` are also independent of each other.
5. **Size and colour are free text**: there are 24 size strings for about 10 real sizes (`38B`, `38 B`, `38  B`, typo `368C`, S/M/L mixed with bra sizes)
   and colours with typos and duplicates (`BERDE`, `BEIBE`, `NEGRO` and `BLACK`, `BEIGE STAMPADO` and `BEIGE  ESTAMPADO`).
6. **Catalogue duplicated in 4 places**: Directus, `frontend/src/config.js`, `frontend/src/data/productData.js`, `database/seed-data.json`.
7. **Migrations with a repeated number**: `001_add_coupons_and_variants.sql` and `001_add_whatsapp_messages.sql`.
8. **Zero tests** across the whole project.

## 5. Why the inventory displays incorrectly on the website (verified in production on 25 Oct 2026)

The data in Directus matches the seed (285 products, correct counts per category). The failures are in how
it was modelled and how it is queried:

- **The Perfumes page is empty**: `pages/Perfume.jsx` requests the category `'perfume'`, but the real slug is `colonias`.
  `?filter[category_id][slug][_eq]=perfume` → 0 results. `colonias` → 133.
- **Products are missing from categories**: `fetchProducts` has `limit = 25` by default and the pages do not paginate.
  Of 33 bras only 25 are shown, and of 133 colognes also 25.
- **The listing does not fetch stock or variants**: `PRODUCT_LIST_FIELDS` in `services/directusService.js` does not include
  `stock_quantity` or `variants`, so the grid cannot show sizes, colours or out-of-stock items.
- **Inconsistent stock**: 49 products have `stock_quantity = 0` but `in_stock = true`.
- **Empty gender filters**: all 133 colognes have `gender = 'unisex'`, so the women/men filters return nothing.
- **Images**: all 285 products have `image = null` (no image has been uploaded to Directus). Everything depends on
  `legacy_image`, a static path served by the frontend (`/images/...`). Of the 270 distinct paths,
  **77 do not load in production** (they return no image), and one product has none at all.
- **Badly generated names**: e.g. `Leonisa BraESTAMPADOC` or `Leonisa BraSTAMPADO` (concatenation without a space in the import script).
  There are 16 duplicate names.

## 6. What I am asking you to do

### Step 1: understand (do not write code yet)
First read: `database/init.sql`, `database/init.v2.sql`, `database/migrations/*`, `services/directus/bootstrap.js`,
`services/backend/src/routes/*.js`, `services/backend/src/middleware/auth.js`, `services/frontend/src/services/directusService.js`,
`services/frontend/src/hooks/useProducts.js`, `database/seed-data.json` and `deploy/scripts/migrate-strapi-to-directus.js`.
Then give me a summary of which table or collection each backend route and each frontend page uses.

### Step 2: architecture decisions (give me your recommendation and why)
- **Who owns the catalogue?** Option A: Directus (the owner's panel for editing products).
  Option B: custom SQL tables, with Directus only as a panel on top of them. There must be **a single source of truth**.
- **Variants as a table, not JSON**: `product_variants` with a unique SKU, per-variant stock and per-variant price,
  and a real FK to `products`.
- **Controlled vocabularies**: `sizes` and `colors` tables (or the Directus equivalent) with FKs, so typos are not repeated.
- **Stock**: a single column, with `in_stock` derived rather than stored separately.
- **Roles**: `is_admin` or `role`. Pick one and align backend + frontend.
- **Images**: upload them to Directus (`directus_files`) or serve them statically. Bear in mind there are ~900 original photos (1.5 GB)
  that should be optimised first.

### Step 3: diagrams (Mermaid, so they render on GitHub)
1. **Full ERD** of the new schema (`erDiagram`): PKs, FKs and cardinalities, with Directus tables marked as such.
2. **Flowchart of the inventory data flow** (`flowchart TD`): Word/Drive → cleaning/normalisation → seed →
   DB load → Directus → API → store page.
3. **Coolify deployment flowchart** (`flowchart LR`): Cloudflare → the 5 resources → what talks to what and on which port.
4. **Checkout sequence** (`sequenceDiagram`): cart → coupon → delivery zone → order → Sentoo → webhook →
   status change → WhatsApp/email, including failure cases.
5. **State diagrams** (`stateDiagram-v2`) for `orders.status` and `payments.status` with the real values.
6. **Flowchart of the rebuild procedure** (Step 5).

### Step 4: implementation
- A **single** idempotent `database/schema.sql` (or numbered migrations with no duplicates, using a real tool:
  node-pg-migrate, Knex or whichever you recommend) that replaces `init.sql` and `init.v2.sql`.
- A reproducible **import script** that reads the cleaned catalogues and loads the inventory, normalising sizes,
  colours and names. It should validate and report errors instead of loading garbage.
- Backend and frontend changes that depend on the schema: `role`/`is_admin`, `reviews.product_id`, perfumes slug,
  pagination, listing fields and stock.
- **Tests**: at a minimum, schema tests (constraints, FKs) and import tests (per-category counts match the source).

### Step 5: plan for applying it in Coolify (without losing data)
- Backup first: `pg_dump` from the `unistyles-postgres` Terminal, and download the dump.
- There are currently no real orders or customers, so a **clean drop and recreate** of the backend tables is possible.
  Confirm this first by running `SELECT count(*)` on `users` and `orders`.
- Exact order of commands: schema → Directus bootstrap → FKs → import → verification.
- Verification checklist with real URLs: `https://api.unistylescuracao.com/health`,
  `https://cms.unistylescuracao.com/items/products?aggregate[count]=*`, and that each category page shows its real total.

## 7. Rules
- Nothing destructive in production without a verified backup and without my confirmation.
- No secrets in repo files. The repo is **public**.
- PostgreSQL 16 and Directus 11. Do not upgrade versions during this work.
- Cite the file (and line) for every claim about the current code.
- If something is half done or unclear, write **“Not implemented / unclear:”** instead of assuming.
