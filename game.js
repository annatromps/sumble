// ── Seeded RNG ──
function mulberry32(seed) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function getDailySeed() {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

function getTodayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function generatePuzzle(rng) {
  const bigNums = [25, 50, 75, 100];
  const smallNums = [1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10];
  const bigCopy = [...bigNums];
  const smallCopy = [...smallNums];

  for (let i = bigCopy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [bigCopy[i], bigCopy[j]] = [bigCopy[j], bigCopy[i]];
  }
  for (let i = smallCopy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [smallCopy[i], smallCopy[j]] = [smallCopy[j], smallCopy[i]];
  }

  const chosen = [
    { val: bigCopy[0], type: 'big' },
    { val: bigCopy[1], type: 'big' },
    { val: smallCopy[0], type: 'small' },
    { val: smallCopy[1], type: 'small' },
    { val: smallCopy[2], type: 'small' },
    { val: smallCopy[3], type: 'small' },
  ];

  const vals = chosen.map(t => t.val);

  // Find a target that's exactly solvable and requires at least 2 steps.
  // Try up to 100 candidates; fall back to any exactly-solvable target.
  let target = null;
  let fallback = null;

  for (let attempt = 0; attempt < 100; attempt++) {
    const candidate = 101 + Math.floor(rng() * 899);
    const sol = solve(vals, candidate);
    if (sol && sol.val === candidate) {
      if (fallback === null) fallback = candidate;
      if (sol.steps.length >= 2) {
        target = candidate;
        break;
      }
    }
  }

  if (target === null) target = fallback ?? (101 + Math.floor(rng() * 899));
  return { tiles: chosen, target };
}

// ── Solver ──
function solve(numbers, target) {
  let best = null;
  let bestDiff = Infinity;

  function search(nums, steps) {
    for (let i = 0; i < nums.length; i++) {
      const diff = Math.abs(nums[i].val - target);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = { val: nums[i].val, steps: [...steps] };
        if (bestDiff === 0) return;
      }
    }
    if (nums.length < 2) return;
    for (let i = 0; i < nums.length; i++) {
      for (let j = 0; j < nums.length; j++) {
        if (i === j) continue;
        const a = nums[i], b = nums[j];
        const rest = nums.filter((_, k) => k !== i && k !== j);
        const ops = [
          { op: '+', val: a.val + b.val, str: `${a.val} + ${b.val} = ${a.val + b.val}` },
          { op: '-', val: a.val - b.val, str: `${a.val} − ${b.val} = ${a.val - b.val}` },
          { op: '*', val: a.val * b.val, str: `${a.val} × ${b.val} = ${a.val * b.val}` },
        ];
        if (b.val !== 0 && a.val % b.val === 0) {
          ops.push({ op: '/', val: a.val / b.val, str: `${a.val} ÷ ${b.val} = ${a.val / b.val}` });
        }
        for (const op of ops) {
          if (op.val > 0) {
            search([...rest, { val: op.val }], [...steps, op.str]);
            if (bestDiff === 0) return;
          }
        }
      }
    }
  }

  search(numbers.map(n => ({ val: n })), []);
  return best;
}

// Finds the shortest exact solution — used for hints
function solveShort(numbers, target) {
  let best = null;

  function search(nums, steps) {
    if (best && steps.length >= best.steps.length) return; // prune longer paths
    for (let i = 0; i < nums.length; i++) {
      if (nums[i].val === target) {
        if (!best || steps.length < best.steps.length) best = { steps: [...steps] };
        return;
      }
    }
    if (nums.length < 2) return;
    for (let i = 0; i < nums.length; i++) {
      for (let j = 0; j < nums.length; j++) {
        if (i === j) continue;
        const a = nums[i], b = nums[j];
        const rest = nums.filter((_, k) => k !== i && k !== j);
        const ops = [];
        if (b.val !== 0) // skip + 0
          ops.push({ val: a.val + b.val, str: `${a.val} + ${b.val} = ${a.val + b.val}` });
        if (b.val !== 0 && a.val !== b.val) // skip − 0 and a − a = 0
          ops.push({ val: a.val - b.val, str: `${a.val} − ${b.val} = ${a.val - b.val}` });
        if (b.val !== 1 && a.val !== 1) // skip × 1
          ops.push({ val: a.val * b.val, str: `${a.val} × ${b.val} = ${a.val * b.val}` });
        if (b.val !== 0 && b.val !== 1 && a.val % b.val === 0) // skip ÷ 1
          ops.push({ val: a.val / b.val, str: `${a.val} ÷ ${b.val} = ${a.val / b.val}` });
        for (const op of ops) {
          if (op.val > 0 && !rest.some(n => n.val === op.val && nums.filter(n2 => n2.val === op.val).length > rest.filter(n2 => n2.val === op.val).length)) {
            search([...rest, { val: op.val }], [...steps, op.str]);
          } else if (op.val > 0) {
            search([...rest, { val: op.val }], [...steps, op.str]);
          }
        }
      }
    }
  }

  search(numbers.map(n => ({ val: n })), []);
  return best;
}

// ── Streak (localStorage) ──
const STORAGE_KEY = 'numble_history';

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveHistory(history) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

// Build a Wordle-style time grid.
// 6 squares = 30s clock (each square = 5s).
// Exact within 30s: 🟩 for seconds used, ⬛ remaining.
// Exact overtime:   all 6 🟥 + one extra 🟥 per 5s of OT.
// Not exact:        🟧 for seconds used, ⬛ remaining.
// No answer:        ⬛⬛⬛⬛⬛⬛
function buildShareGrid(diff, timeTaken) {
  const exact = diff === 0;
  const overtime = timeTaken > 30;

  if (timeTaken == null) return '⬛⬛⬛⬛⬛⬛';

  if (!exact) {
    // Not exact — black for time used, orange for remaining
    const used = Math.min(Math.ceil(timeTaken / 5), 6);
    return '🟧'.repeat(6 - used) + '⬛'.repeat(used);
  }

  if (!overtime) {
    // Exact within time — green remaining on left, black used on right
    const used = Math.min(Math.ceil(timeTaken / 5), 6);
    return '🟩'.repeat(6 - used) + '⬛'.repeat(used);
  }

  // Exact but overtime — 6 red base + extras for OT
  const otBlocks = Math.ceil((timeTaken - 30) / 5);
  return '🟥'.repeat(6 + otBlocks);
}

