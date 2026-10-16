const { GAME_DATA, Engine } = require('./load');

// Dice that return the given faces in order (then a seeded stream).
function rolls(faces, seed = 1) {
  const rest = Engine.mulberry32(seed);
  let i = 0;
  return () => (i < faces.length ? (faces[i++] - 0.5) / GAME_DATA.die.sides : rest());
}

// Canonical tile list in cell order, with overrides {tileIndex: value} swapped in (value 16 = gem).
function layout(overrides = {}) {
  const list = [];
  for (const t of GAME_DATA.tokens) for (let i = 0; i < t.count; i++) list.push({ value: t.value, gem: !!t.gem });
  const fixed = new Set();
  for (const [idx, v] of Object.entries(overrides)) {
    const i = Number(idx);
    if (list[i].value !== v) {
      const j = list.findIndex((x, k) => x.value === v && !fixed.has(k));
      if (j < 0) throw new Error('layout: no spare tile of value ' + v);
      [list[i], list[j]] = [list[j], list[i]];
    }
    fixed.add(i);
  }
  return list;
}

function game(o = {}) {
  return Engine.createGame({
    players: o.players || 2,
    system: o.system === undefined ? true : o.system,
    rng: o.rng || rolls(o.rolls || [6, 5, 4, 3, 2, 1].slice(0, o.players || 2)),
    layout: layout(o.layout || {}),
    data: o.data,
  });
}

const cellAt = (s, q, r) => s.cells.find(c => c.q === q && c.r === r).id;
const place = (s, idx, cell) => { s.players[idx].pos = cell; };
const tileCell = (s, tid) => s.tokens[tid].cell;
// put player on the space holding tile `tid`
const standOn = (s, idx, tid) => place(s, idx, s.tokens[tid].cell);
const stay = s => Engine.move(s, { to: s.players[s.current].pos });

module.exports = { rolls, layout, game, cellAt, place, tileCell, standOn, stay };
