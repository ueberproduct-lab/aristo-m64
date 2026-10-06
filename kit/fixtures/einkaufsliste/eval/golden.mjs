// Orchestrator only: freeze the current CLI output of the sample list as the reference (G-01). FROZEN (sealed).
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const r = spawnSync('node', ['src/cli.mjs', 'eval/sample.txt'], { cwd: ROOT, encoding: 'utf8' });
if (r.status !== 0) { console.error(`cli.mjs endet mit ${r.status}: ${r.stderr}`); process.exit(1); }
mkdirSync(join(ROOT, 'reference'), { recursive: true });
writeFileSync(join(ROOT, 'reference/render.txt'), r.stdout.replace(/\s+$/, '') + '\n');
console.log('Referenz eingefroren: reference/render.txt');
