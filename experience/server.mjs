// The web experience: four ways of building the Aristo M 64 (One Shot, Direktbau, Agentic Loop, Graph), documented results and
// a live build on request.   node experience/server.mjs   → http://localhost:4191
// Reads the live build (experience/state.json, demo-runs/<variant>-*/), the documented results (experience/results.json) and the
// workflow journals. It writes nothing but a start request into state.json.
import { createServer, get } from 'node:http';
import { readFileSync, existsSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, normalize, extname } from 'node:path';
import { execSync } from 'node:child_process';
import { readLines, workflowState, refactorRounds } from '../tools/journal.mjs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const HERE = join(ROOT, 'experience');
const PORT = Number(process.env.EXPERIENCE_PORT) || 4191;
const STATE = join(HERE, 'state.json');
const RESULTS = join(HERE, 'results.json');
// the waiting workshop session touches this file every few seconds (skill aristo-experience); only then can the page start builds
const LISTENING = join(HERE, '.listening');
const listening = () => { try { return Date.now() - statSync(LISTENING).mtimeMs < 15000; } catch { return false; } };
const VARIANTS = ['oneshot', 'direct', 'loop', 'graph'];

const readJson = (p) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; } };
const sh = (cmd, cwd) => { try { return execSync(cmd, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return ''; } };

// files the tutorial may show (read-only)
const SHOWABLE = [
  'briefing/BRIEFING.md', 'SPEC.md', 'EVAL.md', 'LOOP.md', 'spec/tokens.json', 'eval/features.json', 'eval/cases.mjs',
  'eval/e2e/look-geometry.spec.mjs', 'eval/e2e/look-pixels.spec.mjs', 'eval/eval.lock', 'eval/visual-rubric.md',
  '.claude/agents/loop-builder.md', '.claude/agents/loop-tester.md', '.claude/agents/loop-judge.md', '.claude/agents/loop-refactorer.md', '.claude/agents/loop-reviewer.md', '.claude/agents/loop-architect.md', '.claude/agents/loop-integrator.md', '.claude/workflows/agentic-loop-parallel.js', 'tools/lane.mjs',
  '.claude/workflows/agentic-loop.js', 'tools/refactor-policy.json', 'tools/code-metrics.mjs',
  'loop.config.json', 'kit/README.md', '.claude/skills/agentic-loop/SKILL.md',
  'briefing/ONESHOT-PROMPT.md', '.claude/workflows/one-pass.js', '.claude/workflows/assess.js',
];

const appUp = {};
function checkApp(port) {
  const a = (appUp[port] ||= { at: 0, up: false });
  if (Date.now() - a.at < 3000) return a.up;
  a.at = Date.now();
  const req = get({ host: '127.0.0.1', port, path: '/', timeout: 800 }, (r) => { a.up = r.statusCode === 200; r.resume(); });
  req.on('error', () => { a.up = false; });
  req.on('timeout', () => { req.destroy(); a.up = false; });
  return a.up;
}

function srcMtime(dir) {
  let m = 0;
  try { for (const f of readdirSync(join(dir, 'src'))) m = Math.max(m, statSync(join(dir, 'src', f)).mtimeMs); } catch { /* no src yet */ }
  return m;
}

// counters and tiles need a report over everything built so far; a builder's self-check of one feature
// ("only F15") or of the look overwrites eval/report.json, so keep the last complete one
const isFull = (r) => !!r && (r.scope === 'all' || /^up to /.test(r.scope || ''));
const lastFull = {};
function fullReport(dir) {
  const r = readJson(join(dir, 'eval/report.json'));
  if (isFull(r)) return (lastFull[dir] = r);
  if (lastFull[dir]) return lastFull[dir];
  const h = readLines(join(dir, 'eval/history.jsonl')).filter(isFull).pop();
  return h ? { scope: h.scope, timestamp: h.t, pass: h.pass, summary: { ids: h.ids, passed: h.passed, failed: h.failed, pending: h.pending, tests: h.tests, testsFailed: h.testsFailed }, features: {} } : r;
}

function state() {
  const st = readJson(STATE) || { phase: 'none' };
  const run = st.runDir && existsSync(st.runDir) ? st.runDir : null;
  // the live build's journals: everything since it started (one live build at a time)
  const since = st.startedAt || st.stage1StartedAt ? Date.parse(st.startedAt || st.stage1StartedAt) : Infinity;
  const until = Infinity;
  const wf = Number.isFinite(since) ? workflowState({ sinceMs: since, untilMs: until, root: run || ROOT }) : null;
  return {
    now: Date.now(),
    state: st,
    allFeatures: readJson(join(ROOT, 'eval/features.json')),
    runFeatures: run ? readJson(join(run, 'eval/features.json')) : null,
    report: run ? fullReport(run) : null,
    progress: run ? readLines(join(run, 'progress.jsonl'), 80) : [],
    refactors: run ? readLines(join(run, 'refactor-history.jsonl'), 40) : [],
    refactorSteps: Number.isFinite(since) ? refactorRounds({ sinceMs: since, untilMs: until, root: run || ROOT }) : [],
    plan: run ? readJson(join(run, 'loop.plan.json')) : null,
    refactorTargets: run ? (readJson(join(run, 'tools/refactor-policy.json')) || {}).targets || {} : {},
    commits: run ? sh('git log --format=%h%x09%s%x09%cI -n 30', run).trim().split('\n').filter(Boolean).map((l) => { const [h, s, t] = l.split('\t'); return { h, s, t }; }) : [],
    shots: run && existsSync(join(run, 'eval/artifacts')) ? readdirSync(join(run, 'eval/artifacts')).filter((f) => f.endsWith('.png')).map((f) => ({ f, m: statSync(join(run, 'eval/artifacts', f)).mtimeMs })) : [],
    workflow: wf,
    appUp: run ? checkApp(st.appPort) : false,
    results: readJson(RESULTS) || {},
    listening: listening(),
    srcMtime: run ? srcMtime(run) : 0,
    numbers: numbers(),
  };
}

// headline numbers of the finished project for the tutorial
let cachedNumbers = null;
function numbers() {
  if (cachedNumbers) return cachedNumbers;
  const features = readJson(join(ROOT, 'eval/features.json')) || {};
  const report = readJson(join(ROOT, 'eval/report.json'));
  const spec = existsSync(join(ROOT, 'SPEC.md')) ? readFileSync(join(ROOT, 'SPEC.md'), 'utf8') : '';
  cachedNumbers = {
    features: Object.keys(features).length,
    ids: Object.values(features).reduce((a, f) => a + f.ids.length, 0),
    tests: report ? report.summary.tests : null,
    specVersion: (spec.match(/Version ([\d.]+) ·/) || [])[1] || '?',
    references: readdirSync(join(ROOT, 'spec/reference')).length,
    commits: Number(sh('git rev-list --count HEAD', ROOT).trim()) || 0,
  };
  return cachedNumbers;
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const send = (res, code, type, body) => { res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' }); res.end(body); };

createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  try {
    if (p === '/api/state') return send(res, 200, 'application/json', JSON.stringify(state()));
    // a tab asks for a live build of its variant; the workshop session (skill aristo-experience) picks it up
    if (p === '/api/start' && req.method === 'POST') {
      const variant = url.searchParams.get('variant');
      const st = readJson(STATE) || {};
      const open = listening() && ['ready', 'done', 'failed'].includes(st.phase);
      if (open && VARIANTS.includes(variant)) writeFileSync(STATE, JSON.stringify({ ...st, phase: 'start-requested', requested: variant, updatedAt: new Date().toISOString() }, null, 2) + '\n');
      return send(res, 200, 'application/json', JSON.stringify({ ok: open, phase: (readJson(STATE) || {}).phase }));
    }
    // the frozen course of a documented build (experience/results/<variant>/run.json, written by snapshot.mjs)
    if (p === '/api/run') {
      const v = url.searchParams.get('variant');
      const f = join(HERE, 'results', VARIANTS.includes(v) ? v : '-', 'run.json');
      return existsSync(f) ? send(res, 200, 'application/json', readFileSync(f, 'utf8')) : send(res, 404, 'application/json', 'null');
    }
    if (p === '/api/file') {
      const f = url.searchParams.get('p');
      if (!SHOWABLE.includes(f)) return send(res, 403, 'text/plain', 'not showable');
      return send(res, 200, 'text/plain; charset=utf-8', readFileSync(join(ROOT, f), 'utf8'));
    }
    // images: the finished calculator, the reference photos, and the run's screenshots
    let m;
    if ((m = p.match(/^\/img\/(finished|reference|run)\/([\w.-]+\.(png|jpe?g))$/))) {
      const st = readJson(STATE) || {};
      const dir = { finished: join(ROOT, 'eval/artifacts'), reference: join(ROOT, 'spec/reference'), run: st.runDir ? join(st.runDir, 'eval/artifacts') : '' }[m[1]];
      const file = normalize(join(dir, m[2]));
      if (!dir || !file.startsWith(dir) || !existsSync(file)) return send(res, 404, 'text/plain', 'not found');
      return send(res, 200, TYPES[extname(file)] || 'application/octet-stream', readFileSync(file));
    }
    const file = normalize(join(HERE, p === '/' ? 'index.html' : p));
    if (!file.startsWith(HERE) || !existsSync(file) || file.endsWith('.json') || file.endsWith('.mjs')) return send(res, 404, 'text/plain', 'not found');
    return send(res, 200, TYPES[extname(file)] || 'application/octet-stream', readFileSync(file));
  } catch (e) {
    return send(res, 500, 'text/plain', String(e));
  }
}).listen(PORT, '127.0.0.1', () => console.log(`Aristo-Tutorial → http://localhost:${PORT}`));
