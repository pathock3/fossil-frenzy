const test = require('node:test');
const assert = require('node:assert/strict');
const { GAME_DATA, Engine, Bots } = require('./load');

const snapshot = s => JSON.stringify(Engine.standings(s)) + '|' + s.turnNo + '|' + s.matchedCount;

// Plays a bot game; at action number `cutAt`, saves, throws everything away and carries on from the JSON.
function play({ seed, cutAt, memories = [2, 6, 10], endSenses = [0, 2, 10] }) {
  let s = Engine.createGame({ players: 3, seed });
  let bots = Bots.attach(s, memories.map((m, i) => ({ ...GAME_DATA.ai.profiles.expert, memory: m, endSense: endSenses[i], focus: 8 })), seed);
  for (let i = 0; !s.over; i++) {
    if (i === cutAt) {
      const json = JSON.stringify({ game: Engine.serialize(s), bots: bots.map(b => b.save()) });   // → localStorage
      const back = JSON.parse(json);
      s = Engine.restore(back.game);
      bots = Bots.restore(s, back.bots);
    }
    Bots.step(s, bots[s.current]);
  }
  return s;
}

test('save: a game restored at any point finishes exactly like one that was never interrupted', () => {
  for (const seed of [11, 12, 13]) {
    const straight = play({ seed, cutAt: -1 });
    for (const cutAt of [0, 1, 2, 3, 7, 20, 55, 90]) {
      const resumed = play({ seed, cutAt });
      assert.equal(snapshot(resumed), snapshot(straight), `seed=${seed} cut=${cutAt}`);
      assert.deepEqual(resumed.result.winners, straight.result.winners);
    }
  }
});

test('save: the snapshot is plain JSON that survives a round trip, mid-turn included', () => {
  const s = Engine.createGame({ players: 2, seed: 5 });
  Engine.peek(s, 3);
  const saved = Engine.serialize(s);
  assert.deepEqual(JSON.parse(JSON.stringify(saved)), saved);
  const r = Engine.restore(JSON.parse(JSON.stringify(saved)));
  assert.equal(r.phase, 'peeked');
  assert.equal(r.turn.peeked, 3);
  Engine.flipOther(r, 4);                          // the restored game accepts the next action
  assert.equal(r.phase, 'flipped');
});

test('save: players, held sets, points and banked sets are all kept', () => {
  const s = Engine.createGame({ players: 2, seed: 6 });
  const me = s.players[s.current];
  me.sets = [{ value: 7, gem: false, size: 2, ids: [] }];
  Engine.bank(s, 0);
  const r = Engine.restore(JSON.parse(JSON.stringify(Engine.serialize(s))));
  assert.equal(r.players[s.current].points, me.points);
  assert.deepEqual(r.players[s.current].banked, me.banked);
  assert.equal(r.players[s.current].banked[0].value, 7);
});

test('save: a save made under other rules is refused, not resumed', () => {
  const s = Engine.createGame({ players: 2, seed: 7 });
  const saved = Engine.serialize(s);
  const d = JSON.parse(JSON.stringify(GAME_DATA));
  d.rules.scoring.setPoints = 5;
  assert.throws(() => Engine.restore(saved, { data: d }), /rules changed/);
  assert.throws(() => Engine.restore({ ...saved, schema: 1 }), /unknown save format/, 'saves from the old two-rule-set version are not resumed');
  assert.throws(() => Engine.restore(null), /unknown save format/);
});

test('save: only games in progress with a saveable RNG can be saved', () => {
  const custom = Engine.createGame({ players: 2, rng: () => 0.5 });
  assert.throws(() => Engine.serialize(custom), /cannot be saved/);
  const s = Engine.createGame({ players: 2, seed: 8 });
  const bots = Bots.attach(s, ['expert', 'expert'], 8);
  Bots.playGame(s, bots);
  assert.throws(() => Engine.serialize(s), /finished/);
});

test('save: a bot keeps what it remembers, which sets are gone, how old its memories are, and its settings across a restore', () => {
  const s = Engine.createGame({ players: 2, seed: 9 });
  const profile = { ...GAME_DATA.ai.profiles.expert, memory: 7, endSense: 2 };
  const bots = Bots.attach(s, [profile, null], 9);
  bots[0].onEvent({ type: 'reveal', actor: 1, tid: 4, cell: 4, value: 5, gem: false, step: 'other' });
  bots[0].onEvent({ type: 'turn', actor: 1 }); bots[0].onEvent({ type: 'turn', actor: 0 });
  bots[0].onEvent({ type: 'match', actor: 1, tids: [8, 9], value: 3, gem: false });
  const back = JSON.parse(JSON.stringify(bots.map(b => (b ? b.save() : null))));
  const s2 = Engine.restore(JSON.parse(JSON.stringify(Engine.serialize(s))));
  const bots2 = Bots.restore(s2, back);
  assert.equal(bots2[0].facts.get(4).value, 5);
  assert.equal(bots2[0].turnIx, 2, 'its memories keep their age');
  assert.equal(bots2[0].gone.n3, 2);
  assert.deepEqual([bots2[0].profile.memory, bots2[0].profile.endSense], [7, 2]);
  assert.equal(bots2[1], null, 'human seats stay human');
  assert.equal(s2.observers.length, 1);
  assert.throws(() => Bots.restore(s2, [{ v: 2, seat: 0, memory: 1, mem: [] }]), /unknown bot save format/, 'a bot saved by an older version is not resumed');
});
