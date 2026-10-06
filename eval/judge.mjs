// Visual LLM judge, runnable standalone: npm run eval:judge
// 1) captures screenshots (playwright project "capture")  2) asks the loop-judge agent (headless claude)
// 3) writes eval/judge.json and appends to eval/history.jsonl. Exit 0 if score ≥ 17 and no criterion is 0.
import { spawnSync } from 'node:child_process';
import { writeFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;

const cap = spawnSync('npx', ['playwright', 'test', '--project=capture', '--reporter=line'], { cwd: ROOT, stdio: 'inherit' });
if (cap.status !== 0) { console.error('capture failed'); process.exit(1); }

const prompt = [
  'Bewerte den aktuellen Stand der Aristo-M-64-WebApp nach eval/visual-rubric.md.',
  'Screenshots: eval/artifacts/current-desktop.png, current-device.png, current-device-nocase.png, current-display.png, current-pressed.png, current-mobile.png (fehlende ignorieren).',
  'Referenzen: alle Bilder in spec/reference/.',
  'Antworte ausschließlich mit dem JSON-Objekt aus der Rubrik, ohne Markdown-Zaun.',
].join('\n');

const r = spawnSync('claude', ['-p', prompt, '--agent', 'loop-judge', '--allowedTools', 'Read,Glob', '--output-format', 'json'], {
  cwd: ROOT,
  encoding: 'utf8',
  maxBuffer: 20 * 1024 * 1024,
});
if (r.status !== 0) { console.error(r.stderr || 'claude failed'); process.exit(1); }

let verdict;
try {
  const text = JSON.parse(r.stdout).result;
  verdict = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
} catch (e) {
  console.error('could not parse judge output:\n' + r.stdout);
  process.exit(1);
}
const scores = Object.values(verdict.perCriterion || {}).map((c) => (typeof c === 'number' ? c : c.score));
verdict.score = scores.reduce((a, b) => a + b, 0);
verdict.pass = verdict.score >= 17 && !scores.includes(0);
verdict.timestamp = new Date().toISOString();
writeFileSync(join(ROOT, 'eval/judge.json'), JSON.stringify(verdict, null, 2) + '\n');
appendFileSync(join(ROOT, 'eval/history.jsonl'), JSON.stringify({ t: verdict.timestamp, scope: 'judge', pass: verdict.pass, score: verdict.score }) + '\n');
console.log(`Judge: ${verdict.score}/20 → ${verdict.pass ? 'PASS' : 'FAIL'}`);
for (const m of verdict.mustFix || []) console.log(`  must fix: ${m}`);
process.exit(verdict.pass ? 0 : 1);
