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

function recordResult(dateKey, diff, grid) {
  const history = loadHistory();
  history[dateKey] = { diff, grid, ts: Date.now() };
  saveHistory(history);
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
  if (streak === 0 && best === 0) {
    bar.style.display = 'none';
    return;
  }
  bar.style.display = 'flex';
  document.getElementById('streakValue').textContent = streak;
  document.getElementById('streakBest').textContent = `best ${best}`;
}

// ── Scoring ──
function calcScore(diff, timeTaken) {
  if (diff === 0) return Math.max(700, 1000 - Math.floor(timeTaken) * 10);
  return Math.max(0, 500 - diff * 5);
}

// ── Game state ──
let puzzle, tiles, steps, currentNums;
let expr = []; // [{type:'num', val, id} | {type:'op', sym}]
let timerInterval, timeLeft, gameOver;
let todayKey;
let gameMode = 'countdown'; // 'countdown' | 'free'
let modeLocked = false;

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

function init() {
  todayKey = getTodayKey();
  const seed = getDailySeed();
  const rng = mulberry32(seed);
  puzzle = generatePuzzle(rng);

  tiles = puzzle.tiles.map((t, i) => ({ ...t, id: i, used: false }));
  steps = [];
  currentNums = tiles.map(t => ({ val: t.val, id: t.id }));
  expr = [];
  gameOver = false;
  timeLeft = 30;
  modeLocked = false;

  document.getElementById('dateDisplay').textContent =
    new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase();
  document.getElementById('targetDisplay').textContent = puzzle.target;

  renderTiles();
  updateExpr();
  updateStepsLog();
  document.getElementById('resultPanel').classList.remove('show');
  document.getElementById('submitBtn').disabled = true;
  document.getElementById('applyBtn').disabled = true;

  // Streak
  const history = loadHistory();
  const { streak, best } = calcStreak(history);
  renderStreakBar(streak, best);

  // If already played today, show result immediately
  if (history[todayKey] !== undefined) {
    restoreTodayResult(history[todayKey].diff, history[todayKey].grid);
    return;
  }

  if (gameMode === 'countdown') {
    document.querySelector('.timer-bar-wrap').style.display = '';
    startTimer();
  } else {
    document.querySelector('.timer-bar-wrap').style.display = 'none';
  }
}

function restoreTodayResult(diff, storedGrid) {
  clearInterval(timerInterval);
  gameOver = true;
  document.getElementById('timerCount').textContent = '—';
  document.getElementById('timerFill').style.width = '0%';

  // Show result panel with stored diff (no live steps to show)
  const panel = document.getElementById('resultPanel');
  const headline = document.getElementById('resultHeadline');
  const score = document.getElementById('resultScore');
  const detail = document.getElementById('resultDetail');
  const streakEl = document.getElementById('resultStreak');
  const solDiv = document.getElementById('resultSolution');

  let scoreClass, headlineText, detailText;
  if (diff === 0) {
    scoreClass = 'exact'; headlineText = 'Exact';
    detailText = `You solved today's puzzle exactly`;
    score.textContent = puzzle.target;
  } else if (diff <= 5) {
    scoreClass = 'close'; headlineText = 'Very close';
    detailText = `You were ${diff} away from ${puzzle.target}`;
    score.textContent = puzzle.target - diff;
  } else {
    scoreClass = 'miss'; headlineText = 'Not quite';
    detailText = `You were ${diff} away from ${puzzle.target}`;
    score.textContent = puzzle.target - diff;
  }

  headline.textContent = headlineText;
  score.className = 'result-score ' + scoreClass;
  detail.textContent = detailText + ' — already played today';

  const history = loadHistory();
  const { streak, best } = calcStreak(history);
  streakEl.textContent = streak > 0 ? `🔥 ${streak}-day streak` : '';

  const solResult = solve(puzzle.tiles.map(t => t.val), puzzle.target);
  if (solResult) {
    const d2 = Math.abs(solResult.val - puzzle.target);
    let solHtml = `<div style="color:var(--muted);font-size:10px;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px">One solution (${d2 === 0 ? 'exact' : d2 + ' away'})</div>`;
    solHtml += solResult.steps.map(s => `<div class="sol-line">${s}</div>`).join('');
    solDiv.innerHTML = solHtml;
  }

  panel.classList.add('show');
  window._lastResult = { diff, target: puzzle.target, playerBest: null, steps: [], timeTaken: null, grid: storedGrid };
}

