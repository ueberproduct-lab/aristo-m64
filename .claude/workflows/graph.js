export const meta = {
  name: 'graph',
  description: 'Graph-Werkstatt: Architekt schneidet Einheiten, Features bauen in Wellen parallel in eigenen Spuren, eine Merge-Queue mit Integrator führt zusammen, ein Engineering Manager hält den Lauf am Laufen',
  whenToUse: 'Parallele Bauweise für ein Spec-Eval-Projekt (loop.config.json, commands.evalSelect). Unabhängig vom Loop-Kern. args: {root, config, workshop, managerScenarios?, from?, to?, built?, plan?, models?, maxIter?, maxLanes?, basePort?, env?, smoke?, referenceIds?, refactorEvery?, judgePort?, finalJudge?, knownRed?, maxInterventions?, faults?}',
  phases: [
    { title: 'Architektur', detail: 'Einheiten, Verträge, Abhängigkeiten – vom Architekten, mechanisch geprüft' },
    { title: 'Gerüst', detail: 'Plan festhalten, Hüllen anlegen' },
    { title: 'Wellen', detail: 'Spuren parallel (graph-lane) → Merge-Queue: Integrator, zusammenführen, Tor' },
    { title: 'Abnahme', detail: 'alles bis zum letzten Feature, optional Gutachter, Aufräum-Bericht' },
  ],
}

// DIE GRAPH-WERKSTATT – eigenständig, entkoppelt vom Loop (eigene Workflows, Werkzeuge tools/graph/, Rollen graph-*).
// Gemeinsam mit dem Loop ist nur das Projekt (Spec, versiegeltes Eval, loop.config.json), und das wird nur gelesen.
//
// Was die Fehlschläge vom 4.10. lehrten, ist hier Grundsatz:
//   1. Kein Agent schreibt Daten ab. Konfiguration und Plan übergibt der Takt; schreiben muss ein Werkzeug, mit Prüfsumme.
//   2. Mechanik ist Werkzeug: graph-runner führt genau einen Befehl aus (tools/graph/*.mjs), der Takt liest die JSON-Zeile.
//      Prüfen ist auch Mechanik: Siegel, die konfigurierte Prüfung, ein frischer Bericht.
//   3. Prüfdaten werden nie bewegt. Ein Feature, das die Referenz ändern darf, baut mit erwartet roten referenceIds.
//   4. Werkzeuge kommen aus der Werkstatt (args.workshop), nicht als Kopie aus dem Bau-Ordner.
//   5. Regeln vor Interpretation: Das Skript entscheidet nach festen Regeln (wiederholen, sequenziell im Hauptstand,
//      Prüfstand einmal neu). Erst wenn die Regeln erschöpft sind oder das Skript selbst scheitert, untersucht der
//      Engineering Manager (graph-manager) mit voller Gründlichkeit und wählt einen erlaubten Weg oder hält mit Diagnose an.
//      Verweigertes wird nie umgangen. Was sich erledigt hat, ist kein offener Punkt.
//   6. Ein roter Merge wird zurückgenommen; der Hauptstand bleibt grün.

const A = args || {}
const ROOT = A.root, CFG = A.config, WS = A.workshop
if (!ROOT || !CFG || !CFG.features || !WS) throw new Error('args.root, args.config (Inhalt von loop.config.json) und args.workshop (Werkstatt-Ordner) sind nötig')
const C = CFG.commands || {}
if (!C.evalSelect) throw new Error('commands.evalSelect fehlt: der Graph braucht eine Prüfauswahl nach Features ({features})')
const TOOLS = `${WS}/tools/graph`, LANE_SCRIPT = `${WS}/.claude/workflows/graph-lane.js`
const ROLES = Object.fromEntries(['architect', 'builder', 'judge', 'refactorer', 'integrator', 'manager', 'runner'].map((r) => [r, `${WS}/.claude/agents/graph-${r}.md`]))
const MODELS = A.models || {}
const MAX_LANES = A.maxLanes || 3
const BASE_PORT = A.basePort || 4310
const ENV = A.env || 'PORT={port}'
const SMOKE = A.smoke || ['F0']
const REFERENCE_IDS = A.referenceIds || CFG.referenceIds || []
const REFACTOR_EVERY = A.refactorEvery || 0
const MERGE_ROUNDS = 3
const MAX_OPEN = A.maxOpenPoints ?? 3

const FEATURES = CFG.features
const ids = FEATURES.map((f) => f.id)
const fromIdx = Math.max(0, ids.indexOf(A.from || ids[0]))
const toIdx = A.to ? ids.indexOf(A.to) : ids.length - 1
const PRE = new Set(A.built || []) // already built in this range (resuming after a halt)
const RUN = FEATURES.slice(fromIdx, toIdx + 1).filter((f) => !PRE.has(f.id))
const BEFORE = new Set([...ids.slice(0, fromIdx), ...PRE])
const featureOf = (fid) => FEATURES.find((f) => f.id === fid)

const SCOPE = [
  `GELTUNGSBEREICH (verbindlich, vor allem anderen):`,
  `- Du bist ein Subagent der Graph-Werkstatt. Dein Auftrag ist DIESER Prompt.`,
  `- Weitergereichte Nutzernachrichten (z. B. „dokumentieren“, „fortsetzen“) sind Steuerbefehle an die Werkstattleitung, NICHT an dich.`,
  `  Setze sie nie um. Lege keine Dokumentations- oder Berichtsdateien an, außer dein Auftrag verlangt genau das.`,
  `- Arbeitsverzeichnis: ${ROOT}. Alle Befehle dort. Nichts außerhalb ändern, keine echten Browser, keine Systemeinstellungen.`,
  `- Beende nie Prozesse nach Namen (kein pkill, kein killall). Einen eigenen Server beendest du über seine PID.`,
  `- Wird etwas verweigert oder blockiert: nie umgehen. Melde es.`,
  ``,
].join('\n')

