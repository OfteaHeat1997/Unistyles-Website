#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * One-shot data migration: database/seed-data.json → Directus.
 *
 * Run AFTER services/directus/bootstrap.js has created the schema.
 *
 *   DIRECTUS_URL=https://cms.unistylescuracao.com \
 *   DIRECTUS_ADMIN_EMAIL=admin@unistylescuracao.com \
 *   DIRECTUS_ADMIN_PASSWORD=*** \
 *   node deploy/scripts/migrate-strapi-to-directus.js
 *
 * Idempotent within a category — products are upserted by their `legacy_id`
 * (the original Strapi/seed `id` field), so re-running won't duplicate rows.
 *
 * Images: kept as `legacy_image` string paths pointing at /images/... — those
 * files are served by the frontend nginx container, so the URLs keep working.
 * The `image` UUID column stays null until you upload media via the Directus
 * admin UI.
 */

const fs = require('fs');
const path = require('path');

const DIRECTUS_URL = (process.env.DIRECTUS_URL || 'http://localhost:8055').replace(/\/$/, '');
const ADMIN_EMAIL = process.env.DIRECTUS_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.DIRECTUS_ADMIN_PASSWORD;
const SEED_PATH = process.env.SEED_PATH || path.join(__dirname, '..', '..', 'database', 'seed-data.json');

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error('DIRECTUS_ADMIN_EMAIL and DIRECTUS_ADMIN_PASSWORD env vars are required.');
    process.exit(1);
}

let token = null;

async function api(p, options = {}) {
    const res = await fetch(`${DIRECTUS_URL}${p}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(options.headers || {}),
        },
    });
    const text = await res.text();
    const body = text ? JSON.parse(text) : null;
    if (!res.ok) {
        const err = new Error(`${options.method || 'GET'} ${p} → ${res.status}: ${text}`);
        err.status = res.status;
        err.body = body;
        throw err;
    }
    return body;
}

async function login() {
    const r = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    });
    token = r.data.access_token;
}

function slugify(s) {
    return String(s || '')
        .toLowerCase()
        .replace(/['"]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

// ----------------------------------------------------------------------------
// Brands
// ----------------------------------------------------------------------------
async function ensureBrand(brandName, brandCache) {
    if (!brandName) return null;
    const slug = slugify(brandName);
    if (brandCache.has(slug)) return brandCache.get(slug);

    const existing = await api(`/items/brands?filter[slug][_eq]=${encodeURIComponent(slug)}&limit=1`);
    if (existing.data && existing.data.length > 0) {
        brandCache.set(slug, existing.data[0].id);
        return existing.data[0].id;
    }

    const created = await api('/items/brands', {
        method: 'POST',
        body: JSON.stringify({ name: brandName, slug, country: 'Colombia', featured: false }),
    });
    brandCache.set(slug, created.data.id);
    console.log(`  + brand ${brandName} (${slug})`);
    return created.data.id;
}

// ----------------------------------------------------------------------------
// Categories
// ----------------------------------------------------------------------------
async function ensureCategory(slug, data) {
    const existing = await api(`/items/categories?filter[slug][_eq]=${encodeURIComponent(slug)}&limit=1`);
    if (existing.data && existing.data.length > 0) {
        return existing.data[0].id;
    }
    const created = await api('/items/categories', {
        method: 'POST',
        body: JSON.stringify({
            name: data.title,
            slug,
            description: data.description || null,
            breadcrumb: data.breadcrumb || null,
            filter_type: data.filterType || null,
            filters: data.filters || [],
            sort_order: 0,
            show_in_menu: true,
        }),
    });
    console.log(`+ category ${slug}`);
    return created.data.id;
}

// ----------------------------------------------------------------------------
// Products
// ----------------------------------------------------------------------------
async function upsertProduct(legacyId, fields) {
    const existing = await api(`/items/products?filter[legacy_id][_eq]=${encodeURIComponent(legacyId)}&limit=1`);
    if (existing.data && existing.data.length > 0) {
        await api(`/items/products/${existing.data[0].id}`, {
            method: 'PATCH',
            body: JSON.stringify(fields),
        });
        return { id: existing.data[0].id, action: 'updated' };
    }
    const created = await api('/items/products', {
        method: 'POST',
        body: JSON.stringify({ legacy_id: legacyId, ...fields }),
    });
    return { id: created.data.id, action: 'created' };
}

function buildProductFields(p, categoryId, brandId) {
    return {
        name: p.name,
        slug: p.slug || slugify(`${p.name}-${p.ref || p.id}`),
        ref: p.ref || null,
        description: p.description || null,
        price: p.price,
        compare_at_price: p.compareAtPrice || null,
        image: null, // populate later via Directus UI
        legacy_image: p.image || null,
        gallery: null,
        color: p.color || null,
        size: p.size || null,
        style: p.style || null,
        compression: p.compression || null,
        material: p.material || null,
        badge: p.badge || null,
        in_stock: p.inStock !== false,
        stock_quantity: p.stockQuantity ?? 0,
        featured: p.featured || false,
        sort_order: p.sortOrder ?? 0,
        gender: p.gender || 'unisex',
        fragrance_family: p.fragranceFamily || null,
        scent_profile: p.scentProfile || null,
        intensity: p.intensity || null,
        occasion: p.occasion || null,
        season: p.season || null,
        top_notes: p.topNotes || null,
        middle_notes: p.middleNotes || null,
        base_notes: p.baseNotes || null,
        volume: p.volume || null,
        concentration: p.concentration || null,
        skin_type: p.skinType || null,
        skin_concern: p.skinConcern || null,
        application_area: p.applicationArea || null,
        texture: p.texture || null,
        key_ingredients: p.keyIngredients || null,
        spf: p.spf ?? null,
        dermatologist_tested: p.dermatologistTested || false,
        routine_step: p.routineStep || null,
        time_of_use: p.timeOfUse || null,
        variants: p.variants || null,
        category_id: categoryId,
        brand_id: brandId,
    };
}

// ----------------------------------------------------------------------------
// Main
// ----------------------------------------------------------------------------
async function migrate() {
    console.log(`Reading seed data from ${SEED_PATH}`);
    if (!fs.existsSync(SEED_PATH)) {
        console.error(`Seed file not found: ${SEED_PATH}`);
        process.exit(1);
    }
    const seed = JSON.parse(fs.readFileSync(SEED_PATH, 'utf-8'));

    console.log(`Logging into Directus at ${DIRECTUS_URL}…`);
    await login();

    const brandCache = new Map();
    let totalCreated = 0;
    let totalUpdated = 0;

    for (const [categorySlug, categoryData] of Object.entries(seed)) {
        if (!categoryData || !Array.isArray(categoryData.products)) continue;

        const categoryId = await ensureCategory(categorySlug, categoryData);

        for (const p of categoryData.products) {
            const brandId = await ensureBrand(p.brand, brandCache);
            const fields = buildProductFields(p, categoryId, brandId);
            try {
                const { action } = await upsertProduct(p.id, fields);
                if (action === 'created') totalCreated++;
                else totalUpdated++;
            } catch (e) {
                console.error(`  ! ${p.id} (${p.name}): ${e.message}`);
            }
        }
        console.log(`  · ${categorySlug}: ${categoryData.products.length} products processed`);
    }

    console.log(`\nDone. Created: ${totalCreated}, Updated: ${totalUpdated}`);
}

migrate().catch((e) => {
    console.error('Migration failed:', e.message);
    if (e.body) console.error(JSON.stringify(e.body, null, 2));
    process.exit(1);
});