function startTimer() {
  clearInterval(timerInterval);
  updateTimerUI();
  timerInterval = setInterval(() => {
    timeLeft--;
    updateTimerUI();
  }, 1000);
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

  tiles.forEach(t => {
    const isUsed = !currentNums.find(n => n.id === t.id);
    const isSel = exprNumIds.has(t.id);
    const div = document.createElement('div');
    div.className = 'tile ' + t.type + (isUsed ? ' used' : '') + (isSel ? ' selected' : '');
    div.onclick = () => selectTile(t.id);
    div.innerHTML = `<div class="tile-val">${t.val}</div>`;
    area.appendChild(div);
  });

  const intermediates = currentNums.filter(n => !origTileIds.has(n.id));
  intermediates.forEach(n => {
    const isSel = exprNumIds.has(n.id);
    const div = document.createElement('div');
    div.className = 'tile small' + (isSel ? ' selected' : '');
    div.onclick = () => selectTile(n.id);
    div.innerHTML = `<div class="tile-val">${n.val}</div>`;
    area.appendChild(div);
  });
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

  // Can only add a number when expr is empty or last token is an op
  const last = expr[expr.length - 1];
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
    disp.innerHTML = `<span style="color:var(--muted);font-size:14px">Select a number, then an operator, then another number</span>`;
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

function clearWorking() {
  expr = [];
  document.querySelectorAll('.op-btn').forEach(b => b.classList.remove('active'));
  updateOpButtons(false);
  renderTiles(); updateExpr();
  document.getElementById('applyBtn').disabled = true;
}

function submitAnswer() {
  clearInterval(timerInterval);
  gameOver = true;

  const closest = currentNums.reduce((best, n) =>
    Math.abs(n.val - puzzle.target) < Math.abs(best.val - puzzle.target) ? n : best,
    currentNums[0]
  );
  const diff = Math.abs(closest.val - puzzle.target);
  const timeTaken = gameMode === 'countdown' ? 30 - timeLeft : null;

  const grid = gameMode === 'countdown' ? buildShareGrid(diff, timeTaken) : null;

  // Save to history
  recordResult(todayKey, diff, grid);

  showResult(closest.val, diff, timeTaken, grid);
}

function showResult(playerBest, diff, timeTaken, grid) {
  const panel = document.getElementById('resultPanel');
  const headline = document.getElementById('resultHeadline');
  const scoreEl = document.getElementById('resultScore');
  const ptsEl = document.getElementById('resultPts');
  const detail = document.getElementById('resultDetail');
  const streakEl = document.getElementById('resultStreak');
  const solDiv = document.getElementById('resultSolution');

  const isCountdown = gameMode === 'countdown';
  const timeStr = timeTaken <= 30 ? ` in ${timeTaken}s` : ` (+${timeTaken - 30}s overtime)`;

  let scoreClass, headlineText, detailText;
  if (diff === 0) {
    scoreClass = 'exact'; headlineText = 'Exact';
    detailText = isCountdown ? `Hit ${puzzle.target}${timeStr}` : `Hit ${puzzle.target}`;
  } else if (diff <= 5) {
    scoreClass = 'close'; headlineText = 'Very close';
    detailText = `${playerBest} — ${diff} away${isCountdown ? timeStr : ''}`;
  } else if (diff <= 10) {
    scoreClass = 'close'; headlineText = 'Close';
    detailText = `${playerBest} — ${diff} away${isCountdown ? timeStr : ''}`;
  } else {
    scoreClass = 'miss'; headlineText = 'Not quite';
    detailText = `${playerBest} — ${diff} away from ${puzzle.target}${isCountdown ? timeStr : ''}`;
  }

  headline.textContent = headlineText;
  scoreEl.textContent = diff === 0 ? puzzle.target : (playerBest || '—');
  scoreEl.className = 'result-score ' + scoreClass;
  detail.textContent = detailText;

  if (isCountdown) {
    const pts = calcScore(diff, timeTaken);
    ptsEl.textContent = `${pts} pts`;
  } else {
    ptsEl.textContent = '';
  }

  const history = loadHistory();
  const { streak, best } = calcStreak(history);
  renderStreakBar(streak, best);
  if (streak > 0) {
    streakEl.textContent = streak === 1 ? `🔥 1-day streak — come back tomorrow!` : `🔥 ${streak}-day streak`;
  } else {
    streakEl.textContent = '';
  }

  const solResult = solve(puzzle.tiles.map(t => t.val), puzzle.target);
  if (solResult) {
    const d2 = Math.abs(solResult.val - puzzle.target);
    let solHtml = `<div style="color:var(--muted);font-size:10px;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px">One solution (${d2 === 0 ? 'exact' : d2 + ' away'})</div>`;
    solHtml += solResult.steps.map(s => `<div class="sol-line">${s}</div>`).join('');
    solDiv.innerHTML = solHtml;
  }

  panel.classList.add('show');
  window._lastResult = { diff, target: puzzle.target, playerBest, steps, timeTaken, grid, mode: gameMode };
}

function shareResult() {
  const r = window._lastResult;
  if (!r) return;

  const d = new Date();
  const dateStr = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  const history = loadHistory();
  const { streak } = calcStreak(history);
  const streakLine = streak > 1 ? `🔥 ${streak}-day streak\n` : '';

  let text;
  if (r.mode === 'free') {
    const resultLine = r.diff === 0 ? `🎯 ${r.target} — solved!` : `✗ ${r.diff} away from ${r.target}`;
    text = [
      `Numble — ${dateStr} (Free Time)`,
      '',
      resultLine,
      '',
      `${streakLine}https://annatromps.github.io/numble`,
    ].join('\n');
  } else {
    const pts = calcScore(r.diff, r.timeTaken);
    let resultLine;
    if (r.diff === 0) {
      const timeStr = r.timeTaken <= 30 ? `${r.timeTaken}s` : `+${r.timeTaken - 30}s overtime`;
      resultLine = `🎯 ${r.target} — ${pts} pts (${timeStr})`;
    } else {
      resultLine = `✗ ${r.diff} away — ${pts} pts`;
    }
    const grid = r.grid || buildShareGrid(r.diff, r.timeTaken);
    text = [
      `Numble — ${dateStr}`,
      '',
      resultLine,
      grid,
      '',
      `${streakLine}https://annatromps.github.io/numble`,
    ].join('\n');
  }

  navigator.clipboard.writeText(text).then(() => showToast('Copied!'));
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2000);
}

// ── How-to-play modal ──
function openHowTo() {
  document.getElementById('howToModal').classList.add('open');
}

function closeHowTo() {
  document.getElementById('howToModal').classList.remove('open');
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeHowTo();
});

init();
