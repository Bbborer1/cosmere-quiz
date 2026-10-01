'use strict';

const APP_VERSION = '0.1.0';
const STORE_KEY = 'cosmereQuiz.v1';

const CATEGORIES = {
  rules: 'Rules',
  world: 'World',
  scenario: 'Scenario',
};

// One cycle of category slots, shuffled each cycle: enforces 50% rules / 25% world / 25% scenario.
const CYCLE = ['rules', 'rules', 'world', 'scenario'];

// Turns until a missed question comes back, then after each correct retry.
// Clearing all steps (3 correct in a row) removes it from review.
const RETRY_GAPS = [3, 8, 20];

const BOOKS = {
  handbook: 'Stormlight Handbook',
  worldguide: 'Stormlight World Guide',
};

let bank = [];
const byId = new Map();
let state;

const $ = (id) => document.getElementById(id);

// ---------- persistence ----------

function freshState() {
  return {
    v: 1,
    turn: 0,
    cycle: [],
    decks: { rules: [], world: [], scenario: [] },
    retry: {},   // id -> { due: turn, step: index into RETRY_GAPS }
    stats: {},   // id -> { right, wrong, last: turn }
    streak: 0,
    best: 0,
    flagged: {}, // id -> true
    current: null, // { id, order: [choice indexes], picked: null | choice index, review }
  };
}

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return { ...freshState(), ...JSON.parse(raw) };
  } catch (e) { /* storage blocked or corrupt: start fresh */ }
  return freshState();
}

function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
}

// ---------- engine ----------

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function idsIn(cat) {
  return bank.filter((q) => q.category === cat).map((q) => q.id);
}

// Drop ids that no longer exist and slot never-seen new questions into the current decks.
function reconcile() {
  for (const cat of Object.keys(CATEGORIES)) {
    const deck = (state.decks[cat] || []).filter((id) => byId.has(id));
    const inDeck = new Set(deck);
    for (const id of idsIn(cat)) {
      if (!inDeck.has(id) && !state.stats[id]) {
        deck.splice(Math.floor(Math.random() * (deck.length + 1)), 0, id);
      }
    }
    state.decks[cat] = deck;
  }
  for (const id of Object.keys(state.retry)) if (!byId.has(id)) delete state.retry[id];
  if (state.current && !byId.has(state.current.id)) state.current = null;
}

function nextCategory() {
  const available = Object.keys(CATEGORIES).filter((c) => idsIn(c).length);
  for (let tries = 0; tries < 8; tries++) {
    if (!state.cycle.length) state.cycle = shuffle([...CYCLE]);
    const cat = state.cycle.shift();
    if (available.includes(cat)) return cat;
  }
  return available[0];
}

function pickQuestion() {
  const cat = nextCategory();
  const lastId = state.current && state.current.id;

  // Due review questions in this category take the slot, most overdue first.
  const due = Object.entries(state.retry)
    .filter(([id, r]) => r.due <= state.turn && id !== lastId && byId.get(id).category === cat)
    .sort((a, b) => a[1].due - b[1].due);
  if (due.length) return { id: due[0][0], review: true };

  // Questions waiting in review are served by the review schedule, not the deck.
  const inReview = (id) => id in state.retry;
  let deck = state.decks[cat].filter((id) => !inReview(id));
  if (!deck.length) {
    deck = shuffle(idsIn(cat).filter((id) => !inReview(id)));
    if (deck.length > 1 && deck[0] === lastId) deck.push(deck.shift());
  }
  if (!deck.length) {
    // Everything in this category is in review: serve the one due soonest.
    const soonest = Object.entries(state.retry)
      .filter(([id]) => byId.get(id).category === cat)
      .sort((a, b) => a[1].due - b[1].due)[0];
    return { id: soonest[0], review: true };
  }
  const id = deck.shift();
  state.decks[cat] = deck;
  return { id, review: false };
}

function startQuestion() {
  const { id, review } = pickQuestion();
  const q = byId.get(id);
  state.current = { id, order: shuffle(q.choices.map((_, i) => i)), picked: null, review };
  save();
  render();
}

