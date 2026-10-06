// Contract test of the graph workshop's tools against a real repository – no agents, no mocks.
//   node tools/graph/selftest.mjs [scratch folder]
// Every answer must be one JSON line with a valid checksum, and every case that once broke a run is reproduced here.
import { execSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, appendFileSync, readFileSync, existsSync, rmSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const HERE = new URL('.', import.meta.url).pathname;
const WS = join(HERE, '../..');
const base = process.argv[2] || mkdtempSync(join(tmpdir(), 'graph-selftest-'));
const R = join(base, 'projekt');
rmSync(R, { recursive: true, force: true });
execSync(`node ${join(WS, 'kit/fixtures/prepare.mjs')} einkaufsliste ${R}`, { stdio: 'ignore' });
if (existsSync(join(WS, 'node_modules')) && !existsSync(join(R, 'node_modules'))) symlinkSync(join(WS, 'node_modules'), join(R, 'node_modules'));

const checksum = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) >>> 0; return h.toString(16); };
let failed = 0, passed = 0;
function run(tool, args, input) {
  const r = spawnSync('node', [join(HERE, tool), ...args], { cwd: R, input, encoding: 'utf8' });
  const lines = r.stdout.trim().split('\n');
  const last = lines[lines.length - 1];
  let data = null;
  try { data = JSON.parse(last); } catch { /* not JSON */ }
  const { _sum, ...rest } = data || {};
  const sumOk = !!data && _sum === checksum(JSON.stringify(rest));
  return { exit: r.status, data: rest, sumOk, oneLine: lines.length === 1, raw: r.stdout + r.stderr };
}
function check(name, cond, detail) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); } else { failed++; console.log(`  ✗ ${name}${detail ? ` – ${String(detail).slice(0, 300)}` : ''}`); }
}
const contract = (name, r) => check(`${name}: eine JSON-Zeile mit gültiger Prüfsumme`, r.oneLine && r.sumOk, r.raw);
const git = (c, cwd = R) => execSync(`git ${c}`, { cwd, encoding: 'utf8' }).trim();
const W = (...a) => run('werkstatt.mjs', [...a, '--root', R]);
const L = (...a) => run('lane.mjs', [...a, '--root', R]);

console.log(`Werkstatt-Selbsttest in ${R}`);

console.log('werkstatt.mjs');
let r = run('werkstatt.mjs', ['status']); contract('ohne --root', r); check('ohne --root → Fehler, Exit 2', r.exit === 2 && r.data.error);
r = W('status'); contract('status', r); check('status: nichts gebaut', r.exit === 0 && r.data.built.length === 0);
r = W('commit'); contract('commit ohne Nachricht', r); check('commit ohne Nachricht → abgelehnt', r.exit === 1);
writeFileSync(join(R, 'src/parse.mjs'), 'export const parse = () => [];\n');
r = W('commit', '--src', 'src', ''); r = run('werkstatt.mjs', ['commit', '--root', R, '--src', 'src'], 'feat(F1): Test "mit" Anführung\n\nZeile zwei');
contract('commit', r); check('commit: festgehalten mit Co-Authored-By', r.exit === 0 && r.data.committed && git('log -1 --format=%B').includes('Co-Authored-By'));
r = run('werkstatt.mjs', ['commit', '--root', R], 'nochmal'); check('commit ohne Änderung → „nichts zu committen“, Exit 0', r.exit === 0 && r.data.note);
writeFileSync(join(R, 'src/parse.mjs'), '<<<<<<< HEAD\na\n=======\nb\n>>>>>>> x\n');
r = run('werkstatt.mjs', ['commit', '--root', R], 'kaputt'); contract('commit mit Konfliktmarkern', r); check('commit mit Konfliktmarkern → verweigert', r.exit === 1 && /Konfliktmarker/.test(r.data.error));
r = W('restore', '--paths', 'src', '--clean', 'src'); contract('restore', r); check('restore: Stand verworfen', r.exit === 0 && r.data.clean && !readFileSync(join(R, 'src/parse.mjs'), 'utf8').includes('<<<'));
const planText = JSON.stringify({ units: [{ id: 'u', files: ['src/a.mjs'], contract: '„ARISTO M 64"' }], waves: [['F1']] });
r = run('werkstatt.mjs', ['plan', '--root', R, '--sum', checksum(planText)], planText); contract('plan', r); check('plan: mit passender Prüfsumme geschrieben', r.exit === 0 && JSON.parse(readFileSync(join(R, 'loop.plan.json'), 'utf8')).units[0].contract === '„ARISTO M 64"');
r = run('werkstatt.mjs', ['plan', '--root', R, '--sum', checksum(planText)], planText.replace('\\"', '"')); check('plan: verfälschter Text → nicht geschrieben', r.exit === 1 && r.data.ok === false);
// a long plan in short pieces: each piece verified on its own, the whole verified again
const longPlan = JSON.stringify({ units: Array.from({ length: 40 }, (_, i) => ({ id: `u${i}`, contract: `Vertrag „${i}" mit \\ Backslash und "Zitat"` })), waves: [['F1']] });
const pieces = longPlan.match(/[\s\S]{1,700}/g);
let piecesOk = true;
for (let i = 0; i < pieces.length; i++) { const pr = run('werkstatt.mjs', ['plan-part', '--root', R, '--index', String(i), '--sum', checksum(pieces[i])], pieces[i] + '\n'); piecesOk = piecesOk && pr.exit === 0 && pr.sumOk; }
check(`plan-part: ${pieces.length} Stücke einzeln geprüft gespeichert`, piecesOk);
r = run('werkstatt.mjs', ['plan-part', '--root', R, '--index', '0', '--sum', checksum(pieces[0])], pieces[0].slice(1) + '\n'); check('plan-part: verfälschtes Stück → abgelehnt', r.exit === 1);
r = W('plan', '--parts', String(pieces.length), '--sum', checksum(longPlan)); contract('plan aus Stücken', r);
check('plan: aus Stücken zusammengesetzt, exakt gleich', r.exit === 0 && readFileSync(join(R, 'loop.plan.json'), 'utf8').trim() === longPlan && !existsSync(join(R, '.plan-parts')));
r = W('eval', '--cmd', 'npm run eval --silent -- --select F0,F1', '--lock', 'node eval/seal.mjs --check', '--progress', 'F1 1');
contract('eval', r); check('eval: genau die Auswahl (Scope)', r.data.scope === 'select F0,F1' && r.data.summary.ids === 5);
check('eval: rot erkannt, Fehler-IDs aus dem Bericht', r.exit === 1 && r.data.failedIds.includes('P-01') && r.data.lockOk);
check('eval: Logbuch-Zeile geschrieben', readFileSync(join(R, 'progress.jsonl'), 'utf8').includes('"feature":"F1"'));
r = W('eval', '--cmd', 'true'); check('eval: kein frischer Bericht → Fehler statt altem Ergebnis', r.exit === 1 && /frischer Bericht/.test(r.data.error));
r = W('eval', '--cmd', 'npm run eval --silent -- --select F0', '--lock', 'false'); check('eval: gebrochenes Siegel → lockOk false', r.data.lockOk === false && r.data.pass === false);

