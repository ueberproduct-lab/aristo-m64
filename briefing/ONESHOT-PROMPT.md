# One Shot: der Auftrag

Dieser Prompt ist alles, was die Bauweise „Vibe-Coding One Shot“ bekommt: der ursprüngliche Wunsch, die beiden Klarstellungen aus
den ersten Minuten und die Fotos. Keine Spec, keine Maße, keine Rechenregeln, keine Prüfungen, keine technische Schnittstelle.
So würde es jemand machen, der einfach drauflos baut. Bewertet wird danach von Gutachtern, nicht von der versiegelten Prüfung.

---

Bau mir bitte einen Taschenrechner als Web-App, die lokal auf localhost läuft.

> Der Calc soll lediglich die 4 Grundrechenarten können, plus Wurzel und Prozentrechnung.
> Das Wichtigste: Im Look and Feel soll er aussehen und wirken wie der klassische Aristo.

- Vorbild ist der **Aristo M 64**. Fotos liegen in `spec/reference/`.
- Tasten und Schalter ohne Funktion bleiben sichtbar, aber mit einem ganz leichten Grauschleier.

Technisch: Leg die Dateien in `src/` ab (Startseite `src/index.html`). `node server.mjs` liefert den Ordner aus.
