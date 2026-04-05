#!/usr/bin/env node
// ===========================================
// DATABASE MIGRATION RUNNER
// Runs numbered SQL files from ./migrations/
// Tracks applied migrations in schema_migrations table
//
// Usage: node database/migrate.js
// Env: DATABASE_URL must be set
// ===========================================

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
    console.error('FATAL: DATABASE_URL environment variable is required');
    process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function run() {
    const client = await pool.connect();

    try {
        // Create tracking table if it doesn't exist
        await client.query(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                id SERIAL PRIMARY KEY,
                filename VARCHAR(255) NOT NULL UNIQUE,
                applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        `);

        // Get already-applied migrations
        const applied = await client.query('SELECT filename FROM schema_migrations ORDER BY filename');
        const appliedSet = new Set(applied.rows.map(r => r.filename));

        // Get migration files sorted by name
        const files = fs.readdirSync(MIGRATIONS_DIR)
            .filter(f => f.endsWith('.sql'))
            .sort();

        if (files.length === 0) {
            console.log('No migration files found in', MIGRATIONS_DIR);
            return;
        }

        let count = 0;
        for (const file of files) {
            if (appliedSet.has(file)) {
                console.log(`  SKIP  ${file} (already applied)`);
                continue;
            }

            console.log(`  RUN   ${file}...`);
            const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');

            await client.query('BEGIN');
            try {
                await client.query(sql);
                await client.query(
                    'INSERT INTO schema_migrations (filename) VALUES ($1)',
                    [file]
                );
                await client.query('COMMIT');
                console.log(`  OK    ${file}`);
                count++;
            } catch (err) {
                await client.query('ROLLBACK');
                console.error(`  FAIL  ${file}: ${err.message}`);
                process.exit(1);
            }
        }

        if (count === 0) {
            console.log('All migrations already applied.');
        } else {
            console.log(`\nApplied ${count} migration(s) successfully.`);
        }

    } finally {
        client.release();
        await pool.end();
    }
}

run().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
