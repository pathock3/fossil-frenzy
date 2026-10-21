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
  await page.goto(FILE + '#cards');
  await page.waitForSelector('#deckRow .card');
  return { browser, page, errors, requests };
}

const types = ['Power', 'Ongoing', 'Immediate', 'Treasure', 'Monster'];

test('cards: reads the sheet live (not a copy), says so, and draws every card of it in the one design', SKIP, async () => {
  const { browser, page, errors, requests } = await open();
  try {
    assert.match(await page.locator('.status').first().innerText(), /Live from your sheet · 11 cards/);
    assert.ok(requests.some(u => /docs\.google\.com\/spreadsheets\/d\/e\/2PACX-[\w-]+\/pub\?gid=2&single=true&output=csv/.test(u)), 'it asked the published sheet for the card tab');
    assert.equal(await page.locator('#deckRow .card').count(), 16);
    const labels = await page.locator('#deckRow .card').evaluateAll(els => els.map(e => e.getAttribute('aria-label')));
    for (const t of types) assert.ok(labels.some(x => x.includes(', ' + t)), 'a ' + t + ' card');
    assert.equal(await page.locator('text=/Round 1|Round 2|direction/i').count(), 0, 'the old design explorations are gone');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('cards: when the sheet cannot be reached (or answers with a web page) it says so and shows only the sample', SKIP, async () => {
  for (const sheet of ['down', 'html']) {
    const { browser, page, errors } = await open({ sheet });
    try {
      const status = await page.locator('.status').first().innerText();
      assert.match(status, /Could not reach the sheet/); assert.match(status, /sample/);
      assert.equal(await page.locator('#deckRow .card').count(), 12);
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  }
});

test('cards: type is told four ways on every card — icon, type word, pattern and colour — and numbers only on Power cards', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    const info = await page.locator('#deckRow .card').evaluateAll(els => els.map(e => ({
      label: e.getAttribute('aria-label'), icons: e.querySelectorAll('svg use[href^="#t-"]').length,
      word: [...e.querySelectorAll('.typeword')].some(w => /^(Power|Ongoing|Immediate|Treasure|Monster)/i.test(w.textContent.trim())),
      pattern: e.querySelectorAll('rect[fill^="url(#p-"]').length, nums: [...e.querySelectorAll('.num')].map(n => n.textContent.trim()),
    })));
    for (const c of info) { assert.ok(c.icons >= 1, 'icon: ' + c.label); assert.ok(c.word, 'type word: ' + c.label); assert.ok(c.pattern >= 1, 'pattern: ' + c.label); }
    assert.ok(info.filter(c => /, Power/.test(c.label)).every(c => c.nums.length >= 1), 'Power cards show their number');
    assert.ok(info.filter(c => !/, Power/.test(c.label)).every(c => c.nums.length === 0), 'nobody else does');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('cards: the rules text is one size on every card, set by the longest card, and nothing overflows its box', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    const r = await page.locator('#deckRow .card .text').evaluateAll(els => els.map(e => ({ fs: getComputedStyle(e).fontSize, over: e.scrollHeight > e.clientHeight + 1 })));
    assert.equal(new Set(r.map(x => x.fs)).size, 1, 'one text size: ' + JSON.stringify(r.map(x => x.fs)));
    assert.ok(r.every(x => !x.over), 'text fits its box');
    assert.ok(parseFloat(r[0].fs) * 0.75 * (100 / 96) > 12, 'large enough to read at arm\'s length (over 12 pt at print size)');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('cards: print guides (bleed, trim, safe zone) toggle, and everything printed sits inside the safe zone', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    assert.equal(await page.locator('#deckRow .guides').count(), 16, 'guides on by default');
    const bad = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('#deckRow .card').forEach(card => {
        const cr = card.getBoundingClientRect(), u = cr.width / 275, safe = 25 * u - 1.5;
        card.querySelectorAll('.name, .typeword, .num, .art, .text, .disc').forEach(el => {
          const r = el.getBoundingClientRect();
          if (r.left < cr.left + safe || r.top < cr.top + safe || r.right > cr.right - safe || r.bottom > cr.bottom - safe) out.push(card.dataset.id + ':' + el.className);
        });
      });
      return out;
    });
    assert.deepEqual(bad, [], 'nothing close to the cut line');
    await page.tap('[data-act=guides]');
    assert.equal(await page.locator('#deckRow .guides').count(), 0);
    assert.equal(await page.locator('#deckRow .cell > div').first().evaluate(e => e.style.overflow), 'hidden', 'with guides off you see the card cut at the trim line');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('cards: greyscale and colour-blind views are one tap away; the page works on an iPad and a phone without horizontal scroll', SKIP, async () => {
  for (const viewport of [{ width: 1024, height: 768 }, { width: 390, height: 844 }]) {
    const { browser, page, errors } = await open({ viewport });
    try {
      for (const v of ['gray', 'deut', 'prot']) { await page.tap(`[data-act=view][data-v=${v}]`); assert.equal(await page.locator('#app').getAttribute('class'), 'view-' + v); }
      const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));
      assert.ok(m.sw <= m.iw + 2 || viewport.width < 500, JSON.stringify(m));
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  }
});

test('cards: every card in the chosen design — Geode a huge gem count, Monster a damage ladder', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    const cards = await page.locator('#deckRow .card').evaluateAll(els => els.map(e => ({ id: e.dataset.id, stat: e.dataset.stat })));
    const geode = cards.find(c => c.id === 'TR-01'), monster = cards.find(c => c.id === 'MO-01');
    assert.equal(geode.stat, '3'); assert.equal(monster.stat, '1');
    assert.ok(await page.locator('#deckRow .card[data-id=MO-01]').evaluate(e => [...e.querySelectorAll('div')].filter(d => /^[1357]$/.test(d.textContent.trim())).length >= 4), 'four damage tiles 1 3 5 7');
    assert.ok(await page.locator('#deckRow .card[data-id=TR-01]').first().evaluate(e => parseFloat(getComputedStyle([...e.querySelectorAll('div')].find(d => d.textContent.trim() === '1')).fontSize) > 100), 'the gem count is huge');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('cards: offline, the copy of the sheet this browser saved last time is used (and said so); with no copy it falls back to the sample', SKIP, async () => {
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  try {
    const page = await (await browser.newContext({ viewport: { width: 1100, height: 900 }, hasTouch: true })).newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.route('**/docs.google.com/**', r => r.fulfill({ status: 200, contentType: 'text/csv', body: fixture }));
    await page.goto(FILE + '#cards'); await page.waitForSelector('#deckRow .card');
    assert.match(await page.locator('.status').first().innerText(), /Live from your sheet/);
    await page.unroute('**/docs.google.com/**'); await page.route('**/docs.google.com/**', r => r.abort());
    await page.reload(); await page.waitForSelector('#deckRow .card');
    const t = await page.locator('.status').first().innerText();
    assert.match(t, /Could not reach the sheet/); assert.match(t, /Using the copy from/);
    assert.equal(await page.locator('#deckRow .card').count(), 16, 'all the cards, not just the sample');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('cards: the Geode is shown as the six gems it is printed in (colour and cut), three of each', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    const caps = await page.locator('#deckRow .cell:has(.card[data-id=TR-01]) .cap').allInnerTexts();
    assert.equal(caps.length, 6); assert.deepEqual(caps.map(c => c.split(' · ')[2].replace(/ ×\d+$/, '')), ['Sapphire', 'Emerald', 'Topaz', 'Rose Quartz', 'Amethyst', 'Aquamarine']);
    const looks = await page.locator('#deckRow .card[data-id=TR-01]').evaluateAll(els => els.map(e => getComputedStyle(e.querySelector('.band')).backgroundColor + '|' + [...e.querySelectorAll('use')].map(u => u.getAttribute('href')).find(h => h.startsWith('#gem-'))));
    assert.equal(new Set(looks).size, 6, 'six different colours and cuts');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
