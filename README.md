# Unistyles E-Commerce Website

A complete e-commerce solution for Unistyles Curacao - selling Colombian beauty products to Caribbean women.

## Tech Stack

### Frontend
- **React 18** with Vite
- **Tailwind CSS** for styling
- **React Query** for data fetching
- **Zustand** for state management
- **React Router** for navigation

### Backend
- **Node.js** with Express
- **PostgreSQL** for database
- **Redis** for session/cache
- **JWT** for authentication
- **bcrypt** for password hashing

### Infrastructure
- **Docker** & Docker Compose
- **Nginx** for reverse proxy

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 20+ (for local development)

### Development Setup

1. **Clone and setup environment:**
```bash
cd unistyles-website
cp .env.example .env
# Edit .env with your values
```

2. **Start with Docker:**
```bash
docker-compose up -d
```

3. **Access the application:**
- Frontend: http://localhost
- Backend API: http://localhost/api
- Adminer (DB): http://localhost:8080 (dev mode only)

### Local Development (without Docker)

1. **Backend:**
```bash
cd backend
npm install
npm run dev
```

2. **Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## Project Structure

```
unistyles-website/
├── backend/
│   ├── src/
│   │   ├── routes/          # API routes
│   │   ├── middleware/      # Express middleware
│   │   └── utils/           # Utilities
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── pages/           # Page components
│   │   ├── stores/          # Zustand stores
│   │   └── utils/           # Utilities
│   ├── Dockerfile
│   └── package.json
├── database/
│   └── init.sql             # Database schema
├── nginx/
│   └── nginx.conf           # Nginx config
├── docker-compose.yml
└── .env.example
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `POST /api/auth/refresh` - Refresh token

### Products
- `GET /api/products` - List products
- `GET /api/products/:slug` - Get product details
- `GET /api/categories` - List categories

### Cart & Orders
- `GET /api/cart` - Get cart
- `POST /api/cart/add` - Add to cart
- `POST /api/orders` - Create order
- `GET /api/orders/track/:orderNumber` - Track order

### Payments
- `POST /api/payments/cod` - Cash on Delivery
- `POST /api/payments/sentoo` - Sentoo payment
- `POST /api/payments/bank-transfer` - Bank transfer

## Payment Methods

1. **Cash on Delivery (COD)** - Primary method for Curacao market
2. **Sentoo** - Local mobile payment app
3. **Bank Transfer** - Traditional bank payment

## Environment Variables

See `.env.example` for all required variables:
- Database credentials
- JWT secrets
- Sentoo API keys
- WhatsApp number
- SMTP settings

## Features

- Responsive design optimized for 40-65 age group
- Guest checkout (no account required)
- WhatsApp integration for support
- Order tracking
- Size guide
- Multi-currency (ANG)
- Island-wide delivery
- Free delivery over ANG 150

## Deployment

### Production with Docker
```bash
docker-compose --profile production up -d
```

### SSL Setup
1. Place SSL certificates in `nginx/ssl/`
2. Update nginx.conf with your domain
3. Restart nginx container

## License

Private - Unistyles Curacao
