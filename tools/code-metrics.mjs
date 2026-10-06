// General code-health metrics for src/ (project-agnostic). Used by the loop-refactorer and the dashboard.
//   node tools/code-metrics.mjs          → table
//   node tools/code-metrics.mjs --json   → JSON
//
// Metrics (all general, none tied to this project's domain):
//   cognitiveMax / cognitiveTotal  – SonarSource cognitive complexity per JS function (eslint-plugin-sonarjs)
//   duplicationPct / clones        – copy-paste detection over JS, CSS and HTML (jscpd, token based)
//   longFunctions                  – JS functions longer than 40 lines
//   unusedExports / unusedCssClasses – dead code
//   processComments                – TODO/FIXME and comments that narrate the build history instead of the code
//   hotspots                       – change frequency (git) × size, after Adam Tornhill: where refactoring pays off
//   changeCost                     – lines/files of src/ touched per feature commit (git): is the code getting harder to change?
import { readFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { ESLint } from 'eslint';
import sonarjs from 'eslint-plugin-sonarjs';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = join(ROOT, 'src');
const files = Object.fromEntries(readdirSync(SRC).map((f) => [f, readFileSync(join(SRC, f), 'utf8')]));
const spec = existsSync(join(ROOT, 'SPEC.md')) ? readFileSync(join(ROOT, 'SPEC.md'), 'utf8') : '';
const js = Object.entries(files).filter(([f]) => f.endsWith('.js'));
const css = Object.entries(files).filter(([f]) => f.endsWith('.css')).map(([, s]) => s).join('\n');
const markup = Object.entries(files).filter(([f]) => f.endsWith('.html')).map(([, s]) => s).join('\n');
const lines = (s) => s.split('\n');
const loc = Object.fromEntries(Object.entries(files).map(([f, s]) => [f, lines(s).filter((l) => l.trim()).length]));
const sh = (cmd) => { try { return execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return ''; } };

// ---- cognitive complexity (every function, threshold 0 so each one reports its value)
const eslint = new ESLint({
  cwd: ROOT,
  overrideConfigFile: true,
  overrideConfig: [{
    files: ['**/*.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    plugins: { sonarjs },
    rules: { 'sonarjs/cognitive-complexity': ['error', 0] },
  }],
});
const cognitive = [];
for (const r of await eslint.lintFiles(js.map(([f]) => join(SRC, f)))) {
  for (const m of r.messages) {
    const v = m.message.match(/from (\d+) to/);
    if (v) cognitive.push({ where: `${r.filePath.replace(SRC + '/', '')}:${m.line}`, value: Number(v[1]) });
  }
}
cognitive.sort((a, b) => b.value - a.value);

// ---- duplication (jscpd, token based, JS + CSS + HTML)
const cache = join(ROOT, '.metrics-cache');
sh(`npx jscpd src --silent --min-tokens 40 --reporters json --output "${cache}"`);
let dup = { percentage: 0, duplicatedLines: 0, clones: 0 };
try {
  const rep = JSON.parse(readFileSync(join(cache, 'jscpd-report.json'), 'utf8'));
  dup = { percentage: rep.statistics.total.percentage, duplicatedLines: rep.statistics.total.duplicatedLines, clones: rep.duplicates.length };
} catch { /* no report: no duplicates found */ }
rmSync(cache, { recursive: true, force: true });

// ---- long functions (> 40 lines), crude brace matching
const longFunctions = [];
for (const [f, s] of js) {
  const ls = lines(s);
  ls.forEach((l, i) => {
    if (/function\s+\w+\s*\(|=>\s*{\s*$|^\s*\w+\s*\([^)]*\)\s*{\s*$/.test(l)) {
      let depth = 0, j = i;
      for (; j < ls.length; j++) {
        depth += (ls[j].match(/{/g) || []).length - (ls[j].match(/}/g) || []).length;
        if (depth <= 0 && j > i) break;
      }
      if (j - i > 40) longFunctions.push(`${f}:${i + 1} (${j - i} lines)`);
    }
  });
}

// ---- dead code: exports never imported (and not named in the spec as a contract), CSS classes never used
const exports = [];
for (const [f, s] of js) for (const m of s.matchAll(/export\s+(?:const|function|class|let)\s+(\w+)/g)) exports.push([f, m[1]]);
const unusedExports = exports
  .filter(([f, name]) => !js.some(([g, s]) => g !== f && new RegExp(`import[^;]*\\b${name}\\b[^;]*from`).test(s)) && !spec.includes(name))
  .map(([f, n]) => `${f}:${n}`);
const cssNoComments = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/url\([^)]*\)/g, '');
const cssClasses = [...new Set([...cssNoComments.matchAll(/(?<![\w\d])\.([a-zA-Z][\w-]*)(?=[\s,.:{>+~)\[]|$)/gm)].map((m) => m[1]))];
const usedElsewhere = markup + js.map(([, s]) => s).join('\n');
const dynamicPrefix = (c) => c.includes('-') && usedElsewhere.includes(c.slice(0, c.lastIndexOf('-') + 1) + '${');
const unusedCss = cssClasses.filter((c) => !dynamicPrefix(c) && !new RegExp(`\\b${c}\\b`).test(usedElsewhere));

// ---- TODO/FIXME and build-history narration in comments
const markers = /\b(TODO|FIXME|XXX|HACK)\b/; // case-sensitive: "0.xxx" is not a marker
const narration = /(\biteration\b|\blater\b|\bspäter\b|\bfor now\b|\bvorerst\b|\bF\d{1,2}\b|\bjudge\b|\bmustFix\b)/i;
const processComments = [];
for (const [f, s] of Object.entries(files)) {
  lines(s).forEach((l, i) => {
    const c = l.match(/\/\/(.*)$|\/\*(.*?)(\*\/|$)|<!--(.*?)(-->|$)/);
    if (c && (markers.test(c[0]) || narration.test(c[0]))) processComments.push(`${f}:${i + 1}`);
  });
}

// ---- git: hotspots (changes × size) and change cost per feature commit
const changes = {};
for (const block of sh('git log --format=@@%H --name-only -- src').split('@@').filter(Boolean)) {
  for (const f of block.split('\n').slice(1).filter((x) => x.startsWith('src/'))) changes[f.slice(4)] = (changes[f.slice(4)] || 0) + 1;
}
const hotspots = Object.entries(loc)
  .map(([f, n]) => ({ file: f, changes: changes[f] || 0, loc: n, score: (changes[f] || 0) * n }))
  .sort((a, b) => b.score - a.score);
const changeCost = sh('git log --reverse --format=@@%s --numstat --grep=^feat -- src')
  .split('@@').filter(Boolean)
  .map((block) => {
    const [subject, ...rows] = block.trim().split('\n');
    const nums = rows.filter(Boolean).map((r) => r.split('\t')).filter((r) => r.length === 3);
    return { commit: subject, files: nums.length, lines: nums.reduce((a, [ad, del]) => a + (Number(ad) || 0) + (Number(del) || 0), 0) };
  });

const m = {
  locTotal: Object.values(loc).reduce((a, b) => a + b, 0),
  loc,
  cognitiveMax: cognitive[0]?.value ?? 0,
  cognitiveTotal: cognitive.reduce((a, c) => a + c.value, 0),
  duplicationPct: Number(dup.percentage.toFixed(2)),
  clones: dup.clones,
  longFunctions: longFunctions.length,
  unusedExports: unusedExports.length,
  unusedCssClasses: unusedCss.length,
  processComments: processComments.length,
  hotspots: hotspots.slice(0, 3),
  changeCost,
  details: { cognitiveTop: cognitive.slice(0, 8), longFunctions, unusedExports, unusedCss, processComments },
};

if (process.argv.includes('--json')) console.log(JSON.stringify(m, null, 2));
else {
  console.log('Code-Metriken src/ (allgemein)');
  for (const [k, v] of Object.entries(m)) if (typeof v !== 'object') console.log(`  ${k.padEnd(18)} ${v}`);
  console.log('  loc per file      ', Object.entries(m.loc).map(([f, n]) => `${f} ${n}`).join(' · '));
  console.log('  hotspots          ', m.hotspots.map((h) => `${h.file} (${h.changes}× · ${h.loc} loc)`).join(' · '));
  console.log('  changeCost        ', m.changeCost.length ? m.changeCost.map((c) => `${c.commit}: ${c.lines} lines/${c.files} files`).join(' · ') : '– (noch keine Feature-Commits)');
  console.log('  cognitive top     ', m.details.cognitiveTop.map((c) => `${c.where}=${c.value}`).join(', '));
  for (const k of ['longFunctions', 'unusedExports', 'unusedCss', 'processComments']) if (m.details[k].length) console.log(`  ${k}: ${m.details[k].slice(0, 10).join(', ')}`);
}
