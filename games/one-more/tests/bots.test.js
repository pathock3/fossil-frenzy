const test = require('node:test');
const assert = require('node:assert/strict');
const { GAME_DATA, Engine, Bots } = require('./load');

const STYLES = GAME_DATA.styles.map(s => s.id);
// A hand-made public view (only the fields the game publishes).
const view = (o = {}) => ({ n: 2, me: 0, current: 0, phase: 'turn', over: false, turnNo: 0, gemTotal: 38, boomTotal: 6, race: true, target: 20,
  drawCount: 44, gemsInDraw: 38, boomsInDraw: 6, boomsOut: 0, table: 0, scores: [0, 0], ...o });
// 32 gems and 6 booms in the pile: a gem comes up 84% of the time.
const midPile = (o = {}) => view({ drawCount: 38, gemsInDraw: 32, boomsInDraw: 6, boomsOut: 0, ...o });

test('a computer with nothing drawn has to dig; with nothing to dig and gems drawn it saves', () => {
  for (const s of STYLES) {
    assert.equal(Bots.decide(view({ table: 0 }), s), 'draw');
    assert.equal(Bots.decide(view({ table: 3, drawCount: 0, gemsInDraw: 0, boomsInDraw: 0 }), s), 'save');
  }
});

test('a computer saves when only booms are left in the pile, and never digs into a certain boom', () => {
  for (const s of STYLES) assert.equal(Bots.decide(view({ table: 2, drawCount: 5, gemsInDraw: 0, boomsInDraw: 5, boomsOut: 1 }), s), 'save');
});

test('a computer digs on freely when there is no boom left to hit', () => {
  for (const s of STYLES) assert.equal(Bots.decide(view({ table: 9, drawCount: 12, gemsInDraw: 12, boomsInDraw: 0, boomsOut: 6 }), s), 'draw');
});

test('the policy: dig again while G/(G+B) beats g/(g+1) \u2014 on a pile that is 84% gems, steady digs at 5 gems and saves at 6', () => {
  const nr = { race: false, target: null, n: 3, scores: [0, 0, 0] };
  assert.equal(Bots.decide(midPile({ table: 5, ...nr }), 'steady'), 'draw');     // .842 > 5/6
  assert.equal(Bots.decide(midPile({ table: 6, ...nr }), 'steady'), 'save');     // .842 < 6/7
  assert.equal(Bots.decide(midPile({ table: 1, ...nr }), 'steady'), 'draw');
  // fewer gems in the pile makes everyone more cautious
  assert.equal(Bots.decide(view({ ...nr, table: 4, drawCount: 20, gemsInDraw: 14, boomsInDraw: 6, boomsOut: 0 }), 'steady'), 'save');
});

test('the three styles are different: the same hand, three different answers', () => {
  // 6 gems at risk, 32 gems and 6 booms in the pile (p = .842)
  const v = midPile({ table: 6, race: false, target: null, n: 3, scores: [0, 0, 0] });
  const answers = Object.fromEntries(STYLES.map(s => [s, Bots.decide(v, s)]));
  assert.deepEqual(answers, { careful: 'save', steady: 'save', daring: 'draw' });
  const w = midPile({ table: 5, race: false, target: null, n: 3, scores: [0, 0, 0] });
  assert.deepEqual(Object.fromEntries(STYLES.map(s => [s, Bots.decide(w, s)])), { careful: 'save', steady: 'draw', daring: 'draw' });
  const x = midPile({ table: 8, race: false, target: null, n: 3, scores: [0, 0, 0] });
  assert.deepEqual(Object.fromEntries(STYLES.map(s => [s, Bots.decide(x, s)])), { careful: 'save', steady: 'save', daring: 'save' });
});

test('the styles differ in how long they dig from a fresh pile (careful < steady < daring)', () => {
  const avg = style => {
    let total = 0, N = 400;
    for (let seed = 1; seed <= N; seed++) {
      const s = Engine.createGame({ players: 3, seed });
      let draws = 0;
      while (s.phase === 'turn') {
        if (Bots.decide(Engine.publicView(s, 0), style) === 'save') break;
        Engine.draw(s); draws++;
      }
      total += draws;
    }
    return total / N;
  };
  const [c, st, d] = STYLES.map(avg);
  assert.ok(c < st && st < d, `average digs ${c.toFixed(2)} < ${st.toFixed(2)} < ${d.toFixed(2)}`);
});

test('a two-player race: bolder when the other side is close to the target, calmer when it is far away', () => {
  const base = { table: 5, scores: [0, 0] };
  assert.equal(Bots.decide(midPile({ ...base, scores: [0, 10] }), 'steady'), 'draw', 'neutral: 5 gems, p .842 > 5/6');
  assert.equal(Bots.decide(midPile({ ...base, scores: [0, 5] }), 'steady'), 'save', 'the other side is far from 20: calmer');
  assert.equal(Bots.decide(midPile({ table: 6, scores: [0, 10] }), 'steady'), 'save', 'neutral at 6 gems');
  assert.equal(Bots.decide(midPile({ table: 6, scores: [0, 17] }), 'steady'), 'draw', 'the other side is on 17: take the risk');
  // not in a three-player game
  assert.equal(Bots.decide(midPile({ table: 6, race: false, target: null, n: 3, scores: [0, 17, 3] }), 'steady'), 'save');
});

