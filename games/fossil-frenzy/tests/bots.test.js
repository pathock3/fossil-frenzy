const test = require('node:test');
const assert = require('node:assert/strict');
const { GAME_DATA, Engine, Bots, Campaign } = require('./load');
const { game } = require('./helpers');

const playBotGame = (n, seed, specs) => {
  const s = Engine.createGame({ players: n, seed });
  const bots = Bots.attach(s, specs, seed);
  const done = Bots.playGame(s, bots);
  return { s, bots, done };
};
const mem = m => ({ memory: m });

test('bots finish complete games for 2-4 players at every memory level, without an illegal move', () => {
  for (let n = 2; n <= 4; n++) for (const m of [0, 0.5, 1]) {
    const { s, done } = playBotGame(n, 100 * n + Math.round(m * 10), Array(n).fill(mem(m)));
    assert.ok(done, `cap hit: n=${n} m=${m}`);
    assert.equal(s.matchedCount, 31);
    assert.ok(s.result.winners.length >= 1);
  }
});

test('every campaign level plays every other level to the end — no stalls, whatever the banking habits', () => {
  for (const a of GAME_DATA.campaign.levels) for (const b of GAME_DATA.campaign.levels) for (const seed of [1, 2]) {
    const { s, done } = playBotGame(2, seed, [Campaign.botSpec(a), Campaign.botSpec(b)]);
    assert.ok(done, `${a.name} vs ${b.name} seed ${seed} stalled`);
    assert.equal(s.matchedCount, 31);
  }
});

test('bot games are deterministic for a given seed', () => {
  const a = playBotGame(3, 77, [0.3, 0.6, 0.9].map(mem)).s, b = playBotGame(3, 77, [0.3, 0.6, 0.9].map(mem)).s;
  assert.equal(a.turnNo, b.turnNo);
  assert.deepEqual(a.result.standings, b.result.standings);
});

const eventBot = (memory, seed = 5) => Bots.create({ seat: 0, memory, rng: Engine.mulberry32(seed) });
const reveal = (tid, actor = 1) => ({ type: 'reveal', actor, tid, cell: tid, value: 5, gem: false, step: 'other' });

test('memory 1.0 remembers every revealed fossil; memory 0 remembers none', () => {
  const full = eventBot(1), none = eventBot(0);
  for (let t = 0; t < 20; t++) { full.onEvent(reveal(t)); none.onEvent(reveal(t)); }
  assert.equal(full.mem.size, 20);
  assert.equal(none.mem.size, 0);
});

test('memory p remembers each revealed fossil with probability p', () => {
  for (const p of [0.25, 0.5, 0.8]) {
    const b = eventBot(p, 9);
    const N = 4000;
    for (let t = 0; t < N; t++) b.onEvent(reveal(t));
    assert.ok(Math.abs(b.mem.size / N - p) < 0.03, `p=${p} got ${b.mem.size / N}`);
  }
});

test('bots never record other players\' private peeks, but do record their own', () => {
  const b = eventBot(1);
  b.onEvent({ type: 'peek', actor: 1, tid: 3, cell: 3, value: 7, gem: false });
  assert.equal(b.mem.size, 0);
  assert.equal(b.turnKnown.size, 0);
  b.onEvent({ type: 'peek', actor: 0, tid: 4, cell: 4, value: 7, gem: false });
  assert.equal(b.mem.get(4).value, 7);
});

test('bots forget fossils once they are matched (and what it saw this turn is exact even with memory 0)', () => {
  const b = eventBot(0);
  b.onEvent({ type: 'turn', actor: 0 });
  b.onEvent(reveal(2, 0));
  assert.equal(b.turnKnown.get(2).value, 5);
  assert.equal(b.mem.size, 0);
  const c = eventBot(1);
  c.onEvent(reveal(2)); c.onEvent({ type: 'match', actor: 1, tids: [2, 3], value: 5, gem: false });
  assert.equal(c.mem.size, 0);
});

test('bots decide only from the public view (hidden fossil values are absent from it)', () => {
  const s = Engine.createGame({ players: 2, seed: 3 });
  const bot = Bots.create({ seat: s.current, memory: 1, rng: Engine.mulberry32(1) });
  const v = Engine.publicView(s, s.current);
  assert.ok(v.tokens.every(t => !('value' in t)));
  assert.equal(bot.decide(v).type, 'peek');
});

