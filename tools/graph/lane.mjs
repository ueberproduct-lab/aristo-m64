// Graph workshop – parallel lanes: one local git clone per feature with its own ports, its own test selection and a
// write scope limited to the units the feature touches. Deterministic, so no agent has to improvise git.
//   node tools/graph/lane.mjs add F9 --port 4310 --select F0,F3,F9 --writable src/sound.js,src/sound.css [--root <project>]
//   node tools/graph/lane.mjs sync F9      bring the lane up to the current main state (exit 1 with the conflicting files, left for the integrator)
//   node tools/graph/lane.mjs merge F9     merge lane/F9 into the current branch (exit 1 with the conflicting files)
//   node tools/graph/lane.mjs undo F9      take back the last merge of F9 when the gate after it is red (logbook lines of the gate stay)
//   node tools/graph/lane.mjs remove F9    remove the lane and its branch
//   node tools/graph/lane.mjs list
// --root (required): the project the lanes belong to. The tool always runs from the workshop, never as a copy inside a build.
// --env (add): how a lane's commands get their port, e.g. "PORT={port}" (default).
// The lane gets its own loop.config.json (commands pinned to its ports and selection, writable = its units); that file is
// marked skip-worktree so it never travels back with a merge. Append-only logs (*.jsonl) merge as a union.
// Clones, not `git worktree`: a session that itself runs in a worktree may not write into other worktrees (isolation hook),
// while an ordinary repository next to it is fine. Merging fetches the lane branch back.
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, appendFileSync, symlinkSync, realpathSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

const [cmd, feature] = process.argv.slice(2);
const arg = (k) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : null; };
const ROOT = arg('--root') ? resolve(arg('--root')) : null; // required: the project whose lanes these are
const sh = (c, cwd = ROOT) => execSync(c, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const tryRun = (c, cwd = ROOT) => { try { return { ok: true, out: sh(c, cwd) }; } catch (e) { return { ok: false, out: String(e.stdout || '') + String(e.stderr || '') }; } };
const laneDir = (f) => join(ROOT, '.lanes', f);
// one JSON line per command, with a checksum over its content (_sum) so the workflow notices a mistyped relay
const checksum = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) >>> 0; return h.toString(16); };
const emit = (o) => console.log(JSON.stringify({ ...o, _sum: checksum(JSON.stringify(o)) }));
const branch = (f) => `lane/${f}`;

/** once per project: lanes are ignored, append-only logs merge as a union */
function prepareRepo() {
  let changed = false;
  const ensureLine = (file, line) => {
    const p = join(ROOT, file);
    const text = existsSync(p) ? readFileSync(p, 'utf8') : '';
    if (!text.split('\n').includes(line)) { appendFileSync(p, `${text && !text.endsWith('\n') ? '\n' : ''}${line}\n`); changed = true; }
  };
  ensureLine('.gitignore', '.lanes/');
  ensureLine('.gitattributes', '*.jsonl merge=union');
  if (changed) sh('git add .gitignore .gitattributes && git commit -q -m "chore: parallele Spuren vorbereiten" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"');
}

