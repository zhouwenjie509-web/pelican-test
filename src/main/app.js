// Entry point for both deliverables:
//
//   preview   index.html                 playback bar, scrubbing, section name
//   export    index.html?export=1&w=1920 no interface; tools call window.__film.renderAt(t)
//
// Other query options: w (render width), t (start time), solo (render one
// section alone), fps (cap the preview frame rate, e.g. fps=30), warm (which
// sections to prepare before playback, e.g. warm=2,3; default all of them),
// sound=0 (preview without the soundtrack; the clock then runs on the wall clock),
// sync (milliseconds by which the picture is drawn later than the sound's clock:
// positive for loudspeakers that add delay, such as wireless ones; negative for a
// slow display; the [ and ] keys change it by 10 ms while the preview runs).
//
// The preview plays the soundtrack with real-time Web Audio and takes its
// clock from it (audio/engine/transport.js). Export mode makes no sound: the
// WAV is rendered separately by tools/audio.mjs.

/* global p5, brush */

import { Stage } from "../kit/stage.js";
import { BRUSH_SCALE } from "../kit/pen.js";
import { Film } from "./film.js";
import { Clock } from "./clock.js";
import { buildScenes, SECTIONS } from "../scenes/index.js";
import { DURATION, T_INTRO, T_SECTION, T_OUTRO, N_SECTIONS, BAR, BEAT, PICKUP, sectionAt, sectionStart, formatTime } from "../beat/timeline.js";
import { clamp } from "../beat/ease.js";
import { loadSoundtrack } from "../../audio/soundtrack.js";
import { Transport } from "../../audio/engine/transport.js";

const params = new URLSearchParams(location.search);
const exportMode = params.has("export");
const width = clamp(Math.round(Number(params.get("w")) || 1920), 320, 3840);
const height = Math.round((width * 9) / 16);
const fpsCap = Number(params.get("fps")) || 60;
const soundWanted = !exportMode && params.get("sound") !== "0";

const $ = (id) => document.getElementById(id);
const clock = new Clock(DURATION);
clock.seek(Number(params.get("t")) || 0);

let stage = null;
let film = null;
let exportTime = 0;
let prewarm = null;
let stillRequest = null;
let transport = null;
if (exportMode) document.body.classList.add("export");

// ---------------------------------------------------------------- interface
const ui = {
  lastFrameAt: 0,
  fps: 0,
  soundWas: true,
  build() {
    const seg = $("segments");
    const parts = [{ dur: T_INTRO, color: "#ece4d2", title: "Intro" }];
    for (const s of SECTIONS) parts.push({ dur: T_SECTION, color: s.color, title: `${s.n}. ${s.zh} · ${s.en}` });
    parts.push({ dur: T_OUTRO, color: "#ece4d2", title: "Outro" });
    for (const part of parts) {
      const el = document.createElement("div");
      el.style.flex = `${part.dur} 0 0`;
      el.style.background = part.color;
      el.title = part.title;
      seg.appendChild(el);
    }
    $("total").textContent = formatTime(DURATION);
    $("seek").max = String(DURATION);
    $("seek").addEventListener("input", (e) => clock.seek(Number(e.target.value)));
    $("play").addEventListener("click", () => clock.toggle());
    $("sound").addEventListener("click", () => ui.toggleSound());
    $("viewport").addEventListener("click", () => clock.toggle());
    window.addEventListener("keydown", (e) => {
      if (e.target instanceof HTMLInputElement && e.target.type !== "range") return;
      const t = clock.time;
      if (e.code === "Space") {
        clock.toggle();
      } else if (e.code === "KeyM") {
        ui.toggleSound();
      } else if (e.code === "BracketLeft" || e.code === "BracketRight") {
        if (!transport) return;
        const ms = Math.round(transport.pictureDelay * 1000) + (e.code === "BracketRight" ? 10 : -10);
        transport.pictureDelay = clamp(ms, -500, 500) / 1000;
      } else if (e.code === "ArrowRight" || e.code === "ArrowLeft") {
        const dir = e.code === "ArrowRight" ? 1 : -1;
        if (e.shiftKey) {
          const n = sectionAt(t);
          clock.seek(dir > 0 ? sectionStart(Math.min(n + 1, N_SECTIONS + 1)) : sectionStart(t - sectionStart(n) > 0.4 ? n : Math.max(n - 1, 0)));
        } else {
          clock.seek(t + dir * BEAT);
        }
      } else if (e.code === "Period" || e.code === "Comma") {
        clock.pause();
        clock.seek(t + (e.code === "Period" ? 1 : -1) / 60);
      } else if (e.code === "Home") {
        clock.seek(0);
      } else {
        return;
      }
      e.preventDefault();
    });
  },
  toggleSound() {
    if (!transport) return;
    transport.setMuted(!transport.muted);
    this.showSound();
  },
  showSound() {
    const el = $("sound");
    el.hidden = !transport;
    if (!transport) return;
    el.classList.toggle("off", transport.muted || !transport.enabled);
    el.title = !transport.enabled ? "The sound could not start in this browser" : transport.muted ? "Sound is off (M)" : "Sound is on (M)";
  },
  update(t) {
    const now = performance.now();
    if (this.lastFrameAt) {
      const inst = 1000 / Math.max(1, now - this.lastFrameAt);
      this.fps = this.fps ? this.fps * 0.92 + inst * 0.08 : inst;
    }
    this.lastFrameAt = now;
    $("time").textContent = formatTime(t);
    $("playhead").style.left = `${(t / DURATION) * 100}%`;
    if (document.activeElement !== $("seek")) $("seek").value = String(t);
    $("play").textContent = clock.playing ? "❚❚" : "▶";
    $("hint").hidden = clock.playing || t > 0.001;
    const n = sectionAt(t);
    if (n === 0) {
      $("section-no").textContent = "";
      $("section-zh").textContent = "片头";
      $("section-en").textContent = "Intro";
      const b = t - PICKUP;
      $("beat").textContent = b < 0 ? "pickup" : `bar ${Math.floor(b / BAR) + 1} · beat ${Math.floor((b % BAR) / BEAT) + 1}`;
    } else {
      const u = t - sectionStart(n);
      if (n > N_SECTIONS) {
        $("section-no").textContent = "";
        $("section-zh").textContent = "片尾 · 新闻发布会";
        $("section-en").textContent = "Outro · The Press Conference";
      } else {
        const s = SECTIONS[n - 1];
        $("section-no").textContent = String(n).padStart(2, "0");
        $("section-zh").textContent = s.zh;
        $("section-en").textContent = `${s.en} · ${s.dateEn}`;
      }
      $("beat").textContent = `bar ${Math.floor(u / BAR) + 1} · beat ${Math.floor((u % BAR) / BEAT) + 1}`;
    }
    if (transport && transport.enabled !== this.soundWas) {
      this.soundWas = transport.enabled;
      this.showSound();
    }
    const late = transport ? Math.round(transport.pictureDelay * 1000) : 0;
    $("fps").textContent = `${this.fps.toFixed(0)} fps${late ? ` · picture ${late > 0 ? "+" : "−"}${Math.abs(late)} ms` : ""}`;
  },
};

