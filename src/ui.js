// Wiring between DOM, display and engine.
import { buildDisplay } from './display.js';
import { createEngine } from './engine.js';
import { playKeyClick } from './sound.js';

const $ = (sel, root = document) => root.querySelector(sel);

const display = buildDisplay($('[data-part="display"]'));

// Test hook from the DOM contract: render any display text directly and set data-value.
const m64 = (window.m64 = window.m64 || {});
m64.render = (text) => display.render(text);

// calculator state lives in the engine; the display only mirrors engine.display()
const engine = createEngine();
const refresh = () => display.render(engine.display());

/** feed one key of the calculator vocabulary into the engine and update the display */
function press(key) {
  engine.press(key);
  refresh();
}

/** the engine shows "" only while switched off */
const isOn = () => engine.display() !== '';

// start-up state: device is on and shows "0."
refresh();

// ---- key sound ------------------------------------------------------------------
// Every key press on the switched-on device plays a short synthesized "klack" (src/sound.js).
// The AudioContext is created on the first key press only (autoplay policy) and reused after.
// Silent on load, while switched off, for the easter eggs, the switches and m64.render().
let audio = null;
let unlocked = false; // resumed once inside a gesture that every browser accepts

// Wake the context whenever it is not running: 'suspended' (autoplay, background tab) and
// Safari's 'interrupted' (other audio, device change, sleep). A stroke scheduled meanwhile
// plays as soon as the context runs again.
function wakeAudio() {
  if (audio && audio.state !== 'running' && audio.state !== 'closed') {
    audio.resume().catch(() => { /* not allowed yet */ });
  }
}

// Safari only lets a context start inside click, pointerup/mouseup, touchend or key events —
// not inside pointerdown, where the first "klack" is scheduled. So every such gesture handler
// calls this directly: the first time it always resumes,
// which unlocks Safari's context; afterwards only when the context is not running.
function unlockAudio() {
  if (!audio || audio.state === 'closed') return;
  if (unlocked && audio.state === 'running') return;
  unlocked = true;
  audio.resume().catch(() => { /* not allowed yet */ });
}

/** create the context on first use (autoplay policy), reuse it afterwards */
function ensureAudio() {
  if (audio && audio.state !== 'closed') return audio;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null; // no Web Audio: the calculator works silently
  audio = new AC({ latencyHint: 'interactive' });
  unlocked = false;
  return audio;
}

/** one stroke; pitch 1 is the bottom key row */
function playClick(pitch = 1) {
  try {
    if (!ensureAudio()) return;
    wakeAudio();
    playKeyClick(audio, audio.currentTime, { pitch });
  } catch { /* audio unavailable: never break a key press over the sound */ }
}

/** the "klack" of one calculator key, pitched by its key row */
function keyClick(key) {
  if (!soundOn()) return; // muted via the logo easter egg: keys stay silent, the calculator works
  playClick(keyPitch(key));
}

// ---- display flicker --------------------------------------------------------------
// Every key press that reaches the switched-on engine lets the LED display flicker very
// lightly and very briefly, like a multiplexed LED of the time. The look lives in CSS
// (animation `m64-flicker` on the lit segments while `.flicker` is on the display); here we
// only set the class for the animation's duration (--flicker-ms). render(), power, the easter
// eggs and reduced motion never call this. data-value is set by the render before and is
// never touched here.
const displayEl = display.root;
const FLICKER_MS = parseFloat(getComputedStyle(displayEl).getPropertyValue('--flicker-ms'));
const reducedMotion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
let flickerTimer = 0;

function flicker() {
  if (reducedMotion && reducedMotion.matches) return;
  if (flickerTimer) {
    // a press during a running flicker: restart it (newly lit segments start their own animation)
    clearTimeout(flickerTimer);
    for (const a of displayEl.getAnimations({ subtree: true })) {
      if (a.animationName === 'm64-flicker') a.currentTime = 0;
    }
  } else {
    displayEl.classList.add('flicker');
  }
  flickerTimer = setTimeout(() => {
    displayEl.classList.remove('flicker');
    flickerTimer = 0;
  }, FLICKER_MS);
}

