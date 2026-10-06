# Architekten-Pläne (Probe, 3. Oktober 2026)

Erster echter Test von `loop-architect`: Findet ein allgemeiner Agent die Aufteilung selbst, ohne dass sie vorgegeben ist?
Beide Pläne sind vom parallelen Takt mechanisch geprüft (gültig) und in Wellen geplant (`maxLanes: 3`). Gespeichert sind die
geprüften Teile (Einheiten, Dateien, Zuordnung); Verträge und Begründungen standen ausführlich in den Antworten der Agenten.

| Projekt | Einheiten | Wellen |
|---|---|---|
| Aristo M 64 (vollständige Spec 2.1, Neubau) | 13: Rahmen, Verdrahtung, Auslieferung, Rechenlogik, Anzeige, Front, Hülle, Easter Eggs, Schalter, Tastenfeld, Eingabe, Klangsynthese, Klangwiedergabe | Stufe 1: F1 · F4+F2 · F7+F5 · F3 · F6 – Stufe 2: F10+F9 · F8 · F11+F15 · F12 · F13 · F14 (11 statt 15 Schritte; fünf Golden-Features laufen allein) |
| Termin-Buchung (fremde Spec, nie gesehen) | 9: Rahmen mit automatischer Routen-Verdrahtung, Speicher, Slots, Postausgang, Buchungen, Praxis-API, Buchungsseite, Praxisseite, Erinnerungen | F1 · F2 · F3 · F5+F4+F6 · F7+F8 (5 statt 8) |

Bemerkenswert: Bei der Termin-Buchung hat der Architekt den typischen Engpass (eine zentrale Server-Datei) selbst aufgelöst,
indem der Server jede Datei in `src/routes/` lädt. Bei Aristo hat er Abhängigkeiten aus den Prüfungen abgeleitet (F3 braucht den
Tastendruck aus F4, Flackern und Klang werden mit physischen Tasten geprüft und brauchen F7).
