// Core state, save/load, audio, items, stats, leveling.
(function () {
  const PW = (window.PW = window.PW || {});
  const U = (PW.U = {
    dist: (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
    ang: (a, b) => Math.atan2(b.y - a.y, b.x - a.x),
    clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
    rnd: (a, b) => a + Math.random() * (b - a),
    ri: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
    fmt: (n) => Math.round(n).toLocaleString("en-US"),
  });
  const G = (PW.G = {
    W: null, hero: null, allies: [], monsters: [], npcs: [], projs: [], texts: [], rings: [], parts: [], timers: [],
    cam: { x: 0, y: 0 }, t: 0, S: null, input: { x: 0, y: 0, manualT: 0 }, keys: {}, paused: true, running: false,
    autoHunt: false, lastZone: "", imgs: {}, voiceT: 0, shake: 0, panel: null, nearNpc: null,
  });
  const SAVE_KEY = "pureworld_save_v1";
  PW.SAVE_KEY = SAVE_KEY;

  // ---------------------------------------------------------------- save / load
  PW.newSave = (heroId) => ({
    v: 1, heroId, level: 1, xp: 0, gold: 100, hpPot: 5, mpPot: 3, x: 0, y: 0, hp: 0, mp: 0,
    bag: [], eq: { weapon: null, armor: null, charm: null }, qIdx: 0, qProg: 0, party: [], kills: 0,
    settings: { sound: true, autoAtk: true }, played: 0, created: Date.now(), nextId: 1,
  });
  PW.loadSave = () => { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY) || "null"); if (s && s.v === 1 && PW.HEROES[s.heroId]) return s; } catch (e) { /* */ } return null; };
  PW.save = () => {
    const S = G.S, h = G.hero; if (!S || !h) return;
    S.level = h.level; S.xp = h.xp; S.hp = Math.round(h.hp); S.mp = Math.round(h.mp); S.x = Math.round(h.x); S.y = Math.round(h.y);
    S.party = G.allies.map((a) => a.id); S.auto = G.autoHunt;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* storage full/blocked */ }
  };
  PW.wipeSave = () => { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* */ } };

  // ---------------------------------------------------------------- audio
  let ac = null;
  PW.audioUnlock = () => { try { if (!ac) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) ac = new AC(); } if (ac && ac.state === "suspended") ac.resume(); } catch (e) { /* */ } };
  const soundOn = () => !G.S || G.S.settings.sound !== false;
  function tone(f, d, type, vol, slide, delay) {
    if (!ac || !soundOn()) return; const t0 = ac.currentTime + (delay || 0);
    const o = ac.createOscillator(), g = ac.createGain(); o.type = type || "sine"; o.frequency.setValueAtTime(f, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f * slide), t0 + d);
    g.gain.setValueAtTime(vol || 0.08, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d); o.connect(g); g.connect(ac.destination); o.start(t0); o.stop(t0 + d + 0.02);
  }
  PW.sfx = (k) => {
    if (!ac) return;
    if (k === "hit") tone(180 + Math.random() * 60, 0.08, "square", 0.04, 0.5);
    else if (k === "hurt") tone(120, 0.14, "sawtooth", 0.05, 0.5);
    else if (k === "skill") { tone(300, 0.25, "triangle", 0.07, 2.2); }
    else if (k === "coin") { tone(880, 0.08, "square", 0.04); tone(1320, 0.1, "square", 0.04, 1, 0.06); }
    else if (k === "level") { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, "triangle", 0.09, 1, i * 0.1)); }
    else if (k === "pot") tone(500, 0.2, "sine", 0.08, 1.8);
    else if (k === "click") tone(660, 0.05, "square", 0.03);
  };
  const vcache = {}; let curVoice = null;
  PW.playVoice = (heroId, n) => {
    if (!soundOn()) return;
    try {
      const k = heroId + "_" + n; if (!vcache[k]) { vcache[k] = new Audio("assets/audio/" + k + ".mp3"); vcache[k].preload = "auto"; }
      if (curVoice && curVoice !== vcache[k]) { curVoice.pause(); curVoice.currentTime = 0; }
      curVoice = vcache[k]; curVoice.currentTime = 0; const p = curVoice.play(); if (p && p.catch) p.catch(() => {});
    } catch (e) { /* */ }
  };

  // ---------------------------------------------------------------- items
  PW.makeItem = (slot, tier, rar) => {
    const m = PW.RARITY[rar].m, S = G.S;
    const it = { id: S ? S.nextId++ : Math.random(), slot, tier, rar, atk: 0, def: 0, hp: 0, crit: 0 };
    if (slot === "weapon") { it.atk = Math.round((5 + tier * 5.5) * m); it.crit = rar >= 1 ? 0.01 * tier : 0; }
    else if (slot === "armor") { it.def = Math.round((3 + tier * 3.5) * m); it.hp = Math.round((10 + tier * 16) * m); }
    else { it.hp = Math.round((15 + tier * 18) * m); it.atk = Math.round((1 + tier * 1.4) * m); it.crit = 0.008 * tier * m; }
    it.name = (rar ? PW.RARITY[rar].n + " " : "") + PW.TIERS[tier - 1].name + PW.SLOTS[slot];
    it.val = Math.round((28 * tier * tier + 20) * m);
    return it;
  };
  PW.itemStats = (it) => [it.atk ? "โจมตี +" + it.atk : "", it.def ? "ป้องกัน +" + it.def : "", it.hp ? "HP +" + it.hp : "", it.crit ? "คริ +" + Math.round(it.crit * 100) + "%" : ""].filter(Boolean).join(" · ");

  // ---------------------------------------------------------------- hero entities
  PW.mkHero = (id, level, isPlayer) => {
    const H = PW.HEROES[id];
    const h = { id, isPlayer: !!isPlayer, x: 0, y: 0, r: 14, face: 0, level, xp: 0, hp: 1, mp: 1, maxHp: 1, maxMp: 1, atk: 1, def: 1, spd: 100, crit: 0,
      atkT: 0, cds: [0, 0, 0], stun: 0, slow: 0, shield: 0, shieldT: 0, buff: { t: 0, atk: 1, spd: 1 }, dead: false, reviveT: 0, hurt: 0, moving: false, cast: 0, idx: 0 };
    PW.calcStats(h); h.hp = h.maxHp; h.mp = h.maxMp; return h;
  };
  PW.calcStats = (h) => {
    const b = PW.HEROES[h.id].base, L = h.level - 1; const e = { atk: 0, def: 0, hp: 0, crit: 0 };
    const eq = G.S ? G.S.eq : {}; const f = h.isPlayer ? 1 : 0.6;
    for (const k in eq) { const it = eq[k]; if (it) { e.atk += it.atk * f; e.def += it.def * f; e.hp += it.hp * f; e.crit += it.crit * f; } }
    const ratio = h.maxHp ? h.hp / h.maxHp : 1, mr = h.maxMp ? h.mp / h.maxMp : 1;
    h.maxHp = Math.round(b.hp + b.hpG * L + e.hp); h.maxMp = Math.round(b.mp + b.mpG * L);
    h.atk = b.atk + b.atkG * L + e.atk; h.def = b.def + b.defG * L + e.def; h.spd = b.spd; h.crit = b.crit + e.crit;
    h.hp = Math.min(h.maxHp, Math.max(1, Math.round(h.maxHp * ratio))); h.mp = Math.min(h.maxMp, Math.round(h.maxMp * mr));
  };
  PW.xpNext = (l) => Math.round(22 * Math.pow(l, 1.5));
  PW.MAXLV = 50;

  PW.gainXp = (n) => {
    const h = G.hero; if (!h || h.level >= PW.MAXLV) return; h.xp += n; let up = 0;
    while (h.level < PW.MAXLV && h.xp >= PW.xpNext(h.level)) { h.xp -= PW.xpNext(h.level); h.level++; up++; }
    if (up) {
      PW.calcStats(h); h.hp = h.maxHp; h.mp = h.maxMp;
      for (const a of G.allies) { a.level = h.level; PW.calcStats(a); a.hp = a.maxHp; }
      PW.ring(h.x, h.y, 70, "#ffe066", 0.8); PW.ring(h.x, h.y, 40, "#fff", 0.6);
      for (let i = 0; i < 24; i++) PW.part(h.x, h.y, "#ffe066");
      PW.text(h.x, h.y - 40, "LEVEL UP! Lv " + h.level, "#ffe066", 1.6, 18);
      PW.sfx("level"); PW.playVoice(h.id, 3); PW.toast("เลเวลอัป! Lv " + h.level + " — HP/MP ฟื้นเต็ม"); PW.save();
    }
  };

  // ---------------------------------------------------------------- fx helpers
  PW.text = (x, y, s, c, life, size) => G.texts.push({ x, y, s, c: c || "#fff", t: life || 0.9, life: life || 0.9, size: size || 14, vx: U.rnd(-10, 10) });
  PW.ring = (x, y, r, c, dur) => G.rings.push({ x, y, r, c, t: dur || 0.4, dur: dur || 0.4 });
  PW.part = (x, y, c) => G.parts.push({ x, y, vx: U.rnd(-90, 90), vy: U.rnd(-120, 40), t: U.rnd(0.4, 0.9), c });
  PW.later = (sec, fn) => G.timers.push({ t: sec, fn });
  PW.toast = (msg, ms) => { const el = document.getElementById("toast"); if (!el) return; const d = document.createElement("div"); d.className = "toast-item"; d.textContent = msg; el.appendChild(d); setTimeout(() => d.classList.add("out"), ms || 2200); setTimeout(() => d.remove(), (ms || 2200) + 400); while (el.children.length > 3) el.firstChild.remove(); };
})();
