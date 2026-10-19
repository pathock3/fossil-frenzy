// The perfect opponent and the abilities that make the easier ones easier (see docs/AI.md).
const test = require('node:test');
const assert = require('node:assert/strict');
const { GAME_DATA, Engine, Bots } = require('./load');
const { position, lateGame } = require('./helpers');

const EXPERT = GAME_DATA.ai.profiles.expert;
const LEVELS = GAME_DATA.campaign.levels.map(l => l.ai);
const BLIND = { ...EXPERT, valueSense: 0, leadSense: 0, endSense: 0, setsSense: 0 };
const util = (w, kind, value) => { const p = w.plans.find(x => x.kind === kind && (value === undefined || x.value === value)); return p ? p.u : -Infinity; };
const best = w => w.plans[0];
const pairOf = v => [{ tid: 20, value: v, pub: true }, { tid: 21, value: v, pub: true }];

// ---------------------------------------------------------------- the perfect player's judgement
test('perfect AI: it does not rush to bank — early in the game a held set (even a high one) waits while exploring is worth more', () => {
  assert.equal(best(position({ held: [[2], []] }).weigh()).kind, 'explore');
  assert.equal(best(position({ held: [[9], []] }).weigh()).kind, 'explore');
});

test('perfect AI: as the game nears its end it banks — and banks the most valuable set first', () => {
  const w = position({ matched: lateGame([[7], [6], [9]]), held: [[7, 3], []], points: [10, 10] }).weigh();
  assert.equal(best(w).kind, 'bank');
  assert.equal(best(w).value, 7);
});

test('perfect AI: a set\'s worth to it follows its number — a public pair of 9s is taken at once, a pair of 2s is left while there is better to do', () => {
  const low = position({ known: pairOf(2) }).weigh(), high = position({ known: pairOf(9) }).weigh();
  assert.equal(best(high).kind, 'match');
  assert.equal(best(high).value, 9);
  assert.equal(best(low).kind, 'explore', 'just because it can make a match of two 2s does not mean it will');
  assert.ok(util(high, 'match') - util(high, 'explore') > util(low, 'match') - util(low, 'explore') + 3, 'the higher the set, the more it wants it');
});

test('perfect AI: it knows which sets are still on the board (and so how long the game has left)', () => {
  const w = position({ matched: lateGame([[7], [6], [9]]) }).weigh();
  assert.deepEqual(w.sets.slice().sort((a, b) => a - b), [6, 7, 9]);
  const early = position().weigh();
  assert.equal(early.sets.length, 15);
  assert.ok(w.E < early.E / 3, 'far fewer turns left late in the game');
});

test('perfect AI: it never plans on the value of a fossil it has not seen (it plays from the public view and its own peeks)', () => {
  const p = position({ known: [{ tid: 0, value: 9, pub: true }] });
  const before = JSON.stringify(p.weigh());
  p.s.tokens[5].value = 10; p.s.tokens[6].value = 2;                        // change hidden fossils behind its back
  assert.equal(JSON.stringify(p.weigh()), before);
});

// ---------------------------------------------------------------- what the easier opponents lack
test('easier AI: with no feel for set values every set looks the same — it takes a pair of 2s as eagerly as a pair of 9s', () => {
  const low = position({ known: pairOf(2), profile: BLIND }).weigh(), high = position({ known: pairOf(9), profile: BLIND }).weigh();
  assert.equal(util(low, 'match'), util(high, 'match'));
  assert.equal(best(low).kind, 'match', 'and it takes the 2s');
});

test('easier AI: with no sense of the game ending it thinks there is plenty of time, where the perfect AI sees the end coming', () => {
  const pos = { matched: lateGame([[7], [6], [9]]), held: [[7, 3], []], points: [10, 10] };
  const wise = position(pos).weigh(), blind = position({ ...pos, profile: BLIND }).weigh();
  assert.ok(blind.E > wise.E * 2, `blind E=${blind.E} wise E=${wise.E}`);
  assert.equal(best(wise).kind, 'bank', 'seeing the end coming, it banks');
});

test('easier AI: not tracking the sets means it guesses what is left from the number of fossils on the board', () => {
  const blind = position({ matched: lateGame([[7], [6], [9]]), profile: BLIND }).weigh();
  assert.notDeepEqual(blind.sets.slice().sort((a, b) => a - b), [6, 7, 9]);
});

test('levels: the five opponents\' abilities never go down from one level to the next', () => {
  for (const key of ['memory', 'valueSense', 'leadSense', 'endSense', 'setsSense']) {
    for (let i = 1; i < LEVELS.length; i++) assert.ok(LEVELS[i][key] >= LEVELS[i - 1][key], `${key} drops at level ${i + 1}`);
  }
  assert.deepEqual(Object.keys(EXPERT).sort(), ['endSense', 'leadSense', 'memory', 'setsSense', 'valueSense']);
  assert.ok(Object.values(EXPERT).every(x => x === 1), 'the perfect AI has every ability at 1');
});

// ---------------------------------------------------------------- strength follows ability (fixed seeds: deterministic)
function share(a, b, N = 300, seed0 = 8000) {
  let w = 0;
  for (let i = 0; i < N; i++) {
    const flip = i % 2, specs = flip ? [b, a] : [a, b];
    const s = Engine.createGame({ players: 2, seed: seed0 + i });
    Bots.playGame(s, Bots.attach(s, specs, seed0 + i));
    w += s.result.winners.length > 1 ? 0.5 : s.result.winners[0] === (flip ? 1 : 0) ? 1 : 0;
  }
  return w / N;
}

test('strength: the perfect AI beats the same AI with worse memory, and beats one with no sense of the end of the game', () => {
  assert.ok(share(EXPERT, { ...EXPERT, memory: 0.9 }) > 0.8);
  assert.ok(share(EXPERT, { ...EXPERT, endSense: 0, bankAt: 3 }) > 0.5, 'knowing when the game is ending is worth something');
});

test('strength: each campaign level beats the one before it, and Master beats Beginner every time', () => {
  for (let i = 1; i < LEVELS.length; i++) assert.ok(share(LEVELS[i], LEVELS[i - 1]) > 0.55, `${GAME_DATA.campaign.levels[i].name} should beat ${GAME_DATA.campaign.levels[i - 1].name}`);
  assert.ok(share(LEVELS[4], LEVELS[0]) > 0.9);
});
