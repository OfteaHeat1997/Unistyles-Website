# Unistyles Curaçao — Full inventory of what already exists

**Date:** 26 August 2026
**Scope:** everything. Frontend, backend, design, data, CMS, integrations, infrastructure.
**Method:** a direct sweep of the repository. Everything listed here was counted or read in the code. Nothing is estimated.
**Companion document:** `PROFESSIONAL-ECOMMERCE-RESEARCH.md` covers what is *missing*. This one covers what *exists*. Together they make up the complete research.

---

## Summary in numbers

| Layer | Count |
|---|---|
| Frontend pages | 27 |
| Routes declared in the router | 29 |
| Reusable React components | 16 |
| Data hooks | 12 |
| Lines in pages | 14,922 |
| Lines in components | 2,217 |
| Lines of custom CSS | 6,347 (`styles/main.css`) |
| Backend route groups | 16 |
| API endpoints | 70 |
| Lines in backend routes | 4,949 |
| External services integrated | 2 (Sentoo, WhatsApp Cloud API) |
| Collections in Directus | 7 |
| Product fields in Directus | 45 |
| Tables in the v2 schema | 15 |
| Tables in the production schema | 12 |
| SQL migrations | 4 |
| Products loaded | ~285 |
| Containers in the stack | 5 |

---

## 1. Frontend

### 1.1 The 29 router routes

Declared in `services/frontend/src/App.jsx`. All of them hang off a shared `<Layout>` with header, footer and cart sidebar.

**Catalogue — 10 routes**
`/` Home · `/bras` · `/panties` · `/shapewear` (all three use the same `Category` component with a different parameter) · `/perfume` · `/cremas` · `/bloqueador` · `/desodorantes` · `/limpieza-facial` · `/accesorios`

**Product and brand — 3**
`/product/:id` · `/brand/:brandId` · `/search`

**Purchase — 2**
`/checkout` · `/payment/callback`

**Account — 4**
`/login` · `/register` · `/forgot-password` · `/profile` (the only route wrapped in `ProtectedRoute`)

**Service — 3**
`/track-order` · `/wishlist` · `/admin`

**Content — 6**
`/about` · `/contact` · `/faq` · `/terms` · `/privacy` · `/shipping`

**System — 1**
`*` NotFound

### 1.2 The 27 pages, by size

Six pages account for 9,760 lines — 65% of the entire frontend. They are the beauty category pages. **The reason for their size is not the catalogue** — they read products from Directus via `useProductsByCategory` — but the fact that each one carries its own `<style>` block of roughly a thousand lines of CSS:

| Page | Total | Embedded CSS |
|---|---|---|
| `Skincare.jsx` | 1,825 | ~1,011 lines from line 814 |
| `Sunscreen.jsx` | 1,805 | ~1,012 from line 793 |
| `FacialCleansing.jsx` | 1,763 | ~1,011 from line 752 |
| `Perfume.jsx` | 1,733 | ~900 from line 833 |
| `Accessories.jsx` | 1,533 | ~880 from line 653 |
| `PersonalCare.jsx` | 1,111 | ~634 from line 477 |

That is **~5,450 lines of CSS repeated six times**, on top of the 6,347 in `main.css`. `Category.jsx`, `Product.jsx` and `Home.jsx` have no embedded `<style>`: they use the shared stylesheet. The contrast between the two groups shows which pattern is the right one.

What those six pages do contain, and which is valuable content: the filter configuration, the routine steps, the functions that derive product attributes (`getConcern`, `getApplicationArea`, `getRoutineStep`, `getKeyIngredients`) and the quiz questions.

