// Launches the locally installed Google Chrome through puppeteer-core.
// No browser is downloaded; set CHROME_PATH to use a different binary.

import fs from "node:fs";
import puppeteer from "puppeteer-core";

const CANDIDATES = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean);

export function findChrome() {
  for (const candidate of CANDIDATES) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error("Google Chrome was not found. Set CHROME_PATH to its executable.");
}

/** Launch headless Chrome with the GPU enabled (the film draws through WebGL2). */
export async function launchBrowser({ width = 1920, height = 1080, headless = true } = {}) {
  return puppeteer.launch({
    executablePath: findChrome(),
    headless,
    defaultViewport: { width, height, deviceScaleFactor: 1 },
    args: [
      `--window-size=${width},${height}`,
      "--use-angle=metal",
      "--enable-gpu",
      "--ignore-gpu-blocklist",
      "--enable-webgl",
      "--force-color-profile=srgb",
      "--force-device-scale-factor=1",
      "--hide-scrollbars",
      "--mute-audio",
      "--disable-background-timer-throttling",
      "--disable-renderer-backgrounding",
      "--disable-backgrounding-occluded-windows",
      "--autoplay-policy=no-user-gesture-required",
    ],
  });
}

/** Open a page and forward its console errors to this process. */
export async function openPage(browser, url, { width = 1920, height = 1080, log = false } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  page.on("pageerror", (err) => console.error(`[page error] ${err.message}`));
  page.on("console", (msg) => {
    const type = msg.type();
    if (type === "error" || type === "warn" || type === "warning" || log) {
      console.error(`[page ${type}] ${msg.text()}`);
    }
  });
  await page.goto(url, { waitUntil: "load" });
  return page;
}
