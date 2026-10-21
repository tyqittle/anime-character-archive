#!/usr/bin/env python3
"""Import curated *complete* game character art, mirrored to this repo.

Sources are credited per image. Public availability is NOT a license to
redistribute proprietary game art. For noncommercial reference/gallery use;
rightsholders retain all rights. Failed/uncertain images are never indexed.
"""
from __future__ import annotations

import io
import json
import pathlib
import sys
import time
import urllib.error
import urllib.request
from PIL import Image, ImageOps, UnidentifiedImageError

ROOT = pathlib.Path(__file__).resolve().parents[1]
INDEX = ROOT / "data" / "characters.json"
DEST = ROOT / "assets" / "portraits"
UA = {"User-Agent": "Mozilla/5.0 (compatible; AnimeCharacterArchive/1.0)", "Accept": "image/avif,image/webp,image/png,image/*;q=0.8"}
HOYO = "https://raw.githubusercontent.com/ScobbleQ/HoYo-Assets/main/"
WUWA = "https://raw.githubusercontent.com/TomyJan/WutheringWaves-UIResources/3.7/UIResources/UiLuckdraw/Image/"

GAMES = {
    "genshin": ("原神", "Genshin Impact"),
    "starrail": ("崩坏：星穹铁道", "Honkai: Star Rail"),
    "gfl2": ("少女前线2：追放", "Girls' Frontline 2: Exilium"),
    "wutheringwaves": ("鸣潮", "Wuthering Waves"),
}
# Each row is (game, stable id suffix, Chinese name, English name, original image URL, source page).
CURATED = [
    ("genshin", "10000002", "神里绫华", "Kamisato Ayaka", HOYO+"genshin/splash/10000002.png", "https://github.com/ScobbleQ/HoYo-Assets/tree/main/genshin/splash"),
    ("genshin", "10000037", "甘雨", "Ganyu", HOYO+"genshin/splash/10000037.png", "https://github.com/ScobbleQ/HoYo-Assets/tree/main/genshin/splash"),
    ("genshin", "10000046", "胡桃", "Hu Tao", HOYO+"genshin/splash/10000046.png", "https://github.com/ScobbleQ/HoYo-Assets/tree/main/genshin/splash"),
    ("genshin", "10000052", "雷电将军", "Raiden Shogun", HOYO+"genshin/splash/10000052.png", "https://github.com/ScobbleQ/HoYo-Assets/tree/main/genshin/splash"),
    ("genshin", "10000073", "纳西妲", "Nahida", HOYO+"genshin/splash/10000073.png", "https://github.com/ScobbleQ/HoYo-Assets/tree/main/genshin/splash"),
    ("genshin", "10000089", "芙宁娜", "Furina", HOYO+"genshin/splash/10000089.png", "https://github.com/ScobbleQ/HoYo-Assets/tree/main/genshin/splash"),
    ("genshin", "10000091", "娜维娅", "Navia", HOYO+"genshin/splash/10000091.png", "https://github.com/ScobbleQ/HoYo-Assets/tree/main/genshin/splash"),
    ("genshin", "10000096", "阿蕾奇诺", "Arlecchino", HOYO+"genshin/splash/10000096.png", "https://github.com/ScobbleQ/HoYo-Assets/tree/main/genshin/splash"),
    ("starrail", "1005", "卡芙卡", "Kafka", HOYO+"starrail/splash/1005.png", "https://github.com/ScobbleQ/HoYo-Assets/tree/main/starrail/splash"),
    ("starrail", "1102", "希儿", "Seele", HOYO+"starrail/splash/1102.png", "https://github.com/ScobbleQ/HoYo-Assets/tree/main/starrail/splash"),
    ("starrail", "1208", "符玄", "Fu Xuan", HOYO+"starrail/splash/1208.png", "https://github.com/ScobbleQ/HoYo-Assets/tree/main/starrail/splash"),
    ("starrail", "1212", "镜流", "Jingliu", HOYO+"starrail/splash/1212.png", "https://github.com/ScobbleQ/HoYo-Assets/tree/main/starrail/splash"),
    ("starrail", "1307", "黑天鹅", "Black Swan", HOYO+"starrail/splash/1307.png", "https://github.com/ScobbleQ/HoYo-Assets/tree/main/starrail/splash"),
    ("starrail", "1308", "黄泉", "Acheron", HOYO+"starrail/splash/1308.png", "https://github.com/ScobbleQ/HoYo-Assets/tree/main/starrail/splash"),
    ("starrail", "1310", "流萤", "Firefly", HOYO+"starrail/splash/1310.png", "https://github.com/ScobbleQ/HoYo-Assets/tree/main/starrail/splash"),
    ("gfl2", "klukai", "可露凯", "Klukai", "https://iopwiki.com/images/e/e4/Klukai_Whole.png", "https://iopwiki.com/wiki/File:Klukai_Whole.png"),
    ("gfl2", "leva", "莱娅", "Leva", "https://iopwiki.com/images/1/14/Leva_whole.png", "https://iopwiki.com/wiki/File:Leva_whole.png"),
    ("gfl2", "nemesis", "纳美西丝", "Nemesis", "https://iopwiki.com/images/a/aa/Nemesis_Whole.png", "https://iopwiki.com/wiki/File:Nemesis_Whole.png"),
    ("wutheringwaves", "jinhsi", "今汐", "Jinhsi", "https://wiki.biligame.com/wutheringwaves/Special:FilePath/%E8%A7%92%E8%89%B2_%E4%BB%8A%E6%B1%90_%E7%AB%8B%E7%BB%98.png", "https://wiki.biligame.com/wutheringwaves/共鸣者/今汐"),
    ("wutheringwaves", "changli", "长离", "Changli", "https://patchwiki.biligame.com/images/wutheringwaves/2/25/rwnmwv8y5wjcn98wix521fksfqddhgq.png", "https://wiki.biligame.com/wutheringwaves/共鸣者/长离"),
    ("wutheringwaves", "shorekeeper", "守岸人", "Shorekeeper", "https://patchwiki.biligame.com/images/wutheringwaves/5/56/101neg0k0er0rkh019ljtj5ev6jgac3.png", "https://wiki.biligame.com/wutheringwaves/共鸣者/守岸人"),
    ("wutheringwaves", "camellya", "椿", "Camellya", "https://patchwiki.biligame.com/images/wutheringwaves/3/33/piby5xz6lt334blop556739h476l24j.png", "https://wiki.biligame.com/wutheringwaves/共鸣者/椿"),
    ("wutheringwaves", "lupa", "露帕", "Lupa", "https://patchwiki.biligame.com/images/wutheringwaves/8/8b/9psbu0nhrkejgb9pohgse6nftw839mp.png", "https://wiki.biligame.com/wutheringwaves/文件:角色_露帕_立绘.png"),
]

