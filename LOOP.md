# Agentic Loop: allgemeiner Kern und Aristo als Beispiel-Projekt

Die Schleife ist **projektunabhängig**. Sie nimmt jedes Paar aus Spec und Eval auf, das über eine `loop.config.json`
angeschlossen ist. Der Aristo M 64 ist ein Beispiel-Projekt dieses Kerns.

```
            ┌──────────── Fehlerbericht (failures + mustFix) ────────────┐
            ▼                                                             │
  Spec ─► BAUEN (loop-builder) ──► beschreibbare Pfade ──┬─► TESTEN (loop-tester: Siegel + Eval) ─┤
                                                          └─► BEGUTACHTEN (loop-judge: Rubrik, optional) ┘
                                                                     │ grün
                                                                     ▼
                        Referenz einfrieren (optional) → FESTHALTEN (Commit) → alle N Features: AUFRÄUMEN (loop-refactorer)
```

## Der Kern (bleibt für jedes Projekt gleich)
| Element | Datei | Aufgabe |
|---|---|---|
| Schleife | `.claude/workflows/agentic-loop.js` | Dynamic Workflow: Takt, Wiederholung, Gates, Stopps, Commits, Aufräumrunden |
| Bauen | `.claude/agents/loop-builder.md` | baut genau ein Feature, schreibt nur `writable` |
| Testen | `.claude/agents/loop-tester.md` | prüft Siegel und Eval, ändert nie Code (kein Schreibwerkzeug) |
| Begutachten | `.claude/agents/loop-judge.md` | bewertet schwer Messbares nach Rubrik und Referenzen, nur lesend, optional |
| Aufräumen | `.claude/agents/loop-refactorer.md` | verhaltenserhaltendes Refactoring mit Policy, Messung und Stoppregeln |
| Messen | `tools/code-metrics.mjs`, `tools/refactor-record.mjs`, `tools/refactor-policy.json` | allgemeine Code-Metriken, Verlauf, Ziele |
| Zuschauen | `tools/dashboard.mjs`, `tools/journal.mjs` | live sehen, welcher Agent woran arbeitet |

## Der Projekt-Anschluss: `loop.config.json`
Alles Projektspezifische steht hier, sonst nirgends:
* `spec`, `docs`: der Bauplan und was jede Rolle lesen soll
* `writable` / `frozen` / `sourceDir`: was gebaut werden darf und was versiegelt ist
* `commands`:
  * `lockCheck`: Siegel
  * `evalUpTo` (mit `{feature}`), `evalAll`: Prüfung
  * `report`: Bericht im Kern-Format
  * `capture`, `golden`: optional für den Gutachter
  * `metricsBefore`, `metricsAfter`: optional für den Aufräumer
* `judge` (optional): Rubrik, Referenzen, Belege, Endabnahme-Kriterien
* `refactor` (optional): Policy, „alle N Features“
* `guidance`: projektspezifische Hinweise an die Rollen
* `features`: die Reihenfolge, je Feature `id`, `title`, `ids`, `focus` und optional `look`, `criteria`, `gate`/`minScore`, `maxIter`, `golden`

**Kern-Format des Berichts** (`commands.report`): `{ pass, summary: { ids, passed, failed, pending, tests, testsFailed },
features: { F1: { status, ids } }, failures: [{ id, test, error }] }`. Welche Technik prüft, ist egal, solange dieser Bericht entsteht.

## Starten
* **Ein Projekt bauen:** Workflow `agentic-loop` mit `args: { root: "<Projektordner>", config?: <loop.config.json>, from?, to?, models?, refactorEvery? }`
* **Nur aufräumen:** `args: { root, refactorOnly: true, refactorMode: 'clean' | 'routine' }`
* **Neues Projekt aus einem Briefing:** Skill `/agentic-loop`
* **Dieses Projekt als Tutorial mit Live-Neubau:** Skill `/aristo-experience`

## Regeln, die der Kern durchsetzt
* **Grün ist grün:** Ein Feature gilt erst als abgenommen, wenn das Eval bis zu ihm vollständig besteht (Regression inklusive) und das Judge-Gate hält.
* **Versiegelt:** Wer baut, ändert die Prüfung nicht. Bei Manipulation stoppt die Schleife (`eval-tampered`).
* **Streit geht zum Menschen:** `eval-dispute` (Builder hält eine Prüfung für falsch), `specConflicts` (Judge hält die Spec für falsch).
* **Der Judge streut, also gestaffelte Gates:** `soft` (Standard), `look-final`, eine Mindestpunktzahl pro Feature, eine eigene Endabnahme.
  Der Judge bekommt seine letzte Bewertung mit und darf Umgesetztes nicht ins Gegenteil drehen.
