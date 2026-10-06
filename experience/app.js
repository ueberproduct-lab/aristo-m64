// Aristo M 64 tutorial: chapters, file previews and the live workshop (polls /api/state).
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// ── plain-language names ────────────────────────────────────────────────
const SHORT = {
  F0: 'Gerüst', F1: 'Gehäuse', F2: 'LED-Anzeige', F3: 'Tasten', F4: 'Eingabe', F5: 'Rechnen', F6: '√ und %', F7: 'Bedienung',
  F8: 'Hülle', F9: 'Flackern', F10: 'Klang', F11: 'Stumm', F12: 'Feinschliff', F13: 'Wie das Original', F14: 'Schieber', F15: 'Tonhöhe',
};
const STAGE2_TEXT = {
  F8: ['Schutzhülle', 'die cremeweiße Hülle, mit Easter Egg: Ein Klick auf „MADE IN GERMANY“ nimmt sie ab.'],
  F9: ['Flackern', 'die LED-Anzeige flackert beim Tastendruck ganz leicht, wie damals.'],
  F10: ['Tastenklang', 'ein satter, mechanischer Klick, synthetisch erzeugt, ohne Audiodatei.'],
  F11: ['Stummschalter', 'Easter Egg: Ein Klick auf das Logo schaltet den Ton stumm.'],
  F12: ['Feinschliff', 'Logo in Futura, erhabene Schieber, plastische Stufen im Gehäuse.'],
  F13: ['Wie das Original', 'Proportionen nach Foto, transluzente Anzeige, gerundete Kanten, Ton auch in Safari.'],
  F14: ['Schieber', 'Cremeklötze mit harter Kante und Schatten, wie am Original.'],
  F15: ['Tonhöhe', 'jede Tastenreihe klingt ein wenig höher als die darunter.'],
};
const ROLES = [
  { id: 'architect', key: 'white', letter: 'A', name: 'Architekt', tech: 'loop-architect', match: /^architektur/, onlyParallel: true },
  { id: 'builder', key: 'white', letter: 'B', name: 'Handwerker', tech: 'loop-builder', match: /^(build|gerüst|konflikt)/ },
  { id: 'integrator', key: 'red', letter: 'I', name: 'Integrator', tech: 'loop-integrator', match: /^integrator/, onlyParallel: true },
  { id: 'tester', key: 'yellow', letter: 'T', name: 'Prüfer', tech: 'loop-tester', match: /^(test|final eval)/ },
  { id: 'judge', key: 'yellow', letter: 'J', name: 'Gutachter', tech: 'loop-judge', match: /^(judge|final judge)/ },
  { id: 'refactor', key: 'red', letter: 'R', name: 'Aufräumer', tech: 'loop-refactorer', match: /^refactor(?! verwerfen)/ },
  { id: 'helper', key: 'white', letter: 'W', name: 'Werkstatt-Gehilfe', tech: 'ohne Rolle', match: /^(golden|commit|thaw|refactor verwerfen|report|spuren|merge|sync|undo|plan)/ },
];
const METRIC = {
  locTotal: 'Zeilen Code', cognitiveMax: 'schwierigste Funktion', cognitiveTotal: 'Kompliziertheit gesamt', duplicationPct: 'doppelter Code %',
  clones: 'kopierte Stellen', longFunctions: 'überlange Funktionen', unusedExports: 'ungenutzte Exporte', unusedCssClasses: 'ungenutzte CSS-Klassen',
  processComments: 'Bau-Kommentare',
};
const STOP = { 'targets-met': 'alle Ziele erreicht', 'max-steps': 'Schrittbudget aufgebraucht', 'no-gain': 'kein Gewinn mehr', reverts: 'zwei Schritte zurückgenommen', 'boy-scout': 'ein Pfadfinder-Schritt' };

