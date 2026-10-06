# SPEC — Aristo M 64 als WebApp

Version 2.1 · 2026-10-03 (1.1: Schutzhülle als Konfiguration, L-07 präzisiert · 1.2: Hüllenrand oben = unten · 1.3: Hülle als Easter Egg · 1.4: Display-Flackern · 1.5: Tastenklang · 1.6: leiser + Stumm-Easter-Egg, Integritätstest · 1.7: Feinschliff Look · 1.8: Proportionen nach M 85 S, Details nach M 64-Frontfoto · 1.9: Klang ohne Spitze, Safari, deutliche Seitenrundung · 2.0: Schieber wie am Original · 2.1: Tonhöhe pro Tastenzeile) · Owner: Markus Andrezak

> Diese Spec ist der Vertrag zwischen Builder- und Tester-Agenten. Jede Anforderung trägt eine ID
> (`E-`, `L-`, `F-`, `G-`). Zu jeder ID gibt es in `eval/` mindestens einen Test mit genau dieser ID im
> Titel. Zahlenwerte für Farben, Maße und Toleranzen stehen **ausschließlich** in `spec/tokens.json`.

## 1. Ziel

Ein Taschenrechner im Browser (nur `localhost`), der aussieht und sich bedient wie der **Aristo M 64**
(Dennert & Pape, Hamburg, 1973–75). Er beherrscht die vier Grundrechenarten sowie **√** und **%**.
Look & Feel haben Vorrang. Sie sind genauso verbindlich und testbar wie die Rechenlogik.

Referenzbilder: `spec/reference/`. Wichtig zum Verständnis: Das **Gerät selbst ist komplett schwarz**.
Das Cremeweiße ist eine abnehmbare **Schutzhülle**, eine Wanne, in der das Gerät liegt
(`m64-mit-schutzhuelle-seite.jpg`, ohne Hülle: `m64-ohne-schutzhuelle.jpg`).

## 2. Nicht-Ziele

Wissenschaftliche Funktionen, Speicher, Konstantenrechnung (Schalter K) und feste Dezimalstellen
(Schalter F/2), Persistenz, Deployment, Frameworks und Build-Schritt.

## 3. Technik

| Thema | Vorgabe |
|---|---|
| Stack | Vanilla HTML/CSS/ES-Module, keine Runtime-Abhängigkeiten, kein Build |
| Server | `node server.mjs` → statische Auslieferung von `src/` auf `http://localhost:4173` (`PORT` überschreibbar) |
| Dateien | `src/index.html`, `src/style.css`, `src/engine.js` (reine Logik, kein DOM), `src/display.js` (7-Segment-Rendering), `src/ui.js` (Verdrahtung) |
| Schriften | keine externen Requests (keine Google Fonts, kein CDN). System-Sans genügt. |
| Konsole | keine Fehler beim Laden und Bedienen (L-32) |
| Integrität | `src/` enthält keine Eval-IDs (auch nicht in Kommentaren), importiert nichts aus `eval/` und erkennt keinen Testrunner (E-01) |

### 3.1 Engine-API (`src/engine.js`)

```js
export function createEngine(): Engine
interface Engine {
  press(key: Key): void      // Key siehe 3.3
  display(): string          // Anzeigetext nach 3.4, "" wenn ausgeschaltet
  isError(): boolean
  setPower(on: boolean): void // aus: Anzeige "", Tasten wirkungslos; an: kompletter Reset
}
```

### 3.2 DOM-Vertrag

