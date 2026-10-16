const test = require('node:test');
const assert = require('node:assert/strict');
const { Engine } = require('./load');
const { game, standOn, stay } = require('./helpers');

// Plays every remaining match through the real engine actions, current player doing each.
function matchEverything(s, { stopBeforeLast = false } = {}) {
  const groups = {};
  for (const t of s.tokens) if (!t.matched) (groups[t.gem ? 'g' : t.value] ||= []).push(t.id);
  const list = Object.values(groups).flatMap(ids => {
    const size = s.tokens[ids[0]].gem ? 3 : 2, out = [];
    for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
    return out;
  });
  list.sort((a, b) => b.length - a.length);   // gem triple first, so the last match is a pair
  const total = list.length;
  list.forEach((ids, n) => {
    if (stopBeforeLast && n === total - 1) return;
    if (s.system) { standOn(s, s.current, ids[0]); stay(s); }
    Engine.peek(s, ids[0]);
    Engine.flipOther(s, ids[1]);
    if (ids.length === 3) { Engine.flipSecond(s, ids[2]); Engine.flipOwn(s); }
    else Engine.flipOwn(s);
    if (!s.over) Engine.endTurn(s);
  });
  return list.length;
}

test('end: the game ends immediately when the last fossil is matched', () => {
  const s = game();
  assert.equal(matchEverything(s, { stopBeforeLast: true }) , 15);
  assert.equal(s.over, false);
  assert.equal(s.matchedCount, 29);
  // final pair
  const rest = s.tokens.filter(t => !t.matched);
  standOn(s, s.current, rest[0].id); stay(s);
  Engine.peek(s); Engine.flipOther(s, rest[1].id); Engine.flipOwn(s);
  assert.equal(s.over, true);
  assert.equal(s.phase, 'over');
  assert.ok(s.result);
  const turn = s.turnNo; Engine.endTurn(s);
  assert.equal(s.turnNo, turn, 'no further turns once over');
});

test('end: there are exactly 15 matches in a game (14 pairs + 1 gem triple)', () => {
  const s = game();
  assert.equal(matchEverything(s), 15);
  assert.equal(s.over, true);
});

test('end: face-up (undelivered) fossils are worth 0 points at the end', () => {
  const s = game();
  matchEverything(s);
  const sum = s.players.reduce((a, p) => a + p.sets.length, 0);
  assert.equal(sum, 15);
  assert.ok(Engine.standings(s).every(r => r.score === 0));
  assert.equal(s.result.standings.reduce((a, r) => a + r.stranded, 0), 15);
});

function finished(stashes) {
  const s = game({ players: stashes.length });
  stashes.forEach((st, i) => { s.players[i].stash = st; });
  return Engine.computeResult(s);
}

test('scoring: score is the sum of face-down delivered fossils; highest score wins', () => {
  const r = finished([[10, 5], [16], [3, 2, 2]]);
  assert.deepEqual(r.winners, [1]);
  assert.deepEqual(r.ranking.map(x => x.idx), [1, 0, 2]);
  assert.equal(r.standings[0].score, 15);
  assert.equal(r.standings[1].score, 16);           // a gem is worth 16
});

test('scoring tie-break 1: the most fossils wins', () => {
  const r = finished([[10, 5], [5, 5, 5], [15]]);
  assert.deepEqual(r.winners, [1]);
});

test('scoring tie-break 2: still tied — the highest scoring fossil wins', () => {
  const r = finished([[11, 4], [10, 5]]);
  assert.deepEqual(r.winners, [0]);
});

test('scoring: still tied after all tie-breaks — shared win', () => {
  const r = finished([[10, 5], [5, 10]]);
  assert.deepEqual(r.winners.sort(), [0, 1]);
});

test('scoring: points come from the data block (gem value 16)', () => {
  const s = game();
  assert.ok(s.tokens.filter(t => t.gem).every(t => t.value === 16));
});
