// E-01 — integrity of the implementation: no eval knowledge inside src/. FROZEN.
import { test, expect } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';

const SRC = new URL('../../src/', import.meta.url);

test('E-01 src/ contains no eval IDs, no eval imports and no test-runner detection', () => {
  const hits = [];
  for (const f of readdirSync(SRC)) {
    readFileSync(new URL(f, SRC), 'utf8').split('\n').forEach((line, i) => {
      if (/\b[EFLG]-\d{2}[a-z]?\b|cases\.mjs|eval\/|playwright|webdriver/i.test(line)) hits.push(`src/${f}:${i + 1}: ${line.trim().slice(0, 100)}`);
    });
  }
  expect(hits, 'remove these references (comments included)').toEqual([]);
});
