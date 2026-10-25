# Unistyles Curaçao — Research: what a professional e-commerce store has and what I am missing

**Date:** 26 August 2026
**Project author:** Paula — Unistyles Curaçao
**What this is:** the source document. It brings together in one place (a) the verified baseline of the Unistyles code, (b) the standard for what a real professional e-commerce store has, domain by domain, (c) the working methods, UML/C4 modelling and testing strategy already agreed, and (d) the full lifecycle from creating the project to being live and operating.
**What it is for:** it is the material handed to an assistant (ChatGPT) to draft the full research. Every code fact carries its file and line; every external fact carries its source at the end.

---

## 0. How to use this document with ChatGPT

This file is NOT the final research: it is the verified raw material for writing it. The difference matters, because the problem with earlier versions was documentation written by one AI for another AI, with nothing that could be checked.

Rules for whoever drafts from this:

1. **Do not invent status.** If a claim about the code does not appear in section 2 with its `file:line`, it is not written. If a needed fact is missing, mark it as *“to be verified”*.
2. **Do not turn the standard into an achievement.** The “professional” column describes what serious stores do; the “Unistyles today” column describes what exists. Never mix them.
3. **Plain, human language.** Short sentences, no filler, no “in today’s world of e-commerce”.
4. **Every gap needs three things:** what is missing, why it costs Unistyles money or creates risk, and what the minimum acceptable version for launch is.

Suggested prompts to paste alongside this file:

> “Using this document as the only source of facts, write the *State of the art and gap analysis* chapter of my research. Use sections 2 and 3. Cite the file and line when talking about the Unistyles code and the source when talking about the standard. Do not add features that do not appear here.”

> “Using section 5, write the *Testing methodology* chapter. Justify why the Testing Trophy was chosen over the classic pyramid, and define the eight end-to-end flows listed.”

> “Using section 4, write the *System modelling* chapter. For each diagram explain what question it answers and which specific Unistyles elements appear in it.”

Mapping to the five old documents in `docs/planning/` (July 2026), so that nothing is lost:

- Document 1 “What is already done” → section 1 and the “Unistyles today” column of section 2.
- Document 2 “Completion checklist” → section 7 (prioritised backlog).
- Document 3 “Research checklist” → section 9 (open questions).
- Document 4 “Deep research + brainstorming” → section 2 (the standard) and section 8 (metrics).
- Document 5 “Double Diamond action plan” → sections 3 and 6 (methods and lifecycle).

---

## 1. Baseline: what Unistyles is today, verified

Figures counted in the repository on 26 August 2026, not estimated.

| Component | Verified fact |
|---|---|
| Frontend pages | 27 (`services/frontend/src/pages/`, 28 files minus `index.js`) |
| Backend route groups | 16 files, 4,949 lines (`services/backend/src/routes/`) |
| Largest route | `orders.js`, 541 lines |
| Controller layer | empty: `services/backend/src/controllers/` has 0 files |
| External services implemented | Sentoo and WhatsApp (`services/backend/src/services/`) |
| Products in catalogue | ~285, owned by Directus in the same Postgres |
| Automated tests | 0. No `package.json` defines a `test` script |
| Continuous integration | `.github/workflows/ci.yml` exists: installs, builds and assembles Docker images, but **runs no tests at all** |
| Frontend dependencies | 8 production ones; no i18n library, no analytics, no error capture |
| Session token storage | `localStorage` (`services/frontend/src/contexts/AuthContext.jsx:87`) |

What is genuinely well done and should not be touched: `helmet` with a configured CSP (`services/backend/src/index.js:50`), four rate limiters, `compression`, request ID, environment-variable validation at startup, React Query on the client, `ErrorBoundary`, protected routes for the profile, and a transactional checkout that locks rows with `FOR UPDATE` before decrementing stock (`services/backend/src/routes/orders.js:63`).

---

## 2. The professional standard, domain by domain

Sixteen domains. For each: what a professional store does, what Unistyles has with its evidence, and what is missing.

### A. Identity and accounts

