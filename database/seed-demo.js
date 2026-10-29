#!/usr/bin/env node
// ===========================================
// LOCAL DEMO SEED — do NOT run against production.
// Loads database/seed-data.json into the Directus catalog tables (only when
// they are empty), turns bra variants into product_variants rows with
// normalized sizes/colours, and creates demo accounts:
//   admin@example.com / driver@example.com / cliente@example.com
//   password: Demo1234!
//
// Usage (after init.v2.sql + Directus bootstrap + migrate.js):
//   DATABASE_URL=postgresql://unistyles:localdev@localhost:5433/unistyles_db node database/seed-demo.js
// ===========================================

const path = require('path');
const backendDir = path.join(__dirname, '..', 'services', 'backend');
const req = (m) => require(require.resolve(m, { paths: [backendDir] }));
const { Pool } = req('pg');
const bcrypt = req('bcryptjs');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
    console.error('DATABASE_URL is required');
    process.exit(1);
}
if (/unistylescuracao\.com|prod/i.test(DATABASE_URL) && process.env.FORCE_DEMO_SEED !== 'yes') {
    console.error('Refusing to run the demo seed against what looks like production.');
    process.exit(1);
}

const data = require('./seed-data.json');
const pool = new Pool({ connectionString: DATABASE_URL });

// Typos and duplicates found in the catalog audit (docs/PROMPT-REBUILD-DATABASE.md)
const COLOR_FIX = { BERDE: 'VERDE', BEIBE: 'BEIGE', BLACK: 'NEGRO', WHITE: 'BLANCO', 'BEIGE STAMPADO': 'BEIGE ESTAMPADO' };
const normColor = (c) => {
    const v = String(c || '').trim().replace(/\s+/g, ' ').toUpperCase();
    return COLOR_FIX[v] || v;
};
const normSize = (s) => {
    const v = String(s || '').trim().replace(/\s+/g, '').toUpperCase();
    return v === '368C' ? '36C' : v;
};
const titleCase = (s) => s.toLowerCase().replace(/\b\p{L}/gu, ch => ch.toUpperCase());
const slugify = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function seedCatalog(client) {
    const existing = await client.query('SELECT COUNT(*)::int AS n FROM products');
    if (existing.rows[0].n > 0) {
        console.log(`  · products already has ${existing.rows[0].n} rows — catalog left untouched`);
        return;
    }

    const brandIds = new Map();
    const ensureBrand = async (name) => {
        if (!name) return null;
        const key = name.trim();
        if (brandIds.has(key)) return brandIds.get(key);
        const r = await client.query('INSERT INTO brands (name, slug) VALUES ($1, $2) RETURNING id', [key, slugify(key)]);
        brandIds.set(key, r.rows[0].id);
        return r.rows[0].id;
    };

    let sort = 0;
    let productCount = 0;
    let variantCount = 0;
    const usedSlugs = new Set();

    for (const [slug, cat] of Object.entries(data)) {
        const c = await client.query(
            `INSERT INTO categories (name, slug, description, breadcrumb, filter_type, filters, sort_order, show_in_menu)
             VALUES ($1, $2, $3, $4, $5, $6, $7, true) RETURNING id`,
            [cat.title, slug, cat.description || null, cat.breadcrumb || null,
             ['size', 'style', 'category', 'compression'].includes(cat.filterType) ? cat.filterType : null,
             cat.filters ? JSON.stringify(cat.filters) : null, sort++]
        );
        const categoryId = c.rows[0].id;

        for (const p of cat.products || []) {
            const brandId = await ensureBrand(p.brand);
            let pslug = slugify(`${p.name}-${p.ref || p.id}`);
            while (usedSlugs.has(pslug)) pslug += '-x';
            usedSlugs.add(pslug);

            // Merge variant duplicates created by spacing/typos ("36 B" vs "36B")
            const merged = new Map();
            for (const v of p.variants || []) {
                const size = normSize(v.size);
                const color = normColor(v.color);
                if (!size && !color) continue;
                const key = `${size}|${color}`;
                const prev = merged.get(key);
                merged.set(key, { size, color, sku: prev?.sku || v.sku, stock: (prev?.stock || 0) + Number(v.stockQuantity || 0) });
            }
            const variants = [...merged.values()];
            const stock = variants.length ? variants.reduce((s, v) => s + v.stock, 0) : Number(p.stockQuantity || 0);

            const r = await client.query(
                `INSERT INTO products (name, slug, ref, description, price, legacy_image, color, size,
                                       in_stock, stock_quantity, featured, sort_order, legacy_id, category_id, brand_id)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING id`,
                [p.name, pslug, p.ref || null, p.description || null, p.price, p.image || null,
                 variants.length ? null : (p.color ? titleCase(normColor(p.color)) : null),
                 variants.length ? null : (p.size || null),
                 stock > 0, stock, productCount < 8, productCount, String(p.id), categoryId, brandId]
            );
            const productId = r.rows[0].id;
            productCount++;

            for (const v of variants) {
                await client.query(
                    `INSERT INTO product_variants (product_id, size, color, sku, stock_quantity, is_active)
                     VALUES ($1, $2, $3, $4, $5, true)
                     ON CONFLICT DO NOTHING`,
                    [productId, v.size || null, v.color ? titleCase(v.color) : null, v.sku || null, v.stock]
                );
                variantCount++;
            }
        }
    }
    console.log(`  + ${Object.keys(data).length} categories, ${brandIds.size} brands, ${productCount} products, ${variantCount} variants`);
}

async function seedUsers(client) {
    const hash = await bcrypt.hash('Demo1234!', 12);
    const users = [
        ['admin@example.com', 'Paula', 'Admin', '+5999 000 0001', 'admin'],
        ['driver@example.com', 'Ricardo', 'Driver', '+5999 000 0002', 'driver'],
        ['cliente@example.com', 'Maria', 'Cliente', '+5999 000 0003', 'customer']
    ];
    for (const [email, first, last, phone, role] of users) {
        await client.query(
            `INSERT INTO users (email, password_hash, first_name, last_name, phone, role, is_verified)
             VALUES ($1, $2, $3, $4, $5, $6, true)
             ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, is_verified = true, password_hash = EXCLUDED.password_hash`,
            [email, hash, first, last, phone, role]
        );
    }
    console.log('  + demo users: admin@example.com, driver@example.com, cliente@example.com (Demo1234!)');
}

(async () => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        console.log('Seeding demo data…');
        await seedCatalog(client);
        await seedUsers(client);
        // Pending approval stays visible in admin; demo pickup point gets a real-looking address.
        await client.query(`UPDATE pickup_locations SET address = 'Schottegatweg Oost (demo address)' WHERE address LIKE '%pending approval%'`);
        await client.query('COMMIT');
        console.log('Done.');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Seed failed:', err.message);
        process.exitCode = 1;
    } finally {
        client.release();
        await pool.end();
    }
})();
