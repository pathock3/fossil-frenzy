// Records, NEW RECORD badges, profiles, persistence, and time formatting.
const test = require('node:test');
const assert = require('node:assert/strict');
const { GAME_DATA: D, Engine: E } = require('./load');
const P = E.Profiles;

const res = (levelIndex, mistakes, timeMs, practice = false) => ({ levelIndex, levelId: E.level(levelIndex).id, mistakes, timeMs, practice, tries: mistakes + 1 });
const fresh = () => { const st = P.create(); return { st, p: P.current(st) }; };

test('time format: tenths under a minute, m:ss.t under an hour, h:mm:ss beyond', () => {
  assert.equal(E.formatTime(0), '0.0s');
  assert.equal(E.formatTime(7300), '7.3s');
  assert.equal(E.formatTime(59900), '59.9s');
  assert.equal(E.formatTime(60000), '1:00.0');
  assert.equal(E.formatTime(65300), '1:05.3');
  assert.equal(E.formatTime(272100), '4:32.1');
  assert.equal(E.formatTime(3725000), '1:02:05');
  assert.equal(E.formatTime(-5), '0.0s');
});

test('profiles: the default profile is "Player 1" and it is the current one', () => {
  const st = P.create();
  assert.equal(st.profiles.length, 1); assert.equal(P.current(st).name, 'Player 1'); assert.equal(D.profiles.defaultName, 'Player 1');
  assert.equal(P.highestIndex(P.current(st)), -1);
});

test('profiles: a new profile is "Player N" (the lowest free number), becomes current, and starts with no records', () => {
  const st = P.create();
  const b = P.add(st); assert.equal(b.name, 'Player 2'); assert.equal(P.current(st).id, b.id);
  const c = P.add(st); assert.equal(c.name, 'Player 3');
  P.rename(st, b.id, 'Zoe');
  assert.equal(P.add(st).name, 'Player 2', 'the freed number is reused');
  assert.deepEqual(c.levels, {}); assert.equal(c.highest, null);
  assert.equal(new Set(st.profiles.map(p => p.id)).size, st.profiles.length, 'ids are unique');
});

test('profiles: the device holds a limited number of profiles', () => {
  const st = P.create();
  while (P.add(st)); assert.equal(st.profiles.length, D.profiles.max);
  assert.equal(P.add(st), null);
});

test('profiles: select switches the current profile; an unknown id is refused', () => {
  const st = P.create(); const a = st.profiles[0]; P.add(st);
  assert.equal(P.select(st, a.id), true); assert.equal(P.current(st).id, a.id);
  assert.equal(P.select(st, 'nope'), false); assert.equal(P.current(st).id, a.id);
});

test('rename: blank names are rejected (empty, spaces only) and nothing changes', () => {
  const { st, p } = fresh();
  P.applyResult(p, res(0, 1, 5000));
  const before = JSON.stringify(st);
  for (const bad of ['', '   ', '\t \n', null, undefined]) assert.deepEqual(P.rename(st, p.id, bad), { ok: false, reason: 'blank' });
  assert.equal(JSON.stringify(st), before);
});

test('rename: renaming never alters records, is trimmed, tidied and length-limited', () => {
  const { st, p } = fresh();
  P.applyResult(p, res(0, 2, 7000)); P.applyResult(p, res(1, 0, 9000));
  const records = JSON.stringify([p.levels, p.highest]);
  assert.deepEqual(P.rename(st, p.id, '  Patrick   B  '), { ok: true, name: 'Patrick B' });
  assert.equal(p.name, 'Patrick B'); assert.equal(JSON.stringify([p.levels, p.highest]), records);
  P.rename(st, p.id, 'x'.repeat(50)); assert.equal(p.name.length, D.profiles.maxNameLength);
  assert.equal(P.rename(st, 'missing', 'A').ok, false);
});

test('records: the first completion of a level sets the baseline and earns only the LEVEL badge', () => {
  const { p } = fresh();
  const r = P.applyResult(p, res(0, 3, 12000));
  assert.deepEqual(r.badges, { level: true, mistakes: false, time: false });
  assert.deepEqual(p.levels.A, { mistakes: 3, timeMs: 12000 }); assert.equal(p.highest, 'A');
});

test('records: best time and fewest mistakes are tracked separately per level; a better time earns the TIME badge', () => {
  const { p } = fresh();
  P.applyResult(p, res(0, 3, 12000));
  let r = P.applyResult(p, res(0, 5, 9000));      // faster, but more mistakes
  assert.deepEqual(r.badges, { level: false, mistakes: false, time: true });
  assert.deepEqual(p.levels.A, { mistakes: 3, timeMs: 9000 });
  r = P.applyResult(p, res(0, 1, 15000));         // fewer mistakes, slower
  assert.deepEqual(r.badges, { level: false, mistakes: true, time: false });
  assert.deepEqual(p.levels.A, { mistakes: 1, timeMs: 9000 });
  r = P.applyResult(p, res(0, 0, 8000));          // both
  assert.deepEqual(r.badges, { level: false, mistakes: true, time: true });
  assert.deepEqual(p.levels.A, { mistakes: 0, timeMs: 8000 });
});