**The professional standard.** Sign-up with email verification; login resistant to user enumeration; short-lived access token stored in an `httpOnly` + `Secure` + `SameSite` cookie, never in `localStorage`; rotating, revocable refresh token; complete end-to-end password recovery; logout that invalidates on the server; a second factor at least for admin accounts; optionally sign-in with Google or Apple; logging of security events (logins, password changes, email changes).

**Unistyles today.** Sign-up, email verification, login, refresh token with a Redis blacklist (`services/backend/src/routes/auth.js:262`) and enumeration-proof responses. The backend generates and sends the recovery link.

**What is missing.**
1. **The `/reset-password` page does not exist.** The email arrives with a link that leads nowhere. From the customer’s side the feature is broken, not half-done.
2. **The token lives in `localStorage`.** Any script injected into the page can read it and impersonate the customer. The professional approach is an `httpOnly` cookie.
3. **No second factor for admin.** The account that can see every order and all customer data is protected by a password alone.
4. **No audit log.** Zero matches for `audit_log` in the code: there is no way to find out afterwards who changed what.
5. **No CSRF protection.** Zero matches for `csrf`. It is not exploitable today because the token travels in a header, but if we move to cookies (point 2) it becomes mandatory the same day.

### B. Catalogue, search and product page

**The professional standard.** A single source of truth for the catalogue; typo-tolerant search with suggestions; attribute filters with result counts; real variants with their own stock per size and colour; gallery with zoom; size guide; availability visible before adding to cart; related products; structured product data for Google.

**Unistyles today.** Directus owns products, categories and brands. Debounced search, working. Product page with reviews, sizes and colours. Variants exist (`routes/variants.js`).

**What is missing.**
1. **The catalogue is duplicated in four places:** Directus, `frontend/src/config.js` (hand-written categories), `frontend/src/data/productData.js` and `database/seed-data.json`. Four versions that contradict each other are a permanent source of bugs.
2. **Two sources of stock:** `products.stock_quantity` and `product_variants` coexist; nothing guarantees they match.
3. **No structured data** (`JSON-LD` of type `Product` with price and availability). Google cannot show price or “in stock” in search results.
4. **The brand page only knows five hand-defined brands.**

### C. Cart and checkout

**The professional standard.** Cart persisted across devices; guest checkout with no obligation to create an account; total costs visible before the last step; the fewest possible fields; inline validation, not on submit; abandoned-cart recovery.

**Unistyles today.** Side cart with a guest cart in Redis and a user cart in the database, merged on login. Three-step checkout with coupons and address autocomplete.

**What is missing.**
1. **No abandoned-cart recovery.** Zero matches for `abandoned` in the code. It is the feature with the best effort-to-revenue ratio that does not exist today.
2. **Checkout depends on zone data that is not yet seeded in production**, so the area dropdown can come up empty.
3. **Payment method mismatch:** the frontend sends `bank` and the backend requires `bank_transfer`.

**Why it matters, with data.** The average cart abandonment rate is 70.2%, rising to 80.0% on mobile. Among those who abandon and were genuine buyers, the number one reason is a surprise cost at the end (39%), followed by being forced to create an account (24%). The average site asks for 23.5 form fields when 12–14 is reasonable. Fixing the checkout experience alone can raise conversion by up to 35%.

### D. Payments

**The professional standard.** Trusted local methods; the site never touches or stores the card number; webhook verified against the provider rather than trusting the incoming message; idempotency so nobody is charged twice; daily reconciliation; refunds from the admin panel.

**Unistyles today.** Sentoo genuinely integrated (it is the local method in the Dutch Caribbean, connected to MCB and other banks, free for the buyer), cash on delivery, bank transfer, and the webhook **re-verifies the real status against Sentoo** — that is well done.

**What is missing.**
1. **The bank account number is still a placeholder:** `accountNumber: 'XXXX-XXXX-XXXX'` in `services/backend/src/routes/payments.js:429`. Anyone choosing bank transfer today cannot pay.
2. **No working refunds.** There are some mentions of `refund` but no complete flow from the admin panel.
3. **No reconciliation.** Nobody compares, at the end of the day, what Sentoo says with what the database says.
4. **PCI DSS.** Since 31 March 2025, requirements 6.4.3 and 11.6.1 are mandatory: you must keep an inventory of every script loaded on the payment page, authorise them and verify their integrity, and detect tampering with the page and its headers as received by the browser. Unistyles currently loads Font Awesome from `cdnjs.cloudflare.com` and fonts from Google in `services/frontend/index.html` — exactly the kind of third-party script that requirement says must be inventoried.

