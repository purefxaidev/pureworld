// Zero-dependency static server for local play/testing:  node tools/serve.mjs [port]   (default 8080)
// Serves the repo root: landing at http://localhost:8080/ , game at http://localhost:8080/play/
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.argv[2] || process.env.PORT || 8080);
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
  ".svg": "image/svg+xml", ".ico": "image/x-icon", ".mp3": "audio/mpeg", ".ttf": "font/ttf", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8" };

createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    let file = normalize(join(ROOT, p)); if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    let st = await stat(file).catch(() => null);
    if (st && st.isDirectory()) { if (!p.endsWith("/")) { res.writeHead(301, { Location: p + "/" }).end(); return; } file = join(file, "index.html"); st = await stat(file).catch(() => null); }
    if (!st) { res.writeHead(404, { "Content-Type": "text/plain" }).end("404 Not found"); return; }
    const body = await readFile(file);
    res.writeHead(200, { "Content-Type": TYPES[extname(file).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-cache" }).end(body);
  } catch (e) { res.writeHead(500).end(String(e)); }
}).listen(PORT, () => console.log(`PureWorld → http://localhost:${PORT}/  (game: http://localhost:${PORT}/play/)`));
