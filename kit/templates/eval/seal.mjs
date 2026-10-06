// The seal on the exam: a SHA-256 fingerprint of every sealed file (list in loop.config.json → seal).
//   node eval/seal.mjs --write   (only the human / orchestrator, after a deliberate spec or eval change)
//   node eval/seal.mjs --check   (the tester, before every run; exit 1 when anything sealed changed)
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const config = JSON.parse(readFileSync(join(ROOT, 'loop.config.json'), 'utf8'));
const SEAL_FILE = join(ROOT, config.sealFile || 'eval/eval.seal');
const IGNORE = /(^|\/)(node_modules|\.git|artifacts)(\/|$)|\.seal$|report\.(json|md)$|\.jsonl$/;

function walk(p, out) {
  if (!existsSync(p) || IGNORE.test(relative(ROOT, p))) return out;
  if (statSync(p).isDirectory()) for (const f of readdirSync(p)) walk(join(p, f), out);
  else out.push(relative(ROOT, p));
  return out;
}
const files = () => (config.seal || []).flatMap((p) => walk(join(ROOT, p), [])).sort();
const sha = (f) => createHash('sha256').update(readFileSync(join(ROOT, f))).digest('hex');
const compute = () => Object.fromEntries(files().map((f) => [f, sha(f)]));

if (process.argv.includes('--write')) {
  writeFileSync(SEAL_FILE, JSON.stringify(compute(), null, 2) + '\n');
  console.log(`seal written (${files().length} files)`);
} else {
  if (!existsSync(SEAL_FILE)) { console.error('seal missing'); process.exit(1); }
  const want = JSON.parse(readFileSync(SEAL_FILE, 'utf8')), have = compute();
  const problems = [...new Set([...Object.keys(want), ...Object.keys(have)])].filter((f) => want[f] !== have[f])
    .map((f) => `${f}: ${!want[f] ? 'added' : !have[f] ? 'removed' : 'modified'}`);
  if (problems.length) { console.error('SEAL BROKEN:\n  ' + problems.join('\n  ')); process.exit(1); }
  console.log('seal OK');
}
