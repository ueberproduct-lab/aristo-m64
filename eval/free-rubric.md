# Freie Begutachtung (ohne Prüf-Schnittstelle)

Für jede Bauweise gleich, auch für den One Shot, der keine Prüf-Merkmale kennt. Der Gutachter bedient den Rechner wie ein Mensch:
über die sichtbaren Tasten (per Text oder Position finden, nicht über data-Attribute) und liest die Anzeige vom Bild oder aus dem
sichtbaren Text. Er schreibt dafür ein kleines headless Playwright-Skript in `eval/artifacts/` (dort ist es ignoriert) und ändert nichts am Produkt.

## Funktionsprobe (0–10 Punkte, je Zeile 1 Punkt)
| # | Eingabe | erwartet | Hinweis |
|---|---|---|---|
| 1 | 12 + 7 = | 19 | |
| 2 | 9 × 8 = | 72 | |
| 3 | 100 ÷ 8 = | 12.5 | |
| 4 | 7 − 10 = | −3 | |
| 5 | 2 + 3 × 4 = | 20 oder 14 | 20 = sofortige Ausführung wie damals, 14 = Punkt vor Strich; beides zählt, notieren welches |
| 6 | 81 √ | 9 | |
| 7 | 200 + 15 % (ggf. =) | 230 | Kaufmanns-Prozent; 0.15 oder 215 zählen nicht |
| 8 | 1 ÷ 0 = | eine erkennbare Fehleranzeige | kein Absturz, keine leere Anzeige ohne Erklärung |
| 9 | 123 C, dann 4 + 5 = | 9 | Löschen funktioniert |
| 10 | 12345678 + 1 = | 12345679, keine Stelle verloren | 8 Stellen wie das Original |

Halbe Punkte, wenn das Ergebnis stimmt, aber die Bedienung hakt (Taste nicht klickbar, Anzeige erst nach Neuladen).

## Treue zu den Fotos
Die zehn Kriterien aus `eval/visual-rubric.md`, bewertet an den Bildern der Seite und, falls vorhanden, des Geräts.

## Weiterbau-Probe (0–10 Punkte)
Wie gut ließe sich dieser Stand weiterentwickeln? Stell dir vor, als Nächstes kommen diese zwei Wünsche:
1. **Speichertasten** M+, M− und MR, mit einem kleinen „M“ in der Anzeige, solange etwas gespeichert ist.
2. **12 statt 8 Stellen**, umschaltbar über den bisher funktionslosen Schalter F/2.

Lies dafür den Code (nicht bauen, nichts ändern) und schätze für jeden Wunsch: welche Dateien und Stellen sich ändern, wie groß
die Änderung ist (klein, mittel, groß) und wie riskant. Prüfe außerdem, ob etwas Automatisches die Änderung absichern würde:
Gibt es Tests, die an diesen Code andocken und ihn tatsächlich prüfen (nicht bloß Testdateien im Ordner)?

Bewerte vier Aspekte mit je 0–10 und gib eine Gesamtnote:
- **Struktur:** Ist klar, wohin das Neue gehört?
- **Kopplung:** Wie viel muss außerhalb dieser Stelle mitgeändert werden?
- **Absicherung:** Merkt ein automatischer Test, wenn beim Umbau etwas Bestehendes kaputtgeht?
- **Verständlichkeit:** Findet sich ein neuer Entwickler schnell zurecht?
