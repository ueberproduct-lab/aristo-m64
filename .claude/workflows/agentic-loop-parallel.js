export const meta = {
  name: 'agentic-loop-parallel',
  description: 'Paralleler Agentic-Loop: Architekt schneidet Einheiten, Features laufen in Wellen gleichzeitig in eigenen Spuren, geprüft wird nur, was betroffen ist; an jedem Tor alles',
  whenToUse: 'Alternative zu agentic-loop für jedes Projekt mit loop.config.json (+ commands.evalSelect, parallel). args: {root, config, coreScript?, from?, to?, built?, models?, maxIter?, refactorEvery?, maxLanes?, integration?: queue|independent, mergeRounds?, plan?, judgePort?, skipFinalJudge?, knownRed?}',
  phases: [
    { title: 'Architektur', detail: 'Einheiten, Verträge, Abhängigkeiten – vom Architekten vorgeschlagen, mechanisch geprüft' },
    { title: 'Gerüst', detail: 'Dateien der Einheiten anlegen, falls nötig umziehen' },
    { title: 'Wellen', detail: 'je Welle: Spuren parallel (der normale Kern je Feature) → Merge-Queue: Integrator, zusammenführen, Tor' },
    { title: 'Abnahme', detail: 'alles bis zum letzten Feature + Gutachter, Aufräum-Bericht' },
  ],
}

// Die parallele Werkstatt ist eine Hülle um den sequenziellen Kern (agentic-loop.js): Jede Spur ist ein ganz normaler Lauf für genau
// ein Feature, in einer eigenen Arbeitskopie (lokaler Klon), mit eigenen Ports, eigener Prüfauswahl und nur den Dateien ihrer
// Einheiten (tools/lane.mjs). Neu ist nur, was Parallelität braucht:
//   ARCHITEKTUR  loop-architect schlägt Einheiten + Zuordnung vor → der Takt prüft den Plan mechanisch (keine Überschneidung,
//                kreisfrei, vollständig) → ungültig: einmal zurück an den Architekten, sonst sequenziell weiter
//   WELLEN       bereit = alle Abhängigkeiten gebaut, die dringendsten zuerst, bis MAX_LANES; `serial` allein. Einheiten dürfen sich
//                überschneiden (integration 'queue', Standard) – oder nicht (integration 'independent')
//   PRÜFEN       in der Spur: das Feature + bereits gebaute Features, die dieselben Einheiten berühren + Rauch-Set
//   MERGE-QUEUE  Spur für Spur: Hauptstand in die Spur holen → Konflikte und Integrationsfehler löst der Integrator IN der Spur →
//                zusammenführen → Tor (ALLES Gebaute) → rot: zurücknehmen, noch eine Runde in der Spur. Der Hauptstand bleibt grün.

const A = args || {}
const ROOT = A.root
if (!ROOT) throw new Error('args.root fehlt')
const CFG = A.config
if (!CFG || !CFG.features) throw new Error('args.config fehlt: Inhalt von loop.config.json')
const C = CFG.commands || {}
if (!C.evalSelect) throw new Error('commands.evalSelect fehlt: parallel braucht eine Prüfauswahl nach Features ({features})')
const PAR = CFG.parallel || {}
const MODELS = A.models || {}
const opts = (role, agentType) => ({ ...(MODELS[role] ? { model: MODELS[role] } : {}), ...(agentType ? { agentType } : {}) })
// the sequential core that every lane runs (default: next to this project's other workflows)
const CORE_PATH = A.coreScript || `${ROOT}/.claude/workflows/agentic-loop.js`
const MAX_LANES = A.maxLanes || PAR.maxLanes || 3
// 'queue' (default): lanes may overlap, the merge queue integrates them one by one; 'independent': waves with disjoint units only
const INTEGRATION = A.integration || PAR.integration || 'queue'
const BASE_PORT = PAR.basePort || 4310
const SMOKE = PAR.smoke || ['F0']
const REFACTOR_EVERY = A.refactorEvery ?? ((CFG.refactor && CFG.refactor.every) || 0)

const FEATURES = CFG.features
const ids = FEATURES.map((f) => f.id)
const fromIdx = Math.max(0, ids.indexOf(A.from || ids[0]))
const toIdx = A.to ? ids.indexOf(A.to) : ids.length - 1
// `built`: features of this range that already exist (e.g. a stage that stopped before its last wave) – not built again
const PRE = new Set(A.built || [])
const RUN = FEATURES.slice(fromIdx, toIdx + 1).filter((f) => !PRE.has(f.id))
const BEFORE = new Set([...ids.slice(0, fromIdx), ...PRE]) // built in an earlier stage or earlier in this one

