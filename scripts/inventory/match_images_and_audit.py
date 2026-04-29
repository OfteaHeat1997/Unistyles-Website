#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
For each parsed active product, try to find a matching image file in
frontend/public/images/. Then produce an audit:
  - matched: product -> image path
  - missing: products with no image match
  - orphan: image files for categories we updated that don't match any active product
"""

import json
import re
import sys
from pathlib import Path
from difflib import SequenceMatcher

ROOT = Path("/mnt/c/Users/maria/Documents/GitHub/unistyles-website-v2")
IMAGES_DIR = ROOT / "frontend/public/images"
PARSED_DIR = Path("/tmp/inv-parsed")

# Per-category image folders that we know are scoped
CATEGORY_FOLDERS = {
    "perfume": ["perfumes"],
    "cremas": ["catalogo  cremas", "catalogo cremas"],
    "bloqueador": ["CATALOGO BLOQUEADOR"],
    "limpieza-facial": ["limpieza facial"],
}


def normalize(s):
    s = s.lower()
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def list_images_in(folder):
    if not folder.exists():
        return []
    return [p for p in folder.iterdir()
            if p.is_file() and p.suffix.lower() in (".jpg", ".jpeg", ".png", ".webp")]


def best_match(name, candidates):
    norm_name = normalize(name)
    best = None
    best_score = 0.0
    for c in candidates:
        stem = normalize(c.stem)
        # Use product-name -> filename similarity
        score = SequenceMatcher(None, norm_name, stem).ratio()
        # Boost if filename starts with first 3 words of product name
        first_words = " ".join(norm_name.split()[:3])
        if first_words and first_words in stem:
            score += 0.2
        if score > best_score:
            best_score = score
            best = c
    return best, best_score


def main():
    report = {}

    for category, folder_candidates in CATEGORY_FOLDERS.items():
        # Find which folder actually exists
        folder = None
        for fc in folder_candidates:
            p = IMAGES_DIR / fc
            if p.exists():
                folder = p
                break
        if folder is None:
            print(f"[WARN] no image folder for {category}", file=sys.stderr)
            continue

        all_images = list_images_in(folder)
        used_images = set()

        # Load parsed products
        parsed_path = PARSED_DIR / f"{category}.json"
        if not parsed_path.exists():
            print(f"[WARN] no parsed file for {category}", file=sys.stderr)
            continue
        with open(parsed_path) as f:
            products = json.load(f)

        matched = []
        missing = []
        for p in products:
            best, score = best_match(p["name"], all_images)
            if best and score > 0.45:
                used_images.add(best)
                rel = "/" + str(best.relative_to(ROOT / "frontend/public")).replace("\\", "/")
                p["image"] = rel
                matched.append((p["id"], p["name"], best.name, round(score, 2)))
            else:
                missing.append((p["id"], p["name"], round(score, 2) if best else 0.0))

        orphans = [img for img in all_images if img not in used_images]

        report[category] = {
            "folder": str(folder),
            "total_images": len(all_images),
            "matched_count": len(matched),
            "missing_count": len(missing),
            "orphan_count": len(orphans),
            "matched": matched,
            "missing": missing,
            "orphans": [img.name for img in orphans],
        }

        # Save updated products with image paths
        with open(parsed_path, "w") as f:
            json.dump(products, f, indent=2, ensure_ascii=False)

    # Bras: special - no images yet (BH zip not extracted to public yet)
    print("\n" + "=" * 78)
    print(f"{'Category':<20} {'Imgs':>6} {'Match':>6} {'Miss':>6} {'Orphan':>7}")
    print("=" * 78)
    for cat, r in report.items():
        print(f"{cat:<20} {r['total_images']:>6} {r['matched_count']:>6} "
              f"{r['missing_count']:>6} {r['orphan_count']:>7}")
    print("=" * 78)

    # Detailed missing list
    print("\n--- MISSING IMAGES (product has no good match) ---")
    for cat, r in report.items():
        if r["missing"]:
            print(f"\n  {cat}:")
            for sku, name, score in r["missing"]:
                print(f"    {sku}: {name}  (best score: {score})")

    # Orphan list
    print("\n--- ORPHAN IMAGES (file not used by any active product) ---")
    for cat, r in report.items():
        if r["orphans"]:
            print(f"\n  {cat} ({len(r['orphans'])}):")
            for orphan_name in r["orphans"][:20]:
                print(f"    {orphan_name}")
            if len(r["orphans"]) > 20:
                print(f"    ... and {len(r['orphans']) - 20} more")

    # Save full report
    with open(PARSED_DIR / "image-audit.json", "w") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    print(f"\n  Full report: {PARSED_DIR / 'image-audit.json'}")


if __name__ == "__main__":
    main()
