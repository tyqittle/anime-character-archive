#!/usr/bin/env python3
"""Build lightweight, local WebP thumbnails for the character archive.

Only validated thumbnails are referenced by the catalog. Full-size artwork is
never overwritten, and is loaded in the browser only in the detail viewer.
No external runtime image proxy or hotlinks required.
"""
from __future__ import annotations

import io
import json
import os
import pathlib
import sys
from PIL import Image, ImageOps, UnidentifiedImageError

ROOT = pathlib.Path(__file__).resolve().parents[1]
CATALOG = ROOT / "data" / "characters.json"
OUTPUT = ROOT / "assets" / "thumbs"
SIZE = (420, 560)
QUALITY = 76
FORCE = os.environ.get("THUMBS_FORCE", "").lower() in {"1", "true", "yes"}
# Rebuild only the affected game on a focused-art tweak; avoid changing 460 unrelated thumbnails.
FORCE_GAME = os.environ.get("THUMBS_FORCE_GAME", "").strip().lower()


def image_path(image):
    if not isinstance(image, str) or not image.startswith("./assets/portraits/"):
        return None
    name = image.removeprefix("./assets/portraits/")
    if "/" in name or "\\" in name or not name.lower().endswith((".png", ".webp", ".jpg", ".jpeg")):
        return None
    return ROOT / "assets" / "portraits" / name


def focus_character_crop(im, game_id):
    """Crop *only* wide Genshin splash compositions for vertical card previews.

    The source remains unchanged for the modal and download. Genshin's 2:1
    horizontal gacha artwork is currently letterboxed into a 2:3 vertical
    gallery card, which makes the person extremely small. The character
    figures in the curated eight originals sit near the composition centre,
    so retain full original height and crop symmetric scenery on the sides.
    This is image *cropping*, not stretching, and is intentionally limited to
    that game's curated splash sources.
    """
    if game_id != "genshin" or im.width / im.height <= 1.15:
        return im
    target_width = round(im.height * 0.75)
    if target_width >= im.width:
        return im
    # Central vertical 3:4 crop, preserving head and feet. Wide fantasy
    # background effects outside the frame remain in the untouched original.
    centre_x = im.width // 2
    x0 = min(max(0, centre_x - target_width // 2), im.width - target_width)
    return im.crop((x0, 0, x0 + target_width, im.height))


def make_thumbnail(original, output, game_id=None):
    with Image.open(original) as im:
        im = ImageOps.exif_transpose(im)
        im.load()
        if im.width < 100 or im.height < 100:
            raise ValueError("unexpected source dimensions")
        im = focus_character_crop(im, game_id)
        im.thumbnail(SIZE, Image.Resampling.LANCZOS, reducing_gap=2.0)
        if im.mode not in ("RGB", "RGBA"):
            im = im.convert("RGBA" if "A" in im.getbands() or "transparency" in im.info else "RGB")
        buf = io.BytesIO()
        im.save(buf, "WEBP", quality=QUALITY, method=4)
        payload = buf.getvalue()
        if len(payload) < 500:
            raise ValueError("invalid thumbnail")
        with Image.open(io.BytesIO(payload)) as verify:
            verify.verify()
        output.write_bytes(payload)
        return len(payload)


def main():
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    OUTPUT.mkdir(parents=True, exist_ok=True)
    built = 0
    found = 0
    failed = []
    old_total = 0
    new_total = 0
    seen = set()
    for char in catalog.get("characters", []):
        source = image_path(char.get("image"))
        if source is None or not source.is_file():
            char.pop("thumb", None)
            failed.append((char.get("id"), "source missing or invalid"))
            continue
        relative_thumb = "./assets/thumbs/" + source.stem + ".webp"
        output = OUTPUT / (source.stem + ".webp")
        old_total += source.stat().st_size
        refresh = FORCE or FORCE_GAME == str(char.get("gameId", "")).lower()
        if not refresh and output.is_file() and output.stat().st_size >= 500:
            found += 1
        else:
            try:
                new_len = make_thumbnail(source, output, char.get("gameId"))
                built += 1
                if built % 30 == 0:
                    print("Generated", built, "thumbnails", flush=True)
            except Exception as exc:
                char.pop("thumb", None)
                failed.append((char.get("id"), str(exc)))
                print("SKIP", char.get("id"), str(exc)[:160], flush=True)
                continue
        char["thumb"] = relative_thumb
        new_total += output.stat().st_size
        seen.add(relative_thumb)
    new_index = json.dumps(catalog, ensure_ascii=False, indent=2) + "\n"
    if CATALOG.read_text(encoding="utf-8") != new_index:
        CATALOG.write_text(new_index, encoding="utf-8")
    print("SUMMARY entries",len(catalog.get("characters", [])),"thumbnails",len(seen),
          "built",built,"cached",found,"failed",len(failed), flush=True)
    print("Original bytes",old_total,"thumbnail bytes",new_total,
          "ratio",round(new_total/max(old_total,1)*100,2),"%", flush=True)
    if failed:
        print("FAILED ITEMS",failed[:30],flush=True)
    if not seen:
        print("No thumbnails available",file=sys.stderr)
        raise SystemExit(1)

if __name__ == "__main__":
    main()