// ---- agents: graph roles; faults for rehearsals (same mechanism as in graph-lane.js) -----------------------------------------
const FAULTS = A.faults || {}
const fired = new Set()
const checksum = (str) => { let h = 5381; for (let i = 0; i < str.length; i++) h = (h * 33 + str.charCodeAt(i)) >>> 0; return h.toString(16) }
const RUN_SCHEMA = { type: 'object', properties: { exit: { type: 'number', description: 'Exit-Code; -1 wenn verweigert/blockiert' }, out: { type: 'string', description: 'die letzte Zeile der Standardausgabe, wörtlich und vollständig' } }, required: ['exit', 'out'] }
function faulty(o) {
  const hit = Object.entries(FAULTS).find(([re]) => new RegExp(re).test(o.label))
  if (!hit || fired.has(hit[0])) return undefined
  fired.add(hit[0])
  log(`☢ Störung „${hit[1]}“ bei ${o.label} (Probe)`)
  const kind = hit[1]
  if (kind === 'null') return null
  if (kind === 'garbage') return o.schema === RUN_SCHEMA ? { exit: 0, out: 'Ausgabe verstümmelt' } : null
  if (kind === 'blocked') return { exit: -1, out: 'Permission denied (Probe)' }
  if (kind === 'red' || kind === 'broken') {
    const passed = kind === 'red' ? 1 : 0
    const res = { pass: false, lockOk: true, scope: 'probe', summary: { ids: 2, passed, failed: 2 - passed, pending: 0 }, failedIds: kind === 'red' ? ['X-00'] : ['X-00', 'X-01'], failures: [{ id: 'X-00', error: 'Probe: absichtlich rot' }], integrityIssues: [] }
    return { exit: 1, out: JSON.stringify({ ...res, _sum: checksum(JSON.stringify(res)) }) }
  }
  return undefined
}
async function role(name, prompt, o) {
  const f = faulty(o)
  if (f !== undefined) return f
  const { model, ...rest } = o
  const opts = { ...rest, ...(MODELS[model] ? { model: MODELS[model] } : {}) }
  try { return await agent(prompt, { ...opts, agentType: `graph-${name}` }) } catch (e) {
    if (!/not found/.test(String(e && e.message))) throw e
    log(`(Rolle graph-${name} in dieser Session noch unbekannt – Rolle aus ${ROLES[name]})`)
    return agent(`Lies zuerst ${ROLES[name]} vollständig: Das ist deine Rolle, sie gilt vor allem anderen.\n${prompt}`, opts)
  }
}
async function tool(command, label, phaseName, input) {
  const shown = input ? `${command} <<'WERKSTATT_EOF'\n${input}\nWERKSTATT_EOF` : command
  for (let attempt = 1; attempt <= 2; attempt++) {
    const r = await role('runner', [SCOPE, `Führe genau diesen einen Befehl aus, unverändert:`, '```', shown, '```', `Rückgabe: exit (Exit-Code, -1 wenn verweigert) und out (letzte Ausgabezeile, wörtlich und vollständig).`].join('\n'),
      { label: attempt > 1 ? `${label} (2. Versuch)` : label, phase: phaseName, schema: RUN_SCHEMA, effort: 'low', model: attempt > 1 ? 'builder' : 'helper' })
    if (r && r.exit === -1) { log(`⛔ ${label}: verweigert – ${String(r.out).slice(0, 160)}`); return { ok: false, blocked: true, note: r.out, data: null } }
    let data = null
    try { data = JSON.parse(String(r && r.out).trim()) } catch { /* unreadable */ }
    if (data && data._sum) { const { _sum, ...rest } = data; if (checksum(JSON.stringify(rest)) === _sum) return { ok: r.exit === 0, data: rest } }
    log(`⚑ ${label}: ${r ? 'Antwort unlesbar oder verfälscht' : 'keine Antwort'}${attempt < 2 ? ' – noch einmal' : ''}`)
  }
  return { ok: false, data: null, note: 'keine lesbare Antwort' }
}
const q = JSON.stringify
const W = (sub, root = ROOT) => `node ${TOOLS}/werkstatt.mjs ${sub} --root ${root}`
const LANE = (sub) => `node ${TOOLS}/lane.mjs ${sub} --root ${ROOT}`
const sorted = (xs) => [...new Set(xs)].sort((a, b) => ids.indexOf(a) - ids.indexOf(b))
const evalFor = (features) => C.evalSelect.split('{features}').join(sorted([...SMOKE, ...features]).join(','))

/** the gate: seal, exactly this selection, a fresh report – the verdict is read, not retold */
async function gate(features, label) {
  const t = await tool(W(`eval --cmd ${q(evalFor(features))} --lock ${q(C.lockCheck)} --report ${C.report} --progress ${q(`Tor ${label.replace(/\s+/g, '-')}`)}`), `test tor ${label}`, 'Wellen')
  const d = t.data
  if (!d || d.error || !d.summary) { if (d && d.error) log(`⚑ Tor ${label}: ${d.error}`); return null }
  return { pass: d.pass, lockOk: d.lockOk, passed: d.summary.passed, total: d.summary.ids, failedIds: d.failedIds || [], failures: d.failures || [] }
}