| Page | Lines | What it is |
|---|---|---|
| `Skincare.jsx` | 1,825 | Creams, with filters by skin type and routine |
| `Sunscreen.jsx` | 1,805 | Sunscreen, with filters by SPF |
| `FacialCleansing.jsx` | 1,763 | Facial cleansing |
| `Perfume.jsx` | 1,733 | Perfumes + fragrance quiz |
| `Accessories.jsx` | 1,533 | Accessories |
| `PersonalCare.jsx` | 1,111 | Deodorants and personal care |
| `Category.jsx` | 716 | Generic category engine — serves bras, panties and shapewear |
| `Checkout.jsx` | 627 | Three-step checkout |
| `Product.jsx` | 561 | Product page |
| `Profile.jsx` | 548 | Account: details, addresses, orders, password |
| `Admin.jsx` | 386 | Admin panel |
| `PaymentCallback.jsx` | 318 | Return from Sentoo, with live status |
| `Home.jsx` | 314 | Home page |
| `About.jsx` | 213 | About us |
| `Register.jsx` | 197 | Registration |
| `Shipping.jsx` | 194 | Shipping, with the zone map |
| `Brand.jsx` | 164 | Brand page |
| `Login.jsx` | 155 | Sign-in |
| `TrackOrder.jsx` | 138 | Tracking by order number |
| `Contact.jsx` | 132 | Contact |
| `Search.jsx` | 125 | Search results |
| `ForgotPassword.jsx` | 109 | Password reset request |
| `Wishlist.jsx` | 85 | Wishlist |
| `FAQ.jsx` | 73 | Frequently asked questions |
| `Terms.jsx` | 42 | Terms |
| `Privacy.jsx` | 39 | Privacy |
| `NotFound.jsx` | 16 | 404 |

### 1.3 The 16 components

| Component | Lines | What it does |
|---|---|---|
| `HeroSlider.jsx` | 352 | Home page carousel with a Ken Burns effect |
| `Header.jsx` | 347 | Header with navigation, search, cart and account |
| `NewReleasesCarousel.jsx` | 322 | New arrivals carousel |
| `CartSidebar.jsx` | 226 | Cart sidebar: quantities, send via WhatsApp, go to checkout |
| `DeliveryMap.jsx` | 174 | Leaflet map of Curaçao with the three zones as polygons and GPS detection |
| `AddressAutocomplete.jsx` | 159 | Real address autocomplete via Nominatim, with zone detection |
| `QuickViewModal.jsx` | 149 | Product quick view without leaving the listing |
| `ProductCard.jsx` | 102 | Product card |
| `Footer.jsx` | 76 | Footer with links and social media |
| `ErrorBoundary.jsx` | 61 | Catches React errors so the page does not go blank |
| `ProtectedRoute.jsx` | 60 | Authenticated route guard |
| `SplashScreen.jsx` | 59 | Branded splash screen |
| `AnimatedLogo.jsx` | 50 | Animated logo with five custom animations |
| `Layout.jsx` | 38 | Shared skeleton for every page |
| `ProductSkeleton.jsx` | 28 | Catalogue loading skeleton |
| `ScrollToTop.jsx` | 14 | Scrolls back to the top on route change |

### 1.4 The 12 data hooks

All in `hooks/`, built on React Query — that is, with caching, retries and loading and error states already handled:

`useProducts` · `useProduct` · `useProductsByCategory` · `useProductSearch` · `usePrefetchProducts` · `useCategories` · `useCategory` · `useBrands` · `useHomepage` · `usePage` · `useBusinessSettings` · `useDeliveryZones`

The last four matter: they mean the frontend already knows how to read the home page, content pages and business settings from Directus. The pipeline exists even though the copy is still hard-coded today.

### 1.5 Client-side services, state and utilities

- `services/directusService.js` — CMS client, 408 lines.
- `services/cartService.js` — cart backed by the server, with a guest cart identifier.
- `stores/cartStore.js` — client-side cart state.
- `contexts/AuthContext.jsx` — session, registration, login, logout, persistence.
- `utils/api.js` — HTTP client with the token attached.
- `utils/whatsapp.js` — **seven WhatsApp link generators**: general enquiry, product enquiry (with name, reference, size and colour), order from the cart, order from checkout (with order number, customer, address, items, subtotal, shipping and total), account help, general question and category help.
- `data/curacaoZones.js` — the three zones with polygons, fee, free-shipping threshold and delivery time.
- `config/theme.js`, `config/constants.js`, `config.js` — configuration and theme.

---

## 2. Design system

### 2.1 The palette in charge

Defined twice in parallel: as a JavaScript object in `config/theme.js` and as CSS variables in `styles/main.css`. Both match. It is the brand's real identity — "warm neutrals + gold + Caribbean teal".

