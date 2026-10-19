// The Tabletop Library: catalogue integrity (Node) and tapping through to a game and back (browser, skipped without Playwright).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const http = require('http');
const path = require('path');
const vm = require('vm');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const LIBRARY = vm.runInNewContext(html.match(/<script id="data">([\s\S]*?)<\/script>/)[1] + ';LIBRARY');
const gameDirs = fs.readdirSync(path.join(root, 'games')).filter(d => fs.existsSync(path.join(root, 'games', d, 'index.html')));

test('library: the collection is called Tabletop Library', () => {
  assert.equal(LIBRARY.name, 'Tabletop Library');
  assert.match(html, /<title>Tabletop Library<\/title>/);
});

test('library: the designer is credited once, at the top — not under each game', () => {
  assert.equal(LIBRARY.tagline, 'Games designed by Patrick Blim-Hockberger');
  assert.ok(LIBRARY.games.every(g => !('by' in g)), 'games carry no per-game credit');
  assert.doesNotMatch(html, /Designed by \$\{/);
});

test('library: every game folder is in the catalogue, and every local catalogue entry has a game', () => {
  const ids = LIBRARY.games.map(g => g.id);
  assert.equal(new Set(ids).size, ids.length, 'ids are unique');
  for (const d of gameDirs) assert.ok(ids.includes(d), `games/${d} is missing from the catalogue`);
  for (const g of LIBRARY.games.filter(g => g.path)) {
    assert.equal(g.path, `games/${g.id}/index.html`);
    assert.ok(gameDirs.includes(g.id), `${g.id} has no games/${g.id}/index.html`);
  }
});

test('library: every entry has what the shelf shows; entries without an address are never listed', () => {
  for (const g of LIBRARY.games) {
    assert.ok(g.title && g.tagline && g.icon && g.accent && g.art, g.id);
    if (g.listed) assert.ok(g.path || g.url, `${g.id} is listed but has no address`);
  }
  assert.ok(LIBRARY.games.find(g => g.id === 'fossil-frenzy').listed);
});

test('library: Dig Dig Boom is a separate site — a placeholder entry, off the shelf until it has a web address', () => {
  const d = LIBRARY.games.find(g => g.id === 'dig-dig-boom');
  assert.equal(d.listed, false);
  assert.equal(d.path, undefined);
  assert.ok('url' in d);
});

// ---------- browser ----------
function findChromium() {
  for (const t of [() => require('playwright'), () => require(path.join(execSync('npm root -g').toString().trim(), 'playwright'))]) { try { return t().chromium; } catch (e) { /* next */ } }
  return null;
}
const chromium = findChromium();
const exe = ['/opt/pw-browsers/chromium'].find(p => fs.existsSync(p));
const serve = () => new Promise(resolve => {
  const server = http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split('?')[0]);
    const f = path.join(root, u.endsWith('/') ? u + 'index.html' : u);
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html' : 'text/plain' });
    res.end(fs.readFileSync(f));
  }).listen(0, '127.0.0.1', () => resolve(server));
});

test('library (browser): the shelf shows the listed games; tapping a box opens the game; the game links back', { skip: !chromium && 'Playwright/Chromium not available', timeout: 60000 }, async () => {
  const server = await serve(), base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  try {
    const page = await (await browser.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true, isMobile: true })).newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(base + '/index.html');
    assert.equal(await page.title(), 'Tabletop Library');
    assert.equal(await page.evaluate(() => getComputedStyle(document.body).overscrollBehaviorY), 'none', 'no pull-to-refresh on the shelf');
    assert.equal(await page.locator('a.box').count(), 1, 'only listed games with an address are on the shelf');
    assert.match(await page.locator('a.box').getAttribute('aria-label'), /Fossil Frenzy/);
    // a box is a picture first: cover art (an SVG) only, not a paragraph of text
    assert.equal(await page.locator('a.box .art svg').count(), 1, 'cover art');
    assert.match(await page.locator('a.box .art svg').getAttribute('aria-label'), /Fossil Frenzy/);
    const box = await page.locator('a.box').boundingBox();
    assert.ok(box.width >= 240 && box.height >= box.width * 1.2, 'a box is a big, upright rectangle: ' + JSON.stringify(box));
    assert.equal(await page.locator('a.box p').count(), 0, 'no paragraph of text on the box');
    assert.equal(await page.locator('a.box .strip, a.box .pill, a.box .played').count(), 0, 'nothing but the cover art: no players, no time, no Played tag');
    assert.match(await page.locator('a.box').getAttribute('aria-label'), /1–4 players/, 'the player count is still there for screen readers');
    // the tagline in the ribbon fits inside its oval
    const fit = await page.evaluate(() => { const svg = document.querySelector('a.box .art svg'), t = [...svg.querySelectorAll('text')].find(x => /PEEK/.test(x.textContent)), r = [...svg.querySelectorAll('rect')].find(x => x.getAttribute('rx') === '13'); const tb = t.getBBox(), rb = r.getBBox(); return { tx: tb.x, tr: tb.x + tb.width, rx: rb.x, rr: rb.x + rb.width }; });
    assert.ok(fit.tx >= fit.rx + 10 && fit.tr <= fit.rr - 10, 'the words sit inside the oval: ' + JSON.stringify(fit));
    await page.goto(base + '/index.html?unlisted');
    assert.equal(await page.locator('a.box').count(), 1, 'an unlisted placeholder without an address still does not render a dead link');
    await page.goto(base + '/index.html');
    await page.tap('a.box');
    await page.waitForURL('**/games/fossil-frenzy/index.html');
    assert.match(await page.locator('h1').first().innerText(), /Fossil\s+Frenzy/);
    const back = await page.locator('a.back').boundingBox();
    assert.ok(back.x < 40 && back.y < 40, 'the way back is in the very top-left corner: ' + JSON.stringify(back));
    assert.ok(back.height >= 44, 'and big enough to tap: ' + JSON.stringify(back));
    await page.tap('a.back');
    await page.waitForURL(base + '/index.html');
    assert.equal(await page.title(), 'Tabletop Library');
    assert.equal(await page.locator('.played').count(), 0, 'boxes carry no Played tag');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); server.close(); }
});
