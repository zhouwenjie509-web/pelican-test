// Helpers shared by the render tools: argument parsing, opening the film page
// in export mode, and capturing one frame.

import fs from "node:fs";
import { openPage } from "./browser.mjs";

/**
 * Print the comment at the top of the tool that was started: every tool's header is its usage.
 */
function printUsage() {
  const out = [];
  try {
    for (const line of fs.readFileSync(process.argv[1], "utf8").split("\n")) {
      if (line.startsWith("#!") || (line.trim() === "" && !out.length)) continue;
      if (!line.startsWith("//")) break;
      out.push(line.replace(/^\/\/ ?/, ""));
    }
  } catch {
    // no file to read: fall through
  }
  console.log(out.length ? out.join("\n") : "No usage text.");
}

/**
 * --key value / --flag  ->  { key: "value", flag: true }
 *
 * With --help or -h the tool prints its usage and exits before doing anything (several tools
 * write into frames/ and out/ as soon as they start). `own` lets a tool with its own help text
 * (tools/audio.mjs) handle the flag itself.
 */
export function parseArgs(argv, { own = false } = {}) {
  if (!own && (argv.includes("--help") || argv.includes("-h"))) {
    printUsage();
    process.exit(0);
  }
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) out[key] = true;
    else {
      out[key] = next;
      i += 1;
    }
  }
  return out;
}

/** Open index.html in export mode at the given render width and wait until it can draw. */
export async function openFilm(browser, baseUrl, { width = 1920, query = "", log = false } = {}) {
  const height = Math.round((width * 9) / 16);
  const extra = query ? `&${query}` : "";
  const page = await openPage(browser, `${baseUrl}/index.html?export=1&w=${width}${extra}`, { width, height, log });
  await page.waitForFunction(() => window.__film && window.__film.ready === true, { timeout: 120000 });
  return page;
}

/** Render section n's gallery still (square, centred on a dark ground) and write it as an image. */
export async function grabStill(page, n, outFile, { type = "png", quality, u = null } = {}) {
  const url = await page.evaluate(
    async (section, mime, q, at) => {
      await window.__film.renderStill(section, at);
      return window.__film.capture(mime, q);
    },
    n,
    type === "jpg" ? "image/jpeg" : "image/png",
    quality,
    u,
  );
  fs.writeFileSync(outFile, Buffer.from(url.slice(url.indexOf(",") + 1), "base64"));
}

/** Render time t and write the frame as a PNG. Returns the page-side render time. */
export async function grabFrame(page, t, outFile, { type = "png", quality } = {}) {
  const res = await page.evaluate(
    async (time, mime, q) => {
      const t0 = performance.now();
      await window.__film.renderAt(time);
      const ms = performance.now() - t0;
      const url = window.__film.capture(mime, q);
      return { ms, url };
    },
    t,
    type === "jpg" ? "image/jpeg" : "image/png",
    quality,
  );
  const base64 = res.url.slice(res.url.indexOf(",") + 1);
  fs.writeFileSync(outFile, Buffer.from(base64, "base64"));
  return { ms: res.ms };
}
