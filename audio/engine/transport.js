// Live playback for the preview page.
//
// The transport owns the AudioContext, keeps a Player scheduled a second and
// a half ahead of the playhead, and is the film's clock while it plays: each
// frame is drawn for the film time that will be leaving the loudspeakers when
// that frame is on the screen, so sound and picture cannot drift apart.
//
//   play(filmTime)   start, or carry on after a pause
//   pause()          freeze (the context is suspended in every case, held notes survive)
//   seek(filmTime)   jump; if playing, sound restarts there after a short hold
//   finish()         the picture has ended: let the last sound run out
//   time()           film time to draw now
//
// Film time f sounds at context time T0 + f. Everything is scheduled in
// context time, so a main-thread stall shorter than LOOKAHEAD cannot move a
// note; after a longer one the schedule is started afresh on the same clock
// (tick), so nothing is ever played late.
//
// One thing found by testing and left alone: when pause() lands while Chrome is serving the
// audio device, the context's clock is advanced by a block or two (2.7 ms each) that the
// graph never renders. After the resume, sounds that were ringing are that much late against
// the clock until they die away; sounds that begin afterwards are on time. It cannot be heard,
// and the only cure (starting the schedule afresh on every resume) would cut every held note.
//
// What the clock can and cannot know. The browser reports when a sample
// leaves the audio device (getOutputTimestamp) and when a frame begins
// (document.timeline). A frame drawn now is on the screen one display refresh
// later at the earliest, so the picture is drawn that far ahead of the sound.
// Delays the browser is not told about (a television's processing, wireless
// loudspeakers) cannot be measured from here: `pictureDelay` corrects them by
// hand (?sync=, and the [ and ] keys in the preview).

import { Player } from "./player.js";

const LOOKAHEAD = 1.5; // seconds of film scheduled ahead of the playhead
const TICK_MS = 100; // how often the scheduler runs
const LEAD = 0.08; // seconds between starting and the first sound
const SEEK_HOLD_MS = 120; // after a seek while playing, wait this long for the scrubbing to stop
const LATE_MARGIN = 0.02; // an event due sooner than this can no longer be scheduled on time
const TAIL_MS = 300; // after the film's last sample has been heard, how long before the context is put to sleep
const STUCK_MS = 4000; // a context that has not come to life this long after play was pressed will not

export class Transport {
  constructor(track) {
    this.track = track;
    this.ac = null;
    this.player = null;
    this.enabled = true;
    /** True while sound is running and time() follows the audio clock. */
    this.running = false;
    this.wantPlaying = false;
    this.holdFilm = 0;
    this.T0 = 0;
    this.floor = 0;
    this.anchor = null;
    this.stale = true;
    this.timer = null;
    this.pending = null;
    this.token = 0;
    this.volume = 1;
    this.muted = false;
    this.tap = null;
    /**
     * Seconds by which the picture is drawn later than the clock says (negative: earlier).
     * For delays the browser cannot know: wireless loudspeakers (positive), a slow display (negative).
     */
    this.pictureDelay = 0;
    /** Recent intervals between display frames, in seconds (see refresh). */
    this.vsyncs = [];
    this.lastVsync = 0;
    this.raf = null;
    this.anchoredAt = 0;
    this.lastTimeCall = 0;
    this.wantSince = 0;
    /** The last frame's clock reading, for measurement: { drawn, heard, ahead (seconds), held }. */
    this.lastFrame = null;
    /**
     * worstCorrection: largest gap seen between the smoothed clock and the audio clock, in seconds.
     * late: scheduler ticks that found an event already due (each one starts the schedule afresh: resyncs).
     */
    this.stats = { generations: 0, worstCorrection: 0, late: 0, resyncs: 0 };
    /** Every start: { T0 (context time of film time 0), film (where it began), ctx (context time it was begun at) }. */
    this.log = [];
  }