// a reference solution for the golden step (G-01 needs a working CLI)
const SOL = {
  'parse.mjs': `export function parse(t){const o=[];for(const raw of t.split('\\n')){const l=raw.trim();if(!l||l.startsWith('#'))continue;const m=l.match(/^(\\d+)\\s*(?:x\\s+|x(?=\\S)\\s*|\\s+)?(.*)$/i);if(!m){o.push({name:l,qty:1,unit:null});continue}let rest=m[2].trim(),unit=null;const u=rest.match(/^(\\S+)\\s+(.+)$/);if(u&&['g','kg','ml','l'].includes(u[1])){unit=u[1];rest=u[2].trim()}o.push({name:rest,qty:Number(m[1]),unit})}return o}\n`,
  'totals.mjs': `const B={kg:['g',1000],l:['ml',1000]};export function totals(items){const o=[];for(const i of items){const [u,f]=B[i.unit]||[i.unit,1];const h=o.find((x)=>x.name.toLowerCase()===i.name.toLowerCase()&&x.unit===u);if(h)h.qty+=i.qty*f;else o.push({name:i.name,qty:i.qty*f,unit:u})}return o}\n`,
  'render.mjs': `const line=(i)=>String(i.qty).padStart(6)+' '+(i.unit?i.unit+' ':'')+i.name;export function render(items){return items.length?items.map(line).join('\\n'):'(leer)'}\n`,
  'cli.mjs': `import {readFileSync} from 'node:fs';import {parse} from './parse.mjs';import {totals} from './totals.mjs';import {render} from './render.mjs';console.log(render(totals(parse(readFileSync(process.argv[2],'utf8'))),{grouped:true}));\n`,
};
for (const [f, c] of Object.entries(SOL)) writeFileSync(join(R, 'src', f), c);
run('werkstatt.mjs', ['commit', '--root', R], 'feat(F3): Lösung für den Test');
r = W('golden', '--cmd', 'npm run eval:golden --silent', '--eval', 'npm run eval --silent -- --feature F3');
contract('golden', r); check('golden: eingefroren und G-01 grün', r.exit === 0 && r.data.frozen && r.data.pass && existsSync(join(R, 'reference/render.txt')));
run('werkstatt.mjs', ['commit', '--root', R], 'chore: Referenz');

