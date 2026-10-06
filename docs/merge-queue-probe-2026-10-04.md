# Merge-Queue: Probe mit echtem Konflikt (04.10.2026)

**Frage:** Trägt die Merge-Queue mit Integrator, oder verschiebt sie das Problem nur?

**Aufbau:** Klon des fertigen Rechners (106/106 grün), zwei Spuren, die gleichzeitig `src/ui.js` ändern. Jede Spur ist für sich grün.

| Spur | Änderung |
|---|---|
| F7 | IME-Eingaben ignorieren (`isComposing`), `w`/`W` als Wurzel-Taste, Tastatur-Tooltips an jeder Bildschirmtaste, die beim Laden `KEYMAP` lesen |
| F11 | `KEYMAP` → `KEY_TO_CALC` umbenannt, `v`/`V` als Wurzel-Taste, keine Rechnertasten beim Tippen in editierbaren Inhalt |

Zwei Arten von Konflikt:
- **Textkonflikt:** dieselben Zeilen in Tabelle und `keydown`-Schutz.
- **Bedeutungskonflikt, den Git nicht sieht:** Die Tooltips von F7 hätte Git sauber übernommen. Sie lesen aber den alten Namen und hätten den Rechner beim Laden abstürzen lassen.

**Ablauf** (Code 1:1 aus `agentic-loop-parallel.js`, echte Agenten):
1. F7: sync, merge, Tor **104/104**.
2. F11: sync meldet einen Konflikt in `src/ui.js`, der Integrator löst ihn in der Spur.
3. F11: Integrationsprüfung in der Spur 106/106, merge, Tor **106/106**.
4. Keine Rücknahme nötig, keine offenen Punkte. 8 Agenten, rund 4½ Minuten.

**Ergebnis des Integrators:**
- Beide Wurzel-Tasten sind erhalten.
- Alle drei Schutzbedingungen stehen in einer Bedingung.
- Die Tooltips lesen jetzt `KEY_TO_CALC`. Das ist der versteckte Konflikt, er hat ihn selbst erkannt.
- Hinweis an die Werkstattleitung: Der Vertrag in `loop.plan.json` nennt noch `KEYMAP` und sollte nachgezogen werden. Den Plan durfte er nicht ändern.

**Nebenbefunde, schon behoben:**
- Ein Tor mit 0 grünen Anforderungen ist ein kaputter Prüfstand, kein Integrationsfehler. Die Queue hält dann laut an (`gate-broken`), statt den Integrator zu beschäftigen.
- Kennt die Session den Agententyp `loop-integrator` noch nicht (angelegt nach Session-Start), übernimmt ein `loop-builder` die Rolle aus der Datei.
