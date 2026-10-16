const test = require('node:test');
const assert = require('node:assert/strict');
const { Engine } = require('./load');
const { game, rolls, place, stay, standOn } = require('./helpers');

// P0 stands at corner 6 with a set of 2s in hand; dice script: setup [6,5] then delivery rolls.
function withSet(deliveryRolls = [3], gem = false) {
  const s = game({ rolls: [6, 5, ...deliveryRolls] });
  const p = s.players[0];
  p.sets = [gem ? { value: 16, gem: true, size: 3, ids: [] } : { value: 2, gem: false, size: 2, ids: [] }];
  return s;
}

test('delivery: fossils in front of you are worth nothing until delivered', () => {
  const s = withSet();
  assert.equal(Engine.standings(s)[0].score, 0);
});

test('delivery: you can only deliver at your assigned research site (the corner matching your die)', () => {
  const s = withSet();
  s.players[0].assign = 2;                     // standing in corner 6, assigned to corner 2
  stay(s);
  assert.equal(Engine.canDeliver(s), false);
  assert.throws(() => Engine.deliver(s, 0));
});

test('delivery: at the assigned site you flip one fossil face down at face value and the match goes back in the box', () => {
  const s = withSet([3]);
  stay(s);                                      // already on corner 6 = assignment 6
  assert.equal(Engine.canDeliver(s), true);
  Engine.deliver(s, 0);
  assert.deepEqual(s.players[0].stash, [2]);    // 50% cut: one of the pair is kept
  assert.equal(s.box, 1);
  assert.equal(s.players[0].sets.length, 0);
  assert.equal(Engine.standings(s)[0].score, 2);
});

test('delivery: a gem set delivers as one 16-point gem; the other two go back in the box', () => {
  const s = withSet([3], true);
  stay(s); Engine.deliver(s, 0);
  assert.deepEqual(s.players[0].stash, [16]);
  assert.equal(s.box, 2);
});

test('delivery: after delivering you roll your die for the next assignment', () => {
  const s = withSet([3]);
  stay(s); Engine.deliver(s, 0);
  assert.equal(s.players[0].assign, 3);
});

test('delivery: you may only deliver one fossil at a time, but you choose which', () => {
  const s = withSet([6, 2]);                    // roll 6 again => may deposit again
  s.players[0].sets.push({ value: 11, gem: false, size: 2, ids: [] });
  stay(s);
  Engine.deliver(s, 1);                         // choose the 11s first
  assert.deepEqual(s.players[0].stash, [11]);
  assert.equal(s.players[0].sets.length, 1);
});

test('delivery: if you roll the number of the site you are at you may deposit again and roll again', () => {
  const s = withSet([6, 2]);
  s.players[0].sets.push({ value: 7, gem: false, size: 2, ids: [] });
  stay(s);
  Engine.deliver(s, 0);
  assert.equal(s.players[0].assign, 6);
  assert.equal(Engine.canDeliver(s), true);
  Engine.deliver(s, 0);
  assert.deepEqual(s.players[0].stash, [2, 7]);
  assert.equal(s.players[0].assign, 2);
  assert.equal(Engine.canDeliver(s), false);   // rolled a different number
});

test('delivery: after delivering you cannot move or peek until your next turn', () => {
  const s = withSet([3]);
  stay(s); Engine.deliver(s, 0);
  assert.throws(() => Engine.move(s, { to: s.players[0].pos }));
  assert.equal(Engine.status(s).canPeek, false);
  Engine.endTurn(s);
  assert.equal(s.phase, 'move');
});

test('delivery: you can move to your site and deliver in the same turn', () => {
  const s = withSet([3]);
  s.players[0].assign = 5;
  place(s, 1, s.siteCell[1]);                                    // move the other player out of corner 5
  place(s, 0, s.cells.find(c => c.q === -3 && c.r === 2).id);   // one space from corner 5
  Engine.move(s, { to: s.siteCell[5] });
  assert.equal(Engine.canDeliver(s), true);
  Engine.deliver(s, 0);
  assert.deepEqual(s.players[0].stash, [2]);
});

test('delivery: nothing to deliver means no delivery (and no die roll)', () => {
  const s = game({ rolls: [6, 5] });
  stay(s);
  assert.equal(Engine.canDeliver(s), false);
  assert.throws(() => Engine.deliver(s, 0));
});

test('delivery: you cannot peek and deliver in the same turn (corners hold no fossil)', () => {
  const s = withSet([3]);
  stay(s);
  assert.equal(Engine.status(s).canPeek, false);
  assert.equal(Engine.status(s).canDeliver, true);
});

test('delivery: a face-down delivered fossil is private — only its owner can look at their stash', () => {
  const s = withSet([3]); stay(s); Engine.deliver(s, 0);
  const mine = Engine.publicView(s, 0), theirs = Engine.publicView(s, 1);
  assert.deepEqual(mine.myStash, [2]);
  assert.deepEqual(theirs.myStash, []);
  assert.equal(theirs.players[0].stashCount, 1);
  assert.ok(!JSON.stringify(theirs.players).includes('"stash"'));
});