### E. Order lifecycle and post-purchase

**The professional standard.** Order statuses with a dated history and who changed them; email or WhatsApp on every change; downloadable invoice; returns policy with an authorisation number (RMA), instructions and label; refund linked to the return; tracking page that does not require login.

**Unistyles today.** Transactional orders with their own number, a `/track-order` page by order number, and a WhatsApp chatbot that checks the status.

**What is missing.**
1. **`order_status_history` is designed but not live.** The table exists in `database/init.v2.sql:310`, along with two triggers that fill it automatically when an order is created and when its status changes. The problem is that v2 is not the schema running in production, and no backend code reads it yet. So today, in the real store, only the current status is known, not how it got there: when a complaint comes in there is no way to reconstruct what happened. It does not need designing — it needs migrating to v2 and using.
2. **No invoices.** Zero matches for `invoice` or `factura`. No customer can download a receipt.
3. **No returns or RMA.** The flow does not exist. And it is costly: 79% of shoppers abandon if their preferred return method is not offered, and 76% say easy, free returns decide where they shop.
4. **No delivery time slots or delivery confirmation.**

### F. Inventory

**The professional standard.** A single source of stock; stock reserved while payment is in progress so the same item is not sold twice; low-stock alerts; recorded goods receipts; movement history.

**Unistyles today.** Stock decremented inside the purchase transaction with row locking — correct.

**What is missing.** The double source already mentioned (product vs. variant); no low-stock alerts; no movement log; no temporary reservation during Sentoo payment (if a customer is slow to pay, another can take the last item).

### G. Delivery and logistics

**The professional standard.** Zones and rates editable without touching code; driver assignment; dispatch screen; live tracking; proof of delivery; route optimisation.

**Unistyles today.** And this is far more built out than it seemed: an interactive map of Curaçao with the three zones drawn, GPS zone detection, real address autocomplete, rates and free-shipping thresholds per zone (5 / 10 / 25 XCG; free from 75 / 100 / 150), and the order stores the zone and coordinates.

**What is missing.** The entire operational layer: who delivers, how they are notified, how the customer sees that it is on the way, and a panel for Paula to edit zones and rates without touching code.

### H. Marketing, retention and analytics

**The professional standard.** Funnel analytics; transactional and lifecycle emails; newsletter with double opt-in and one-click unsubscribe; verified-purchase reviews; referral programme; campaign pixels.

**Unistyles today.** Concurrency-safe coupons, reviews, newsletter sign-up, a complete WhatsApp chatbot in Papiamentu.

**What is missing.**
1. **Zero analytics.** There is no `gtag` or equivalent. Right now it is impossible to know at which step customers drop off, and therefore impossible to prioritise with data.
2. **Newsletter with no double opt-in or unsubscribe** (`routes/newsletter.js` is 43 lines).
3. **Dead contact form:** `services/frontend/src/pages/Contact.jsx:97` is literally `onSubmit={(e) => e.preventDefault()}`. The customer writes, clicks send, nothing happens and nobody finds out.
4. **Reviews with a type bug:** `reviews.product_id` is a UUID while products have integer ids.

### I. Content and CMS

**The professional standard.** Whoever runs the business edits products, copy, banners and legal pages without programming; images with cropping and modern formats; drafts and scheduling.

**Unistyles today.** Directus installed, with the catalogue inside it.

**What is missing.** The copy on the content pages is still hard-coded; images are served as-is, with no size variants and no WebP/AVIF.

### J. SEO and performance

**The professional standard.** Distinct title and description per page; Open Graph for social networks; `robots.txt`; `sitemap.xml`; canonical URLs; structured data; server-side rendering or pre-rendering so search engines see the content; and all three Core Web Vitals metrics in the green.

