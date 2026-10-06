// Documents the outcome of one build in experience/results.json, the same way for all four building styles, so the page can
// show and compare them without a live run. Screenshots are copied next to it (experience/results/<variant>/).
//   node experience/record.mjs <variant> --dir <build folder> [--assess assess.json] [--started ISO] [--finished ISO]
//        [--tokens N] [--note "…"]…
// variant: oneshot | direct | loop | graph. assess.json: result of the workflow assess.js ({ look, review }).
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ROOT, sh, STAGE1 } from './prepare-run.mjs';

const RESULTS = join(ROOT, 'experience/results.json');
const VARIANTS = ['oneshot', 'direct', 'loop', 'graph'];
const readJson = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null);
const args = process.argv.slice(2);
const arg = (k) => { const i = args.indexOf(k); return i > -1 ? args[i + 1] : null; };
const all = (k) => args.flatMap((a, i) => (a === k ? [args[i + 1]] : []));

/** the measurable part: eval report (overall and the core of the briefing, F0–F7), code metrics, commits */
export function measure(dir) {
  const report = readJson(join(dir, 'eval/report.json'));
  let metrics = null;
  try { metrics = JSON.parse(sh('node tools/code-metrics.mjs --json', dir)); } catch { /* no metrics */ }
  const feats = report ? Object.entries(report.features) : [];
  const core = feats.filter(([f]) => STAGE1.includes(f));
  const idsOf = (list) => {
    const st = list.flatMap(([, e]) => Object.values(e.ids));
    return { passed: st.filter((s) => s === 'passed').length, pending: st.filter((s) => s === 'pending').length, total: st.length };
  };
  return {
    ids: report ? idsOf(feats) : null,
    idsCore: report ? idsOf(core) : null,
    tests: report ? { passed: report.summary.tests - report.summary.testsFailed, total: report.summary.tests } : null,
    featuresGreen: report ? { passed: feats.filter(([, e]) => e.status === 'passed').length, total: feats.length } : null,
    failedIds: report ? [...new Set(report.failures.map((f) => f.id))] : [],
    metrics: metrics && (({ locTotal, cognitiveMax, cognitiveTotal, duplicationPct, longFunctions, unusedExports, unusedCssClasses, processComments }) =>
      ({ locTotal, cognitiveMax, cognitiveTotal, duplicationPct, longFunctions, unusedExports, unusedCssClasses, processComments }))(metrics),
    commits: Number(sh('git rev-list --count HEAD', dir).trim()) || 0,
  };
}

/** store one variant; the previous documentation of that variant is kept as `previous` */
export function record(variant, entry) {
  if (!VARIANTS.includes(variant)) throw new Error(`variant: ${VARIANTS.join(' | ')}`);
  const results = readJson(RESULTS) || {};
  const prev = results[variant];
  results[variant] = { ...entry, recordedAt: new Date().toISOString(), previous: prev && prev.status === 'done' ? { ...prev, previous: undefined } : undefined };
  writeFileSync(RESULTS, JSON.stringify(results, null, 2) + '\n');
  return results[variant];
}

export function copyShots(variant, dir) {
  const out = join(ROOT, 'experience/results', variant);
  mkdirSync(out, { recursive: true });
  const shots = {};
  for (const [name, file] of [['device', 'current-device.png'], ['nocase', 'current-device-nocase.png']]) {
    const src = join(dir, 'eval/artifacts', file);
    if (existsSync(src)) { copyFileSync(src, join(out, `${name}.png`)); shots[name] = `results/${variant}/${name}.png`; }
  }
  return shots;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [variant] = args;
  const dir = arg('--dir');
  if (!variant || !dir) { console.error('usage: record.mjs <oneshot|direct|loop|graph> --dir <build> [--assess f] [--started ISO] [--finished ISO] [--tokens N] [--note t]'); process.exit(2); }
  const assess = arg('--assess') ? readJson(arg('--assess')) : null;
  const started = arg('--started'), finished = arg('--finished') || new Date().toISOString();
  const entry = record(variant, {
    status: 'done',
    run: relative(ROOT, dir),
    date: finished.slice(0, 10),
    // --pause <min>: time the build stood still waiting for a human (e.g. after a halt), not counted as build time
    durationMin: started ? Math.round((Date.parse(finished) - Date.parse(started)) / 60000 - Number(arg('--pause') || 0)) : null,
    pauseMin: arg('--pause') ? Number(arg('--pause')) : undefined,
    tokens: arg('--tokens') ? Number(arg('--tokens')) : null,
    ...measure(dir),
    look: assess && assess.look ? assess.look : null,
    review: assess && assess.review ? assess.review : null,
    probe: assess && assess.probe ? assess.probe : null,
    maintainability: assess && assess.maintainability ? assess.maintainability : null,
    evalApplies: !(assess && assess.tests === false),
    shots: copyShots(variant, dir),
    notes: all('--note'),
  });
  console.log(JSON.stringify(entry, null, 2));
}
