// Sprite loading (AI-generated art in assets/sprites/*.webp) + derived assets (white hit-flash silhouettes, darker variants).
(function () {
  const PW = window.PW, G = PW.G;
  const S = (G.spr = {});
  const LIST = [];
  PW.HERO_ORDER.forEach((h) => { LIST.push("hero_" + h, "skill_" + h + "_0", "skill_" + h + "_1", "skill_" + h + "_2", "ult_" + h); });
  Object.keys(PW.MONSTERS).forEach((m) => LIST.push("mon_" + m, "tamed_" + m));
  Object.keys(PW.PETS).forEach((p) => LIST.push("pet_" + p));
  ["sword", "armor", "amulet", "hpot", "mpot", "crystal", "egg", "gold", "book", "treat", "gem", "chest"].forEach((i) => LIST.push("item_" + i));
  ["tree", "pine", "snowpine", "cactus", "rock", "bush", "pillar", "icecrystal", "house", "fountain", "stall", "lamp"].forEach((p) => LIST.push("prop_" + p));
  ["prom", "lek", "mali", "sak"].forEach((n) => LIST.push("npc_" + n));
  ["grass", "forest", "sand", "snow", "town"].forEach((t) => LIST.push("tex_" + t));
  PW.SPRITE_LIST = LIST;
  PW.sprUrl = (k) => "assets/sprites/" + k + ".webp";

  function silhouette(im, color) {
    const c = document.createElement("canvas"); c.width = im.width; c.height = im.height; const g = c.getContext("2d");
    g.drawImage(im, 0, 0); g.globalCompositeOperation = "source-in"; g.fillStyle = color; g.fillRect(0, 0, c.width, c.height); return c;
  }
  function tinted(im, color, a) {
    const c = document.createElement("canvas"); c.width = im.width; c.height = im.height; const g = c.getContext("2d");
    g.drawImage(im, 0, 0); g.globalCompositeOperation = "source-atop"; g.globalAlpha = a; g.fillStyle = color; g.fillRect(0, 0, c.width, c.height); return c;
  }
  PW.loadSprites = (onProgress) => {
    let done = 0;
    return Promise.all(LIST.map((k) => new Promise((res) => {
      const im = new Image(); im.decoding = "async";
      im.onload = () => { S[k] = im; done++; onProgress && onProgress(done / LIST.length); res(); };
      im.onerror = () => { done++; res(); }; im.src = PW.sprUrl(k);
    }))).then(() => {
      for (const k of LIST) if (S[k] && (k.startsWith("hero_") || k.startsWith("mon_") || k.startsWith("tamed_") || k.startsWith("pet_"))) S[k + "#w"] = silhouette(S[k], "#ffffff");
      if (S.prop_tree) S["prop_tree#dark"] = tinted(S.prop_tree, "#0b2a1c", 0.35);
      if (S.prop_pine) S["prop_pine#dark"] = tinted(S.prop_pine, "#0b2a1c", 0.3);
      if (S.prop_rock) { S["prop_rock#ice"] = tinted(S.prop_rock, "#cfe6ff", 0.45); S["prop_rock#sand"] = tinted(S.prop_rock, "#d8b878", 0.4); }
    });
  };
  // lazy single sprite (evolved pet / minion art): resolves when S[k] is ready
  const pend = {};
  PW.loadSpr = (k) => pend[k] || (pend[k] = new Promise((res) => { const im = new Image(); im.decoding = "async"; im.onload = () => { S[k] = im; res(im); }; im.onerror = () => { res(null); setTimeout(() => { delete pend[k]; }, 2000); }; im.src = PW.sprUrl(k); }));
  // draw sprite anchored at bottom-centre, height in world px
  PW.drawSpr = (c, k, x, y, h, flip, alpha) => {
    const im = S[k]; if (!im) return 0; const w = h * im.width / im.height;
    if (alpha != null) c.globalAlpha = alpha;
    if (flip) { c.save(); c.translate(x, y); c.scale(-1, 1); c.drawImage(im, -w / 2, -h, w, h); c.restore(); } else c.drawImage(im, x - w / 2, y - h, w, h);
    if (alpha != null) c.globalAlpha = 1; return w;
  };
})();
