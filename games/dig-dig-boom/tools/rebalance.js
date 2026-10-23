// Rebalancing the Booster cards, one damped step at a time:   measure -> propose -> apply, repeat.
//
//   node games/dig-dig-boom/tools/rebalance.js init  <dir>                 copy the sheet fixture and the proposed new cards into <dir> (working copies: the repo is not touched)
//   node games/dig-dig-boom/tools/rebalance.js measure <dir>               value of every card (Monsters survived before the BOOM, with the card minus without it, same Mines and dice)
//   node games/dig-dig-boom/tools/rebalance.js propose <dir>               for each card outside the band: the one-number change that moves it about half the way back to the band
//   node games/dig-dig-boom/tools/rebalance.js apply <dir>                 write the proposal into the working copies and note it in <dir>/changes.log
//   node games/dig-dig-boom/tools/rebalance.js loop <dir> [rounds]         measure + propose + apply, again and again
//   node games/dig-dig-boom/tools/rebalance.js publish <dir>               copy the working copies back over the fixture and NEW-BOOSTERS.csv
//
// How it keeps from just shuffling the order: only cards BELOW the band's floor are buffed, and only up to halfway to the floor (never past it); only cards ABOVE the ceiling
// are nerfed, and only halfway down to the ceiling. Cards inside the band are never touched, so a buffed card cannot overtake the others, and the strongest are trimmed a little each round.
// The measuring uses many contexts and few Digs each, with the same Mines and dice for every card, so a difference between two versions of a card is far less noisy than either value alone.
//   env: RB_FLOOR (default 0.25), RB_CEIL (1.8), RB_CTX (120), RB_N (100), RB_SEED (0)
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const { Engine, DDB } = require('../tests/load.js');
const root = path.join(__dirname, '..'), tool = path.join(__dirname, 'cardvalue.js');
const [cmd, dir, arg] = process.argv.slice(2);
if (!cmd || !dir) { console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(0, 12).join('\n')); process.exit(1); }
const FLOOR = Number(process.env.RB_FLOOR || 0.25), CEIL = Number(process.env.RB_CEIL || 1.8), CTX = process.env.RB_CTX || '120', N = process.env.RB_N || '100', SEED = process.env.RB_SEED || '0';
const OVER = Number(process.env.RB_OVER || 0.25), f = n => path.join(dir, n);
// Cards whose worth is not "how many Monsters you survive with it in your kit": they work through other cards, through what you keep, or by dodging Monsters (which this measure cannot credit).
// They are measured and shown, never changed by this tool.
const FIXED = new Set(['IM-06', 'IM-22', 'IM-32', 'IM-33', 'IM-04', 'IM-24', 'ON-06', 'IM-35', 'IM-14', 'IM-15', 'IM-16', 'PW-22', 'IM-17', 'IM-03', 'IM-30', 'IM-63', 'IM-08', 'IM-66', 'IM-01']);

