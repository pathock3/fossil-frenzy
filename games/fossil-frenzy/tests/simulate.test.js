const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

test('tools/simulate.js runs end to end and reports both modes', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ff-sim-'));
  const out = path.join(dir, 'results.json');
  execFileSync('node', [path.join(__dirname, '..', 'tools', 'simulate.js'), '--games', '6', '--out', out], { stdio: ['ignore', 'pipe', 'ignore'] });
  const r = JSON.parse(fs.readFileSync(out, 'utf8'));
  for (const mode of ['on', 'off']) {
    assert.equal(r.modes[mode].equal4.games, 6);
    assert.ok(r.modes[mode].equal4.turns.mean > 10);
    assert.equal(r.modes[mode].mixedWide.rows.length, 4);
    assert.equal(r.modes[mode].curve.length, 5);
  }
  assert.ok(fs.readFileSync(path.join(dir, 'tables.md'), 'utf8').includes('Table 1'));
});
