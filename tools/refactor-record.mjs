// Deterministic record of every refactor round → refactor-history.jsonl (project root).
//   node tools/refactor-record.mjs before
//   node tools/refactor-record.mjs after --label "nach F6" --mode routine --steps 5 --reverts 0 --stop targets-met --green true
// KPIs per round:
//   effect  – how many metrics improved, how much of the gap to the policy targets was closed
//   safety  – revert rate, eval green afterwards
//   drift   – how much the gap grew between the end of the previous round and the start of this one
import { execFileSync, execSync } from 'node:child_process';
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SNAP = join(ROOT, '.refactor-metrics-before.json');
const HISTORY = join(ROOT, 'refactor-history.jsonl');
const policy = JSON.parse(readFileSync(join(ROOT, 'tools/refactor-policy.json'), 'utf8'));

const metrics = () => {
  const m = JSON.parse(execFileSync('node', [join(ROOT, 'tools/code-metrics.mjs'), '--json'], { encoding: 'utf8' }));
  delete m.details;
  delete m.hotspots;
  delete m.changeCost;
  return m;
};
/** distance to the policy targets: sum over all targeted metrics of how far they are above target */
const targets = Object.entries(policy.targets).filter(([k]) => !k.startsWith('$'));
const gap = (m) => +targets.reduce((s, [k, t]) => s + Math.max(0, (m[k] ?? 0) - t), 0).toFixed(2);
const arg = (name, dflt) => { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] : dflt; };
const churn = () => {
  try { return execSync('git diff --shortstat HEAD -- src', { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || 'no changes'; }
  catch { return null; }
};

const cmd = process.argv[2];
if (cmd === 'before') {
  writeFileSync(SNAP, JSON.stringify(metrics(), null, 2));
  console.log('metrics before saved');
} else if (cmd === 'after') {
  if (!existsSync(SNAP)) { console.error('run "before" first'); process.exit(1); }
  const before = JSON.parse(readFileSync(SNAP, 'utf8'));
  const after = metrics();
  const prev = existsSync(HISTORY) ? readFileSync(HISTORY, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)).pop() : null;
  const keys = targets.map(([k]) => k);
  const samePolicy = prev && prev.policyVersion === policy.version;
  const steps = Number(arg('steps', 0)), reverts = Number(arg('reverts', 0));
  const entry = {
    t: new Date().toISOString(),
    label: arg('label', ''),
    policyVersion: policy.version,
    mode: arg('mode', ''),
    steps,
    reverts,
    stopReason: arg('stop', ''),
    green: arg('green', 'false') === 'true',
    before,
    after,
    kpis: {
      improved: keys.filter((k) => after[k] < before[k]).length,
      worsened: keys.filter((k) => after[k] > before[k]).length,
      gapBefore: gap(before),
      gapAfter: gap(after),
      gapClosed: +(gap(before) - gap(after)).toFixed(2),
      revertRate: steps + reverts ? +(reverts / (steps + reverts)).toFixed(2) : 0,
      locDelta: after.locTotal - before.locTotal,
      drift: samePolicy ? +(gap(before) - prev.kpis.gapAfter).toFixed(2) : null,
      driftLoc: prev ? before.locTotal - prev.after.locTotal : null,
      cognitiveTotalDelta: (after.cognitiveTotal ?? 0) - (before.cognitiveTotal ?? 0),
    },
    gitChurnSrcSinceCommit: churn(),
  };
  appendFileSync(HISTORY, JSON.stringify(entry) + '\n');
  execSync(`rm -f "${SNAP}"`);
  console.log(JSON.stringify(entry.kpis));
} else {
  console.error('usage: refactor-record.mjs before | after --label … --mode … --steps n --reverts n --stop reason --green true|false');
  process.exit(2);
}