const readCSV = file => Engine.parseCSV(fs.readFileSync(file, 'utf8'));
const q = v => /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
const writeCSV = (file, rows) => fs.writeFileSync(file, rows.map(r => r.map(q).join(',')).join('\n') + '\n');
const run = (env, args) => execFileSync('node', [tool, ...args], { env: { ...process.env, CV_BASE: f('base.csv'), CV_EXTRA: f('new.csv'), CV_CTX: CTX, CV_SEED: SEED, ...env }, stdio: ['ignore', 'pipe', 'inherit'] });
const rowsOf = () => { const out = {}; for (const file of ['base.csv', 'new.csv']) { const rows = readCSV(f(file)), h = rows[0]; for (const r of rows.slice(1)) out[r[0]] = { id: r[0], name: r[1], type: r[2], number: r[3], text: r[6] }; } return out; };
const median = a => { const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

function measure() {
  run({}, [N, f('values.json')]);
  const v = JSON.parse(fs.readFileSync(f('values.json'), 'utf8')), info = rowsOf();
  const list = Object.keys(v).map(id => ({ id, v: v[id].mean, ...info[id] })).sort((a, b) => a.v - b.v);
  const tun = list.filter(x => !FIXED.has(x.id)), M = median(tun.map(x => x.v));
  const low = tun.filter(x => x.v < FLOOR), high = tun.filter(x => x.v > CEIL);
  console.log(`${list.length} cards (${tun.length} tuned, ${list.length - tun.length} fixed); median ${M.toFixed(2)}; band ${FLOOR}..${CEIL}; below ${low.length}, above ${high.length}`);
  for (const x of list) console.log(`${x.v.toFixed(2).padStart(6)} ${x.id} ${x.name.slice(0, 20).padEnd(20)} ${(x.number || '').padStart(2)} ${x.text.slice(0, 64)}${FIXED.has(x.id) ? '  (fixed)' : x.v < FLOOR ? '  <- low' : x.v > CEIL ? '  <- high' : ''}`);
  return { list, low, high };
}
function propose() {
  const v = JSON.parse(fs.readFileSync(f('values.json'), 'utf8')), info = rowsOf();
  const M = median(Object.keys(v).filter(id => !FIXED.has(id)).map(id => v[id].mean)), out = [], ids = Object.keys(v).filter(id => !FIXED.has(id) && (v[id].mean < FLOOR || v[id].mean > CEIL));
  if (!ids.length) { fs.writeFileSync(f('proposal.json'), '[]'); console.log('nothing outside the band'); return []; }
  const vars = JSON.parse(run({ CV_IDS: ids.join(',') }, ['variants', N, f('variants.json')]) && fs.readFileSync(f('variants.json'), 'utf8'));
  for (const id of ids) {
    const v0 = v[id].mean, edge = v0 < FLOOR ? FLOOR : CEIL, target = v0 + (edge - v0) / 2, dir = Math.sign(edge - v0);
    const ok = c => (c.mean - v0) * dir > 0.05, byTarget = c => ({ ...c, d: Math.abs(c.mean - target) });
    let cands = (vars[id] || []).filter(c => ok(c) && (c.mean - edge) * dir < OVER).map(byTarget);          // a change that stays near the band's edge...
    if (!cands.length) cands = (vars[id] || []).filter(c => ok(c) && (c.mean - M) * dir <= 0).map(byTarget);          // ...or else the nearest one that still does not carry the card past the middle of the pack
    cands.sort((a, b) => a.d - b.d);
    const r = info[id], pick = cands[0];
    if (!pick) { console.log(`${id} ${r.name}: ${v0.toFixed(2)} — no one-number change moves it the right way (needs a design change)`); continue; }
    out.push({ id, name: r.name, v0, target, from: { text: r.text, number: r.number }, to: { text: pick.text, number: pick.number === undefined ? r.number : String(pick.number), v: pick.mean } });
    console.log(`${id} ${r.name}: ${v0.toFixed(2)} -> ${pick.mean.toFixed(2)} (aim ${target.toFixed(2)})   ${r.number ? '[' + r.number + '] ' : ''}${r.text}  =>  ${pick.number !== undefined && String(pick.number) !== r.number ? '[' + pick.number + '] ' : ''}${pick.text}`);
  }
  fs.writeFileSync(f('proposal.json'), JSON.stringify(out, null, 1)); return out;
}
function apply() {
  const prop = JSON.parse(fs.readFileSync(f('proposal.json'), 'utf8')); if (!prop.length) return 0;
  for (const file of ['base.csv', 'new.csv']) {
    const rows = readCSV(f(file)); let hit = 0;
    for (const p of prop) { const r = rows.find(x => x[0] === p.id); if (!r) continue; r[6] = p.to.text; if (p.to.number !== undefined && r[3] !== '') r[3] = p.to.number; hit++; }
    if (hit) writeCSV(f(file), rows);
  }
  fs.appendFileSync(f('changes.log'), prop.map(p => `${p.id}\t${p.name}\t${p.v0.toFixed(2)}->${p.to.v.toFixed(2)}\t${p.from.number}|${p.from.text}\t=>\t${p.to.number}|${p.to.text}`).join('\n') + '\n---\n');
  return prop.length;
}
if (cmd === 'init') {
  fs.mkdirSync(dir, { recursive: true }); fs.copyFileSync(path.join(root, 'tests', 'cards-full.csv'), f('base.csv')); fs.copyFileSync(path.join(root, 'NEW-BOOSTERS.csv'), f('new.csv'));
  fs.writeFileSync(f('changes.log'), ''); console.log('working copies in', dir);
} else if (cmd === 'measure') measure();
else if (cmd === 'propose') propose();
else if (cmd === 'apply') console.log('applied', apply(), 'changes');
else if (cmd === 'loop') {
  for (let i = 1; i <= Number(arg || 3); i++) {
    console.log(`\n===== round ${i} =====`); const m = measure(); if (!m.low.length && !m.high.length) { console.log('all inside the band'); break; }
    const p = propose(); if (!p.length) break; apply();
  }
} else if (cmd === 'publish') {
  fs.copyFileSync(f('base.csv'), path.join(root, 'tests', 'cards-full.csv')); fs.copyFileSync(f('new.csv'), path.join(root, 'NEW-BOOSTERS.csv')); console.log('copied back');
}