// ---------------------------------------------------------------- sketch
const sketch = new p5((p) => {
  brush.instance(p);

  p.setup = () => {
    p.createCanvas(width, height, p.WEBGL);
    p.pixelDensity(1); // one canvas pixel per film pixel, also on high-density displays
    p.frameRate(fpsCap);
    stage = new Stage(p, { width, height });
    brush.scaleBrushes(BRUSH_SCALE);
    film = new Film(stage, buildScenes());
    if (params.has("solo")) film.solo = Number(params.get("solo"));

    p.noLoop();
    window.__film.ready = true;
    if (!exportMode) {
      ui.build();
      warmUp();
    }
  };

  p.draw = () => {
    if (!film) return;
    if (prewarm) {
      // one section's gallery still per call (this also warms that scene's caches)
      stage.beginFrame();
      p.background(18, 17, 16);
      film.still(prewarm.n);
      stage.endFrame();
      return;
    }
    if (stillRequest !== null) {
      // a section's gallery still on its own, as large as the canvas allows (export tools)
      stage.beginFrame();
      p.background(18, 17, 16);
      const tex = stillRequest.u === undefined ? film.still(stillRequest.n) : film.squareAt(stillRequest.n, stillRequest.u);
      stage.origin();
      stage.image(tex, (width - height) / 2, 0, height, height);
      stage.endFrame();
      return;
    }
    const t = exportMode ? exportTime : clock.time;
    film.renderAt(t);
    if (!exportMode) ui.update(t);
  };
}, $("canvas-holder"));

/** A turn of the event loop that is not slowed down when the tab is in the background. */
function tick() {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => resolve();
    channel.port2.postMessage(0);
  });
}

/** Paint every section once before playback starts, so the first run-through is smooth. */
async function warmUp() {
  await tick();
  await tick();
  const only = params.has("warm") ? new Set(params.get("warm").split(",").map(Number)) : null;
  for (let n = 1; n <= N_SECTIONS; n += 1) {
    if (only && !only.has(n)) continue;
    prewarm = { n };
    $("loading").textContent = `Preparing ${n} / ${N_SECTIONS}`;
    await sketch.redraw();
    await tick();
  }
  prewarm = null;
  if (soundWanted) {
    // compute every part's sounds now, so that nothing has to be made while the film plays
    try {
      const track = await loadSoundtrack({
        onProgress: async (done, total) => {
          $("loading").textContent = `Preparing the sound ${done} / ${total}`;
          await tick();
        },
      });
      transport = new Transport(track);
      transport.pictureDelay = clamp(Number(params.get("sync")) || 0, -500, 500) / 1000;
      clock.attach(transport);
      window.__sound = { transport, track };
    } catch (err) {
      console.error(`[sound] the soundtrack could not be loaded: ${err}`);
    }
    ui.showSound();
  }
  $("loading").hidden = true;
  $("controls").hidden = false;
  sketch.loop();
}

// ---------------------------------------------------------------- export hooks
window.__film = {
  ready: false,
  duration: DURATION,
  width,
  height,
  /** Draw the frame for time t (seconds). Resolves when it is on the canvas. */
  async renderAt(t) {
    exportTime = t;
    await sketch.redraw();
  },
  /**
   * Draw section n's gallery still, centred, filling the canvas height.
   * With u: the same square at another moment of the section, drawn live (a debugging view).
   */
  async renderStill(n, u) {
    stillRequest = { n, u: u === null ? undefined : u };
    await sketch.redraw();
    stillRequest = null;
  },
  /** The current canvas as a data URL. */
  capture(type = "image/png", quality) {
    return stage.toDataURL(type, quality);
  },
  /** What the last frame cost and which scenes it drew. */
  stats() {
    return { ...film.lastFrame, bakes: stage.stats.bakes, bakeMs: stage.stats.bakeMs };
  },
};
window.film = () => film;
window.clock = clock;
