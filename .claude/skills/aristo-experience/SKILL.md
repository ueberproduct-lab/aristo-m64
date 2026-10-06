---
name: aristo-experience
description: Startet das Aristo-M-64-Tutorial von überproduct über vier Bauweisen (Vibe-Coding One Shot, Direktbau, Agentic Loop Engineering, Graph/parallel). Öffnet die Erlebnisseite, hört auf ihre Startknöpfe und lässt den gewählten Weg live in einem frischen Bau-Ordner bauen. Verwenden, wenn der Nutzer das Tutorial, die Demo oder einen Live-Bau des Aristo-Rechners starten will; „/aristo-experience dokumentieren <oneshot|direct|loop|graph>“ baut einen Weg und dokumentiert ihn mit der gemeinsamen Bewertung.
---

# Aristo M 64 — vier Bauweisen, live

Du bist der **Werkstattleiter (Orchestrator)**. Die Seite erklärt die vier Bauweisen und zeigt ihre dokumentierten Ergebnisse
(`experience/results.json`). Auf Knopfdruck baust du einen Weg live. Projekt **W**: der Ordner dieses Repos, also das
Arbeitsverzeichnis dieser Session (zu Beginn mit `pwd` ermitteln; immer absolute Pfade `W/…` verwenden, nie per `cd` das
Arbeitsverzeichnis wechseln). Der fertige Rechner in `src/` (Port 4173) wird
**nie** angefasst. Ein Live-Bau läuft in `demo-runs/<variante>-<stempel>/` mit eigenem Git-Repo, App-Port 4273, Foto-Port 4274,
parallele Spuren ab 4310. Es läuft immer nur ein Bau zur Zeit.

Argumente:
- keins: einrichten, Seite öffnen, zuhören und auf Knopfdruck bauen (Abschnitte 0–4). Das ist der einzige Weg für Besucher:
  Wer nur schauen will, schaut; wer bauen will, drückt einen Knopf. Fragen kommen erst, wenn gebaut wird.
- `dokumentieren <variante>`: diesen Weg einmal bauen **und** mit der gemeinsamen Bewertung dokumentieren (Abschnitte 0, 1,
  die Fragen aus Abschnitt 3, dann 5).
  Das ist für die vordokumentierten Ergebnisse gedacht, nicht für Besucher.

## 0. Ab jetzt nur Steuerbefehle
**Ab dem Aufruf nur noch Steuerbefehle.** Die Workflow-Laufzeit reicht jedem Agenten die letzte Nachricht des Nutzers weiter,
mit Vorrang vor dem Skript. Das ist ab jetzt dieser Aufruf (oder eine Antwort auf deine Fragen); was vorher in der Session
besprochen wurde, spielt keine Rolle. Schick niemanden in eine neue Session. Sag zu Beginn in einem Satz: Ab jetzt hier nur noch
auf meine Fragen antworten oder einen Lauf fortsetzen; Fragen zum Projekt bitte in einer anderen Session.

**Nur im Hauptordner bauen.** Bauen und Dokumentieren laufen ausschließlich in einer Session, deren Arbeitsordner
der Hauptordner des Repos selbst ist, nicht eine Arbeitskopie (git worktree, z. B. `…/.claude/worktrees/…`). Eine
Session in einer Arbeitskopie darf nicht in `demo-runs/` schreiben und keine Workflows aus dem Hauptordner starten. Prüfe das
zuerst (`pwd`); liegt die Session woanders, bitte um eine neue Session im Hauptordner und beende hier. `spawn_task` legt immer
eine Arbeitskopie an und taugt deshalb nicht zum Bauen.

## 1. Server bereitstellen
**Einrichtung beim ersten Start:** Fehlt `W/node_modules`, dann sag in einem Satz, dass du einmalig einrichtest, und führe in W aus:
`npm install`, `npx playwright install chromium`, `npm run eval`. Das Eval muss mit „106/106“ enden; sonst die letzte
Ausgabe zeigen und hier aufhören. Danach weiter.

Prüfe mit `curl -s -o /dev/null -w "%{http_code}" http://localhost:<port>/` und starte Fehlendes über `.claude/launch.json` (preview_start):
- `experience` auf 4191 (Pflicht). Läuft er schon, prüfe, ob er die neue Seite kennt:
  `curl -s http://localhost:4191/api/state | grep -q '"listening":'`. Sonst `lsof -ti tcp:4191 -sTCP:LISTEN | xargs -r kill` und neu starten.
- `app`: der fertige Rechner auf 4173. Starte ihn als `node ./server.mjs` (mit `./`, das schützt vor fremdem `pkill`).