function recordResult(dateKey, diff, grid, pts, solvedInTime) {
  const history = loadHistory();
  history[dateKey] = { diff, grid, ts: Date.now(), pts, solvedInTime };
  saveHistory(history);
}

function calcStats(history) {
  const all = Object.values(history);
  const total = all.length;
  const withPts = all.filter(e => e.pts !== undefined);
  const avgPts = withPts.length ? Math.round(withPts.reduce((s, e) => s + e.pts, 0) / withPts.length) : null;
  const best = withPts.length ? Math.max(...withPts.map(e => e.pts)) : null;
  const solved = all.filter(e => e.diff === 0).length;
  const solvedInTime = all.filter(e => e.solvedInTime).length;
  // Score distribution buckets (only entries with pts)
  const dist = [
    { label: '900+', count: withPts.filter(e => e.pts >= 900).length },
    { label: '800+', count: withPts.filter(e => e.pts >= 800 && e.pts < 900).length },
    { label: '700+', count: withPts.filter(e => e.pts >= 700 && e.pts < 800).length },
    { label: '<700', count: withPts.filter(e => e.pts < 700).length },
  ];
  return { total, avgPts, best, solved, solvedInTime, dist, withPts: withPts.length };
}

function renderStats(history) {
  const el = document.getElementById('resultStats');
  if (!el) return;
  const { total, avgPts, solvedInTime } = calcStats(history);
  if (total === 0) { el.innerHTML = ''; return; }
  el.innerHTML = `
    <div class="stats-grid">
      <div class="stats-cell"><div class="stats-num">${total}</div><div class="stats-lbl">Played</div></div>
      <div class="stats-cell"><div class="stats-num">${solvedInTime}</div><div class="stats-lbl">Solved in time</div></div>
      <div class="stats-cell"><div class="stats-num">${avgPts !== null ? avgPts : '—'}</div><div class="stats-lbl">Avg pts</div></div>
    </div>
  `;
}

function calcStreak(history) {
  const today = getTodayKey();
  let streak = 0;
  let best = 0;

  // Walk backwards from today
  const d = new Date();
  for (let i = 0; i < 365; i++) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const key = `${y}-${m}-${day}`;
    if (history[key] !== undefined) {
      streak++;
      if (streak > best) best = streak;
    } else {
      // Allow a gap of 1 day only if we haven't started counting yet (today not yet played)
      if (i === 0) {
        // today not played yet, don't break streak
      } else {
        break;
      }
    }
    d.setDate(d.getDate() - 1);
  }

  // Also scan full history for all-time best
  const keys = Object.keys(history).sort();
  let runBest = 0, run = 0, prevKey = null;
  for (const k of keys) {
    if (prevKey) {
      const prev = new Date(prevKey);
      const curr = new Date(k);
      const gap = Math.round((curr - prev) / 86400000);
      run = gap === 1 ? run + 1 : 1;
    } else {
      run = 1;
    }
    if (run > runBest) runBest = run;
    prevKey = k;
  }

  return { streak, best: Math.max(best, runBest) };
}

function renderStreakBar(streak, best) {
  const bar = document.getElementById('streakBar');
  if (!bar) return;
  const shouldShow = streak > 0 || best > 0;
  bar.dataset.shouldShow = shouldShow ? 'true' : 'false';
  if (streak === 0 && best === 0) {
    bar.style.display = 'none';
    return;
  }
  bar.style.display = 'flex';
  document.getElementById('streakValue').textContent = streak;
  document.getElementById('streakBest').textContent = `best ${best}`;
}

// ── Scoring ──
function calcScore(diff, timeTaken, hints = 0) {
  const base = diff === 0
    ? 1000 - Math.floor(timeTaken) * 10
    : Math.max(0, 500 - diff * 5);
  return Math.max(0, base - hints * HINT_PENALTY);
}

// ── Game state ──
let puzzle, tiles, steps, currentNums;
let expr = []; // [{type:'num', val, id} | {type:'op', sym}]
let timerInterval, timeLeft, freeTimeElapsed, gameOver;
let todayKey, dailyTarget;
let infiniteSeed = null;
let gameMode = 'countdown'; // 'countdown' | 'free'
let modeLocked = false;
let countdownResult = null; // locked-in countdown score, preserved if player continues in free
let hintSolution = null;   // steps array from solver, used for hint reveals
let hintsUsed = 0;
const MAX_HINTS = 3;
const HINT_PENALTY = 100;

function setMode(mode) {
  if (modeLocked) return;
  gameMode = mode;
  document.getElementById('modeCountdown').classList.toggle('active', mode === 'countdown');
  document.getElementById('modeFree').classList.toggle('active', mode === 'free');
  document.querySelector('.timer-bar-wrap').style.display = mode === 'countdown' ? '' : 'none';
  if (mode === 'free') {
    clearInterval(timerInterval);
  } else {
    // restart timer only if game not over and no steps yet
    if (!gameOver && steps.length === 0) startTimer();
  }
}

function showView(name) {
  // name: 'start' | 'game' | 'result'
  document.getElementById('startScreen').style.display = name === 'start'  ? '' : 'none';
  document.getElementById('gameView').style.display   = name === 'game'   ? 'flex' : 'none';
  document.getElementById('resultView').style.display = name === 'result' ? 'flex' : 'none';
  document.getElementById('targetArea').style.display = name === 'game'   ? '' : 'none';
  // Hide streak bar during game to keep header height stable
  const streakBar = document.getElementById('streakBar');
  if (streakBar) streakBar.style.display = name === 'game' ? 'none' : streakBar.dataset.shouldShow === 'true' ? 'flex' : 'none';
}

