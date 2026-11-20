// Minimal static file server used by the preview and by every render tool.
// It serves the project root as-is (plain ES modules, no bundler) and maps
// /vendor/* onto the unmodified library files inside node_modules.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".wav": "audio/wav",
  ".mp4": "video/mp4",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
};

// Library files are served straight from node_modules so nothing is copied
// into (or redistributed from) this repository.
const VENDOR = {
  "/vendor/p5.js": "node_modules/p5/lib/p5.js",
  "/vendor/p5.min.js": "node_modules/p5/lib/p5.min.js",
  "/vendor/p5.brush.js": "node_modules/p5.brush/dist/p5.brush.js",
};

function resolveRequest(root, urlPath) {
  if (VENDOR[urlPath]) return path.join(PROJECT_ROOT, VENDOR[urlPath]);
  let rel = decodeURIComponent(urlPath);
  if (rel.endsWith("/")) rel += "index.html";
  const abs = path.normalize(path.join(root, rel));
  if (abs !== root && !abs.startsWith(root + path.sep)) return null; // no escaping the root
  return abs;
}

/**
 * Start the server. Resolves with { server, port, url, close }.
 * port 0 picks any free port (used by the render tools).
 */
export function startServer({ root = PROJECT_ROOT, port = 0, host = "127.0.0.1", quiet = true } = {}) {
  const absRoot = path.resolve(root);
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/favicon.ico") {
      res.writeHead(204).end();
      return;
    }
    // p5 looks for "./<browser language>.json" (messages for its error helper)
    // and falls back to a CDN when that fails. Answer with an empty table so
    // the page makes no outside requests.
    if (/^\/[A-Za-z]{2,3}(-[A-Za-z0-9]+)*\.json$/.test(url.pathname)) {
      res.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }).end("{}");
      return;
    }
    const file = resolveRequest(absRoot, url.pathname);
    if (!file) {
      res.writeHead(403).end("Forbidden");
      return;
    }
    fs.stat(file, (err, stat) => {
      if (err || !stat.isFile()) {
        if (!quiet) console.log(`404 ${url.pathname}`);
        res.writeHead(404, { "content-type": "text/plain" }).end("Not found");
        return;
      }
      res.writeHead(200, {
        "content-type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream",
        "content-length": stat.size,
        "cache-control": "no-store",
      });
      fs.createReadStream(file).pipe(res);
    });
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      const actual = server.address().port;
      resolve({
        server,
        port: actual,
        url: `http://${host}:${actual}`,
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}
