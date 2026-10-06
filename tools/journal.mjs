// Reads the workflow journals of this project: which agent is running, what it is doing, what it returned.
// Shared by tools/dashboard.mjs and experience/server.mjs.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

// Claude Code keeps one folder per project; sessions in a git worktree of this repo get their own folder (<project>--claude-worktrees-…)
const PROJECTS = join(homedir(), '.claude/projects');
const PROJECT = new URL('..', import.meta.url).pathname.replace(/\/$/, '').replace(/[/.]/g, '-');
const projectDirs = () => { try { return readdirSync(PROJECTS).filter((d) => d === PROJECT || d.startsWith(`${PROJECT}--`)).map((d) => join(PROJECTS, d)); } catch { return []; } };

export const readLines = (path, n = 100000) => {
  try { return readFileSync(path, 'utf8').trim().split('\n').filter(Boolean).slice(-n).map((l) => JSON.parse(l)); }
  catch { return []; }
};

/** does this workflow run work in `root`? Its agents' prompts name their working directory; other sessions' runs
 *  (e.g. a rehearsal in another folder) are not part of this build */
const rootCache = new Map();
function worksIn(dir, root) {
  const key = `${dir}|${root}`;
  if (rootCache.has(key)) return rootCache.get(key);
  let yes = false;
  try {
    for (const f of readdirSync(dir).filter((x) => /^agent-.*\.jsonl$/.test(x)).slice(0, 3)) {
      if (readFileSync(join(dir, f), 'utf8').slice(0, 20000).includes(root)) { yes = true; break; }
    }
  } catch { /* unreadable: not ours */ }
  if (yes || readdirSync(dir).some((x) => /^agent-.*\.jsonl$/.test(x))) rootCache.set(key, yes); // decide once agents exist
  return yes;
}

/** all journals last touched in [sinceMs, untilMs), oldest first; with `root` only the runs working there */
function journals(sinceMs = 0, untilMs = Infinity, root = '') {
  const out = [];
  try {
    for (const session of projectDirs().flatMap((p) => readdirSync(p).map((s) => join(p, s)))) {
      const wfDir = join(session, 'subagents/workflows');
      if (!existsSync(wfDir)) continue;
      for (const run of readdirSync(wfDir)) {
        const j = join(wfDir, run, 'journal.jsonl');
        if (!existsSync(j)) continue;
        const m = statSync(j).mtimeMs;
        if (m >= sinceMs && m < untilMs && (!root || worksIn(join(wfDir, run), root))) out.push({ j, m, run, dir: join(wfDir, run) });
      }
    }
  } catch { /* no journals yet */ }
  return out.sort((a, b) => a.m - b.m);
}

/** newest journal, optionally only journals last touched in [sinceMs, untilMs) */
export function latestJournal(sinceMs = 0, untilMs = Infinity, root = '') {
  return journals(sinceMs, untilMs, root).pop() || null;
}

/** what the refactorer did, round by round, across all journals of a build (oldest first) */
export function refactorRounds({ sinceMs = 0, untilMs = Infinity, root = '' } = {}) {
  const rounds = [];
  for (const jn of journals(sinceMs, untilMs, root)) {
    const labels = {};
    for (const l of readLines(jn.j)) {
      if (l.type === 'started') labels[l.key] = l.label;
      const label = labels[l.key] || '';
      if (l.type === 'result' && /^refactor /.test(label) && l.result && 'stopReason' in l.result) {
        const r = l.result;
        rounds.push({ label: label.replace(/^refactor /, ''), steps: (r.steps || []).map((x) => ({ rule: x.rule, what: x.what })), stopReason: r.stopReason, summary: r.summary });
      }
    }
  }
  return rounds;
}

