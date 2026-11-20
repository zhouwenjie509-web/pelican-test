// Where the pelican is and where the camera looks, as pure functions of time.
//
// The pelican is the clock hand of the film: it reaches boundary k (x = 1000 k)
// exactly at crossing k, which is always a downbeat. The camera keeps it on the
// anchor column, eases back during bar 3 so the next frame shows in full, and
// pushes in as the pelican passes through.

import { T_INTRO, T_SECTION, T_OUTRO_START, N_SECTIONS, BAR, crossingTime, sectionStart, sectionAt } from "../beat/timeline.js";
import { smoothstep, hermite5, clamp } from "../beat/ease.js";
import { SPEED, FOCUS_Y, ZOOM_IN, ROAD_Y, WHEEL_R, boundaryX } from "./layout.js";
import { CRANK_ON_BEAT } from "../rig/rig.js";

/** Intro: the sketch comes alive on this downbeat and reaches the first frame at T_INTRO. */
export const T_DEPART = T_INTRO - BAR; // 3 s
/** Where the pelican waits. Uniform acceleration from rest covers half the distance of a full-speed bar. */
export const X_REST = (-SPEED * (T_INTRO - T_DEPART)) / 2; // -166.67
/** Where the camera rests during the intro: the first frame is still out of sight. */
export const CAM_REST = -345;

/**
 * Road position (0..1000) and pedal turns inside one section at local time u.
 * A scene may supply motion(u) -> { x, turns } for bar-2 slowdowns and freezes;
 * it must start at x = 0 and end at x = 1000 moving at SPEED.
 */
export function sectionMotion(scene, u) {
  if (scene && typeof scene.motion === "function" && u > 0 && u < T_SECTION) {
    const m = scene.motion(u);
    return { x: m.x, turns: m.turns === undefined ? m.x / SPEED : m.turns };
  }
  return { x: SPEED * u, turns: u };
}

/** The pelican's state at time t in corridor coordinates. */
export function pelicanAt(t, scenes) {
  let x;
  let turns;
  let n = 0;
  if (t < T_DEPART) {
    x = X_REST;
  } else if (t < T_INTRO) {
    const d = t - T_DEPART;
    x = X_REST + 0.5 * (SPEED / (T_INTRO - T_DEPART)) * d * d;
  } else {
    n = Math.min(sectionAt(t), N_SECTIONS);
    const u = t - sectionStart(n);
    const m = sectionMotion(scenes ? scenes[n] : null, u);
    x = boundaryX(n - 1) + m.x;
    turns = (n - 1) * T_SECTION + m.turns;
  }
  if (turns === undefined) turns = x / SPEED;
  return {
    x,
    y: ROAD_Y,
    turns,
    crank: CRANK_ON_BEAT + 2 * Math.PI * turns,
    wheel: x / WHEEL_R,
    section: n,
  };
}

/** Speed relative to the standard pace (1 = cruising), by central difference. */
export function pelicanSpeed(t, scenes, eps = 1 / 240) {
  return (pelicanAt(t + eps, scenes).x - pelicanAt(t - eps, scenes).x) / (2 * eps) / SPEED;
}

const PUSH_START = -0.25; // seconds relative to a crossing
const PUSH_END = 0.4;
const RELAX_START = 4.2;
const RELAX_END = 5.7;

/**
 * Corridor zoom: 1 on the approach (frame rails visible), pushed in to ZOOM_IN
 * as the pelican passes through, held, then eased back out during bar 3.
 */
export function corridorZoom(t) {
  const k = Math.floor((t - PUSH_START - T_INTRO) / T_SECTION);
  if (k < 0) return 1;
  const dt = t - crossingTime(Math.min(k, N_SECTIONS));
  const rise = smoothstep(PUSH_START, PUSH_END, dt);
  const fall = smoothstep(RELAX_START, RELAX_END, dt);
  return 1 + (ZOOM_IN - 1) * rise * (1 - fall);
}

/** Camera for the corridor part of the film (t < T_OUTRO_START). */
export function corridorCamera(t, scenes) {
  let x;
  if (t < T_DEPART) x = CAM_REST;
  else if (t < T_INTRO) x = hermite5(t, T_DEPART, T_INTRO, CAM_REST, 0, 0, SPEED);
  else x = pelicanAt(Math.min(t, T_OUTRO_START), scenes).x;
  return { x, y: FOCUS_Y, zoom: corridorZoom(t) };
}

/**
 * Blend two cameras the way a dolly move looks: zoom changes geometrically
 * and the position follows the changing view size, so points travel in
 * straight lines on screen.
 */
export function blendCameras(a, b, e) {
  const t = clamp(e);
  const zoom = Math.exp(Math.log(a.zoom) + (Math.log(b.zoom) - Math.log(a.zoom)) * t);
  const ia = 1 / a.zoom;
  const ib = 1 / b.zoom;
  const w = Math.abs(ia - ib) < 1e-9 ? 1 - t : (1 / zoom - ib) / (ia - ib);
  return { x: b.x + (a.x - b.x) * w, y: b.y + (a.y - b.y) * w, zoom };
}
