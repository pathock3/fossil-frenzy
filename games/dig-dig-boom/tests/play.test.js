// Browser tests for the solo Dig screen. The sheet is stubbed with tests/cards-full.csv (the real page reads it live).
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

async function open({ viewport = { width: 1180, height: 820 }, sheet = 'ok' } = {}) {
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const page = await (await browser.newContext({ viewport, hasTouch: true })).newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.route('**/docs.google.com/**', r => (sheet === 'ok' ? r.fulfill({ status: 200, contentType: 'text/csv', body: csv }) : r.abort()));
  await page.goto(FILE);
  await page.waitForSelector('#play .panel');
  return { browser, page, errors };
}
// Start a Dig with a scripted Mine (top first), dice and tracks.
async function begin(page, { kit = [], mine = [], dice = [], start = {} } = {}) {
  await page.evaluate(k => { const P = window.DigDigBoomPlay; P.S.kit = k; P.S.kitSize = Math.max(P.S.kitSize, k.length); P.act('go'); }, kit);
  await page.waitForSelector('#play .ptable');
  await page.evaluate(({ mine, dice, start }) => {
    const P = window.DigDigBoomPlay, st = P.S.st, all = window.DigDigBoomUI.state.all;
    if (mine.length) st.mine = mine.map((id, i) => ({ ...all.find(c => c.id === id), uid: 8000 + i }));
    st.dice = dice.slice(); for (const k of Object.keys(start)) st[k] = start[k];
    P.render();
  }, { mine, dice, start });
}
const log = page => page.locator('#logEntries').innerText();

