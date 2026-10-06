# SPEC — <Projektname>

Version 1.0 · <Datum> · Auftraggeber: <Name>

> Der Bauplan. Jede Anforderung hat eine ID (z. B. `F-01` für Funktion, `L-01` für Look, `Q-01` für Qualität). Zu jeder ID gibt es
> in `eval/` mindestens eine Prüfung mit genau dieser ID im Titel. Zahlen, Grenzwerte und Toleranzen stehen an **einer** Stelle.

## 1. Ziel
<Was soll entstehen, für wen, woran erkennt man „fertig“? Aus dem Briefing, in zwei bis vier Sätzen.>

## 2. Nicht-Ziele
<Was ausdrücklich nicht dazugehört.>

## 3. Technik und Verträge
<Stack, Schnittstellen, Dateien, Test-Hooks: alles, worauf sich Builder und Prüfungen verlassen müssen.>

## 4. Anforderungen nach Feature
### F1 — <Titel>
| ID | Anforderung | messbar durch |
|---|---|---|
| F-01 | <eine überprüfbare Aussage> | <Prüfmethode> |

## 5. Features und Reihenfolge
| Feature | IDs |
|---|---|
| F0 Gerüst | E-00 |
| F1 <Titel> | F-01… |

**Definition of Done:** Die komplette Suite ist grün, das Siegel ist intakt und (falls es einen Gutachter gibt) das Endabnahme-Gate ist bestanden.
