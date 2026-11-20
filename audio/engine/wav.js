// WAV files: 24-bit PCM, written from Float32Array channels.

/** Encode channels (Float32Arrays of equal length, -1..1) as a 24-bit PCM WAV. Returns a Uint8Array. */
export function encodeWav(channels, sampleRate) {
  const nCh = channels.length;
  const n = channels[0].length;
  const bytesPerSample = 3;
  const dataBytes = n * nCh * bytesPerSample;
  const out = new Uint8Array(44 + dataBytes);
  const view = new DataView(out.buffer);
  const text = (at, s) => {
    for (let i = 0; i < s.length; i += 1) out[at + i] = s.charCodeAt(i);
  };
  text(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, nCh, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * nCh * bytesPerSample, true);
  view.setUint16(32, nCh * bytesPerSample, true);
  view.setUint16(34, 24, true);
  text(36, "data");
  view.setUint32(40, dataBytes, true);
  let at = 44;
  for (let i = 0; i < n; i += 1) {
    for (let c = 0; c < nCh; c += 1) {
      let v = channels[c][i];
      v = v > 1 ? 1 : v < -1 ? -1 : v;
      let s = Math.round(v * 8388607);
      if (s < 0) s += 16777216;
      out[at] = s & 255;
      out[at + 1] = (s >> 8) & 255;
      out[at + 2] = (s >> 16) & 255;
      at += 3;
    }
  }
  return out;
}

/** Base64 of a slice of bytes (for handing a large file to the render tool in pieces). */
export function base64Slice(bytes, from, to) {
  let s = "";
  const end = Math.min(to, bytes.length);
  const STEP = 0x8000;
  for (let i = from; i < end; i += STEP) s += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(end, i + STEP)));
  return btoa(s);
}