console.log('lane.mjs');
r = run('lane.mjs', ['list']); contract('ohne --root', r); check('ohne --root → Fehler', r.exit === 2);
r = L('add', 'F4', '--port', '4610', '--env', 'PORT={port}', '--select', 'F0,F4', '--writable', 'src/categories.mjs');
contract('add', r); check('add: Spur angelegt', r.exit === 0 && existsSync(join(R, '.lanes/F4/.git')));
const laneCfg = JSON.parse(readFileSync(join(R, '.lanes/F4/loop.config.json'), 'utf8'));
check('add: Spur-Konfiguration mit Port und Auswahl, Berichtspfad bleibt Pfad', laneCfg.commands.evalUpTo === 'PORT=4610 npm run eval --silent -- --select F0,F4' && laneCfg.commands.report === 'eval/report.json' && !laneCfg.commands.thaw);
r = L('add', 'F2', '--port', '4620', '--select', 'F0,F2', '--writable', 'src/totals.mjs'); check('add: zweite Spur', r.exit === 0);
r = L('sync', 'F4'); contract('sync', r); check('sync: aktuell', r.exit === 0 && r.data.upToDate);
writeFileSync(join(R, '.lanes/F4/src/categories.mjs'), 'export const categoryOf = () => "Sonstiges";\n');
run('werkstatt.mjs', ['commit', '--root', join(R, '.lanes/F4')], 'feat(F4): Kategorien');
// a test run in main created a NEW logbook (untracked) – once this blocked every merge
appendFileSync(join(R, 'eval/history.jsonl'), '{"t":"main"}\n'); appendFileSync(join(R, 'neues-logbuch.jsonl'), '{"t":"neu"}\n');
appendFileSync(join(R, '.lanes/F4/neues-logbuch.jsonl'), '{"t":"spur"}\n'); run('werkstatt.mjs', ['commit', '--root', join(R, '.lanes/F4')], 'chore: Logbuch der Spur');
r = L('merge', 'F4'); contract('merge', r); check('merge: trotz neuer und geänderter Logbücher zusammengeführt', r.exit === 0 && r.data.merged, r.raw);
check('merge: Logbücher vereinigt', readFileSync(join(R, 'neues-logbuch.jsonl'), 'utf8').includes('"neu"') && readFileSync(join(R, 'neues-logbuch.jsonl'), 'utf8').includes('"spur"'));
appendFileSync(join(R, 'progress.jsonl'), '{"t":"tor"}\n');
r = L('undo', 'F4'); contract('undo', r); check('undo: Merge zurückgenommen, Tor-Zeile bleibt', r.exit === 0 && r.data.undone && readFileSync(join(R, 'progress.jsonl'), 'utf8').includes('"tor"') && !git('log -1 --format=%s').startsWith('merge(F4)'));
r = L('merge', 'F4'); check('merge: erneut möglich', r.exit === 0 && r.data.merged, r.raw);
// conflict: F2's lane and main both change the same file differently
writeFileSync(join(R, '.lanes/F2/src/render.mjs'), 'export const render = () => "spur";\n'); run('werkstatt.mjs', ['commit', '--root', join(R, '.lanes/F2')], 'feat(F2): anders');
writeFileSync(join(R, 'src/render.mjs'), 'export const render = () => "haupt";\n'); run('werkstatt.mjs', ['commit', '--root', R], 'feat(F9): Hauptstand ändert dieselbe Datei');
r = L('sync', 'F2'); contract('sync mit Konflikt', r); check('sync: Konflikt gemeldet, bleibt in der Spur', r.exit === 1 && r.data.conflicts.includes('src/render.mjs'));
r = run('werkstatt.mjs', ['commit', '--root', join(R, '.lanes/F2')], 'integrate'); check('commit in der Spur mit offenem Konflikt → verweigert', r.exit === 1);
writeFileSync(join(R, '.lanes/F2/src/render.mjs'), 'export const render = () => "beides";\n'); git('add -A', join(R, '.lanes/F2'));
r = run('werkstatt.mjs', ['commit', '--root', join(R, '.lanes/F2')], 'integrate(F2): beides'); check('commit nach Auflösung: Merge festgehalten', r.exit === 0 && r.data.committed, r.raw);
r = L('merge', 'F2'); check('merge nach Integration: ohne Konflikt', r.exit === 0 && r.data.merged, r.raw);
r = L('remove', 'F4'); contract('remove', r); L('remove', 'F2'); check('remove: Spuren weg', !existsSync(join(R, '.lanes/F4')) && !existsSync(join(R, '.lanes/F2')));
r = L('sync', 'F9'); contract('Fehler', r); check('unbekannte Spur → JSON-Fehler statt Absturz', r.exit === 1 && r.data.error);
r = W('status'); check('status: gebaut laut Commits', r.data.built.includes('F4') && r.data.built.includes('F2'));

console.log(`\n${passed} bestanden, ${failed} fehlgeschlagen`);
process.exit(failed ? 1 : 0);
