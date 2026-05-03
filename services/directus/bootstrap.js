#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Directus schema bootstrap for the Unistyles e-commerce site.
 *
 * Mirrors the 7 Strapi content types (product, category, brand, customer,
 * business_settings, page, homepage) as Directus collections. Idempotent —
 * skips collections / fields / relations / permissions that already exist.
 *
 * Run once after the Directus container is healthy:
 *
 *   DIRECTUS_URL=https://cms.unistylescuracao.com \
 *   DIRECTUS_ADMIN_EMAIL=admin@unistylescuracao.com \
 *   DIRECTUS_ADMIN_PASSWORD=*** \
 *   node services/directus/bootstrap.js
 *
 * Re-runs are safe: existing structure is left untouched.
 */

const DIRECTUS_URL = (process.env.DIRECTUS_URL || 'http://localhost:8055').replace(/\/$/, '');
const ADMIN_EMAIL = process.env.DIRECTUS_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.DIRECTUS_ADMIN_PASSWORD;

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error('DIRECTUS_ADMIN_EMAIL and DIRECTUS_ADMIN_PASSWORD env vars are required.');
    process.exit(1);
}

let token = null;

async function api(path, options = {}) {
    const res = await fetch(`${DIRECTUS_URL}${path}`, {
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
        const err = new Error(`${options.method || 'GET'} ${path} → ${res.status}: ${text}`);
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

async function ensureCollection(name, opts = {}) {
    try {
        await api(`/collections/${name}`);
        return false;
    } catch (e) {
        if (e.status !== 403 && e.status !== 404) throw e;
    }
    await api('/collections', {
        method: 'POST',
        body: JSON.stringify({
            collection: name,
            meta: {
                collection: name,
                hidden: false,
                singleton: opts.singleton || false,
                icon: opts.icon || 'box',
                note: opts.note || null,
                sort_field: opts.sortField || null,
            },
            schema: { name },
            fields: [
                {
                    field: 'id',
                    type: 'integer',
                    meta: { hidden: true, interface: 'input', readonly: true },
                    schema: { is_primary_key: true, has_auto_increment: true },
                },
            ],
        }),
    });
    return true;
}

async function ensureField(collection, field, definition) {
    try {
        await api(`/fields/${collection}/${field}`);
        return false;
    } catch (e) {
        if (e.status !== 403 && e.status !== 404) throw e;
    }
    await api(`/fields/${collection}`, {
        method: 'POST',
        body: JSON.stringify({ field, ...definition }),
    });
    return true;
}

async function ensureRelation(collection, field, relatedCollection, type = 'm2o') {
    const existing = await api(`/relations/${collection}/${field}`).catch(() => null);
    if (existing && existing.data) return false;
    await api('/relations', {
        method: 'POST',
        body: JSON.stringify({
            collection,
            field,
            related_collection: relatedCollection,
            meta: { many_collection: collection, many_field: field, one_collection: relatedCollection },
            schema: { on_delete: 'SET NULL' },
        }),
    });
    return true;
}

// Field-definition shorthands ------------------------------------------------
const f = {
    string: (opts = {}) => ({ type: 'string', meta: { interface: 'input', ...opts.meta }, schema: { is_nullable: !opts.required, ...opts.schema } }),
    text: (opts = {}) => ({ type: 'text', meta: { interface: 'input-multiline', ...opts.meta }, schema: { is_nullable: !opts.required } }),
    richtext: () => ({ type: 'text', meta: { interface: 'input-rich-text-html' }, schema: { is_nullable: true } }),
    integer: (opts = {}) => ({ type: 'integer', meta: { interface: 'input', ...opts.meta }, schema: { is_nullable: !opts.required, default_value: opts.default ?? null } }),
    decimal: (opts = {}) => ({ type: 'decimal', meta: { interface: 'input', ...opts.meta }, schema: { numeric_precision: 10, numeric_scale: 2, is_nullable: !opts.required, default_value: opts.default ?? null } }),
    boolean: (opts = {}) => ({ type: 'boolean', meta: { interface: 'boolean' }, schema: { default_value: opts.default ?? false } }),
    json: () => ({ type: 'json', meta: { interface: 'input-code', options: { language: 'json' } }, schema: { is_nullable: true } }),
    enumeration: (choices, opts = {}) => ({ type: 'string', meta: { interface: 'select-dropdown', options: { choices: choices.map(c => ({ text: c, value: c })) } }, schema: { is_nullable: !opts.required, default_value: opts.default ?? null } }),
    file: () => ({ type: 'uuid', meta: { interface: 'file-image', special: ['file'] }, schema: { is_nullable: true } }),
    fk: () => ({ type: 'integer', meta: { interface: 'select-dropdown-m2o', special: ['m2o'] }, schema: { is_nullable: true } }),
    timestamp: () => ({ type: 'timestamp', meta: { interface: 'datetime', readonly: true, special: ['date-created'] }, schema: { is_nullable: true } }),
};

// Schema definitions ---------------------------------------------------------
const COLLECTIONS = [
    {
        name: 'brands',
        opts: { icon: 'storefront' },
        fields: {
            name: f.string({ required: true }),
            slug: f.string({ required: true }),
            description: f.text(),
            logo: f.file(),
            website: f.string(),
            country: f.string(),
            featured: f.boolean({ default: false }),
        },
    },
    {
        name: 'categories',
        opts: { icon: 'category' },
        fields: {
            name: f.string({ required: true }),
            slug: f.string({ required: true }),
            description: f.text(),
            breadcrumb: f.string(),
            image: f.file(),
            filter_type: f.enumeration(['size', 'style', 'category', 'compression']),
            filters: f.json(),
            sort_order: f.integer({ default: 0 }),
            show_in_menu: f.boolean({ default: true }),
        },
    },
    {
        name: 'products',
        opts: { icon: 'shopping_bag', sortField: 'sort_order' },
        fields: {
            name: f.string({ required: true }),
            slug: f.string({ required: true }),
            ref: f.string(),
            description: f.text(),
            price: f.decimal({ required: true }),
            compare_at_price: f.decimal(),
            image: f.file(),
            gallery: f.json(),
            color: f.string(),
            size: f.string(),
            style: f.string(),
            compression: f.enumeration(['light', 'medium', 'firm']),
            material: f.string(),
            badge: f.enumeration(['new', 'bestseller', 'premium', 'sale', 'gift_set', 'pack_3']),
            in_stock: f.boolean({ default: true }),
            stock_quantity: f.integer({ default: 0 }),
            featured: f.boolean({ default: false }),
            sort_order: f.integer({ default: 0 }),
            legacy_id: f.string({ meta: { hidden: true } }),
            legacy_image: f.string(),
            variants: f.json(),
            gender: f.enumeration(['women', 'men', 'unisex'], { default: 'unisex' }),
            fragrance_family: f.enumeration(['floral', 'oriental', 'woody', 'fresh', 'fruity', 'gourmand', 'citrus', 'aquatic']),
            scent_profile: f.enumeration(['sweet', 'spicy', 'musky', 'powdery', 'green', 'aromatic', 'warm', 'cool']),
            intensity: f.enumeration(['light', 'moderate', 'intense', 'very_intense']),
            occasion: f.enumeration(['daily', 'office', 'evening', 'romantic', 'special', 'casual', 'sport']),
            season: f.enumeration(['spring', 'summer', 'fall', 'winter', 'all_year']),
            top_notes: f.string(),
            middle_notes: f.string(),
            base_notes: f.string(),
            volume: f.string(),
            concentration: f.enumeration(['parfum', 'edp', 'edt', 'cologne', 'splash']),
            skin_type: f.enumeration(['all', 'normal', 'dry', 'oily', 'combination', 'sensitive']),
            skin_concern: f.enumeration(['hydration', 'anti_aging', 'brightening', 'nourishing', 'acne', 'sensitive']),
            application_area: f.enumeration(['face', 'body', 'hands', 'all']),
            texture: f.enumeration(['cream', 'lotion', 'gel', 'serum', 'oil', 'balm']),
            key_ingredients: f.text(),
            spf: f.integer(),
            dermatologist_tested: f.boolean({ default: false }),
            routine_step: f.enumeration(['cleanse', 'treat', 'moisturize', 'protect']),
            time_of_use: f.enumeration(['morning', 'evening', 'both']),
            category_id: f.fk(),
            brand_id: f.fk(),
        },
        relations: [
            { field: 'category_id', target: 'categories' },
            { field: 'brand_id', target: 'brands' },
        ],
    },
    {
        name: 'pages',
        opts: { icon: 'description' },
        fields: {
            title: f.string({ required: true }),
            slug: f.string({ required: true }),
            content: f.richtext(),
            excerpt: f.text(),
            featured_image: f.file(),
            seo_title: f.string(),
            seo_description: f.text(),
            show_in_footer: f.boolean({ default: false }),
            sort_order: f.integer({ default: 0 }),
        },
    },
    {
        name: 'customers',
        opts: { icon: 'person' },
        fields: {
            email: f.string({ required: true }),
            first_name: f.string({ required: true }),
            last_name: f.string({ required: true }),
            phone: f.string(),
            role: f.enumeration(['customer', 'admin'], { default: 'customer', required: true }),
            postgres_id: f.string({ meta: { hidden: true } }),
        },
    },
    {
        name: 'business_settings',
        opts: { icon: 'settings', singleton: true },
        fields: {
            store_name: f.string({ required: true }),
            tagline: f.string(),
            logo: f.file(),
            email: f.string(),
            phone: f.string(),
            whatsapp_number: f.string(),
            address: f.text(),
            currency: f.string(),
            currency_symbol: f.string(),
            free_delivery_threshold: f.decimal(),
            delivery_fee: f.decimal(),
            delivery_zones: f.json(),
            payment_methods: f.json(),
            social_links: f.json(),
            business_hours: f.json(),
            maintenance_mode: f.boolean({ default: false }),
            maintenance_message: f.text(),
        },
    },
    {
        name: 'homepage',
        opts: { icon: 'home', singleton: true },
        fields: {
            // Stored as JSON arrays since Strapi components don't have a 1:1
            // Directus equivalent and the frontend already reads them as plain
            // objects. Migrate via scripts/migrate-strapi-to-directus.js.
            hero_slides: f.json(),
            featured_categories: f.json(),
            featured_products: f.json(),
            new_arrivals: f.json(),
            promo_banner: f.json(),
            seo_title: f.string(),
            seo_description: f.text(),
        },
    },
];

const PUBLIC_READ_COLLECTIONS = [
    'products',
    'categories',
    'brands',
    'pages',
    'homepage',
    'business_settings',
];

async function ensurePublicReadPermission(collection) {
    const existing = await api(`/permissions?filter[collection][_eq]=${collection}&filter[action][_eq]=read&filter[role][_null]=true`).catch(() => null);
    if (existing?.data?.length) return false;
    await api('/permissions', {
        method: 'POST',
        body: JSON.stringify({
            role: null,           // null role == public
            collection,
            action: 'read',
            fields: ['*'],
            permissions: {},
            validation: {},
        }),
    });
    return true;
}

async function bootstrap() {
    console.log(`→ Logging in as ${ADMIN_EMAIL}…`);
    await login();

    for (const c of COLLECTIONS) {
        const created = await ensureCollection(c.name, c.opts);
        console.log(`${created ? '+' : '·'} collection ${c.name}`);
        for (const [name, def] of Object.entries(c.fields)) {
            const f = await ensureField(c.name, name, def);
            console.log(`  ${f ? '+' : '·'} field ${c.name}.${name}`);
        }
        for (const rel of c.relations || []) {
            const r = await ensureRelation(c.name, rel.field, rel.target);
            console.log(`  ${r ? '+' : '·'} relation ${c.name}.${rel.field} → ${rel.target}`);
        }
    }

    console.log('→ Setting public-role read permissions…');
    for (const col of PUBLIC_READ_COLLECTIONS) {
        const p = await ensurePublicReadPermission(col);
        console.log(`  ${p ? '+' : '·'} public:read on ${col}`);
    }

    console.log('Bootstrap complete.');
}

bootstrap().catch((e) => {
    console.error('Bootstrap failed:', e.message);
    if (e.body) console.error(JSON.stringify(e.body, null, 2));
    process.exit(1);
});
