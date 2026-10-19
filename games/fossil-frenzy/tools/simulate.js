#!/usr/bin/env node
// Bot simulations for Fossil Frenzy's single rule set.
//   npm run simulate -- [--games 1000] [--seed 1] [--out path/results.json]     (from the repo root)
// Prints markdown tables and writes the raw numbers to the --out JSON file (and tables.md next to it).
const fs = require('fs');
const path = require('path');
const { GAME_DATA, Engine, Bots, Campaign } = require('../tests/load');

const argv = process.argv.slice(2);
const arg = (name, def) => { const i = argv.indexOf('--' + name); return i >= 0 ? argv[i + 1] : def; };
const GAMES = Number(arg('games', 1000));
const BASE_SEED = Number(arg('seed', 1));
const OUT = arg('out', path.join(__dirname, 'results.json'));
const LEVELS = GAME_DATA.campaign.levels;

// ---------- stats helpers ----------
const sum = a => a.reduce((x, y) => x + y, 0);
const mean = a => (a.length ? sum(a) / a.length : NaN);
const sd = a => { const m = mean(a); return Math.sqrt(mean(a.map(x => (x - m) ** 2))); };
const pct = (a, p) => { const b = a.slice().sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(p * b.length))]; };
const median = a => pct(a, 0.5);
const ci = (p, n) => 1.96 * Math.sqrt(p * (1 - p) / n);          // 95% half-width of a proportion
function spearman(x, y) {
  const rank = a => a.map(v => a.filter(w => w < v).length + (a.filter(w => w === v).length - 1) / 2);
  const rx = rank(x), ry = rank(y), mx = mean(rx), my = mean(ry);
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < rx.length; i++) { num += (rx[i] - mx) * (ry[i] - my); dx += (rx[i] - mx) ** 2; dy += (ry[i] - my) ** 2; }
  return dx && dy ? num / Math.sqrt(dx * dy) : 0;
}

// A player of the perfect strategy with a given memory — stands in for a human of that skill (who plays well but forgets).
const EXPERT = GAME_DATA.ai.profiles.expert;
const player = memory => ({ ...EXPERT, memory });
const level = i => Campaign.botSpec(LEVELS[i]);

// ---------- one game ----------
function runGame({ specs, seed }) {
  const n = specs.length;
  const s = Engine.createGame({ players: n, seed });
  const bots = Bots.attach(s, specs, seed);
  const snaps = [Engine.standings(s).map(x => x.score)];            // snaps[k] = scores after k completed turns
  let guard = 0;
  while (!s.over) {
    if (++guard > 200000) return null;
    const turnBefore = s.turnNo;
    Bots.step(s, bots[s.current]);
    if (s.turnNo !== turnBefore) snaps.push(Engine.standings(s).map(x => x.score));
  }
  const final = Engine.standings(s);
  const topScore = Math.max(...final.map(x => x.score));
  return {
    n, turns: s.turnNo + 1, specs, snaps, scores: final.map(x => x.score), winners: s.result.winners, firstPlayer: s.firstPlayer,
    stranded: sum(s.players.map(p => p.sets.length)),
    scoreTie: final.filter(x => x.score === topScore).length > 1, sharedWin: s.result.winners.length > 1,
  };
}

const leadersAt = (g, frac) => {
  const k = Math.min(g.snaps.length - 1, Math.floor(frac * g.turns));
  const sc = g.snaps[k], top = Math.max(...sc);
  return top <= 0 ? [] : sc.flatMap((v, i) => (v === top ? [i] : []));
};
const winCredit = (g, seat) => (g.winners.includes(seat) ? 1 / g.winners.length : 0);

function runMany(specsFor, label, count = GAMES) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const g = runGame({ specs: specsFor(i), seed: BASE_SEED * 100000 + i });
    if (!g) throw new Error('game hit the safety cap: ' + label + ' #' + i);
    out.push(g);
  }
  return out;
}

function summary(games) {
  const n = games[0].n;
  const turns = games.map(g => g.turns);
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
      any++; anyCredit += mean(L.map(l => winCredit(g, l)));        // a tied lead shares its credit
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
    spread: { sdWithinGame: mean(games.map(g => sd(g.scores))), rangeWithinGame: mean(range), cvWithinGame: mean(cv), meanMargin: mean(margin), marginPctOfWinner: mean(margin) / mean(winScore) },
    sharedWinPct: mean(games.map(g => (g.sharedWin ? 1 : 0))),
    scoreTiePct: mean(games.map(g => (g.scoreTie ? 1 : 0))),
    early,
    seatOrderWinShare: bySeatOrder.map(x => x / games.length),
    stranded: { mean: mean(games.map(g => g.stranded)), gamesWithAny: mean(games.map(g => (g.stranded > 0 ? 1 : 0))) },
  };
}

