---
name: agentic-loop
description: Der allgemeine Agentic-Loop-Kern von überproduct für beliebige Projekte. „neu <Ordner>“ setzt aus einem Briefing ein Spec-Eval-Projekt auf (Kern installieren, Rückfragen, Spec mit IDs, versiegeltes Eval, loop.config.json). „bauen <Ordner>“ lässt Builder, Tester, Judge und Refactorer Feature für Feature bauen, bis das Eval grün ist. „aufräumen <Ordner>“ macht einen Refactor-Lauf gegen die Tests. Verwenden, wenn jemand etwas nach dem Spec-Eval-Muster mit Agenten bauen lassen will, auch außerhalb des Aristo-Rechners.
---

# Agentic Loop — der allgemeine Kern

Die Schleife (`.claude/workflows/agentic-loop.js`) und die vier Rollen (`.claude/agents/loop-*.md`) kennen kein Projekt.
Sie lesen alles Projektspezifische aus `<Ordner>/loop.config.json`. **Jedes Spec-Eval-Paar, das den Vertrag erfüllt, kann
gebaut werden:**
- `commands.evalUpTo` mit `{feature}` prüft F0 bis zu diesem Feature und schreibt einen Bericht im Kern-Format.
- `commands.lockCheck` schlägt fehl, sobald Versiegeltes verändert wurde.
- `features[]` gibt Reihenfolge, IDs und Fokus vor.

Kern-Quelle **W**: der Ordner dieses Repos, also das Arbeitsverzeichnis dieser Session (`pwd`) (Bausatz in `kit/`, Doku in `kit/README.md`). Immer absolute Pfade verwenden.

Argument lesen: `neu <Ordner>`, `bauen <Ordner>`, `aufräumen <Ordner>` oder `gegenprobe <Ordner>`. Ohne Argument fragst du per AskUserQuestion,
was ansteht.

## neu <Ordner>: vom Briefing zum versiegelten Eval
Ziel: Am Ende steht ein Projekt, dessen Eval **rot** ist und das die Schleife bauen kann. Gebaut wird hier noch nichts.
1. **Kern installieren:** `node W/kit/install.mjs <Ordner> --name "<Name>"`
   (kopiert Schleife, Rollen, Mess-Werkzeuge, Vorlagen und diesen Skill, dann `git init`).
2. **Briefing:** Lass dir das Vorhaben in eigenen Worten geben und trag es **wörtlich** in `briefing/BRIEFING.md` ein.
3. **Rückfragen:** Höchstens vier, per AskUserQuestion. Frag nur, was Spec oder Prüfbarkeit wirklich verändert, etwa Umfang,
   Plattform, Referenzen für Aussehen, „fertig heißt …“. Die Antworten kommen in die Tabelle „Klarstellungen“.
4. **Spec** (`SPEC.md` nach Vorlage):
   - Jede Anforderung bekommt eine ID und ist überprüfbar: „messbar durch …“ wird ausgefüllt, nichts bleibt vage.
   - Zahlen und Toleranzen stehen an einer Stelle (Tabelle oder `spec/tokens.json`).
   - Schneide 4–10 Features mit **F0 Gerüst** am Anfang. Jedes Feature soll in 1–4 Builder-Durchläufen schaffbar sein.
   - Schwer Messbares (Aussehen, Ton, Texte) kommt als Rubrik für den Gutachter dazu, mit Referenzen.
5. **Eval** (`eval/`, `EVAL.md`):
   - Wähle die Prüftechnik passend zum Stack, z. B. `node:test`, Playwright, pytest, HTTP-Aufrufe oder Shell-Skripte.
   - Jeder Test beginnt mit seiner ID. Ein Runner führt „bis Feature X“ aus und schreibt `eval/report.json` im Kern-Format
     (siehe `EVAL.md`). Gib dazu ein paar Testfälle aus dem Briefing wörtlich wieder.
   - Gutachter-Anteil, falls nötig: `eval/visual-rubric.md` (Kriterien à 0–2) und ein `capture`-Befehl für Screenshots.
   - Für die parallele Bauweise: Der Runner kann eine Auswahl von Features prüfen (`commands.evalSelect` mit `{features}`), und
     Server und Prüfung nehmen ihren Port aus einer Umgebungsvariable (`parallel.env`).
6. **loop.config.json** ausfüllen:
   - `writable`, `frozen`, `seal` und alle `commands`
   - `features` aus der Spec-Tabelle (`look: true` + `criteria` für Gutachter-Features)
   - `guidance.builder` mit Stack und Stil
   - `judge` nur, wenn es eine Rubrik gibt
   - `refactor` nur, wenn `tools/code-metrics.mjs` zum Stack passt (JS/CSS/HTML) oder ein eigenes Metrik-Skript existiert
7. **F0-Gerüst** selbst anlegen (Server, Paketdatei, Testlauf), Abhängigkeiten installieren.
8. **Siegel:** `node eval/seal.mjs --write`, dann `--check` muss grün sein.
9. **Sanity rot:** Gesamtes Eval ausführen. Erwartung: E-00 grün, alles andere rot. Ist ein Test schon grün, prüft er nichts,
   also nachschärfen und neu versiegeln.
