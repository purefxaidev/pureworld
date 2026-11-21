// Rendering: canvas, camera, entities, monsters, effects, minimap, input.
(function () {
  const PW = window.PW, G = PW.G, U = PW.U, T = PW.T;
  let cv, c, dpr = 1, zoom = 1, cw = 0, ch = 0, mini, mc;
  PW.initCanvas = () => {
    cv = document.getElementById("game"); c = cv.getContext("2d"); mini = document.getElementById("minimap"); mc = mini.getContext("2d");
    const rs = () => { dpr = Math.min(window.devicePixelRatio || 1, 2); cw = Math.floor(window.innerWidth * dpr); ch = Math.floor(window.innerHeight * dpr); cv.width = cw; cv.height = ch; cv.style.width = window.innerWidth + "px"; cv.style.height = window.innerHeight + "px"; zoom = Math.min(cw, ch) / 520; zoom = Math.max(zoom, 0.9 * dpr); };
    window.addEventListener("resize", rs); window.addEventListener("orientationchange", () => setTimeout(rs, 200)); rs();
  };
  PW.view = () => ({ cw, ch, zoom, dpr });
  PW.screenToWorld = (sx, sy) => ({ x: G.cam.x + (sx * dpr - cw / 2) / zoom, y: G.cam.y + (sy * dpr - ch / 2) / zoom });

  const tm = (type) => PW.MONSTERS[type];
  function drawMonster(m, t) {
    const D = tm(m.type), r = m.r, b = Math.sin(t * 5 + m.seed) * 1.5, hurt = m.hurt > 0;
    c.save(); c.translate(m.x, m.y);
    c.fillStyle = "rgba(0,0,0,.25)"; c.beginPath(); c.ellipse(0, r * 0.7, r * 0.95, r * 0.4, 0, 0, 7); c.fill();
    if (m.stun > 0) { c.strokeStyle = "#ffe066"; c.lineWidth = 2; c.beginPath(); c.arc(0, -r - 6, 7, t * 6, t * 6 + 4.5); c.stroke(); }
    const col = hurt ? "#fff" : D.color; const face = Math.cos(m.face || 0) >= 0 ? 1 : -1; c.scale(face, 1);
    const eye = (x, y, s) => { c.fillStyle = "#fff"; c.beginPath(); c.arc(x, y, s, 0, 7); c.fill(); c.fillStyle = "#222"; c.beginPath(); c.arc(x + s * 0.3, y, s * 0.5, 0, 7); c.fill(); };
    if (m.type === "slime") {
      c.fillStyle = col; c.beginPath(); c.ellipse(0, b * 0.6, r, r * 0.8 + b * 0.4, 0, Math.PI, 0); c.lineTo(r, r * 0.6); c.quadraticCurveTo(0, r * 0.9, -r, r * 0.6); c.closePath(); c.fill();
      c.fillStyle = "rgba(255,255,255,.4)"; c.beginPath(); c.ellipse(-r * 0.4, -r * 0.3, 4, 2.5, -0.5, 0, 7); c.fill(); eye(-4, -2, 3); eye(4, -2, 3);
    } else if (m.type === "rabbit") {
      c.fillStyle = col; c.beginPath(); c.ellipse(0, b, r, r * 0.8, 0, 0, 7); c.fill(); c.beginPath(); c.ellipse(-4, -r - 4 + b, 3.5, 9, -0.2, 0, 7); c.ellipse(5, -r - 4 + b, 3.5, 9, 0.2, 0, 7); c.fill();
      c.fillStyle = "#ffb3c1"; c.beginPath(); c.ellipse(-4, -r - 3 + b, 1.6, 6, -0.2, 0, 7); c.fill(); c.fillStyle = "#e33"; c.beginPath(); c.arc(-4, -2 + b, 2.2, 0, 7); c.arc(5, -2 + b, 2.2, 0, 7); c.fill();
      c.fillStyle = "#fff"; c.fillRect(-2, 4 + b, 2, 4); c.fillRect(1, 4 + b, 2, 4);
    } else if (m.type === "wolf") {
      c.fillStyle = col; c.beginPath(); c.ellipse(-3, 2 + b, r + 2, r * 0.7, 0, 0, 7); c.fill(); c.beginPath(); c.arc(r - 2, -3 + b, r * 0.62, 0, 7); c.fill();
      c.beginPath(); c.moveTo(r - 8, -r + b); c.lineTo(r - 4, -r - 8 + b); c.lineTo(r, -r + 1 + b); c.fill(); c.beginPath(); c.moveTo(-r - 2, 0); c.quadraticCurveTo(-r - 12, -8, -r - 8, -14); c.lineTo(-r + 2, -2); c.fill();
      c.fillStyle = "#ffd23f"; c.beginPath(); c.arc(r + 2, -5 + b, 2.2, 0, 7); c.fill(); c.fillStyle = "#222"; c.beginPath(); c.arc(r + 8, -1 + b, 2, 0, 7); c.fill();
    } else if (m.type === "mushroom") {
      c.fillStyle = hurt ? "#fff" : "#efe3cf"; c.fillRect(-6, -2 + b, 12, r - 2); c.fillStyle = col; c.beginPath(); c.ellipse(0, -4 + b, r + 2, r * 0.8, 0, Math.PI, 0); c.fill();
      c.fillStyle = "#fff"; [[-6, -10], [4, -12], [8, -6], [-1, -6]].forEach((p) => { c.beginPath(); c.arc(p[0], p[1] + b, 2.3, 0, 7); c.fill(); }); eye(-3, 4 + b, 2.2); eye(4, 4 + b, 2.2);
    } else if (m.type === "scorpion") {
      c.fillStyle = col; c.beginPath(); c.ellipse(0, b, r, r * 0.65, 0, 0, 7); c.fill(); c.strokeStyle = col; c.lineWidth = 5; c.beginPath(); c.moveTo(-r + 2, 0); c.bezierCurveTo(-r - 14, -4, -r - 10, -22, 0, -22 + b); c.stroke(); c.fillStyle = "#c33"; c.beginPath(); c.arc(0, -22 + b, 3.5, 0, 7); c.fill();
      c.fillStyle = col; c.beginPath(); c.arc(r + 2, -6, 6, 0, 7); c.arc(r + 2, 7, 6, 0, 7); c.fill(); eye(r * 0.4, -3, 2.2); eye(r * 0.4, 3, 2.2);
    } else if (m.type === "mummy") {
      c.fillStyle = col; c.fillRect(-r * 0.6, -r + b, r * 1.2, r * 1.9); c.beginPath(); c.arc(0, -r - 2 + b, r * 0.62, 0, 7); c.fill(); c.strokeStyle = "rgba(120,100,70,.7)"; c.lineWidth = 1.5;
      for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(-r * 0.6, -r + 4 + i * 7 + b); c.lineTo(r * 0.6, -r + 9 + i * 7 + b); c.stroke(); } c.fillStyle = "#ff5a3c"; c.beginPath(); c.arc(-3, -r - 2 + b, 2, 0, 7); c.arc(4, -r - 2 + b, 2, 0, 7); c.fill();
      c.fillStyle = col; c.fillRect(r * 0.5, -r + 4 + b, 12, 5);
    } else { // yeti / boss
      const boss = D.boss; c.fillStyle = boss ? "rgba(127,216,255,.25)" : "rgba(0,0,0,0)"; if (boss) { c.beginPath(); c.arc(0, 0, r * 1.5 + Math.sin(t * 3) * 3, 0, 7); c.fill(); }
      c.fillStyle = col; c.beginPath(); c.ellipse(0, b, r, r * 1.05, 0, 0, 7); c.fill(); c.beginPath(); c.arc(-r, 2 + b, r * 0.35, 0, 7); c.arc(r, 2 + b, r * 0.35, 0, 7); c.fill();
      c.fillStyle = hurt ? "#fff" : (boss ? "#2c4a78" : "#4c6b94"); c.beginPath(); c.ellipse(0, -r * 0.2 + b, r * 0.62, r * 0.5, 0, 0, 7); c.fill(); c.fillStyle = "#fff"; eye(-r * 0.25, -r * 0.25 + b, boss ? 5 : 3.5); eye(r * 0.25, -r * 0.25 + b, boss ? 5 : 3.5);
      c.fillStyle = "#fff"; c.fillRect(-r * 0.2, r * 0.05 + b, 3, 5); c.fillRect(r * 0.1, r * 0.05 + b, 3, 5);
      if (boss) { c.fillStyle = "#aeeaff"; for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(i * 9 - 5, -r + 4 + b); c.lineTo(i * 9, -r - 16 + Math.abs(i) * 4 + b); c.lineTo(i * 9 + 5, -r + 4 + b); c.fill(); } }
    }
    c.restore();
    // bars/labels
    if (m.hp < m.maxHp || D.boss || Math.hypot(m.x - G.hero.x, m.y - G.hero.y) < 170) {
      const w = D.boss ? 70 : 34, y = m.y - r - (D.boss ? 34 : 16); c.fillStyle = "rgba(0,0,0,.6)"; c.fillRect(m.x - w / 2 - 1, y - 1, w + 2, 6); c.fillStyle = D.boss ? "#ff4d6d" : "#ff5a5a"; c.fillRect(m.x - w / 2, y, w * Math.max(0, m.hp / m.maxHp), 4);
      c.font = "bold 10px Sarabun, sans-serif"; c.textAlign = "center"; c.lineWidth = 3; c.strokeStyle = "rgba(0,0,0,.7)"; const lab = "Lv" + m.lvl + " " + D.name; c.strokeText(lab, m.x, y - 3); c.fillStyle = m.lvl > G.hero.level + 4 ? "#ff9a9a" : "#fff"; c.fillText(lab, m.x, y - 3);
    }
  }
  function drawHero(h, t) {
    const H = PW.HEROES[h.id], img = G.imgs[h.id + "_icon"]; const bob = h.moving ? Math.sin(t * 14) * 2 : Math.sin(t * 3) * 0.8;
    c.save(); c.translate(h.x, h.y); c.fillStyle = "rgba(0,0,0,.3)"; c.beginPath(); c.ellipse(0, 15, 15, 6, 0, 0, 7); c.fill();
    if (h.buff.t > 0) { c.strokeStyle = "rgba(255,200,80," + (0.4 + Math.sin(t * 10) * 0.2) + ")"; c.lineWidth = 4; c.beginPath(); c.arc(0, bob, 24, 0, 7); c.stroke(); }
    if (h.shield > 0) { c.fillStyle = "rgba(138,232,255,.25)"; c.strokeStyle = "#8ae8ff"; c.lineWidth = 2; c.beginPath(); c.arc(0, bob, 23, 0, 7); c.fill(); c.stroke(); }
    // facing pointer
    c.fillStyle = H.color; c.save(); c.rotate(h.face); c.beginPath(); c.moveTo(26, bob); c.lineTo(18, bob - 5); c.lineTo(18, bob + 5); c.fill(); c.restore();
    c.save(); c.beginPath(); c.arc(0, bob, 17, 0, 7); c.clip(); c.fillStyle = "#222"; c.fillRect(-18, -18 + bob, 36, 36); if (img) c.drawImage(img, -18, -18 + bob, 36, 36); if (h.hurt > 0) { c.fillStyle = "rgba(255,0,0,.45)"; c.fillRect(-18, -18, 36, 36); } c.restore();
    c.strokeStyle = h.isPlayer ? "#ffe066" : H.color; c.lineWidth = h.isPlayer ? 3 : 2.5; c.beginPath(); c.arc(0, bob, 17, 0, 7); c.stroke();
    if (h.cast > 0) { c.strokeStyle = H.color; c.globalAlpha = h.cast; c.lineWidth = 3; c.beginPath(); c.arc(0, bob, 17 + (0.35 - h.cast) * 60, 0, 7); c.stroke(); c.globalAlpha = 1; }
    c.restore();
    c.font = "bold 11px Sarabun, sans-serif"; c.textAlign = "center"; c.lineWidth = 3; c.strokeStyle = "rgba(0,0,0,.75)"; const nm = H.name + " Lv" + h.level; c.strokeText(nm, h.x, h.y - 28); c.fillStyle = h.isPlayer ? "#ffe066" : "#fff"; c.fillText(nm, h.x, h.y - 28);
    if (!h.isPlayer) { c.fillStyle = "rgba(0,0,0,.6)"; c.fillRect(h.x - 17, h.y - 25, 34, 4); c.fillStyle = "#6aff8a"; c.fillRect(h.x - 16, h.y - 24, 32 * Math.max(0, h.hp / h.maxHp), 2); }
    if (h.dead) { c.fillStyle = "rgba(0,0,0,.5)"; c.beginPath(); c.arc(h.x, h.y, 17, 0, 7); c.fill(); }
  }
  function drawNpc(n, t) {
    const img = G.imgs["npc_" + n.id], bob = Math.sin(t * 2 + n.x) * 1.2;
    c.save(); c.translate(n.x, n.y); c.fillStyle = "rgba(0,0,0,.3)"; c.beginPath(); c.ellipse(0, 16, 16, 6, 0, 0, 7); c.fill();
    c.save(); c.beginPath(); c.arc(0, bob, 18, 0, 7); c.clip(); c.fillStyle = "#333"; c.fillRect(-19, -19, 38, 38); if (img) c.drawImage(img, -19, -19 + bob, 38, 38); c.restore();
    c.strokeStyle = n.color; c.lineWidth = 3; c.beginPath(); c.arc(0, bob, 18, 0, 7); c.stroke(); c.restore();
    c.font = "bold 11px Sarabun, sans-serif"; c.textAlign = "center"; c.lineWidth = 3; c.strokeStyle = "rgba(0,0,0,.75)"; c.strokeText(n.name, n.x, n.y - 28); c.fillStyle = "#9ff0ff"; c.fillText(n.name, n.x, n.y - 28);
    c.font = "9px Sarabun, sans-serif"; c.fillStyle = "#cfe"; c.strokeText(n.title, n.x, n.y + 31); c.fillText(n.title, n.x, n.y + 31);
    if (G.nearNpc === n) { c.fillStyle = "#ffe066"; c.beginPath(); c.arc(n.x + 18, n.y - 20 + Math.sin(t * 6) * 2, 7, 0, 7); c.fill(); c.fillStyle = "#222"; c.font = "bold 11px Sarabun"; c.fillText("!", n.x + 18, n.y - 16 + Math.sin(t * 6) * 2); }
  }

  PW.render = () => {
    if (!G.W) return; const t = G.t, h = G.hero; const W = G.W;
    c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = "#111"; c.fillRect(0, 0, cw, ch);
    const sx = G.shake > 0 ? U.rnd(-3, 3) : 0, sy = G.shake > 0 ? U.rnd(-3, 3) : 0;
    let camx = G.cam.x, camy = G.cam.y; const vw = cw / zoom, vh = ch / zoom;
    if (vw < PW.MW * T) camx = U.clamp(camx, vw / 2, PW.MW * T - vw / 2); else camx = PW.MW * T / 2; if (vh < PW.MH * T) camy = U.clamp(camy, vh / 2, PW.MH * T - vh / 2); else camy = PW.MH * T / 2;
    c.setTransform(zoom, 0, 0, zoom, cw / 2 - camx * zoom + sx, ch / 2 - camy * zoom + sy);
    c.drawImage(W.ground, 0, 0);
    const x0 = camx - vw / 2 - 60, x1 = camx + vw / 2 + 60, y0 = camy - vh / 2 - 60, y1 = camy + vh / 2 + 60;
    // zone telegraph rings (below entities)
    for (const r of G.rings) { const k = r.t / r.dur; c.globalAlpha = Math.min(1, k * 1.4) * 0.8; c.strokeStyle = r.c; c.lineWidth = 3; c.fillStyle = r.c; c.beginPath(); c.arc(r.x, r.y, r.r * (1 - k * 0.15), 0, 7); c.stroke(); c.globalAlpha = k * 0.12; c.fill(); c.globalAlpha = 1; }
    const list = [];
    for (const d of W.deco) { if (d.x < x0 || d.x > x1 || d.y < y0 - 40 || d.y > y1 + 40) continue; list.push({ y: d.y, f: () => PW.drawDeco(c, d, t) }); }
    for (const m of G.monsters) { if (m.dead || m.x < x0 || m.x > x1 || m.y < y0 || m.y > y1) continue; list.push({ y: m.y, f: () => drawMonster(m, t) }); }
    for (const n of G.npcs) list.push({ y: n.y, f: () => drawNpc(n, t) });
    for (const a of G.allies) list.push({ y: a.y, f: () => drawHero(a, t) });
    list.push({ y: h.y, f: () => drawHero(h, t) });
    list.sort((a, b) => a.y - b.y); for (const e of list) e.f();
    // projectiles
    for (const p of G.projs) {
      c.save(); c.translate(p.x, p.y); c.rotate(p.ang); c.fillStyle = p.c;
      if (p.kind === "arrow") { c.fillRect(-10, -1.5, 16, 3); c.beginPath(); c.moveTo(10, 0); c.lineTo(5, -4); c.lineTo(5, 4); c.fill(); }
      else if (p.kind === "beam") { const g2 = c.createLinearGradient(-30, 0, 20, 0); g2.addColorStop(0, "rgba(207,224,255,0)"); g2.addColorStop(1, "#fff"); c.fillStyle = g2; c.beginPath(); c.ellipse(-8, 0, 36, p.size * 0.6, 0, 0, 7); c.fill(); }
      else { c.globalAlpha = 0.35; c.beginPath(); c.arc(0, 0, p.size * 1.7, 0, 7); c.fill(); c.globalAlpha = 1; c.beginPath(); c.arc(0, 0, p.size, 0, 7); c.fill(); c.fillStyle = "#fff"; c.beginPath(); c.arc(0, 0, p.size * 0.45, 0, 7); c.fill(); }
      c.restore();
    }
    for (const p of G.parts) { c.globalAlpha = Math.max(0, p.t * 1.6); c.fillStyle = p.c; c.fillRect(p.x - 1.5, p.y - 1.5, 3, 3); } c.globalAlpha = 1;
    for (const tx of G.texts) { c.globalAlpha = Math.min(1, tx.t / tx.life * 2); c.font = "bold " + tx.size + "px Kanit, Sarabun, sans-serif"; c.textAlign = "center"; c.lineWidth = 3.5; c.strokeStyle = "rgba(0,0,0,.8)"; c.strokeText(tx.s, tx.x, tx.y); c.fillStyle = tx.c; c.fillText(tx.s, tx.x, tx.y); } c.globalAlpha = 1;
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
    mc.fillStyle = "#ff0"; mc.beginPath(); mc.arc(G.hero.x * sx, G.hero.y * sy, 3.2, 0, 7); mc.fill(); mc.strokeStyle = "#000"; mc.lineWidth = 1; mc.stroke();
  };
})();
