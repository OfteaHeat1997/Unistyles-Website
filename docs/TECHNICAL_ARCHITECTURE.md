# UNISTYLES E-Commerce - Technical Architecture

## Technology Stack Recommendation

### Frontend (Client-Side)
| Technology | Purpose | Why |
|------------|---------|-----|
| **HTML5** | Structure | Semantic, accessible, SEO-friendly |
| **CSS3** | Styling | Modern features, responsive design |
| **JavaScript (Vanilla/Alpine.js)** | Interactivity | Lightweight, fast, no framework overhead |
| **Font Awesome** | Icons | Widely supported, professional icons |

### Backend (Server-Side)
| Technology | Purpose | Why |
|------------|---------|-----|
| **Node.js + Express** | API Server | Fast, JavaScript everywhere, large ecosystem |
| **PostgreSQL** | Database | Reliable, ACID compliant, perfect for e-commerce |
| **Redis** | Caching/Sessions | Fast sessions, cart storage |
| **Nginx** | Reverse Proxy | SSL termination, load balancing, static files |

### DevOps & Infrastructure
| Technology | Purpose | Why |
|------------|---------|-----|
| **Docker** | Containerization | Consistent environments, easy deployment |
| **Docker Compose** | Multi-container | Orchestrate all services together |
| **Let's Encrypt** | SSL/TLS | Free HTTPS certificates |
| **Cloudflare** | CDN/Security | DDoS protection, caching, SSL |

---

## Security & Encryption Requirements

### 1. HTTPS/SSL (MANDATORY)
```
- All traffic must be encrypted with TLS 1.2+
- Use Let's Encrypt for free certificates
- Force HTTPS redirect (no HTTP)
- HSTS header enabled
```

### 2. Data Encryption
```
- Passwords: bcrypt with cost factor 12+
- Sensitive data: AES-256 encryption at rest
- Payment data: NEVER store card numbers (use payment providers)
- Session tokens: Secure, HttpOnly, SameSite cookies
```

### 3. API Security
```
- CORS: Restrict to your domain only
- Rate limiting: 100 requests/minute per IP
- Input validation: Sanitize ALL user input
- SQL injection prevention: Parameterized queries
- XSS prevention: Escape output, CSP headers
```

### 4. Authentication
```
- JWT tokens with short expiry (1 hour)
- Refresh tokens with rotation
- Password requirements: Min 8 chars, mixed case, numbers
- Account lockout after 5 failed attempts
```

---

## Privacy Rules (GDPR/CCPA Compliance)

### Required for Curacao E-Commerce:

1. **Privacy Policy Page** (MANDATORY)
   - What data you collect
   - How you use it
   - Who you share it with
   - User rights (access, delete, export)

2. **Cookie Consent Banner**
   - Must get consent before tracking cookies
   - Allow users to opt-out

3. **Data Minimization**
   - Only collect what's necessary
   - Don't store payment card details
   - Delete old orders after retention period

4. **User Rights**
   - Right to access their data
   - Right to delete account
   - Right to export data

5. **Secure Data Handling**
   - Encrypt personal data
   - Limit employee access
   - Log all data access

---

## Backend Requirements

### Database Schema (PostgreSQL)

```sql
-- Users
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(20),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Products
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    sku VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    category_id INTEGER REFERENCES categories(id),
    brand VARCHAR(100),
    stock INTEGER DEFAULT 0,
    images JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Categories
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    parent_id INTEGER REFERENCES categories(id)
);

-- Orders
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    status VARCHAR(50) DEFAULT 'pending',
    payment_method VARCHAR(50),
    payment_status VARCHAR(50) DEFAULT 'pending',
    subtotal DECIMAL(10,2),
    delivery_fee DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2),
    shipping_address JSONB,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Order Items
CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id),
    product_id INTEGER REFERENCES products(id),
    quantity INTEGER NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    size VARCHAR(20),
    color VARCHAR(50)
);
```

### API Endpoints Needed

```
Authentication:
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/refresh

Products:
GET  /api/products
GET  /api/products/:id
GET  /api/products/category/:slug
GET  /api/products/search?q=

Cart:
GET  /api/cart
POST /api/cart/add
PUT  /api/cart/update
DELETE /api/cart/remove/:id

Orders:
POST /api/orders
GET  /api/orders
GET  /api/orders/:id

Payments:
POST /api/payments/cod
POST /api/payments/sentoo
POST /api/payments/bank-transfer

User:
GET  /api/user/profile
PUT  /api/user/profile
GET  /api/user/orders
```

---

## Docker Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      NGINX (Port 80/443)                │
│                   SSL Termination + Proxy               │
└─────────────────────┬───────────────────────────────────┘
                      │
         ┌────────────┴────────────┐
         │                         │
         ▼                         ▼
┌─────────────────┐      ┌─────────────────┐
│   Frontend      │      │   Backend API   │
│   Static Files  │      │   Node.js       │
│   (Nginx)       │      │   Port 3000     │
└─────────────────┘      └────────┬────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
                    ▼                           ▼
          ┌─────────────────┐         ┌─────────────────┐
          │   PostgreSQL    │         │     Redis       │
          │   Port 5432     │         │   Port 6379     │
          │   (Database)    │         │  (Sessions)     │
          └─────────────────┘         └─────────────────┘
```

---

## Performance Optimization

### Frontend Performance
1. **Image Optimization**
   - WebP format with JPEG fallback
   - Lazy loading for below-fold images
   - Responsive images (srcset)
   - Max 200KB per product image

2. **CSS/JS Optimization**
   - Minified production files
   - Gzip compression
   - Critical CSS inline
   - Defer non-critical JS

3. **Caching Strategy**
   - Static assets: 1 year cache
   - API responses: Redis cache 5 min
   - Product pages: CDN edge cache

### Backend Performance
1. **Database**
   - Indexed columns (id, sku, category_id)
   - Connection pooling
   - Query optimization

2. **API**
   - Response compression
   - Pagination (20 items/page)
   - Rate limiting

---

## File Structure

```
unistyles-website/
├── docker-compose.yml
├── .env.example
├── nginx/
│   ├── nginx.conf
│   └── ssl/
├── frontend/
│   ├── Dockerfile
│   ├── index.html
│   ├── css/
│   ├── js/
│   └── images/
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── src/
│   │   ├── index.js
│   │   ├── config/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── models/
│   │   ├── middleware/
│   │   └── utils/
│   └── prisma/
│       └── schema.prisma
└── database/
    └── init.sql
```

---

## Payment Integration Notes

### Sentoo (Curacao)
- Register as merchant at sentoo.com
- Use their API or payment links
- Webhook for payment confirmation

### Cash on Delivery (COD)
- No integration needed
- Mark order as "pending_delivery"
- Update to "paid" on delivery

### Bank Transfer
- Display bank details
- Manual verification
- Email notification system

---

## Deployment Checklist

- [ ] SSL certificate configured
- [ ] Environment variables set
- [ ] Database migrations run
- [ ] Backup system configured
- [ ] Monitoring setup (uptime)
- [ ] Error logging enabled
- [ ] Rate limiting active
- [ ] CORS configured
- [ ] CSP headers set
- [ ] Domain DNS configured
