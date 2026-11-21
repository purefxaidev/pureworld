# PureWorld 🌸⚔️ — เกม RPG อนิเมะสายเก็บเลเวล (ภาษาไทย)

เกม HTML5 เล่นบนเว็บและมือถือ (PWA) — เลือกฮีโรอีน 1 ใน 6 อาชีพ เก็บเลเวล ล่ามอนสเตอร์ ตั้งทีม AI และคุยกับ NPC ที่ตอบเองได้

* **Landing page:** `/` (root of GitHub Pages)  
* **Game:** `/play/`
* Code: MIT · Art/voice: generated with AI tools for the PureWorld project (all rights reserved by PureFxAi unless stated)

## Features

* 6 ฮีโรอีนอนิเมะ: แทงก์ เกราะแก้ว · นักสู้ พยัคฆ์ · จอมเวท จันทรา · มือธนู สายฟ้า · นักฆ่า คมเงา · ซัพพอร์ต ไหมทอง  
  แต่ละคนมีบุคลิก เสียงพากย์ไทย (เลือกตัว / ใช้สกิล / เลเวลอัป) และ 3 สกิลตามอาชีพ
* แมพ top-down 5 โซน: เมืองพิวร์ (ปลอดภัย), ทุ่งหญ้า, ป่าหมอก, ทะเลทรายซากเมือง, ยอดเขาน้ำแข็ง + บอส “ราชาหิมะ ฟรอสต์”
* ต่อสู้: ตีอัตโนมัติ/แตะโจมตี + สกิล 3 ท่า, **ล่าอัตโนมัติ** (grinding), ยาแดง/ยาน้ำเงิน, XP/ทอง/ดรอป, เลเวลสูงสุด 50
* อุปกรณ์ 3 ช่อง (อาวุธ/เกราะ/เครื่องประดับ) 6 ระดับ, ร้านยา ร้านตีเหล็ก, ภารกิจกิลด์
* เพื่อนร่วมทีม AI สูงสุด 2 คน (ฮีโรอีนคนอื่น ๆ สู้และฮีลเอง)
* **NPC 4 คนที่ตอบเอง** (ป้าพรม, ลุงเหล็ก, น้องมะลิ, ตาปู่ศักดิ์):
  * โหมด **AI สด** — พิมพ์หรือพูดผ่านไมค์ ตอบเป็นเสียงไทย native audio ผ่าน **Gemini Live API** (ephemeral token จาก Cloudflare Worker — ดู `worker/`)
  * โหมด **สำรอง** — บทพูดสคริปต์ประจำตัวละคร ใช้ได้ทันทีโดยไม่ต้องตั้งค่าอะไร (เมื่อ `NPC_API_URL` ว่างหรือเชื่อมต่อไม่ได้)
* รองรับจอสัมผัส (จอยลอย) + คีย์บอร์ด (WASD/ลูกศร, Space, 1-3 ฯลฯ), responsive
* PWA: manifest + service worker (ติดตั้งลงหน้าจอโฮม, ออฟไลน์ได้), เซฟใน `localStorage`
* ไม่มีความลับใน client — **`GEMINI_API_KEY` อยู่ใน Worker เท่านั้น**

## Repo layout

```
index.html            Landing page (PureWorld)        assets/        landing images (banner, og, QR)
play/                 The game (static, no build)     play/js/       config.js data.js world.js core.js combat.js render.js npc.js ui.js
play/assets/          hero + NPC art (webp), voice (mp3), fonts, icons
play/sw.js            service worker                  play/manifest.webmanifest
worker/               Cloudflare Worker (Gemini Live ephemeral token broker) + README
mobile/               Capacitor config example
tests/                Playwright end-to-end tests (e2e.py, landing.py)
```

## Run locally

```bash
python3 -m http.server 8080        # from the repo root
# landing: http://localhost:8080/   game: http://localhost:8080/play/
```

No build step or dependencies — vanilla JS + Canvas 2D.

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
pip install playwright           # uses system Chrome: /usr/bin/google-chrome
python3 -m http.server 8080 &
python3 tests/landing.py         # landing page checks + screenshots
python3 tests/e2e.py             # game: select hero, move, chat (fallback), shop, party, fight, level-up, save/continue
# with the dev worker running (GEMINI_API_KEY=… node worker/dev-server.mjs):
python3 tests/e2e.py --live http://127.0.0.1:8787     # also tests Gemini Live text + mic + key-leak check
```

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

* Hero/monster art on the map is a portrait token (not animated sprites); monsters are procedurally drawn.
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