| Selektor | Bedeutung |
|---|---|
| `[data-part="shell"]` | gesamtes Gerät inkl. Schutzhülle. Attribut `data-case` = `on` (mit Hülle) oder `off` (ohne) |
| `[data-part="faceplate"]` | schwarze Frontplatte (in `shell`) |
| `[data-part="head"]` | Kopfplatte, enthält `[data-part="logo"]` |
| `[data-part="switches"]` | Schalterleiste mit drei `[data-switch]` (`k`, `dec`, `power`), jeweils `role="switch"` und `aria-checked` |
| `[data-part="display"]` | Anzeigefenster. Attribut `data-value` = aktueller Anzeigetext (3.4), `aria-live="polite"` |
| `[data-part="sign"]` | Vorzeichenzelle links im Display, enthält ein Segment `[data-seg="g"]` |
| `[data-part="digit"]` ×8 | Ziffernzellen von links nach rechts, je mit `[data-seg]` = `a b c d e f g dp` |
| `.lit` auf `[data-seg]` | Segment leuchtet |
| `[data-part="keypad"]` | Tastenfeld mit genau 20 `button[data-key]` |
| `button[data-key]` | `data-key` nach 3.3, `data-color` = `red`, `yellow` oder `white`, `aria-label` nach tokens.json |
| `.pressed` auf Taste | gesetzt, solange Maus, Finger oder physische Taste gedrückt ist |
| `[data-part="foot"]` | Fußplatte mit Schriftzug |
| `[data-part="switch-slot"]`, `[data-part="switch-knob"]` | Schlitz und Schieber in jedem `[data-switch]` (F12) |
| `[data-config="sound"]` | Easter Egg: das Logo „ARISTO M 64“ in `[data-part="head"]`. Ein Klick schaltet den Tastenklang stumm bzw. wieder an. Dazu trägt `[data-part="shell"]` das Attribut `data-sound` = `on` oder `off`. |
| `[data-config="case"]` | Easter Egg: der Schriftzug „MADE IN GERMANY“ in `[data-part="foot"]`. Ein Klick darauf schaltet die Schutzhülle um. |
| `src/sound.js` | `export function playKeyClick(ctx, when, { pitch } = {})`: plant den Tastenklang in einen `BaseAudioContext` ein. `pitch` ist ein Frequenzfaktor (Standard 1) und verschiebt den ganzen Anschlag (F10, F15). |
| `window.m64.render(text)` | Test-Hook: rendert einen beliebigen Anzeigetext (3.4) direkt ins Display und setzt `data-value` |

Regeln zum DOM:
* Form, Schatten und Druckversatz einer Taste (`border-radius`, `box-shadow`, Bewegung) liegen auf dem
  `button` selbst, nicht nur auf Pseudo-Elementen oder Kindern.
* Außer dem Gerät ist auf der Seite nichts sichtbar, keine Überschrift und keine Erklärtexte. Der Hintergrund ist eine ruhige,
  neutrale Fläche, z. B. ein warmes Grau oder eine dezente Tischoberfläche.
* Die Seite lädt ohne Startanimation länger als 300 ms.

### 3.3 Tasten-Vokabular

`0`–`9`, `.`, `+`, `-`, `*`, `/`, `=`, `%`, `sqrt`, `C`, `CE`. Reihenfolge, Legenden, Farben und Labels
legt `tokens.json → keys` fest.

### 3.4 Anzeigetext

Grammatik: `""` (aus) | `"E"` (Fehler) | `-?` Ziffern mit genau einem `.`.

* Maximal **8 Ziffern**.
* **Ganze Zahlen enden immer mit `.`**, weil der Dezimalpunkt der letzten Stelle leuchtet: `0.`, `42.`, `-3.`
* Während der Eingabe wird der Text exakt wie getippt angezeigt (`0.50`, `12.`), ohne führende Nullen außer `0.`.
* Ergebnisse werden auf 8 Ziffern gerundet und nachgestellte Nullen entfernt (`0.3333333`, `14.285714`, `0.3`).
  `-0` wird zu `0.`.
* Rendering: Ziffern rechtsbündig in den 8 Zellen. `.` schaltet `dp` der links davon stehenden Ziffer.
  `-` leuchtet in `[data-part="sign"]`. Bei `E` zeigt die **linke** Ziffernzelle das Muster `E`.
  Segmentmuster: `tokens.json → segments`.

## 4. Rechenlogik (Features F4–F6)

Sofortige Ausführung wie beim Original, **ohne Punkt-vor-Strich**.

