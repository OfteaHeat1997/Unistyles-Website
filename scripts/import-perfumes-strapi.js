/**
 * Import Perfumes to Strapi CMS
 * Run: node scripts/import-perfumes-strapi.js
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337'
const STRAPI_TOKEN = process.env.STRAPI_ADMIN_TOKEN || ''

// Parse CSV file
function parseCSV(filepath) {
  const content = fs.readFileSync(filepath, 'utf-8')
  const lines = content.split('\n').filter(line => line.trim())
  const headers = lines[0].split(',')

  const products = []
  for (let i = 1; i < lines.length; i++) {
    const values = []
    let current = ''
    let inQuotes = false

    for (const char of lines[i]) {
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    values.push(current.trim())

    const product = {}
    headers.forEach((header, idx) => {
      product[header.trim()] = values[idx] || ''
    })
    products.push(product)
  }
  return products
}

// Create slug from name
function createSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

async function fetchWithRetry(url, options, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options)
      return response
    } catch (error) {
      if (i === retries - 1) throw error
      await new Promise(r => setTimeout(r, 1000))
    }
  }
}

async function importPerfumes() {
  const csvPath = path.join(__dirname, '..', 'perfumes-catalog.csv')

  if (!fs.existsSync(csvPath)) {
    console.error('CSV file not found:', csvPath)
    process.exit(1)
  }

  const products = parseCSV(csvPath)
  console.log(`Found ${products.length} perfumes to import\n`)

  // Headers for Strapi API
  const headers = {
    'Content-Type': 'application/json'
  }
  if (STRAPI_TOKEN) {
    headers['Authorization'] = `Bearer ${STRAPI_TOKEN}`
  }

  // First, get or create the perfume category
  console.log('1. Checking/Creating perfume category...')
  let categoryId = null

  try {
    const catResponse = await fetchWithRetry(
      `${STRAPI_URL}/api/categories?filters[slug][$eq]=perfume`,
      { headers }
    )
    const catData = await catResponse.json()

    if (catData.data && catData.data.length > 0) {
      categoryId = catData.data[0].id
      console.log(`   Category exists with ID: ${categoryId}`)
    } else {
      // Create category
      const createCatResponse = await fetchWithRetry(
        `${STRAPI_URL}/api/categories`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            data: {
              name: 'Perfumes',
              slug: 'perfume',
              description: 'Colombian perfumes and fragrances from top brands',
              showInMenu: true,
              sortOrder: 4
            }
          })
        }
      )
      const newCat = await createCatResponse.json()
      categoryId = newCat.data.id
      console.log(`   Created category with ID: ${categoryId}`)
    }
  } catch (error) {
    console.log('   Note: Could not connect to Strapi, will use local fallback')
  }

  // Get or create brands
  console.log('\n2. Checking/Creating brands...')
  const brandMap = {}
  const brandNames = ['Avon', 'Cyzone', 'Esika', "L'Bel", 'Yanbal']

  for (const brandName of brandNames) {
    try {
      const brandResponse = await fetchWithRetry(
        `${STRAPI_URL}/api/brands?filters[name][$eqi]=${encodeURIComponent(brandName)}`,
        { headers }
      )
      const brandData = await brandResponse.json()

      if (brandData.data && brandData.data.length > 0) {
        brandMap[brandName] = brandData.data[0].id
        console.log(`   ${brandName}: ID ${brandData.data[0].id}`)
      } else {
        // Create brand
        const createBrandResponse = await fetchWithRetry(
          `${STRAPI_URL}/api/brands`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify({
              data: {
                name: brandName,
                slug: createSlug(brandName),
                tagline: `${brandName} Colombian fragrances`
              }
            })
          }
        )
        const newBrand = await createBrandResponse.json()
        if (newBrand.data) {
          brandMap[brandName] = newBrand.data.id
          console.log(`   Created ${brandName}: ID ${newBrand.data.id}`)
        }
      }
    } catch (error) {
      console.log(`   Note: Could not process brand ${brandName}`)
    }
  }

  // Import products
  console.log('\n3. Importing products...')
  let imported = 0
  let skipped = 0
  let errors = 0

  for (const product of products) {
    const slug = createSlug(product.name)

    try {
      // Check if product exists
      const existsResponse = await fetchWithRetry(
        `${STRAPI_URL}/api/products?filters[slug][$eq]=${slug}`,
        { headers }
      )
      const existsData = await existsResponse.json()

      if (existsData.data && existsData.data.length > 0) {
        skipped++
        process.stdout.write('.')
        continue
      }

      // Create product
      const productData = {
        name: product.name,
        slug: slug,
        ref: product.sku,
        description: product.description,
        price: parseFloat(product.price) || 19,
        inStock: parseInt(product.stock) > 0,
        legacyImage: `/images/perfumes/${product.image}`,
        category: categoryId,
        brand: brandMap[product.brand] || null,
        publishedAt: new Date().toISOString()
      }

      const createResponse = await fetchWithRetry(
        `${STRAPI_URL}/api/products`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ data: productData })
        }
      )

      const result = await createResponse.json()
      if (result.data) {
        imported++
        process.stdout.write('+')
      } else {
        errors++
        process.stdout.write('x')
      }
    } catch (error) {
      errors++
      process.stdout.write('x')
    }

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 50))
  }

  console.log('\n\n=== Import Complete ===')
  console.log(`Imported: ${imported}`)
  console.log(`Skipped (existing): ${skipped}`)
  console.log(`Errors: ${errors}`)
  console.log(`Total: ${products.length}`)
}

importPerfumes().catch(console.error)
