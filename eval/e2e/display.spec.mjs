// L-16, L-17, L-18 — 7-segment rendering contract. FROZEN.
import { test, expect } from '@playwright/test';
import { open, sel, tokens, litState, render, displayValue } from './helpers.mjs';

// same normalisation as litState(): sorted segment names joined, e.g. "abcddpef" for "0."
const expected = (ch, dp) => [...(ch ? tokens.segments[ch] : ''), ...(dp ? ['dp'] : [])].sort().join('');
const expectCell = (actual, ch, dp, msg) => expect(actual, msg).toBe(expected(ch, dp));

test.beforeEach(async ({ page }) => open(page));

test('L-16 initial display shows "0." right-aligned', async ({ page }) => {
  expect(await displayValue(page)).toBe('0.');
  const s = await litState(page);
  expect(s.digits).toHaveLength(8);
  expect(s.sign, 'sign cell dark').toBe('');
  for (let i = 0; i < 7; i++) expect(s.digits[i], `cell ${i} dark`).toBe('');
  expectCell(s.digits[7], '0', true, 'rightmost cell shows 0 with decimal point');
});

test('L-17 render(): digits 0–9 use the reference segment patterns, right-aligned with dp', async ({ page }) => {
  await render(page, '01234567.');
  let s = await litState(page);
  expect(await displayValue(page)).toBe('01234567.');
  for (let i = 0; i < 8; i++) expectCell(s.digits[i], String(i), i === 7, `cell ${i} = ${i}`);

  await render(page, '89.');
  s = await litState(page);
  for (let i = 0; i < 6; i++) expect(s.digits[i], `cell ${i} dark`).toBe('');
  expectCell(s.digits[6], '8', false, 'cell 6 = 8');
  expectCell(s.digits[7], '9', true, 'cell 7 = 9.');

  await render(page, '3.1415926');
  s = await litState(page);
  [...'31415926'].forEach((ch, i) => expectCell(s.digits[i], ch, i === 0, `cell ${i} = ${ch}`));
});

test('L-18 render(): minus in the sign cell, E in the leftmost cell, "" blank', async ({ page }) => {
  await render(page, '-5.');
  let s = await litState(page);
  expect(s.sign, 'minus lit').toBe('g');
  expectCell(s.digits[7], '5', true, 'cell 7 = 5.');

  await render(page, 'E');
  s = await litState(page);
  expect(await displayValue(page)).toBe('E');
  expect(s.sign).toBe('');
  expectCell(s.digits[0], 'E', false, 'leftmost cell shows E');
  for (let i = 1; i < 8; i++) expect(s.digits[i], `cell ${i} dark`).toBe('');

  await render(page, '');
  s = await litState(page);
  expect(s.sign).toBe('');
  for (let i = 0; i < 8; i++) expect(s.digits[i]).toBe('');
});
