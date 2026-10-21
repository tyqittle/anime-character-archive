#!/usr/bin/env python3
"""Generate consistently framed lightweight character-gallery previews.

Every art variant keeps its original full image. The thumbnails are:
 - alpha-trimmed (eliminates invisible PNG canvas),
 - centered on a portrait-shaped crop for wide effect/splash artwork,
 - scaled onto the same 420x560 transparent presentation frame.

A detail click continues to load the UNMODIFIED high-resolution artwork.
"""
from __future__ import annotations

import hashlib
import io
import json
import os
import pathlib
import sys
from PIL import Image, ImageOps

ROOT = pathlib.Path(__file__).resolve().parents[1]
CATALOG = ROOT / "data" / "characters.json"
OUTPUT = ROOT / "assets" / "thumbs"
STATE = OUTPUT / ".thumb-build-state.json"
BUILD_VERSION = "uniform-portrait-v2-20261021"
SIZE = (420, 560)
QUALITY = 77
PAD = 6
FORCE = os.environ.get("THUMBS_FORCE", "").lower() in {"1", "true", "yes"}
FORCE_GAME = os.environ.get("THUMBS_FORCE_GAME", "").strip().lower()

# Specific splash illustrations whose central effects visually dwarf the person.
# Preview-only focal hints, never change a stored source image.
FOCAL_OVERRIDES = {
    "ak-char_002_amiya-2": (0.52, 0.49, 1.45),
    "ak-char_1001_amiya2-2": (0.49, 0.52, 1.23),
}


def image_path(image):
    if not isinstance(image, str) or not image.startswith("./assets/portraits/"):
        return None
    name = image.removeprefix("./assets/portraits/")
    if "/" in name or "\\" in name or not name.lower().endswith((".png", ".webp", ".jpg", ".jpeg")):
        return None
    return ROOT / "assets" / "portraits" / name


def alpha_trim(im):
    """Trim transparent margins but do not discard opaque body or costume."""
    im = ImageOps.exif_transpose(im).convert("RGBA")
    channel = im.getchannel("A")
    if channel.getextrema()[0] >= 250:
        return im
    # Ignore barely-visible PNG export specks.
    mask = channel.point(lambda a: 255 if a >= 14 else 0)
    bbox = mask.getbbox()
    if bbox is None:
        raise ValueError("fully transparent artwork")
    left, top, right, bottom = bbox
    if right-left < 75 or bottom-top < 100:
        raise ValueError("artwork occupies almost no area")
    # A few pixels margin keep hair, weapon and trailing ribbons in the frame.
    margin = max(4, round(min(im.size) * 0.008))
    return im.crop((max(0,left-margin),max(0,top-margin),
                    min(im.width,right+margin),min(im.height,bottom+margin)))


def portrait_focus(im, item_id):
    """Preview wide scenes at character scale; originals remain uncropped."""
    width,height=im.size
    if height == 0:
        raise ValueError("zero-height artwork")
    ratio=width/height
    # Wide action splashes need a portrait focal window, not a tiny letterbox.
    if ratio > 0.82:
        target_w = max(2, round(height * 0.76))
        # Keep entire height and cut only background/effect art to the sides.
        if target_w < width:
            cx=FOCAL_OVERRIDES.get(item_id,(.5,.5,1))[0]
            left=max(0,min(width-target_w,round(width*cx-target_w/2)))
            im=im.crop((left,0,left+target_w,height))
    focus_x,focus_y,zoom=FOCAL_OVERRIDES.get(item_id,(.5,.5,1.0))
    if zoom > 1:
        nw=max(1,round(im.width/zoom))
        nh=max(1,round(im.height/zoom))
        x=max(0,min(im.width-nw,round(im.width*focus_x-nw/2)))
        y=max(0,min(im.height-nh,round(im.height*focus_y-nh/2)))
        im=im.crop((x,y,x+nw,y+nh))
    return im


def make_thumbnail(original,output,item_id):
    with Image.open(original) as src:
        src.load()
        if src.width < 160 or src.height < 160:
            raise ValueError("small or invalid source")
        im=portrait_focus(alpha_trim(src),item_id)
        im.thumbnail((SIZE[0]-PAD*2,SIZE[1]-PAD*2),
                     Image.Resampling.LANCZOS,reducing_gap=2.0)
        frame=Image.new("RGBA",SIZE,(0,0,0,0))
        frame.alpha_composite(im,((SIZE[0]-im.width)//2,(SIZE[1]-im.height)//2))
        buf=io.BytesIO()
        frame.save(buf,"WEBP",quality=QUALITY,method=4)
        data=buf.getvalue()
        if len(data) < 500:raise ValueError("invalid thumbnail")
        with Image.open(io.BytesIO(data)) as check:
            check.verify()
        output.write_bytes(data)
        return len(data)


def main():
    catalog=json.loads(CATALOG.read_text(encoding="utf8"))
    OUTPUT.mkdir(parents=True,exist_ok=True)
    try: state=json.loads(STATE.read_text(encoding="utf8"))
    except (FileNotFoundError,ValueError):state={}
    state_is_current=state.get("version")==BUILD_VERSION
    cached=state.get("files",{}) if state_is_current else {}
    new_state={}
    built=0;kept=0;failed=[];original_bytes=0;thumbnail_bytes=0
    for character in catalog.get("characters",[]):
        source=image_path(character.get("image"))
        if source is None or not source.is_file():
            character.pop("thumb",None)
            failed.append((character.get("id"),"source missing"))
            continue
        name=source.stem+".webp"
        out=OUTPUT/name
        original_bytes+=source.stat().st_size
        # Hash source bytes so an updated full-resolution portrait invalidates
        # the preview even if its filename stays unchanged.
        digest=hashlib.sha256(source.read_bytes()).hexdigest()[:20]
        valid=(not FORCE and FORCE_GAME!=character.get("gameId","").lower()
               and state_is_current and cached.get(name)==digest
               and out.is_file() and out.stat().st_size>=500)
        if valid:
            kept+=1
        else:
            try:
                make_thumbnail(source,out,character.get("id",""))
                built+=1
                if built%40==0:print("GENERATED",built,flush=True)
            except Exception as exc:
                character.pop("thumb",None)
                failed.append((character.get("id"),str(exc)))
                print("THUMBNAIL_FAILED",character.get("id"),str(exc),flush=True)
                continue
        character["thumb"]="./assets/thumbs/"+name
        new_state[name]=digest
        thumbnail_bytes+=out.stat().st_size
    index_json=json.dumps(catalog,ensure_ascii=False,indent=2)+"\n"
    if CATALOG.read_text(encoding="utf8")!=index_json:
        CATALOG.write_text(index_json,encoding="utf8")
    STATE.write_text(json.dumps({"version":BUILD_VERSION,"files":new_state},
                                 indent=1,ensure_ascii=False)+"\n",encoding="utf8")
    print("SUMMARY total",len(catalog.get("characters",[])),
          "generated",built,"cached",kept,"failed",len(failed),
          "thumb_MB",round(thumbnail_bytes/1048576,2),
          "original_MB",round(original_bytes/1048576,2),flush=True)
    if failed:
        print("FAILED",failed[:40],flush=True)
    if len(new_state)<300:
        print("Too few valid thumbnails",file=sys.stderr)
        raise SystemExit(1)

if __name__=="__main__":
    main()
