"""Process AI-generated source art (art_src/*.jpg) into game-ready transparent WebP sprites/icons/textures.
Usage: python3 tools/process_art.py   (requires Pillow + numpy)"""
import os, numpy as np
from PIL import Image, ImageFilter, ImageDraw
from collections import deque
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "art_src"); OUT = os.path.join(ROOT, "play", "assets", "sprites"); os.makedirs(OUT, exist_ok=True)

def load(n): return Image.open(os.path.join(SRC, n)).convert("RGB")

def remove_bg(img, tol=70, soft=40):
    a = np.asarray(img).astype(np.int32); H, W, _ = a.shape
    border = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]]); bg = np.median(border, axis=0)
    d = np.sqrt(((a - bg) ** 2).sum(-1))
    cand = d < tol + soft  # possible background
    # flood fill from border over cand
    seen = np.zeros((H, W), bool); q = deque()
    for x in range(W):
        for y in (0, H - 1):
            if cand[y, x] and not seen[y, x]: seen[y, x] = True; q.append((y, x))
    for y in range(H):
        for x in (0, W - 1):
            if cand[y, x] and not seen[y, x]: seen[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for ny, nx in ((y+1,x),(y-1,x),(y,x+1),(y,x-1)):
            if 0 <= ny < H and 0 <= nx < W and not seen[ny, nx] and cand[ny, nx]: seen[ny, nx] = True; q.append((ny, nx))
    # also enclosed holes that are very close to bg colour
    hole = (d < tol * 0.6) & ~seen
    alpha = np.ones((H, W)) * 255
    region = seen | hole
    ramp = np.clip((d - tol) / soft, 0, 1)
    alpha[region] = (ramp[region] * 255)
    alpha = Image.fromarray(alpha.astype(np.uint8)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.7))
    al = np.asarray(alpha).astype(np.float32) / 255
    # despill: pull bg colour out of semi-transparent edge pixels
    rgb = a.astype(np.float32)
    edge = (al > 0.02) & (al < 0.98)
    k = (1 - al)[..., None] * 0.85
    rgb = np.where(edge[..., None], np.clip((rgb - bg * k) / np.maximum(1 - k, 0.15), 0, 255), rgb)
    # generic spill suppress for green/magenta keys
    if bg[1] > bg[0] + 60 and bg[1] > bg[2] + 60:  # green
        g = rgb[..., 1]; lim = np.maximum(rgb[..., 0], rgb[..., 2]) * 1.05; m = (al < 0.999) | (d < tol + soft * 2)
        rgb[..., 1] = np.where(m & (g > lim), lim, g)
    elif bg[0] > bg[1] + 60 and bg[2] > bg[1] + 30:  # magenta
        r, b = rgb[..., 0], rgb[..., 2]; gg = rgb[..., 1]; m = (al < 0.999)
        rgb[..., 0] = np.where(m & (r > gg * 1.6), (r + gg) / 2, r); rgb[..., 2] = np.where(m & (b > gg * 1.6), (b + gg) / 2, b)
    out = np.dstack([rgb, al * 255]).astype(np.uint8)
    return Image.fromarray(out, "RGBA")

def trim(im, pad=6):
    bb = im.getchannel("A").point(lambda v: 255 if v > 24 else 0).getbbox()
    if not bb: return im
    x0, y0, x1, y1 = bb; return im.crop((max(0, x0 - pad), max(0, y0 - pad), min(im.width, x1 + pad), min(im.height, y1 + pad)))

def fit(im, maxw, maxh):
    s = min(maxw / im.width, maxh / im.height, 1); return im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)

def save(im, name, q=86):
    p = os.path.join(OUT, name + ".webp"); im.save(p, "WEBP", quality=q, method=6); return os.path.getsize(p)

def segments(prof, thresh, min_gap, min_len):
    on = prof > thresh; segs = []; i = 0; n = len(on)
    while i < n:
        if on[i]:
            j = i
            while j < n and (on[j] or (j + min_gap < n and on[j:j + min_gap].any())): j += 1
            if j - i >= min_len: segs.append((i, j))
            i = j
        else: i += 1
    return segs

