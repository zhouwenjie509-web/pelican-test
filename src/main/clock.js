// Playback clock for the preview.
//
// With a soundtrack attached, the audio clock is the film's clock while it
// plays: each frame is drawn for the film time that will be sounding when the
// frame is on the screen, so picture and sound cannot drift apart. Without one
// (export mode, ?sound=0, or a browser that refuses audio) the clock runs on
// the wall clock.

import { clamp } from "../beat/ease.js";

export class Clock {
  constructor(duration) {
    this.duration = duration;
    this._t = 0;
    this._playing = false;
    this._startedAt = 0;
    this.onend = null;
    /** The live transport (audio/engine/transport.js), once the soundtrack is loaded. */
    this.audio = null;
  }

  /** Let the soundtrack drive the clock. */
  attach(transport) {
    this.audio = transport;
  }

  get sounding() {
    return Boolean(this.audio && this.audio.enabled);
  }

  _now() {
    return performance.now() / 1000;
  }

  get playing() {
    return this._playing;
  }

  get time() {
    if (!this._playing) return this._t;
    if (this.sounding && this.audio.stuck) {
      // the browser will not start the audio: carry on from where the film stands, without it
      this.audio.giveUp();
      this._startedAt = this._now();
    }
    const t = this.sounding ? this.audio.time() : this._t + (this._now() - this._startedAt);
    if (t >= this.duration) {
      this._t = this.duration;
      this._playing = false;
      if (this.sounding) this.audio.finish(this.duration); // the last sound runs out by itself
      if (this.onend) this.onend();
      return this.duration;
    }
    return t;
  }

  play() {
    if (this._playing) return;
    if (this._t >= this.duration - 1e-3) {
      this._t = 0;
      if (this.sounding) this.audio.seek(0, false);
    }
    this._startedAt = this._now();
    this._playing = true;
    if (this.sounding) this.audio.play(this._t);
  }

  pause() {
    if (!this._playing) return;
    if (this.sounding) {
      // the transport decides where the film stands, so that both hold exactly the same time
      this.audio.pause();
      this._t = Math.min(this.duration, this.audio.holdFilm);
    } else {
      this._t = this.time;
    }
    this._playing = false;
  }

  toggle() {
    if (this._playing) this.pause();
    else this.play();
  }

  seek(t) {
    this._t = clamp(t, 0, this.duration);
    this._startedAt = this._now();
    if (this.sounding) this.audio.seek(this._t, this._playing);
  }
}
