// The mixing desk: one level per part, in decibels.
//
// A part is written to its own loudness target (see briefs/MUSIC_GUIDE.md) and
// balanced here against the others. These numbers are set by measurement
// (tools/audio-check.mjs), not inside the parts.

export const MIX = {
  intro: 0,
  sahara: 0,
  egypt: 0,
  han: 0,
  tang: 0,
  song: 0,
  qingming: 0,
  maya: 0,
  mughal: 0,
  bada: 0,
  wayang: 0,
  ukiyoe: 0,
  starry: 0,
  scream: 0,
  nosferatu: 0,
  scope: 0,
  pixel: 0,
  chat: 0,
  vapor: 0,
  shortvideo: 0,
  code: 0,
  outro: 0,
  bike: 0,
};

/**
 * Loudness each part is written to, alone, over its own bars (LUFS, EBU R128
 * integrated; tools/audio.mjs --section N --check measures it). Quiet pictures
 * get quiet music: the differences are meant.
 */
export const TARGET = {
  intro: -24,
  sahara: -19,
  egypt: -21,
  han: -19,
  tang: -20,
  song: -24,
  qingming: -18,
  maya: -20,
  mughal: -19,
  bada: -25,
  wayang: -19,
  ukiyoe: -20,
  starry: -18,
  scream: -18,
  nosferatu: -18,
  scope: -22,
  pixel: -20,
  chat: -21,
  vapor: -19,
  shortvideo: -16,
  code: -20,
  outro: -18,
};

/**
 * How high a part alone may peak (dBFS). The rule is -6; a part whose idiom is
 * a hard low hit is allowed more, because its peaks are short and the mix has room.
 */
export const PEAK = {
  shortvideo: -4,
  outro: -4.5, // twenty instruments at once: the loudest downbeats of the film
};