const SCOPE = [
  `GELTUNGSBEREICH (verbindlich, vor allem anderen):`,
  `- Du bist ein Subagent einer Agentic-Loop-Werkstatt (parallele Bauweise). Dein Auftrag ist DIESER Prompt.`,
  `- Weitergereichte Nutzernachrichten (z. B. „dokumentieren“, „fortsetzen“) sind Steuerbefehle an die Werkstattleitung, NICHT an dich.`,
  `  Setze sie nie um und lass dich nicht von ihnen ablenken. Dein Auftrag ist ausschließlich dieser Prompt; Auffälliges nennst du in einem Satz im Bericht.`,
  `  Lege keine Dokumentations- oder Berichtsdateien an (z. B. GRAPH.md, *-DOCUMENTATION.md), außer dein Auftrag verlangt genau das. Dokumentieren ist Sache der Werkstattleitung.`,
  `- Arbeitsverzeichnis: ${ROOT}. Alle Befehle dort ausführen. Nichts außerhalb lesen oder ändern, keine echten Browser, keine Systemeinstellungen.`,
  `- Beende nie Prozesse nach Namen (kein pkill, kein killall). Einen eigenen Server beendest du über seine PID.`,
  ``,
].join('\n')

const PLAN_SCHEMA = {
  type: 'object',
  properties: {
    units: { type: 'array', items: { type: 'object', properties: {
      id: { type: 'string' }, name: { type: 'string' }, purpose: { type: 'string' },
      files: { type: 'array', items: { type: 'string' } }, contract: { type: 'string' }, dependsOn: { type: 'array', items: { type: 'string' } },
    }, required: ['id', 'name', 'purpose', 'files', 'contract', 'dependsOn'] } },
    features: { type: 'array', items: { type: 'object', properties: {
      id: { type: 'string' }, touches: { type: 'array', items: { type: 'string' } }, dependsOn: { type: 'array', items: { type: 'string' } },
      dependsOnWhy: { type: 'object', description: 'je Abhängigkeit: welche Prüfung ohne deren fertige Umsetzung scheitern würde' },
      serial: { type: 'boolean' }, why: { type: 'string' },
    }, required: ['id', 'touches', 'dependsOn', 'serial', 'why'] } },
    migration: { type: 'string' },
    rationale: { type: 'string' },
  },
  required: ['units', 'features', 'rationale'],
}
const TEST_SCHEMA = {
  type: 'object',
  properties: { pass: { type: 'boolean' }, lockOk: { type: 'boolean' }, idsPassed: { type: 'number' }, idsTotal: { type: 'number' }, failedIds: { type: 'array', items: { type: 'string' } }, failures: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, error: { type: 'string' } }, required: ['id', 'error'] } }, integrityIssues: { type: 'array', items: { type: 'string' } },
    reportSummary: { type: 'object' }, reportScope: { type: 'string' } },
  required: ['pass', 'lockOk', 'idsPassed', 'idsTotal', 'failedIds', 'failures', 'integrityIssues', 'reportSummary', 'reportScope'],
}
const LANES_SCHEMA = { type: 'object', properties: { results: { type: 'array', items: { type: 'object', properties: { feature: { type: 'string' }, ok: { type: 'boolean' }, json: { type: 'string' } }, required: ['feature', 'ok'] } } }, required: ['results'] }
const DONE_SCHEMA = { type: 'object', properties: { ok: { type: 'boolean' }, note: { type: 'string' } }, required: ['ok'] }

// ---- the plan is checked by code, not by trust ----
const covers = (a, b) => a === b || (a.endsWith('/') && b.startsWith(a)) || (b.endsWith('/') && a.startsWith(b))
function validatePlan(plan) {
  const errors = []
  const unitIds = new Set(plan.units.map((u) => u.id))
  if (unitIds.size !== plan.units.length) errors.push('Einheiten-IDs sind nicht eindeutig')
  const owned = []
  for (const u of plan.units) {
    if (!u.files.length) errors.push(`Einheit ${u.id} hat keine Dateien`)
    for (const file of u.files) {
      const other = owned.find((o) => covers(o.file, file))
      if (other) errors.push(`Datei ${file} gehört zu ${other.unit} und ${u.id}`)
      if ((CFG.writable || []).length && !(CFG.writable || []).some((w) => covers(w, file))) errors.push(`Datei ${file} (${u.id}) liegt außerhalb von writable`)
      owned.push({ file, unit: u.id })
    }
    for (const d of u.dependsOn) if (!unitIds.has(d)) errors.push(`Einheit ${u.id} hängt von unbekannter Einheit ${d} ab`)
  }
  const byId = Object.fromEntries(plan.features.map((f) => [f.id, f]))
  for (const f of RUN) {
    const p = byId[f.id]
    if (!p) { errors.push(`Feature ${f.id} fehlt im Plan`); continue }
    if (!p.touches.length) errors.push(`Feature ${f.id} berührt keine Einheit`)
    for (const t of p.touches) if (!unitIds.has(t)) errors.push(`Feature ${f.id} berührt unbekannte Einheit ${t}`)
    for (const d of p.dependsOn) {
      if (!ids.includes(d)) errors.push(`Feature ${f.id} hängt von unbekanntem Feature ${d} ab`)
      else if (ids.indexOf(d) > toIdx) errors.push(`Feature ${f.id} hängt von ${d} ab, das in diesem Lauf nicht gebaut wird`)
      if (d === f.id) errors.push(`Feature ${f.id} hängt von sich selbst ab`)
    }
  }
  // cycles among the features of this run
  const state = {}
  const visit = (id, path) => {
    if (state[id] === 'done' || !byId[id] || BEFORE.has(id)) return
    if (state[id] === 'open') { errors.push(`Abhängigkeits-Kreis: ${[...path, id].join(' → ')}`); return }
    state[id] = 'open'
    for (const d of byId[id].dependsOn) visit(d, [...path, id])
    state[id] = 'done'
  }
  RUN.forEach((f) => visit(f.id, []))
  return errors
}

