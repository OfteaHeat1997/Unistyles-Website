# Unistyles Project Structure

## Professional Folder Organization

```
unistyles-website/
│
├── 📁 frontend/                    # React Frontend Application
│   │
│   ├── 📁 public/                  # Static public assets
│   │   └── favicon.svg             # Website icon
│   │
│   ├── 📁 src/                     # Source code
│   │   │
│   │   ├── 📁 assets/              # Static assets (imported in code)
│   │   │   ├── 📁 images/          # Images, photos, banners
│   │   │   │   ├── products/       # Product photos
│   │   │   │   ├── categories/     # Category banners
│   │   │   │   └── banners/        # Hero & promo images
│   │   │   ├── 📁 fonts/           # Custom fonts (if not using Google Fonts)
│   │   │   └── 📁 icons/           # Custom SVG icons
│   │   │
│   │   ├── 📁 components/          # Reusable UI components
│   │   │   ├── Layout.jsx          # Main layout wrapper
│   │   │   ├── Header.jsx          # Navigation header
│   │   │   ├── Footer.jsx          # Site footer
│   │   │   ├── CartSidebar.jsx     # Shopping cart panel
│   │   │   ├── ProductCard.jsx     # Product display card
│   │   │   └── WhatsAppButton.jsx  # Floating WhatsApp
│   │   │
│   │   ├── 📁 pages/               # Page components (routes)
│   │   │   ├── Home.jsx            # Homepage
│   │   │   ├── Category.jsx        # Product listing
│   │   │   ├── Product.jsx         # Product details
│   │   │   ├── Cart.jsx            # Shopping cart
│   │   │   ├── Checkout.jsx        # Checkout flow
│   │   │   ├── OrderConfirmation.jsx
│   │   │   ├── TrackOrder.jsx
│   │   │   ├── About.jsx
│   │   │   ├── Contact.jsx
│   │   │   ├── SizeGuide.jsx
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   ├── Account.jsx
│   │   │   └── NotFound.jsx
│   │   │
│   │   ├── 📁 config/              # ⭐ DESIGN & CONFIGURATION
│   │   │   ├── theme.js            # Colors, fonts, spacing
│   │   │   ├── constants.js        # Business settings, categories
│   │   │   └── index.js            # Export all config
│   │   │
│   │   ├── 📁 stores/              # State management (Zustand)
│   │   │   ├── cartStore.js        # Shopping cart state
│   │   │   └── authStore.js        # User authentication
│   │   │
│   │   ├── 📁 utils/               # Utility functions
│   │   │   └── api.js              # API client (axios)
│   │   │
│   │   ├── 📁 hooks/               # Custom React hooks
│   │   │   └── (add custom hooks here)
│   │   │
│   │   ├── App.jsx                 # Main app with routes
│   │   ├── main.jsx                # Entry point
│   │   └── index.css               # Global CSS & Tailwind
│   │
│   ├── index.html                  # HTML template
│   ├── package.json                # Dependencies
│   ├── vite.config.js              # Build config
│   ├── tailwind.config.js          # Tailwind theme
│   ├── postcss.config.js           # PostCSS
│   ├── Dockerfile                  # Docker build
│   └── nginx.conf                  # Nginx config
│
├── 📁 backend/                     # Node.js Backend API
│   │
│   ├── 📁 src/
│   │   ├── 📁 routes/              # API endpoints
│   │   │   ├── auth.js
│   │   │   ├── products.js
│   │   │   ├── categories.js
│   │   │   ├── cart.js
│   │   │   ├── orders.js
│   │   │   ├── payments.js
│   │   │   └── users.js
│   │   │
│   │   ├── 📁 middleware/          # Express middleware
│   │   │   ├── auth.js
│   │   │   └── errorHandler.js
│   │   │
│   │   ├── 📁 utils/               # Utilities
│   │   │   ├── db.js               # Database connection
│   │   │   ├── redis.js            # Redis connection
│   │   │   └── notifications.js    # Email/WhatsApp
│   │   │
│   │   └── index.js                # Server entry
│   │
│   ├── package.json
│   └── Dockerfile
│
├── 📁 database/
│   └── init.sql                    # Database schema
│
├── 📁 nginx/
│   ├── nginx.conf                  # Production config
│   └── 📁 ssl/                     # SSL certificates
│
├── docker-compose.yml              # Docker orchestration
├── .env.example                    # Environment template
└── README.md                       # Documentation
```

---

## ⭐ Design Control Center

### Changing Colors

Edit `frontend/src/config/theme.js`:

```javascript
// Change primary brand color (gold)
primary: {
  500: '#C5A55A',  // ← Change this hex code
  // ... other shades auto-generate in Tailwind
}

// Change secondary color (teal)
secondary: {
  500: '#1B4D4F',  // ← Change this hex code
}
```

Then update `frontend/tailwind.config.js` to match.

### Changing Fonts

Edit `frontend/src/config/theme.js`:

```javascript
fonts: {
  heading: "'Playfair Display', Georgia, serif",  // ← Change heading font
  body: "'Inter', system-ui, sans-serif",         // ← Change body font
}
```

Then update `frontend/index.html` Google Fonts link.

### Changing Business Info

Edit `frontend/src/config/constants.js`:

```javascript
export const BUSINESS = {
  name: 'Unistyles Curacao',
  email: 'info@unistylescuracao.com',
  phone: '+599 9 XXX XXXX',
  whatsapp: '5999XXXXXXX',
  // ...
}
```

### Changing Categories

Edit `frontend/src/config/constants.js`:

```javascript
export const CATEGORIES = [
  { name: 'Bras', slug: 'bras', description: '...' },
  // Add or modify categories here
]
```

### Changing Payment Methods

Edit `frontend/src/config/constants.js`:

```javascript
export const PAYMENT_METHODS = [
  { id: 'cod', name: 'Cash on Delivery', ... },
  // Add or modify payment options
]
```

---

## CSS Architecture

### Global Styles
- `src/index.css` - Tailwind imports + custom CSS classes

### Component Styles
- Each component uses Tailwind classes inline
- Reusable classes defined in `index.css` (btn-primary, input, etc.)

### Theme Integration
```javascript
// In any component:
import { theme } from '../config';

// Use theme values
<div style={{ color: theme.colors.primary[500] }}>
```

---

## Adding Images

1. **Product Images**: Place in `src/assets/images/products/`
2. **Category Banners**: Place in `src/assets/images/categories/`
3. **Hero Banners**: Place in `src/assets/images/banners/`

Reference in code:
```javascript
import productImage from '../assets/images/products/bra-001.jpg';
// or
<img src="/images/products/bra-001.jpg" />
```

---

## Quick Customization Checklist

| What to Change | File to Edit |
|----------------|--------------|
| Brand colors | `config/theme.js` + `tailwind.config.js` |
| Fonts | `config/theme.js` + `index.html` |
| Business info | `config/constants.js` |
| Categories | `config/constants.js` |
| Payment methods | `config/constants.js` |
| Delivery fees | `config/constants.js` |
| Size charts | `config/constants.js` |
| Button styles | `src/index.css` |
| Global CSS | `src/index.css` |
