const test = require('node:test');
const assert = require('node:assert/strict');
const { Engine } = require('./load');
const { game } = require('./helpers');

// Canonical layout: fossils 0-5 are 2s, 6-11 are 3s, 12-15 are 5s, 28-30 are gems.

test('peek: first tap — a private peek at ANY fossil; only the peeker learns the value', () => {
  const s = game();
  const events = [];
  s.observers.push({ onEvent: e => events.push(e) });
  assert.equal(Engine.peek(s, 20), 7);                        // any of the 31 fossils, no walking required
  assert.equal(s.phase, 'peeked');
  assert.equal(s.turn.revealed.length, 0, 'a peek reveals nothing publicly');
  const pk = events.find(e => e.type === 'peek');
  assert.deepEqual([pk.actor, pk.value], [s.current, 7]);
  assert.ok(!events.some(e => e.type === 'reveal'));
});

test('peek: every fossil on the board can be peeked at', () => {
  for (const id of [0, 7, 15, 22, 30]) { const s = game(); assert.equal(Engine.peek(s, id), s.tokens[id].value); }
});

test('peek: only one peek per turn, and never a fossil that is already matched', () => {
  const s = game();
  Engine.peek(s, 0);
  assert.throws(() => Engine.peek(s, 1));
  const t = game();
  t.tokens[0].matched = true;
  assert.throws(() => Engine.peek(t, 0), /cannot peek at/);
});

test('peek: it does not use up the turn — you may end the turn after a bare peek (it stays private)', () => {
  const s = game({ players: 2 });
  const first = s.current;
  Engine.peek(s, 0);
  Engine.endTurn(s);
  assert.notEqual(s.current, first);
  assert.deepEqual(s.turn.revealed, []);
});

test('flip: second tap — a public flip of a different fossil, only after a peek', () => {
  const s = game();
  const events = [];
  s.observers.push({ onEvent: e => events.push(e) });
  assert.throws(() => Engine.flipOther(s, 7), /flip only after peeking/);
  Engine.peek(s, 0);
  assert.throws(() => Engine.flipOther(s, 0), /cannot flip/);       // not the one you peeked
  Engine.flipOther(s, 7);
  const rv = events.find(e => e.type === 'reveal');
  assert.deepEqual([rv.tid, rv.value, rv.step], [7, 3, 'other']);
  assert.deepEqual(s.turn.revealed, [7]);
  assert.throws(() => Engine.flipOther(s, 8), /flip only after peeking/);   // one flip per peek
});

test('match: if the peeked and flipped fossils match, both go face up in front of you', () => {
  const s = game(); const me = s.players[s.current];
  Engine.peek(s, 0); Engine.flipOther(s, 1); Engine.flipOwn(s);
  assert.equal(me.sets.length, 1);
  assert.deepEqual([me.sets[0].value, me.sets[0].size, me.sets[0].gem], [2, 2, false]);
  assert.ok(s.tokens[0].matched && s.tokens[1].matched);
  assert.equal(s.tokenAt[s.tokens[0].cell], -1);
  assert.equal(s.matchedCount, 2);
  assert.equal(s.phase, 'resolved');
});

test('match: a matched set is worth nothing until it is banked', () => {
  const s = game();
  Engine.peek(s, 0); Engine.flipOther(s, 1); Engine.flipOwn(s);
  assert.equal(Engine.standings(s)[s.current].score, 0);
  assert.equal(Engine.standings(s)[s.current].stranded, 1);
});

test('miss: fossils that do not match flip back at the end of the turn and stay on the board', () => {
  const s = game();
  Engine.peek(s, 0); Engine.flipOther(s, 7);                         // a 2 and a 3
  assert.deepEqual(s.turn.revealed, [7]);
  Engine.endTurn(s);
  assert.equal(s.matchedCount, 0);
  assert.deepEqual(s.turn.revealed, []);
  assert.ok(!s.tokens[0].matched && !s.tokens[7].matched);
});

test('miss: revealing your own fossil when it does not match shows it to all but makes no match', () => {
  const s = game();
  Engine.peek(s, 0); Engine.flipOther(s, 7); Engine.flipOwn(s);
  assert.equal(s.players[s.current].sets.length, 0);
  assert.deepEqual(s.turn.revealed, [7, 0]);
  assert.equal(s.phase, 'resolved');
});

