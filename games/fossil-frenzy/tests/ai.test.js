// The perfect opponent and the abilities that make the easier ones easier (see docs/AI.md).
const test = require('node:test');
const assert = require('node:assert/strict');
const { GAME_DATA, Engine, Bots } = require('./load');
const { game, position, lateGame } = require('./helpers');

const EXPERT = GAME_DATA.ai.profiles.expert;
const LEVELS = GAME_DATA.campaign.levels.map(l => l.ai);
const BLIND = { ...EXPERT, valueSense: 0, leadSense: 0, endSense: 0, setsSense: 0 };
const util = (w, kind, value) => { const p = w.plans.find(x => x.kind === kind && (value === undefined || x.value === value)); return p ? p.u : -Infinity; };
const best = w => w.plans[0];
const pairOf = v => [{ tid: 20, value: v, pub: true }, { tid: 21, value: v, pub: true }];

// ---------------------------------------------------------------- the perfect player's judgement
test('perfect AI: early in the game banking is the default move — it banks a good set — but a low set may not be worth the turn', () => {
  for (const v of [5, 7, 9]) assert.equal(best(position({ held: [[v], []] }).weigh()).kind, 'bank', `holding a ${v}`);
  assert.equal(best(position({ held: [[2], []] }).weigh()).kind, 'explore', 'a 2 is not worth a turn');
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
  assert.equal(best(position({ known: pairOf(5) }).weigh()).kind, 'match', 'but a set worth having is the default');
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

// ---------------------------------------------------------------- the human-like imperfections
const aged = (profile, turns) => {
  const p = position({ known: pairOf(7), profile });
  for (let i = 0; i < turns; i++) p.bot.onEvent({ type: 'turn', actor: 1 });
  return p;
};

test('overconfidence: a bot with a fading memory that is realistic about it explores rather than trust an old memory; an overconfident one goes for the match', () => {
  const faded = { ...EXPERT, memory: 0.8 };
  const calm = aged({ ...faded, overconfidence: 0 }, 8).weigh(), rash = aged({ ...faded, overconfidence: 10 }, 8).weigh();
  assert.equal(best(calm).kind, 'explore', 'a pair it saw 8 turns ago is mostly a guess: it looks for something surer');
  assert.equal(best(rash).kind, 'match', 'the overconfident bot is sure it remembers');
  assert.equal(best(aged({ ...faded, overconfidence: 0 }, 0).weigh()).kind, 'match', 'a fresh memory is trusted by everyone');
});

test('overconfidence: going for a match it cannot reliably make, it often taps the wrong spot', () => {
  const p = aged({ ...EXPERT, memory: 0.8, overconfidence: 10 }, 8);
  let right = 0, N = 1500;
  for (let i = 0; i < N; i++) { const a = p.decide(); if (a.type === 'peek' && a.tid === 20) right++; }
  assert.ok(right / N < 0.3, `right ${right / N}`);
});

test('gems: a bot with no feel for them always goes for the third gem; the perfect AI only does when it knows where it is', () => {
  const two = [{ tid: 28, value: 12, gem: true, pub: true }, { tid: 29, value: 12, gem: true, pub: true }];
  assert.equal(best(position({ known: two, profile: { ...EXPERT, gemSense: 0 } }).weigh()).kind, 'gamble');
  assert.notEqual(best(position({ known: two }).weigh()).kind, 'gamble', 'the perfect AI would be giving two gems away');
  const three = two.concat([{ tid: 30, value: 12, gem: true, pub: true }]);
  assert.equal(best(position({ known: three }).weigh()).kind, 'match', 'it takes the gem set when it knows all three');
  // in the middle of a turn: it has peeked a gem and flipped a gem — does it go on?
  const turn = profile => {
    const s = game({ players: 2, rolls: [6, 5] });
    const bot = Bots.create({ seat: 0, profile, rng: Engine.mulberry32(2) });
    s.observers.push(bot);
    Engine.peek(s, 28); Engine.flipOther(s, 29);
    return bot.decide(Engine.publicView(s, 0)).type;
  };
  assert.equal(turn({ ...EXPERT, gemSense: 0 }), 'flipOwn', 'two gems found: go for the third');
  assert.equal(turn(EXPERT), 'endTurn', 'the perfect AI keeps the two positions to itself');
});

test('mistakes: a bot with a mistake rate plays a random move that often instead of the best one', () => {
  const rate = m => {
    const p = position({ held: [[9], []], profile: { ...EXPERT, mistakes: m } });
    let banked = 0, N = 2000;
    for (let i = 0; i < N; i++) if (p.decide().type === 'bank') banked++;
    return banked / N;
  };
  assert.equal(rate(0), 1, 'the best move here is to bank');
  assert.ok(Math.abs(rate(0.3) - 0.7) < 0.04);
  assert.ok(rate(1) < 0.01, 'a bot that only makes mistakes never banks on purpose');
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
  for (const key of ['memory', 'valueSense', 'leadSense', 'endSense', 'setsSense', 'gemSense']) {
    for (let i = 1; i < LEVELS.length; i++) assert.ok(LEVELS[i][key] >= LEVELS[i - 1][key], `${key} drops at level ${i + 1}`);
  }
  for (const key of ['overconfidence', 'mistakes']) {
    for (let i = 1; i < LEVELS.length; i++) assert.ok(LEVELS[i][key] <= LEVELS[i - 1][key], `${key} rises at level ${i + 1}`);
  }
  assert.deepEqual(Object.keys(EXPERT).sort(), ['endSense', 'gemSense', 'leadSense', 'memory', 'mistakes', 'overconfidence', 'setsSense', 'valueSense']);
  for (const k of ['valueSense', 'leadSense', 'endSense', 'setsSense', 'gemSense']) assert.equal(EXPERT[k], 10, k);
  assert.deepEqual([EXPERT.memory, EXPERT.overconfidence, EXPERT.mistakes], [1, 0, 0], 'the perfect AI never forgets, is never overconfident, never slips');
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