10. **Commit** „Spec und Eval“ im Projekt-Repo, mit Co-Authored-By-Zeile.
11. **Übergabe:** Sag dem Nutzer: Gebaut wird in einer **eigenen Session** mit `/agentic-loop bauen <Ordner>` (Begründung siehe unten).
    Biete an, sie per `mcp__ccd_session__spawn_task` anzulegen (cwd = `<Ordner>`).

## bauen <Ordner>: die Schleife fahren
1. **Eigene Session:** Die Workflow-Laufzeit reicht die auslösende Nutzernachricht mit Vorrang an jeden Agenten weiter.
   Gab es in dieser Session vor dem Aufruf schon andere Themen, starte nicht hier, sondern lege per
   `mcp__ccd_session__spawn_task` eine neue Session an (Prompt `/agentic-loop bauen <Ordner>`, cwd `<Ordner>`). Sag dem Nutzer:
   Dort während des Baus nur Steuerbefehle (fortsetzen, Entscheidung nach einem Halt), alles andere in einer anderen Session.
2. **Vorbedingungen:** `<Ordner>/loop.config.json` existiert, `commands.lockCheck` ist grün und die Arbeitskopie ist sauber
   (`git -C <Ordner> status --porcelain`). Fehlt etwas, dann `neu` empfehlen und aufhören.
3. **Modelle** per AskUserQuestion („Modelle“):
   | Option | builder | judge | refactor | tester | helper |
   |---|---|---|---|---|---|
   | Ausgewogen (empfohlen) | opus | opus | sonnet | haiku | haiku |
   | Maximale Qualität | opus | opus | opus | opus | opus |
   | Sparsam | sonnet | sonnet | sonnet | haiku | haiku |
   | Wie diese Session | – | – | – | – | – |
4. **Bauweise** per AskUserQuestion: sequenziell (Standard) oder parallel. Parallel braucht `commands.evalSelect` und `parallel` im
   Anschluss; fehlt das, sequenziell bauen und es sagen.
5. **Start:** sequenziell Workflow mit `scriptPath` = `<Ordner>/.claude/workflows/agentic-loop.js`, parallel mit
   `<Ordner>/.claude/workflows/agentic-loop-parallel.js` (zusätzlich `coreScript` = Pfad des sequenziellen Takts, `maxLanes: 3`,
   bei einer Folgestufe `plan` = Inhalt von `loop.plan.json`), jeweils
   `args: { root: "<Ordner>", config: <Inhalt von loop.config.json>, models, maxIter: 4, refactorEvery: <refactor.every> }`.
   `from`/`to` nur, wenn der Nutzer einen Ausschnitt will. `judgePort` nur, wenn der Capture-Befehl einen Port braucht.
   Läuft im Hintergrund. Nicht pollen.
6. **Ergebnis:** Bei `done` oder `done-with-open-points`: Iterationen pro Feature, Refactor-Runden (Stoppgrund, Wirkung aus
   `refactor-history.jsonl`), Commits, Judge-Punkte und jeden offenen Punkt mit der Entscheidung, die der Mensch treffen muss.
   Der Kern läuft bei Streitpunkten, festgefahrenen Features und roten Aufräumrunden konservativ weiter (LOOP.md).
   Bei einem anderen Status (`too-many-open-points`, `eval-tampered`, `final-failed`, `aborted`) Status und Ursache nennen und
   den Nutzer entscheiden lassen. Danach mit `resumeFromRunId` fortsetzen.

## gegenprobe <Ordner>: andere Bauweisen zum Vergleich
1. Den Projektordner ohne Bauergebnis in einen frischen Nachbarordner klonen (Commit „Spec und Eval“), `writable` auf das Gerüst zurücksetzen.
2. Workflow `<Ordner>/.claude/workflows/one-pass.js` mit `args: { root: "<Klon>", config, models, input: "spec" }` (Direktbau) oder
   `input: "briefing"` mit `prompt` (Pfad zu einem Auftrag ohne Spec, One Shot).
3. Beide Ordner gleich bewerten: `assess.js` mit `args: { root, config, models, tests }` (`tests: false` für One Shot).

## aufräumen <Ordner>: Refactor-Lauf
Gleiche Vorbedingungen wie bei `bauen`, dann den Workflow mit `args: { root, config, models, refactorOnly: true, refactorMode: "clean" }`.
Berichte das Vorher/Nachher der Kennzahlen aus `refactor-history.jsonl`.

## Regeln
- **Spec und Eval bleiben fest**, sobald gebaut wird. Konflikte (`evalDispute`, `specConflicts`) entscheidet der Mensch.
  Eine Änderung heißt: neue Spec-Version, neues Siegel, eigener Commit, dann erst weiterbauen.
- Der Kern wird pro Projekt nicht angepasst. Projektspezifisches gehört in `loop.config.json` und `guidance`.
- Was der Gutachter wiederholt findet, wird beim nächsten Spec-Stand zu einer festen Prüfung.