* **Jedes Mal ein bisschen Ordnung:** Aufräumrunde alle N Features.
  * Modus `routine`: 1–8 Schritte.
  * Stopp bei `targets-met`, `max-steps`, `no-gain`, `reverts` oder `boy-scout`.
  * Sind Alarmwerte erreicht, empfiehlt die Schleife einen Clean-Run.
* **Festhalten:** `feat(Fxx)` nach jeder Abnahme, `refactor:` nach jeder grünen Runde. Daraus entstehen Änderungskosten pro Feature und Hotspots.
* **Nutzerstimme:** Die Workflow-Laufzeit reicht jedem Agenten die Nutzernachricht weiter, die den Lauf gestartet hat.
  Live-Bauten deshalb in einer eigenen Session starten.

## Parallele Bauweise (`agentic-loop-parallel.js`, Alternative)
Gleicher Anschluss, gleiche Rollen, gleiches Eval, dazu `commands.evalSelect` (Prüfauswahl mit `{features}`) und `parallel`
(`env` mit `{port}`, `basePort`, `maxLanes`, optional `smoke`).
1. **Architektur:** `loop-architect` leitet aus Spec, Features, Prüfungen und Code Einheiten mit Verträgen ab und ordnet jedem Feature
   `touches`, `dependsOn` und `serial` zu. Der Takt prüft den Plan mechanisch (keine Datei doppelt, alles in `writable`, kreisfrei,
   vollständig). Ungültig → einmal zurück, sonst sequenziell weiter. Der Plan landet in `loop.plan.json` (mit den Wellen).
2. **Gerüst:** fehlende Dateien der Einheiten als leere Hüllen, eingebunden vom Rahmen.
3. **Wellen:** bereit = Abhängigkeiten gebaut; dringlichste zuerst; `serial`, Golden- und Auftau-Features allein; sonst so viele
   Features mit disjunkten Einheiten wie `maxLanes`. Jede Spur (`tools/lane.mjs`) ist ein eigener git-Worktree mit eigenen Ports,
   eigener Prüfauswahl (Feature + gebaute Features derselben Einheiten + Abhängigkeiten + Rauch-Set) und nur ihren Dateien als
   `writable`. In jeder Spur läuft der normale Kern für genau dieses Feature (`noAcceptance`).
4. **Tor:** Zusammenführen nacheinander (Konflikte löst ein Handwerker, Bereichsverstöße werden gemeldet), dann **alles** Gebaute prüfen.
5. **Abnahme:** der normale Kern mit `acceptOnly`, danach der Aufräum-Bericht.

## Weiterlaufen statt Anhalten (`keepGoing`, Standard an)
Probleme werden zu **offenen Punkten** für den Menschen, die Schleife läuft konservativ weiter. Die roten IDs eines offenen Punkts gelten
als „bekannt rot“ und blockieren spätere Features nicht. Alles andere muss grün bleiben.
| Fall | was die Schleife tut |
|---|---|
| Builder bestreitet Prüfungen, **nur** diese sind rot, Judge zufrieden | Feature abgenommen, Streitpunkt → offener Punkt |
| Feature nach `maxIter` nicht grün | Stand als `wip(Fxx)` festgehalten, offener Punkt, weiter mit dem nächsten Feature |
| Referenz (Golden) lässt sich nicht einfrieren | offener Punkt, weiter |
| Aufräumrunde bleibt rot | Runde verworfen (letzter Commit), offener Punkt, weiter |
| Feature mit `thaw: true` | vor dem Bau taut `commands.thaw` die Referenz auf (umkehrbar: verschieben statt löschen), nach der Abnahme wird sie neu eingefroren. Scheitert das Auftauen: offener Punkt |
| eine „bekannt rote“ ID ist wieder grün | sie fliegt von der Liste und ist wieder geschützt |

## Status am Ende (`status`)
| status | Bedeutung | wer handelt |
|---|---|---|
| `done` | alles grün | – |
| `done-with-open-points` | fertig, mit `openPoints` und `knownRed` | Mensch: Punkte entscheiden; für eine Folgestufe `knownRed` als args mitgeben |
| `too-many-open-points` | mehr als `maxOpenPoints` (Standard 3) | Mensch: Ursache klären, dann mit `resumeFromRunId` fortsetzen |
| `eval-tampered` | Siegel verletzt | Mensch |
| `final-failed`, `config-missing`, `aborted`, `refactor-failed` (Verwerfen gescheitert) | Schritt gescheitert | Mensch |
Mit `keepGoing: false` hält die Schleife wie früher beim ersten Problem an (`stuck`, `eval-dispute`, `golden-failed`, `refactor-failed`).

## Aristo M 64: Befehle dieses Beispiel-Projekts
```bash
npm start                      # http://localhost:4173
npm run eval                   # komplette Suite
npm run eval -- --feature F3   # Feature + Regression
npm run eval:judge             # visueller Gutachter headless (loop-judge)
```