/** waves: ready = all dependencies built, most urgent first (how many features wait on it, then spec order).
 *  An urgent serial feature (global change, frozen reference) runs alone; otherwise the wave takes every ready feature up to
 *  MAX_LANES. With the merge queue (default) features may share units – the integrator resolves the overlap. With
 *  integration 'independent' a wave only takes features whose units are still free (no conflicts by construction). */
function planWaves(plan) {
  const byId = Object.fromEntries(plan.features.map((f) => [f.id, f]))
  const isSerial = (id) => byId[id].serial || !!RUN.find((f) => f.id === id).golden || !!RUN.find((f) => f.id === id).thaw
  const waiting = (id, seen = new Set()) => {
    for (const p of plan.features) if (p.dependsOn.includes(id) && !seen.has(p.id)) { seen.add(p.id); waiting(p.id, seen) }
    return seen.size
  }
  const urgency = Object.fromEntries(RUN.map((f) => [f.id, waiting(f.id)]))
  const built = new Set(BEFORE)
  const remaining = RUN.map((f) => f.id)
  const waves = []
  while (remaining.length) {
    const ready = remaining.filter((id) => byId[id].dependsOn.every((d) => built.has(d)))
      .sort((a, b) => urgency[b] - urgency[a] || ids.indexOf(a) - ids.indexOf(b))
    if (!ready.length) throw new Error(`keine Welle möglich, offen: ${remaining.join(', ')}`)
    let wave = []
    if (isSerial(ready[0])) wave = [ready[0]]
    else {
      const used = new Set()
      for (const id of ready) {
        if (isSerial(id) || wave.length >= MAX_LANES || (INTEGRATION === 'independent' && byId[id].touches.some((t) => used.has(t)))) continue
        wave.push(id)
        byId[id].touches.forEach((t) => used.add(t))
      }
    }
    wave.forEach((id) => { built.add(id); remaining.splice(remaining.indexOf(id), 1) })
    waves.push(wave)
  }
  return waves
}

// ---- ARCHITEKTUR ----
phase('Architektur')
let plan = A.plan && A.plan.units ? A.plan : null
let errors = plan ? validatePlan(plan) : ['kein Plan']
for (let attempt = 1; errors.length && attempt <= 2; attempt++) {
  plan = await agent([
    SCOPE,
    `Rolle: loop-architect. Schneide „${CFG.project}“ in Einheiten und ordne ALLE Features aus loop.config.json zu (nicht nur ${RUN.map((f) => f.id).join(', ')}).`,
    `Beschreibbar sind: ${(CFG.writable || []).join(', ')}. Quellordner: ${CFG.sourceDir || 'src'}. Bis zu ${MAX_LANES} Handwerker arbeiten gleichzeitig.`,
    plan && attempt > 1 ? `\nDein letzter Plan war ungültig. Behebe genau diese Fehler:\n- ${errors.join('\n- ')}` : '',
  ].filter(Boolean).join('\n'), { label: `architektur #${attempt}`, phase: 'Architektur', schema: PLAN_SCHEMA, ...opts(MODELS.architect ? 'architect' : 'builder', 'loop-architect') })
  errors = plan ? validatePlan(plan) : ['Architekt hat keinen Plan geliefert']
  log(errors.length ? `Plan #${attempt} ungültig: ${errors.join(' · ')}` : `Plan: ${plan.units.length} Einheiten (${plan.units.map((u) => u.id).join(', ')})`)
}
if (errors.length) {
  // conservative: without a valid plan the sequential loop builds the same features
  log(`⚑ kein gültiger Plan – baue sequenziell weiter`)
  const seq = await workflow({ scriptPath: CORE_PATH }, { ...A, plan: undefined })
  return { ...seq, mode: 'sequential-fallback', planErrors: errors }
}
let WAVES = planWaves(plan)
log(`Wellen: ${WAVES.map((w, i) => `${i + 1}:[${w.join(' ')}]`).join(' ')}`)
// a plan that is almost a chain gets one critical second look: every dependency must name the check that would fail without it
if (!A.plan && RUN.length >= 4 && WAVES.length > 0.7 * RUN.length) {
  const deps = plan.features.filter((f) => RUN.some((r) => r.id === f.id) && f.dependsOn.length)
    .map((f) => `- ${f.id} ← ${f.dependsOn.join(', ')}${f.dependsOnWhy ? ` (${Object.entries(f.dependsOnWhy).map(([k, v]) => `${k}: ${v}`).join('; ')})` : ''}`).join('\n')
  const second = await agent([
    SCOPE,
    `Rolle: loop-architect. Dein Plan für „${CFG.project}“ ergibt ${WAVES.length} Wellen für ${RUN.length} Features, fast eine Kette. Prüfe jede`,
    `Abhängigkeit einzeln: Welche Prüfung würde scheitern, wenn das andere Feature nur als Hülle mit seinem Vertrag existiert? Wo keine,`,
    `streiche sie. Wo eine Einheit zu viel bündelt, teile sie. Behalte alles, was wirklich nötig ist. Deine Abhängigkeiten:`, deps,
    `Gib den vollständigen, überarbeiteten Plan zurück (gleiches Format, alle Features).`,
  ].join('\n'), { label: 'architektur #2', phase: 'Architektur', schema: PLAN_SCHEMA, ...opts(MODELS.architect ? 'architect' : 'builder', 'loop-architect') })
  const errs2 = second ? validatePlan(second) : ['keine Antwort']
  const waves2 = errs2.length ? null : planWaves(second)
  log(errs2.length ? `Zweiter Plan ungültig (${errs2.join(' · ')}), es bleibt bei ${WAVES.length} Wellen` : `Zweiter Plan: ${waves2.length} Wellen ${waves2.length < WAVES.length ? '→ übernommen' : '→ nicht besser, erster bleibt'}`)
  if (waves2 && waves2.length < WAVES.length) { plan = second; WAVES = waves2 }
  log(`Wellen: ${WAVES.map((w, i) => `${i + 1}:[${w.join(' ')}]`).join(' ')}`)
}

