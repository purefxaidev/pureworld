# PureWorld 🌸⚔️ — เกม RPG อนิเมะสายเก็บเลเวล (ภาษาไทย)

เกม HTML5 เล่นบนเว็บและมือถือ (PWA) — เลือกฮีโรอีน 1 ใน 6 อาชีพ เก็บเลเวล ล่ามอนสเตอร์ ตั้งทีม AI และคุยกับ NPC ที่ตอบเองได้

* **Landing page:** `/` (root of GitHub Pages)  
* **Game:** `/play/`
* Code: MIT · Art/voice: generated with AI tools for the PureWorld project (all rights reserved by PureFxAi unless stated)

## What's new in v2

* **Controls fixed** — always-visible joystick bottom-left (also re-centres wherever you touch the lower-left), drag anywhere on the map,
  **tap/click the ground to walk there**, tap a monster to attack it, tap an NPC to walk over and talk. Keyboard uses physical key codes,
  so WASD works with the **Thai keyboard layout** too. First-play hint overlay. Service worker bumped to `pureworld-v2` (old cache purged).
* **Graphics overhaul** — every sprite, tile texture, icon, panel frame and banner is AI-generated in one anime style (transparent WebP, ~1 MB):
  textured zone ground, animated chibi heroines (bob/squash/facing/shadows), monster + boss sprites, hit sparks, damage numbers,
  skill VFX particles, glowing UI, smooth camera, vignette and ambient particles.
* **Pets** — 6 pets (eggs from monsters or the shop). One active pet follows you, auto-attacks, vacuums loot, gives a stat bonus, levels up and evolves (Lv10/Lv20 + gems).
* **Monster capture → minions** — weaken a monster, throw a *ผนึกวิญญาณ* (capture crystal, bought or dropped). Chance depends on HP %, rarity and level.
  Captured monsters become cute tamed minions that fight beside you; collection book *สมุดสมุน*.
* **Skill upgrades** — 1 skill point per level; raise each skill to Lv10 (damage, cooldown, area; Lv5/Lv10 bonus effects), unlock a passive (Lv5) and an ultimate (Lv10).
* **AUTO farm** — one big AUTO button: paths out of town to the right zone, hunts the nearest monster, uses skills (toggle), picks up loot,
  drinks potions below a configurable HP %, pets assist, auto-revives after death and resumes. Moving manually overrides AUTO, then it resumes.

## Features

* 6 ฮีโรอีนอนิเมะ: แทงก์ เกราะแก้ว · นักสู้ พยัคฆ์ · จอมเวท จันทรา · มือธนู สายฟ้า · นักฆ่า คมเงา · ซัพพอร์ต ไหมทอง  
  แต่ละคนมีบุคลิก เสียงพากย์ไทย (เลือกตัว / ใช้สกิล / เลเวลอัป) 3 สกิล + พาสซีฟ + อัลติเมต
* แมพ top-down 5 โซน: เมืองพิวร์ (ปลอดภัย), ทุ่งหญ้า, ป่าหมอก, ทะเลทรายซากเมือง, ยอดเขาน้ำแข็ง + บอส “ราชาหิมะ ฟรอสต์”
* ต่อสู้: ตีอัตโนมัติ/แตะโจมตี + สกิล, **AUTO ฟาร์ม**, ยาแดง/ยาน้ำเงิน, XP/ทอง/ของดรอปบนพื้น, เลเวลสูงสุด 50
* สัตว์เลี้ยง 6 ตัว + จับมอนสเตอร์ 8 ชนิดเป็นสมุน + สมุดสมุน
* อุปกรณ์ 3 ช่อง 6 ระดับ, ร้านยา (ผนึก/ไข่/ขนม/อัญมณี) ร้านตีเหล็ก, ภารกิจกิลด์, เพื่อนร่วมทีม AI สูงสุด 2 คน
* **NPC 4 คนที่ตอบเอง** — โหมด **AI สด** (Gemini Live ผ่าน Worker ของคุณ) หรือโหมดสำรองบทพูดสคริปต์ (ใช้ได้ทันที)
* PWA: manifest + service worker (ติดตั้งลงหน้าจอโฮม, ออฟไลน์ได้), เซฟใน `localStorage`
* ไม่มีความลับใน client — **`GEMINI_API_KEY` อยู่ใน Worker เท่านั้น**

### Controls

| | Mobile | Desktop |
|---|---|---|
| Move | joystick bottom-left · drag on map · tap ground | WASD / arrows · click ground · drag |
| Attack / target | ⚔ button · tap a monster | Space / J · click a monster |
| Skills · Ultimate | 3 skill buttons · ✦ ult | 1 2 3 · 4 or F |
| Capture | ผนึก button | C |
| AUTO | AUTO button | H |
| Panels | สกิล / สัตว์เลี้ยง / สมุดสมุน / กระเป๋า … | K skills · L pets · N book · B bag · P party · O quests · E talk · Q/R potions · Esc menu |

## Repo layout

```
index.html            Landing page                       assets/          landing images (banner, og, QR)
play/                 The game (static, no build)
play/js/              config data world core assets combat systems render npc ui
play/assets/sprites/  generated game sprites (webp)      play/assets/img|audio|fonts   portraits, voice, fonts
play/sw.js            service worker                     play/manifest.webmanifest
art_src/              generated source art (jpg)         tools/process_art.py   -> play/assets/sprites/*.webp
tools/serve.mjs       zero-dependency static server      package.json   npm scripts
worker/               Cloudflare Worker (Gemini Live ephemeral token broker) + README
mobile/               Capacitor config example
tests/                Playwright tests (controls, systems, e2e, landing, smoke)
```