| Regel | Beschreibung |
|---|---|
| Ziffern | starten eine neue Eingabe, wenn keine läuft (nach Operator, `=`, `%`, `√`). Mehr als 8 Ziffern werden ignoriert. |
| `.` | `0.` falls keine Eingabe läuft; ein zweiter Punkt wird ignoriert |
| Operator | rechnet die anstehende Operation aus (Zwischenergebnis wird angezeigt) und merkt sich den neuen Operator. Zwei Operatoren hintereinander: der letzte gilt. |
| `=` | rechnet aus. Ohne neue Eingabe gilt die Anzeige als zweiter Operand (`5 × =` → `25.`). Ein weiteres `=` ändert nichts (keine Konstante). |
| `√` | wirkt sofort auf die Anzeige; das Ergebnis gilt als Eingabe |
| `%` | mit anstehendem Operator: `a×b%` = a·b/100 · `a+b%` = a+a·b/100 · `a−b%` = a−a·b/100 · `a÷b%` = a/b·100. Schließt die Rechnung ab wie `=`. Ohne Operator: Anzeige/100. |
| `C` | kompletter Reset → `0.`, hebt auch Fehler auf |
| `CE` | setzt nur die laufende Eingabe auf `0.`; Operator und Zwischenergebnis bleiben. Im Fehlerzustand wirkungslos. |
| Fehler `E` | bei ÷0, √ negativ, \|Ergebnis\| ≥ 10⁸. Danach wirkt nur noch `C` (bzw. Aus/Ein). |
| Gleitkomma | Ergebnisse werden vor der Anzeige gerundet: `0.1+0.2` → `0.3` |
| 8-Stellen-Rechenwerk | Wie beim Original wird mit dem **angezeigten (gerundeten) Wert** weitergerechnet: `1÷3×3=` → `0.9999999`. Rundungsüberträge werden neu bewertet: `9999999.9+0.06=` → `10000000.` |

## 5. Look & Feel (Features F1–F3, F7)

Hierarchie der Prüfungen: DOM-Struktur → CSS-Tokens → Geometrie → Pixelproben → Interaktion →
visueller Judge → Golden Screenshot.

### F1 — Gehäuse & Layout
| ID | Anforderung | messbar durch |
|---|---|---|
| L-01 | Alle Teile aus 3.2 existieren und sind sichtbar | DOM |
| L-02 | Logo „ARISTO M 64“ (Groß-/Kleinschreibung egal, als Versalien bzw. Kapitälchen dargestellt), helle Farbe, `letter-spacing` ≥ 0,08em, serifenlos | computed style |
| L-03 | Fußplatte „MADE IN GERMANY“, Versalien, `letter-spacing` ≥ 0,1em, kleiner als das Logo | computed style |
| L-04 | Seitenverhältnis des Gehäuses (h/b) = `shellAspect` | bbox |
| L-05 | Reihenfolge von oben nach unten: head → switches → display → keypad → foot, ohne Überlappung | bbox |
| L-06 | Höhenanteile an der Frontplatte = `verticalFractions` ± Toleranz | bbox |
| L-07 | Mit Hülle (Standard), Draufsicht: gleichmäßiger cremeweißer Rahmen auf **allen vier Seiten**, jeweils `case.rimOfShellWidth` (≈ 2,3 % der Gerätebreite, wie am Frontfoto). Oben = unten und links = rechts (± 1 px). Seiten über die ganze Länge sichtbar. | bbox + Pixel |
| L-08 | 20 Tasten in der Reihenfolge, mit Legenden und `aria-label` aus `tokens.keys` | DOM |
| L-09 | 4 Spalten × 5 Reihen. Spalten und Reihen fluchten (± 1 px), Abstände gleichmäßig (± 2 px), Raster horizontal zentriert (± 3 px) | bbox |
| L-10 | Tasten annähernd quadratisch (`keyAspect`), alle gleich groß (± 1 px), Breite = `keyWidthOfFaceplate`, Raster-Teilung = `columnPitchOverKeyWidth` / `rowPitchOverKeyWidth` | bbox |
| L-11 | Drei Schiebeschalter links → rechts: `0 K`, `F 2`, `0 I`, mit `role="switch"` | DOM |
| L-12 | Desktop 1280×900: Gerät vollständig sichtbar, horizontal zentriert (± 2 px), Höhe = `desktopShellHeightOfViewport` | bbox |
| L-13 | `:root` definiert alle `tokens.colors` als CSS-Custom-Properties mit exakt diesen Werten | computed style |
| L-14 | Frontplatte rendert in `--m64-faceplate` (ΔE ≤ `faceplateDeltaE`) | Pixel |

