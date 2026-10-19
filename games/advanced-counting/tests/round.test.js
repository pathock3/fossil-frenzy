// Levels, the layout shuffle, the round state machine, time accounting, practice, and the card-layout helpers.
const test = require('node:test');
const assert = require('node:assert/strict');
const { GAME_DATA: D, Engine: E } = require('./load');

const sizes = { A: [2, 2], B: [2, 3], C: [3, 3], D: [3, 4], E: [4, 4], F: [4, 5], G: [5, 5], H: [5, 6], I: [6, 6], J: [6, 7], K: [7, 7], L: [7, 8], M: [8, 8] };
const round = (o = {}) => E.newRound({ levelIndex: 0, seed: 1, now: 0, ...o });
// tap the cards in the order of their numbers
const posOf = (r, n) => r.layout.indexOf(n);

test('levels: thirteen levels A-M with the specified grids and card counts', () => {
  assert.equal(E.levelCount(), 13);
  assert.deepEqual(E.levels.map(l => l.id), 'ABCDEFGHIJKLM'.split(''));
  for (const l of E.levels) {
    assert.deepEqual([l.rows, l.cols], sizes[l.id], l.id);
    assert.equal(l.count, sizes[l.id][0] * sizes[l.id][1]);
  }
  assert.equal(E.level(0).count, 4);       // level A: cards 1-4
  assert.equal(E.level(1).count, 6);       // level B: cards 1-6
  assert.equal(E.level(2).count, 9);       // level C: 3x3
  assert.equal(E.level(12).count, 64);     // level M: 8x8
});

test('levels: each level adds one row or column, and is a square whenever possible', () => {
  for (let i = 1; i < E.levelCount(); i++) {
    const a = E.level(i - 1), b = E.level(i);
    assert.ok((b.rows === a.rows && b.cols === a.cols + 1) || (b.cols === a.cols && b.rows === a.rows + 1), a.id + ' to ' + b.id + ' adds one row or column');
    assert.ok(b.cols - b.rows === 0 || b.cols - b.rows === 1, 'square or one column wider');
  }
  assert.throws(() => E.level(13)); assert.throws(() => E.level(-1));
});

test('layout: a deal holds every number 1..count exactly once, and the same seed deals the same layout', () => {
  for (const l of E.levels) {
    const lay = E.deal(l.index, E.mulberry32(7));
    assert.deepEqual(lay.slice().sort((a, b) => a - b), Array.from({ length: l.count }, (_, i) => i + 1));
    assert.deepEqual(lay, E.deal(l.index, E.mulberry32(7)));
  }
  assert.notDeepEqual(E.deal(12, E.mulberry32(1)), E.deal(12, E.mulberry32(2)));
});

test('layout: the shuffle is fair enough (every number lands in every position over many deals)', () => {
  const seen = Array.from({ length: 4 }, () => new Set());
  for (let s = 1; s < 200; s++) E.deal(0, E.mulberry32(s)).forEach((n, p) => seen[p].add(n));
  seen.forEach(set => assert.equal(set.size, 4));
});

test('round: dealt face up, studying; Flip turns every card face down and counting starts at 1', () => {
  const r = round();
  assert.equal(r.phase, 'study'); assert.ok(r.faceUp.every(Boolean)); assert.equal(E.primaryLabel(r), 'Flip');
  assert.equal(E.flip(r, 0), true);
  assert.equal(r.phase, 'recall'); assert.ok(r.faceUp.every(f => !f)); assert.equal(r.next, 1);
  assert.equal(E.primaryLabel(r), null, 'the button has nothing to do while counting');
  assert.equal(E.flip(r, 0), false, 'Flip does nothing mid-count');
});

test('round: taps in order 1..N complete the level; a correct tap leaves the card face up', () => {
  const r = round(); E.flip(r, 0);
  const n = r.def.count;
  for (let k = 1; k < n; k++) {
    const res = E.tapCard(r, posOf(r, k), 10);
    assert.equal(res.type, 'correct'); assert.equal(res.number, k);
    assert.equal(r.faceUp[posOf(r, k)], true);
    assert.equal(r.phase, 'recall');
  }
  const last = E.tapCard(r, posOf(r, n), 10);
  assert.equal(last.type, 'complete'); assert.equal(r.phase, 'done'); assert.ok(r.faceUp.every(Boolean));
  assert.equal(last.result.mistakes, 0); assert.equal(last.result.levelId, 'A');
  assert.equal(E.tapCard(r, 0, 11).type, 'ignored', 'nothing happens after completion');
});