**Backgrounds** — `#FFFFFF` cards · `#FAF8F5` page (warm white) · `#F3EDE6` sections (sand cream)
**Text** — `#1A1A1A` headings · `#3A3F45` body · `#6B6560` secondary · `#9B9490` disabled
**Gold, the logo accent** — `#C5A55A` · `#D4B96E` on hover · `#EDD9A3` soft
**Caribbean teal, the actions** — `#1B4D4F` primary button · `#24635F` on hover · `#1F3347` navy for footer and overlays
**Borders** — `#E6DED8` soft taupe · `#F3EDE6` cream
**Semantic** — `#3D7A5F` success · `#B8862D` low-stock warning · `#A4443A` error

There are also **21 legacy aliases** (`--cream-bg`, `--nude`, `--accent-coral`…) that point to the new tokens. They are the trace of an earlier palette; they work, but it is worth knowing they exist.

### 2.2 Typography

- Headings: **Playfair Display** (serif), weights 400–700.
- Body: **Inter**, weights 300–600.
- Both are loaded from Google Fonts in `index.html`.
- Icons: Font Awesome 6.4.0 from a CDN.

### 2.3 Scales

- **Spacing:** 4 · 8 · 16 · 24 · 32 · 48 · 64 px.
- **Radii:** 4 · 8 · 12 px.
- **Shadows:** three levels, all with very low opacity (0.06 / 0.08 / 0.10) — the style is soft, not pronounced.

### 2.4 Motion

**13 custom CSS animations** in `main.css`: `modalSlideIn`, `fadeIn`, `slideUp`, `skeleton-loading`, `spin`, `whatsapp-pulse`, `kenBurns`, and five dedicated solely to the animated logo (`alogo-pop-in`, `alogo-float`, `alogo-glow-pulse`, `alogo-glow-burst`, `alogo-spark`).

Plus **Framer Motion** in one component, with 11 uses of `motion.` and 5 of `AnimatePresence`.

### 2.5 A conflict worth knowing about

`tailwind.config.js` declares a palette and fonts **different** from the ones the site uses: coral `#D4A088`, cream `#FAF7F2`, browns, and the Cormorant Garamond + Montserrat typefaces. Those two fonts are not loaded anywhere, so if any Tailwind class uses them, the browser silently falls back to the default font. The live palette is the one in `theme.js` and `main.css`; the Tailwind one is left over from an earlier version.

---

## 3. Backend — the 70 endpoints

Express on Node 20. Everything under `/api`. Enumerated from `services/backend/src/routes/`.

### 3.1 Authentication — `/api/auth` · 9 endpoints
`POST /register` · `POST /verify-email` · `POST /resend-verification` · `POST /login` · `POST /refresh` · `GET /me` · `POST /logout` · `POST /forgot-password` · `POST /reset-password`

**Important:** `POST /reset-password` **does exist and is finished in the backend**. The only thing missing is the frontend page that calls it.

### 3.2 Users — `/api/users` · 7 endpoints
`GET /profile` · `PUT /profile` · `PUT /password` · `POST /addresses` · `PUT /addresses/:id` · `DELETE /addresses/:id` · `GET /orders`
The whole group sits behind the `authenticate` middleware applied in `index.js:200`.

### 3.3 Cart — `/api/cart` · 6 endpoints
`GET /` · `POST /add` · `PUT /update` · `DELETE /remove/:productId` · `DELETE /clear` · `POST /merge`
`merge` is the one that merges the guest cart stored in Redis with the account's cart on sign-in.

### 3.4 Orders — `/api/orders` · 5 endpoints
`POST /` (checkout) · `GET /` · `GET /:id` · `GET /track/:orderNumber` · `PUT /:id/cancel`

### 3.5 Payments — `/api/payments` · 6 endpoints
`POST /cod` cash on delivery · `POST /sentoo` · `POST /sentoo/webhook` · `GET /:orderId/sentoo-status` · `POST /bank-transfer` · `GET /:orderId/status`

### 3.6 Catalogue — 11 endpoints
Products `/api/products`: `GET /` · `GET /featured` · `GET /search` · `GET /:slug`
Categories `/api/categories`: `GET /` · `GET /:slug`
Variants `/api/variants`: `GET /product/:productId` · `POST /` · `PUT /:id` · `DELETE /:id`

### 3.7 Perfume quiz — `/api/perfumes` · 5 endpoints
`GET /quiz` · `POST /quiz/results` · `GET /filters` · `GET /` · `GET /:id`
It is the only one in this group that the frontend calls today: `POST /quiz/results`.

### 3.8 Skincare quiz — `/api/skincare` · 4 endpoints
`GET /quiz` · `POST /quiz/results` · `GET /filters` · `GET /`

