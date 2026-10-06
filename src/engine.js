// Calculator engine of the Aristo M 64. Pure logic, no DOM.
//
// Model of the original 8-digit machine:
//   * immediate execution, no operator precedence
//   * every result is rounded to what the 8-digit display can show, and the machine keeps
//     calculating with exactly that displayed value
//   * a running entry is kept as the typed text, so "0.50" stays "0.50" until it is used

export const DIGITS = 8;
const LIMIT = 1e8; // |result| ≥ 10^8 does not fit → E

const OPERATORS = new Set(['+', '-', '*', '/']);

/** number of digits left of the decimal point (at least 1, "0.xxx" uses the 0 cell) */
function intDigits(abs) {
  return abs < 1 ? 1 : String(Math.trunc(abs)).length;
}

/**
 * Round a number to what the 8-digit display shows. Rounding carries are re-evaluated
 * (9999999.96 → 10000000.0 → 10000000). Returns NaN when the value does not fit.
 */
function round8(x) {
  if (!Number.isFinite(x)) return NaN;
  // strip binary float noise first (0.1 + 0.2 = 0.30000000000000004)
  const r = roundMagnitude(Math.abs(Number(x.toPrecision(12))));
  return x < 0 && r !== 0 ? -r : r; // never -0
}

/** round a non-negative number to the display's digits; NaN when it does not fit */
function roundMagnitude(abs) {
  if (abs >= LIMIT) return NaN;
  const r = Number(abs.toFixed(DIGITS - intDigits(abs)));
  // a carry into a new integer digit leaves one decimal place less: round again
  return intDigits(r) === intDigits(abs) ? r : roundMagnitude(r);
}

/** display text of an already rounded number */
function formatNumber(n) {
  if (n === 0 || Object.is(n, -0)) return '0.';
  const abs = Math.abs(n);
  let s = abs.toFixed(Math.max(0, DIGITS - intDigits(abs)));
  if (s.includes('.')) s = s.replace(/0+$/, '');
  if (!s.includes('.')) s += '.';
  return (n < 0 ? '-' : '') + s;
}

/** display text of a running entry: shown exactly as typed, integers end with "." */
function formatEntry(entry) {
  return entry.includes('.') ? entry : `${entry}.`;
}

const countDigits = (s) => s.replace(/[^0-9]/g, '').length;

/** a op b; division by zero is NaN (→ E) */
function applyOperator(a, operator, b) {
  switch (operator) {
    case '+': return a + b;
    case '-': return a - b;
    case '*': return a * b;
    case '/': return b === 0 ? NaN : a / b;
    default: return b;
  }
}

/** % after a pending operation: a × b %, a ± b % of a, a as a percentage of b */
function applyPercent(acc, operator, b) {
  switch (operator) {
    case '*': return (acc * b) / 100;
    case '+': return acc + (acc * b) / 100;
    case '-': return acc - (acc * b) / 100;
    case '/': return b === 0 ? NaN : (acc / b) * 100;
    default: return b / 100;
  }
}

function initialState() {
  return {
    error: false,
    current: 0,   // value on the display when no entry is being typed (always rounded)
    entry: null,  // typed text while an entry is running, else null
    fresh: false, // a new operand exists since the last operator (typed or √)
    acc: 0,       // left operand of the pending operation
    op: null,     // pending operator
  };
}

/** the value the display stands for right now */
const shownValue = (s) => (s.entry !== null ? Number(s.entry) || 0 : s.current);

/** close a running entry: its value becomes the displayed value */
function commitEntry(s) {
  if (s.entry === null) return;
  s.current = round8(Number(s.entry) || 0);
  s.entry = null;
}

/** put a computed result on the display, or go into the error state */
function showResult(s, x) {
  const r = round8(x);
  s.entry = null;
  if (Number.isNaN(r)) {
    s.error = true;
    s.current = 0;
    s.op = null;
    return false;
  }
  s.current = r;
  return true;
}

function enterDigit(s, d) {
  if (s.entry === null) {
    s.entry = '';
    s.fresh = true;
  }
  if (countDigits(s.entry) >= DIGITS) return; // more than 8 digits are ignored
  s.entry = s.entry === '0' ? d : s.entry + d; // no leading zeros except "0."
}

function enterPoint(s) {
  if (s.entry === null) {
    s.entry = '0.';
    s.fresh = true;
    return;
  }
  if (s.entry.includes('.')) return; // a second point is ignored
  s.entry = (s.entry === '' ? '0' : s.entry) + '.';
}

function chooseOperator(s, next) {
  if (s.op !== null && s.fresh) {
    const b = shownValue(s);
    commitEntry(s);
    if (!showResult(s, applyOperator(s.acc, s.op, b))) return;
  } else {
    commitEntry(s);
  }
  s.acc = s.current;
  s.op = next;
  s.fresh = false;
}

function equals(s) {
  if (s.op === null) {
    commitEntry(s);
    s.fresh = false;
    return;
  }
  // without a new entry the display is the second operand (5 × = → 25)
  const b = shownValue(s);
  commitEntry(s);
  const pending = s.op;
  s.op = null;
  s.fresh = false;
  showResult(s, applyOperator(s.acc, pending, b));
}

function squareRoot(s) {
  const x = shownValue(s);
  commitEntry(s);
  if (x < 0) {
    showResult(s, NaN);
    return;
  }
  if (showResult(s, Math.sqrt(x))) s.fresh = true; // the root counts as an entry
}

function percent(s) {
  const b = shownValue(s);
  commitEntry(s);
  const r = applyPercent(s.acc, s.op, b);
  s.op = null;
  s.fresh = false;
  showResult(s, r);
}

function clearEntry(s) {
  s.entry = '0';
  s.fresh = true;
}

const ACTIONS = new Map([
  ['.', enterPoint],
  ['=', equals],
  ['sqrt', squareRoot],
  ['%', percent],
  ['CE', clearEntry],
]);

/** one key of the calculator vocabulary on a running, error-free machine */
function handleKey(s, k) {
  if (/^[0-9]$/.test(k)) enterDigit(s, k);
  else if (OPERATORS.has(k)) chooseOperator(s, k);
  else ACTIONS.get(k)?.(s);
}

function displayText(s) {
  if (s.error) return 'E';
  return s.entry !== null ? formatEntry(s.entry === '' ? '0' : s.entry) : formatNumber(s.current);
}

export function createEngine() {
  let on = true;
  const state = initialState();
  const reset = () => Object.assign(state, initialState());

  return {
    press(key) {
      if (!on) return;
      const k = String(key);
      if (k === 'C') {
        reset();
        return;
      }
      if (state.error) return; // only C (or power off/on) leaves the error state
      handleKey(state, k);
    },
    display: () => (on ? displayText(state) : ''),
    isError: () => on && state.error,
    setPower(powerOn) {
      on = Boolean(powerOn);
      reset();
    },
  };
}
