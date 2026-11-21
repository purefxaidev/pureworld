// Local stand-in for the Worker (Node 18+). Reads GEMINI_API_KEY from your shell env.
//   GEMINI_API_KEY=... node dev-server.mjs   -> http://localhost:8787
import http from "node:http";
import { handle } from "./src/index.js";
const env = {
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || "*",
  LIVE_MODEL: process.env.LIVE_MODEL,
  RATE_LIMIT_PER_10MIN: process.env.RATE_LIMIT_PER_10MIN,
};
const port = Number(process.env.PORT || 8787);
http.createServer(async (req, res) => {
  const chunks = []; for await (const c of req) chunks.push(c);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const request = new Request(`http://localhost:${port}${req.url}`, { method: req.method, headers: req.headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : body });
  const r = await handle(request, env);
  res.writeHead(r.status, Object.fromEntries(r.headers));
  res.end(Buffer.from(await r.arrayBuffer()));
}).listen(port, () => console.log("pureworld npc dev server on :" + port, env.GEMINI_API_KEY ? "(key set)" : "(NO KEY)"));
