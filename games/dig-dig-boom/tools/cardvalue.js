// How good is each Booster card? Played out by simulation: put the card in the Starter Kit (in place of a gem), dig a few thousand Digs with the AI's quick policy
// (play every fight well, never bank) and see how many Monsters get survived before the BOOM. The same Mines and dice are used with and without the card.
//   node games/dig-dig-boom/tools/cardvalue.js [digs per context] [out.json]          (all cards, parallel)
//   node games/dig-dig-boom/tools/cardvalue.js numbers [digs] [out.json]              (every Power card at every trigger number 1..10)
const fs = require('fs'), path = require('path'), os = require('os'), { fork } = require('child_process');
const G = require('../tests/load.js');
const { Dig, Engine, DDB, AI } = G;
const cards = Engine.cards(Engine.parseCSV(fs.readFileSync(path.join(__dirname, '..', 'tests', 'cards-full.csv'), 'utf8')), DDB.columns);
const banned = c => DDB.run.boosterBan.some(re => new RegExp(re).test(c.text));
const extraFile = process.env.CV_EXTRA;                    // a CSV of candidate new cards (same columns as the sheet), balanced together with the real ones
const extra = extraFile ? Engine.cards(Engine.parseCSV(fs.readFileSync(extraFile, 'utf8')), DDB.columns) : [];
const booster = cards.concat(extra).filter(c => c.deck === DDB.run.boosterDeck && Dig.supported(c) && !banned(c));
const isNew = new Set(extra.map(c => c.id));
const Ts = [3, 4, 5, 6, 7];
const brain = AI.make({});
const ctx = { final: false, leadN: 99, crown: 2 };

// one Dig with this kit; returns the number of Monsters survived before the BOOM (capped)
function digOnce(kit, kitMax, rest, seed) {
  const st = Dig.start(cards, kit, { seed, extra: rest, gems: Math.max(0, kitMax - kit.length) * DDB.run.startGems });
  for (let i = 0; i < 400 && !st.over; i++) { if (st.digs > 60) break; if (!brain.baseAct(st, ctx, 99)) break; }
  return st.over && st.over.kind === 'boom' ? st.survived : Math.min(st.survived, 12);
}
function score(kit, kitMax, rest, n, seed0) {                                   // reach score: the average chance of surviving at least T Monsters, T = 3..7
  let sum = 0, tot = 0;
  for (let j = 0; j < n; j++) { const s = digOnce(kit, kitMax, rest, seed0 + j * 104729); tot += s; for (const T of Ts) if (s >= T) sum++; }
  return { reach: sum / (n * Ts.length), mean: tot / n };
}
let seedBase = 1;
const rng = seed => { let x = seed >>> 0 || 1; return () => (x = (x * 1664525 + 1013904223) >>> 0) / 4294967296; };
// contexts: kit of 1 (round 1) and kits of 3 with two random fillers from the Booster Deck (and what you own beyond the kit shuffled into the Mine)
function contexts(id, nCtx) {
  const r = rng(7919 + id), out = [{ k: 1, fill: [], rest: [] }];
  for (let i = 0; i < nCtx; i++) {
    const pool = booster.slice(); const pick = () => pool.splice(Math.floor(r() * pool.length), 1)[0];
    const fill = [pick(), pick()], rest = [pick(), pick()];
    out.push({ k: 3, fill, rest });
  }
  return out;
}
function valueOf(card, n, nCtx, num) {
  const c = num ? { ...card, number: num } : card, imm = c.type === 'Immediate';
  let d = 0, dm = 0, m = 0, d2 = 0, dm2 = 0;
  const ctxs = contexts(1, nCtx);
  ctxs.forEach((x, i) => {
    const kitWith = [c, ...x.fill].map((y, j) => ({ ...y, uid: 500 + j })), kitNo = x.fill.map((y, j) => ({ ...y, uid: 600 + j }));
    const rest = x.rest.map((y, j) => ({ ...y, uid: 700 + j })), seed0 = 1000 + i * 977;
    const a = score(kitWith, x.k, rest, n, seed0), b = score(kitNo, x.k, rest, n, seed0);
    d += a.reach - b.reach; dm += a.mean - b.mean; m++;
    if (imm) { const a2 = score(kitNo, x.k, rest.concat([{ ...c, uid: 800 }]), n, seed0); d2 += a2.reach - b.reach; dm2 += a2.mean - b.mean; }          // an Immediate card is also good shuffled into the Mine, dug when it comes
  });
  return imm && d2 > d ? { reach: d2 / m, mean: dm2 / m, how: 'in the Mine' } : { reach: d / m, mean: dm / m };
}
// the same card with one of its numbers moved a little: the first number in its text, then the next ... (never inside {braces})
function variants(card) {
  const out = [], re = /(?<![{\w])(\d+)(?![^{]*\})/g; let m;
  while ((m = re.exec(card.text))) {
    const n0 = Number(m[1]);
    for (const dlt of [-2, -1, 1, 2]) { const v = n0 + dlt; if (v < 1 || v > 12) continue; const text = card.text.slice(0, m.index) + v + card.text.slice(m.index + m[1].length), c2 = { ...card, text }; if (Dig.supported(c2)) out.push(c2); }
  }
  return out;
}
module.exports = { booster, valueOf, variants, cards, isNew };

if (process.env.CV_WORKER) {
  const { ids, n, nCtx, nums, vars } = JSON.parse(process.env.CV_WORKER), out = {};
  for (const id of ids) {
    const c = booster.find(x => x.id === id);
    if (nums) { out[id] = {}; for (let k = 1; k <= 10; k++) out[id][k] = valueOf(c, n, nCtx, k); }
    else if (vars) { out[id] = variants(c).map(v => ({ text: v.text, ...valueOf(v, n, nCtx) })); }
    else out[id] = valueOf(c, n, nCtx);
  }
  process.send(out);
} else if (require.main === module) {
  const args = process.argv.slice(2), nums = args[0] === 'numbers', vars = args[0] === 'variants'; if (nums || vars) args.shift();
  const n = Number(args[0] || 600), file = args[1] || (nums ? 'cardvalue-numbers.json' : vars ? 'cardvalue-variants.json' : 'cardvalue.json'), nCtx = Number(process.env.CV_CTX || 6);
  const ids = booster.filter(c => nums ? c.type === 'Power' : vars ? c.type !== 'Power' : true).map(c => c.id), cpus = Math.min(os.cpus().length, 8), res = {}; let done = 0; const t = Date.now();
  for (let i = 0; i < cpus; i++) {
    const mine = ids.filter((_, k) => k % cpus === i); if (!mine.length) { done++; continue; }
    const w = fork(__filename, [], { env: { ...process.env, CV_WORKER: JSON.stringify({ ids: mine, n, nCtx, nums, vars }) } });
    w.on('message', r => Object.assign(res, r));
    w.on('exit', () => { if (++done === cpus) { fs.writeFileSync(file, JSON.stringify(res, null, 1)); console.log('wrote', file, ((Date.now() - t) / 1000).toFixed(0) + ' s'); } });
  }
}
