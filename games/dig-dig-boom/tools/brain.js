// Prototype of a stronger AI brain (rollouts on copies of the Dig), measured with tools/sim.js.
// A brain is { act(run), prep(run) }. Everything it reads is public: its own Dig (the Mine's cards, but the ORDER of the Mine only as far as it has seen)
// and the Leaderboard.
const { G } = require('./sim.js');
const { Dig, Board, Run, DDB } = G;
const RN = DDB.run;

const DEFAULTS = {
  rolls: 40,            // playouts per option at a decision
  idleRolls: 80,
  lambda: 0.03,         // what one more card kept from a pack is worth, in win probability
  gamma: 0.7,           // how fast a lead matters less the more rounds remain
  rerollBelow: 3,       // the base policy rerolls when the plan leaves it with this much Health or less
  digCap: 70,
  prepSims: 60,
  screenSims: 16,       // Digs to give each possible set of kept cards before the best few are looked at properly
  finalists: 3,         // Digs played to judge one deck
  kitMargin: 0.003,     // a Kit place is only filled by a card that is at least this much better than a gem
  ladderT: [1, 2, 3, 4, 5, 6, 8],   // "bank at N Monsters survived" policies tried at the idle decision
};

// P(win) by (rounds left, my best, their best, who holds the better spot when level): measured in self-play (tools/phi0.json, made by tools/gather.js).
// Bests are 0 (nothing past the Crown's 3) or 4..8.
let PHI = require('./phi0.json');
function phi(left, a, b, t) {
  const L = Math.min(left, 5), A = Math.min(a, 8), B = Math.min(b, 8), cell = PHI[L + '|' + A + '|' + B + '|' + (A === B && A ? t : 0)];
  const guess = 0.5 + Math.max(-0.4, Math.min(0.4, (A - B) * 0.2 * Math.pow(0.85, L - 1))) + (A === B && A ? 0.1 * t : 0);      // where the table has no data
  const k = 25; return ((cell ? cell.w : 0) + guess * k) / ((cell ? cell.n : 0) + k);
}
const eff = (b, crown) => (b > crown ? b : 0);
function packVal(G_, boom) {
  const tv = p => p.keep;
  if (boom) return tv(RN.ladder.find(p => p.name === RN.boomPack));
  let t = 0; for (let e = 1; e <= DDB.rules.die; e++) t += tv(Run.ladderFor(G_ + e)); return t / DDB.rules.die;
}

function context(run, P) {
  const st = run.dig, b = run.board, me = run.me;
  const mark = (id, k) => { const m = Board.marker(b, id, k); return m ? m.n : 0; };
  const others = b.players.filter(p => p.id !== me);
  const bo = Math.max(0, ...others.map(p => mark(p.id, 'best')));
  const mr = Board.marker(b, me, 'best'), orank = Math.min(99, ...others.map(p => { const m = Board.marker(b, p.id, 'best'); return m && m.n === bo ? m.rank : 99; }));
  return { final: !!(st.board && st.board.final), left: run.rounds - run.round, bm: mark(me, 'best'), bo, crown: b.crownStart, leadN: st.board ? st.board.leadN : 99, tBase: mr && mr.n === bo && bo ? (mr.rank < orank ? 1 : -1) : 0, P };
}

function valueOf(st, ctx) {
  const o = st.over, P = ctx.P;
  if (ctx.final) return (!(o && o.kind === 'boom') && st.over !== undefined && st.survived >= ctx.leadN) || (!o && st.survived >= ctx.leadN) ? 1 : 0;
  const boom = !o || o.kind === 'boom';
  const best = boom ? ctx.bm : Math.max(ctx.bm, st.survived);
  const a = eff(best, ctx.crown), b = eff(ctx.bo, ctx.crown);
  return phi(ctx.left, a, b, a && a === b ? (best > ctx.bm ? -1 : ctx.tBase) : 0) + P.lambda * packVal(boom ? 0 : st.geodeGems + st.monsterGems, boom);
}

// ---- the base policy used inside playouts: quick and sensible ----
function planOutcome(st) { const c = Dig.clone(st, 7); Dig.autoFace(c); return c; }
function baseAct(st, ctx, T) {
  if (st.over) return false;
  const c = Dig.can(st), f = st.fight;
  if (c.choose) { Dig.chooseClone(st, st.line.find(e => !e.pet) || st.line[0]); return true; }
  if (f) {
    if (f.phase === 'before') { Dig.roll(st); return true; }
    if (c.reroll) { const o = planOutcome(st); if (o.over || o.heart <= ctx.P.rerollBelow) { Dig.reroll(st); return true; } }
    Dig.autoFace(st); return true;
  }
  if (ctx.final) { if (st.survived >= ctx.leadN) return false; Dig.dig(st); return true; }
  if (c.bank && st.survived >= T) { Dig.bank(st); return true; }
  if (!c.dig) return false;
  Dig.dig(st); return true;
}
function playout(st, ctx, T) {
  for (let i = 0; i < 500 && !st.over; i++) { if (st.digs > ctx.P.digCap) { st.over = { kind: 'boom' }; break; } if (!baseAct(st, ctx, T)) break; }
  return valueOf(st, ctx);
}
// a copy of the Dig with the unseen part of the Mine shuffled (the AI does not know its order)
function sample(st, seed) {
  const c = Dig.clone(st, seed);
  const known = Math.min(c.known, c.mine.length), rest = Dig.shuffle(c, c.mine.slice(known));
  c.mine = c.mine.slice(0, known).concat(rest); return c;
}
function evaluate(st, ctx, apply, n, T) {
  let sum = 0;
  for (let j = 0; j < n; j++) { const c = sample(st, 1000 + j * 7919); apply(c); sum += playout(c, ctx, T); }
  return sum / n;
}

