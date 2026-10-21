#!/usr/bin/env python3
"""Mirror approved static full-body image URLs into this repository.

Only image assets are copied. Spine .skel/.atlas/texture files are never mirrored.
Run from the repository root with: python scripts/mirror_static_portraits.py
"""
import json
import pathlib
import re
import time
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "data" / "characters.json"
DEST = ROOT / "assets" / "portraits"
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
SOURCE_ROOT = "https://raw.githubusercontent.com/Nikke-db/Nikke-db.github.io/main/images/FB/"
MAX_FILE_SIZE = 15 * 1024 * 1024

def download(url: str) -> bytes:
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "anime-character-archive-static-mirror/1.0"})
            with urllib.request.urlopen(req, timeout=60) as response:
                length = response.headers.get("Content-Length")
                if length and int(length) > MAX_FILE_SIZE:
                    raise ValueError("Image exceeds per-file safety limit: " + url)
                data = response.read(MAX_FILE_SIZE + 1)
            if len(data) > MAX_FILE_SIZE or not data.startswith(PNG_SIGNATURE):
                raise ValueError("Invalid or oversized PNG: " + url)
            return data
        except (OSError, TimeoutError) as exc:
            if attempt == 2:
                raise RuntimeError(f"Failed after 3 tries: {url}") from exc
            time.sleep(2 * (attempt + 1))

def main():
    data = json.loads(MANIFEST.read_text(encoding="utf-8"))
    all_entries = data["characters"]
    # This tool restores only official NIKKE FB PNG mirrors.
    # The repository also contains other games and separately sourced NIKKE
    # wiki artwork; those records must remain completely unchanged.
    entries = [
        entry for entry in all_entries
        if entry.get("gameId") == "nikke"
        and re.fullmatch(r"c[0-9]{3}", entry.get("id", ""))
        and entry.get("originalImage") == (
            SOURCE_ROOT + entry["id"] + "_00.png"
        )
    ]
    if not entries:
        raise ValueError("No eligible NIKKE full-body source entries found")
    DEST.mkdir(parents=True, exist_ok=True)
    repaired = 0
    for number, entry in enumerate(entries, 1):
        id_ = entry["id"]
        destination = DEST / f"{id_}.png"
        expected_local = f"./assets/portraits/{id_}.png"
        if entry.get("image") != expected_local:
            raise ValueError(f"Unexpected local NIKKE asset path for {id_}: {entry.get('image')}")
        valid = False
        if destination.is_file():
            with destination.open("rb") as file:
                valid = file.read(8) == PNG_SIGNATURE
        if not valid:
            contents = download(f"{SOURCE_ROOT}{id_}_00.png")
            destination.write_bytes(contents)
            repaired += 1
            print(f"RESTORED [{number}/{len(entries)}] {destination.name} ({len(contents)} bytes)", flush=True)
    print(
        f"NIKKE source records checked: {len(entries)}; files restored: {repaired}; "
        f"other game and wiki records untouched: {len(all_entries) - len(entries)}.",
        flush=True,
    )
    # Do not rewrite the catalog: all paths and metadata remain unchanged.
    # If a missing PNG was restored, run the thumbnail workflow separately.


if __name__ == "__main__":
    main()
