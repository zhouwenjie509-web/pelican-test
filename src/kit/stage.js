// The stage: one p5 WEBGL canvas plus the bookkeeping every scene shares.
//
//   - render targets (framebuffers) with a top-left pixel origin
//   - a cache of baked layers, painted once from fixed seeds and reused every frame
//   - 2D canvas layers (text, UI, crisp vector work) that upload as textures
//   - p5.brush targeting and an explicit flush, so brush strokes and ordinary
//     p5 shapes can be layered in a known order inside a single frame
//
// Everything is drawn inside p5's draw(), which the film calls once per frame.

/* global p5, brush */

const REF_W = 1920;
const REF_H = 1080;

/**
 * p5.brush composites its pending strokes when p5 finishes a frame. The film
 * needs that to happen between layers and before a framebuffer scope closes,
 * so we call the hook the library registered with p5 directly. index.html
 * records how many postdraw hooks existed before p5.brush was loaded.
 */
function findBrushFlushHook() {
  const hooks = p5.lifecycleHooks && p5.lifecycleHooks.postdraw;
  const index = window.__p5HooksBeforeBrush;
  if (!hooks || typeof index !== "number" || typeof hooks[index] !== "function") {
    throw new Error("p5.brush flush hook not found: load p5, then the hook counter, then p5.brush.");
  }
  return hooks[index];
}

export class View {
  /** Maps world units to target pixels: px = x * k + tx, py = y * k + ty. */
  constructor(k, tx, ty) {
    this.k = k;
    this.tx = tx;
    this.ty = ty;
  }

  x(wx) {
    return wx * this.k + this.tx;
  }

  y(wy) {
    return wy * this.k + this.ty;
  }

  /** Inverse mapping, target pixels back to world units. */
  wx(px) {
    return (px - this.tx) / this.k;
  }

  wy(py) {
    return (py - this.ty) / this.k;
  }

  /** Visible world rectangle for a target of w x h pixels. */
  bounds(w, h) {
    return { x0: this.wx(0), y0: this.wy(0), x1: this.wx(w), y1: this.wy(h) };
  }

  /** Apply to a 2D canvas context. */
  apply2d(ctx) {
    ctx.setTransform(this.k, 0, 0, this.k, this.tx, this.ty);
  }

  /** A view of the same world for a target scaled by `f` (f = 0.5 for a half-size layer). */
  scaled(f) {
    return new View(this.k * f, this.tx * f, this.ty * f);
  }

  /** View that frames world rect (x, y, w, h) exactly in a target of tw x th pixels (uniform scale from width). */
  static fit(x, y, w, tw) {
    const k = tw / w;
    return new View(k, -x * k, -y * k);
  }
}

export class Layer2D {
  /**
   * A 2D canvas that can be drawn as a texture. Call touch() after changing it.
   *
   * The canvas is rasterised on the CPU ("willReadFrequently"). Chrome's
   * GPU-accelerated 2D canvas draws text through a glyph atlas whose contents
   * depend on what was drawn before, which changes a few pixels by one level
   * from run to run. On the CPU the same calls always give the same bytes, so
   * parallel export workers agree exactly.
   */
  constructor(p, w, h) {
    this.w = Math.max(1, Math.round(w));
    this.h = Math.max(1, Math.round(h));
    this.img = p.createImage(this.w, this.h);
    this.canvas = document.createElement("canvas");
    this.canvas.width = this.w;
    this.canvas.height = this.h;
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });
    // p5 uploads img.canvas as the texture and re-uploads when the image is marked modified
    this.img.canvas = this.canvas;
    this.img.drawingContext = this.ctx;
  }

  /**
   * Wipe the layer and reset the whole drawing state: transform, clip, styles,
   * line width, dashes, shadows, filters. Layers are reused from frame to
   * frame, and anything a frame leaves set would otherwise leak into the
   * next one drawn on the same layer, which breaks frame purity.
   */
  clear() {
    if (typeof this.ctx.reset === "function") {
      this.ctx.reset();
    } else {
      this.canvas.width = this.w; // resizing a canvas also resets its context
    }
    return this.ctx;
  }

  touch() {
    this.img.setModified(true);
  }
}

export class Stage {
  constructor(p, { width, height }) {
    this.p = p;
    this._brush = brush;
    /** Which target p5.brush is currently set up for: undefined = unknown, null = the canvas. */
    this._brushTarget = undefined;
    this._brushPending = false;
    this.W = width;
    this.H = height;
    /** Pixels per reference pixel: 1 when rendering 1920x1080. */
    this.s = width / REF_W;
    this.gl = p.drawingContext;
    this.cur = { w: width, h: height, fb: null };
    this._flushHook = findBrushFlushHook();
    this._fbs = new Map();
    this._layers = new Map();
    this._shaders = new Map();
    this._baked = new Set();
    this.stats = { bakes: 0, bakeMs: 0 };
  }

  // ---------------------------------------------------------------- targets