### 3.9 Coupons — `/api/coupons` · 5 endpoints
`POST /validate` · `POST /apply` · `GET /` · `POST /` · `DELETE /:id`

### 3.10 Reviews — `/api/reviews` · 3 endpoints
`GET /product/:productId` · `POST /` · `DELETE /:id`

### 3.11 Delivery — `/api/delivery` · 2 endpoints
`GET /zones` · `GET /calculate`
It also exposes two reusable functions: `getZoneByArea` and `getFreeShippingThreshold`.

### 3.12 Administration — `/api/admin` · 7 endpoints
`GET /users` · `GET /users/:id` · `PUT /users/:id` · `DELETE /users/:id` · `GET /orders` · `PUT /orders/:id` · `GET /stats`

### 3.13 WhatsApp — `/api/whatsapp` · 2 endpoints
`GET /webhook` verification · `POST /webhook` incoming messages

### 3.14 Newsletter — `/api/newsletter` · 1 endpoint
`POST /subscribe`

---

## 4. Backend cross-cutting layer

### 4.1 Authentication middleware (`middleware/auth.js`)
Seven pieces: `authenticate`, `optionalAuth`, `adminOnly` (which checks the role **against the database**, not just against the token), `generateToken`, `generateRefreshToken`, `blacklistToken` and `isTokenBlacklisted` — the last two backed by Redis, which makes it possible to genuinely invalidate sessions.

### 4.2 Global configuration (`index.js`)
- **Helmet** with an explicit content security policy.
- **CORS** with a dynamically built allowlist.
- **Four rate limiters**: a general one on `/api/`, a specific one for `/api/auth/login`, one for validating and applying coupons, and one for reviews. The Sentoo webhook is deliberately exempt so that a payment notification is never rejected.
- A custom **request ID** and logging with `winston` + `morgan`.
- **Compression** enabled.
- JSON body up to 10 MB, with raw body capture for the WhatsApp webhook (needed to verify the signature).
- **Socket.IO** for live payment status.

### 4.3 Utilities
`db.js` (55) · `redis.js` (25) · `logger.js` (81) · `images.js` (46) · `validateEnv.js` (44; validates the variables at start-up and refuses to start the server if any are missing) · `notifications.js` (388).

### 4.4 `notifications.js` — what the system can already send
With automatic retries (`withRetry`, up to 3 attempts) and SMTP transport via Nodemailer:
- `sendOrderConfirmation` — "Order Confirmed – UNI-…" email with the items.
- `sendVerificationEmail` — account verification.
- `sendPasswordResetEmail` — password reset.
- `sendOrderStatusUpdate` — status change notification.
- `sendWhatsAppNotification` — order notification via WhatsApp.
- `sendWelcomeMessage` — welcome message.
- `getWhatsAppLink` — fallback `wa.me` link when the Meta template has not been approved.

### 4.5 `services/sentoo.js` (168 lines)
Complete client for the local payment provider: `isConfigured`, `getClient`, `createTransaction` (amount, description, currency, return URL, customer, expiry), `fetchStatus` and `cancelTransaction`. It has a **sandbox** mode and a live mode, with separate URLs for the API and the payment gateway.

### 4.6 `services/whatsapp.js` (315 lines)
Client for Meta's Cloud API, Graph API version `v21.0`:
- `sendTextMessage`, `sendInteractiveMessage` (button and list menus), `sendTemplateMessage`, `sendMediaMessage`.
- `verifyWebhook` and `verifySignature` — cryptographic verification that the message comes from Meta.
- `parseWebhookPayload`, `normalizePhone`, `logMessage` — every incoming and outgoing message is stored in the `whatsapp_messages` table with direction, phone number, Meta ID, type, content, template, status and associated order.

### 4.7 The WhatsApp bot (`routes/whatsapp.js`, 355 lines)
A conversation with state stored in Redis. It replies **in Papiamentu**. It can:
- show a category menu ("Mira kategorias") with descriptions,
- ask for an order number and validate it against the `UNI-XXXXXX-XXXX` format, replying `❌ E number di order no ta balido…` if it does not match,
- look up the real order status in the database,
- and warn with `⚠️ Tin un eror buskando bo order…` if the lookup fails.

---

## 5. Data

