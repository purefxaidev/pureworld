# PureWorld NPC Worker (Gemini Live token broker)

Cloudflare Worker that lets the PureWorld web/mobile client talk to **Gemini Live (native audio)**
**without ever shipping your `GEMINI_API_KEY` to the browser**.

```
Browser ──POST /token {npc, hero}──▶ Worker (holds GEMINI_API_KEY as a secret)
        ◀── { token: "auth_tokens/…" } ── Worker calls  POST /v1beta/auth_tokens
Browser ──WebSocket (access_token=auth_tokens/…)──▶ Gemini Live  (BidiGenerateContentConstrained)
```

* The token is **single-use** (`uses: 1`), must start its session within **60 s**, and expires after
  `SESSION_MINUTES` (default 15).
* Each NPC's **system instruction (personality), prebuilt voice, model and response modality are locked inside the token**
  (`bidiGenerateContentSetup`, no `fieldMask`) — the client cannot change them. Personas live in `src/npcs.js`.
* Model: `gemini-3.8-live` (set `LIVE_MODEL` to change, e.g. `gemini-2.5-flash-native-audio-latest`).
* Voices: ป้าพรม=Vindemiatrix, ลุงเหล็ก=Orus, น้องมะลิ=Zephyr, ตาปู่ศักดิ์=Charon.
* If the Worker is not configured or fails, the game automatically falls back to scripted Thai dialogue.

## Deploy (≈ 5 minutes)

Requirements: a free Cloudflare account, Node 18+, and a Gemini API key from <https://aistudio.google.com/apikey>.

```bash
cd worker
npm install                         # installs wrangler
npx wrangler login                  # opens browser once
npx wrangler secret put GEMINI_API_KEY   # paste your key when prompted (stored encrypted, never in git)
```

Edit `wrangler.toml` → `ALLOWED_ORIGINS` so it contains the origin of your game
(e.g. `https://<your-user>.github.io`; keep `capacitor://localhost` / `https://localhost` if you wrap the app with Capacitor).

```bash
npx wrangler deploy
# → https://pureworld-npc.<your-subdomain>.workers.dev
curl https://pureworld-npc.<your-subdomain>.workers.dev/health
```

Then point the game at it: edit `play/js/config.js`

```js
window.PW_CONFIG = { NPC_API_URL: "https://pureworld-npc.<your-subdomain>.workers.dev" };
```

Commit & push (GitHub Pages redeploys). Open the game → talk to an NPC → status chip shows **“AI สด · พร้อมคุย”**;
type or tap 🎤 to speak. (Headphones recommended to avoid echo.)

## Local testing

```bash
cd worker
GEMINI_API_KEY=your_key node dev-server.mjs      # http://localhost:8787 (same code as the Worker)
# in another shell, from the repo root:
python3 -m http.server 8080
# temporarily set NPC_API_URL to http://localhost:8787 in play/js/config.js (or run tests/e2e.py --live http://127.0.0.1:8787)
```

## Hardening / cost control

* Keep `ALLOWED_ORIGINS` to your own origin(s) (the Worker rejects other browsers' `Origin`).
* Add a Cloudflare **Rate Limiting rule** on `POST /token` (the built-in per-isolate limiter is only best-effort).
* Set a **quota / budget alert** on the Gemini API key in Google AI Studio / Cloud Console.
* Rotate the key any time with `npx wrangler secret put GEMINI_API_KEY`.

## API

`POST /token` body `{ "npc": "prom|lek|mali|sak", "hero": { "id": "tank|fighter|mage|marksman|assassin|support", "level": 1 } }`
→ `{ token, model, voice, npcName, expiresAt, newSessionExpiresAt }`

`GET /health` → service info (no secrets).