### F2 — 7-Segment-LED-Anzeige
| ID | Anforderung |
|---|---|
| L-15 | Display enthält 1 Vorzeichenzelle und 8 Ziffernzellen mit je 8 Segmenten (`a`–`g`, `dp`) |
| L-16 | Nach dem Laden zeigt das Display `0.` (`data-value="0."`): rechte Zelle `abcdef` + `dp`, sonst nichts leuchtet |
| L-17 | `window.m64.render()` stellt Ziffern 0–9 nach `tokens.segments` rechtsbündig dar, inklusive `dp` |
| L-18 | `-` leuchtet in der Vorzeichenzelle, `E` erscheint in der linken Ziffernzelle |
| L-19 | Leuchtende Segmente sind LED-rot (`led.litMin/Max…`) |
| L-20 | Unbeleuchtete Segmente schimmern schwach durch (Geister-Segmente): ΔE ≥ `ghostMinDeltaEFromWindow` zum Fenster, L* ≤ `ghostMaxLightness` |
| L-21 | Leuchtende Segmente glühen: 2 px neben dem Segment ist es um ≥ `glowMinRedGain` röter als neben einem dunklen Segment |
| L-22 | Fensterfarbe dunkel und rötlich (L* ≤ 20, a* > 0) |
| L-23 | Ziffernzellen gleich breit (± 1 px), gleichmäßig verteilt (± 1,5 px), Seitenverhältnis `digitCellAspect`, Ziffernreihe ≥ 60 % der Fensterbreite |

### F3 — Tasten-Look & Haptik
| ID | Anforderung |
|---|---|
| L-24 | `data-color` je Taste wie in `tokens.keys` (C/CE rot, %, √ und Operatoren gelb, Ziffern und Punkt weiß) |
| L-25 | Gerenderte Tastenfarbe ≈ Token (ΔE ≤ `keyDeltaE`, Probe bei 22 % Breite und 50 % Höhe) |
| L-26 | Legenden fett (≥ 600), dunkel (L* ≤ 25), mittig (± 15 % der Tastenbreite) |
| L-27 | Ecken leicht gerundet (`keyRadiusOfWidth`), Tasten wirken erhaben (`box-shadow` ≠ none) |
| L-28 | Gedrückt (Maus unten): Taste versetzt sich um ≥ 1 px nach unten, Schatten ändert sich. Losgelassen: zurück. Übergang ≤ 100 ms. |
| L-29 | Schalter K und F/2: `aria-disabled="true"`, **leichter Grauschleier** (opacity 0,55–0,85 oder grayscale/saturate-Filter), Klick ändert nichts. Ein/Aus-Schalter: kein Schleier. |
| L-30 | `cursor: pointer` auf Tasten und Ein/Aus-Schalter |
| G-01 | Golden Screenshot des Geräts mit Hülle (Initialzustand, Desktop), Abweichung ≤ 0,1 % der Gerätepixel, damit auch kleine Details wie die Hüllen-Ecken geschützt sind. Eingefroren nach Abnahme von F3, neu eingefroren nach Abnahme von F8. |

### F8 — Schutzhülle (Konfiguration für Fans)
Das Original hat eine abnehmbare cremeweiße Schutzhülle. Sie wird unter das Gerät gesteckt (Standard), zum
Schutz auf die Oberseite gesteckt oder ganz abgenommen. Die WebApp bildet „mit“ (unten aufgesteckt) und
„ohne“ ab. Die Variante „oben aufgesteckt“ ist nicht im Scope. Umgeschaltet wird über ein **Easter Egg für Fans**:
ein Klick auf den Schriftzug „MADE IN GERMANY“. Es gibt keinen sichtbaren Schalter.