## 2. Seite öffnen
`node W/experience/run.mjs ready`, dann
öffne `http://localhost:4191/` (den Anfang der Seite, nicht die Werkstatt: erst die Geschichte, dann die Bauweisen) im Standardbrowser (macOS `open <url>`, Linux
`xdg-open <url>`, Windows `start <url>`) und nenne die Adresse im Chat.
Sag in zwei Sätzen: Die Seite erzählt, wie der Rechner entstanden ist, und zeigt vier Bauweisen mit dokumentierten Ergebnissen.
Wer selbst bauen will, drückt in der Werkstatt den Knopf einer Bauweise und beantwortet dann hier zwei kurze Fragen.

## 3. Zuhören
Lade das Monitor-Tool (ToolSearch `select:Monitor`) und warte, bis die Seite einen Bau anfordert. Das Lebenszeichen sagt der Seite,
dass jemand zuhört (ohne es bleiben ihre Knöpfe gesperrt):
`until grep -q '"phase": "start-requested"' W/experience/state.json; do touch W/experience/.listening; sleep 3; done`
Dann `requested` aus `run.mjs status` lesen, beim ersten Bau dieser Session Modelle und Umfang abfragen (unten) und den Weg bauen
(Abschnitt 4). Danach wieder hierher.

**Modelle und Umfang abfragen** (AskUserQuestion, zwei Fragen in einem Aufruf). Frage 1 „Modelle“:
| Option | builder | judge | refactor | tester | helper |
|---|---|---|---|---|---|
| Ausgewogen (empfohlen) | opus | opus | sonnet | haiku | haiku |
| Maximale Qualität | opus | opus | opus | opus | opus |
| Sparsam | sonnet | sonnet | sonnet | haiku | haiku |
| Wie diese Session | – | – | – | – | – |
Speichern: `node W/experience/run.mjs models '<json>'` (bei „Wie diese Session“: `'{}'`).

Frage 2 „Umfang“: „Beide Stufen (empfohlen, F1–F15)“ → `run.mjs scope both`, „Nur Stufe 1 (F1–F7)“ → `run.mjs scope stage1`.
Die Spec liegt immer vollständig im Bau-Ordner; geprüft und gebaut wird der gewählte Umfang.

Sagt der Nutzer im Chat einen Weg an, gilt das wie ein Knopfdruck.

## 4. Einen Weg bauen
1. Zuerst einen alten App-Server beenden: `lsof -ti tcp:4273 -sTCP:LISTEN | xargs -r kill` (sonst zeigt die Seite kurz einen fremden Rechner).
   Dann `node …/experience/run.mjs init <variante>`. Das legt den Bau-Ordner an und setzt die Phase `building`.
2. App-Server des Bau-Ordners im Hintergrund starten: `node ./server.mjs` mit `cwd` = runDir.
3. `config` = Inhalt von `<runDir>/loop.config.json`, `models` aus `run.mjs status`. Alle Workflows laufen im Hintergrund, nicht pollen.
   **Workflow-Skripte immer aus dem eigenen Arbeitsordner dieser Session** nehmen: `<cwd>/.claude/workflows/<name>.js`
   (in einer Arbeitskopie also deren Kopie, nicht die des Hauptordners). Workflows dürfen nur
   Skripte starten, die die Session lesen darf.
   Die `node`-Befehle (`run.mjs`, `record.mjs`, `snapshot.mjs`) und alle Bau-Ordner bleiben absolut im Hauptordner.
   - **oneshot:** Workflow `one-pass` (`scriptPath` `W/.claude/workflows/one-pass.js`),
     `args: { root, config, models, input: "briefing" }`. Er bekommt nur `briefing/ONESHOT-PROMPT.md` und die Fotos.
   - **direct:** Workflow `one-pass` mit `input: "spec"` (bei Umfang `stage1` zusätzlich `to: "F7"`).
   - **loop:** Stufe 1: `run.mjs phase stage1`, Workflow `agentic-loop` (`…/.claude/workflows/agentic-loop.js`) mit
     `args: { root, config, judgePort: 4274, models, from: "F1", to: "F7", maxIter: 4, refactorEvery: 3, skipFinalJudge: true }`.
     Bei `done`/`done-with-open-points` und Umfang `both`: `run.mjs stage2`, etwa 30 s Pause (Monitor mit `sleep 30`), `run.mjs phase stage2`,
     `config` neu lesen, derselbe Workflow mit `from: "F8", to: "F15", maxIter: 5, refactorEvery: 3, knownRed: <knownRed aus Stufe 1>`.
   - **graph:** die Graph-Werkstatt (`W/.claude/workflows/graph.js`), eigenständig und
     unabhängig vom Loop. Stufe 1: `run.mjs phase stage1`, Workflow `graph` mit
     `args: { root, config, workshop: <W als absoluter Pfad>, models, from: "F1", to: "F7", maxIter: 4, maxLanes: 3,
     basePort: 4310, judgePort: 4274, refactorEvery: 3, referenceIds: ["G-01", "G-02"] }`.
     Bei `done`/`done-with-open-points` und Umfang `both`: Stufenwechsel wie bei loop, dann derselbe Workflow mit
     `from: "F8", to: "F15", maxIter: 5, knownRed: <knownRed aus Stufe 1>, finalJudge: true` und der neu gelesenen `config`
     (ohne `plan`: der Architekt schneidet für Stufe 2 neu und berücksichtigt den vorhandenen Code). Bei Umfang `stage1`
     schon in Stufe 1 `finalJudge: true`.
     Wie es geschnitten und in Wellen gebaut wird, entscheidet die Werkstatt selbst; nichts davon vorgeben.
     Endet der Workflow nicht mit `done…`: so verfahren wie im Skill `graph-werkstatt`, Abschnitt 4 (einmal fortsetzen mit
     `built` und `plan` aus dem Ergebnis, wenn der Takt abstürzte oder ein Agent ausfiel; sonst die Diagnose des
     Engineering Managers melden). Nie eine Verweigerung umgehen.
