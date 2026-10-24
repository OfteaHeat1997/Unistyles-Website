#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Copy BH zip images into frontend/public/images/bra/<REF>/ with clean filenames.

LEGAL: Brand-owned product photos. Used as PLACEHOLDERS for layout preview only.
Replace with own photography or licensed assets before public launch.
A NOTICE.md is written alongside.
"""

import json
import re
import shutil
from pathlib import Path

ROOT = Path("/mnt/c/Users/maria/Documents/GitHub/unistyles-website-v2")
SRC = Path("/tmp/inv-zips/BH")
DST = ROOT / "frontend/public/images/bra"
PARSED_BRAS = Path("/tmp/inv-parsed/bras.json")


def clean_name(name):
    """Clean: 'BH NEGRO  2 011968 .png' -> 'negro-2.png'."""
    stem = name.rsplit(".", 1)[0]
    ext = name.rsplit(".", 1)[1].lower()
    s = stem.lower()
    s = re.sub(r"\bbh\b", "", s)
    s = re.sub(r"\b\d{5,6}\b", "", s)  # remove ref number
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    if not s:
        s = "img"
    return f"{s}.{ext}"


def main():
    DST.mkdir(parents=True, exist_ok=True)
    notice = DST / "NOTICE.md"
    notice.write_text(
        "# IMAGE NOTICE\n\n"
        "These bra product images are sourced from brand-supplied catalogs (Leonisa).\n"
        "They are used as **placeholders for layout preview only**.\n\n"
        "**Action required before public launch:** replace each image with own\n"
        "photography or licensed assets. The image filenames map to product\n"
        "references and color/angle so swapping is straightforward.\n",
        encoding="utf-8",
    )

    if not SRC.exists():
        print(f"ERROR: source missing: {SRC}")
        return

    placed = {}
    for ref_dir in sorted(SRC.iterdir()):
        if not ref_dir.is_dir():
            continue
        ref = ref_dir.name
        ref_dst = DST / ref
        ref_dst.mkdir(exist_ok=True)
        files = []
        for img in sorted(ref_dir.iterdir()):
            if img.suffix.lower() not in (".png", ".jpg", ".jpeg"):
                continue
            target_name = clean_name(img.name)
            # If target already exists, append index
            target = ref_dst / target_name
            i = 2
            while target.exists():
                stem, ext = target_name.rsplit(".", 1)
                target = ref_dst / f"{stem}-{i}.{ext}"
                i += 1
            shutil.copy2(img, target)
            files.append(target.name)
        placed[ref] = files
        # Symlink the first file as main.png/jpg for the parent product card
        if files:
            first = ref_dst / files[0]
            main_target = ref_dst / f"main.{files[0].rsplit('.', 1)[1]}"
            if not main_target.exists():
                shutil.copy2(first, main_target)

    # Update parsed bras with proper image path including extension
    if PARSED_BRAS.exists():
        with open(PARSED_BRAS) as f:
            bras = json.load(f)
        for p in bras:
            ref = p["ref"]
            ref_dst = DST / ref
            if ref_dst.exists():
                # find main.* file
                for ext in ("png", "jpg", "jpeg"):
                    candidate = ref_dst / f"main.{ext}"
                    if candidate.exists():
                        p["image"] = f"/images/bra/{ref}/main.{ext}"
                        break
        with open(PARSED_BRAS, "w") as f:
            json.dump(bras, f, indent=2, ensure_ascii=False)

    print(f"\nPlaced images for {len(placed)} refs:")
    for ref, files in sorted(placed.items()):
        print(f"  {ref}: {len(files)} files")
    print(f"\nNotice: {notice}")


if __name__ == "__main__":
    main()
