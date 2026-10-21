// Win probability by position, measured in self-play:  node tools/gather.js '<brain A>' '<brain B>' <matches per round count> <out.json>
// Key "left|a|b|t": rounds still to play after this one, my best, their best (0 if not past the Crown's 3), t = +1/-1 when level and I hold the better/worse spot.
const { fork } = require('child_process'), os = require('os'), fs = require('fs');
function key(m, me, other, left) {
  const B = require('./sim.js').G.Board, crown = m.board.crownStart;
  const mk = id => B.marker(m.board, id, 'best'), a = mk(me), b = mk(other);
  const na = a && a.n > crown ? Math.min(a.n, 8) : 0, nb = b && b.n > crown ? Math.min(b.n, 8) : 0;
  const t = na && na === nb ? (a.rank < b.rank ? 1 : -1) : 0;
  return left + '|' + na + '|' + nb + '|' + t;
}
if (process.env.DDB_GATHER) {
  const [aSpec, bSpec, n, seed0, roundList] = JSON.parse(process.env.DDB_GATHER);
  const { playMatch } = require('./sim.js'), { brainFrom } = require('./run.js'), A = brainFrom(aSpec), B = brainFrom(bSpec), tab = {};
  for (const rounds of roundList) for (let i = 0; i < n; i++) {
    const obs = [];
    const r = playMatch(i % 2 ? { me: B, ai: A } : { me: A, ai: B }, seed0 + i, rounds, (m, rd) => { if (rd < rounds) { const left = rounds - rd; obs.push([key(m, 'me', 'ai', left), key(m, 'ai', 'me', left)]); } });
    if (r.stalled) continue;
    for (const [km, ka] of obs) {
      for (const [k, who] of [[km, 'me'], [ka, 'ai']]) { const t = tab[k] = tab[k] || { n: 0, w: 0 }; t.n++; t.w += r.winner === who ? 1 : r.winner === null ? 0.5 : 0; }
    }
  }
  process.send(tab);
} else if (require.main === module) {
  const [a, b, nS = '5000', out = 'phi.json', rl = '2,3,4,5,6'] = process.argv.slice(2), cpus = os.cpus().length, per = Math.ceil(Number(nS) / cpus); const agg = {}; let done = 0;
  for (let i = 0; i < cpus; i++) {
    const w = fork(__filename, [], { env: { ...process.env, DDB_GATHER: JSON.stringify([a, b, per, 1 + i * 100000, rl.split(',').map(Number)]) } });
    w.on('message', t => { for (const k in t) { const x = agg[k] = agg[k] || { n: 0, w: 0 }; x.n += t[k].n; x.w += t[k].w; } });
    w.on('exit', () => { if (++done === cpus) { fs.writeFileSync(out, JSON.stringify(agg)); console.log('wrote', out, Object.keys(agg).length, 'cells'); } });
  }
}