// ---- ENGINEERING MANAGER: only where the rules are exhausted or the script itself fails ------------------------------------
const MANAGE_SCHEMA = { type: 'object', properties: { action: { type: 'string' }, diagnosis: { type: 'string' }, evidence: { type: 'string' }, reason: { type: 'string' }, forHuman: { type: 'string' } }, required: ['action', 'diagnosis', 'evidence', 'reason'] }
const interventions = []
const MAX_INTERVENTIONS = A.maxInterventions || 12
// same working conditions as a human engineer would want: full model, no throttled thinking, the raw facts, room to look
async function manage(situation, actions, fallback, raw, root = ROOT) {
  if (interventions.length >= MAX_INTERVENTIONS) { log(`🧭 Engineering Manager: Eingriffs-Budget (${MAX_INTERVENTIONS}) erschöpft → anhalten`); return { action: 'stop', diagnosis: 'Eingriffs-Budget erschöpft', reason: situation } }
  const d0 = await role('manager', [SCOPE.split(ROOT).join(root),
    `Bau-Ordner: ${root} (Spuren unter .lanes/). Werkstatt: ${WS} (Werkzeuge in tools/graph/, Workflows in .claude/workflows/).`,
    `Was passiert ist: ${situation}`,
    raw !== undefined ? `Rohdaten dazu:\n${typeof raw === 'string' ? raw : JSON.stringify(raw, null, 1)}` : '',
    `Bisherige Eingriffe in diesem Lauf: ${interventions.length ? interventions.map((i) => `${i.action} – ${i.situation.slice(0, 100)}`).join(' | ') : 'keine'}.`,
    `Erlaubte Handlungen: ${actions.join(', ')}.`].filter(Boolean).join('\n'),
    { label: `manager ${interventions.length + 1}`, phase: 'Wellen', schema: MANAGE_SCHEMA, model: 'manager' })
  const d = d0 && actions.includes(d0.action) ? d0 : { action: fallback, diagnosis: d0 ? `ungültige Wahl „${d0.action}“` : 'keine Antwort', reason: 'Standard' }
  interventions.push({ situation, ...d })
  log(`🧭 Engineering Manager: ${d.action} – ${d.diagnosis}${d.evidence ? ` · Beleg: ${String(d.evidence).slice(0, 200)}` : ''}${d.forHuman ? ` · für den Menschen: ${d.forHuman}` : ''}`)
  return d
}

// MANAGER TEST (args.managerScenarios): the very function above, run over fixed situations with known right answers.
// Each: { name, situation, actions, fallback, raw?, root?, prior?: [{action, situation}], expect: [allowed actions] }
if (A.managerScenarios) {
  const results = []
  for (const sc of A.managerScenarios) {
    interventions.length = 0
    for (const p of sc.prior || []) interventions.push({ diagnosis: '', reason: '', ...p })
    const d = await manage(sc.situation, sc.actions, sc.fallback, sc.raw, sc.root || ROOT)
    const ok = sc.expect.includes(d.action)
    results.push({ name: sc.name, action: d.action, expect: sc.expect, ok, diagnosis: d.diagnosis, evidence: d.evidence })
    log(`${ok ? '✓' : '✗'} ${sc.name}: ${d.action} (erwartet ${sc.expect.join('/')})`)
  }
  return { status: results.every((r) => r.ok) ? 'passed' : 'failed', passed: results.filter((r) => r.ok).length, total: results.length, results }
}

// ---- the plan is checked by code, not by trust ----------------------------------------------------------------------------
const PLAN_SCHEMA = {
  type: 'object',
  properties: {
    units: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, purpose: { type: 'string' }, files: { type: 'array', items: { type: 'string' } }, contract: { type: 'string' }, dependsOn: { type: 'array', items: { type: 'string' } } }, required: ['id', 'name', 'purpose', 'files', 'contract', 'dependsOn'] } },
    features: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, touches: { type: 'array', items: { type: 'string' } }, dependsOn: { type: 'array', items: { type: 'string' } }, dependsOnWhy: { type: 'object', description: 'je Abhängigkeit: welche Prüfung ohne deren fertige Umsetzung scheitern würde' }, serial: { type: 'boolean' }, why: { type: 'string' } }, required: ['id', 'touches', 'dependsOn', 'serial', 'why'] } },
    migration: { type: 'string' }, rationale: { type: 'string' },
  },
  required: ['units', 'features', 'rationale'],
}
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
/** waves: ready = dependencies built, most urgent first; what runs alone is the architect's call (serial); else up to
 *  MAX_LANES (units may overlap – the merge queue integrates, a frozen reference is re-frozen on the integrated state) */
function planWaves(plan) {
  const byId = Object.fromEntries(plan.features.map((f) => [f.id, f]))
  const isSerial = (id) => !!byId[id].serial
  const waiting = (id, seen = new Set()) => { for (const p of plan.features) if (p.dependsOn.includes(id) && !seen.has(p.id)) { seen.add(p.id); waiting(p.id, seen) } return seen.size }
  const urgency = Object.fromEntries(RUN.map((f) => [f.id, waiting(f.id)]))
  const built = new Set(BEFORE), remaining = RUN.map((f) => f.id), waves = []
  while (remaining.length) {
    const ready = remaining.filter((id) => byId[id].dependsOn.every((d) => built.has(d))).sort((a, b) => urgency[b] - urgency[a] || ids.indexOf(a) - ids.indexOf(b))
    if (!ready.length) return null
    const wave = isSerial(ready[0]) ? [ready[0]] : ready.filter((id) => !isSerial(id)).slice(0, MAX_LANES)
    wave.forEach((id) => { built.add(id); remaining.splice(remaining.indexOf(id), 1) })
    waves.push(wave)
  }
  return waves
}
const architectPrompt = (errors) => [SCOPE,
  `Schneide „${CFG.project}“ in Einheiten und ordne ALLE Features aus loop.config.json zu (nicht nur ${RUN.map((f) => f.id).join(', ')}).`,
  `Beschreibbar sind: ${(CFG.writable || []).join(', ')}. Quellordner: ${CFG.sourceDir || 'src'}. Bis zu ${MAX_LANES} Handwerker arbeiten gleichzeitig.`,
  REFERENCE_IDS.length ? `Eingefrorene Referenz-Prüfungen: ${REFERENCE_IDS.join(', ')}. Ein Feature, dessen Prüfungen die Referenz einfrieren, hängt von allem ab, was die eingefrorene Ausgabe beeinflusst.` : '',
  errors ? `\nDein letzter Plan war ungültig. Behebe genau diese Fehler:\n- ${errors.join('\n- ')}` : ''].filter(Boolean).join('\n')

