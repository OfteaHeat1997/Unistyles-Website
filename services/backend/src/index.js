// ===========================================
// UNISTYLES E-COMMERCE - BACKEND API SERVER
// ===========================================

require('dotenv').config();
const validateEnv = require('./utils/validateEnv');
validateEnv();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

// Import routes
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const perfumeRoutes = require('./routes/perfumes');
const skincareRoutes = require('./routes/skincare');
const categoryRoutes = require('./routes/categories');
const cartRoutes = require('./routes/cart');
const orderRoutes = require('./routes/orders');
const paymentRoutes = require('./routes/payments');
const userRoutes = require('./routes/users');
const adminRoutes = require('./routes/admin');
const whatsappRoutes = require('./routes/whatsapp');
const newsletterRoutes = require('./routes/newsletter');
const reviewRoutes = require('./routes/reviews');
const couponRoutes = require('./routes/coupons');
const variantRoutes = require('./routes/variants');
const deliveryRoutes = require('./routes/delivery');

// Import middleware
const { errorHandler } = require('./middleware/errorHandler');
const { authenticate, adminOnly } = require('./middleware/auth');
const { logger, requestLogger } = require('./utils/logger');

// Initialize Express
const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy (for nginx reverse proxy)
app.set('trust proxy', 1);

// ===========================================
// SECURITY MIDDLEWARE
// ===========================================

// Helmet - Security headers
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:"],
            scriptSrc: ["'self'"],
        },
    },
    crossOriginEmbedderPolicy: false,
}));

// CORS configuration — allowlist is built from env so staging / preview
// domains work without code changes. FRONTEND_URL is the SPA origin;
// DIRECTUS_URL covers admin-driven server-to-server calls during migrations.
const corsAllowlist = (() => {
    const fromEnv = [
        process.env.FRONTEND_URL,
        process.env.DIRECTUS_URL,
        process.env.SITE_URL,
    ].filter(Boolean);

    if (process.env.NODE_ENV === 'production') {
        return fromEnv.length > 0
            ? fromEnv
            : ['https://unistylescuracao.com', 'https://www.unistylescuracao.com'];
    }
    return [
        ...fromEnv,
        'http://localhost:3000',
        'http://localhost:5173',
        'http://127.0.0.1:5173',
    ];
})();

app.use(cors({
    origin: corsAllowlist,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Cart-Id'],
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: { error: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        // Bypass rate limiter for Sentoo webhook (external service, must always accept)
        return req.path === '/api/payments/sentoo/webhook' && req.method === 'POST';
    }
});
app.use('/api/', limiter);

// Stricter rate limit for auth routes
const authLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // limit each IP to 10 login attempts per hour
    message: { error: 'Too many login attempts, please try again later.' },
});
app.use('/api/auth/login', authLimiter);

// Stricter rate limit for coupon validation (prevent enumeration)
const couponLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 30, // 30 attempts per 15 min
    message: { error: 'Too many coupon attempts, please try again later.' },
});
app.use('/api/coupons/validate', couponLimiter);
app.use('/api/coupons/apply', couponLimiter);

// Rate limit for review submissions
const reviewLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 reviews per hour
    message: { error: 'Too many reviews submitted, please try again later.' },
});
app.use('/api/reviews', reviewLimiter);

// ===========================================
// GENERAL MIDDLEWARE
// ===========================================

// Request tracing — attach unique ID to every request for debugging
app.use((req, res, next) => {
    const requestId = req.headers['x-request-id'] || require('uuid').v4();
    req.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);
    next();
});

// Compression
app.use(compression());

// Logging — structured logger + morgan for access logs
app.use(requestLogger);
if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('combined'));
}

// Capture raw body for WhatsApp webhook signature verification
app.use('/api/whatsapp/webhook', express.json({
    limit: '10mb',
    verify: (req, _res, buf) => { req.rawBody = buf; }
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ===========================================
// HEALTH CHECK & METRICS
// ===========================================
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

app.get('/metrics', authenticate, adminOnly, (req, res) => {
    const memUsage = process.memoryUsage();
    res.json({
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        memory: {
            rss: Math.round(memUsage.rss / 1024 / 1024) + 'MB',
            heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
            heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB'
        },
        pid: process.pid,
        nodeVersion: process.version
    });
});

// ===========================================
// API ROUTES
// ===========================================
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/perfumes', perfumeRoutes);
app.use('/api/skincare', skincareRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/users', authenticate, userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/newsletter', newsletterRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/variants', variantRoutes);
app.use('/api/delivery', deliveryRoutes);

// ===========================================
// 404 HANDLER
// ===========================================
app.use('/api/*', (req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// ===========================================
// ERROR HANDLER
// ===========================================
app.use(errorHandler);

// ===========================================
// START SERVER WITH WEBSOCKET
// ===========================================
const http = require('http');
const { Server: SocketServer } = require('socket.io');

const server = http.createServer(app);

// Socket.IO for real-time payment updates — reuses the HTTP CORS allowlist
// so the SPA's WebSocket origin matches its REST origin.
const io = new SocketServer(server, {
    cors: {
        origin: corsAllowlist,
        credentials: true
    },
    path: '/ws'
});

io.on('connection', (socket) => {
    logger.info('WebSocket client connected', { socketId: socket.id });

    // Client joins a room for their order to receive payment updates
    socket.on('join-order', (orderId) => {
        if (orderId && typeof orderId === 'string') {
            socket.join(`order:${orderId}`);
            logger.info('Client joined order room', { socketId: socket.id, orderId });
        }
    });

    socket.on('disconnect', () => {
        logger.info('WebSocket client disconnected', { socketId: socket.id });
    });
});

// Make io accessible to routes
app.set('io', io);

server.listen(PORT, () => {
    logger.info(`Unistyles API Server started`, { port: PORT, mode: process.env.NODE_ENV || 'development' });
    console.log(`
    ╔═══════════════════════════════════════════╗
    ║     UNISTYLES E-COMMERCE API SERVER       ║
    ╠═══════════════════════════════════════════╣
    ║  Status:  Running                         ║
    ║  Port:    ${PORT}                            ║
    ║  Mode:    ${process.env.NODE_ENV || 'development'}                     ║
    ║  WebSocket: Enabled (/ws)                 ║
    ╚═══════════════════════════════════════════╝
    `);
});

module.exports = { app, server, io };
