// A fresh, sealed build folder from a fixture project, for rehearsals of the workshop (not for results).
//   node kit/fixtures/prepare.mjs <fixture> <target folder>
// Copies the fixture, seals the exam, starts its own git repository with one commit (F0 scaffold included).
import { cpSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, resolve } from 'node:path';

const [fixture, target] = process.argv.slice(2);
if (!fixture || !target) { console.error('usage: prepare.mjs <fixture> <target>'); process.exit(2); }
const src = join(new URL('.', import.meta.url).pathname, fixture), dir = resolve(target);
if (existsSync(dir)) { console.error(`${dir} existiert schon`); process.exit(1); }
cpSync(src, dir, { recursive: true });
mkdirSync(join(dir, 'src'), { recursive: true });
writeFileSync(join(dir, 'src/.gitkeep'), '');
writeFileSync(join(dir, '.gitignore'), 'node_modules\neval/report.json\neval/report.md\n.lanes/\n');
writeFileSync(join(dir, '.gitattributes'), '*.jsonl merge=union\n');
const sh = (c) => execSync(c, { cwd: dir, encoding: 'utf8' });
sh('node eval/seal.mjs --write');
sh('git init -q -b main && git add -A && git commit -q -m "Probe: Spec, versiegeltes Eval, Gerüst" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"');
console.log(JSON.stringify({ dir, head: sh('git rev-parse --short HEAD').trim() }));
