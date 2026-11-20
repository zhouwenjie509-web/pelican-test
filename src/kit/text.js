// Text. All lettering is drawn with the 2D canvas API onto cached layers and
// then composited as textures, which gives proper CJK shaping and crisp edges.
//
// The fonts are macOS system fonts (they are not bundled with the project);
// each stack ends in a generic family so the page still works elsewhere.

export const FONTS = {
  /** Serif Chinese for the documentary voice of the intro and outro. */
  song: "'Songti SC', 'STSong', 'Noto Serif CJK SC', 'Source Han Serif SC', 'SimSun', serif",
  /** Brush-style regular script, for the ink sections. */
  kai: "'Kaiti SC', 'STKaiti', 'KaiTi', 'Noto Serif CJK SC', serif",
  /** Sans Chinese for interface text. */
  hei: "'PingFang SC', 'Heiti SC', 'Noto Sans CJK SC', 'Microsoft YaHei', sans-serif",
  serif: "'Baskerville', 'Hoefler Text', 'Georgia', 'Times New Roman', serif",
  sans: "'Helvetica Neue', 'Helvetica', 'Arial', sans-serif",
  mono: "'Menlo', 'SF Mono', 'Monaco', 'Consolas', monospace",
};

/** CSS font shorthand. */
export const font = (family, sizePx, weight = 400, style = "normal") => `${style} ${weight} ${sizePx}px ${family}`;

/**
 * A cached, drawn-once layer: sprite(stage, "intro/line1", w, h, (ctx, layer) => { ... }).
 * Use it for anything static (lettering, labels, interface furniture). The
 * draw callback receives a cleared context in layer pixels.
 */
export function sprite(stage, key, w, h, draw) {
  const layer = stage.layer(key, w, h);
  if (!layer.drawn) {
    const ctx = layer.clear();
    ctx.save();
    draw(ctx, layer);
    ctx.restore();
    layer.drawn = true;
    layer.touch();
  }
  return layer;
}

/**
 * Draw a line of text and return its width. Options:
 *   align "left" | "center" | "right", baseline, fill, stroke, strokeWidth, spacing (px)
 */
export function drawText(ctx, text, x, y, opts = {}) {
  ctx.save();
  if (opts.font) ctx.font = opts.font;
  ctx.textAlign = opts.align || "left";
  ctx.textBaseline = opts.baseline || "alphabetic";
  if (opts.spacing !== undefined && "letterSpacing" in ctx) ctx.letterSpacing = `${opts.spacing}px`;
  if (opts.stroke) {
    ctx.strokeStyle = opts.stroke;
    ctx.lineWidth = opts.strokeWidth || 2;
    ctx.lineJoin = "round";
    ctx.strokeText(text, x, y);
  }
  ctx.fillStyle = opts.fill || "#000";
  ctx.fillText(text, x, y);
  const width = ctx.measureText(text).width;
  ctx.restore();
  return width;
}

/** Measure a line of text in pixels for the given font. */
export function measure(ctx, text, fontCss, spacing) {
  ctx.save();
  ctx.font = fontCss;
  if (spacing !== undefined && "letterSpacing" in ctx) ctx.letterSpacing = `${spacing}px`;
  const m = ctx.measureText(text);
  ctx.restore();
  return m.width;
}

/** Relative luminance of "#rrggbb", for choosing dark or light lettering. */
export function luminance(hex) {
  const v = hex.replace("#", "");
  const c = [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255).map((u) => (u <= 0.03928 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

/**
 * A single line of text as a cached sprite. Returns the layer with
 * layer.meta = { w, h, baseline, pad, textWidth } in layer pixels.
 * Include anything that changes the pixels (size, colour) in the key.
 */
export function textSprite(stage, key, text, { family, size, weight = 400, style = "normal", fill = "#000", spacing, pad = 0.25 }) {
  const fontCss = font(family, size, weight, style);
  const probe = stage.layer("kit/text-probe", 8, 8).ctx;
  const textWidth = measure(probe, text, fontCss, spacing);
  const padPx = Math.ceil(size * pad);
  const w = Math.ceil(textWidth) + 2 * padPx;
  const h = Math.ceil(size * 1.5) + 2 * padPx;
  const baseline = padPx + Math.round(size * 1.12);
  const layer = sprite(stage, key, w, h, (ctx) => {
    drawText(ctx, text, padPx, baseline, { font: fontCss, fill, spacing });
  });
  layer.meta = { w, h, baseline, pad: padPx, textWidth };
  return layer;
}

/**
 * Draw a text sprite so that its baseline sits at (x, y) in the current space.
 * unitsPerPixel converts layer pixels to the current space's units
 * (1 for pixel space; 1 / oversampling for world space).
 */
export function placeText(stage, layer, x, y, { align = "left", unitsPerPixel = 1, alpha = 1 } = {}) {
  if (alpha <= 0.003) return;
  const m = layer.meta;
  const u = unitsPerPixel;
  let left = x - m.pad * u;
  if (align === "center") left = x - (m.pad + m.textWidth / 2) * u;
  else if (align === "right") left = x - (m.pad + m.textWidth) * u;
  stage.image(layer, left, y - m.baseline * u, m.w * u, m.h * u, alpha);
}
