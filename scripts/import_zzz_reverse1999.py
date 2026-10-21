#!/usr/bin/env python3
"""Import curated full-character artworks from two NEW games to the local gallery.

Source filenames and Chinese labels are in data/new_game_sources.json.
Only a successfully decoded, sufficiently large artwork is cataloged.
Images are mirrored as optimized WebP, original source and copyright retained.
"""
from __future__ import annotations

import concurrent.futures
import io
import json
import pathlib
import time
import urllib.error
import urllib.parse
import urllib.request
from PIL import Image, ImageOps, ImageStat

ROOT = pathlib.Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "data" / "new_game_sources.json"
CATALOG = ROOT / "data" / "characters.json"
OUTPUT = ROOT / "assets" / "portraits"
HEADERS = {"User-Agent":"Mozilla/5.0 (compatible; anime-character-archive-importer/2.0)",
           "Accept":"image/png,image/webp,image/jpeg,image/*"}
GAMES = {"zzz": ("绝区零", "Zenless Zone Zero"),
         "reverse1999": ("重返未来：1999", "Reverse: 1999")}


def fetch_image(record):
    raw_url = ("https://raw.githubusercontent.com/"
               + record["sourceRepo"]+"/"+record["sourceBranch"]+"/"
               + urllib.parse.quote(record["sourcePath"],safe="/"))
    error = None
    for attempt in range(3):
        try:
            req = urllib.request.Request(raw_url,headers=HEADERS)
            with urllib.request.urlopen(req,timeout=45) as resp:
                if resp.status!=200:raise ValueError("status "+str(resp.status))
                data=resp.read(16_000_001)
            if len(data)>16_000_000:raise ValueError("source image >16MB")
            if len(data)<35_000:raise ValueError("thumbnail or error page")
            if not (data.startswith(b"\x89PNG\r\n\x1a\n")
                    or data.startswith(b"RIFF")
                    or data.startswith(b"\xff\xd8\xff")):
                raise ValueError("not a supported image")
            return data,raw_url
        except (OSError,ValueError) as exc:
            error = exc
            if attempt<2:time.sleep(1.5*(attempt+1))
    raise ValueError("download failed: "+str(error))


def convert_image(data, game_id):
    with Image.open(io.BytesIO(data)) as src:
        src.load()
        src=ImageOps.exif_transpose(src)
        w,h=src.size
        if w<550 or h<690:
            raise ValueError("too small for full character art: %sx%s"%(w,h))
        if not 0.26 <= w/h <= 1.8:
            raise ValueError("unexpected aspect ratio: %sx%s"%(w,h))
        im=src.convert("RGBA")
        alpha=im.getchannel("A")
        bbox=alpha.point(lambda a:255 if a>20 else 0).getbbox()
        if not bbox:raise ValueError("fully transparent image")
        left,top,right,bottom=bbox
        visible_w,visible_h=right-left,bottom-top
        if visible_w < 350 or visible_h < 560:
            raise ValueError("artwork too small within source canvas")
        if visible_h/h < 0.49:
            raise ValueError("likely an icon or cropped body rather than complete art")
        # Crop transparent export margins only. No opaque foreground is cropped.
        pad=22
        if bbox!=(0,0,w,h):
            im=im.crop((max(0,left-pad),max(0,top-pad),
                        min(w,right+pad),min(h,bottom+pad)))
        if max(im.size)>2450:
            im.thumbnail((2450,2450),Image.Resampling.LANCZOS)
        b=io.BytesIO()
        im.save(b,format="WEBP",quality=88,method=5)
        image=b.getvalue()
        if len(image)<18000:raise ValueError("converted art is too small")
        with Image.open(io.BytesIO(image)) as test:
            test.verify()
        return image,(w,h),im.size


def import_one(record):
    try:
        data,url=fetch_image(record)
        payload,before,after=convert_image(data,record["gameId"])
        return record,payload,url,before,after,None
    except Exception as exc:
        return record,None,None,None,None,str(exc)


def main():
    selections=json.loads(MANIFEST.read_text("utf8"))["entries"]
    catalog=json.loads(CATALOG.read_text("utf8"))
    by_id={x["id"]:x for x in catalog["characters"]}
    planned=[x for x in selections if x["id"] not in by_id
             or not (ROOT / by_id[x["id"]]["image"].removeprefix("./")).is_file()]
    OUTPUT.mkdir(parents=True,exist_ok=True)
    imported,failed=[],[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as workers:
        futures=[workers.submit(import_one,x) for x in planned]
        for future in concurrent.futures.as_completed(futures):
            entry,payload,url,size,after,error=future.result()
            if error:
                failed.append((entry["gameId"],entry["name"],error))
                print("SKIPPED",entry["gameId"],entry["name"],error,flush=True)
                continue
            dest=OUTPUT/(entry["id"]+".webp")
            dest.write_bytes(payload)
            rec={
                "id":entry["id"], "name":entry["name"], "zh":entry["name"],
                "nameEn":entry["nameEn"],"gameId":entry["gameId"],
                "game":entry["game"],"characterKey":entry["characterKey"],
                "groupId":"","kind":"full","image":"./assets/portraits/"+dest.name,
                "source":entry["sourcePage"],"originalImage":url,
                "variant":False, "license":entry["license"]
            }
            if entry["id"] in by_id:
                by_id[entry["id"]].update(rec)
            else:
                catalog["characters"].append(rec)
                by_id[entry["id"]]=rec
            imported.append((entry["gameId"],entry["name"]))
            print("IMPORTED",entry["gameId"],entry["name"],"pixels",size,
                  "converted",after,"WebP_bytes",len(payload),flush=True)
    for game_id,(name,en) in GAMES.items():
        if any(c.get("gameId")==game_id for c in catalog["characters"]):
            if not any(g.get("id")==game_id for g in catalog.get("games",[])):
                catalog.setdefault("games",[]).append({"id":game_id,"name":name,"en":en})
    if imported:
        catalog["characters"].sort(key=lambda c:
            (c.get("gameId",""),c.get("characterKey",""),c.get("id","")))
        catalog["counts"]={
            "total":len(catalog["characters"]),
            "full":sum(c.get("kind")=="full" for c in catalog["characters"])
        }
        CATALOG.write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
    counts={game:sum(c.get("gameId")==game for c in catalog["characters"])
            for game in GAMES}
    print("SUMMARY imported",len(imported),"failed",len(failed),
          "catalog_total",len(catalog["characters"]),"new_game_counts",counts,flush=True)
    if failed:
        print("FAILED_ITEMS",json.dumps(failed,ensure_ascii=False),flush=True)
    if any(counts.values())==0:
        raise SystemExit("No valid assets imported for either game")


if __name__=="__main__":
    main()