**Unistyles today.** A single `<title>` and a single `<meta description>` for the whole site, in `services/frontend/index.html`.

**What is missing.**
1. **There is no `robots.txt` or `sitemap.xml`** in `services/frontend/public/`.
2. **No per-page metadata or Open Graph.** Sharing a product on WhatsApp or Instagram shows neither the photo nor the product name.
3. **It is a Vite SPA without server-side rendering:** the search engine receives an empty `<div id="root">`.
4. **No Core Web Vitals measurement.** The thresholds are LCP < 2.5 s, INP < 200 ms and CLS < 0.1, and you pass if 75% of visits meet them. INP is the one most often failed today: 43% of sites do not reach it. And the impact is money: 0.1 s faster mobile load time increased conversion by 8.4% in the Google and Deloitte study; sites that pass all three have 24% lower bounce rates.

### K. Accessibility and language

**The professional standard.** WCAG 2.2 level AA: full keyboard navigation, labels associated with every field, alt text on product images, sufficient contrast, ARIA on the cart and dynamic menus. And the language the customer actually uses.

**Unistyles today.** There are a few scattered `aria-label`s in several components. The WhatsApp chatbot replies in Papiamentu.

**What is missing.**
1. **No accessibility audit and no correct `lang`:** `index.html` declares `lang="en"` for a site serving an audience whose mother tongue is Papiamentu for ~81%.
2. **No internationalisation.** Zero i18n library: the interface is in English and switching language would mean rewriting copy by hand.
3. **Legal context:** the European Accessibility Act came into force on 28 June 2025 and requires level AA via EN 301 549 for anyone selling to the European Union. Curaçao is an autonomous country within the Kingdom, not EU territory, so it **does not apply directly**; the research should say so clearly and adopt WCAG 2.2 AA for quality and market reach, not as an obligation. The fact that a German retailer was fined €150,000 for alt-text failures in its checkout shows the bar the industry considers acceptable.

### L. Back office and administration

**The professional standard.** Panel with filterable orders, status changes, customer profile, stock management, coupons, zones, reports and users with role-based permissions.

**Unistyles today.** `routes/admin.js` (265 lines) with user, order and statistics management.

**What is missing.**
1. **The `/admin` route is not protected on the client:** `services/frontend/src/App.jsx:78` declares it without wrapping it in a protected route, unlike the profile.
2. **The panel’s “view” buttons are non-functional mock-ups.**
3. **No delivery-zone panel, no stock management, no exportable reports.**
4. **Default admin password** included as a hash in `database/init.sql`. It must be rotated before opening.

### M. Cross-cutting security

**The professional standard.** Measured against the OWASP Top 10:2025, whose current edition puts **broken access control** first and **security misconfiguration** second, and adds two new categories: **software supply chain failures** (dependencies, build system, CI/CD, third-party platforms) and **mishandling of exceptional conditions** (uncaught errors, insecure failure states).

**Unistyles today.** bcrypt, parameterised queries, admin permissions checked against the database, helmet with CSP, CORS with an allowlist, four rate limiters, and a re-verified payment webhook. It is a serious foundation.

**What is missing, mapped to the Top 10:**
- *A01 access control*: `/admin` unprotected on the client.
- *A02 misconfiguration*: default admin password in the schema.
- *A03 supply chain*: no `npm audit` or Dependabot in CI; third-party scripts loaded from a CDN without integrity checks.
- *A04 authentication*: token in `localStorage`, no second factor.
- *A09 logging and monitoring*: `winston` is present, but with no centralised destination, no alerts and no audit log.
- *A10 exceptional conditions*: there is an `errorHandler`, but without production error capture (no Sentry or equivalent) nobody finds out about the real failures customers hit.

### N. Legal and compliance in Curaçao

**The professional standard.** A real privacy policy describing what is collected and for how long; legal basis for processing; rights of access, correction and erasure that can actually be exercised; cookie notice and controls; terms of sale; returns and shipping policies.

**Unistyles today.** Terms and Privacy pages exist with static text.