def retrieve(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=45) as response:
        if response.status != 200:
            raise ValueError("bad status: "+str(response.status))
        limit = 18_000_000
        blob = response.read(limit+1)
        if len(blob) > limit:
            raise ValueError("oversized image")
        if len(blob) < 35_000:
            raise ValueError("tiny response, likely icon or error page")
        return blob

def clean_fullbody(blob):
    if not (blob.startswith(b"\x89PNG\r\n\x1a\n") or blob.startswith(b"RIFF") or blob.startswith(b"\xff\xd8\xff")):
        raise ValueError("not a PNG/WebP/JPEG file")
    with Image.open(io.BytesIO(blob)) as src:
        src.load()
        if src.width < 700 or src.height < 700:
            raise ValueError("small icon/thumbnail %sx%s" % src.size)
        if not 0.42 <= src.width/src.height <= 2.35:
            raise ValueError("unexpected aspect ratio %s" % (src.size,))
        # For character cut-outs crop excess transparent margins, never crop opaque art.
        im = ImageOps.exif_transpose(src).convert("RGBA")
        bbox = im.getchannel("A").getbbox()
        if bbox is None:
            raise ValueError("entirely transparent")
        if bbox[2]-bbox[0] < 370 or bbox[3]-bbox[1] < 600:
            raise ValueError("visible character area too small")
        if bbox != (0, 0, im.width, im.height):
            margin = 24
            im = im.crop((max(0,bbox[0]-margin),max(0,bbox[1]-margin),min(im.width,bbox[2]+margin),min(im.height,bbox[3]+margin)))
        if max(im.size) > 2300:
            im.thumbnail((2300,2300),Image.Resampling.LANCZOS)
        out = io.BytesIO()
        im.save(out,format="WEBP",quality=91,method=5)
        if out.tell() < 20_000:
            raise ValueError("invalidly small converted image")
        return out.getvalue(),src.size,im.size