  /**
   * p5.brush, pointed at the current render target. The library keeps
   * full-size work buffers for whatever target it is loaded on, so it is only
   * (re)loaded when a scene actually reaches for it: scenes that never brush
   * cost nothing, and switching targets does not thrash GPU memory.
   */
  get brush() {
    const want = this.cur.fb || null;
    if (this._brushTarget !== want) {
      if (want) this._brush.load(want);
      else this._brush.load();
      this._brushTarget = want;
    }
    this._brushPending = true;
    return this._brush;
  }

  /** Call at the start of every frame, before any drawing. */
  beginFrame() {
    this.cur = { w: this.W, h: this.H, fb: null };
    this._brushTarget = undefined;
    this._brushPending = false;
    this._prep();
    this.origin();
  }

  /** Call at the end of every frame. */
  endFrame() {
    this.flush();
  }

  _prep() {
    const { p, gl } = this;
    gl.disable(gl.DEPTH_TEST);
    p.noStroke();
    p.noTint();
    p.imageMode(p.CORNER);
    p.rectMode(p.CORNER);
    p.blendMode(p.BLEND);
  }

  /** Put the origin at the top-left corner of the current target, in pixels. */
  origin() {
    const { p } = this;
    p.resetMatrix();
    p.translate(-this.cur.w / 2, -this.cur.h / 2);
  }

  /**
   * Composite pending p5.brush strokes and fills into the current target.
   * Call it between a brush layer and anything that must lie on top of it.
   */
  flush() {
    if (!this._brushPending) return;
    this._flushHook.call(this.p);
    this._brushPending = false;
  }

  /** Run fn with a p5 blend mode (for example p.MULTIPLY), then return to normal blending. */
  blend(mode, fn) {
    const { p } = this;
    p.blendMode(mode);
    try {
      fn();
    } finally {
      p.blendMode(p.BLEND);
    }
  }

  /** Seed p5 and p5.brush together (random and noise). Bakes and brush-drawn frames must call this. */
  seed(n) {
    const v = (n >>> 0) % 2147483647;
    this.p.randomSeed(v);
    this.p.noiseSeed(v);
  }

  /**
   * Re-seed only the random stream. Much cheaper than seed(): use it between
   * the parts of one drawing so each part keeps its own grain from frame to
   * frame, after one seed() for the drawing as a whole.
   */
  reseed(n) {
    this.p.randomSeed((n >>> 0) % 2147483647);
  }

  /** Get or create a cached framebuffer. */
  fb(key, w, h, { antialias = false } = {}) {
    const iw = Math.max(1, Math.round(w));
    const ih = Math.max(1, Math.round(h));
    let entry = this._fbs.get(key);
    if (entry && (entry.width !== iw || entry.height !== ih)) {
      entry.remove();
      this._baked.delete(key);
      entry = null;
    }
    if (!entry) {
      entry = this.p.createFramebuffer({ width: iw, height: ih, density: 1, antialias, depth: false });
      this._fbs.set(key, entry);
    }
    return entry;
  }

  /**
   * Draw into a framebuffer. Inside fn the origin is the buffer's top-left
   * corner, p5.brush targets the buffer, and pending strokes are flushed
   * before the scope closes.
   */
  into(target, fn, { clear = true } = {}) {
    const { p } = this;
    this.flush();
    const prev = this.cur;
    target.draw(() => {
      this.cur = { w: target.width, h: target.height, fb: target };
      this._prep();
      if (clear) p.clear();
      this.origin();
      fn(this.cur);
      this.flush();
    });
    this.cur = prev;
    this._prep();
    this.origin();
  }

  /**
   * A layer painted once and then reused: bake("song/mountain", w, h, draw).
   * draw() must be deterministic (seed it), because parallel export workers
   * each rebuild their own copy and the results have to match.
   */
  bake(key, w, h, draw, opts = {}) {
    const target = this.fb(key, w, h, opts);
    if (!this._baked.has(key)) {
      const t0 = performance.now();
      this.into(target, (cur) => draw(cur));
      this._baked.add(key);
      this.stats.bakes += 1;
      this.stats.bakeMs += performance.now() - t0;
    }
    return target;
  }

  isBaked(key) {
    return this._baked.has(key);
  }

  /**
   * Like bake(), for art drawn with the 2D canvas API: draw(ctx) paints a
   * canvas of w x h pixels once, the result is kept as a GPU texture and the
   * canvas itself is released.
   */
  bake2d(key, w, h, draw) {
    return this.bake(key, w, h, () => {
      const layer = new Layer2D(this.p, w, h);
      layer.ctx.save();
      draw(layer.ctx, layer);
      layer.ctx.restore();
      layer.touch();
      this.origin();
      this.image(layer, 0, 0, layer.w, layer.h);
      // p5 remembers a texture for every source it has drawn; let this one go
      const textures = this.p._renderer && this.p._renderer.textures;
      if (textures && typeof textures.get === "function") {
        const tex = textures.get(layer.img);
        if (tex && typeof tex.remove === "function") tex.remove();
        textures.delete(layer.img);
      }
    });
  }

  /** Forget cached layers whose key starts with prefix (frees GPU memory). */
  drop(prefix) {
    for (const [key, entry] of this._fbs) {
      if (key.startsWith(prefix)) {
        entry.remove();
        this._fbs.delete(key);
        this._baked.delete(key);
      }
    }
    for (const key of this._layers.keys()) {
      if (key.startsWith(prefix)) this._layers.delete(key);
    }
  }

