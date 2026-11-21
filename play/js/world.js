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

    // pre-render ground
    const cv = document.createElement("canvas"); cv.width = MW * T; cv.height = MH * T; const g = cv.getContext("2d");
    const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) >>> 0; h = ((h ^ (h >>> 13)) * 1274126177) >>> 0; return (h ^ (h >>> 16)) / 4294967296; };
    for (let ty = 0; ty < MH; ty++) for (let tx = 0; tx < MW; tx++) {
      const z = zoneAtTile(tx, ty); const zid = z ? z.id : "wild"; const pal = GROUND[zid];
      g.fillStyle = pal[(tx + ty) & 1]; g.fillRect(tx * T, ty * T, T, T);
      const h = hash(tx, ty);
      // texture
      if (zid === "meadow" || zid === "wild" || zid === "forest") {
        g.fillStyle = zid === "forest" ? "rgba(20,60,30,.35)" : "rgba(60,130,60,.25)";
        for (let i = 0; i < 3; i++) { const hh = hash(tx * 3 + i, ty * 7 + i); g.fillRect(tx * T + hh * 28, ty * T + ((hh * 977) % 1) * 28, 2, 5); }
      } else if (zid === "desert") {
        g.fillStyle = "rgba(160,120,60,.25)"; g.fillRect(tx * T + h * 20, ty * T + ((h * 313) % 1) * 24, 10, 2);
      } else if (zid === "ice") {
        g.fillStyle = "rgba(255,255,255,.6)"; g.fillRect(tx * T + h * 26, ty * T + ((h * 211) % 1) * 26, 3, 3);
      } else if (zid === "town") {
        g.strokeStyle = "rgba(90,80,60,.25)"; g.strokeRect(tx * T + 0.5, ty * T + 0.5, T - 1, T - 1);
      }
    }
    // town paths + plaza
    g.fillStyle = "#d9cfae";
    g.fillRect(town[0] * T, 27 * T, town[2] * T, 2 * T);
    g.fillRect(39 * T, town[1] * T, 2 * T, town[3] * T);
    g.fillStyle = "rgba(255,255,255,.12)"; for (let i = 0; i < 60; i++) g.fillRect(town[0] * T + hash(i, 1) * town[2] * T, town[1] * T + hash(1, i) * town[3] * T, 3, 3);
    // roads outward from town
    g.fillStyle = "rgba(190,160,100,.55)";
    g.fillRect(0, 27 * T, town[0] * T, 2 * T); g.fillRect((town[0] + town[2]) * T, 27 * T, (MW - town[0] - town[2]) * T, 2 * T);
    g.fillRect(39 * T, 0, 2 * T, town[1] * T); g.fillRect(39 * T, (town[1] + town[3]) * T, 2 * T, (MH - town[1] - town[3]) * T);
    // water
    for (const p of W.water) { g.fillStyle = "#3c88d8"; g.fillRect(p[0] * T, p[1] * T, p[2] * T, p[3] * T); g.fillStyle = "rgba(255,255,255,.25)"; for (let i = 0; i < p[2] * 2; i++) g.fillRect(p[0] * T + hash(i, p[1]) * p[2] * T, p[1] * T + hash(p[0], i) * p[3] * T, 14, 2); g.strokeStyle = "#2a64a8"; g.lineWidth = 3; g.strokeRect(p[0] * T, p[1] * T, p[2] * T, p[3] * T); }
    // road clearing: remove deco overlap with roads (cosmetic): handled by prob only
    // buildings
    for (const b of B) {
      const x = b.x * T, y = b.y * T, w = b.w * T, h = b.h * T;
      g.fillStyle = "rgba(0,0,0,.25)"; g.fillRect(x + 6, y + 8, w, h);
      g.fillStyle = b.wall; g.fillRect(x, y, w, h);
      g.fillStyle = b.roof; g.fillRect(x - 4, y - 4, w + 8, h - 18);
      g.fillStyle = "rgba(0,0,0,.18)"; for (let i = 0; i < 6; i++) g.fillRect(x - 4, y - 4 + i * 12, w + 8, 2);
      g.fillStyle = "#6b4a2b"; const dx = x + w / 2 - 14; const dy = b.y < 28 ? y + h - 34 : y + 6; g.fillRect(dx, b.y < 28 ? y + h - 32 : y, 28, 32);
      g.fillStyle = "#fff"; g.font = "bold 14px Kanit, sans-serif"; g.textAlign = "center"; g.fillText(b.label, x + w / 2, b.y < 28 ? y + 20 : y + h - 30);
    }
    // fountain
    const fx = 40 * T, fy = 28 * T;
    g.fillStyle = "#9aa3ad"; g.beginPath(); g.arc(fx, fy, 44, 0, 7); g.fill();
    g.fillStyle = "#4aa3e8"; g.beginPath(); g.arc(fx, fy, 36, 0, 7); g.fill();
    g.fillStyle = "rgba(255,255,255,.5)"; g.beginPath(); g.arc(fx - 8, fy - 8, 12, 0, 7); g.fill();
    g.fillStyle = "#c8d0d8"; g.beginPath(); g.arc(fx, fy, 9, 0, 7); g.fill();
    W.ground = cv;
    return W;
  };

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

  // drawing helpers for decorations
  PW.drawDeco = function (c, d, t) {
    c.save(); c.translate(d.x, d.y);
    if (d.kind === "tree") {
      const s = d.s; const forest = d.zone === "forest";
      c.fillStyle = "rgba(0,0,0,.22)"; c.beginPath(); c.ellipse(0, 8, 16 * s, 6 * s, 0, 0, 7); c.fill();
      c.fillStyle = "#6b4a2b"; c.fillRect(-4 * s, -6 * s, 8 * s, 16 * s);
      c.fillStyle = forest ? "#2f6a3a" : (d.v === 0 ? "#3f9a4d" : d.v === 1 ? "#4aa957" : "#358a45");
      c.beginPath(); c.arc(0, -18 * s, 18 * s, 0, 7); c.fill();
      c.fillStyle = "rgba(255,255,255,.12)"; c.beginPath(); c.arc(-6 * s, -24 * s, 8 * s, 0, 7); c.fill();
      if (d.v === 2 && !forest) { c.fillStyle = "#ff6a6a"; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc((-8 + i * 8) * s, (-16 - (i % 2) * 6) * s, 2.6 * s, 0, 7); c.fill(); } }
    } else if (d.kind === "pine") {
      const s = d.s; c.fillStyle = "rgba(0,0,0,.2)"; c.beginPath(); c.ellipse(0, 8, 14 * s, 5 * s, 0, 0, 7); c.fill();
      c.fillStyle = "#5a4630"; c.fillRect(-3 * s, 0, 6 * s, 10 * s);
      for (let i = 0; i < 3; i++) { c.fillStyle = i === 2 ? "#e9f4ff" : "#2e6f78"; c.beginPath(); c.moveTo(0, (-34 + i * 12) * s); c.lineTo(-(12 + i * 4) * s, (-12 + i * 10) * s); c.lineTo((12 + i * 4) * s, (-12 + i * 10) * s); c.closePath(); c.fill(); }
      c.fillStyle = "rgba(255,255,255,.85)"; c.beginPath(); c.moveTo(0, -34 * s); c.lineTo(-7 * s, -22 * s); c.lineTo(7 * s, -22 * s); c.closePath(); c.fill();
    } else if (d.kind === "cactus") {
      const s = d.s; c.fillStyle = "rgba(0,0,0,.2)"; c.beginPath(); c.ellipse(0, 8, 12 * s, 4 * s, 0, 0, 7); c.fill();
      c.fillStyle = "#4f9a52"; c.fillRect(-5 * s, -22 * s, 10 * s, 30 * s); c.fillRect(-14 * s, -14 * s, 9 * s, 5 * s); c.fillRect(-14 * s, -20 * s, 5 * s, 11 * s); c.fillRect(5 * s, -10 * s, 9 * s, 5 * s); c.fillRect(9 * s, -18 * s, 5 * s, 13 * s);
      c.fillStyle = "#2f6f35"; c.fillRect(-1 * s, -22 * s, 2 * s, 30 * s);
    } else if (d.kind === "rock") {
      const s = d.s; c.fillStyle = "rgba(0,0,0,.2)"; c.beginPath(); c.ellipse(0, 6, 15 * s, 5 * s, 0, 0, 7); c.fill();
      c.fillStyle = d.zone === "ice" ? "#b8cde0" : d.zone === "desert" ? "#b79a68" : "#8d94a0"; c.beginPath(); c.moveTo(-13 * s, 6 * s); c.lineTo(-8 * s, -8 * s); c.lineTo(4 * s, -11 * s); c.lineTo(13 * s, 0); c.lineTo(10 * s, 7 * s); c.closePath(); c.fill();
      c.fillStyle = "rgba(255,255,255,.2)"; c.beginPath(); c.moveTo(-8 * s, -8 * s); c.lineTo(4 * s, -11 * s); c.lineTo(2 * s, -3 * s); c.closePath(); c.fill();
    } else if (d.kind === "flower") {
      c.fillStyle = d.c; for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(Math.cos(i * 1.57) * 3, Math.sin(i * 1.57) * 3, 2.2, 0, 7); c.fill(); } c.fillStyle = "#ffe066"; c.beginPath(); c.arc(0, 0, 1.8, 0, 7); c.fill();
    }
    c.restore();
  };
})();