// Mixed-memory table: win share and mean final-score rank per memory level, rotated randomly across seats.
function mixed(specs) {
  const levels = specs.map(sp => sp.memory);                      // each seat is told apart by its (distinct) memory
  const rngSeat = Engine.mulberry32(4242);
  const shuffle = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rngSeat() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  const games = runMany(() => shuffle(specs), 'mixed ' + levels);
  const wins = levels.map(() => 0), scores = levels.map(() => []), ranks = levels.map(() => []), rhos = [];
  for (const g of games) {
    const mems = g.specs.map(s => s.memory);
    levels.forEach((m, li) => {
      const seat = mems.indexOf(m);
      wins[li] += winCredit(g, seat); scores[li].push(g.scores[seat]);
      ranks[li].push(1 + g.scores.filter(v => v > g.scores[seat]).length);
    });
    rhos.push(spearman(mems, g.scores));
  }
  const N = games.length;
  return { levels, rows: levels.map((m, li) => ({ memory: m, winShare: wins[li] / N, ci: ci(wins[li] / N, N), meanScore: mean(scores[li]), meanRank: mean(ranks[li]) })),
           fairShare: 1 / levels.length, spearman: mean(rhos) };
}

// One bot of memory m against three bots at `field`, seat chosen at random.
function skillCurve(field, mems) {
  const rngSeat = Engine.mulberry32(777);
  return mems.map(m => {
    const focal = [];
    const games = runMany(i => { const seat = Math.floor(rngSeat() * 4); focal[i] = seat; const a = [player(field), player(field), player(field)]; a.splice(seat, 0, player(m)); return a; }, 'curve ' + m);
    let wins = 0, scoreSum = 0;
    games.forEach((g, i) => { wins += winCredit(g, focal[i]); scoreSum += g.scores[focal[i]]; });
    return { memory: m, winShare: wins / games.length, ci: ci(wins / games.length, games.length), meanScore: scoreSum / games.length };
  });
}

// Head to head over a set of games, seats alternating: share of games won outright by `a` (a draw counts half).
function headToHead(a, b) {
  const games = runMany(i => (i % 2 ? [b, a] : [a, b]), 'h2h');
  let wins = 0, draws = 0, outright = 0;
  games.forEach((g, i) => { const seat = i % 2 ? 1 : 0; wins += winCredit(g, seat); if (g.winners.length > 1) draws++; else if (g.winners[0] === seat) outright++; });
  const N = games.length;
  return { winShare: wins / N, ci: ci(wins / N, N), outright: outright / N, draws: draws / N };
}

