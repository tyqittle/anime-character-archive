#!/usr/bin/env python3
"""Batch-audit all indexed Spine assets without rendering them one by one.

Checks skeleton headers (3.8 and 4.x), atlas availability, every atlas texture
page and reference metadata. Writes a machine-readable status per character.
This is a RESOURCE audit, not proof that a character rendered/animated.
"""
import argparse
import concurrent.futures as futures
import datetime as dt
import json
import pathlib
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "data" / "spine-characters.json"
REPORT = ROOT / "data" / "spine-audit.json"
SUPPORTED = {"3.8", "4.0", "4.1", "4.2"}
HEADERS = {"User-Agent": "WinterCG-Spine-BatchAudit/1.0", "Accept": "*/*"}
VERSION_PATTERN = re.compile(r"^\d+\.\d+(?:\.\d+)?(?:[-a-zA-Z0-9.]*)?$")
PAGE_PATTERN = re.compile(r"\.(?:png|webp|jpe?g)$", re.I)


def request(url, method="GET", size=None, retries=2, timeout=20):
    """Read a bounded prefix, entire small text atlas, or HEAD response."""
    error = None
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(url, headers=HEADERS, method=method)
            with urllib.request.urlopen(req, timeout=timeout) as res:
                payload = res.read(size) if size is not None else (res.read() if method != "HEAD" else b"")
                return res.status, payload, dict(res.headers)
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, OSError) as exc:
            error = exc
            if isinstance(exc, urllib.error.HTTPError) and exc.code in (400, 401, 403, 404, 410):
                break
            if attempt < retries:
                time.sleep(0.45 * (attempt + 1))
    raise ValueError(f"{type(error).__name__}: {error}")


def read_spine_string(data, pos):
    length = 0
    shift = 0
    while True:
        if pos >= len(data) or shift >= 35:
            raise ValueError("invalid string length / truncated skeleton header")
        byte = data[pos]
        pos += 1
        length |= (byte & 127) << shift
        shift += 7
        if not byte & 128:
            break
    if not length:
        return None, pos
    length -= 1
    if length > 127 or pos + length > len(data):
        raise ValueError("invalid string length")
    value = data[pos : pos + length].decode("utf-8")
    return value, pos + length


def spine_version(binary):
    # 3.8: hash length + hash + version length + version.
    # 4.x: fixed 8-byte hash + version length + version.
    versions = []
    try:
        _, offset = read_spine_string(binary, 0)
        value, _ = read_spine_string(binary, offset)
        versions.append(value)
    except (UnicodeError, ValueError):
        pass
    try:
        value, _ = read_spine_string(binary, 8)
        versions.append(value)
    except (UnicodeError, ValueError):
        pass
    for version in versions:
        if version and VERSION_PATTERN.fullmatch(version):
            return version, ".".join(version.split(".")[:2])
    raise ValueError("Spine skeleton header cannot be decoded as 3.8 or 4.x")


def atlas_pages(text):
    lines = text.replace("\ufeff", "").splitlines()
    # Region names may also contain .png; a page begins at top or after
    # an empty separator and is followed by texture-page metadata.
    pages = []
    for idx, line in enumerate(lines):
        item = line.strip()
        if not PAGE_PATTERN.search(item):
            continue
        ahead = "\n".join(x.strip() for x in lines[idx+1:idx+6]).lower()
        if ("size:" in ahead or "format:" in ahead or "filter:" in ahead) and (
            idx == 0 or not lines[idx - 1].strip()
        ):
            pages.append(item)
    return list(dict.fromkeys(pages))


def check_texture(url):
    try:
        status, _, headers = request(url, "HEAD", retries=1, timeout=18)
        n = int(headers.get("Content-Length", "0") or 0)
        if n <= 0:
            # HTTP HEAD isn't always reliable on CDN; try GET prefix.
            status, prefix, _ = request(url, "GET", size=24, retries=1, timeout=18)
            if not prefix:
                raise ValueError("texture has no content")
        return {"url": url, "status": status, "ok": True}
    except Exception as exc:
        return {"url": url, "ok": False, "error": str(exc)}


