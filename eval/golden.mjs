// Orchestrator only: freeze the accepted look as golden screenshots (G-01 with case, G-02 without) and lock them.
//   node eval/golden.mjs
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const FILES = ['eval/golden/m64-case-on.png', 'eval/golden/m64-case-off.png'];
const r = spawnSync('npx', ['playwright', 'test', '--project=e2e', '--grep', 'G-0[12]', '--update-snapshots=all'], {
  cwd: ROOT,
  env: { ...process.env, GOLDEN_UPDATE: '1' },
  stdio: 'inherit',
});
const lock = {};
for (const f of FILES) {
  if (!existsSync(join(ROOT, f))) { console.error(`golden screenshot was not written: ${f}`); process.exit(1); }
  lock[f] = createHash('sha256').update(readFileSync(join(ROOT, f))).digest('hex');
}
writeFileSync(join(ROOT, 'eval/golden.lock'), JSON.stringify(lock, null, 2) + '\n');
console.log(`golden written + locked: ${FILES.join(', ')}`);
process.exit(r.status ?? 0);