// ---------- run ----------
const t0 = Date.now();
const R = { games: GAMES, seed: BASE_SEED, levels: LEVELS.map(l => l.name) };
console.error('baseline …');
R.equal4 = summary(runMany(() => [0.9, 0.9, 0.9, 0.9].map(player), 'equal4'));
R.byPlayers = {};
for (let n = 2; n <= 4; n++) R.byPlayers[n] = summary(runMany(() => Array(n).fill(0.9).map(player), 'players' + n));
R.equalMemory = {};
for (const m of [0.5, 0.7, 0.9, 1.0]) R.equalMemory[m] = summary(runMany(() => Array(4).fill(m).map(player), 'eq' + m));
console.error('memory skill …');
R.mixedWide = mixed([0.3, 0.55, 0.8, 1.0].map(player));
R.mixedTiers = mixed([0, 2, 3, 4].map(i => level(i)));                  // four seats: Beginner, Normal, Challenging, Master
R.curve = skillCurve(0.7, [0.3, 0.5, 0.7, 0.9, 1.0]);
console.error('campaign ladder …');
R.ladder = LEVELS.map((_, i) => LEVELS.map((__, j) => (i === j ? null : headToHead(level(i), level(j)))));
const REFS = [0.5, 0.7, 0.9, 1.0];
R.vsReference = LEVELS.map((_, i) => REFS.map(m => headToHead(player(m), level(i))));   // a player of memory m against each level
R.refs = REFS;
console.error('what each ability is worth …');
const ABILITIES = [
  ['memory 0.8 (instead of perfect)', { memory: 0.8 }],
  ['memory 0.8, and overconfident about it (overconfidence 10)', { memory: 0.8, overconfidence: 10 }],
  ['no feel for set values (valueSense 0)', { valueSense: 0 }],
  ['no eye on the win (leadSense 0)', { leadSense: 0 }],
  ['no sense of the game ending (endSense 0, banks at 3 sets)', { endSense: 0, bankAt: 3 }],
  ['does not track which sets are left (setsSense 0)', { setsSense: 0 }],
  ['always goes for the third gem (gemSense 0)', { gemSense: 0 }],
  ['plays a random move 10% of the time (mistakes 0.1)', { mistakes: 0.1 }],
  ['plays a random move 25% of the time (mistakes 0.25)', { mistakes: 0.25 }],
  ['all of the weak settings (memory 0.8, overconfident, every skill 0, mistakes 0.2, banks at 3 sets)', { memory: 0.8, overconfidence: 10, valueSense: 0, leadSense: 0, endSense: 0, setsSense: 0, gemSense: 0, mistakes: 0.2, bankAt: 3 }],
];
R.abilities = ABILITIES.map(([name, o]) => ({ name, ...headToHead(EXPERT, { ...EXPERT, ...o }) }));
R.tutorial = LEVELS.map((_, i) => headToHead(level(i), GAME_DATA.ai.profiles.random));
R.levelSettings = LEVELS.map(l => ({ name: l.name, ...l.ai }));
R.seconds = (Date.now() - t0) / 1000;
fs.writeFileSync(OUT, JSON.stringify(R, null, 1));
console.error('done in', R.seconds, 's ->', OUT);

// ---------- markdown ----------
const f1 = x => (Number.isFinite(x) ? x.toFixed(1) : '–');
const f2 = x => (Number.isFinite(x) ? x.toFixed(2) : '–');
const P = x => (Number.isFinite(x) ? (100 * x).toFixed(1) + '%' : '–');
const L = [];
const a = R.equal4;
L.push(`## Table 1 — 4 players, everyone at memory 0.90, ${GAMES} games`, '', '| metric | value |', '|---|---|');
L.push(`| turns per game (mean / median) | ${f1(a.turns.mean)} / ${a.turns.median} |`);
L.push(`| turns per game (10th–90th pct) | ${a.turns.p10}–${a.turns.p90} |`);
L.push(`| rounds per player | ${f1(a.rounds)} |`);
L.push(`| mean final score per player / mean winning score | ${f1(a.finalScore.meanPerPlayer)} / ${f1(a.finalScore.meanWinning)} |`);
L.push(`| score SD within a game / range (max − min) | ${f1(a.spread.sdWithinGame)} / ${f1(a.spread.rangeWithinGame)} |`);
L.push(`| coefficient of variation within a game | ${f2(a.spread.cvWithinGame)} |`);
L.push(`| mean winning margin (1st − 2nd), and as % of winner's score | ${f1(a.spread.meanMargin)}, ${P(a.spread.marginPctOfWinner)} |`);
L.push(`| games with a tie on score / a shared win after every tie-break | ${P(a.scoreTiePct)} / ${P(a.sharedWinPct)} |`);
L.push(`| points lost at the end in unbanked sets (mean) | ${f1(a.stranded.mean)} |`);
for (const fr of [0.25, 0.5, 0.75]) {
  const e = a.early[fr];
  L.push(`| leader at ${fr * 100}% of the game: someone has scored / a sole leader exists | ${P(e.anyShare)} / ${P(e.share)} |`);
  L.push(`| leader at ${fr * 100}%: win rate counting tied leaders (credit shared) | ${P(e.tieAwareWinRate)} ±${P(ci(e.tieAwareWinRate, e.anyGames))} |`);
}
L.push(`| win share by turn order (1st / 2nd / 3rd / 4th) | ${a.seatOrderWinShare.map(P).join(' / ')} |`);
L.push('', `Fair win share with 4 players is 25.0%; the 95% half-width of a win share over ${GAMES} games is about ±2.7%.`, '');

L.push('## Table 2 — game length and early leader by player count (everyone at memory 0.90)', '', '| players | turns | rounds/player | leader at 50% goes on to win (fair share) | win share by turn order |', '|---|---|---|---|---|');
for (let n = 2; n <= 4; n++) { const x = R.byPlayers[n]; L.push(`| ${n} | ${f1(x.turns.mean)} | ${f1(x.rounds)} | ${P(x.early[0.5].tieAwareWinRate)} (${P(1 / n)}) | ${x.seatOrderWinShare.map(P).join(' / ')} |`); }
L.push('');