  /** Get or create a cached 2D canvas layer. */
  layer(key, w, h) {
    const iw = Math.max(1, Math.round(w));
    const ih = Math.max(1, Math.round(h));
    let entry = this._layers.get(key);
    if (!entry || entry.w !== iw || entry.h !== ih) {
      entry = new Layer2D(this.p, iw, ih);
      this._layers.set(key, entry);
    }
    return entry;
  }

  /**
   * A scratch 2D layer covering the world rectangle (x0, y0)-(x1, y1) as seen
   * through `view`, for things redrawn every frame (the puppet, small moving
   * parts). Returns { layer, ctx, x, y, w, h }: ctx is cleared and already
   * maps world units to the layer; after drawing, call stage.imagePatch(patch).
   * Sizes are rounded up to steps of 128 px so a handful of canvases is reused.
   */
  patch(key, view, x0, y0, x1, y1, pad = 4) {
    const px0 = Math.floor(view.x(x0)) - pad;
    const py0 = Math.floor(view.y(y0)) - pad;
    const w = Math.max(128, Math.ceil((view.x(x1) + pad - px0) / 128) * 128);
    const h = Math.max(128, Math.ceil((view.y(y1) + pad - py0) / 128) * 128);
    const layer = this.layer(`${key}/${w}x${h}`, w, h);
    const ctx = layer.clear();
    ctx.setTransform(view.k, 0, 0, view.k, view.tx - px0, view.ty - py0);
    return { layer, ctx, x: px0, y: py0, w, h };
  }

  /** Composite a patch at its place (target pixel space). */
  imagePatch(patch, alpha = 1) {
    patch.layer.touch();
    this.origin();
    this.image(patch.layer, patch.x, patch.y, patch.w, patch.h, alpha);
  }

  // ---------------------------------------------------------------- drawing

  _tex(src) {
    return src instanceof Layer2D ? src.img : src;
  }

  /**
   * Draw a framebuffer or 2D layer. Coordinates are in the current space
   * (target pixels unless a view is active). alpha in [0, 1].
   */
  image(src, x, y, w, h, alpha = 1) {
    const { p } = this;
    const tex = this._tex(src);
    const dw = w === undefined ? tex.width : w;
    const dh = h === undefined ? tex.height : h;
    if (alpha < 1) p.tint(255, 255 * Math.max(0, alpha));
    p.image(tex, x, y, dw, dh);
    if (alpha < 1) p.noTint();
  }

  /** Draw the sub-rectangle (sx, sy, sw, sh) of a source into (dx, dy, dw, dh). */
  imagePart(src, dx, dy, dw, dh, sx, sy, sw, sh, alpha = 1) {
    const { p } = this;
    if (dw <= 0 || dh <= 0 || sw <= 0 || sh <= 0) return;
    if (alpha < 1) p.tint(255, 255 * Math.max(0, alpha));
    p.image(this._tex(src), dx, dy, dw, dh, sx, sy, sw, sh);
    if (alpha < 1) p.noTint();
  }

  /** Solid rectangle; color is anything p5.fill accepts as a single argument or [r, g, b, a]. */
  rect(x, y, w, h, color) {
    const { p } = this;
    p.noStroke();
    if (Array.isArray(color)) p.fill(...color);
    else p.fill(color);
    p.rect(x, y, w, h);
  }

  /** Run fn with world units mapped through a view. */
  withView(view, fn) {
    const { p } = this;
    p.push();
    p.translate(view.tx, view.ty);
    p.scale(view.k);
    try {
      fn();
    } finally {
      p.pop();
    }
  }

  /**
   * Run fn in "reference pixels": 1920 x 1080 units whatever the real render
   * size. Use it (or withView) around all p5.brush drawing, so brush width
   * and grain keep the same proportions at every resolution.
   */
  refSpace(fn) {
    const { p } = this;
    p.push();
    p.scale(this.s);
    try {
      fn();
    } finally {
      p.pop();
    }
  }

  // ---------------------------------------------------------------- shaders

  /** Compile (once) and return a shader. */
  shader(key, vert, frag) {
    let sh = this._shaders.get(key);
    if (!sh) {
      sh = this.p.createShader(vert, frag);
      this._shaders.set(key, sh);
    }
    return sh;
  }

  /** Fill rectangle (x, y, w, h) of the current space with a shader. vTexCoord runs 0..1 across it. */
  shaderRect(sh, uniforms, x, y, w, h) {
    const { p } = this;
    p.push();
    p.shader(sh);
    for (const name of Object.keys(uniforms)) sh.setUniform(name, uniforms[name]);
    p.noStroke();
    p.fill(255);
    p.rect(x, y, w, h);
    p.pop();
    p.resetShader();
  }

  /** Read back the canvas as a PNG data URL (used by the export tools). */
  toDataURL(type = "image/png", quality) {
    return this.p.canvas.toDataURL(type, quality);
  }
}

export const REF = { W: REF_W, H: REF_H };