function init() {
  todayKey = getTodayKey();
  const seed = getDailySeed();
  const rng = mulberry32(seed);
  puzzle = generatePuzzle(rng);
  dailyTarget = puzzle.target;

  tiles = puzzle.tiles.map((t, i) => ({ ...t, id: i, used: false }));
  steps = [];
  currentNums = tiles.map(t => ({ val: t.val, id: t.id }));
  expr = [];
  gameOver = false;
  timeLeft = 30;
  freeTimeElapsed = 0;
  modeLocked = false;
  countdownResult = null;
  hintsUsed = 0;
  const solForHints = solveShort(puzzle.tiles.map(t => t.val), puzzle.target);
  hintSolution = solForHints ? solForHints.steps : null;

  const dateStr = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  }).toUpperCase();
  document.getElementById('dateDisplay').textContent = dateStr;
  document.getElementById('startDateDisplay').textContent = dateStr;
  document.getElementById('targetDisplay').textContent = puzzle.target;
  document.getElementById('startTargetDisplay').textContent = puzzle.target;

  renderTiles();
  updateExpr();
  updateStepsLog();
  document.getElementById('submitBtn').disabled = true;
  document.getElementById('applyBtn').disabled = true;

  const history = loadHistory();
  const { streak, best } = calcStreak(history);
  renderStreakBar(streak, best);
  document.getElementById('startStreakDisplay').textContent =
    streak > 1 ? `🔥 ${streak}-day streak` : streak === 1 ? '🔥 1-day streak' : '';

  // Shared infinite puzzle link → load that specific puzzle
  const urlSeed = new URLSearchParams(window.location.search).get('p');
  if (urlSeed) {
    startInfinite(parseInt(urlSeed, 10));
    return;
  }

  // Already played today → skip start screen, go to results
  if (history[todayKey] !== undefined) {
    showView('result');
    restoreTodayResult(history[todayKey].diff, history[todayKey].grid);
    return;
  }

  showView('start');
}

function startGame() {
  isInfinite = false;
  showInfiniteBanner(false);
  showView('game');
  document.getElementById('timerBarWrap').style.display = '';
  document.getElementById('timerFill').style.display = gameMode === 'countdown' ? '' : 'none';
  document.getElementById('pauseBtn').style.display =
    gameMode === 'countdown' ? '' : 'none';
  if (gameMode === 'countdown') {
    startTimer();
  } else {
    startFreeTimer();
  }
}

function restoreTodayResult(diff, storedGrid) {
  clearInterval(timerInterval);
  gameOver = true;

  const headline = document.getElementById('resultHeadline');
  const scoreEl  = document.getElementById('resultScore');
  const ptsEl    = document.getElementById('resultPts');
  const detail   = document.getElementById('resultDetail');
  const streakEl = document.getElementById('resultStreak');
  const solDiv   = document.getElementById('resultSolution');

  let scoreClass, headlineText, detailText;
  if (diff === 0) {
    scoreClass = 'exact'; headlineText = '🎯 Exact';
    detailText = 'You solved today\'s puzzle';
    scoreEl.textContent = puzzle.target;
  } else {
    scoreClass = diff <= 10 ? 'close' : 'miss';
    headlineText = diff <= 5 ? '🔥 Very close' : diff <= 10 ? '👍 Close' : '😬 Not quite';
    detailText = `${diff} away from ${puzzle.target}`;
    scoreEl.textContent = puzzle.target - diff;
  }

  headline.textContent = headlineText;
  scoreEl.className = 'result-score ' + scoreClass;
  detail.textContent = detailText;
  ptsEl.textContent = '';

  const history = loadHistory();
  const { streak } = calcStreak(history);
  streakEl.textContent = streak > 0 ? `🔥 ${streak}-day streak` : '';

  renderStats(history);

  const solResult = solveShort(puzzle.tiles.map(t => t.val), puzzle.target);
  if (solResult) {
    solDiv.innerHTML = solResult.steps.map(s => `<div class="sol-line">${s}</div>`).join('');
  }
  solDiv.style.display = 'none';

  window._lastResult = { diff, target: puzzle.target, playerBest: null, steps: [], timeTaken: null, grid: storedGrid, mode: gameMode };
}

function startTimer() {
  clearInterval(timerInterval);
  updateTimerUI();
  timerInterval = setInterval(() => {
    timeLeft--;
    updateTimerUI();
  }, 1000);
}

function startFreeTimer() {
  clearInterval(timerInterval);
  freeTimeElapsed = 0;
  updateFreeTimerUI();
  timerInterval = setInterval(() => {
    freeTimeElapsed++;
    updateFreeTimerUI();
  }, 1000);
}

function updateFreeTimerUI() {
  const count = document.getElementById('timerCount');
  const label = document.querySelector('.timer-label span:first-child');
  const mins = Math.floor(freeTimeElapsed / 60);
  const secs = String(freeTimeElapsed % 60).padStart(2, '0');
  count.textContent = mins > 0 ? `${mins}:${secs}` : `${freeTimeElapsed}s`;
  count.style.color = '';
  label.textContent = 'Time';
}

function updateTimerUI() {
  const count = document.getElementById('timerCount');
  const fill = document.getElementById('timerFill');
  const label = document.querySelector('.timer-label span:first-child');

  if (timeLeft > 0) {
    count.textContent = timeLeft;
    count.style.color = timeLeft <= 10 ? 'var(--danger)' : '';
    fill.style.width = (timeLeft / 30 * 100) + '%';
    fill.classList.toggle('urgent', timeLeft <= 10);
    label.textContent = 'Time';
    label.style.color = '';
  } else if (timeLeft === 0) {
    count.textContent = '0';
    count.style.color = 'var(--danger)';
    fill.style.width = '0%';
    fill.classList.add('urgent');
    label.textContent = 'Time';
    label.style.color = '';
    // Auto-submit in countdown mode
    if (gameMode === 'countdown' && !gameOver) {
      setTimeout(() => submitAnswer(), 400);
    }
  } else {
    // Overtime (only reached if somehow timeLeft goes below 0 outside countdown mode)
    count.textContent = timeLeft;
    count.style.color = 'var(--danger)';
    fill.style.width = '0%';
    fill.classList.add('urgent');
    label.textContent = 'Overtime';
    label.style.color = 'var(--danger)';
  }
}

