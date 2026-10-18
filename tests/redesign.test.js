const test = require('node:test');
const assert = require('node:assert/strict');
const { GAME_DATA, Engine } = require('./load');
const { game, rolls } = require('./helpers');

const off = (o = {}) => game({ system: false, ...o });
const pairOfTwos = s => { Engine.peek(s, 0); Engine.flipOther(s, 1); Engine.flipOwn(s); };

test('redesign: 31 spaces, no corners, no pieces, no movement, no delivery', () => {
  const s = off();
  assert.equal(s.cells.length, 31);
  assert.ok(s.cells.every(c => !c.site));
  assert.equal(s.tokenAt.filter(t => t >= 0).length, 31);
  assert.ok(s.players.every(p => p.pos === null));
  assert.equal(s.phase, 'action');
  assert.equal(Engine.availableMoves(s), null);
  assert.equal(Engine.canDeliver(s), false);
  assert.throws(() => Engine.deliver(s, 0));
});

test('redesign: first player is still the highest roller', () => {
  assert.equal(off({ players: 3, rolls: [2, 6, 4] }).current, 1);
});

test('redesign: you may peek at any tile (no standing on it required)', () => {
  const s = off();
  assert.equal(Engine.status(s).peekable.length, 31);
  assert.equal(Engine.peek(s, 20), s.tokens[20].value);
});

test('redesign: peek (private), then flip another (public); a match goes to your held stash', () => {
  const s = off(); const ev = [];
  s.observers.push({ onEvent: e => ev.push(e.type) });
  pairOfTwos(s);
  assert.equal(s.players[0].sets.length, 1);
  assert.deepEqual(ev, ['turn', 'peek', 'reveal', 'reveal', 'match'].slice(1));
});

test('redesign: a miss keeps both tiles up until End turn, then they flip back', () => {
  const s = off();
  Engine.peek(s, 0); Engine.flipOther(s, 7);
  assert.deepEqual(s.turn.revealed, [7]);
  Engine.endTurn(s);
  assert.equal(s.matchedCount, 0);
  assert.deepEqual(s.turn.revealed, []);
});

test('redesign: a peek does not spend the turn — you may end it, and the peeked tile stays secret', () => {
  const s = off();
  Engine.peek(s, 0);
  Engine.endTurn(s);                            // allowed (unlike the rulebook)
  assert.equal(s.current, 1);
});

test('redesign: bank is only offered while holding at least one set', () => {
  const s = off();
  assert.equal(Engine.canBank(s), false);
  assert.throws(() => Engine.bank(s));
});

const held = (...vals) => vals.map(v => (v === 16 ? { value: 16, gem: true, size: 3 } : { value: v, gem: false, size: 2 }));

test('redesign: bank takes ONE held set and scores the number on its fossil', () => {
  const s = off({ rolls: [6, 5, 3] });
  s.players[0].sets = held(7, 3);
  Engine.bank(s, 0);
  assert.equal(s.players[0].points, 7);
  assert.deepEqual(s.players[0].sets.map(x => x.value), [3], 'the other set stays in front of you');
  assert.deepEqual([s.lastBank.value, s.lastBank.base, s.lastBank.bonus, s.lastBank.setsLeft], [7, 7, 0, 1]);
});

test('redesign: you choose which set to bank', () => {
  const s = off({ rolls: [6, 5, 2] });
  s.players[0].sets = held(7, 3, 10);
  Engine.bank(s, 1);
  assert.equal(s.players[0].points, 3);
  assert.deepEqual(s.players[0].sets.map(x => x.value), [7, 10]);
  assert.throws(() => Engine.bank(off(), 0), /cannot bank/);
});

test('redesign: banking a gem set scores 16', () => {
  const s = off({ rolls: [6, 5, 1] });
  s.players[0].sets = held(16);
  Engine.bank(s, 0);
  assert.equal(s.players[0].points, 16);
});

test('redesign: after banking, a d6 chain — each 6 adds +1 and rolls again', () => {
  const s = off({ rolls: [6, 5, 6, 6, 2] });
  s.players[0].sets = held(5);
  Engine.bank(s, 0);
  assert.equal(s.players[0].points, 5 + 2);       // two 6s, then a 2
  assert.deepEqual(s.lastBank.rolls, [6, 6, 2]);
});

