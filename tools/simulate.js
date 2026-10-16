#!/usr/bin/env node
// Bot simulations: movement/delivery ON (rulebook) vs OFF (redesign).
//   node tools/simulate.js [--games 1000] [--seed 1] [--out tools/results.json]
// Prints markdown tables and writes the raw numbers to the --out JSON file.
const fs = require('fs');
const path = require('path');
const { Engine, Bots } = require('../tests/load');

const argv = process.argv.slice(2);
const arg = (name, def) => { const i = argv.indexOf('--' + name); return i >= 0 ? argv[i + 1] : def; };
const GAMES = Number(arg('games', 1000));
const BASE_SEED = Number(arg('seed', 1));
const OUT = arg('out', path.join(__dirname, 'results.json'));

// ---------- stats helpers ----------
const sum = a => a.reduce((x, y) => x + y, 0);
const mean = a => (a.length ? sum(a) / a.length : NaN);
const sd = a => { const m = mean(a); return Math.sqrt(mean(a.map(x => (x - m) ** 2))); };
const pct = (a, p) => { const b = a.slice().sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(p * b.length))]; };
const median = a => pct(a, 0.5);
// 95% half-width of a proportion (normal approximation)
const ci = (p, n) => 1.96 * Math.sqrt(p * (1 - p) / n);
function spearman(x, y) {
  const rank = a => a.map(v => a.filter(w => w < v).length + (a.filter(w => w === v).length - 1) / 2);
  const rx = rank(x), ry = rank(y), mx = mean(rx), my = mean(ry);
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < rx.length; i++) { num += (rx[i] - mx) * (ry[i] - my); dx += (rx[i] - mx) ** 2; dy += (ry[i] - my) ** 2; }
  return dx && dy ? num / Math.sqrt(dx * dy) : 0;
}

// ---------- one game ----------
function runGame({ system, memories, seed }) {
  const n = memories.length;
  const s = Engine.createGame({ players: n, system, seed });
  const bots = Bots.attach(s, memories.map(m => ({ memory: m })), seed);
  const snaps = [];                              // snaps[k] = scores after k completed turns
  snaps.push(Engine.standings(s).map(x => x.score));
  let guard = 0;
  while (!s.over) {
    if (++guard > 200000) return null;
    const turnBefore = s.turnNo;
    Bots.step(s, bots[s.current]);
    if (s.turnNo !== turnBefore) snaps.push(Engine.standings(s).map(x => x.score));
  }
  const final = Engine.standings(s);
  const stranded = system
    ? sum(s.players.map(p => sum(p.sets.map(x => x.value))))
    : sum(s.players.map(p => p.sets.length));
  const winners = s.result.winners;
  const topScore = Math.max(...final.map(x => x.score));
  return {
    n, turns: s.turnNo + 1, memories, snaps, scores: final.map(x => x.score), winners,
    firstPlayer: s.firstPlayer, stranded,
    scoreTie: final.filter(x => x.score === topScore).length > 1,
    sharedWin: winners.length > 1,
  };
}

// Everyone holding the top score after `frac` of the game's turns (empty while nobody has scored).
function leadersAt(g, frac) {
  const k = Math.min(g.snaps.length - 1, Math.floor(frac * g.turns));
  const sc = g.snaps[k], top = Math.max(...sc);
  return top <= 0 ? [] : sc.flatMap((v, i) => (v === top ? [i] : []));
}
const winCredit = (g, seat) => (g.winners.includes(seat) ? 1 / g.winners.length : 0);

// ---------- experiments ----------
function runMany(system, memoriesFor, label) {
  const out = [];
  for (let i = 0; i < GAMES; i++) {
    const g = runGame({ system, memories: memoriesFor(i), seed: BASE_SEED * 100000 + i });
    if (!g) throw new Error('game hit the safety cap: ' + label + ' #' + i);
    out.push(g);
  }
  return out;
}

