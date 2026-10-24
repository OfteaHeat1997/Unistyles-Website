# Prompt: Generate UML + ERD diagrams for Unistyles

Copy everything below the line into Claude (or any AI tool) while inside this repo.

---

## PROMPT

You are a software architect. Analyze the **Unistyles Curaçao e-commerce** repository and produce two
diagrams as **Mermaid code** so I can render them in Markdown, plus a short plain-language explanation
of each (I am not a developer).

### Step 1 — Read these sources first (do not guess)
- `database/init.sql` — the base schema (source of truth for tables/columns)
- `database/migrations/*.sql` — later tables & columns (coupons, product_variants, whatsapp_messages, delivery_zones, address geocoding)
- `services/backend/src/routes/*.js` — the API surface (auth, users, cart, orders, payments, products, perfumes, skincare, categories, coupons, variants, reviews, delivery, newsletter, whatsapp, admin)
- `services/backend/src/services/*.js` — external integrations (Sentoo payments, WhatsApp)
- `services/backend/src/middleware/`, `services/backend/src/utils/` — auth, validation, db, redis
- `services/frontend/src/{pages,components,contexts,stores,services,hooks}` — React app structure
- `services/frontend/src/data/productData.js` and `curacaoZones.js` — where the product catalog and delivery zones actually live
- `docker-compose.yml`, `deploy/`, `.env.coolify.example` — deployment topology
- `docs/TECHNICAL_ARCHITECTURE.md`, `docs/PROJECT_STRUCTURE.md` — existing written architecture

### Step 2 — Deliverable A: ERD (database diagram)
Produce a `mermaid` **erDiagram** covering every table that exists in SQL, including:
users, addresses, orders, order_items, payments, carts, reviews, newsletter_subscribers,
settings, coupons, product_variants, whatsapp_messages, delivery_zones.

Rules:
- List each table's real columns with types, and mark **PK** and **FK** exactly as defined in the SQL.
- Draw relationships with correct cardinality (`||--o{`, `}o--||`, etc.) and label them
  (e.g. `users ||--o{ orders : "places"`).
- Show ENUM / CHECK constraint values (order status, payment status, etc.) in a table below the diagram.
- **Important:** explicitly flag which entities are NOT in Postgres. Products/categories currently live
  in frontend `productData.js` (and/or Directus), so `order_items.product_id`, `product_variants.product_id`
  and `reviews.product_id` are *logical* references with no DB foreign key. Draw those as dashed/annotated
  relationships to a `PRODUCT (external — not a Postgres table)` node, and say so in the notes.
- Add a "Data integrity risks" section: missing FKs, missing indexes, orphan-record risks, and what
  would need to change if products move into Postgres or Directus.

### Step 3 — Deliverable B: UML diagrams
Produce these, each as separate Mermaid code blocks:

1. **Component / deployment diagram** (`graph TB`) — browser → React/Vite frontend → Express API →
   Postgres + Redis, plus Directus CMS, Sentoo payment gateway, WhatsApp API, email/SMTP, Socket.io
   real-time channel, and the Coolify-hosted containers. Show which calls are internal vs external.
2. **Class diagram** (`classDiagram`) — model the domain objects (User, Address, Order, OrderItem,
   Payment, Cart, Product, ProductVariant, Coupon, Review, DeliveryZone, WhatsAppMessage) with their
   attributes and the main operations the API performs on them; show inheritance/composition where real.
3. **Sequence diagram** (`sequenceDiagram`) — the checkout flow end to end: browse → add to cart →
   apply coupon → select delivery zone/address → create order → Sentoo payment → webhook confirmation →
   order status update → WhatsApp/email notification. Include failure branches (payment declined, timeout).
4. **State diagram** (`stateDiagram-v2`) — the lifecycle of an order status and of a payment status,
   using the exact status values found in the SQL.
5. **Use case diagram** (`graph LR` with actor boxes) — Guest, Registered Customer, Admin, and the
   external systems, mapped to what each can actually do given the current routes.

### Step 4 — Rules for the whole answer
- Ground everything in the real code. If something is ambiguous or half-built, say
  "**Not implemented / unclear:** …" instead of inventing it.
- Cite the file (and line where useful) that each entity or relationship came from.
- Keep every Mermaid block valid and self-contained so it renders on GitHub.
- After each diagram, write 3–6 sentences in plain language explaining what it shows and why it matters.
- Finish with a short "What I'd fix in the data model before launch" list, ordered by priority.

### Step 5 — Save the output
Write the full result to `docs/DIAGRAMS.md` with a table of contents at the top.