def main():
    db = json.loads(INDEX.read_text(encoding="utf-8"))
    old_total = len(db.get("characters", []))
    db["characters"] = [
        c for c in db.get("characters", [])
        if not (c.get("gameId") == "wutheringwaves"
                and ("T_RoleImgjiyan_UI" in c.get("originalImage", "")
                     or "T_RoleImgyinlin_UI" in c.get("originalImage", "")))
    ]
    removed_bad = old_total - len(db["characters"])
    existing = {c["id"] for c in db.get("characters", [])}
    DEST.mkdir(parents=True,exist_ok=True)
    added = []
    failed = []
    for game,key,zh,en,url,page in CURATED:
        char_id = game+"-"+key
        target = DEST/(char_id+".webp")
        if char_id in existing and target.is_file() and target.stat().st_size > 20000:
            print("EXISTS",char_id,flush=True)
            continue
        try:
            payload = retrieve(url)
            saved, original_size, final_size = clean_fullbody(payload)
            target.write_bytes(saved)
            record = {
                "id":char_id,"name":zh,"zh":zh,"nameEn":en,
                "gameId":game,"game":GAMES[game][0],"characterKey":zh,
                "groupId":"","kind":"full",
                "image":"./assets/portraits/"+target.name,
                "source":page,"originalImage":url,"variant":False,
                "license":"游戏角色美术版权归原权利人；来源可访问不意味着获得再分发授权"
            }
            if char_id in existing:
                db["characters"] = [c for c in db["characters"] if c["id"] != char_id]
            db["characters"].append(record)
            existing.add(char_id)
            added.append((game,zh,target.stat().st_size))
            print("ADDED",game,zh,original_size,"->",final_size,len(saved),flush=True)
        except Exception as exc:
            failed.append((game,zh,str(exc)))
            print("SKIP",game,zh,str(exc)[:250],flush=True)
        time.sleep(0.22)
    if added or removed_bad:
        for game,(zh,en) in GAMES.items():
            if any(c.get("gameId")==game for c in db["characters"]) and not any(g.get("id")==game for g in db.get("games",[])):
                db.setdefault("games",[]).append({"id":game,"name":zh,"en":en})
        db["characters"].sort(key=lambda c:(c.get("gameId",""),c.get("characterKey",""),c.get("id","")))
        n=len(db["characters"])
        db["counts"]={"total":n,"full":sum(x.get("kind")=="full" for x in db["characters"])}
        INDEX.write_text(json.dumps(db,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("SUMMARY imported",len(added),"failed",len(failed),flush=True)
    for game,zh,why in failed:
        print("FAILED",game,zh,why,flush=True)
    # Do not fail the whole import if a third-party source is temporarily unavailable.
    if not added and not all((game+"-"+key) in existing for game,key,*_ in CURATED):
        print("WARNING: no new images imported",file=sys.stderr)

if __name__=="__main__":
    main()
