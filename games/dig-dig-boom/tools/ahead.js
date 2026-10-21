// Who wins from which position before the last round?  node tools/ahead.js '<brain A>' '<brain B>' <matches> [rounds]
const { fork } = require('child_process'), os = require('os');
if (process.env.DDB_AHEAD) {
  const [aSpec, bSpec, n, seed0, R] = JSON.parse(process.env.DDB_AHEAD);
  const { playMatch, G } = require('./sim.js'), { brainFrom } = require('./run.js'), A = brainFrom(aSpec), B = brainFrom(bSpec), cat = {};
  for (let i = 0; i < n; i++) {
    const swap = i % 2; let pre;
    const r = playMatch(swap ? { me: B, ai: A } : { me: A, ai: B }, seed0 + i, R, (m, rd) => { if (rd === R - 1) { const mk = id => { const x = G.Board.marker(m.board, id, 'best'); return x && x.n > 3 ? x : null; }; pre = { a: mk(swap ? 'ai' : 'me'), b: mk(swap ? 'me' : 'ai') }; } });
    if (r.stalled) continue;
    const aS = swap ? 'ai' : 'me', na = pre.a ? pre.a.n : 0, nb = pre.b ? pre.b.n : 0;
    const rel = na > nb ? 'A ahead' : na < nb ? 'B ahead' : na === 0 ? 'both none' : pre.a.rank < pre.b.rank ? 'tie, A first' : 'tie, B first';
    const t = cat[rel] = cat[rel] || { n: 0, aw: 0 }; t.n++; if (r.winner === aS) t.aw++;
  }
  process.send(cat);
} else {
  const [a, b, nS = '400', R = '4'] = process.argv.slice(2), cpus = os.cpus().length, per = Math.ceil(Number(nS) / cpus), agg = {}; let done = 0;
  for (let i = 0; i < cpus; i++) {
    const w = fork(__filename, [], { env: { ...process.env, DDB_AHEAD: JSON.stringify([a, b, per, 1 + i * 100000, Number(R)]) } });
    w.on('message', c => { for (const k in c) { const x = agg[k] = agg[k] || { n: 0, aw: 0 }; x.n += c[k].n; x.aw += c[k].aw; } });
    w.on('exit', () => { if (++done === cpus) { let tn = 0, tw = 0; for (const [k, v] of Object.entries(agg)) { tn += v.n; tw += v.aw; console.log(k.padEnd(14), 'n', String(v.n).padStart(4), `(${(100 * v.n / 1).toFixed(0)})`.replace(/\(.*\)/, ''), 'A wins', (v.aw / v.n).toFixed(2)); } console.log('total A', (tw / tn).toFixed(3), 'of', tn); } });
  }
}
