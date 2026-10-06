// Graph workshop – the mechanics in one deterministic tool, so no agent has to improvise git, files or data.
// Every command works on a project folder (--root, default: this repository), prints exactly ONE JSON line on stdout
// and exits 0 when it did what it was asked, 1 when it could not (the JSON says why). Workflows let a helper agent run
// one command and read that line; they never trust the helper's own summary.
//
// --root is required. Used only by the graph workflows (graph.js, graph-lane.js); the loop has its own way of working.
//
//   commit  --root R            commit everything; message from stdin (subject first line), adds Co-Authored-By
//   restore --root R --paths a,b [--clean src]   throw away uncommitted changes in these paths
//   golden  --root R --cmd "<freeze cmd>" --eval "<eval cmd>" [--report eval/report.json]
//                               freeze the reference, then run the eval and report its summary (from the report file)
//   eval    --root R --cmd "<eval cmd>" [--lock "<seal check>"] [--integrity "<cmd>"] [--report eval/report.json] [--progress "F3 2"]
//                               seal check, the eval exactly as given, the report it wrote (must be fresh) – the verdict
//   report  --root R --cmd "<report cmd>"        write a report document, then commit it
//   plan    --root R --sum <checksum>            write loop.plan.json from stdin, verified against the checksum
//   plan-part --root R --index i --sum <checksum>   store one piece of a long plan (stdin), verified on its own
//   plan    --root R --parts n --sum <checksum>  put the pieces together, verify the whole, write loop.plan.json
//           (long texts are relayed in short pieces: a helper copies 1 KB reliably, 13 KB not)
//   status  --root R            what is built (feat/merge commits), lanes, uncommitted files, plan validity
//
// The checksum is djb2 over the trimmed text, the same function the workflow computes.
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, appendFileSync, readdirSync, statSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const checksum = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) >>> 0; return h.toString(16); };
const argv = process.argv.slice(2);
const cmd = argv[0];
const arg = (k) => { const i = argv.indexOf(k); return i > -1 ? argv[i + 1] : null; };
const ROOT = arg('--root') ? resolve(arg('--root')) : null; // required: the project to work on
const CO = 'Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>';

// every answer carries a checksum over its content (_sum): the workflow recomputes it and so notices a helper that mistyped the line
const out = (o, code = 0) => { console.log(JSON.stringify({ ...o, _sum: checksum(JSON.stringify(o)) })); process.exit(code); };
const sh = (c, opts = {}) => execSync(c, { cwd: ROOT, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024, ...opts }).trim();
const tryRun = (c, opts) => { try { return { ok: true, out: sh(c, opts) }; } catch (e) { return { ok: false, out: `${e.stdout || ''}${e.stderr || ''}`.trim() }; } };
const stdin = () => { try { return readFileSync(0, 'utf8'); } catch { return ''; } };

function commit() {
  const message = stdin().trim();
  if (!message) out({ committed: false, error: 'keine Commit-Nachricht auf stdin' }, 1);
  // never commit a half-resolved merge: unmerged paths or conflict markers in what would be committed
  if (tryRun('git ls-files -u').out) out({ committed: false, error: 'ungelöste Konflikte (git ls-files -u)' }, 1);
  sh('git add -A');
  const markers = tryRun('git diff --cached -U0').out.split('\n').filter((l) => /^\+(<{7}|>{7}) /.test(l));
  if (markers.length) { tryRun('git reset -q'); out({ committed: false, error: `Konfliktmarker im Stand: ${markers.slice(0, 3).join(' | ')}` }, 1); }
  const merging = existsSync(join(ROOT, '.git/MERGE_HEAD'));
  if (!merging && !sh('git status --porcelain')) out({ committed: false, hash: sh('git rev-parse --short HEAD'), shortstat: '', note: 'nichts zu committen' });
  const msg = message.includes('Co-Authored-By:') ? message : `${message}\n\n${CO}`;
  const r = tryRun('git commit -q -F -', { input: msg });
  if (!r.ok) out({ committed: false, error: r.out.slice(0, 400) }, 1);
  const src = arg('--src') || 'src';
  out({ committed: true, hash: sh('git rev-parse --short HEAD'), shortstat: tryRun(`git show --shortstat --format= HEAD -- ${src}`).out });
}