function answer(choiceIndex) {
  const cur = state.current;
  if (!cur || cur.picked !== null) return;
  const q = byId.get(cur.id);
  const right = choiceIndex === q.answer;
  cur.picked = choiceIndex;
  state.turn += 1;

  const s = state.stats[q.id] || (state.stats[q.id] = { right: 0, wrong: 0, last: 0 });
  s.last = state.turn;
  if (right) {
    s.right += 1;
    state.streak += 1;
    state.best = Math.max(state.best, state.streak);
    const r = state.retry[q.id];
    if (r) {
      r.step += 1;
      if (r.step >= RETRY_GAPS.length) delete state.retry[q.id];
      else r.due = state.turn + RETRY_GAPS[r.step];
    }
  } else {
    s.wrong += 1;
    state.streak = 0;
    state.retry[q.id] = { due: state.turn + RETRY_GAPS[0], step: 0 };
  }
  save();
  render();
}

// ---------- rendering ----------

function citeText(q) {
  const c = q.cite;
  return `${BOOKS[c.book] || c.book} — ${c.section}, p. ${c.page}`;
}

function renderQuiz() {
  const cur = state.current;
  if (!cur) return;
  const q = byId.get(cur.id);
  const answered = cur.picked !== null;

  $('q-cat').textContent = CATEGORIES[q.category];
  $('q-cat').dataset.cat = q.category;
  $('q-topic').textContent = q.topic;
  $('q-review').hidden = !cur.review;
  $('q-text').textContent = q.question;

  const list = $('choices');
  list.replaceChildren(...cur.order.map((ci, pos) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'choice';
    btn.disabled = answered;
    const key = document.createElement('span');
    key.className = 'key';
    key.textContent = 'ABCD'[pos];
    const label = document.createElement('span');
    label.textContent = q.choices[ci];
    btn.append(key, label);
    if (answered) {
      if (ci === q.answer) btn.classList.add('correct');
      else if (ci === cur.picked) btn.classList.add('wrong');
      else btn.classList.add('dim');
    }
    btn.addEventListener('click', () => answer(ci));
    li.append(btn);
    return li;
  }));

  $('feedback').hidden = !answered;
  if (answered) {
    const right = cur.picked === q.answer;
    const res = $('fb-result');
    res.textContent = right ? 'Correct' : `Not quite — the answer is ${'ABCD'[cur.order.indexOf(q.answer)]}.`;
    res.className = 'fb-result ' + (right ? 'good' : 'bad');
    $('fb-explain').textContent = q.explanation;
    $('fb-cite').textContent = citeText(q);
    const flag = $('flag');
    const flagged = !!state.flagged[q.id];
    flag.setAttribute('aria-pressed', String(flagged));
    flag.textContent = flagged ? 'Flagged for review ✓' : 'Flag this question';
  }
  $('next').disabled = !answered;
}

function pct(right, total) {
  return total ? Math.round((right / total) * 100) : 0;
}

function barRow(label, right, total) {
  const p = pct(right, total);
  const row = document.createElement('div');
  row.className = 'bar-row';
  row.innerHTML = `<span></span><span class="count">${right}/${total} · ${p}%</span>
    <div class="bar ${p < 60 ? 'low' : p < 80 ? 'mid' : ''}"><span style="width:${p}%"></span></div>`;
  row.firstChild.textContent = label;
  return row;
}

function renderStats() {
  let right = 0, total = 0;
  const cats = {}, topics = {};
  for (const [id, s] of Object.entries(state.stats)) {
    const q = byId.get(id);
    if (!q) continue;
    const n = s.right + s.wrong;
    right += s.right; total += n;
    for (const [map, key] of [[cats, q.category], [topics, q.topic]]) {
      const t = map[key] || (map[key] = { right: 0, total: 0 });
      t.right += s.right; t.total += n;
    }
  }
  $('st-answered').textContent = total;
  $('st-accuracy').textContent = total ? pct(right, total) + '%' : '–';
  $('st-best').textContent = state.best;
  $('st-review').textContent = Object.keys(state.retry).length;

  $('st-cats').replaceChildren(...Object.entries(CATEGORIES).map(([c, label]) =>
    barRow(label, (cats[c] || {}).right || 0, (cats[c] || {}).total || 0)));

  const topicRows = Object.entries(topics)
    .sort((a, b) => a[1].right / a[1].total - b[1].right / b[1].total || b[1].total - a[1].total)
    .slice(0, 10)
    .map(([t, v]) => barRow(t, v.right, v.total));
  $('st-topics').replaceChildren(...(topicRows.length ? topicRows : [hint('Answer a few questions to see this.')]));

  const seen = bank.filter((q) => state.stats[q.id]).length;
  $('st-coverage').textContent = `You've seen ${seen} of ${bank.length} questions in the bank.`;

  const flagged = Object.keys(state.flagged).filter((id) => byId.has(id));
  $('st-flagged').replaceChildren(...(flagged.length ? flagged.map((id) => {
    const q = byId.get(id);
    const div = document.createElement('div');
    div.className = 'flag-item';
    div.innerHTML = '<div></div><small></small>';
    div.firstChild.textContent = q.question;
    div.lastChild.textContent = `${q.id} · ${citeText(q)}`;
    return div;
  }) : [hint('None. Use "Flag this question" after answering if something looks off.')]));
  $('version').textContent = `v${APP_VERSION} · ${bank.length} questions`;
}

