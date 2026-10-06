// Prepares and steers one live build of the Aristo M 64 for the web experience, in one of four building styles.
//   node experience/run.mjs ready              → workshop is open: the page may request a build (phase ready)
//   node experience/run.mjs init <variant>     → new folder demo-runs/<variant>-<stamp>/ (spec, sealed eval, empty src, own git repo)
//   node experience/run.mjs stage2             → loop/graph: unlock F8–F15, relock the eval, commit
//   node experience/run.mjs phase <p>          → ready | start-requested | stage1 | stage2-spec | stage2 | building | assessing | done | failed
//   node experience/run.mjs models '<json>'    → model per role ({} = like the session)
//   node experience/run.mjs scope stage1|both  → only the rough calculator (F1–F7) or both stages (default)
//   node experience/run.mjs status
// variant: oneshot | direct | loop | graph. One live build at a time: app on 4273, photos on 4274, parallel lanes from 4310.
// The finished calculator in src/ (port 4173) is never touched.
import { cpSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ROOT, sh, commit, stamp, prepareRun, STAGE1 } from './prepare-run.mjs';

const STATE = join(ROOT, 'experience/state.json');
const APP_PORT = 4273;
const JUDGE_PORT = 4274;
const VARIANTS = {
  oneshot: { name: 'Vibe-Coding One Shot', staged: false },
  direct: { name: 'Direktbau', staged: false },
  loop: { name: 'Agentic Loop Engineering', staged: true },
  graph: { name: 'Agentic Loop Engineering, Graph', staged: true },
};

const readState = () => (existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : {});
const writeState = (patch) => {
  const s = { ...readState(), ...patch, updatedAt: new Date().toISOString() };
  writeFileSync(STATE, JSON.stringify(s, null, 2) + '\n');
  return s;
};

function init(variant) {
  if (!VARIANTS[variant]) throw new Error(`variant: ${Object.keys(VARIANTS).join(' | ')}`);
  const prev = readState();
  const scope = prev.scope || 'both';
  // the loops grow in two stages (stage 2 unlocks F8–F15 later); single passes get the whole chosen scope at once
  const features = VARIANTS[variant].staged || scope === 'stage1' ? STAGE1 : undefined;
  const dir = prepareRun({ dir: join(ROOT, 'demo-runs', `${variant}-${stamp()}`), appPort: APP_PORT, features,
    message: `${VARIANTS[variant].name}: Briefing, Spec, versiegeltes Eval${features ? ' (F0–F7)' : ''}, leeres Gerüst` });
  const s = writeState({ models: prev.models || {}, scope, variant, phase: 'building', requested: null, runDir: dir, run: relative(ROOT, dir),
    appPort: APP_PORT, judgePort: JUDGE_PORT, stage: 1, createdAt: new Date().toISOString(), startedAt: new Date().toISOString(),
    stage1StartedAt: null, stage2StartedAt: null, finishedAt: null });
  console.log(JSON.stringify(s, null, 2));
}

function stage2() {
  const s = readState();
  if (!s.runDir) throw new Error('no run: node experience/run.mjs init <variant>');
  cpSync(join(ROOT, 'eval/features.json'), join(s.runDir, 'eval/features.json'));
  sh('node eval/lock.mjs --write', s.runDir);
  commit(s.runDir, 'Spec Stufe 2: verfeinerte Spezifikation (F8–F15)');
  console.log(JSON.stringify(writeState({ phase: 'stage2-spec', stage: 2 }), null, 2));
}

const [cmd, arg] = process.argv.slice(2);
if (cmd === 'ready') console.log(JSON.stringify(writeState({ phase: 'ready', requested: null }), null, 2));
else if (cmd === 'init') init(arg);
else if (cmd === 'stage2') stage2();
else if (cmd === 'phase') {
  const patch = { phase: arg };
  // set once: a resumed stage keeps its start, so durations stay true
  const st = readState();
  if (arg === 'stage1' && !st.stage1StartedAt) patch.stage1StartedAt = new Date().toISOString();
  if (arg === 'stage2' && !st.stage2StartedAt) patch.stage2StartedAt = new Date().toISOString();
  if (arg === 'done') patch.finishedAt = new Date().toISOString();
  console.log(JSON.stringify(writeState(patch), null, 2));
} else if (cmd === 'models') console.log(JSON.stringify(writeState({ models: JSON.parse(arg || '{}') }), null, 2));
else if (cmd === 'scope') {
  if (!['stage1', 'both'].includes(arg)) { console.error('scope: stage1 | both'); process.exit(2); }
  console.log(JSON.stringify(writeState({ scope: arg }), null, 2));
} else if (cmd === 'status') console.log(JSON.stringify(readState(), null, 2));
else { console.error('usage: run.mjs ready | init <oneshot|direct|loop|graph> | stage2 | phase <name> | models <json> | scope stage1|both | status'); process.exit(2); }
