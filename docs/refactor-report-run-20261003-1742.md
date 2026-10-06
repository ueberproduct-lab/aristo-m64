# Aufräum-Bericht · Aristo M 64

Was hat das regelmäßige Aufräumen (Refactoring) in diesem Lauf gebracht? Grundlage: `refactor-history.jsonl`, die Regeln in
`tools/refactor-policy.json` und die Commits in `src/`.

## Bilanz
| | |
|---|---|
| Aufräumrunden | 5 |
| Schritte, davon zurückgenommen | 7, 0 |
| Prüfung nach jeder Runde grün | ja |
| Verstöße gegen die Ordnungsregeln beseitigt | 9 |
| Zeilen Code, netto | -5 |
| Anteil des Aufräumens an allen Änderungen in `src/` | 17 % |

## Stand am Ende gegen die Ziele
| Messwert | am Ende | Ziel | |
|---|---|---|---|
| ungenutzte Exporte | 0 | ≤ 0 | erfüllt |
| ungenutzte CSS-Klassen | 0 | ≤ 0 | erfüllt |
| Bau-Kommentare im Code | 0 | ≤ 0 | erfüllt |
| überlange Funktionen | 0 | ≤ 0 | erfüllt |
| Kompliziertheit der schwierigsten Funktion | 10 | ≤ 10 | erfüllt |
| doppelter Code (%) | 1,17 | ≤ 3 | erfüllt |

## Runde für Runde

### nach F3 · routine
1 Schritt, 0 zurückgenommen · Stopp: alle Ziele erreicht · Prüfung danach grün · Verstöße 4 → 0

- ungenutzte Exporte: 4 → 0

Was der Aufräumer getan hat:
- **Regel 3 (toter Code raus, Metrik unusedExports):** Vier ungenutzte Exporte in display.js (SEGMENT_PATTERNS, SEGMENTS, DIGIT_COUNT, layoutText) auf modulintern gestellt. Sie werden nur in display.js selbst benutzt und stehen weder in der Spec noch in anderen Modulen. Verhalten und Look unverändert.

### nach F3 · routine
1 Schritt, 0 zurückgenommen · Stopp: Ziele schon erreicht, ein Pfadfinder-Schritt · Prüfung danach grün · Verstöße 0 → 0

- Zeilen Code: 625 → 622

Was der Aufräumer getan hat:
- **Regel 7 (einheitliche Struktur) / Pfadfinder:** Redundante font-family-Deklarationen in .logo, .switch-label und .foot-print entfernt (erben dieselbe Schrift vom body). Bei .key bleibt sie, mit Kommentar warum: Buttons erben die Schrift nicht.

### nach F6 · routine
2 Schritte, 0 zurückgenommen · Stopp: alle Ziele erreicht · Prüfung danach grün · Verstöße 3 → 0

- Zeilen Code: 808 → 804
- überlange Funktionen: 1 → 0
- ungenutzte Exporte: 2 → 0

Was der Aufräumer getan hat:
- **3 Toter Code raus:** MAX_DIGITS und formatResult werden nirgends importiert: das Schlüsselwort export entfernt, beide bleiben modullokal
- **5 Kleine, benannte Einheiten:** createEngine war 142 Zeilen lang. Die Zustandsübergänge (reset, settle, showResult, execute, typeDigit, typePoint, clearEntry, pressOperator, pressEquals, pressSqrt, pressPercent, press) stehen jetzt als Modulfunktionen mit explizitem state-Parameter. createEngine ist nur noch eine dünne Hülle mit unveränderter öffentlicher API.

### nach F10 · routine
2 Schritte, 0 zurückgenommen · Stopp: alle Ziele erreicht · Prüfung danach grün · Verstöße 2 → 0

- Zeilen Code: 1044 → 1049
- doppelter Code (%): 0,76 → 0,75
- überlange Funktionen: 1 → 0
- ungenutzte Exporte: 1 → 0

Was der Aufräumer getan hat:
- **3 Toter Code raus:** keyFor in keyboard.js war exportiert, wird aber nur intern genutzt; Export entfernt (unusedExports 1 auf 0).
- **5 Kleine, benannte Einheiten:** Flacker-Logik (Reduced-Motion-Prüfung, Timer, Animation neu starten) aus createDisplay in eigene Funktion createFlicker(root) ausgelagert. createDisplay war 43 Zeilen lang, jetzt unter der Grenze (longFunctions 1 auf 0). Verhalten unverändert.

### nach F13 · routine
1 Schritt, 0 zurückgenommen · Stopp: Ziele schon erreicht, ein Pfadfinder-Schritt · Prüfung danach grün · Verstöße 0 → 0

- Zeilen Code: 1126 → 1123
- doppelter Code (%): 1,64 → 1,17
- kopierte Stellen: 3 → 2

Was der Aufräumer getan hat:
- **Regel 2 / 7 (eine Quelle der Wahrheit, Gleiches gleich lösen):** Die zwei gespiegelten Lichtband-Verläufe an den Seitenkanten (.device::after) teilen sich jetzt eine Variable --edge-light statt die fünf Farbstopps doppelt zu führen. Duplikation sank von 1,64 % auf 1,17 %, Klone von 3 auf 2.