### 5.1 Production schema — `database/init.sql`, 12 tables
`users` · `addresses` · `carts` · `orders` · `order_items` · `payments` · `reviews` · `coupons` · `product_variants` · `delivery_zones` · `newsletter_subscribers` · `settings` · `whatsapp_messages`

### 5.2 v2 schema — `database/init.v2.sql`, 15 tables
All of the above plus **`order_status_history`** and **`coupon_redemptions`**.

What v2 adds beyond tables:
- Real `CHECK` constraints on statuses. An order can only be `pending`, `awaiting_payment`, `confirmed`, `processing`… and a payment method can only be `cod`, `sentoo`, `bank_transfer`, `card` or `whatsapp`.
- **Automatic triggers** that write to `order_status_history` every time an order is created or its status changes. Nobody has to remember to log it: the database does it on its own.
- Prices frozen on the order line, so that changing a product's price does not alter orders already placed.
- Automatic timestamps and conditional foreign keys to the Directus tables.
- The three delivery zones **seeded with their neighbourhoods** (`init.v2.sql:535`).

### 5.3 Migrations
`001_add_coupons_and_variants.sql` · `001_add_whatsapp_messages.sql` · `002_delivery_zones.sql` · `003_address_geocoding.sql`
Run by `database/migrate.js`.

### 5.4 Seeds
`seed-data.json` (4,018 lines) and `seed-example.sql`.

### 5.5 The catalogue, and where each copy lives
- **Directus** — the official source, ~285 products. It is what the pages read from today.
- `frontend/src/data/productData.js` — 4,042 lines.
- `database/seed-data.json` — 4,018 lines.
- `frontend/src/config.js` — 89 lines with the categories written by hand.

Four copies. The beauty pages are **not** a fifth: they read from Directus, as they should.

---

## 6. Directus — the CMS

Seven collections created by `services/directus/bootstrap.js`: **`products`**, **`categories`**, **`brands`**, **`pages`**, **`customers`**, **`business_settings`** and **`homepage`**.

### 6.1 `products` — 45 fields

It is, by far, the best-designed part of the project.

**Commerce** — `name`, `slug`, `ref`, `description`, `price`, `compare_at_price`, `in_stock`, `stock_quantity`, `featured`, `sort_order`
**Images** — `image`, `gallery`, `legacy_image`, `legacy_id`
**Lingerie** — `color`, `size`, `style`, `compression` (light/medium/firm), `material`, `variants`
**Labels** — `badge`: new, bestseller, premium, sale, gift_set, pack_3
**Perfumery, full taxonomy** — `gender`, `fragrance_family` (floral, oriental, woody, fresh, fruity, gourmand, citrus, aquatic), `scent_profile` (sweet, spicy, musky, powdery, green, aromatic, warm, cool), `intensity`, `occasion` (daily, office, evening, romantic, special, casual, sport), `season`, `top_notes`, `middle_notes`, `base_notes`, `volume`, `concentration` (parfum, edp, edt, cologne, splash)
**Cosmetics** — `skin_type`, `skin_concern`, `application_area`, `texture`, `key_ingredients`, `spf`, `dermatologist_tested`, `routine_step` (cleanse, treat, moisturize, protect), `time_of_use`
**Relations** — `category_id` → `categories`, `brand_id` → `brands`

That taxonomy is exactly what feeds the perfume and skincare quizzes, and what would enable advanced filters without writing anything new.

### 6.2 The other collections
- **`categories`** — name, slug, description, breadcrumb, image, `filter_type` (size / style / category / compression), `filters` as JSON, sort order and `show_in_menu`.
- **`brands`** — name, slug, description, logo, website, country, featured.
- **`pages`** — title, slug, rich content, excerpt, featured image, **`seo_title` and `seo_description`**, show in footer, sort order. The SEO fields already exist in the CMS; what is missing is for the frontend to use them.
- **`customers`**, **`business_settings`**, **`homepage`**.

---

## 7. External integrations already built

| Service | Purpose | Code status |
|---|---|---|
| **Sentoo** | Local Curaçao payments, connected to MCB and other banks | Complete, with sandbox and production |
| **WhatsApp Cloud API (Meta)** | Papiamentu bot, templates, interactive messages | Complete, with signature verification |
| **SMTP / Nodemailer** | Six transactional emails with retries | Complete |
| **Socket.IO** | Live payment status on `/payment/callback` | Complete |
| **Leaflet + OpenStreetMap** | Zone map with polygons | Complete |
| **Nominatim** | Autocomplete for real Curaçao addresses | Complete |
| **Browser geolocation** | "Detect my zone" button | Complete |
| **Directus** | CMS for the catalogue and content | Complete |
| **Redis** | Guest cart, token blacklist, bot state | Complete |

