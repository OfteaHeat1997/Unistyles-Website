#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Move orphan images out of frontend/public/images/ to a timestamped backup folder."""

import json
import shutil
from datetime import datetime
from pathlib import Path

ROOT = Path("/mnt/c/Users/maria/Documents/GitHub/unistyles-website-v2")
PUBLIC_IMAGES = ROOT / "frontend/public/images"
PARSED_DIR = Path("/tmp/inv-parsed")

CATEGORY_FOLDERS = {
    "perfume": "perfumes",
    "cremas": "catalogo  cremas",
    "bloqueador": "CATALOGO BLOQUEADOR",
    "limpieza-facial": "limpieza facial",
}


def main():
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_root = ROOT / f"backups/orphan-images-{timestamp}"
    backup_root.mkdir(parents=True, exist_ok=True)

    with open(PARSED_DIR / "image-audit.json") as f:
        audit = json.load(f)

    total_moved = 0
    for category, folder_name in CATEGORY_FOLDERS.items():
        if category not in audit:
            continue
        folder = PUBLIC_IMAGES / folder_name
        backup_folder = backup_root / folder_name
        backup_folder.mkdir(parents=True, exist_ok=True)

        moved_here = 0
        for orphan_name in audit[category]["orphans"]:
            src = folder / orphan_name
            dst = backup_folder / orphan_name
            if src.exists():
                shutil.move(str(src), str(dst))
                moved_here += 1
        print(f"  {category}: moved {moved_here} orphans -> {backup_folder.relative_to(ROOT)}")
        total_moved += moved_here

    print(f"\nTotal moved: {total_moved}")
    print(f"Backup location: {backup_root.relative_to(ROOT)}")
    print("(restore with: mv backups/orphan-images-*/<folder>/* frontend/public/images/<folder>/)")


if __name__ == "__main__":
    main()
