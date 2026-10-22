// The thinking AI lives in the game (script "ai" in index.html); this just builds one with tuning overrides for experiments.
//   makeBrain({ rolls: 20, phi: tableFromFile('phi1.json') })
const { G } = require('./sim.js');
const fs = require('fs'), path = require('path');
// a win-chance table written by tools/gather.js ({ key: { n, w } }) in the game's form ({ key: [w, n] })
function tableFromFile(file) {
  const t = JSON.parse(fs.readFileSync(path.isAbsolute(file) ? file : path.join(__dirname, file), 'utf8')), out = {};
  for (const k in t) if (t[k].n >= 5) out[k] = [Math.round(t[k].w * 10) / 10, t[k].n];
  return out;
}
const makeBrain = (over = {}) => G.AI.make(typeof over.phi === 'string' ? { ...over, phi: tableFromFile(over.phi) } : over);
module.exports = { makeBrain, tableFromFile };

if (require.main === module) {
  const { tournament } = require('./sim.js');
  const n = Number(process.argv[2] || 100), t = Date.now();
  tournament(makeBrain(), G.Basic, { n });
  console.log(((Date.now() - t) / 1000).toFixed(1) + ' s');
}