function summary(games) {
  const n = games[0].n;
  const turns = games.map(g => g.turns);
  const within = games.map(g => sd(g.scores));
  const range = games.map(g => Math.max(...g.scores) - Math.min(...g.scores));
  const margin = games.map(g => { const b = g.scores.slice().sort((x, y) => y - x); return b[0] - b[1]; });
  const winScore = games.map(g => Math.max(...g.scores));
  const cv = games.map(g => { const m = mean(g.scores); return m > 0 ? sd(g.scores) / m : 0; });
  const early = {};
  for (const f of [0.25, 0.5, 0.75]) {
    let uniq = 0, uniqWins = 0, any = 0, anyCredit = 0;
    for (const g of games) {
      const L = leadersAt(g, f);
      if (!L.length) continue;
      any++; anyCredit += mean(L.map(l => winCredit(g, l)));      // a tied lead shares its credit
      if (L.length === 1) { uniq++; uniqWins += winCredit(g, L[0]); }
    }
    early[f] = { games: uniq, share: uniq / games.length, winRate: uniq ? uniqWins / uniq : NaN,
                 anyGames: any, anyShare: any / games.length, tieAwareWinRate: any ? anyCredit / any : NaN };
  }
  const bySeatOrder = Array(n).fill(0);
  for (const g of games) for (const w of g.winners) bySeatOrder[(w - g.firstPlayer + n) % n] += 1 / g.winners.length;
  return {
    games: games.length, players: n,
    turns: { mean: mean(turns), median: median(turns), sd: sd(turns), p10: pct(turns, 0.1), p90: pct(turns, 0.9) },
    rounds: mean(turns) / n,
    finalScore: { meanPerPlayer: mean(games.map(g => mean(g.scores))), meanWinning: mean(winScore) },
    spread: { sdWithinGame: mean(within), rangeWithinGame: mean(range), cvWithinGame: mean(cv), meanMargin: mean(margin), marginPctOfWinner: mean(margin) / mean(winScore) },
    sharedWinPct: mean(games.map(g => (g.sharedWin ? 1 : 0))),
    scoreTiePct: mean(games.map(g => (g.scoreTie ? 1 : 0))),
    early,
    seatOrderWinShare: bySeatOrder.map(x => x / games.length),
    stranded: { mean: mean(games.map(g => g.stranded)), gamesWithAny: mean(games.map(g => (g.stranded > 0 ? 1 : 0))) },
  };
}

// Mixed-memory table: win share and mean final-score rank per memory level, rotated randomly across seats.
function mixed(system, levels) {
  const rngSeat = Engine.mulberry32(4242);
  const shuffle = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rngSeat() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  const games = runMany(system, () => shuffle(levels), 'mixed ' + levels);
  const wins = levels.map(() => 0), scores = levels.map(() => []), ranks = levels.map(() => []);
  const rhos = [];
  for (const g of games) {
    levels.forEach((m, li) => {
      const seat = g.memories.indexOf(m);
      wins[li] += winCredit(g, seat);
      scores[li].push(g.scores[seat]);
      ranks[li].push(1 + g.scores.filter(v => v > g.scores[seat]).length);
    });
    rhos.push(spearman(g.memories, g.scores));
  }
  const N = games.length, fair = 1 / levels.length;
  return {
    levels,
    rows: levels.map((m, li) => ({ memory: m, winShare: wins[li] / N, ci: ci(wins[li] / N, N), meanScore: mean(scores[li]), meanRank: mean(ranks[li]) })),
    fairShare: fair, spearman: mean(rhos), summary: summary(games),
  };
}

// One focal bot of memory m against three bots at `field` memory, seat chosen at random.
function skillCurve(system, field, mems) {
  const rngSeat = Engine.mulberry32(777);
  return mems.map(m => {
    const focalSeat = [];
    const games = runMany(system, i => {
      const seat = Math.floor(rngSeat() * 4); focalSeat[i] = seat;
      const a = [field, field, field]; a.splice(seat, 0, m); return a;
    }, 'curve ' + m);
    let wins = 0, scoreSum = 0;
    games.forEach((g, i) => { wins += winCredit(g, focalSeat[i]); scoreSum += g.scores[focalSeat[i]]; });
    const N = games.length;
    return { memory: m, winShare: wins / N, ci: ci(wins / N, N), meanScore: scoreSum / N };
  });
}