function add(f) {
  const port = Number(arg('--port'));
  if (!f || !port) throw new Error('usage: lane.mjs add <feature> --port <n> [--select F0,F3] [--writable a,b]');
  prepareRepo();
  if (existsSync(laneDir(f))) remove(f);
  sh(`git clone -q --no-tags ${ROOT} ${laneDir(f)}`);
  sh(`git checkout -q -b ${branch(f)}`, laneDir(f));
  if (existsSync(join(ROOT, 'node_modules')) && !existsSync(join(laneDir(f), 'node_modules'))) symlinkSync(realpathSync(join(ROOT, 'node_modules')), join(laneDir(f), 'node_modules'));

  // the lane's own connection: same project, but its ports, its tests and its files
  const config = JSON.parse(readFileSync(join(ROOT, 'loop.config.json'), 'utf8'));
  const env = String(arg('--env') || 'PORT={port}').split('{port}').join(String(port));
  const select = arg('--select');
  // commands get the lane's port; plain paths (report files) stay paths. Same rule as laneConfig() in graph.js
  const pin = (c) => (typeof c === 'string' && /\s/.test(c) && !c.includes('<') ? `${env} ${c.split('{judgePort}').join(String(port + 1))}` : c);
  const commands = Object.fromEntries(Object.entries(config.commands || {}).map(([k, v]) => [k, pin(v)]));
  delete commands.refactorReport; // written once for the whole build, not per lane
  delete commands.thaw; // the graph never moves reference files: reference checks are expected red instead
  if (select && config.commands.evalSelect) {
    // inside a lane, "everything up to here" means: the feature and what it can affect, never unbuilt features
    commands.evalUpTo = commands.evalAll = pin(config.commands.evalSelect.split('{features}').join(select));
  }
  const writable = arg('--writable') ? arg('--writable').split(',').filter(Boolean) : config.writable;
  const note = `Parallele Spur für ${f}: Dein App-Port ist ${port}, dein Foto-Port ${port + 1}. Starte Server nur mit diesem Port und beende nur deinen eigenen (per PID). `
    + `Deine Prüfung ist die Auswahl ${select || '(wie im Hauptprojekt)'}. Ändere nur: ${writable.join(', ')}. `
    + `Brauchst du eine andere Datei, baue nicht darum herum, sondern melde es in evalDispute mit id "PLAN" und Begründung.`;
  const lane = { ...config, commands, writable, guidance: { ...(config.guidance || {}), builder: `${note}\n${(config.guidance || {}).builder || ''}`.trim() }, lane: { feature: f, port, judgePort: port + 1, select } };
  writeFileSync(join(laneDir(f), 'loop.config.json'), JSON.stringify(lane, null, 2) + '\n');
  sh('git update-index --skip-worktree loop.config.json', laneDir(f));
  emit({ feature: f, dir: laneDir(f), branch: branch(f), port, judgePort: port + 1, select, writable });
}

/** files the lane changed outside its write scope (mechanical check, not just the agent's discipline) */
function outOfScope(f) {
  const cfgPath = join(laneDir(f), 'loop.config.json');
  if (!existsSync(cfgPath)) return [];
  const writable = JSON.parse(readFileSync(cfgPath, 'utf8')).writable || [];
  const changed = tryRun(`git diff --name-only HEAD...${branch(f)}`).out.split('\n').filter(Boolean);
  const isLog = (p) => /\.jsonl$/.test(p) || /^eval\/(golden|history)/.test(p) || p === 'REFACTOR-REPORT.md';
  return changed.filter((p) => !isLog(p) && !writable.some((w) => p === w || (w.endsWith('/') && p.startsWith(w))));
}

const CO = '-m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"';
/** test runs append to logbooks (*.jsonl); commit them, otherwise git refuses to merge. Returns other uncommitted files. */
function commitLogs(cwd) {
  // changed AND new files: a logbook a test run just created (untracked) would otherwise block the merge
  const list = (c) => tryRun(c, cwd).out.split('\n').filter(Boolean);
  const dirty = [...new Set([...list('git diff --name-only HEAD'), ...list('git ls-files --others --exclude-standard')])];
  const logs = dirty.filter((p) => /\.jsonl$/.test(p));
  if (logs.length) sh(`git add -- ${logs.join(' ')} && git commit -q -m "chore: Logbücher" ${CO}`, cwd);
  return dirty.filter((p) => !/\.jsonl$/.test(p));
}
const conflictsIn = (cwd) => tryRun('git diff --name-only --diff-filter=U', cwd).out.split('\n').filter(Boolean);

/** merge queue, step 1: the lane takes in everything merged since it started. Conflicts stay in the lane for the integrator. */
function sync(f) {
  const dir = laneDir(f);
  if (!existsSync(dir)) throw new Error(`keine Spur ${f}`);
  if (conflictsIn(dir).length) { emit({ feature: f, synced: false, conflicts: conflictsIn(dir), hint: 'Spur steckt noch in einer Zusammenführung' }); process.exit(1); }
  const other = commitLogs(dir);
  if (other.length) sh(`git add -A && git commit -q -m "chore(${f}): Reste der Spur festgehalten" ${CO}`, dir);
  const main = sh('git rev-parse --abbrev-ref HEAD');
  sh(`git fetch -q origin ${main}`, dir);
  const behind = Number(sh(`git rev-list --count HEAD..origin/${main}`, dir));
  if (!behind) { emit({ feature: f, synced: true, upToDate: true }); return; }
  const r = tryRun(`git merge --no-ff origin/${main} -m "sync(${f}): Hauptstand übernommen" ${CO}`, dir);
  if (r.ok) { emit({ feature: f, synced: true, upToDate: false, took: behind, head: sh('git rev-parse --short HEAD', dir) }); return; }
  const conflicts = conflictsIn(dir);
  emit({ feature: f, synced: false, took: behind, conflicts, hint: conflicts.length ? 'Konflikte in der Spur: Integrator löst sie dort' : r.out.slice(0, 400) });
  process.exit(1);
}