function restore() {
  const paths = (arg('--paths') || '').split(',').filter(Boolean);
  if (!paths.length) out({ clean: false, error: '--paths fehlt' }, 1);
  const existing = paths.filter((p) => existsSync(join(ROOT, p)) || tryRun(`git ls-files --error-unmatch -- ${p}`).ok);
  if (existing.length) tryRun(`git checkout -- ${existing.join(' ')}`);
  if (arg('--clean')) tryRun(`git clean -fdq -- ${arg('--clean')}`);
  const left = tryRun(`git status --porcelain -- ${paths.join(' ')}`).out;
  out({ clean: !left, left: left ? left.split('\n') : [] }, left ? 1 : 0);
}

/** the eval's summary, read from the report file, not from anyone's recollection */
function readReport(file) {
  const p = join(ROOT, file);
  if (!existsSync(p)) return null;
  try {
    const r = JSON.parse(readFileSync(p, 'utf8'));
    // report contract: features.<F>.ids.<ID> = 'passed' | 'failed' | 'pending', failures[{id, …}]
    const fromIds = Object.values(r.features || {}).flatMap((f) => Object.entries(f.ids || {}).filter(([, v]) => v === 'failed').map(([id]) => id));
    const failedIds = [...new Set([...fromIds, ...(r.failures || []).map((x) => x.id).filter(Boolean)])];
    // short enough for a helper to pass on: the full details stay in the report files
    const failures = (r.failures || []).slice(0, 8).map((x) => ({ id: x.id, error: String(x.error || '').replace(/\s+/g, ' ').slice(0, 160) }));
    return { pass: !!r.pass, scope: r.scope, summary: r.summary, failedIds, failures };
  } catch { return null; }
}

function evaluate() {
  const evalCmd = arg('--cmd'), report = arg('--report') || 'eval/report.json';
  if (!evalCmd) out({ pass: false, error: '--cmd fehlt' }, 1);
  const lockOk = arg('--lock') ? tryRun(arg('--lock')).ok : true;
  let integrityIssues = [];
  if (arg('--integrity')) { const i = tryRun(arg('--integrity')); if (!i.ok) integrityIssues = i.out.split('\n').filter(Boolean).slice(-10); }
  const p = join(ROOT, report);
  const before = existsSync(p) ? statSync(p).mtimeMs : 0;
  tryRun(evalCmd); // red is a result, not an error: the report says what failed
  const fresh = existsSync(p) && statSync(p).mtimeMs > before;
  const r = fresh ? readReport(report) : null;
  if (!r) out({ pass: false, lockOk, error: fresh ? `Bericht ${report} unlesbar` : `kein frischer Bericht ${report} – die Prüfung lief nicht` }, 1);
  const pass = r.pass && lockOk && !integrityIssues.length;
  // the build's logbook for humans and the page: one line per check (--progress "<feature> <iteration>")
  if (arg('--progress')) {
    const [feature, iteration] = arg('--progress').split(' ');
    appendFileSync(join(ROOT, 'progress.jsonl'), JSON.stringify({ t: new Date().toISOString(), feature, iteration: Number(iteration) || iteration, pass, passedIds: r.summary && r.summary.passed, totalIds: r.summary && r.summary.ids, failedIds: r.failedIds }) + '\n');
  }
  out({ pass, lockOk, scope: r.scope, summary: r.summary, failedIds: r.failedIds, failures: r.failures, integrityIssues }, pass ? 0 : 1);
}

function golden() {
  const freeze = arg('--cmd'), evalCmd = arg('--eval'), report = arg('--report') || 'eval/report.json';
  if (!freeze || !evalCmd) out({ pass: false, error: '--cmd und --eval nötig' }, 1);
  const f = tryRun(freeze);
  if (!f.ok) out({ pass: false, frozen: false, error: f.out.slice(-400) }, 1);
  tryRun(evalCmd); // red is a result, not an error: the report says what failed
  const r = readReport(report);
  if (!r) out({ pass: false, frozen: true, error: `kein lesbarer Bericht ${report}` }, 1);
  out({ pass: r.pass, frozen: true, scope: r.scope, summary: r.summary, failedIds: r.failedIds }, r.pass ? 0 : 1);
}

