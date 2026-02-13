/**
 * Upload images to Strapi Media Library and update products
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import FormData from 'form-data';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';
const IMAGES_DIR = path.join(__dirname, '../frontend/public/images');

async function uploadImage(filePath) {
    const fileName = path.basename(filePath);
    const form = new FormData();
    form.append('files', fs.createReadStream(filePath), fileName);

    try {
        const response = await fetch(`${STRAPI_URL}/api/upload`, {
            method: 'POST',
            body: form
        });

        if (!response.ok) {
            console.error(`Failed to upload ${fileName}:`, await response.text());
            return null;
        }

        const data = await response.json();
        console.log(`Uploaded: ${fileName} -> ID: ${data[0].id}`);
        return data[0];
    } catch (err) {
        console.error(`Error uploading ${fileName}:`, err.message);
        return null;
    }
}

async function getAllProducts() {
    try {
        const response = await fetch(`${STRAPI_URL}/api/products?pagination[pageSize]=200&populate=*`);
        if (!response.ok) {
            console.error('Failed to fetch products');
            return [];
        }
        const data = await response.json();
        return data.data || [];
    } catch (err) {
        console.error('Error fetching products:', err.message);
        return [];
    }
}

async function updateProductImage(productId, imageId) {
    try {
        const response = await fetch(`${STRAPI_URL}/api/products/${productId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                data: {
                    image: imageId
                }
            })
        });

        if (!response.ok) {
            console.error(`Failed to update product ${productId}`);
            return false;
        }
        return true;
    } catch (err) {
        console.error(`Error updating product ${productId}:`, err.message);
        return false;
    }
}

async function main() {
    console.log('=== Uploading Images to Strapi ===\n');

    // Get all image files
    const imageFiles = fs.readdirSync(IMAGES_DIR)
        .filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f))
        .map(f => path.join(IMAGES_DIR, f));

    console.log(`Found ${imageFiles.length} images\n`);

    // Upload all images and build a map
    const imageMap = {}; // filename -> strapi image object

    for (const filePath of imageFiles) {
        const fileName = path.basename(filePath);
        const uploaded = await uploadImage(filePath);
        if (uploaded) {
            imageMap[fileName] = uploaded;
            // Also map with /images/ prefix
            imageMap[`/images/${fileName}`] = uploaded;
        }
        // Small delay to avoid overwhelming Strapi
        await new Promise(r => setTimeout(r, 100));
    }

    console.log(`\nUploaded ${Object.keys(imageMap).length / 2} images\n`);

    // Get all products and update their images
    console.log('=== Updating Products ===\n');
    const products = await getAllProducts();
    console.log(`Found ${products.length} products\n`);

    let updated = 0;
    for (const product of products) {
        const legacyImage = product.attributes?.legacyImage;
        if (legacyImage && imageMap[legacyImage]) {
            const success = await updateProductImage(product.id, imageMap[legacyImage].id);
            if (success) {
                console.log(`Updated: ${product.attributes.name} -> ${legacyImage}`);
                updated++;
            }
        }
    }

    console.log(`\n=== Done ===`);
    console.log(`Uploaded: ${Object.keys(imageMap).length / 2} images`);
    console.log(`Updated: ${updated} products`);
}

main().catch(console.error);