def audit_one(character):
    row = {
        "id": character["id"],
        "name": character.get("name", ""),
        "gameId": character.get("gameId", "nikke"),
        "preview": character.get("preview", ""),
        "base": character.get("base", ""),
        "catalogVersion": character.get("spineVersion", ""),
        "version": None,
        "status": "unknown",
        "issues": [],
        "texturePages": [],
    }
    base = row["base"]
    if not base.startswith("https://"):
        row["issues"].append("invalid-base-url")
        row["status"] = "broken"
        return row
    try:
        _, header, _ = request(base + ".skel", size=256)
        version, minor = spine_version(header)
        row["version"] = version
        row["majorMinor"] = minor
        if minor not in SUPPORTED:
            row["issues"].append("unsupported-version:" + minor)
        if minor != row["catalogVersion"]:
            row["issues"].append("version-mismatch")
    except Exception as exc:
        row["issues"].append("skeleton-error:" + str(exc))
    try:
        _, content, _ = request(base + ".atlas", size=1000000)
        atlas = content.decode("utf-8-sig")
        pages = atlas_pages(atlas)
        if not pages:
            row["issues"].append("atlas-no-texture-pages")
        else:
            prefix = base.rsplit("/", 1)[0] + "/"
            with futures.ThreadPoolExecutor(max_workers=4) as ex:
                textures = list(ex.map(check_texture, [
                    urllib.parse.urljoin(prefix, page) for page in pages
                ]))
            row["texturePages"] = textures
            for item in textures:
                if not item["ok"]:
                    row["issues"].append("missing-texture:" + item["url"].rsplit("/", 1)[-1])
    except Exception as exc:
        row["issues"].append("atlas-error:" + str(exc))
    blocking = [v for v in row["issues"] if not v.startswith("version-mismatch")]
    row["status"] = "broken" if blocking else ("version-mismatch" if row["issues"] else "resources-ok")
    return row


def main():
    cli = argparse.ArgumentParser()
    cli.add_argument("--apply", action="store_true", help="Write reliably detected versions into catalog")
    cli.add_argument("--workers", type=int, default=12)
    args = cli.parse_args()
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    characters = manifest["characters"]
    started = time.monotonic()
    with futures.ThreadPoolExecutor(max_workers=max(1, min(24, args.workers))) as ex:
        rows = list(ex.map(audit_one, characters))
    changed = []
    if args.apply:
        lookup = {item["id"]: item for item in rows}
        for character in characters:
            found = lookup[character["id"]]
            actual = found.get("majorMinor")
            if actual in SUPPORTED and found["catalogVersion"] != actual:
                character["spineVersion"] = actual
                changed.append({"id": character["id"], "was": found["catalogVersion"], "now": actual})
            if actual in SUPPORTED:
                character["versionUnverified"] = False
        if changed or any(character.get("versionUnverified") is False for character in characters):
            MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    counts = {key: sum(row["status"] == key for row in rows) for key in
              ("resources-ok", "version-mismatch", "broken", "unknown")}
    report = {
        "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
        "notice": "Resource/header/CDN availability audit, NOT a browser rendering or animation guarantee.",
        "total": len(rows), "counts": counts, "versionsUpdated": changed,
        "elapsedSeconds": round(time.monotonic() - started, 2),
        "characters": rows
    }
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("SPINE_BATCH_SUMMARY " + json.dumps({
        "total": len(rows), "counts": counts, "versionsUpdated": len(changed),
        "elapsedSeconds": report["elapsedSeconds"]
    }, ensure_ascii=False), flush=True)
    for row in rows:
        if row["status"] != "resources-ok":
            print("SPINE_BATCH_ISSUE " + json.dumps({
                "id": row["id"], "status": row["status"], "issues": row["issues"],
                "expectedVersion": row["catalogVersion"], "detectedVersion": row.get("version")
            }, ensure_ascii=False), flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