function report() {
  const c = arg('--cmd');
  if (!c) out({ committed: false, error: '--cmd fehlt' }, 1);
  const r = tryRun(c);
  if (!r.ok) out({ committed: false, error: r.out.slice(-400) }, 1);
  sh('git add -A');
  if (!sh('git status --porcelain')) out({ committed: false, note: 'Bericht unverändert' });
  sh('git commit -q -F -', { input: `docs: Aufräum-Bericht\n\n${CO}` });
  out({ committed: true, hash: sh('git rev-parse --short HEAD') });
}

const PARTS_DIR = () => join(ROOT, '.plan-parts');
function planPart() {
  const i = Number(arg('--index')), want = arg('--sum');
  // the here-doc adds exactly one newline at the end; the piece itself may begin or end with any character
  const text = stdin().replace(/\n$/, '');
  const got = checksum(text);
  if (!Number.isInteger(i) || i < 0 || got !== want) out({ ok: false, index: i, sum: got, want, hint: 'Stück weicht ab – nicht gespeichert' }, 1);
  mkdirSync(PARTS_DIR(), { recursive: true });
  writeFileSync(join(PARTS_DIR(), String(i)), text);
  out({ ok: true, index: i, bytes: text.length });
}

function plan() {
  const want = arg('--sum');
  if (arg('--parts')) {
    const n = Number(arg('--parts'));
    const missing = [...Array(n).keys()].filter((i) => !existsSync(join(PARTS_DIR(), String(i))));
    if (missing.length) out({ ok: false, missing, hint: 'Stücke fehlen' }, 1);
    const text = [...Array(n).keys()].map((i) => readFileSync(join(PARTS_DIR(), String(i)), 'utf8')).join('');
    let valid = true;
    try { JSON.parse(text); } catch { valid = false; }
    const got = checksum(text);
    if (!valid || got !== want) out({ ok: false, valid, sum: got, want, hint: 'Zusammengesetzt weicht vom Plan ab – nicht geschrieben' }, 1);
    writeFileSync(join(ROOT, 'loop.plan.json'), text + '\n');
    rmSync(PARTS_DIR(), { recursive: true, force: true });
    out({ ok: true, sum: got, bytes: text.length, parts: n });
  }
  const text = stdin().trim();
  let valid = true;
  try { JSON.parse(text); } catch { valid = false; }
  const got = checksum(text);
  if (!valid || (want && got !== want)) out({ ok: false, valid, sum: got, want, hint: 'Text weicht vom Plan ab – nicht geschrieben' }, 1);
  writeFileSync(join(ROOT, 'loop.plan.json'), text + '\n');
  out({ ok: true, sum: got, bytes: text.length });
}

function status() {
  const log = tryRun('git log --format=%s').out.split('\n');
  const built = [...new Set(log.map((s) => (s.match(/^(?:feat|merge)\((F\d+)\)/) || [])[1]).filter(Boolean))];
  const wip = [...new Set(log.map((s) => (s.match(/^wip\((F\d+)\)/) || [])[1]).filter(Boolean))];
  const lanesDir = join(ROOT, '.lanes');
  const lanes = existsSync(lanesDir) ? readdirSync(lanesDir) : [];
  const dirty = tryRun('git status --porcelain').out.split('\n').filter(Boolean);
  let planValid = null;
  if (existsSync(join(ROOT, 'loop.plan.json'))) { try { JSON.parse(readFileSync(join(ROOT, 'loop.plan.json'), 'utf8')); planValid = true; } catch { planValid = false; } }
  out({ root: ROOT, head: tryRun('git rev-parse --short HEAD').out, built, wip, lanes, dirty, planValid });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (!ROOT) out({ error: '--root fehlt (Projektordner)' }, 2);
  if (!existsSync(join(ROOT, '.git'))) out({ error: `kein Git-Repository: ${ROOT}` }, 1);
  const commands = { commit, restore, eval: evaluate, golden, report, plan, 'plan-part': planPart, status };
  if (!commands[cmd]) out({ error: `unbekannter Befehl ${cmd}; erlaubt: ${Object.keys(commands).join(', ')}` }, 2);
  commands[cmd]();
}
