// The scheduler: renderAt(t) draws the whole film frame for time t.
//
// For most of the film the camera tracks along a wall of paintings. Each
// visible section is rendered full-frame into its own buffer, then the buffers
// are cut together along the picture frames: everything left of a frame comes
// from one scene, everything right of it from the next. Both scenes draw the
// pelican from the same pose, each in its own style, so as it passes behind
// the frame its front half is already in the new style.
//
// Scene contract (see scenes/placeholder.js for the smallest example):
//
//   scene.render(stage, f)     draw one frame into the current target
//   scene.init(stage)          optional, called once before the first render
//   scene.motion(u)            optional, { x, turns } for bar-2 slowdowns and freezes
//   scene.camera(u)            optional, { dx, dy, zoom } applied during bar 2 only
//   scene.road(x)              optional road height profile (must be ROAD_Y at both ends)
//   scene.poseHz               optional stepped pose rate (camera and position stay smooth)
//   scene.still                optional { u, cx, span, y0 } for the gallery wall

import { T_OUTRO_START, T_SECTION, BAR, BEAT, N_SECTIONS, DURATION, sectionStart, stepTime } from "../beat/timeline.js";
import { clamp, smoothstep } from "../beat/ease.js";
import { View } from "../kit/stage.js";
import { fillPaper } from "../kit/paper.js";
import { drawMoulding, drawWallShadow, drawInnerShadow } from "../kit/frame.js";
import { WHEELBASE } from "../rig/rig.js";
import { SECTION_LEN, BAND_HALF, FRAME, ROAD_Y, WHEEL_R, PAINT_TOP, GALLERY, boundaryX, paintingRect, galleryRect, viewFor } from "./layout.js";
import { corridorCamera, pelicanAt, pelicanSpeed } from "./camera.js";
import { renderGallery } from "../scenes/outro.js";

const PRESS = N_SECTIONS + 1;

export class Film {
  /** scenes[0] = intro, scenes[1..20] = sections, scenes[21] = the 21st picture. */
  constructor(stage, scenes) {
    this.stage = stage;
    this.scenes = scenes;
    this.duration = DURATION;
    /** Debug: render only this section, full frame, without neighbours or picture frames. */
    this.solo = null;
    this.lastFrame = { scenes: [], ms: 0 };
  }

  /** Corridor x of scene n's local origin. */
  originX(n) {
    return n <= 0 ? 0 : boundaryX(n - 1);
  }

  /** Picture area of scene n in corridor coordinates. */
  pictureRect(n) {
    return n === PRESS ? galleryRect(PRESS) : paintingRect(n);
  }

  /** The pelican as scene n sees it at time t (scene-local coordinates). */
  pelicanFor(n, t) {
    const scene = this.scenes[n];
    const live = pelicanAt(t, this.scenes);
    let pose = live;
    let time = t;
    if (scene.poseHz) {
      // stepped pose, smooth position: the camera never stutters
      time = stepTime(t, scene.poseHz);
      pose = pelicanAt(time, this.scenes);
    }
    const x = live.x - this.originX(n);
    let y = ROAD_Y;
    let slope = 0;
    if (typeof scene.road === "function") {
      const half = (WHEELBASE / 2) * WHEEL_R;
      const yr = scene.road(x - half);
      const yf = scene.road(x + half);
      y = (yr + yf) / 2;
      slope = Math.atan2(yr - yf, 2 * half);
    }
    return {
      x,
      y,
      slope,
      crank: pose.crank,
      wheel: pose.wheel,
      time,
      speed: pelicanSpeed(t, this.scenes),
      scale: WHEEL_R,
      visible: t < T_OUTRO_START + 1.3,
    };
  }

  /** Build the per-frame context handed to scene.render. */
  frame(n, t, view, target, extra = {}) {
    const u = t - sectionStart(n);
    return {
      t,
      n,
      u,
      bar: u / BAR,
      beat: u / BEAT,
      view,
      w: target.w,
      h: target.h,
      s: this.stage.s,
      pelican: this.pelicanFor(n, t),
      still: false,
      film: this,
      ...extra,
    };
  }

  ensureScene(n) {
    const scene = this.scenes[n];
    if (!scene._ready) {
      if (typeof scene.init === "function") scene.init(this.stage);
      scene._ready = true;
    }
    return scene;
  }

  /** Render scene n into a buffer through an explicit view (scene-local world -> buffer pixels). */
  renderSceneView(n, target, t, view, extra) {
    const scene = this.ensureScene(n);
    const f = this.frame(n, t, view, { w: target.width, h: target.height }, extra);
    this.stage.into(target, () => scene.render(this.stage, f));
    return f;
  }

  /** Render scene n into a buffer as seen by a corridor camera. */
  renderSceneCam(n, target, t, cam) {
    const scene = this.scenes[n];
    const u = t - sectionStart(n);
    let c = { x: cam.x - this.originX(n), y: cam.y, zoom: cam.zoom };
    // a scene may move its own camera, but only in bar 2, when no picture frame is in view
    if (typeof scene.camera === "function" && u > BAR && u < 2 * BAR) {
      const m = scene.camera(u) || {};
      c = { x: c.x + (m.dx || 0), y: c.y + (m.dy || 0), zoom: c.zoom * (m.zoom || 1) };
    }
    return this.renderSceneView(n, target, t, viewFor(c, { w: target.width, h: target.height }));
  }

