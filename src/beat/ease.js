// Small easing and shaping helpers shared by the camera, the rig and the scenes.

export const clamp = (v, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (a === b ? 0 : (v - a) / (b - a));

/** Map v from [a, b] to [c, d], clamped. */
export const remap = (v, a, b, c, d) => lerp(c, d, clamp(invLerp(a, b, v)));

export const smoothstep = (a, b, v) => {
  const t = clamp(invLerp(a, b, v));
  return t * t * (3 - 2 * t);
};

export const smootherstep = (a, b, v) => {
  const t = clamp(invLerp(a, b, v));
  return t * t * t * (t * (t * 6 - 15) + 10);
};

export const easeInQuad = (t) => t * t;
export const easeOutQuad = (t) => 1 - (1 - t) * (1 - t);
export const easeInOutQuad = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
export const easeInCubic = (t) => t * t * t;
export const easeOutCubic = (t) => 1 - (1 - t) ** 3;
export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
export const easeOutQuart = (t) => 1 - (1 - t) ** 4;
export const easeInOutSine = (t) => -(Math.cos(Math.PI * t) - 1) / 2;
export const easeOutExpo = (t) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t));

export const easeOutBack = (t, s = 1.70158) => 1 + (s + 1) * (t - 1) ** 3 + s * (t - 1) ** 2;

/**
 * A hit that starts at 1 on the event and decays away.
 * dt = seconds since the event; returns 0 before it.
 */
export const decay = (dt, halfLife = 0.12) => (dt < 0 ? 0 : 0.5 ** (dt / halfLife));

/** A bump that rises over `attack` seconds and falls over `release` seconds, peaking at dt = 0. */
export function bump(dt, attack, release) {
  if (dt <= -attack || dt >= release) return 0;
  if (dt < 0) return smoothstep(-attack, 0, dt);
  return 1 - smoothstep(0, release, dt);
}

/** Fade in over [a, b], hold, fade out over [c, d]. */
export const window4 = (v, a, b, c, d) => Math.min(smoothstep(a, b, v), 1 - smoothstep(c, d, v));

/**
 * Quintic segment with position, velocity and zero acceleration fixed at both ends.
 * Used wherever a motion must leave and arrive at an exact speed.
 */
export function hermite5(t, t0, t1, p0, v0, p1, v1) {
  const d = t1 - t0;
  const s = clamp((t - t0) / d);
  const s2 = s * s;
  const s3 = s2 * s;
  const s4 = s3 * s;
  const s5 = s4 * s;
  const h0 = 1 - 10 * s3 + 15 * s4 - 6 * s5;
  const h1 = s - 6 * s3 + 8 * s4 - 3 * s5;
  const h4 = -4 * s3 + 7 * s4 - 3 * s5;
  const h5 = 10 * s3 - 15 * s4 + 6 * s5;
  return h0 * p0 + h1 * d * v0 + h4 * d * v1 + h5 * p1;
}

export const TAU = Math.PI * 2;
export const deg = (d) => (d * Math.PI) / 180;
