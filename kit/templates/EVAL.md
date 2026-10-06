# EVAL — <Projektname>

Das Eval ist **versiegelt** (`eval/seal.mjs`, Liste `seal` in `loop.config.json`). Wer baut, ändert es nicht.
Jede ID aus der Spec hat mindestens eine Prüfung, deren Titel mit der ID beginnt.

## Ausführen
| Befehl | Zweck |
|---|---|
| `<evalAll>` | komplette Suite → `eval/report.json` + `eval/report.md` |
| `<evalUpTo mit F3>` | Feature F3 und Regression aller früheren |
| `node eval/seal.mjs --check` | Siegel prüfen |

## Kern-Format des Berichts (`eval/report.json`)
```json
{
  "pass": false,
  "summary": { "ids": 12, "passed": 10, "failed": 2, "pending": 0, "tests": 31, "testsFailed": 3 },
  "features": { "F1": { "status": "passed", "ids": { "F-01": "passed" } } },
  "failures": [{ "id": "F-02", "test": "F-02 …", "error": "erwartet … erhalten …" }]
}
```
Mit welcher Technik geprüft wird (Unit-Tests, Browser-Tests, API-Aufrufe, Skripte), ist egal, solange dieser Bericht entsteht.

## Prüfungen
| ID | Prüfung | Datei |
|---|---|---|
| E-00 | Gerüst antwortet | <Datei> |
