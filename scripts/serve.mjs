// Tiny local web server for trying ProfitPilot (no dependencies). Run: npm start → http://localhost:8000
// It tells the browser not to cache, so a code change shows up on the next reload.
// Listens on this computer only; set HOST=0.0.0.0 to open it to your Wi-Fi (e.g. to try it on your phone).
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const port = Number(process.env.PORT) || 8000;
const host = process.env.HOST || "127.0.0.1";
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".csv": "text/csv", ".svg": "image/svg+xml", ".json": "application/json", ".png": "image/png" };

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const file = normalize(join(root, path.endsWith("/") ? path + "index.html" : path));
  // stay inside the project, and never serve the private learner profile
  if (!file.startsWith(root) || file.includes(`${sep}.git${sep}`) || file.endsWith("learner-profile.md")) {
    res.writeHead(403).end("Forbidden");
    return;
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { "Content-Type": (TYPES[extname(file)] || "application/octet-stream") + "; charset=utf-8", "Cache-Control": "no-store" });
    res.end(body);
  } catch {
    res.writeHead(404).end("Not found");
  }
}).listen(port, host, () => console.log(`ProfitPilot is running at http://localhost:${port}`));
