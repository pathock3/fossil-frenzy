// Browser tests for the print-and-play sheets. The sheet is stubbed with tests/cards-full.csv (the real page reads it live).
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
const csv = fs.readFileSync(path.join(__dirname, 'cards-full.csv'), 'utf8');

async function open() {
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const page = await (await browser.newContext({ viewport: { width: 1100, height: 1000 }, hasTouch: true })).newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.route('**/docs.google.com/**', r => r.fulfill({ status: 200, contentType: 'text/csv', body: csv }));
  await page.goto(FILE); await page.waitForSelector('#play [data-p=print]');
  await page.click('#play [data-p=print]'); await page.waitForSelector('#printv .sheet');
  return { browser, page, errors };
}
const feet = page => page.locator('#printv .sheet .foot').allInnerTexts();

test('print: every card of the sheet, by its count, in 3 x 3 sheets at exactly 2.5 x 3.5 in with cut marks, plus the Power line, Drill, Leaderboard and mat', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    const f = await feet(page);
    assert.equal(f.filter(t => /Cards \d+\/15/.test(t)).length, 15, '130 cards = 15 sheets of 9');
    assert.equal(f.filter(t => /Power line/.test(t)).length, 3); assert.equal(f.filter(t => /Drill/.test(t)).length, 1); assert.equal(f.filter(t => /Leaderboard/.test(t)).length, 1); assert.equal(f.filter(t => /Table mat/.test(t)).length, 1);
    assert.equal(await page.locator('#printv .sheet .pc').count(), 130);
    const first = await page.locator('#printv .sheet .pc >> nth=0').evaluate(e => { const r = e.firstElementChild.getBoundingClientRect(); const sheet = e.closest('.sheet').getBoundingClientRect(); return { w: r.width, h: r.height, sw: sheet.width, sh: sheet.height }; });
    assert.deepEqual([Math.round(first.w), Math.round(first.h), Math.round(first.sw), Math.round(first.sh)], [240, 336, 816, 1056], '2.5 x 3.5 in on an 8.5 x 11 in sheet at 96 px per inch');
    assert.equal(await page.locator('#printv .sheet:first-child .mk').count(), 16, 'crop marks on every grid line');
    assert.match(await page.locator('#printv style').innerText(), /size: 8\.5in 11in/);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('print: A4, a print-shop mode with bleed (one 2.75 x 3.75 in page per card), parts and player count are one tap each', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    await page.click('[data-pr="paper:a4"]'); assert.match(await page.locator('#printv style').innerText(), /size: A4/);
    assert.equal(Math.round(await page.locator('#printv .sheet >> nth=0').evaluate(e => e.getBoundingClientRect().width)), 794);
    await page.click('[data-pr="part:cards"]'); await page.click('[data-pr="part:line"]'); await page.click('[data-pr="part:mat"]'); await page.click('[data-pr="part:board"]');
    assert.deepEqual(await feet(page), ['Dig Dig BOOM! · Drill — player 1']);
    await page.click('[data-pr="pl:1"]'); await page.click('[data-pr="pl:1"]');
    assert.equal((await feet(page)).length, 3, 'one Drill per player'); 
    const trims = await page.locator('#printv .drill').evaluateAll(els => els.map(e => e.style.borderColor || getComputedStyle(e).borderTopColor));
    assert.equal(new Set(trims).size, 3, 'each player has their own trim colour');
    await page.click('[data-pr=bleed]');
    assert.equal(await page.locator('#printv .bleedpage').count(), 130);
    assert.match(await page.locator('#printv style').innerText(), /size: 2\.75in 3\.75in/);
    const b = await page.locator('#printv .bleedpage >> nth=0').evaluate(e => { const r = e.getBoundingClientRect(), c = e.querySelector('.card').getBoundingClientRect(); return [r.width, r.height, c.width, c.height].map(Math.round); });
    assert.deepEqual(b, [264, 360, 264, 360], 'the page is the card plus its bleed');
    await page.click('[data-pr=back]'); assert.equal(await page.evaluate(() => document.body.dataset.mode), 'play');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('print: the Drill and Leaderboard use the rules in the data block (Health 0-10 with a star on 10, Grit 0-6, Rerolls 0-3; Crown at 3; the ladder)', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    const drill = await page.locator('#printv .drill').innerText();
    assert.match(drill, /Health[\s\S]*Grit[\s\S]*Rerolls/);
    const cells = await page.locator('#printv .drill .trk').evaluateAll(els => els.map(e => [...e.querySelectorAll('.dcell')].map(c => c.textContent.replace('★', '').trim()).join(',') + '|' + [...e.querySelectorAll('.dcell')].findIndex(c => c.querySelector('.star'))));
    assert.deepEqual(cells, ['0,1,2,3,4,5,6,7,8,9,10|10', '0,1,2,3,4,5,6|0', '0,1,2,3|0']);
    assert.equal(await page.locator('#printv .bgrid .bh.crown').innerText().then(t => t.replace(/\s+/g, '')), '3♛');
    const mat = await page.locator('#printv .sheet', { hasText: 'Table mat' }).last().innerText();
    assert.match(mat, /Bronze[\s\S]*Gold/); assert.match(mat, /Starter Kit\s*1\s*2\s*2\s*3/);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
