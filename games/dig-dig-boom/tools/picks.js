// Which Booster cards does the AI actually take? A quick balance check: whatever the AI keeps rarely when it is offered is a little weak.
//   node games/dig-dig-boom/tools/picks.js [matches=800] [level=medium] [out.json]
// Plays whole matches (the AI against itself, 4 rounds) and counts, for every card, how often it was offered in a Booster Pack and how often it was kept.
// Extra candidate cards (NEW-CARDS*.csv) can be mixed into the Booster Deck with CV_EXTRA=<path>,<path> (as for tools/cardvalue.js).
const { fork } = require('child_process'), os = require('os'), fs = require('fs'), path = require('path');
if (process.env.DDB_WORKER) {
  const [n, lvl, seed0] = JSON.parse(process.env.DDB_WORKER);
  const { G, playMatch } = require('./sim.js');
  const offered = {}, kept = {}, orig = G.Run.confirmKeep;
  G.Run.confirmKeep = function (run) {
    const pr = run.prep;
    if (pr && pr.step === 'keep') {
      for (const c of pr.offer) offered[c.id] = (offered[c.id] || 0) + 1;
      for (const id of pr.picked) { const c = pr.offer.find(x => x.uid === id); if (c) kept[c.id] = (kept[c.id] || 0) + 1; }
    }
    return orig.call(this, run);
  };
  let stalls = 0;
  for (let i = 0; i < n; i++) { const b = G.AI.level(lvl); const r = playMatch({ me: b, ai: b }, seed0 + i, 4); if (r.stalled) stalls++; }
  process.send({ offered, kept, stalls });
} else {
  const n = Number(process.argv[2] || 800), lvl = process.argv[3] || 'medium', out = process.argv[4], cpus = Math.min(os.cpus().length, 8), per = Math.ceil(n / cpus);
  const tot = { offered: {}, kept: {}, stalls: 0 }; let done = 0;
  for (let i = 0; i < cpus; i++) {
    const w = fork(__filename, [], { env: { ...process.env, DDB_WORKER: JSON.stringify([per, lvl, 5000 + i * per]) } });
    w.on('message', r => { for (const k of Object.keys(r.offered)) tot.offered[k] = (tot.offered[k] || 0) + r.offered[k]; for (const k of Object.keys(r.kept)) tot.kept[k] = (tot.kept[k] || 0) + r.kept[k]; tot.stalls += r.stalls; });
    w.on('exit', () => { if (++done === cpus) { if (out) fs.writeFileSync(out, JSON.stringify(tot)); report(tot); } });
  }
  function report(t) {
    const { G } = require('./sim.js'), rows = Object.keys(t.offered).map(id => ({ id, o: t.offered[id], k: t.kept[id] || 0 })).map(r => ({ ...r, rate: r.k / r.o }));
    rows.sort((a, b) => a.rate - b.rate);
    console.log('card | offered | kept | pick rate'); for (const r of rows) console.log(`${r.id} | ${r.o} | ${r.k} | ${(r.rate * 100).toFixed(1)}%`);
    console.log('stalls', t.stalls);
  }
}
