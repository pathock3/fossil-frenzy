const test = require('node:test');
const assert = require('node:assert/strict');
const { GAME_DATA, Engine, Bots } = require('./load');
const { game, rolls, layout, stay } = require('./helpers');

// A different board, tile set and point values — nothing in the engine, bots or tests above may assume the stock numbers.
const small = () => ({
  ...JSON.parse(JSON.stringify(GAME_DATA)),
  board: { shape: 'hex', radius: 2, corners: [[0, -2], [2, -2], [2, 0], [0, 2], [-2, 2], [-2, 0]] },
  tokens: [{ value: 1, count: 4 }, { value: 4, count: 6 }, { value: 20, count: 3, gem: true }],
});

test('data block: a smaller board with other tiles and a 20-point gem plays to the end in both modes', () => {
  for (const system of [true, false]) for (const seed of [1, 2, 3]) {
    const s = Engine.createGame({ players: 3, system, seed, data: small() });
    assert.equal(s.tokens.length, 13);
    assert.equal(s.cells.length, system ? 19 : 13);
    const bots = Bots.attach(s, [1, 1, 1].map(m => ({ memory: m })), seed);
    assert.ok(Bots.playGame(s, bots));
    assert.equal(s.matchedCount, 13);
  }
});

test('data block: the gem value is whatever the data says', () => {
  const d = small();
  const s = Engine.createGame({ players: 2, system: true, data: d, rng: rolls([6, 5, 3]) });
  const gems = s.tokens.filter(t => t.gem);
  assert.equal(gems.length, 3);
  assert.ok(gems.every(t => t.value === 20));
  const p = s.players[0];
  p.sets = [{ value: 20, gem: true, size: 3, ids: [] }];
  p.pos = s.siteCell[p.assign];
  Engine.move(s, { to: p.pos });
  Engine.deliver(s, 0);
  assert.equal(Engine.standings(s)[0].score, 20);
});

test('data block: die size, pair size and the toggle default all live in GAME_DATA', () => {
  assert.equal(GAME_DATA.die.sides, 6);
  assert.equal(GAME_DATA.matching.pairSize, 2);
  assert.equal(GAME_DATA.matching.gemSetSize, 3);
  assert.equal(typeof GAME_DATA.movementDeliverySystem, 'boolean');
  assert.ok(GAME_DATA.variants.delivery && GAME_DATA.variants.redesign);
});

test('data block: the rulebook numbers are not hard-coded in the engine source', () => {
  const html = require('fs').readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
  const engine = html.match(/<script id="engine">([\s\S]*?)<\/script>/)[1];
  // tile values, set sizes, step limits, point values: all must come from the data block
  for (const re of [/\b31\b/, /\b37\b/, /\b16\b/, /maxSteps\s*[:=]\s*3/, /\bsides\s*[:=]\s*6\b/]) assert.ok(!re.test(engine), 'engine mentions ' + re);
});
