const test = require('node:test');
const assert = require('node:assert/strict');
const { GAME_DATA, Engine } = require('./load');
const { game, rolls, layout, cellAt } = require('./helpers');

test('tile set: 31 tiles — six 2s, six 3s, four 5s/6s/7s, two 10s/11s, three gems worth 16', () => {
  const s = game();
  assert.equal(s.tokens.length, 31);
  const count = v => s.tokens.filter(t => t.value === v && !t.gem).length;
  assert.deepEqual([2, 3, 5, 6, 7, 10, 11].map(count), [6, 6, 4, 4, 4, 2, 2]);
  const gems = s.tokens.filter(t => t.gem);
  assert.equal(gems.length, 3);
  assert.ok(gems.every(t => t.value === 16));
});

test('board (system on): 37 spaces, six corner sites numbered 1-6 clockwise, 31 tile spaces', () => {
  const s = game();
  assert.equal(s.cells.length, 37);
  const sites = s.cells.filter(c => c.site);
  assert.deepEqual(sites.map(c => c.site).sort(), [1, 2, 3, 4, 5, 6]);
  assert.equal(s.cells.filter(c => !c.site).length, 31);
  // die face 1 = top-left corner, then clockwise
  assert.equal(s.siteCell[1], cellAt(s, 0, -3));
  assert.equal(s.siteCell[2], cellAt(s, 3, -3));
  assert.equal(s.siteCell[3], cellAt(s, 3, 0));
  assert.equal(s.siteCell[4], cellAt(s, 0, 3));
  assert.equal(s.siteCell[5], cellAt(s, -3, 3));
  assert.equal(s.siteCell[6], cellAt(s, -3, 0));
});

test('setup: one face-down tile on every space except the corners', () => {
  const s = game();
  for (const c of s.cells) {
    if (c.site) assert.equal(s.tokenAt[c.id], -1, 'corner must hold no tile');
    else assert.ok(s.tokenAt[c.id] >= 0, 'every non-corner space holds a tile');
  }
  assert.equal(new Set(s.tokens.map(t => t.cell)).size, 31);
  assert.ok(s.tokens.every(t => !t.matched));
});

test('setup: tiles are mixed (different seeds give different boards)', () => {
  const a = Engine.createGame({ players: 2, seed: 1 }).tokens.map(t => t.value).join();
  const b = Engine.createGame({ players: 2, seed: 2 }).tokens.map(t => t.value).join();
  assert.notEqual(a, b);
});

test('setup: each player rolls and starts in the corner matching their roll', () => {
  const s = game({ players: 3, rolls: [4, 1, 6] });
  assert.deepEqual(s.players.map(p => p.roll), [4, 1, 6]);
  assert.deepEqual(s.players.map(p => s.cells[p.pos].site), [4, 1, 6]);
});

test('setup: a duplicate roll is re-rolled by whoever rolled it second', () => {
  const s = game({ players: 2, rolls: [3, 3, 5] });
  assert.equal(s.players[0].roll, 3);
  assert.equal(s.players[1].roll, 5);
});

test('setup: all player counts 2-6 get distinct corners; 1 and 7 are rejected', () => {
  for (let n = 2; n <= 6; n++) {
    const s = Engine.createGame({ players: n, seed: n });
    assert.equal(new Set(s.players.map(p => p.pos)).size, n);
  }
  assert.throws(() => Engine.createGame({ players: 1 }));
  assert.throws(() => Engine.createGame({ players: 7 }));
});

test('setup: highest roller goes first and play continues clockwise (seat order)', () => {
  const s = game({ players: 4, rolls: [2, 6, 1, 4] });
  assert.equal(s.current, 1);
  const order = [];
  for (let i = 0; i < 5; i++) { order.push(s.current); Engine.move(s, { to: s.players[s.current].pos }); Engine.endTurn(s); }
  assert.deepEqual(order, [1, 2, 3, 0, 1]);
});

test('setup: your setup roll is also your first delivery assignment', () => {
  const s = game({ players: 2, rolls: [5, 2] });
  assert.deepEqual(s.players.map(p => p.assign), [5, 2]);
});

test('data: tile count must equal the number of spaces, and set sizes must divide counts', () => {
  const d = JSON.parse(JSON.stringify(GAME_DATA));
  d.tokens[0].count = 4;
  assert.throws(() => Engine.createGame({ players: 2, data: d }), /tiles for/);
  const e = JSON.parse(JSON.stringify(GAME_DATA));
  e.tokens[7].count = 2; e.tokens[0].count = 7;
  assert.throws(() => Engine.createGame({ players: 2, data: e }), /multiple/);
});

test('toggle: GAME_DATA.movementDeliverySystem selects the rule set; an option can override it', () => {
  assert.equal(typeof GAME_DATA.movementDeliverySystem, 'boolean');
  const d = JSON.parse(JSON.stringify(GAME_DATA));
  d.movementDeliverySystem = false;
  const off = Engine.createGame({ players: 2, seed: 3, data: d });
  assert.equal(off.system, false);
  assert.equal(off.cells.length, 31);
  assert.ok(off.cells.every(c => !c.site));
  assert.ok(off.players.every(p => p.pos === null && p.assign === null));
  d.movementDeliverySystem = true;
  assert.equal(Engine.createGame({ players: 2, seed: 3, data: d }).system, true);
  assert.equal(Engine.createGame({ players: 2, seed: 3, data: d, system: false }).system, false);
});

test('setup: first turn starts in the movement phase (on) or action phase (off)', () => {
  assert.equal(game().phase, 'move');
  assert.equal(game({ system: false }).phase, 'action');
});
