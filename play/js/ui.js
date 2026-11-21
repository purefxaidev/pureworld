// UI: title/hero select, HUD, controls, panels (bag/shop/party/quests/menu), NPC chat (scripted + Gemini Live), game loop.
(function () {
  const PW = window.PW, G = PW.G, U = PW.U, T = PW.T;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  let selHero = "tank", deferredInstall = null, loopOn = false, live = null;

  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferredInstall = e; const b = $("t-install"); if (b) b.hidden = false; });
  window.addEventListener("appinstalled", () => { deferredInstall = null; const b = $("t-install"); if (b) b.hidden = true; });

  // ---------------------------------------------------------------- assets
  function preload() {
    const names = [];
    PW.HERO_ORDER.forEach((id) => names.push([id + "_icon", "assets/img/" + id + "_icon.webp"]));
    Object.values(PW.NPCS).forEach((n) => names.push(["npc_" + n.id, n.icon]));
    const bar = $("load-bar"), txt = $("load-txt");
    const icons = Promise.all(names.map(([k, src]) => new Promise((res) => { const im = new Image(); im.onload = () => { G.imgs[k] = im; res(); }; im.onerror = () => res(); im.src = src; })));
    return Promise.all([icons, PW.loadSprites((p) => { if (bar) bar.style.width = Math.round(p * 100) + "%"; if (txt) txt.textContent = "กำลังโหลดภาพ " + Math.round(p * 100) + "%"; })]);
  }

  // ---------------------------------------------------------------- title
  function buildTitle() {
    const save = PW.loadSave();
    $("t-cards").innerHTML = PW.HERO_ORDER.map((id) => { const H = PW.HEROES[id]; return `<button class="hcard" data-hero="${id}" style="--c:${H.color}"><img src="assets/img/${id}_icon.webp" alt=""><b>${H.name}</b><small>${H.role}</small></button>`; }).join("");
    const cont = $("t-continue");
    if (save) { cont.hidden = false; cont.textContent = `ต่อเกม · ${PW.HEROES[save.heroId].name} Lv ${save.level}`; selectHero(save.heroId, false); } else { cont.hidden = true; selectHero("tank", false); }
    $("t-cards").addEventListener("click", (e) => { const b = e.target.closest("[data-hero]"); if (b) { PW.audioUnlock(); selectHero(b.dataset.hero, true); } });
    $("t-start").onclick = () => {
      PW.audioUnlock(); const ex = PW.loadSave();
      if (ex && !confirm("มีเซฟเดิมอยู่ การเริ่มใหม่จะลบเซฟเก่า ต้องการเริ่มใหม่หรือไม่?")) return;
      PW.wipeSave(); const S = PW.newSave(selHero); PW.playVoice(selHero, 1); startGame(S, true);
    };
    cont.onclick = () => { PW.audioUnlock(); const s = PW.loadSave(); if (s) startGame(s, false); };
    $("t-voice").onclick = () => { PW.audioUnlock(); PW.playVoice(selHero, 1); };
    $("t-install").onclick = async () => { if (deferredInstall) { deferredInstall.prompt(); await deferredInstall.userChoice; deferredInstall = null; $("t-install").hidden = true; } };
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.navigator.standalone; $("t-ios").hidden = !ios;
  }
  function selectHero(id, speak) {
    selHero = id; const H = PW.HEROES[id];
    document.querySelectorAll(".hcard").forEach((b) => b.classList.toggle("on", b.dataset.hero === id));
    $("t-art").src = "assets/img/" + id + ".webp"; $("t-art").style.setProperty("--c", H.color);
    $("t-name").textContent = H.name; $("t-role").textContent = H.role + " · " + H.style; $("t-pers").textContent = H.personality; $("t-line").textContent = "“" + H.lines[0] + "”";
    $("t-skills").innerHTML = H.skills.map((s, i) => `<li><b>${i + 1}. ${s.n}</b><span>${s.d}</span></li>`).join("");
    const b = H.base; $("t-stats").innerHTML = `<span>HP ${b.hp}</span><span>MP ${b.mp}</span><span>ATK ${b.atk}</span><span>DEF ${b.def}</span><span>SPD ${b.spd}</span>`;
    if (speak) PW.playVoice(id, 1);
  }

  // ---------------------------------------------------------------- game start
  function startGame(S, isNew) {
    G.S = PW.migrate(S); S = G.S; if (!G.W) G.W = PW.buildWorld();
    G.npcs = Object.values(PW.NPCS).map((n) => Object.assign({}, n, { x: n.x * T, y: n.y * T }));
    PW.spawnMonsters();
    const h = PW.mkHero(S.heroId, S.level, true); h.xp = S.xp || 0; PW.calcStats(h); h.hp = S.hp > 0 ? Math.min(S.hp, h.maxHp) : h.maxHp; h.mp = S.mp > 0 ? Math.min(S.mp, h.maxMp) : h.maxMp;
    h.x = S.x || G.W.spawn.x; h.y = S.y || G.W.spawn.y; if (PW.collides(G.W, h.x, h.y, 10)) { h.x = G.W.spawn.x; h.y = G.W.spawn.y; }
    G.hero = h; G.allies = (S.party || []).slice(0, 2).map((id, i) => { const a = PW.mkHero(id, h.level, false); a.x = h.x + 30; a.y = h.y + 20 * (i + 1); a.idx = i; return a; });
    G.autoHunt = !!S.auto && !isNew; G.moveTo = null; G.cam.x = h.x; G.cam.y = h.y; G.lastZone = ""; G.t = 0; G.comps = []; G.loot = []; PW.syncComps();
    $("title").hidden = true; $("hud").hidden = false; $("controls").hidden = false; $("joy").hidden = false; G.paused = false; G.running = true; PW.updateUltBtn();
    $("hud-icon").src = "assets/img/" + S.heroId + "_icon.webp"; buildSkillButtons(); PW.updateHud(true); syncToggles();
    PW.fade("#05020f", 1, 900); PW.ensureAtlases(); if (!S.hint) showHint();
    if (!loopOn) { loopOn = true; let last = performance.now(); const frame = (now) => { const dt = Math.min(0.05, (now - last) / 1000); last = now; if (G.running && !G.paused) PW.update(dt); if (G.running) { PW.render(); PW.renderMinimap(); PW.updateHud(); updateSkillButtons(); updateTalk(); updateCap(); } requestAnimationFrame(frame); }; requestAnimationFrame(frame); }
    PW.save();
  }

  // ---------------------------------------------------------------- HUD
  const hc = {};
  const setT = (id, v) => { if (hc[id] !== v) { hc[id] = v; $(id).textContent = v; } };
  const setW = (id, p) => { p = Math.round(U.clamp(p, 0, 1) * 100); if (hc[id] !== p) { hc[id] = p; $(id).style.width = p + "%"; } };
  PW.updateHud = (force) => {
    const h = G.hero, S = G.S; if (!h) return; if (force) for (const k in hc) delete hc[k];
    setT("hud-name", PW.HEROES[h.id].name + " · " + PW.HEROES[h.id].role); setT("hud-lv", "Lv " + h.level);
    setW("bar-hp", h.hp / h.maxHp); setW("bar-mp", h.mp / h.maxMp); const need = PW.xpNext(h.level); setW("bar-xp", h.level >= PW.MAXLV ? 1 : h.xp / need);
    setT("txt-hp", Math.ceil(h.hp) + "/" + h.maxHp); setT("txt-mp", Math.ceil(h.mp) + "/" + h.maxMp); setT("txt-xp", h.level >= PW.MAXLV ? "MAX" : U.fmt(h.xp) + "/" + U.fmt(need));
    setT("hud-gold", U.fmt(S.gold)); setT("btn-hp-n", String(S.hpPot)); setT("btn-mp-n", String(S.mpPot));
    const z = PW.zoneAt(h.x, h.y); setT("hud-zone", z.name + " · " + z.lv);
    setT("cap-n", "x" + S.crystals); const sp = S.sp || 0; if (hc.sp !== sp) { hc.sp = sp; const bd = $("sp-badge"); bd.hidden = !sp; bd.textContent = sp; }
    if (hc.auto !== G.autoHunt) { hc.auto = G.autoHunt; $("auto-ind").hidden = !G.autoHunt; $("btn-auto").classList.toggle("on", G.autoHunt); $("auto-sub").textContent = G.autoHunt ? "เปิด" : "ปิด"; }
  };
  function updateCap() {
    const m = G.running && !G.paused ? PW.captureTarget() : null; const show = m && m.hp / m.maxHp < 0.6 ? m : null; G.capTarget = show;
    const v = show ? Math.round(PW.captureChance(show) * 100) + "%" : ""; if (hc.capp !== v) { hc.capp = v; $("cap-p").textContent = v; $("btn-cap").classList.toggle("hot", !!show && G.S.crystals > 0); }
    const h = G.hero, b = $("btn-ult"); if (!b.hidden) { const cd = Math.round(U.clamp((h.ultCd || 0) / PW.ULTS[h.id].cd, 0, 1) * 100); if (hc.ult !== cd) { hc.ult = cd; b.querySelector(".cd").style.height = cd + "%"; b.classList.toggle("ready", cd === 0); } }
  }
  PW.updateUltBtn = () => { const S = G.S, h = G.hero; if (!S || !h) return; const b = $("btn-ult"); b.hidden = !(S.ult > 0); if (S.ult > 0) { b.style.backgroundImage = "url(" + PW.sprUrl("ult_" + h.id) + ")"; b.innerHTML = `<i class="cd"></i><span class="k">4</span><span class="lv">Lv${S.ult}</span><b>${PW.ULTS[h.id].n}</b>`; } delete hc.ult; };
  PW.showZone = (z) => { const b = $("zonebanner"); if (!G.running) return; if (PW.zoneAtlases) { PW.zoneAtlases(z.id); PW.prefetchNextZone(z.id); } if (G.t > 1.5) { PW.sfx("zone"); PW.fade(FADE[z.id] || FADE.meadow, 0.7, 700); } b.innerHTML = `<b>${z.name}</b><small>${z.lv}${z.danger && G.hero.level < z.danger ? " · อันตราย! แนะนำ Lv " + z.danger + "+" : ""}</small>`; b.classList.remove("show"); void b.offsetWidth; b.classList.add("show"); };
  const FADE = { town: "radial-gradient(circle,rgba(0,0,0,0) 10%,#2a1a0a 120%)", meadow: "radial-gradient(circle,rgba(0,0,0,0) 10%,#12331a 120%)", forest: "radial-gradient(circle,rgba(0,0,0,0) 10%,#06190f 120%)", desert: "radial-gradient(circle,rgba(0,0,0,0) 10%,#3a2406 120%)", ice: "radial-gradient(circle,rgba(0,0,0,0) 10%,#0b2a48 120%)" };
  PW.fade = (bg, peak, ms) => { const el = $("fade"); if (!el) return; if (PW.quality() === "low" && peak < 1) peak *= 0.6; el.style.transition = "none"; el.style.background = bg; el.style.opacity = peak; void el.offsetWidth; el.style.transition = "opacity " + ms + "ms ease-out"; el.style.opacity = 0; };
  function syncToggles() { delete hc.auto; PW.updateHud(); $("tg-atk").classList.toggle("on", G.S.settings.autoAtk); $("tg-snd").classList.toggle("on", G.S.settings.sound); }

  function buildSkillButtons() {
    const H = PW.HEROES[G.hero.id];
    [0, 1, 2].forEach((i) => { const b = $("btn-s" + i); b.style.setProperty("--c", H.color); b.style.backgroundImage = "url(" + PW.sprUrl("skill_" + G.hero.id + "_" + i) + ")"; b.innerHTML = `<i class="cd"></i><span class="k">${i + 1}</span><span class="lv">Lv${G.S.skl[i]}</span><b>${H.skills[i].n}</b><small>MP ${H.skills[i].mp}</small>`; });
    $("btn-atk").style.setProperty("--c", H.color);
  }
  function updateSkillButtons() {
    const h = G.hero, H = PW.HEROES[h.id];
    [0, 1, 2].forEach((i) => { const b = $("btn-s" + i), cd = h.cds[i] / H.skills[i].cd; const v = Math.round(U.clamp(cd, 0, 1) * 100); const key = "s" + i; if (hc[key] !== v) { hc[key] = v; b.querySelector(".cd").style.height = v + "%"; } const low = h.mp < PW.skillCost(h, i); if (hc[key + "l"] !== low) { hc[key + "l"] = low; b.classList.toggle("low", low); } });
  }
  function updateTalk() { const b = $("btn-talk"), n = G.nearNpc; const v = n ? n.name : ""; if (hc.talk !== v) { hc.talk = v; b.hidden = !n; if (n) b.textContent = "คุยกับ " + n.name; } }

  // ---------------------------------------------------------------- input
  // Movement: (1) fixed joystick bottom-left (re-centres where you touch in the lower-left area), (2) drag anywhere on the map = floating stick,
  // (3) tap/click the ground = walk there, tap a monster = attack it, tap an NPC = walk & talk, (4) keyboard WASD/arrows (layout-independent via e.code).
  const CODE = { KeyW: "up", ArrowUp: "up", KeyS: "down", ArrowDown: "down", KeyA: "left", ArrowLeft: "left", KeyD: "right", ArrowRight: "right" };
  const KEYF = { w: "up", s: "down", a: "left", d: "right", arrowup: "up", arrowdown: "down", arrowleft: "left", arrowright: "right", "ไ": "up", "ห": "down", "ฟ": "left", "ก": "right" };
  function bindInput() {
    const keys = G.keys; let stickOn = false;
    const upd = () => { let x = 0, y = 0; if (keys.left) x -= 1; if (keys.right) x += 1; if (keys.up) y -= 1; if (keys.down) y += 1; if (x && y) { x *= 0.7071; y *= 0.7071; } if (!stickOn) { G.input.x = x; G.input.y = y; } if (x || y) { G.moveTo = null; hideHint(); } };
    window.addEventListener("keydown", (e) => {
      if (!G.running) return; const tag = (e.target.tagName || "").toLowerCase(); if (tag === "input" || tag === "textarea" || tag === "select") { if (e.key === "Escape") closePanel(); return; }
      const k = (e.key || "").toLowerCase(), code = e.code || "";
      if (G.panel) { if (k === "escape") closePanel(); return; }
      const dir = CODE[code] || KEYF[k]; if (dir) { e.preventDefault(); keys[dir] = true; upd(); return; }
      const is = (c, ...ks) => code === c || ks.includes(k);
      if (is("Space", " ") || is("KeyJ", "j")) { e.preventDefault(); manualAttack(); } else if (is("Digit1", "1")) PW.castSkill(G.hero, 0); else if (is("Digit2", "2")) PW.castSkill(G.hero, 1); else if (is("Digit3", "3")) PW.castSkill(G.hero, 2);
      else if (is("Digit4", "4") || is("KeyF", "f")) PW.castUlt(G.hero); else if (is("KeyC", "c")) PW.throwCapture(); else if (is("KeyQ", "q")) PW.usePotion("hp"); else if (is("KeyR", "r")) PW.usePotion("mp");
      else if (is("KeyE", "e")) talk(); else if (is("KeyB", "b")) openBag(); else if (is("KeyP", "p")) openParty(); else if (is("KeyO", "o")) openQuests(); else if (is("KeyH", "h")) toggleAuto();
      else if (is("KeyM", "m")) openSettings(); else if (is("KeyK", "k")) openSkills(); else if (is("KeyL", "l")) openPets(); else if (is("KeyN", "n")) openBook(); else if (k === "escape") openMenu();
    });
    window.addEventListener("keyup", (e) => { const dir = CODE[e.code] || KEYF[(e.key || "").toLowerCase()]; if (dir) { keys[dir] = false; upd(); } });
    window.addEventListener("blur", () => { for (const k in keys) keys[k] = false; upd(); });
    // fixed joystick
    const joy = $("joy"), jknob = $("joy-knob"), R = 46; const J = { id: null, cx: 0, cy: 0 };
    const jset = (dx, dy) => { const d = Math.hypot(dx, dy); if (d > R) { dx = dx / d * R; dy = dy / d * R; } jknob.style.transform = `translate(${dx}px,${dy}px)`; const m = Math.hypot(dx, dy); if (m > 6) { G.input.x = dx / R; G.input.y = dy / R; G.moveTo = null; } else { G.input.x = 0; G.input.y = 0; } };
    const jstart = (e, recenter) => {
      if (G.panel || !G.running || J.id !== null) return; e.preventDefault(); PW.audioUnlock(); hideHint(); J.id = e.pointerId; stickOn = true; joy.classList.add("on");
      const r = joy.getBoundingClientRect(); J.cx = r.left + r.width / 2; J.cy = r.top + r.height / 2;
      if (recenter) { joy.style.left = (e.clientX - r.width / 2) + "px"; joy.style.bottom = (window.innerHeight - e.clientY - r.height / 2) + "px"; J.cx = e.clientX; J.cy = e.clientY; }
      try { (recenter ? $("touchzone") : joy).setPointerCapture(e.pointerId); } catch (er) { /* */ }
      jset(e.clientX - J.cx, e.clientY - J.cy);
    };
    const jmove = (e) => { if (e.pointerId !== J.id) return; e.preventDefault(); jset(e.clientX - J.cx, e.clientY - J.cy); };
    const jend = (e) => { if (e.pointerId !== J.id) return; J.id = null; stickOn = false; joy.classList.remove("on"); jknob.style.transform = ""; joy.style.left = ""; joy.style.bottom = ""; G.input.x = 0; G.input.y = 0; upd(); };
    joy.addEventListener("pointerdown", (e) => jstart(e, false)); joy.addEventListener("pointermove", jmove); joy.addEventListener("pointerup", jend); joy.addEventListener("pointercancel", jend);
    // map: tap = walk/attack/talk, drag = floating stick
    const zone = $("touchzone"), base = $("stick"), knob = $("knob"); const st = { on: false, id: -1, sx: 0, sy: 0, t0: 0, moved: 0, drag: false };
    zone.addEventListener("pointerdown", (e) => {
      if (G.panel || !G.running) return; PW.audioUnlock();
      const lowLeft = e.pointerType !== "mouse" && e.clientX < window.innerWidth * 0.42 && e.clientY > window.innerHeight * 0.55;
      if (lowLeft && J.id === null) return jstart(e, true);
      if (st.on) return; st.on = true; st.id = e.pointerId; st.sx = e.clientX; st.sy = e.clientY; st.t0 = performance.now(); st.moved = 0; st.drag = false; try { zone.setPointerCapture(e.pointerId); } catch (er) { /* */ }
    });
    zone.addEventListener("pointermove", (e) => {
      if (e.pointerId === J.id) return jmove(e);
      if (!st.on || e.pointerId !== st.id) return; let dx = e.clientX - st.sx, dy = e.clientY - st.sy; const d = Math.hypot(dx, dy); st.moved = Math.max(st.moved, d);
      if (!st.drag && st.moved > 14) { st.drag = true; stickOn = true; G.moveTo = null; base.style.left = st.sx + "px"; base.style.top = st.sy + "px"; base.classList.add("on"); hideHint(); }
      if (st.drag) { const Rr = 50; if (d > Rr) { dx = dx / d * Rr; dy = dy / d * Rr; } knob.style.transform = `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`; G.input.x = dx / Rr; G.input.y = dy / Rr; }
    });
    const end = (e) => {
      if (e.pointerId === J.id) return jend(e);
      if (!st.on || e.pointerId !== st.id) return; st.on = false; if (st.drag) { stickOn = false; base.classList.remove("on"); G.input.x = 0; G.input.y = 0; upd(); return; }
      if (e.type === "pointerup") tap(e.clientX, e.clientY);
    };
    zone.addEventListener("pointerup", end); zone.addEventListener("pointercancel", end);
    zone.addEventListener("contextmenu", (e) => e.preventDefault());
    const on = (id, fn) => { const b = $(id); b.addEventListener("pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); PW.audioUnlock(); fn(); }); };
    on("btn-atk", manualAttack); on("btn-s0", () => PW.castSkill(G.hero, 0)); on("btn-s1", () => PW.castSkill(G.hero, 1)); on("btn-s2", () => PW.castSkill(G.hero, 2));
    on("btn-ult", () => PW.castUlt(G.hero)); on("btn-cap", () => PW.throwCapture()); on("btn-auto", toggleAuto);
    on("btn-hp", () => PW.usePotion("hp")); on("btn-mp", () => PW.usePotion("mp")); on("btn-talk", talk);
    const click = (id, fn) => $(id).addEventListener("click", () => { PW.audioUnlock(); PW.sfx("click"); fn(); });
    click("hb-bag", openBag); click("hb-party", openParty); click("hb-quest", openQuests); click("hb-menu", openMenu); click("hb-skill", openSkills); click("hb-pet", openPets); click("hb-book", openBook);
    click("tg-atk", () => { G.S.settings.autoAtk = !G.S.settings.autoAtk; syncToggles(); }); click("tg-snd", () => { G.S.settings.sound = !G.S.settings.sound; syncToggles(); });
    $("hint-ok").addEventListener("click", () => { hideHint(); });
    $("modal").addEventListener("click", onModalClick); $("modal").addEventListener("change", onModalChange); $("modal").addEventListener("input", onModalInput); click("hb-set", openSettings);
    document.addEventListener("visibilitychange", () => { if (document.hidden && G.running) PW.save(); });
    window.addEventListener("pagehide", () => { if (G.running) PW.save(); });
  }
  function showHint() { $("hint").hidden = false; }
  function hideHint() { const el = $("hint"); if (el.hidden) return; el.hidden = true; if (G.S) { G.S.hint = 1; } }
  function manualAttack() { const h = G.hero; if (h.dead || G.paused) return; const H = PW.HEROES[h.id]; const ms = PW.monstersNear(h.x, h.y, H.range + 24); let best = null, bd = 1e9; for (const m of ms) { const d = Math.hypot(m.x - h.x, m.y - h.y); if (d < bd) { bd = d; best = m; } } if (best) PW.basicAttack(h, best); else { const e = PW._cb.nearestMonster(h, 260, false); if (e) G.moveTo = { m: e }; } }
  function toggleAuto() { if (G.panel || !G.running) return; G.autoHunt = !G.autoHunt; G.moveTo = null; G.S.auto = G.autoHunt; syncToggles(); PW.sfx("click"); PW.toast(G.autoHunt ? "AUTO: เปิด — ล่า/เก็บของ/ใช้สกิล/กินยาเอง (บังคับเองได้ตลอด)" : "AUTO: ปิด"); }
  function tap(sx, sy) {
    const w = PW.screenToWorld(sx, sy), h = G.hero; if (h.dead) return; hideHint();
    for (const n of G.npcs) if (Math.hypot(n.x - w.x, n.y - 30 - w.y) < 42) { if (Math.hypot(n.x - h.x, n.y - h.y) < 90) openChat(n); else G.moveTo = { x: n.x, y: n.y + 30, npc: n }; return; }
    let best = null, bd = 1e9; for (const m of G.monsters) { if (m.dead) continue; const hh = PW.MONSTERS[m.type].boss ? 150 : m.r * 3.5; const d = Math.hypot(m.x - w.x, (m.y - hh * 0.45) - w.y); const rr = Math.max(26, hh * 0.55); if (d < rr && d < bd) { bd = d; best = m; } }
    if (best) { G.moveTo = { m: best }; return; }
    G.moveTo = { x: w.x, y: w.y };
  }
  PW.onReachNpc = (n) => { if (!G.panel && Math.hypot(n.x - G.hero.x, n.y - G.hero.y) < 100) openChat(n); };
  function talk() { if (G.panel) return; if (G.nearNpc) openChat(G.nearNpc); }

  // ---------------------------------------------------------------- panels
  function openPanel(html, cls) { G.paused = true; G.panel = cls || "p"; const m = $("modal"); m.innerHTML = `<div class="sheet ${cls || ""}">${html}</div>`; m.hidden = false; G.input.x = 0; G.input.y = 0; for (const k in G.keys) G.keys[k] = false; }
  function closePanel() { if (live) { live.close(); live = null; } $("modal").hidden = true; $("modal").innerHTML = ""; G.panel = null; if (G.running && !G.hero.dead) G.paused = false; PW.save(); PW.updateHud(true); syncToggles(); }
  PW.closePanel = closePanel;
  let curNpc = null;
  function onModalClick(e) {
    const b = e.target.closest("[data-act]"); if (!b) { if (e.target.id === "modal") closePanel(); return; } PW.sfx("click"); const a = b.dataset.act, v = b.dataset.v;
    const S = G.S;
    if (a === "close") closePanel();
    else if (a === "bag") { if (live) { live.close(); live = null; } openBag(); } else if (a === "party") { if (live) { live.close(); live = null; } openParty(); } else if (a === "quests") { if (live) { live.close(); live = null; } openQuests(); }
    else if (a === "shop") { if (live) { live.close(); live = null; } openShop(PW.NPCS[v]); }
    else if (a === "chat") openChat(PW.NPCS[v]);
    else if (a === "equip") { const i = S.bag.findIndex((x) => String(x.id) === v); if (i >= 0) { const it = S.bag.splice(i, 1)[0]; const old = S.eq[it.slot]; S.eq[it.slot] = it; if (old) S.bag.push(old); PW.calcStats(G.hero); G.allies.forEach(PW.calcStats); PW.sfx("pot"); openBag(); } }
    else if (a === "unequip") { if (S.bag.length >= 40) return PW.toast("กระเป๋าเต็ม"); const it = S.eq[v]; if (it) { S.eq[v] = null; S.bag.push(it); PW.calcStats(G.hero); openBag(); } }
    else if (a === "sell") { const i = S.bag.findIndex((x) => String(x.id) === v); if (i >= 0) { const it = S.bag.splice(i, 1)[0]; S.gold += Math.floor(it.val * 0.4); PW.sfx("coin"); openBag(); } }
    else if (a === "buy") buy(b.dataset); else if (a === "buyx") buyExtra(b.dataset);
    else if (a === "recruit") { const id = v; const i = G.allies.findIndex((x) => x.id === id); if (i >= 0) { G.allies.splice(i, 1); } else if (G.allies.length < 2) { const al = PW.mkHero(id, G.hero.level, false); al.x = G.hero.x + 30; al.y = G.hero.y + 20; G.allies.push(al); PW.playVoice(id, 1); } else PW.toast("ทีมเต็มแล้ว (สูงสุด 2 คน)"); openParty(); }
    else if (a === "claim") claimQuest();
    else if (a === "save") { PW.save(); PW.toast("บันทึกแล้ว ✓"); }
    else if (a === "install") { if (deferredInstall) { deferredInstall.prompt(); deferredInstall = null; } else PW.toast("iPhone: กดปุ่มแชร์ → เพิ่มลงในหน้าจอโฮม · Android: เมนูเบราว์เซอร์ → ติดตั้งแอป", 5000); }
    else if (a === "fullscreen") { const d = document.documentElement; if (d.requestFullscreen) d.requestFullscreen().catch(() => {}); }
    else if (a === "reset") { if (confirm("ลบเซฟและกลับไปเลือกฮีโรอีนใหม่?")) { PW.wipeSave(); location.reload(); } }
    else if (a === "revive") { closePanel(); PW.revive(); }
    else if (a === "titleback") { PW.save(); location.reload(); }
    else if (a === "skills") openSkills(); else if (a === "pets") openPets(); else if (a === "book") openBook();
    else if (a === "sk-up") { if (PW.upSkill(+v)) { buildSkillButtons(); } openSkills(); }
    else if (a === "sk-pass") { PW.unlockPassive(); openSkills(); } else if (a === "sk-ult") { PW.upUlt(); openSkills(); }
    else if (a === "sk-reset") { if (confirm("รีเซ็ตสกิลทั้งหมด (คืนแต้มให้ครบ)?")) { const n = PW.resetSkills(); buildSkillButtons(); PW.toast("คืนแต้มสกิล " + n + " แต้ม"); openSkills(); } }
    else if (a === "hatch") { PW.hatchEgg(); openPets(); } else if (a === "pet-on") { PW.setActiveComp(+v); openPets(b.dataset.tab); }
    else if (a === "pet-feed") { PW.feedComp(+v); openPets(b.dataset.tab); } else if (a === "pet-evo") { PW.evolveComp(+v); openPets(b.dataset.tab); }
    else if (a === "pet-rel") { const p = S.pets.find((q) => q.uid === +v); if (p && confirm("ปล่อย " + PW.compName(p) + " ? (ได้ทอง " + 20 * p.lv + "G)")) { PW.releaseComp(+v); openPets(b.dataset.tab); } }
    else if (a === "pet-tab") openPets(v);
    else if (a === "tg-autoskill") { S.settings.autoSkill = !S.settings.autoSkill; openMenu(); }
    else if (a === "tg-sound") { S.settings.sound = !S.settings.sound; PW.audioApplyVol(); openSettings(); }
    else if (a === "settings") openSettings();
  }
  function onModalInput(e) {
    const S = G.S, id = e.target.id;
    if (id === "set-music") { S.settings.musicVol = +e.target.value; PW.audioApplyVol(); const o = $("v-music"); if (o) o.textContent = e.target.value + "%"; }
    else if (id === "set-sfx") { S.settings.sfxVol = +e.target.value; PW.audioApplyVol(); const o = $("v-sfx"); if (o) o.textContent = e.target.value + "%"; clearTimeout(onModalInput.t); onModalInput.t = setTimeout(() => PW.sfx("coin"), 120); }
  }
  function openSettings() {
    const S = G.S, s = S.settings, q = PW.quality(); const mo = (v, t) => `<option value="${v}" ${s.quality === v ? "selected" : ""}>${t}</option>`;
    openPanel(`<div class="ph"><h2>⚙ ตั้งค่า</h2><button data-act="close" class="x">✕</button></div>
      <h3>เสียง</h3>
      <div class="set-row"><span>เสียงทั้งหมด</span><button data-act="tg-sound" class="${s.sound !== false ? "" : "sub"}">${s.sound !== false ? "เปิด" : "ปิด"}</button></div>
      <div class="set-row"><span>🎵 เพลงประกอบ</span><input id="set-music" type="range" min="0" max="100" step="5" value="${s.musicVol}"><b id="v-music">${s.musicVol}%</b></div>
      <div class="set-row"><span>💥 เสียงเอฟเฟกต์</span><input id="set-sfx" type="range" min="0" max="100" step="5" value="${s.sfxVol}"><b id="v-sfx">${s.sfxVol}%</b></div>
      <h3>กราฟิก</h3>
      <div class="set-row"><span>คุณภาพภาพ</span><select id="set-quality">${mo("auto", "อัตโนมัติ")}${mo("high", "สูง")}${mo("low", "ประหยัด (มือถือสเปคต่ำ)")}</select></div>
      <p class="muted">ตอนนี้ใช้โหมด: <b id="q-now">${q === "low" ? "ประหยัด" : "สูง"}</b>${s.quality === "auto" && G.autoLow ? " (ระบบลดให้อัตโนมัติเพราะเฟรมเรตต่ำ)" : ""} · ประหยัด = ลดความละเอียด/พาร์ติเคิล/เอฟเฟกต์แสง ลดการใช้แบตและความร้อน</p>
      <p class="muted">เพลง: ${PW.musicId || "—"} · FPS ~${PW.fps || "?"} · โหลดแอนิเมชันแล้ว ${Object.keys(G.atl).length} ชุด</p>`, "settings");
  }
  PW.openSettings = openSettings;
  function onModalChange(e) {
    if (e.target.id === "set-quality") { G.S.settings.quality = e.target.value; G.autoLow = false; PW.applyQuality(); PW.save(); const o = $("q-now"); if (o) o.textContent = PW.quality() === "low" ? "ประหยัด" : "สูง"; return; } if (e.target.id === "set-pot") { G.S.settings.potPct = +e.target.value; PW.save(); } }
  PW.openPanelFn = () => ({ openSkills, openPets, openBook });

  function statBlock() {
    const h = G.hero; return `<div class="stats"><span>โจมตี <b>${Math.round(h.atk)}</b></span><span>ป้องกัน <b>${Math.round(h.def)}</b></span><span>HP <b>${h.maxHp}</b></span><span>MP <b>${h.maxMp}</b></span><span>คริ <b>${Math.round(h.crit * 100)}%</b></span><span>ความเร็ว <b>${h.spd}</b></span></div>`;
  }
  function itemRow(it, acts) { return `<div class="item" style="--rc:${PW.RARITY[it.rar].c}">${icoImg(ITEM_ICON[it.slot] || "item_amulet")}<div><b>${esc(it.name)}</b><small>${PW.itemStats(it)}</small></div><div class="acts">${acts}</div></div>`; }
  function openBag() {
    const S = G.S, h = G.hero, H = PW.HEROES[h.id];
    const eq = Object.keys(PW.SLOTS).map((s) => { const it = S.eq[s]; return it ? itemRow(it, `<button data-act="unequip" data-v="${s}">ถอด</button>`) : `<div class="item empty"><div><b>${PW.SLOTS[s]}</b><small>ว่าง</small></div></div>`; }).join("");
    const bag = S.bag.length ? S.bag.map((it) => itemRow(it, `<button data-act="equip" data-v="${it.id}">สวม</button><button data-act="sell" data-v="${it.id}" class="sub">ขาย ${Math.floor(it.val * 0.4)}G</button>`)).join("") : `<p class="muted">ยังไม่มีไอเทม — สัตว์ประหลาดมีโอกาสดรอปอุปกรณ์</p>`;
    openPanel(`<div class="ph"><h2>กระเป๋า · ${H.name} Lv ${h.level}</h2><button data-act="close" class="x">✕</button></div>${statBlock()}<p class="potions">ยาแดง <b>${S.hpPot}</b> · ยาน้ำเงิน <b>${S.mpPot}</b> · ทอง <b>${U.fmt(S.gold)}</b></p><h3>สวมใส่อยู่</h3>${eq}<h3>ในกระเป๋า (${S.bag.length}/40)</h3><div class="list">${bag}</div>`, "bag");
  }
  function openShop(npc) {
    if (!npc || !npc.shop) return; const S = G.S, lv = G.hero.level; let rows = "";
    if (npc.shop === "potion") {
      const P = [["hp", 1, 25, "ยาแดง x1", "ฟื้น HP 45%"], ["hp", 5, 110, "ยาแดง x5", "ประหยัดกว่า"], ["mp", 1, 30, "ยาน้ำเงิน x1", "ฟื้น MP 50%"], ["mp", 5, 135, "ยาน้ำเงิน x5", "ประหยัดกว่า"]];
      rows = P.map((p) => `<div class="item">${icoImg(p[0] === "hp" ? "item_hpot" : "item_mpot")}<div><b>${p[3]}</b><small>${p[4]}</small></div><div class="acts"><button data-act="buy" data-k="pot" data-t="${p[0]}" data-n="${p[1]}" data-p="${p[2]}">${p[2]}G</button></div></div>`).join("");
    } else {
      const tiers = PW.TIERS.map((t, i) => i + 1).filter((t) => PW.TIERS[t - 1].lv <= lv + 3).slice(-3);
      for (const t of tiers) for (const s of Object.keys(PW.SLOTS)) { const it = PW.makeItem(s, t, 0); S.nextId--; const price = it.val * 2; rows += itemRow(it, `<button data-act="buy" data-k="gear" data-s="${s}" data-t="${t}" data-p="${price}">${U.fmt(price)}G</button>`); }
      rows += `<p class="muted">ของที่ดรอปจากมอนสเตอร์อาจมีค่าสถานะสูงกว่า ลองเก็บเลเวลหาของดีด้วยนะ</p>`;
    }
    if (npc.shop === "pot" || /pot/.test(String(npc.shop))) rows += PW.SHOP_EXTRA.map((p) => `<div class="item"><img class="ico2" src="${PW.sprUrl("item_" + p[0])}" alt=""><div><b>${p[3]}</b><small>${p[4]}</small></div><div class="acts"><button data-act="buyx" data-t="${p[0]}" data-n="${p[1]}" data-p="${p[2]}" data-npc="${npc.id}">${p[2]}G</button></div></div>`).join("");
    openPanel(`<div class="ph"><h2>${npc.title} · ${npc.name}</h2><button data-act="close" class="x">✕</button></div><p class="potions">ทอง <b id="shop-gold">${U.fmt(S.gold)}</b> · ยาแดง <b>${S.hpPot}</b> · ยาน้ำเงิน <b>${S.mpPot}</b></p><div class="list">${rows}</div><div class="foot"><button data-act="chat" data-v="${npc.id}">กลับไปคุย</button></div>`, "shop");
  }
  function buy(d) {
    const S = G.S, p = +d.p; if (S.gold < p) return PW.toast("ทองไม่พอ");
    if (d.k === "pot") { S.gold -= p; if (d.t === "hp") S.hpPot += +d.n; else S.mpPot += +d.n; }
    else { if (S.bag.length >= 40) return PW.toast("กระเป๋าเต็ม"); S.gold -= p; const it = PW.makeItem(d.s, +d.t, 0); S.bag.push(it); PW.toast("ซื้อ " + it.name + " แล้ว (ดูในกระเป๋า)"); }
    PW.sfx("coin"); $("shop-gold").textContent = U.fmt(S.gold); PW.updateHud(true);
  }
  function buyExtra(d) {
    const S = G.S, p = +d.p, n = +d.n; if (S.gold < p) return PW.toast("ทองไม่พอ"); S.gold -= p;
    const key = { crystal: "crystals", egg: "eggs", treat: "treats", gem: "gems" }[d.t]; S[key] = (S[key] || 0) + n; PW.sfx("coin"); PW.toast("ซื้อแล้ว ✓"); openShop(PW.NPCS[d.npc]);
  }
  const ITEM_ICON = { weapon: "item_sword", armor: "item_armor", charm: "item_amulet" };
  const icoImg = (k) => `<img class="ico2" src="${PW.sprUrl(k)}" alt="">`;
  const invRow = () => { const S = G.S; return `<div class="inv-row"><span>${icoImg("item_crystal")} ผนึก <b>${S.crystals}</b></span><span>${icoImg("item_egg")} ไข่ <b>${S.eggs}</b></span><span>${icoImg("item_treat")} ขนม <b>${S.treats}</b></span><span>${icoImg("item_gem")} อัญมณี <b>${S.gems}</b></span><span>${icoImg("item_gold")} <b>${U.fmt(S.gold)}</b></span></div>`; };

  // ---------------------------------------------------------------- v2 panels: skills / pets / book
  function openSkills() {
    const S = G.S, h = G.hero, H = PW.HEROES[h.id], P = PW.PASSIVES[h.id], UL = PW.ULTS[h.id];
    const pips = (lv, max) => `<div class="pips">${Array.from({ length: max }, (_, i) => `<i class="${i < lv ? "on" : ""}"></i>`).join("")}</div>`;
    const cards = H.skills.map((sk, i) => { const lv = S.skl[i], why = PW.canUpSkill(i);
      return `<div class="sk-card"><img src="${PW.sprUrl("skill_" + h.id + "_" + i)}" alt=""><div class="sk-b"><b>${i + 1}. ${sk.n} · Lv ${lv}/${PW.SKILL_MAX}</b><small>${sk.d}</small>${pips(lv, PW.SKILL_MAX)}
      <small>ดาเมจ/ฮีล ×${PW.skillMul(lv).toFixed(2)} · คูลดาวน์ ×${PW.skillCdMul(lv).toFixed(2)} · พื้นที่ ×${PW.skillAreaMul(lv).toFixed(2)} · MP ${PW.skillCost(h, i)}</small>
      <div class="ms ${lv >= 5 ? "" : "off"}">Lv5 — ${PW.SKILL_MILESTONE[5]}</div><div class="ms ${lv >= 10 ? "" : "off"}">Lv10 — ${PW.SKILL_MILESTONE[10]}</div></div>
      <div class="acts"><button data-act="sk-up" data-v="${i}" ${why ? "disabled" : ""} title="${why}">${why && lv < PW.SKILL_MAX ? why : lv >= PW.SKILL_MAX ? "MAX" : "+1 อัป"}</button></div></div>`; }).join("");
    const pw = PW.canPassive(), uw = PW.canUlt();
    const pas = `<div class="sk-card"><img src="assets/img/${h.id}_icon.webp" alt=""><div class="sk-b"><b>พาสซีฟ · ${P.n} ${S.passive ? "✓" : ""}</b><small>${P.d}</small><small>ปลดล็อก Lv ${P.lv} · ${P.cost} แต้ม</small></div><div class="acts"><button data-act="sk-pass" ${pw ? "disabled" : ""}>${S.passive ? "มีแล้ว" : pw || "ปลดล็อก"}</button></div></div>`;
    const ult = `<div class="sk-card"><img src="${PW.sprUrl("ult_" + h.id)}" alt=""><div class="sk-b"><b>อัลติเมต · ${UL.n} ${S.ult ? "Lv " + S.ult + "/5" : ""}</b><small>${UL.d}</small><small>คูลดาวน์ ${UL.cd} วิ · MP ${UL.mp} · ปุ่ม 4 / F</small>${pips(S.ult, 5)}</div><div class="acts"><button data-act="sk-ult" ${uw ? "disabled" : ""}>${uw || (S.ult ? "+1 อัป" : "ปลดล็อก")}</button></div></div>`;
    openPanel(`<div class="ph"><h2>สกิล · ${H.name}</h2><button data-act="close" class="x">✕</button></div><div class="sp-head"><span>แต้มสกิล (ได้ 1 แต้มทุกเลเวลอัป)</span><b id="sp-left">${S.sp}</b></div>${cards}<h3>พาสซีฟ & อัลติเมต</h3>${pas}${ult}<div class="foot"><button data-act="sk-reset" class="sub">รีเซ็ตสกิล</button></div>`, "skills");
  }
  function openPets(tab) {
    const S = G.S; tab = tab || "pet"; const list = S.pets.filter((p) => p.kind === tab);
    const cards = list.length ? list.map((p) => { const D = PW.compDef(p), on = S.petOn === p.uid || S.minionOn === p.uid, ev = PW.canEvolve(p), nx = PW.petXpNext(p.lv);
      return `<div class="pet ${on ? "on" : ""}">${on ? '<span class="tag">ออกรบ</span>' : ""}<img src="${PW.sprUrl(PW.compSprite(p))}" alt=""><b>${esc(PW.compName(p))}</b><small>Lv ${p.lv}/${PW.PET_MAXLV} · ${D.desc}</small><div class="xpbar"><i style="width:${p.lv >= PW.PET_MAXLV ? 100 : Math.round(p.xp / nx * 100)}%"></i></div>
      <div class="acts"><button data-act="pet-on" data-v="${p.uid}" data-tab="${tab}" class="${on ? "sub" : ""}">${on ? "พัก" : "ออกรบ"}</button><button data-act="pet-feed" data-v="${p.uid}" data-tab="${tab}">ให้ขนม</button><button data-act="pet-evo" data-v="${p.uid}" data-tab="${tab}" ${ev ? "disabled" : ""} title="${ev}">วิวัฒน์</button><button data-act="pet-rel" data-v="${p.uid}" data-tab="${tab}" class="sub">ปล่อย</button></div></div>`; }).join("")
      : `<p class="muted">${tab === "pet" ? "ยังไม่มีสัตว์เลี้ยง — ฟักไข่ (ได้จากมอนสเตอร์/ร้านป้าพรม)" : "ยังไม่มีสมุน — ตีมอนสเตอร์ให้เลือดน้อย แล้วกดปุ่ม ผนึก (C) เพื่อจับ"}</p>`;
    openPanel(`<div class="ph"><h2>สัตว์เลี้ยง & สมุน</h2><button data-act="close" class="x">✕</button></div>${invRow()}
      <div class="tabs"><button data-act="pet-tab" data-v="pet" class="${tab === "pet" ? "" : "sub"}">🐾 สัตว์เลี้ยง</button><button data-act="pet-tab" data-v="minion" class="${tab === "minion" ? "" : "sub"}">👾 สมุน</button><button data-act="hatch" ${S.eggs ? "" : "disabled"}>🥚 ฟักไข่ (${S.eggs})</button><button data-act="book" class="sub">📖 สมุดสมุน</button></div>
      <p class="muted">ออกรบได้ 1 สัตว์เลี้ยง + 1 สมุน — ช่วยตี เก็บของ ให้โบนัสสเตตัส และได้ EXP ไปด้วย (เลเวล 10/20 วิวัฒนาการด้วยอัญมณี)</p><div class="pet-grid">${cards}</div>`, "pets");
  }
  function openBook() {
    const S = G.S; const mons = Object.keys(PW.MINIONS), pets = Object.keys(PW.PETS);
    const got = mons.filter((k) => S.book["mon_" + k]).length + pets.filter((k) => S.book["pet_" + k]).length;
    const mc = mons.map((k) => { const g = S.book["mon_" + k], sn = S.seen && S.seen[k]; return `<div class="bk ${g ? "got" : sn ? "seen" : "unk"}"><img src="${PW.sprUrl(g ? "tamed_" + k : "mon_" + k)}" alt=""><b>${g || sn ? PW.MONSTERS[k].name : "???"}</b><small>${g ? "จับแล้ว ✓" : sn ? "เคยพบ · โอกาสจับ ×" + PW.RARE[k] : "ยังไม่พบ"}</small></div>`; }).join("");
    const pc = pets.map((k) => { const g = S.book["pet_" + k]; return `<div class="bk ${g ? "got" : "unk"}"><img src="${PW.sprUrl("pet_" + k)}" alt=""><b>${g ? PW.PETS[k].name : "???"}</b><small>${g ? PW.PETS[k].desc : "ฟักจากไข่"}</small></div>`; }).join("");
    openPanel(`<div class="ph"><h2>สมุดสมุน ${got}/${mons.length + pets.length}</h2><button data-act="close" class="x">✕</button></div><p class="muted">จับสำเร็จ ${S.capOk || 0} · พลาด ${S.capFail || 0} — ยิ่งเลือดน้อย โอกาสจับยิ่งสูง</p><h3>มอนสเตอร์</h3><div class="book-grid">${mc}</div><h3>สัตว์เลี้ยง</h3><div class="book-grid">${pc}</div><div class="foot"><button data-act="pets">🐾 ไปหน้าสัตว์เลี้ยง</button></div>`, "book");
  }
  function openParty() {
    const rows = PW.HERO_ORDER.filter((id) => id !== G.hero.id).map((id) => { const H = PW.HEROES[id], on = G.allies.some((a) => a.id === id); return `<div class="item" style="--rc:${H.color}"><img class="ico" src="assets/img/${id}_icon.webp" alt=""><div><b>${H.name} · ${H.role}</b><small>${H.personality}</small></div><div class="acts"><button data-act="recruit" data-v="${id}" class="${on ? "sub" : ""}">${on ? "ปล่อย" : "เรียก"}</button></div></div>`; }).join("");
    openPanel(`<div class="ph"><h2>ทีมผจญภัย (${G.allies.length}/2)</h2><button data-act="close" class="x">✕</button></div><p class="muted">เพื่อนร่วมทีมจะเดินตามและสู้เองอัตโนมัติ (เลเวลเท่าคุณ) — แทงก์ช่วยรับดาเมจ ซัพพอร์ตช่วยฮีล</p><div class="list">${rows}</div>`, "party");
  }
  function openQuests() {
    const S = G.S, q = PW.QUESTS[S.qIdx]; let body;
    if (!q) body = `<p>🎉 ภารกิจทั้งหมดสำเร็จแล้ว! ยินดีด้วย ผู้กล้าแห่ง PureWorld</p>`;
    else { const pr = Math.min(S.qProg, q.n), done = pr >= q.n; body = `<div class="quest"><b>${S.qIdx + 1}/${PW.QUESTS.length} · ${q.t}</b><div class="bar"><i style="width:${pr / q.n * 100}%"></i></div><small>ความคืบหน้า ${pr}/${q.n} · รางวัล ${U.fmt(q.gold)}G + ${U.fmt(q.xp)} XP</small><div class="foot"><button data-act="claim" ${done ? "" : "disabled"}>${done ? "รับรางวัล" : "ยังไม่สำเร็จ"}</button></div></div>`; }
    openPanel(`<div class="ph"><h2>ภารกิจกิลด์</h2><button data-act="close" class="x">✕</button></div>${body}<p class="muted">ฆ่าสัตว์ประหลาดที่ระบุในโซนที่เหมาะสมเพื่อเพิ่มความคืบหน้า</p><p class="muted">ฆ่ามอนสเตอร์ทั้งหมด: ${U.fmt(S.kills)} ตัว</p>`, "quests");
  }
  function claimQuest() { const S = G.S, q = PW.QUESTS[S.qIdx]; if (!q || S.qProg < q.n) return; S.gold += q.gold; S.qIdx++; S.qProg = 0; PW.gainXp(q.xp); PW.sfx("coin"); PW.toast("ได้รับ " + q.gold + "G และ " + q.xp + " XP"); PW.save(); openQuests(); }
  function openMenu() {
    const S = G.S; const mode = PW.liveSupported() ? "AI สด (Gemini Live)" : "บทพูดในเกม (ยังไม่ตั้งค่า NPC_API_URL)";
    openPanel(`<div class="ph"><h2>เมนู</h2><button data-act="close" class="x">✕</button></div>
      <h3>ตั้งค่า AUTO</h3><div class="set-row"><span>ใช้สกิลอัตโนมัติ (ตอน AUTO)</span><button data-act="tg-autoskill" class="${G.S.settings.autoSkill ? "" : "sub"}">${G.S.settings.autoSkill ? "เปิด" : "ปิด"}</button></div>
      <div class="set-row"><span>กินยาแดงอัตโนมัติเมื่อ HP ต่ำกว่า</span><select id="set-pot">${[0, 30, 40, 50, 60, 70].map((v) => `<option value="${v}" ${G.S.settings.potPct === v ? "selected" : ""}>${v ? v + "%" : "ไม่ใช้"}</option>`).join("")}</select></div>
      <p class="muted">ปุ่มลัด: WASD/ลูกศร เดิน · คลิก/แตะพื้นเพื่อเดินไป · Space ตี · 1-3 สกิล · 4/F อัลติ · C ผนึก · H AUTO · K สกิล · L สัตว์เลี้ยง · N สมุด</p>
      <div class="menu"><button data-act="settings">⚙ ตั้งค่าเสียง/กราฟิก</button><button data-act="save">💾 บันทึกเกม</button><button data-act="install">📲 ติดตั้งเป็นแอป</button><button data-act="fullscreen">⛶ เต็มจอ</button><button data-act="titleback">🏠 กลับหน้าแรก</button><button data-act="reset" class="sub">🗑 เริ่มใหม่ทั้งหมด</button></div>
      <p class="muted">NPC: ${mode}</p><p class="muted">เซฟอัตโนมัติทุก 8 วินาที · เล่น ${Math.floor(S.played / 60)} นาที</p>
      <h3>ปุ่มลัดคีย์บอร์ด</h3><p class="muted">WASD/ลูกศร เดิน · Space/J โจมตี · 1/2/3 สกิล · Q/R ยาแดง/ยาน้ำเงิน · E คุย NPC · B กระเป๋า · P ทีม · O ภารกิจ · H ล่าอัตโนมัติ · Esc เมนู</p>
      <p class="muted credit">PureWorld · สร้างโดย PureFxAi · ภาพและเสียงสร้างด้วย AI</p>`, "menu");
  }
  let reviveT = null;
  PW.showDeath = () => {
    openPanel(`<div class="ph"><h2>ล้มแล้ว...</h2></div><p>${PW.HEROES[G.hero.id].name} หมดแรง ฟื้นที่เมืองพิวร์ (เสียทอง 10%)</p>${G.autoHunt ? '<p class="muted">AUTO เปิดอยู่ — ฟื้นอัตโนมัติใน <b id="rv-n">5</b> วิ แล้วกลับไปล่าต่อ</p>' : ""}<div class="foot"><button data-act="revive" class="big">ฟื้นที่เมือง</button></div>`, "death");
    clearInterval(reviveT); if (G.autoHunt) { let n = 5; reviveT = setInterval(() => { n--; const el = $("rv-n"); if (el) el.textContent = n; if (G.panel !== "death") { clearInterval(reviveT); return; } if (n <= 0) { clearInterval(reviveT); closePanel(); PW.revive(); } }, 1000); }
  };

  // ---------------------------------------------------------------- NPC chat (scripted + Gemini Live)
  function openChat(npc) {
    if (live) { live.close(); live = null; } curNpc = npc; const h = G.hero;
    const acts = [npc.shop ? `<button data-act="shop" data-v="${npc.id}">🛒 ร้านค้า</button>` : "", npc.guild ? `<button data-act="quests">📜 ภารกิจ</button><button data-act="party">👥 ทีม</button>` : "", `<button data-act="bag">🎒 กระเป๋า</button>`].join("");
    openPanel(`<div class="chat-head"><img src="${npc.face}" alt=""><div><b>${npc.name}</b><small>${npc.title}</small></div><span class="chip" id="chat-status">…</span><button data-act="close" class="x">✕</button></div>
      <div class="chat-actions">${acts}</div><div class="chat-log" id="chat-log"></div>
      <div class="chat-input"><button id="chat-mic" title="พูดด้วยเสียง" disabled>🎤</button><input id="chat-text" type="text" maxlength="200" placeholder="พิมพ์คุยกับ${npc.name}…" autocomplete="off"><button id="chat-send">ส่ง</button></div>
      <label class="chk"><input type="checkbox" id="chat-voice" checked> เปิดเสียงตอบ</label>`, "chat");
    const ctx = () => ({ heroName: PW.HEROES[h.id].name, role: PW.HEROES[h.id].role, level: h.level, gold: G.S.gold });
    const log = $("chat-log"), input = $("chat-text"), send = $("chat-send"), mic = $("chat-mic"), status = $("chat-status");
    let mode = "script", curNpcEl = null, curUserEl = null, busy = false;
    const setStatus = (s, cls) => { status.textContent = s; status.className = "chip " + (cls || ""); };
    const add = (who, text) => { const d = document.createElement("div"); d.className = "msg " + who; d.textContent = text; log.appendChild(d); log.scrollTop = log.scrollHeight; return d; };
    const sayScript = (text) => { setTimeout(() => { if (!G.panel || G.panel !== "chat") return; add("npc", text); speak(text); }, 420); };
    const speak = (text) => { try { if (!$("chat-voice").checked || !G.S.settings.sound || !window.speechSynthesis) return; const u = new SpeechSynthesisUtterance(text); u.lang = "th-TH"; window.speechSynthesis.cancel(); window.speechSynthesis.speak(u); } catch (e) { /* */ } };
    const toScript = (why) => { mode = "script"; mic.disabled = true; setStatus("บทพูดในเกม", "script"); if (why) add("sys", why); if (live) { live.close(); live = null; } sayScript(PW.scriptedGreeting(npc.id, ctx())); };
    const submit = () => {
      const t = input.value.trim(); if (!t) return; input.value = ""; add("user", t); curUserEl = null;
      if (mode === "live" && live && live.sendText(t)) { setStatus("กำลังคิด…", "live"); return; }
      if (mode === "live") { toScript("การเชื่อมต่อ AI สดหลุด ใช้บทพูดในเกมแทน"); return; }
      sayScript(PW.scriptedReply(npc.id, t, ctx()));
    };
    send.onclick = submit; input.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }; $("chat-voice").onchange = (e) => { if (live) { live.audioOn = e.target.checked; if (!e.target.checked) live.stopPlayback(); } };
    mic.onclick = async () => { if (!live || mode !== "live") return; if (live.mic) { live.stopMic(); mic.classList.remove("rec"); return; } try { await live.startMic(); mic.classList.add("rec"); } catch (e) { add("sys", "เปิดไมโครโฟนไม่ได้ (อนุญาตการใช้ไมค์ก่อนนะ) — พิมพ์คุยแทนได้"); } };
    if (!PW.liveSupported()) { setStatus("บทพูดในเกม", "script"); sayScript(PW.scriptedGreeting(npc.id, ctx())); setTimeout(() => input.focus(), 50); return; }
    // live mode
    setStatus("กำลังเชื่อมต่อ AI สด…", "wait"); const L = new PW.LiveNPC({ apiUrl: window.PW_CONFIG.NPC_API_URL, npcId: npc.id, hero: { id: h.id, level: h.level },
      on: {
        status: (s) => { if (live !== L) return; const m = { ready: ["AI สด · พร้อมคุย", "live"], listening: ["กำลังฟังคุณ…", "rec"], speaking: ["กำลังพูด…", "live"], connecting: ["กำลังเชื่อมต่อ AI สด…", "wait"] }; if (m[s]) setStatus(m[s][0], m[s][1]); if (s === "closed" && mode === "live") toScript("การเชื่อมต่อ AI สดสิ้นสุดแล้ว ใช้บทพูดในเกมแทน"); },
        npcText: (t) => { if (curUserEl) curUserEl = null; if (!curNpcEl) curNpcEl = add("npc", ""); curNpcEl.textContent += t; log.scrollTop = log.scrollHeight; },
        userText: (t) => { if (!curUserEl) curUserEl = add("user", ""); curUserEl.textContent += t; curNpcEl = null; log.scrollTop = log.scrollHeight; },
        turnEnd: () => { curNpcEl = null; curUserEl = null; setStatus(live && live.mic ? "กำลังฟังคุณ…" : "AI สด · พร้อมคุย", live && live.mic ? "rec" : "live"); },
      } });
    live = L; L.audioOn = true;
    L.start().then(() => { if (live !== L) return; mode = "live"; mic.disabled = false; add("sys", "เชื่อมต่อ AI สดแล้ว — พิมพ์ หรือกด 🎤 แล้วพูดได้เลย (แนะนำใส่หูฟัง)"); L.sendText("(ผู้เล่นเดินเข้ามาทักทายคุณ ช่วยทักทายสั้นๆ ตามบทบาท)"); input.focus(); })
      .catch((err) => { if (live !== L) return; if (G.panel === "chat") { live = null; try { L.close(); } catch (e) { /* */ } toScript("เชื่อมต่อ AI สดไม่ได้ (" + (err && err.message ? err.message : "error") + ") — ใช้บทพูดในเกมแทน"); } });
  }

  // ---------------------------------------------------------------- boot
  window.addEventListener("load", async () => {
    PW.initCanvas(); bindInput(); await preload(); buildTitle(); $("loading").hidden = true;
    if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).then((r) => r.update()).catch(() => {});
    if (/[?&]debug=1/.test(location.search)) window.__PW = { PW, G, startGame, openChat, openBag, openShop, openParty, openQuests, openMenu, openSkills, openPets, openBook, tap, toggleAuto };
    window.__PW_READY = true;
  });
})();
