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

// Face the Monster the way a player who wants every card does: trigger each eligible Power card, then take the damage.
async function faceIt(page) {
  for (let i = 0; i < 20; i++) { const el = page.locator('#play .piece.elig').first(); if (!(await el.count())) break; await el.click(); }
  await page.click('#play .mcard[data-p=face]');
}

async function open({ viewport = { width: 1180, height: 820 }, sheet = 'ok', menu = false } = {}) {
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const page = await (await browser.newContext({ viewport, hasTouch: true })).newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.route('**/docs.google.com/**', r => (sheet === 'ok' ? r.fulfill({ status: 200, contentType: 'text/csv', body: csv }) : r.abort()));
  await page.goto(FILE);
  await page.waitForSelector('#play .panel');
  if (!menu) { await page.waitForSelector('#play [data-p=practice]:not([disabled])'); await page.click('#play [data-p=practice]'); await page.waitForSelector('#play .tabs'); }
  return { browser, page, errors };
}
// Start a Dig with a scripted Mine (top first), dice and tracks.
async function begin(page, { kit = [], mine = [], dice = [], start = {}, line = [], ongoing = [] } = {}) {
  await page.evaluate(k => { const P = window.DigDigBoomPlay; P.S.kit = k; P.S.kitSize = Math.max(P.S.kitSize, k.length); P.act('go'); }, kit);
  await page.waitForSelector('#play .ptable');
  await page.evaluate(({ mine, dice, start, line, ongoing }) => {
    const P = window.DigDigBoomPlay, st = P.S.st, all = window.DigDigBoomUI.state.all;
    line.forEach((id, i) => { const c = all.find(x => x.id === id); st.line.push({ card: { ...c, uid: 7000 + i }, at: c.number, base: c.number }); });
    ongoing.forEach((id, i) => st.ongoing.push({ ...all.find(x => x.id === id), uid: 7100 + i }));
    if (mine.length) st.mine = mine.map((id, i) => ({ ...all.find(c => c.id === id), uid: 8000 + i }));
    st.dice = dice.slice(); for (const k of Object.keys(start)) st[k] = start[k];
    P.render();
  }, { mine, dice, start, line, ongoing });
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

test('play: Starter Kit — pick up to the kit size, tap again to put one back; the kit goes on top of the Mine face up', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    const pick = async (tab, name) => { await page.click(`#play .tabs [data-v=${tab}]`); await page.click(`#play .grid .piece:has-text("${name}")`); };
    await pick('Power', 'Nurse Newt'); await pick('Ongoing', 'Tune-Up'); await pick('Immediate', 'Med Kit');
    assert.match(await page.locator('#play .foot .note').innerText(), /3 of 3 chosen/);
    await pick('Immediate', 'Iron Vein');                      // a fourth: not allowed at size 3
    assert.match(await page.locator('#play .foot .note').innerText(), /3 of 3 chosen/);
    await pick('Immediate', 'Med Kit');                        // put it back
    assert.match(await page.locator('#play .foot .note').innerText(), /2 of 3 chosen/);
    await page.click('#play [data-p=go]'); await page.waitForSelector('#play .ptable');
    assert.equal(await page.locator('#play .lcol .piece').count(), 1, 'only the Pet is in play at the start');
    assert.equal(await page.locator('#play .ongoing .piece').count(), 0);
    assert.match(await page.locator('#play .mat .cardback').innerText(), /^27$/, 'the 25 plus the 2 kit cards');
    assert.equal(await page.locator('#play .known .piece').count(), 2, 'the kit is on top of the Mine, face up');
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
    await faceIt(page);
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
    await faceIt(page);                         // 2 damage: 3 -> 1
    await page.click('#play [data-p=dig]'); await page.click('#play [data-p=roll]'); await faceIt(page);   // 4 damage: BOOM
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
    await begin(page, { mine: ['PW-10', 'ON-06', 'TR-01'] });
    await page.click('#play [data-p=dig]'); await page.click('#play [data-p=dig]');
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
    await begin(page, { mine: ['ON-36', 'TR-01'], start: { grit: 4, reroll: 0 } });
    await page.click('#play [data-p=dig]');
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
      await begin(page, { line: ['PW-02', 'PW-06', 'PW-10'], ongoing: ['ON-33', 'ON-01'], mine: ['MO-01', 'TR-01'], dice: [4], start: { grit: 2 } });
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

test('play: a seed replays the same Dig; your best (Monsters survived, gems banked) is remembered in this browser', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    await page.click('#play details summary'); await page.fill('#seedIn', '42'); await page.click('#play [data-p=go]'); await page.waitForSelector('#play .ptable');
    const a = await page.evaluate(() => window.DigDigBoomPlay.S.st.mine.map(c => c.id).join(','));
    await page.click('#play .pbar [data-p=menu]'); await page.click('#play [data-p=practice]'); if (await page.locator('#play .confirm').count()) await page.click('#play [data-p=practice]'); await page.click('#play details summary'); await page.fill('#seedIn', '42'); await page.click('#play [data-p=go]');
    assert.equal(await page.evaluate(() => window.DigDigBoomPlay.S.st.mine.map(c => c.id).join(',')), a);
    assert.match(await page.locator('#logEntries').innerText(), /seed 42/);
    await begin(page, { mine: ['TR-01', 'TR-01', 'MO-01'], dice: [6], start: { heart: 6 } });
    await page.click('#play [data-p=dig]'); await page.click('#play [data-p=dig]'); await page.click('#play [data-p=bank]');
    assert.match(await page.locator('#play .over').innerText(), /Best so far: 0 Monsters survived · 2 gems banked \(new!\)/);
    assert.deepEqual(JSON.parse(await page.evaluate(() => localStorage.getItem('ddb.solo.best'))), { survived: 0, gems: 2 });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

// ---------- a run: menu, Prep, Leaderboard, the end ----------
test('run: the menu offers a run or a Practice Dig; a run opens with the Bronze Pack (draw 3, keep 1), then a Starter Kit of 1, then round 1 with the Leaderboard', SKIP, async () => {
  const { browser, page, errors } = await open({ menu: true });
  try {
    assert.match(await page.locator('#play .menu').innerText(), /Play a run[\s\S]*Practice Dig/);
    await page.evaluate(() => { window.DigDigBoomPlay.S.opp = false; }); await page.click('#play [data-p=startrun]');
    assert.match(await page.locator('#play .panel').innerText(), /Before round 1[\s\S]*Bronze Pack[\s\S]*draw 3, keep 1/);
    assert.match(await page.locator('#play .lb').innerText(), /crown at 3/i);
    await page.click('#play [data-p=openpack]');
    assert.equal(await page.locator('#play .grid .piece').count(), 3);
    assert.ok(await page.locator('#play [data-p=keepgo]').isDisabled());
    await page.click('#play .grid .piece >> nth=1'); assert.match(await page.locator('#play .pstep.live').innerText(), /1\/1 chosen/);
    await page.click('#play .grid .piece >> nth=2'); assert.match(await page.locator('#play .pstep.live').innerText(), /1\/1 chosen/, 'only one keep');
    await page.click('#play [data-p=keepgo]');
    assert.match(await page.locator('#play .panel').innerText(), /Starter Kit — up to 1/);
    await page.click('#play [data-p=kitpick]'); await page.click('#play [data-p=startround]');
    await page.waitForSelector('#play .ptable');
    assert.equal(await page.locator('#play .lb').count(), 1);
    assert.match(await page.locator('#play .lbhead').innerText(), /round 1 of 4/i);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('run: bank, roll the Escape Bonus, open the pack the gems earn, keep, choose a bigger kit; the Crown moves when you beat the tracker; the final round ends the run', SKIP, async () => {
  const { browser, page, errors } = await open({ menu: true });
  try {
    await page.evaluate(() => { window.DigDigBoomPlay.S.rounds = 2; });
    await page.evaluate(() => { window.DigDigBoomPlay.S.opp = false; }); await page.click('#play [data-p=startrun]'); await page.click('#play [data-p=openpack]'); await page.click('#play .grid .piece >> nth=0'); await page.click('#play [data-p=keepgo]'); await page.click('#play [data-p=startround]');
    await page.waitForSelector('#play .ptable');
    // round 1: four Monsters beaten by the Pet (die 10), then bank -> survived 4 beats the Crown tracker (3)
    await page.evaluate(() => {
      const P = window.DigDigBoomPlay, st = P.S.st, all = window.DigDigBoomUI.state.all;
      st.mine = ['TR-01', 'MO-01', 'MO-02', 'MO-01', 'MO-02', 'TR-01'].map((id, i) => ({ ...all.find(c => c.id === id), uid: 8000 + i })); st.dice = Array(30).fill(10); P.render();
    });
    await page.click('#play [data-p=dig]');
    for (let i = 0; i < 4; i++) { await page.click('#play [data-p=dig]'); await page.click('#play [data-p=roll]'); await faceIt(page); }
    assert.equal(await page.locator('#play .lbc.here').innerText().then(t => t.split('\n')[0].trim()), '4');
    assert.ok(await page.locator('#play .lbc.open').count() >= 1, 'you may pledge now');
    await page.click('#play [data-p=bank]');
    assert.match(await page.locator('#play .over').innerText(), /Banked![\s\S]*4 Monsters survived — you take the Crown Jewel/);
    await page.click('#play [data-p=prep]');
    assert.match(await page.locator('#play .pstep.live').innerText(), /Escape Bonus/);
    await page.evaluate(() => { window.DigDigBoomPlay.S.run.dice = [8]; });
    await page.click('#play [data-p=escape]');
    assert.match(await page.locator('#play .panel').innerText(), /Geodes 1 \+ Monsters survived 4 \+ Escape Bonus 8 = 13/);
    assert.match(await page.locator('#play .panel').innerText(), /Silver Pack/);
    assert.match(await page.locator('#play .lb').innerText(), /you hold the crown jewel/i);
    await page.click('#play [data-p=openpack]'); assert.equal(await page.locator('#play .grid .piece').count(), 4);
    await page.click('#play .grid .piece >> nth=0'); await page.click('#play .grid .piece >> nth=1'); await page.click('#play [data-p=keepgo]');
    assert.match(await page.locator('#play .panel').innerText(), /Starter Kit — up to 2/);
    await page.click('#play [data-p=startround]');
    assert.match(await page.locator('#play .lbhead').innerText(), /round 2 of 2 · final/i);
    assert.match(await page.locator('#play [data-p=bank] ').innerText(), /Take the Crown[\s\S]*no banking until you pass 4/);
    // final round: beat the tracker (4) and take the Crown
    await page.evaluate(() => {
      const P = window.DigDigBoomPlay, st = P.S.st, all = window.DigDigBoomUI.state.all;
      st.mine = ['MO-01', 'MO-02', 'MO-01', 'MO-02', 'MO-01'].map((id, i) => ({ ...all.find(c => c.id === id), uid: 8100 + i })); st.dice = Array(30).fill(10); P.render();
    });
    for (let i = 0; i < 5; i++) { await page.click('#play [data-p=dig]'); await page.click('#play [data-p=roll]'); await faceIt(page); }
    await page.click('#play [data-p=bank]');
    assert.match(await page.locator('#play .over').innerText(), /In the lead!/);
    await page.click('#play [data-p=prep]');
    assert.match(await page.locator('#play .panel').innerText(), /You hold the Crown Jewel!/);
    assert.match(await page.locator('#play table').innerText(), /Banked[\s\S]*Banked/);
    await page.evaluate(() => { window.DigDigBoomPlay.S.opp = false; }); await page.click('#play [data-p=startrun]'); assert.match(await page.locator('#play .panel').innerText(), /Before round 1/);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('run: BOOM skips the Escape Bonus and gives a Bronze Pack; pledging moves your pledge marker and blocks banking until you reach it', SKIP, async () => {
  const { browser, page, errors } = await open({ menu: true });
  try {
    await page.evaluate(() => { window.DigDigBoomPlay.S.opp = false; }); await page.click('#play [data-p=startrun]'); await page.click('#play [data-p=openpack]'); await page.click('#play .grid .piece >> nth=0'); await page.click('#play [data-p=keepgo]'); await page.click('#play [data-p=startround]');
    await page.evaluate(() => {
      const P = window.DigDigBoomPlay, st = P.S.st, all = window.DigDigBoomUI.state.all;
      st.mine = ['MO-01', 'MO-02', 'MO-01', 'MO-02', 'MO-01'].map((id, i) => ({ ...all.find(c => c.id === id), uid: 8000 + i })); st.dice = Array(30).fill(10); P.render();
    });
    for (let i = 0; i < 3; i++) { await page.click('#play [data-p=dig]'); await page.click('#play [data-p=roll]'); await faceIt(page); }
    await page.click('#play .lbc[data-n="4"]');
    assert.equal(await page.locator('#play .lbc .mk.pledge').count(), 1);
    assert.match(await page.locator('#play .lbhead').innerText(), /pledged 4/i);
    assert.ok(await page.locator('#play [data-p=bank]').isDisabled(), 'cannot bank before the pledge');
    await page.evaluate(() => { const st = window.DigDigBoomPlay.S.st; st.heart = 1; st.dice = [1]; });
    await page.click('#play [data-p=dig]'); await page.click('#play [data-p=roll]'); await faceIt(page);
    assert.match(await page.locator('#play .over').innerText(), /BOOM!/);
    assert.equal(await page.evaluate(() => window.DigDigBoomPlay.S.st.pledge), null);
    await page.click('#play [data-p=prep]');
    const t = await page.locator('#play .panel').innerText();
    assert.match(t, /BOOM: no Escape Bonus|You went BOOM/); assert.match(t, /Bronze Pack/);
    assert.ok(!/Roll\s*tap/.test(t), 'no Escape Bonus to roll');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('run: the Leaderboard and Prep fit the screen on an iPad (landscape and upright) without scrolling the page', SKIP, async () => {
  for (const viewport of [{ width: 1180, height: 820 }, { width: 1024, height: 700 }, { width: 820, height: 1180 }]) {
    const { browser, page, errors } = await open({ viewport, menu: true });
    try {
      await page.evaluate(() => { window.DigDigBoomPlay.S.opp = false; }); await page.click('#play [data-p=startrun]'); await page.click('#play [data-p=openpack]'); await page.click('#play .grid .piece >> nth=0'); await page.click('#play [data-p=keepgo]');
      await page.click('#play [data-p=kitpick]'); await page.click('#play [data-p=startround]');
      await page.evaluate(() => { const P = window.DigDigBoomPlay, st = P.S.st, all = window.DigDigBoomUI.state.all; st.mine = ['MO-01', 'TR-01'].map((id, i) => ({ ...all.find(c => c.id === id), uid: 8000 + i })); st.dice = [4]; P.render(); });
      await page.click('#play [data-p=dig]'); await page.click('#play [data-p=roll]');
      const m = await page.evaluate(() => { const b = s => { const r = document.querySelector(s).getBoundingClientRect(); return { b: r.bottom, h: r.height, w: r.width }; };
        return { sh: document.documentElement.scrollHeight, ih: innerHeight, mat: b('#play .mat'), lb: b('#play .lb'), cell: b('#play .lbc'), die: b('#play .die') }; });
      assert.ok(m.sh <= m.ih + 1, `${viewport.width}x${viewport.height}: page scrolls`);
      assert.ok(m.mat.b <= m.ih + 1, `${viewport.width}x${viewport.height}: table is cut off (${m.mat.b} > ${m.ih})`);
      assert.ok(m.cell.h >= 40 && m.cell.w >= 40, `Leaderboard cells ${m.cell.w}x${m.cell.h}`);
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  }
});

test('play: a reload puts you back exactly where you were — mid-fight in a run, in Prep, and in a Practice Dig', SKIP, async () => {
  const { browser, page, errors } = await open({ menu: true });
  try {
    await page.evaluate(() => { window.DigDigBoomPlay.S.opp = false; }); await page.click('#play [data-p=startrun]'); await page.click('#play [data-p=openpack]'); await page.click('#play .grid .piece >> nth=0'); await page.click('#play [data-p=keepgo]');
    await page.reload(); await page.waitForSelector('#play .panel');
    assert.match(await page.locator('#play .panel').innerText(), /Starter Kit — up to 1/, 'back in Prep, with the pack already kept');
    await page.click('#play [data-p=kitpick]'); await page.click('#play [data-p=startround]');
    await page.evaluate(() => { const P = window.DigDigBoomPlay, st = P.S.st, all = window.DigDigBoomUI.state.all; st.mine = ['TR-01', 'MO-01', 'TR-01'].map((id, i) => ({ ...all.find(c => c.id === id), uid: 8000 + i })); st.dice = [7, 3]; P.render(); });
    await page.click('#play [data-p=dig]'); await page.click('#play [data-p=dig]'); await page.click('#play [data-p=roll]');
    const before = await page.evaluate(() => { const st = window.DigDigBoomPlay.S.st; return { mine: st.mine.length, die: st.fight.die, log: st.log.length, line: st.line.length, heart: st.heart }; });
    await page.reload(); await page.waitForSelector('#play .ptable');
    const after = await page.evaluate(() => { const st = window.DigDigBoomPlay.S.st; return { mine: st.mine.length, die: st.fight && st.fight.die, log: st.log.length, line: st.line.length, heart: st.heart }; });
    assert.deepEqual(after, before, 'the same Mine, die, log and line');
    await faceIt(page);
    assert.match(await page.locator('#logEntries').innerText(), /survive Monster A/);
    await page.click('#play .pbar [data-p=menu]'); assert.match(await page.locator('#play .menu').innerText(), /Continue[\s\S]*round 1 of 4, Dig/);
    await page.click('#play [data-p=resume]'); await page.waitForSelector('#play .ptable');
    // a Practice Dig resumes too
    await page.click('#play .pbar [data-p=menu]'); await page.click('#play [data-p=practice]'); if (await page.locator('#play .confirm').count()) await page.click('#play [data-p=practice]'); await page.click('#play [data-p=random]'); await page.click('#play [data-p=go]'); await page.waitForSelector('#play .ptable');
    await page.click('#play [data-p=dig]'); const n = await page.evaluate(() => window.DigDigBoomPlay.S.st.mine.length);
    await page.reload(); await page.waitForSelector('#play .ptable');
    assert.equal(await page.evaluate(() => window.DigDigBoomPlay.S.st.mine.length), n); assert.equal(await page.evaluate(() => window.DigDigBoomPlay.S.run), null);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('play: monkey test — random taps through whole runs at iPad sizes: no errors, the page never scrolls, a legal tap always exists until the run is done', { ...SKIP, timeout: 240000 }, async () => {
  const ALL = `(document.querySelector('#play .zoom') ? [document.querySelector('#play .zoom')] : [...document.querySelectorAll('#play [data-p]:not([disabled])')]).filter(e => e.getBoundingClientRect().width > 0 && (!(e.closest('.pbar') || e.closest('.foot')) || ['startround', 'prep', 'keepgo', 'again', 'openpack'].includes(e.dataset.p)) && (r => e.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)))(e.getBoundingClientRect()))`;
  const AVOID = ['menu', 'practice', 'cards', 'print', 'help', 'startrun', 'setup', 'rounds', 'adv'];
  for (const [vp, seed, ai] of [[{ width: 1180, height: 820 }, 1, true], [{ width: 820, height: 1180 }, 2, false], [{ width: 1024, height: 700 }, 3, true]]) {
    const { browser, page, errors } = await open({ viewport: vp, menu: true });
    try {
      await page.evaluate(a => { window.DigDigBoomPlay.S.rounds = 2; window.DigDigBoomPlay.S.opp = a; }, ai); await page.click('#play [data-p=startrun]');
      let r = seed * 7919; const rnd = () => { r = (r * 1103515245 + 12345) & 0x7fffffff; return r / 0x7fffffff; };
      let done = false, i = 0;
      for (; i < 2500 && !done; i++) {
        const acts = await page.evaluate(`${ALL}.map((e, i) => [i, e.dataset.p])`);
        const pool = acts.filter(([, p]) => !AVOID.includes(p));
        assert.ok(pool.length, `no legal tap at step ${i}: ${(await page.locator('#play').innerText()).slice(0, 160)}`);
        const prefer = pool.filter(([, p]) => ['dig', 'roll', 'face', 'escape', 'openpack', 'keepgo', 'startround', 'prep', 'unzoom'].includes(p));
        const from = prefer.length && rnd() < .85 ? prefer : pool, [idx] = from[Math.floor(rnd() * from.length)];
        const h = await page.evaluateHandle(`${ALL}[${idx}]`);
        await h.asElement().click({ timeout: 15000 });
        const m = await page.evaluate(() => ({ sh: document.documentElement.scrollHeight, ih: innerHeight, done: /Crown Jewel/.test((document.querySelector('#play .panel h2') || {}).textContent || '') }));
        assert.ok(m.sh <= m.ih + 1, `the page scrolls at step ${i}`);
        done = m.done;
      }
      assert.ok(done, `the run did not finish in ${i} taps at ${vp.width}x${vp.height}: ${(await page.locator('#play').innerText()).replace(/\s+/g, ' ').slice(0, 500)} | ${JSON.stringify(await page.evaluate(() => { const S = window.DigDigBoomPlay.S; return { panel: S.panel, phase: S.run && S.run.phase, step: S.run && S.run.prep && S.run.prep.step, over: S.st && S.st.over && S.st.over.kind, fight: !!(S.st && S.st.fight), mine: S.st && S.st.mine.length }; }))}`);
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  }
});

// ---------- against the AI ----------
test('ai: the menu offers an AI opponent (on by default); a run shares one Leaderboard with it, the AI digs a card each time you dig, and your marker moves by itself', SKIP, async () => {
  const { browser, page, errors } = await open({ menu: true });
  try {
    assert.match(await page.locator('#play .menu').innerText(), /Opponent:\s*AI\s*Nobody/);
    assert.ok(await page.locator('#play [data-p=opp][data-v="1"]').evaluate(e => e.classList.contains('on')), 'AI is the default');
    await page.click('#play [data-p=startrun]'); await page.click('#play [data-p=openpack]'); await page.click('#play .grid .piece >> nth=0'); await page.click('#play [data-p=keepgo]'); await page.click('#play [data-p=kitpick]'); await page.click('#play [data-p=startround]');
    await page.waitForSelector('#play .ptable');
    assert.match(await page.locator('#play .lbhead').innerText(), /you\s*●?\s*ai/i);
    assert.match(await page.locator('#play .ailine').innerText(), /AI: digging · 0 survived/);
    await page.evaluate(() => { const P = window.DigDigBoomPlay, st = P.S.st, all = window.DigDigBoomUI.state.all; st.mine = ['MO-01', 'MO-02', 'MO-01', 'MO-02'].map((id, i) => ({ ...all.find(c => c.id === id), uid: 8000 + i })); st.dice = Array(30).fill(10); P.render(); });
    const aiDigs = () => page.evaluate(() => window.DigDigBoomPlay.S.match.runs.ai.dig.digs);
    const before = await aiDigs();
    await page.click('#play [data-p=dig]'); assert.equal(await aiDigs(), before + 1, 'one card for each of yours');
    await page.click('#play [data-p=roll]'); assert.equal(await aiDigs(), before + 1, 'rolling is not digging');
    await faceIt(page);
    assert.equal(await page.locator('#play .lbc .mk[title*="live marker"]').count() >= 1, true, 'a live marker is on the board');
    assert.match(await page.locator('#play .lbc:has(.mk) .mk >> nth=0').getAttribute('title'), /live marker|best Dig/);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('ai: when your Dig ends the AI finishes its own, Prep reports it, the Escape Bonus is one roll for both, and the end names a winner', SKIP, async () => {
  const { browser, page, errors } = await open({ menu: true });
  try {
    await page.evaluate(() => { window.DigDigBoomPlay.S.rounds = 2; });
    await page.click('#play [data-p=startrun]'); await page.click('#play [data-p=openpack]'); await page.click('#play .grid .piece >> nth=0'); await page.click('#play [data-p=keepgo]'); await page.click('#play [data-p=kitpick]'); await page.click('#play [data-p=startround]');
    await page.evaluate(() => { const P = window.DigDigBoomPlay, st = P.S.st, all = window.DigDigBoomUI.state.all; st.mine = ['TR-01', 'TR-01'].map((id, i) => ({ ...all.find(c => c.id === id), uid: 8000 + i })); P.render(); });
    await page.click('#play [data-p=dig]'); await page.click('#play [data-p=bank]');
    assert.equal(await page.evaluate(() => window.DigDigBoomPlay.S.match.runs.ai.dig.over !== null), true, 'the AI is done too');
    assert.match(await page.locator('#play .over').innerText(), /AI (banked|went BOOM)/);
    await page.click('#play [data-p=prep]');
    assert.match(await page.locator('#play .panel').innerText(), /The AI[\s\S]*(Banked|Went BOOM)/);
    await page.evaluate(() => { window.DigDigBoomPlay.S.match.dice = [6]; });
    await page.click('#play [data-p=escape]');
    const esc = await page.evaluate(() => [window.DigDigBoomPlay.S.match.runs.me.prep.escape, window.DigDigBoomPlay.S.match.runs.ai.prep.escape]);
    assert.equal(esc[0], 6); assert.ok(esc[1] === 6 || esc[1] === null, 'the AI got the same roll when it banked');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('ai: a reload in the middle of a match puts you and the AI back exactly where you were', SKIP, async () => {
  const { browser, page, errors } = await open({ menu: true });
  try {
    await page.click('#play [data-p=startrun]'); await page.click('#play [data-p=openpack]'); await page.click('#play .grid .piece >> nth=0'); await page.click('#play [data-p=keepgo]'); await page.click('#play [data-p=kitpick]'); await page.click('#play [data-p=startround]');
    await page.waitForSelector('#play .ptable');
    for (let i = 0; i < 3; i++) { await page.click('#play [data-p=dig]'); if (await page.locator('#play [data-p=roll]').count()) { await page.click('#play [data-p=roll]'); await faceIt(page); } if (await page.locator('#play .over').count()) break; }
    const snap = () => page.evaluate(() => { const m = window.DigDigBoomPlay.S.match; return { me: m.runs.me.dig.digs, ai: m.runs.ai.dig.digs, aiLog: m.runs.ai.dig.log.length, board: JSON.stringify(m.board.spots) }; });
    const before = await snap();
    await page.reload(); await page.waitForSelector('#play .ptable');
    assert.deepEqual(await snap(), before);
    assert.match(await page.locator('#play .ailine').innerText(), /AI/);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('play: after the roll you tap the Power cards you want to trigger, in the order you like; the Monster takes its damage last; tapping the damage first skips the rest', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    await begin(page, { line: ['PW-02', 'PW-06', 'PW-15'], mine: ['MO-01', 'MO-01'], dice: [4, 4], start: { heart: 6, grit: 0 } });
    await page.click('#play [data-p=dig]'); await page.click('#play [data-p=roll]');
    assert.equal(await page.locator('#play .piece.elig').count(), 2, 'Newt (1) and Gecko (2) are eligible at 4; Sloth (6) is not');
    assert.match(await page.locator('#play .linehead').innerText(), /tap the cards you want to trigger/i);
    await page.click('#play .piece.elig:has-text("Gritty Gecko")');
    assert.equal(await page.evaluate(() => window.DigDigBoomPlay.S.st.grit), 1);
    assert.equal(await page.locator('#play .piece.elig').count(), 1); assert.equal(await page.locator('#play .piece.done').count(), 1, 'the one you triggered is marked');
    await page.click('#play .mcard[data-p=face]');                                   // Newt is still eligible, but you tapped the damage: it is not used
    assert.deepEqual(await page.evaluate(() => [window.DigDigBoomPlay.S.st.heart, window.DigDigBoomPlay.S.st.survived]), [5, 1], 'Newt never triggered; 1 damage');
    await page.click('#play [data-p=dig]'); await page.click('#play [data-p=roll]');
    await page.click('#play [data-p=triggerall]');
    assert.equal(await page.locator('#play .piece.elig').count(), 0);
    await page.click('#play .mcard[data-p=face]');
    assert.equal(await page.evaluate(() => window.DigDigBoomPlay.S.st.survived), 2);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
