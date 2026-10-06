# Agentic-Loop-Kit (überproduct)

Der allgemeine Kern aus dem Aristo-Projekt, für jedes andere Vorhaben: **bauen · testen · begutachten · aufräumen**,
gesteuert von einem Dynamic Workflow, angeschlossen über eine `loop.config.json`. Der Kern ist für jedes Projekt gleich,
das Projekt bringt drei Dinge mit:

1. ein **Briefing**: was entstehen soll, in den Worten des Auftraggebers
2. eine **Spec**: nummerierte, überprüfbare Anforderungen, nach Features geordnet
3. ein **Eval**: Prüfungen zu jeder ID, ein Befehl „bis Feature X“, ein Bericht im Kern-Format, ein Siegel

## Installieren
```bash
node kit/install.mjs ~/Claude/MeinProjekt --name "Mein Projekt"
```
Am einfachsten geht es mit dem Skill **`/agentic-loop neu <Ordner>`**. Er installiert den Kern, führt mit dir durch Briefing,
Rückfragen, Spec und Eval, setzt das Siegel und prüft, dass am Anfang alles rot ist.

## Was ins Projekt kopiert wird
| Kern (nicht anpassen) | Projekt (ausfüllen) |
|---|---|
| `.claude/workflows/agentic-loop.js`, `agentic-loop-parallel.js`, `one-pass.js`, `assess.js`, `.claude/skills/agentic-loop/` | `briefing/BRIEFING.md` |
| `.claude/agents/loop-builder.md`, `loop-tester.md`, `loop-judge.md`, `loop-refactorer.md`, `loop-reviewer.md` | `SPEC.md` |
| `tools/code-metrics.mjs`, `refactor-record.mjs`, `refactor-report.mjs`, `refactor-policy.json`, `journal.mjs` | `EVAL.md`, `eval/` (Prüfungen und Runner), `eval/seal.mjs` |
| | `loop.config.json` |

## Der Vertrag zwischen Projekt und Kern
* `commands.evalUpTo` (mit `{feature}`) führt alle Prüfungen von F0 bis zu diesem Feature aus und schreibt `commands.report` im
  Kern-Format (siehe `templates/EVAL.md`). Die Technik ist frei: Unit-Tests, Browser-Tests, API-Aufrufe oder Skripte.
* `commands.lockCheck` scheitert, sobald etwas Versiegeltes verändert wurde.
* Für schwer Messbares (Aussehen, Texte, Anmutung) gibt es optional einen Gutachter: `judge.rubric`, `judge.references`,
  `commands.capture`. Was er findet und korrigiert haben will, wird zu einer festen Prüfung.
* Optional ein Aufräumer: `refactor.policy` plus die Metrik-Befehle. Ohne `refactor` wird nicht aufgeräumt. Jeder Aufräum-Commit trägt
  seine Schritte im Text, und am Ende schreibt `commands.refactorReport` den Bericht `REFACTOR-REPORT.md`: was das Aufräumen gebracht hat.
* Vergleich mit anderen Bauweisen: `one-pass.js` baut in einem Durchgang, entweder mit Spec (`input: "spec"`, Direktbau) oder nur mit
  einem Prompt und Bildern (`input: "briefing"`, One Shot). `assess.js` bewertet jeden Bau gleich und blind: Treue zu den Fotos,
  freie Funktionsprobe, Code-Note, dazu die versiegelte Prüfung, wo sie passt.

## Sequenziell oder parallel
`agentic-loop.js` baut ein Feature nach dem anderen. `agentic-loop-parallel.js` lässt zuerst den Architekten (`loop-architect`) das
Projekt in Einheiten schneiden und baut dann in Wellen parallel, jedes Feature in einer eigenen Spur (`tools/lane.mjs`). Dafür braucht
der Anschluss `commands.evalSelect` (Prüfung genau dieser Features) und `parallel` (Port-Umgebung, erster Port, Spuren). Der Schnitt
wird nicht von Hand vorgegeben, der Architekt leitet ihn aus jeder Spec neu ab, und der Takt prüft ihn mechanisch.

## Lehren aus dem Aristo-Projekt, schon eingebaut
* Die Prüfung steht fest, bevor gebaut wird, und ist versiegelt.
* Der Judge streut, deshalb gestaffelte Gates und Konsistenz mit seiner letzten Bewertung.
* Was die Spec festlegt, entscheidet nicht der Judge. Konflikte gehen an den Menschen.
* Jede Rolle hat ihre Werkzeuge: Prüfer und Gutachter können nichts schreiben.
* Die Workflow-Laufzeit reicht die auslösende Nutzernachricht an alle Agenten weiter. Bauläufe deshalb in einer eigenen Session starten,
  dort nur Steuerbefehle (fortsetzen, Entscheidungen). Fragen und Ideen gehören in eine andere Session.
* Jedes Mal ein bisschen Ordnung: Aufräumrunden mit Policy, Messung und Stoppregeln. Commits machen die Änderungskosten pro Feature messbar.
