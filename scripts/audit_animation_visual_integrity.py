#!/usr/bin/env python3
"""Non-destructive visual triage of rendered character previews.

A nonblank screenshot can still contain dislocated atlas fragments. This reports
large disconnected foreground masses for human review; it does NOT pretend to
prove model quality or remove legitimate multi-object illustrations.
"""
from __future__ import annotations
import argparse
import json
from collections import deque
from pathlib import Path
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
DEFAULT = "data/spine-daiblos-core.json"

def connectivity(image_or_path) -> dict:
    if isinstance(image_or_path, Image.Image):
        im = image_or_path.convert('RGB')
    else:
        with Image.open(image_or_path) as image:
            im = image.convert('RGB')
    width, height = im.size
    corners = [im.getpixel((x, y)) for x, y in ((0, 0), (width - 1, 0), (0, height - 1), (width - 1, height - 1))]
    bg = tuple(sorted(c[i] for c in corners)[2] for i in range(3))
    threshold = 30
    mask = Image.new("L", (width, height))
    mask.putdata([255 if max(abs(r-bg[0]), abs(g-bg[1]), abs(b-bg[2])) > threshold else 0
                  for r, g, b in im.getdata()])
    # Five-pixel closing joins antialiased regions separated by tiny seams;
    # distant body parts still remain separate in the user's example.
    mask = mask.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(5))
    foreground = bytearray(1 if p >= 128 else 0 for p in mask.getdata())
    total = sum(foreground)
    components = []
    for seed in range(width * height):
        if not foreground[seed]:
            continue
        foreground[seed] = 0
        queue = deque([seed])
        size = 0
        while queue:
            pos = queue.popleft()
            size += 1
            x, y = pos % width, pos // width
            for neighbor in ((pos-1 if x else -1), (pos+1 if x < width-1 else -1),
                             (pos-width if y else -1), (pos+width if y < height-1 else -1)):
                if neighbor >= 0 and foreground[neighbor]:
                    foreground[neighbor] = 0
                    queue.append(neighbor)
        components.append(size)
    components.sort(reverse=True)
    return {
        "largestShare": round(components[0] / total, 4) if total else 0,
        "majorComponents": sum(size >= max(40, total * .055) for size in components),
        "foregroundFraction": round(total / (width * height), 4),
        "dimensions": [width, height],
    }

def is_fragmented_character(image_or_path):
    metrics = connectivity(image_or_path)
    return (metrics["largestShare"] < .55
            and metrics["majorComponents"] >= 3
            and metrics["foregroundFraction"] >= .025)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", default=DEFAULT)
    parser.add_argument("--json", default="")
    args = parser.parse_args()
    manifest = json.loads((ROOT / args.catalog).read_text(encoding="utf-8"))
    results = []
    for character in manifest["characters"]:
        preview = character.get("preview", "")
        path = ROOT / preview.removeprefix("./")
        if not preview or not path.is_file():
            results.append({"id": character["id"], "missing": True})
            continue
        metrics = connectivity(path)
        metrics["id"] = character["id"]
        metrics["suspicious"] = metrics["largestShare"] < .55 and metrics["majorComponents"] >= 3 and metrics["foregroundFraction"] >= .025
        results.append(metrics)
    flagged = sorted((r for r in results if r.get("suspicious")), key=lambda item: item["largestShare"])
    summary = {"indexed": len(results), "missing": sum(bool(r.get("missing")) for r in results),
               "fragmentationCandidates": len(flagged), "suspects": flagged,
               "smallestLargestShare": sorted((r for r in results if not r.get("missing")), key=lambda item: item["largestShare"])[:20],
               "note": "Visual triage only, not a proof of correctness. Review all flagged files before changing a character status."}
    print("SPINE_VISUAL_INTEGRITY", json.dumps(summary, ensure_ascii=False))
    if args.json:
        destination = ROOT / args.json
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

if __name__ == "__main__":
    main()
