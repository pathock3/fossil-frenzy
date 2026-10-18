const test = require('node:test');
const assert = require('node:assert/strict');
const { GAME_DATA, Engine } = require('./load');
const { game } = require('./helpers');

const held = (...vals) => vals.map(v => (v === 12 ? { value: 12, gem: true, size: 3 } : { value: v, gem: false, size: 2 }));
const me = s => s.players[s.current];

test('bank: only while holding at least one set', () => {
  const s = game();
  assert.equal(Engine.canBank(s), false);
  assert.throws(() => Engine.bank(s), /cannot bank/);
});

test('bank: takes ONE held set and scores the number on its fossil', () => {
  const s = game({ rolls: [6, 5, 3] });
  me(s).sets = held(7, 3);
  Engine.bank(s, 0);
  assert.equal(me(s).points, 7);
  assert.deepEqual(me(s).sets.map(x => x.value), [3], 'the other set stays in front of you');
  assert.deepEqual([s.lastBank.value, s.lastBank.base, s.lastBank.bonus, s.lastBank.setsLeft], [7, 7, 0, 1]);
});

test('bank: you choose which set to bank', () => {
  const s = game({ rolls: [6, 5, 2] });
  me(s).sets = held(7, 3, 10);
  Engine.bank(s, 1);
  assert.equal(me(s).points, 3);
  assert.deepEqual(me(s).sets.map(x => x.value), [7, 10]);
  assert.throws(() => Engine.bank(s, 0), /cannot bank/, 'banking took the whole turn');
});

test('bank: a gem set scores 12', () => {
  const s = game({ rolls: [6, 5, 1] });
  me(s).sets = held(12);
  Engine.bank(s, 0);
  assert.equal(me(s).points, 12);
});

test('bank: afterwards a d6 chain — each 6 adds +1 and rolls again', () => {
  const s = game({ rolls: [6, 5, 6, 6, 2] });
  me(s).sets = held(5);
  Engine.bank(s, 0);
  assert.equal(me(s).points, 5 + 2);                // two 6s, then a 2
  assert.deepEqual(s.lastBank.rolls, [6, 6, 2]);
});

test('bank: rejects a set that is not there', () => {
  const s = game({ rolls: [6, 5, 1] });
  me(s).sets = held(5);
  assert.throws(() => Engine.bank(s, 3), /no such set/);
});

test('bank: takes the whole turn — and works right after a peek (the peeked fossil stays secret)', () => {
  const s = game({ rolls: [6, 5, 1] });
  me(s).sets = held(2);
  Engine.peek(s, 0);
  assert.equal(Engine.canBank(s), true);
  Engine.bank(s, 0);
  assert.equal(s.turn.peeked, null);
  assert.equal(s.phase, 'resolved');
  assert.throws(() => Engine.peek(s, 0));
});

test('bank: the banked sets are remembered for the end screen', () => {
  const s = game({ rolls: [6, 5, 6, 3] });
  me(s).sets = held(5);
  Engine.bank(s, 0);
  assert.deepEqual(me(s).banked, [{ value: 5, gem: false, base: 5, bonus: 1 }]);
});

test('bank: scoring comes from the data block (flat points, no bonus die)', () => {
  const d = JSON.parse(JSON.stringify(GAME_DATA));
  d.rules.scoring.setPoints = 5;
  d.rules.scoring.bonusDieSides = 0;
  const s = game({ data: d, rolls: [6, 5] });
  me(s).sets = held(9);
  Engine.bank(s, 0);
  assert.equal(me(s).points, 5);
  assert.deepEqual(s.lastBank.rolls, []);
});
