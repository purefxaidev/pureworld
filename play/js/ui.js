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
    return Promise.all(names.map(([k, src]) => new Promise((res) => { const im = new Image(); im.onload = () => { G.imgs[k] = im; res(); }; im.onerror = () => res(); im.src = src; })));
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
    G.S = S; if (!G.W) G.W = PW.buildWorld();
    G.npcs = Object.values(PW.NPCS).map((n) => Object.assign({}, n, { x: n.x * T, y: n.y * T }));
    PW.spawnMonsters();
    const h = PW.mkHero(S.heroId, S.level, true); h.xp = S.xp || 0; PW.calcStats(h); h.hp = S.hp > 0 ? Math.min(S.hp, h.maxHp) : h.maxHp; h.mp = S.mp > 0 ? Math.min(S.mp, h.maxMp) : h.maxMp;
    h.x = S.x || G.W.spawn.x; h.y = S.y || G.W.spawn.y; if (PW.collides(G.W, h.x, h.y, 10)) { h.x = G.W.spawn.x; h.y = G.W.spawn.y; }
    G.hero = h; G.allies = (S.party || []).slice(0, 2).map((id, i) => { const a = PW.mkHero(id, h.level, false); a.x = h.x + 30; a.y = h.y + 20 * (i + 1); a.idx = i; return a; });
    G.autoHunt = false; G.cam.x = h.x; G.cam.y = h.y; G.lastZone = ""; G.t = 0;
    $("title").hidden = true; $("hud").hidden = false; $("controls").hidden = false; G.paused = false; G.running = true;
    $("hud-icon").src = "assets/img/" + S.heroId + "_icon.webp"; buildSkillButtons(); PW.updateHud(true); syncToggles();
    if (isNew) { PW.toast("ใช้จอยซ้าย/WASD เดิน · ปุ่มสกิลด้านขวา · คุยกับ NPC ในเมืองได้เลย", 5200); }
    if (!loopOn) { loopOn = true; let last = performance.now(); const frame = (now) => { const dt = Math.min(0.05, (now - last) / 1000); last = now; if (G.running && !G.paused) PW.update(dt); if (G.running) { PW.render(); PW.renderMinimap(); PW.updateHud(); updateSkillButtons(); updateTalk(); } requestAnimationFrame(frame); }; requestAnimationFrame(frame); }
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
  };
  PW.showZone = (z) => { const b = $("zonebanner"); if (!G.running) return; b.innerHTML = `<b>${z.name}</b><small>${z.lv}${z.danger && G.hero.level < z.danger ? " · อันตราย! แนะนำ Lv " + z.danger + "+" : ""}</small>`; b.classList.remove("show"); void b.offsetWidth; b.classList.add("show"); };
  function syncToggles() { $("tg-auto").classList.toggle("on", G.autoHunt); $("tg-atk").classList.toggle("on", G.S.settings.autoAtk); $("tg-snd").classList.toggle("on", G.S.settings.sound); }

  function buildSkillButtons() {
    const H = PW.HEROES[G.hero.id];
    [0, 1, 2].forEach((i) => { const b = $("btn-s" + i); b.style.setProperty("--c", H.color); b.innerHTML = `<i class="cd"></i><span class="k">${i + 1}</span><b>${H.skills[i].n}</b><small>MP ${H.skills[i].mp}</small>`; });
    $("btn-atk").style.setProperty("--c", H.color);
  }
  function updateSkillButtons() {
    const h = G.hero, H = PW.HEROES[h.id];
    [0, 1, 2].forEach((i) => { const b = $("btn-s" + i), cd = h.cds[i] / H.skills[i].cd; const v = Math.round(U.clamp(cd, 0, 1) * 100); const key = "s" + i; if (hc[key] !== v) { hc[key] = v; b.querySelector(".cd").style.height = v + "%"; } const low = h.mp < H.skills[i].mp; if (hc[key + "l"] !== low) { hc[key + "l"] = low; b.classList.toggle("low", low); } });
  }
  function updateTalk() { const b = $("btn-talk"), n = G.nearNpc; const v = n ? n.name : ""; if (hc.talk !== v) { hc.talk = v; b.hidden = !n; if (n) b.textContent = "คุยกับ " + n.name; } }

  // ---------------------------------------------------------------- input
  function bindInput() {
    const keys = G.keys;
    const upd = () => { let x = 0, y = 0; if (keys.a || keys.arrowleft) x -= 1; if (keys.d || keys.arrowright) x += 1; if (keys.w || keys.arrowup) y -= 1; if (keys.s || keys.arrowdown) y += 1; if (x && y) { x *= 0.7071; y *= 0.7071; } if (!stick.on) { G.input.x = x; G.input.y = y; } };
    window.addEventListener("keydown", (e) => {
      if (!G.running) return; const tag = (e.target.tagName || "").toLowerCase(); if (tag === "input" || tag === "textarea") { if (e.key === "Escape") closePanel(); return; }
      const k = e.key.toLowerCase();
      if (G.panel) { if (k === "escape") closePanel(); return; }
      keys[k] = true; upd();
      if (k === " " || k === "j") { e.preventDefault(); manualAttack(); } else if (k === "1" || k === "2" || k === "3") PW.castSkill(G.hero, +k - 1); else if (k === "q") PW.usePotion("hp"); else if (k === "r") PW.usePotion("mp");
      else if (k === "e") talk(); else if (k === "b") openBag(); else if (k === "p") openParty(); else if (k === "o") openQuests(); else if (k === "h") toggleAuto(); else if (k === "escape") openMenu();
    });
    window.addEventListener("keyup", (e) => { keys[e.key.toLowerCase()] = false; upd(); });
    window.addEventListener("blur", () => { for (const k in keys) keys[k] = false; upd(); });
    // floating stick + tap
    const zone = $("touchzone"), base = $("stick"), knob = $("knob"); const stick = { on: false, id: -1, sx: 0, sy: 0, t0: 0, moved: 0 };
    zone.addEventListener("pointerdown", (e) => { if (G.panel || stick.on) return; PW.audioUnlock(); stick.on = true; stick.id = e.pointerId; stick.sx = e.clientX; stick.sy = e.clientY; stick.t0 = performance.now(); stick.moved = 0; zone.setPointerCapture(e.pointerId); base.style.left = e.clientX + "px"; base.style.top = e.clientY + "px"; base.classList.add("on"); knob.style.transform = "translate(-50%,-50%)"; });
    zone.addEventListener("pointermove", (e) => { if (!stick.on || e.pointerId !== stick.id) return; let dx = e.clientX - stick.sx, dy = e.clientY - stick.sy; const d = Math.hypot(dx, dy), R = 50; stick.moved = Math.max(stick.moved, d); if (d > R) { dx = dx / d * R; dy = dy / d * R; } knob.style.transform = `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`; if (stick.moved > 8) { G.input.x = dx / R; G.input.y = dy / R; } });
    const end = (e) => { if (!stick.on || e.pointerId !== stick.id) return; stick.on = false; base.classList.remove("on"); G.input.x = 0; G.input.y = 0; upd(); if (stick.moved < 9 && performance.now() - stick.t0 < 400) tap(e.clientX, e.clientY); };
    zone.addEventListener("pointerup", end); zone.addEventListener("pointercancel", end);
    const on = (id, fn) => { const b = $(id); b.addEventListener("pointerdown", (e) => { e.preventDefault(); PW.audioUnlock(); fn(); }); };
    on("btn-atk", manualAttack); on("btn-s0", () => PW.castSkill(G.hero, 0)); on("btn-s1", () => PW.castSkill(G.hero, 1)); on("btn-s2", () => PW.castSkill(G.hero, 2));
    on("btn-hp", () => PW.usePotion("hp")); on("btn-mp", () => PW.usePotion("mp")); on("btn-talk", talk);
    const click = (id, fn) => $(id).addEventListener("click", () => { PW.audioUnlock(); PW.sfx("click"); fn(); });
    click("hb-bag", openBag); click("hb-party", openParty); click("hb-quest", openQuests); click("hb-menu", openMenu); click("tg-auto", toggleAuto);
    click("tg-atk", () => { G.S.settings.autoAtk = !G.S.settings.autoAtk; syncToggles(); }); click("tg-snd", () => { G.S.settings.sound = !G.S.settings.sound; syncToggles(); });
    $("modal").addEventListener("click", onModalClick);
    document.addEventListener("visibilitychange", () => { if (document.hidden && G.running) PW.save(); });
    window.addEventListener("pagehide", () => { if (G.running) PW.save(); });
  }
  function manualAttack() { const h = G.hero; if (h.dead || G.paused) return; const H = PW.HEROES[h.id]; const ms = PW.monstersNear(h.x, h.y, H.range + 24); let best = null, bd = 1e9; for (const m of ms) { const d = Math.hypot(m.x - h.x, m.y - h.y); if (d < bd) { bd = d; best = m; } } if (best) PW.basicAttack(h, best); }
  function toggleAuto() { if (G.panel || !G.running) return; G.autoHunt = !G.autoHunt; syncToggles(); PW.toast(G.autoHunt ? "ล่าอัตโนมัติ: เปิด (แตะจอยเพื่อควบคุมเอง)" : "ล่าอัตโนมัติ: ปิด"); }
  function tap(sx, sy) { const w = PW.screenToWorld(sx, sy); for (const n of G.npcs) if (Math.hypot(n.x - w.x, n.y - w.y) < 34) { if (Math.hypot(n.x - G.hero.x, n.y - G.hero.y) < 90) openChat(n); else PW.toast("เดินเข้าไปใกล้ " + n.name + " ก่อนนะ"); return; } }
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
    else if (a === "buy") buy(b.dataset);
    else if (a === "recruit") { const id = v; const i = G.allies.findIndex((x) => x.id === id); if (i >= 0) { G.allies.splice(i, 1); } else if (G.allies.length < 2) { const al = PW.mkHero(id, G.hero.level, false); al.x = G.hero.x + 30; al.y = G.hero.y + 20; G.allies.push(al); PW.playVoice(id, 1); } else PW.toast("ทีมเต็มแล้ว (สูงสุด 2 คน)"); openParty(); }
    else if (a === "claim") claimQuest();
    else if (a === "save") { PW.save(); PW.toast("บันทึกแล้ว ✓"); }
    else if (a === "install") { if (deferredInstall) { deferredInstall.prompt(); deferredInstall = null; } else PW.toast("iPhone: กดปุ่มแชร์ → เพิ่มลงในหน้าจอโฮม · Android: เมนูเบราว์เซอร์ → ติดตั้งแอป", 5000); }
    else if (a === "fullscreen") { const d = document.documentElement; if (d.requestFullscreen) d.requestFullscreen().catch(() => {}); }
    else if (a === "reset") { if (confirm("ลบเซฟและกลับไปเลือกฮีโรอีนใหม่?")) { PW.wipeSave(); location.reload(); } }
    else if (a === "revive") { closePanel(); PW.revive(); }
    else if (a === "titleback") { PW.save(); location.reload(); }
  }

  function statBlock() {
    const h = G.hero; return `<div class="stats"><span>โจมตี <b>${Math.round(h.atk)}</b></span><span>ป้องกัน <b>${Math.round(h.def)}</b></span><span>HP <b>${h.maxHp}</b></span><span>MP <b>${h.maxMp}</b></span><span>คริ <b>${Math.round(h.crit * 100)}%</b></span><span>ความเร็ว <b>${h.spd}</b></span></div>`;
  }
  function itemRow(it, acts) { return `<div class="item" style="--rc:${PW.RARITY[it.rar].c}"><div><b>${esc(it.name)}</b><small>${PW.itemStats(it)}</small></div><div class="acts">${acts}</div></div>`; }
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
      rows = P.map((p) => `<div class="item"><div><b>${p[3]}</b><small>${p[4]}</small></div><div class="acts"><button data-act="buy" data-k="pot" data-t="${p[0]}" data-n="${p[1]}" data-p="${p[2]}">${p[2]}G</button></div></div>`).join("");
    } else {
      const tiers = PW.TIERS.map((t, i) => i + 1).filter((t) => PW.TIERS[t - 1].lv <= lv + 3).slice(-3);
      for (const t of tiers) for (const s of Object.keys(PW.SLOTS)) { const it = PW.makeItem(s, t, 0); S.nextId--; const price = it.val * 2; rows += itemRow(it, `<button data-act="buy" data-k="gear" data-s="${s}" data-t="${t}" data-p="${price}">${U.fmt(price)}G</button>`); }
      rows += `<p class="muted">ของที่ดรอปจากมอนสเตอร์อาจมีค่าสถานะสูงกว่า ลองเก็บเลเวลหาของดีด้วยนะ</p>`;
    }
    openPanel(`<div class="ph"><h2>${npc.title} · ${npc.name}</h2><button data-act="close" class="x">✕</button></div><p class="potions">ทอง <b id="shop-gold">${U.fmt(S.gold)}</b> · ยาแดง <b>${S.hpPot}</b> · ยาน้ำเงิน <b>${S.mpPot}</b></p><div class="list">${rows}</div><div class="foot"><button data-act="chat" data-v="${npc.id}">กลับไปคุย</button></div>`, "shop");
  }
  function buy(d) {
    const S = G.S, p = +d.p; if (S.gold < p) return PW.toast("ทองไม่พอ");
    if (d.k === "pot") { S.gold -= p; if (d.t === "hp") S.hpPot += +d.n; else S.mpPot += +d.n; }
    else { if (S.bag.length >= 40) return PW.toast("กระเป๋าเต็ม"); S.gold -= p; const it = PW.makeItem(d.s, +d.t, 0); S.bag.push(it); PW.toast("ซื้อ " + it.name + " แล้ว (ดูในกระเป๋า)"); }
    PW.sfx("coin"); $("shop-gold").textContent = U.fmt(S.gold); PW.updateHud(true);
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
      <div class="menu"><button data-act="save">💾 บันทึกเกม</button><button data-act="install">📲 ติดตั้งเป็นแอป</button><button data-act="fullscreen">⛶ เต็มจอ</button><button data-act="titleback">🏠 กลับหน้าแรก</button><button data-act="reset" class="sub">🗑 เริ่มใหม่ทั้งหมด</button></div>
      <p class="muted">NPC: ${mode}</p><p class="muted">เซฟอัตโนมัติทุก 8 วินาที · เล่น ${Math.floor(S.played / 60)} นาที</p>
      <h3>ปุ่มลัดคีย์บอร์ด</h3><p class="muted">WASD/ลูกศร เดิน · Space/J โจมตี · 1/2/3 สกิล · Q/R ยาแดง/ยาน้ำเงิน · E คุย NPC · B กระเป๋า · P ทีม · O ภารกิจ · H ล่าอัตโนมัติ · Esc เมนู</p>
      <p class="muted credit">PureWorld · สร้างโดย PureFxAi · ภาพและเสียงสร้างด้วย AI</p>`, "menu");
  }
  PW.showDeath = () => { openPanel(`<div class="ph"><h2>ล้มแล้ว...</h2></div><p>${PW.HEROES[G.hero.id].name} หมดแรง ฟื้นที่เมืองพิวร์ (เสียทอง 10%)</p><div class="foot"><button data-act="revive" class="big">ฟื้นที่เมือง</button></div>`, "death"); };

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
    if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) navigator.serviceWorker.register("sw.js").catch(() => {});
    if (/[?&]debug=1/.test(location.search)) window.__PW = { PW, G, startGame, openChat, openBag, openShop, openParty, openQuests, openMenu };
    window.__PW_READY = true;
  });
})();