| ID | Anforderung |
|---|---|
| L-34 | Easter Egg: Ein Klick auf den Schriftzug „MADE IN GERMANY“ (`[data-part="foot"] [data-config="case"]`) schaltet zwischen mit und ohne Hülle um (`data-case` am Shell), ein zweiter Klick zurück. Nichts verrät das Easter Egg: kein sichtbarer Schalter, nirgends der Text „Schutzhülle“, `cursor` ist nicht `pointer`, der Schriftzug verändert sich beim Hover nicht. Der Klick löst keine Rechnertaste aus und ändert die Anzeige nicht. |
| L-35 | Ohne Hülle (`data-case="off"`): Nirgends ist Creme zu sehen. Wo vorher der Hüllenrand war (links und rechts auf 1,5 %, 50 % und 90 % der Höhe, oben und unten), ist entweder der Seitenhintergrund zu sehen (ΔE ≤ 8 zum Hintergrund 20 px neben dem Gerät) oder das schwarze Gehäuse (L* ≤ 30). Das Gerät ist dann ein rein schwarzes Gehäuse mit kleinen Eckenradien, wie `m64-ohne-schutzhuelle.jpg`. Mit Hülle gilt L-07. |
| L-36 | Umschalten verschiebt nichts am Gerät: Frontplatte, Display und alle Tasten behalten ihre Position (± 0,5 px). Anzeige und Rechenzustand bleiben erhalten (`1 2 3`, umschalten, `+ 1 =` → `124.`). |
| L-37 | Die Wahl bleibt nach einem Neuladen erhalten (localStorage, Schlüssel `m64-case`). Ohne gespeicherten Wert gilt „mit“. Ist der Speicher nicht verfügbar, funktioniert die Seite trotzdem. |
| G-02 | Golden Screenshot „ohne Hülle“ (Gerät, Desktop), eingefroren nach Abnahme von F8 |

### F9 — Display-Flackern
Bei jedem Tastendruck flackert die LED-Anzeige ganz leicht und sehr kurz, wie eine gemultiplexte
LED-Anzeige der Zeit. Werte: `tokens.json → flicker`.

| ID | Anforderung |
|---|---|
| L-38 | Jeder Tastendruck, ob Maus, Touch oder physische Taste, der beim eingeschalteten Gerät die Engine erreicht, setzt am Display die Klasse `flicker` für `flicker.minMs`–`flicker.maxMs` (40–120 ms). Zwei Drücke hintereinander flackern beide. |
| L-39 | Das Flackern ist eine **CSS-/Web-Animation** (per `getAnimations()` prüfbar) und dauert höchstens `flicker.maxMs`. **Sehr leicht:** Die effektive Helligkeit der leuchtenden Segmente (Opacity × `brightness()`) sinkt mindestens einmal auf ≤ `flicker.maxDipOpacity` (0,95), nie unter `flicker.minOpacity` (0,6). `data-value` ändert sich sofort und nicht durch das Flackern. |
| L-40 | Kein Flackern bei ausgeschaltetem Gerät, beim Easter-Egg-Klick, bei `window.m64.render()` und bei `prefers-reduced-motion: reduce`. In diesen Fällen wird die Klasse nicht gesetzt. |

### F10 — Tastenklang
Die Tastatur des Originals ist sehr mechanisch und satt. Jeder Tastendruck spielt ein kurzes, sattes,
mechanisches „Klack“: Körper im Bass, Kunststoff-Resonanz, heller Anschlag-Transient. Der Klang wird mit der
Web Audio API **synthetisiert** (keine Audiodateien, keine externen Requests). `src/sound.js` exportiert
`playKeyClick(ctx, when)`. Die Funktion plant den Klang in einen beliebigen `BaseAudioContext` ein, damit das Eval
ihn offline rendern und messen kann. Werte: `tokens.json → sound`. Der gemessene Pegel ist der **endgültige**:
Die App darf hinter `playKeyClick` keine weitere Lautstärke-Stufe schalten. **Lautstärke (1.6):** Bei mittlerer
Systemlautstärke am Rechner, der normalen Arbeitssituation, soll der Klang satt, aber nicht laut sein, einfach hörbar.
Daher liegt die Spitze bei 0,08–0,2 (≈ −22 bis −14 dBFS).
**Ohne Spitze (1.9):** In der Hörprobe ist die leise Stufe richtig, aber der scharfe Klick-Anteil soll raus. Der Anschlag ist weich
(2,5–6 ms bis zur Spitze), höchstens 1,5 % der Energie liegen über 3 kHz, über 2 kHz sind es 3–12 %. Der Schwerpunkt liegt bei 900–2000 Hz.
**Klangfarbe (1.6):** einen Tick weniger Bass. Der Energieanteil unter 600 Hz liegt bei 35–60 %, der Schwerpunkt bei
1000–2000 Hz. Der Körper bleibt, der Klang wird etwas heller und knackiger.

