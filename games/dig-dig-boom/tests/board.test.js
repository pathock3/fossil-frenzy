// The Leaderboard and Crown Jewel for any number of players (Board engine): spots, dibs, pledges, the lead.
const test = require('node:test');
const assert = require('node:assert/strict');
const { Board } = require('./load.js');
const mk = (...ids) => Board.create(ids.map(id => ({ id, name: id, color: '#fff' })));

test('the Crown tracker starts at 3 and nobody holds the Crown until a score past it is locked in', () => {
  const b = mk('a');
  assert.equal(Board.tracker(b), 3); assert.equal(Board.holder(b), null);
  assert.deepEqual(Board.lockIn(b, 'a', 3), { rank: 1, tookLead: false, newBest: true }, 'level with the tracker is not the lead');
  assert.equal(Board.holder(b), null); assert.equal(Board.tracker(b), 3);
  const r = Board.lockIn(b, 'a', 4);
  assert.deepEqual(r, { rank: 1, tookLead: true, newBest: true }); assert.equal(Board.holder(b), 'a'); assert.equal(Board.tracker(b), 4);
  assert.equal(Board.marker(b, 'a', 'best').n, 4, 'your best marker moved up');
});

test('Pledge: only once you have reached the Crown, and only your current number or 1 more', () => {
  const b = mk('a');
  assert.ok(!Board.canPledge(b, 'a', 2, 3), 'not at the Crown yet');
  assert.ok(Board.canPledge(b, 'a', 3, 3) && Board.canPledge(b, 'a', 3, 4));
  assert.ok(!Board.canPledge(b, 'a', 3, 5) && !Board.canPledge(b, 'a', 3, 2));
  assert.ok(Board.pledge(b, 'a', 3, 4)); assert.deepEqual(Board.marker(b, 'a', 'pledge'), { n: 4, rank: 1, t: 1 });
  assert.ok(!Board.canPledge(b, 'a', 3, 4), 'already pledged 4');
  assert.ok(Board.pledge(b, 'a', 4, 5)); assert.equal(Board.marker(b, 'a', 'pledge').n, 5, 'a new pledge moves the marker');
});

test('Dibs: saying a number gets the next open spot, so ties go to whoever said it first, not whoever banked first', () => {
  const b = mk('a', 'b'); b.crownStart = 3;
  Board.pledge(b, 'a', 3, 4); Board.pledge(b, 'b', 3, 4);
  assert.equal(Board.marker(b, 'a', 'pledge').rank, 1); assert.equal(Board.marker(b, 'b', 'pledge').rank, 2);
  const rb = Board.lockIn(b, 'b', 4);                                     // b banks first, with the worse spot
  assert.deepEqual(rb, { rank: 2, tookLead: true, newBest: true }); assert.equal(Board.holder(b), 'b');
  const ra = Board.lockIn(b, 'a', 4);                                     // a banks later, but said it first
  assert.deepEqual(ra, { rank: 1, tookLead: true, newBest: true }); assert.equal(Board.holder(b), 'a', 'a steals the Crown back on the better spot');
  assert.equal(Board.tracker(b), 4);
});

test('an unpledged lock-in takes the best open spot at that moment', () => {
  const b = mk('a', 'b', 'c');
  Board.lockIn(b, 'a', 5); Board.lockIn(b, 'b', 5);
  assert.equal(Board.marker(b, 'a', 'best').rank, 1); assert.equal(Board.marker(b, 'b', 'best').rank, 2);
  Board.pledge(b, 'c', 5, 5); assert.equal(Board.marker(b, 'c', 'pledge').rank, 3);
  assert.equal(Board.holder(b), 'a');
});

test('BOOM: the Pledge marker is removed and its spot is free again; the best marker stays', () => {
  const b = mk('a', 'c');
  Board.lockIn(b, 'a', 4); Board.pledge(b, 'a', 4, 5); Board.pledge(b, 'c', 4, 5);
  assert.equal(Board.marker(b, 'c', 'pledge').rank, 2);
  Board.clearPledge(b, 'a');
  assert.equal(Board.marker(b, 'a', 'pledge'), null); assert.equal(Board.marker(b, 'a', 'best').n, 4);
  Board.pledge(b, 'c', 4, 4); Board.pledge(b, 'c', 4, 5); assert.equal(Board.marker(b, 'c', 'pledge').rank, 1, 'the freed first spot is the best open one');
});

test('the best marker only moves up: a lower bank keeps it, a higher one frees the old spot', () => {
  const b = mk('a', 'b');
  Board.lockIn(b, 'a', 5); Board.lockIn(b, 'a', 4);
  assert.equal(Board.marker(b, 'a', 'best').n, 5);
  Board.lockIn(b, 'a', 6); assert.equal(Board.marker(b, 'a', 'best').n, 6);
  Board.lockIn(b, 'b', 5); assert.equal(Board.marker(b, 'b', 'best').rank, 1, 'a left spot 1 under 5');
});

test('what it takes to be in the lead: past the tracker, or level with it on a better spot', () => {
  const b = mk('me', 'l');
  assert.equal(Board.leadN(b, 'me'), 4, 'nobody has locked in: beat the starting tracker (3)');
  Board.pledge(b, 'me', 5, 5); Board.pledge(b, 'l', 5, 5);               // I said "five" first
  Board.lockIn(b, 'l', 5);                                                // l banks 5 on the worse spot and leads
  assert.equal(Board.holder(b), 'l'); assert.equal(Board.tracker(b), 5);
  assert.ok(Board.wouldLead(b, 'me', 5), 'level at 5 but on the better spot');
  assert.equal(Board.leadN(b, 'me'), 5);
  Board.clearPledge(b, 'me'); assert.equal(Board.leadN(b, 'me'), 5, 'the first spot is open again, so locking in 5 takes it');
  const c = mk('me', 'l'); Board.lockIn(c, 'l', 5); assert.equal(Board.leadN(c, 'me'), 6, 'the leader holds the first spot under 5: I need 6');
  assert.equal(Board.leadN(b, 'l'), 5, 'the leader stays the leader at their own number');
});

test('six players: every marker finds a spot, and the order of claims is the order of ranks', () => {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f'], b = mk(...ids);
  ids.forEach(id => Board.lockIn(b, id, 5));
  assert.deepEqual(ids.map(id => Board.marker(b, id, 'best').rank), [1, 2, 3, 4, 5, 6]);
  assert.equal(Board.holder(b), 'a');
  ids.forEach(id => Board.pledge(b, id, 5, 6));
  assert.deepEqual(ids.map(id => Board.marker(b, id, 'pledge').rank), [1, 2, 3, 4, 5, 6]);
});
