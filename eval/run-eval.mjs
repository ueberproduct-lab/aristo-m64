// The one eval entry point. Agents and humans run exactly this.
//   node eval/run-eval.mjs                 all features
//   node eval/run-eval.mjs --feature F5    F0…F5 (feature + regression of all earlier ones)
//   node eval/run-eval.mjs --only F5       just F5
//   node eval/run-eval.mjs --select F0,F3,F9  exactly these features (test selection for parallel lanes)
//   node eval/run-eval.mjs --look          only look features (F1, F2, F3, F7)
// Writes eval/report.json, eval/report.md and appends eval/history.jsonl. Exit 0 only if everything passes.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, appendFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { checkLock } from './lock.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const FEATURES = JSON.parse(readFileSync(join(ROOT, 'eval/features.json'), 'utf8'));
const order = Object.keys(FEATURES);
const arg = (name) => { const i = process.argv.indexOf(name); return i > -1 ? process.argv[i + 1] : null; };

let scope, selected;
if (arg('--feature')) { scope = `up to ${arg('--feature')}`; selected = order.slice(0, order.indexOf(arg('--feature')) + 1); }
else if (arg('--select')) { selected = order.filter((f) => arg('--select').split(',').includes(f)); scope = `select ${selected.join(',')}`; if (selected.length !== arg('--select').split(',').length) selected = []; }
else if (arg('--only')) { scope = `only ${arg('--only')}`; selected = [arg('--only')]; }
else if (process.argv.includes('--look')) { scope = 'look'; selected = order.filter((f) => FEATURES[f].look); }
else { scope = 'all'; selected = order; }
if (!selected.length || selected.some((f) => !FEATURES[f])) { console.error(`unknown feature in ${process.argv.slice(2).join(' ')}`); process.exit(2); }

// 1. tamper check
const lockProblems = checkLock();

// 2. run playwright for the selected IDs
const ids = selected.flatMap((f) => FEATURES[f].ids);
const grep = `(?<![\\w-])(${ids.join("|")})(?![0-9])`;
mkdirSync(join(ROOT, 'eval/artifacts'), { recursive: true });
const jsonOut = join(ROOT, 'eval/artifacts/last-run.json');
const started = Date.now();
spawnSync('npx', ['playwright', 'test', '--project=unit', '--project=e2e', '--grep', grep, '--reporter=json'], {
  cwd: ROOT,
  env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_FILE: jsonOut, PLAYWRIGHT_JSON_OUTPUT_NAME: jsonOut, FORCE_COLOR: '0' },
  stdio: ['ignore', 'ignore', 'inherit'],
});
const pw = existsSync(jsonOut) ? JSON.parse(readFileSync(jsonOut, 'utf8')) : { suites: [], errors: [{ message: 'playwright produced no report' }] };

// 3. collect results per test
const results = [];
const walk = (suite, file) => {
  for (const spec of suite.specs || []) {
    for (const t of spec.tests || []) {
      const last = t.results?.[t.results.length - 1];
      const status = t.status === 'skipped' ? 'pending' : t.status === 'expected' || t.status === 'flaky' ? 'passed' : 'failed';
      const msg = (last?.error?.message || '').replace(/\u001b\[[0-9;]*m/g, '').split('\n').filter(Boolean).slice(0, 6).join('\n');
      results.push({ title: spec.title, file, project: t.projectName, status, error: status === 'failed' ? msg : undefined });
    }
  }
  for (const s of suite.suites || []) walk(s, file || s.file || s.title);
};
for (const s of pw.suites || []) walk(s, s.file || s.title);

// 4. aggregate per ID and feature
const idOf = (title) => (title.match(/^([A-Z]-\d\d)/) || [])[1];
const features = {};
const failures = [];
for (const f of selected) {
  const entry = { title: FEATURES[f].title, status: 'passed', ids: {} };
  for (const id of FEATURES[f].ids) {
    const tests = results.filter((r) => idOf(r.title) === id);
    let status = 'passed';
    if (!tests.length) status = 'failed';
    else if (tests.some((t) => t.status === 'failed')) status = 'failed';
    else if (tests.every((t) => t.status === 'pending')) status = 'pending';
    entry.ids[id] = status;
    if (status === 'failed') {
      entry.status = 'failed';
      if (!tests.length) failures.push({ id, feature: f, test: '(no test ran)', error: 'no test found / runner error' });
      for (const t of tests.filter((t) => t.status === 'failed')) failures.push({ id, feature: f, test: `${t.title} [${t.project}]`, error: t.error });
    }
  }
  features[f] = entry;
}
const all = Object.values(features).flatMap((f) => Object.values(f.ids));
const summary = {
  ids: all.length,
  passed: all.filter((s) => s === 'passed').length,
  failed: all.filter((s) => s === 'failed').length,
  pending: all.filter((s) => s === 'pending').length,
  tests: results.length,
  testsFailed: results.filter((r) => r.status === 'failed').length,
};
const pass = lockProblems.length === 0 && summary.failed === 0 && !(pw.errors || []).length;
const report = {
  timestamp: new Date().toISOString(),
  scope,
  durationSec: Math.round((Date.now() - started) / 1000),
  pass,
  lock: { ok: lockProblems.length === 0, problems: lockProblems },
  runnerErrors: (pw.errors || []).map((e) => e.message?.split('\n')[0]),
  summary,
  features,
  failures,
};

// 5. write report.json, report.md, history.jsonl
writeFileSync(join(ROOT, 'eval/report.json'), JSON.stringify(report, null, 2) + '\n');
const md = [
  `# Eval-Report (${scope}) — ${pass ? '✅ PASS' : '❌ FAIL'}`,
  '',
  `${report.timestamp} · ${report.durationSec}s · IDs ${summary.passed}/${summary.ids} grün` + (summary.pending ? ` · ${summary.pending} pending` : '') + ` · Tests ${summary.tests - summary.testsFailed}/${summary.tests}`,
  '',
  lockProblems.length ? `**eval.lock verletzt:** ${lockProblems.join('; ')}\n` : 'eval.lock: OK\n',
  '| Feature | Status | IDs |',
  '|---|---|---|',
  ...Object.entries(features).map(([f, e]) => `| ${f} ${e.title} | ${e.status === 'passed' ? '✅' : '❌'} | ${Object.entries(e.ids).map(([id, s]) => `${id}${s === 'passed' ? '' : s === 'pending' ? ' ⏳' : ' ❌'}`).join(' ')} |`),
  '',
  failures.length ? '## Fehlschläge\n' : '',
  ...failures.map((f) => `### ${f.id} — ${f.test}\n\`\`\`\n${f.error}\n\`\`\``),
].join('\n');
writeFileSync(join(ROOT, 'eval/report.md'), md + '\n');
appendFileSync(join(ROOT, 'eval/history.jsonl'), JSON.stringify({ t: report.timestamp, scope, pass, ...summary, lockOk: report.lock.ok }) + '\n');

console.log(md.split('\n').slice(0, 4 + Object.keys(features).length + 4).join('\n'));
if (failures.length) console.log(`\n${failures.length} Fehlschläge → eval/report.md`);
process.exit(pass ? 0 : 1);