test('match: pairs only — a third equal fossil is never part of the set', () => {
  const s = game();
  Engine.peek(s, 0); Engine.flipOther(s, 1); Engine.flipOwn(s);
  assert.equal(s.players[s.current].sets[0].size, 2);
  assert.equal(s.tokens.filter(t => t.value === 2 && !t.matched).length, 4);
});

test('turn: one peek and one match attempt per turn', () => {
  const s = game();
  Engine.peek(s, 0); Engine.flipOther(s, 1); Engine.flipOwn(s);
  assert.throws(() => Engine.peek(s, 2));
  assert.throws(() => Engine.flipOwn(s));
  assert.throws(() => Engine.flipOther(s, 2));
});

test('turn: ending a turn passes to the next player', () => {
  const s = game({ players: 3 });
  assert.equal(s.current, 0);
  Engine.endTurn(s); assert.equal(s.current, 1);
  Engine.endTurn(s); assert.equal(s.current, 2);
  Engine.endTurn(s); assert.equal(s.current, 0);
  assert.equal(s.turnNo, 3);
});

// ---- gems: peek a gem, flip a gem, reveal your own gem, then flip a third; a gem makes the set ----
test('gems: peek a gem, flip a gem, flip your own gem, then a third — three gems match as one set', () => {
  const s = game(); const me = s.players[s.current];
  assert.equal(Engine.peek(s, 28), 12);
  Engine.flipOther(s, 29);
  assert.equal(Engine.canFlipSecond(s), false, 'the third flip comes only after revealing your own gem');
  assert.equal(Engine.canFlipOwn(s), true);
  Engine.flipOwn(s);
  assert.equal(s.phase, 'gemThird');
  assert.equal(Engine.canFlipSecond(s), true);
  Engine.flipSecond(s, 30);
  assert.deepEqual([me.sets[0].value, me.sets[0].size, me.sets[0].gem], [12, 3, true]);
  assert.equal(s.matchedCount, 3);
});

test('gems: if the third fossil is not a gem, everything flips back and nothing is matched', () => {
  const s = game();
  Engine.peek(s, 28); Engine.flipOther(s, 29); Engine.flipOwn(s); Engine.flipSecond(s, 0);
  assert.equal(s.matchedCount, 0);
  assert.equal(s.phase, 'resolved');
  Engine.endTurn(s);
  assert.ok(s.tokens.every(t => !t.matched));
});

test('gems: declining (End turn) keeps the peeked gem private', () => {
  const s = game();
  Engine.peek(s, 28); Engine.flipOther(s, 29);
  assert.deepEqual(s.turn.revealed, [29]);
  Engine.endTurn(s);
  assert.equal(s.matchedCount, 0);
});

test('gems: two gems are never a match on their own (all three are needed)', () => {
  const s = game();
  Engine.peek(s, 28); Engine.flipOther(s, 29); Engine.flipOwn(s);
  Engine.endTurn(s);
  assert.equal(s.matchedCount, 0);
  assert.equal(s.players[0].sets.length, 0);
});

test('gems: the third flip is only offered when you flipped a gem and revealed yours', () => {
  const s = game();
  Engine.peek(s, 28); Engine.flipOther(s, 0);                        // flipped a 2, not a gem
  assert.equal(Engine.canFlipSecond(s), false);
  Engine.flipOwn(s);
  assert.equal(s.phase, 'resolved');
  assert.throws(() => Engine.flipSecond(s, 29));
});

test('gems: the third fossil must be a hidden fossil other than the two already involved', () => {
  const s = game();
  Engine.peek(s, 28); Engine.flipOther(s, 29); Engine.flipOwn(s);
  assert.throws(() => Engine.flipSecond(s, 28));
  assert.throws(() => Engine.flipSecond(s, 29));
});

test('events: observers hear every public reveal and each match, so bots can remember them', () => {
  const s = game(); const types = [];
  s.observers.push({ onEvent: e => types.push(e.type) });
  Engine.peek(s, 0); Engine.flipOther(s, 1); Engine.flipOwn(s);
  assert.deepEqual(types, ['peek', 'reveal', 'reveal', 'match']);
});
