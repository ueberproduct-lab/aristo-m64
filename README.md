# Aristo M 64: ein Taschenrechner, vier Bauweisen

Ein Taschenrechner von 1974, viermal von KI-Agenten nachgebaut: vom schnellen One Shot bis zum parallelen Graphen. Alle vier
Ergebnisse wurden blind mit denselben Maßstäben bewertet. Dieses Repo enthält alles, um die Ergebnisse anzusehen und jeden
Weg selbst noch einmal bauen zu lassen.

Das Video dazu: [Kann ein Non-Coder Loop-Engineering?](https://youtu.be/HDWxSmRVGV8)

Die Geschichte dazu: [Ein Taschenrechner, vier Bauweisen](https://ueberproduct.de/ein-taschenrechner-vier-bauweisen/)

## Was drin ist

| Ordner | Inhalt |
|---|---|
| `src/` | der fertige Rechner (Port 4173) |
| `SPEC.md`, `spec/` | die Spec mit IDs, Design-Tokens und Referenzfotos |
| `eval/`, `EVAL.md` | das versiegelte Eval: 106 Prüf-IDs, Golden Screenshots, Rubriken für den Gutachter |
| `experience/` | die Tutorial-Seite mit den dokumentierten Ergebnissen (Port 4191) |
| `.claude/` | Skills, Workflows und Agenten-Rollen für die vier Bauweisen |
| `kit/` | der allgemeine Agentic-Loop-Kern zum Mitnehmen in eigene Projekte |
| `tools/` | Mess- und Werkstatt-Werkzeuge |

## Die vier Bauweisen und was sie gekostet haben

| Bauweise | Dauer | Tokens | Prüf-IDs grün | Aussehen (von 20) |
|---|---|---|---|---|
| One Shot (Vibe-Coding, nur Prompt und Fotos) | 11 min | ca. 0,34 Mio. | nicht geprüft | 14 |
| Direktbau (ein Durchgang gegen die Spec) | 22 min | ca. 0,36 Mio. | 103/106 | 17 |
| Loop (Builder, Tester, Gutachter, Aufräumer in Schleife) | 148 min | ca. 4,2 Mio. | 106/106 | 20 |
| Graph (dieselbe Schleife, parallel in Spuren) | 136 min | ca. 4,3 Mio. | 106/106 | 20 |

Wer selbst baut, sollte mit ähnlichen Größenordnungen rechnen.

## So geht's

1. **Voraussetzungen:** [Claude Code](https://claude.com/claude-code) mit Dynamic Workflows, Node.js (getestet mit Node 25), git.
2. **Herunterladen:**
   ```bash
   git clone https://github.com/ueberproduct-lab/aristo-m64.git
   ```
   Oder auf GitHub über den grünen Knopf „Code“ → „Download ZIP“ und entpacken. Wer eigene Änderungen ausprobieren will,
   forkt das Repo vorher („Fork“ oben rechts) und klont den Fork.
3. **Claude Code in diesem Ordner öffnen und eingeben:**
   ```
   /aristo-experience
   ```
   Beim ersten Start richtet Claude das Repo selbst ein: `npm install`, `npx playwright install chromium` und einmal
   `npm run eval` als Kurzcheck (ca. 30 Sekunden, keine Tokens, am Ende „106/106 grün“). Danach öffnet sich die
   Tutorial-Seite unter http://localhost:4191.
4. **Lesen, schauen, und wer will: selbst bauen lassen.** In der Werkstatt hat jede Bauweise einen Knopf „Diese Bauweise selbst
   bauen lassen“. Nach dem Drücken fragt Claude im Chat nach Modellen und Umfang, dann baut es live in einem frischen Ordner
   unter `demo-runs/`. Der fertige Rechner in `src/` bleibt unberührt.

**Wichtig:** Nach `/aristo-experience` in dieser Session nur noch auf Claudes Fragen antworten. Eigene Fragen zum Projekt
bitte in einer anderen Session stellen. Grund: Die Bau-Agenten bekommen die letzte Nachricht aus dem Chat mit und würden sie
als Auftrag verstehen. Die Session muss im Ordner des Repos selbst laufen, nicht in einer Arbeitskopie (git worktree).

## Der Kern in `kit/`

Der Kern in `kit/` ist allgemein gebaut und zeigt, wie man das Muster auf andere Projekte überträgt. Er ist Anschauungsmaterial
für dieses Experiment, kein gepflegtes Werkzeug. Details in [`kit/README.md`](kit/README.md).

## Referenzfotos

Die Fotos in `spec/reference/` sind zum größten Teil eigene Aufnahmen. `m64-computersammler.jpg` stammt von
[computersammler.de](https://www.computersammler.de/).

## Lizenz

Code unter MIT-Lizenz, siehe [`LICENSE`](LICENSE). Die Lizenz gilt nicht für die Fotos fremder Quellen.

---

Ein Experiment von [überproduct](https://ueberproduct.de) · Markus Andrezak
