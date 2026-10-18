const test = require('node:test');
const assert = require('node:assert/strict');
const { GAME_DATA, Engine } = require('./load');
const { game, rolls } = require('./helpers');

test('fossils: 31 — six 2s, six 3s, four 5s/6s/7s, two 9s/10s, three gems worth 12', () => {
  const s = game();
  assert.equal(s.tokens.length, 31);
  const count = v => s.tokens.filter(t => t.value === v && !t.gem).length;
  assert.deepEqual([2, 3, 5, 6, 7, 9, 10].map(count), [6, 6, 4, 4, 4, 2, 2]);
  const gems = s.tokens.filter(t => t.gem);
  assert.equal(gems.length, 3);
  assert.ok(gems.every(t => t.value === 12));
});

test('board: a hexagon of 31 spaces — the six corners are not part of the game', () => {
  const s = game();
  assert.equal(s.cells.length, 31);
  for (const [q, r] of GAME_DATA.board.removed) assert.ok(!s.cells.some(c => c.q === q && c.r === r), `corner ${q},${r} must be absent`);
  assert.ok(s.cells.every(c => Math.max(Math.abs(c.q), Math.abs(c.r), Math.abs(c.q + c.r)) <= 3));
});

test('setup: one face-down fossil on every space', () => {
  const s = game();
  for (const c of s.cells) assert.ok(s.tokenAt[c.id] >= 0);
  assert.equal(new Set(s.tokens.map(t => t.cell)).size, 31);
  assert.ok(s.tokens.every(t => !t.matched));
});

test('setup: there are no pieces and no movement — nothing about positions, sites or deliveries exists', () => {
  const s = game();
  for (const p of s.players) for (const k of ['pos', 'assign', 'stash']) assert.ok(!(k in p), `players have no ${k}`);
  for (const fn of ['move', 'availableMoves', 'deliver', 'canDeliver', 'peekable']) assert.equal(Engine[fn], undefined, `Engine.${fn} must not exist`);
  assert.equal(s.cells.some(c => 'site' in c || 'nbrs' in c), false);
  assert.equal('movementDeliverySystem' in GAME_DATA, false, 'there is no rule-set toggle');
  assert.equal('variants' in GAME_DATA, false);
});

test('setup: fossils are mixed (different seeds give different boards)', () => {
  const a = Engine.createGame({ players: 2, seed: 1 }).tokens.map(t => t.value).join();
  const b = Engine.createGame({ players: 2, seed: 2 }).tokens.map(t => t.value).join();
  assert.notEqual(a, b);
});

test('players: 2 to 4 people; 1 and 5 are rejected', () => {
  assert.deepEqual([GAME_DATA.players.min, GAME_DATA.players.max], [2, 4]);
  for (let n = 2; n <= 4; n++) assert.equal(Engine.createGame({ players: n, seed: n }).players.length, n);
  assert.throws(() => Engine.createGame({ players: 1 }));
  assert.throws(() => Engine.createGame({ players: 5 }));
  assert.throws(() => Engine.createGame({ players: 6 }));
});

test('setup: everyone rolls; the highest roller goes first and play continues clockwise (seat order)', () => {
  const s = game({ players: 4, rolls: [2, 6, 1, 4] });
  assert.deepEqual(s.players.map(p => p.roll), [2, 6, 1, 4]);
  assert.equal(s.current, 1);
  const order = [];
  for (let i = 0; i < 5; i++) { order.push(s.current); Engine.endTurn(s); }
  assert.deepEqual(order, [1, 2, 3, 0, 1]);
});

test('setup: a duplicate roll is re-rolled by whoever rolled it second', () => {
  const s = game({ players: 2, rolls: [3, 3, 5] });
  assert.deepEqual(s.players.map(p => p.roll), [3, 5]);
  assert.equal(s.current, 1);
});

test('data: fossil count must equal the number of spaces, and set sizes must divide counts', () => {
  const d = JSON.parse(JSON.stringify(GAME_DATA));
  d.tokens[0].count = 4;
  assert.throws(() => Engine.createGame({ players: 2, data: d }), /tiles for/);
  const e = JSON.parse(JSON.stringify(GAME_DATA));
  e.tokens[7].count = 2; e.tokens[0].count = 7;
  assert.throws(() => Engine.createGame({ players: 2, data: e }), /multiple/);
});

test('setup: a turn starts with the player free to peek or bank', () => {
  const s = game();
  assert.equal(s.phase, 'action');
  assert.equal(Engine.status(s).canPeek, true);
});
