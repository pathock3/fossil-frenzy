const test = require('node:test');
const assert = require('node:assert/strict');
const { Engine } = require('./load');
const { game, standOn, place, stay } = require('./helpers');

// Canonical layout: tiles 0-5 are 2s, 6-11 are 3s, 12-15 are 5s, 28-30 are gems.
const ready = (o = {}) => { const s = game(o); return s; };

test('peek: only possible when you stand on a fossil (not on a corner, not before moving)', () => {
  const s = ready();
  assert.throws(() => Engine.peek(s, 0), /./, 'cannot peek before the movement phase is over');
  stay(s);                                   // player 0 stays in a corner
  assert.equal(Engine.status(s).canPeek, false);
  assert.throws(() => Engine.peek(s));
});

test('peek: on a fossil you may peek; only you learn the value (private event), phase becomes peeked', () => {
  const s = ready();
  const events = [];
  s.observers.push({ onEvent: e => events.push(e) });
  standOn(s, 0, 0); stay(s);
  assert.equal(Engine.status(s).canPeek, true);
  const v = Engine.peek(s);
  assert.equal(v, 2);
  assert.equal(s.phase, 'peeked');
  const pk = events.find(e => e.type === 'peek');
  assert.equal(pk.value, 2); assert.equal(pk.actor, 0);
  assert.equal(s.turn.revealed.length, 0, 'a peek reveals nothing publicly');
});

test('peek: you may peek only at the fossil you are standing on', () => {
  const s = ready(); standOn(s, 0, 0); stay(s);
  assert.throws(() => Engine.peek(s, 5));
});

test('peek: "if you peek, you must also flip one other fossil" — cannot end the turn after a bare peek', () => {
  const s = ready(); standOn(s, 0, 0); stay(s); Engine.peek(s);
  assert.throws(() => Engine.endTurn(s), /peek/);
  assert.equal(Engine.status(s).mustFlip, true);
});

test('flip: the other fossil is revealed to all (public event); it must be a different, unmatched fossil', () => {
  const s = ready();
  const events = [];
  s.observers.push({ onEvent: e => events.push(e) });
  standOn(s, 0, 0); stay(s); Engine.peek(s);
  assert.throws(() => Engine.flipOther(s, 0), /cannot flip/);
  Engine.flipOther(s, 7);
  const rv = events.find(e => e.type === 'reveal');
  assert.deepEqual([rv.tid, rv.value, rv.step], [7, 3, 'other']);
  assert.deepEqual(s.turn.revealed, [7]);
  assert.throws(() => Engine.flipOther(s, 8), /flip only after peeking/);
});

test('match: flipping the fossil you stand on after a matching flip puts both face up in front of you', () => {
  const s = ready(); standOn(s, 0, 0); stay(s); Engine.peek(s);
  Engine.flipOther(s, 1);                      // another 2
  Engine.flipOwn(s);
  const p = s.players[0];
  assert.equal(p.sets.length, 1);
  assert.deepEqual([p.sets[0].value, p.sets[0].size, p.sets[0].gem], [2, 2, false]);
  assert.ok(s.tokens[0].matched && s.tokens[1].matched);
  assert.equal(s.tokenAt[s.tokens[0].cell], -1);
  assert.equal(s.matchedCount, 2);
  assert.equal(s.phase, 'resolved');
});

test('match: a matched set is worth nothing until delivered (score 0)', () => {
  const s = ready(); standOn(s, 0, 0); stay(s); Engine.peek(s); Engine.flipOther(s, 1); Engine.flipOwn(s);
  assert.equal(Engine.standings(s)[0].score, 0);
  assert.equal(Engine.standings(s)[0].stranded, 1);
});

test('miss: non-matching fossils flip back down at end of turn and stay on the board', () => {
  const s = ready(); standOn(s, 0, 0); stay(s); Engine.peek(s);
  Engine.flipOther(s, 7);                      // a 3
  Engine.endTurn(s);                           // option to flip own is declined
  assert.equal(s.matchedCount, 0);
  assert.deepEqual(s.turn.revealed, []);
  assert.equal(s.current, 1);
  assert.ok(!s.tokens[0].matched && !s.tokens[7].matched);
});

