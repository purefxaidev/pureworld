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
  PW.AGGRO_CAP = 4; PW.AGGRO_CAP_ZONE = { meadow: 3, forest: 3, desert: 4, ice: 4 };
  PW.INVULN = 3; PW.RESPAWN_T = 28; PW.BOSS_RESPAWN_T = 120; PW.LEASH = 260; PW.BOSS_LEASH = 400; PW.RESPAWN_CLEAR = 300;
  PW.initMonster = (m) => {
    const D = PW.MONSTERS[m.type]; const lvl = U.ri(D.lv[0], D.lv[1]); const sc = 1 + 0.14 * (lvl - D.lv[0]);
    m.lvl = lvl; m.maxHp = Math.round(D.hp * sc); m.hp = m.maxHp; m.atk = Math.round(D.atk * sc); m.def = D.def * sc; m.spd = D.spd; m.xp = Math.round(D.xp * (1 + 0.1 * (lvl - D.lv[0]))); m.gold = D.gold;
    m.x = m.hx; m.y = m.hy; m.dead = false; m.target = null; m.forceTarget = null; m.forceT = 0; m.stun = 0; m.slow = 0; m.an = null; m.hurt = 0;
  };
  PW.aggroCap = () => { const z = G.hero ? PW.zoneAt(G.hero.x, G.hero.y).id : "meadow"; return PW.AGGRO_CAP_ZONE[z] || PW.AGGRO_CAP; };
  PW.aggroCount = () => { let n = 0; for (const m of G.monsters) if (!m.dead && m.target && !m.target.dead && !PW.MONSTERS[m.type].boss) n++; return n; };
  function claimAggro(m, src) {
    if (!src || src.dead) return; if (m.target === src) return;
    if (PW.MONSTERS[m.type].boss || PW.aggroCount() < PW.aggroCap()) { m.target = src; return; }
    let far = null, fd = -1;
    for (const x of G.monsters) { if (x === m || x.dead || !x.target || PW.MONSTERS[x.type].boss) continue; const d = Math.hypot(x.x - src.x, x.y - src.y); if (d > fd) { fd = d; far = x; } }
    if (far && fd > Math.hypot(m.x - src.x, m.y - src.y) + 30) { far.target = null; m.target = src; }
  }
  PW.claimAggro = claimAggro;
  PW.clearAggro = (snapHome) => {
    const sp = G.W && G.W.spawn; for (const m of G.monsters) {
      m.target = null; m.forceTarget = null; m.forceT = 0;
      if (snapHome && !m.dead && sp && (PW.zoneAt(m.x, m.y).safe || Math.hypot(m.x - sp.x, m.y - sp.y) < 280)) { m.x = m.hx; m.y = m.hy; }
    }
  };
  // skill context: while a player skill runs, damage/area/heal scale with its upgrade level (also inside delayed PW.later callbacks)
  let SKC = null; PW.skc = () => SKC;
  PW.later = (sec, fn) => { const ctx = SKC; G.timers.push({ t: sec, fn: ctx ? () => { const p = SKC; SKC = ctx; try { fn(); } finally { SKC = p; } } : fn }); };
  const _ring = PW.ring; PW.ring = (x, y, r, c, d) => _ring(x, y, SKC ? r * SKC.area : r, c, d);
  const alive = () => [G.hero].concat(G.allies).filter((h) => !h.dead);
  PW.party = alive;
  const near = (x, y, r) => { if (SKC) r *= SKC.area; return G.monsters.filter((m) => !m.dead && Math.hypot(m.x - x, m.y - y) <= r + m.r); };
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
    const crit = forceCrit || Math.random() < h.crit; if (crit) d *= 1.6 + (h.critDmg || 0) + (SKC && SKC.h === h && SKC.ms5 ? 0.4 : 0); return { d, crit };
  }
  function hit(h, m, mul, o) {
    o = o || {}; if (SKC && SKC.h === h) mul *= SKC.mul; const r = dmgOf(h, mul, o.crit); const d = Math.max(1, Math.round(r.d - m.def * 0.5));
    damageMonster(m, d, h, r.crit, o);
  }
  function damageMonster(m, d, src, crit, o) {
    if (m.dead) return; m.hp -= d; m.hurt = 0.12; if (!m.target || m.target.dead) claimAggro(m, src);
    if (o.stun) m.stun = Math.max(m.stun, o.stun); if (o.slow) m.slow = Math.max(m.slow, o.slow);
    if (o.knock) { const a = Math.atan2(m.y - src.y, m.x - src.x); tryMove(m, Math.cos(a) * o.knock, Math.sin(a) * o.knock); }
    PW.dmgText(m.x, m.y - m.r * 2.2, d, crit, src);
    if (src.isPlayer) { PW.sfx(crit ? "crit" : "hit"); if (src.lifesteal) src.hp = Math.min(src.maxHp, src.hp + d * src.lifesteal); }
    PW.spark(m.x, m.y - m.r, crit ? "#ffd23f" : (src.color || "#fff"), crit ? 9 : 5);
    if (m.hp <= 0) killMonster(m, src);
  }
  function killMonster(m, src) {
    PW.sfx("pop"); m.dead = true; m.dieT = 0.5; m.respT = PW.MONSTERS[m.type].boss ? PW.BOSS_RESPAWN_T : PW.RESPAWN_T; m.target = null; m.forceTarget = null; m.forceT = 0; const D = PW.MONSTERS[m.type]; const h = G.hero, S = G.S; const B = PW.bonus ? PW.bonus() : {};
    const pen = U.clamp(1 - (h.level - m.lvl - 4) * 0.12, 0.2, 1); const xp = Math.max(1, Math.round(m.xp * pen * (1 + (B.xp || 0)))); const gold = Math.round(m.gold * U.rnd(0.8, 1.4) * (1 + (B.gold || 0)));
    S.kills++; PW.text(m.x, m.y - 30, "+" + xp + " XP", "#9be7ff", 1.1, 13); PW.drop(m.x, m.y, "gold", gold);
    for (let i = 0; i < 14; i++) PW.part(m.x, m.y - m.r, D.color); PW.spark(m.x, m.y - m.r, "#fff", 10);
    PW.gainXp(xp); PW.petXp && PW.petXp(Math.ceil(xp * 0.6));
    if (Math.random() < (D.boss ? 1 : 0.06)) PW.drop(m.x, m.y, "crystal", D.boss ? 3 : 1);
    if (Math.random() < (D.boss ? 1 : 0.012)) PW.drop(m.x, m.y, "egg", 1);
    if (Math.random() < (D.boss ? 1 : 0.012)) PW.drop(m.x, m.y, "gem", 1);
    if (Math.random() < 0.04) PW.drop(m.x, m.y, "treat", 1);
    // quests
    const q = PW.QUESTS[S.qIdx]; if (q && q.m === m.type && S.qProg < q.n) { S.qProg++; if (S.qProg >= q.n) PW.toast("ภารกิจสำเร็จ! ไปกดรับรางวัลที่เมนู \"ภารกิจ\""); }
    // drops
    if (Math.random() < 0.22) PW.drop(m.x, m.y, "hpot", 1);
    if (Math.random() < 0.12) PW.drop(m.x, m.y, "mpot", 1);
    const tierMap = { meadow: 1, forest: 2, desert: 3, ice: 4 }; const tier = D.boss ? 5 : tierMap[D.zone] + (Math.random() < 0.15 ? 1 : 0);
    if (D.boss || Math.random() < 0.07) {
      const slot = ["weapon", "armor", "charm"][U.ri(0, 2)]; const roll = Math.random(); const rar = D.boss ? 2 : roll < 0.75 ? 0 : roll < 0.95 ? 1 : 2;
      const it = PW.makeItem(slot, Math.min(6, tier), rar); PW.drop(m.x, m.y, "item", 1, it);
    }
    PW.updateHud && PW.updateHud(true);
  }
  function hurtHero(h, d, src) {
    if (h.dead) return; if ((h.invuln || 0) > 0) return; d = Math.max(1, Math.round(d));
    if (h.shield > 0) { const a = Math.min(h.shield, d); h.shield -= a; d -= a; PW.text(h.x, h.y - 24, "block", "#8ae8ff", 0.6, 11); }
    if (d <= 0) return; h.hp -= d; h.hurt = 0.15; PW.text(h.x, h.y - 24, "-" + d, h.isPlayer ? "#ff6a6a" : "#ffa0a0", 0.8, 13); if (h.isPlayer) { PW.sfx("hurt"); G.shake = 0.15; }
    if (h.hp <= 0) { h.hp = 0; h.dead = true; h.deadAt = G.t; PW.sfx && PW.sfx("down"); h.moving = false; if (h.isPlayer) PW.onPlayerDead(); else { h.reviveT = 14; PW.text(h.x, h.y - 30, "ล้มแล้ว!", "#fff", 1.2, 14); } }
  }
  function healHero(h, a) { if (h.dead) return; if (SKC) a *= SKC.mul; a = Math.round(a); h.hp = Math.min(h.maxHp, h.hp + a); PW.text(h.x, h.y - 28, "+" + a, "#7dff9b", 0.9, 13); }
  function shieldHero(h, a, dur) { if (SKC) a *= SKC.mul; h.shield = Math.max(h.shield, a); h.shieldT = dur; PW.ring(h.x, h.y, 26, "#8ae8ff", 0.5); }
  PW.healHero = healHero;

  // ---------------------------------------------------------------- projectiles
  function shoot(h, ang, o) {
    if (SKC && SKC.h === h) o = Object.assign({}, o, { mul: (o.mul || 1) * SKC.mul, r: (o.r || 6) * Math.sqrt(SKC.area) });
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
    h.atkT = H.atkCd; h.face = U.ang(h, m); h.cast = 0.18; PW.setAnim(h, "attack", Math.min(0.34, H.atkCd * 0.8)); if (h.isPlayer) PW.sfx(!H.ranged ? "swing" : h.id === "marksman" ? "arrow" : "magic");
    if (!H.ranged) { hit(h, m, 1.0); const a = h.face; G.slashes.push({ x: h.x, y: h.y - 14, a, r: 34, c: H.color, t: 0.2, dur: 0.2, flip: Math.random() < 0.5 }); }
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
    const lv = h.isPlayer && PW.skillLv ? PW.skillLv(i) : 1; const cost = PW.skillCost(h, i);
    if (h.isPlayer && h.mp < cost) { if (!G.autoHunt) PW.toast("มานาไม่พอ"); return false; }
    const ctx = { h, mul: PW.skillMul(lv) * (h.skillDmg || 1), area: PW.skillAreaMul(lv), ms5: lv >= 5 };
    let ok; SKC = ctx; try { ok = SK[h.id][i](h); } finally { SKC = null; }
    if (ok === false) { if (h.isPlayer && !G.autoHunt) PW.toast("ไม่มีเป้าหมายในระยะ"); return false; }
    h.cds[i] = def.cd * PW.skillCdMul(lv); h.cast = 0.35; PW.setAnim(h, "cast", 0.5); PW.skillFx && PW.skillFx(h, i);
    if (h.isPlayer) { h.mp -= cost; PW.sfx("skill"); if (G.t - lastVoice > 6) { lastVoice = G.t; PW.playVoice(h.id, 2); } }
    if (h.isPlayer && lv >= 10) PW.later(0.55, () => { if (h.dead) return; const e = Object.assign({}, ctx, { mul: ctx.mul * 0.5 }); SKC = e; try { SK[h.id][i](h); } finally { SKC = null; } PW.text(h.x, h.y - 70, "ECHO!", "#9fe4ff", 0.8, 14); });
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
    if (h.isPlayer && h.mp < PW.skillCost(h, i)) return false;
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
      if (!h.isPlayer || G.S.settings.autoSkill !== false) { for (let i = 0; i < 3; i++) if (aiWants(h, i, e)) { h.face = a; if (PW.castSkill(h, i)) break; } if (h.isPlayer && PW.ultReady && PW.ultReady() && (near(h.x, h.y, 200).length >= 3 || PW.MONSTERS[e.type].boss || e.maxHp > h.atk * 25)) PW.castUlt(h); }
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
    if (m.dead) {
      m.respT -= dt; if (m.respT <= 0) {
        const p = G.hero, sp = G.W.spawn, D = PW.MONSTERS[m.type];
        const tooClose = Math.hypot(m.hx - p.x, m.hy - p.y) < PW.RESPAWN_CLEAR || Math.hypot(m.hx - sp.x, m.hy - sp.y) < 240 || PW.zoneAt(m.hx, m.hy).safe;
        const liveNear = G.monsters.filter((x) => !x.dead && PW.MONSTERS[x.type].zone === D.zone && Math.hypot(x.x - p.x, x.y - p.y) < 440).length;
        const capNear = D.zone === "meadow" ? 6 : D.zone === "forest" ? 7 : 8;
        if (tooClose || liveNear >= capNear) { m.respT = 6; return; }
        PW.initMonster(m);
      }
      return;
    }
    m.hurt = Math.max(0, m.hurt - dt); m.atkT -= dt;
    if (m.stun > 0) { m.stun -= dt; return; }
    const D = PW.MONSTERS[m.type]; const sl = m.slow > 0 ? 0.55 : 1; if (m.slow > 0) m.slow -= dt;
    let t = null;
    if (m.forceT > 0 && m.forceTarget && !m.forceTarget.dead) { t = m.forceTarget; m.forceT -= dt; }
    else if (m.target && !m.target.dead && Math.hypot(m.target.x - m.x, m.target.y - m.y) < D.aggro * 1.35) t = m.target;
    else {
      m.target = null; let bd = D.aggro, cand = null;
      for (const h of alive()) { const d = Math.hypot(h.x - m.x, h.y - m.y); if (d < bd) { bd = d; cand = h; } }
      if (cand) {
        if (D.boss || PW.aggroCount() < PW.aggroCap()) { t = cand; m.target = cand; }
        else t = null;
      }
    }
    const leash = D.boss ? PW.BOSS_LEASH : PW.LEASH;
    if (Math.hypot(m.x - m.hx, m.y - m.hy) > leash) { t = null; m.target = null; }
    if (t && (PW.zoneAt(m.x, m.y).safe || PW.zoneAt(t.x, t.y).safe || (t.invuln || 0) > 0)) { t = null; m.target = null; }
    if (!t) {
      const dh = Math.hypot(m.hx - m.x, m.hy - m.y);
      if (dh > 14) { tryMove(m, ((m.hx - m.x) / dh) * m.spd * 0.8 * dt, ((m.hy - m.y) / dh) * m.spd * 0.8 * dt); m.hp = Math.min(m.maxHp, m.hp + m.maxHp * 0.1 * dt); }
      else { m.wander -= dt; if (m.wander <= 0) { m.wander = U.rnd(1.5, 4); const a = Math.random() * 6.28; m.wx = Math.cos(a); m.wy = Math.sin(a); if (Math.random() < 0.4) { m.wx = 0; m.wy = 0; } } tryMove(m, m.wx * m.spd * 0.3 * dt, m.wy * m.spd * 0.3 * dt); if (Math.hypot(m.x - m.hx, m.y - m.hy) > 90) { m.wx = 0; m.wy = 0; m.hx = m.hx; } }
      return;
    }
    const dx = t.x - m.x, dy = t.y - m.y, d = Math.hypot(dx, dy), reach = m.r + t.r + 6; m.face = Math.atan2(dy, dx);
    if (d > reach) tryMove(m, (dx / d) * m.spd * sl * dt, (dy / d) * m.spd * sl * dt);
    else if (m.atkT <= 0) { m.atkT = D.boss ? 1.4 : 1.2; PW.setAnim(m, "attack", D.boss ? 0.55 : 0.4); hurtHero(t, m.atk * U.rnd(0.85, 1.15) - t.def * 0.6, m); }
    if (D.boss) { m.spT -= dt; if (m.spT <= 0 && d < 320) { m.spT = 6; PW.setAnim(m, "attack", 0.9); PW.sfx && PW.sfx("boss"); const bx = m.x, by = m.y; PW.ring(bx, by, 150, "#ff4d4d", 0.9); PW.text(bx, by - 50, "ระวัง!", "#ff6a6a", 1, 16); PW.later(0.9, () => { PW.ring(bx, by, 150, "#fff", 0.3); G.shake = 0.3; for (const h of alive()) if (Math.hypot(h.x - bx, h.y - by) < 150 + h.r) hurtHero(h, m.atk * 1.4 - h.def * 0.6, m); }); } }
  }

  // ---------------------------------------------------------------- main update
  PW.update = (dt) => {
    G.t += dt; const h = G.hero, S = G.S; S.played += dt;
    // timers
    for (const tm of G.timers) { tm.t -= dt; if (tm.t <= 0) tm.fn(); } G.timers = G.timers.filter((tm) => tm.t > 0);
    // player
    if (!h.dead) {
      h.atkT -= dt; h.hurt = Math.max(0, h.hurt - dt); h.cast = Math.max(0, h.cast - dt); if (h.invuln > 0) h.invuln = Math.max(0, h.invuln - dt); for (let i = 0; i < 3; i++) h.cds[i] = Math.max(0, h.cds[i] - dt);
      if (h.stun > 0) h.stun -= dt; if (h.slow > 0) h.slow -= dt; if (h.buff.t > 0) h.buff.t -= dt; if (h.shieldT > 0) { h.shieldT -= dt; if (h.shieldT <= 0) h.shield = 0; }
      h.mp = Math.min(h.maxMp, h.mp + h.maxMp * 0.012 * dt); if (PW.zoneAt(h.x, h.y).safe) { h.hp = Math.min(h.maxHp, h.hp + h.maxHp * 0.08 * dt); h.mp = Math.min(h.maxMp, h.mp + h.maxMp * 0.08 * dt); } else h.hp = Math.min(h.maxHp, h.hp + h.maxHp * 0.004 * dt);
      PW.playerControl(h, dt, S);
    } else h.moving = false;
    // allies
    G.allies.forEach((a, i) => {
      a.idx = i; if (a.dead) { a.reviveT -= dt; if (a.reviveT <= 0) { a.dead = false; a.hp = a.maxHp * 0.6; a.x = h.x; a.y = h.y; } return; }
      a.atkT -= dt; a.hurt = Math.max(0, a.hurt - dt); a.cast = Math.max(0, a.cast - dt); for (let k = 0; k < 3; k++) a.cds[k] = Math.max(0, a.cds[k] - dt);
      if (a.stun > 0) a.stun -= dt; if (a.slow > 0) a.slow -= dt; if (a.buff.t > 0) a.buff.t -= dt; if (a.shieldT > 0) { a.shieldT -= dt; if (a.shieldT <= 0) a.shield = 0; }
      a.hp = Math.min(a.maxHp, a.hp + a.maxHp * 0.01 * dt);
      if (h.dead) return; const r = heroAI(a, dt, h); moveHero(a, r.mx, r.my, dt);
    });
    for (const m of G.monsters) { if (m.dead || m.hp < m.maxHp || m.target || (Math.abs(m.x - h.x) < 900 && Math.abs(m.y - h.y) < 700)) updateMonster(m, dt); }
    updateProjs(dt); PW.updateComps && PW.updateComps(dt); PW.updateLoot && PW.updateLoot(dt);
    for (const m of G.monsters) if (m.dead && m.dieT > 0) m.dieT -= dt;
    for (const sl of G.slashes) sl.t -= dt; G.slashes = G.slashes.filter((q) => q.t > 0);
    for (const k of ["meteors", "bolts", "zaps", "glows"]) { const L = G[k]; for (const q of L) q.t -= dt; G[k] = L.filter((q) => q.t > 0); }
    for (const q of G.capFx) q.t += dt; G.capFx = G.capFx.filter((q) => q.t < q.dur); if (G.flash) { G.flash.t -= dt; if (G.flash.t <= 0) G.flash = null; }
    for (const m of G.monsters) if (m.captured > 0) m.captured -= dt;
    if (h.regenAura) for (const p of alive()) p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.015 * dt);
    if (h.mpRegen) h.mp = Math.min(h.maxMp, h.mp + h.maxMp * h.mpRegen * dt);
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
    const lead = h.moving ? 38 : 0; const k = Math.min(1, dt * 5); G.cam.x += (h.x + Math.cos(h.face) * lead - G.cam.x) * k; G.cam.y += (h.y + Math.sin(h.face) * lead * 0.7 - G.cam.y) * k;
    // autosave
    G.saveT = (G.saveT || 0) + dt; if (G.saveT > 8) { G.saveT = 0; PW.save(); }
  };
  function pickHuntZone() { const lv = G.hero.level; return lv >= 16 ? "ice" : lv >= 11 ? "desert" : lv >= 6 ? "forest" : "meadow"; }

  PW.onPlayerDead = () => {
    const h = G.hero, S = G.S, wasAuto = !!G.autoHunt;
    G.moveTo = null; G.huntTarget = null; G.capTarget = null; G.timers = [];
    h.moving = false; h.cast = 0; h.an = null; h._path = null; h.stun = 0;
    G.input.x = 0; G.input.y = 0; PW.resetControls && PW.resetControls();
    if (wasAuto) { G.autoHunt = false; S.auto = false; }
    PW.clearAggro(false);
    PW.showDeath && PW.showDeath(wasAuto);
    // persist a safe town snapshot so a crash/reload mid-death doesn't drop the player back into the pack
    const ox = h.x, oy = h.y, oh = h.hp, om = h.mp;
    h.x = G.W.spawn.x; h.y = G.W.spawn.y; h.hp = h.maxHp; h.mp = h.maxMp; PW.save();
    h.x = ox; h.y = oy; h.hp = oh; h.mp = om;
  };
  PW.revive = () => {
    const h = G.hero, S = G.S; const loss = Math.floor(S.gold * 0.1); S.gold -= loss;
    h.dead = false; delete h.deadAt; h.an = null; h.cast = 0; h.hurt = 0; h.moving = false; h._path = null;
    h.hp = h.maxHp; h.mp = h.maxMp; h.shield = 0; h.stun = 0; h.slow = 0; h.invuln = PW.INVULN;
    h.x = G.W.spawn.x; h.y = G.W.spawn.y; G.cam.x = h.x; G.cam.y = h.y;
    G.moveTo = null; G.huntTarget = null; G.capTarget = null; G.input.x = 0; G.input.y = 0; G.timers = [];
    PW.resetControls && PW.resetControls();
    for (const a of G.allies) { a.dead = false; delete a.deadAt; a.an = null; a.hp = a.maxHp; a.mp = a.maxMp; a.x = h.x + 24; a.y = h.y + 18; a.invuln = PW.INVULN; a.moving = false; }
    PW.clearAggro(true); PW.syncComps && PW.syncComps();
    if (G.comps) for (const c of G.comps) { c.x = h.x - 20; c.y = h.y + 16; c.tgt = null; }
    G.paused = false; G.panel = null;
    PW.save(); PW.updateHud && PW.updateHud(true);
    PW.toast("ฟื้นขึ้นที่เมืองพิวร์ (เลือดเต็ม · ทองเสีย " + loss + (S.auto === false ? " · AUTO พักไว้" : "") + ")");
    PW.fade && PW.fade("#000", 1, 1000);
  };
  PW.pickHuntZone = pickHuntZone;

  // ---------------------------------------------------------------- player control: joystick/keys > tap-to-move > auto-farm > auto-attack

  // ---------------------------------------------------------------- grid pathfinding (BFS, 8-way, no corner cutting)
  const MW = 80, MH = 56;
  function walkGrid() {
    const W = G.W; if (W.walk) return W.walk; const g = new Uint8Array(MW * MH);
    for (let j = 0; j < MH; j++) for (let i = 0; i < MW; i++) g[j * MW + i] = PW.collides(W, (i + 0.5) * T, (j + 0.5) * T, 9) ? 0 : 1;
    W.walk = g; return g;
  }
  PW.findPath = (sx, sy, tx, ty) => {
    const g = walkGrid(); const cl = (v, m) => Math.max(0, Math.min(m - 1, v));
    let si = cl(Math.floor(sx / T), MW), sj = cl(Math.floor(sy / T), MH), ti = cl(Math.floor(tx / T), MW), tj = cl(Math.floor(ty / T), MH);
    const prev = new Int32Array(MW * MH).fill(-1), start = sj * MW + si, goal = tj * MW + ti; prev[start] = start;
    const q = new Int32Array(MW * MH); let qh = 0, qt = 0; q[qt++] = start; let best = start, bd = 1e9;
    const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    while (qh < qt) {
      const cur = q[qh++]; const ci = cur % MW, cj = (cur / MW) | 0; const dd = Math.abs(ci - ti) + Math.abs(cj - tj); if (dd < bd) { bd = dd; best = cur; } if (cur === goal) break;
      for (const [di, dj] of DIRS) {
        const ni = ci + di, nj = cj + dj; if (ni < 0 || nj < 0 || ni >= MW || nj >= MH) continue; const n = nj * MW + ni; if (prev[n] >= 0 || !g[n]) continue;
        if (di && dj && (!g[cj * MW + ni] || !g[nj * MW + ci])) continue; prev[n] = cur; q[qt++] = n;
      }
    }
    const end = prev[goal] >= 0 ? goal : best; const pts = []; let c = end; while (c !== start) { pts.push({ x: (c % MW + 0.5) * T, y: (((c / MW) | 0) + 0.5) * T }); c = prev[c]; if (c < 0) break; }
    pts.reverse(); if (end === goal) pts.push({ x: tx, y: ty });
    // string-pull: drop waypoints that are directly reachable
    const clear = (a, b) => { const d = Math.hypot(b.x - a.x, b.y - a.y), n = Math.ceil(d / 10); for (let k = 1; k < n; k++) { const x = a.x + (b.x - a.x) * k / n, y = a.y + (b.y - a.y) * k / n; if (PW.collides(G.W, x, y, 11)) return false; } return true; };
    const out = []; let a = { x: sx, y: sy }, i = 0; while (i < pts.length) { let j = pts.length - 1; while (j > i && !clear(a, pts[j])) j--; out.push(pts[j]); a = pts[j]; i = j + 1; }
    return out;
  };
  // walk h toward (tx,ty) along a cached path; returns remaining distance
  function pathTo(h, tx, ty, dt) {
    const P = h._path; const key = Math.round(tx / T) + "," + Math.round(ty / T);
    if (!P || P.key !== key || G.t > P.t + 4 || P.stuck > 0.5) h._path = { key, t: G.t, pts: PW.findPath(h.x, h.y, tx, ty), stuck: 0 };
    const pp = h._path; while (pp.pts.length && Math.hypot(pp.pts[0].x - h.x, pp.pts[0].y - h.y) < 8) pp.pts.shift();
    const wp = pp.pts[0] || { x: tx, y: ty }; const dx = wp.x - h.x, dy = wp.y - h.y, d = Math.hypot(dx, dy) || 1; const ox = h.x, oy = h.y;
    moveHero(h, dx / d, dy / d, dt); if (Math.hypot(h.x - ox, h.y - oy) < 0.1) pp.stuck += dt; else pp.stuck = 0;
    return Math.hypot(tx - h.x, ty - h.y);
  }
  PW.pathTo = pathTo;
  PW.playerControl = (h, dt, S) => {
    const inp = G.input, H = PW.HEROES[h.id]; const manual = Math.hypot(inp.x, inp.y) > 0.12;
    if (manual) { inp.manualT = 1.2; G.moveTo = null; moveHero(h, inp.x, inp.y, dt); }
    else inp.manualT = Math.max(0, inp.manualT - dt);
    h.potT = Math.max(0, (h.potT || 0) - dt);
    if (G.autoHunt && h.potT <= 0) { const pp = (S.settings.potPct || 40) / 100; if (h.hp < h.maxHp * pp && S.hpPot > 0) { PW.usePotion("hp"); h.potT = 1.2; } else if (h.mp < h.maxMp * 0.15 && S.mpPot > 0) { PW.usePotion("mp"); h.potT = 1.2; } }
    if (!manual && G.moveTo) {
      const mt = G.moveTo; let tx = mt.x, ty = mt.y;
      if (mt.m) { if (mt.m.dead) { G.moveTo = null; return; } tx = mt.m.x; ty = mt.m.y; }
      const dx = tx - h.x, dy = ty - h.y, d = Math.hypot(dx, dy); const stop = mt.m ? H.range * 0.85 + mt.m.r : mt.npc ? 56 : 6;
      if (d > stop) { const ox = h.x, oy = h.y; pathTo(h, tx, ty, dt); if (Math.hypot(h.x - ox, h.y - oy) < 0.15) { mt.stuck = (mt.stuck || 0) + dt; if (mt.stuck > 1.5) { G.moveTo = null; h.moving = false; } } else mt.stuck = 0; }
      else if (mt.m) { h.moving = false; h.face = U.ang(h, mt.m); PW.basicAttack(h, mt.m); }
      else { h.moving = false; const npc = mt.npc; G.moveTo = null; if (npc && PW.onReachNpc) PW.onReachNpc(npc); }
      if (S.settings.autoAtk && !mt.m) { const e = nearestMonster(h, H.range, false); if (e) PW.basicAttack(h, e); }
      return;
    }
    if (!manual && G.autoHunt && inp.manualT <= 0) return autoFarm(h, dt, S, H);
    if (S.settings.autoAtk) { const e = nearestMonster(h, H.range, false); if (e && !manual) { h.face = U.ang(h, e); PW.basicAttack(h, e); } else if (e && manual) PW.basicAttack(h, e); }
  };
  function autoFarm(h, dt, S, H) {
    const retreat = (S.settings.retreatPct == null ? 30 : S.settings.retreatPct) / 100;
    const z = PW.zoneAt(h.x, h.y);
    if (retreat > 0 && h.hp < h.maxHp * retreat && !z.safe) {
      G.huntTarget = null; pathTo(h, G.W.spawn.x, G.W.spawn.y, dt); return;
    }
    if (z.safe && retreat > 0 && h.hp < h.maxHp * Math.max(retreat + 0.25, 0.55)) { h.moving = false; return; }
    const lt = PW.nearestLoot ? PW.nearestLoot(h, 240) : null;
    let e = G.huntTarget;
    if (!e || e.dead || Math.hypot(e.x - h.x, e.y - h.y) > 520) e = (G.huntTarget = nearestMonster(h, 640, true));
    if (lt && !e) { const dx = lt.x - h.x, dy = lt.y - h.y, d = Math.hypot(dx, dy) || 1; moveHero(h, dx / d, dy / d, dt); return; }
    const hz = pickHuntZone();
    if (z.safe || (z.id !== hz && !e)) {
      const zz = PW.ZONES.find((q) => q.id === hz); pathTo(h, (zz.rect[0] + zz.rect[2] / 2) * T, (zz.rect[1] + zz.rect[3] / 2) * T, dt);
      return;
    }
    // stick to one target: move/attack only that monster (heroAI would retarget the nearest every frame and pull a pack)
    const locked = e;
    if (locked && !locked.dead) {
      const d = Math.hypot(locked.x - h.x, locked.y - h.y) - locked.r, a = U.ang(h, locked);
      if (d > H.range * (H.ranged ? 0.85 : 0.6)) moveHero(h, Math.cos(a), Math.sin(a), dt);
      else if (H.ranged && d < 60) moveHero(h, -Math.cos(a), -Math.sin(a), dt);
      else { h.moving = false; h.face = a; }
      if (!h.isPlayer || S.settings.autoSkill !== false) { for (let i = 0; i < 3; i++) if (aiWants(h, i, locked)) { h.face = a; if (PW.castSkill(h, i)) break; } }
      if (d <= H.range) PW.basicAttack(h, locked);
      return;
    }
    const r = heroAI(h, dt, null); moveHero(h, r.mx, r.my, dt);
  }
  PW._cb = { hit, near, shoot, healHero, shieldHero, tryMove, nearestMonster, moveHero, alive, damageMonster, hurtHero };
})();