test('redesign: bank rejects a set that is not there', () => {
  const s = off({ rolls: [6, 5, 1] });
  s.players[0].sets = held(5);
  assert.throws(() => Engine.bank(s, 3), /no such set/);
});

test('redesign: bank takes the whole turn (and works right after a peek, which flips back secret)', () => {
  const s = off({ rolls: [6, 5, 1] });
  s.players[0].sets = [{ value: 2, gem: false, size: 2 }];
  Engine.peek(s, 0);
  assert.equal(Engine.canBank(s), true);
  Engine.bank(s);
  assert.equal(s.turn.peeked, null);
  assert.equal(s.phase, 'resolved');
  assert.throws(() => Engine.peek(s, 0));
  assert.throws(() => Engine.bank(s));
});

test('redesign: bank rules come from the data block (flat points, no bonus die)', () => {
  const d = JSON.parse(JSON.stringify(GAME_DATA));
  d.variants.redesign.scoring.setPoints = 5;
  d.variants.redesign.scoring.bonusDieSides = 0;
  const s = game({ system: false, data: d, rolls: [6, 5] });
  s.players[0].sets = held(9);
  Engine.bank(s, 0);
  assert.equal(s.players[0].points, 5);
  assert.deepEqual(s.lastBank.rolls, []);
});

test('redesign gems: peeked gem + public gem — reveal yours, then flip a third; all gems pop as one set', () => {
  const s = off();
  Engine.peek(s, 28); Engine.flipOther(s, 29);
  assert.equal(Engine.canFlipSecond(s), false, 'the third flip comes after revealing your own gem');
  Engine.flipOwn(s);
  assert.equal(s.phase, 'gemThird');
  assert.equal(Engine.canFlipSecond(s), true);
  Engine.flipSecond(s, 30);
  assert.equal(s.players[0].sets[0].size, 3);
  assert.equal(s.matchedCount, 3);
});

test('redesign gems: third tile not a gem — all flip back, nothing matched', () => {
  const s = off();
  Engine.peek(s, 28); Engine.flipOther(s, 29); Engine.flipOwn(s); Engine.flipSecond(s, 0);
  assert.equal(s.matchedCount, 0);
  assert.equal(s.phase, 'resolved');
});

test('redesign gems: declining (End turn) keeps the peeked gem private', () => {
  const s = off();
  Engine.peek(s, 28); Engine.flipOther(s, 29);
  assert.deepEqual(s.turn.revealed, [29]);
  Engine.endTurn(s);
  assert.equal(s.matchedCount, 0);
});

test('redesign end: the game ends the instant no face-down tiles remain; unbanked sets are lost', () => {
  const s = off();
  for (const t of s.tokens) if (t.id > 1) { t.matched = true; s.tokenAt[t.cell] = -1; }
  s.matchedCount = 29;
  s.players[0].sets = [{ value: 2, gem: false, size: 2 }];
  pairOfTwos(s);
  assert.equal(s.over, true);
  assert.equal(s.players[0].points, 0);
  assert.equal(s.result.standings[0].stranded, 2);
});

function ended(points, sets, lastPopper) {
  const s = off({ players: points.length });
  points.forEach((p, i) => { s.players[i].points = p; s.players[i].poppedSets = sets[i]; });
  s.lastPopper = lastPopper;
  return Engine.computeResult(s);
}

test('redesign tie-breaks: score, then sets popped, then who popped the final pair, then a draw', () => {
  assert.deepEqual(ended([5, 3], [1, 9], 1).winners, [0]);
  assert.deepEqual(ended([5, 5], [4, 6], 0).winners, [1]);
  assert.deepEqual(ended([5, 5], [6, 6], 1).winners, [1]);
  assert.deepEqual(ended([5, 5, 5], [6, 6, 6], 2).winners, [2]);
  assert.deepEqual(ended([5, 5, 2], [6, 6, 9], 2).winners, [0, 1]);   // final popper not among the tied: draw
});
