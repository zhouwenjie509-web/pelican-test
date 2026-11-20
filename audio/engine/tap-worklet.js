// Measurement only: passes sound through untouched and reports every block
// (128 frames, mixed to mono) with the context frame it begins at.
//
// The frame is counted here, block by block, from the first block's stamp:
// the browser's own `currentFrame` is sometimes stale for a few blocks in a
// row and then jumps, although every block is processed exactly once. Each
// message also carries the browser's stamp, so the tool can see whether the
// two ever part for good (which would mean a block was really skipped).

class Tap extends AudioWorkletProcessor {
  constructor() {
    super();
    this.next = null;
  }

  process(inputs) {
    // eslint-disable-next-line no-undef
    const stamp = currentFrame;
    if (this.next === null || stamp > this.next) this.next = stamp; // the first block, or blocks were skipped
    const input = inputs[0];
    const n = input && input.length ? input[0].length : 128;
    if (input && input.length) {
      const l = input[0];
      const r = input[1] || input[0];
      const mono = new Float32Array(l.length);
      for (let i = 0; i < l.length; i += 1) mono[i] = 0.5 * (l[i] + r[i]);
      this.port.postMessage({ frame: this.next, stamp, mono }, [mono.buffer]);
    }
    this.next += n;
    return true;
  }
}

registerProcessor("tap", Tap);