test('saving that wins on the spot is always taken', () => {
  for (const s of STYLES) {
    assert.equal(Bots.decide(view({ table: 3, scores: [17, 4], drawCount: 30, gemsInDraw: 30, boomsInDraw: 0 }), s), 'save', 'reaches 20');
    assert.equal(Bots.decide(view({ n: 3, race: false, target: null, table: 4, scores: [20, 10, 4], drawCount: 6, gemsInDraw: 0, boomsInDraw: 6, boomsOut: 0 }), s), 'save', 'saves the last gems and leads');
  }
});

test('information discipline: only the public view goes in, and the answer does not change when the hidden order changes', () => {
  let checked = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const a = Engine.createGame({ players: 2 + (seed % 5), seed }), pick = Engine.mulberry32(seed);
    for (let i = 0; i < 80 && !a.over; i++) {
      if (a.phase === 'boomed') { Engine.endTurn(a); continue; }
      const b = JSON.parse(JSON.stringify(a));
      b.draw = Engine.shuffle(b.draw.slice(), Engine.mulberry32(seed + i));          // same cards, other order
      for (const style of STYLES) {
        assert.equal(Bots.decide(Engine.publicView(a, a.current), style), Bots.decide(Engine.publicView(b, b.current), style));
        checked++;
      }
      if (Engine.canSave(a) && (pick() < 0.3)) Engine.save(a); else Engine.draw(a);
    }
  }
  assert.ok(checked > 1000);
});

test('information discipline: the decision needs nothing beyond the documented public fields', () => {
  const s = Engine.createGame({ players: 3, seed: 8 });
  for (let i = 0; i < 4; i++) Engine.draw(s);
  const full = Engine.publicView(s, 0);
  const keys = ['me', 'table', 'scores', 'drawCount', 'gemsInDraw', 'boomsInDraw', 'gemTotal', 'race', 'target'];
  const slim = Object.fromEntries(keys.map(k => [k, full[k]]));
  for (const st of STYLES) assert.equal(Bots.decide(slim, st), Bots.decide(full, st));
  const src = require('./load').scriptText('bots'), decide = src.slice(src.indexOf('function decide'), src.indexOf('function create'));
  assert.doesNotMatch(decide.replace(/\/\/.*$/gm, ''), /Engine|\.draw\b|boomPile|\.safe\b|rng/, 'the decision never touches the game state itself');
});

test('a computer never stalls: every public view it could face gets a legal answer', () => {
  for (const style of STYLES) {
    for (let table = 0; table <= 12; table++) for (let G = 0; G <= 38; G += 2) for (let Bn = 0; Bn <= 6; Bn++) {
      for (const race of [true, false]) for (const opp of [0, 10, 19]) {
        const v = view({ table, drawCount: G + Bn, gemsInDraw: G, boomsInDraw: Bn, boomsOut: 6 - Bn, race, target: race ? 20 : null, n: race ? 2 : 3, scores: race ? [3, opp] : [3, opp, 1] });
        const a = Bots.decide(v, style);
        assert.ok(a === 'draw' || a === 'save');
        if (table === 0) assert.equal(a, 'draw'); else if (v.drawCount === 0) assert.equal(a, 'save');
      }
    }
  }
});

test('an unknown style falls back to the default instead of breaking', () => {
  assert.equal(Bots.styleOf('nope').id, GAME_DATA.bots.defaultStyle);
  assert.equal(Bots.decide(midPile({ table: 2 }), 'nope'), 'draw');
  assert.equal(Bots.create({ style: 'daring' }).style, 'daring');
  assert.equal(Bots.create({ style: 'daring' }).decide(midPile({ table: 2 })), 'draw');
});

test('whole games between computers finish at every seat count, 2 to 6', () => {
  for (const n of [2, 3, 4, 5, 6]) {
    for (let seed = 1; seed <= 12; seed++) {
      const styles = Array.from({ length: n }, (_, i) => STYLES[(i + seed) % 3]);
      const g = Bots.playGame({ styles, seed });
      assert.equal(g.state.over, true, `${n} players, seed ${seed}`);
      assert.ok(g.result.winners.length >= 1);
      const total = g.result.scores.reduce((a, b) => a + b, 0);
      if (g.result.reason === 'all-saved') assert.equal(total, 38);
      else assert.ok(Math.max(...g.result.scores) >= 20 && n === 2);
      assert.ok(g.steps < 5000, 'a sensible number of moves');
    }
  }
});

test('a computer-only game is deterministic from its seed', () => {
  const a = Bots.playGame({ styles: ['careful', 'steady', 'daring'], seed: 31 }), b = Bots.playGame({ styles: ['careful', 'steady', 'daring'], seed: 31 });
  assert.deepEqual(a.result, b.result);
  assert.equal(a.steps, b.steps);
});
