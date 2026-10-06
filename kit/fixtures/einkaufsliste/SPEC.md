# Einkaufsliste – Spec

Ein kleines Kommandozeilen-Werkzeug, das eine Einkaufsliste als Text einliest und aufbereitet. Reines Node.js (ES-Module),
keine Abhängigkeiten. Alles liegt in `src/`. Übungsprojekt für die Werkstatt: klein, schnell geprüft, mit allen Bausteinen
eines echten Projekts (Verträge, Abhängigkeiten, eine eingefrorene Referenz).

## 1. Verträge
- `src/parse.mjs` exportiert `parse(text) → Item[]`. Ein `Item` ist `{ name: string, qty: number, unit: string|null }`.
- `src/totals.mjs` exportiert `totals(items) → Item[]`.
- `src/categories.mjs` exportiert `categoryOf(name) → string`.
- `src/render.mjs` exportiert `render(items, { grouped = false } = {}) → string`.
- `src/cli.mjs`: `node src/cli.mjs <datei>` liest die Datei, wendet `parse` und `totals` an und gibt `render(…, { grouped: true })` aus.

## 2. Features
### F0 Gerüst
`package.json` mit `"type": "module"`, Ordner `src/`.

### F1 Einlesen (P-01 … P-04)
Eine Zeile pro Eintrag. Leere Zeilen und Zeilen, die mit `#` beginnen, werden übersprungen. Formen:
- `Milch` → qty 1, unit null
- `3 Äpfel` → qty 3
- `2x Brot` oder `2 x Brot` → qty 2
- `500 g Mehl` → qty 500, unit `g`; Einheiten: `g`, `kg`, `ml`, `l`
Namen werden getrimmt, Groß-/Kleinschreibung bleibt erhalten. Unlesbare Mengen (`zwei Eier`) zählen als Teil des Namens, qty 1.

### F2 Summen (S-01 … S-03)
`totals` fasst gleiche Einträge zusammen: gleicher Name (ohne Rücksicht auf Groß-/Kleinschreibung, die erste Schreibweise gilt)
und gleiche Einheit. Mengen werden addiert. `kg` wird in `g` und `l` in `ml` umgerechnet, bevor addiert wird. Reihenfolge:
erstes Vorkommen.

### F3 Ausgabe (R-01 … R-03, G-01)
`render` gibt eine Zeile pro Eintrag aus: Menge rechtsbündig in einer Spalte der Breite 6, ein Leerzeichen, Einheit (falls
vorhanden) und ein Leerzeichen, dann der Name. Kein abschließender Zeilenumbruch. Leere Liste → `(leer)`.
G-01 friert die Ausgabe der CLI für die Beispielliste `eval/sample.txt` ein (Referenz). Sie nutzt `parse` und `totals`.

### F4 Kategorien (K-01 … K-03)
`categoryOf` ordnet nach Stichworten (ohne Rücksicht auf Groß-/Kleinschreibung, Teilwort genügt):
`Obst & Gemüse` (apfel, äpfel, banane, tomate, gurke, salat), `Milchprodukte` (milch, käse, joghurt, butter),
`Backwaren` (brot, brötchen, mehl), sonst `Sonstiges`.

### F5 Gruppierte Ausgabe (R-04, R-05) – darf die Referenz ändern
`render(items, { grouped: true })` gruppiert nach Kategorie in der Reihenfolge `Obst & Gemüse`, `Milchprodukte`, `Backwaren`,
`Sonstiges`; leere Kategorien entfallen. Jede Gruppe beginnt mit einer Zeile `## <Kategorie>`, danach ihre Einträge wie in F3,
zwischen Gruppen eine Leerzeile. Die CLI nutzt die gruppierte Ausgabe; deshalb ändert sich die Referenz G-01.
