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

  const target = 101 + Math.floor(rng() * 899);
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

function recordResult(dateKey, diff) {
  const history = loadHistory();
  history[dateKey] = { diff, ts: Date.now() };
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

// ── Game state ──
let puzzle, tiles, steps, currentNums, selected1, selected2, selectedOp;
let timerInterval, timeLeft, gameOver;
let todayKey;

function init() {
  todayKey = getTodayKey();
  const seed = getDailySeed();
  const rng = mulberry32(seed);
  puzzle = generatePuzzle(rng);

  tiles = puzzle.tiles.map((t, i) => ({ ...t, id: i, used: false }));
  steps = [];
  currentNums = tiles.map(t => ({ val: t.val, id: t.id }));
  selected1 = null;
  selected2 = null;
  selectedOp = null;
  gameOver = false;
  timeLeft = 30;

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
    restoreTodayResult(history[todayKey].diff);
    return;
  }

  startTimer();
}

function restoreTodayResult(diff) {
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

  if (timeLeft >= 0) {
    count.textContent = timeLeft;
    count.style.color = timeLeft <= 10 ? 'var(--danger)' : '';
    fill.style.width = (timeLeft / 30 * 100) + '%';
    fill.classList.toggle('urgent', timeLeft <= 10);
    label.textContent = 'Time';
    label.style.color = '';
  } else {
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

  tiles.forEach(t => {
    const isUsed = !currentNums.find(n => n.id === t.id);
    const isSel = (selected1 && selected1.id === t.id) || (selected2 && selected2.id === t.id);
    const div = document.createElement('div');
    div.className = 'tile ' + t.type + (isUsed ? ' used' : '') + (isSel ? ' selected' : '');
    div.onclick = () => selectTile(t.id);
    div.innerHTML = `<div class="tile-tag">${t.type}</div><div class="tile-val">${t.val}</div>`;
    area.appendChild(div);
  });

  const intermediates = currentNums.filter(n => !origTileIds.has(n.id));
  intermediates.forEach(n => {
    const isSel = (selected1 && selected1.id === n.id) || (selected2 && selected2.id === n.id);
    const div = document.createElement('div');
    div.className = 'tile small' + (isSel ? ' selected' : '');
    div.onclick = () => selectTile(n.id);
    div.innerHTML = `<div class="tile-tag">result</div><div class="tile-val">${n.val}</div>`;
    area.appendChild(div);
  });
}

function selectTile(id) {
  if (gameOver) return;
  const num = currentNums.find(n => n.id === id);
  if (!num) return;

  if (selected1 && selected1.id === id && !selectedOp) {
    selected1 = null;
    updateOpButtons(false);
    renderTiles(); updateExpr();
    return;
  }
  if (selected2 && selected2.id === id) {
    selected2 = null;
    renderTiles(); updateExpr(); checkApplyReady();
    return;
  }

  if (!selected1) {
    selected1 = num;
    updateOpButtons(true);
  } else if (selectedOp && !selected2) {
    selected2 = num;
  } else if (!selectedOp) {
    selected1 = num;
  }
  renderTiles(); updateExpr(); checkApplyReady();
}

function updateOpButtons(enabled) {
  ['opPlus', 'opMinus', 'opMul', 'opDiv'].forEach(id => {
    document.getElementById(id).disabled = !enabled;
  });
}

function selectOp(op) {
  if (!selected1) return;
  selectedOp = op;
  document.querySelectorAll('.op-btn').forEach(b => b.classList.remove('active'));
  const map = { '+': 'opPlus', '−': 'opMinus', '×': 'opMul', '÷': 'opDiv' };
  document.getElementById(map[op]).classList.add('active');
  updateExpr(); checkApplyReady();
}

function checkApplyReady() {
  const ready = selected1 && selectedOp && selected2;
  document.getElementById('applyBtn').disabled = !ready;
}

function updateExpr() {
  const disp = document.getElementById('exprDisplay');
  if (!selected1 && !selectedOp && !selected2) {
    disp.innerHTML = `<span style="color:var(--muted);font-size:14px">Select a number, then an operator, then another number</span>`;
    return;
  }
  let html = '';
  if (selected1) html += `<span class="expr-token num">${selected1.val}</span>`;
  if (selectedOp) html += `<span class="expr-token op">${selectedOp}</span>`;
  if (selected2) html += `<span class="expr-token num">${selected2.val}</span>`;
  disp.innerHTML = html;
}

function applyStep() {
  if (!selected1 || !selectedOp || !selected2) return;
  tryApply(selected1, selected2);
}

function tryApply(a, b) {
  const opSym = selectedOp;
  let result;
  if (opSym === '+') result = a.val + b.val;
  else if (opSym === '−') result = a.val - b.val;
  else if (opSym === '×') result = a.val * b.val;
  else if (opSym === '÷') {
    if (b.val === 0 || a.val % b.val !== 0) { showToast('Must divide evenly'); return; }
    result = a.val / b.val;
  }

  if (result <= 0) { showToast('Result must be positive'); return; }

  const snapshot = { nums: [...currentNums] };
  steps.push({ a, b, op: opSym, result, snapshot, stepStr: `${a.val} ${opSym} ${b.val} = ${result}` });

  const newId = Date.now();
  currentNums = currentNums.filter(n => n.id !== a.id && n.id !== b.id);
  currentNums.push({ val: result, id: newId });

  selected1 = null; selected2 = null; selectedOp = null;
  document.querySelectorAll('.op-btn').forEach(b => b.classList.remove('active'));
  updateOpButtons(false);
  renderTiles(); updateExpr(); updateStepsLog(); checkSubmit();
  document.getElementById('applyBtn').disabled = true;

  if (result === puzzle.target) {
    setTimeout(() => submitAnswer(), 300);
  }
}

function updateStepsLog() {
  const log = document.getElementById('stepsLog');
  if (steps.length === 0) { log.innerHTML = ''; return; }
  log.innerHTML = steps.map(s =>
    `<div class="step-line">${s.a.val} ${s.op} ${s.b.val} = <span>${s.result}</span></div>`
  ).join('');
}

function checkSubmit() {
  document.getElementById('submitBtn').disabled = steps.length === 0;
}

function undoStep() {
  if (steps.length === 0) return;
  const last = steps.pop();
  currentNums = [...last.snapshot.nums];
  selected1 = null; selected2 = null; selectedOp = null;
  document.querySelectorAll('.op-btn').forEach(b => b.classList.remove('active'));
  updateOpButtons(false);
  renderTiles(); updateExpr(); updateStepsLog();
  checkSubmit();
  document.getElementById('applyBtn').disabled = true;
}

function clearWorking() {
  selected1 = null; selected2 = null; selectedOp = null;
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
  const timeTaken = 30 - timeLeft;

  // Save to history
  recordResult(todayKey, diff);

  showResult(closest.val, diff, timeTaken);
}

function showResult(playerBest, diff, timeTaken) {
  const panel = document.getElementById('resultPanel');
  const headline = document.getElementById('resultHeadline');
  const score = document.getElementById('resultScore');
  const detail = document.getElementById('resultDetail');
  const streakEl = document.getElementById('resultStreak');
  const solDiv = document.getElementById('resultSolution');

  const timeStr = timeTaken <= 30 ? ` in ${timeTaken}s` : ` (+${timeTaken - 30}s overtime)`;

  let scoreClass, headlineText, detailText;
  if (diff === 0) {
    scoreClass = 'exact'; headlineText = 'Exact';
    detailText = `You reached ${puzzle.target} exactly${timeStr}`;
  } else if (diff <= 5) {
    scoreClass = 'close'; headlineText = 'Very close';
    detailText = `You got ${playerBest}, just ${diff} away${timeStr}`;
  } else if (diff <= 10) {
    scoreClass = 'close'; headlineText = 'Close';
    detailText = `You got ${playerBest}, ${diff} away${timeStr}`;
  } else {
    scoreClass = 'miss'; headlineText = 'Not quite';
    detailText = `You got ${playerBest}, ${diff} away from ${puzzle.target}${timeStr}`;
  }

  headline.textContent = headlineText;
  score.textContent = diff === 0 ? puzzle.target : (playerBest || '—');
  score.className = 'result-score ' + scoreClass;
  detail.textContent = detailText;

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
  window._lastResult = { diff, target: puzzle.target, playerBest, steps, timeTaken };
}

function shareResult() {
  const d = new Date();
  const dateStr = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const r = window._lastResult;
  if (!r) return;
  let line;
  if (r.diff === 0) {
    const t = r.timeTaken <= 30 ? `${r.timeTaken}s` : `+${r.timeTaken - 30}s OT`;
    line = `🎯 Exact! Hit ${r.target} (${t})`;
  } else if (r.diff <= 5) {
    line = `🔥 ${r.playerBest} (${r.diff} away from ${r.target})`;
  } else {
    line = `💡 ${r.playerBest || '—'} (${r.diff} away from ${r.target})`;
  }
  const history = loadHistory();
  const { streak } = calcStreak(history);
  const streakLine = streak > 1 ? `\n🔥 ${streak}-day streak` : '';
  const text = `Numble — ${dateStr}\n${line}${streakLine}\nhttps://annatromps.github.io/numble`;
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
