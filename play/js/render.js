// Rendering: canvas, camera, entities, monsters, effects, minimap, input.
(function () {
  const PW = window.PW, G = PW.G, U = PW.U, T = PW.T;
  let cv, c, dpr = 1, zoom = 1, cw = 0, ch = 0, mini, mc;
  // graphics quality: settings.quality = auto | high | low; "auto" drops to low on weak devices or when the frame rate stays low
  PW.quality = () => { const q = G.S && G.S.settings && G.S.settings.quality; if (q === "low" || q === "high") return q; if (G.autoLow) return "low"; if (PW.weakDevice) return "low"; return "high"; };
  PW.weakDevice = (navigator.deviceMemory && navigator.deviceMemory <= 2) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) || false;
  PW.pcap = 420;
  // soft glow sprites for particles (cached per colour)
  const GLOWS = {};
  function glowSpr(col) { if (GLOWS[col]) return GLOWS[col]; const s = document.createElement("canvas"); s.width = s.height = 32; const g = s.getContext("2d"); const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, "rgba(255,255,255,.95)"); gr.addColorStop(0.3, col.length === 7 ? hexA(col, 0.75) : "rgba(255,255,255,.6)"); gr.addColorStop(1, col.length === 7 ? hexA(col, 0) : "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return (GLOWS[col] = s); }
  PW.initCanvas = () => {
    cv = document.getElementById("game"); c = cv.getContext("2d"); mini = document.getElementById("minimap"); mc = mini.getContext("2d");
    const rs = PW.applyQuality = () => { PW.pcap = PW.quality() === "low" ? 140 : 420; dpr = Math.min(window.devicePixelRatio || 1, PW.quality() === "low" ? 1 : 2); cw = Math.floor(window.innerWidth * dpr); ch = Math.floor(window.innerHeight * dpr); cv.width = cw; cv.height = ch; cv.style.width = window.innerWidth + "px"; cv.style.height = window.innerHeight + "px"; zoom = Math.min(cw, ch) / 520; zoom = Math.max(zoom, 0.9 * dpr); };
    window.addEventListener("resize", () => rs()); window.addEventListener("orientationchange", () => setTimeout(rs, 200)); rs();
  };
  PW.view = () => ({ cw, ch, zoom, dpr });
  PW.screenToWorld = (sx, sy) => ({ x: G.cam.x + (sx * dpr - cw / 2) / zoom, y: G.cam.y + (sy * dpr - ch / 2) / zoom });
  PW.worldToScreen = (x, y) => ({ x: ((x - G.cam.x) * zoom + cw / 2) / dpr, y: ((y - G.cam.y) * zoom + ch / 2) / dpr });

  const S = () => G.spr;
  const ell = (x, y, rx, ry, a) => { c.fillStyle = "rgba(0,0,0," + a + ")"; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, 7); c.fill(); };
  function sprite(k, x, y, h, flip, sx, sy, hurt, alpha) {
    const im = S()[k]; if (!im) return 0; const w = h * im.width / im.height;
    c.save(); c.translate(x, y); c.scale((flip ? -1 : 1) * (sx || 1), sy || 1); if (alpha != null) c.globalAlpha = alpha;
    c.drawImage(im, -w / 2, -h, w, h);
    if (hurt > 0 && S()[k + "#w"]) { c.globalAlpha = Math.min(1, hurt) * (alpha != null ? alpha : 1); c.drawImage(S()[k + "#w"], -w / 2, -h, w, h); }
    c.restore(); return w;
  }
  function label(txt, x, y, col, size, bg) {
    c.font = "bold " + (size || 11) + "px Kanit, Sarabun, sans-serif"; c.textAlign = "center";
    if (bg) { const w = c.measureText(txt).width + 12; c.fillStyle = bg; c.beginPath(); if (c.roundRect) c.roundRect(x - w / 2, y - (size || 11) - 2, w, (size || 11) + 7, 7); else c.rect(x - w / 2, y - (size || 11) - 2, w, (size || 11) + 7); c.fill(); }
    c.lineWidth = 3; c.strokeStyle = "rgba(10,5,25,.85)"; c.strokeText(txt, x, y); c.fillStyle = col; c.fillText(txt, x, y);
  }
  function bar(x, y, w, p, col, h2) { h2 = h2 || 5; c.fillStyle = "rgba(10,5,25,.75)"; c.fillRect(x - w / 2 - 1, y - 1, w + 2, h2 + 2); const g = c.createLinearGradient(0, y, 0, y + h2); g.addColorStop(0, col[0]); g.addColorStop(1, col[1]); c.fillStyle = g; c.fillRect(x - w / 2, y, w * U.clamp(p, 0, 1), h2); }

  function drawMonster(m, t) {
    const D = PW.MONSTERS[m.type], boss = !!D.boss; const H = boss ? 150 : m.r * 3.5;
    let alpha = 1, sc = 1, hurt = m.hurt > 0 ? m.hurt / 0.12 : 0;
    if (m.dead) { if (m.captured > 0) { const k = m.captured / 0.8; sc = k; alpha = k; hurt = 1 - k; } else { const k = Math.max(0, m.dieT / 0.5); alpha = k; sc = 1 + (1 - k) * 0.25; hurt = 1; } }
    const flip = Math.cos(m.face || 0) < 0; const ph = t * (m.type === "slime" ? 6 : 8) + m.seed;
    const mv = !m.dead && (m.target || m.wx || m.wy); const bob = m.type === "slime" ? 0 : (mv ? Math.abs(Math.sin(ph)) * 3 : Math.sin(ph * 0.4) * 1);
    const sq = m.type === "slime" ? Math.sin(ph) * 0.09 : (mv ? Math.sin(ph * 2) * 0.04 : Math.sin(ph * 0.4) * 0.02);
    ell(m.x, m.y + 2, m.r * (boss ? 1.6 : 1.15) * sc, m.r * 0.42 * sc, 0.3 * alpha);
    if (boss && !m.dead) { const g = c.createRadialGradient(m.x, m.y - 60, 10, m.x, m.y - 60, 110); g.addColorStop(0, "rgba(140,220,255,.35)"); g.addColorStop(1, "rgba(140,220,255,0)"); c.fillStyle = g; c.beginPath(); c.arc(m.x, m.y - 60, 110, 0, 7); c.fill(); }
    const mk = "mon_" + m.type;
    if (G.atl[mk]) {
      const fr = m.dead ? { f: 7, s: "dead", p: 0 } : PW.monFrame(m, t, mv); let ox = 0, oy = 0;
      if (fr.s === "attack") { const l = Math.sin(fr.p * Math.PI) * (boss ? 16 : 9); ox = Math.cos(m.face || 0) * l; oy = Math.sin(m.face || 0) * l * 0.5; }
      PW.drawFrame(c, mk, fr.f, m.x + ox, m.y + 3 - bob * 0.35 + oy, H * sc, flip, 1 + sq * 0.5, 1 - sq * 0.5, hurt, alpha);
    } else { PW.loadAtlas(mk); sprite(mk, m.x, m.y + 3 - bob, H * sc, flip, 1 + sq, 1 - sq, hurt, alpha); }
    if (m.dead) return;
    if (m.stun > 0) { for (let i = 0; i < 3; i++) { const a = t * 5 + i * 2.1; c.fillStyle = "#ffe066"; c.beginPath(); c.arc(m.x + Math.cos(a) * 12, m.y - H - 4 + Math.sin(a) * 4, 3, 0, 7); c.fill(); } }
    if (m.slow > 0) { c.strokeStyle = "rgba(160,220,255,.7)"; c.lineWidth = 2; c.beginPath(); c.ellipse(m.x, m.y + 2, m.r * 1.3, m.r * 0.5, 0, 0, 7); c.stroke(); }
    const h = G.hero; const tgt = G.moveTo && G.moveTo.m === m; const capT = G.capTarget === m;
    if (tgt || capT) { c.save(); c.strokeStyle = capT ? "#7ff6ff" : "#ff5a6a"; c.lineWidth = 2.5; c.setLineDash([6, 5]); c.lineDashOffset = -t * 30; c.beginPath(); c.ellipse(m.x, m.y + 2, m.r * 1.6, m.r * 0.65, 0, 0, 7); c.stroke(); c.restore(); }
    if (!boss && (m.hp < m.maxHp || Math.hypot(m.x - h.x, m.y - h.y) < 200)) {
      const y = m.y - H - 10; bar(m.x, y, 40, m.hp / m.maxHp, m.hp / m.maxHp < 0.35 ? ["#7ff6ff", "#2aa6c8"] : ["#ff7a7a", "#c8304a"], 5);
      label("Lv" + m.lvl + " " + D.name, m.x, y - 4, m.lvl > h.level + 4 ? "#ff9a9a" : "#fff", 10);
    }
  }
  function aura(x, y, r, col, a) { const g = c.createRadialGradient(x, y, 2, x, y, r); g.addColorStop(0, col.replace(")", "," + a + ")").replace("rgb", "rgba")); g.addColorStop(1, col.replace(")", ",0)").replace("rgb", "rgba")); c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }
  function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return "rgba(" + (n >> 16) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")"; }
  function drawHero(h, t) {
    const Hd = PW.HEROES[h.id]; const HH = 62; const flip = Math.cos(h.face) < 0;
    const ph = t * 13 + (h.idx || 0); const bob = h.moving ? Math.abs(Math.sin(ph)) * 4 : Math.sin(t * 2.6 + h.x * 0.01) * 0.8;
    const sq = h.moving ? Math.sin(ph * 2) * 0.045 : Math.sin(t * 2.6) * 0.015;
    const lunge = h.cast > 0 ? Math.min(1, h.cast / 0.2) * 5 : 0; const lx = Math.cos(h.face) * lunge, ly = Math.sin(h.face) * lunge * 0.5;
    // ground marker
    c.save(); c.globalAlpha = 0.85; c.strokeStyle = h.isPlayer ? "#ffe066" : Hd.color; c.lineWidth = h.isPlayer ? 2.5 : 1.8; c.beginPath(); c.ellipse(h.x, h.y + 2, 19, 7.5, 0, 0, 7); c.stroke();
    if (h.isPlayer) { c.globalAlpha = 0.25 + Math.sin(t * 4) * 0.1; c.fillStyle = "#ffe066"; c.fill(); } c.restore();
    ell(h.x, h.y + 2, 15, 5.5, 0.32);
    for (const gl of G.glows) if (gl.e === h) { const k = gl.t / gl.dur; const g = c.createRadialGradient(h.x, h.y - 30, 4, h.x, h.y - 30, 60); g.addColorStop(0, hexA(gl.c, 0.55 * k)); g.addColorStop(1, hexA(gl.c, 0)); c.fillStyle = g; c.beginPath(); c.arc(h.x, h.y - 30, 60, 0, 7); c.fill(); }
    if (h.buff.t > 0) { for (let i = 0; i < 2; i++) if (Math.random() < 0.5) G.parts.push({ x: h.x + U.rnd(-14, 14), y: h.y - U.rnd(0, 40), vx: 0, vy: -60, t: 0.5, c: "#ffb347", s: 2.5, spark: 0 }); }
    const hk = "hero_" + h.id;
    if (G.atl[hk]) {
      const fr = PW.heroFrame(h, t), hl = PW.quality() !== "low";
      if (hl && fr.s === "cast") { const k = Math.sin(fr.p * Math.PI); c.save(); c.globalCompositeOperation = "lighter"; const g = c.createRadialGradient(h.x, h.y - 30, 4, h.x, h.y - 30, 52); g.addColorStop(0, hexA(Hd.color, 0.55 * k)); g.addColorStop(1, hexA(Hd.color, 0)); c.fillStyle = g; c.beginPath(); c.arc(h.x, h.y - 30, 52, 0, 7); c.fill(); c.restore(); }
      const dead = fr.s === "dead", rot = dead ? (flip ? 1 : -1) * Math.min(1, fr.p * 1.4) * 1.45 : 0;
      PW.drawFrame(c, hk, fr.f, h.x + lx, h.y + 3 - (fr.s === "walk" ? bob * 0.35 : 0) + ly, HH, flip, 1 + (fr.s === "idle" ? sq : 0), 1 - (fr.s === "idle" ? sq : 0), h.hurt > 0 ? h.hurt / 0.15 : 0, dead ? 0.55 : null, rot);
    } else { PW.loadAtlas(hk); sprite(hk, h.x + lx, h.y + 3 - bob + ly, HH, flip, 1 + sq, 1 - sq, h.hurt > 0 ? h.hurt / 0.15 : 0, h.dead ? 0.35 : null); }
    if (h.shield > 0) { c.save(); const g = c.createRadialGradient(h.x, h.y - 30, 10, h.x, h.y - 30, 40); g.addColorStop(0, "rgba(138,232,255,0)"); g.addColorStop(0.8, "rgba(138,232,255,.22)"); g.addColorStop(1, "rgba(200,250,255,.6)"); c.fillStyle = g; c.beginPath(); c.ellipse(h.x, h.y - 28, 30, 38, 0, 0, 7); c.fill(); c.restore(); }
    if (h.isPlayer) label(Hd.name + " Lv" + h.level, h.x, h.y - HH - 8, "#ffe066", 11);
    else { label(Hd.name + " Lv" + h.level, h.x, h.y - HH - 12, "#fff", 10); bar(h.x, h.y - HH - 8, 34, h.hp / h.maxHp, ["#8dff9f", "#2fbf5a"], 4); }
  }
  function drawNpc(n, t) {
    const bob = Math.sin(t * 2 + n.x) * 1.2; ell(n.x, n.y + 2, 16, 6, 0.3);
    c.save(); c.globalAlpha = 0.6; c.strokeStyle = n.color; c.lineWidth = 2; c.beginPath(); c.ellipse(n.x, n.y + 2, 20, 7.5, 0, 0, 7); c.stroke(); c.restore();
    sprite("npc_" + n.id, n.x, n.y + 3 - bob, 66, n.x > 40 * T, 1, 1, 0);
    label(n.name, n.x, n.y - 74, "#9ff0ff", 12, "rgba(20,10,40,.6)"); label(n.title, n.x, n.y + 18, "#e8f6ff", 9);
    if (G.nearNpc === n || G.moveTo && G.moveTo.npc === n) { const y = n.y - 96 + Math.sin(t * 6) * 3; c.fillStyle = "#ffe066"; c.beginPath(); c.arc(n.x, y, 10, 0, 7); c.fill(); c.strokeStyle = "#7a4a00"; c.lineWidth = 2; c.stroke(); label("!", n.x, y + 5, "#5a3200", 14); }
  }
  function drawComp(e, t) {
    const p = e.p; if (!p) return; const pet = p.kind === "pet"; const evo = PW.EVO[p.evo || 0]; const ev = p.evo || 0; const HH = (pet ? 34 : 38) * (1 + (evo.s - 1) * 0.55);
    const hop = e.moving ? Math.abs(Math.sin(e.hop)) * 6 : Math.abs(Math.sin(e.hop * 0.6)) * 2; const fl = pet ? 8 + Math.sin(t * 3 + e.uid) * 3 : 0;
    ell(e.x, e.y + 2, 11 * evo.s, 4 * evo.s, 0.28);
    if (ev) { c.save(); c.globalAlpha = 0.5 + Math.sin(t * 3 + e.uid) * 0.12; c.strokeStyle = ev > 1 ? "#ffe9a8" : "#bdf3ff"; c.lineWidth = 1.6; c.beginPath(); c.ellipse(e.x, e.y + 2, 16 + ev * 3, 6 + ev, 0, 0, 7); c.stroke(); c.restore(); }
    let ck = PW.compSprite(p); if (ev && !S()[ck]) { PW.loadSpr(ck); ck = (pet ? "pet_" : "tamed_") + p.sp; }
    sprite(ck, e.x, e.y + 2 - hop - fl, HH, Math.cos(e.face) < 0, 1, 1, 0);
    label("Lv" + p.lv, e.x, e.y - HH - fl - 4, pet ? "#ffd6ff" : "#ffe0b0", 9);
  }
  function drawLoot(l, t) {
    const k = PW.LOOT_ICON[l.kind]; const sz = l.kind === "gold" ? 16 : l.kind === "item" ? 24 : 20; const y = l.y - l.z - (l.fly ? 0 : Math.abs(Math.sin(t * 3 + l.x)) * 3);
    if (!l.fly) ell(l.x, l.y + 2, sz * 0.45, sz * 0.18, 0.3);
    const col = l.kind === "gold" ? "255,224,102" : l.kind === "item" ? "255,180,255" : l.kind === "crystal" ? "127,246,255" : l.kind === "egg" || l.kind === "gem" ? "214,168,255" : "255,255,255";
    const g = c.createRadialGradient(l.x, y - sz / 2, 1, l.x, y - sz / 2, sz); g.addColorStop(0, "rgba(" + col + ",.55)"); g.addColorStop(1, "rgba(" + col + ",0)"); c.fillStyle = g; c.beginPath(); c.arc(l.x, y - sz / 2, sz, 0, 7); c.fill();
    sprite(k, l.x, y, sz, false);
  }

  // ambient particles per zone
  function ambient(dt, zid, camx, camy, vw, vh) {
    const want = Math.round((zid === "ice" ? 70 : zid === "forest" ? 26 : zid === "desert" ? 30 : 22) * (PW.quality() === "low" ? 0.35 : 1)); const A = G.amb;
    while (A.length < want) A.push({ x: camx + U.rnd(-vw / 2, vw / 2), y: camy + U.rnd(-vh / 2, vh / 2), p: Math.random() * 6.28, s: U.rnd(0.6, 1.4), z: zid });
    if (A.length > want) A.length = want;
    for (const a of A) {
      if (a.z !== zid) { a.z = zid; }
      a.p += dt;
      if (zid === "ice") { a.y += 40 * a.s * dt; a.x += Math.sin(a.p) * 14 * dt; }
      else if (zid === "forest") { a.x += Math.cos(a.p * 0.7) * 12 * dt; a.y += Math.sin(a.p * 0.9) * 10 * dt; }
      else if (zid === "desert") { a.x += 60 * a.s * dt; a.y += Math.sin(a.p) * 6 * dt; }
      else { a.x += 22 * a.s * dt; a.y += 18 * a.s * dt + Math.sin(a.p) * 8 * dt; }
      if (a.x < camx - vw / 2 - 20) a.x += vw + 30; if (a.x > camx + vw / 2 + 20) a.x -= vw + 30; if (a.y < camy - vh / 2 - 20) a.y += vh + 30; if (a.y > camy + vh / 2 + 20) a.y -= vh + 30;
      if (zid === "ice") { c.fillStyle = "rgba(255,255,255,.85)"; c.beginPath(); c.arc(a.x, a.y, 1.6 * a.s, 0, 7); c.fill(); }
      else if (zid === "forest") { const k = 0.5 + Math.sin(a.p * 3) * 0.5; const g = c.createRadialGradient(a.x, a.y, 0, a.x, a.y, 7); g.addColorStop(0, "rgba(200,255,150," + 0.9 * k + ")"); g.addColorStop(1, "rgba(200,255,150,0)"); c.fillStyle = g; c.beginPath(); c.arc(a.x, a.y, 7, 0, 7); c.fill(); }
      else if (zid === "desert") { c.fillStyle = "rgba(255,236,190,.45)"; c.fillRect(a.x, a.y, 3 * a.s, 1.2); }
      else { c.save(); c.translate(a.x, a.y); c.rotate(a.p); c.fillStyle = "rgba(255,190,215,.8)"; c.beginPath(); c.ellipse(0, 0, 3 * a.s, 1.6 * a.s, 0, 0, 7); c.fill(); c.restore(); }
    }
  }
  let vign = null, vw0 = 0, vh0 = 0;
  function vignette() {
    if (!vign || vw0 !== cw || vh0 !== ch) { vw0 = cw; vh0 = ch; vign = document.createElement("canvas"); vign.width = Math.max(1, cw >> 1); vign.height = Math.max(1, ch >> 1); const g = vign.getContext("2d"); const r = Math.hypot(vign.width, vign.height) / 2; const gr = g.createRadialGradient(vign.width / 2, vign.height / 2, r * 0.45, vign.width / 2, vign.height / 2, r); gr.addColorStop(0, "rgba(10,0,30,0)"); gr.addColorStop(1, "rgba(10,0,30,.55)"); g.fillStyle = gr; g.fillRect(0, 0, vign.width, vign.height); }
    c.drawImage(vign, 0, 0, cw, ch);
  }
  const TINT = { forest: "rgba(10,40,30,.22)", ice: "rgba(170,210,255,.10)", desert: "rgba(255,170,60,.07)", town: "rgba(255,210,150,.04)", meadow: "rgba(255,240,180,.03)", wild: "rgba(0,0,0,0)" };
  let lastT = 0, fEma = 16, fLow = 0, fPrev = 0;
  function fpsWatch() { // auto graphics: if the frame time stays high for ~3s on "auto" quality, switch to low
    const n = performance.now(); if (fPrev) { const d = Math.min(200, n - fPrev); fEma += (d - fEma) * 0.05; } fPrev = n;
    PW.fps = Math.round(1000 / Math.max(1, fEma));
    if (!G.S || !G.S.settings || G.S.settings.quality !== "auto" || G.autoLow || document.hidden) return;
    if (fEma > 30) fLow += 1; else fLow = Math.max(0, fLow - 2);
    if (fLow > 180) { G.autoLow = true; PW.applyQuality(); PW.toast("กราฟิกอัตโนมัติ: ปรับเป็นโหมดประหยัดเพื่อให้ลื่นขึ้น (ตั้งค่าได้ในเมนู)", 3500); }
  }

  PW.render = () => {
    if (!G.W) return; const t = G.t, h = G.hero; const W = G.W; const dt = Math.min(0.05, Math.max(0, t - lastT)); lastT = t;
    c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = "#0c0818"; c.fillRect(0, 0, cw, ch);
    const shA = G.shake > 0 ? Math.min(1, G.shake / 0.25) * 4.5 : 0, sx = shA * Math.sin(t * 73), sy = shA * Math.cos(t * 59);
    let camx = G.cam.x, camy = G.cam.y; const vw = cw / zoom, vh = ch / zoom;
    if (vw < PW.MW * T) camx = U.clamp(camx, vw / 2, PW.MW * T - vw / 2); else camx = PW.MW * T / 2; if (vh < PW.MH * T) camy = U.clamp(camy, vh / 2, PW.MH * T - vh / 2); else camy = PW.MH * T / 2;
    G.camView = { x: camx, y: camy };
    c.setTransform(zoom, 0, 0, zoom, cw / 2 - camx * zoom + sx, ch / 2 - camy * zoom + sy);
    const gx = Math.max(0, Math.floor(camx - vw / 2 - 2)), gy = Math.max(0, Math.floor(camy - vh / 2 - 2)), gw = Math.min(W.ground.width - gx, Math.ceil(vw + 4)), gh = Math.min(W.ground.height - gy, Math.ceil(vh + 4));
    c.imageSmoothingEnabled = true; c.drawImage(W.ground, gx, gy, gw, gh, gx, gy, gw, gh);
    const x0 = camx - vw / 2 - 80, x1 = camx + vw / 2 + 80, y0 = camy - vh / 2 - 60, y1 = camy + vh / 2 + 140;
    // water shimmer
    if (PW.quality() !== "low") for (const p of W.water) { const px = p[0] * T, py = p[1] * T, pw = p[2] * T, ph = p[3] * T; if (px > x1 || px + pw < x0 || py > y1 || py + ph < y0) continue; c.strokeStyle = "rgba(255,255,255,.45)"; c.lineWidth = 2; for (let i = 0; i < 5; i++) { const k = (t * 0.25 + i / 5) % 1; const xx = px + pw * (0.15 + 0.7 * ((i * 0.37) % 1)), yy = py + ph * (0.2 + 0.6 * k); c.globalAlpha = Math.sin(k * Math.PI) * 0.8; c.beginPath(); c.moveTo(xx - 8, yy); c.quadraticCurveTo(xx, yy - 3, xx + 8, yy); c.stroke(); } c.globalAlpha = 1; }
    // tap-to-move marker
    if (G.moveTo && !G.moveTo.m) { const k = (t * 2) % 1; c.strokeStyle = "rgba(255,230,120," + (1 - k) + ")"; c.lineWidth = 2.5; c.beginPath(); c.ellipse(G.moveTo.x, G.moveTo.y, 8 + k * 16, (8 + k * 16) * 0.45, 0, 0, 7); c.stroke(); c.fillStyle = "#ffe066"; c.beginPath(); c.ellipse(G.moveTo.x, G.moveTo.y, 4, 2, 0, 0, 7); c.fill(); }
    // ground rings (skill telegraphs)
    for (const r of G.rings) { const k = r.t / r.dur, e = 1 - Math.pow(k, 2.2), rr = r.r * (0.3 + 0.78 * (1 - Math.pow(1 - e, 3))), col = r.c.length === 7 ? r.c : "#ffffff"; const g = c.createRadialGradient(r.x, r.y, rr * 0.2, r.x, r.y, rr); g.addColorStop(0, hexA(col, 0)); g.addColorStop(0.8, hexA(col, 0.16 * k)); g.addColorStop(1, hexA(col, 0.5 * k)); c.fillStyle = g; c.beginPath(); c.ellipse(r.x, r.y, rr, rr * 0.62, 0, 0, 7); c.fill(); c.globalAlpha = Math.min(1, k * 1.6); c.strokeStyle = r.c; c.lineWidth = 1.5 + 2.5 * k; c.stroke(); c.globalAlpha = 1; }
    for (const l of G.loot) if (l.fly) continue; else drawLoot(l, t);
    // y-sorted world
    const list = [];
    for (const d of W.deco) { if (d.x < x0 - 60 || d.x > x1 + 60 || d.y < y0 || d.y > y1 + 60) continue; list.push({ y: d.y, d }); }
    for (const m of G.monsters) { if ((m.dead && !(m.dieT > 0) && !(m.captured > 0)) || m.x < x0 || m.x > x1 || m.y < y0 || m.y > y1) continue; list.push({ y: m.y, m }); }
    for (const n of G.npcs) list.push({ y: n.y, n });
    for (const a of G.allies) list.push({ y: a.y, h: a });
    for (const e of G.comps) list.push({ y: e.y, e });
    list.push({ y: h.y, h });
    list.sort((a, b) => a.y - b.y);
    for (const e of list) { if (e.d) PW.drawDeco(c, e.d, t); else if (e.m) drawMonster(e.m, t); else if (e.n) drawNpc(e.n, t); else if (e.h) drawHero(e.h, t); else if (e.e) drawComp(e.e, t); }
    for (const l of G.loot) if (l.fly) drawLoot(l, t);
    // additive fx layer
    c.globalCompositeOperation = "lighter";
    for (const p of G.projs) {
      if (PW.quality() !== "low") { const tr = p.tr || (p.tr = []); if (!tr.length || Math.hypot(tr[tr.length - 1].x - p.x, tr[tr.length - 1].y - p.y) > 5) { tr.push({ x: p.x, y: p.y }); if (tr.length > 8) tr.shift(); } const gs = glowSpr(p.c || "#ffffff"); for (let i = 0; i < tr.length; i++) { const q = tr[i], f = (i + 1) / tr.length, sz = (p.size || 5) * (1.2 + f * 1.8); c.globalAlpha = f * 0.45; c.drawImage(gs, q.x - sz, q.y - 22 - sz, sz * 2, sz * 2); } c.globalAlpha = 1; }
      c.save(); c.translate(p.x, p.y - 22); c.rotate(p.ang);
      if (p.kind === "arrow") { const g = c.createLinearGradient(-26, 0, 10, 0); g.addColorStop(0, hexA(p.c, 0)); g.addColorStop(1, hexA(p.c, 0.9)); c.fillStyle = g; c.fillRect(-26, -2, 36, 4); c.fillStyle = "#fff"; c.beginPath(); c.moveTo(12, 0); c.lineTo(5, -4); c.lineTo(5, 4); c.fill(); }
      else if (p.kind === "beam") { const g = c.createLinearGradient(-60, 0, 24, 0); g.addColorStop(0, "rgba(180,210,255,0)"); g.addColorStop(1, "rgba(235,245,255,.95)"); c.fillStyle = g; c.beginPath(); c.ellipse(-16, 0, 48, p.size * 0.75, 0, 0, 7); c.fill(); }
      else { const g = c.createRadialGradient(0, 0, 0, 0, 0, p.size * 2.4); g.addColorStop(0, "rgba(255,255,255,.95)"); g.addColorStop(0.35, hexA(p.c.length === 7 ? p.c : "#ffffff", 0.8)); g.addColorStop(1, hexA(p.c.length === 7 ? p.c : "#ffffff", 0)); c.fillStyle = g; c.beginPath(); c.arc(0, 0, p.size * 2.4, 0, 7); c.fill(); }
      c.restore();
    }
    for (const s2 of G.slashes) { const k = s2.t / s2.dur; c.save(); c.translate(s2.x, s2.y); c.rotate(s2.a); if (s2.flip) c.scale(1, -1); c.strokeStyle = hexA(s2.c, 0.9 * k); c.lineWidth = 7 * k + 1; c.lineCap = "round"; c.beginPath(); c.arc(0, 0, s2.r * (1.15 - k * 0.3), -1.1 + (1 - k) * 0.6, 1.1 - (1 - k) * 0.2); c.stroke(); c.strokeStyle = "rgba(255,255,255," + 0.8 * k + ")"; c.lineWidth = 2; c.stroke(); c.restore(); }
    for (const z of G.zaps) { const k = z.t / z.dur; c.strokeStyle = hexA(z.c.length === 7 ? z.c : "#ffffff", k); c.lineWidth = z.melee ? 4 : 3; c.beginPath(); c.moveTo(z.x1, z.y1); if (z.melee) c.lineTo(z.x2, z.y2); else c.quadraticCurveTo((z.x1 + z.x2) / 2, Math.min(z.y1, z.y2) - 30, z.x2, z.y2); c.stroke(); }
    for (const b of G.bolts) { const k = b.t / b.dur; c.strokeStyle = "rgba(255,250,170," + k + ")"; c.lineWidth = 4; c.beginPath(); let yy = b.y - 260, xx = b.x + 20; c.moveTo(xx, yy); while (yy < b.y - 10) { yy += 30; xx = b.x + U.rnd(-14, 14); c.lineTo(xx, yy); } c.stroke(); c.lineWidth = 1.5; c.strokeStyle = "rgba(255,255,255," + k + ")"; c.stroke(); }
    for (const mt of G.meteors) { const k = mt.t / mt.dur; const mx = mt.x + k * 220, my = mt.y - k * 420 - 20; const g = c.createRadialGradient(mx, my, 0, mx, my, 46); g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.4, "rgba(170,220,255,.8)"); g.addColorStop(1, "rgba(120,180,255,0)"); c.fillStyle = g; c.beginPath(); c.arc(mx, my, 46, 0, 7); c.fill(); c.strokeStyle = "rgba(170,220,255,.5)"; c.lineWidth = 14; c.beginPath(); c.moveTo(mx, my); c.lineTo(mx + 90, my - 170); c.stroke(); }
    for (const p of G.parts) { const a = Math.max(0, Math.min(1, p.t * 2.2)); c.fillStyle = p.c; c.globalAlpha = a; if (p.spark) { c.strokeStyle = p.c; c.lineWidth = p.s || 2; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04); c.stroke(); } else if (PW.quality() !== "low") { const sz = (p.s || 2) * 2.6 * (0.5 + a * 0.5); c.drawImage(glowSpr(p.c), p.x - sz, p.y - sz, sz * 2, sz * 2); } else { c.beginPath(); c.arc(p.x, p.y, p.s || 2, 0, 7); c.fill(); } } c.globalAlpha = 1;
    c.globalCompositeOperation = "source-over";
    for (const q of G.capFx) { const k = q.t / q.dur; if (q.ok) { for (let i = 0; i < 8; i++) { const a = i * 0.785 + k * 3; c.fillStyle = "rgba(127,246,255," + (1 - k) + ")"; c.beginPath(); c.arc(q.x1 + Math.cos(a) * k * 40, q.y1 - 20 - k * 50 + Math.sin(a) * k * 20, 3, 0, 7); c.fill(); } continue; } const m = q.m; if (!m) continue; const x = q.x1 + (m.x - q.x1) * k, y = q.y1 + (m.y - m.r - q.y1) * k - Math.sin(k * Math.PI) * 60; c.save(); c.translate(x, y); c.rotate(k * 12); sprite("item_crystal", 0, 10, 20, false); c.restore(); }
    ambient(dt, PW.zoneAt(h.x, h.y).id, camx, camy, vw, vh);
    // floating combat text (pop)
    for (const tx of G.texts) { const age = tx.life - tx.t; const pop = tx.pop ? 1 + Math.max(0, 0.6 - age * 4) : 1; c.globalAlpha = Math.min(1, tx.t / tx.life * 2.5); c.font = "800 " + Math.round(tx.size * pop) + "px Kanit, Sarabun, sans-serif"; c.textAlign = "center"; c.lineJoin = "round"; c.lineWidth = tx.crit ? 5 : 4; c.strokeStyle = tx.crit ? "rgba(120,40,0,.9)" : "rgba(15,5,30,.85)"; c.strokeText(tx.s, tx.x, tx.y); c.fillStyle = tx.c; c.fillText(tx.s, tx.x, tx.y); } c.globalAlpha = 1;
    // screen-space overlays
    c.setTransform(1, 0, 0, 1, 0, 0);
    const zt = TINT[PW.zoneAt(h.x, h.y).id]; if (zt) { c.fillStyle = zt; c.fillRect(0, 0, cw, ch); }
    if (PW.quality() !== "low") vignette();
    fpsWatch();
    if (G.flash) { c.fillStyle = hexA(G.flash.c, G.flash.t * 0.9); c.fillRect(0, 0, cw, ch); }
    // boss bar
    const boss = G.monsters.find((m) => PW.MONSTERS[m.type].boss && !m.dead && Math.hypot(m.x - h.x, m.y - h.y) < 420);
    if (boss) { const w = Math.min(cw * 0.6, 520 * dpr), x = cw / 2 - w / 2, y = ch * 0.17; c.fillStyle = "rgba(10,5,25,.8)"; c.fillRect(x - 3 * dpr, y - 3 * dpr, w + 6 * dpr, 16 * dpr); const g = c.createLinearGradient(0, y, 0, y + 10 * dpr); g.addColorStop(0, "#ff8aa8"); g.addColorStop(1, "#c8204a"); c.fillStyle = g; c.fillRect(x, y, w * boss.hp / boss.maxHp, 10 * dpr); c.font = "bold " + 13 * dpr + "px Kanit, sans-serif"; c.textAlign = "center"; c.fillStyle = "#fff"; c.fillText("👑 " + PW.MONSTERS.boss.name + " Lv" + boss.lvl, cw / 2, y - 6 * dpr); }
  };

  let mf = 0;
  PW.renderMinimap = () => {
    if (!mc || (mf++ % 6)) return; const w = mini.width, hgt = mini.height, sx = w / (PW.MW * T), sy = hgt / (PW.MH * T);
    mc.fillStyle = "#6fb85c"; mc.fillRect(0, 0, w, hgt);
    for (let i = PW.ZONES.length - 1; i >= 0; i--) { const z = PW.ZONES[i], r = z.rect; mc.fillStyle = z.minimap; mc.fillRect(r[0] * T * sx, r[1] * T * sy, r[2] * T * sx, r[3] * T * sy); }
    mc.fillStyle = "#4aa3e8"; for (const p of G.W.water) mc.fillRect(p[0] * T * sx, p[1] * T * sy, p[2] * T * sx, p[3] * T * sy);
    for (const m of G.monsters) if (!m.dead) { mc.fillStyle = PW.MONSTERS[m.type].boss ? "#f0f" : "#d33"; mc.fillRect(m.x * sx - 1, m.y * sy - 1, PW.MONSTERS[m.type].boss ? 4 : 2, PW.MONSTERS[m.type].boss ? 4 : 2); }
    mc.fillStyle = "#3df"; for (const n of G.npcs) mc.fillRect(n.x * sx - 1.5, n.y * sy - 1.5, 3, 3);
    for (const a of G.allies) { mc.fillStyle = "#6f6"; mc.fillRect(a.x * sx - 2, a.y * sy - 2, 4, 4); }
    if (G.moveTo && !G.moveTo.m) { mc.strokeStyle = "#ffe066"; mc.strokeRect(G.moveTo.x * sx - 2, G.moveTo.y * sy - 2, 4, 4); }
    mc.fillStyle = "#ff0"; mc.beginPath(); mc.arc(G.hero.x * sx, G.hero.y * sy, 3.2, 0, 7); mc.fill(); mc.strokeStyle = "#000"; mc.lineWidth = 1; mc.stroke();
  };
})();