  /** The frozen picture of section n that hangs on the gallery wall. */
  still(n) {
    const st = this.stage;
    const key = `still/${n}`;
    const px = Math.round(GALLERY.side * 2.2 * st.s);
    if (!st.isBaked(key)) {
      const scene = this.ensureScene(n);
      const spec = scene.still || {};
      const t = sectionStart(n) + (spec.u === undefined ? T_SECTION / 2 : spec.u);
      const pel = this.pelicanFor(n, t);
      const span = spec.span || GALLERY.side;
      const cx = spec.cx === undefined ? pel.x : spec.cx;
      const y0 = spec.y0 === undefined ? ROAD_Y - (ROAD_Y - PAINT_TOP) * (span / GALLERY.side) : spec.y0;
      const view = View.fit(cx - span / 2, y0, span, px);
      st.bake(key, px, px, () => {
        scene.render(st, this.frame(n, t, view, { w: px, h: px }, { still: true }));
      });
    }
    return st.fb(key, px, px);
  }

  /**
   * Debug: section n through the same square as its gallery still, but at another moment
   * (u seconds into the section) and drawn live, as the outro draws painting 20 before it settles.
   */
  squareAt(n, u) {
    const st = this.stage;
    const scene = this.ensureScene(n);
    const spec = scene.still || {};
    const px = Math.round(GALLERY.side * 2.2 * st.s);
    const tStill = sectionStart(n) + (spec.u === undefined ? T_SECTION / 2 : spec.u);
    const span = spec.span || GALLERY.side;
    const cx = spec.cx === undefined ? this.pelicanFor(n, tStill).x : spec.cx;
    const y0 = spec.y0 === undefined ? ROAD_Y - (ROAD_Y - PAINT_TOP) * (span / GALLERY.side) : spec.y0;
    const fb = st.fb(`square/${n}`, px, px);
    this.renderSceneView(n, fb, sectionStart(n) + u, View.fit(cx - span / 2, y0, span, px));
    return fb;
  }

  /** Draw the film frame for time t onto the canvas. Call inside p5's draw(). */
  renderAt(time) {
    const st = this.stage;
    const t = clamp(time, 0, DURATION - 1e-6);
    const t0 = performance.now();
    this.lastFrame.scenes = [];
    st.beginFrame();
    if (this.solo !== null) this.renderSolo(this.solo, t);
    else if (t < T_OUTRO_START) this.renderCorridor(t);
    else renderGallery(this, t);
    if (t < 0.4 && this.solo === null) {
      // come up from black
      st.origin();
      st.rect(0, 0, st.W, st.H, [0, 0, 0, 255 * (1 - smoothstep(0.02, 0.4, t))]);
    }
    st.endFrame();
    this.lastFrame.ms = performance.now() - t0;
  }

  renderSolo(n, t) {
    const st = this.stage;
    const fb = st.fb("film/a", st.W, st.H);
    const cam = t < T_OUTRO_START ? corridorCamera(t, this.scenes) : corridorCamera(T_OUTRO_START - 1e-3, this.scenes);
    this.renderSceneCam(n, fb, t, cam);
    this.lastFrame.scenes.push(n);
    st.origin();
    fillPaper(st, viewFor(cam, { w: st.W, h: st.H }));
    st.image(fb, 0, 0, st.W, st.H);
  }

  renderCorridor(t) {
    const st = this.stage;
    const { W, H } = st;
    const cam = corridorCamera(t, this.scenes);
    const view = viewFor(cam, { w: W, h: H });
    const vb = view.bounds(W, H);

    // nearest boundary and whether its band (frame + wall gap + frame) is on screen
    const kb = clamp(Math.round(cam.x / SECTION_LEN), 0, N_SECTIONS);
    const bx = boundaryX(kb);
    const reach = BAND_HALF + 14; // include the frame's shadow
    const bandVisible = bx + reach > vb.x0 && bx - reach < vb.x1;

    let left;
    let right = null;
    if (bandVisible) {
      left = kb;
      right = kb + 1;
    } else {
      left = cam.x < bx ? kb : kb + 1;
    }

    const fbA = st.fb("film/a", W, H);
    this.renderSceneCam(left, fbA, t, cam);
    this.lastFrame.scenes.push(left);
    let fbB = null;
    if (right !== null) {
      fbB = st.fb("film/b", W, H);
      this.renderSceneCam(right, fbB, t, cam);
      this.lastFrame.scenes.push(right);
    }

    // the wall, then the scenes cut together along the frame
    st.origin();
    const framed = [left, right].filter((n) => n !== null && n >= 1);
    if (right === null) {
      // one painting covers the whole screen and every scene paints its target opaque: none of the wall can show
      st.image(fbA, 0, 0, W, H);
    } else {
      fillPaper(st, view);
      // the intro is the bare wall, so it runs right up to painting 1
      const cutL = Math.round(clamp(view.x(left === 0 ? bx + BAND_HALF : bx - BAND_HALF), 0, W));
      const cutR = Math.round(clamp(view.x(bx + BAND_HALF), 0, W));
      const endR = right === PRESS ? Math.round(clamp(view.x(this.pictureRect(PRESS).x1), 0, W)) : W;
      st.imagePart(fbA, 0, 0, cutL, H, 0, 0, cutL, H);
      st.imagePart(fbB, cutR, 0, endR - cutR, H, cutR, 0, endR - cutR, H);
    }

    // frames on top: shadow on the wall, moulding, shadow line on the picture
    st.withView(view, () => {
      for (const n of framed) drawWallShadow(st, this.pictureRect(n), FRAME.w);
    });
    st.withView(view, () => {
      for (const n of framed) {
        const r = this.pictureRect(n);
        drawMoulding(st, r, FRAME.w);
        drawInnerShadow(st, r);
      }
    });
  }
}
