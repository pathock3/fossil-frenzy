const test = require('node:test');
const assert = require('node:assert/strict');
const { Engine } = require('./load');
const { game, standOn, stay } = require('./helpers');

test('public view never contains the value of a face-down tile', () => {
  const s = game({ players: 3 });
  for (const who of [0, 1, 2]) for (const t of Engine.publicView(s, who).tokens) {
    assert.deepEqual(Object.keys(t).sort(), ['cell', 'id', 'matched']);
  }
});

test('only the peeking player sees the peeked value; everybody sees public flips', () => {
  const s = game({ players: 2 });
  standOn(s, 0, 0); stay(s); Engine.peek(s);
  assert.equal(Engine.publicView(s, 0).peeked.value, 2);
  assert.equal(Engine.publicView(s, 1).peeked, null);
  Engine.flipOther(s, 7);
  assert.deepEqual(Engine.publicView(s, 1).revealed, [{ tid: 7, value: 3, gem: false }]);
});

test('apply() dispatches every action type and rejects unknown ones', () => {
  const s = game();
  standOn(s, 0, 0);
  Engine.apply(s, { type: 'move', to: s.players[0].pos });
  Engine.apply(s, { type: 'peek' });
  Engine.apply(s, { type: 'flipOther', tid: 1 });
  Engine.apply(s, { type: 'flipOwn' });
  Engine.apply(s, { type: 'endTurn' });
  assert.throws(() => Engine.apply(s, { type: 'nope' }));
});
