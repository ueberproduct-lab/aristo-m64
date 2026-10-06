// Installs the Agentic-Loop core into a new project folder: the generic loop, the four roles, the skill, measuring tools and templates.
//   node kit/install.mjs <target-folder> [--name "Projektname"]
// The project then gets its own briefing, spec and eval (see kit/README.md, or let the /agentic-loop skill do it).
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, resolve } from 'node:path';

const KIT = new URL('.', import.meta.url).pathname;
const CORE = join(KIT, '..');
const target = resolve(process.argv[2] || '');
const nameArg = process.argv.indexOf('--name');
const name = nameArg > -1 ? process.argv[nameArg + 1] : target.split('/').pop();
if (!process.argv[2]) { console.error('usage: node kit/install.mjs <target-folder> [--name "Projektname"]'); process.exit(2); }
if (existsSync(target) && readdirSync(target).length && !process.argv.includes('--force')) {
  console.error(`${target} ist nicht leer (--force zum Überschreiben der Kern-Dateien)`); process.exit(1);
}
mkdirSync(target, { recursive: true });

// the core: identical in every project
const core = [
  ...['loop-builder.md', 'loop-tester.md', 'loop-judge.md', 'loop-refactorer.md', 'loop-reviewer.md', 'loop-architect.md'].map((f) => `.claude/agents/${f}`),
  '.claude/workflows/agentic-loop.js', '.claude/workflows/agentic-loop-parallel.js', '.claude/workflows/one-pass.js', '.claude/workflows/assess.js', '.claude/skills/agentic-loop/SKILL.md',
  'tools/code-metrics.mjs', 'tools/refactor-record.mjs', 'tools/refactor-report.mjs', 'tools/refactor-policy.json', 'tools/lane.mjs', 'tools/journal.mjs',
];
for (const f of core) { mkdirSync(join(target, f, '..'), { recursive: true }); cpSync(join(CORE, f), join(target, f)); }

// the project's own part, from templates (never overwrite what is already there)
for (const f of ['SPEC.md', 'EVAL.md', 'loop.config.json', 'briefing/BRIEFING.md', 'eval/seal.mjs']) {
  const to = join(target, f);
  if (existsSync(to)) continue;
  mkdirSync(join(to, '..'), { recursive: true });
  writeFileSync(to, readFileSync(join(KIT, 'templates', f), 'utf8').split('<Projektname>').join(name));
}
mkdirSync(join(target, 'src'), { recursive: true });
if (!existsSync(join(target, '.gitignore'))) {
  writeFileSync(join(target, '.gitignore'), 'node_modules/\neval/artifacts/\neval/report.json\neval/report.md\n.refactor-backup/\n.refactor-metrics-before.json\n.metrics-cache/\n');
}
if (!existsSync(join(target, '.git'))) {
  execSync('git init -q -b main && git add -A && git commit -q -m "Agentic-Loop-Kern und Vorlagen" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"', { cwd: target });
}
console.log(`Agentic-Loop-Kern installiert in ${target}
Nächste Schritte: Briefing → Spec → Eval (Bericht im Kern-Format) → loop.config.json → node eval/seal.mjs --write → Schleife.
Hinweis: tools/code-metrics.mjs misst JS/CSS/HTML (braucht eslint, eslint-plugin-sonarjs, jscpd als devDependencies).
Für andere Sprachen ein eigenes Metrik-Skript mit denselben Kennzahl-Namen wie in tools/refactor-policy.json anschließen.`);
