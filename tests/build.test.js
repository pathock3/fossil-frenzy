const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const build = (env = {}) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ff-build-'));
  execFileSync('node', [path.join(__dirname, '..', 'tools', 'build.js'), dir], { env: { ...process.env, ...env }, stdio: 'ignore' });
  return fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
};
const stamp = html => html.match(/<meta name="build" content="([^"]*)">/)[1];

test('build: output is the single index.html, stamped with commit, date and branch', () => {
  const html = build({ WORKERS_CI_COMMIT_SHA: 'abcdef1234567', WORKERS_CI_BRANCH: 'claude/test-branch' });
  assert.match(stamp(html), /^abcdef1 · \d{4}-\d\d-\d\d · preview: claude\/test-branch$/);
  const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.equal(html.length - src.length, stamp(html).length - '__BUILD__'.length, 'only the stamp changes');
});

test('build: production (main) builds are not labelled as previews', () => {
  const html = build({ WORKERS_CI_COMMIT_SHA: 'abcdef1234567', WORKERS_CI_BRANCH: 'main' });
  assert.doesNotMatch(stamp(html), /preview/);
});

test('build: the unbuilt index.html still opens on its own and calls itself a local file', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.equal(stamp(src), '__BUILD__');
  assert.match(src, /'local file'/);
});
