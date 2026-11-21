"""Static sprite/icon/texture pipeline: art_src/*.jpg -> play/assets/sprites/*.webp (see process_anim.py for animation atlases)."""
from artlib import *
import os
total = 0; log = []
def S(im, name, q=86):
    global total; b = save(im, name, q); total += b; log.append(f"{name} {im.size} {b//1024}KB")

HEROES = ["tank", "fighter", "mage", "marksman", "assassin", "support"]
for h in HEROES: S(fit(trim(remove_bg(load(f"chibi_{h}.jpg"))), 220, 240), f"hero_{h}")
MON = {"slime": 150, "rabbit": 160, "wolf": 200, "mushroom": 170, "scorpion": 200, "mummy": 190, "yeti": 230, "boss": 320}
for m, sz in MON.items(): S(fit(trim(remove_bg(load(f"mon_{m}.jpg"))), sz, sz), f"mon_{m}")
for m, sp in zip(MON, split_sheet(remove_bg(load("tamed_sheet.jpg")), 2, 4)): S(fit(sp, 140, 140), f"tamed_{m}")
PETS = ["fox", "dragon", "phoenix", "cloudcat", "turtle", "starbat"]
for p, sp in zip(PETS, split_sheet(remove_bg(load("pets_sheet.jpg")), 2, 3)): S(fit(sp, 150, 150), f"pet_{p}")
ITEMS = ["sword", "armor", "amulet", "hpot", "mpot", "crystal", "egg", "gold", "book", "treat", "gem", "chest"]
for it, sp in zip(ITEMS, split_sheet(remove_bg(load("items_sheet.jpg")), 3, 4)): S(fit(sp, 112, 112), f"item_{it}")
PROPS = ["tree", "pine", "snowpine", "cactus", "rock", "bush", "pillar", "icecrystal", "house", "fountain", "stall", "lamp"]
PSZ = {"house": 260, "fountain": 200, "stall": 200, "tree": 190, "pine": 180, "snowpine": 180}
for pr, sp in zip(PROPS, split_sheet(remove_bg(load("props_sheet.jpg")), 3, 4)): S(fit(sp, PSZ.get(pr, 140), PSZ.get(pr, 150)), f"prop_{pr}")
for n, sp in zip(["prom", "lek", "mali", "sak"], split_components(remove_bg(load("npc_sheet.jpg")), 4)): S(fit(sp, 200, 230), f"npc_{n}")
SK = grid_icons(load("skills_a.jpg"), 3, 3) + grid_icons(load("skills_b.jpg"), 3, 3)
for i, ic in enumerate(SK): S(ic, f"skill_{HEROES[i // 3]}_{i % 3}", 82)
for h, ic in zip(HEROES, grid_icons(load("ults.jpg"), 2, 3, dark=20)): S(ic, f"ult_{h}", 82)
for z in ["grass", "forest", "sand", "snow", "town"]: S(seamless(load(f"tex_{z}.jpg")), f"tex_{z}", 80)
S(load("ui_panel.jpg").resize((384, 384), Image.LANCZOS), "ui_panel", 84)
# banners
b = load("banner_v2.jpg")
for p, w in [(os.path.join(ROOT, "assets", "banner.webp"), 1600), (os.path.join(ROOT, "play", "assets", "img", "banner.webp"), 1280)]:
    b.resize((w, round(w * b.height / b.width)), Image.LANCZOS).save(p, "WEBP", quality=82, method=6)
print("\n".join(log)); print("TOTAL sprites KB", total // 1024)
