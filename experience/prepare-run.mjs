// Prepares an isolated build folder of the Aristo M 64: briefing, spec, frozen eval, roles and tools, empty scaffold, own ports,
// own git repo. Used by run.mjs for every building style (One Shot, Direktbau, Agentic Loop, Graph).
import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';

export const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
export const sh = (cmd, cwd) => execSync(cmd, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
export const commit = (dir, msg) => sh(`git add -A && git commit -q -m "${msg}" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`, dir);
/** stage 1 of the Aristo build: the rough calculator */
export const STAGE1 = ['F0', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7'];
export const stamp = () => new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 13);

/** features: the feature ids the eval unlocks (e.g. ['F0', …, 'F7']); all when omitted */
export function prepareRun({ dir, appPort, features, message }) {
  mkdirSync(dir, { recursive: true });

  // the plan and the frozen exam: spec, tokens, reference photos, eval, agents, refactor tools
  for (const p of ['SPEC.md', 'EVAL.md', 'LOOP.md', 'loop.config.json', 'spec', 'eval', 'playwright.config.mjs', 'server.mjs', 'package.json', 'briefing']) {
    cpSync(join(ROOT, p), join(dir, p), { recursive: true });
  }
  mkdirSync(join(dir, 'tools'), { recursive: true });
  for (const f of ['code-metrics.mjs', 'refactor-record.mjs', 'refactor-report.mjs', 'refactor-policy.json', 'lane.mjs']) cpSync(join(ROOT, 'tools', f), join(dir, 'tools', f));
  mkdirSync(join(dir, '.claude/agents'), { recursive: true });
  for (const f of readdirSync(join(ROOT, '.claude/agents'))) {
    // the roles name the project path: point them at the run
    writeFileSync(join(dir, '.claude/agents', f), readFileSync(join(ROOT, '.claude/agents', f), 'utf8').split(ROOT).join(dir));
  }
  symlinkSync(join(ROOT, 'node_modules'), join(dir, 'node_modules'));

  // fresh start: no goldens, no reports, no history — and the run's own ports
  rmSync(join(dir, 'eval/golden'), { recursive: true, force: true });
  mkdirSync(join(dir, 'eval/golden'));
  for (const f of ['eval/golden.lock', 'eval/report.json', 'eval/report.md', 'eval/history.jsonl']) rmSync(join(dir, f), { force: true });
  rmSync(join(dir, 'eval/artifacts'), { recursive: true, force: true });
  // the spec names the port the build really runs on, so nobody has to guess (the finished calculator keeps 4173)
  const specPath = join(dir, 'SPEC.md');
  writeFileSync(specPath, readFileSync(specPath, 'utf8').split('http://localhost:4173').join(`http://localhost:${appPort}`));
  for (const f of ['playwright.config.mjs', 'server.mjs']) {
    const p = join(dir, f);
    writeFileSync(p, readFileSync(p, 'utf8').replace('Number(process.env.PORT) || 4173', `Number(process.env.PORT) || ${appPort}`));
  }

  if (features) {
    const all = JSON.parse(readFileSync(join(ROOT, 'eval/features.json'), 'utf8'));
    writeFileSync(join(dir, 'eval/features.json'), JSON.stringify(Object.fromEntries(Object.entries(all).filter(([f]) => features.includes(f))), null, 2) + '\n');
  }

  // the empty scaffold (F0): a page with a title, nothing else
  mkdirSync(join(dir, 'src'));
  writeFileSync(join(dir, 'src/index.html'), `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Aristo M 64</title>
</head>
<body>
  <!-- F0 scaffold: the calculator is built from SPEC.md. -->
</body>
</html>
`);
  writeFileSync(join(dir, '.gitignore'), 'node_modules\neval/artifacts/\neval/report.json\neval/report.md\n.refactor-backup/\n.refactor-metrics-before.json\n.metrics-cache/\n.thawed/\n.lanes/\n');
  writeFileSync(join(dir, '.gitattributes'), '*.jsonl merge=union\n');
  sh('node eval/lock.mjs --write', dir);
  sh('git init -q -b main', dir);
  commit(dir, message);
  return dir;
}
