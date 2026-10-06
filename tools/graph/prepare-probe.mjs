// A fresh, sealed build folder for a graph run – from the workshop's practice project or from the Aristo M 64.
//   node tools/graph/prepare-probe.mjs einkaufsliste <target>
//   node tools/graph/prepare-probe.mjs aristo-stufe1 <target> [--app-port 4383]
//   node tools/graph/prepare-probe.mjs aristo <target> [--app-port 4383]
// Prints one JSON line: the folder, its ports, the feature range and the reference checks to pass to graph.js.
// Only reads the workshop (kit/fixtures, experience/prepare-run.mjs); writes nothing outside <target>.
import { execSync } from 'node:child_process';
import { existsSync, symlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';

const WS = resolve(new URL('../..', import.meta.url).pathname);
const [kind, target] = process.argv.slice(2);
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d; };
const out = (o, code = 0) => { console.log(JSON.stringify(o)); process.exit(code); };
if (!kind || !target) out({ error: 'usage: prepare-probe.mjs <einkaufsliste|aristo-stufe1|aristo> <target> [--app-port N]' }, 2);
const dir = resolve(target);
if (existsSync(dir)) out({ error: `${dir} existiert schon – einen neuen Ordner wählen` }, 1);

if (kind === 'einkaufsliste') {
  execSync(`node ${join(WS, 'kit/fixtures/prepare.mjs')} einkaufsliste ${dir}`, { stdio: 'ignore' });
  if (existsSync(join(WS, 'node_modules'))) symlinkSync(join(WS, 'node_modules'), join(dir, 'node_modules'));
  out({ dir, from: 'F1', to: 'F5', referenceIds: ['G-01'], appPort: null, judgePort: null });
}
if (kind === 'aristo' || kind === 'aristo-stufe1') {
  const appPort = Number(arg('--app-port', 4383));
  const { prepareRun, STAGE1 } = await import(join(WS, 'experience/prepare-run.mjs'));
  prepareRun({ dir, appPort, features: kind === 'aristo-stufe1' ? STAGE1 : undefined, message: `Graph-Lauf: Aristo M 64${kind === 'aristo-stufe1' ? ', Stufe 1' : ''}` });
  out({ dir, from: 'F1', to: kind === 'aristo-stufe1' ? 'F7' : 'F15', referenceIds: ['G-01', 'G-02'], appPort, judgePort: appPort + 1 });
}
out({ error: `unbekanntes Projekt ${kind}` }, 2);
