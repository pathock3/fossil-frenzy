const { GAME_DATA, Engine } = require('./load');

// Dice that return the given faces in order (then a seeded stream).
function rolls(faces, seed = 1) {
  const rest = Engine.mulberry32(seed);
  let i = 0;
  return () => (i < faces.length ? (faces[i++] - 0.5) / GAME_DATA.die.sides : rest());
}

// Canonical fossil list in space order, with overrides {index: value} swapped in (value 12 = gem).
// Indexes: 0-5 are 2s, 6-11 are 3s, 12-15 are 5s, 16-19 are 6s, 20-23 are 7s, 24-25 are 9s, 26-27 are 10s, 28-30 are gems.
function layout(overrides = {}) {
  const list = [];
  for (const t of GAME_DATA.tokens) for (let i = 0; i < t.count; i++) list.push({ value: t.value, gem: !!t.gem });
  const fixed = new Set();
  for (const [idx, v] of Object.entries(overrides)) {
    const i = Number(idx);
    if (list[i].value !== v) {
      const j = list.findIndex((x, k) => x.value === v && !fixed.has(k));
      if (j < 0) throw new Error('layout: no spare fossil of value ' + v);
      [list[i], list[j]] = [list[j], list[i]];
    }
    fixed.add(i);
  }
  return list;
}

// A game with player 0 going first (rolls default to descending), a known layout, and optional data overrides.
function game(o = {}) {
  const n = o.players || 2;
  return Engine.createGame({
    players: n,
    rng: o.rng || rolls(o.rolls || [6, 5, 4, 3].slice(0, n)),
    layout: layout(o.layout || {}),
    data: o.data,
  });
}

module.exports = { rolls, layout, game };
