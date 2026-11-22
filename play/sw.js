// PureWorld service worker: precache the app shell + assets, runtime cache for the rest.
// Live NPC traffic (token endpoint + Google WebSocket) is never cached.
const VERSION = "pureworld-v3.2";
const CORE = [
  "./", "index.html", "manifest.webmanifest", "css/style.css",
  "js/config.js", "js/atlasmeta.js", "js/data.js", "js/world.js", "js/core.js", "js/audio.js", "js/assets.js", "js/anim.js", "js/combat.js", "js/systems.js", "js/render.js", "js/npc.js", "js/ui.js",
  "assets/fonts/Kanit-Bold.ttf", "assets/fonts/Sarabun-Regular.ttf", "assets/fonts/Sarabun-SemiBold.ttf",
  "assets/img/favicon.png", "assets/img/apple-touch-icon.png", "assets/img/icon-192.png", "assets/img/icon-512.png", "assets/img/banner.webp",
];
const HEROES = ["tank", "fighter", "mage", "marksman", "assassin", "support"];
const NPCS = ["prom", "lek", "mali", "sak"];
const ASSETS = [
  ...HEROES.flatMap((h) => [`assets/img/${h}.webp`, `assets/img/${h}_icon.webp`, `assets/audio/${h}_1.mp3`, `assets/audio/${h}_2.mp3`, `assets/audio/${h}_3.mp3`]),
  ...NPCS.flatMap((n) => [`assets/img/npc_${n}.webp`, `assets/img/npc_${n}_icon.webp`]),
];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then(async (c) => { await c.addAll(CORE); await Promise.all(ASSETS.map((u) => c.add(u).catch(() => {}))); }).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request; if (req.method !== "GET") return;
  const url = new URL(req.url); if (url.origin !== location.origin) return; // cross-origin (worker/live) passes through
  if (req.mode === "navigate" || url.pathname.endsWith(".js") || url.pathname.endsWith(".css")) {
    // network-first for code so updates ship, fall back to cache offline
    e.respondWith(fetch(req).then((r) => { const cp = r.clone(); caches.open(VERSION).then((c) => c.put(req, cp)); return r; }).catch(() => caches.match(req, { ignoreSearch: true }).then((m) => m || caches.match("index.html"))));
    return;
  }
  e.respondWith(caches.match(req).then((m) => m || fetch(req).then((r) => { const cp = r.clone(); caches.open(VERSION).then((c) => c.put(req, cp)); return r; })));
});