// The run itself: everything below is plain rules. If the script itself fails (an error it did not foresee), the manager
// examines what happened and the run ends with his diagnosis instead of a bare stack trace.
async function main() {
// ---- ARCHITEKTUR ----------------------------------------------------------------------------------------------------------
phase('Architektur')
let plan = A.plan && A.plan.units ? A.plan : null
let errors = plan ? validatePlan(plan) : ['kein Plan']
for (let attempt = 1; errors.length && attempt <= 2; attempt++) {
  plan = await role('architect', architectPrompt(attempt > 1 ? errors : null), { label: `architektur #${attempt}`, phase: 'Architektur', schema: PLAN_SCHEMA, model: 'architect' })
  errors = plan ? validatePlan(plan) : ['Architekt hat keinen Plan geliefert']
  log(errors.length ? `Plan #${attempt} ungültig: ${errors.join(' · ')}` : `Plan: ${plan.units.length} Einheiten (${plan.units.map((u) => u.id).join(', ')})`)
}
if (errors.length) return { status: 'no-plan', planErrors: errors, interventions }
let WAVES = planWaves(plan)
if (!WAVES) return { status: 'no-plan', planErrors: ['keine ausführbare Wellenfolge'], interventions }
// a plan that is almost a chain gets one critical second look: every dependency must name the check that would fail without it
if (!A.plan && RUN.length >= 4 && WAVES.length > 0.7 * RUN.length) {
  const deps = plan.features.filter((f) => RUN.some((r) => r.id === f.id) && f.dependsOn.length).map((f) => `- ${f.id} ← ${f.dependsOn.join(', ')}${f.dependsOnWhy ? ` (${Object.entries(f.dependsOnWhy).map(([k, v]) => `${k}: ${v}`).join('; ')})` : ''}`).join('\n')
  const second = await role('architect', [SCOPE, `Dein Plan für „${CFG.project}“ ergibt ${WAVES.length} Wellen für ${RUN.length} Features, fast eine Kette. Prüfe jede Abhängigkeit einzeln: Welche Prüfung würde scheitern, wenn das andere Feature nur als Hülle mit seinem Vertrag existiert? Wo keine, streiche sie. Deine Abhängigkeiten:`, deps, `Gib den vollständigen, überarbeiteten Plan zurück.`].join('\n'),
    { label: 'architektur #2', phase: 'Architektur', schema: PLAN_SCHEMA, model: 'architect' })
  const w2 = second && !validatePlan(second).length ? planWaves(second) : null
  const better = !!w2 && w2.length < WAVES.length
  log(`Zweiter Blick: ${w2 ? `${w2.length} statt ${WAVES.length} Wellen${better ? ' → übernommen' : ' → erster Plan bleibt'}` : 'ungültig, erster Plan bleibt'}`)
  if (better) { plan = second; WAVES = w2 }
}
log(`Wellen: ${WAVES.map((w, i) => `${i + 1}:[${w.join(' ')}]`).join(' ')}`)

// ---- GERÜST ----------------------------------------------------------------------------------------------------------------
phase('Gerüst')
const unitsOf = (fid) => plan.features.find((f) => f.id === fid).touches
const filesOf = (fid) => plan.units.filter((u) => unitsOf(fid).includes(u.id)).flatMap((u) => u.files)
const PLAN_TEXT = JSON.stringify({ ...plan, waves: WAVES })
// relayed in short pieces (a helper copies ~1 KB reliably, 13 KB did fail), each piece and then the whole verified by checksum
const PIECES = PLAN_TEXT.match(/[\s\S]{1,1000}/g)
let planOk = false
for (let attempt = 1; attempt <= 2 && !planOk; attempt++) {
  const parts = await parallel(PIECES.map((piece, i) => () => tool(W(`plan-part --index ${i} --sum ${checksum(piece)}`), `plan teil ${i + 1}/${PIECES.length}${attempt > 1 ? ` #${attempt}` : ''}`, 'Gerüst', piece)))
  if (parts.some((r) => r && r.blocked)) break
  const r = await tool(W(`plan --parts ${PIECES.length} --sum ${checksum(PLAN_TEXT)}`), `plan zusammensetzen${attempt > 1 ? ` #${attempt}` : ''}`, 'Gerüst')
  planOk = !!(r.data && r.data.ok)
}
log(planOk ? 'Plan festgehalten (loop.plan.json, Prüfsumme stimmt)' : '⚑ Plan-Datei nicht geschrieben – der Plan steht im Ergebnis dieses Laufs')
const scaffold = await role('builder', [SCOPE, `Lege das Gerüst für den parallelen Bau an. Der Plan steht in loop.plan.json (verbindlich).`,
  `1. Lege jede Datei der Einheiten an, die noch nicht existiert: als Hülle, die ihren Vertrag minimal erfüllt (wie im Plan beschrieben) und eingebunden ist. Keine Feature-Logik. Bestehende Dateien NICHT überschreiben.`,
  plan.migration ? `2. Vorhandener Code passt nicht zum Schnitt: ${plan.migration} – verschiebe verhaltenserhaltend.` : '',
  `3. Prüfe: \`${C.lockCheck}\` und \`${evalFor([...BEFORE])}\` müssen grün sein.`, `Nicht committen, das macht die Werkstatt.`].filter(Boolean).join('\n'),
  { label: 'gerüst', phase: 'Gerüst', schema: { type: 'object', properties: { summary: { type: 'string' }, filesChanged: { type: 'array', items: { type: 'string' } }, evalDispute: { type: 'array', items: { type: 'object' } } }, required: ['summary', 'filesChanged', 'evalDispute'] }, model: 'builder' })
if (!scaffold) log('⚑ Gerüst: keine Antwort des Handwerkers')
const archCommit = await tool(W(`commit --src ${CFG.sourceDir || 'src'}`), 'commit arch', 'Gerüst', 'arch: Einheiten und Plan')
log(archCommit.data && (archCommit.data.committed || archCommit.data.note) ? `⎇ arch: Einheiten und Plan${archCommit.data.hash ? ` → ${archCommit.data.hash}` : ''}` : `⚑ Gerüst nicht festgehalten`)

// ---- WELLEN ----------------------------------------------------------------------------------------------------------------
const built = new Set(BEFORE)
const openPoints = [], specConflicts = [], waveLog = []
let knownRed = A.knownRed || []
const selectFor = (fid) => {
  const mine = unitsOf(fid)
  const near = [...built].filter((g) => (plan.features.find((p) => p.id === g) || { touches: [] }).touches.some((t) => mine.includes(t)))
  return sorted([...SMOKE, ...near, ...plan.features.find((p) => p.id === fid).dependsOn, fid])
}
/** the lane's own configuration – passed to graph-lane directly; tools/graph/lane.mjs writes the same for the agents to read */
function laneConfig(l) {
  const env = ENV.split('{port}').join(String(l.port))
  const pin = (c) => (typeof c === 'string' && /\s/.test(c) && !c.includes('<') ? `${env} ${c.split('{judgePort}').join(String(l.port + 1))}` : c)
  const commands = Object.fromEntries(Object.entries(C).map(([k, v]) => [k, pin(v)]))
  delete commands.refactorReport; delete commands.thaw
  commands.evalUpTo = commands.evalAll = pin(C.evalSelect.split('{features}').join(l.select.join(',')))
  const note = `Parallele Spur für ${l.fid}: App-Port ${l.port}, Foto-Port ${l.port + 1}. Starte Server nur mit diesem Port, beende nur deinen eigenen (per PID). Deine Prüfung ist die Auswahl ${l.select.join(',')}. Ändere nur: ${l.writable.join(', ')}. Brauchst du eine andere Datei, baue nicht darum herum, sondern melde es in evalDispute mit id "PLAN".`
  const G = CFG.guidance || {}
  return { ...CFG, commands, writable: l.writable, guidance: { ...G, builder: `${note}\n${G.builder || ''}`.trim() } }
}
// in the main tree (sequential fallback) the feature is checked against its selection too: unbuilt features never count
const mainConfig = (l) => ({ ...CFG, commands: { ...C, evalUpTo: C.evalSelect.split('{features}').join(l.select.join(',')), evalAll: C.evalSelect.split('{features}').join(l.select.join(',')) } })
// faults (rehearsals) only on a lane's first attempt: a retry must be able to succeed, that is the path under test
const laneArgs = (l, root = `${ROOT}/.lanes/${l.fid}`, first = true) => ({
  root, config: root === ROOT ? mainConfig(l) : laneConfig(l), tools: TOOLS, feature: l.fid, roles: ROLES, models: MODELS, maxIter: A.maxIter,
  judgePort: root === ROOT ? A.judgePort : l.port + 1, knownRed, referenceIds: REFERENCE_IDS, faults: first ? A.faults : {},
  refactor: !!(REFACTOR_EVERY && CFG.refactor && (ids.indexOf(l.fid) + 1) % REFACTOR_EVERY === 0),
})
const failedRun = (r) => !r || ['aborted', 'config-missing', 'lane-error'].includes(r.status)
async function runLane(l, root, first = true) { try { return await workflow({ scriptPath: LANE_SCRIPT }, laneArgs(l, root, first)) } catch (e) { return { status: 'lane-error', error: String(e && e.message ? e.message : e) } } }
function collect(r) {
  if (!r) return
  if (r.openPoints) openPoints.push(...r.openPoints)
  if (r.knownRed) knownRed = [...new Set([...knownRed, ...r.knownRed])]
  if (r.specConflicts) specConflicts.push(...r.specConflicts)
}

/** one lane through the merge queue: sync → (integrator) → merge → gate → (undo, again). */
async function integrate(l, waveNo) {
  const laneRoot = `${ROOT}/.lanes/${l.fid}`, target = [...built, l.fid], f = featureOf(l.fid)
  const arrived = [...built].filter((x) => !l.builtAtStart.includes(x))
  let trouble = null, g = null
  for (let round = 1; round <= MERGE_ROUNDS; round++) {
    const tag = round > 1 ? ` #${round}` : ''
    const s = await tool(LANE(`sync ${l.fid}`), `sync ${l.fid}${tag}`, 'Wellen')
    const conflicts = (s.data && s.data.conflicts) || []
    if (!s.data || (!s.ok && !conflicts.length)) {
      // rule: a failed sync is tried again in the next round; refused or out of rounds → the manager
      if (!s.blocked && round < MERGE_ROUNDS) { log(`↻ ${l.fid}: Synchronisieren nicht gelungen – nächste Runde`); continue }
      const d = await manage(`Spur ${l.fid} ließ sich nicht auf den Hauptstand bringen (lane.mjs sync)${s.blocked ? ', der Befehl wurde verweigert' : `, auch nach ${round} Versuchen`}. Die Regeln des Takts sind erschöpft.`, ['retry', 'skip', 'stop'], 'stop', s)
      if (d.action === 'retry' && round < MERGE_ROUNDS) continue
      if (d.action === 'stop') return { merged: false, stop: d }
      openPoints.push({ kind: 'merge', feature: l.fid, detail: d.diagnosis })
      return { merged: false }
    }
    if (conflicts.length || trouble) {
      log(conflicts.length ? `⇄ ${l.fid}: Konflikte in ${conflicts.join(', ')} – Integrator` : `⇄ ${l.fid}: Tor war rot (${trouble.ids.join(', ')}) – Integrator in der Spur`)
      const SCHEMA = { type: 'object', properties: { ok: { type: 'boolean' }, resolved: { type: 'array', items: { type: 'string' } }, test: { type: 'string' }, dispute: { type: 'array', items: { type: 'object' } }, note: { type: 'string' } }, required: ['ok', 'resolved', 'test', 'dispute'] }
      const fix = await role('integrator', [SCOPE.split(ROOT).join(laneRoot),
        `Spur: ${laneRoot} (eigenes Git-Repository, Branch lane/${l.fid}). Arbeite nur dort.`,
        `Feature der Spur: ${l.fid} ${f.title || ''} – ${f.focus || ''}`,
        `Seit die Spur begann, kamen in den Hauptstand: ${arrived.length ? arrived.map((a) => `${a} (${featureOf(a).title || ''})`).join(', ') : 'nichts Neues'}. Plan mit Einheiten und Verträgen: loop.plan.json.`,
        conflicts.length ? `Lage: Beim Übernehmen des Hauptstands gab es Konflikte in: ${conflicts.join(', ')} (siehe \`git status\`). Löse sie so, dass alle Features erhalten bleiben.` : '',
        trouble ? `Lage: Nach dem Zusammenführen war die Prüfung im Hauptstand rot; der Hauptstand ist zurückgesetzt. Rot waren:\n${q(trouble.failures)}` : '',
        `Du darfst alle Dateien aus ${(CFG.writable || []).join(', ')} ändern. Niemals: ${(CFG.frozen || []).join(', ') || 'Prüfungen, Spec'}.`,
        `Integrationsprüfung (muss grün sein): \`cd ${laneRoot} && ${ENV.split('{port}').join(String(l.port))} ${evalFor(target)}\`.`,
        `Löse, prüfe, \`git add -A\` – aber committe NICHT.`].filter(Boolean).join('\n'),
        { label: `integrator ${l.fid}${tag}`, phase: 'Wellen', schema: SCHEMA, model: 'builder' })
      if (fix && fix.dispute && fix.dispute.length) openPoints.push({ kind: 'dispute', feature: l.fid, detail: fix.dispute })
      const ic = fix && fix.ok ? await tool(W(`commit --src ${CFG.sourceDir || 'src'}`, laneRoot), `commit integrate ${l.fid}${tag}`, 'Wellen', `integrate(${l.fid}): ${conflicts.length ? `Konflikte gelöst (${conflicts.join(', ')})` : 'Integrationsfehler behoben'}`) : null
      if (!ic || !ic.data || ic.data.error) {
        log(`⚑ ${l.fid}: Integration nicht gelungen (${fix ? fix.note || fix.test : 'keine Antwort'}${ic && ic.data && ic.data.error ? ` · ${ic.data.error}` : ''})`)
        if (round === MERGE_ROUNDS) { openPoints.push({ kind: 'merge', feature: l.fid, detail: 'Integration nicht gelungen' }); return { merged: false } }
        continue
      }
      log(`✓ ${l.fid}: integriert (${fix.test})${fix.note ? ` · ${String(fix.note).slice(0, 200)}` : ''}`)
    }
    // a lane that froze a reference and then took in other features re-freezes it on the integrated state (mechanical);
    // otherwise the reference would show a state that never existed in main
    if (f.golden && C.golden && (conflicts.length || trouble || (s.data && s.data.upToDate === false))) {
      const lc = laneConfig({ ...l, select: sorted([...SMOKE, ...target]) }).commands
      const rg = await tool(W(`golden --cmd ${q(lc.golden)} --eval ${q(lc.evalUpTo)} --report ${C.report}`, laneRoot), `golden ${l.fid} neu${tag}`, 'Wellen')
      log(rg.data && rg.data.pass ? `❄ ${l.fid}: Referenz auf dem integrierten Stand neu eingefroren` : `⚑ ${l.fid}: Referenz neu einfrieren nicht gelungen${rg.data ? ` (rot: ${(rg.data.failedIds || []).join(', ') || rg.data.error})` : ''} – das Tor entscheidet`)
      if (rg.data && rg.data.frozen) await tool(W(`commit --src ${CFG.sourceDir || 'src'}`, laneRoot), `commit golden ${l.fid}${tag}`, 'Wellen', `golden(${l.fid}): Referenz auf integriertem Stand neu eingefroren`)
    }
    const m = await tool(LANE(`merge ${l.fid}`), `merge ${l.fid}${tag}`, 'Wellen')
    // files the workshop itself writes (a reference frozen anew) are not the builder's doing
    const outside = ((m.data && m.data.outOfScope) || []).filter((p) => !(f.golden && (CFG.frozen || []).some((fr) => covers(fr, p))))
    if (outside.length) log(`⚠ ${l.fid} hat Dateien außerhalb seiner Einheiten geändert: ${outside.join(', ')}`)
    if (!m.ok || !m.data || !m.data.merged) {
      if (!m.blocked && round < MERGE_ROUNDS) { log(`↻ ${l.fid}: Zusammenführen nicht gelungen – nächste Runde`); continue }
      const d = await manage(`Zusammenführen von ${l.fid} abgelehnt (lane.mjs merge)${m.blocked ? ', der Befehl wurde verweigert' : `, auch nach ${round} Versuchen`}. Die Regeln des Takts sind erschöpft.`, ['retry', 'skip', 'stop'], 'stop', m)
      if (d.action === 'retry' && round < MERGE_ROUNDS) continue
      if (d.action === 'stop') return { merged: false, stop: d }
      openPoints.push({ kind: 'merge', feature: l.fid, detail: d.diagnosis })
      return { merged: false }
    }
    g = await gate(target, `${waveNo} ${l.fid}${tag}`)
    if (g && !g.lockOk) return { merged: true, gate: g, tampered: true }
    if (!g || (g.total > 0 && g.passed === 0)) {
      // nothing green at all: the test bench, not the integration. Rule: run the gate once more; then the manager
      log(`↻ Tor nach ${l.fid}: ${g ? 'nichts grün' : 'kein Bericht'} – noch einmal`)
      g = await gate(target, `${waveNo} ${l.fid}${tag} wiederholt`)
      if (!g || (g.total > 0 && g.passed === 0)) {
        const d = await manage(`Das Tor nach ${l.fid} lieferte zweimal ${g ? 'kein einziges grünes Ergebnis' : 'keinen Prüfbericht'}. Die Regeln des Takts sind erschöpft.`, ['retry', 'stop'], 'stop', g)
        if (d.action === 'retry') g = await gate(target, `${waveNo} ${l.fid}${tag} (Manager)`)
        if (!g || (g.total > 0 && g.passed === 0)) return { merged: true, gate: g, stop: d, broken: true }
      }
    }
    const red = g.failedIds.filter((id) => !knownRed.includes(id))
    if (!red.length) return { merged: true, gate: g }
    if (round === MERGE_ROUNDS) break
    const u = await tool(LANE(`undo ${l.fid}`), `undo ${l.fid}${tag}`, 'Wellen')
    if (!u.data || !u.data.undone) { log(`⚑ ${l.fid}: Zurücknehmen fehlgeschlagen – bleibt zusammengeführt`); break }
    log(`↩ ${l.fid}: Tor rot (${red.join(', ')}), zurückgenommen – noch einmal in die Spur`)
    trouble = { ids: red, failures: g.failures.filter((x) => !knownRed.includes(x.id)) }
  }
  const red = g ? g.failedIds.filter((id) => !knownRed.includes(id)) : []
  openPoints.push({ kind: 'gate', feature: l.fid, ids: red })
  knownRed = [...new Set([...knownRed, ...red])]
  log(`⚑ ${l.fid}: nach ${MERGE_ROUNDS} Runden noch rot (${red.join(', ')}) – zusammengeführt, offener Punkt`)
  return { merged: true, gate: g }
}
const halt = (status, extra) => ({ status, ...extra, openPoints, knownRed, specConflicts, interventions, waves: waveLog, plan: { ...plan, waves: WAVES }, built: [...built] })

let lastWaveGate = null // the acceptance rule compares against it
for (let w = 0; w < WAVES.length; w++) {
  phase('Wellen')
  log(`▶ Welle ${w + 1}/${WAVES.length}: ${WAVES[w].join(', ')}`)
  let lanes = WAVES[w].map((fid, slot) => ({ fid, port: BASE_PORT + slot * 10, select: selectFor(fid), writable: filesOf(fid), builtAtStart: [...built] }))
  const sequential = [] // features the manager moved into the main tree

  const setup = await parallel(lanes.map((l) => () => tool(LANE(`add ${l.fid} --port ${l.port} --env ${q(ENV)} --select ${l.select.join(',')} --writable ${l.writable.join(',')}`), `spur ${l.fid}`, 'Wellen')))
  const notSet = lanes.filter((l, i) => !setup[i] || !setup[i].ok)
  if (notSet.length) {
    // rule: a lane that cannot be set up builds sequentially in the main tree (no lane needed there)
    log(`↪ Spur(en) nicht angelegt (${notSet.map((l) => l.fid).join(', ')}) – sequenziell im Hauptstand`)
    sequential.push(...notSet.map((l) => l.fid))
    lanes = lanes.filter((l) => !notSet.includes(l))
  }

  const results = await parallel(lanes.map((l) => () => runLane(l)))
  for (let i = 0; i < lanes.length; i++) {
    if (!failedRun(results[i])) continue
    const l = lanes[i], res = results[i]
    // the cause in plain words: what exactly did not happen
    const why = !res ? 'die Spur lieferte kein Ergebnis'
      : res.status === 'aborted' ? `ein Agent der Spur lieferte keine Antwort (Schritt ${res.at || '?'}, auch nicht im zweiten Versuch)`
      : res.status === 'lane-error' ? `der Spur-Workflow brach ab: ${res.error}` : `Status ${res.status}${res.hint ? `: ${res.hint}` : ''}`
    // rule: run the lane once more; still failing → build it sequentially in the main tree
    log(`⚠ Spur ${l.fid} nicht durchgelaufen: ${String(why).slice(0, 200)} – noch einmal`)
    results[i] = await runLane(l, undefined, false)
    if (failedRun(results[i])) { log(`↪ ${l.fid}: auch der zweite Lauf scheiterte – sequenziell im Hauptstand`); sequential.push(l.fid); results[i] = null }
  }
  results.forEach(collect)

  // MERGE-QUEUE: one lane after the other; conflicts and red integrations are resolved in the lane
  let lastGate = null
  for (const l of lanes.filter((x, i) => results[i])) {
    const r = await integrate(l, w + 1)
    if (r.tampered) return halt('eval-tampered', { at: `Tor ${w + 1} (${l.fid})` })
    if (r.broken) return halt('gate-broken', { at: `Tor ${w + 1} (${l.fid})`, manager: r.stop })
    if (r.stop) return halt('stopped', { at: `Merge-Queue ${l.fid}`, manager: r.stop })
    if (r.merged) built.add(l.fid)
    if (r.gate) lastGate = r.gate
  }
  await parallel(lanes.map((l) => () => tool(LANE(`remove ${l.fid}`), `spur entfernen ${l.fid}`, 'Wellen')))

  // features the manager moved: built by graph-lane directly in the main tree, then the gate
  for (const fid of sequential) {
    log(`↪ ${fid} sequenziell im Hauptstand`)
    const r = await runLane({ fid, port: BASE_PORT, select: selectFor(fid), writable: filesOf(fid) }, ROOT, false)
    if (failedRun(r)) {
      const d = await manage(`${fid} ließ sich weder in der Spur noch sequenziell im Hauptstand bauen. Die Regeln des Takts sind erschöpft.`, ['skip', 'stop'], 'stop', r)
      if (d.action === 'stop') return halt('stopped', { at: `${fid} sequenziell`, manager: d })
      openPoints.push({ kind: 'stuck', feature: fid, detail: d.diagnosis })
      continue
    }
    collect(r)
    built.add(fid)
    lastGate = await gate([...built], `${w + 1} ${fid} sequenziell`)
  }

  lastWaveGate = lastGate
  waveLog.push({ wave: w + 1, features: WAVES[w], merged: WAVES[w].filter((f) => built.has(f)), gate: lastGate ? `${lastGate.passed}/${lastGate.total}` : 'n/a', red: lastGate ? lastGate.failedIds : [] })
  log(`Tor ${w + 1}: ${lastGate ? `${lastGate.passed}/${lastGate.total}` : 'n/a'}${lastGate && lastGate.failedIds.length ? ` · offen: ${lastGate.failedIds.join(', ')}` : ' · grün'}`)
  // rule: open points only stop the build when a feature still to come depends on a feature they concern
  const later = RUN.filter((f) => !built.has(f.id)).map((f) => plan.features.find((p) => p.id === f.id))
  const blocking = openPoints.filter((o) => ['stuck', 'gate', 'merge'].includes(o.kind) && later.some((p) => p && p.dependsOn.includes(o.feature)))
  if (openPoints.length > MAX_OPEN && blocking.length) {
    const d = await manage(`Nach Welle ${w + 1} gibt es ${openPoints.length} offene Punkte; ${blocking.map((o) => o.feature).join(', ')} betrifft Features, von denen noch kommende abhängen. Die Regeln des Takts sind erschöpft.`, ['continue', 'stop'], 'stop', { openPoints, stillToCome: later.map((p) => p && { id: p.id, dependsOn: p.dependsOn }) })
    if (d.action === 'stop') return halt('too-many-open-points', { manager: d })
  }
}

// ---- ABNAHME ---------------------------------------------------------------------------------------------------------------
phase('Abnahme')
const acceptance = (tag) => tool(W(`eval --cmd ${q(C.evalUpTo.split('{feature}').join(ids[toIdx]))} --lock ${q(C.lockCheck)} --report ${C.report} --progress ${q(`Abnahme ${tag}`)}`), tag === 1 ? 'final eval' : 'final eval (wiederholt)', 'Abnahme')
const isFinalOk = (d) => !!d && !d.error && d.lockOk && (d.pass || (d.failedIds || []).every((id) => knownRed.includes(id)))
let fin = (await acceptance(1)).data
let flaky = []
// rule: red acceptance on the very state whose last gate was fully green → run it once more; what flips is flaky, not broken
if (!isFinalOk(fin) && fin && fin.lockOk && lastWaveGate && !lastWaveGate.failedIds.length) {
  log(`↻ Abnahme rot (${(fin.failedIds || []).join(', ')}), das letzte Tor auf demselben Stand war grün – noch einmal`)
  const first = fin.failedIds || []
  fin = (await acceptance(2)).data
  if (isFinalOk(fin)) { flaky = first; log(`⚠ wackelige Prüfungen (einmal rot, dann grün): ${flaky.join(', ')}`) }
}
const finalOk = isFinalOk(fin)
let finalJudge = null
const J = CFG.judge
if (A.finalJudge && J && Array.isArray(J.finalCriteria) && J.finalCriteria.length) {
  finalJudge = await role('judge', [SCOPE, `Belege erzeugen: \`${(C.capture || '').split('{judgePort}').join(String(A.judgePort || 4174))}\`. Rubrik: ${J.rubric}. Referenzen: ${J.references}. Belege: ${J.screenshots}.`, `Bewerte die Kriterien ${J.finalCriteria.join(', ')} (Endabnahme).`, J.finalNote || ''].filter(Boolean).join('\n'),
    { label: 'final judge', phase: 'Abnahme', schema: { type: 'object', properties: { perCriterion: { type: 'array', items: { type: 'object', properties: { criterion: { type: 'number' }, score: { type: 'number' }, note: { type: 'string' } }, required: ['criterion', 'score', 'note'] } }, mustFix: { type: 'array', items: { type: 'string' } }, specConflicts: { type: 'array', items: { type: 'string' } }, summary: { type: 'string' } }, required: ['perCriterion', 'mustFix', 'specConflicts', 'summary'] }, model: 'judge' })
}
if (C.refactorReport && REFACTOR_EVERY) await tool(W(`report --cmd ${q(C.refactorReport)}`), 'report aufräumen', 'Abnahme')
log(`Abnahme: ${fin && fin.summary ? `${fin.summary.passed}/${fin.summary.ids}` : 'ohne Bericht'} → ${finalOk ? 'FERTIG' : 'nicht bestanden'}${interventions.length ? ` · ${interventions.length} Eingriff(e) des Engineering Managers` : ''}`)
const status = finalOk ? (openPoints.length ? 'done-with-open-points' : 'done') : 'final-failed'
return { status, mode: 'graph', plan: { ...plan, waves: WAVES }, planFileOk: planOk, waves: waveLog, built: [...built], openPoints, knownRed, specConflicts, interventions, flaky,
  finalTest: fin ? { pass: fin.pass, passed: fin.summary && fin.summary.passed, total: fin.summary && fin.summary.ids, failedIds: fin.failedIds } : null, finalJudge }
}

try { return await main() } catch (e) {
  log(`⛔ Der Takt ist abgestürzt: ${String(e && e.message ? e.message : e).slice(0, 200)}`)
  const d = await manage(`Der Takt (graph.js) ist mit einem unerwarteten Fehler abgestürzt: ${String(e && e.message ? e.message : e)}. Untersuche den Bau-Ordner und sag dem Menschen, was passiert ist und wie es weitergehen kann.`, ['stop'], 'stop', String((e && e.stack) || e).slice(0, 2000))
  return { status: 'crashed', error: String(e && e.message ? e.message : e), manager: d, interventions }
}