test('retry rule: a wrong tap counts a mistake and re-deals the IDENTICAL layout face up; the count restarts at 1', () => {
  const r = round({ levelIndex: 4 }); E.flip(r, 0);
  const layout = r.layout.slice();
  E.tapCard(r, posOf(r, 1), 5); E.tapCard(r, posOf(r, 2), 5);
  const wrong = E.tapCard(r, posOf(r, 5), 5);      // 3 was next
  assert.equal(wrong.type, 'wrong'); assert.equal(r.mistakes, 1); assert.equal(r.tries, 2);
  assert.deepEqual(r.layout, layout, 'same cards in the same places');
  assert.ok(r.faceUp.every(Boolean), 'every card, including those already found, is face up again');
  assert.equal(r.phase, 'study'); assert.equal(r.next, 1); assert.equal(E.primaryLabel(r), 'Flip');
  assert.deepEqual(E.tapCard(r, 0, 6), { type: 'toggle', pos: 0, up: false }, 'while studying, a tap turns a card down (free flips, every round)');
  assert.deepEqual(E.tapCard(r, 0, 6), { type: 'toggle', pos: 0, up: true });
  assert.equal(r.mistakes, 1, 'free flips never count as mistakes'); assert.equal(r.phase, 'study');
  E.flip(r, 6);
  assert.ok(r.faceUp.every(f => !f), 'Flip starts the next try with everything face down');
  assert.equal(E.tapCard(r, posOf(r, 2), 7).type, 'wrong', 'the count restarted at 1: 2 is wrong now');
  assert.equal(r.mistakes, 2);
  assert.deepEqual(r.layout, layout);
});

test('retry rule: any number of retries keep the layout; only completing a level deals a new one', () => {
  const r = round({ levelIndex: 2, seed: 9 }); const layout = r.layout.slice();
  for (let t = 0; t < 5; t++) { E.flip(r, t); E.tapCard(r, posOf(r, 9), t); }
  assert.equal(r.mistakes, 5); assert.deepEqual(r.layout, layout);
  E.flip(r, 9); for (let k = 1; k <= 9; k++) E.tapCard(r, posOf(r, k), 9);
  assert.equal(r.phase, 'done');
  const next = round({ levelIndex: 3, seed: 10 });            // the next level is a fresh round with its own layout
  assert.equal(next.layout.length, 12); assert.equal(next.mistakes, 0); assert.ok(next.faceUp.every(Boolean));
});

test('round: tapping a card that is already face up does nothing (not a mistake)', () => {
  const r = round(); E.flip(r, 0);
  E.tapCard(r, posOf(r, 1), 1);
  assert.equal(E.tapCard(r, posOf(r, 1), 2).type, 'ignored'); assert.equal(r.mistakes, 0); assert.equal(r.next, 2);
  assert.equal(E.tapCard(r, 99, 2).type, 'ignored'); assert.equal(E.tapCard(r, -1, 2).type, 'ignored');
});

test('round: in the climb too, cards can be flipped freely while studying — then Flip turns everything down', () => {
  const r = round();
  assert.deepEqual(E.tapCard(r, 0, 1), { type: 'toggle', pos: 0, up: false });
  assert.deepEqual(E.tapCard(r, 1, 1), { type: 'toggle', pos: 1, up: false });
  assert.equal(r.faceUp[0] || r.faceUp[1], false);
  assert.equal(r.mistakes, 0, 'testing yourself before Flip costs nothing'); assert.equal(r.phase, 'study');
  assert.equal(E.isRunning(r), true, 'the climb clock keeps running while you study');
  E.flip(r, 2);
  assert.ok(r.faceUp.every(f => !f), 'Flip turns every card face down, including those already down');
  assert.equal(r.phase, 'recall'); assert.equal(r.next, 1);
});

test('time: a climb round counts from the moment it is dealt, through study and every retry, to the last correct tap', () => {
  const r = round({ now: 1000 });
  assert.equal(E.elapsed(r, 1000), 0);
  assert.equal(E.elapsed(r, 3500), 2500, 'study time counts');
  E.flip(r, 4000); E.tapCard(r, posOf(r, 3), 5000);          // a mistake
  assert.equal(E.elapsed(r, 6000), 5000, 'retries count');
  E.flip(r, 7000);
  for (let k = 1; k <= 4; k++) E.tapCard(r, posOf(r, k), 9000);
  assert.equal(r.timeMs, 8000);
  assert.equal(E.elapsed(r, 99999), 8000, 'the clock stopped on the last correct tap');
});

test('time: the results screen is excluded: a finished round never changes, and the next round starts its clock only when it is dealt', () => {
  const r = round({ now: 0 }); E.flip(r, 1000); for (let k = 1; k <= 4; k++) E.tapCard(r, posOf(r, k), 2000);
  assert.equal(r.timeMs, 2000);
  assert.equal(E.elapsed(r, 60 * 60 * 1000), 2000);          // an hour on the results screen
  const next = E.newRound({ levelIndex: 1, seed: 2, now: 3600000 });   // the OK tap
  assert.equal(E.elapsed(next, 3600000), 0);
  assert.equal(E.elapsed(next, 3601500), 1500);
});

