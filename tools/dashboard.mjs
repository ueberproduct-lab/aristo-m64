// Live dashboard for the build→test loop: app (iframe) + eval status + workflow activity + screenshots.
//   node tools/dashboard.mjs   → http://localhost:4180   (app itself must run on :4173, `npm start`)
import { createServer } from 'node:http';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { readLines as readLinesAbs, workflowState as sharedWorkflowState } from './journal.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const PORT = Number(process.env.DASH_PORT) || 4180;

const readJson = (p) => { try { return JSON.parse(readFileSync(join(ROOT, p), 'utf8')); } catch { return null; } };
const readLines = (p, n) => readLinesAbs(p.startsWith('/') ? p : join(ROOT, p), n);
const workflowState = () => sharedWorkflowState({ root: ROOT });

function state() {
  let srcMtime = 0;
  try { for (const f of readdirSync(join(ROOT, 'src'))) srcMtime = Math.max(srcMtime, statSync(join(ROOT, 'src', f)).mtimeMs); } catch {}
  let shots = [];
  try {
    shots = readdirSync(join(ROOT, 'eval/artifacts')).filter((f) => f.endsWith('.png')).map((f) => ({ f, m: statSync(join(ROOT, 'eval/artifacts', f)).mtimeMs }));
  } catch {}
  return {
    now: Date.now(),
    features: readJson('eval/features.json'),
    report: readJson('eval/report.json'),
    judge: readJson('eval/judge.json'),
    history: readLines('eval/history.jsonl', 60),
    progress: readLines('progress.jsonl', 60),
    refactors: readLines('refactor-history.jsonl', 30),
    workflow: workflowState(),
    srcMtime,
    shots,
    golden: existsSync(join(ROOT, 'eval/golden/m64-initial.png')),
  };
}

createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/state') {
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    return res.end(JSON.stringify(state()));
  }
  const m = url.pathname.match(/^\/(artifacts|golden|reference)\/([\w.-]+\.(png|jpe?g))$/);
  if (m) {
    const dir = { artifacts: 'eval/artifacts', golden: 'eval/golden', reference: 'spec/reference' }[m[1]];
    try {
      res.writeHead(200, { 'content-type': m[3] === 'png' ? 'image/png' : 'image/jpeg', 'cache-control': 'no-store' });
      return res.end(readFileSync(join(ROOT, dir, m[2])));
    } catch { res.writeHead(404); return res.end(); }
  }
  if (url.pathname === '/sound-check') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    return res.end(readFileSync(join(ROOT, 'tools/sound-check.html')));
  }
  if (url.pathname === '/src/sound.js') {
    res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' });
    return res.end(readFileSync(join(ROOT, 'src/sound.js')));
  }
  if (url.pathname === '/') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    return res.end(readFileSync(join(ROOT, 'tools/dashboard.html')));
  }
  res.writeHead(404); res.end();
}).listen(PORT, '127.0.0.1', () => console.log(`Dashboard → http://localhost:${PORT}`));