test('miss: flipping your own fossil when it does not match gives no match (but it is shown to all)', () => {
  const s = ready(); standOn(s, 0, 0); stay(s); Engine.peek(s); Engine.flipOther(s, 7);
  Engine.flipOwn(s);
  assert.equal(s.players[0].sets.length, 0);
  assert.deepEqual(s.turn.revealed, [7, 0]);
  assert.equal(s.phase, 'resolved');
});

test('match: pairs only — a third equal fossil is never part of the set', () => {
  const s = ready(); standOn(s, 0, 0); stay(s); Engine.peek(s); Engine.flipOther(s, 1); Engine.flipOwn(s);
  assert.equal(s.players[0].sets[0].size, 2);
  assert.equal(s.tokens.filter(t => t.value === 2 && !t.matched).length, 4);
});

test('turn: one peek and one match attempt per turn', () => {
  const s = ready(); standOn(s, 0, 0); stay(s); Engine.peek(s); Engine.flipOther(s, 1); Engine.flipOwn(s);
  assert.throws(() => Engine.peek(s));
  assert.throws(() => Engine.flipOwn(s));
  assert.throws(() => Engine.flipOther(s, 2));
});

test('turn: end of turn passes to the next player with a fresh movement phase', () => {
  const s = ready(); stay(s); Engine.endTurn(s);
  assert.equal(s.current, 1);
  assert.equal(s.phase, 'move');
  assert.throws(() => Engine.endTurn(s), /must move/);
});

test('gems: peek a gem, flip a gem, flip a second fossil, then flip yours — all three gems match as one set', () => {
  const s = ready(); standOn(s, 0, 28); stay(s);
  assert.equal(Engine.peek(s), 16);
  Engine.flipOther(s, 29);
  assert.equal(Engine.status(s).canFlipSecond, true);
  Engine.flipSecond(s, 30);
  assert.equal(Engine.status(s).canFlipOwn, true);
  Engine.flipOwn(s);
  const set = s.players[0].sets[0];
  assert.deepEqual([set.value, set.size, set.gem], [16, 3, true]);
  assert.equal(s.matchedCount, 3);
});

test('gems: if the second fossil is not a gem there is no match and everything flips back', () => {
  const s = ready(); standOn(s, 0, 28); stay(s); Engine.peek(s);
  Engine.flipOther(s, 29); Engine.flipSecond(s, 0);
  Engine.flipOwn(s);
  assert.equal(s.matchedCount, 0);
  Engine.endTurn(s);
  assert.ok(s.tokens.every(t => !t.matched));
});

test('gems: two gems are never a match on their own (all three are required)', () => {
  const s = ready(); standOn(s, 0, 28); stay(s); Engine.peek(s); Engine.flipOther(s, 29);
  Engine.flipOwn(s);
  assert.equal(s.matchedCount, 0);
  assert.equal(s.players[0].sets.length, 0);
});

test('gems: a second flip is only offered after flipping a gem, and never before the first flip', () => {
  const s = ready(); standOn(s, 0, 28); stay(s); Engine.peek(s);
  assert.throws(() => Engine.flipSecond(s, 29));
  Engine.flipOther(s, 0);                      // a 2, not a gem
  assert.equal(Engine.status(s).canFlipSecond, false);
  assert.throws(() => Engine.flipSecond(s, 29));
});

test('gems: the second flip must be a hidden fossil other than the two already involved', () => {
  const s = ready(); standOn(s, 0, 28); stay(s); Engine.peek(s); Engine.flipOther(s, 29);
  assert.throws(() => Engine.flipSecond(s, 28));
  assert.throws(() => Engine.flipSecond(s, 29));
});

test('peek: standing on a space whose fossil was already matched (empty space) gives no peek', () => {
  const s = ready();
  s.tokens[0].matched = true; s.tokenAt[s.tokens[0].cell] = -1;
  standOn(s, 0, 0); stay(s);
  assert.equal(Engine.status(s).canPeek, false);
  assert.throws(() => Engine.peek(s));
});

test('events: observers hear every public reveal and each match, so bots can remember them', () => {
  const s = ready(); const types = [];
  s.observers.push({ onEvent: e => types.push(e.type) });
  standOn(s, 0, 0); stay(s); Engine.peek(s); Engine.flipOther(s, 1); Engine.flipOwn(s);
  assert.deepEqual(types.filter(t => t !== 'move'), ['peek', 'reveal', 'reveal', 'match']);
});
