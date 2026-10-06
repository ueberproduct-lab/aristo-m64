// Key click: a short, full-bodied, soft "klack", synthesized with the Web Audio API.
// No audio files, no requests. playKeyClick() schedules one stroke into any BaseAudioContext
// (live AudioContext or OfflineAudioContext), so the eval can render and measure it.
//
// Layers, like a real key of the time heard from a short distance:
//   1. body   – a short sine "thump" around 190 Hz, pitch falling (the key bottoming out)
//   2. tock   – the mid "tock" of the plastic key cap and case, 1.4–1.6 kHz
//   3. edge   – a faint upper partial just above 2 kHz that gives the stroke its definition
// Pitch per key row: `pitch` scales every frequency of the stroke; the rows span 3 semitones.
// The layers are placed so the balance holds over that whole range: the tock stays below 2 kHz
// and the edge stays between 2 and 3 kHz even at +3 semitones, so the share above 2 kHz (the
// edge) is the same for every row and nothing ever reaches 3 kHz.
// No noise burst, no partial above ~3 kHz, and no spike in the envelope: every layer swells in
// along a smooth S-curve (a few milliseconds, like a felt-damped plastic key) and then fades out
// exponentially right from its rounded top — there is no sharp tip that drops away. The body
// leads, the brighter layers follow a fraction of a millisecond behind, so the onset is round.
// The level set here is the final one; the app adds no gain stage behind it. It is quiet on
// purpose: full-bodied but not loud at a medium system volume.
// Every stroke varies slightly (pitch, levels, timing), so fast typing never sounds like a machine gun.
// Target values: tokens.json → sound.

const jitter = (amount) => 1 + (Math.random() * 2 - 1) * amount;

const OUT = 0.14;      // master level of one stroke
const ATTACK = 0.004;  // soft swell to the top (s)
const END = 0.14;      // everything has died away by then (s)

// [frequency Hz, level, decay time constant s, pitch drop factor over 40 ms, attack factor]
const LAYERS = [
  [190, 0.44, 0.0075, 0.8, 1],      // body
  [1380, 0.24, 0.008, 0.98, 1.12],  // tock, lower mode of the cap
  [1580, 0.37, 0.0092, 0.97, 1.1],  // tock
  [2300, 0.19, 0.0066, 1, 1.15],    // edge
];

// smooth swell 0 → 1 (sin²): starts and arrives without a corner
const SWELL = (() => {
  const n = 64;
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) c[i] = Math.sin(((i / (n - 1)) * Math.PI) / 2) ** 2;
  return c;
})();

/** soft envelope on a gain node: S-shaped swell, then an exponential fade from the top */
function envelope(gain, t, peak, attack, tau) {
  const g = gain.gain;
  g.setValueCurveAtTime(SWELL.map((v) => v * peak), t, attack);
  // a hair after the swell ends, so no browser sees two overlapping automation events
  g.setTargetAtTime(0, t + attack + 0.00005, tau);
}

/**
 * Schedule one key click.
 * @param {BaseAudioContext} ctx
 * @param {number} [when] start time in ctx seconds (default: now)
 * @param {{ pitch?: number }} [opts] pitch: frequency factor for the whole stroke (default 1)
 */
export function playKeyClick(ctx, when, { pitch = 1 } = {}) {
  const t = Math.max(when ?? ctx.currentTime, ctx.currentTime);
  const out = ctx.createGain();
  out.gain.value = OUT * jitter(0.04);
  out.connect(ctx.destination);
  const attack = ATTACK * jitter(0.04);
  const nodes = [];

  for (const [f, level, tau, drop, slower] of LAYERS) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    const f0 = f * pitch * jitter(0.015);
    osc.frequency.setValueAtTime(f0, t);
    if (drop !== 1) osc.frequency.exponentialRampToValueAtTime(f0 * drop, t + 0.04);
    const g = ctx.createGain();
    envelope(g, t, level * jitter(0.025), attack * slower, tau * jitter(0.03));
    osc.connect(g).connect(out);
    nodes.push(osc);
  }

  for (const n of nodes) {
    n.start(t);
    n.stop(t + END);
  }
  // free the graph once the stroke is over (live contexts)
  nodes[0].onended = () => {
    try { out.disconnect(); } catch { /* already gone */ }
  };
}
