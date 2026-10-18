// The app is the Tabletop Library; Fossil Frenzy is a game inside it. Keep the two names from drifting back together.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const stripJsonc = s => s.replace(/^\s*\/\/.*$/gm, '');

test('naming: package.json and the Cloudflare config are named tabletop-library', () => {
  assert.equal(JSON.parse(read('package.json')).name, 'tabletop-library');
  assert.equal(JSON.parse(stripJsonc(read('wrangler.jsonc'))).name, 'tabletop-library');
});

test('naming: the docs point at the tabletop-library web addresses, not the old fossil-frenzy ones', () => {
  for (const f of ['README.md', 'docs/PLAN.md', 'CLAUDE.md']) {
    assert.doesNotMatch(read(f), /fossil-frenzy\.patrickhockberger|fvc0jn-fossil-frenzy/, `${f} still links to the old address`);
  }
  assert.match(read('README.md'), /https:\/\/tabletop-library\.patrickhockberger\.workers\.dev\//);
});

test('naming: the game stores everything under tabletop-library-fossil-frenzy-…; the old fossil-frenzy-… keys appear only in the cleanup list', () => {
  const html = read('games/fossil-frenzy/index.html');
  const code = html.match(/<script id="ui">([\s\S]*?)<\/script>/)[1];
  assert.match(code, /const NS = 'tabletop-library-fossil-frenzy-'/);
  const outsideLegacy = code.split('\n').filter(l => !l.includes('LEGACY_KEYS')).join('\n');
  assert.doesNotMatch(outsideLegacy, /'fossil-frenzy-[a-z0-9-]+'/, 'an old-style storage key is still in use');
});

test('naming: the library is titled Tabletop Library; the game keeps its own title', () => {
  assert.match(read('index.html'), /<title>Tabletop Library<\/title>/);
  assert.match(read('index.html'), /apple-mobile-web-app-title" content="Tabletop Library"/);
  assert.match(read('games/fossil-frenzy/index.html'), /<title>Fossil Frenzy<\/title>/);
});
