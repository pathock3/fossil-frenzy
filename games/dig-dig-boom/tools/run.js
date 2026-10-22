// Parallel tournaments:  node tools/run.js '<brain A>' '<brain B>' [n] [rounds]
// A brain is "base" (the shipped AI) or "rollout" / "rollout:{json overrides}" (tools/brain.js). Seeds are split over the CPUs.
const { fork } = require('child_process'), os = require('os');
function brainFrom(spec) {
  const { G } = require('./sim.js');
  if (spec === 'base') return G.Basic;
  if (['easy', 'normal', 'best'].includes(spec)) return G.AI.level(spec);          // the shipped difficulty levels
  if (['easy', 'normal', 'best'].includes(spec)) return G.AI.level(spec);          // the shipped difficulty levels
  const m = /^(\w+)(?::(.*))?$/.exec(spec), over = m[2] ? JSON.parse(m[2]) : {};
  const b = require('./brain.js').makeBrain(over);
  if (m[1] === 'smartprep') return { act: G.Basic.act, prep: b.prep };      // the shipped Dig play, the new Prep
  if (m[1] === 'rolldig') return { act: b.act, prep: G.Basic.prep };        // the new Dig play, the shipped Prep
  if (m[1] === 'finaldig') {                                             // like smartprep, but in the last round the leader keeps digging instead of waiting (until it would be safe: nobody else alive)
    const sp = require('./brain.js').makeBrain().prep;
    return { prep: sp, act(run) { const st = run.dig; if (st && !st.over && !st.fight && !st.pending && st.board && st.board.final) { G.Run.refresh(run); if (st.board.lead && G.Dig.can(st).dig && st.survived >= (over.minSurvived || 0)) { G.Dig.dig(st); return true; } } return G.Basic.act(run); } };
  }
  if (m[1] === 'rollact') return { act: b.act, prep: require('./brain.js').makeBrain().prep };   // the new Dig play with the default new Prep (to compare with "smartprep": only the Dig play differs)
  return b;                                                              // "rollout": both
}
module.exports = { brainFrom };
if (process.env.DDB_WORKER) {
  const [a, b, n, rounds, seed0] = JSON.parse(process.env.DDB_WORKER);
  const { tournament } = require('./sim.js');
  const res = tournament(brainFrom(a), brainFrom(b), { n, rounds, seed0, quiet: true });
  process.send(res);
} else if (require.main === module) {
  const [a, b, nS = '400', rS = '4'] = process.argv.slice(2), n = Number(nS), rounds = Number(rS), cpus = Math.min(os.cpus().length, 8), per = Math.ceil(n / cpus);
  let done = 0, agg = null; const t = Date.now();
  for (let i = 0; i < cpus; i++) {
    const k = Math.min(per, n - i * per); if (k <= 0) continue;
    const w = fork(__filename, [], { env: { ...process.env, DDB_WORKER: JSON.stringify([a, b, k - (k % 2), rounds, 1 + i * per * 2]) } });
    w.on('message', r => { agg = agg ? merge(agg, r) : r; });
    w.on('exit', () => { if (++done === cpus) { report(agg, a, b, t); } });
  }
  function merge(x, y) {
    const o = { n: x.n + y.n, A: x.A + y.A, B: x.B + y.B, tie: x.tie + y.tie, stalls: x.stalls + y.stalls, statsA: {}, statsB: {} };
    for (const k of Object.keys(x.statsA)) { o.statsA[k] = +((x.statsA[k] * x.n + y.statsA[k] * y.n) / o.n).toFixed(3); o.statsB[k] = +((x.statsB[k] * x.n + y.statsB[k] * y.n) / o.n).toFixed(3); }
    return o;
  }
  function report(r, a, b, t) {
    const played = r.n - r.stalls, rate = (r.A + r.tie / 2) / played, se = Math.sqrt(rate * (1 - rate) / played);
    console.log(`${a}  vs  ${b}:  A wins ${r.A}, B wins ${r.B}, ties ${r.tie}, stalls ${r.stalls}  =>  A ${(100 * rate).toFixed(1)}% ±${(196 * se).toFixed(1)}   [${((Date.now() - t) / 1000).toFixed(0)} s]`);
    console.log('  A', JSON.stringify(r.statsA), '\n  B', JSON.stringify(r.statsB));
  }
}