// ---- trigger plans: which eligible cards, in which order ----
function plans(st) {
  const el = Dig.eligible(st), idx = el.map(e => st.line.indexOf(e)), out = [];
  const perms = (a, k) => { const r = []; (function go(cur, rest) { if (cur.length) r.push(cur); if (cur.length >= k) return; for (let i = 0; i < rest.length; i++) go(cur.concat(rest[i]), rest.slice(0, i).concat(rest.slice(i + 1))); })([], a); return r; };
  if (el.length <= 3) return [[]].concat(perms(idx, el.length));
  const all = idx.slice();
  out.push([], all, all.slice().reverse());
  for (let i = 0; i < all.length; i++) { out.push(all.filter((_, k) => k !== i)); out.push([all[i]]); }
  return out;
}
function applyPlan(c, plan) { const idxLine = c.line; for (const i of plan) { const e = idxLine[i]; if (!Dig.trigger(c, e)) break; } Dig.face(c); }
const sig = c => [c.over && c.over.kind, c.heart, c.reroll, c.survived, c.fight ? 'f' : '', c.line.map(e => e.at).join('.'), c.ongoing.length, c.mine.length, c.geodeGems + c.monsterGems].join('|');

function argmax(opts, score) {
  let best = null, bv = -Infinity;
  for (const o of opts) { const v = score(o); if (v > bv + 1e-9) { bv = v; best = o; } }
  return best;
}