function renderTiles() {
  const area = document.getElementById('tilesArea');
  area.innerHTML = '';
  const origTileIds = new Set(tiles.map(t => t.id));
  const exprNumIds = new Set(expr.filter(t => t.type === 'num').map(t => t.id));

  // Row 1: original tiles, always one line
  const origRow = document.createElement('div');
  origRow.className = 'tiles-row';
  tiles.forEach(t => {
    const isUsed = !currentNums.find(n => n.id === t.id);
    const isSel = exprNumIds.has(t.id);
    const div = document.createElement('div');
    div.className = 'tile ' + t.type + (isUsed ? ' used' : '') + (isSel ? ' selected' : '');
    div.onclick = () => selectTile(t.id);
    div.innerHTML = `<div class="tile-val">${t.val}</div>`;
    origRow.appendChild(div);
  });
  area.appendChild(origRow);

  // Row 2: intermediate results in a different colour
  const intermediates = currentNums.filter(n => !origTileIds.has(n.id));
  if (intermediates.length > 0) {
    const intRow = document.createElement('div');
    intRow.className = 'tiles-row';
    intermediates.forEach(n => {
      const isSel = exprNumIds.has(n.id);
      const div = document.createElement('div');
      div.className = 'tile result' + (isSel ? ' selected' : '');
      div.onclick = () => selectTile(n.id);
      div.innerHTML = `<div class="tile-val">${n.val}</div>`;
      intRow.appendChild(div);
    });
    area.appendChild(intRow);
  }
}

// ── BODMAS evaluator ──
function evaluateExpr(tokens) {
  const nums = tokens.filter(t => t.type === 'num').map(t => t.val);
  const ops  = tokens.filter(t => t.type === 'op').map(t => t.sym);

  // × and ÷ first
  let i = 0;
  while (i < ops.length) {
    if (ops[i] === '×' || ops[i] === '÷') {
      const a = nums[i], b = nums[i + 1];
      if (ops[i] === '÷') {
        if (b === 0 || a % b !== 0) return { error: 'Must divide evenly' };
      }
      const r = ops[i] === '×' ? a * b : a / b;
      nums.splice(i, 2, r);
      ops.splice(i, 1);
    } else {
      i++;
    }
  }

  // + and − second
  let result = nums[0];
  for (let j = 0; j < ops.length; j++) {
    result = ops[j] === '+' ? result + nums[j + 1] : result - nums[j + 1];
  }
  return { val: result };
}

function selectTile(id) {
  if (gameOver) return;
  const num = currentNums.find(n => n.id === id);
  if (!num) return;

  // Tap an already-in-expr number → remove it and everything after it
  const idx = expr.findIndex(t => t.type === 'num' && t.id === id);
  if (idx !== -1) {
    expr = expr.slice(0, idx);
    syncOpButtons(); renderTiles(); updateExpr(); checkApplyReady();
    return;
  }

  // If expr is exactly one number (no op yet), swap it for the new selection
  const last = expr[expr.length - 1];
  if (expr.length === 1 && last.type === 'num') {
    expr[0] = { type: 'num', val: num.val, id: num.id };
    syncOpButtons(); renderTiles(); updateExpr(); checkApplyReady();
    return;
  }

  // Can only add a number when expr is empty or last token is an op
  if (expr.length === 0 || (last && last.type === 'op')) {
    expr.push({ type: 'num', val: num.val, id: num.id });
    syncOpButtons(); renderTiles(); updateExpr(); checkApplyReady();
  }
}

function updateOpButtons(enabled) {
  ['opPlus', 'opMinus', 'opMul', 'opDiv'].forEach(id => {
    document.getElementById(id).disabled = !enabled;
  });
}

function syncOpButtons() {
  const last = expr[expr.length - 1];
  const hasNum = last && last.type === 'num';
  updateOpButtons(hasNum || (last && last.type === 'op'));
  document.getElementById('deleteBtn').disabled = expr.length === 0;
  // Highlight whichever op is the last token
  document.querySelectorAll('.op-btn').forEach(b => b.classList.remove('active'));
  if (last && last.type === 'op') {
    const map = { '+': 'opPlus', '−': 'opMinus', '×': 'opMul', '÷': 'opDiv' };
    const btn = map[last.sym];
    if (btn) document.getElementById(btn).classList.add('active');
  }
}

function selectOp(sym) {
  const last = expr[expr.length - 1];
  if (!last) return; // nothing in expr yet
  if (last.type === 'op') {
    expr[expr.length - 1] = { type: 'op', sym }; // replace
  } else if (last.type === 'num') {
    expr.push({ type: 'op', sym });
  }
  syncOpButtons(); updateExpr(); checkApplyReady();
}

function checkApplyReady() {
  const last = expr[expr.length - 1];
  const ready = expr.length >= 3 && last && last.type === 'num';
  document.getElementById('applyBtn').disabled = !ready;
}

function updateExpr() {
  const disp = document.getElementById('exprDisplay');
  if (expr.length === 0) {
    disp.innerHTML = `<span style="color:rgba(255,255,255,0.45);font-size:20px;font-family:'Caveat',cursive">tap a number to start…</span>`;
    return;
  }
  disp.innerHTML = expr.map(t =>
    t.type === 'num'
      ? `<span class="expr-token num">${t.val}</span>`
      : `<span class="expr-token op">${t.sym}</span>`
  ).join('');
}

