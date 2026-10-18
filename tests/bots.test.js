const test = require('node:test');
const assert = require('node:assert/strict');
const { Engine, Bots } = require('./load');
const { game, standOn, stay } = require('./helpers');

const playBotGame = (system, n, seed, mems) => {
  const s = Engine.createGame({ players: n, system, seed });
  const bots = Bots.attach(s, mems.map(m => ({ memory: m })), seed);
  const done = Bots.playGame(s, bots);
  return { s, bots, done };
};

test('bots finish complete games in both modes for 2-6 players, at every memory level, without an illegal move', () => {
  for (const system of [true, false]) for (let n = 2; n <= 6; n++) for (const m of [0, 0.5, 1]) {
    const { s, done } = playBotGame(system, n, 100 * n + Math.round(m * 10), Array(n).fill(m));
    assert.ok(done, `cap hit: system=${system} n=${n} m=${m}`);
    assert.equal(s.matchedCount, 31);
    assert.ok(s.result.winners.length >= 1);
  }
});

test('bot games are deterministic for a given seed', () => {
  const a = playBotGame(true, 3, 77, [0.3, 0.6, 0.9]).s, b = playBotGame(true, 3, 77, [0.3, 0.6, 0.9]).s;
  assert.equal(a.turnNo, b.turnNo);
  assert.deepEqual(a.result.standings, b.result.standings);
});

function eventBot(memory, seed = 5) {
  return Bots.create({ seat: 0, memory, rng: Engine.mulberry32(seed) });
}
const reveal = (tid, actor = 1) => ({ type: 'reveal', actor, tid, cell: tid, value: 5, gem: false, step: 'other' });

test('memory 1.0 remembers every revealed tile; memory 0 remembers none', () => {
  const full = eventBot(1), none = eventBot(0);
  for (let t = 0; t < 20; t++) { full.onEvent(reveal(t)); none.onEvent(reveal(t)); }
  assert.equal(full.mem.size, 20);
  assert.equal(none.mem.size, 0);
});

test('memory p remembers each revealed tile with probability p', () => {
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

test('bots forget tiles once they are matched (and what it saw this turn is exact even with memory 0)', () => {
  const b = eventBot(0);
  b.onEvent({ type: 'turn', actor: 0 });
  b.onEvent(reveal(2, 0));
  assert.equal(b.turnKnown.get(2).value, 5);
  assert.equal(b.mem.size, 0);
  const c = eventBot(1);
  c.onEvent(reveal(2)); c.onEvent({ type: 'match', actor: 1, tids: [2, 3], value: 5, gem: false });
  assert.equal(c.mem.size, 0);
});

test('bots decide only from the public view (hidden tile values are absent from it)', () => {
  const s = Engine.createGame({ players: 2, seed: 3 });
  const bot = Bots.create({ seat: s.current, memory: 1, rng: Engine.mulberry32(1) });
  const v = Engine.publicView(s, s.current);
  assert.ok(v.tokens.every(t => !('value' in t)));
  assert.equal(bot.decide(v).type, 'move');
});

test('a bot that knows where a pair is goes and matches it (rulebook mode)', () => {
  const s = game({ players: 2, rolls: [6, 5] });
  const bot = Bots.create({ seat: 0, memory: 1, rng: Engine.mulberry32(2) });
  s.observers.push(bot);
  // bot has seen tiles 0 and 1 (both 2s) revealed earlier
  bot.onEvent({ type: 'reveal', actor: 1, tid: 0, cell: s.tokens[0].cell, value: 2, gem: false, step: 'other' });
  bot.onEvent({ type: 'reveal', actor: 1, tid: 1, cell: s.tokens[1].cell, value: 2, gem: false, step: 'other' });
  standOn(s, 0, 0);
  let guard = 0;
  while (s.current === 0 && s.players[0].sets.length === 0 && guard++ < 10) Bots.step(s, bot);
  assert.equal(s.players[0].sets.length, 1);
  assert.equal(s.players[0].sets[0].value, 2);
});

test('a bot with a pair in hand at its site delivers it', () => {
  const s = game({ players: 2, rolls: [6, 5, 3] });
  const bot = Bots.create({ seat: 0, memory: 1, rng: Engine.mulberry32(2) });
  s.players[0].sets = [{ value: 7, gem: false, size: 2, ids: [] }];
  Bots.step(s, bot);                 // move: stays (already at its site)
  const a = Bots.step(s, bot);
  assert.equal(a.type, 'deliver');
  assert.deepEqual(s.players[0].stash, [7]);
});

test('redesign: a bot banks once it holds bankAt sets — one set, the most valuable', () => {
  const s = game({ players: 2, system: false, rolls: [6, 5, 2] });
  const bot = Bots.create({ seat: 0, memory: 1, bankAt: 2, rng: Engine.mulberry32(2) });
  s.players[0].sets = [{ value: 2, gem: false, size: 2 }, { value: 9, gem: false, size: 2 }];
  assert.equal(Bots.step(s, bot).type, 'bank');
  assert.equal(s.players[0].points, 9);
  assert.deepEqual(s.players[0].sets.map(x => x.value), [2]);
});

test('redesign: a bot reveals a space on every turn unless it banked', () => {
  for (let g = 0; g < 30; g++) {
    const s = Engine.createGame({ players: 3, system: false, seed: 4000 + g });
    const bots = Bots.attach(s, [0, 0.5, 1].map(m => ({ memory: m })), g);
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

test('better memory wins more: perfect memory beats no memory head-to-head, in both modes', () => {
  for (const system of [true, false]) {
    let strong = 0;
    const N = 150;
    for (let g = 0; g < N; g++) {
      const { s } = playBotGame(system, 2, 5000 + g, g % 2 ? [1, 0] : [0, 1]);
      const strongSeat = g % 2 ? 0 : 1;
      if (s.result.winners.length === 1 && s.result.winners[0] === strongSeat) strong++;
    }
    assert.ok(strong / N > 0.6, `system=${system}: perfect memory won only ${strong}/${N}`);
  }
});

test('gem sets get matched in bot games (all three gems, both modes)', () => {
  for (const system of [true, false]) {
    let gemSets = 0;
    for (let g = 0; g < 40; g++) {
      const s = Engine.createGame({ players: 3, system, seed: 900 + g });
      const bots = Bots.attach(s, [1, 1, 1].map(m => ({ memory: m })), g);
      s.observers.push({ onEvent: e => { if (e.type === 'match' && e.gem) gemSets++; } });
      Bots.playGame(s, bots);
    }
    assert.equal(gemSets, 40);
  }
});
