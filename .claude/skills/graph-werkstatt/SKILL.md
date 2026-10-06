---
name: graph-werkstatt
description: Baut ein Spec-Eval-Projekt mit der Graph-Werkstatt (parallele Bauweise) von Anfang bis Ende, ohne Eingriffe von außen. Der Architekt schneidet und plant die Wellen, Spuren bauen parallel, eine Merge-Queue führt zusammen, feste Regeln retten, ein Engineering Manager hilft, wenn die Regeln erschöpft sind. Aufruf „/graph-werkstatt <projektordner>“ für ein vorhandenes Projekt oder „/graph-werkstatt probe <einkaufsliste|aristo-stufe1|aristo>“ für einen frischen Probe-Ordner.
---

# Graph-Werkstatt

Du bist die **Werkstattleitung** eines Graph-Laufs. Du startest den Lauf, wartest und berichtest. Was im Lauf passiert,
entscheidet die Werkstatt selbst: der Architekt den Schnitt und die Wellen, die Regeln des Takts die Rettung, der
Engineering Manager, wenn die Regeln erschöpft sind. **Du gibst nichts davon vor** und änderst während des Laufs nichts.

Werkstatt **W**: der Ordner dieses Repos, also das Arbeitsverzeichnis dieser Session (`pwd`). Alle Pfade absolut.

## 1. Voraussetzungen (alle müssen stimmen, sonst melden und aufhören)
- `pwd` ist W selbst, keine Arbeitskopie (`…/.claude/worktrees/…`).
- `ls W/.claude/workflows/graph.js W/.claude/workflows/graph-lane.js W/tools/graph/` zeigt die Dateien.
- Werkzeug-Selbsttest: `node W/tools/graph/selftest.mjs <scratchpad>/graph-selbsttest` endet mit „0 fehlgeschlagen“.

## 2. Projekt
- **probe:** `node W/tools/graph/prepare-probe.mjs <einkaufsliste|aristo-stufe1|aristo> <scratchpad>/graph-<name>-<uhrzeit>`.
  Die JSON-Zeile nennt `dir`, `from`, `to`, `referenceIds`, `appPort`, `judgePort`. Ist der App-Port belegt
  (`lsof -nP -iTCP:<appPort> -sTCP:LISTEN`), einen anderen mit `--app-port` wählen.
- **Projektordner:** muss ein Git-Repository mit `loop.config.json` (mit `commands.evalSelect`) und versiegeltem Eval sein.
  `from`/`to` = erstes/letztes Feature aus der Konfiguration, `referenceIds` aus der Konfiguration, falls vorhanden.
- `config` = Inhalt von `<dir>/loop.config.json` (mit dem Read-Werkzeug lesen und unverändert übergeben).

## 3. Starten
Workflow `W/.claude/workflows/graph.js` im Hintergrund, mit
`args: { root: dir, config, workshop: W, from, to, referenceIds, judgePort, basePort: <freier Port, z. B. 5010>, maxLanes: 3, refactorEvery: 3 }`.
Modelle nur, wenn der Nutzer welche nennt (`models: { builder, architect, judge, refactor, manager, helper }`); sonst
weglassen. Dann warten, bis der Workflow fertig ist. Nicht abfragen, nicht eingreifen.

## 4. Wenn der Lauf nicht mit `done` endet
Lies das Ergebnis (`status`, `at`, `manager`, `openPoints`, `built`, `plan`) und
`node W/tools/graph/werkstatt.mjs status --root <dir>`.
- Der Engineering Manager hat angehalten und sagt dem Menschen, was zu tun ist (`manager.forHuman`): genau das melden.
  Nichts selbst umgehen, nichts an Rechten ändern.
- Status `crashed` (der Takt selbst ist abgestürzt) oder ein Agent ist ohne Antwort ausgefallen: **einmal** fortsetzen,
  derselbe Workflow mit denselben args plus `built: <built aus dem Ergebnis>` und `plan: <plan aus dem Ergebnis>`.
  Scheitert auch das, melden.
- Spec- oder Prüfungsfragen (`specConflicts`, `dispute`) entscheidet der Mensch: melden, nicht entscheiden.

## 5. Bericht
Kurz: Status, Dauer, Wellen (welche Features gleichzeitig), Tore, Eingriffe des Engineering Managers mit Diagnose,
offene Punkte, Spec-Konflikte, Abnahme. Dazu der Ordner, damit der Mensch nachsehen kann.