| ID | Anforderung |
|---|---|
| L-41 | Offline gerendert und gemessen: Spitzenpegel `peakMin`–`peakMax` (hörbar, kein Übersteuern). Anstieg zur Spitze ≤ `attackMaxMs` (mechanischer Transient). Dauer bis −40 dB `minMs`–`maxMs`. **Satt:** Energieanteil unter `lowCutHz` zwischen `lowShareMin` und `lowShareMax`, also Körper, aber kein dumpfes Wummern. **Mechanisch:** Anteil über `highCutHz` ≥ `highShareMin`. Spektraler Schwerpunkt `centroidMin`–`centroidMax`. **Lebendig:** Zwei Anschläge sind nicht identisch (Variation > `minVariation`). |
| L-42 | Jeder Tastendruck mit Maus, Touch oder physischer Taste bei eingeschaltetem Gerät spielt den Klang. Still bleibt es beim Laden, bei ausgeschaltetem Gerät, beim Easter Egg und bei `window.m64.render()`. |
| L-43 | Der `AudioContext` entsteht erst beim ersten Tastendruck (Autoplay-Regeln) und wird danach wiederverwendet. Es gibt keine Fehler. |

### F11 — Stummschalter (Easter Egg)
| ID | Anforderung |
|---|---|
| L-44 | Easter Egg: Ein Klick auf das Logo „ARISTO M 64“ (`[data-part="head"] [data-config="sound"]`) schaltet den Tastenklang stumm, ein zweiter Klick wieder an (`data-sound` am Shell). Nichts verrät das Easter Egg: kein sichtbarer Hinweis, `cursor` nicht `pointer`, keine Hover-Veränderung. Der Klick löst keine Rechnertaste aus und lässt das Display nicht flackern. |
| L-45 | Stumm: Klicks und physische Tasten bleiben still, der Rechner funktioniert normal. Das Stummschalten selbst ist still. Beim Wiedereinschalten ertönt **einmal** der Klang als Bestätigung. Die Wahl bleibt nach einem Neuladen erhalten (localStorage `m64-sound`, Standard „an“) und funktioniert auch ohne Speicher. |

### F12 — Feinschliff Look (wertiger)
Aus der Endabnahme 1.5 (Judge 17/20) übernommen und messbar gemacht. Werte: `tokens.json → polish`.

| ID | Anforderung |
|---|---|
| L-46 | Logo: moderat gesperrt (0,10–0,14 em bezogen auf die Logo-Größe), normale Wortabstände, breite geometrische Schrift wie am Original (erste Schrift im Stack: Futura, Avenir Next, Avenir oder Century Gothic; lokal vorhanden, keine Web-Fonts), Gewicht 400–600. Kapitälchen-Anmutung bleibt (L-02). |
| L-47 | Schiebeschalter: kräftige, erhabene Cremeschieber, die den Schlitz zu ≥ 85 % der Höhe füllen (Seitenverhältnis 1,1–2,1). Schattiert mit einem Verlauf und einem Schlagschatten in den Schlitz. Beim Ein/Aus-Schieber ist die Oberseite sichtbar heller als die Vorderkante (ΔL* ≥ 8). Der Grauschleier auf K und F/2 bleibt (L-29). |
| L-48 | Relief wie am Original: Die Kopfplatte ist ein erhabener Block mit Fase und fällt sichtbar in die vertiefte Schalterrinne ab (L*-Spanne an der Kante ≥ 10). Die Fußplatte ist eine eigene, abgesetzte Leiste mit sichtbarer Kante zum Tastenfeld (≥ 6). Die glatte Frontplatte bleibt flach (< 3). Gemessen wird am linken und rechten Rand der Frontplatte (3 % / 97 %). |

### F13 — Nah am Original (Spec 1.8)
**Proportionen** (Entscheidung Markus): nach dem Frontfoto des Schwestermodells M 85 S
(`spec/reference/m85s-front-proportionen.png`), auch in der Breite. Gerät mit Hülle 2,0 : 1, Höhenanteile Kopf 0,175,
Schalter 0,065, Display 0,075 (schmales LED-Fenster wie beim M 64), Tastenfeld 0,53, Fuß 0,105. Das 4×5-Tastenfeld des M 64
bleibt (Tastenbreite 0,142 der Gerätebreite, Teilungen wie am M 64-Foto). Werte: `tokens.json → geometry`, `case`.
**Details** nach dem M 64-Frontfoto (`spec/reference/m64-front-detail.jpg`). Werte: `tokens.json → detail`.

