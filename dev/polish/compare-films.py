#!/usr/bin/env python3
"""Every frame of one render of the whole film against another: which stretches changed?

  python3 dev/polish/compare-films.py frames/final frames/next      (two folders of 8220 frames at 60 a second)

Frames are a pure function of time, so a stretch that a change did not touch is byte-identical.
In the final polish this compared the finished film with the film before it: 3672 frames identical,
every changed stretch belonging to a ruling in briefs/POLISH.md.
"""
import filecmp, os, sys
A = sys.argv[1] if len(sys.argv) > 1 else "frames/film"
B = sys.argv[2] if len(sys.argv) > 2 else "frames/final"
FPS = 60
N = 8220
names = ["intro"] + ["S%02d" % n for n in range(1, 21)] + ["outro"]
def part(t):
    if t < 5: return 0
    if t >= 125: return 21
    return 1 + int((t - 5) // 6)
same = [None] * N
missing = 0
for i in range(N):
    a = os.path.join(A, "f_%06d.png" % i); b = os.path.join(B, "f_%06d.png" % i)
    if not (os.path.exists(a) and os.path.exists(b)):
        missing += 1; continue
    same[i] = filecmp.cmp(a, b, shallow=False)
print("%d frames compared, %d missing; %d byte-identical, %d changed" % (N - missing, missing, sum(1 for s in same if s), sum(1 for s in same if s is False)))
print("\nper part: identical / changed")
for p in range(22):
    idx = [i for i in range(N) if part(i / FPS) == p]
    print("  %-6s %4d / %4d" % (names[p], sum(1 for i in idx if same[i]), sum(1 for i in idx if same[i] is False)))
print("\nchanged stretches (film seconds):")
i = 0
while i < N:
    if same[i] is False:
        j = i
        while j + 1 < N and same[j + 1] is False: j += 1
        print("  %8.3f - %8.3f  (%4d frames)  %s .. %s" % (i / FPS, j / FPS, j - i + 1, names[part(i / FPS)], names[part(j / FPS)]))
        i = j + 1
    else:
        i += 1
