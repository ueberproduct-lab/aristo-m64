# Visuelle Rubrik — Aristo M 64

Der Judge vergleicht die Screenshots in `eval/artifacts/current-*.png` mit den Fotos in
`spec/reference/`. `current-device.png` zeigt das Gerät mit Schutzhülle (Referenz: `m64-computersammler.jpg`,
`m64-mit-schutzhuelle-seite.jpg`), `current-device-nocase.png` ohne Hülle (Referenz: `m64-ohne-schutzhuelle.jpg`). Er bewertet nicht den Code, sondern **nur, was man sieht**.
**Proportionen** (inkl. Breite): verbindlich ist das frontale Foto `m85s-front-proportionen.png` (Schwestermodell M 85 S, 5 Tastenspalten – das M 64 behält seine 4 Spalten). **Details** (Gehäuserundungen, transluzente Anzeige, Schalter-Haptik, Tasten): `m64-front-detail.jpg`. Ältere, perspektivisch verzerrte Fotos nur ergänzend.

Jedes Kriterium bekommt 0, 1 oder 2 Punkte:
* **2** = trifft das Original, ein Sammler würde nicken
* **1** = erkennbar richtig, aber sichtbar daneben
* **0** = fehlt oder ist falsch

**Bestanden: Summe ≥ 17 von 20 und kein Kriterium mit 0.**

| # | Kriterium | Worauf achten |
|---|---|---|
| 1 | Proportionen | Hochformat ≈ 2,0 : 1 mit Hülle (nach dem M 85 S-Frontfoto, Spec 1.8). Teilung von oben nach unten: Kopfplatte, schmale Schalterleiste, flaches Display, großes Tastenfeld, Fußplatte. |
| 2 | Gehäuse, Hülle & Material | Das Gerät ist mattschwarz. **Mit Hülle:** Die cremeweiße Schutzhülle (eine Wanne unter dem Gerät) ist links und rechts über die ganze Länge bis oben und unten als schmaler Rand sichtbar. **Ohne Hülle:** ein rein schwarzes Gehäuse mit kleinen Eckenradien, ohne jede Creme. Kein Hochglanz, kein Glas-Effekt, keine bunten Verläufe. |
| 3 | Logo-Typografie | „ARISTO M 64“ hell, gesperrt, Kapitälchen-Anmutung (großes A), dezent, zentriert in der Kopfplatte. |
| 4 | Schalterleiste | Drei kleine weiße Schieber mit Beschriftung `0 K`, `F 2`, `0 I`. K und F/2 mit leichtem Grauschleier, Ein/Aus klar erkennbar. |
| 5 | Display-Fenster | Schmales, dunkles, rot getöntes Fenster, wirkt eingelassen (leichte Innenkante/Tiefe). |
| 6 | LED-Ziffern | Rote 7-Segment-Ziffern, leicht kursiv, mit Glühen. Unbeleuchtete Segmente schimmern als Geister durch, Dezimalpunkt als eigener Punkt. |
| 7 | Tastenform | Kleine, quadratische, leicht erhabene Tasten mit weichen Kanten und großzügigen schwarzen Abständen. Gedrückte Taste sinkt sichtbar ein. |
| 8 | Tastenfarben | Weiß für Ziffern und Punkt, warmes Gelb-Orange für % √ ÷ × − = +, Rot-Orange für C und CE. Matte Kunststoffanmutung. |
| 9 | Legenden | Fette schwarze Grotesk, mittig. Symbole `÷ × − + = √ % · CE C` wie am Original. |
| 10 | Gesamteindruck | Wirkt wie das Gerät von 1974 auf einem ruhigen, neutralen Untergrund und nicht wie eine moderne Flat-UI. Außer dem Gerät ist nichts zu sehen (keine Überschriften, Menüs oder Fremd-Buttons; die Hülle wird per Easter Egg umgeschaltet). Mobil ebenfalls stimmig. |

## Ausgabeformat (verbindlich)

```json
{
  "perCriterion": {
    "1": { "score": 2, "note": "…" },
    "2": { "score": 1, "note": "…" },
    "…": {}
  },
  "score": 0,
  "mustFix": ["konkrete, umsetzbare Anweisung für den Builder, z. B. 'Ziffern 5° kursiv, Glühen schwächer'"],
  "specConflicts": ["optional: Spec-Wert, der dem Original widerspricht, mit Begründung"],
  "summary": "ein Satz"
}
```
`mustFix` enthält für **jedes** Kriterium unter 2 Punkten mindestens eine konkrete Änderung.

**Grenzen des Judges:** Was `SPEC.md` und `spec/tokens.json` festlegen (Maße, Proportionen, Höhenanteile,
Tastengröße und -raster, Farben), ist gesetzt. Dafür gibt es **keine** `mustFix`, auch nicht „innerhalb der
Toleranz“. Bewertet und korrigiert wird nur, was die Spec offen lässt: Material, Schattierung, Licht,
Kanten, Typografie-Feinheiten, Gesamteindruck. Hältst du einen Spec-Wert im Vergleich zum Original für falsch,
trage ihn unter `specConflicts` ein (wird an den Menschen eskaliert) und vergib die Punkte so, als wäre der
Spec-Wert richtig.