def split_sheet(im, rows, cols):
    """split an RGBA sheet into rows x cols sprites using alpha projections (falls back to even grid)."""
    A = np.asarray(im.getchannel("A")) > 40; H, W = A.shape; res = []
    rs = segments(A.sum(1), 2, 6, H // (rows * 4))
    if len(rs) != rows: rs = [(round(H * r / rows), round(H * (r + 1) / rows)) for r in range(rows)]
    for (y0, y1) in rs:
        band = A[y0:y1]; cs = segments(band.sum(0), 1, 8, W // (cols * 5))
        while len(cs) > cols:  # merge smallest gap
            gaps = [cs[i + 1][0] - cs[i][1] for i in range(len(cs) - 1)]; k = int(np.argmin(gaps)); cs[k] = (cs[k][0], cs[k + 1][1]); del cs[k + 1]
        if len(cs) != cols: cs = [(round(W * c / cols), round(W * (c + 1) / cols)) for c in range(cols)]
        for (x0, x1) in cs: res.append(trim(im.crop((x0, y0, x1, y1))))
    return res

def split_components(im, n):
    """split by connected components: n largest blobs, smaller blobs join the nearest large one."""
    sm = im.getchannel("A").resize((im.width // 2, im.height // 2)); A = np.asarray(sm) > 40; H, W = A.shape
    lab = np.zeros((H, W), np.int32); comps = []; cur = 0
    for y0 in range(H):
        for x0 in range(W):
            if A[y0, x0] and not lab[y0, x0]:
                cur += 1; q = deque([(y0, x0)]); lab[y0, x0] = cur; xs = []; ys = []
                while q:
                    y, x = q.popleft(); xs.append(x); ys.append(y)
                    for ny, nx in ((y+1,x),(y-1,x),(y,x+1),(y,x-1)):
                        if 0 <= ny < H and 0 <= nx < W and A[ny, nx] and not lab[ny, nx]: lab[ny, nx] = cur; q.append((ny, nx))
                comps.append((len(xs), min(xs), min(ys), max(xs), max(ys), cur))
    comps.sort(reverse=True); big = comps[:n]; groups = {c[5]: [c] for c in big}
    for c in comps[n:]:
        cx, cy = (c[1] + c[3]) / 2, (c[2] + c[4]) / 2
        best = min(big, key=lambda b: (max(b[1] - cx, 0, cx - b[3]) ** 2 + max(b[2] - cy, 0, cy - b[4]) ** 2))
        groups[best[5]].append(c)
    out = []
    for b in sorted(big, key=lambda b: (round(b[2] / (H / 3)), b[1])):
        ids = [c[5] for c in groups[b[5]]]; mask = np.isin(lab, ids)
        m = Image.fromarray((mask * 255).astype(np.uint8)).resize(im.size).filter(ImageFilter.MaxFilter(5))
        x0 = min(c[1] for c in groups[b[5]]) * 2; y0 = min(c[2] for c in groups[b[5]]) * 2; x1 = max(c[3] for c in groups[b[5]]) * 2 + 2; y1 = max(c[4] for c in groups[b[5]]) * 2 + 2
        piece = im.copy(); al = np.minimum(np.asarray(piece.getchannel("A")), np.asarray(m)); piece.putalpha(Image.fromarray(al))
        out.append(trim(piece.crop((max(0, x0 - 6), max(0, y0 - 6), min(im.width, x1 + 6), min(im.height, y1 + 6)))))
    return out

def grid_icons(img, rows, cols, size=128, dark=28):
    a = np.asarray(img.convert("L")); H, W = a.shape; out = []
    rs = segments((a > dark).sum(1), W * 0.08, 3, H // (rows * 3)); 
    if len(rs) != rows: rs = [(round(H * r / rows), round(H * (r + 1) / rows)) for r in range(rows)]
    for (y0, y1) in rs:
        cs = segments((a[y0:y1] > dark).sum(0), (y1 - y0) * 0.08, 3, W // (cols * 3))
        if len(cs) != cols: cs = [(round(W * c / cols), round(W * (c + 1) / cols)) for c in range(cols)]
        for (x0, x1) in cs:
            ic = img.crop((x0 + 4, y0 + 4, x1 - 4, y1 - 4)).resize((size, size), Image.LANCZOS).convert("RGBA")
            m = Image.new("L", (size * 4, size * 4), 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, size * 4 - 1, size * 4 - 1), radius=size * 4 // 7, fill=255)
            ic.putalpha(m.resize((size, size), Image.LANCZOS)); out.append(ic)
    return out

def seamless(img, size=512):
    im = img.resize((size, size), Image.LANCZOS); a = np.asarray(im).astype(np.float32)
    r = np.roll(np.roll(a, size // 2, 0), size // 2, 1)
    yy, xx = np.mgrid[0:size, 0:size]; d = np.minimum(np.minimum(xx, size - 1 - xx), np.minimum(yy, size - 1 - yy)) / (size / 2)
    w = np.clip((d - 0.12) / 0.5, 0, 1)[..., None]; w = w * w * (3 - 2 * w)
    return Image.fromarray((a * w + r * (1 - w)).astype(np.uint8))

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