// ---- keypad -----------------------------------------------------------------------
// `.pressed` is set while a mouse button, finger or physical key holds a key.
// Each source registers its own hold, so pointer and keyboard can overlap cleanly.
const keypad = $('[data-part="keypad"]');
const keyButton = (key) => keypad.querySelector(`button[data-key="${CSS.escape(key)}"]`);

// Pitch per key row: the bottom row (0 · = +) sounds lowest, every row above
// three quarters of a semitone higher, so the top row (C % √ CE) is 3 semitones up.
// The row comes from the key's place in the keypad (4 columns, like the grid in style.css);
// physical keys map to the same calculator key and therefore sound like their on-screen key.
const KEYPAD_COLUMNS = 4;
const SEMITONES_PER_ROW = 0.75;
const ROW_PITCH = (() => {
  const buttons = [...keypad.querySelectorAll('button[data-key]')];
  const rows = Math.ceil(buttons.length / KEYPAD_COLUMNS);
  const pitch = new Map();
  buttons.forEach((btn, i) => {
    const rowsAboveBottom = rows - 1 - Math.floor(i / KEYPAD_COLUMNS);
    pitch.set(btn.dataset.key, 2 ** ((rowsAboveBottom * SEMITONES_PER_ROW) / 12));
  });
  return pitch;
})();
const keyPitch = (key) => ROW_PITCH.get(key) ?? 1;

const holds = new Map(); // button -> Set of hold sources
const sounded = new WeakSet(); // buttons that already clicked on pointerdown for the current press

function hold(btn, source, on) {
  if (!btn) return;
  let set = holds.get(btn);
  if (!set) holds.set(btn, (set = new Set()));
  if (on) set.add(source);
  else set.delete(source);
  btn.classList.toggle('pressed', set.size > 0);
}

/** press / release the on-screen key for `key` from a given source (e.g. 'kbd:Enter') */
const holdKey = (key, source, on) => hold(keyButton(key), source, on);

keypad.addEventListener('pointerdown', (ev) => {
  const btn = ev.target.closest('button[data-key]');
  if (!btn || (ev.pointerType === 'mouse' && ev.button !== 0)) return;
  const source = `pointer:${ev.pointerId}`;
  hold(btn, source, true);
  // the "klack" belongs to the key going down, not to the release
  if (isOn()) {
    keyClick(btn.dataset.key);
    sounded.add(btn);
  }
  try { btn.setPointerCapture(ev.pointerId); } catch { /* pointer already gone */ }
  const release = (e) => {
    hold(btn, source, false);
    if (e && e.type === 'pointerup') unlockAudio(); // Safari: pointerdown is no audio gesture
    setTimeout(() => sounded.delete(btn), 0); // the click (if any) follows within the same input task
    btn.removeEventListener('pointerup', release);
    btn.removeEventListener('pointercancel', release);
    btn.removeEventListener('lostpointercapture', release);
  };
  btn.addEventListener('pointerup', release);
  btn.addEventListener('pointercancel', release);
  btn.addEventListener('lostpointercapture', release);
});

/**
 * One key press, from a click/tap, the keyboard activation of a focused button or a physical
 * key. Pointer presses already clicked on pointerdown (pointerSounded); all others click here.
 */
function keyPressed(key, pointerSounded = false) {
  const on = isOn();
  press(key);
  if (!on) return;
  flicker();
  if (!pointerSounded) keyClick(key);
}

keypad.addEventListener('click', (ev) => {
  const btn = ev.target.closest('button[data-key]');
  if (!btn) return;
  unlockAudio(); // a click is an audio gesture in every browser (Safari included)
  keyPressed(btn.dataset.key, sounded.delete(btn));
});

// ---- switches ---------------------------------------------------------------------
// K and F/2 are decorative (a non-goal of the spec) and carry aria-disabled="true".
// The power switch toggles the engine's power (off: blank display, keys ignored; on: reset).
for (const sw of document.querySelectorAll('[data-part="switches"] [data-switch]')) {
  sw.addEventListener('click', (ev) => {
    if (sw.getAttribute('aria-disabled') === 'true') {
      ev.preventDefault();
      return;
    }
    const on = sw.getAttribute('aria-checked') !== 'true';
    sw.setAttribute('aria-checked', String(on));
    if (sw.dataset.switch === 'power') {
      engine.setPower(on);
      refresh();
    }
  });
}

