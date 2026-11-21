// World generation: ground pre-render, zones, obstacles (trees/rocks/buildings/water).
(function () {
  const PW = (window.PW = window.PW || {});
  const T = 32, MW = 80, MH = 56;
  PW.T = T; PW.MW = MW; PW.MH = MH;

  function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  PW.rng = rng;

  const GROUND = {
    town: ["#c9c0ad", "#bdb4a0"], ice: ["#e8f2fb", "#d8e8f4"], desert: ["#e3c88c", "#d9bd7d"],
    forest: ["#3f7a45", "#37703d"], meadow: ["#80c66b", "#76ba62"], wild: ["#8ccf74", "#82c46b"],
  };

  function zoneAtTile(tx, ty) {
    for (const z of PW.ZONES) { const [x, y, w, h] = z.rect; if (tx >= x && tx < x + w && ty >= y && ty < y + h) return z; }
    return null;
  }
  PW.zoneAt = (px, py) => zoneAtTile(Math.floor(px / T), Math.floor(py / T)) || { id: "wild", name: "ทุ่งโล่ง", lv: "ปลอดภัยพอควร" };

  PW.buildWorld = function () {
    const R = rng(20261121);
    const W = { obstacles: [], deco: [], water: [], buildings: [], grid: new Map(), spawn: { x: 40 * T + 16, y: 30 * T } };
    const town = PW.ZONES[0].rect; // x30..50, y21..35

    // buildings (tile rects) {x,y,w,h,roof,label}
    const B = [
      { x: 32, y: 22, w: 5, h: 3, roof: "#6aa86a", wall: "#d8c9a8", label: "ร้านยา" },
      { x: 44, y: 22, w: 5, h: 3, roof: "#c9703a", wall: "#cdb89a", label: "โรงตีเหล็ก" },
      { x: 32, y: 32, w: 5, h: 3, roof: "#4f86d8", wall: "#e0d6c0", label: "กิลด์" },
      { x: 44, y: 32, w: 5, h: 3, roof: "#8b5fc7", wall: "#d4c7ae", label: "กระโจมผู้เฒ่า" },
    ];
    W.buildings = B;
    for (const b of B) addRect(b.x * T, b.y * T, b.w * T, b.h * T, "building");
    addRect(39 * T - 8, 27 * T - 8, 2 * T + 16, 2 * T + 16, "fountain"); // fountain around (40,28)

    // water ponds
    const ponds = [[8, 18, 5, 3], [14, 36, 4, 3], [58, 44, 5, 3], [62, 14, 0, 0]].filter((p) => p[2] > 0);
    const ponds2 = [[22, 6, 4, 3], [66, 26, 4, 3]];
    for (const p of ponds.concat(ponds2)) { W.water.push(p); addRect(p[0] * T, p[1] * T, p[2] * T, p[3] * T, "water"); }

    function addRect(x, y, w, h, kind) { const o = { x, y, w, h, kind }; W.obstacles.push(o); const x0 = Math.floor(x / 64), x1 = Math.floor((x + w) / 64), y0 = Math.floor(y / 64), y1 = Math.floor((y + h) / 64); for (let gx = x0; gx <= x1; gx++) for (let gy = y0; gy <= y1; gy++) { const k = gx + "," + gy; if (!W.grid.has(k)) W.grid.set(k, []); W.grid.get(k).push(o); } return o; }

    const inTown = (tx, ty, pad) => tx >= town[0] - pad && tx < town[0] + town[2] + pad && ty >= town[1] - pad && ty < town[1] + town[3] + pad;
    const nearWater = (tx, ty) => W.water.some((p) => tx >= p[0] - 1 && tx < p[0] + p[2] + 1 && ty >= p[1] - 1 && ty < p[1] + p[3] + 1);

    // decorations
    const prob = { meadow: 0.045, forest: 0.15, desert: 0.035, ice: 0.07, wild: 0.04 };
    for (let ty = 0; ty < MH; ty++) for (let tx = 0; tx < MW; tx++) {
      if (inTown(tx, ty, 1) || nearWater(tx, ty)) continue;
      const z = zoneAtTile(tx, ty); const zid = z ? z.id : "wild";
      let p = prob[zid] || 0.04;
      const edge = Math.min(tx, ty, MW - 1 - tx, MH - 1 - ty);
      if (edge < 2) p = 0.85;
      if (R() > p) continue;
      const cx = tx * T + 6 + R() * (T - 12), cy = ty * T + 6 + R() * (T - 12);
      let kind;
      const r = R();
      if (zid === "desert") kind = r < 0.55 ? "cactus" : "rock";
      else if (zid === "ice") kind = r < 0.7 ? "pine" : "rock";
      else if (zid === "forest") kind = r < 0.88 ? "tree" : "rock";
      else kind = r < 0.82 ? "tree" : (r < 0.93 ? "rock" : "flower");
      if (kind === "flower") { W.deco.push({ x: cx, y: cy, kind, c: ["#ff7aa8", "#ffd34d", "#fff"][(R() * 3) | 0], s: 1 }); continue; }
      const s = 0.85 + R() * 0.45;
      const d = { x: cx, y: cy, kind, s, v: (R() * 3) | 0, zone: zid };
      W.deco.push(d);
      const w = kind === "rock" ? 22 * s : 12, h = kind === "rock" ? 14 * s : 8;
      addRect(cx - w / 2, cy - h / 2 + (kind === "rock" ? 0 : 6), w, h, kind);
    }
    W.deco.sort((a, b) => a.y - b.y);

    // town props (lamps / market stalls) — y-sorted sprites
    const TP = [["lamp", 37.6, 26.4], ["lamp", 42.4, 26.4], ["lamp", 37.6, 30.4], ["lamp", 42.4, 30.4], ["stall", 38.2, 24.2], ["stall", 41.9, 34.0], ["bush", 31, 26], ["bush", 49, 26], ["bush", 31, 31], ["bush", 49, 31]];
    for (const [k, tx, ty] of TP) { const d = { x: tx * T, y: ty * T, kind: k, s: 1, v: 0, zone: "town" }; W.deco.push(d); if (k === "stall") addRect(d.x - 28, d.y - 14, 56, 14, "stall"); else if (k === "lamp") addRect(d.x - 4, d.y - 6, 8, 6, "lamp"); else addRect(d.x - 14, d.y - 10, 28, 10, "bush"); }
    for (const b of B) W.deco.push({ x: (b.x + b.w / 2) * T, y: (b.y + b.h) * T + 2, kind: "house", b, s: 1 });
    W.deco.push({ x: 40 * T, y: 28 * T + 46, kind: "fountain", s: 1 });
    W.deco.sort((a, b) => a.y - b.y);
    W.ground = buildGround(W, B, town);
    return W;
  };

  // ---------------------------------------------------------------- ground (AI textures, feathered zone blending)
  function blurA(data, w, h, r) {
    const a = new Float32Array(w * h); for (let i = 0; i < w * h; i++) a[i] = data[i * 4 + 3];
    const tmp = new Float32Array(w * h);
    for (let pass = 0; pass < 3; pass++) {
      for (let y = 0; y < h; y++) { let acc = 0; const row = y * w; for (let x = -r; x <= r; x++) acc += a[row + Math.min(w - 1, Math.max(0, x))]; for (let x = 0; x < w; x++) { tmp[row + x] = acc / (2 * r + 1); acc += a[row + Math.min(w - 1, x + r + 1)] - a[row + Math.max(0, x - r)]; } }
      for (let x = 0; x < w; x++) { let acc = 0; for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x]; for (let y = 0; y < h; y++) { a[y * w + x] = acc / (2 * r + 1); acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x]; } }
    }
    for (let i = 0; i < w * h; i++) { data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = 255; data[i * 4 + 3] = a[i]; }
  }
  function buildGround(W, B, town) {
    const spr = PW.G.spr, GW = MW * T, GH = MH * T, R = rng(4242);
    const cv = document.createElement("canvas"); cv.width = GW; cv.height = GH; const g = cv.getContext("2d");
    const L = document.createElement("canvas"); L.width = GW; L.height = GH; const lg = L.getContext("2d");
    const fillPat = (ctx, k, scale, fallback) => {
      const im = spr[k]; if (!im) { ctx.fillStyle = fallback; ctx.fillRect(0, 0, GW, GH); return; }
      const p = ctx.createPattern(im, "repeat"); try { p.setTransform(new DOMMatrix([scale, 0, 0, scale, 0, 0])); } catch (e) { /* old browsers: unscaled */ }
      ctx.fillStyle = p; ctx.fillRect(0, 0, GW, GH);
    };
    const SC = 8, mw = GW / SC, mh = GH / SC; const m = document.createElement("canvas"); m.width = mw; m.height = mh; const mg = m.getContext("2d");
    const layer = (tex, scale, fallback, rects, feather, tint, jag) => {
      mg.clearRect(0, 0, mw, mh); mg.fillStyle = "#fff";
      for (const r of rects) {
        mg.fillRect(r[0] / SC, r[1] / SC, r[2] / SC, r[3] / SC);
        if (jag) { const per = 2 * (r[2] + r[3]) / 40; for (let i = 0; i < per; i++) { const t = R(); let x, y; const side = (R() * 4) | 0; if (side === 0) { x = r[0] + t * r[2]; y = r[1]; } else if (side === 1) { x = r[0] + t * r[2]; y = r[1] + r[3]; } else if (side === 2) { x = r[0]; y = r[1] + t * r[3]; } else { x = r[0] + r[2]; y = r[1] + t * r[3]; } mg.beginPath(); mg.arc(x / SC, y / SC, (8 + R() * jag) / SC, 0, 7); mg.fill(); } }
      }
      const id = mg.getImageData(0, 0, mw, mh); blurA(id.data, mw, mh, Math.max(1, Math.round(feather / SC))); mg.putImageData(id, 0, 0);
      lg.globalCompositeOperation = "source-over"; lg.clearRect(0, 0, GW, GH); fillPat(lg, tex, scale, fallback);
      if (tint) { lg.fillStyle = tint; lg.fillRect(0, 0, GW, GH); }
      lg.globalCompositeOperation = "destination-in"; lg.imageSmoothingEnabled = true; lg.drawImage(m, 0, 0, GW, GH);
      g.drawImage(L, 0, 0);
    };
    const zr = (id) => { const z = PW.ZONES.find((q) => q.id === id); return [z.rect[0] * T, z.rect[1] * T, z.rect[2] * T, z.rect[3] * T]; };
    // base: wild grass (slightly deeper green)
    fillPat(g, "tex_grass", 0.5, "#86c86e"); g.fillStyle = "rgba(20,70,30,.16)"; g.fillRect(0, 0, GW, GH);
    layer("tex_grass", 0.5, "#86c86e", [zr("meadow")], 40, "rgba(255,250,200,.07)", 34);
    layer("tex_forest", 0.5, "#3a6b3f", [zr("forest")], 56, null, 40);
    layer("tex_sand", 0.55, "#e0c48a", [zr("desert")], 56, null, 40);
    layer("tex_snow", 0.6, "#e8f2fb", [zr("ice")], 56, null, 40);
    // dirt roads
    const roads = [[0, 27 * T, town[0] * T, 2 * T], [(town[0] + town[2]) * T, 27 * T, (MW - town[0] - town[2]) * T, 2 * T], [39 * T, 0, 2 * T, town[1] * T], [39 * T, (town[1] + town[3]) * T, 2 * T, (MH - town[1] - town[3]) * T]];
    layer("tex_sand", 0.45, "#c9a46a", roads, 14, "rgba(110,70,30,.28)", 10);
    // town cobblestone plaza
    layer("tex_town", 0.32, "#c9c0ad", [zr("town")], 22, null, 16);
    // water ponds: sandy shore + gradient water
    for (const p of W.water) {
      const x = p[0] * T, y = p[1] * T, w = p[2] * T, h = p[3] * T, cx = x + w / 2, cy = y + h / 2;
      g.save(); g.fillStyle = "rgba(214,190,140,.85)"; g.beginPath(); g.ellipse(cx, cy, w / 2 + 14, h / 2 + 12, 0, 0, 7); g.fill();
      const gr = g.createRadialGradient(cx, cy - h * 0.1, 4, cx, cy, Math.max(w, h) / 2 + 6); gr.addColorStop(0, "#5fd0ff"); gr.addColorStop(0.65, "#2f86d6"); gr.addColorStop(1, "#1f5fa8");
      g.fillStyle = gr; g.beginPath(); g.ellipse(cx, cy, w / 2 + 4, h / 2 + 3, 0, 0, 7); g.fill();
      g.strokeStyle = "rgba(255,255,255,.55)"; g.lineWidth = 3; g.beginPath(); g.ellipse(cx, cy, w / 2 + 2, h / 2 + 1, 0, 0, 7); g.stroke(); g.restore();
    }
    // forest floor gets soft dark vignette patches
    const f = zr("forest"); g.fillStyle = "rgba(0,20,10,.18)"; for (let i = 0; i < 40; i++) { g.beginPath(); g.arc(f[0] + R() * f[2], f[1] + R() * f[3], 30 + R() * 60, 0, 7); g.fill(); }
    // building footprints shadow
    g.fillStyle = "rgba(0,0,0,.22)"; for (const b of B) { g.beginPath(); g.ellipse((b.x + b.w / 2) * T, (b.y + b.h) * T, b.w * T * 0.55, 18, 0, 0, 7); g.fill(); }
    return cv;
  }

  PW.collides = function (W, x, y, r) {
    if (x < r + 4 || y < r + 4 || x > MW * T - r - 4 || y > MH * T - r - 4) return true;
    const gx = Math.floor(x / 64), gy = Math.floor(y / 64);
    for (let ix = gx - 1; ix <= gx + 1; ix++) for (let iy = gy - 1; iy <= gy + 1; iy++) {
      const L = W.grid.get(ix + "," + iy); if (!L) continue;
      for (const o of L) {
        const cx = Math.max(o.x, Math.min(x, o.x + o.w)), cy = Math.max(o.y, Math.min(y, o.y + o.h));
        const dx = x - cx, dy = y - cy; if (dx * dx + dy * dy < r * r) return true;
      }
    }
    return false;
  };

  PW.randomFreeIn = function (W, zid, r, R) {
    const z = PW.ZONES.find((q) => q.id === zid); const [zx, zy, zw, zh] = z.rect;
    for (let i = 0; i < 80; i++) {
      const x = (zx + 1 + R() * (zw - 2)) * T, y = (zy + 1 + R() * (zh - 2)) * T;
      if (PW.zoneAt(x, y).id !== zid) continue;
      if (!PW.collides(W, x, y, r + 6)) return { x, y };
    }
    return { x: (zx + zw / 2) * T, y: (zy + zh / 2) * T };
  };

  // drawing decorations with AI sprites (bottom-anchored)
  const shadow = (c, x, y, rx, ry, a) => { c.fillStyle = "rgba(0,0,0," + (a || 0.25) + ")"; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, 7); c.fill(); };
  PW.drawDeco = function (c, d, t) {
    const s = d.s || 1, D = PW.drawSpr;
    if (d.kind === "tree") {
      const sway = Math.sin(t * 1.3 + d.x * 0.05) * 0.02;
      if (d.zone === "forest") { shadow(c, d.x, d.y + 8, 22 * s, 7 * s, 0.3); c.save(); c.translate(d.x, d.y + 10); c.rotate(sway); D(c, d.v === 0 ? "prop_pine#dark" : "prop_tree#dark", 0, 0, (d.v === 0 ? 86 : 80) * s); c.restore(); }
      else if (d.v === 2) { shadow(c, d.x, d.y + 6, 18 * s, 6 * s); D(c, "prop_bush", d.x, d.y + 10, 38 * s); }
      else { shadow(c, d.x, d.y + 8, 22 * s, 7 * s); c.save(); c.translate(d.x, d.y + 10); c.rotate(sway); D(c, "prop_tree", 0, 0, 80 * s); c.restore(); }
    } else if (d.kind === "pine") { shadow(c, d.x, d.y + 8, 18 * s, 6 * s, 0.22); D(c, "prop_snowpine", d.x, d.y + 10, 82 * s); }
    else if (d.kind === "cactus") { shadow(c, d.x, d.y + 7, 16 * s, 5 * s); if (d.v === 1) D(c, "prop_pillar", d.x, d.y + 9, 60 * s); else D(c, "prop_cactus", d.x, d.y + 9, 50 * s); }
    else if (d.kind === "rock") {
      shadow(c, d.x, d.y + 5, 17 * s, 5 * s);
      if (d.zone === "ice" && d.v === 2) D(c, "prop_icecrystal", d.x, d.y + 8, 44 * s); else D(c, d.zone === "ice" ? "prop_rock#ice" : d.zone === "desert" ? "prop_rock#sand" : "prop_rock", d.x, d.y + 8, 32 * s);
    } else if (d.kind === "flower") {
      c.save(); c.translate(d.x, d.y); c.fillStyle = d.c; for (let i = 0; i < 5; i++) { c.beginPath(); c.arc(Math.cos(i * 1.256) * 3, Math.sin(i * 1.256) * 3, 2.4, 0, 7); c.fill(); } c.fillStyle = "#ffe066"; c.beginPath(); c.arc(0, 0, 1.8, 0, 7); c.fill(); c.restore();
    } else if (d.kind === "house") {
      const b = d.b, w = b.w * T * 1.12; const im = PW.G.spr.prop_house; const hh = im ? w * im.height / im.width : 120;
      D(c, "prop_house", d.x, d.y + 6, hh);
      // signboard
      c.save(); c.font = "bold 13px Kanit, sans-serif"; c.textAlign = "center"; const tw = c.measureText(b.label).width + 18; const sy = d.y - hh + 6;
      c.fillStyle = "rgba(40,22,10,.85)"; c.strokeStyle = "#ffd76a"; c.lineWidth = 2; c.beginPath(); if (c.roundRect) c.roundRect(d.x - tw / 2, sy - 16, tw, 22, 8); else c.rect(d.x - tw / 2, sy - 16, tw, 22); c.fill(); c.stroke();
      c.fillStyle = "#ffe9a8"; c.fillText(b.label, d.x, sy); c.restore();
    } else if (d.kind === "fountain") {
      D(c, "prop_fountain", d.x, d.y, 118);
      c.fillStyle = "rgba(200,240,255," + (0.35 + Math.sin(t * 4) * 0.15) + ")"; for (let i = 0; i < 3; i++) { const a = t * 2 + i * 2.1; c.beginPath(); c.arc(d.x + Math.cos(a) * 26, d.y - 52 + Math.sin(a * 1.7) * 6, 2.5, 0, 7); c.fill(); }
    } else if (d.kind === "lamp") {
      D(c, "prop_lamp", d.x, d.y + 2, 64);
      const gl = c.createRadialGradient(d.x, d.y - 52, 2, d.x, d.y - 52, 34); gl.addColorStop(0, "rgba(255,220,120,.55)"); gl.addColorStop(1, "rgba(255,200,80,0)"); c.fillStyle = gl; c.beginPath(); c.arc(d.x, d.y - 52, 34, 0, 7); c.fill();
    } else if (d.kind === "stall") { shadow(c, d.x, d.y, 34, 8); D(c, "prop_stall", d.x, d.y + 4, 74); }
    else if (d.kind === "bush") { shadow(c, d.x, d.y, 18, 6); D(c, "prop_bush", d.x, d.y + 4, 40); }
  };
})();
