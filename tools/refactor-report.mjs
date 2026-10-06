// What did tidying up bring? Writes a plain-language report of all refactor rounds of a build.
//   node tools/refactor-report.mjs                      → REFACTOR-REPORT.md in the project (this tool's parent folder)
//   node tools/refactor-report.mjs --steps rounds.json  → with the refactorer's own step descriptions ([{label, steps:[{rule, what}]}])
//   node tools/refactor-report.mjs --json               → the numbers as JSON
//   --dir <project> reports on another build folder, --out <file> writes the report elsewhere
// Sources: refactor-history.jsonl (metrics before/after per round), tools/refactor-policy.json (targets), git (what changed in src).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

const arg = (k) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : null; };
const ROOT = arg('--dir') || new URL('..', import.meta.url).pathname;
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const config = existsSync(join(ROOT, 'loop.config.json')) ? readJson(join(ROOT, 'loop.config.json')) : {};
const SRC = config.sourceDir || 'src';
const policy = readJson(join(ROOT, (config.refactor && config.refactor.policy) || 'tools/refactor-policy.json'));
const targets = Object.entries(policy.targets).filter(([k]) => !k.startsWith('$'));
const history = existsSync(join(ROOT, 'refactor-history.jsonl'))
  ? readFileSync(join(ROOT, 'refactor-history.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l))
  : [];
const git = (c) => { try { return execSync(`git ${c}`, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return ''; } };
// the refactorer's step texts: from --steps, otherwise from the bodies of the refactor commits ("- rule: what")
const fromGit = () => git("log --reverse --grep='^refactor' --format=%s%x1f%b%x1e").split('\x1e').map((c) => c.trim()).filter(Boolean).map((c) => {
  const [subject, body = ''] = c.split('\x1f');
  const steps = body.split('\n').filter((l) => l.startsWith('- ')).map((l) => { const m = l.slice(2).match(/^([^:]+):\s*(.*)$/); return m ? { rule: m[1], what: m[2] } : { rule: '', what: l.slice(2) }; });
  return { label: subject.replace(/^refactor:\s*/, '').replace(/\s*\(.*$/, ''), steps };
});
const stepsFile = arg('--steps');
const stepRounds = stepsFile ? readJson(stepsFile) : fromGit();

export const NAMES = {
  locTotal: 'Zeilen Code', cognitiveMax: 'Kompliziertheit der schwierigsten Funktion', cognitiveTotal: 'Kompliziertheit gesamt',
  duplicationPct: 'doppelter Code (%)', clones: 'kopierte Stellen', longFunctions: 'überlange Funktionen',
  unusedExports: 'ungenutzte Exporte', unusedCssClasses: 'ungenutzte CSS-Klassen', processComments: 'Bau-Kommentare im Code',
};
const STOP = { 'targets-met': 'alle Ziele erreicht', 'max-steps': 'Schrittbudget aufgebraucht', 'no-gain': 'kein Gewinn mehr', reverts: 'zu viele Rücknahmen', 'boy-scout': 'Ziele schon erreicht, ein Pfadfinder-Schritt', 'not-green-at-start': 'Prüfung war schon vorher rot' };

// lines changed in src by refactor commits vs. by all commits
const churn = (grep) => git(`log ${grep} --format= --numstat -- ${SRC}`).trim().split('\n').filter(Boolean)
  .reduce((s, l) => { const [a, d] = l.split('\t'); return s + (Number(a) || 0) + (Number(d) || 0); }, 0);
const refactorChurn = churn("--grep='^refactor'");
const allChurn = churn('');

// the refactorer's step texts, matched to the history in order of their label
const used = {};
const stepsFor = (label) => {
  const list = stepRounds.filter((r) => r.label === label);
  const i = used[label] = (used[label] ?? -1) + 1;
  return (list[i] || {}).steps || [];
};
const rounds = history.map((h) => {
  const changed = Object.keys(NAMES).filter((k) => h.before && h.after && h.before[k] !== h.after[k]).map((k) => ({ metric: k, before: h.before[k], after: h.after[k] }));
  return { label: h.label, mode: h.mode, steps: h.steps, reverts: h.reverts, stop: h.stopReason, green: h.green, gapBefore: h.kpis?.gapBefore, gapAfter: h.kpis?.gapAfter, gapClosed: h.kpis?.gapClosed, locDelta: h.kpis?.locDelta, changed, stepTexts: stepsFor(h.label) };
});
const last = history.length ? history[history.length - 1].after : null;
const summary = {
  rounds: rounds.length,
  steps: rounds.reduce((s, r) => s + (r.steps || 0), 0),
  reverts: rounds.reduce((s, r) => s + (r.reverts || 0), 0),
  alwaysGreen: rounds.every((r) => r.green),
  gapClosed: rounds.reduce((s, r) => s + (r.gapClosed || 0), 0),
  locDelta: rounds.reduce((s, r) => s + (r.locDelta || 0), 0),
  refactorShareOfChanges: allChurn ? Math.round((refactorChurn / allChurn) * 100) : null,
  finalOnTarget: last ? targets.map(([k, t]) => ({ metric: k, value: last[k], target: t, ok: (last[k] ?? 0) <= t })) : [],
};

if (process.argv.includes('--json')) { console.log(JSON.stringify({ summary, rounds }, null, 2)); process.exit(0); }

const fmt = (v) => (typeof v === 'number' ? String(Math.round(v * 100) / 100).replace('.', ',') : v ?? '–');
const md = [
  `# Aufräum-Bericht${config.project ? ` · ${config.project}` : ''}`,
  ``,
  `Was hat das regelmäßige Aufräumen (Refactoring) in diesem Lauf gebracht? Grundlage: \`refactor-history.jsonl\`, die Regeln in`,
  `\`${(config.refactor && config.refactor.policy) || 'tools/refactor-policy.json'}\` und die Commits in \`${SRC}/\`.`,
  ``,
  `## Bilanz`,
  `| | |`,
  `|---|---|`,
  `| Aufräumrunden | ${summary.rounds} |`,
  `| Schritte, davon zurückgenommen | ${summary.steps}, ${summary.reverts} |`,
  `| Prüfung nach jeder Runde grün | ${summary.alwaysGreen ? 'ja' : 'nein'} |`,
  `| Verstöße gegen die Ordnungsregeln beseitigt | ${fmt(summary.gapClosed)} |`,
  `| Zeilen Code, netto | ${summary.locDelta > 0 ? '+' : ''}${summary.locDelta} |`,
  `| Anteil des Aufräumens an allen Änderungen in \`${SRC}/\` | ${summary.refactorShareOfChanges ?? '–'} % |`,
  ``,
  `## Stand am Ende gegen die Ziele`,
  `| Messwert | am Ende | Ziel | |`,
  `|---|---|---|---|`,
  ...summary.finalOnTarget.map((t) => `| ${NAMES[t.metric] || t.metric} | ${fmt(t.value)} | ≤ ${fmt(t.target)} | ${t.ok ? 'erfüllt' : 'offen'} |`),
  ``,
  `## Runde für Runde`,
  ...rounds.flatMap((r) => [
    ``,
    `### ${r.label} · ${r.mode}`,
    `${r.steps} Schritt${r.steps === 1 ? '' : 'e'}, ${r.reverts} zurückgenommen · Stopp: ${STOP[r.stop] || r.stop} · Prüfung danach ${r.green ? 'grün' : 'rot'} · Verstöße ${fmt(r.gapBefore)} → ${fmt(r.gapAfter)}`,
    ...(r.changed.length ? ['', ...r.changed.map((c) => `- ${NAMES[c.metric]}: ${fmt(c.before)} → ${fmt(c.after)}`)] : []),
    ...(r.stepTexts.length ? ['', 'Was der Aufräumer getan hat:', ...r.stepTexts.map((s) => `- **${s.rule}:** ${s.what}`)] : []),
  ]),
  ``,
].join('\n');
const out = arg('--out') || join(ROOT, 'REFACTOR-REPORT.md');
writeFileSync(out, md);
console.log(`${out} geschrieben: ${summary.rounds} Runden, ${summary.steps} Schritte, ${fmt(summary.gapClosed)} Verstöße beseitigt`);