for (const [key, title] of [['mixedWide', 'Table 3 — memory skill: four players of very different memory (0.30 / 0.55 / 0.80 / 1.00), random seats'], ['mixedTiers', 'Table 4 — memory skill: the memory of Beginner / Normal / Challenging / Master, random seats']]) {
  const m = R[key];
  L.push(`## ${title}`, '', '| memory | win share | mean score | mean rank |', '|---|---|---|---|');
  m.rows.forEach(x => L.push(`| ${x.memory} | ${P(x.winShare)} ±${P(x.ci)} | ${f1(x.meanScore)} | ${f2(x.meanRank)} |`));
  L.push('', `Spearman correlation between a seat's memory and its final score (per game, averaged): ${f2(m.spearman)}.`, '');
}

L.push('## Table 5 — one player of memory m against three players at 0.70 (fair share 25%)', '', '| focal memory | win share | mean score |', '|---|---|---|');
R.curve.forEach(x => L.push(`| ${x.memory} | ${P(x.winShare)} ±${P(x.ci)} | ${f1(x.meanScore)} |`));
L.push('');

L.push('## Table 6 — the campaign ladder: each level against each other level (2 players, row beats column this often; a draw counts half)', '', `| | ${R.levels.join(' | ')} |`, `|---|${R.levels.map(() => '---').join('|')}|`);
R.ladder.forEach((row, i) => L.push(`| **${R.levels[i]}** | ${row.map(c => (c ? P(c.winShare) : '—')).join(' | ')} |`));
L.push('');

L.push('## Table 7 — how hard is each level? Win rate of the perfect strategy at a given memory against each level', '', `| level | ${R.refs.map(m => 'player memory ' + m).join(' | ')} |`, `|---|${R.refs.map(() => '---').join('|')}|`);
R.vsReference.forEach((row, i) => L.push(`| ${R.levels[i]} | ${row.map(c => `${P(c.outright)}${c.draws > 0.005 ? ` (+${P(c.draws)} draws)` : ''}`).join(' | ')} |`));
L.push('', 'Outright wins only, since the campaign counts only an outright win as a defeat (a draw leaves the level locked).', '');

L.push('## Table 9 — what each ability is worth: the perfect player against itself with one ability taken away (2 players; the perfect player wins this often, a draw counts half)', '', '| the other player lacks… | perfect player wins |', '|---|---|');
R.abilities.forEach(x => L.push(`| ${x.name} | ${P(x.winShare)} ±${P(x.ci)} |`));
L.push('');
L.push('## Table 10 — the five campaign opponents\' settings', '', '| level | memory | overconfidence | valueSense | leadSense | endSense | setsSense | gemSense | mistakes | bank habit |', '|---|---|---|---|---|---|---|---|---|---|');
R.levelSettings.forEach(x => L.push(`| ${x.name} | ${x.memory} | ${x.overconfidence} | ${x.valueSense} | ${x.leadSense} | ${x.endSense} | ${x.setsSense} | ${x.gemSense} | ${P(x.mistakes)} | ${x.bankAt ? 'at ' + x.bankAt + ' sets' : 'none'}${x.endgameTiles ? ', and when ≤ ' + x.endgameTiles + ' fossils left' : ''} |`));
L.push('', 'Skills run from 0 (none) to 10 (perfect); memory is the chance a remembered fact is still recalled exactly, per turn that passes; mistakes is the chance of a random move (see `docs/AI.md`).', '');
L.push('## Table 11 — the tutorial opponent (plays at random): how often each campaign level beats it (2 players)', '', '| level | wins |', '|---|---|');
R.tutorial.forEach((x, i) => L.push(`| ${R.levels[i]} | ${P(x.winShare)} |`));
L.push('');

L.push('## Table 8 — everyone has the same memory (4 players)', '', '| memory | turns | leader at 50% goes on to win |', '|---|---|---|');
for (const m of Object.keys(R.equalMemory)) L.push(`| ${m} | ${f1(R.equalMemory[m].turns.mean)} | ${P(R.equalMemory[m].early[0.5].tieAwareWinRate)} |`);
L.push('');
const md = L.join('\n');
fs.writeFileSync(path.join(path.dirname(OUT), 'tables.md'), md);
console.log(md);
