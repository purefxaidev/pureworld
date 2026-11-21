// v2 systems: skill upgrades + passive + ultimate, pets & tamed minions (companions), monster capture, ground loot.
(function () {
  const PW = window.PW, G = PW.G, U = PW.U;
  const cb = () => PW._cb;

  // ---------------------------------------------------------------- skills
  PW.skillLv = (i) => (G.S && G.S.skl ? G.S.skl[i] : 1);
  PW.skillCost = (h, i) => { const def = PW.HEROES[h.id].skills[i]; return Math.round(def.mp * (h.isPlayer && PW.skillLv(i) >= 5 ? 0.75 : 1)); };
  PW.skillReqLv = (cur) => cur * 3 - 1; // hero level needed to raise a skill from `cur` to cur+1
  PW.canUpSkill = (i) => { const S = G.S, cur = S.skl[i]; if (cur >= PW.SKILL_MAX) return "สูงสุดแล้ว"; if (S.sp < 1) return "แต้มสกิลไม่พอ"; if (G.hero.level < PW.skillReqLv(cur)) return "ต้องเลเวล " + PW.skillReqLv(cur); return ""; };
  PW.upSkill = (i) => { const why = PW.canUpSkill(i); if (why) { PW.toast(why); return false; } G.S.sp--; G.S.skl[i]++; const lv = G.S.skl[i]; PW.sfx("level"); PW.glow(G.hero, PW.HEROES[G.hero.id].color, 0.8); if (PW.SKILL_MILESTONE[lv]) PW.toast("ปลดล็อก" + PW.SKILL_MILESTONE[lv], 3500); PW.save(); return true; };
  PW.canPassive = () => { const S = G.S, P = PW.PASSIVES[G.hero.id]; if (S.passive) return "ปลดล็อกแล้ว"; if (G.hero.level < P.lv) return "ต้องเลเวล " + P.lv; if (S.sp < P.cost) return "ต้องใช้ " + P.cost + " แต้ม"; return ""; };
  PW.unlockPassive = () => { const why = PW.canPassive(); if (why) { PW.toast(why); return false; } G.S.sp -= PW.PASSIVES[G.hero.id].cost; G.S.passive = true; PW.calcStats(G.hero); PW.sfx("level"); PW.toast("ปลดล็อกพาสซีฟ: " + PW.PASSIVES[G.hero.id].n); PW.save(); return true; };
  PW.ultCost = () => (G.S.ult ? 2 : PW.ULT_COST);
  PW.ultReqLv = () => PW.ULT_LV + 5 * (G.S.ult ? G.S.ult : 0) - (G.S.ult ? 5 : 0);
  PW.canUlt = () => { const S = G.S; if (S.ult >= 5) return "สูงสุดแล้ว"; const req = S.ult ? PW.ULT_LV + 5 * S.ult : PW.ULT_LV; if (G.hero.level < req) return "ต้องเลเวล " + req; if (S.sp < PW.ultCost()) return "ต้องใช้ " + PW.ultCost() + " แต้ม"; return ""; };
  PW.upUlt = () => { const why = PW.canUlt(); if (why) { PW.toast(why); return false; } G.S.sp -= PW.ultCost(); G.S.ult++; PW.sfx("level"); PW.toast(G.S.ult === 1 ? "ปลดล็อกอัลติเมต: " + PW.ULTS[G.hero.id].n + "!" : "อัปเกรดอัลติเมต Lv " + G.S.ult); PW.updateUltBtn && PW.updateUltBtn(); PW.save(); return true; };
  PW.resetSkills = () => { const S = G.S; let back = (S.skl[0] - 1) + (S.skl[1] - 1) + (S.skl[2] - 1) + (S.passive ? PW.PASSIVES[G.hero.id].cost : 0) + (S.ult ? PW.ULT_COST + (S.ult - 1) * 2 : 0); S.skl = [1, 1, 1]; S.passive = false; S.ult = 0; S.sp += back; PW.calcStats(G.hero); PW.updateUltBtn && PW.updateUltBtn(); PW.save(); return back; };

  // stat mods: passive + companion bonuses (player only)
  PW.bonus = () => {
    const S = G.S, out = {}; if (!S || !S.pets) return out;
    for (const uid of [S.petOn, S.minionOn]) {
      const p = S.pets.find((q) => q.uid === uid); if (!p) continue; const D = p.kind === "pet" ? PW.PETS[p.sp] : PW.MINIONS[p.sp]; if (!D) continue;
      const sc = (1 + 0.04 * (p.lv - 1)) * PW.EVO[p.evo || 0].m; for (const k in D.bonus) out[k] = (out[k] || 0) + (k === "loot" ? D.bonus[k] : D.bonus[k] * sc);
    }
    return out;
  };
  PW.applyMods = (h) => {
    const B = PW.bonus(); h.atk *= 1 + (B.atk || 0); h.def *= 1 + (B.def || 0); h.maxHp = Math.round(h.maxHp * (1 + (B.hp || 0))); h.maxMp = Math.round(h.maxMp * (1 + (B.mp || 0))); h.crit += B.crit || 0; h.spd = Math.round(h.spd * (1 + (B.spd || 0)));
    if (G.S && G.S.passive) {
      const id = h.id;
      if (id === "tank") { h.maxHp = Math.round(h.maxHp * 1.15); h.def *= 1.15; }
      else if (id === "fighter") h.lifesteal = 0.08;
      else if (id === "mage") { h.skillDmg = 1.15; h.mpRegen = 0.02; }
      else if (id === "marksman") h.crit += 0.1;
      else if (id === "assassin") { h.spd = Math.round(h.spd * 1.12); h.critDmg = 0.3; }
      else if (id === "support") h.regenAura = true;
    }
  };

  // ---------------------------------------------------------------- ultimate
  PW.ultReady = () => { const S = G.S, h = G.hero; return S && S.ult > 0 && !h.dead && (h.ultCd || 0) <= 0 && h.mp >= PW.ULTS[h.id].mp; };
  PW.castUlt = (h) => {
    if (!PW.ultReady()) { if (G.S.ult > 0 && !G.autoHunt) PW.toast((h.ultCd || 0) > 0 ? "อัลติเมตยังคูลดาวน์" : "มานาไม่พอ"); return false; }
    const U2 = PW.ULTS[h.id], H = PW.HEROES[h.id], { hit, near, healHero, shieldHero, alive, tryMove } = cb(); const L = 1 + 0.25 * (G.S.ult - 1);
    h.mp -= U2.mp; h.ultCd = U2.cd; h.cast = 0.6; G.flash = { c: H.color, t: 0.35 }; G.shake = 0.35; PW.sfx("level"); PW.playVoice(h.id, 2);
    PW.text(h.x, h.y - 84, U2.n, "#fff4b8", 1.6, 20); PW.ring(h.x, h.y, 60, H.color, 0.6); PW.spark(h.x, h.y - 20, H.color, 24);
    const tgt = (r) => cb().nearestMonster(h, r, false);
    if (h.id === "tank") { PW.ring(h.x, h.y, 170, "#ffd34d", 0.8); for (const m of near(h.x, h.y, 170)) { hit(h, m, 3 * L, { stun: 2.5 }); m.forceTarget = h; m.forceT = 5; } for (const p of alive()) shieldHero(p, p.maxHp * 0.35 * L, 8); }
    else if (h.id === "fighter") { h.buff = { t: 10, atk: 1.6, spd: 1.3 }; for (let k = 0; k < 8; k++) PW.later(0.13 * k, () => { if (h.dead) return; G.slashes.push({ x: h.x, y: h.y - 14, a: k * 0.8, r: 80, c: "#ff9a3c", t: 0.22, dur: 0.22, flip: k % 2 }); for (const m of near(h.x, h.y, 115)) hit(h, m, 1.3 * L); }); }
    else if (h.id === "mage") { const m = tgt(340); const c = m ? { x: m.x, y: m.y } : { x: h.x + Math.cos(h.face) * 160, y: h.y + Math.sin(h.face) * 160 }; G.meteors.push({ x: c.x, y: c.y, t: 0.7, dur: 0.7, c: "#bfe6ff" }); PW.ring(c.x, c.y, 175, "#9fe4ff", 0.7); PW.later(0.7, () => { G.shake = 0.4; PW.ring(c.x, c.y, 175, "#ffffff", 0.5); PW.spark(c.x, c.y, "#dff4ff", 40); for (const mm of near(c.x, c.y, 175)) hit(h, mm, 7 * L, { slow: 4 }); }); }
    else if (h.id === "marksman") { const ms = near(h.x, h.y, 320).sort((a, b) => U.dist(a, h) - U.dist(b, h)).slice(0, 8); ms.forEach((m, k) => PW.later(0.07 * k, () => { if (m.dead) return; G.bolts.push({ x: m.x, y: m.y, t: 0.3, dur: 0.3 }); hit(h, m, 4 * L, { stun: 1.2 }); PW.spark(m.x, m.y - 20, "#fff27a", 12); })); }
    else if (h.id === "assassin") { const ms = near(h.x, h.y, 320).sort((a, b) => U.dist(a, h) - U.dist(b, h)).slice(0, 6); ms.forEach((m, k) => PW.later(0.13 * k, () => { if (m.dead || h.dead) return; const a = Math.random() * 6.28; const px = m.x + Math.cos(a) * (m.r + 18), py = m.y + Math.sin(a) * (m.r + 18); PW.spark(h.x, h.y - 20, "#a56bff", 8); if (!PW.collides(G.W, px, py, 10)) { h.x = px; h.y = py; } h.face = U.ang(h, m); hit(h, m, 3.5 * L, { crit: true }); G.slashes.push({ x: m.x, y: m.y - 14, a: a + 3.14, r: 44, c: "#c9a0ff", t: 0.2, dur: 0.2 }); })); }
    else if (h.id === "support") { for (const p of alive()) { healHero(p, p.maxHp * 0.6 * L); shieldHero(p, p.maxHp * 0.2 * L, 6); } PW.ring(h.x, h.y, 150, "#ffc0dd", 0.9); for (const m of near(h.x, h.y, 150)) hit(h, m, 3 * L); for (let i = 0; i < 30; i++) PW.part(h.x + U.rnd(-120, 120), h.y + U.rnd(-90, 60), "#ffd6ea"); }
    PW.updateHud && PW.updateHud(true); return true;
  };
  PW.skillFx = (h, i) => { const c = PW.HEROES[h.id].color; PW.spark(h.x, h.y - 24, c, h.isPlayer ? 10 : 4); if (h.isPlayer) PW.glow(h, c, 0.45); };

  // ---------------------------------------------------------------- companions (pets + tamed minions)
  PW.compDef = (p) => (p.kind === "pet" ? PW.PETS[p.sp] : PW.MINIONS[p.sp]);
  PW.compName = (p) => (PW.EVO[p.evo || 0].n ? PW.EVO[p.evo || 0].n + " " : "") + (p.kind === "pet" ? PW.PETS[p.sp].name : "สมุน" + PW.MONSTERS[p.sp].name);
  PW.compSprite = (p) => (p.kind === "pet" ? "pet_" : "tamed_") + p.sp;
  PW.addComp = (kind, sp, lv) => { const S = G.S; if (S.pets.length >= 40) { PW.toast("สมุดสมุนเต็ม (40)"); return null; } const p = { uid: S.nextId++, kind, sp, lv: lv || 1, xp: 0, evo: 0 }; S.pets.push(p); S.book[(kind === "pet" ? "pet_" : "mon_") + sp] = true; if (kind === "pet" && !S.petOn) S.petOn = p.uid; if (kind === "minion" && !S.minionOn) S.minionOn = p.uid; PW.syncComps(); PW.calcStats(G.hero); return p; };
  PW.hatchEgg = () => { const S = G.S; if (S.eggs <= 0) { PW.toast("ไม่มีไข่"); return null; } S.eggs--; const ids = Object.keys(PW.PETS); const unowned = ids.filter((id) => !S.pets.some((p) => p.kind === "pet" && p.sp === id)); const pool = unowned.length && Math.random() < 0.75 ? unowned : ids; const sp = pool[(Math.random() * pool.length) | 0]; const p = PW.addComp("pet", sp, 1); if (p) { PW.sfx("level"); PW.toast("ฟักไข่ได้ " + PW.PETS[sp].name + "! 🎉", 3200); PW.save(); } return p; };
  PW.setActiveComp = (uid) => { const S = G.S, p = S.pets.find((q) => q.uid === uid); if (!p) return; const key = p.kind === "pet" ? "petOn" : "minionOn"; S[key] = S[key] === uid ? null : uid; PW.syncComps(); PW.calcStats(G.hero); PW.save(); };
  PW.releaseComp = (uid) => { const S = G.S; const i = S.pets.findIndex((q) => q.uid === uid); if (i < 0) return; const p = S.pets[i]; S.pets.splice(i, 1); if (S.petOn === uid) S.petOn = null; if (S.minionOn === uid) S.minionOn = null; S.gold += 20 * p.lv; PW.syncComps(); PW.calcStats(G.hero); PW.save(); };
  function compGain(p, n) { if (p.lv >= PW.PET_MAXLV) return; p.xp += n; let up = 0; while (p.lv < PW.PET_MAXLV && p.xp >= PW.petXpNext(p.lv)) { p.xp -= PW.petXpNext(p.lv); p.lv++; up++; } if (up) { PW.toast(PW.compName(p) + " เลเวลอัป! Lv " + p.lv); const e = G.comps.find((c) => c.uid === p.uid); if (e) { PW.ring(e.x, e.y, 30, "#ffe066", 0.6); PW.spark(e.x, e.y - 14, "#ffe066", 10); } PW.calcStats(G.hero); } }
  PW.petXp = (n) => { const S = G.S; for (const uid of [S.petOn, S.minionOn]) { const p = S.pets.find((q) => q.uid === uid); if (p) compGain(p, n); } };
  PW.feedComp = (uid) => { const S = G.S, p = S.pets.find((q) => q.uid === uid); if (!p) return; if (S.treats <= 0) return PW.toast("ขนมหมด — ซื้อที่ร้านป้าพรม"); if (p.lv >= PW.PET_MAXLV) return PW.toast("เลเวลสูงสุดแล้ว"); S.treats--; compGain(p, Math.round(PW.petXpNext(p.lv) * 0.6)); PW.sfx("pot"); PW.save(); };
  PW.canEvolve = (p) => { const r = PW.EVO_REQ[p.evo || 0]; if (!r) return "วิวัฒนาการสูงสุดแล้ว"; if (p.lv < r.lv) return "ต้องเลเวล " + r.lv; if (G.S.gems < r.gem) return "ต้องใช้อัญมณี " + r.gem + " เม็ด"; return ""; };
  PW.evolveComp = (uid) => { const S = G.S, p = S.pets.find((q) => q.uid === uid); if (!p) return false; const why = PW.canEvolve(p); if (why) { PW.toast(why); return false; } S.gems -= PW.EVO_REQ[p.evo || 0].gem; p.evo = (p.evo || 0) + 1; PW.sfx("level"); PW.toast("วิวัฒนาการสำเร็จ! " + PW.compName(p) + " ✨", 3200); PW.syncComps(); const e = G.comps.find((c) => c.uid === p.uid); if (e) { PW.ring(e.x, e.y, 60, "#fff4b8", 1); PW.spark(e.x, e.y - 20, "#fff4b8", 30); } PW.calcStats(G.hero); PW.save(); return true; };
  PW.syncComps = () => {
    const S = G.S, h = G.hero; if (!S || !h) return; const want = [S.petOn, S.minionOn].filter(Boolean);
    G.comps = G.comps.filter((c) => want.includes(c.uid));
    for (const uid of want) if (!G.comps.some((c) => c.uid === uid)) { const p = S.pets.find((q) => q.uid === uid); if (p) G.comps.push({ uid, p, x: h.x - 20, y: h.y + 16, face: 0, atkT: 1, hop: Math.random() * 6, isComp: true, moving: false, tgt: null }); }
    for (const c of G.comps) c.p = S.pets.find((q) => q.uid === c.uid);
  };
  let seenT = 0;
  PW.updateComps = (dt) => {
    const h = G.hero, S = G.S; if (!h) return; h.ultCd = Math.max(0, (h.ultCd || 0) - dt);
    seenT -= dt; if (seenT <= 0) { seenT = 0.5; for (const m of G.monsters) if (!m.dead && Math.abs(m.x - h.x) < 320 && Math.abs(m.y - h.y) < 320) S.seen[m.type] = true; }
    G.comps.forEach((c, i) => {
      const p = c.p; if (!p) return; c.hop += dt * (c.moving ? 12 : 4); c.atkT -= dt;
      const pet = p.kind === "pet"; const range = pet ? 170 : 40; const evo = PW.EVO[p.evo || 0].m;
      let tgt = c.tgt && !c.tgt.dead && U.dist(c.tgt, h) < 300 ? c.tgt : null;
      if (!tgt && !h.dead) { let bd = 230; for (const m of G.monsters) { if (m.dead) continue; const d = U.dist(m, h); if (d < bd && (m.target || G.autoHunt || d < 140)) { bd = d; tgt = m; } } }
      c.tgt = tgt; let tx, ty;
      if (tgt) { const d = U.dist(c, tgt); if (d > range + tgt.r) { tx = tgt.x; ty = tgt.y; } else { tx = c.x; ty = c.y; c.face = U.ang(c, tgt); if (c.atkT <= 0) { c.atkT = pet ? 1.3 : 1.0; const dmg = Math.max(1, Math.round(h.atk * (pet ? 0.32 : 0.42) * (1 + 0.035 * (p.lv - 1)) * evo - tgt.def * 0.3)); const crit = Math.random() < 0.12; G.zaps.push({ x1: c.x, y1: c.y - 14, x2: tgt.x, y2: tgt.y - tgt.r, c: pet ? (PW.PETS[p.sp].color || "#fff") : "#ffd28a", t: 0.18, dur: 0.18, melee: !pet }); cb().damageMonster(tgt, crit ? dmg * 2 : dmg, G.hero, crit, {}); } } }
      else { const side = i === 0 ? -1 : 1; tx = h.x + side * 34 - Math.cos(h.face) * 22; ty = h.y + 18 - Math.sin(h.face) * 14; }
      const dx = tx - c.x, dy = ty - c.y, d = Math.hypot(dx, dy); c.moving = d > 8;
      if (d > 600) { c.x = h.x; c.y = h.y + 10; }
      else if (c.moving) { const sp = Math.min(d * 4, Math.max(150, h.spd * 1.25)); c.x += (dx / d) * sp * dt; c.y += (dy / d) * sp * dt; if (!tgt) c.face = Math.atan2(dy, dx); }
    });
  };

  // ---------------------------------------------------------------- capture (ผนึกวิญญาณ)
  PW.captureTarget = () => { const h = G.hero; let best = null, bp = 2; for (const m of G.monsters) { if (m.dead || U.dist(m, h) > 260) continue; const p = m.hp / m.maxHp; if (p < bp) { bp = p; best = m; } } return best; };
  PW.captureChance = (m) => { const hp = U.clamp(m.hp / m.maxHp, 0, 1); const lvm = U.clamp(1 - (m.lvl - G.hero.level) * 0.06, 0.3, 1.15); return U.clamp(0.95 * Math.pow(1 - hp, 1.35) * (PW.RARE[m.type] || 0.5) * lvm, 0.02, 0.95); };
  PW.captureRoll = () => Math.random();
  PW.throwCapture = () => {
    const S = G.S, h = G.hero; if (h.dead || G.paused) return false; if (S.crystals <= 0) { PW.toast("ผนึกวิญญาณหมด — ซื้อที่ร้านป้าพรม"); return false; }
    const m = PW.captureTarget(); if (!m) { PW.toast("ไม่มีมอนสเตอร์ใกล้ ๆ ให้จับ"); return false; }
    S.crystals--; const ch = PW.captureChance(m); h.face = U.ang(h, m); h.cast = 0.3;
    G.capFx.push({ x1: h.x, y1: h.y - 30, m, t: 0, dur: 0.45 }); PW.sfx("skill");
    PW.later(0.45, () => {
      if (m.dead) { PW.toast("เป้าหมายหายไปแล้ว"); return; }
      PW.ring(m.x, m.y, 40, "#7ff6ff", 0.6); PW.spark(m.x, m.y - m.r, "#7ff6ff", 18);
      if (PW.captureRoll() < ch) {
        m.dead = true; m.dieT = 0; m.captured = 0.8; m.respT = PW.MONSTERS[m.type].boss ? 120 : 14; m.target = null;
        const lv = Math.max(1, Math.min(m.lvl, h.level)); const p = PW.addComp("minion", m.type, lv);
        PW.gainXp(Math.round(m.xp * 0.5)); PW.sfx("level"); G.capFx.push({ x1: m.x, y1: m.y, m: null, t: 0, dur: 0.8, ok: true });
        if (p) PW.toast("จับ " + PW.MONSTERS[m.type].name + " สำเร็จ! ได้สมุนใหม่ (สมุดสมุน)", 3200);
        S.capOk = (S.capOk || 0) + 1;
      } else { PW.text(m.x, m.y - m.r * 2.4, "หลุด!", "#ff9a9a", 1, 16); PW.toast("ผนึกแตก! (โอกาส " + Math.round(ch * 100) + "%) — ตีให้เลือดน้อยลงก่อน"); m.target = h; S.capFail = (S.capFail || 0) + 1; }
      PW.updateHud && PW.updateHud(true); PW.save();
    });
    return true;
  };

  // ---------------------------------------------------------------- ground loot (magnet pickup)
  const LOOT_ICON = { gold: "item_gold", hpot: "item_hpot", mpot: "item_mpot", crystal: "item_crystal", egg: "item_egg", gem: "item_gem", treat: "item_treat", item: "item_chest" };
  PW.LOOT_ICON = LOOT_ICON;
  PW.drop = (x, y, kind, n, item) => { if (G.loot.length > 120) collect(G.loot.shift()); const a = Math.random() * 6.283, v = U.rnd(30, 90); G.loot.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6, z: 0, vz: U.rnd(140, 220), kind, n, item, age: 0, fly: false }); };
  function collect(l) {
    const S = G.S, h = G.hero; const tx = (s, c) => PW.text(h.x + U.rnd(-10, 10), h.y - 60, s, c, 1, 13);
    if (l.kind === "gold") { S.gold += l.n; tx("+" + l.n + " G", "#ffe066"); PW.sfx("coin"); }
    else if (l.kind === "hpot") { S.hpPot += l.n; tx("+ยาแดง", "#ff8a8a"); }
    else if (l.kind === "mpot") { S.mpPot += l.n; tx("+ยาน้ำเงิน", "#8ab4ff"); }
    else if (l.kind === "crystal") { S.crystals += l.n; tx("+ผนึกวิญญาณ " + l.n, "#7ff6ff"); }
    else if (l.kind === "egg") { S.eggs += l.n; tx("+ไข่สัตว์เลี้ยง!", "#ffd6ff"); PW.toast("ได้ไข่สัตว์เลี้ยง! ฟักได้ที่เมนู สัตว์เลี้ยง"); }
    else if (l.kind === "gem") { S.gems += l.n; tx("+อัญมณีวิวัฒนาการ!", "#d6a8ff"); }
    else if (l.kind === "treat") { S.treats += l.n; tx("+ขนมสัตว์เลี้ยง", "#ffd28a"); }
    else if (l.kind === "item") { if (S.bag.length < 40) { S.bag.push(l.item); PW.toast("ได้ไอเทม: " + l.item.name, 2600); tx(l.item.name, PW.RARITY[l.item.rar].c); } else { S.gold += Math.floor(l.item.val * 0.4); tx("กระเป๋าเต็ม → ขายอัตโนมัติ", "#ffe066"); } }
    PW.updateHud && PW.updateHud(true);
  }
  PW.nearestLoot = (h, r) => { let b = null, bd = r; for (const l of G.loot) { if (l.fly) continue; const d = Math.hypot(l.x - h.x, l.y - h.y); if (d < bd) { bd = d; b = l; } } return b; };
  PW.updateLoot = (dt) => {
    const h = G.hero; if (!h || h.dead) return; const B = PW.bonus(); const R = 70 + (B.loot || 0) + (G.S.petOn ? 50 : 0);
    for (const l of G.loot) {
      l.age += dt; if (l.z > 0 || l.vz > 0) { l.vz -= 600 * dt; l.z = Math.max(0, l.z + l.vz * dt); if (l.z === 0) { l.vz = l.vz < -60 ? -l.vz * 0.35 : 0; } l.x += l.vx * dt; l.y += l.vy * dt; l.vx *= 0.96; l.vy *= 0.96; }
      const d = Math.hypot(h.x - l.x, h.y - l.y);
      if (!l.fly && l.age > 0.45 && (d < R || l.age > 25)) l.fly = true;
      if (l.fly) { const sp = 260 + l.age * 40; l.x += (h.x - l.x) / (d || 1) * Math.min(d, sp * dt); l.y += (h.y - 10 - l.y) / (d || 1) * Math.min(d, sp * dt); if (d < 18) { l.done = true; collect(l); } }
    }
    G.loot = G.loot.filter((l) => !l.done);
  };
})();