/** what an agent is doing right now, in plain words */
function friendly(t) {
  const w = t.what || '';
  if (t.tool === 'denkt') return ['überlegt', w];
  if (t.tool === 'Read') return ['liest', w.replace(/^.*\//, '')];
  if (t.tool === 'Edit' || t.tool === 'Write') return ['ändert', w.replace(/^.*\//, '')];
  if (t.tool === 'Grep' || t.tool === 'Glob') return ['sucht', w];
  if (/eval:capture/.test(w)) return ['fotografiert', 'den Rechner für den Vergleich'];
  if (/eval:golden/.test(w)) return ['friert ein', 'das Referenzfoto'];
  if (/run eval|run-eval/.test(w)) return ['prüft', 'alle Anforderungen bis zu diesem Feature'];
  if (/lock\.mjs/.test(w)) return ['prüft', 'das Siegel der Prüfung'];
  if (/code-metrics|refactor-record/.test(w)) return ['misst', 'die Ordnung im Code'];
  if (/git commit/.test(w)) return ['hält fest', 'den Stand im Logbuch'];
  return ['arbeitet', t.desc || w]; // the agent's own one-line description reads better than the raw command
}

// ── the loop as a ring of Aristo keys ───────────────────────────────────
const NODES = [
  { id: 'builder', letter: 'B', name: 'Bauen', key: 'var(--cream)' },
  { id: 'tester', letter: 'T', name: 'Prüfen', key: 'var(--amber)' },
  { id: 'judge', letter: 'J', name: 'Begutachten', key: 'var(--amber)' },
  { id: 'golden', letter: 'G', name: 'Referenzfoto', key: 'var(--cream)' },
  { id: 'commit', letter: 'C', name: 'Festhalten', key: 'var(--cream)' },
  { id: 'refactor', letter: 'R', name: 'Aufräumen', key: 'var(--red)' },
];
function drawLoop(svg) {
  const g = svg.querySelector('.loop-nodes');
  const cx = 260, cy = 260, r = 178, size = 70;
  const pos = NODES.map((_, i) => { const a = (-90 + i * 60) * Math.PI / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; });
  let html = '';
  pos.forEach(([x, y], i) => {
    const [nx, ny] = pos[(i + 1) % pos.length];
    const a1 = Math.atan2(y - cy, x - cx) + 0.32, a2 = Math.atan2(ny - cy, nx - cx) - 0.32;
    html += `<path class="edge" d="M ${cx + r * Math.cos(a1)} ${cy + r * Math.sin(a1)} A ${r} ${r} 0 0 1 ${cx + r * Math.cos(a2)} ${cy + r * Math.sin(a2)}"/>`;
  });
  NODES.forEach((n, i) => {
    const [x, y] = pos[i];
    const below = y >= cy - 10;
    html += `<g class="node" data-node="${n.id}">
      <rect class="shadow" x="${x - size / 2 + 5}" y="${y - size / 2 + 5}" width="${size}" height="${size}"/>
      <rect class="face-rect" x="${x - size / 2}" y="${y - size / 2}" width="${size}" height="${size}" fill="${n.key}"/>
      <text class="letter" x="${x}" y="${y}">${n.letter}</text>
      <text class="name" x="${x}" y="${below ? y + size / 2 + 22 : y - size / 2 - 12}">${n.name}</text></g>`;
  });
  g.innerHTML = html;
}
document.querySelectorAll('.loop-svg').forEach(drawLoop);

// ── file previews ───────────────────────────────────────────────────────
const dlg = $('#fileDialog');
$('#fileClose').onclick = () => dlg.close();
async function showFile(p) {
  $('#fileTitle').textContent = p;
  $('#fileBody').textContent = 'lädt …';
  dlg.showModal();
  const t = await (await fetch(`/api/file?p=${encodeURIComponent(p)}`)).text();
  const lines = t.split('\n');
  $('#fileBody').textContent = lines.slice(0, 220).join('\n') + (lines.length > 220 ? `\n\n… (${lines.length - 220} weitere Zeilen)` : '');
}
document.querySelectorAll('.artifact').forEach((a) => { a.querySelector('button').onclick = () => showFile(a.dataset.file); });
document.querySelectorAll('a.file').forEach((a) => { a.href = '#'; a.onclick = (e) => { e.preventDefault(); showFile(a.dataset.file); }; });

// ── four building styles: tabs, documented results, start requests ──────
const VARIANTS = { oneshot: 'One Shot', direct: 'Direktbau', loop: 'Agentic Loop', graph: 'Graph' };
// the steps a build goes through, per variant: [title, workflow phases, what happens, in plain words]
const STEPS = {
  oneshot: [['Bauen', ['Bauen'], 'Ein Agent liest den Auftrag und die Fotos und baut alles in einem Durchgang.'], ['Festhalten', ['Festhalten'], 'Der Stand wird im Logbuch festgehalten.']],
  direct: [['Bauen', ['Bauen'], 'Ein Agent liest Spec, Maße und Fotos und baut alles in einem Durchgang.'], ['Festhalten', ['Festhalten'], 'Der Stand wird im Logbuch festgehalten.']],
  loop: [['Bauen', ['Setup', 'Bauen'], 'Feature für Feature: bauen, prüfen, begutachten, nachbessern, festhalten.'], ['Aufräumen', ['Refactor'], 'Der Aufräumer ordnet den Code, die Prüfung wacht darüber.'], ['Abnahme', ['Abnahme'], 'Alles wird noch einmal geprüft und begutachtet.']],
  graph: [['Architektur', ['Architektur'], 'Der Architekt liest Spec, Features und Prüfungen und schneidet den Rechner in Einheiten mit Verträgen. Der Takt prüft den Schnitt.'],
    ['Plan & Gerüst', ['Gerüst'], 'Der Plan wird festgehalten. Für jede Einheit entsteht eine Hülle, die ihren Vertrag schon erfüllt, damit parallel gebaut werden kann.'],
    ['Wellen', ['Wellen', 'Setup', 'Bauen', 'Refactor'], 'In jeder Welle bauen Spuren gleichzeitig, jede in ihrer eigenen Kopie. Dann die Merge-Queue: Spur für Spur holt den Hauptstand, der Integrator löst Konflikte, erst dann wird zusammengeführt und am Tor alles geprüft.'],
    ['Abnahme', ['Abnahme'], 'Alles wird noch einmal geprüft und begutachtet.']],
};
const CENTER = [[/^architektur/, 'Architekt', 'schneidet Einheiten'], [/^plan festhalten/, 'Plan', 'wird festgehalten'], [/^gerüst/, 'Gerüst', 'Hüllen anlegen'],
  [/^spuren welle (\d+)/, 'Welle $1', 'Spuren anlegen'], [/^sync/, 'Merge-Queue', 'Hauptstand in die Spur'], [/^integrator/, 'Integrator', 'Konflikte lösen'],
  [/^merge/, 'Merge-Queue', 'Spur für Spur'], [/^undo/, 'Zurücknehmen', 'Tor war rot'], [/^test tor (\d+)/, 'Tor $1', 'alles prüfen'], [/^spuren aufräumen/, 'Aufräumen', 'Spuren entfernen']];
const STAGED = ['loop', 'graph'];
let activeTab = (() => { try { return localStorage.getItem('aristo-tab'); } catch { return null; } })() || 'loop';
function showTab(v) {
  activeTab = v;
  try { localStorage.setItem('aristo-tab', v); } catch { /* private window */ }
  document.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === v)));
  document.querySelectorAll('.tab-panel').forEach((t) => { t.hidden = t.dataset.variant !== v; });
}
document.querySelectorAll('[data-tab]').forEach((b) => { b.onclick = () => showTab(b.dataset.tab); });
showTab(activeTab);
document.querySelectorAll('[data-trigger]').forEach((t) => {
  t.querySelector('button').onclick = async () => {
    t.querySelector('button').disabled = true;
    await fetch(`/api/start?variant=${t.dataset.trigger}`, { method: 'POST' });
    tick();
  };
});

let lastSrc = 0;
// a builder's partial self-check ("only F15", "look") must not reset counters and tiles
let lastFullReport = null;
const fullOrLast = (r) => (r && (r.scope === 'all' || /^up to /.test(r.scope || '')) ? (lastFullReport = r) : lastFullReport || r);
// the calculator corner belongs to the workshop: visible there, or anywhere while a build is running
let inWorkshop = false;
let buildingNow = false;
new IntersectionObserver(([e]) => { inWorkshop = e.isIntersecting; placeCorner(); }, { threshold: 0.05 }).observe($('#bauweisen'));
function placeCorner() { $('#corner').classList.toggle('away', !(inWorkshop || buildingNow)); }
let numbersSet = false;

function fitCorner() {
  const frame = $('#cornerFrame'), app = $('#cornerApp');
  const k = Math.min(frame.clientWidth / 760, frame.clientHeight / 900);
  app.style.transform = `translateX(-50%) scale(${k})`;
}
new ResizeObserver(fitCorner).observe($('#cornerFrame'));

let state = {};
function render(st) {
  const s = st.state || {};
  state = s;
  document.querySelectorAll('[data-model]').forEach((el) => { const m = (s.models || {})[el.dataset.model]; if (m) el.textContent = m; });
  if (!numbersSet && st.numbers) {
    document.querySelectorAll('[data-n]').forEach((el) => { const v = st.numbers[el.dataset.n]; if (v != null) el.textContent = v; });
    numbersSet = true;
  }
  const events = st.workflow?.events || [];
  const running = events.filter((e) => e.running);
  const phase = s.phase || 'none';
  const onlyStage1 = s.scope === 'stage1';
  const variant = s.variant || null;
  const building = ['stage1', 'stage2', 'stage2-spec', 'building', 'assessing'].includes(phase) || running.length > 0;
  const name = VARIANTS[variant] || 'Der Bau';

  // the live workshop sits in the tab of the build that runs (or ran last)
  const hint = $('#startHint');
  hint.textContent = {
    'start-requested': `Startsignal für ${VARIANTS[s.requested] || 'den Bau'} gesendet. Beantworte in Claude Code die zwei kurzen Fragen, dann geht es los.`,
    building: `${name} baut …`,
    stage1: 'Stufe 1 läuft: Der grobe Rechner entsteht.',
    'stage2-spec': 'Stufe 1 ist abgenommen. Die Spec wird verfeinert …',
    stage2: 'Stufe 2 läuft: verfeinerte Optik, Klang und die Easter Eggs.',
    assessing: 'Gebaut. Jetzt bewerten die Gutachter …',
    done: STAGED.includes(variant) && onlyStage1 ? 'Fertig. Stufe 1 ist abgenommen, Stufe 2 war nicht gewählt.' : 'Fertig.',
    failed: 'Angehalten. Der Mensch entscheidet, wie es weitergeht.',
  }[phase] || '';
  $('#liveTitle').textContent = variant ? `Live-Werkstatt · ${name}` : 'Live-Werkstatt';
  $('#liveLed').className = `led ${building ? 'on' : phase === 'done' ? 'ok' : 'off'}`;
  const liveTab = variant && document.querySelector(`[data-live="${variant}"]`);
  if (liveTab && $('#liveArea').parentElement !== liveTab) liveTab.appendChild($('#liveArea'));
  $('#liveArea').querySelector('.stages').hidden = !STAGED.includes(variant);
  $('#navLive').className = `led ${building ? 'on' : phase === 'done' ? 'ok' : 'off'}`;
  renderTriggers(st, phase, building);

  // stages
  const st1 = $('#stage1'), st2 = $('#stage2');
  st1.className = `stage ${phase === 'stage1' ? 'active' : ['stage2-spec', 'stage2', 'done'].includes(phase) ? 'done' : ''}`;
  st2.className = `stage ${onlyStage1 ? 'skipped' : ['stage2-spec', 'stage2'].includes(phase) ? 'active' : phase === 'done' ? 'done' : ''}`;
  st1.querySelector('.stage-state').textContent = phase === 'stage1' ? 'läuft' : ['stage2-spec', 'stage2', 'done'].includes(phase) ? 'abgenommen' : '';
  st2.querySelector('.stage-state').textContent = onlyStage1 ? 'nicht gewählt' : phase === 'stage2-spec' ? 'Spec wird verfeinert' : phase === 'stage2' ? 'läuft' : phase === 'done' ? 'abgenommen' : '';

  // current feature + active node
  const cur = running[0] || events[events.length - 1];
  const fm = cur && cur.label.match(/F\d+/), im = cur && cur.label.match(/#(\d+)/);
  $('#liveFeature').textContent = fm ? `${fm[0]} · ${SHORT[fm[0]] || ''}` : (cur && /refactor/.test(cur.label) ? 'Aufräumrunde' : cur && /final/.test(cur.label) ? 'Endabnahme' : '–');
  const runningFeatures = [...new Set(running.map((e) => (e.label.match(/F\d+/) || [])[0]).filter(Boolean))];
  if (runningFeatures.length > 1) $('#liveFeature').textContent = runningFeatures.join(' · ');
  $('#liveIter').textContent = runningFeatures.length > 1 ? `${runningFeatures.length} Spuren parallel` : im ? `Versuch ${im[1]}` : (running.length ? 'läuft' : '');
  // phases without a feature (architect, scaffold, merge, gate) get their own words in the middle of the ring
  const special = cur && !fm && runningFeatures.length < 2 && CENTER.find(([re]) => re.test(cur.label));
  if (special) {
    const m = cur.label.match(special[0]);
    $('#liveFeature').textContent = special[1].replace('$1', (m && m[1]) || '');
    $('#liveIter').textContent = special[2];
  }
  renderSteps(s.variant, events, running, building, st.plan);
  const activeIds = new Set(running.map((e) => (/^build/.test(e.label) ? 'builder' : /^(test|final eval)/.test(e.label) ? 'tester' : /judge/.test(e.label) ? 'judge' : /^(golden|thaw)/.test(e.label) ? 'golden' : /^commit/.test(e.label) ? 'commit' : /^refactor(?! verwerfen)/.test(e.label) ? 'refactor' : '')));
  document.querySelectorAll('.loop-svg.live .node').forEach((n) => n.classList.toggle('active', activeIds.has(n.dataset.node)));

  // agents
  const parallelMode = s.variant === 'graph' || !!st.plan;
  $('#agents').innerHTML = ROLES.filter((r) => !r.onlyParallel || parallelMode).map((r) => {
    const mine = events.filter((e) => r.match.test(e.label));
    const last = mine[mine.length - 1];
    let what = 'wartet', trail = '';
    if (last && last.running) {
      const busy = mine.filter((e) => e.running);
      what = busy.length > 1 ? `arbeitet gleichzeitig an <b>${busy.map((e) => esc(e.label)).join(' · ')}</b>` : `arbeitet an <b>${esc(last.label)}</b>`;
      trail = (last.trail || []).slice().reverse().map((t) => { const [v, o] = friendly(t); return `<li><span class="verb">${v}</span> ${esc(o)}</li>`; }).join('');
    } else if (last) {
      if (last.kind === 'test') what = `zuletzt <b>${esc(last.label)}</b>: ${last.pass ? 'alles grün' : 'noch rot'} (${esc(last.ids)})`;
      else if (last.kind === 'judge') what = `zuletzt <b>${esc(last.label)}</b>: ${last.score} von ${last.max} Punkten`;
      else if (last.kind === 'refactor') what = `zuletzt ${last.steps} Aufräumschritte, Stopp: ${STOP[last.stopReason] || esc(last.stopReason)}`;
      else if (last.kind === 'commit') what = `zuletzt festgehalten: <b>${esc(last.hash || '')}</b> ${esc(last.shortstat || '')}`;
      else if (last.kind === 'build') what = `zuletzt <b>${esc(last.label)}</b> fertig gebaut`;
      else what = `zuletzt <b>${esc(last.label)}</b>`;
    }
    return `<div class="agent ${last && last.running ? 'running' : ''}"><span class="key ${r.key}">${r.letter}</span>
      <div><div class="who">${r.name} <small>${r.tech}${(s.models || {})[r.id] ? ` · ${esc(s.models[r.id])}` : ''}</small>${last && last.running ? '<span class="led on"></span>' : ''}</div>
      <div class="what">${what}</div>${trail ? `<ul class="trail">${trail}</ul>` : ''}</div></div>`;
  }).join('');

  // feature track
  const all = Object.keys(st.allFeatures || SHORT);
  const unlocked = new Set(Object.keys(st.runFeatures || {}));
  const report = fullOrLast(st.report);
  const rep = report?.features || {};
  const committed = new Set((st.commits || []).map((c) => (c.s.match(/^feat\((F\d+)\)/) || [])[1]).filter(Boolean));
  const iters = {};
  for (const p of st.progress || []) iters[p.feature] = Math.max(iters[p.feature] || 0, p.iteration || 0);
  const curF = fm && fm[0];
  const tile = (f) => {
    const status = (runningFeatures.includes(f) || (curF === f && running.length)) ? 'active' : rep[f]?.status === 'passed' || committed.has(f) ? 'done' : rep[f]?.status === 'failed' && unlocked.has(f) && iters[f] ? 'failed' : unlocked.has(f) ? '' : 'locked';
    return `<div class="tile ${status}">${iters[f] ? `<span class="it">${iters[f]}×</span>` : ''}<div>${f}<small>${SHORT[f] || ''}</small></div></div>`;
  };
  $('#track').innerHTML = `<div class="sep">Stufe 1 · der grobe Rechner</div>${all.filter((f) => Number(f.slice(1)) <= 7).map(tile).join('')}
    <div class="sep">Stufe 2 · die verfeinerte Spec</div>${all.filter((f) => Number(f.slice(1)) >= 8).map(tile).join('')}`;

  // counters
  const sum = report?.summary;
  const ratio = (n, of) => `${n}<i class="of">/${of}</i>`;
  $('#cIds').innerHTML = sum ? ratio(sum.passed, sum.ids) : '–';
  $('#cTests').innerHTML = sum ? ratio(sum.tests - sum.testsFailed, sum.tests) : '–';
  $('#cCommits').textContent = st.commits?.length ?? '–';
  $('#cRefactors').textContent = st.refactors?.length ?? 0;

  // spec refinement panel
  const showSpec = ['stage2-spec', 'stage2', 'done'].includes(phase);
  $('#specRefine').hidden = !showSpec;
  if (showSpec) $('#specAdds').innerHTML = Object.entries(STAGE2_TEXT).map(([f, [t, d]]) => `<li><b><span class="n">${f}</span>${t}</b>${d}</li>`).join('');

  // logbook: newest first
  const lines = [];
  for (const e of events) {
    if (e.running) lines.push(['●', `${esc(e.label)} läuft`, '']);
    else if (e.kind === 'test') lines.push([e.pass ? '+' : '×', `${esc(e.label)}: ${esc(e.ids)} Anforderungen grün`, e.pass ? 'ok' : 'bad']);
    else if (e.kind === 'judge') lines.push(['★', `${esc(e.label)}: ${e.score}/${e.max} Punkte`, '']);
    else if (e.kind === 'commit') lines.push(['→', `Meilenstein ${esc(e.hash || '')} ${esc(e.shortstat || '')}`, 'milestone']);
    else if (e.kind === 'refactor') lines.push(['→', `Aufräumrunde: ${e.steps} Schritte, Stopp: ${STOP[e.stopReason] || esc(e.stopReason)}`, 'milestone']);
    else if (e.kind === 'build') lines.push(['•', `${esc(e.label)}: gebaut`, '']);
    else lines.push(['·', esc(e.label), '']);
  }
  $('#log').innerHTML = lines.reverse().slice(0, 80).map(([i, t, c]) => `<li class="${c}"><time>${i}</time><span>${t}</span></li>`).join('') ||
    '<li><time>·</time><span>Noch nichts passiert. Sobald der Bau läuft, steht hier jeder Schritt.</span></li>';

  renderPlan($('#liveArea'), st.plan, runningFeatures, committed);
  renderTidy($('#liveArea'), st);
  renderResults(st.results || {});
  renderCourses(st.results || {});
  renderCompare(st.results || {}, building ? name : null);

  // corner: the calculator as it is right now
  if (s.appPort && (building || st.appUp)) {
    $('#corner').hidden = false;
    buildingNow = building;
    placeCorner();
    const app = $('#cornerApp');
    if (!app.src || (st.srcMtime && st.srcMtime !== lastSrc)) {
      app.src = `http://localhost:${s.appPort}/?t=${st.srcMtime || 0}`;
      $('#cornerOpen').href = $('#footRun').href = `http://localhost:${s.appPort}/`;
      $('#footRun').textContent = `localhost:${s.appPort} ↗`;
      lastSrc = st.srcMtime;
      fitCorner();
    }
    $('#cornerLed').className = `led ${building ? 'on' : st.appUp ? 'ok' : 'off'}`;
    $('#cornerState').textContent = !st.appUp ? 'Server aus' : curF ? `bei ${curF}` : 'live';
  } else $('#corner').hidden = true;
}

// ── phase steps of the live build ──
function renderSteps(variant, events, running, building, plan) {
  const steps = STEPS[variant] || [];
  const curPhase = (running[0] || events[events.length - 1] || {}).phase;
  const idx = steps.findIndex(([, phases]) => phases.includes(curPhase));
  const waves = plan && plan.waves ? plan.waves.length : null;
  const waveNow = Math.max(0, ...events.map((e) => Number((e.label.match(/^spuren welle (\d+)/) || [])[1] || 0)));
  $('#phaseSteps').innerHTML = steps.map(([t], i) => `<li class="${i < idx || (!building && events.length && i <= idx) ? 'done' : i === idx && building ? 'on' : ''}">${t}${t === 'Wellen' && waves ? `<small>${waveNow || 0} von ${waves}</small>` : ''}</li>`).join('');
  $('#phaseNow').textContent = idx >= 0 && building ? steps[idx][2] : building ? 'Der Bau startet …' : '';
}

// ── P: the architect's plan and the waves (parallel mode) ──
function renderPlan(root, plan, runningFeatures, committed) {
  const panel = root.querySelector('.plan-panel');
  const pending = !plan && root.id === 'liveArea' && (state.variant === 'graph');
  panel.hidden = !plan && !pending;
  if (pending) {
    panel.querySelector('.plan-why').textContent = 'Der Plan entsteht gerade: Der Architekt liest Spec, Features und Prüfungen und schneidet den Rechner in Einheiten. Sobald der Takt den Schnitt geprüft hat, erscheinen hier die Einheiten und die Wellen.';
    panel.querySelector('.plan-units').innerHTML = panel.querySelector('.plan-waves').innerHTML = '';
    return;
  }
  if (!plan) return;
  panel.querySelector('.plan-why').textContent = plan.rationale || '';
  panel.querySelector('.plan-units').innerHTML = (plan.units || []).map((u) => `<div><b>${esc(u.name || u.id)}</b><small>${esc(u.purpose || '')}</small><small>${(u.files || []).map(esc).join(' · ')}</small></div>`).join('');
  const touches = Object.fromEntries((plan.features || []).map((f) => [f.id, f.touches || []]));
  panel.querySelector('.plan-waves').innerHTML = (plan.waves || []).map((w, i) => `<div class="row"><span>Welle ${i + 1}</span><div class="lanes">${w.map((f) =>
    `<span class="lane ${runningFeatures.includes(f) ? 'active' : committed.has(f) ? 'done' : ''}">${f}<small>${esc((touches[f] || []).join(', '))}</small></span>`).join('')}</div></div>`).join('');
}

// ── R: what tidying up brought (refactor-history.jsonl + the refactorer's own step descriptions) ──
const num = (v) => (typeof v === 'number' ? String(Math.round(v * 100) / 100).replace('.', ',') : '–');
function renderTidy(root, d) {
  const hist = d.refactors || [];
  const texts = (d.refactorSteps || []).filter((r) => !/Reparatur/.test(r.label));
  const seen = {};
  const stepsOf = (label) => { const i = (seen[label] = (seen[label] ?? -1) + 1); return (texts.filter((r) => r.label === label)[i] || {}).steps || []; };
  const rounds = hist.map((h) => ({ ...h, texts: stepsOf(h.label) }));
  const sum = (k) => rounds.reduce((s, r) => s + (r.kpis?.[k] || 0), 0);
  const steps = rounds.reduce((s, r) => s + (r.steps || 0), 0);
  const reverts = rounds.reduce((s, r) => s + (r.reverts || 0), 0);
  const loc = sum('locDelta');
  root.querySelector('.tidy-sum').innerHTML = [
    [rounds.length, 'Runden', 'blue'], [`${steps}`, `Schritte · ${reverts} zurück`, ''], [num(sum('gapClosed')), 'Regelverstöße beseitigt', 'blue'],
    [`${loc > 0 ? '+' : ''}${loc}`, 'Zeilen netto', ''], [rounds.length ? (rounds.every((r) => r.green) ? 'immer' : 'nicht immer') : '–', 'Prüfung grün danach', rounds.every((r) => r.green) ? 'blue' : 'red'],
  ].map(([v, l, c]) => `<div><span class="${c}">${esc(String(v))}</span><small>${l}</small></div>`).join('');
  root.querySelector('.tidy-rounds').innerHTML = rounds.length ? rounds.slice().reverse().map((r) => {
    const changed = Object.keys(METRIC).filter((k) => r.before && r.after && r.before[k] !== r.after[k]);
    return `<article><h4>${esc(r.label)}<small>${esc(r.mode || '')}</small></h4>
      <div class="meta">${r.steps} Schritt${r.steps === 1 ? '' : 'e'} · Stopp: ${STOP[r.stopReason] || esc(r.stopReason)} · Regelverstöße <b>${num(r.kpis?.gapBefore)} → ${num(r.kpis?.gapAfter)}</b> · Prüfung ${r.green ? 'grün' : 'rot'}</div>
      ${changed.length ? `<ul class="delta">${changed.map((k) => `<li>${METRIC[k]}: <b>${num(r.before[k])} → ${num(r.after[k])}</b></li>`).join('')}</ul>` : ''}
      ${r.texts.length ? `<ul>${r.texts.map((t) => `<li><b>${esc(t.rule)}:</b> ${esc(String(t.what).slice(0, 240))}${String(t.what).length > 240 ? ' …' : ''}</li>`).join('')}</ul>` : ''}
    </article>`;
  }).join('') : '<p class="tidy-empty">Die erste Aufräumrunde kommt nach drei abgenommenen Features. Danach steht hier nach jeder Runde, was der Aufräumer getan hat und was es gebracht hat.</p>';
  const last = hist.length ? hist[hist.length - 1].after : null;
  const targets = Object.entries(d.refactorTargets || {}).filter(([k]) => !k.startsWith('$'));
  root.querySelector('.tidy-targets').innerHTML = last ? targets.map(([k, t]) => `<span class="${(last[k] ?? 0) <= t ? 'ok' : 'off'}">${METRIC[k] || k}: ${num(last[k])} / Ziel ≤ ${num(t)}</span>`).join('') : '';
}

// ── documented results (experience/results.json) ──
const fmt = (v, d = 1) => (typeof v === 'number' ? String(Math.round(v * 10 ** d) / 10 ** d).replace('.', ',') : '–');
const mio = (t) => (t ? (t >= 1e6 ? `${fmt(t / 1e6)} Mio.` : `${Math.round(t / 1000)} Tsd.`) : '–');
const ratio = (x) => (x ? `${x.passed}/${x.total}` : '–');
const done = (r) => r && r.status === 'done';

const BUILD_IDLE = ($('[data-build-state]') || {}).innerHTML || '';
function renderTriggers(st, phase, building) {
  const open = st.listening && ['ready', 'done', 'failed'].includes(phase);
  const s = st.state || {};
  document.querySelectorAll('[data-trigger]').forEach((t) => {
    const v = t.dataset.trigger;
    t.querySelector('button').disabled = !open;
    t.querySelector('.hint').textContent = !st.listening && !building && phase !== 'start-requested'
      ? 'Die Werkstatt hört gerade nicht zu. In Claude Code „/aristo-experience“ starten, dann lässt sich hier jeder Weg live bauen.'
      : phase === 'start-requested' ? `Angefragt: ${VARIANTS[s.requested] || ''}. Beantworte in Claude Code die zwei kurzen Fragen, dann geht es los.`
      : building ? `Gerade läuft: ${VARIANTS[s.variant] || 'ein Bau'}. Danach ist der nächste Lauf möglich.`
      : 'Die Werkstatt ist bereit.';
  });
  // the build call to action: hero and workshop banner show whether the workshop is listening
  const ready = open, busy = building || phase === 'start-requested';
  document.querySelectorAll('[data-build-led]').forEach((l) => { l.className = `led ${busy ? 'on' : ready ? 'ok' : 'off'}`; });
  document.querySelectorAll('[data-build-cta], [data-build-bar]').forEach((b) => b.classList.toggle('ready', ready && !busy));
  const state = $('[data-build-state]');
  if (state) {
    state.innerHTML = phase === 'start-requested' ? `<b>Startsignal für ${VARIANTS[s.requested] || 'den Bau'} gesendet.</b> Beantworte jetzt in Claude Code die zwei kurzen Fragen (Modelle und Umfang), dann geht es los.`
      : busy ? `Gerade läuft: <b>${VARIANTS[s.variant || s.requested] || 'ein Bau'}</b>. Live zu sehen im Tab dieser Bauweise. Danach ist der nächste Lauf möglich.`
      : ready ? '<b>Die Werkstatt ist bereit.</b> Wähl unten eine Bauweise und drück „Diese Bauweise selbst bauen lassen“.'
      : BUILD_IDLE;
  }
  document.querySelectorAll('[data-chip]').forEach((c) => {
    const v = c.dataset.chip, r = (st.results || {})[v];
    const live = s.variant === v && building;
    c.textContent = live ? 'läuft' : done(r) ? 'dokumentiert' : 'noch offen';
    c.className = `chip ${live ? 'live' : done(r) ? 'ok' : ''}`;
  });
}

function renderResults(results) {
  document.querySelectorAll('[data-result]').forEach((el) => {
    const v = el.dataset.result, r = results[v];
    if (!done(r)) {
      el.innerHTML = `<p class="result-empty">Noch nicht gelaufen. Sobald dieser Weg einmal gebaut und gleich bewertet ist, steht das Ergebnis hier.</p>`;
      return;
    }
    const tiles = [
      ['Dauer', r.durationMin != null ? `${r.durationMin} min` : '–'],
      ['Tokens', `${r.tokensApprox ? 'ca. ' : ''}${mio(r.tokens)}`],
      ['Treue zu den Fotos', r.look ? `${r.look.score}/${r.look.max}` : 'offen'],
      ['Funktionsprobe', r.probe ? `${fmt(r.probe.score)}/10` : 'offen'],
      ['Code-Note', r.review ? `${fmt(r.review.score)}/10` : 'offen'],
      ['Weiterbaubarkeit', r.maintainability ? `${fmt(r.maintainability.score)}/10` : 'offen'],
      ['Prüfung grün', r.evalApplies === false ? 'nicht anwendbar' : ratio(r.ids)],
    ];
    const img = r.shots && (r.shots.device || r.shots.desktop);
    el.innerHTML = `<div class="result-card">
      <div class="result-tiles">${tiles.map(([k, x]) => `<div><span>${esc(x)}</span><small>${k}</small></div>`).join('')}</div>
      ${img ? `<figure><img src="${esc(img)}" alt="${VARIANTS[v]}"><figcaption>${VARIANTS[v]} · ${esc(r.date || '')}</figcaption></figure>` : ''}
      <div class="result-text">
        ${r.maintainability ? `<blockquote class="verdict maint">${esc(r.maintainability.summary)}<cite>Weiterbau-Probe · ${esc(maintHint(r.maintainability))}</cite></blockquote>` : ''}
        ${r.review && r.review.verdict ? `<blockquote class="verdict">${esc(r.review.verdict)}<cite>Code-Gutachter${r.review.comparedWith ? ' (im Vergleich zum Direktbau bzw. zur Schleife)' : ''}</cite></blockquote>` : ''}
        ${(r.notes || []).length ? `<ul class="notes">${r.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
      </div>
    </div>`;
  });
}

// [label, value(r), lower is better?] – the same rows for all four ways
const ROWS = [
  ['Aufwand'],
  ['Dauer', (r) => r.durationMin != null && [r.durationMin, 'min'], true],
  ['Tokens', (r) => r.tokens && [mio(r.tokens), r.tokensApprox ? 'ca.' : '', r.tokens], true],
  ['Tokens je Zeile Code', (r) => r.tokens && r.metrics && r.metrics.locTotal && [Math.round(r.tokens / r.metrics.locTotal).toLocaleString('de-DE'), '', r.tokens / r.metrics.locTotal], true],
  ['Urteil der Gutachter'],
  ['Treue zu den Fotos', (r) => r.look && [`${r.look.score}/${r.look.max}`, '', r.look.score / r.look.max]],
  ['Funktionsprobe', (r) => r.probe && [fmt(r.probe.score), 'von 10', r.probe.score]],
  ['Code-Note', (r) => r.review && [fmt(r.review.score), 'von 10', r.review.score]],
  ['Weiterbaubarkeit', (r) => r.maintainability && [fmt(r.maintainability.score), maintHint(r.maintainability), r.maintainability.score]],
  ['Versiegelte Prüfung'],
  ['Anforderungen grün', (r) => r.evalApplies !== false && r.ids && [ratio(r.ids), r.ids.pending ? `${r.ids.pending} offen` : '', r.ids.passed / r.ids.total]],
  ['davon Briefing-Kern (F0–F7)', (r) => r.evalApplies !== false && r.idsCore && [ratio(r.idsCore), '', r.idsCore.passed / r.idsCore.total]],
  ['Features komplett grün', (r) => r.evalApplies !== false && r.featuresGreen && [ratio(r.featuresGreen), '', r.featuresGreen.passed]],
  ['Code, gemessen'],
  ['Zeilen Code', (r) => r.metrics && [r.metrics.locTotal, ''], true],
  ['Schwierigste Funktion (Grenze 10)', (r) => r.metrics && [r.metrics.cognitiveMax, ''], true],
  ['Überlange Funktionen', (r) => r.metrics && [r.metrics.longFunctions, ''], true],
  ['Toter Code', (r) => r.metrics && [r.metrics.unusedExports + r.metrics.unusedCssClasses, 'Stellen'], true],
  ['Meilensteine (Commits)', (r) => r.commits != null && [r.commits, '']],
];
const maintHint = (m) => (m.aspects ? `Struktur ${fmt(m.aspects.structure)} · Kopplung ${fmt(m.aspects.coupling)} · Absicherung ${fmt(m.aspects.safetyNet)} · Verständlich ${fmt(m.aspects.clarity)}` : 'von 10');
// the fifth column: a human doing it, deliberately unknown – the table asks instead of answering
const HUMAN = {
  'Dauer': 'Tage? Wochen?', 'Tokens': 'keine, dafür Stunden', 'Tokens je Zeile Code': 'Kaffee je Zeile?', 'Treue zu den Fotos': 'mit Liebe zum Detail?',
  'Funktionsprobe': 'nach dem ersten Anlauf?', 'Code-Note': 'je nach Erfahrung', 'Weiterbaubarkeit': 'mit Tests?', 'Anforderungen grün': 'gegen dieselbe Prüfung?',
  'davon Briefing-Kern (F0–F7)': '', 'Features komplett grün': '', 'Zeilen Code': 'mehr oder weniger?', 'Schwierigste Funktion (Grenze 10)': '',
  'Überlange Funktionen': '', 'Toter Code': '', 'Meilensteine (Commits)': '',
};
const EVAL_ROWS = ['Anforderungen grün', 'davon Briefing-Kern (F0–F7)', 'Features komplett grün'];
function renderCompare(results, runningName) {
  const vs = Object.keys(VARIANTS);
  const ok = vs.filter((v) => done(results[v]));
  const human = (k) => `<span class="v human-cell">???${HUMAN[k] ? `<small>${HUMAN[k]}</small>` : ''}</span>`;
  $('#compareTable').innerHTML = `<div class="h"><span></span>${vs.map((v) => `<span>${VARIANTS[v]}</span>`).join('')}<span>Mensch</span></div>` + ROWS.map(([k, f, lower]) => {
    if (!f) return `<div class="sec"><span>${k}</span>${vs.map(() => '<span></span>').join('')}<span></span></div>`;
    const cells = vs.map((v) => (done(results[v]) ? f(results[v]) || null : null));
    const nums = cells.map((c) => (c ? (c[2] != null ? Number(c[2]) : Number(c[0])) : NaN));
    const valid = nums.filter(Number.isFinite);
    const best = valid.length > 1 && new Set(valid).size > 1 ? (lower ? Math.min(...valid) : Math.max(...valid)) : null;
    // empty cell: the sealed eval does not apply to a build without its interface (One Shot); anything else is simply not judged yet
    const empty = (v) => (EVAL_ROWS.includes(k) && results[v] && results[v].evalApplies === false ? 'nicht anwendbar' : 'offen');
    return `<div><span class="k">${k}</span>${cells.map((c, i) => `<span class="v ${best !== null && nums[i] === best ? 'win' : ''}">${c ? `${esc(String(c[0]))}${c[1] ? `<small>${esc(c[1])}</small>` : ''}` : `<small>${empty(vs[i])}</small>`}</span>`).join('')}${human(k)}</div>`;
  }).join('');
  $('#compareShots').innerHTML = vs.map((v) => {
    const r = results[v], img = done(r) && r.shots && (r.shots.device || r.shots.desktop);
    return `<figure>${img ? `<img src="${esc(img)}" alt="${VARIANTS[v]}">` : '<div class="shot-empty">noch offen</div>'}<figcaption>${VARIANTS[v]}</figcaption></figure>`;
  }).join('') + '<figure><div class="shot-empty human-shot">???</div><figcaption>Mensch</figcaption></figure>';
  // the conclusion is offered once there is something to compare
  $('#fazitBtn').disabled = ok.length < 2;
  $('#fazitHint').textContent = `${ok.length} von 4 Wegen dokumentiert.` + (runningName ? ` Gerade läuft: ${runningName}, danach werden die Zahlen ersetzt.` : ok.length < 4 ? ' Die fehlenden lassen sich in § 04 starten.' : '');
  const L = results.loop;
  $('#fazitNumbers').innerHTML = done(L) ? ok.filter((v) => v !== 'loop').map((v) => {
    const r = results[v];
    const t = L.durationMin && r.durationMin ? `${fmt(L.durationMin / r.durationMin)}-mal so schnell wie die Schleife` : '';
    const k = L.tokens && r.tokens ? `${fmt(L.tokens / r.tokens, 0)}-mal weniger Tokens` : '';
    const q = [r.look && L.look ? `Fotos ${r.look.score} statt ${L.look.score} von ${L.look.max}` : '', r.review && L.review ? `Code-Note ${fmt(r.review.score)} statt ${fmt(L.review.score)}` : '',
      r.maintainability && L.maintainability ? `Weiterbaubarkeit ${fmt(r.maintainability.score)} statt ${fmt(L.maintainability.score)}` : '',
      r.evalApplies !== false && r.ids && L.ids ? `${r.ids.passed} statt ${L.ids.passed} Anforderungen grün` : ''].filter(Boolean).join(', ');
    return `<b>${VARIANTS[v]}:</b> ${[t, k].filter(Boolean).join(', ')}${q ? `; ${q}` : ''}.`;
  }).join('<br>') : '';
}
$('#fazitBtn').onclick = () => { $('#fazit').hidden = false; $('#fazitBtn').hidden = true; $('#fazit').scrollIntoView({ behavior: 'smooth', block: 'start' }); };

// ── documented course of each way (experience/results/<variant>/run.json via /api/run) ──
const ROLE_ROWS = [['architect', 'Architekt'], ['builder', 'Handwerker'], ['integrator', 'Integrator'], ['tester', 'Prüfer'], ['judge', 'Gutachter'],
  ['refactor', 'Aufräumer'], ['reviewer', 'Code-Gutachter'], ['helper', 'Gehilfe']];
const courseLoaded = {};
const ms = (iso) => Date.parse(iso);
const clock = (m) => (m >= 60 ? `${Math.floor(m / 60)} h ${String(Math.round(m % 60)).padStart(2, '0')} min` : `${Math.round(m)} min`);
const outcome = (a) => (a.kind === 'test' ? `${a.pass ? '✓' : '×'} ${a.ids}` : a.kind === 'judge' ? `${a.score}/${a.max}` : a.kind === 'refactor' ? `${a.steps} Schritte` : a.kind === 'commit' ? (a.hash || '') : a.kind === 'plan' ? `${a.units} Einheiten` : '');

/** activity timeline: one block per role, overlapping agents of a role stack into extra rows */
function timelineHtml(run) {
  const t0 = ms(run.from), T = Math.max(ms(run.to) - t0, 60000);
  const pct = (t) => `${Math.max(0, Math.min(100, ((t - t0) / T) * 100))}%`;
  const step = [5, 10, 15, 30, 60].find((m) => T / 60000 / m <= 10) || 60;
  const ticks = [];
  for (let m = 0; m * 60000 <= T; m += step) ticks.push(`<span style="left:${(m * 60000 / T) * 100}%">${m} min</span>`);
  const groups = ROLE_ROWS.map(([role, name]) => {
    const lanes = [];
    for (const a of run.agents.filter((x) => x.role === role)) {
      const s = ms(a.start), e = Math.max(ms(a.end), s + 20000);
      let lane = lanes.find((l) => l.end <= s);
      if (!lane) { lane = { end: 0, bars: [] }; lanes.push(lane); }
      lane.end = e;
      lane.bars.push(`<i class="bar r-${role}" data-s="${s - t0}" data-e="${e - t0}" style="left:${pct(s)};width:${((e - s) / T) * 100}%"
        title="${esc(a.label)} · ${clock((e - s) / 60000)}${outcome(a) ? ' · ' + esc(outcome(a)) : ''}">${esc(a.feature || '')}</i>`);
    }
    return lanes.length ? `<div class="tl-group"><span class="tl-name">${name}${lanes.length > 1 ? `<small>bis ${lanes.length} gleichzeitig</small>` : ''}</span><div class="tl-lanes">${lanes.map((l) => `<div class="tl-lane">${l.bars.join('')}</div>`).join('')}</div></div>` : '';
  }).join('');
  return `<div class="timeline" data-total="${T}"><div class="tl-head"><button class="btn-ghost tl-play">▶ Ablauf abspielen</button><span class="tl-clock">${clock(T / 60000)}, ${run.agents.length} Agenteneinsätze</span></div>
    <div class="tl-body">${groups}<div class="tl-axis">${ticks.join('')}</div><div class="tl-cursor" hidden></div></div></div>`;
}

function playTimeline(tl) {
  const T = Number(tl.dataset.total), bars = [...tl.querySelectorAll('.bar')], cursor = tl.querySelector('.tl-cursor'), clk = tl.querySelector('.tl-clock');
  const DUR = 30000, started = performance.now();
  cursor.hidden = false;
  const frame = (now) => {
    const t = Math.min(T, ((now - started) / DUR) * T);
    let active = 0;
    for (const b of bars) {
      const s = Number(b.dataset.s), e = Number(b.dataset.e);
      b.style.visibility = t < s ? 'hidden' : 'visible';
      b.style.width = t < s ? '0' : `${((Math.min(e, t) - s) / T) * 100}%`;
      if (t >= s && t < e) active++;
    }
    cursor.style.left = `${(t / T) * 100}%`;
    clk.textContent = `nach ${clock(t / 60000)} · ${active} Agent${active === 1 ? '' : 'en'} gleichzeitig`;
    if (t < T) requestAnimationFrame(frame);
    else { cursor.hidden = true; clk.textContent = `${clock(T / 60000)}, ${bars.length} Agenteneinsätze`; }
  };
  requestAnimationFrame(frame);
}

function courseHtml(run) {
  const feats = Object.entries(run.attempts || {});
  const log = run.agents.map((a) => `<li><time>${clock((ms(a.start) - ms(run.from)) / 60000)}</time><span>${esc(a.label)}${outcome(a) ? ` <b>${esc(outcome(a))}</b>` : ''}</span></li>`).join('');
  return `${timelineHtml(run)}
    ${feats.length ? `<div class="course-feats"><b>Feature für Feature</b><div>${feats.map(([f, n]) => `<span class="${n > 1 ? 'retry' : ''}">${f}<small>${n}× gebaut</small></span>`).join('')}</div></div>` : ''}
    ${run.plan ? `<div class="plan-panel course-plan" hidden><b>Der Plan des Architekten</b><p class="plan-why"></p><div class="plan-units"></div><div class="plan-waves"></div></div>` : ''}
    ${(run.refactors || []).length ? `<div class="course-tidy"><b>Was das Aufräumen gebracht hat</b><div class="tidy-sum"></div><div class="tidy-rounds"></div><div class="tidy-targets"></div></div>` : ''}
    <details class="course-log"><summary>Logbuch: alle ${run.agents.length} Agenteneinsätze</summary><ol class="log">${log}</ol></details>`;
}

async function renderCourses(results) {
  for (const el of document.querySelectorAll('[data-course]')) {
    const v = el.dataset.course, r = results[v];
    const key = r && r.status === 'done' ? `${r.recordedAt}|${r.assessedAt || ''}` : 'none';
    if (courseLoaded[v] === key) continue;
    courseLoaded[v] = key;
    const run = key === 'none' ? null : await (await fetch(`/api/run?variant=${v}`, { cache: 'no-store' })).json().catch(() => null);
    el.hidden = !run;
    if (!run) continue;
    const body = el.querySelector('.course-body');
    body.innerHTML = courseHtml(run);
    if (run.plan) renderPlan(body, run.plan, [], new Set(run.commits.map((c) => (c.s.match(/^feat\((F\d+)\)/) || [])[1]).filter(Boolean)));
    if ((run.refactors || []).length) renderTidy(body.querySelector('.course-tidy'), run);
    body.querySelector('.tl-play').onclick = () => playTimeline(body.querySelector('.timeline'));
  }
}

async function tick() {
  try { render(await (await fetch('/api/state', { cache: 'no-store' })).json()); } catch { /* server restarting */ }
}
tick();
setInterval(tick, 3000);
