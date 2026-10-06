// Tamper protection for the frozen spec + eval.
//   node eval/lock.mjs --write   (orchestrator only: after spec/eval changes)
//   node eval/lock.mjs --check   (tester: before every run; exit 1 on mismatch)
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const LOCK = join(ROOT, 'eval/eval.lock');
const GOLDEN_LOCK = join(ROOT, 'eval/golden.lock');

const files = () => {
  const list = ['SPEC.md', 'EVAL.md', 'spec/tokens.json', 'playwright.config.mjs'];
  for (const dir of ['eval', 'eval/unit', 'eval/e2e']) {
    for (const f of readdirSync(join(ROOT, dir))) {
      if (/\.(mjs|json|md)$/.test(f) && !/^(report|judge)\./.test(f)) list.push(`${dir}/${f}`);
    }
  }
  return list.sort();
};

const sha = (p) => createHash('sha256').update(readFileSync(join(ROOT, p))).digest('hex');

export function computeLock() {
  return Object.fromEntries(files().map((f) => [f, sha(f)]));
}

export function checkLock() {
  const problems = [];
  if (!existsSync(LOCK)) return ['eval/eval.lock missing'];
  const want = JSON.parse(readFileSync(LOCK, 'utf8'));
  const have = computeLock();
  for (const f of new Set([...Object.keys(want), ...Object.keys(have)])) {
    if (want[f] !== have[f]) problems.push(`${f}: ${!want[f] ? 'added' : !have[f] ? 'removed' : 'modified'}`);
  }
  if (existsSync(GOLDEN_LOCK)) {
    for (const [f, h] of Object.entries(JSON.parse(readFileSync(GOLDEN_LOCK, 'utf8')))) {
      if (!existsSync(join(ROOT, f)) || sha(f) !== h) problems.push(`${f}: golden modified`);
    }
  }
  return problems;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv.includes('--write')) {
    writeFileSync(LOCK, JSON.stringify(computeLock(), null, 2) + '\n');
    console.log(`eval.lock written (${files().length} files)`);
  } else {
    const p = checkLock();
    if (p.length) {
      console.error('EVAL LOCK BROKEN:\n  ' + p.join('\n  '));
      process.exit(1);
    }
    console.log('eval.lock OK');
  }
}
