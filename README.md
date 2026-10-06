# Aristo M 64: ein Taschenrechner, vier Bauweisen

Ein Taschenrechner von 1974, viermal von KI-Agenten nachgebaut: vom schnellen One Shot bis zum parallelen Graphen. Alle vier
Ergebnisse wurden blind mit denselben Maßstäben bewertet. Dieses Repo enthält alles, um die Ergebnisse anzusehen und jeden
Weg selbst noch einmal bauen zu lassen.

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
3. **Installieren:**
   ```bash
   cd aristo-m64
   npm install
   npx playwright install chromium
   ```
4. **Prüfen, ob alles läuft** (optional, ca. 30 Sekunden, keine Tokens):
   ```bash
   npm run eval
   ```
   Am Ende steht „106/106 grün“.
5. **Claude Code in diesem Ordner öffnen** und eine frische Session starten.
6. **Erst den Überblick holen, ohne zu bauen:**
   ```
   /aristo-experience nur-tour
   ```
   Die Tutorial-Seite öffnet sich unter http://localhost:4191 und zeigt die vier Bauweisen mit ihren Ergebnissen.
7. **Bei Bedarf selbst bauen:**
   ```
   /aristo-experience
   ```
   Claude fragt nach Modellen und Umfang. Danach startet auf der Seite in jedem Tab ein Knopf den Live-Bau dieses Wegs. Gebaut wird
   in einem frischen Ordner unter `demo-runs/`, der fertige Rechner in `src/` bleibt unberührt.

**Wichtig beim Bauen:** Jeder Bau braucht eine eigene, frische Session im Hauptordner des Repos, keine Arbeitskopie (git
worktree). In der Bau-Session nur Steuerbefehle geben, Fragen in einer anderen Session stellen.

## Für eigene Projekte

Der Kern in `kit/` ist nicht an den Taschenrechner gebunden. `/agentic-loop neu <Ordner>` setzt aus einem Briefing ein
eigenes Spec-Eval-Projekt auf, `/agentic-loop bauen <Ordner>` baut es. Details in [`kit/README.md`](kit/README.md).

## Referenzfotos

Die Fotos in `spec/reference/` sind zum größten Teil eigene Aufnahmen. `m64-computersammler.jpg` stammt von
[computersammler.de](https://www.computersammler.de/).

## Lizenz

Code unter MIT-Lizenz, siehe [`LICENSE`](LICENSE). Die Lizenz gilt nicht für die Fotos fremder Quellen.

---

Ein Experiment von [überproduct](https://ueberproduct.de) · Markus Andrezak
