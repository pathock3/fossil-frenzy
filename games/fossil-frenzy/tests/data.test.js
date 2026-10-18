const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { GAME_DATA, Engine, Bots, Campaign } = require('./load');
const { rolls } = require('./helpers');

// A different board, fossil set and point values — nothing in the engine, bots or campaign may assume the stock numbers.
const small = () => ({
  ...JSON.parse(JSON.stringify(GAME_DATA)),
  board: { shape: 'hex', radius: 2, removed: [[0, -2], [2, -2], [2, 0], [0, 2], [-2, 2], [-2, 0]] },
  tokens: [{ value: 1, count: 4 }, { value: 4, count: 6 }, { value: 20, count: 3, gem: true }],
});

test('data block: a smaller board with other fossils and a 20-point gem plays to the end', () => {
  for (const seed of [1, 2, 3]) {
    const s = Engine.createGame({ players: 3, seed, data: small() });
    assert.equal(s.tokens.length, 13);
    assert.equal(s.cells.length, 13);
    const bots = Bots.attach(s, [1, 1, 1].map(m => ({ memory: m })), seed);
    assert.ok(Bots.playGame(s, bots));
    assert.equal(s.matchedCount, 13);
  }
});

test('data block: the gem value is whatever the data says', () => {
  const s = Engine.createGame({ players: 2, data: small(), rng: rolls([6, 5, 1]) });
  const gems = s.tokens.filter(t => t.gem);
  assert.equal(gems.length, 3);
  assert.ok(gems.every(t => t.value === 20));
  const me = s.players[s.current];
  me.sets = [{ value: 20, gem: true, size: 3, ids: [] }];
  Engine.bank(s, 0);
  assert.equal(me.points, 20);
});

test('data block: player limits, die, fossil sets and tie-breaks live in GAME_DATA', () => {
  assert.deepEqual(GAME_DATA.players, { min: 2, max: 4 });
  assert.equal(GAME_DATA.die.sides, 6);
  assert.deepEqual(GAME_DATA.matching, { pairSize: 2, gemSetSize: 3 });
  assert.deepEqual(GAME_DATA.rules.tiebreaks, ['score', 'sets', 'finalPair']);
  assert.equal(GAME_DATA.rules.scoring.setPoints, 'tile-number');
});

test('data block: the campaign levels come from the data (a different list is honoured)', () => {
  const saved = GAME_DATA.campaign.levels;
  GAME_DATA.campaign.levels = [{ id: 'a', name: 'A', memory: 0.5, bankAt: 1, endgameTiles: 0 }, { id: 'b', name: 'B', memory: 0.9, bankAt: 1, endgameTiles: 0 }];
  try {
    assert.equal(Campaign.levels().length, 2);
    assert.equal(Campaign.isUnlocked(1, []), false);
    assert.equal(Campaign.isUnlocked(1, ['a']), true);
    assert.equal(Campaign.recordResult([], 0, true).newlyUnlocked, 'B');
  } finally { GAME_DATA.campaign.levels = saved; }
});

test('data block: the rule numbers are not hard-coded in the engine, bots or campaign source', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  for (const id of ['engine', 'bots', 'campaign']) {
    const code = html.match(new RegExp('<script id="' + id + '">([\\s\\S]*?)</script>'))[1];
    for (const re of [/\b31\b/, /\b37\b/, /\b16\b/, /\bsides\s*[:=]\s*6\b/, /Beginner|Master/]) assert.ok(!re.test(code), `${id} mentions ${re}`);
  }
});
