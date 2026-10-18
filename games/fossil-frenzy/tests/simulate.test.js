const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

test('tools/simulate.js runs end to end: baseline, memory skill and the campaign ladder', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ff-sim-'));
  const out = path.join(dir, 'results.json');
  execFileSync('node', [path.join(__dirname, '..', 'tools', 'simulate.js'), '--games', '6', '--out', out], { stdio: ['ignore', 'pipe', 'ignore'] });
  const r = JSON.parse(fs.readFileSync(out, 'utf8'));
  assert.equal(r.equal4.games, 6);
  assert.ok(r.equal4.turns.mean > 10);
  assert.deepEqual(Object.keys(r.byPlayers), ['2', '3', '4']);
  assert.equal(r.mixedWide.rows.length, 4);
  assert.equal(r.curve.length, 5);
  assert.deepEqual(r.levels, ['Beginner', 'Novice', 'Normal', 'Challenging', 'Master']);
  assert.equal(r.ladder.length, 5);
  assert.ok(r.ladder.every((row, i) => row.length === 5 && row[i] === null && row.filter(Boolean).length === 4));
  assert.equal(r.vsReference.length, 5);
  assert.ok(fs.readFileSync(path.join(dir, 'tables.md'), 'utf8').includes('Table 6'));
});