**What is missing.**
1. **The applicable law is Curaçao’s Landsverordening bescherming persoonsgegevens**, in force since 1 October 2013, supervised by the CBP, with administrative fines of up to NAf 10,000 per infringement. It resembles the GDPR but **is not the GDPR** — the research must not cite the GDPR as if it applied.
2. **No consent management or cookie notice:** zero matches for `consent`.
3. **No data access or erasure mechanism** for a customer who requests it.
4. **No retention policy:** order data is kept indefinitely with no written criterion.
5. **Transfers outside Curaçao:** the email provider, the hosting provider and Meta receive personal data; the ordinance requires an adequate level of protection or safeguards.

### O. Quality and testing

**The professional standard.** See section 5 in full.

**Unistyles today.** Zero tests. `.github/workflows/ci.yml` builds and checks `/health`, but does not run a single test because none exist.

### P. Deployment, observability and operations

**The professional standard.** Configuration in environment variables; reproducible builds; automatic deployment from the main branch; versioned, numbered migrations with no collisions; tested backups; uptime monitor; error dashboard; written recovery plan.

**Unistyles today.** Docker, Coolify in progress, `.env.coolify.example`, `deploy/scripts/backup-db.sh`, CI that builds images.

**The hosting stack, which until now was not written down anywhere.** There are three layers, and they are worth naming separately because each one fails differently:

1. **Contabo — the physical server (VPS).** This is the rented machine: CPU, memory, disk, IP address and bandwidth. Contabo knows nothing about Unistyles; it just delivers a running Linux box. What breaks here: full disk, exhausted memory, the machine going down, or someone getting in via SSH.
2. **Coolify — the orchestrator.** It runs *on top of* the Contabo VPS. It builds the Docker images, starts them, renews TLS certificates, stores environment variables and exposes the five resources (frontend, backend, Directus, Postgres, Redis). What breaks here: a failed deployment, a misconfigured variable, a certificate that does not renew.
3. **The five containers** — the application itself.

**What is missing in this layer, and was not in any previous document:**
- **Contabo is not mentioned anywhere in the repository.** Zero matches in documentation, `.yml` files or environment examples. Nobody new to the project knows where the site lives.
- **No documented server hardening:** firewall with only 22/80/443 open, key-only SSH with no password, `fail2ban`, automatic security updates. It is the most exposed surface in the whole project and nothing is written down.
- **No VPS snapshots.** The `backup-db.sh` backup covers the database, not the machine. If the whole server is corrupted, there is no quick way back.
- **No per-container resource limits.** Five services on a single machine: Directus or Postgres can eat up the memory and take down the checkout.
- **No disk monitoring.** Old Docker images from each deployment fill the disk over time; without a scheduled `docker system prune` and a disk-space alert, the site will go down one day without warning.
- **No written recovery plan:** what to do, and in what order, if Contabo goes down or Coolify will not start.

*To be verified:* the exact Contabo plan (CPU, RAM, disk), data centre region, and whether snapshots are included. These must be filled in by hand — they are not in the code.

**What is missing.**
1. **Two database schemas side by side:** `database/init.sql` (12 tables, the one running in production) and `database/init.v2.sql` (15 tables, better built, with CHECK constraints, prices frozen in the order and correct foreign keys). v2 needs to be declared official, the forward migration written, and v1 archived.
2. **Migrations with a repeated number:** `001_add_coupons_and_variants.sql` and `001_add_whatsapp_messages.sql` share 001. Any migration runner that orders by name may apply them in the wrong order.
3. **~1,300 lines of orphaned backend code:** `routes/products.js` (302), `perfumes.js` (526) and `skincare.js` (441) are not called by the frontend, which only uses `/api/perfumes/quiz/results` and gets products from Directus. It is code that has to be maintained, reviewed and secured while contributing nothing.
4. **The backup is not scheduled and a restore has never been tested.** A backup that has never been restored is not a backup.
5. **No uptime monitor or error dashboard.**

---

## 3. Chosen working methods and why

This is already decided; the research should justify it, not reopen it.