| ID | Anforderung |
|---|---|
| L-49 | Gehäuse-Rundungen: Eckenradius der Frontplatte 2,5–5 % der Breite, an allen vier Ecken. **Die Seiten wirken deutlich gerundet (1.9):** Links und rechts läuft ein Lichtband entlang der Kante, ΔL* ≥ 8 heller als die Fläche und mindestens 4 px breit (ΔL* ≥ 3), gemessen auf Höhe von Kopf- und Fußplatte. Das ist die wertige, plastische Anmutung des Originals. |
| L-50 | Anzeige wie am Original: breites Fenster (0,90 ± 0,03 der Gerätebreite). Transluzent und tief: Die Mitte ist heller als die Oberkante (ΔL* ≥ 4). Zierliche LED-Ziffern: Strich ≤ 0,13 der Zellbreite, Ziffernhöhe ≤ 55 % der Fensterhöhe. Geister-Segmente kaum sichtbar (ΔE ≤ 8, weiterhin ≥ 3 nach L-20). |
| L-51 | Schalter-Haptik: Im Schlitz liegt eine helle Cremeführung (L* ≥ 60, bei K und F/2 ≥ 45), kein schwarzes Loch. Der Schieber sitzt erhaben darauf (L-47). Der Grauschleier auf K und F/2 ist nur leicht (ΔE ≤ 15 zum Ein/Aus-Schieber, L-29 bleibt gültig). |
| L-52 | Tasten wie am Original: Eckenradius 12–18 % der Tastenbreite (`keyRadiusOfWidth`, L-27). Legenden in derselben geometrischen Schrift wie das Logo. „CE“ ist so groß wie „C“. |
| L-54 | **Safari (1.9):** Der AudioContext wird innerhalb einer von Safari anerkannten Geste angelegt oder fortgesetzt (`click`, `pointerup`, `mouseup`, `keydown`, `keyup` oder `touchend`), nicht nur in `pointerdown`. Sonst bleibt Safari stumm. |
| L-53 | Der Tastenklang kommt **hörbar am Audio-Ausgang** an (laufender AudioContext, Pegel ≥ 0,02 am Ausgang). Stummgeschaltet kommt dort nichts an. |

### F14 — Schieber wie am Original (Spec 2.0, letzte Runde)
Nach `m64-front-detail.jpg`. Werte: `tokens.json → switchesF14`.

| ID | Anforderung |
|---|---|
| L-55 | Führung (Schlitz) ≈ 15 % der Gerätebreite (± 1,2 %). Der Schieber ist ein Klotz, der aus dem Schlitz **herausragt** (1,2–1,5 × Schlitzhöhe), 35–50 % der Führungslänge breit. |
| L-56 | Relief des Schiebers: helle Oberseite, deutlich dunklere Vorderkante (ΔL* ≥ 15) und eine **harte Kante** dazwischen (Sprung ≥ 8 L* zwischen benachbarten Pixeln). Schlagschatten in den Schlitz (L-47), Grauschleier auf K und F/2 (L-29/L-51). |
| L-57 | Beschriftungen `0 K`, `F 2`, `0 I` größer (≥ 50 % der Logo-Schriftgröße) und hell (L* ≥ 89), wie der Siebdruck am Original. |

### F15 — Tonhöhe pro Tastenzeile (Spec 2.1)
Die unterste Tastenreihe (`0 · = +`) klingt am tiefsten. Jede Reihe darüber klingt **ganz leicht höher**
(`sound.rowPitch.semitonesPerRow` = ¾ Halbton), die oberste Reihe (`C % √ CE`) also 3 Halbtöne über der untersten.
Charakter, Pegel und Hüllkurve bleiben gleich.

| ID | Anforderung |
|---|---|
| L-58 | `playKeyClick(ctx, when, { pitch })` verschiebt den ganzen Anschlag um den Faktor `pitch` (gemessen am spektralen Schwerpunkt, ± 0,6 Halbtöne). Die Klangkriterien aus L-41 (Bass, kein Tick über 3 kHz, 3–12 % über 2 kHz, Schwerpunkt) gelten für die tiefste **und** die höchste Reihe. |
| L-59 | Maus- und Bildschirmtasten: Jede Reihe klingt höher als die darunter (≥ 0,3 Halbtöne). Von unten nach oben sind es insgesamt 3 Halbtöne (± 0,6). Physische Tasten klingen wie ihre Bildschirmtaste. |