function applyStep() {
  const last = expr[expr.length - 1];
  if (expr.length < 3 || !last || last.type !== 'num') return;

  // Lock mode on first step
  if (!modeLocked) {
    modeLocked = true;
    document.getElementById('modeCountdown').disabled = true;
    document.getElementById('modeFree').disabled = true;
  }

  const evalResult = evaluateExpr(expr);
  if (evalResult.error) { showToast(evalResult.error); return; }
  const result = evalResult.val;
  if (result <= 0) { showToast('Result must be positive'); return; }

  const usedNums = expr.filter(t => t.type === 'num');
  const exprStr = expr.map(t => t.type === 'num' ? t.val : t.sym).join(' ');
  const snapshot = { nums: [...currentNums] };
  steps.push({ usedNums, result, snapshot, stepStr: `${exprStr} = ${result}` });

  const newId = Date.now();
  const usedIds = new Set(usedNums.map(n => n.id));
  currentNums = currentNums.filter(n => !usedIds.has(n.id));
  currentNums.push({ val: result, id: newId });

  expr = [];
  document.querySelectorAll('.op-btn').forEach(b => b.classList.remove('active'));
  updateOpButtons(false);
  renderTiles(); updateExpr(); updateStepsLog(); checkSubmit();
  document.getElementById('applyBtn').disabled = true;

  if (result === puzzle.target) setTimeout(() => submitAnswer(), 300);
}

function updateStepsLog() {
  const log = document.getElementById('stepsLog');
  if (steps.length === 0) { log.innerHTML = ''; return; }
  log.innerHTML = steps.map(s => {
    const [lhs, rhs] = s.stepStr.split(' = ');
    return `<div class="step-line">${lhs} = <span>${rhs}</span></div>`;
  }).join('');
}

function checkSubmit() {
  document.getElementById('submitBtn').disabled = steps.length === 0;
}

function undoStep() {
  if (steps.length === 0) return;
  const last = steps.pop();
  currentNums = [...last.snapshot.nums];
  expr = [];
  document.querySelectorAll('.op-btn').forEach(b => b.classList.remove('active'));
  updateOpButtons(false);
  renderTiles(); updateExpr(); updateStepsLog(); checkSubmit();
  document.getElementById('applyBtn').disabled = true;
}

function deleteLast() {
  if (expr.length === 0) return;
  const removed = expr[expr.length - 1];
  expr = expr.slice(0, -1);
  document.querySelectorAll('.op-btn').forEach(b => b.classList.remove('active'));
  syncOpButtons(); renderTiles(); updateExpr(); checkApplyReady();
}

function clearWorking() {
  expr = [];
  document.querySelectorAll('.op-btn').forEach(b => b.classList.remove('active'));
  updateOpButtons(false);
  document.getElementById('deleteBtn').disabled = true;
  renderTiles(); updateExpr();
  document.getElementById('applyBtn').disabled = true;
}

function getHint() {
  if (gameOver) return;
  if (!hintSolution) { showToast('No hint available'); return; }
  if (hintsUsed >= MAX_HINTS) { showToast('No more hints'); return; }

  const step = hintSolution[hintsUsed];
  if (!step) { showToast('No more hints'); return; }

  hintsUsed++;
  updateHintBtn();

  // Show the hint as a toast and also append to steps log
  showToast(`Hint ${hintsUsed}: ${step}`, 4000);
  const log = document.getElementById('stepsLog');
  const hint = document.createElement('div');
  hint.className = 'step-line hint-step';
  hint.textContent = `💡 ${step}`;
  log.appendChild(hint);
}

function updateHintBtn() {
  const btn = document.getElementById('hintBtn');
  if (!btn) return;
  const remaining = MAX_HINTS - hintsUsed;
  btn.textContent = remaining > 0 ? `💡 Hint (${remaining})` : '💡 No hints left';
  btn.disabled = remaining === 0 || gameOver || !hintSolution;
}

let frozenTimerText = '0', frozenTimerBar = '0%';

function submitAnswer() {
  clearInterval(timerInterval);
  gameOver = true;
  frozenTimerText = document.getElementById('timerCount').textContent;
  const fill = document.getElementById('timerFill');
  frozenTimerBar = fill ? fill.style.width : '0%';
  updateHintBtn();
  document.getElementById('pauseBtn').style.display = 'none';
  document.getElementById('pauseModal').classList.remove('open');

  const closest = currentNums.reduce((best, n) =>
    Math.abs(n.val - puzzle.target) < Math.abs(best.val - puzzle.target) ? n : best,
    currentNums[0]
  );
  const diff = Math.abs(closest.val - puzzle.target);
  const timeTaken = gameMode === 'countdown' ? 30 - timeLeft : freeTimeElapsed;

  const grid = gameMode === 'countdown' ? buildShareGrid(diff, timeTaken) : null;

  // Save to history
  const pts = calcScore(diff, timeTaken, hintsUsed);
  const solvedInTime = diff === 0 && gameMode === 'countdown' && timeTaken <= 30;
  recordResult(todayKey, diff, grid, pts, solvedInTime);

  showResult(closest.val, diff, timeTaken, grid, hintsUsed);
  if (diff === 0 && typeof confetti === 'function') {
    confetti({ particleCount: 120, spread: 80, origin: { y: 0.5 } });
  }
}