// ---- GERÜST: unit files exist (idempotent), plan is recorded ----
phase('Gerüst')
const unitsOf = (fid) => plan.features.find((f) => f.id === fid).touches
const filesOf = (fid) => plan.units.filter((u) => unitsOf(fid).includes(u.id)).flatMap((u) => u.files)
// the plan is a record for humans, the page, the integrator and stage 2. An agent writes it, so the copy is checked
// mechanically: the file must parse and carry the same checksum as the plan in memory (agents mistype long JSON)
const checksum = (str) => { let h = 5381; for (let i = 0; i < str.length; i++) h = (h * 33 + str.charCodeAt(i)) >>> 0; return h.toString(16) }
const PLAN_TEXT = JSON.stringify({ ...plan, waves: WAVES })
const VERIFY = `node -e "const s=require('fs').readFileSync('${ROOT}/loop.plan.json','utf8').trim();JSON.parse(s);let h=5381;for(let i=0;i<s.length;i++)h=(h*33+s.charCodeAt(i))>>>0;console.log(h.toString(16))"`
let planOk = false
for (let attempt = 1; attempt <= 3 && !planOk; attempt++) {
  const r = await agent([SCOPE, `Du bist der Werkstatt-Gehilfe. Schreibe den Plan Zeichen für Zeichen unverändert nach ${ROOT}/loop.plan.json. Jeder Backslash bleibt, wie er ist.`,
    `cat > ${ROOT}/loop.plan.json <<'PLAN_EOF'`, PLAN_TEXT, `PLAN_EOF`,
    `Dann prüfe: \`${VERIFY}\` und gib die ausgegebene Zeile (oder die Fehlermeldung) als note zurück. Ändere sonst nichts, committe nicht.`].join('\n'),
    { label: `plan festhalten${attempt > 1 ? ` #${attempt}` : ''}`, phase: 'Gerüst', schema: DONE_SCHEMA, effort: 'low', ...opts(attempt > 1 ? 'builder' : 'helper') })
  planOk = !!r && String(r.note || '').trim() === checksum(PLAN_TEXT)
  if (!planOk) log(`⚑ Plan-Datei weicht ab (${r ? String(r.note || '').slice(0, 120) : 'keine Antwort'}) – noch einmal`)
}
if (!planOk) log(`⚑ Plan-Datei nach 3 Versuchen nicht exakt – der Bau läuft weiter, Plan im Ergebnis dieses Laufs`)
const scaffold = await agent([
  SCOPE,
  `Rolle: loop-builder. Lege das Gerüst für den parallelen Bau an. Der Plan steht in loop.plan.json (verbindlich).`,
  `1. Lege jede Datei der Einheiten an, die noch nicht existiert: als Hülle, die ihren Vertrag minimal erfüllt (so wie im Plan beschrieben, z. B. Standardwert anzeigen, "0" liefern) und vom Rahmen eingebunden ist. Keine Feature-Logik. Bestehende Dateien NICHT überschreiben.`,
  plan.migration ? `2. Vorhandener Code passt nicht zum Schnitt: ${plan.migration} – verschiebe verhaltenserhaltend.` : '',
  `3. Prüfe: \`${C.lockCheck}\` und \`${C.evalSelect.split('{features}').join([...SMOKE, ...BEFORE].join(','))}\` müssen grün sein.`,
  `4. \`git add -A && git commit -q -m "arch: Einheiten und Plan" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"\`.`,
].filter(Boolean).join('\n'), { label: 'gerüst', phase: 'Gerüst', schema: DONE_SCHEMA, ...opts('builder', 'loop-builder') })
if (!scaffold || !scaffold.ok) log(`⚑ Gerüst unvollständig: ${scaffold ? scaffold.note : 'keine Antwort'}`)

// ---- WELLEN ----
const built = new Set(BEFORE)
const openPoints = []
let knownRed = A.knownRed || []
const waveLog = []
const selectFor = (fid) => {
  const mine = unitsOf(fid)
  const near = [...built].filter((g) => plan.features.find((p) => p.id === g)?.touches.some((t) => mine.includes(t)))
  const deps = plan.features.find((p) => p.id === fid).dependsOn
  return [...new Set([...SMOKE, ...near, ...deps, fid])].sort((a, b) => ids.indexOf(a) - ids.indexOf(b))
}
// the lane's own connection – the same object tools/lane.mjs writes into the lane for the agents to read. It is handed to the
// core directly: an agent must never copy it (13 KB of JSON once came back broken five times and stopped a lane).
function laneConfig(l) {
  const env = String(PAR.env || 'PORT={port}').split('{port}').join(String(l.port))
  // commands get the lane's port; plain paths (report files) stay paths
  const pin = (c) => (typeof c === 'string' && /\s/.test(c) && !c.includes('<') ? `${env} ${c.split('{judgePort}').join(String(l.port + 1))}` : c)
  const commands = Object.fromEntries(Object.entries(C).map(([k, v]) => [k, pin(v)]))
  delete commands.refactorReport // written once for the whole build, not per lane
  if (featureOf(l.fid).thaw) delete commands.thaw // lane.mjs add --thaw already did it, mechanically
  commands.evalUpTo = commands.evalAll = pin(C.evalSelect.split('{features}').join(l.select.join(',')))
  const note = `Parallele Spur für ${l.fid}: Dein App-Port ist ${l.port}, dein Foto-Port ${l.port + 1}. Starte Server nur mit diesem Port und beende nur deinen eigenen (per PID). `
    + `Deine Prüfung ist die Auswahl ${l.select.join(',')}. Ändere nur: ${l.writable.join(', ')}. `
    + `Brauchst du eine andere Datei, baue nicht darum herum, sondern melde es in evalDispute mit id "PLAN" und Begründung.`
  const G = CFG.guidance || {}
  return { ...CFG, commands, writable: l.writable, guidance: { ...G, builder: `${note}\n${G.builder || ''}`.trim() }, lane: { feature: l.fid, port: l.port, judgePort: l.port + 1, select: l.select.join(',') } }
}

// ---- MERGE-QUEUE ----
// QUEUE-HELPERS-START
const sorted = (xs) => [...new Set(xs)].sort((a, b) => ids.indexOf(a) - ids.indexOf(b))
const evalFor = (features) => C.evalSelect.split('{features}').join(sorted([...SMOKE, ...features]).join(','))
const laneEnv = (port) => String(PAR.env || 'PORT={port}').split('{port}').join(String(port))
const MERGE_ROUNDS = A.mergeRounds || PAR.mergeRounds || 3
const INTEGRATE_SCHEMA = { type: 'object', properties: { ok: { type: 'boolean' }, resolved: { type: 'array', items: { type: 'string' } }, how: { type: 'array', items: { type: 'string' } }, test: { type: 'string' }, dispute: { type: 'array', items: { type: 'object' } }, note: { type: 'string' } }, required: ['ok', 'resolved', 'test', 'dispute'] }
// the gate believes the report, not the tester: claims must match the summary copied from it
const consistent = (t) => !!t && t.reportSummary && t.reportSummary.ids === t.idsTotal && t.reportSummary.passed === t.idsPassed && (t.reportSummary.failed === 0) === !!t.pass
const red = (t) => (!t ? ['kein Bericht'] : !consistent(t) ? ['Bericht widerspricht dem Prüfer'] : t.failedIds.filter((id) => !knownRed.includes(id)))
const helper = (cmd, label) => agent(`${SCOPE}Du bist der Werkstatt-Gehilfe. Führe genau diesen Befehl aus, sonst nichts, und gib ok (Exit-Code 0) und die JSON-Zeile der Ausgabe als note zurück: \`cd ${ROOT} && ${cmd}\`. Löse nichts selbst.`,
  { label, phase: 'Wellen', schema: DONE_SCHEMA, effort: 'low', ...opts('helper') })
const gateTest = (features, label) => agent(`${SCOPE}Rolle: loop-tester. Siegel: \`${C.lockCheck}\`. Prüfung: \`${evalFor(features)}\` (alles bisher Gebaute). Bericht: ${C.report}. Kopiere summary und scope daraus wörtlich nach reportSummary und reportScope.`,
  { label, phase: 'Wellen', schema: TEST_SCHEMA, effort: 'low', ...opts('tester', 'loop-tester') })
const featureOf = (fid) => FEATURES.find((f) => f.id === fid)
// the integrator role; a session started before .claude/agents/loop-integrator.md existed does not know the type yet:
// then a builder takes the role from the file itself
const INTEGRATOR_FILE = CORE_PATH.replace(/workflows\/[^/]+$/, 'agents/loop-integrator.md')
const integratorAgent = async (prompt, label) => {
  const o = { label, phase: 'Wellen', schema: INTEGRATE_SCHEMA, ...opts(MODELS.integrator ? 'integrator' : 'builder') }
  try { return await agent(prompt, { ...o, agentType: 'loop-integrator' }) } catch (e) {
    if (!/not found/.test(String(e && e.message))) throw e
    log(`(Rolle loop-integrator in dieser Session unbekannt – ein Handwerker übernimmt sie aus ${INTEGRATOR_FILE})`)
    return agent(`Lies zuerst ${INTEGRATOR_FILE} vollständig: Das ist deine Rolle für diesen Auftrag, sie hat Vorrang vor deiner Handwerker-Rolle.\n${prompt}`, { ...o, agentType: 'loop-builder' })
  }
}

/** one lane through the queue: sync → (integrator) → merge → gate → (undo, again). Returns {merged, gate, tampered}. */
async function integrate(l, waveNo) {
  const target = [...built, l.fid]
  const laneRoot = `${ROOT}/.lanes/${l.fid}`
  const arrived = [...built].filter((f) => !l.builtAtStart.includes(f))
  const f = featureOf(l.fid)
  let trouble = null // red ids from the last gate, to be fixed in the lane
  let gate = null
  for (let round = 1; round <= MERGE_ROUNDS; round++) {
    const tag = round > 1 ? ` #${round}` : ''
    const s = await helper(`node tools/lane.mjs sync ${l.fid}`, `sync ${l.fid}${tag}`)
    const note = (s && s.note) || ''
    const conflicts = ((note.match(/"conflicts":\[([^\]]*)\]/) || [])[1] || '').replace(/"/g, '').split(',').filter(Boolean)
    if (!s || (!s.ok && !conflicts.length)) {
      openPoints.push({ kind: 'merge', feature: l.fid, detail: `Spur ließ sich nicht auf den Hauptstand bringen: ${note.slice(0, 300) || 'keine Antwort'}` })
      log(`⚑ ${l.fid}: Spur nicht synchronisierbar – nicht zusammengeführt`)
      return { merged: false }
    }
    if (conflicts.length || trouble) {
      log(conflicts.length ? `⇄ ${l.fid}: Konflikte mit ${arrived.join(', ') || 'dem Hauptstand'} in ${conflicts.join(', ')} – Integrator` : `⇄ ${l.fid}: Tor war rot (${trouble.ids.join(', ')}) – Integrator in der Spur`)
      const fix = await integratorAgent([
        SCOPE.split(ROOT).join(laneRoot),
        `Rolle: loop-integrator. Spur: ${laneRoot} (eigenes Git-Repository, Branch lane/${l.fid}). Arbeite nur dort, nie im Hauptstrang.`,
        `Feature der Spur: ${l.fid} ${f.title || ''} – ${f.focus || ''}`,
        `Seit die Spur begann, kamen in den Hauptstand: ${arrived.length ? arrived.map((a) => `${a} (${featureOf(a).title || ''})`).join(', ') : 'nichts Neues'}. Der Plan mit Einheiten und Verträgen: loop.plan.json.`,
        conflicts.length ? `Lage: Die Spur hat den Hauptstand übernommen, dabei gab es Konflikte in: ${conflicts.join(', ')} (siehe \`git status\`). Löse sie so, dass alle Features erhalten bleiben, und schließe die Zusammenführung mit einem Commit ab.` : '',
        trouble ? `Lage: Nach dem Zusammenführen war die Prüfung im Hauptstand rot. Der Hauptstand ist zurückgesetzt, die Spur enthält ihn schon. Rot waren:\n${JSON.stringify(trouble.failures, null, 1)}` : '',
        `Für die Integration darfst du alle Dateien aus ${(CFG.writable || []).join(', ')} ändern (die loop.config.json der Spur nennt nur die Einheiten des Features). Niemals: ${(CFG.frozen || []).join(', ') || 'Prüfungen, Spec'}.`,
        `Integrationsprüfung (muss grün sein): \`cd ${laneRoot} && ${laneEnv(l.port)} ${evalFor(target)}\`. Bericht: ${C.report} in der Spur. Siegel: \`${C.lockCheck}\`.`,
        `Committe in der Spur mit \`git commit -q -m "integrate(${l.fid}): …" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"\` (bei einer offenen Zusammenführung genügt \`git commit -q --no-edit\`).`,
      ].filter(Boolean).join('\n'), `integrator ${l.fid}${tag}`)
      if (fix && fix.dispute && fix.dispute.length) openPoints.push({ kind: 'dispute', feature: l.fid, detail: fix.dispute })
      if (!fix || !fix.ok) {
        log(`⚑ ${l.fid}: Integration nicht gelungen (${fix ? fix.note || fix.test : 'keine Antwort'})`)
        if (round === MERGE_ROUNDS) { openPoints.push({ kind: 'merge', feature: l.fid, detail: fix ? fix.note || fix.test : 'Integrator ohne Antwort' }); return { merged: false } }
        continue
      }
      log(`✓ ${l.fid}: integriert (${fix.test})${fix.resolved.length ? ` – ${fix.resolved.join(', ')}` : ''}${fix.note ? ` · Hinweis: ${fix.note.slice(0, 240)}` : ''}`)
    }
    const m = await helper(`node tools/lane.mjs merge ${l.fid}`, `merge ${l.fid}${tag}`)
    if (m && /outOfScope":\["/.test(m.note || '')) log(`⚠ ${l.fid} hat Dateien außerhalb seiner Einheiten geändert: ${(m.note.match(/outOfScope":\[([^\]]*)\]/) || [])[1]}`)
    if (!m || !m.ok) {
      // the lane contains main, so this is not a content conflict; most likely main had uncommitted changes
      openPoints.push({ kind: 'merge', feature: l.fid, detail: `Zusammenführen abgelehnt: ${((m && m.note) || 'keine Antwort').slice(0, 300)}` })
      log(`⚑ ${l.fid}: Zusammenführen abgelehnt – nicht zusammengeführt`)
      return { merged: false }
    }
    gate = await gateTest(target, `test tor ${waveNo} ${l.fid}${tag}`)
    if (gate && !gate.lockOk) return { merged: true, gate, tampered: true }
    // nothing green at all (not even the smoke test): the test bench is broken, not the integration – stop loudly
    if (gate && gate.idsTotal > 0 && gate.idsPassed === 0) return { merged: true, gate, broken: true }
    const r = red(gate)
    if (!r.length) return { merged: true, gate }
    if (round === MERGE_ROUNDS) break
    const u = await helper(`node tools/lane.mjs undo ${l.fid}`, `undo ${l.fid}${tag}`)
    if (!u || !u.ok) { log(`⚑ ${l.fid}: Zurücknehmen fehlgeschlagen (${u ? u.note : 'keine Antwort'}) – bleibt zusammengeführt`); break }
    log(`↩ ${l.fid}: Tor rot (${r.join(', ')}), zurückgenommen – noch einmal in die Spur`)
    trouble = { ids: r, failures: gate ? gate.failures.filter((x) => !knownRed.includes(x.id)).slice(0, 20) : [{ id: '?', error: 'kein Prüfbericht' }] }
  }
  // conservative: after the last round the merge stays, its red ids become known and are healed later
  const r = red(gate)
  openPoints.push({ kind: 'gate', feature: l.fid, ids: r })
  knownRed = [...new Set([...knownRed, ...r.filter((id) => !/\s/.test(id))])] // test ids only, not 'kein Bericht'
  log(`⚑ ${l.fid}: nach ${MERGE_ROUNDS} Runden noch rot (${r.join(', ')}) – zusammengeführt als offener Punkt`)
  return { merged: true, gate }
}
// QUEUE-HELPERS-END

for (let w = 0; w < WAVES.length; w++) {
  const wave = WAVES[w]
  phase('Wellen')
  log(`▶ Welle ${w + 1}/${WAVES.length}: ${wave.join(', ')}`)
  const lanes = wave.map((fid, slot) => ({ fid, port: BASE_PORT + slot * 10, select: selectFor(fid), writable: filesOf(fid), builtAtStart: [...built] }))

  const setup = await agent([
    SCOPE,
    `Du bist der Werkstatt-Gehilfe. Führe genau diese Befehle aus, sonst nichts (je Befehl die JSON-Zeile merken):`,
    ...lanes.map((l) => `cd ${ROOT} && node tools/lane.mjs add ${l.fid} --port ${l.port} --select ${l.select.join(',')} --writable ${l.writable.join(',')}${featureOf(l.fid).thaw ? ' --thaw' : ''}`),
    `Ändere sonst nichts. Gib je Feature ok und die JSON-Zeile zurück.`,
  ].join('\n'), { label: `spuren welle ${w + 1}`, phase: 'Wellen', schema: LANES_SCHEMA, effort: 'low', ...opts('helper') })
  if (!setup) return { status: 'aborted', at: `Welle ${w + 1}`, openPoints, waves: waveLog }

  // every lane is the normal loop for one feature, in its own worktree. A lane that cannot even start (e.g. the core script is not
  // reachable from this session) is an infrastructure failure: stop loudly instead of merging nothing.
  const results = await parallel(lanes.map((l) => async () => {
    try {
      return await workflow({ scriptPath: CORE_PATH }, {
        root: `${ROOT}/.lanes/${l.fid}`, config: laneConfig(l), from: l.fid, to: l.fid, models: MODELS, maxIter: A.maxIter, judgePort: l.port + 1,
        refactorEvery: REFACTOR_EVERY && (ids.indexOf(l.fid) + 1) % REFACTOR_EVERY === 0 ? 1 : 0,
        noAcceptance: true, knownRed, keepGoing: true,
      })
    } catch (e) { return { status: 'lane-error', error: String(e && e.message ? e.message : e) } }
  }))
  const broken = results.map((r, i) => ({ r, l: lanes[i] })).filter(({ r }) => !r || r.status === 'lane-error' || r.status === 'config-missing' || r.status === 'aborted')
  if (broken.length) {
    log(`⛔ Spur(en) nicht gelaufen: ${broken.map(({ r, l }) => `${l.fid} (${r ? r.error || r.status : 'keine Antwort'})`).join('; ')}`)
    return { status: 'lane-failed', wave: w + 1, lanes: broken.map(({ r, l }) => ({ feature: l.fid, error: r ? r.error || r.status : 'keine Antwort' })), coreScript: CORE_PATH, openPoints, waves: waveLog }
  }
  results.forEach((r, i) => {
    if (r && r.openPoints) openPoints.push(...r.openPoints.map((o) => ({ ...o, lane: lanes[i].fid })))
    if (r && r.knownRed) knownRed = [...new Set([...knownRed, ...r.knownRed])]
  })

  // merge queue: one lane after the other. The lane first takes in the current main state; conflicts and red tests are
  // resolved IN the lane by the integrator. Only then it is merged, and the gate checks everything built. A red gate takes
  // the merge back and sends the lane round again. Main is never left red on purpose, only after the last round (open point).
  phase('Wellen')
  // QUEUE-START
  let lastGate = null
  for (const l of lanes) {
    const q = await integrate(l, w + 1)
    if (q.tampered) return { status: 'eval-tampered', at: `Tor ${w + 1} (${l.fid})`, openPoints, waves: waveLog }
    if (q.broken) {
      log(`⛔ Tor ${w + 1} (${l.fid}): nichts grün – die Prüfung selbst läuft nicht (${(q.gate.failures[0] || {}).error || '?'})`)
      return { status: 'gate-broken', at: `Tor ${w + 1} (${l.fid})`, detail: q.gate.failures.slice(0, 3), openPoints, waves: waveLog }
    }
    if (q.merged) built.add(l.fid)
    if (q.gate) lastGate = q.gate
  }
  // QUEUE-END
  await agent(`${SCOPE}Du bist der Werkstatt-Gehilfe. Führe genau diese Befehle aus, sonst nichts – keine Dateien anlegen, nichts dokumentieren: ${lanes.map((l) => `\`cd ${ROOT} && node tools/lane.mjs remove ${l.fid}\``).join(', ')}.`,
    { label: `spuren aufräumen ${w + 1}`, phase: 'Wellen', schema: DONE_SCHEMA, effort: 'low', ...opts('helper') })

  const gateRed = lastGate ? lastGate.failedIds : []
  waveLog.push({ wave: w + 1, features: wave, merged: wave.filter((f) => built.has(f)), gate: lastGate ? `${lastGate.idsPassed}/${lastGate.idsTotal}` : 'n/a', red: gateRed })
  log(`Tor ${w + 1}: ${lastGate ? `${lastGate.idsPassed}/${lastGate.idsTotal}` : 'n/a'}${gateRed.length ? ` · offen: ${gateRed.join(', ')}` : ' · grün'}`)
  if (openPoints.length > (A.maxOpenPoints ?? 3)) return { status: 'too-many-open-points', openPoints, knownRed, waves: waveLog }
}

// ---- ABNAHME: the normal acceptance of the core, then the refactor report for the whole build ----
phase('Abnahme')
const acc = await workflow({ scriptPath: CORE_PATH }, { root: ROOT, config: CFG, to: ids[toIdx], models: MODELS, judgePort: A.judgePort, skipFinalJudge: A.skipFinalJudge, knownRed, acceptOnly: true })
if (C.refactorReport) {
  await agent(`${SCOPE}Du bist der Werkstatt-Gehilfe. \`cd ${ROOT} && ${C.refactorReport} && git add -A && git commit -q -m "docs: Aufräum-Bericht" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"\`. Ändere sonst nichts.`,
    { label: 'report aufräumen', phase: 'Abnahme', schema: DONE_SCHEMA, effort: 'low', ...opts('helper') })
}
const status = acc && /^done/.test(acc.status) ? (openPoints.length || (acc.openPoints || []).length ? 'done-with-open-points' : 'done') : (acc ? acc.status : 'final-failed')
return { status, mode: 'parallel', plan: { ...plan, waves: WAVES }, planFileOk: planOk, waves: waveLog, openPoints, knownRed, finalTest: acc && acc.finalTest, finalJudge: acc && acc.finalJudge }
