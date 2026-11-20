// The plain skin: a clean flat-colour pelican and bicycle on a 2D canvas.
// It is the reference look for checking the rig, and what the placeholder
// scenes use. Period styles get their own skins that read the same skeleton.

const INK = "#2a2623";

export const PLAIN = {
  ink: INK,
  feather: "#faf7f0",
  featherShade: "#e9e3d6",
  wingtip: INK,
  bill: "#f3a83b",
  pouch: "#f8c96a",
  leg: "#e8892b",
  legFar: "#b86a1d",
  foot: "#f09a36",
  footFar: "#c4761f",
  frame: "#c7402d",
  metal: "#9aa0a6",
  metalDark: "#5f6368",
  tire: INK,
  spoke: "#b9bcc0",
  saddle: "#4a3222",
  bell: "#d8b13a",
  reflector: "#f0a030",
};

const FEATHERED = new Set(["tail", "body", "neck", "head", "crest"]);

/**
 * Begin a 2D-canvas path for one rig shape (circle, open line or closed
 * polygon). Exported so other canvas skins need not repeat it.
 */
export function traceShape(ctx, sh) {
  trace(ctx, sh);
}

function trace(ctx, sh) {
  ctx.beginPath();
  if (sh.kind === "circle") {
    ctx.arc(sh.c[0], sh.c[1], sh.r, 0, Math.PI * 2);
    return;
  }
  const pts = sh.pts;
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i][0], pts[i][1]);
  if (sh.closed) ctx.closePath();
}

/**
 * Draw the puppet. The context must already map the skeleton's units to
 * pixels (view.apply2d(ctx)).
 *
 * options: { palette, outline (line width as a fraction of the wheel radius), alpha,
 *            halo: { color, width } a border round the whole figure, like a cut-out sticker }
 */
export function drawPlain(ctx, skel, options = {}) {
  const pal = { ...PLAIN, ...(options.palette || {}) };
  const S = skel.scale;
  const lw = (options.outline ?? 0.05) * S;

  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  if (options.alpha !== undefined) ctx.globalAlpha = options.alpha;

  if (options.halo) {
    // every part stroked wide in one colour first: the union reads as a sticker's border
    ctx.strokeStyle = options.halo.color;
    ctx.fillStyle = options.halo.color;
    for (const sh of skel.shapes) {
      if (sh.tag === "spoke" || sh.tag === "chain" || sh.tag === "wingfold" || sh.tag === "lid") continue;
      trace(ctx, sh);
      ctx.lineWidth = (sh.kind === "line" ? sh.w : sh.w || 0) + options.halo.width * S * 2;
      ctx.stroke();
      if (sh.kind !== "line" && sh.tag !== "tire" && sh.tag !== "rim" && sh.tag !== "ring") ctx.fill();
    }
  }

  const fill = (sh, color) => {
    trace(ctx, sh);
    ctx.fillStyle = color;
    ctx.fill();
  };
  const stroke = (sh, color, width) => {
    trace(ctx, sh);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  };
  const both = (sh, color) => {
    trace(ctx, sh);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = lw;
    ctx.stroke();
  };

  let featherOutlineDone = false;
  for (const sh of skel.shapes) {
    const far = sh.side === "far";
    switch (sh.tag) {
      case "tire":
        stroke(sh, pal.tire, sh.w);
        break;
      case "rim":
        stroke(sh, pal.metal, sh.w);
        break;
      case "spoke":
        stroke(sh, pal.spoke, Math.max(sh.w, lw * 0.35));
        break;
      case "reflector":
        fill(sh, pal.reflector);
        break;
      case "hub":
        fill(sh, pal.metalDark);
        break;
      case "frame":
        stroke(sh, pal.ink, sh.w + lw * 1.2);
        stroke(sh, pal.frame, sh.w);
        break;
      case "post":
      case "bar":
        stroke(sh, pal.metalDark, sh.w + lw * 0.6);
        stroke(sh, pal.metal, sh.w * 0.6);
        break;
      case "grip":
        stroke(sh, pal.ink, sh.w);
        break;
      case "bell":
        both(sh, pal.bell);
        break;
      case "saddle":
        both(sh, pal.saddle);
        break;
      case "chain":
        stroke(sh, pal.metalDark, Math.max(sh.w, lw * 0.5));
        break;
      case "ring":
        stroke(sh, pal.metalDark, sh.w);
        break;
      case "crank":
        stroke(sh, far ? pal.metalDark : pal.metal, sh.w);
        break;
      case "pedal":
        fill(sh, pal.ink);
        break;
      case "leg":
        stroke(sh, pal.ink, sh.w + lw * 1.2);
        stroke(sh, far ? pal.legFar : pal.leg, sh.w);
        break;
      case "foot":
        both(sh, far ? pal.footFar : pal.foot);
        break;
      case "tail":
      case "body":
      case "neck":
      case "head":
      case "crest":
        if (!featherOutlineDone) {
          // one shared outline behind all the white parts, so they read as a single bird
          for (const other of skel.shapes) {
            if (FEATHERED.has(other.tag)) stroke(other, pal.ink, lw * 2);
          }
          featherOutlineDone = true;
        }
        fill(sh, pal.feather);
        break;
      case "bill":
        both(sh, pal.bill);
        break;
      case "pouch":
        both(sh, pal.pouch);
        break;
      case "eye":
        both(sh, "#ffffff");
        break;
      case "pupil":
        fill(sh, pal.ink);
        break;
      case "lid":
        fill(sh, pal.feather);
        ctx.beginPath();
        ctx.moveTo(sh.c[0] - sh.r, sh.c[1]);
        ctx.lineTo(sh.c[0] + sh.r, sh.c[1]);
        ctx.strokeStyle = pal.ink;
        ctx.lineWidth = lw;
        ctx.stroke();
        break;
      case "wing":
        both(sh, pal.featherShade);
        break;
      case "wingtip":
        both(sh, pal.wingtip);
        break;
      case "wingfold":
        stroke(sh, pal.ink, lw * 0.7);
        break;
      default:
        break;
    }
  }
  ctx.restore();
}
