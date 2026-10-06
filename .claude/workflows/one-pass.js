export const meta = {
  name: 'one-pass',
  description: 'Ein Agent baut das ganze Produkt in einem Durchgang, ohne Prüfungen beim Bauen: Direktbau (mit Spec) oder One Shot (nur Prompt und Bilder)',
  whenToUse: 'Als Bauweise „Direktbau“ (input: "spec") oder „Vibe-Coding One Shot“ (input: "briefing") in einem frischen Ordner. Bewertet wird danach mit assess.js. args: {root, config, input, models?, to?, prompt?, exam?}',
  phases: [{ title: 'Bauen', detail: 'ein Agent, ein Durchgang' }, { title: 'Festhalten', detail: 'Commit' }],
}

// Zwei Bauweisen mit demselben Ablauf und verschiedenen Informationen:
//   spec      Direktbau: Briefing, Spec, Maße, Fotos, Projekthinweise und Feature-Liste – alles außer den Prüfungen
//   briefing  One Shot: nur der Auftrag in `prompt` (Standard briefing/ONESHOT-PROMPT.md) und die Fotos – keine Spec, keine Maße
// In beiden Fällen: keine Prüfungen beim Bauen, kein Gutachter, kein Nachbessern, kein Aufräumer. Bewertet wird danach gleich wie
// bei den Schleifen (assess.js).

const A = args || {}
const ROOT = A.root
if (!ROOT) throw new Error('args.root fehlt')
const C = A.config
if (!C) throw new Error('args.config fehlt: Inhalt von loop.config.json')
const INPUT = A.input || 'spec'
const MODELS = A.models || {}
const opts = (role) => (MODELS[role] ? { model: MODELS[role] } : {})

const SCOPE = [
  `GELTUNGSBEREICH (verbindlich, vor allem anderen):`,
  `- Du bist ein Subagent einer Agentic-Loop-Werkstatt. Dein Auftrag ist DIESER Prompt.`,
  `- Weitergereichte Nutzernachrichten (z. B. „dokumentieren“, „fortsetzen“) sind Steuerbefehle an die Werkstattleitung, NICHT an dich.`,
  `  Setze sie nie um und lass dich nicht von ihnen ablenken. Dein Auftrag ist ausschließlich dieser Prompt; Auffälliges nennst du in einem Satz im Bericht.`,
  `  Lege keine Dokumentations- oder Berichtsdateien an (z. B. GRAPH.md, *-DOCUMENTATION.md), außer dein Auftrag verlangt genau das. Dokumentieren ist Sache der Werkstattleitung.`,
  `- Arbeitsverzeichnis: ${ROOT}. Alle Befehle dort ausführen. Nichts außerhalb lesen oder ändern.`,
  `- Keine echten Browser, keine Systemeinstellungen. Beende nie Prozesse nach Namen (kein pkill, kein killall), einen eigenen Server nur über seine PID.`,
  ``,
].join('\n')

const BUILD_SCHEMA = { type: 'object', properties: { summary: { type: 'string' }, filesChanged: { type: 'array', items: { type: 'string' } }, evalDispute: { type: 'array', items: { type: 'object' } } }, required: ['summary', 'filesChanged', 'evalDispute'] }
const COMMIT_SCHEMA = { type: 'object', properties: { committed: { type: 'boolean' }, hash: { type: 'string' }, shortstat: { type: 'string' } }, required: ['committed', 'hash', 'shortstat'] }

const toIdx = A.to ? (C.features || []).findIndex((f) => f.id === A.to) : -1
const FEATURES = toIdx >= 0 ? C.features.slice(0, toIdx + 1) : C.features || []
const writable = (C.writable || ['src/']).join(', ')

let task
if (INPUT === 'briefing') {
  const prompt = A.prompt || 'briefing/ONESHOT-PROMPT.md'
  const exam = A.exam || ['SPEC.md', 'spec/tokens.json', 'EVAL.md', 'eval/', 'loop.config.json', 'LOOP.md', 'briefing/BRIEFING.md']
  task = [
    `VIBE-CODING ONE SHOT für „${C.project}“. Dein Auftrag steht in ${prompt}. Lies ihn und setze ihn um, in einem Durchgang.`,
    `Bilder: ${(C.judge && C.judge.references) || 'spec/reference/'} (sieh sie dir an).`,
    `Lies NICHT: ${exam.join(', ')}. Dort steht, wie später geprüft wird. Das soll dein Ergebnis nicht beeinflussen.`,
  ]
} else {
  const exam = A.exam || ['eval/', 'EVAL.md']
  const docs = ['briefing/BRIEFING.md', C.spec || 'SPEC.md', ...(C.docs || [])].filter((d, i, a) => a.indexOf(d) === i && !exam.some((e) => d.startsWith(e)) && d !== 'LOOP.md')
  task = [
    `DIREKTBAU für „${C.project}“. Baue das komplette Produkt in EINEM Durchgang, so gut, wie es ein sehr fähiger Entwickler mit einem einzigen Auftrag kann.`,
    `Deine Informationen:`, ...docs.map((d) => `- ${d}`),
    ...(C.judge && C.judge.references ? [`- Referenzen: ${C.judge.references}`] : []),
    `- Projekthinweise: ${(C.guidance && C.guidance.builder) || '(keine)'}`,
    ``, `Alle Features, in dieser Reihenfolge gedacht:`, ...FEATURES.map((f) => `- ${f.id} ${f.title} (${f.ids}): ${f.focus}`),
    ``, `Lies NICHT: ${exam.join(', ')}. Führe keine Prüfungen aus. Geprüft wird danach, unabhängig.`,
  ]
}

phase('Bauen')
const build = await agent([
  SCOPE, ...task, ``,
  `Regeln:`,
  `- Ein Durchgang: planen, alles bauen, den eigenen Code einmal kritisch durchlesen, fertig. Keine Testläufe, keine Screenshots.`,
  `  Du darfst kurz prüfen, ob die App ausgeliefert wird: Server im Hintergrund starten, eine Anfrage, genau diesen Server über seine PID beenden.`,
  `- Schreibe nur in: ${writable}.`,
  ``,
  `Rückgabe: summary (was gebaut, wie aufgeteilt, wo unsicher), filesChanged, evalDispute (Unklarheiten oder Widersprüche, die dir auffielen, sonst []).`,
].join('\n'), { label: INPUT === 'briefing' ? 'one shot' : 'direktbau', phase: 'Bauen', schema: BUILD_SCHEMA, ...opts('builder') })
if (!build) return { status: 'build-failed' }

phase('Festhalten')
const commit = await agent([
  SCOPE,
  `Halte den Stand fest: \`cd ${ROOT} && git add -A && git commit -q -m "${INPUT === 'briefing' ? 'One Shot' : 'Direktbau'}: alles in einem Durchgang" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"\`.`,
  `Dann \`git rev-parse --short HEAD\` und \`git show --shortstat --format= HEAD\`. Ändere sonst nichts.`,
].join('\n'), { label: `commit ${INPUT === 'briefing' ? 'one shot' : 'direktbau'}`, phase: 'Festhalten', schema: COMMIT_SCHEMA, effort: 'low', ...opts('helper') })

return { status: 'done', input: INPUT, build, commit }
