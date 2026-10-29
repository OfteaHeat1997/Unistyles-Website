
# Unistyles — Complete Beginner's Guide

> A step-by-step walkthrough of your project, from "what is this thing?" to "the website is live and selling products."
>
> Written for someone who has never deployed a self-hosted website before. If a sentence uses a technical word you don't know, look at the **Glossary** at the bottom of this document — every term used here is defined there.

---

## Table of contents

1. [What is this project, exactly?](#1-what-is-this-project-exactly)
2. [What does "self-hosting" mean?](#2-what-does-self-hosting-mean)
3. [The five pieces of your website](#3-the-five-pieces-of-your-website)
4. [How the pieces work together](#4-how-the-pieces-work-together)
5. [What you need before starting](#5-what-you-need-before-starting)
6. [Phase A — Push the code to GitHub](#6-phase-a--push-the-code-to-github)
7. [Phase B — Point your domain at the server](#7-phase-b--point-your-domain-at-the-server)
8. [Phase C — Create the Coolify resource](#8-phase-c--create-the-coolify-resource)
9. [Phase D — Configure environment variables](#9-phase-d--configure-environment-variables)
10. [Phase E — Configure the three domains](#10-phase-e--configure-the-three-domains)
11. [Phase F — First deploy](#11-phase-f--first-deploy)
12. [Phase G — Set up your CMS schema](#12-phase-g--set-up-your-cms-schema)
13. [Phase H — Import your inventory](#13-phase-h--import-your-inventory)
14. [Phase I — Smoke-test the live site](#14-phase-i--smoke-test-the-live-site)
15. [Day-to-day operations](#15-day-to-day-operations)
16. [Troubleshooting](#16-troubleshooting)
17. [Glossary](#17-glossary)

---

## 1. What is this project, exactly?

You are deploying an **online store** for Unistyles Curaçao. The store sells lingerie, perfumes, skincare, and accessories to customers in the Caribbean.

The store is a **website** that runs on the internet. Customers go to `unistylescuracao.com` in their phone or laptop browser, browse products, add them to a cart, pay, and have them delivered.

A website like this is not a single program. It's actually **five small programs** that work together. You'll see in section 3 what each one does.

The code lives on your computer (in `C:\Users\maria\Documents\GitHub\unistyles-website-v2`). To make it visible to the world, you need to:
- Put the code on a **server** (a computer that's always on, with a public internet address).
- Tell that server how to run the five programs.
- Tell people's browsers where to find the server (DNS).

That's deployment. The rest of this guide walks you through it.

---

## 2. What does "self-hosting" mean?

There are two ways to put a website online:

**Managed hosting** — You upload your code to a managed hosting company. They run it for you. Easy, but you pay per usage and you don't control the server.

**Self-hosting** — You run the website on your own server (often rented from DigitalOcean, Hetzner, or similar — they sell you a Linux machine for $5-20/month). You control everything: where files are saved, when updates happen, what software is installed.

You're going with **self-hosting** using a tool called **Coolify**.

**Coolify** is a graphical control panel that runs on your server. It makes self-hosting almost as easy as managed hosting — you click buttons in a web UI instead of typing Linux commands. It handles things like:
- Pulling your code from GitHub.
- Building and starting the five programs.
- Issuing free SSL certificates so your site is `https://` (secure).
- Routing internet traffic to the right program.

You only need to set Coolify up once. After that, every time you push new code to GitHub, you click "Deploy" in Coolify and it updates the live site.

---

## 3. The five pieces of your website

Open your project folder. You'll see a folder called `services/` and inside it three sub-folders: `frontend/`, `backend/`, `directus/`. Plus the deployment uses two more services that aren't in `services/` because they're standard off-the-shelf programs: `postgres` and `redis`.

Here's what each one does, in plain language:

### 3.1 Frontend — what your customers see

A **React** application. It's the website itself: the home page, product pages, the cart, the checkout form. When a customer types `unistylescuracao.com`, this is what loads in their browser.

The frontend is "dumb" in an important way: it doesn't know anything about products, prices, or orders directly. When it needs that data, it asks the **Backend** (for orders/cart) or **Directus** (for product information).

### 3.2 Backend — the order-taker and cashier

A **Node.js / Express** application. It handles everything that needs to be private or transactional:
- User accounts (register, log in, log out).
- The shopping cart.
- Placing orders.
- Processing payments through Sentoo (the Curaçao payment gateway).
- Sending order confirmations to customers via WhatsApp and email.
- Tracking inventory levels.

When a customer adds something to cart, the **Frontend** sends a request to the **Backend**, which writes it to the database.

### 3.3 Directus — your product manager

A **Headless CMS** (Content Management System). Think of it like the back-office program a store manager uses to add new products, change prices, upload photos, write descriptions.

Directus comes with a beautiful admin web interface at `cms.unistylescuracao.com/admin`. You log in there and you can:
- Add a new product
- Change a price
- Upload product photos
- Mark something as out of stock
- Edit category descriptions
- Update the homepage hero slider

You don't need to touch any code to do those things. That's the point of having a CMS.

### 3.4 PostgreSQL — the filing cabinet

A **database**. This is where every piece of data is stored permanently: your customers, your orders, your products, your prices.

Both the **Backend** and **Directus** read and write to the same Postgres database. They're like two clerks sharing the same filing cabinet — backend writes orders to one drawer, Directus writes products to another.

### 3.5 Redis — the short-term memory

An **in-memory cache**. Faster than Postgres but doesn't keep data forever. Used for:
- Active shopping carts (a cart that's been abandoned for 30 days disappears).
- Session tokens (so users stay logged in).
- Caching Directus permissions (so it's snappy).

You almost never interact with Redis directly. It just makes things fast.

---

## 4. How the pieces work together

When a customer visits your store and buys something, here's the journey:

```
   Customer's browser
          │
          │  1. Types unistylescuracao.com
          ▼
   Your Coolify server (Traefik routes the request)
          │
          ├──→  Frontend (Nginx serving React) ──→ Browser displays the homepage
          │
          │  2. Customer clicks "Bras" category
          │
          ├──→  Frontend asks Directus for products in "bras" category
          │     (cms.unistylescuracao.com/items/products?filter[category]=bras)
          │
          ├──→  Directus reads from Postgres ──→ returns JSON of bras
          │
          ├──→  Frontend renders the bras with images
          │
          │  3. Customer adds to cart
          │
          ├──→  Frontend asks Backend to add to cart
          │     (api.unistylescuracao.com/api/cart/add)
          │
          ├──→  Backend writes the cart item to Redis
          │
          │  4. Customer checks out, pays with Sentoo
          │
          ├──→  Backend creates an order in Postgres
          ├──→  Backend asks Sentoo to charge the card
          ├──→  Sentoo replies with a payment URL
          ├──→  Customer is redirected to Sentoo, pays, comes back
          ├──→  Sentoo notifies Backend (webhook) that payment succeeded
          ├──→  Backend marks the order as paid in Postgres
          ├──→  Backend sends a WhatsApp + email confirmation
          │
          ▼
   You see the order in Directus admin and prepare it for delivery.
```

That's the whole loop.

---

## 5. What you need before starting

Tick off each item before moving on.

### 5.1 A GitHub account
You already have one (`OfteaHeat1997`). ✓

### 5.2 A repository on GitHub
You need to **create one named `Unistyles-Website`** (private). See **Phase A** below.

### 5.3 A server with Coolify installed
You need a Linux server (a "VPS") running Coolify. Common providers:
- **Hetzner** — cheap, good for Europe (€4/month covers this project).
- **DigitalOcean** — popular, has a 1-click Coolify image ($12/month).
- **Vultr / Linode** — similar.

If you don't have one yet, sign up with one of them, create a small VPS (2 GB RAM minimum, 4 GB recommended), and follow [Coolify's installation guide](https://coolify.io/docs) — it's literally one shell command. Once Coolify is installed, you'll have a URL like `coolify.your-domain.com` to log into. **You appear to have one already** based on the screenshot you showed me.

### 5.4 A domain name
You own `unistylescuracao.com` ✓ (going from earlier conversation).

### 5.5 The third-party accounts whose credentials you'll need
You don't need them all on day one — the deploy will succeed without them, you just won't have those features until you fill them in. But you'll want most of them eventually:

- **Sentoo** account at https://portal.sentoo.io — for credit-card and bank payments.
- **Meta for Developers** (https://developers.facebook.com) — for the WhatsApp Business Cloud API.
- **Gmail** (or another SMTP provider) — for sending order confirmation emails.

---

## 6. Phase A — Push the code to GitHub

Right now, your code is only on your laptop. GitHub is where the code lives in the cloud, and it's where Coolify will pull it from.

### Step A.1 — Create the empty repository on GitHub

1. Open https://github.com/new in a browser.
2. **Repository name:** `Unistyles-Website` (exactly this — your local config already points there).
3. **Owner:** `OfteaHeat1997` (your account).
4. **Description:** "E-commerce platform for Unistyles Curaçao."
5. **Visibility:** **Private** (do NOT make it public — your code references credentials in env templates).
6. **Initialize this repository with…** — leave ALL boxes unchecked (no README, no .gitignore, no license). Your local repo already has those.
7. Click the green **Create repository** button.

You'll land on an empty repo page that says something like "Quick setup — if you've done this kind of thing before". You don't need to copy any of those instructions; we already configured your local repo.

### Step A.2 — Push your code

Open your terminal (in your project folder, `C:\Users\maria\Documents\GitHub\unistyles-website-v2`).

Run:

```bash
git push -u origin master
```

The first time you push, your terminal (or a popup window from "Git Credential Manager") will ask you to log in to GitHub. Approve it. Wait for the upload to finish — could take 30-60 seconds depending on your internet.

When it finishes, refresh https://github.com/OfteaHeat1997/Unistyles-Website in your browser. You should see all your folders and files listed: `services/`, `database/`, `deploy/`, etc.

✓ **Phase A is complete.**

---

## 7. Phase B — Point your domain at the server

Coolify needs a stable internet address to receive traffic. The domain registrar (where you bought `unistylescuracao.com`) is what links your domain to your server's IP address.

### Step B.1 — Find your Coolify server's IP

In your Coolify dashboard, the server IP is usually shown on the **Servers** tab. Or run `curl ifconfig.me` on the server itself. Note the IPv4 address — it'll look like `123.45.67.89`.

### Step B.2 — Create three DNS records

Log in to your domain registrar (the place you bought `unistylescuracao.com` — could be GoDaddy, Namecheap, Cloudflare, etc.). Find the **DNS** or **DNS Records** section. Create three **A records**, each pointing at the same IP:

| Type | Name | Value | TTL |
|---|---|---|---|
| A | `@` (or `unistylescuracao.com`) | `<your server IP>` | 300 |
| A | `api` | `<your server IP>` | 300 |
| A | `cms` | `<your server IP>` | 300 |

After saving, wait 5–15 minutes for DNS to propagate. To check, open a terminal and run:

```bash
nslookup unistylescuracao.com
nslookup api.unistylescuracao.com
nslookup cms.unistylescuracao.com
```

All three should return your server's IP. If they don't yet, wait longer.

✓ **Phase B is complete.**

---

## 8. Phase C — Create the Coolify resource

Coolify calls each app it deploys a "resource". You're creating one resource that covers all five services from your `docker-compose.yml`.

### Step C.1 — In Coolify, create the resource

1. From the left sidebar, click **Projects**.
2. If you don't have a project yet, click **+ New Project** and name it `Unistyles`. Click into it.
3. Inside the project, click **+ New Resource**.
4. Pick **Docker Compose** (NOT "Docker Compose Empty" — you want the one that pulls from a Git repo).

### Step C.2 — Connect your GitHub repo

1. Coolify will ask you to connect a Git source. If GitHub isn't connected yet, follow Coolify's prompt to install its GitHub App on your account.
2. Choose the source: **GitHub**.
3. Choose the repo: `OfteaHeat1997/Unistyles-Website`.
4. Choose the branch: `master`.
5. Compose file path: `docker-compose.yml` (this is the default).
6. Click **Create Resource** (or **Save**).

Coolify will pull the repo and parse the compose file. You should see five services listed in the resource overview: `frontend`, `backend`, `directus`, `postgres`, `redis`.

✓ **Phase C is complete.**

---

## 9. Phase D — Configure environment variables

This is the page in your screenshot. Environment variables are how you tell each program its secret values (passwords, API keys, public URLs).

### Step D.1 — Paste the variables

1. In Coolify, on the resource page, click the **Environment Variables** tab in the middle column.
2. Click into the big yellow textbox labeled **Production Environment Variables**.
3. Paste the entire block I gave you in the previous reply. It already has secret values pre-generated for you.
4. Click **Save All Environment Variables** at the bottom.

⚠️ **Save these values somewhere outside Coolify too** — write them in your password manager (Bitwarden, 1Password, even a Notes app):
- `DIRECTUS_ADMIN_EMAIL` and `DIRECTUS_ADMIN_PASSWORD` — you'll log into the Directus admin with these.
- `DB_PASSWORD` — you'll need it if you ever restore from a backup.
- `JWT_SECRET` — losing this logs every customer out.

### Step D.2 — Mark the FRONTEND_VITE_* vars as build-time

This step is critical and easy to miss.

1. At the top of the env page, click **Normal view**.
2. You'll now see one variable per row.
3. Find these three variables:
   - `FRONTEND_VITE_API_URL`
   - `FRONTEND_VITE_DIRECTUS_URL`
   - `FRONTEND_VITE_USE_CMS`
4. On each one, click the row and toggle the **"Is Build Time?"** (or "Build Variable") switch **ON**.
5. Save again.

**Why this matters:** the frontend is built once into a static bundle. If these variables aren't marked as build-time, the build won't see them and the frontend won't know where to find the API. The site will load but every "loading…" will spin forever.

### Step D.3 — Fill in third-party credentials when you have them

When you sign up for Sentoo, WhatsApp Cloud API, and Gmail SMTP, come back to this page and update:
- `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID`, `WHATSAPP_APP_SECRET`
- `SENTOO_API_KEY`, `SENTOO_MERCHANT_ID`
- `SMTP_USER`, `SMTP_PASSWORD`

After updating, click **Save** and then click **Redeploy** at the top of the resource — the new values only take effect after a redeploy.

✓ **Phase D is complete.**

---

## 10. Phase E — Configure the three domains

Each public-facing service needs its own subdomain.

### Step E.1 — Open the Configuration tab for each service

In Coolify, your resource page shows the five services. For each of `frontend`, `backend`, `directus`, click into it (the name links to its config) and scroll to the **Domains** field (sometimes called "FQDN" or "URL").

| Service | Set domain to | Container port |
|---|---|---|
| `frontend` | `https://unistylescuracao.com` | 80 |
| `backend` | `https://api.unistylescuracao.com` | 3000 |
| `directus` | `https://cms.unistylescuracao.com` | 8055 |
| `postgres` | leave blank | (internal) |
| `redis` | leave blank | (internal) |

Coolify will auto-issue an SSL certificate from Let's Encrypt for each domain when you deploy.

### Step E.2 — Save and deploy

After setting all three domains, click **Save** on each service. Then click the green **Deploy** button at the top right of the resource page.

✓ **Phase E is complete.**

---

## 11. Phase F — First deploy

The first deploy takes the longest — usually 5–10 minutes — because it needs to:
- Clone your repo.
- Build three Docker images (frontend, backend, directus).
- Pull two off-the-shelf images (postgres, redis).
- Boot all five.
- Issue Let's Encrypt SSL certificates.

Watch the **Logs** tab to see progress. You're hoping to see, in this order:

1. Postgres reports "ready to accept connections" (~30 seconds).
2. Redis reports "Ready to accept connections" (~5 seconds).
3. Backend logs `UNISTYLES E-COMMERCE API SERVER ... Status: Running` (~40 seconds).
4. Directus logs `Server started at http://0.0.0.0:8055` (~60 seconds — slowest service on first boot because it runs database migrations).
5. Frontend logs nothing dramatic — it's just Nginx serving static files.

If any service goes red ("unhealthy" or "exited"), open its log to see why. Most common first-deploy failures:
- A typo in env vars (especially in the URLs).
- The DNS records haven't propagated yet — Let's Encrypt can't issue the certificate.
- A `FRONTEND_VITE_*` variable was not marked as build-time.

### Step F.1 — Verify in your browser

Once everything is green:

| Open in browser | What you expect to see |
|---|---|
| `https://unistylescuracao.com` | Your storefront homepage. Will be mostly empty until you do Phase H. |
| `https://api.unistylescuracao.com/health` | A small JSON response: `{"status":"healthy",...}` |
| `https://cms.unistylescuracao.com/admin` | The Directus login screen. |

If all three are reachable with green padlocks (HTTPS), you have a working deployment.

✓ **Phase F is complete.**

---

## 12. Phase G — Set up your CMS schema

Directus is running but its database tables are empty. Time to define the structure (products, categories, brands, etc.).

You wrote the schema as code in `services/directus/bootstrap.js`. Running that script creates all the collections automatically.

### Step G.1 — Run the bootstrap script

Open a terminal **on your laptop**, in your project folder. Run:

```bash
DIRECTUS_URL=https://cms.unistylescuracao.com \
DIRECTUS_ADMIN_EMAIL=admin@unistylescuracao.com \
DIRECTUS_ADMIN_PASSWORD=<the password you set in Phase D> \
node services/directus/bootstrap.js
```

Replace `<the password you set in Phase D>` with the actual `DIRECTUS_ADMIN_PASSWORD` value (from your password manager).

You should see output like:

```
→ Logging in as admin@unistylescuracao.com…
+ collection brands
  + field brands.name
  + field brands.slug
  …
+ collection products
  + field products.name
  …
→ Setting public-role read permissions…
  + public:read on products
  + public:read on categories
  …
Bootstrap complete.
```

If you see `+` in the output, fields were created. If you see `·`, they already existed (the script is safe to re-run).

### Step G.2 — Log into Directus to verify

Open https://cms.unistylescuracao.com/admin in your browser. Log in with:
- Email: `admin@unistylescuracao.com`
- Password: `<your DIRECTUS_ADMIN_PASSWORD>`

In the left sidebar you should see all 7 collections listed: Products, Categories, Brands, Customers, Pages, Homepage, Business Settings. Click into Products — it'll be empty for now.

✓ **Phase G is complete.**

---

## 13. Phase H — Import your inventory

Your existing product catalog (285 products across categories like bras, perfumes, skincare) lives in `database/seed-data.json`. There's a script to import it into Directus.

### Step H.1 — Run the migration script

In the same terminal, run:

```bash
DIRECTUS_URL=https://cms.unistylescuracao.com \
DIRECTUS_ADMIN_EMAIL=admin@unistylescuracao.com \
DIRECTUS_ADMIN_PASSWORD=<same password as before> \
node deploy/scripts/migrate-strapi-to-directus.js
```

You'll see output like:

```
Reading seed data from .../database/seed-data.json
Logging into Directus at https://cms.unistylescuracao.com…
+ category bras
  + brand Leonisa (leonisa)
  · bras: 77 products processed
+ category perfume
  · perfume: 146 products processed
…
Done. Created: 285, Updated: 0
```

The script is idempotent — running it again won't duplicate anything. It uses the `legacy_id` field to know whether a product already exists.

### Step H.2 — Verify in Directus

Refresh https://cms.unistylescuracao.com/admin. Click **Products** in the sidebar. You should now see all 285 products.

Click on one — you'll see all its fields populated (name, price, color, size, brand, etc.). The image will show a `/images/...` path under "Legacy Image" but the "Image" field will be empty. **That's expected** — the actual image files are bundled inside the frontend container and are still accessible to customers via the storefront. We'll cover uploading "real" Directus images in section 15.4.

### Step H.3 — Verify in the browser

Open `https://unistylescuracao.com` and click into a category. Products should now display. ✓

✓ **Phase H is complete.** Your store has inventory and is technically live.

---

## 14. Phase I — Smoke-test the live site

Before telling customers about the URL, walk through every important user flow yourself.

### Step I.1 — Critical paths

Test each one **in a real browser**, on both desktop and mobile:

| Test | What you're checking |
|---|---|
| Open homepage | Loads, fonts render, no console errors (F12 → Console). |
| Click "Bras" category | Products list, prices in XCG, images appear. |
| Click a product | Detail page opens with image gallery, description, "Add to cart". |
| Add to cart | Cart icon shows count, sidebar shows the item. |
| Go to checkout | Form asks for email, address, delivery zone. |
| Pick "Cash on Delivery" | Order completes, redirects to a confirmation page. |
| Refresh confirmation page URL | Order details still show. |
| Log in to Directus admin | Order shows up under… well, orders are in the backend database, not Directus. Use the Adminer or psql to check. (Ops note in section 15.) |

### Step I.2 — Test a Sentoo payment (only if you've added Sentoo credentials)

Make sure `SENTOO_SANDBOX=true` first, then place a test order. Sentoo gives you sandbox card numbers in their docs. The payment should redirect, succeed, and the order should be marked paid in the database.

### Step I.3 — Test the WhatsApp webhook (only if you've added WhatsApp credentials)

In Meta for Developers, configure your webhook URL as `https://api.unistylescuracao.com/api/whatsapp/webhook` and set the verify token to whatever value `WHATSAPP_VERIFY_TOKEN` has. Click **Verify and Save**. Meta will hit your endpoint with a verification challenge — if it succeeds, the green check appears.

### Step I.4 — Switch off sandbox / staging modes

Once everything works, set `SENTOO_SANDBOX=false` in Coolify env vars and redeploy.

✓ **Your site is production-live.**

---

## 15. Day-to-day operations

Things you'll do regularly to run the store.

### 15.1 Adding a new product

1. Log in to https://cms.unistylescuracao.com/admin
2. Sidebar → **Products** → top-right **+ Create Item**
3. Fill in: name, slug (auto-fills from name), price, description, category, brand.
4. **Image** field — click it, click "Upload File", drag a JPG/PNG.
5. Toggle **In Stock** if applicable.
6. Click **Save**.

The new product appears on the storefront within a few seconds (cached for ~5 min by React Query — refresh the page to force).

### 15.2 Editing prices in bulk

1. Sidebar → Products
2. Click the **Filter** button, narrow down to e.g. "Brand = Leonisa".
3. Select multiple rows with the checkboxes.
4. Click the pencil icon on a selected row → "Edit selected fields" → set the new price → Save.

### 15.3 Marking a category as out of season

You don't delete it — you toggle visibility. Open the category in Directus, set `Show In Menu` to `false`. Save.

### 15.4 Replacing legacy product images with proper Directus uploads

The migration script set `legacy_image` paths but left `image` blank. To replace the blue placeholder URLs with real Directus-hosted images:

1. In Directus, open a product.
2. The **Image** field is empty. Click "Choose File", upload a JPG.
3. Save.

The frontend will now show the Directus-hosted image (which is automatically served at `cms.unistylescuracao.com/assets/<file-uuid>` — Directus also gives you on-the-fly resizing if you ever need it).

### 15.5 Checking orders

Orders live in the **backend's** Postgres tables, not Directus (Directus only manages content/catalog).

To view them quickly:

```bash
# from your local machine
ssh root@<your_server_ip>
docker exec -it $(docker ps --format '{{.Names}}' | grep postgres | head -1) \
  psql -U unistyles -d unistyles_db \
  -c "SELECT id, order_number, total, status, created_at FROM orders ORDER BY created_at DESC LIMIT 20;"
```

A nicer option: spin up Adminer in Coolify as a separate service later, or build an admin page in your `/api/admin` namespace (it already has skeleton endpoints).

### 15.6 Backing up the database

Run from your local machine (or schedule it on the server):

```bash
ssh root@<your_server_ip>
cd /path/to/coolify/deployment
POSTGRES_CONTAINER=$(docker ps --format '{{.Names}}' | grep postgres | head -1) \
  bash deploy/scripts/backup-db.sh
```

Backups are gzipped SQL dumps, dropped in `./backups/`. The script auto-deletes anything older than 30 days. Copy backups off-server periodically (e.g., nightly to S3 / Backblaze).

### 15.7 Pushing code changes

Every time you fix a bug or add a feature on your laptop:

```bash
cd C:\Users\maria\Documents\GitHub\unistyles-website-v2
git add .
git commit -m "fix: explain what you changed"
git push origin master
```

Then in Coolify → your resource → **Deploy** button. Coolify pulls the new code, rebuilds the affected images, and rolls them out without dropping traffic. Typical update takes 2–4 minutes.

### 15.8 Tailing logs when something seems off

In Coolify, click into a service → **Logs** tab. Or from the server:

```bash
docker logs -f --tail 200 <service-container-name>
```

---

## 16. Troubleshooting

### "I get a browser error like NET::ERR_CERT_AUTHORITY_INVALID"

DNS hasn't fully propagated, or Let's Encrypt couldn't issue the cert. Check that the A records resolve correctly with `nslookup`. In Coolify, click the service → **General** → there's usually a "Reissue certificate" or "Check DNS" button.

### "The frontend loads but every page is empty / spinner spins forever"

The `FRONTEND_VITE_*` build-time variables are missing or wrong. Solution:
1. Phase D Step D.2 — make sure all three are toggled as build-time.
2. Click **Force rebuild** on the frontend service so the new build args take effect.

### "Backend logs say `cors error origin not allowed`"

`FRONTEND_URL` env var on the backend doesn't match the actual storefront domain. Check the spelling, redeploy.

### "Directus 500 errors when fetching /items/products"

The public role doesn't have read permission. Re-run `node services/directus/bootstrap.js` — it sets permissions automatically. Or, in the Directus admin, Settings → Roles → Public → grant Read access on Products, Categories, Brands.

### "Images render as broken icons"

The `legacy_image` paths point at `/images/bra/...`. Those files live inside the frontend container's `services/frontend/public/images/` folder. If you accidentally delete that folder, or if a `.dockerignore` excludes it, images break. Check `services/frontend/.dockerignore` for the excluded list.

### "I lost my Directus admin password"

Open Coolify → resource → Environment Variables → find `DIRECTUS_ADMIN_PASSWORD`. The value is shown there. If you'd rather rotate it, change the value in Coolify, redeploy, then in the Directus admin (still using the old password it was created with), Settings → Users → admin@... → Edit → set new password.

### "Sentoo says webhook signature invalid"

Sentoo expects `SENTOO_API_KEY` to match exactly what you set in their portal. A common error is a trailing newline or a quoted value. Re-paste the API key carefully.

### "WhatsApp webhook verification fails"

Two things to check:
1. The `WHATSAPP_VERIFY_TOKEN` in Coolify env matches exactly what you typed in the Meta Developer dashboard.
2. The webhook URL in Meta is `https://api.unistylescuracao.com/api/whatsapp/webhook` (note the path).

### "I want to roll back to a previous version"

In Coolify → your resource → Deployments tab → find a previous successful deployment → click **Redeploy this version**.

---

## 17. Glossary

**API** — Application Programming Interface. A way for programs to talk to each other. Your frontend "calls" the backend's API to fetch products.

**Build-time variable** — A value the build process needs to know in advance. With Vite, the URL of the API has to be known when the JavaScript bundle is built, because it gets "baked in" — opposite of "runtime variable" which is read each time the program starts.

**CMS (Content Management System)** — A program with a friendly UI for non-technical users to edit content (products, blog posts, settings) without touching code. Directus is your CMS.

**Container** — A self-contained, lightweight package that runs a single program with all its dependencies. Each of your five services (frontend, backend, directus, postgres, redis) runs in its own container.

**CORS (Cross-Origin Resource Sharing)** — A browser security rule. Without proper CORS headers, your frontend can't call your backend if they're on different domains. The backend reads `FRONTEND_URL` from env to allow the right origin.

**Database** — A program that stores data permanently and lets other programs query it. Postgres is your database.

**DNS (Domain Name System)** — The phone book of the internet. Maps `unistylescuracao.com` to a server's IP address.

**Docker** — A program that runs containers.

**Docker Compose** — A program that runs multiple Docker containers together as a unit, defined by a `docker-compose.yml` file.

**Environment variable** — A configuration value passed to a program at startup. Format is `NAME=VALUE`. Used for secrets and per-environment settings.

**FQDN (Fully-Qualified Domain Name)** — A complete domain like `api.unistylescuracao.com` (as opposed to just the hostname `api`).

**Git** — A program that tracks changes to your code. Every "commit" is a snapshot.

**GitHub** — A website that hosts Git repositories online.

**HTTPS** — Secure HTTP. The little padlock in the browser bar. Requires an SSL certificate.

**JSON** — A common text format for sending structured data between programs.

**JWT (JSON Web Token)** — A small encrypted string the backend gives a customer when they log in. The customer sends it back with every request to prove who they are.

**Let's Encrypt** — A free SSL certificate authority. Coolify uses it via Traefik to give you HTTPS automatically.

**Migration** — A script that transforms data from one shape to another. `migrate-strapi-to-directus.js` migrates your seed file into Directus.

**Nginx** — A web server. The frontend container runs Nginx to serve the static React bundle.

**Postgres / PostgreSQL** — A specific database program. Yours runs in a container, on port 5432, accessible only inside the Coolify network.

**REST API** — A common style of API where you make HTTP requests to URLs like `/items/products` and get JSON back.

**Repository (repo)** — A folder of code tracked by Git. Your project is one repo.

**Self-hosting** — Running a website on a server you control, instead of paying a company to run it for you.

**SPA (Single-Page Application)** — A website that loads a single HTML page, then dynamically swaps content as the user navigates. Yours is built with React.

**SSL certificate** — A small file that proves your domain is legitimate, enabling HTTPS. Issued by a certificate authority like Let's Encrypt.

**Traefik** — A reverse proxy. The traffic cop in front of all your services. Coolify uses it under the hood to route requests by domain and handle SSL.

**Vite** — A build tool for the frontend. Bundles your React code into static JS/CSS files.

**Volume** — A persistent disk attached to a container so data isn't lost when the container restarts. Your `postgres-data`, `redis-data`, `directus-uploads` are volumes.

**Webhook** — A URL on your backend that an external service (Sentoo, WhatsApp) calls to notify you of events (payment succeeded, message received).

---

## What's next?

Once you've completed Phases A through I, you have a working production e-commerce site.

Realistic next steps over the following weeks:
1. Add Sentoo + WhatsApp + SMTP credentials, redeploy, test those flows.
2. Replace `legacy_image` paths with real Directus-uploaded images, one category at a time.
3. Set up a nightly database backup that pushes to S3/Backblaze.
4. Configure Google Analytics (or Plausible, Umami) for traffic stats.
5. Set up a status-page or uptime monitor (Better Stack, UptimeRobot) that pings `/health` every minute.
6. Spend time in Directus customizing the admin interface (sort orders, default values, custom dashboards) so day-to-day inventory work is fast.

Take it one phase at a time. Don't try to do everything in one day.

You've got this. 💪
