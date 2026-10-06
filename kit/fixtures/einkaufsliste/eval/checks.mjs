// One check per requirement ID. FROZEN (sealed). Each check throws on failure, returns 'pending' when it cannot run yet.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const mod = async (name) => import(`${join(ROOT, 'src', name)}?v=${process.hrtime.bigint()}`);
const item = (name, qty = 1, unit = null) => ({ name, qty, unit });
const cli = () => {
  const r = spawnSync('node', ['src/cli.mjs', 'eval/sample.txt'], { cwd: ROOT, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`cli.mjs endet mit ${r.status}: ${(r.stderr || '').slice(0, 200)}`);
  return r.stdout.replace(/\s+$/, '');
};

export const checks = {
  'E-00': async () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
    assert.equal(pkg.type, 'module', 'package.json braucht "type": "module"');
    assert.ok(existsSync(join(ROOT, 'src')), 'Ordner src/ fehlt');
  },
  'P-01': async () => { const { parse } = await mod('parse.mjs'); assert.deepEqual(parse('Milch'), [item('Milch')]); },
  'P-02': async () => {
    const { parse } = await mod('parse.mjs');
    assert.deepEqual(parse('3 Äpfel'), [item('Äpfel', 3)]);
    assert.deepEqual(parse('2x Brot\n2 x Brot'), [item('Brot', 2), item('Brot', 2)]);
  },
  'P-03': async () => {
    const { parse } = await mod('parse.mjs');
    assert.deepEqual(parse('500 g Mehl\n2 kg Zucker\n250 ml Sahne\n1 l Saft'), [item('Mehl', 500, 'g'), item('Zucker', 2, 'kg'), item('Sahne', 250, 'ml'), item('Saft', 1, 'l')]);
  },
  'P-04': async () => {
    const { parse } = await mod('parse.mjs');
    assert.deepEqual(parse('\n# Kommentar\n   Butter  \n\nzwei Eier'), [item('Butter'), item('zwei Eier')]);
  },
  'S-01': async () => { const { totals } = await mod('totals.mjs'); assert.deepEqual(totals([item('Milch'), item('Brot'), item('milch')]), [item('Milch', 2), item('Brot')]); },
  'S-02': async () => { const { totals } = await mod('totals.mjs'); assert.deepEqual(totals([item('Mehl', 500, 'g'), item('Mehl', 1, 'kg')]), [item('Mehl', 1500, 'g')]); },
  'S-03': async () => {
    const { totals } = await mod('totals.mjs');
    assert.deepEqual(totals([item('Saft', 1, 'l'), item('Brot', 2), item('Brot', 500, 'g'), item('saft', 250, 'ml')]), [item('Saft', 1250, 'ml'), item('Brot', 2), item('Brot', 500, 'g')]);
  },
  'R-01': async () => { const { render } = await mod('render.mjs'); assert.equal(render([item('Brot', 2)]), '     2 Brot'); },
  'R-02': async () => { const { render } = await mod('render.mjs'); assert.equal(render([item('Mehl', 1500, 'g'), item('Milch')]), '  1500 g Mehl\n     1 Milch'); },
  'R-03': async () => { const { render } = await mod('render.mjs'); assert.equal(render([]), '(leer)'); },
  'G-01': async () => {
    const ref = join(ROOT, 'reference/render.txt');
    if (!existsSync(ref)) return 'pending';
    assert.equal(cli(), readFileSync(ref, 'utf8').replace(/\s+$/, ''), 'Ausgabe weicht von der eingefrorenen Referenz ab');
  },
  'K-01': async () => { const { categoryOf } = await mod('categories.mjs'); assert.equal(categoryOf('Äpfel'), 'Obst & Gemüse'); assert.equal(categoryOf('Gurke'), 'Obst & Gemüse'); },
  'K-02': async () => {
    const { categoryOf } = await mod('categories.mjs');
    assert.equal(categoryOf('Milch'), 'Milchprodukte'); assert.equal(categoryOf('Butter'), 'Milchprodukte');
    assert.equal(categoryOf('Brötchen'), 'Backwaren'); assert.equal(categoryOf('Mehl'), 'Backwaren');
  },
  'K-03': async () => {
    const { categoryOf } = await mod('categories.mjs');
    assert.equal(categoryOf('Zahnpasta'), 'Sonstiges'); assert.equal(categoryOf('BANANE'), 'Obst & Gemüse'); assert.equal(categoryOf('Bio-Joghurt'), 'Milchprodukte');
  },
  'R-04': async () => {
    const { render } = await mod('render.mjs');
    assert.equal(render([item('Brot', 2), item('Äpfel', 3), item('Milch')], { grouped: true }), '## Obst & Gemüse\n     3 Äpfel\n\n## Milchprodukte\n     1 Milch\n\n## Backwaren\n     2 Brot');
  },
  'R-05': async () => {
    const { render } = await mod('render.mjs');
    assert.equal(render([item('Zahnpasta'), item('Käse')], { grouped: true }), '## Milchprodukte\n     1 Käse\n\n## Sonstiges\n     1 Zahnpasta');
  },
};
