# Einkaufsliste – Eval

Versiegelt (`node eval/seal.mjs --check`). `node eval/run-eval.mjs` schreibt `eval/report.json` und `eval/report.md`.
Optionen: `--feature F3` (bis F3), `--select F0,F2` (genau diese), ohne Option alles.
Die Prüfungen stehen in `eval/checks.mjs`, je ID eine. G-01 vergleicht die CLI-Ausgabe der Beispielliste mit
`reference/render.txt` (fehlt die Datei: ausstehend). `node eval/golden.mjs` friert die aktuelle Ausgabe als Referenz ein.