4. Ende: `run.mjs phase done` (bei einem Halt `run.mjs phase failed`, Status und Ursache nennen, den Nutzer entscheiden lassen,
   Wiederaufnahme mit `resumeFromRunId` und gleichen args; beim Graph gilt der Absatz oben). Kurz zusammenfassen: Dauer, Stand,
   offene Punkte (beim Graph auch: Wellen, Eingriffe des Engineering Managers, Rücknahmen).
   Ein Live-Bau für Besucher wird **nicht** bewertet und nicht in die Dokumentation übernommen. Zurück zu Abschnitt 3.

## 5. Dokumentieren (`dokumentieren <variante>`)
Wie Abschnitt 4, ohne auf die Seite zu warten. Ohne Server gibt es keine Live-Ansicht: Abschnitt 1 (Server) gilt auch hier.
Gleich nach `run.mjs init`: `http://localhost:4191/#bauweisen` wie in Abschnitt 2 öffnen und im Chat in einem Satz sagen, wo der Lauf live
zu verfolgen ist: http://localhost:4191/#bauweisen, Tab der Bauweise. Danach die **gemeinsame Bewertung**, gleich für alle vier Wege:
1. `run.mjs phase assessing`, dann Workflow `assess` (`…/.claude/workflows/assess.js`) mit
   `args: { root, config, judgePort: 4274, models, tests: <false bei oneshot, sonst true> }`. Gutachter und Aufräumer bewerten blind:
   Treue zu den Fotos, freie Funktionsprobe (`eval/free-rubric.md`), Code-Note; dazu die versiegelte Prüfung, wo sie passt.
2. Ergebnis als JSON nach `<runDir>/assess.json`, dann
   `node …/experience/record.mjs <variante> --dir <runDir> --assess <runDir>/assess.json --started <startedAt aus run.mjs status> --tokens <Summe der Tokens aller Workflows dieses Laufs, falls gemeldet>`.
   Das schreibt `experience/results.json` und kopiert die Bilder nach `experience/results/<variante>/`.
   Dann das Protokoll des Laufs einfrieren (Aktivitäts-Zeitleiste, Features, Aufräumrunden, Plan):
   `node …/experience/snapshot.mjs <variante> --dir <runDir> --from <startedAt> --to <Ende des Baus, vor der Bewertung>`.
3. Im Hauptrepo committen: `git add experience/results.json experience/results/<variante>` mit Nachricht „docs: <Bauweise> dokumentiert“.
4. `run.mjs phase done` und die Zahlen nennen. Die Seite zeigt sie sofort.

## Regeln
- Spec und Eval eines laufenden Baus nicht ändern, außer dem vorgesehenen Stufenwechsel. Spec-Konflikte entscheidet der Mensch.
- Der One Shot bekommt nichts außer seinem Prompt und den Fotos. Keine Hinweise, keine Hilfe.
- Den fertigen Rechner (`src/`, Port 4173) nicht anfassen. Keine Commits im Hauptrepo durch einen Bau, außer der Dokumentation in Abschnitt 5.
