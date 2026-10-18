const test = require('node:test');
const assert = require('node:assert/strict');
const { Engine } = require('./load');
const { game } = require('./helpers');

// Plays every remaining match through the real engine actions, the current player doing each.
function matchEverything(s, { stopBeforeLast = false } = {}) {
  const groups = {};
  for (const t of s.tokens) if (!t.matched) (groups[t.gem ? 'g' : t.value] ||= []).push(t.id);
  const list = Object.values(groups).flatMap(ids => {
    const size = s.tokens[ids[0]].gem ? 3 : 2, out = [];
    for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
    return out;
  });
  list.sort((a, b) => b.length - a.length);                       // gem triple first, so the last match is a pair
  list.forEach((ids, n) => {
    if (stopBeforeLast && n === list.length - 1) return;
    Engine.peek(s, ids[0]);
    Engine.flipOther(s, ids[1]);
    Engine.flipOwn(s);
    if (ids.length === 3) Engine.flipSecond(s, ids[2]);
    if (!s.over) Engine.endTurn(s);
  });
  return list.length;
}

test('end: the game ends immediately when the last fossil is matched', () => {
  const s = game();
  assert.equal(matchEverything(s, { stopBeforeLast: true }), 15);
  assert.equal(s.over, false);
  assert.equal(s.matchedCount, 29);
  const rest = s.tokens.filter(t => !t.matched);
  Engine.peek(s, rest[0].id); Engine.flipOther(s, rest[1].id); Engine.flipOwn(s);
  assert.equal(s.over, true);
  assert.equal(s.phase, 'over');
  assert.ok(s.result);
  const turn = s.turnNo; Engine.endTurn(s);
  assert.equal(s.turnNo, turn, 'no further turns once over');
});

test('end: there are exactly 15 matches in a game (14 pairs + 1 gem triple)', () => {
  assert.equal(matchEverything(game()), 15);
});

test('end: sets you never banked are worth 0 points', () => {
  const s = game();
  matchEverything(s);
  assert.equal(s.players.reduce((a, p) => a + p.sets.length, 0), 15);
  assert.ok(Engine.standings(s).every(r => r.score === 0));
  assert.equal(s.result.standings.reduce((a, r) => a + r.stranded, 0), 15);
});

function ended(points, sets, lastPopper) {
  const s = game({ players: points.length });
  points.forEach((p, i) => { s.players[i].points = p; s.players[i].poppedSets = sets[i]; });
  s.lastPopper = lastPopper;
  return Engine.computeResult(s);
}

test('scoring: the highest score wins', () => {
  const r = ended([5, 3, 9], [1, 9, 2], 1);
  assert.deepEqual(r.winners, [2]);
  assert.deepEqual(r.ranking.map(x => x.idx), [2, 0, 1]);
});

test('tie-break 1: the most sets popped wins', () => {
  assert.deepEqual(ended([5, 5], [4, 6], 0).winners, [1]);
});

test('tie-break 2: still tied — whoever popped the final pair wins', () => {
  assert.deepEqual(ended([5, 5], [6, 6], 1).winners, [1]);
  assert.deepEqual(ended([5, 5, 5], [6, 6, 6], 2).winners, [2]);
});

test('tie-break 3: the final popper is not among the tied players — a shared win', () => {
  assert.deepEqual(ended([5, 5, 2], [6, 6, 9], 2).winners, [0, 1]);
});