function showResult(playerBest, diff, timeTaken, grid, hints = 0) {
  const headline = document.getElementById('resultHeadline');
  const scoreEl  = document.getElementById('resultScore');
  const ptsEl    = document.getElementById('resultPts');
  const detail   = document.getElementById('resultDetail');
  const streakEl = document.getElementById('resultStreak');
  const solDiv   = document.getElementById('resultSolution');

  const isCountdown = gameMode === 'countdown';
  const fmtTime = (t) => {
    if (t == null) return '';
    if (!isCountdown) {
      const m = Math.floor(t / 60), s = t % 60;
      return m > 0 ? ` in ${m}m ${s}s` : ` in ${t}s`;
    }
    return t <= 30 ? ` in ${t}s` : ` (+${t - 30}s overtime)`;
  };
  const timeStr = fmtTime(timeTaken);

  let scoreClass, headlineText, detailText;
  if (diff === 0) {
    scoreClass = 'exact'; headlineText = '🎯 Exact';
    detailText = `Hit ${puzzle.target}${timeStr}`;
  } else if (diff <= 5) {
    scoreClass = 'close'; headlineText = '🔥 Very close';
    detailText = `${playerBest}, ${diff} away${timeStr}`;
  } else if (diff <= 10) {
    scoreClass = 'close'; headlineText = '👍 Close';
    detailText = `${playerBest}, ${diff} away${timeStr}`;
  } else {
    scoreClass = 'miss'; headlineText = '😬 Not quite';
    detailText = `${playerBest}, ${diff} away from ${puzzle.target}${timeStr}`;
  }

  headline.textContent = headlineText;
  scoreEl.textContent = diff === 0 ? puzzle.target : (playerBest || '?');
  scoreEl.className = 'result-score ' + scoreClass;
  detail.textContent = detailText;
  const pts = calcScore(diff, timeTaken, hints);
  const hintNote = hints > 0 ? ` (${hints} hint${hints > 1 ? 's' : ''})` : '';
  ptsEl.textContent = isCountdown ? `${pts} pts${hintNote}` : (hints > 0 ? `${hints} hint${hints > 1 ? 's' : ''} used` : '');

  const history = loadHistory();
  const { streak, best } = calcStreak(history);
  renderStreakBar(streak, best);
  streakEl.textContent = streak > 1 ? `🔥 ${streak}-day streak`
    : streak === 1 ? '🔥 1-day streak, come back tomorrow!'
    : '';

  renderStats(history);

  const solResult = solveShort(puzzle.tiles.map(t => t.val), puzzle.target);
  if (solResult) {
    solDiv.innerHTML = solResult.steps.map(s => `<div class="sol-line">${s}</div>`).join('');
  }
  solDiv.style.display = 'none';

  // Show "continue in free" only when countdown ended without exact match
  const canContinue = gameMode === 'countdown' && diff > 0 && !countdownResult;
  document.getElementById('continueBtn').style.display = canContinue ? '' : 'none';

  // Lock in the countdown result the first time (before any free-mode continuation)
  const result = { diff, target: puzzle.target, playerBest, steps: [...steps], timeTaken, grid, mode: gameMode, hints };
  window._lastResult = result;
  if (gameMode === 'countdown' && !countdownResult) countdownResult = result;

  const infBtn = document.querySelector('#resultView .btn-primary[onclick="startInfinite()"]');
  if (infBtn) infBtn.textContent = isInfinite ? '▶ Next' : '▶ Infinite Mode';

  showView('result');
  maybeShowInstallBanner();
}

// ── Install prompt ──
let _deferredInstallPrompt = null;
const INSTALL_KEY = 'sumble_installed';
const PLAY_COUNT_KEY = 'sumble_play_count';

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  _deferredInstallPrompt = e;
});

window.addEventListener('appinstalled', () => {
  localStorage.setItem(INSTALL_KEY, '1');
  _deferredInstallPrompt = null;
  hideInstallBanner();
});

function maybeShowInstallBanner() {
  if (localStorage.getItem(INSTALL_KEY)) return;
  const count = parseInt(localStorage.getItem(PLAY_COUNT_KEY) || '0', 10) + 1;
  localStorage.setItem(PLAY_COUNT_KEY, count);
  if (count < 2 || (count - 2) % 5 !== 0) return;

  const banner = document.getElementById('installBanner');
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
  const isStandalone = window.navigator.standalone === true;
  if (isStandalone) { localStorage.setItem(INSTALL_KEY, '1'); return; }

  if (_deferredInstallPrompt) {
    document.getElementById('installBannerSub').textContent = 'Play Sumble like an app — no browser needed';
    document.getElementById('installBannerBtn').onclick = async () => {
      _deferredInstallPrompt.prompt();
      const { outcome } = await _deferredInstallPrompt.userChoice;
      if (outcome === 'accepted') localStorage.setItem(INSTALL_KEY, '1');
      hideInstallBanner();
    };
    banner.style.display = 'flex';
  } else if (isIOS) {
    document.getElementById('installBannerSub').textContent = 'Tap Share then "Add to Home Screen"';
    document.getElementById('installBannerBtn').onclick = () => {
      localStorage.setItem(INSTALL_KEY, '1');
      hideInstallBanner();
    };
    document.getElementById('installBannerBtn').textContent = 'Got it';
    banner.style.display = 'flex';
  }
}

function hideInstallBanner() {
  document.getElementById('installBanner').style.display = 'none';
}

document.getElementById('installBannerDismiss').onclick = hideInstallBanner;

let infiniteMode = localStorage.getItem('sumble_infinite_mode') || 'countdown';
let isInfinite = false;

function switchInfiniteMode(mode) {
  infiniteMode = mode;
  localStorage.setItem('sumble_infinite_mode', mode);
  document.getElementById('infBtnCountdown').classList.toggle('active', mode === 'countdown');
  document.getElementById('infBtnFree').classList.toggle('active', mode === 'free');
  // Apply immediately if mid-game
  if (isInfinite && !gameOver) {
    clearInterval(timerInterval);
    gameMode = mode;
    timeLeft = 30;
    freeTimeElapsed = 0;
    document.getElementById('timerFill').style.display = mode === 'countdown' ? '' : 'none';
    document.getElementById('pauseBtn').style.display = mode === 'countdown' ? '' : 'none';
    if (mode === 'countdown') startTimer(); else startFreeTimer();
  }
}

function showInfiniteBanner(visible) {
  const banner = document.getElementById('infiniteBanner');
  if (!banner) return;
  banner.style.display = visible ? '' : 'none';
  document.getElementById('infBtnCountdown').classList.toggle('active', infiniteMode === 'countdown');
  document.getElementById('infBtnFree').classList.toggle('active', infiniteMode === 'free');
}