function makeBrain(over = {}) {
  const P = { ...DEFAULTS, ...over };
  function act(run) {
    const st = run.dig; if (!st || st.over) return false;
    Run.refresh(run);
    const ctx = context(run, P), c = Dig.can(st), f = st.fight;
    if (c.choose) {
      const best = argmax(st.line.map((e, i) => i), i => evaluate(st, ctx, k => Dig.chooseClone(k, k.line[i]), P.rolls, 99));
      Dig.chooseClone(st, st.line[best]); return true;
    }
    if (f) {
      if (f.phase === 'before') { Dig.roll(st); return true; }
      const opts = [];
      if (c.reroll) opts.push({ kind: 'reroll' });
      const seen = new Set();
      for (const plan of plans(st)) { const t = sample(st, 5); applyPlan(t, plan); const s = sig(t); if (seen.has(s)) continue; seen.add(s); opts.push({ kind: 'plan', plan }); }
      const T = ctx.final ? 99 : 5;
      const pick = opts.length === 1 ? opts[0] : argmax(opts, o => evaluate(st, ctx, k => (o.kind === 'reroll' ? Dig.reroll(k) : applyPlan(k, o.plan)), P.rolls, T));
      if (pick.kind === 'reroll') Dig.reroll(st); else applyPlan(st, pick.plan);
      return true;
    }
    if (ctx.final) { if (st.board.lead) return false; Dig.dig(st); return true; }
    if (c.bank && st.digs >= DDB.ai.giveUpDigs) { Run.bank(run); return true; }
    if (!c.dig) return false;
    if (!c.bank) { Dig.dig(st); return true; }
    // dig on, or bank: the best of "bank now" and "play on until T Monsters survived"
    const arms = [{ bank: true }].concat(P.ladderT.filter(t => t > st.survived).map(t => ({ T: t })));
    const pick = argmax(arms, a => a.bank ? valueOf(Object.assign(Dig.clone(st, 1), { over: { kind: 'bank' } }), ctx) : evaluate(st, ctx, () => {}, P.idleRolls, a.T));
    if (pick.bank) Run.bank(run); else Dig.dig(st);
    return true;
  }
  // ---- Prep ----
  // How good is a deck? Dig with it many times, never banking, and see how far it gets: reaching 4 or more Monsters is what counts for the Crown.
  const W = P.deckWeights || [0, 0.1, 0.2, 0.4, 1, 0.7, 0.5, 0.35, 0.25, 0.2];     // value of having survived n Monsters (n = 0..9): the Crown needs more than 3
  // The value of a deck: the average value (as in valueOf) of the coming Dig played with a plain bank-at-the-number-that-puts-me-ahead policy.
  function prepContext(run) {
    const fake = { dig: { board: { final: run.round === run.rounds, leadN: 99 } }, board: run.board, me: run.me, rounds: run.rounds, round: run.round };
    if (fake.dig.board.final) fake.dig.board.leadN = Board.leadN(run.board, run.me);
    const ctx = context(fake, P); ctx.T = Math.max(ctx.crown, ctx.bo) + 1; return ctx;
  }
  function evalDeck(run, ctx, kit, rest, n, seed0, kitMax) {
    let sum = 0; const empty = kitMax - kit.length;
    for (let j = 0; j < n; j++) {
      const st = Dig.start(run.all, kit, { seed: seed0 + j * 104729, extra: rest, gems: empty * RN.startGems, board: { crown: ctx.crown, final: ctx.final, leadN: ctx.leadN } });
      for (let i = 0; i < 500 && !st.over; i++) { if (st.digs > P.digCap) { st.over = { kind: 'boom' }; break; } if (!baseAct(st, ctx, ctx.T)) break; }
      sum += valueOf(st, ctx);
    }
    return sum / n;
  }
  const perms = a => a.length <= 1 ? [a] : a.flatMap((x, i) => perms(a.slice(0, i).concat(a.slice(i + 1))).map(r => [x].concat(r)));
  function chooseKit(run, owned, kitMax, n, seed0) {
    const ctx = prepContext(run), val = kit => evalDeck(run, ctx, kit, owned.filter(c => !kit.includes(c)), n, seed0, kitMax);
    let kit = [], best = val(kit);
    for (let step = 0; step < kitMax; step++) {
      let pick = null, pv = best + P.kitMargin;
      for (const c of owned) { if (kit.includes(c)) continue; const v = val(kit.concat(c)); if (v > pv) { pv = v; pick = c; } }
      if (!pick) break; kit = kit.concat(pick); best = pv;
    }
    if (kit.length > 1 && kit.length <= 3) { let bo = kit, bv = best; for (const o of perms(kit)) { const v = val(o); if (v > bv + 1e-9) { bv = v; bo = o; } } kit = bo; best = bv; }
    return { kit, value: best };
  }
  const combos = (a, k) => k === 0 ? [[]] : a.length < k ? [] : combos(a.slice(1), k - 1).map(r => [a[0]].concat(r)).concat(combos(a.slice(1), k));
  // The best Kit you could make from `pool` among a few ways of putting `extra` cards into your current best Kit.
  function screen(run, ctx, owned, set, kit0, kitMax, n, seed0) {
    const all = owned.concat(set), tries = [kit0];
    for (const c of set) {
      if (kit0.length < kitMax) tries.push(kit0.concat(c));
      else for (let j = 0; j < kit0.length; j++) tries.push(kit0.map((x, i) => (i === j ? c : x)));
    }
    let best = -Infinity;
    for (const kit of tries) best = Math.max(best, evalDeck(run, ctx, kit, all.filter(c => !kit.includes(c)), n, seed0, kitMax));
    return best;
  }
  function prep(run) {
    const pr = run.prep; if (!pr) return;
    if (pr.step === 'pack') Run.openPack(run);
    const n = P.prepSims, seed0 = 31337;
    if (run.prep.step === 'keep') {
      const k = Run.keepCount(run), offer = run.prep.offer, sets = combos(offer, k);
      let bestSet = sets[0];
      if (sets.length > 1) {
        const kitMax = run.prep.kitMax, ctx = prepContext(run), kit0 = chooseKit(run, run.owned, kitMax, n, seed0).kit;
        const scored = sets.map(set => ({ set, v: screen(run, ctx, run.owned, set, kit0, kitMax, P.screenSims, seed0) })).sort((x, y) => y.v - x.v).slice(0, P.finalists);
        let bv = -Infinity;
        for (const f of scored) { const v = chooseKit(run, run.owned.concat(f.set), kitMax, n, seed0).value; if (v > bv + 1e-9) { bv = v; bestSet = f.set; } }
      }
      for (const c of bestSet) Run.toggleKeep(run, c.uid);
      Run.confirmKeep(run);
    }
    if (run.prep.step === 'reveal') Run.continueReveal(run);
    if (run.prep.step === 'kit') {
      const { kit } = chooseKit(run, run.owned, run.prep.kitMax, n * 2, seed0);
      run.prep.kitPick = []; for (const c of kit) Run.toggleKit(run, c.uid);
    }
  }
  return { act, prep, P };
}

module.exports = { makeBrain, DEFAULTS, phi, setPhi: t => { PHI = t; } };

if (require.main === module) {
  const { tournament } = require('./sim.js');
  const n = Number(process.argv[2] || 100), t = Date.now();
  tournament(makeBrain(), G.AI, { n });
  console.log(((Date.now() - t) / 1000).toFixed(1) + ' s');
}