| Area | Chosen method | Reason |
|---|---|---|
| Process | Kanban + Shape Up | One-person team: work-in-progress limit and fixed-time batches with variable scope |
| Research | Double Diamond + DOT Framework | Double Diamond orders the phases; DOT forces triangulation across library, field and lab |
| Architecture | Layered modular monolith | Route → controller → service → repository. Today everything lives in the routes |
| Modelling | C4 + three UML diagrams + ERD | Enough to understand the system without the cost of full UML |
| Decisions | ADR (architecture decision record) | One page per decision: context, options, choice, consequences |
| Scope | MoSCoW + user stories | Already in use in July’s document 2 |
| Quality | Testing Trophy | Section 5 |
| Deployment | 12-Factor + single branch + CI | Configuration in the environment, everything to `master`, CI decides |
| Data | Directus as the single source of the catalogue | Eliminates the duplication across four places |

Deliberately rejected, and the reasons are worth writing down: Scrum (there is no team to synchronise), Clean/Hexagonal/Onion (the cost does not pay off at this size), microservices, Kubernetes, full UML, and TDD for now — first, some tests need to exist.

---

## 4. Modelling: which diagrams and what each must show

Five diagrams. Each answers a specific question; if it answers none, it is unnecessary.

**1. C4 level 1 — Context.** *Who uses the system and what does it talk to externally?*
Actors: customer, Paula as administrator, delivery driver. External systems: Sentoo, Meta’s WhatsApp Business, SMTP mail server, OpenStreetMap and Nominatim.

**2. C4 level 2 — Containers.** *What pieces is it made of internally?*
React/Vite frontend, Node/Express backend, Directus, PostgreSQL (shared: Directus owns the catalogue, the backend owns the commerce tables), Redis (guest carts, token blacklist), Socket.IO. This is the diagram that makes the number one risk obvious: if only Directus is published, the catalogue is visible but nobody can buy.

**3. ERD — Entity-relationship model.** *How is the data stored?*
Based on `database/init.v2.sql`. It must explicitly mark the ownership boundary between the Directus tables (`products`, `categories`, `brands`) and the commerce tables, and flag the known defects: `reviews.product_id` UUID vs. integer, `order_items.variant_id` integer vs. UUID, double source of stock.

**4. Sequence diagram — Purchase with Sentoo.** *What exactly happens, and in what order, at payment?*
Customer → checkout → backend creates the order in a transaction with stock locking → call to Sentoo → redirect → return to `/payment/callback` → incoming webhook → **backend re-verifies against Sentoo** → Socket.IO updates the screen. That re-verification step is the design decision to highlight.

**5. State diagram — Order.** *What can happen to an order and which transitions are illegal?*
Pending → paid → preparing → out for delivery → delivered, plus cancelled and refunded. This diagram is what justifies the `order_status_history` table that does not exist today.

Optional diagram if the research needs to cover processes: **activity diagram for returns**, which cannot be drawn today because the process does not exist — and that is precisely why it is worth designing before programming it.

---

## 5. Testing strategy

The **Testing Trophy** is chosen over the classic pyramid. Reason: in a store of this size almost all real bugs are at the seams — route with database, component with state, checkout with Redis — not inside isolated pure functions. The Trophy puts the weight on integration tests, which is where the failures are, and adds a base of static analysis that catches an entire class of errors for free. For services with deep business logic the pyramid still makes sense; this is not one of them.

**Layer 1 — Static.** ESLint and type checking with JSDoc, `npm audit` and Dependabot in CI. Near-zero cost; catches naming errors and vulnerable dependencies (covers A03 of the OWASP Top 10).

**Layer 2 — Unit, with Vitest.** Only what has real logic and deserves isolation: shipping rate calculation by zone and free-shipping threshold, coupon validation and application, zone detection from coordinates, and the perfume quiz recommendation algorithm.

**Layer 3 — Integration, the bulk.** Supertest against Express with real Postgres and Redis in containers — CI already starts them, so the infrastructure is there. This covers: sign-up and verification, the full refresh-token cycle, guest cart merge on login, checkout with insufficient stock, checkout with two simultaneous purchases of the last unit, a coupon applied twice, and the payment webhook with a forged message (it must reject it because it re-verifies).