/** merge queue, back-off: the gate after merge(F) is red → main returns to its state before, the lane fixes and comes again */
function undo(f) {
  const subject = sh('git log -1 --format=%s');
  if (!subject.startsWith(`merge(${f}):`)) { emit({ feature: f, undone: false, hint: `HEAD ist nicht der Merge von ${f}: ${subject}` }); process.exit(1); }
  // the gate wrote logbook lines after the merge: keep exactly those, drop what the merge brought (it comes back with the next merge)
  const dirty = tryRun('git diff --name-only HEAD').out.split('\n').filter(Boolean);
  const other = dirty.filter((p) => !/\.jsonl$/.test(p));
  if (other.length) { emit({ feature: f, undone: false, dirty: other, hint: 'Ungespeicherte Änderungen im Hauptstrang' }); process.exit(1); }
  const added = Object.fromEntries(dirty.map((p) => {
    const before = new Set(tryRun(`git show HEAD:${p}`).out.split('\n'));
    return [p, readFileSync(join(ROOT, p), 'utf8').split('\n').filter((l) => l && !before.has(l))];
  }));
  if (dirty.length) sh(`git checkout -- ${dirty.join(' ')}`);
  sh('git reset -q --keep HEAD~1');
  for (const [p, lines] of Object.entries(added)) if (lines.length) appendFileSync(join(ROOT, p), lines.join('\n') + '\n');
  emit({ feature: f, undone: true, head: sh('git rev-parse --short HEAD'), keptLogLines: Object.values(added).flat().length });
}

function merge(f) {
  const other = commitLogs(ROOT);
  if (other.length) { emit({ feature: f, merged: false, dirty: other, hint: 'Ungespeicherte Änderungen im Hauptstrang, erst festhalten oder verwerfen' }); process.exit(1); }
  sh(`git fetch -q ${laneDir(f)} ${branch(f)}:${branch(f)}`);
  const outside = outOfScope(f);
  const r = tryRun(`git merge --no-ff ${branch(f)} -m "merge(${f}): Spur zusammengeführt" ${CO}`);
  if (r.ok) { emit({ feature: f, merged: true, head: sh('git rev-parse --short HEAD'), outOfScope: outside }); return; }
  const conflicts = conflictsIn(ROOT);
  emit({ feature: f, merged: false, outOfScope: outside, conflicts, hint: conflicts.length ? 'Konflikte auflösen, dann git add + git commit' : r.out.slice(0, 400) });
  process.exit(1);
}

function remove(f) {
  rmSync(laneDir(f), { recursive: true, force: true });
  tryRun(`git branch -D ${branch(f)}`);
}

try {
  if (!ROOT) { emit({ error: '--root fehlt (Projektordner)' }); process.exit(2); }
  if (cmd === 'add') add(feature);
  else if (cmd === 'sync') sync(feature);
  else if (cmd === 'merge') merge(feature);
  else if (cmd === 'undo') undo(feature);
  else if (cmd === 'remove') { remove(feature); emit({ feature, removed: true }); }
  else if (cmd === 'list') emit({ lanes: sh('git branch --list "lane/*"').split('\n').map((l) => l.trim()).filter(Boolean) });
  else { emit({ error: 'usage: lane.mjs add|sync|merge|undo|remove|list <feature> … [--root <projekt>]' }); process.exit(2); }
} catch (e) {
  // never a stack trace instead of an answer: the workflow reads exactly one JSON line
  emit({ feature, error: String((e && (e.stderr || e.message)) || e).trim().slice(0, 400) });
  process.exit(1);
}
