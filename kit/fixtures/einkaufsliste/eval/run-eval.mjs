// Runs the sealed checks and writes eval/report.json (+ report.md, + a line in eval/history.jsonl). FROZEN (sealed).
//   node eval/run-eval.mjs                 everything
//   node eval/run-eval.mjs --feature F3    F0…F3
//   node eval/run-eval.mjs --select F0,F2  exactly these features
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { checks } from './checks.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const FEATURES = JSON.parse(readFileSync(join(ROOT, 'eval/features.json'), 'utf8'));
const order = Object.keys(FEATURES);
const arg = (k) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : null; };
let selected = order, scope = 'all';
if (arg('--feature')) { selected = order.slice(0, order.indexOf(arg('--feature')) + 1); scope = `up to ${arg('--feature')}`; }
else if (arg('--select')) { const want = arg('--select').split(','); selected = order.filter((f) => want.includes(f)); scope = `select ${selected.join(',')}`; if (selected.length !== want.length) selected = []; }
if (!selected.length) { console.error(`unbekanntes Feature in ${process.argv.slice(2).join(' ')}`); process.exit(2); }

const lock = spawnSync('node', ['eval/seal.mjs', '--check'], { cwd: ROOT, encoding: 'utf8' }).status === 0 ? 'ok' : 'broken';
const features = {}, failures = [];
let passed = 0, failed = 0, pending = 0;
for (const f of selected) {
  const entry = { title: FEATURES[f].title, status: 'passed', ids: {} };
  for (const id of FEATURES[f].ids) {
    let status = 'passed';
    try { if ((await checks[id]()) === 'pending') status = 'pending'; } catch (e) { status = 'failed'; failures.push({ id, feature: f, test: id, error: String(e && e.message ? e.message : e).slice(0, 400) }); }
    entry.ids[id] = status;
    if (status === 'passed') passed++; else if (status === 'failed') { failed++; entry.status = 'failed'; } else pending++;
  }
  features[f] = entry;
}
const ids = passed + failed + pending;
const report = { timestamp: new Date().toISOString(), scope, pass: failed === 0 && lock === 'ok', lock, summary: { ids, passed, failed, pending, tests: ids, testsFailed: failed }, features, failures };
writeFileSync(join(ROOT, 'eval/report.json'), JSON.stringify(report, null, 2) + '\n');
writeFileSync(join(ROOT, 'eval/report.md'), [`# Eval ${scope}: ${passed}/${ids} grün${pending ? `, ${pending} ausstehend` : ''}, Siegel ${lock}`, '', '| Feature | Status | IDs |', '|---|---|---|',
  ...Object.entries(features).map(([f, e]) => `| ${f} ${e.title} | ${e.status === 'passed' ? '✅' : '❌'} | ${Object.entries(e.ids).map(([id, s]) => (s === 'passed' ? id : `${id} (${s})`)).join(' ')} |`),
  ...(failures.length ? ['', '## Fehler', ...failures.map((x) => `- ${x.id}: ${x.error}`)] : [])].join('\n') + '\n');
appendFileSync(join(ROOT, 'eval/history.jsonl'), JSON.stringify({ t: report.timestamp, scope, pass: report.pass, ids, passed, failed, pending, tests: ids, testsFailed: failed, lockOk: lock === 'ok' }) + '\n');
console.log(`${scope}: ${passed}/${ids} grün, ${failed} rot, ${pending} ausstehend, Siegel ${lock}`);
process.exit(report.pass ? 0 : 1);