test('records: a tie or a worse result is not a record and changes nothing', () => {
  const { p } = fresh();
  P.applyResult(p, res(0, 0, 8000));
  const r = P.applyResult(p, res(0, 0, 8000));
  assert.deepEqual(r.badges, { level: false, mistakes: false, time: false });
  const w = P.applyResult(p, res(0, 4, 20000));
  assert.deepEqual(w.badges, { level: false, mistakes: false, time: false });
  assert.deepEqual(p.levels.A, { mistakes: 0, timeMs: 8000 });
});

test('records: highest level reached is the highest level completed; the LEVEL badge only for a new high', () => {
  const { p } = fresh();
  assert.equal(P.applyResult(p, res(0, 0, 1000)).badges.level, true);
  assert.equal(P.applyResult(p, res(1, 0, 1000)).badges.level, true);
  assert.equal(P.highestIndex(p), 1);
  assert.equal(P.applyResult(p, res(0, 0, 900)).badges.level, false, 'replaying A is not a new high');
  assert.equal(P.highestIndex(p), 1);
  assert.equal(P.applyResult(p, res(2, 0, 1000)).badges.level, true);
  assert.equal(p.highest, 'C');
  assert.equal(P.recordsFor(p, 5), null); assert.deepEqual(P.recordsFor(p, 1), { mistakes: 0, timeMs: 1000 });
});

test('records: records are per profile', () => {
  const st = P.create(); const a = P.current(st); P.applyResult(a, res(3, 0, 1000));
  const b = P.add(st);
  assert.equal(P.highestIndex(b), -1); assert.deepEqual(b.levels, {}); assert.equal(P.highestIndex(a), 3);
  assert.equal(P.applyResult(b, res(0, 0, 1)).badges.level, true);
});

test('records: practice rounds never change records and never earn badges', () => {
  const { p } = fresh();
  const before = JSON.stringify(p);
  const r = P.applyResult(p, res(5, 0, 1000, true));
  assert.deepEqual(r, { badges: { level: false, mistakes: false, time: false }, saved: false });
  assert.equal(JSON.stringify(p), before);
  P.applyResult(p, res(0, 2, 5000));
  const r2 = P.applyResult(p, res(0, 0, 100, true));
  assert.equal(r2.badges.time, false); assert.deepEqual(p.levels.A, { mistakes: 2, timeMs: 5000 });
});

test('persistence: a round trip through JSON keeps profiles, names, current profile and every record', () => {
  const st = P.create(); P.applyResult(P.current(st), res(0, 1, 4000)); P.applyResult(P.current(st), res(1, 0, 9000));
  const b = P.add(st); P.rename(st, b.id, 'Sam'); P.applyResult(b, res(2, 7, 70000)); P.select(st, st.profiles[0].id);
  const back = P.restore(P.serialize(st));
  assert.deepEqual(back, st);
  assert.equal(P.current(back).name, 'Player 1'); assert.equal(P.highestIndex(back.profiles[1]), 2);
  const c = P.add(back); assert.ok(!st.profiles.some(p => p.id === c.id), 'new ids never reuse an old one');
});

test('persistence: damaged or hostile stored data is dropped, never trusted', () => {
  for (const raw of [null, '', 'not json', '{}', '[]', '{"profiles":"x"}', '{"profiles":[]}', '{"profiles":[null,5,"a"]}', 42]) {
    const st = P.restore(raw); assert.equal(st.profiles.length, 1); assert.equal(P.current(st).name, 'Player 1');
  }
  const st = P.restore({ current: 'zz', profiles: [
    { id: 'p1', name: '   ', levels: { A: { mistakes: 1, timeMs: 5000 }, B: { mistakes: -1, timeMs: 5 }, C: { mistakes: 'x', timeMs: 5 }, Z: { mistakes: 0, timeMs: 1 } }, highest: 'Q' },
    { id: 'p1', name: 'dup id' },
    { id: 'p2', name: '<b>' + 'y'.repeat(40), levels: null, highest: 'D' },
  ] });
  assert.equal(st.profiles.length, 2); assert.equal(st.current, 'p1');
  assert.match(st.profiles[0].name, /^Player \d$/);
  assert.deepEqual(Object.keys(st.profiles[0].levels), ['A']);
  assert.equal(st.profiles[0].highest, 'A', 'a recorded level has been completed');
  assert.ok(st.profiles[1].name.length <= D.profiles.maxNameLength);
  assert.equal(st.profiles[1].highest, 'D');
});