function hint(text) {
  const p = document.createElement('p');
  p.className = 'hint';
  p.textContent = text;
  return p;
}

let screen = 'quiz';

function render() {
  $('streak').textContent = state.streak;
  $('quiz').hidden = screen !== 'quiz';
  $('stats').hidden = screen !== 'stats';
  $('nav-stats').setAttribute('aria-pressed', String(screen === 'stats'));
  $('next').textContent = screen === 'stats' ? 'Back to quiz' : 'Next question';
  if (screen === 'stats') {
    $('next').disabled = false;
    renderStats();
  } else {
    renderQuiz();
  }
}

function show(name) {
  screen = name;
  window.scrollTo(0, 0);
  render();
}

// ---------- data import/export ----------

function exportProgress() {
  const blob = new Blob([JSON.stringify({ app: 'cosmere-quiz', version: APP_VERSION, exported: new Date().toISOString(), state }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `cosmere-quiz-progress-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function importProgress(file) {
  try {
    const data = JSON.parse(await file.text());
    if (data.app !== 'cosmere-quiz' || !data.state) throw new Error('Not a Cosmere Quiz backup');
    if (!confirm('Replace the progress on this device with this backup?')) return;
    state = { ...freshState(), ...data.state };
    reconcile();
    if (!state.current) startQuestion();
    save();
    render();
  } catch (e) {
    alert(`Couldn't import that file: ${e.message}`);
  }
}

// ---------- boot ----------

function bindEvents() {
  $('next').addEventListener('click', () => {
    if (screen === 'stats') return show('quiz');
    startQuestion();
    window.scrollTo(0, 0);
  });
  $('nav-stats').addEventListener('click', () => show(screen === 'stats' ? 'quiz' : 'stats'));
  $('nav-quiz').addEventListener('click', () => show('quiz'));
  $('flag').addEventListener('click', () => {
    const id = state.current.id;
    if (state.flagged[id]) delete state.flagged[id];
    else state.flagged[id] = true;
    save();
    render();
  });
  $('export').addEventListener('click', exportProgress);
  $('import').addEventListener('change', (e) => {
    if (e.target.files[0]) importProgress(e.target.files[0]);
    e.target.value = '';
  });
  $('reset').addEventListener('click', () => {
    if (!confirm('Erase all progress, stats and flags on this device?')) return;
    state = freshState();
    reconcile();
    startQuestion();
    show('quiz');
  });
  document.addEventListener('keydown', (e) => {
    if (screen !== 'quiz' || !state.current || e.metaKey || e.ctrlKey || e.altKey) return;
    const pos = '1234'.indexOf(e.key) >= 0 ? '1234'.indexOf(e.key) : 'abcd'.indexOf(e.key.toLowerCase());
    if (state.current.picked === null && pos >= 0 && pos < state.current.order.length) {
      answer(state.current.order[pos]);
    } else if (state.current.picked !== null && (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight')) {
      e.preventDefault();
      startQuestion();
    }
  });
}

async function boot() {
  bindEvents();
  try {
    const res = await fetch('data/questions.json');
    bank = (await res.json()).questions;
  } catch (e) {
    $('q-text').textContent = "Couldn't load the question bank. Check your connection and reload.";
    return;
  }
  for (const q of bank) byId.set(q.id, q);
  state = load();
  reconcile();
  if (!state.current) startQuestion();
  else render();

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    // When a new version's service worker takes over, reload once to pick up fresh files.
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController) location.reload();
    });
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

boot();