**Layer 4 — End-to-end, with Playwright.** Few, and only for things that cost money if they break. Eight flows:
1. Search for a product → product page → add to cart → guest checkout → cash on delivery.
2. Purchase with Sentoo in the test environment through to the confirmation screen.
3. Sign up → verification → login → the guest cart survives.
4. End-to-end password recovery (impossible today: the page does not exist).
5. Delivery zone detection and rate calculation at checkout.
6. Apply a coupon and see the recalculated total.
7. Order tracking by number, without being logged in.
8. Access to `/admin` without being an admin: must be rejected (it would fail today).

Vitest and Playwright are today’s reference combination: in the State of JavaScript 2025 survey Vitest has the highest retention of any testing tool at 96%, ahead of Playwright at 91%.

**CI rule.** No test that depends on real external services. Sentoo, Meta and SMTP are mocked. Flow 2 runs against the Sentoo test environment, in a separate job that may fail without blocking.

**Definition of done, applicable from now on.** The first goal is not a coverage percentage: it is for the eight end-to-end flows to pass green. Coverage is measured afterwards, and only on layer 3.

---

## 6. From creating the project to being live: the full lifecycle

Twelve phases. This is the skeleton of the methodology chapter.

1. **Discover.** Interviews with 5–8 customers, local competitor analysis, review of the orders already arriving via WhatsApp. Deliverable: findings and 2–3 evidence-based customer personas.
2. **Define.** Turn findings into problem statements, prioritise with MoSCoW, set the minimum launch scope and the indicators.
3. **Model.** The five diagrams from section 4 and the first ADRs.
4. **Settle the data.** Declare `init.v2.sql` official, write the forward migration with its `USING` clauses, renumber migrations, archive v1.
5. **Clean up.** Delete the ~1,300 orphaned lines, remove the duplicated catalogue leaving only Directus, extract controllers and services from the fat routes.
6. **Close the blockers.** The P0 list in section 7.
7. **Put up a safety net.** Write the tests from section 5 and make CI actually run them.
8. **Harden.** Admin second factor, token in an `httpOnly` cookie, `npm audit` in CI, audit log, inventory of payment-page scripts.
9. **Comply.** Privacy policy compliant with the Curaçao ordinance, cookie notice, access and erasure procedure, written retention policy.
10. **Measure.** Funnel analytics, error capture, uptime monitor, field Core Web Vitals.
11. **Rehearse the launch.** Restore a backup into a clean environment, an end-to-end test purchase with real money and its refund, and a rollback rehearsal.
12. **Open and operate.** On-call for the first 72 hours, weekly review of funnel and errors, and two-week cycles from then on.

---

## 7. Prioritised backlog

**P0 — cannot open without these.**
1. Frontend, backend and Directus deployed together and talking to each other (with only Directus: you can look, but not buy).
2. Seed the delivery-zone neighbourhoods in the production database.
3. Real bank account number in `payments.js:429`.
4. Rotate the default admin password.
5. Protect `/admin` on the client and confirm the server-side check.
6. Fix the reviews type bug, or disable reviews.
7. Create the `/reset-password` page, or hide the “forgot my password” link.
8. Fix the contact form (`Contact.jsx:97`) or remove it.
9. Align the `bank` / `bank_transfer` payment method.
10. Real Sentoo keys, and a complete test purchase with refund.
11. Scheduled daily backup and a tested restore.
12. Harden the Contabo VPS: firewall, key-only SSH, automatic updates.

**P1 — first two weeks.**
Funnel analytics · error capture · per-page metadata and Open Graph, `robots.txt` and `sitemap.xml` · the eight end-to-end tests with CI running them · `order_status_history` · cookie notice and privacy policy compliant with the local ordinance · token out of `localStorage` · admin second factor · declare v2 official and renumber migrations · VPS snapshots, per-container resource limits and disk-space alert.

**P2 — weeks 3 to 8.**
Abandoned-cart recovery · returns with RMA and refund · downloadable invoices · delivery-zone panel · stock management and low-stock alert · structured product data · WCAG 2.2 AA accessibility audit · decide the language based on data and set up i18n · delete orphaned code and extract controllers.

**P3 — later.**
Driver assignment and dispatch screen · live tracking · time slots · route optimisation · referrals · Google sign-in · server-side rendering.

