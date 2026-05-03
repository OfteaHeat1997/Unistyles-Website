// ===========================================
// ENVIRONMENT VARIABLE VALIDATION
// Fails fast on startup if critical vars are missing
// ===========================================

function validateEnv() {
    const required = [
        'DATABASE_URL',
        'REDIS_URL',
        'JWT_SECRET'
    ];

    const recommended = [
        'WHATSAPP_NUMBER',
        'SENTOO_API_KEY',
        'SENTOO_MERCHANT_ID',
        'SITE_URL'
    ];

    const missing = required.filter(key => !process.env[key]);
    const missingRecommended = recommended.filter(key => !process.env[key]);

    if (missing.length > 0) {
        console.error('\n╔═══════════════════════════════════════════╗');
        console.error('║  FATAL: Missing required env variables     ║');
        console.error('╚═══════════════════════════════════════════╝');
        missing.forEach(key => console.error(`  ✗ ${key}`));
        console.error('\nCopy .env.example to .env and fill in values.\n');
        process.exit(1);
    }

    if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
        console.error('FATAL: JWT_SECRET must be at least 32 characters long');
        process.exit(1);
    }

    if (missingRecommended.length > 0) {
        console.warn('\n⚠️  Missing recommended env variables (some features disabled):');
        missingRecommended.forEach(key => console.warn(`  - ${key}`));
        console.warn('');
    }
}

module.exports = validateEnv;
