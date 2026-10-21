#!/usr/bin/env python3
"""Mirror approved static full-body image URLs into this repository.

Only image assets are copied. Spine .skel/.atlas/texture files are never mirrored.
Run from the repository root with: python scripts/mirror_static_portraits.py
"""
import json
import pathlib
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
    entries = data["characters"]
    for entry in entries:
        id_ = entry["id"]
        if not (len(id_) == 4 and id_[0] == "c" and id_[1:].isdigit() and entry.get("kind") == "full"):
            raise ValueError(f"Unexpected image entry: {id_}")
        expected = f"{SOURCE_ROOT}{id_}_00.png"
        source = entry.get("originalImage", entry["image"])
        if source != expected:
            raise ValueError(f"Unapproved upstream image path for {id_}: {source}")
    DEST.mkdir(parents=True, exist_ok=True)
    for number, entry in enumerate(entries, 1):
        id_ = entry["id"]
        destination = DEST / f"{id_}.png"
        if not (destination.is_file() and destination.read_bytes()[:8] == PNG_SIGNATURE):
            contents = download(f"{SOURCE_ROOT}{id_}_00.png")
            destination.write_bytes(contents)
        entry["originalImage"] = f"{SOURCE_ROOT}{id_}_00.png"
        entry["image"] = f"./assets/portraits/{id_}.png"
        print(f"[{number}/{len(entries)}] {destination.name} ({destination.stat().st_size} bytes)", flush=True)
    data["note"] = "静态全身立绘已镜像至本仓库；动态 Spine 仍使用第三方资源。原图来源保存在 originalImage 和 source 字段。"
    MANIFEST.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("Static PNG mirror complete; no Spine assets were downloaded.")

if __name__ == "__main__":
    main()
