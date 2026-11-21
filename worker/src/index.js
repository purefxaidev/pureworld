// PureWorld NPC token broker (Cloudflare Worker).
// Mints single-use Gemini Live *ephemeral* auth tokens. GEMINI_API_KEY never leaves this Worker.

import { NPCS, buildSystemInstruction } from "./npcs.js";

const DEFAULT_MODEL = "gemini-3.8-live";
const HEROES = {
  tank: ["เกราะแก้ว", "แทงก์"], fighter: ["พยัคฆ์", "นักสู้"], mage: ["จันทรา", "จอมเวท"],
  marksman: ["สายฟ้า", "มือธนู"], assassin: ["คมเงา", "นักฆ่า"], support: ["ไหมทอง", "ซัพพอร์ต"],
};

// best-effort per-isolate rate limit (add Cloudflare Rate Limiting rules for real protection)
const hits = new Map();
function limited(ip, max = 20, windowMs = 10 * 60 * 1000) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > max;
}

function corsHeaders(req, env) {
  const origin = req.headers.get("Origin") || "";
  const allowed = (env.ALLOWED_ORIGINS || "*").split(",").map((s) => s.trim()).filter(Boolean);
  const ok = allowed.includes("*") || allowed.includes(origin);
  return {
    "Access-Control-Allow-Origin": ok ? (allowed.includes("*") ? "*" : origin) : allowed[0] || "null",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
    _ok: ok,
  };
}

function json(data, status, cors) {
  const h = { ...cors };
  delete h._ok;
  return new Response(JSON.stringify(data), { status, headers: { ...h, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}

export async function handle(req, env) {
  const cors = corsHeaders(req, env);
  const url = new URL(req.url);
  if (req.method === "OPTIONS") return json({}, 204, cors);
  if (url.pathname === "/" || url.pathname === "/health") return json({ ok: true, service: "pureworld-npc", model: env.LIVE_MODEL || DEFAULT_MODEL, npcs: Object.keys(NPCS) }, 200, cors);
  if (url.pathname !== "/token" || req.method !== "POST") return json({ error: "not_found" }, 404, cors);
  if (!cors._ok) return json({ error: "origin_not_allowed" }, 403, cors);
  if (!env.GEMINI_API_KEY) return json({ error: "server_not_configured" }, 500, cors);

  const ip = req.headers.get("CF-Connecting-IP") || "local";
  if (limited(ip, Number(env.RATE_LIMIT_PER_10MIN || 20))) return json({ error: "rate_limited" }, 429, cors);

  let body = {};
  try { body = await req.json(); } catch { /* empty */ }
  const npcId = String(body.npc || "");
  const npc = NPCS[npcId];
  if (!npc) return json({ error: "unknown_npc" }, 400, cors);

  let hero = null;
  const hid = String(body.hero?.id || "");
  if (HEROES[hid]) {
    const level = Math.max(1, Math.min(99, parseInt(body.hero?.level, 10) || 1));
    hero = { name: HEROES[hid][0], role: HEROES[hid][1], level };
  }

  const model = env.LIVE_MODEL || DEFAULT_MODEL;
  const now = Date.now();
  const sessionMs = Number(env.SESSION_MINUTES || 15) * 60 * 1000;
  const expireTime = new Date(now + sessionMs).toISOString();
  const newSessionExpireTime = new Date(now + 60 * 1000).toISOString();

  const payload = {
    uses: 1, // single use: can start exactly one Live session
    expireTime,
    newSessionExpireTime,
    // The whole setup is locked into the token (no fieldMask => client setup is ignored).
    bidiGenerateContentSetup: {
      model: `models/${model}`,
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: npc.voice } } },
      },
      systemInstruction: { parts: [{ text: buildSystemInstruction(npcId, hero) }] },
      inputAudioTranscription: {},
      outputAudioTranscription: {},
    },
  };

  let r;
  try {
    r = await fetch("https://generativelanguage.googleapis.com/v1beta/auth_tokens", {
      method: "POST",
      headers: { "x-goog-api-key": env.GEMINI_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    return json({ error: "upstream_unreachable" }, 502, cors);
  }
  if (!r.ok) {
    // never echo upstream body (could contain details); log status only
    console.log("auth_tokens upstream status", r.status);
    return json({ error: "upstream_error", status: r.status }, 502, cors);
  }
  const data = await r.json();
  return json({ token: data.name, model, voice: npc.voice, npcName: npc.name, expiresAt: expireTime, newSessionExpiresAt: newSessionExpireTime }, 200, cors);
}

export default { fetch: (req, env) => handle(req, env) };