test('a bot that knows where a pair is peeks one, flips the other and matches', () => {
  const s = game({ players: 2, rolls: [6, 5] });
  const bot = Bots.create({ seat: 0, memory: 1, rng: Engine.mulberry32(2) });
  s.observers.push(bot);
  bot.onEvent({ type: 'reveal', actor: 1, tid: 0, cell: 0, value: 2, gem: false, step: 'other' });
  bot.onEvent({ type: 'reveal', actor: 1, tid: 1, cell: 1, value: 2, gem: false, step: 'other' });
  for (let i = 0; i < 4 && s.current === 0; i++) Bots.step(s, bot);
  assert.equal(s.players[0].sets.length, 1);
  assert.equal(s.players[0].sets[0].value, 2);
});

test('a bot reveals a space on every turn unless it banked', () => {
  for (let g = 0; g < 30; g++) {
    const s = Engine.createGame({ players: 3, seed: 4000 + g });
    const bots = Bots.attach(s, [mem(0), mem(0.5), mem(1)], g);
    let reveals = 0, banked = false, turns = 0;
    const check = () => { if (turns) assert.ok(banked || reveals >= 1, 'a bot turn neither banked nor revealed a space'); };
    s.observers.push({ onEvent: e => {
      if (e.type === 'turn') { check(); reveals = 0; banked = false; turns++; }
      else if (e.type === 'reveal') reveals++;
      else if (e.type === 'bank') banked = true;
    } });
    while (!s.over) Bots.step(s, bots[s.current]);
    check();
  }
});

// ---- banking habits (these differ between campaign levels) ----
const nearEnd = (spec, setValues) => {                      // 4 fossils left (two pairs); the bot holds sets
  const s = game({ players: 2, rolls: [6, 5] });
  const keep = new Set([0, 1, 6, 7]);
  s.tokens.forEach(t => { if (!keep.has(t.id)) { t.matched = true; s.tokenAt[t.cell] = -1; } });
  s.matchedCount = 27;
  s.players[0].sets = setValues.map(v => ({ value: v, gem: false, size: 2 }));
  const bot = Bots.create({ seat: 0, memory: 1, rng: Engine.mulberry32(3), ...spec });
  return bot.decide(Engine.publicView(s, 0));
};

test('banking: a bot banks once it holds bankAt sets — one set, the most valuable', () => {
  const s = game({ players: 2, rolls: [6, 5, 2] });
  const bot = Bots.create({ seat: 0, memory: 1, bankAt: 2, endgameTiles: 0, rng: Engine.mulberry32(2) });
  s.players[0].sets = [{ value: 2, gem: false, size: 2 }, { value: 9, gem: false, size: 2 }];
  assert.equal(Bots.step(s, bot).type, 'bank');
  assert.equal(s.players[0].points, 9);
  assert.deepEqual(s.players[0].sets.map(x => x.value), [2]);
});

test('banking: below bankAt a bot keeps playing — unless the end of the game is near and it plans for it', () => {
  assert.equal(nearEnd({ bankAt: 3, endgameTiles: 0 }, [5]).type, 'peek', 'no endgame awareness: sits on its set');
  assert.equal(nearEnd({ bankAt: 3, endgameTiles: 4 }, [5]).type, 'bank', 'with 4 fossils left, a careful bot banks');
  assert.equal(nearEnd({ bankAt: 3, endgameTiles: 2 }, [5]).type, 'peek', '2-tile awareness does not trigger yet at 4 left');
  assert.equal(nearEnd({ bankAt: 3, endgameTiles: 0 }, [5, 3, 2]).type, 'bank', 'three sets in hand: bank');
});

test('better memory wins more: perfect memory beats no memory head-to-head', () => {
  let strong = 0;
  const N = 150;
  for (let g = 0; g < N; g++) {
    const { s } = playBotGame(2, 5000 + g, g % 2 ? [mem(1), mem(0)] : [mem(0), mem(1)]);
    const strongSeat = g % 2 ? 0 : 1;
    if (s.result.winners.length === 1 && s.result.winners[0] === strongSeat) strong++;
  }
  assert.ok(strong / N > 0.6, `perfect memory won only ${strong}/${N}`);
});

test('gem sets get matched in bot games (all three gems)', () => {
  let gemSets = 0;
  for (let g = 0; g < 40; g++) {
    const s = Engine.createGame({ players: 3, seed: 900 + g });
    const bots = Bots.attach(s, [mem(1), mem(1), mem(1)], g);
    s.observers.push({ onEvent: e => { if (e.type === 'match' && e.gem) gemSets++; } });
    Bots.playGame(s, bots);
  }
  assert.equal(gemSets, 40);
});