## Run locally

Requirements: **Node 18+** (or just Python 3). No build step, no dependencies — vanilla JS + Canvas 2D.

```bash
git clone https://github.com/purefxaidev/pureworld && cd pureworld
npm start                          # = node tools/serve.mjs 8080
# or: python3 -m http.server 8080  (from the repo root)
# landing: http://localhost:8080/    game: http://localhost:8080/play/
```

To test on your phone on the same Wi-Fi: open `http://<your-PC-LAN-IP>:8080/play/` (the PWA service worker only installs on `localhost`/https,
everything else works). If you previously played an older version, a hard refresh (or closing the tab once) picks up the new service worker.

### Live AI NPC locally (optional)

```bash
cd worker && npm install
echo 'GEMINI_API_KEY=your-key-here' > .dev.vars     # git-ignored; never commit it
npm run dev                                          # = npx wrangler dev  -> http://127.0.0.1:8787
# (alternative without wrangler: GEMINI_API_KEY=... node dev-server.mjs)
```

Then set `window.PW_CONFIG = { NPC_API_URL: "http://127.0.0.1:8787" }` in `play/js/config.js` (don't commit that change) and reload the game.

### Regenerate sprites (optional)

`npm run art` (= `python3 tools/process_art.py`, needs `pip install pillow numpy`) cuts the generated sheets in `art_src/`
(background removal, trimming, icon grids, seamless textures) into `play/assets/sprites/*.webp` and the landing banners.

## Enable live AI NPC (Gemini Live voice) — optional

1. Deploy the Worker (full guide in [`worker/README.md`](worker/README.md)):
   ```bash
   cd worker && npm install
   npx wrangler login
   npx wrangler secret put GEMINI_API_KEY      # paste your key; it is stored encrypted by Cloudflare, never in this repo
   npx wrangler deploy
   ```
2. Put the Worker URL in `play/js/config.js`:
   ```js
   window.PW_CONFIG = { NPC_API_URL: "https://pureworld-npc.<subdomain>.workers.dev" };
   ```
3. Edit `ALLOWED_ORIGINS` in `worker/wrangler.toml` to your game origin, push.

How it stays safe: the Worker calls `POST /v1beta/auth_tokens` and returns a **single-use ephemeral token** (60 s to open a session,
15 min lifetime) whose setup — model `gemini-3.8-live`, NPC system instruction, prebuilt voice — is **locked server-side**.
The browser opens the Live WebSocket (`BidiGenerateContentConstrained?access_token=…`) directly with that token.
If anything fails the game silently falls back to scripted dialogue.

## Tests

```bash
npm run test:setup               # pip install playwright && playwright install chromium (bundled browser)
npm start &                      # or python3 -m http.server 8080 &
npm run test:controls            # moves the heroine with every input: CDP touch joystick/drag/tap (iPhone, Android, landscape),
                                 # keyboard (incl. Thai layout), mouse click-to-move, drag, click-to-attack
npm run test:systems             # skill points/upgrades/passive/ult, pets hatch/feed/evolve/follow, capture -> minion + book,
                                 # shop extras, AUTO farm gains XP/levels with zero input, auto potion, override+resume, auto-revive
npm run test:e2e                 # hero select, NPC chat fallback, shop, gear, party, fight, level-up, save/continue
npm run test:landing             # landing page checks + screenshots
```

All tests accept a base URL (`python3 tests/controls.py https://purefxaidev.github.io/pureworld`) and use Playwright's bundled Chromium,
or your own browser via `CHROME_PATH=/path/to/chrome`. Screenshots and JSON results go to `screens/`.
With the dev worker running: `python3 tests/e2e.py --live http://127.0.0.1:8787` also tests Gemini Live text + mic + key-leak check.

## Wrap as a real mobile app (Capacitor → Play Store / App Store)

The game is a static web app, so it can be wrapped without code changes:

```bash
mkdir pureworld-app && cd pureworld-app
npm init -y
npm i @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios
cp ../mobile/capacitor.config.example.json capacitor.config.json     # webDir points to ../play
npx cap add android && npx cap add ios
npx cap sync
npx cap open android      # Android Studio → Build ▸ Generate Signed Bundle (AAB) → Play Console
npx cap open ios          # Xcode → Product ▸ Archive → App Store Connect (needs Apple Developer account)
```

Notes:
* Add the **microphone** permission for voice NPC: Android `<uses-permission android:name="android.permission.RECORD_AUDIO"/>`; iOS `NSMicrophoneUsageDescription` in `Info.plist`.
* Use the deployed **https** Worker URL in `NPC_API_URL`; keep `https://localhost` and `capacitor://localhost` in the Worker's `ALLOWED_ORIGINS`.
* Replace icons/splash with `npx @capacitor/assets generate` using `play/assets/img/icon-512.png`.
* The service worker is optional inside Capacitor (assets are bundled).

## Known limitations

* Sprites are single-frame images animated procedurally (bob/squash/lunge), not frame-by-frame animation.
* Single-player, single save slot (browser `localStorage`; clearing site data deletes progress).
* Live voice NPC needs your own Worker + Gemini key (the landing/game work without it using scripted replies); Gemini Live is a preview API.
* Echo can occur on speakers when using the mic — use headphones.

## 💛 Support / Donate

PureWorld is free. If you'd like to support development, you can donate **USDT (ERC20 / Ethereum network only)**:

```
0x920deab53daf94ca2030ad5ceec2265bf5686941
```

Send only USDT on the **Ethereum (ERC20)** network. Donations are voluntary, are not an investment and carry no returns.

---
Made by **PureFxAi**.