### F7 — Bedienung & Feinschliff
| ID | Anforderung |
|---|---|
| L-31 | Mobil 375×812: kein horizontales Scrollen, Gerät in voller Breite sichtbar, Tasten ≥ 44 px |
| L-32 | Keine Konsolenfehler bei Laden und Bedienung |
| L-33 | Display hat `aria-live="polite"`, alle Tasten haben `aria-label` |

## 6. Funktions-IDs (Details und Fälle: `EVAL.md`, `eval/cases.mjs`)

* **F4 Eingabe:** F-01 Ziffern · F-02 führende Nullen · F-03 Dezimalpunkt · F-04 getippte Nullen bleiben · F-05 8-Stellen-Limit · F-06 C · F-07 CE während der Eingabe
* **F5 Grundrechenarten:** F-11 + · F-12 − · F-13 × · F-14 ÷ · F-15 Kette ohne Punkt-vor-Strich · F-16 Operatorwechsel · F-17 `5×=` · F-18 doppeltes `=` · F-19 neue Zahl nach `=` · F-20 Weiterrechnen mit Ergebnis · F-21 ÷0 → E · F-22 Überlauf → E · F-23 Gleitkomma · F-24 negative Ergebnisse · F-25 CE mit anstehendem Operator · F-26 Rundung auf 8 Stellen · F-27 −0 · F-28 Punkt nach Operator
* **F6 √ und %:** F-31 √9 · F-32 √2 · F-33 √ als Operand · F-34 √ negativ → E · F-35 √0 · F-36 a×b% · F-37 a+b% · F-38 a−b% · F-39 a÷b% · F-40 b% allein · F-41 Weiterrechnen nach % · F-42 ÷0% → E · F-43 √ nach `=`
* **F7 Bedienung:** F-50 Tastatur Ziffern/Operatoren (`Enter`/`=`, `,` als Punkt) · F-51 `Escape`=C, `Backspace`/`Delete`=CE, `%`, `r`=√ · F-52 physische Taste setzt `.pressed` an der Bildschirmtaste · F-53 Ein/Aus-Schalter · F-54 jeder Klick zählt genau einmal

## 7. Features und Reihenfolge

| Feature | IDs | Look? |
|---|---|---|
| F0 Gerüst | E-00, E-01 | – |
| F1 Gehäuse & Layout | L-01…L-14 | ja |
| F2 7-Segment-LED | L-15…L-23 | ja |
| F3 Tasten-Look & Haptik | L-24…L-30 (+ G-01 nach Abnahme) | ja |
| F4 Eingabe | F-01…F-07 | – |
| F5 Grundrechenarten | F-11…F-28 | – |
| F6 √ und % | F-31…F-43 | – |
| F7 Bedienung & Feinschliff | F-50…F-54, L-31…L-33 | ja |
| F8 Schutzhülle | L-34…L-37 (+ G-02 nach Abnahme) | ja |
| F9 Display-Flackern | L-38…L-40 | – |
| F10 Tastenklang | L-41…L-43 | – |
| F11 Stummschalter & Lautstärke | L-44, L-45 (+ L-41 leiser) | – |
| F12 Feinschliff Look | L-46…L-48 (+ G-01/G-02 neu einfrieren) | ja |
| F13 Nah am Original | L-49…L-54, Proportionen L-04/L-06/L-07/L-10 (+ Goldens neu) | ja |
| F14 Schieber | L-55…L-57 (+ Goldens neu) | ja |
| F15 Tonhöhe pro Tastenzeile | L-58, L-59 | – |

**Regel für Look-Korrekturen:** Die Zielwerte in `tokens.json` gelten, die Toleranzen sind Messtoleranz
und kein Gestaltungsspielraum. Der visuelle Judge bewertet nur, was die Spec offen lässt. Hält er die
Spec selbst für falsch, meldet er einen Konflikt an den Menschen und lässt sie nicht still übersteuern.

**Definition of Done:** `npm run eval` ist zu 100 % grün, der Golden Screenshot ist stabil, der
visuelle Judge vergibt ≥ 17/20 Punkte (bewertet mit und ohne Hülle) ohne ein Kriterium mit 0, und `eval.lock` ist unverändert.