---

## 8. Metrics: how we will know it works

Without analytics none of these can be measured today; that is why installing it is P1 and not P2.

**Business.** Visit-to-order conversion rate · average order value against the free-shipping thresholds of 75/100/150 XCG · cart abandonment rate, with the industry benchmark at 70.2% overall and 80.0% on mobile · split between web orders and WhatsApp orders · 90-day repeat purchase, which in a market of 158,006 people (CBS, 1 Jan 2026) with near-zero growth matters more than attracting new traffic.

**Product.** Step-by-step checkout drop-off · searches with no results · products viewed without being added to cart · number of form fields, with a target of 12–14.

**Technical.** LCP < 2.5 s, INP < 200 ms, CLS < 0.1 at the 75th percentile of real visits · uptime · 5xx error rate · Sentoo payment success rate · recovery time after a failure.

**Quality.** The eight flows green · CI that runs tests and does not just build · zero high-severity vulnerabilities in `npm audit`.

---

## 9. Open research questions

Questions that must be answered with real customers, not in the code.

1. What language does the customer want to shop in? Papiamentu is the mother tongue of ~81% of the population and the interface is currently in English. It is the decision with the biggest impact on the redesign, and it is being made by inertia.
2. Which payment method does she really prefer? Sentoo is backed by the local bank and is free for the buyer, but trust cannot be inferred — it has to be asked.
3. Does she complete the purchase on the site herself, or prefer to close it over WhatsApp? This determines how much to invest in the checkout versus the chatbot.
4. What holds back online shopping in Curaçao — distrust, shipping or payment?
5. Do the free-shipping thresholds (75/100/150 XCG) match the real average order value?
6. Does the sizing barrier in lingerie justify a virtual fitting room, an expanded size guide or free exchanges?
7. What returns policy can be sustained operationally on an island?

---

## 10. Sources

- OWASP Top 10:2025 — https://owasp.org/Top10/2025/
- PCI Security Standards Council, e-commerce requirements effective after 31 March 2025 — https://blog.pcisecuritystandards.org/coffee-with-the-council-podcast-guidance-for-pci-dss-e-commerce-requirements-effective-after-31-march-2025
- PCI DSS 4.0.1, changes to requirement 6.4.3 — https://www.feroot.com/blog/pci-4-0-1-has-arrived/
- Cart abandonment, Baymard meta-analysis (70.22%) and breakdown by device and sector — https://eightx.co/blog/average-ecommerce-cart-abandonment-rate-by-vertical-2026 · https://www.zipchat.ai/blog/cart-abandonment-benchmarks-and-causes
- Checkout optimisation and form fields — https://growth-engines.com/insights/ecommerce/ecommerce-checkout-optimization
- Core Web Vitals 2026, thresholds and impact on conversion — https://www.corewebvitals.io/core-web-vitals · https://neogenmedia.com/blog/core-web-vitals
- Returns management and RMA — https://www.shopify.com/blog/ecommerce-returns-management · https://www.ringly.io/blog/ecommerce-returns-management
- European Accessibility Act and WCAG 2.2 AA in e-commerce — https://www.siteimprove.com/blog/european-accessibility-act-e-commerce/ · https://www.levelaccess.com/compliance-overview/european-accessibility-act-eaa/
- Curaçao’s Landsverordening bescherming persoonsgegevens — https://www.dlapiperdataprotection.com/?t=law&c=CW · https://www.cbs.cw/landsverordening-bescherming-persoonsgegevens
- Testing Trophy vs. testing pyramid — https://www.baytechconsulting.com/blog/test-pyramid-vs-testing-trophy-whats-the-difference
- Vitest and Playwright, adoption and layer split — https://testdino.com/blog/javascript-testing-frameworks · https://www.browserstack.com/guide/vitest-vs-playwright

Curaçao market data 2025 (population: document 4 said ~185,000, but CBS gives **158,006** as of 1 Jan 2026 — https://www.cbs.cw/population; 126,000 internet users, 192,000 mobile connections, Papiamentu ~81%): taken from document 4 in `docs/planning/`, July 2026.