test('play: the game screen opens first, with the Starter Kit chooser read from the sheet; Cards is one tap away and back', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    assert.equal(await page.evaluate(() => document.body.dataset.mode), 'play');
    const tabs = await page.locator('#play .tabs .chip').allInnerTexts();
    assert.deepEqual(tabs.slice(0, 3).map(t => t.trim()), ['Power (31)', 'Ongoing (37)', 'Immediate (34)']);
    assert.equal(await page.locator('#play .grid .piece').count(), 31);
    assert.ok(!(await page.locator('#play').innerText()).includes('Not implemented yet'), 'every card in the sheet is built');
    await page.click('#play .pbar [data-p=cards]'); await page.waitForSelector('section.dir');
    assert.equal(await page.evaluate(() => document.body.dataset.mode), 'cards');
    await page.click('[data-act=mode]'); await page.waitForSelector('#play .panel');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('play: Starter Kit — pick up to the kit size, tap again to put one back; Power and Ongoing cards start in play, Immediate cards go in the Mine', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    const pick = async (tab, name) => { await page.click(`#play .tabs [data-v=${tab}]`); await page.click(`#play .grid .piece:has-text("${name}")`); };
    await pick('Power', 'Nurse Newt'); await pick('Ongoing', 'Tune-Up'); await pick('Immediate', 'Med Kit');
    assert.match(await page.locator('#play .foot .note').innerText(), /3\/3 chosen/);
    await pick('Immediate', 'Iron Vein');                      // a fourth: not allowed at size 3
    assert.match(await page.locator('#play .foot .note').innerText(), /3\/3 chosen/);
    await pick('Immediate', 'Med Kit');                        // put it back
    assert.match(await page.locator('#play .foot .note').innerText(), /2\/3 chosen/);
    await page.click('#play [data-p=go]'); await page.waitForSelector('#play .ptable');
    assert.equal(await page.locator('#play .lcol .piece').count(), 2, 'the Pet and Nurse Newt');
    assert.equal(await page.locator('#play .ongoing .piece').count(), 1);
    assert.match(await page.locator('#play .mat .cardback').innerText(), /^25$/);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('play: dig a Geode, then a Monster — spend Grit, roll, reroll, face it; the table and the log show every step', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    await begin(page, { mine: ['TR-01', 'MO-01', 'TR-01'], dice: [2, 5], start: { heart: 6, grit: 2, reroll: 1 } });
    await page.click('#play [data-p=dig]');
    assert.match(await log(page), /You dig Geode[\s\S]*Geode: \+1/);
    assert.match(await page.locator('#play [data-p=bank]').innerText(), /^1/);
    await page.click('#play [data-p=dig]');
    assert.ok(await page.locator('#play .mcard[data-p=face]').isDisabled(), 'cannot face it before rolling');
    await page.click('#play .track[data-p=grit]');                         // +1 before the roll
    assert.equal(await page.evaluate(() => window.DigDigBoomPlay.S.st.grit), 1);
    assert.equal(await page.locator('#play .tokens button').count(), 1);
    await page.click('#play .tokens button');                              // take it back
    assert.equal(await page.evaluate(() => window.DigDigBoomPlay.S.st.grit), 2);
    await page.click('#play .track[data-p=grit]');
    await page.click('#play [data-p=roll]');
    assert.match(await page.locator('#play .calc').innerText(), /Result 3/);
    assert.equal(await page.locator('#play .lcol.on').count(), 3, 'the line lights up to the result');
    await page.click('#play .track[data-p=reroll]');                       // die 5 + 1 Grit
    assert.match(await page.locator('#play .calc').innerText(), /Result 6/);
    await page.click('#play .mcard[data-p=face]');
    assert.match(await log(page), /You take 1 .*\nYou survive Monster A/);
    assert.equal(await page.evaluate(() => window.DigDigBoomPlay.S.st.heart), 5);
    assert.match(await page.locator('#play .dig').innerText(), /Last card dug/);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('play: after the roll, Grit buys +1 for 3; BOOM shows the end screen with New Dig; a new Dig starts fresh', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    await begin(page, { mine: ['MO-02', 'MO-02'], dice: [1, 1], start: { heart: 3, grit: 3 } });
    await page.click('#play [data-p=dig]'); await page.click('#play [data-p=roll]');
    await page.click('#play .track[data-p=grit]');                         // 3 Grit for +1
    assert.match(await page.locator('#play .calc').innerText(), /Result 2/);
    await page.click('#play .mcard[data-p=face]');                         // 2 damage: 3 -> 1
    await page.click('#play [data-p=dig]'); await page.click('#play [data-p=roll]'); await page.click('#play .mcard[data-p=face]');   // 4 damage: BOOM
    assert.match(await page.locator('#play .over').innerText(), /BOOM!/);
    assert.match(await page.locator('#play .over').innerText(), /survived 1 Monster/);
    assert.ok(await page.locator('#play [data-p=dig]').isDisabled());
    await page.click('#play [data-p=again]');
    assert.equal(await page.locator('#play .over').count(), 0);
    assert.equal(await page.evaluate(() => window.DigDigBoomPlay.S.st.survived), 0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('play: banking keeps your gems and ends the Dig; it cannot be done in front of a Monster', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    await begin(page, { mine: ['TR-01', 'TR-01', 'MO-01'], dice: [3], start: { heart: 6 } });
    await page.click('#play [data-p=dig]'); await page.click('#play [data-p=dig]');
    await page.click('#play [data-p=bank]');
    const o = await page.locator('#play .over').innerText();
    assert.match(o, /Banked!/); assert.match(o, /2\s*\n?.*\(2 from Geodes, 0 from Monsters\)/s);
    await page.click('#play [data-p=setup]'); await page.waitForSelector('#play .panel');
    assert.ok(await page.locator('#play [data-p=go]').isVisible());
    const { browser: b2, page: p2 } = await open();
    try {
      await begin(p2, { mine: ['MO-01'] }); await p2.click('#play [data-p=dig]');
      assert.ok(await p2.locator('#play [data-p=bank]').isDisabled());
    } finally { await b2.close(); }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('play: Cloning Machine asks for a Power card by tapping it on the line; tapping any card zooms it, tapping again closes', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    await begin(page, { kit: ['PW-10'], mine: ['ON-06', 'TR-01'] });
    await page.click('#play [data-p=dig]');
    assert.ok(await page.locator('#play [data-p=dig]').isDisabled());
    assert.match(await page.locator('#play .dig').innerText(), /Tap a Power card on the line/);
    await page.click('#play .lcol .piece:has-text("Grit Gopher")');
    assert.match(await page.locator('#logEntries').innerText(), /triggers twice/);
    await page.click('#play .lcol .piece:has-text("Grit Gopher")');       // now it zooms
    assert.equal(await page.locator('#play .zoom .card').count(), 1);
    await page.click('#play .zoom'); assert.equal(await page.locator('#play .zoom').count(), 0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('play: Workbench trades are taps on buttons beside the Grit and Rerolls tracks', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    await begin(page, { kit: ['ON-36'], mine: ['TR-01'], start: { grit: 4, reroll: 0 } });
    await page.click('#play .wbtn[data-v=grit]');
    assert.deepEqual(await page.evaluate(() => [window.DigDigBoomPlay.S.st.grit, window.DigDigBoomPlay.S.st.reroll]), [1, 1]);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('play: the page is locked — no scrolling at iPad sizes, taps are at least 44 px, nothing is cut off', SKIP, async () => {
  for (const viewport of [{ width: 1180, height: 820 }, { width: 1024, height: 768 }, { width: 820, height: 1180 }, { width: 768, height: 1024 }]) {
    const { browser, page, errors } = await open({ viewport });
    try {
      const orient = viewport.width > viewport.height ? 'landscape' : 'portrait';
      await begin(page, { kit: ['PW-02', 'PW-06', 'PW-10', 'ON-33', 'ON-01'], mine: ['MO-01', 'TR-01'], dice: [4], start: { grit: 2 } });
      await page.click('#play [data-p=dig]'); await page.click('#play [data-p=roll]');
      const m = await page.evaluate(() => {
        const box = s => { const e = document.querySelector(s), r = e && e.getBoundingClientRect(); return r && { w: r.width, h: r.height, b: r.bottom, r: r.right }; };
        return { sh: document.documentElement.scrollHeight, sw: document.documentElement.scrollWidth, ih: innerHeight, iw: innerWidth,
          die: box('#play .die'), monster: box('#play .mcard'), bank: box('#play [data-p=bank]'), mat: box('#play .mat'), log: box('#play .plog'), grit: box('#play .track[data-p=grit]') };
      });
      assert.ok(m.sh <= m.ih + 1 && m.sw <= m.iw + 1, `${orient} ${viewport.width}: page scrolls (${m.sw}x${m.sh} in ${m.iw}x${m.ih})`);
      for (const k of ['die', 'monster', 'bank', 'grit']) assert.ok(m[k].w >= 44 && m[k].h >= 44, `${orient}: ${k} is ${m[k].w}x${m[k].h}`);
      assert.ok(m.mat.b <= m.ih + 1, `${orient}: the bottom of the table (${m.mat.b}) is below the screen (${m.ih})`);
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  }
});

test('play: if the sheet cannot be reached it says so instead of failing', SKIP, async () => {
  const { browser, page, errors } = await open({ sheet: 'down' });
  try {
    assert.match(await page.locator('#play .note').first().innerText(), /design sample|Starting cards/);
    assert.match(await page.locator('#play').innerText(), /could not be reached/);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
