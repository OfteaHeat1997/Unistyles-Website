/**
 * Import Perfumes from CSV to Database
 * Run: node scripts/import-perfumes.js
 */

const fs = require('fs')
const path = require('path')
const { Pool } = require('pg')

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'unistyles',
  user: process.env.DB_USER || 'unistyles',
  password: process.env.DB_PASSWORD || 'unistyles123'
})

// Parse CSV file
function parseCSV(filepath) {
  const content = fs.readFileSync(filepath, 'utf-8')
  const lines = content.split('\n').filter(line => line.trim())
  const headers = lines[0].split(',')

  const products = []
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',')
    const product = {}
    headers.forEach((header, idx) => {
      product[header.trim()] = values[idx]?.trim() || ''
    })
    products.push(product)
  }
  return products
}

async function importPerfumes() {
  const csvPath = path.join(__dirname, '..', 'perfumes-catalog.csv')

  if (!fs.existsSync(csvPath)) {
    console.error('CSV file not found:', csvPath)
    process.exit(1)
  }

  const products = parseCSV(csvPath)
  console.log(`Found ${products.length} perfumes to import`)

  const client = await pool.connect()

  try {
    // Start transaction
    await client.query('BEGIN')

    // First, ensure perfume category exists
    const categoryResult = await client.query(
      `INSERT INTO categories (name, slug, description, image)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (slug) DO UPDATE SET name = $1, description = $3
       RETURNING id`,
      ['Perfumes', 'perfume', 'Colombian perfumes and fragrances from top brands', '/images/cat-perfume.jpg']
    )
    const categoryId = categoryResult.rows[0].id
    console.log('Category ID:', categoryId)

    // Insert or update each product
    let inserted = 0
    let updated = 0

    for (const product of products) {
      const result = await client.query(
        `INSERT INTO products (name, sku, brand, category_id, category_slug, description, price, stock, image)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (sku) DO UPDATE SET
           name = $1, brand = $3, description = $6, price = $7, stock = $8, image = $9
         RETURNING (xmax = 0) as inserted`,
        [
          product.name,
          product.sku,
          product.brand,
          categoryId,
          'perfume',
          product.description,
          parseFloat(product.price) || 19,
          parseInt(product.stock) || 3,
          `/images/perfumes/${product.image}`
        ]
      )

      if (result.rows[0].inserted) {
        inserted++
      } else {
        updated++
      }
    }

    await client.query('COMMIT')
    console.log(`\nImport complete!`)
    console.log(`- Inserted: ${inserted} new products`)
    console.log(`- Updated: ${updated} existing products`)
    console.log(`- Total: ${products.length} perfumes`)

  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Import failed:', error.message)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

importPerfumes().catch(console.error)
