// Monsters, combat, skills, AI, update loop.
(function () {
  const PW = window.PW, G = PW.G, U = PW.U, T = PW.T;

  // ---------------------------------------------------------------- spawning
  PW.spawnMonsters = () => {
    const R = PW.rng(777); G.monsters = [];
    for (const zid in PW.SPAWNS) for (const [type, n] of PW.SPAWNS[zid]) for (let i = 0; i < n; i++) {
      const D = PW.MONSTERS[type]; const p = PW.randomFreeIn(G.W, zid, D.r, R);
      const m = { type, x: p.x, y: p.y, hx: p.x, hy: p.y, r: D.r, dead: false, respT: 0, hurt: 0, stun: 0, slow: 0, atkT: 0.5, target: null, forceTarget: null, forceT: 0, spT: 4, wander: 0, wx: 0, wy: 0, seed: R() * 10, face: 0 };
      PW.initMonster(m); G.monsters.push(m);
    }
  };
  PW.initMonster = (m) => {
    const D = PW.MONSTERS[m.type]; const lvl = U.ri(D.lv[0], D.lv[1]); const sc = 1 + 0.14 * (lvl - D.lv[0]);
    m.lvl = lvl; m.maxHp = Math.round(D.hp * sc); m.hp = m.maxHp; m.atk = Math.round(D.atk * sc); m.def = D.def * sc; m.spd = D.spd; m.xp = Math.round(D.xp * (1 + 0.1 * (lvl - D.lv[0]))); m.gold = D.gold;
    m.x = m.hx; m.y = m.hy; m.dead = false; m.target = null; m.stun = 0; m.slow = 0;
  };
  const alive = () => [G.hero].concat(G.allies).filter((h) => !h.dead);
  PW.party = alive;
  const near = (x, y, r) => G.monsters.filter((m) => !m.dead && Math.hypot(m.x - x, m.y - y) <= r + m.r);
  PW.monstersNear = near;
  function nearestMonster(h, range, safe) {
    let best = null, bd = 1e9; const plv = G.hero.level;
    for (const m of G.monsters) {
      if (m.dead) continue; const d = Math.hypot(m.x - h.x, m.y - h.y) - m.r; if (d > range || d >= bd) continue;
      if (safe && m.lvl > plv + 6 && !(m.target)) continue;
      best = m; bd = d;
    }
    return best;
  }

  // ---------------------------------------------------------------- movement
  function tryMove(e, dx, dy) {
    const W = G.W; let nx = e.x + dx, ny = e.y;
    if (!PW.collides(W, nx, ny, e.r * 0.7)) e.x = nx; nx = e.x; ny = e.y + dy;
    if (!PW.collides(W, nx, ny, e.r * 0.7)) e.y = ny;
  }
  function moveHero(h, vx, vy, dt) {
    const m = Math.hypot(vx, vy); h.moving = m > 0.05;
    if (!h.moving || h.stun > 0) return;
    const sp = h.spd * (h.buff.t > 0 ? h.buff.spd : 1) * (h.slow > 0 ? 0.55 : 1); const k = Math.min(1, m);
    tryMove(h, (vx / m) * sp * k * dt, (vy / m) * sp * k * dt); if (!h.lockFace) h.face = Math.atan2(vy, vx);
  }

  // ---------------------------------------------------------------- damage
  function dmgOf(h, mul, forceCrit) {
    let d = h.atk * (h.buff.t > 0 ? h.buff.atk : 1) * mul * (0.9 + Math.random() * 0.2);
    const crit = forceCrit || Math.random() < h.crit; if (crit) d *= 1.6; return { d, crit };
  }
  function hit(h, m, mul, o) {
    o = o || {}; const r = dmgOf(h, mul, o.crit); const d = Math.max(1, Math.round(r.d - m.def * 0.5));
    damageMonster(m, d, h, r.crit, o);
  }
  function damageMonster(m, d, src, crit, o) {
    if (m.dead) return; m.hp -= d; m.hurt = 0.12; if (!m.target || m.target.dead) m.target = src;
    if (o.stun) m.stun = Math.max(m.stun, o.stun); if (o.slow) m.slow = Math.max(m.slow, o.slow);
    if (o.knock) { const a = Math.atan2(m.y - src.y, m.x - src.x); tryMove(m, Math.cos(a) * o.knock, Math.sin(a) * o.knock); }
    PW.text(m.x, m.y - m.r - 8, (crit ? "CRIT " : "") + d, crit ? "#ffd23f" : (src.isPlayer ? "#fff" : "#d8e6ff"), crit ? 1.1 : 0.8, crit ? 17 : 13);
    if (src.isPlayer) PW.sfx("hit"); for (let i = 0; i < 3; i++) PW.part(m.x, m.y, crit ? "#ffd23f" : "#fff");
    if (m.hp <= 0) killMonster(m, src);
  }
  function killMonster(m, src) {
    m.dead = true; m.respT = PW.MONSTERS[m.type].boss ? 90 : 14; m.target = null; const D = PW.MONSTERS[m.type]; const h = G.hero, S = G.S;
    const pen = U.clamp(1 - (h.level - m.lvl - 4) * 0.12, 0.2, 1); const xp = Math.max(1, Math.round(m.xp * pen)); const gold = Math.round(m.gold * U.rnd(0.8, 1.4));
    S.gold += gold; S.kills++; PW.text(m.x, m.y - 30, "+" + xp + " XP", "#9be7ff", 1.1, 13); PW.text(m.x, m.y - 14, "+" + gold + " G", "#ffe066", 1.1, 12); PW.sfx("coin");
    for (let i = 0; i < 10; i++) PW.part(m.x, m.y, D.color);
    PW.gainXp(xp);
    // quests
    const q = PW.QUESTS[S.qIdx]; if (q && q.m === m.type && S.qProg < q.n) { S.qProg++; if (S.qProg >= q.n) PW.toast("ภารกิจสำเร็จ! ไปกดรับรางวัลที่เมนู \"ภารกิจ\""); }
    // drops
    if (Math.random() < 0.22) { S.hpPot++; PW.text(m.x + 10, m.y - 44, "+ยาแดง", "#ff8a8a", 1.2, 12); }
    if (Math.random() < 0.12) { S.mpPot++; PW.text(m.x - 10, m.y - 52, "+ยาน้ำเงิน", "#8ab4ff", 1.2, 12); }
    const tierMap = { meadow: 1, forest: 2, desert: 3, ice: 4 }; const tier = D.boss ? 5 : tierMap[D.zone] + (Math.random() < 0.15 ? 1 : 0);
    if (D.boss || Math.random() < 0.07) {
      const slot = ["weapon", "armor", "charm"][U.ri(0, 2)]; const roll = Math.random(); const rar = D.boss ? 2 : roll < 0.75 ? 0 : roll < 0.95 ? 1 : 2;
      if (S.bag.length < 40) { const it = PW.makeItem(slot, Math.min(6, tier), rar); S.bag.push(it); PW.toast("ได้ไอเทม: " + it.name, 2800); PW.text(m.x, m.y - 64, it.name, PW.RARITY[rar].c, 1.6, 13); }
    }
    PW.updateHud && PW.updateHud(true);
  }
  function hurtHero(h, d, src) {
    if (h.dead) return; d = Math.max(1, Math.round(d));
    if (h.shield > 0) { const a = Math.min(h.shield, d); h.shield -= a; d -= a; PW.text(h.x, h.y - 24, "block", "#8ae8ff", 0.6, 11); }
    if (d <= 0) return; h.hp -= d; h.hurt = 0.15; PW.text(h.x, h.y - 24, "-" + d, h.isPlayer ? "#ff6a6a" : "#ffa0a0", 0.8, 13); if (h.isPlayer) { PW.sfx("hurt"); G.shake = 0.15; }
    if (h.hp <= 0) { h.hp = 0; h.dead = true; h.moving = false; if (h.isPlayer) PW.onPlayerDead(); else { h.reviveT = 14; PW.text(h.x, h.y - 30, "ล้มแล้ว!", "#fff", 1.2, 14); } }
  }
  function healHero(h, a) { if (h.dead) return; a = Math.round(a); h.hp = Math.min(h.maxHp, h.hp + a); PW.text(h.x, h.y - 28, "+" + a, "#7dff9b", 0.9, 13); }
  function shieldHero(h, a, dur) { h.shield = Math.max(h.shield, a); h.shieldT = dur; PW.ring(h.x, h.y, 26, "#8ae8ff", 0.5); }
  PW.healHero = healHero;

  // ---------------------------------------------------------------- projectiles
  function shoot(h, ang, o) {
    G.projs.push({ x: h.x + Math.cos(ang) * 16, y: h.y + Math.sin(ang) * 16, vx: Math.cos(ang) * (o.speed || 380), vy: Math.sin(ang) * (o.speed || 380), life: (o.range || 220) / (o.speed || 380), r: o.r || 6, mul: o.mul || 1, pierce: !!o.pierce, hits: new Set(), from: h, c: o.c || "#fff", slow: o.slow, stun: o.stun, size: o.size || 6, crit: o.crit, kind: o.kind || "orb", ang });
  }
  function updateProjs(dt) {
    for (const p of G.projs) {
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (PW.collides(G.W, p.x, p.y, 2) && !p.pierce) p.life = 0;
      for (const m of G.monsters) {
        if (m.dead || p.hits.has(m) || p.life <= 0) continue; if (Math.hypot(m.x - p.x, m.y - p.y) <= m.r + p.r) {
          p.hits.add(m); hit(p.from, m, p.mul, { slow: p.slow, stun: p.stun, crit: p.crit }); if (!p.pierce) p.life = 0;
        }
      }
      if (Math.random() < 0.5) G.parts.push({ x: p.x, y: p.y, vx: 0, vy: 0, t: 0.2, c: p.c });
    }
    G.projs = G.projs.filter((p) => p.life > 0);
  }

  // ---------------------------------------------------------------- basic attack
  PW.basicAttack = (h, m) => {
    const H = PW.HEROES[h.id]; if (h.atkT > 0 || h.stun > 0 || h.dead) return false;
    h.atkT = H.atkCd; h.face = U.ang(h, m); h.cast = 0.18;
    if (!H.ranged) { hit(h, m, 1.0); const a = h.face; PW.ring(h.x + Math.cos(a) * 26, h.y + Math.sin(a) * 26, 18, H.color, 0.2); }
    else shoot(h, h.face, { mul: 1.0, speed: 400, range: H.range + 60, r: 7, c: H.color, size: 5 });
    return true;
  };

  // ---------------------------------------------------------------- skills
  function frontPoint(h, d) { return { x: h.x + Math.cos(h.face) * d, y: h.y + Math.sin(h.face) * d }; }
  function target(h, range) { return nearestMonster(h, range, false); }
  function area(h, c, r, mul, o) { PW.ring(c.x, c.y, r, PW.HEROES[h.id].color, 0.45); for (const m of near(c.x, c.y, r)) hit(h, m, mul, o); }
  function partyIn(h, r) { return alive().filter((p) => Math.hypot(p.x - h.x, p.y - h.y) <= r); }
  const SK = {
    tank: [
      (h) => { PW.ring(h.x, h.y, 95, "#ffd34d", 0.5); for (const m of near(h.x, h.y, 95)) { hit(h, m, 1.0, { stun: 1.2 }); m.forceTarget = h; m.forceT = 3.5; } return true; },
      (h) => { for (const p of partyIn(h, 280)) shieldHero(p, (40 + h.def * 5 + h.maxHp * 0.18) * (p === h ? 1.4 : 1), 6); return true; },
      (h) => { const hitSet = new Set(); const a = h.face; for (let k = 0; k < 10; k++) { const nx = h.x + Math.cos(a) * 15, ny = h.y + Math.sin(a) * 15; if (PW.collides(G.W, nx, ny, h.r * 0.7)) break; h.x = nx; h.y = ny; for (const m of near(h.x, h.y, 28)) if (!hitSet.has(m)) { hitSet.add(m); hit(h, m, 2.2, { knock: 46 }); } if (k % 2 === 0) PW.part(h.x, h.y, "#ffd34d"); } PW.ring(h.x, h.y, 40, "#ffd34d", 0.4); return true; },
    ],
    fighter: [
      (h) => { const m = target(h, 80); if (!m) return false; h.face = U.ang(h, m); hit(h, m, 1.1); PW.later(0.14, () => !m.dead && hit(h, m, 1.1)); PW.ring(m.x, m.y, 24, "#f08a24", 0.3); return true; },
      (h) => { area(h, h, 90, 1.8, {}); return true; },
      (h) => { h.buff = { t: 8, atk: 1.4, spd: 1.2 }; healHero(h, h.maxHp * 0.12); PW.ring(h.x, h.y, 36, "#ff9a3c", 0.6); return true; },
    ],
    mage: [
      (h) => { const m = target(h, 280); if (m) h.face = U.ang(h, m); shoot(h, h.face, { mul: 1.8, speed: 420, range: 280, r: 10, c: "#9fe4ff", slow: 2.5, size: 9 }); return true; },
      (h) => { const m = target(h, 280); const c = m ? { x: m.x, y: m.y } : frontPoint(h, 130); area(h, c, 105, 2.3, { slow: 3 }); for (let i = 0; i < 16; i++) PW.part(c.x + U.rnd(-90, 90), c.y + U.rnd(-90, 90), "#dff4ff"); return true; },
      (h) => { const m = target(h, 320); if (m) h.face = U.ang(h, m); shoot(h, h.face, { mul: 5, speed: 560, range: 340, r: 24, c: "#cfe0ff", pierce: true, size: 18, kind: "beam" }); return true; },
    ],
    marksman: [
      (h) => { const m = target(h, 260); if (m) h.face = U.ang(h, m); for (const o of [-0.2, 0, 0.2]) shoot(h, h.face + o, { mul: 1.0, speed: 520, range: 260, r: 6, c: "#ffe066", size: 5, kind: "arrow" }); return true; },
      (h) => { const m = target(h, 280); if (m) h.face = U.ang(h, m); shoot(h, h.face, { mul: 2.4, speed: 640, range: 300, r: 10, c: "#fff27a", pierce: true, stun: 0.6, size: 8, kind: "arrow" }); return true; },
      (h) => { const m = target(h, 260); const c = m ? { x: m.x, y: m.y } : frontPoint(h, 140); PW.ring(c.x, c.y, 120, "#ffe066", 1.6); for (let k = 0; k < 4; k++) PW.later(0.4 * k, () => { for (const mm of near(c.x, c.y, 120)) hit(h, mm, 0.9); for (let i = 0; i < 6; i++) PW.part(c.x + U.rnd(-100, 100), c.y + U.rnd(-100, 100), "#ffe066"); }); return true; },
    ],
    assassin: [
      (h) => { const m = target(h, 230); if (!m) return false; const a = U.ang(h, m); const px = m.x + Math.cos(a) * (m.r + h.r + 4), py = m.y + Math.sin(a) * (m.r + h.r + 4); PW.ring(h.x, h.y, 24, "#a56bff", 0.3); if (!PW.collides(G.W, px, py, h.r * 0.7)) { h.x = px; h.y = py; } h.face = a + Math.PI; hit(h, m, 2.0, { crit: true }); PW.ring(h.x, h.y, 30, "#a56bff", 0.3); return true; },
      (h) => { for (let k = 0; k < 5; k++) PW.later(0.16 * k, () => { if (h.dead) return; PW.ring(h.x, h.y, 60, "#a56bff", 0.2); for (const m of near(h.x, h.y, 62)) hit(h, m, 0.7); }); return true; },
      (h) => { const m = target(h, 180); if (!m) return false; h.face = U.ang(h, m); const ex = m.hp < m.maxHp * 0.4; hit(h, m, ex ? 7 : 3.5, { crit: ex }); PW.ring(m.x, m.y, 36, "#a56bff", 0.4); if (ex) PW.text(m.x, m.y - 40, "EXECUTE!", "#c9a0ff", 1, 15); return true; },
    ],
    support: [
      (h) => { for (const p of partyIn(h, 250)) healHero(p, 30 + h.atk * 2.5 + p.maxHp * 0.12); PW.ring(h.x, h.y, 120, "#7dff9b", 0.6); return true; },
      (h) => { for (const p of partyIn(h, 280)) shieldHero(p, 25 + h.atk * 2 + p.maxHp * 0.1, 6); return true; },
      (h) => { area(h, h, 130, 2.0, {}); for (const p of partyIn(h, 200)) healHero(p, p.maxHp * 0.2); for (let i = 0; i < 14; i++) PW.part(h.x + U.rnd(-100, 100), h.y + U.rnd(-100, 100), "#ffc0dd"); return true; },
    ],
  };
  let lastVoice = -99;
  PW.castSkill = (h, i) => {
    const def = PW.HEROES[h.id].skills[i]; if (h.dead || h.cds[i] > 0 || h.stun > 0) return false;
    if (h.isPlayer && h.mp < def.mp) { PW.toast("มานาไม่พอ"); return false; }
    const ok = SK[h.id][i](h); if (ok === false) { if (h.isPlayer) PW.toast("ไม่มีเป้าหมายในระยะ"); return false; }
    h.cds[i] = def.cd; h.cast = 0.35; if (h.isPlayer) { h.mp -= def.mp; PW.sfx("skill"); if (G.t - lastVoice > 6) { lastVoice = G.t; PW.playVoice(h.id, 2); } }
    return true;
  };
  PW.usePotion = (kind) => {
    const h = G.hero, S = G.S; if (h.dead) return;
    if (kind === "hp") { if (S.hpPot <= 0) return PW.toast("ยาแดงหมด"); if (h.hp >= h.maxHp) return; S.hpPot--; healHero(h, h.maxHp * 0.45); PW.sfx("pot"); }
    else { if (S.mpPot <= 0) return PW.toast("ยาน้ำเงินหมด"); if (h.mp >= h.maxMp) return; S.mpPot--; h.mp = Math.min(h.maxMp, h.mp + h.maxMp * 0.5); PW.text(h.x, h.y - 28, "+MP", "#8ab4ff", 0.9, 13); PW.sfx("pot"); }
    PW.updateHud(true);
  };

  // ---------------------------------------------------------------- hero AI (allies + player auto-hunt)
  function aiWants(h, i, e) {
    const def = PW.HEROES[h.id].skills[i]; if (h.cds[i] > 0) return false;
    if (h.isPlayer && h.mp < def.mp) return false;
    if (def.type === "heal") return alive().some((p) => Math.hypot(p.x - h.x, p.y - h.y) < 260 && p.hp < p.maxHp * 0.6);
    if (def.type === "buff") {
      if (!nearestMonster(h, 230, false)) return false;
      if (h.id === "fighter") return h.buff.t <= 0;
      return alive().some((p) => p.shield <= 0 && Math.hypot(p.x - h.x, p.y - h.y) < 280);
    }
    const d = Math.hypot(e.x - h.x, e.y - h.y) - e.r; if (d > def.ai) return false;
    if (h.id === "assassin" && i === 2) return e.hp < e.maxHp * 0.5 || PW.MONSTERS[e.type].boss;
    if (h.id === "support" && i === 2) return near(h.x, h.y, 130).length >= 1;
    return true;
  }
  function heroAI(h, dt, leader) {
    const H = PW.HEROES[h.id]; let mx = 0, my = 0; let e = null;
    if (leader) { e = nearestMonster(h, 230, true); if (e && Math.hypot(e.x - leader.x, e.y - leader.y) > 380) e = null; }
    else e = nearestMonster(h, 640, true);
    if (e) {
      const d = Math.hypot(e.x - h.x, e.y - h.y) - e.r; const a = U.ang(h, e);
      if (H.ranged) { if (d > H.range * 0.85) { mx = Math.cos(a); my = Math.sin(a); } else if (d < 60) { mx = -Math.cos(a); my = -Math.sin(a); } }
      else if (d > H.range * 0.6) { mx = Math.cos(a); my = Math.sin(a); }
      for (let i = 0; i < 3; i++) if (aiWants(h, i, e)) { h.face = a; if (PW.castSkill(h, i)) break; }
      if (d <= H.range) PW.basicAttack(h, e);
    } else if (leader) {
      const off = h.idx === 0 ? -0.9 : 0.9; const tx = leader.x + Math.cos(leader.face + Math.PI + off) * 60, ty = leader.y + Math.sin(leader.face + Math.PI + off) * 60;
      const dx = tx - h.x, dy = ty - h.y; const d = Math.hypot(dx, dy); if (d > 70) { mx = dx / d; my = dy / d; }
      if (d > 700) { h.x = leader.x - 30; h.y = leader.y; }
      const inj = alive().find((p) => p.hp < p.maxHp * 0.6); if (inj && H.skills[0].type === "heal") PW.castSkill(h, 0);
    } else if (h.isPlayer) {
      const z = PW.ZONES.find((q) => q.id === pickHuntZone()); const tx = (z.rect[0] + z.rect[2] / 2) * T, ty = (z.rect[1] + z.rect[3] / 2) * T; const dx = tx - h.x, dy = ty - h.y, d = Math.hypot(dx, dy);
      if (d > 260) { mx = dx / d; my = dy / d; }
    }
    return { mx, my };
  }

  // ---------------------------------------------------------------- monster AI
  function updateMonster(m, dt) {
    if (m.dead) { m.respT -= dt; if (m.respT <= 0) { const p = G.hero; if (Math.hypot(m.hx - p.x, m.hy - p.y) > 160) PW.initMonster(m); else m.respT = 3; } return; }
    m.hurt = Math.max(0, m.hurt - dt); m.atkT -= dt;
    if (m.stun > 0) { m.stun -= dt; return; }
    const D = PW.MONSTERS[m.type]; const sl = m.slow > 0 ? 0.55 : 1; if (m.slow > 0) m.slow -= dt;
    let t = null;
    if (m.forceT > 0 && m.forceTarget && !m.forceTarget.dead) { t = m.forceTarget; m.forceT -= dt; }
    else {
      if (m.target && !m.target.dead && Math.hypot(m.target.x - m.x, m.target.y - m.y) < D.aggro * 1.8) t = m.target;
      else { let bd = D.aggro; m.target = null; for (const h of alive()) { const d = Math.hypot(h.x - m.x, h.y - m.y); if (d < bd) { bd = d; t = h; } } m.target = t; }
    }
    if (Math.hypot(m.x - m.hx, m.y - m.hy) > 560) { t = null; m.target = null; }
    if (!t) {
      const dh = Math.hypot(m.hx - m.x, m.hy - m.y);
      if (dh > 14) { tryMove(m, ((m.hx - m.x) / dh) * m.spd * 0.8 * dt, ((m.hy - m.y) / dh) * m.spd * 0.8 * dt); m.hp = Math.min(m.maxHp, m.hp + m.maxHp * 0.1 * dt); }
      else { m.wander -= dt; if (m.wander <= 0) { m.wander = U.rnd(1.5, 4); const a = Math.random() * 6.28; m.wx = Math.cos(a); m.wy = Math.sin(a); if (Math.random() < 0.4) { m.wx = 0; m.wy = 0; } } tryMove(m, m.wx * m.spd * 0.3 * dt, m.wy * m.spd * 0.3 * dt); if (Math.hypot(m.x - m.hx, m.y - m.hy) > 90) { m.wx = 0; m.wy = 0; m.hx = m.hx; } }
      return;
    }
    const dx = t.x - m.x, dy = t.y - m.y, d = Math.hypot(dx, dy), reach = m.r + t.r + 6; m.face = Math.atan2(dy, dx);
    if (d > reach) tryMove(m, (dx / d) * m.spd * sl * dt, (dy / d) * m.spd * sl * dt);
    else if (m.atkT <= 0) { m.atkT = D.boss ? 1.4 : 1.2; hurtHero(t, m.atk * U.rnd(0.85, 1.15) - t.def * 0.6, m); }
    if (D.boss) { m.spT -= dt; if (m.spT <= 0 && d < 320) { m.spT = 6; const bx = m.x, by = m.y; PW.ring(bx, by, 150, "#ff4d4d", 0.9); PW.text(bx, by - 50, "ระวัง!", "#ff6a6a", 1, 16); PW.later(0.9, () => { PW.ring(bx, by, 150, "#fff", 0.3); G.shake = 0.3; for (const h of alive()) if (Math.hypot(h.x - bx, h.y - by) < 150 + h.r) hurtHero(h, m.atk * 1.4 - h.def * 0.6, m); }); } }
  }

  // ---------------------------------------------------------------- main update
  PW.update = (dt) => {
    G.t += dt; const h = G.hero, S = G.S; S.played += dt;
    // timers
    for (const tm of G.timers) { tm.t -= dt; if (tm.t <= 0) tm.fn(); } G.timers = G.timers.filter((tm) => tm.t > 0);
    // player
    if (!h.dead) {
      h.atkT -= dt; h.hurt = Math.max(0, h.hurt - dt); h.cast = Math.max(0, h.cast - dt); for (let i = 0; i < 3; i++) h.cds[i] = Math.max(0, h.cds[i] - dt);
      if (h.stun > 0) h.stun -= dt; if (h.slow > 0) h.slow -= dt; if (h.buff.t > 0) h.buff.t -= dt; if (h.shieldT > 0) { h.shieldT -= dt; if (h.shieldT <= 0) h.shield = 0; }
      h.mp = Math.min(h.maxMp, h.mp + h.maxMp * 0.012 * dt); if (PW.zoneAt(h.x, h.y).safe) { h.hp = Math.min(h.maxHp, h.hp + h.maxHp * 0.08 * dt); h.mp = Math.min(h.maxMp, h.mp + h.maxMp * 0.08 * dt); } else h.hp = Math.min(h.maxHp, h.hp + h.maxHp * 0.004 * dt);
      const inp = G.input; const manual = Math.hypot(inp.x, inp.y) > 0.12;
      if (manual) { inp.manualT = 0.5; moveHero(h, inp.x, inp.y, dt); }
      else inp.manualT = Math.max(0, inp.manualT - dt);
      const H = PW.HEROES[h.id];
      if (!manual && G.autoHunt && inp.manualT <= 0 && !PW.zoneAt(h.x, h.y).safe) {
        const r = heroAI(h, dt, null); moveHero(h, r.mx, r.my, dt);
        if (h.hp < h.maxHp * 0.4 && S.hpPot > 0) PW.usePotion("hp"); if (h.mp < h.maxMp * 0.15 && S.mpPot > 0) PW.usePotion("mp");
      } else if (!manual && G.autoHunt && PW.zoneAt(h.x, h.y).safe) {
        // in town: walk out toward the nearest hunting zone entrance
        const zid = pickHuntZone(); const z = PW.ZONES.find((q) => q.id === zid); const tx = (z.rect[0] + z.rect[2] / 2) * T, ty = (z.rect[1] + z.rect[3] / 2) * T; const dx = tx - h.x, dy = ty - h.y, d = Math.hypot(dx, dy) || 1; moveHero(h, dx / d, dy / d, dt);
      } else if (S.settings.autoAtk) {
        const e = nearestMonster(h, H.range, false); if (e && !manual) { h.face = U.ang(h, e); PW.basicAttack(h, e); } else if (e && manual) PW.basicAttack(h, e);
      }
    } else h.moving = false;
    // allies
    G.allies.forEach((a, i) => {
      a.idx = i; if (a.dead) { a.reviveT -= dt; if (a.reviveT <= 0) { a.dead = false; a.hp = a.maxHp * 0.6; a.x = h.x; a.y = h.y; } return; }
      a.atkT -= dt; a.hurt = Math.max(0, a.hurt - dt); a.cast = Math.max(0, a.cast - dt); for (let k = 0; k < 3; k++) a.cds[k] = Math.max(0, a.cds[k] - dt);
      if (a.stun > 0) a.stun -= dt; if (a.slow > 0) a.slow -= dt; if (a.buff.t > 0) a.buff.t -= dt; if (a.shieldT > 0) { a.shieldT -= dt; if (a.shieldT <= 0) a.shield = 0; }
      a.hp = Math.min(a.maxHp, a.hp + a.maxHp * 0.01 * dt);
      if (h.dead) return; const r = heroAI(a, dt, h); moveHero(a, r.mx, r.my, dt);
    });
    for (const m of G.monsters) { if (m.dead || Math.abs(m.x - h.x) < 900 && Math.abs(m.y - h.y) < 700 || m.hp < m.maxHp) updateMonster(m, dt); else if (m.dead) updateMonster(m, dt); }
    updateProjs(dt);
    // fx
    for (const t of G.texts) { t.t -= dt; t.y -= 26 * dt; t.x += t.vx * dt; } G.texts = G.texts.filter((t) => t.t > 0);
    for (const r of G.rings) r.t -= dt; G.rings = G.rings.filter((r) => r.t > 0);
    for (const p of G.parts) { p.t -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 220 * dt; } G.parts = G.parts.filter((p) => p.t > 0); if (G.parts.length > 300) G.parts.splice(0, 100);
    G.shake = Math.max(0, G.shake - dt);
    // npc proximity
    let nn = null; for (const n of G.npcs) if (Math.hypot(n.x - h.x, n.y - h.y) < 70) nn = n; G.nearNpc = nn;
    // zone
    const z = PW.zoneAt(h.x, h.y); if (z.id !== G.lastZone) { G.lastZone = z.id; PW.showZone && PW.showZone(z); }
    // camera
    const k = Math.min(1, dt * 7); G.cam.x += (h.x - G.cam.x) * k; G.cam.y += (h.y - G.cam.y) * k;
    // autosave
    G.saveT = (G.saveT || 0) + dt; if (G.saveT > 8) { G.saveT = 0; PW.save(); }
  };
  function pickHuntZone() { const lv = G.hero.level; return lv >= 16 ? "ice" : lv >= 11 ? "desert" : lv >= 6 ? "forest" : "meadow"; }

  PW.onPlayerDead = () => { G.autoHunt = false; PW.showDeath && PW.showDeath(); };
  PW.revive = () => {
    const h = G.hero, S = G.S; const loss = Math.floor(S.gold * 0.1); S.gold -= loss; h.dead = false; h.hp = Math.round(h.maxHp * 0.5); h.mp = Math.round(h.maxMp * 0.5);
    h.x = G.W.spawn.x; h.y = G.W.spawn.y; h.shield = 0; h.stun = 0; for (const a of G.allies) { a.dead = false; a.hp = a.maxHp; a.x = h.x; a.y = h.y; }
    for (const m of G.monsters) { if (!m.dead && m.target) m.target = null; }
    PW.save(); PW.toast("ฟื้นขึ้นที่เมืองพิวร์ (เสียทอง " + loss + ")");
  };
  PW.pickHuntZone = pickHuntZone;
})();
