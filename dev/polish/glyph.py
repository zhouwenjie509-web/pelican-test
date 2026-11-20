#!/usr/bin/env python3
"""How tall is this lettering on screen? Measures the ink inside a box of a rendered frame.

  python3 dev/polish/glyph.py out/shots/t24.000.png X0 Y0 X1 Y1 [--thr 70] [--save crop.png]

Put the box round ONE glyph (a capital letter, a digit, a Chinese character) with a little ground on
every side. The ground is taken to be the commonest colour in the box; ink is every pixel that differs
from it by more than --thr (0..255, largest channel). Prints the ink's height and width in pixels and
where it lies. --save writes the box enlarged four times, with the measured extent marked, so that you
can see what was measured. The rule (scene guide 4.3), on a 1920 x 1080 frame at zoom 1.1: a Chinese
name at least 44 px tall; capitals and digits of every other title line at least 26 px.
"""
import argparse, sys
from collections import Counter
from PIL import Image, ImageDraw

ap = argparse.ArgumentParser()
ap.add_argument("png"); ap.add_argument("x0", type=int); ap.add_argument("y0", type=int); ap.add_argument("x1", type=int); ap.add_argument("y1", type=int)
ap.add_argument("--thr", type=int, default=70)
ap.add_argument("--save")
a = ap.parse_args()
im = Image.open(a.png).convert("RGB")
if im.size != (1920, 1080):
    print("note: the frame is %dx%d, not 1920x1080; the rule is for 1920x1080" % im.size)
box = im.crop((a.x0, a.y0, a.x1, a.y1))
w, h = box.size
px = box.load()
ground = Counter((px[x, y][0] // 8, px[x, y][1] // 8, px[x, y][2] // 8) for y in range(h) for x in range(w)).most_common(1)[0][0]
g = tuple(c * 8 + 4 for c in ground)
rows = [0] * h; cols = [0] * w
for y in range(h):
    for x in range(w):
        p = px[x, y]
        if max(abs(p[0] - g[0]), abs(p[1] - g[1]), abs(p[2] - g[2])) > a.thr:
            rows[y] += 1; cols[x] += 1
ys = [y for y in range(h) if rows[y] > 0]; xs = [x for x in range(w) if cols[x] > 0]
if not ys:
    sys.exit("no ink found in the box at this threshold (ground colour about %s); lower --thr or move the box" % (g,))
top, bot, left, right = ys[0], ys[-1], xs[0], xs[-1]
print("ink: %d px tall, %d px wide; rows y %d..%d, columns x %d..%d of the frame; ground about rgb%s; threshold %d" % (bot - top + 1, right - left + 1, a.y0 + top, a.y0 + bot, a.x0 + left, a.x0 + right, g, a.thr))
if top == 0 or bot == h - 1 or left == 0 or right == w - 1:
    print("warning: the ink touches the edge of the box: the glyph may be cut, or something else is in the box. Widen or move the box.")
if a.save:
    big = box.resize((w * 4, h * 4), Image.NEAREST)
    d = ImageDraw.Draw(big)
    d.rectangle((left * 4, top * 4, right * 4 + 3, bot * 4 + 3), outline=(255, 0, 255))
    big.save(a.save)