/** last tool calls of a running agent, from its transcript */
function trailOf(dir, agentId, root) {
  const f = join(dir, `agent-${agentId}.jsonl`);
  if (!existsSync(f)) return { trail: [], lastActivity: null };
  const tail = readLines(f, 400);
  const trail = [];
  for (const l of tail) {
    const c = l.message && Array.isArray(l.message.content) ? l.message.content : [];
    for (const x of c) {
      if (l.type === 'assistant' && x.type === 'tool_use') {
        const i = x.input || {};
        const what = i.command || i.file_path || i.pattern || i.description || JSON.stringify(i).slice(0, 80);
        trail.push({ t: l.timestamp, tool: x.name, what: String(what).split(root).join('').slice(0, 160), desc: i.description || '' });
      }
      if (l.type === 'assistant' && x.type === 'text' && x.text.trim()) trail.push({ t: l.timestamp, tool: 'denkt', what: x.text.trim().slice(0, 160) });
    }
  }
  return { trail: trail.slice(-6), lastActivity: tail.length ? tail[tail.length - 1].timestamp : null };
}

/** what an agent returned, in a few fields the pages can show */
export function classify(r) {
  if (r && r.perCriterion) return { kind: 'judge', score: r.perCriterion.reduce((a, p) => a + p.score, 0), max: r.perCriterion.length * 2, criteria: r.perCriterion, mustFix: r.mustFix };
  if (r && 'idsPassed' in r) return { kind: 'test', pass: r.pass && r.lockOk && !(r.integrityIssues || []).length, ids: `${r.idsPassed}/${r.idsTotal}`, failedIds: r.failedIds };
  if (r && 'stopReason' in r) return { kind: 'refactor', steps: r.steps.length, stopReason: r.stopReason, summary: r.summary };
  if (r && 'committed' in r) return { kind: 'commit', hash: r.hash, shortstat: r.shortstat };
  if (r && r.units && r.features) return { kind: 'plan', units: r.units.length };
  if (r && r.summary) return { kind: 'build', summary: r.summary, disputes: r.evalDispute };
  if (r === null) return { kind: 'aborted' };
  return { kind: 'other' };
}

/** start and end of an agent, from its transcript */
function spanOf(dir, agentId) {
  const lines = readLines(join(dir, `agent-${agentId}.jsonl`)).filter((l) => l.timestamp);
  return lines.length ? { start: lines[0].timestamp, end: lines[lines.length - 1].timestamp } : null;
}

/** every agent of a build (all journals last touched in [sinceMs, untilMs]), with label, timing and outcome, oldest first */
export function agentRuns({ sinceMs = 0, untilMs = Infinity, root = '' } = {}) {
  const runs = [];
  const seen = new Set();
  for (const jn of journals(sinceMs, untilMs, root)) {
    const byKey = {};
    for (const l of readLines(jn.j)) {
      if (l.type === 'started') byKey[l.key] = { label: l.label, phase: l.phase, agentId: l.agentId };
      if (l.type === 'result' && byKey[l.key]) {
        const a = byKey[l.key];
        if (!a.agentId || seen.has(a.agentId)) continue; // a resumed run replays cached agents
        const span = spanOf(jn.dir, a.agentId);
        if (!span) continue;
        seen.add(a.agentId);
        const c = classify(l.result);
        delete c.criteria; delete c.summary;
        runs.push({ label: a.label, phase: a.phase, ...span, ...c });
      }
    }
  }
  return runs.sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
}

/** all agent events of the newest journal (since `sinceMs`), newest last */
export function workflowState({ sinceMs = 0, untilMs = Infinity, root = '' } = {}) {
  const jn = latestJournal(sinceMs, untilMs, root);
  if (!jn) return null;
  const byKey = {};
  const events = [];
  let done = null;
  for (const l of readLines(jn.j)) {
    if (l.type === 'started') { byKey[l.key] = { label: l.label, phase: l.phase, agentId: l.agentId, running: true, t: l.ts || null }; events.push(byKey[l.key]); }
    if (l.type === 'result' && byKey[l.key]) Object.assign(byKey[l.key], { running: false }, classify(l.result));
    if (l.type === 'done' || l.type === 'completed') done = l;
  }
  for (const e of events.filter((x) => x.running && x.agentId)) Object.assign(e, trailOf(jn.dir, e.agentId, root));
  return { run: jn.run, updated: jn.m, events, done: !!done };
}
