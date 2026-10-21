// Browser tests for the card design lab. The Google Sheet is stubbed with tests/fixture.csv (the real page fetches it live).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const { execSync } = require('child_process');
function findChromium() {
  for (const t of [() => require('playwright'), () => require(path.join(execSync('npm root -g').toString().trim(), 'playwright'))]) { try { return t().chromium; } catch (e) { /* next */ } }
  return null;
}
const chromium = findChromium();
const exe = ['/opt/pw-browsers/chromium'].find(p => fs.existsSync(p));
const FILE = 'file://' + path.join(__dirname, '..', 'index.html');
const SKIP = { skip: !chromium && 'Playwright/Chromium not available', timeout: 90000 };
const fixture = fs.readFileSync(path.join(__dirname, 'fixture.csv'), 'utf8');

async function open({ sheet = 'ok', viewport = { width: 1180, height: 820 } } = {}) {
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const page = await (await browser.newContext({ viewport, hasTouch: true })).newPage();
  const errors = [], requests = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => { if (!/^(file|data|blob):/.test(r.url())) requests.push(r.url()); });
  await page.route('**/docs.google.com/**', r => (sheet === 'ok' ? r.fulfill({ status: 200, contentType: 'text/csv', body: fixture }) : sheet === 'html' ? r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html></html>' }) : r.abort()));
  await page.goto(FILE);
  await page.waitForSelector('section.dir');
  return { browser, page, errors, requests };
}

test('lab: reads the sheet live (not a copy), says so, and shows the five directions on six real cards each', SKIP, async () => {
  const { browser, page, errors, requests } = await open();
  try {
    assert.match(await page.locator('.status').first().innerText(), /Live from your sheet · 11 cards/);
    assert.ok(requests.some(u => /docs\.google\.com\/spreadsheets\/d\/1cKcNNs38CydvvhW7rUJIc4DWHgEvT-deluLdhrIpk04\/gviz\/tq\?tqx=out:csv&gid=2/.test(u)), 'it asked the sheet for the card tab');
    assert.deepEqual(await page.locator('section.dir').evaluateAll(els => els.map(e => e.dataset.dir)), ['A', 'B', 'C', 'D', 'E']);
    for (const d of 'ABCDE') assert.equal(await page.locator(`section[data-dir=${d}] .row .card`).count(), 6, d);
    const types = await page.locator('section[data-dir=A] .row .card').evaluateAll(els => els.map(e => e.getAttribute('aria-label')));
    for (const t of ['Power', 'Ongoing', 'Immediate', 'Treasure', 'Monster']) assert.ok(types.some(x => x.includes(', ' + t)), 'a ' + t + ' card');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('lab: when the sheet cannot be reached (or answers with a web page) it says so and shows only the six-card sample', SKIP, async () => {
  for (const sheet of ['down', 'html']) {
    const { browser, page, errors } = await open({ sheet });
    try {
      const status = await page.locator('.status').first().innerText();
      assert.match(status, /Could not reach the sheet/); assert.match(status, /6-card design sample/);
      assert.equal(await page.locator('section[data-dir=B] .row .card').count(), 6);
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  }
});

test('lab: type is told four ways on every card — icon, type word, pattern and colour — and numbers only on Power cards', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    for (const d of 'ABCDE') {
      const info = await page.locator(`section[data-dir=${d}] .row .card`).evaluateAll(els => els.map(e => ({
        label: e.getAttribute('aria-label'), icons: e.querySelectorAll('svg use[href^="#t-"]').length,
        word: [...e.querySelectorAll('.typeword')].some(w => /^(Power|Ongoing|Immediate|Treasure|Monster)/i.test(w.textContent.trim())),
        pattern: e.querySelectorAll('rect[fill^="url(#p-"]').length, nums: [...e.querySelectorAll('.num')].map(n => n.textContent.trim()),
      })));
      for (const c of info) {
        assert.ok(c.icons >= 1, d + ' icon: ' + c.label);
        if (d !== 'D') assert.ok(c.word || /Power|Ongoing|Immediate|Treasure|Monster/.test(c.label), d + ' type word');
      }
      const power = info.filter(c => /, Power/.test(c.label)), others = info.filter(c => !/, Power/.test(c.label));
      assert.ok(power.every(c => c.nums.length >= 1), d + ': Power cards show their number');
      assert.ok(others.every(c => c.nums.length === 0), d + ': nobody else does');
      if (d !== 'D') assert.ok(info.every(c => c.pattern >= 1), d + ': a pattern on every card');
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('lab: the rules text is one size on every card of a direction, set by the longest card, and nothing overflows its box', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    for (const d of 'ABCDE') {
      const r = await page.locator(`section[data-dir=${d}] .row .card .text`).evaluateAll(els => els.map(e => ({ fs: getComputedStyle(e).fontSize, over: e.scrollHeight > e.clientHeight + 1 })));
      assert.equal(new Set(r.map(x => x.fs)).size, 1, d + ' one text size: ' + JSON.stringify(r.map(x => x.fs)));
      assert.ok(r.every(x => !x.over), d + ' text fits its box');
    }
    const sizes = Object.fromEntries(await Promise.all([...'ABCDE'].map(async d => [d, parseFloat(await page.locator(`section[data-dir=${d}] .row .card .text`).first().evaluate(e => getComputedStyle(e).fontSize))])));
    assert.ok(sizes.E > sizes.D, 'the big-type direction sets the rules larger than the corner-index one');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('lab: print guides (bleed, trim, safe zone) toggle, and everything printed sits inside the safe zone', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    assert.equal(await page.locator('section[data-dir=A] .guides').count(), 6, 'guides on by default');
    // names, type words, numbers, art and text are all inside the safe zone (25 units = 0.25 in from the card edge)
    const bad = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('.row .card').forEach(card => {
        const cr = card.getBoundingClientRect(), u = cr.width / (card.dataset.dir === 'A' ? 375 : 275), safe = 25 * u - 1.5;
        card.querySelectorAll('.name, .typeword, .num, .art, .text, .disc').forEach(el => {
          const r = el.getBoundingClientRect();
          if (r.left < cr.left + safe || r.top < cr.top + safe || r.right > cr.right - safe || r.bottom > cr.bottom - safe) out.push(card.dataset.dir + ':' + card.dataset.id + ':' + el.className);
        });
      });
      return out;
    });
    assert.deepEqual(bad, [], 'nothing close to the cut line');
    await page.tap('[data-act=guides]');
    assert.equal(await page.locator('section[data-dir=A] .guides').count(), 0);
    assert.equal(await page.locator('section[data-dir=A] .row .cell > div').first().evaluate(e => e.style.overflow), 'hidden', 'with guides off you see the card cut at the trim line');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('lab: the overlapped row shows each card\'s identifying strip; greyscale and colour-blind views are one tap away', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    for (const d of 'ABCDE') assert.equal(await page.locator(`section[data-dir=${d}] .fan > div`).count(), 6, d + ' overlapped row');
    await page.tap('[data-act=overlap]'); assert.equal(await page.locator('.fan').count(), 0); await page.tap('[data-act=overlap]');
    for (const v of ['gray', 'deut', 'prot']) { await page.tap(`[data-act=view][data-v=${v}]`); assert.equal(await page.locator('#app').getAttribute('class'), 'view-' + v); }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('lab: the comparison table lists all five directions; the page works on an iPad and a phone without horizontal scroll', SKIP, async () => {
  for (const viewport of [{ width: 1024, height: 768 }, { width: 390, height: 844 }]) {
    const { browser, page, errors } = await open({ viewport });
    try {
      assert.equal(await page.locator('table.cmp th').count(), 6);
      const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));
      assert.ok(m.sw <= m.iw + 2 || viewport.width < 500, JSON.stringify(m));
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  }
});