test('time: pausing (Rules open, page hidden) stops the clock and resuming continues it', () => {
  const r = round({ now: 0 });
  E.pause(r, 1000); assert.equal(E.isRunning(r), false);
  assert.equal(E.elapsed(r, 50000), 1000);
  E.resume(r, 50000); assert.equal(E.elapsed(r, 51000), 2000);
  E.pause(r, 51000); E.pause(r, 52000); E.resume(r, 60000); E.resume(r, 61000);
  assert.equal(E.elapsed(r, 61500), 3500, 'double pause / resume are harmless');
  E.flip(r, 61500); for (let k = 1; k <= 4; k++) E.tapCard(r, posOf(r, k), 62000);
  assert.equal(r.timeMs, 4000);
});

test('time: times are kept to a tenth of a second', () => {
  const r = round({ now: 0 }); E.flip(r, 0); for (let k = 1; k <= 4; k++) E.tapCard(r, posOf(r, k), 1234);
  assert.equal(r.timeMs, 1200);
  assert.equal(D.time.resolutionMs, 100);
});

test('practice: dealt face up, the primary button reads Start, cards flip freely while looking', () => {
  const r = round({ levelIndex: 1, practice: true });
  assert.equal(E.primaryLabel(r), 'Start'); assert.ok(r.faceUp.every(Boolean));
  assert.equal(E.isRunning(r), false, 'the clock has not started');
  assert.deepEqual(E.tapCard(r, 2, 10), { type: 'toggle', pos: 2, up: false });
  assert.equal(r.faceUp[2], false);
  assert.deepEqual(E.tapCard(r, 2, 11), { type: 'toggle', pos: 2, up: true });
  assert.equal(r.mistakes, 0);
});

test('practice: Start begins a try (all face down) and starts the clock; wrong taps re-deal as in the climb', () => {
  const r = round({ levelIndex: 0, practice: true, now: 0 });
  assert.equal(E.elapsed(r, 5000), 0);
  E.tapCard(r, 0, 100);
  assert.equal(E.flip(r, 10000), true);
  assert.ok(r.faceUp.every(f => !f)); assert.equal(r.phase, 'recall');
  assert.equal(E.tapCard(r, posOf(r, 2), 11000).type, 'wrong');
  assert.equal(r.phase, 'study'); assert.equal(E.primaryLabel(r), 'Start'); assert.ok(r.faceUp.every(Boolean));
  E.flip(r, 12000); for (let k = 1; k <= 4; k++) E.tapCard(r, posOf(r, k), 14000);
  assert.equal(r.timeMs, 4000, 'practice time runs from the first Start, through the retry');
  const res = E.result(r); assert.equal(res.practice, true); assert.equal(res.mistakes, 1);
});

test('fitCards: the cards fill the space, never overflow it, and level A is not silly big', () => {
  for (const [w, h] of [[390, 640], [768, 800], [1024, 680], [320, 480], [1366, 900]]) {
    for (const l of E.levels) {
      const f = E.fitCards(l.rows, l.cols, w, h);
      assert.ok(f.w >= 1 && f.h >= 1);
      assert.ok(f.w * l.cols + f.gap * (l.cols - 1) <= w, `${l.id} ${w}x${h} too wide`);
      assert.ok(f.h * l.rows + f.gap * (l.rows - 1) <= h, `${l.id} ${w}x${h} too tall`);
      assert.ok(f.w <= D.layout.maxCardWidth);
    }
  }
  const big = E.fitCards(8, 8, 358, 640), small = E.fitCards(2, 2, 358, 640);
  assert.ok(big.w >= 38, '8x8 cards are big enough to read on a phone');
  assert.ok(small.w > big.w * 3);
  assert.equal(E.fitCards(8, 8, 358, 640).big, false); assert.equal(E.fitCards(2, 2, 358, 640).big, true);
});

test('waveDelays: spreads outward from the origin, never exceeds the cap, and zero at the origin', () => {
  for (const l of E.levels) {
    for (const origin of [0, l.count - 1, Math.floor(l.count / 2)]) {
      const d = E.waveDelays(l.rows, l.cols, origin);
      assert.equal(d.length, l.count); assert.equal(d[origin], 0);
      assert.ok(Math.max(...d) <= D.ui.staggerMaxMs);
    }
  }
  const d = E.waveDelays(3, 3, 4, 50, 1000);
  assert.ok(d[1] === d[3] && d[1] === d[5] && d[1] === d[7] && d[0] > d[1], 'ripple order');
});

test('chime: the pitch climbs with the card number, from the base note to the top of the scale', () => {
  for (const n of [4, 9, 25, 64]) {
    let prev = -1;
    for (let k = 1; k <= n; k++) { const s = E.chimeSemitones(k, n); assert.ok(s >= prev, 'never falls'); prev = s; }
    assert.equal(E.chimeSemitones(1, n), 0);
    assert.equal(E.chimeSemitones(n, n), D.chime.scale[D.chime.scale.length - 1]);
  }
  assert.ok(E.chimeSemitones(4, 4) > E.chimeSemitones(2, 4));
});
