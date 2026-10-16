const test = require('node:test');
const assert = require('node:assert/strict');
const { GAME_DATA, Engine } = require('./load');
const { game, cellAt, place, stay } = require('./helpers');

const at = (s, q, r) => cellAt(s, q, r);

test('movement: you may move 0 spaces (stay) and then act', () => {
  const s = game();
  const p = s.players[s.current];
  const before = p.pos;
  Engine.move(s, { to: before });
  assert.equal(p.pos, before);
  assert.equal(s.phase, 'action');
});

test('movement: up to 3 spaces, never 4, never off the board', () => {
  const s = game();
  place(s, 0, at(s, 0, 0)); place(s, 1, at(s, 3, 0));
  s.current = 0;
  const m = Engine.availableMoves(s);
  assert.equal(m.steps[at(s, 0, 0)], 0);
  assert.equal(m.steps[at(s, 0, 3)], 3);
  assert.equal(m.steps[at(s, 1, 1)], 2);
  assert.ok(Math.max(...Object.values(m.steps)) === 3);
  // cell exactly 4 away from the centre does not exist on a radius-3 board; test from a corner instead
  place(s, 0, at(s, 0, -3));
  const m2 = Engine.availableMoves(s);
  assert.equal(m2.steps[at(s, 0, 0)], 3);
  assert.equal(m2.steps[at(s, 0, 1)], undefined);
  assert.throws(() => Engine.move(s, { to: at(s, 0, 1) }));
  Engine.move(s, { to: at(s, 0, 0) });
  assert.equal(s.players[0].pos, at(s, 0, 0));
});

test('movement: moves only exist on the mover\'s own turn and only once (before acting)', () => {
  const s = game();
  stay(s);
  assert.throws(() => Engine.move(s, { to: s.players[s.current].pos }), /movement phase/);
});

test('movement: another player in your way — you may go around (costs extra steps)', () => {
  const s = game();
  place(s, 0, at(s, 0, 0)); place(s, 1, at(s, 1, 0)); s.current = 0;
  const m = Engine.availableMoves(s);
  assert.equal(m.steps[at(s, 2, 0)], 3);         // around via (1,-1),(2,-1)
  assert.equal(m.steps[at(s, 3, 0)], undefined); // straight would be 3, around is 4
  assert.equal(m.steps[at(s, 1, 0)], undefined); // cannot stop on an occupied space
});

test('movement: pushing — victim moves one space in any direction, you take their space', () => {
  const s = game();
  place(s, 0, at(s, 0, 0)); place(s, 1, at(s, 1, 0)); s.current = 0;
  const m = Engine.availableMoves(s);
  const push = m.pushes[at(s, 1, 0)];
  assert.equal(push.victim, 1);
  assert.ok(push.options.length >= 4);
  const to = at(s, 2, -1);
  assert.ok(push.options.includes(to));
  Engine.move(s, { to: at(s, 1, 0), victimTo: to });
  assert.equal(s.players[1].pos, to);
  assert.equal(s.players[0].pos, at(s, 1, 0));
});

test('movement: you may not continue moving after pushing', () => {
  const s = game();
  place(s, 0, at(s, 0, 0)); place(s, 1, at(s, 1, 0)); s.current = 0;
  Engine.move(s, { to: at(s, 1, 0), victimTo: at(s, 2, 0) });
  assert.equal(s.phase, 'action');
  assert.throws(() => Engine.move(s, { to: at(s, 2, -1) }));
});

test('movement: a push costs one of your 3 steps (victim 3 away is pushable, 4 away is not)', () => {
  const s = game();
  place(s, 0, at(s, -3, 0)); place(s, 1, at(s, 0, 0)); s.current = 0;     // distance 3
  assert.ok(Engine.availableMoves(s).pushes[at(s, 0, 0)]);
  place(s, 1, at(s, 1, 0));                                                // distance 4
  assert.equal(Engine.availableMoves(s).pushes[at(s, 1, 0)], undefined);
});

test('movement: you may not bump one player into another', () => {
  const s = game({ players: 3 });
  place(s, 0, at(s, 0, 0)); place(s, 1, at(s, 1, 0)); place(s, 2, at(s, 2, 0)); s.current = 0;
  const push = Engine.availableMoves(s).pushes[at(s, 1, 0)];
  assert.ok(!push.options.includes(at(s, 2, 0)));
  assert.throws(() => Engine.move(s, { to: at(s, 1, 0), victimTo: at(s, 2, 0) }), /push destination/);
});

test('movement: no push is possible when the victim is boxed in by other players', () => {
  const s = game({ players: 4 });
  // corner (0,-3) has exactly three neighbours; the mover and two others fill them
  place(s, 1, at(s, 0, -3)); place(s, 0, at(s, 0, -2)); place(s, 2, at(s, 1, -3)); place(s, 3, at(s, -1, -2));
  s.current = 0;
  assert.equal(Engine.availableMoves(s).pushes[at(s, 0, -3)], undefined);
});

test('movement: a pushed player can be pushed onto any empty space, including a corner', () => {
  const s = game();
  place(s, 0, at(s, 0, -2)); place(s, 1, at(s, 1, -2)); s.current = 0;
  const push = Engine.availableMoves(s).pushes[at(s, 1, -2)];
  assert.ok(push.options.includes(at(s, 1, -3)) || push.options.includes(at(s, 2, -3)));
  place(s, 1, at(s, 2, -2));
  const p2 = Engine.availableMoves(s).pushes[at(s, 2, -2)];
  assert.ok(p2.options.includes(at(s, 3, -3)), 'corner (3,-3) is a legal landing space');
});

test('movement: pushing can be disabled from the data block', () => {
  const d = JSON.parse(JSON.stringify(GAME_DATA));
  d.variants.delivery.movement.allowPush = false;
  const s = game({ data: d });
  place(s, 0, at(s, 0, 0)); place(s, 1, at(s, 1, 0)); s.current = 0;
  assert.deepEqual(Engine.availableMoves(s).pushes, {});
});

test('movement: max steps comes from the data block', () => {
  const d = JSON.parse(JSON.stringify(GAME_DATA));
  d.variants.delivery.movement.maxSteps = 1;
  const s = game({ data: d });
  place(s, 0, at(s, 0, 0)); place(s, 1, at(s, 3, 0)); s.current = 0;
  assert.equal(Math.max(...Object.values(Engine.availableMoves(s).steps)), 1);
});

test('movement: does not exist when the system is off', () => {
  const s = game({ system: false });
  assert.equal(Engine.availableMoves(s), null);
  assert.throws(() => Engine.move(s, { to: 0 }));
});