function getDailyTargetsNearby(daysBefore, daysAfter) {
  const targets = new Set();
  const now = new Date();
  for (let offset = -daysBefore; offset <= daysAfter; offset++) {
    const d = new Date(now);
    d.setDate(d.getDate() + offset);
    const seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
    targets.add(generatePuzzle(mulberry32(seed)).target);
  }
  return targets;
}

function startInfinite(seed) {
  const forbiddenTargets = getDailyTargetsNearby(7, 30);
  let newPuzzle, usedSeed;
  if (seed) {
    usedSeed = seed;
    newPuzzle = generatePuzzle(mulberry32(seed));
  } else {
    do {
      usedSeed = (Math.random() * 0xffffffff) >>> 0;
      newPuzzle = generatePuzzle(mulberry32(usedSeed));
    } while (forbiddenTargets.has(newPuzzle.target));
  }
  infiniteSeed = usedSeed;
  puzzle = newPuzzle;

  tiles = puzzle.tiles.map((t, i) => ({ ...t, id: i, used: false }));
  steps = [];
  currentNums = tiles.map(t => ({ val: t.val, id: t.id }));
  expr = [];
  gameOver = false;
  timeLeft = 30;
  freeTimeElapsed = 0;
  modeLocked = true;
  countdownResult = null;
  hintsUsed = 0;
  isInfinite = true;
  gameMode = infiniteMode;
  const solForHints = solveShort(puzzle.tiles.map(t => t.val), puzzle.target);
  hintSolution = solForHints ? solForHints.steps : null;

  document.getElementById('targetDisplay').textContent = puzzle.target;
  document.getElementById('backToResultRow').style.display = 'none';
  renderTiles(); updateExpr(); updateStepsLog();
  document.getElementById('submitBtn').disabled = true;
  document.getElementById('applyBtn').disabled = true;
  document.querySelectorAll('.op-btn').forEach(b => { b.classList.remove('active'); b.disabled = false; });
  updateHintBtn();

  showView('game');
  showInfiniteBanner(true);
  document.getElementById('timerBarWrap').style.display = '';
  document.getElementById('timerFill').style.display = gameMode === 'countdown' ? '' : 'none';
  document.getElementById('pauseBtn').style.display = gameMode === 'countdown' ? '' : 'none';
  if (gameMode === 'countdown') startTimer(); else startFreeTimer();
}

function continueInFree() {
  gameMode = 'free';
  gameOver = false;
  updateHintBtn();
  expr = [];
  document.getElementById('continueBtn').style.display = 'none';
  document.getElementById('timerBarWrap').style.display = '';
  document.getElementById('timerFill').style.display = 'none';
  startFreeTimer();
  document.getElementById('submitBtn').disabled = steps.length === 0;
  document.getElementById('applyBtn').disabled = true;
  document.querySelectorAll('.op-btn').forEach(b => { b.classList.remove('active'); b.disabled = false; });
  updateOpButtons(false);
  renderTiles(); updateExpr();
  showView('game');
}

function buildShareText() {
  const r = window._lastResult;
  if (!r) return null;
  // Always share the countdown result if one exists (even if player continued in free)
  const shareR = countdownResult || r;

  const d = new Date();
  const dateStr = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  const history = loadHistory();
  const { streak } = calcStreak(history);
  const streakLine = streak > 1 ? `🔥 ${streak}-day streak\n` : '';

  let text;
  if (shareR.mode === 'free' && !countdownResult) {
    // Pure free-mode play — no countdown was done
    const freeTime = shareR.timeTaken != null
      ? (shareR.timeTaken >= 60
          ? ` in ${Math.floor(shareR.timeTaken/60)}m ${shareR.timeTaken%60}s`
          : ` in ${shareR.timeTaken}s`)
      : '';
    const resultLine = shareR.diff === 0
      ? `✅ ${shareR.target} solved${freeTime}`
      : `❌ ${shareR.diff} away from ${shareR.target}${freeTime}`;
    const baseUrl = isInfinite && infiniteSeed
      ? `https://annatromps.github.io/sumble?p=${infiniteSeed}`
      : 'https://annatromps.github.io/sumble';
    text = [
      `Sumble ${isInfinite ? `Puzzle #${infiniteSeed}` : dateStr} (Free Time)`,
      '',
      resultLine,
      '',
      `${streakLine}${baseUrl}`,
    ].join('\n');
  } else {
    // Countdown result (possibly after continuing in free)
    const pts = calcScore(shareR.diff, shareR.timeTaken, shareR.hints || 0);
    const hintTag = shareR.hints > 0 ? ` 💡×${shareR.hints}` : '';
    let resultLine;
    if (shareR.diff === 0) {
      const timeStr = shareR.timeTaken <= 30 ? `${shareR.timeTaken}s` : `+${shareR.timeTaken - 30}s overtime`;
      resultLine = `✅ ${shareR.target} in ${timeStr} (${pts} pts)${hintTag}`;
    } else {
      resultLine = `❌ ${shareR.diff} away (${pts} pts)${hintTag}`;
    }
    const grid = shareR.grid || buildShareGrid(shareR.diff, shareR.timeTaken);
    const baseUrl = isInfinite && infiniteSeed
      ? `https://annatromps.github.io/sumble?p=${infiniteSeed}`
      : 'https://annatromps.github.io/sumble';
    text = [
      `Sumble ${isInfinite ? `Puzzle #${infiniteSeed}` : dateStr}`,
      '',
      resultLine,
      grid,
      '',
      `${streakLine}${baseUrl}`,
    ].join('\n');
  }

  return text;
}

function copyResult() {
  const text = buildShareText();
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => showToast('Copied!'));
}

function shareResult() {
  const text = buildShareText();
  if (!text) return;
  if (navigator.share) {
    navigator.share({ text }).catch(() => {});
  } else {
    navigator.clipboard.writeText(text).then(() => showToast('Copied!'));
  }
}

