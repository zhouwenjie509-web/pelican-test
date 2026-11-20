// Geometry of the film.
//
// "Corridor units" are the shared world units. Each of the 20 sections owns a
// stretch of road exactly 1000 units long (boundary k sits at x = 1000 k), and
// each scene draws in its own 1000-unit square whose road runs along y = ROAD_Y.
// The pelican covers one section in three bars, so the standard speed is
// 1000 / 6 units per second, and one pedal turn (two beats) moves it 166.67 units.
//
// On screen (reference size 1920 x 1080, zoom 1) one unit is 2.88 px, so the
// road scrolls at 480 px per second and a picture frame takes exactly one bar
// to travel from the screen edge to the pelican.

import { T_SECTION, N_SECTIONS } from "../beat/timeline.js";
import { GEAR } from "../rig/rig.js";
import { View } from "../kit/stage.js";

export const REF_W = 1920;
export const REF_H = 1080;

export const SECTION_LEN = 1000;
export const SPEED = SECTION_LEN / T_SECTION; // 166.67 units per second
export const PX_PER_UNIT = 2.88; // reference pixels per unit at zoom 1

/** Road surface height inside every scene's 1000-unit square. */
export const ROAD_Y = 700;

/** Screen point the camera zooms about, and where the pelican's column sits. */
export const ANCHOR_X = REF_W / 2;
export const ANCHOR_Y = REF_H / 2;
/** Screen height of the road at zoom 1. */
export const ROAD_SCREEN_Y = 800;
/** World height that sits on the anchor row. */
export const FOCUS_Y = ROAD_Y - (ROAD_SCREEN_Y - ANCHOR_Y) / PX_PER_UNIT; // 609.72

export const VIEW_W = REF_W / PX_PER_UNIT; // 666.67 units across the screen at zoom 1
export const VIEW_H = REF_H / PX_PER_UNIT; // 375 units

/** Wheel radius: one pedal turn per second, GEAR wheel turns per pedal turn. */
export const WHEEL_R = SPEED / (2 * Math.PI * GEAR); // 21.22 units

/** How far the camera pushes in when the pelican passes through a frame. */
export const ZOOM_IN = 1.1;

/**
 * Picture frames. Paintings hang side by side on one wall; between two
 * paintings there are two frame members with a sliver of wall between them.
 */
export const FRAME = {
  w: 11, // width of the moulding
  gap: 14, // wall visible between neighbouring frames
};
/** Half-width of the band (moulding + gap + moulding) the pelican passes behind. */
export const BAND_HALF = FRAME.gap / 2 + FRAME.w;

/** Top and bottom of every painting's picture area. At zoom 1 the rails just fit on screen. */
export const PAINT_TOP = FOCUS_Y - VIEW_H / 2 + FRAME.w; // 433.2
export const PAINT_BOTTOM = FOCUS_Y + VIEW_H / 2 - FRAME.w; // 786.2
export const PAINT_H = PAINT_BOTTOM - PAINT_TOP; // 353

export const boundaryX = (k) => k * SECTION_LEN;

/** Picture area of painting n (1..20) along the corridor. */
export function paintingRect(n) {
  return {
    x0: boundaryX(n - 1) + BAND_HALF,
    x1: boundaryX(n) - BAND_HALF,
    y0: PAINT_TOP,
    y1: PAINT_BOTTOM,
  };
}

/**
 * The gallery wall of the outro: a 7 x 3 grid of square frames. Its bottom
 * row lines up with the corridor so the camera can pull straight back from
 * the last crossing; frame 20 ends where painting 20 ends.
 */
export const GALLERY = {
  cols: 7,
  rows: 3,
  side: PAINT_H, // square picture area
  pitch: PAINT_H + 2 * FRAME.w + FRAME.gap,
};

/** Picture area of gallery frame i (1..21), row-major from the top-left. */
export function galleryRect(i) {
  const col = (i - 1) % GALLERY.cols;
  const row = Math.floor((i - 1) / GALLERY.cols);
  // frame 20 (col 5, bottom row) has its right edge at painting 20's right edge
  const x1of20 = boundaryX(N_SECTIONS) - BAND_HALF;
  const x0 = x1of20 - GALLERY.side + (col - 5) * GALLERY.pitch;
  const y0 = PAINT_TOP + (row - (GALLERY.rows - 1)) * GALLERY.pitch;
  return { x0, y0, x1: x0 + GALLERY.side, y1: y0 + GALLERY.side };
}

/** Bounding box of the whole grid including mouldings. */
export function galleryBounds() {
  const a = galleryRect(1);
  const b = galleryRect(GALLERY.cols * GALLERY.rows);
  return { x0: a.x0 - FRAME.w, y0: a.y0 - FRAME.w, x1: b.x1 + FRAME.w, y1: b.y1 + FRAME.w };
}

/**
 * Build the view (world -> target pixels) for a camera.
 *   cam = { x, y, zoom }   world point under the anchor, and zoom (1 = 2.88 px per unit at 1080p)
 *   target = { w, h }      pixel size of the render target
 */
export function viewFor(cam, target) {
  const s = target.w / REF_W;
  const k = PX_PER_UNIT * cam.zoom * s;
  return new View(k, ANCHOR_X * s - cam.x * k, ANCHOR_Y * s - cam.y * k);
}