// ---- easter eggs: case and mute ---------------------------------------------------
// Two hidden toggles for fans; nothing on the page hints at them (no pointer, no hover change).
// Each choice lives in a data attribute on the shell and is kept in localStorage; without
// storage (private mode, blocked) the page still works, default "on".
const shell = $('[data-part="shell"]');

/** an on/off choice in shell.dataset[attr], persisted under storageKey */
function persistedToggle(attr, storageKey) {
  let initial = 'on';
  try {
    if (localStorage.getItem(storageKey) === 'off') initial = 'off';
  } catch { /* storage unavailable: default */ }
  shell.dataset[attr] = initial;
  return {
    isOn: () => shell.dataset[attr] !== 'off',
    toggle() {
      const next = shell.dataset[attr] === 'off' ? 'on' : 'off';
      shell.dataset[attr] = next;
      try {
        localStorage.setItem(storageKey, next);
      } catch { /* storage unavailable: the choice holds for this visit only */ }
      return next;
    },
  };
}

// "MADE IN GERMANY" takes the cream case off or puts it back. The shell box keeps its size,
// so nothing on the device moves.
const caseToggle = persistedToggle('case', 'm64-case');
$('[data-part="foot"] [data-config="case"]').addEventListener('click', () => caseToggle.toggle());

// The "ARISTO M 64" logo mutes the key sound or switches it back on. Muting is silent;
// switching the sound back on plays one click as confirmation.
const soundToggle = persistedToggle('sound', 'm64-sound');
const soundOn = () => soundToggle.isOn();
$('[data-part="head"] [data-config="sound"]').addEventListener('click', () => {
  if (soundToggle.toggle() === 'on') {
    playClick();
    unlockAudio();
  }
});

// ---- physical keyboard ------------------------------------------------------------
// Maps KeyboardEvent.key to the calculator vocabulary.
const KEYMAP = {
  Enter: '=', '=': '=',
  ',': '.', '.': '.', Decimal: '.',
  '+': '+', '-': '-', '*': '*', x: '*', X: '*', '/': '/', ':': '/', '÷': '/', '×': '*',
  '%': '%', r: 'sqrt', R: 'sqrt', '√': 'sqrt',
  Escape: 'C', Clear: 'C', c: 'C', C: 'C',
  Backspace: 'CE', Delete: 'CE',
};
for (let d = 0; d <= 9; d++) KEYMAP[String(d)] = String(d);

// key held per physical key code, so the release still finds the right on-screen key
// even if the produced character changes in between (e.g. Shift released first).
const heldByCode = new Map(); // code -> calculator key

const releaseAllKeyboardHolds = () => {
  for (const [code, key] of heldByCode) holdKey(key, `kbd:${code}`, false);
  heldByCode.clear();
};

// keydown is an audio gesture: the context must be created / unlocked inside its handler
function unlockAudioOnKeydown() {
  if (!isOn() || !soundOn()) return;
  try {
    if (ensureAudio()) unlockAudio();
  } catch { /* audio unavailable */ }
}

document.addEventListener('keydown', (ev) => {
  if (ev.ctrlKey || ev.metaKey || ev.altKey) return; // leave browser shortcuts alone
  const key = KEYMAP[ev.key];
  if (!key) return;
  // Enter/Space on a focused switch keeps its native activation (accessibility).
  const t = ev.target;
  if (ev.key === 'Enter' && t instanceof Element && t.closest('[data-switch], [data-config]')) return;
  // prevent native button activation (would double-count) and browser actions (Backspace, /)
  ev.preventDefault();
  const code = ev.code || ev.key;
  if (ev.repeat || heldByCode.has(code)) return; // a held key enters once, like the original
  heldByCode.set(code, key);
  holdKey(key, `kbd:${code}`, true);
  unlockAudioOnKeydown();
  keyPressed(key);
});

document.addEventListener('keyup', (ev) => {
  const code = ev.code || ev.key;
  const key = heldByCode.get(code);
  if (key === undefined) return;
  heldByCode.delete(code);
  holdKey(key, `kbd:${code}`, false);
});

window.addEventListener('blur', releaseAllKeyboardHolds);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) releaseAllKeyboardHolds();
});
