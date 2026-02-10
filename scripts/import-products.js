/**
 * UNISTYLES Product Import Script
 * Imports products from CSV files into PostgreSQL database
 *
 * Usage: node scripts/import-products.js
 */

import fs from 'fs'
import path from 'path'
import { parse } from 'csv-parse/sync'
import pg from 'pg'

const { Pool } = pg

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'unistyles',
  user: process.env.DB_USER || 'unistyles',
  password: process.env.DB_PASSWORD || 'unistyles123'
})

// CSV files to import
const CSV_BASE_PATH = '../CATALOGOS_ACTUALIZADOS'
const CSV_FILES = [
  { file: 'bh-catalogo-final.csv', category: 'bras' },
  { file: 'pantys-catalogo.csv', category: 'panties' },
  { file: 'cremas-catalogo.csv', category: 'creams' },
  { file: 'bloqueadores-catalogo.csv', category: 'sunscreen' },
  { file: 'desodorantes-catalogo.csv', category: 'deodorants' },
  { file: 'limpieza-facial-catalogo.csv', category: 'facial-cleansers' },
  { file: 'accesorios-catalogo-final.csv', category: 'accessories' }
]

// Get category ID from slug
async function getCategoryId(slug) {
  const result = await pool.query(
    'SELECT id FROM categories WHERE slug = $1',
    [slug]
  )
  return result.rows[0]?.id || null
}

// Generate slug from name
function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[áàäâ]/g, 'a')
    .replace(/[éèëê]/g, 'e')
    .replace(/[íìïî]/g, 'i')
    .replace(/[óòöô]/g, 'o')
    .replace(/[úùüû]/g, 'u')
    .replace(/ñ/g, 'n')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 250)
}

// Parse CSV row to product object
function parseProduct(row, categorySlug) {
  const sku = row.sku || row.SKU || ''
  const name = row.name || row.Name || row.nombre || ''
  const description = row.description || row.Description || row.descripcion || ''
  const price = parseFloat(row.regular_price || row.price || row.precio || 0)
  const comparePrice = parseFloat(row.sale_price || row.compare_price || 0) || null
  const stock = parseInt(row.stock || row.quantity || 1)
  const brand = row['attribute:Brand'] || row.brand || row.marca || 'Unistyles'
  const images = row.images || row.image || ''
  const color = row['attribute:Color'] || row.color || ''
  const size = row['attribute:Size'] || row.size || row.talla || ''

  return {
    sku,
    name,
    slug: generateSlug(name + '-' + sku),
    description,
    price: price || 25, // Default price if missing
    comparePrice,
    stock,
    brand,
    images: images ? [images] : [],
    colors: color ? [color] : [],
    sizes: size ? [size] : [],
    categorySlug
  }
}

// Insert product into database
async function insertProduct(product, categoryId) {
  const query = `
    INSERT INTO products (
      sku, name, slug, description, price, compare_price,
      stock, brand, images, colors, sizes, category_id, is_active
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true)
    ON CONFLICT (sku) DO UPDATE SET
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      price = EXCLUDED.price,
      stock = EXCLUDED.stock,
      images = EXCLUDED.images,
      updated_at = NOW()
    RETURNING id
  `

  const values = [
    product.sku,
    product.name,
    product.slug,
    product.description,
    product.price,
    product.comparePrice,
    product.stock,
    product.brand,
    JSON.stringify(product.images),
    JSON.stringify(product.colors),
    JSON.stringify(product.sizes),
    categoryId
  ]

  const result = await pool.query(query, values)
  return result.rows[0]?.id
}

// Import products from CSV file
async function importCSV(filePath, categorySlug) {
  const fullPath = path.resolve(import.meta.dirname, CSV_BASE_PATH, filePath)

  if (!fs.existsSync(fullPath)) {
    console.log(`  Skipping ${filePath} - file not found`)
    return 0
  }

  const fileContent = fs.readFileSync(fullPath, 'utf-8')
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  })

  const categoryId = await getCategoryId(categorySlug)
  if (!categoryId) {
    console.log(`  Category not found: ${categorySlug}`)
    return 0
  }

  let imported = 0
  for (const row of records) {
    try {
      const product = parseProduct(row, categorySlug)
      if (product.sku && product.name) {
        await insertProduct(product, categoryId)
        imported++
      }
    } catch (err) {
      console.error(`  Error importing row:`, err.message)
    }
  }

  return imported
}

// Main import function
async function main() {
  console.log('='.repeat(50))
  console.log('UNISTYLES Product Import')
  console.log('='.repeat(50))

  try {
    // Test database connection
    await pool.query('SELECT 1')
    console.log('Database connected successfully\n')

    let totalImported = 0

    for (const { file, category } of CSV_FILES) {
      console.log(`Importing: ${file}`)
      const count = await importCSV(file, category)
      console.log(`  Imported: ${count} products\n`)
      totalImported += count
    }

    console.log('='.repeat(50))
    console.log(`Total products imported: ${totalImported}`)
    console.log('='.repeat(50))

  } catch (err) {
    console.error('Import failed:', err.message)
  } finally {
    await pool.end()
  }
}

main()