// ---------- run ----------
const t0 = Date.now();
const results = { games: GAMES, seed: BASE_SEED, modes: {} };
const MODES = [['on', true], ['off', false]];
for (const [name, system] of MODES) {
  const R = results.modes[name] = {};
  console.error('mode', name, '…');
  R.equal4 = summary(runMany(system, () => [0.9, 0.9, 0.9, 0.9], 'equal4'));
  R.byPlayers = {};
  for (let n = 2; n <= 6; n++) R.byPlayers[n] = summary(runMany(system, () => Array(n).fill(0.9), 'players' + n));
  R.mixedWide = mixed(system, [0.3, 0.55, 0.8, 1.0]);
  R.mixedTiers = mixed(system, [0.8, 0.9, 0.965, 0.99]);
  R.curve = skillCurve(system, 0.7, [0.3, 0.5, 0.7, 0.9, 1.0]);
  R.equalMemory = {};
  for (const m of [0.5, 0.7, 0.9, 1.0]) R.equalMemory[m] = summary(runMany(system, () => [m, m, m, m], 'eq' + m));
}
results.seconds = (Date.now() - t0) / 1000;
fs.writeFileSync(OUT, JSON.stringify(results, null, 1));
console.error('done in', results.seconds, 's ->', OUT);

// ---------- markdown ----------
const f1 = x => (Number.isFinite(x) ? x.toFixed(1) : '–');
const f2 = x => (Number.isFinite(x) ? x.toFixed(2) : '–');
const P = x => (Number.isFinite(x) ? (100 * x).toFixed(1) + '%' : '–');
const [ON, OFF] = [results.modes.on, results.modes.off];
const row = (label, a, b) => `| ${label} | ${a} | ${b} |`;
const lines = [];
lines.push(`## Table 1 — 4 players, equal memory 0.90, ${GAMES} games per mode`, '', '| metric | delivery ON | delivery OFF |', '|---|---|---|');
const a = ON.equal4, b = OFF.equal4;
lines.push(row('turns per game (mean / median)', `${f1(a.turns.mean)} / ${a.turns.median}`, `${f1(b.turns.mean)} / ${b.turns.median}`));
lines.push(row('turns per game (10th–90th pct)', `${a.turns.p10}–${a.turns.p90}`, `${b.turns.p10}–${b.turns.p90}`));
lines.push(row('rounds per player', f1(a.rounds), f1(b.rounds)));
lines.push(row('mean final score per player', f1(a.finalScore.meanPerPlayer), f1(b.finalScore.meanPerPlayer)));
lines.push(row('mean winning score', f1(a.finalScore.meanWinning), f1(b.finalScore.meanWinning)));
lines.push(row('score SD within a game', f1(a.spread.sdWithinGame), f1(b.spread.sdWithinGame)));
lines.push(row('score range (max − min)', f1(a.spread.rangeWithinGame), f1(b.spread.rangeWithinGame)));
lines.push(row('coefficient of variation within a game', f2(a.spread.cvWithinGame), f2(b.spread.cvWithinGame)));
lines.push(row('mean winning margin (1st − 2nd)', f1(a.spread.meanMargin), f1(b.spread.meanMargin)));
lines.push(row('winning margin as % of winner\'s score', P(a.spread.marginPctOfWinner), P(b.spread.marginPctOfWinner)));
lines.push(row('games with a tie on score', P(a.scoreTiePct), P(b.scoreTiePct)));
lines.push(row('games with a shared win (all tie-breaks tied)', P(a.sharedWinPct), P(b.sharedWinPct)));
lines.push(row('unbanked/undelivered points lost at the end (mean)', f1(a.stranded.mean), f1(b.stranded.mean)));
for (const fr of [0.25, 0.5, 0.75]) {
  const A = a.early[fr], B = b.early[fr];
  lines.push(row(`leader at ${fr * 100}% of the game: someone has scored / a sole leader exists`, `${P(A.anyShare)} / ${P(A.share)}`, `${P(B.anyShare)} / ${P(B.share)}`));
  lines.push(row(`leader at ${fr * 100}%: sole leader goes on to win`, `${P(A.winRate)} ±${P(ci(A.winRate, A.games))}`, `${P(B.winRate)} ±${P(ci(B.winRate, B.games))}`));
  lines.push(row(`leader at ${fr * 100}%: win rate counting tied leaders (credit shared)`, `${P(A.tieAwareWinRate)} ±${P(ci(A.tieAwareWinRate, A.anyGames))}`, `${P(B.tieAwareWinRate)} ±${P(ci(B.tieAwareWinRate, B.anyGames))}`));
}
lines.push(row('win share by turn order (1st / 2nd / 3rd / 4th)', a.seatOrderWinShare.map(P).join(' / '), b.seatOrderWinShare.map(P).join(' / ')));
lines.push('', `Fair win share with 4 players is 25.0%; 95% half-width of a win share over ${GAMES} games is about ±2.7%.`, '');

