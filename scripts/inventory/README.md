# Inventory Update Pipeline

Scripts to refresh the Strapi/frontend inventory from updated Word catalogs.

## Source of truth

Word docs in `C:\Users\maria\Pictures\Inventory Unistyles images\`:
- `Copia de CATALOGO_BH_FINAL.docx` — bras (Leonisa, 77 size/color rows → 33 parent products with variants)
- `CATALOGO_COLONIAS_UPDATED.docx` — fragrances (133 active)
- `CATALOGO_CREMAS_UPDATED.docx` — creams (33 active, 19 discontinued)
- `CATALOGO_BLOQUEADOR_UPDATED.docx` — sunscreen (10 active, 5 discontinued)
- `CATALOGO_LIMPIEZA_FACIAL_UPDATED.docx` — facial cleansing (2 active, 4 discontinued)

**Rules baked into the parser:**
- Red highlight in any cell → product discontinued, dropped from output
- Bras grouped by reference number → 1 parent product + N color/size variants
- Other categories stay flat (1 row = 1 product)
- Prices normalized to integer XCG

## Running an inventory refresh

When the catalogs change (new prices, new SKUs, items marked red):

```bash
# 1. Parse all 5 catalogs
python3 scripts/inventory/parse_catalogs.py

# 2. Match products to image files in frontend/public/images/, identify orphans
python3 scripts/inventory/match_images_and_audit.py

# 3. Move orphan images (products no longer in catalog) to backups/
python3 scripts/inventory/move_orphans.py

# 4. Build new seed-data.json + productData.js
python3 scripts/inventory/build_seed.py

# 5. Place BH (bra) images from the BH zip (placeholder use only — see legal note)
python3 scripts/inventory/place_bra_images.py

# 6. Rebuild seed once more so image paths reflect actual bra files
python3 scripts/inventory/build_seed.py

# 7. Verify frontend compiles
cd frontend && npm run build
```

## Pushing changes to the live Strapi DB

The Strapi bootstrap (`strapi/src/index.js`) supports two modes:

### Sync mode (default)
On normal restart, Strapi reads `seed-data.json` and:
- **Updates** existing products (matched by `legacyId`) with new price/stock/description/variants
- **Creates** any new SKUs not yet in DB
- **Deletes** any DB products whose `legacyId` is no longer in the seed (this is how discontinued items get removed)

### Force reseed mode
For a clean wipe (e.g. major schema/structure change):

```bash
FORCE_RESEED=1 npm run develop      # local
# or set FORCE_RESEED=1 in Vercel/host env vars and redeploy
```

This deletes ALL products first, then seeds from scratch. **Use sparingly** — admin edits made in the Strapi UI will be lost.

## Owner workflow (after launch)

The owner manages inventory in Strapi admin (`/cms/admin`):
- **Edit a product**: Content Manager → Product → click row → change price/description/stock → Save → Publish
- **Add a new SKU**: Content Manager → Product → Create new entry → fill fields → Save → Publish
- **Mark out of stock**: open product → set `inStock` to false (or `stockQuantity` to 0) → Save → Publish
- **Add a variant** (bras only): open product → scroll to Variants → Add a component → fill SKU/color/size/stock → Save → Publish

Changes show on the website on the next page load (5-min React Query cache; the owner can hard-refresh to see immediately).

## Files this pipeline produces / modifies

| File | Modified by |
|------|------------|
| `strapi/src/seed-data.json` | `build_seed.py` |
| `frontend/src/data/productData.js` | `build_seed.py` |
| `frontend/public/images/bra/<REF>/` | `place_bra_images.py` |
| `frontend/public/images/<category>/` | `move_orphans.py` (removes orphans) |
| `backups/orphan-images-<timestamp>/` | `move_orphans.py` (preserves removed files) |

## Backup recovery

If something goes wrong, the most recent backups are at the repo root:
- `strapi/src/seed-data.json.backup-<timestamp>`
- `frontend/src/data/productData.js.backup-<timestamp>`
- `backups/orphan-images-<timestamp>/`

Restore with:
```bash
cp strapi/src/seed-data.json.backup-<TS> strapi/src/seed-data.json
cp frontend/src/data/productData.js.backup-<TS> frontend/src/data/productData.js
mv backups/orphan-images-<TS>/<folder>/* frontend/public/images/<folder>/
```

## Legal note on bra (BH) images

Images in `frontend/public/images/bra/` are sourced from brand catalogs.
They are **placeholders for layout preview only**. Replace with own
photography or licensed assets before public launch — see
`frontend/public/images/bra/NOTICE.md`.
