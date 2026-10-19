const { GAME_DATA, Engine, Bots } = require('./load');

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

// A position part-way through a game, seen by a bot in `seat`, for testing what the bot decides.
//   matched: sets already popped, as [value, gem] (their fossils are taken off the board and the bot is told)
//   points / held: each player's banked points and held set values
//   known: fossils the bot knows — {tid, value, pub} (pub: it saw them flipped publicly; otherwise they were its own peeks)
function position({ matched = [], points = [0, 0], held = [[], []], known = [], seat = 0, profile = 'expert', seed = 3 } = {}) {
  const s = Engine.createGame({ players: 2, seed });
  s.current = seat; s.firstPlayer = seat;
  const bot = Bots.create({ seat, profile, rng: Engine.mulberry32(1) });
  s.observers.push(bot);
  const used = new Set(known.map(k => k.tid));
  for (const [value, gem] of matched) {
    const size = gem ? GAME_DATA.matching.gemSetSize : GAME_DATA.matching.pairSize;
    const tids = s.tokens.filter(t => !t.matched && t.value === value && !!t.gem === !!gem && !used.has(t.id)).slice(0, size).map(t => t.id);
    for (const t of tids) { s.tokens[t].matched = true; s.tokenAt[s.tokens[t].cell] = -1; }
    s.matchedCount += size;
    bot.onEvent({ type: 'match', actor: 1 - seat, tids, value, gem: !!gem });
  }
  for (const k of known) {
    const t = s.tokens[k.tid]; t.value = k.value; t.gem = !!k.gem;
    bot.onEvent(k.pub ? { type: 'reveal', actor: 1 - seat, tid: k.tid, value: k.value, gem: !!k.gem, step: 'other' } : { type: 'peek', actor: seat, tid: k.tid, value: k.value, gem: !!k.gem });
  }
  points.forEach((p, i) => { s.players[i].points = p; });
  held.forEach((h, i) => { s.players[i].sets = h.map(v => ({ value: v, gem: v === 12, size: v === 12 ? 3 : 2, ids: [] })); });
  const view = () => Engine.publicView(s, seat);
  return { s, bot, view, weigh: () => bot.weigh(view()), decide: () => bot.decide(view()) };
}

// Most of the game is over: only these sets are left on the board.
const lateGame = (left = [[12, true], [9], [7], [6]]) => {
  const all = [];
  for (const t of GAME_DATA.tokens) { const size = t.gem ? GAME_DATA.matching.gemSetSize : GAME_DATA.matching.pairSize; for (let i = 0; i < t.count / size; i++) all.push([t.value, !!t.gem]); }
  const keep = left.map(x => [x[0], !!x[1]]);
  return all.filter(a => { const i = keep.findIndex(k => k[0] === a[0] && k[1] === a[1]); if (i >= 0) { keep.splice(i, 1); return false; } return true; });
};

module.exports = { rolls, layout, game, position, lateGame };