lines.push('## Table 2 — game length by player count (equal memory 0.90)', '', '| players | ON turns | ON rounds/player | OFF turns | OFF rounds/player |', '|---|---|---|---|---|');
for (let n = 2; n <= 6; n++) lines.push(`| ${n} | ${f1(ON.byPlayers[n].turns.mean)} | ${f1(ON.byPlayers[n].rounds)} | ${f1(OFF.byPlayers[n].turns.mean)} | ${f1(OFF.byPlayers[n].rounds)} |`);
lines.push('');

lines.push('## Table 3 — does the early leader win? by player count (leader at 50% of the game, tied leaders share credit)', '', '| players | ON | OFF | fair share |', '|---|---|---|---|');
for (let n = 2; n <= 6; n++) lines.push(`| ${n} | ${P(ON.byPlayers[n].early[0.5].tieAwareWinRate)} | ${P(OFF.byPlayers[n].early[0.5].tieAwareWinRate)} | ${P(1 / n)} |`);
lines.push('');

for (const [key, title] of [['mixedWide', 'Table 4 — mixed memory (0.30 / 0.55 / 0.80 / 1.00), 4 players, random seats'], ['mixedTiers', 'Table 5 — mixed memory at the design-doc tier levels (0.80 / 0.90 / 0.965 / 0.99), 4 players, random seats']]) {
  lines.push(`## ${title}`, '', '| memory | ON win share | ON mean score | ON mean rank | OFF win share | OFF mean score | OFF mean rank |', '|---|---|---|---|---|---|---|');
  ON[key].levels.forEach((m, i) => {
    const x = ON[key].rows[i], y = OFF[key].rows[i];
    lines.push(`| ${m} | ${P(x.winShare)} ±${P(x.ci)} | ${f1(x.meanScore)} | ${f2(x.meanRank)} | ${P(y.winShare)} ±${P(y.ci)} | ${f1(y.meanScore)} | ${f2(y.meanRank)} |`);
  });
  lines.push('', `Spearman correlation between a seat's memory and its final score (per game, averaged): ON ${f2(ON[key].spearman)}, OFF ${f2(OFF[key].spearman)}.`, '');
}

lines.push('## Table 6 — one bot of memory m against three bots at 0.70 (fair share 25%)', '', '| focal memory | ON win share | ON mean score | OFF win share | OFF mean score |', '|---|---|---|---|---|');
ON.curve.forEach((x, i) => { const y = OFF.curve[i]; lines.push(`| ${x.memory} | ${P(x.winShare)} ±${P(x.ci)} | ${f1(x.meanScore)} | ${P(y.winShare)} ±${P(y.ci)} | ${f1(y.meanScore)} |`); });
lines.push('');

lines.push('## Table 7 — everyone has the same memory (4 players)', '', '| memory | ON turns | OFF turns | ON early leader (50%) wins | OFF early leader (50%) wins |', '|---|---|---|---|---|');
for (const m of Object.keys(ON.equalMemory)) lines.push(`| ${m} | ${f1(ON.equalMemory[m].turns.mean)} | ${f1(OFF.equalMemory[m].turns.mean)} | ${P(ON.equalMemory[m].early[0.5].tieAwareWinRate)} | ${P(OFF.equalMemory[m].early[0.5].tieAwareWinRate)} |`);
lines.push('');
const md = lines.join('\n');
fs.writeFileSync(path.join(path.dirname(OUT), 'tables.md'), md);
console.log(md);