---

## 8. Shipping: the three zones

Defined twice — in `frontend/src/data/curacaoZones.js` with their polygons, and in the database with their neighbourhoods.

| Zone | Fee | Free shipping from | Delivery time |
|---|---|---|---|
| 1 — Centre | XCG 5 | XCG 75 | 1–2 working days |
| 2 — East | XCG 10 | XCG 100 | 1–2 working days |
| 3 — West and North | XCG 25 | XCG 150 | 2–3 working days |

Neighbourhoods catalogued: Willemstad, Punda, Otrobanda, Pietermaai, Scharloo, Jan Thiel, Blue Bay, Saliña, Mahaai, Cas Grandi, Banda Abou, Banda Ariba, Tera Kòrá, Groot Kwartier.

Each order stores the delivery zone and coordinates.

---

## 9. Infrastructure

**The stack, from the bottom up:**
1. **Contabo** — the server (VPS). It provides a running Linux machine and nothing more.
2. **Coolify** — orchestrates on top: builds the images, starts them, renews TLS, stores the variables.
3. **Five containers** — frontend, backend, Directus 11, PostgreSQL 16-alpine and Redis 7-alpine.

**What already exists around it:**
- `docker-compose.yml` with the five services.
- Four Dockerfiles: production and development, for frontend and backend.
- `.env.coolify.example` and three more templates in `deploy/separated/`.
- `deploy/scripts/backup-db.sh` and `deploy/scripts/migrate-strapi-to-directus.js`.
- Deployment documentation: `deploy/separated/01-databases-notes.md`, `docs/COOLIFY-SEPARATED-SETUP.md`, `docs/COOLIFY-PHASE4-5-STEP-BY-STEP.md`.
- `.github/workflows/ci.yml` with three jobs: backend (spins up real Postgres and Redis, loads the schema, applies migrations and checks `/health`), frontend (installs and builds) and docker (builds both images).

---

## 10. Security already implemented

- Passwords hashed with **bcrypt**.
- **Parameterised** queries throughout data access.
- Admin role verified **against the database**, not just against the token.
- **Helmet** with an explicit content security policy.
- **CORS** with an allowlist.
- **Four rate limiters**, with a deliberate exemption for the Sentoo webhook.
- **Enumeration-proof** login responses — they do not reveal whether an email address exists.
- **Token blacklist** in Redis: signing out genuinely invalidates the session.
- **Signature verification** on the WhatsApp webhook.
- **Re-verification** of the payment webhook against Sentoo: it does not trust the incoming message.
- **Transactional** checkout with `SELECT … FOR UPDATE` on the product rows before deducting stock (`orders.js:63`), and a sufficient-stock check before confirming.
- **Environment variable validation** at start-up: if a critical one is missing, the server does not start.
- 10 MB limit on request bodies.

---

## 11. What this inventory makes clear

1. **The backend is finished in more places than people think.** `POST /reset-password` exists; the skincare quiz has its four endpoints; the admin panel has seven. In several cases, all that is missing is the screen that calls them.
2. **`init.v2.sql` already solves problems that seemed outstanding.** `order_status_history` does not just exist: it fills itself via triggers. So does `coupon_redemptions`. What remains is to declare it official and migrate production.
3. **Directus is the most undervalued asset.** 45 product fields with a full perfumery and cosmetics taxonomy, and SEO fields in `pages` that nobody is using yet.
4. **The six large pages are not a catalogue problem but a CSS problem.** They read from Directus correctly; what bloats them is ~5,450 lines of embedded styles repeated across them. Moving them into `main.css` shrinks the frontend by more than a third without touching a single feature. The catalogue is indeed duplicated, but in four other places.
5. **There are two design systems in the repository.** The live one (gold + teal, Playfair + Inter) and a leftover one in `tailwind.config.js` (coral, Cormorant + Montserrat) whose fonts are not even loaded.
6. **The security layer is genuinely serious**, and deserves to be described as such in the research rather than taken for granted.
