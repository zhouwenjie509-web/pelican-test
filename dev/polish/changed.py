#!/usr/bin/env python3
"""What did my change do to the picture, and where?

Renders a stretch of the film as the code now stands, ten frames a second, and compares every frame,
pixel for pixel, with the same frame of a reference render at 60 frames a second (by default the frames
the finished video was made from, frames/final). Frames are a pure function of time, so an untouched
frame is byte-identical; a changed one is reported with the number of pixels that differ and the box
that holds them. This is how every change of the final polish was proved to touch nothing else.

  python3 dev/polish/changed.py --section 7              (run from the project's root, or from a copy of it)
  python3 dev/polish/changed.py --from 41.0 --to 44.0 [--fps 10]
  python3 dev/polish/changed.py --section 7 --crops      also write a crop of every changed box, before | after, to out/changed/
  python3 dev/polish/changed.py --section 7 --ref /path/to/another/frames/folder

A section's stretch is from 1 s before it to 1 s after it (both crossings and what shows beyond them).
The reference folder is made by `node tools/render.mjs --fps 60 --out frames/final` (the export does it).
Needs Python 3 with Pillow, besides what the project itself needs.
"""
import argparse, os, subprocess, sys
from PIL import Image, ImageChops

ap = argparse.ArgumentParser()
ap.add_argument("--section", type=int)
ap.add_argument("--from", dest="a", type=float)
ap.add_argument("--to", dest="b", type=float)
ap.add_argument("--fps", type=int, default=10)
ap.add_argument("--crops", action="store_true")
ap.add_argument("--ref", default="frames/final", help="reference frames at 60 fps (default frames/final)")
args = ap.parse_args()
if args.section:
    a = 5 + 6 * (args.section - 1) - 1.0
    b = 5 + 6 * args.section + 1.0
else:
    a, b = args.a, args.b
if a is None or b is None:
    sys.exit("give --section N or --from A --to B")
if 60 % args.fps:
    sys.exit("--fps must divide 60")
a = max(0.0, a); b = min(137.0, b)
root = os.getcwd()
if not os.path.exists(os.path.join(root, "tools", "render.mjs")):
    sys.exit("run this from the root of the project (or of a copy of it)")
MAIN = os.path.abspath(args.ref)
if not os.path.isdir(MAIN):
    sys.exit("no reference frames at %s: render them first (node tools/render.mjs --fps 60 --out frames/final) or give --ref" % MAIN)
out = os.path.join(root, "out", "changed", "frames")
os.makedirs(out, exist_ok=True)
for f in os.listdir(out):
    os.remove(os.path.join(out, f))
r = subprocess.run(["node", "tools/render.mjs", "--from", str(a), "--to", str(b), "--fps", str(args.fps), "--workers", "2", "--out", "out/changed/frames"], capture_output=True, text=True)
if r.returncode != 0:
    sys.exit(r.stdout + r.stderr)
k = 60 // args.fps
same = changed = 0
union = None
for name in sorted(os.listdir(out)):
    i = int(name[2:8])
    t = i / args.fps
    ref = os.path.join(MAIN, "f_%06d.png" % (i * k))
    if not os.path.exists(ref):
        print("%8.3f s  no reference frame" % t); continue
    A = Image.open(ref).convert("RGB"); B = Image.open(os.path.join(out, name)).convert("RGB")
    d = ImageChops.difference(A, B)
    box = d.getbbox()
    if box is None:
        same += 1; continue
    changed += 1
    n = sum(d.convert("L").point(lambda v: 255 if v else 0).histogram()[255:])
    worst = max(max(band.getextrema()) for band in d.split())
    union = box if union is None else (min(union[0], box[0]), min(union[1], box[1]), max(union[2], box[2]), max(union[3], box[3]))
    sec = int((t - 5) // 6) + 1 if 5 <= t < 125 else (0 if t < 5 else 21)
    u = t - (5 + 6 * (sec - 1)) if 1 <= sec <= 20 else t
    print("%8.3f s  (S%02d u %5.2f)  %8d px differ, largest step %3d of 255, box x %4d..%4d  y %4d..%4d" % (t, sec, u, n, worst, box[0], box[2], box[1], box[3]))
    if args.crops:
        pad = 24
        c = (max(0, box[0] - pad), max(0, box[1] - pad), min(A.width, box[2] + pad), min(A.height, box[3] + pad))
        w, h = c[2] - c[0], c[3] - c[1]
        sheet = Image.new("RGB", (w * 2 + 8, h), (255, 0, 255))
        sheet.paste(A.crop(c), (0, 0)); sheet.paste(B.crop(c), (w + 8, 0))
        sheet.save(os.path.join(root, "out", "changed", "t%.3f_before-after.png" % t))
print("\n%d frames compared from %.2f to %.2f s: %d byte-identical to the reference, %d changed%s" % (same + changed, a, b, same, changed, ("; all changes lie inside x %d..%d, y %d..%d" % (union[0], union[2], union[1], union[3])) if union else ""))