function viewCompletedPuzzle() {
  clearInterval(timerInterval);
  document.getElementById('timerCount').textContent = frozenTimerText;
  const fill = document.getElementById('timerFill');
  if (fill) fill.style.width = frozenTimerBar;
  showView('game');
  document.getElementById('backToResultRow').style.display = '';
  document.getElementById('exprDisplay').innerHTML = '';
  updateStepsLog();
  document.querySelector('.ops-area').style.display = 'none';
  document.querySelector('.action-row').style.display = 'none';
  document.getElementById('blackboard').classList.add('blackboard--review');
}

function backToResult() {
  document.querySelector('.ops-area').style.display = '';
  document.querySelector('.action-row').style.display = '';
  document.getElementById('blackboard').classList.remove('blackboard--review');
  showView('result');
  document.getElementById('backToResultRow').style.display = 'none';
}

function goHome() {
  if (gameOver) {
    // Restore result view cleanly if we're viewing completed puzzle
    backToResult();
  } else {
    showView('start');
  }
}

function showToast(msg, duration = 2000) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
}

// ── Pause ──
let paused = false;

function pauseGame() {
  if (gameOver || gameMode !== 'countdown') return;
  paused = true;
  clearInterval(timerInterval);
  document.getElementById('gameView').style.visibility = 'hidden';
  document.getElementById('targetArea').style.visibility = 'hidden';
  document.getElementById('pauseModal').classList.add('open');
}

function resumeGame() {
  paused = false;
  document.getElementById('pauseModal').classList.remove('open');
  document.getElementById('gameView').style.visibility = '';
  document.getElementById('targetArea').style.visibility = '';
  if (!gameOver && gameMode === 'countdown') startTimer();
}

// ── How-to-play modal ──
function openHowTo() {
  document.getElementById('howToModal').classList.add('open');
}

function closeHowTo() {
  document.getElementById('howToModal').classList.remove('open');
}

let _numBuf = '', _numTimer = null;

function _flushNumBuf() {
  const val = parseInt(_numBuf, 10);
  _numBuf = '';
  if (isNaN(val)) return;
  // Find an available (unused, unselected) tile matching this value
  const match = currentNums.find(n => n.val === val && !tiles.find(t => t.id === n.id && t.used));
  if (match) selectTile(match.id);
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeHowTo();
    if (paused) resumeGame();
  }
  if (e.key === 'Enter') {
    const applyBtn = document.getElementById('applyBtn');
    if (applyBtn && !applyBtn.disabled) applyStep();
  }
  if (e.key === 'Backspace') {
    const deleteBtn = document.getElementById('deleteBtn');
    if (deleteBtn && !deleteBtn.disabled) deleteLast();
  }

  // Only handle digit/operator keys during active game, not when typing in an input
  if (gameOver || paused || e.target.tagName === 'INPUT') return;
  if (document.getElementById('gameView').style.display === 'none') return;

  if (e.key >= '0' && e.key <= '9') {
    _numBuf += e.key;
    clearTimeout(_numTimer);
    // If no available tile could start with this prefix, flush immediately
    const possible = currentNums.filter(n =>
      String(n.val).startsWith(_numBuf) && !tiles.find(t => t.id === n.id && t.used)
    );
    if (possible.length === 1 && String(possible[0].val) === _numBuf) {
      _flushNumBuf(); // exact unique match — select now
    } else if (possible.length === 0) {
      _numBuf = ''; // no match possible, discard
    } else {
      _numTimer = setTimeout(_flushNumBuf, 600); // wait for more digits
    }
    return;
  }

  // Operator keys
  const opMap = { '+': '+', '-': '−', '*': '×', 'x': '×', 'X': '×', '/': '÷' };
  if (opMap[e.key]) {
    const op = opMap[e.key];
    const btn = document.querySelector(`.op-btn[onclick="selectOp('${op}')"]`);
    if (btn && !btn.disabled) selectOp(op);
  }
});

// ── Admin ──
const ADMIN_EMAIL = 'annamtrompetas@gmail.com';
const wantsAdmin = new URLSearchParams(window.location.search).has('admin');

function initAdmin() {
  if (!wantsAdmin) return;
  if (sessionStorage.getItem('numbleAdmin') === '1') {
    document.getElementById('adminBar').style.display = 'flex';
  } else {
    document.getElementById('adminLoginModal').classList.add('open');
    setTimeout(() => document.getElementById('adminEmailInput').focus(), 100);
  }
}

function adminLogin() {
  const val = document.getElementById('adminEmailInput').value.trim().toLowerCase();
  if (val === ADMIN_EMAIL) {
    sessionStorage.setItem('numbleAdmin', '1');
    document.getElementById('adminLoginModal').classList.remove('open');
    document.getElementById('adminBar').style.display = 'flex';
  } else {
    document.getElementById('adminLoginError').style.display = 'block';
  }
}

function adminReset() {
  localStorage.removeItem(STORAGE_KEY);
  location.reload();
}

function toggleSolution() {
  const solDiv = document.getElementById('resultSolution');
  const btn = document.getElementById('viewSolBtn');
  const hidden = solDiv.style.display === 'none';
  solDiv.style.display = hidden ? '' : 'none';
  btn.textContent = hidden ? 'Hide Solution' : 'View Solution';
}

function adminToggleSolution() {
  const panel = document.getElementById('adminSolution');
  if (panel.style.display !== 'none') { panel.style.display = 'none'; return; }

  const sol = solveShort(puzzle.tiles.map(t => t.val), puzzle.target);
  if (!sol) { panel.innerHTML = '<em>No exact solution found</em>'; panel.style.display = 'block'; return; }

  const nums = puzzle.tiles.map(t => t.val).join(', ');
  panel.innerHTML = `
    <div class="admin-sol-header">Target: <strong>${puzzle.target}</strong> &nbsp;|&nbsp; Numbers: <strong>${nums}</strong> &nbsp;|&nbsp; Steps: <strong>${sol.steps.length}</strong> &nbsp;|&nbsp; <span style="color:var(--accent2)">Exact</span></div>
    ${sol.steps.map(s => `<div class="admin-sol-step">${s}</div>`).join('')}
  `;
  panel.style.display = 'block';
}

init();
initAdmin();
