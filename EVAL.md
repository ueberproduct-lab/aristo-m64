# EVAL — Aristo M 64

Das Eval ist **eingefroren** (`eval/eval.lock`). Builder-Agenten dürfen weder `eval/` noch `SPEC.md`
oder `spec/` ändern. Jede ID aus `SPEC.md` hat mindestens einen Test, dessen Titel mit der ID
beginnt. Die Zuordnung ID → Feature steht in `eval/features.json`.

## Ausführen (explizit und beliebig oft wiederholbar)

| Befehl | Zweck |
|---|---|
| `npm run eval` | komplette Suite → `eval/report.json`, `eval/report.md`, Zeile in `eval/history.jsonl` |
| `npm run eval -- --feature F5` | Feature F5 + Regression F0…F4 (so prüft der Tester in der Schleife) |
| `npm run eval -- --only F2` | nur ein Feature |
| `npm run eval -- --select F0,F3,F9` | genau diese Features (Testauswahl für parallele Spuren) |
| `npm run eval:look` | nur Look-Features (F1, F2, F3, F7, F8) |
| `npm run eval:unit` | nur die Engine-Tests (ohne Browser) |
| `npm run eval:capture` | Screenshots nach `eval/artifacts/current-*.png` |
| `npm run eval:judge` | visueller LLM-Judge (headless `claude --agent loop-judge`) → `eval/judge.json` |
| `npm run eval:golden` | *nur Orchestrator:* Golden Screenshot einfrieren (nach Abnahme von F3) |
| `npm run eval:lock` | *nur Orchestrator:* `eval.lock` neu schreiben (nach bewusster Spec-Änderung) |
| `npx playwright test --ui` | interaktiv durch die Tests klicken |

Reproduzierbarkeit: feste Viewports (1280×900, mobil 375×812), deviceScaleFactor 1, Screenshots mit
`animations: 'disabled'`. Der Server wird vom Runner selbst gestartet. Einzige nicht-deterministische
Komponente ist der Judge, deshalb friert ab F3 der Golden Screenshot (G-01) den Look pixelgenau ein.

## Ebenen

| Ebene | Dateien | prüft |
|---|---|---|
| Engine (Unit) | `eval/unit/engine.spec.mjs` | 82 Rechenfälle aus `eval/cases.mjs` + Power |
| Funktion (UI) | `eval/e2e/functional.spec.mjs` | dieselben 82 Fälle per Mausklick, Tastatur, Ein/Aus, Doppelklick |
| Struktur | `eval/e2e/look-structure.spec.mjs` | DOM-Vertrag, Tastenreihenfolge, Legenden, Schalter, Display-Zellen |
| Tokens | `eval/e2e/look-tokens.spec.mjs` | CSS-Variablen, Typografie, Tastenfarbklassen, Radius/Schatten, Grauschleier, Cursor |
| Geometrie | `eval/e2e/look-geometry.spec.mjs` | Seitenverhältnis, Höhenanteile, 4×5-Raster, Tastengröße, Desktop & Mobil |
| Pixel | `eval/e2e/look-pixels.spec.mjs` | gerenderte Farben: Schale, Frontplatte, Tasten, LED rot, Geister-Segmente, Glühen, Fenster |
| Display | `eval/e2e/display.spec.mjs` | 7-Segment-Muster, rechtsbündig, Dezimalpunkt, Minus, E |
| Feel | `eval/e2e/feel.spec.mjs` | Tastenhub ≥ 1 px + Schattenwechsel, Rückfedern, ≤ 100 ms, keine Konsolenfehler |
| Schutzhülle | `eval/e2e/case.spec.mjs` | Easter Egg „MADE IN GERMANY“, mit/ohne Hülle (Pixel), kein Layout-Sprung, Zustand bleibt, Persistenz |
| Flackern | `eval/e2e/flicker.spec.mjs` | Dauer der `flicker`-Klasse, Animationskurve (angehalten und abgetastet), Ausnahmen |
| Klang | `eval/e2e/sound.spec.mjs` | Tastenklang offline gerendert: Pegel, Anstieg, Dauer, Spektrum (satt + mechanisch), Variation; Auslöser und Stille |
| Stumm | `eval/e2e/mute.spec.mjs` | Easter Egg am Logo, stumm/an, Bestätigungsklick, Persistenz |
| Integrität | `eval/unit/integrity.spec.mjs` | keine Eval-IDs, Eval-Importe oder Testrunner-Erkennung in `src/` |
| Feinschliff | `eval/e2e/polish.spec.mjs` | Logo-Typografie, erhabene Schieber, Relief (Kopfstufe, Schalterrinne, Fußleiste) per Pixelprofil |
| Nah am Original | `eval/e2e/detail.spec.mjs` | Gehäuserundung + Lichtkante, transluzentes Fenster, zierliche LEDs, Cremeführung der Schalter, Tasten-Schrift, Klang hörbar am Ausgang |
| Schieber | `eval/e2e/switches.spec.mjs` | Führungslänge, herausragender Klotz, harte Kante Oberseite/Vorderkante, Beschriftung |
| Tonhöhe | `eval/e2e/pitch.spec.mjs` | `pitch`-Option offline gemessen, Reihen steigen von unten nach oben, Tastatur wie Bildschirmtaste |
| Golden | `eval/e2e/golden.spec.mjs` | Gerät mit Hülle (G-01) und ohne (G-02), ≤ 0,1 % Pixelabweichung |
| Judge | `eval/visual-rubric.md`, `eval/judge.mjs` | 10 Kriterien × 0–2 Punkte, Bestehen ab 17, keine 0 |

## Rechenfälle (Auszug, vollständig in `eval/cases.mjs`)

| ID | Eingabe | Anzeige |
|---|---|---|
| F-01b | `1 2 3` | `123.` |
| F-03a | `. 5` | `0.5` |
| F-05a | `1 2 3 4 5 6 7 8 9` | `12345678.` |
| F-14b | `1 ÷ 3 =` | `0.3333333` |
| F-15a | `2 + 3 × 4 =` | `20.` (ohne Punkt-vor-Strich) |
| F-17a | `5 × =` | `25.` |
| F-21a | `1 ÷ 0 =` | `E` |
| F-22a | `99999999 + 1 =` | `E` |
| F-23a | `0.1 + 0.2 =` | `0.3` |
| F-26e | `1 ÷ 3 × 3 =` | `0.9999999` (8-Stellen-Rechenwerk) |
| F-31a | `9 √` | `3.` |
| F-34a | `0 − 4 = √` | `E` |
| F-36a | `200 × 15 %` | `30.` |
| F-37a | `200 + 15 %` | `230.` |
| F-38a | `200 − 15 %` | `170.` |
| F-39a | `50 ÷ 200 %` | `25.` |
| F-40a | `15 %` | `0.15` |

## Definition of Done

1. `npm run eval` → exit 0: alle IDs grün, G-01 nicht mehr pending, `eval.lock` intakt
2. `npm run eval:judge` → ≥ 17/20, kein Kriterium mit 0
