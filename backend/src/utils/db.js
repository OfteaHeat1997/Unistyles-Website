// ===========================================
// DATABASE CONNECTION - PostgreSQL
// With retry logic for Docker startup ordering
// ===========================================

const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
});

pool.on('connect', () => {
    console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle PostgreSQL client', err);
});

/**
 * Retry database connection with exponential backoff.
 * Useful when PostgreSQL starts slower than the backend in Docker.
 */
async function connectWithRetry(maxRetries = 5) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const client = await pool.connect();
            await client.query('SELECT 1');
            client.release();
            console.log(`PostgreSQL connected (attempt ${attempt})`);
            return;
        } catch (err) {
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
            console.warn(`DB connection attempt ${attempt}/${maxRetries} failed: ${err.message}. Retrying in ${delay}ms...`);
            if (attempt === maxRetries) {
                console.error('FATAL: Could not connect to PostgreSQL after max retries');
                process.exit(1);
            }
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

// Initiate connection on module load
connectWithRetry().catch(() => process.exit(1));

module.exports = {
    query: (text, params) => pool.query(text, params),
    getClient: () => pool.connect(),
    pool
};
