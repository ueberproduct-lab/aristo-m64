// Freezes how a documented build went, so the page can show its course without a live run:
// every agent with timing and outcome (activity timeline), feature attempts, commits, refactor rounds, the architect's plan.
//   node experience/snapshot.mjs <variant> --dir <build folder> --from <ISO> --to <ISO>
// Writes experience/results/<variant>/run.json. The window [from, to] selects the workflow journals of that build.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ROOT, sh } from './prepare-run.mjs';
import { agentRuns, refactorRounds, readLines } from '../tools/journal.mjs';

const ROLE = [
  [/^architektur/, 'architect'], [/^(build|gerüst|konflikt|direktbau|one shot)/, 'builder'], [/^integrator/, 'integrator'], [/^(test|final eval)/, 'tester'],
  [/^(judge|final judge|funktion)/, 'judge'], [/^refactor(?! verwerfen)/, 'refactor'], [/^gutachten/, 'reviewer'],
];
const roleOf = (label) => (ROLE.find(([re]) => re.test(label)) || [null, 'helper'])[1];
const readJson = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null);

export function snapshot(variant, dir, from, to) {
  const sinceMs = Date.parse(from), untilMs = Date.parse(to) + 5 * 60000; // journals are written until shortly after the end
  const agents = agentRuns({ sinceMs, untilMs, root: dir })
    .filter((a) => Date.parse(a.start) >= sinceMs - 60000 && Date.parse(a.start) <= Date.parse(to))
    .filter((a) => !/bewertung$/.test(a.label)) // the documentation's assessment is not part of the build
    .map((a) => ({ ...a, role: roleOf(a.label), feature: (a.label.match(/F\d+/) || [null])[0] }));
  // attempts per feature: the highest "#n" among its build agents
  const attempts = {};
  for (const a of agents) { const m = a.label.match(/^build (F\d+) #(\d+)/); if (m) attempts[m[1]] = Math.max(attempts[m[1]] || 0, Number(m[2])); }
  const commits = sh(`git log --reverse --format=%h%x09%s%x09%cI`, dir).trim().split('\n').filter(Boolean).map((l) => { const [h, s, t] = l.split('\t'); return { h, s, t }; });
  const run = {
    variant, run: relative(ROOT, dir), from, to,
    durationMin: Math.round((Date.parse(to) - Date.parse(from)) / 60000),
    agents, attempts, commits,
    refactors: readLines(join(dir, 'refactor-history.jsonl')),
    refactorSteps: refactorRounds({ sinceMs, untilMs, root: dir }).filter((r) => !/Reparatur/.test(r.label)),
    refactorTargets: (readJson(join(dir, 'tools/refactor-policy.json')) || {}).targets || {},
    plan: readJson(join(dir, 'loop.plan.json')),
  };
  const out = join(ROOT, 'experience/results', variant);
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'run.json'), JSON.stringify(run) + '\n');
  return run;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const a = process.argv.slice(2);
  const arg = (k) => { const i = a.indexOf(k); return i > -1 ? a[i + 1] : null; };
  if (!a[0] || !arg('--dir') || !arg('--from') || !arg('--to')) { console.error('usage: snapshot.mjs <variant> --dir <build> --from <ISO> --to <ISO>'); process.exit(2); }
  const r = snapshot(a[0], arg('--dir'), arg('--from'), arg('--to'));
  console.log(`${a[0]}: ${r.agents.length} Agenten, ${r.durationMin} min, ${r.commits.length} Commits, ${r.refactors.length} Aufräumrunden${r.plan ? ', Plan' : ''}`);
}
