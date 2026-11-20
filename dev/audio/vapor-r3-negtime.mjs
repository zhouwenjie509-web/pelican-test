// What at(u0) = when - off + ((u + off) - u) gives with when = 0 (engine clamp), for the
// seekable tape events A (u 0.8), B (u 4.0) and bed (u -0.02), preroll 8 s before each render start.
for (const from of [116.0, 117.2, 118.9, 120.3]) {
  const pre = from - 8 - 107; // film u at which the preroll begins
  for (const [name, u, dur] of [["bed", -0.02, 7.6], ["A", 0.8, 2.2], ["B", 4.0, 1.206]]) {
    if (pre <= u || pre >= u + dur) continue;
    const off = (from - 8) - (107 + u), when = 0;
    console.log(from, name, "off", off.toFixed(3), "at(u0) =", when - off + ((u + off) - u));
  }
}
