#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Merge parsed catalogs with the existing seed-data.json:
  - bras, colonias, cremas, bloqueador, limpieza-facial -> replaced with new data
  - panties, shapewear, desodorantes, accesorios -> kept unchanged

Outputs: strapi/src/seed-data.json (overwrites)
         frontend/src/data/productData.js (regenerated)
"""

import json
from pathlib import Path

ROOT = Path("/mnt/c/Users/maria/Documents/GitHub/unistyles-website-v2")
SEED_PATH = ROOT / "strapi/src/seed-data.json"
PRODDATA_PATH = ROOT / "frontend/src/data/productData.js"
PARSED_DIR = Path("/tmp/inv-parsed")

# Map parser key -> seed-data category key
CATEGORY_MAP = {
    "bras": "bras",
    "perfume": "colonias",
    "cremas": "cremas",
    "bloqueador": "bloqueador",
    "limpieza-facial": "limpieza-facial",
}


def aggregate_variant_attrs(variants, attr):
    """Collect unique values from variants list and join."""
    if not variants:
        return None
    vals = [v.get(attr) for v in variants if v.get(attr)]
    seen = []
    for v in vals:
        if v not in seen:
            seen.append(v)
    return ", ".join(seen) if seen else None


def transform_bra(p):
    """Bra parent product. Keep variants array AND set flat color/size for backward-compat UI."""
    variants = p.get("variants", [])
    return {
        "id": p["id"],
        "ref": f"REF {p['ref']}",
        "name": p["name"],
        "price": p["price"],
        "image": p["image"],
        "color": aggregate_variant_attrs(variants, "color"),
        "size": aggregate_variant_attrs(variants, "size"),
        "brand": p["brand"],
        "description": p.get("description"),
        "stockQuantity": p.get("totalStock", 0),
        "inStock": p.get("inStock", False),
        "variants": variants,
    }


def transform_flat(p):
    """Other categories: simple product."""
    return {
        "id": p["id"],
        "ref": p.get("ref"),
        "name": p["name"],
        "price": p["price"],
        "image": p.get("image"),
        "brand": p.get("brand"),
        "description": p.get("description"),
        "stockQuantity": p.get("stockQuantity", 0),
        "inStock": p.get("inStock", False),
    }


def main():
    # Load existing seed for category metadata + unchanged categories
    with open(SEED_PATH) as f:
        seed = json.load(f)

    # Replace updated categories
    for parser_key, seed_key in CATEGORY_MAP.items():
        parsed_path = PARSED_DIR / f"{parser_key}.json"
        if not parsed_path.exists():
            print(f"  SKIP: {parser_key} (no parsed file)")
            continue
        with open(parsed_path) as f:
            new_products = json.load(f)

        if seed_key not in seed:
            seed[seed_key] = {
                "title": parser_key.replace("-", " ").title(),
                "description": "",
                "breadcrumb": "",
                "filterType": "category",
                "filters": ["All"],
                "products": [],
            }

        if parser_key == "bras":
            seed[seed_key]["products"] = [transform_bra(p) for p in new_products]
            # Keep existing filterType/filters but extend filters with bra sizes from variants
            all_sizes = set()
            for p in new_products:
                for v in p.get("variants", []):
                    if v.get("size"):
                        all_sizes.add(v["size"].strip())
            if all_sizes:
                size_list = sorted(all_sizes)
                seed[seed_key]["filters"] = ["All"] + size_list
                seed[seed_key]["filterType"] = "size"
        else:
            seed[seed_key]["products"] = [transform_flat(p) for p in new_products]

    # Write updated seed-data.json
    with open(SEED_PATH, "w") as f:
        json.dump(seed, f, indent=2, ensure_ascii=False)
    print(f"  wrote {SEED_PATH}")

    # Print summary
    print("\n  Final seed counts:")
    total = 0
    for key, cat in seed.items():
        if isinstance(cat, dict) and "products" in cat:
            count = len(cat["products"])
            total += count
            print(f"    {key:<20} {count:>4} products")
    print(f"  {'TOTAL':<22} {total:>4}")

    # Regenerate productData.js (mirror of seed-data, JS module form)
    # Existing file exports `products`, `getProductById`, `getProductsByCategory`, default
    js_export = "// AUTO-GENERATED from strapi/src/seed-data.json\n"
    js_export += "// Run scripts/inventory/build_seed.py to regenerate\n\n"
    js_export += "export const products = " + json.dumps(seed, indent=2, ensure_ascii=False) + ";\n\n"
    js_export += """export const getProductById = (id) => {
  for (const [category, data] of Object.entries(products)) {
    const product = data.products?.find(p => p.id === id);
    if (product) {
      return {
        ...product,
        categorySlug: category,
        categoryName: data.title,
      };
    }
  }
  return null;
};

export const getProductsByCategory = (categorySlug) => {
  return products[categorySlug] || null;
};

export default products;
"""

    with open(PRODDATA_PATH, "w") as f:
        f.write(js_export)
    print(f"\n  wrote {PRODDATA_PATH}")


if __name__ == "__main__":
    main()