  /** Create the context. The first call must come from a click or a key press. */
  unlock() {
    if (this.ac) return this.ac;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ac = new AC({ sampleRate: 48000, latencyHint: "interactive" });
      this.outGain = this.ac.createGain();
      this.outGain.gain.value = this.muted ? 0 : this.volume;
      this.outGain.connect(this.ac.destination);
    } catch (err) {
      console.error(`[sound] no audio: ${err}`);
      this.enabled = false;
    }
    return this.ac;
  }

  setVolume(v) {
    this.volume = v;
    this.applyVolume();
  }

  setMuted(m) {
    this.muted = m;
    this.applyVolume();
  }

  applyVolume() {
    if (!this.ac) return;
    const g = this.outGain.gain;
    const now = this.ac.currentTime;
    g.cancelScheduledValues(now);
    g.setTargetAtTime(this.muted ? 0 : this.volume, now, 0.015);
  }

  // ---------------------------------------------------------------- the clock

  /** Film time now leaving the loudspeakers, from the audio clock. */
  heard() {
    const ac = this.ac;
    let ctxNow;
    const ts = typeof ac.getOutputTimestamp === "function" ? ac.getOutputTimestamp() : null;
    if (ts && ts.contextTime > 0 && ts.performanceTime > 0) ctxNow = ts.contextTime + (performance.now() - ts.performanceTime) / 1000;
    else ctxNow = ac.currentTime - (ac.outputLatency || ac.baseLatency || 0);
    return ctxNow - this.T0;
  }

  /**
   * One refresh of the display, in seconds: the lower quartile of the recent
   * intervals between animation frames (a frame that took too long shows as a
   * multiple, so the short ones are the display's own rhythm). 1/60 until measured.
   */
  get refresh() {
    const v = this.vsyncs;
    if (v.length < 8) return 1 / 60;
    const sorted = [...v].sort((a, b) => a - b);
    return Math.min(1 / 24, Math.max(1 / 240, sorted[Math.floor(sorted.length / 4)]));
  }

  /** Measure the display's rhythm while the film runs. */
  watchDisplay() {
    if (this.raf !== null || typeof requestAnimationFrame !== "function") return;
    this.lastVsync = 0;
    const step = (ts) => {
      this.raf = null;
      if (!this.running) return;
      if (this.lastVsync) {
        const d = (ts - this.lastVsync) / 1000;
        if (d > 0.002 && d < 0.1) {
          this.vsyncs.push(d);
          if (this.vsyncs.length > 40) this.vsyncs.shift();
        }
      }
      this.lastVsync = ts;
      this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }

  /**
   * Wall-clock time (seconds, on performance.now's scale) at which the frame being
   * drawn now can first be on the screen: one display refresh after this frame began.
   */
  shownAt(now) {
    let begun = now;
    const tl = typeof document !== "undefined" && document.timeline ? document.timeline.currentTime : null;
    if (typeof tl === "number" && now - tl / 1000 >= 0 && now - tl / 1000 < 0.1) begun = tl / 1000;
    return begun + this.refresh;
  }

  /**
   * Film time to draw. While running this is the wall clock, steered gently
   * onto the audio clock: the audio clock is the truth but advances in steps
   * of a device buffer, which would make motion judder if used raw. The frame
   * is drawn for the moment it will be seen (shownAt), not for the moment it
   * is computed: otherwise the sound would lead the picture by a display refresh.
   */
  time() {
    if (!this.running) return this.holdFilm;
    const now = performance.now() / 1000;
    const raw = this.heard();
    if (this.anchor === null) {
      this.anchor = raw - now;
      this.anchoredAt = now;
      this.lastTimeCall = now;
    }
    const err = raw - (now + this.anchor);
    if (Math.abs(err) > 0.08) {
      this.anchor = raw - now; // a stall or a device change: jump to the truth
      this.anchoredAt = now;
    } else {
      // Steered by elapsed time, not by call (the page may ask twice in a frame, or not for a
      // while). For the first half second after a start the audio clock's first reading may be
      // a device buffer off, so the steering is quick; after that it is gentle (0.4 s).
      const settled = now - this.anchoredAt > 0.5;
      const dt = Math.min(0.1, Math.max(0, now - this.lastTimeCall));
      this.anchor += err * (1 - Math.exp(-dt / (settled ? 0.4 : 0.05)));
      if (settled && Math.abs(err) > this.stats.worstCorrection) this.stats.worstCorrection = Math.abs(err);
    }
    this.lastTimeCall = now;
    const shown = this.shownAt(now);
    const wanted = shown + this.anchor - this.pictureDelay;
    const drawn = Math.max(this.floor, wanted);
    // held: the clock is waiting at its floor by more than a tenth of a millisecond (before the first
    // sound of a start, or after the picture was set later by hand)
    this.lastFrame = { drawn, heard: raw, ahead: shown - now, held: wanted < this.floor - 1e-4 };
    this.floor = drawn; // while it runs, the clock never steps back
    return drawn;
  }

  /** Stop the context's own clock: nothing sounds and nothing advances. Safe in any state. */
  sleep() {
    const ac = this.ac;
    if (!ac || ac.state === "closed") return;
    const done = ac.suspend();
    if (done && typeof done.catch === "function") done.catch(() => {});
  }

  /**
   * True when play was asked for but the context has not come to life for seconds: a browser
   * that will not start audio. The clock then gives the soundtrack up (giveUp) and runs on the
   * wall clock, so that the picture does not stand for ever.
   */
  get stuck() {
    return this.enabled && this.wantPlaying && !this.running && !this.pending && this.wantSince > 0 && performance.now() - this.wantSince > STUCK_MS;
  }

  giveUp() {
    console.warn("[sound] the audio did not start in this browser; the film plays without sound");
    this.enabled = false;
    this.wantPlaying = false;
    this.token += 1;
    this.cut();
  }

  // ---------------------------------------------------------------- control

  play(filmTime) {
    if (!this.enabled) return;
    const ac = this.unlock();
    if (!ac) return;
    this.wantPlaying = true;
    this.wantSince = performance.now();
    if (this.player && !this.stale) {
      // carry on where the context was suspended
      const token = (this.token += 1);
      ac.resume()
        .then(() => {
          if (token !== this.token || !this.wantPlaying) {
            // paused again before the context came back: it must not be left running
            if (!this.wantPlaying) this.sleep();
            return;
          }
          this.anchor = null;
          this.floor = this.holdFilm; // the picture never steps back from where it was held
          this.running = true;
          this.startTimer();
          this.watchDisplay();
        })
        .catch((err) => console.error(`[sound] could not resume: ${err}`));
      return;
    }
    this.begin(filmTime, 0);
  }

  /** Start a new generation at film time `filmTime` after `delayMs`. */
  begin(filmTime, delayMs) {
    this.cut();
    this.holdFilm = filmTime;
    const token = (this.token += 1);
    const go = async () => {
      this.pending = null;
      this.wantSince = performance.now();
      const ac = this.ac;
      try {
        await ac.resume();
      } catch (err) {
        console.error(`[sound] could not start: ${err}`);
      }
      if (token !== this.token || !this.wantPlaying) {
        if (!this.wantPlaying) this.sleep(); // paused before the context came to life
        return;
      }
      const c = ac.currentTime;
      this.player = new Player(ac, this.track, { dest: this.outGain });
      // T0 is a whole number of render blocks (128 samples). Film time then falls on the same
      // samples, and on the same blocks, as in the offline render (which starts at film time 0):
      // parameters that Web Audio updates once per block, such as a tape's playback rate, change
      // at the same film moments, and the live graph produces the same samples as the WAV.
      const BLOCK = 128;
      this.T0 = (Math.round(((c + LEAD - filmTime) * ac.sampleRate) / BLOCK) * BLOCK) / ac.sampleRate;
      this.floor = filmTime;
      this.player.start(filmTime, this.T0 + filmTime);
      this.player.pump(filmTime + LOOKAHEAD);
      this.stale = false;
      this.anchor = null;
      this.running = true;
      this.stats.generations += 1;
      this.log.push({ T0: this.T0, film: filmTime, ctx: c });
      this.startTimer();
      this.watchDisplay();
    };
    if (delayMs > 0) this.pending = setTimeout(go, delayMs);
    else go();
  }

  pause() {
    this.wantPlaying = false;
    this.token += 1;
    if (this.pending) {
      clearTimeout(this.pending);
      this.pending = null;
    }
    this.stopTimer();
    if (this.running) {
      this.holdFilm = this.time();
      this.running = false;
    }
    // Whether or not sound was running: play() may have asked the context to resume a moment
    // ago, and that resume arrives later. Without this the old schedule would play on while
    // the picture stands (found by pressing play and pause in the same instant).
    this.sleep();
  }

  seek(filmTime, playing) {
    this.holdFilm = filmTime;
    this.stale = true;
    if (!this.enabled || !this.ac) return;
    if (playing && this.wantPlaying) this.begin(filmTime, SEEK_HOLD_MS);
    else this.cut();
  }

  /** Silence at once, and nothing left to resume. */
  stop() {
    this.wantPlaying = false;
    const token = (this.token += 1);
    this.cut();
    // once the short fade has run, the context need not stay awake
    setTimeout(() => {
      if (token === this.token && !this.wantPlaying) this.sleep();
    }, 80);
  }

  /**
   * The picture has reached the end of the film (it runs a display refresh ahead
   * of the sound): hold the clock there and let what is still sounding run out.
   */
  finish(filmTime) {
    this.wantPlaying = false;
    const token = (this.token += 1);
    if (this.pending) clearTimeout(this.pending);
    this.stopTimer();
    // how much of the film has still to be heard: the picture is ahead of the sound by a
    // display refresh, and by more if the picture was set earlier by hand
    const left = this.running ? Math.min(1.5, Math.max(0, filmTime - this.heard())) : 0;
    this.holdFilm = filmTime;
    this.running = false;
    this.stale = true;
    this.pending = setTimeout(() => {
      this.pending = null;
      if (token !== this.token) return;
      this.cut();
      this.sleep(); // nothing is sounding any more: the context need not stay awake
    }, left * 1000 + TAIL_MS);
  }

  /** Silence the current generation and forget it. */
  cut() {
    if (this.pending) {
      clearTimeout(this.pending);
      this.pending = null;
    }
    this.stopTimer();
    if (this.player) {
      this.player.stop(this.ac.state === "running" ? 0.03 : 0);
      this.player = null;
    }
    this.running = false;
    this.stale = true;
  }

  startTimer() {
    this.stopTimer();
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  stopTimer() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Keep the schedule ahead of the playhead. */
  tick() {
    if (!this.player || !this.running) return;
    const film = this.ac.currentTime - this.T0;
    const next = this.track.events[this.player.index];
    if (next && next.t < film + LATE_MARGIN) {
      // The main thread was held up for longer than LOOKAHEAD (or its timer was throttled):
      // events that should be sounding by now were never scheduled. Scheduling them now would
      // play them late, in a heap. Start the schedule afresh a moment ahead instead, on the same
      // clock: a short gap, then every sound where it belongs, the long ones picked up part-way.
      this.stats.late += 1;
      this.resync(film + LEAD);
      return;
    }
    this.player.pump(film + LOOKAHEAD);
  }

  /** A new generation from `filmTime` on, keeping T0: the clock does not move. */
  resync(filmTime) {
    this.player.stop(0.03);
    this.player = new Player(this.ac, this.track, { dest: this.outGain });
    this.player.start(filmTime, this.T0 + filmTime);
    this.player.pump(filmTime + LOOKAHEAD);
    this.stats.resyncs += 1;
    this.log.push({ T0: this.T0, film: filmTime, ctx: this.ac.currentTime, resync: true });
  }

  // ---------------------------------------------------------------- measurement

  /**
   * Record what the live graph plays, sample for sample, with the context
   * frame of every block (tools/audio-live.mjs compares it with the offline
   * render). Call before play().
   */
  async startTap() {
    const ac = this.unlock();
    await ac.audioWorklet.addModule(new URL("./tap-worklet.js", import.meta.url));
    const node = new AudioWorkletNode(ac, "tap", { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 2, channelCountMode: "explicit" });
    const blocks = [];
    node.port.onmessage = (e) => blocks.push(e.data);
    this.outGain.connect(node);
    node.connect(ac.destination);
    this.tap = { node, blocks };
    return this.tap;
  }
}
