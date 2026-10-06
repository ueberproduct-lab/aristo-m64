# Briefing — der Ausgangspunkt

Alles in diesem Projekt (Spec, Eval, Agenten, Schleife, Rechner) ist aus diesem kurzen Briefing entstanden.
Es ist der Originalprompt vom Anfang, wörtlich und mit Tippfehlern, dazu die Klarstellungen aus den ersten Minuten.

## Originalprompt (Markus, 3. Oktober 2026)

> Lass uns eine WebApp Taschenrechner bauen. Im spec evel pattern. Schreibe eine Spec und eine Eval.
>
> Der Calc soll lediglich die 4 Grundrechenarten können, plus Wurzel und Prozentrechnung.
>
> Das Wichtigste: IM Look and Feel solle r aussehen udn wirken wie der klassische Aristo M 85 S:
>
> Baue die Agenten, die sowohl den Code generieren als auch die jenigen die ihn testen. mache eine explizite
> loop daraus. baue feature für feature bis die webapp fertig ist und der Eval entspricht. die app muss nut
> local auf local host laufen.
>
> wichtig ist, dass das look and feel auch spezifiziert und testbar ist.

## Klarstellungen in den ersten Minuten

| Frage | Antwort |
|---|---|
| Das Original M 85 S hat keine %-Taste, √ liegt auf einer Zweitbelegung. Wie damit umgehen? | „Authentisch, wir wechseln aber zum einfacheren **M 64**.“ Dieser hat genau die gewünschten Funktionen. |
| Was passiert mit Tasten und Schaltern ohne Funktion? | „Sichtbar lassen, aber nicht funktionale mit einem **ganz leichten Grauschleier**.“ |
| Sind die Tests explizit und wiederholt ausführbar? | Ja: Jeder Test ist eine Datei, `npm run eval` läuft jederzeit. |
| Baust du es direkt mit Dynamic Workflows? | Ja: Die Schleife ist ein Workflow-Skript, also Code und nicht nur eine Anweisung. |

## Was daraus wurde

1. **Spec** (`SPEC.md`): der Bauplan mit über 100 nummerierten Anforderungen, darunter auch messbare Anforderungen an den Look.
2. **Tokens** (`spec/tokens.json`): alle Farben, Maße und Grenzwerte an einer Stelle.
3. **Eval** (`EVAL.md`, `eval/`): über 200 automatische Prüfungen, versiegelt mit `eval.lock`.
4. **Agenten** (`.claude/agents/`): Builder, Tester, visueller Judge und Refactorer, jeweils mit klarer Rolle.
5. **Schleife** (`.claude/workflows/agentic-loop.js`): Bauen, Prüfen und Nachbessern, Feature für Feature.
6. **Der Rechner** (`src/`): das Ergebnis, auf http://localhost:4173.
