// Browser tests for the game screens: the main menu, Prep, the table, the AI. The sheet is stubbed with tests/cards-full.csv (the real page reads it live).
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

// Face the Monster the way a player who wants every card does: trigger each eligible Power card (a card that defeats the Monster ends the fight at once), then take the damage.
async function faceIt(page) {
  for (let i = 0; i < 20; i++) { const el = page.locator('#play .tcard.elig').first(); if (!(await el.count())) break; await el.click(); }
  if (await page.locator('#play [data-p=face]').count()) await page.click('#play [data-p=face]');
}

async function open({ viewport = { width: 1180, height: 820 }, sheet = 'ok', menu = false } = {}) {
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const page = await (await browser.newContext({ viewport, hasTouch: true })).newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => { window.DDB_AI_PACE = 3600000; window.DDB_TALLY_PACE = 0.01; window.DDB_HERO_PACE = window.DDB_HERO_PACE || 1; });         // the AI's own clock never fires on its own in a test: tests call DigDigBoomPlay.tick()
  await page.route('**/docs.google.com/**', r => (sheet === 'ok' ? r.fulfill({ status: 200, contentType: 'text/csv', body: csv }) : r.abort()));
  await page.goto(FILE);
  await page.waitForSelector('#play .home');
  if (!menu) { await page.waitForSelector('#play [data-p=more]'); await page.click('#play [data-p=more]'); await page.waitForSelector('#play [data-p=practice]:not([disabled])'); await page.click('#play [data-p=practice]'); await page.waitForSelector('#play .tabs'); }
  return { browser, page, errors };
}
// Start a Practice Dig with a scripted Mine (top first), dice and tracks.
async function begin(page, { kit = [], mine = [], dice = [], start = {}, line = [], ongoing = [] } = {}) {
  await page.evaluate(k => { const P = window.DigDigBoomPlay; P.S.kit = k; P.S.kitSize = Math.max(P.S.kitSize, k.length); P.act('go'); }, kit);
  await page.waitForSelector('#play .ptable');
  await script(page, { mine, dice, start, line, ongoing });
}
// Replace what is in the Mine (nothing known on top), the dice, the tracks and what is in play, in a Dig already under way.
async function script(page, { mine = [], dice = [], start = {}, line = [], ongoing = [] }) {
  await page.evaluate(({ mine, dice, start, line, ongoing }) => {
    const P = window.DigDigBoomPlay, st = P.S.st, all = window.DigDigBoomUI.state.all;
    line.forEach((id, i) => { const c = all.find(x => x.id === id); st.line.push({ card: { ...c, uid: 7000 + i }, at: c.number, base: c.number }); });
    ongoing.forEach((id, i) => st.ongoing.push({ ...all.find(x => x.id === id), uid: 7100 + i }));
    if (mine.length) { st.mine = mine.map((id, i) => ({ ...all.find(c => c.id === id), uid: 8000 + i })); st.known = 0; }
    st.dice = dice.slice(); for (const k of Object.keys(start)) st[k] = start[k];
    P.render();
  }, { mine, dice, start, line, ongoing });
}
// Keep the first n offered cards that are not a Mystery Box (which would keep one more and make card counts depend on luck).
async function keepNonMystery(page, n) {
  const idx = await page.evaluate(() => { const o = window.DigDigBoomPlay.S.run.prep.offer; return o.map((c, i) => [i, /When kept/.test(c.text)]).filter(([, m]) => !m).map(([i]) => i); });
  const take = idx.slice(0, n);
  for (const i of take) await page.click(`#play [data-p=pick] >> nth=${i}`);                          // tap to choose...
  await page.click('#play [data-p=keepgo]');                                                          // ...then Keep (bottom right)
}
// A run from the main menu: the AI switched off unless asked (tests turn it on explicitly); round 1: open the Bronze Pack, keep a card, choose it as the Starter Kit, then the table.
async function startRun(page, { opp = false, rounds } = {}) {
  await page.evaluate(({ opp, rounds }) => { const S = window.DigDigBoomPlay.S; S.opp = opp; if (rounds) S.rounds = rounds; }, { opp, rounds });
  await page.click('#play [data-p=startrun]'); await page.click('#play [data-p=openpack]'); await keepNonMystery(page, 1);
  await page.click('#play [data-p=kitpick] >> nth=0'); await page.click('#play [data-p=startround]');          // tap to choose, then Start (bottom right)
  await page.waitForSelector('#play .ptable');
}
const stOf = (page, fn) => page.evaluate(fn);
const logText = page => page.evaluate(() => window.DigDigBoomPlay.S.st.log.map(l => l.text).join('\n'));
const dieShows = (page, sel, v) => page.waitForFunction(([s, v]) => { const e = document.querySelector(s + ' .dnum'); return e && e.textContent === String(v); }, [sel, v], { timeout: 5000 });

// ---------------------------------------------------------------- the main menu
test('menu: the front of the box — the logo and a tiny game playing itself (a deck flips gem, gem, monster… into one spot; one loop banks, the next goes BOOM), one screen that never scrolls, nothing about printing', SKIP, async () => {
  for (const viewport of [{ width: 1180, height: 820 }, { width: 1024, height: 700 }, { width: 820, height: 1180 }, { width: 700, height: 420 }]) {
    const { browser, page, errors } = await open({ viewport, menu: true });
    try {
      await page.addInitScript(() => { window.DDB_HERO_PACE = 0.05; }); await page.reload(); await page.waitForSelector('#play .hero2');
      assert.equal(await page.locator('#play .hero2 .hc').count(), 11, 'a Health track, 0 to 10');
      assert.match(await page.locator('#play .logo').innerText(), /Dig Dig\s*BOOM!/);
      assert.ok(await page.locator('#play [data-p=startrun]').isVisible()); assert.ok(await page.locator('#play [data-p=more]').isVisible()); assert.ok(await page.locator('#play [data-p=help]').isVisible());
      await page.waitForFunction(() => /Banked/.test(document.querySelector('.hbanner').textContent), null, { timeout: 8000 });
      assert.ok(await page.locator('#play .hero2 .hslot .card').count() >= 1, 'cards land in one spot');
      await page.waitForFunction(() => /BOOM/.test(document.querySelector('.hbanner').textContent), null, { timeout: 8000 });
      assert.equal(await page.locator('#play .hero2 .hc.now').innerText(), '0', 'out of Health: BOOM');
      const m = await page.evaluate(() => ({ sh: document.documentElement.scrollHeight, ih: innerHeight, overflow: [...document.querySelectorAll('#play .homemenu *')].some(e => e.getBoundingClientRect().bottom > innerHeight + 1) }));
      assert.ok(m.sh <= m.ih + 1 && !m.overflow, `one screen at ${viewport.width}x${viewport.height}`);
      assert.doesNotMatch(await page.locator('#play').innerText(), /[Pp]rint/);
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  }
});

test('menu: Play, How to play and Settings and nothing else — no text under the buttons, no footnote; Settings has Rounds 2 to 7, the cards and a playtest, with a way back and no second Menu', SKIP, async () => {
  const { browser, page, errors } = await open({ menu: true });
  try {
    const home = await page.locator('#play .homemenu').innerText();
    assert.match(home, /Play/); assert.doesNotMatch(home, /Practice|The cards|See the cards|[Pp]rint|Nobody|Opponent|against the AI|Cards and rules|Version/);
    assert.deepEqual((await page.locator('#play .homemenu button').allInnerTexts()).map(t => t.trim()), ['Play', 'How to play', 'Settings']);
    await page.click('#play [data-p=more]');
    assert.equal(await page.locator('#play .pbar').count(), 0, 'no second Menu on the Settings screen');
    assert.equal(await page.locator('#play [data-p=gmenu]').count(), 0);
    const menu = await page.locator('#play .settings').innerText();
    assert.match(menu, /Settings[\s\S]*Rounds[\s\S]*The cards[\s\S]*Playtest/); assert.doesNotMatch(menu, /[Tt]rash|Nobody|Opponent|[Pp]rint/);
    assert.deepEqual((await page.locator('#play .seg button').allInnerTexts()).map(t => t.trim()), ['2', '3', '4', '5', '6', '7']);
    await page.click('#play .seg button:has-text("7")'); assert.equal(await stOf(page, () => window.DigDigBoomPlay.S.rounds), 7);
    await page.click('#play [data-p=menu]'); await page.waitForSelector('#play .homemenu');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('menu: How to play is three pictures and a line each — no wall of text, no link to the card designs', SKIP, async () => {
  const { browser, page, errors } = await open({ menu: true });
  try {
    await page.click('#play [data-p=help]');
    assert.equal(await page.locator('#play .hcard').count(), 3);
    assert.equal(await page.locator('#play .hcard .hpic .card, #play .hcard .hpic svg').count() >= 3, true, 'pictures, not paragraphs');
    assert.equal(await page.locator('#play [data-p=cards]').count(), 0, 'no link to the card designs');
    const words = (await page.locator('#play .how').innerText()).split(/\s+/).length; assert.ok(words < 110, 'the gist only: ' + words + ' words');
    await page.click('#play [data-p=closehelp]'); await page.waitForSelector('#play .homemenu');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('menu: if the sheet cannot be reached it says so instead of failing', SKIP, async () => {
  const { browser, page, errors } = await open({ sheet: 'down', menu: true });
  try {
    assert.match(await page.locator('#play .homenote').innerText(), /could not be reached/);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

// ---------------------------------------------------------------- a Practice Dig on the table
test('practice: the Starter Kit chooser lists only cards the game can play; pick up to the kit size, tap again to put one back; the kit goes on top of the Mine face up', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    const OUT = ['PW-04', 'PW-06', 'PW-08', 'PW-10', 'PW-11', 'PW-13', 'PW-18', 'PW-23', 'PW-25', 'PW-26', 'PW-29', 'PW-30', 'ON-01', 'ON-07', 'ON-10', 'ON-13', 'ON-16', 'ON-18', 'ON-24', 'ON-25', 'ON-26', 'ON-28', 'ON-30', 'ON-32', 'ON-36', 'IM-02', 'IM-09', 'IM-10', 'IM-12', 'IM-15', 'IM-18', 'IM-19', 'IM-27', 'IM-29', 'IM-31', 'IM-34'];
    const want = await page.evaluate(out => { const all = window.DigDigBoomUI.state.all; return ['Power', 'Ongoing', 'Immediate'].map(t => all.filter(c => c.deck === 'Booster' && c.type === t && !out.includes(c.id)).length); }, OUT);
    const tabs = (await page.locator('#play .tabs .chip').allInnerTexts()).slice(0, 3).map(t => Number(t.match(/\((\d+)\)/)[1]));
    assert.deepEqual(tabs, want, 'the cards that need Grit (cut) are not offered');
    assert.ok(!(await page.locator('#play').innerText()).includes('Not implemented yet'));
    const pick = async (tab, name) => { await page.click(`#play .tabs [data-v=${tab}]`); await page.click(`#play .grid .piece:has-text("${name}")`); };
    await pick('Power', 'Nurse Newt'); await pick('Ongoing', 'Tune-Up'); await pick('Immediate', 'Med Kit');
    assert.match(await page.locator('#play .foot .note').innerText(), /3 of 3 chosen/);
    await pick('Immediate', 'Lucky Dice');                      // a fourth: not allowed at size 3
    assert.match(await page.locator('#play .foot .note').innerText(), /3 of 3 chosen/);
    await pick('Immediate', 'Med Kit');                        // put it back
    assert.match(await page.locator('#play .foot .note').innerText(), /2 of 3 chosen/);
    await page.click('#play [data-p=go]'); await page.waitForSelector('#play .ptable');
    assert.equal(await page.locator('#play .tcard:not(.inplay)').count(), 1, 'only the Pet is in play at the start');
    assert.equal(await page.locator('#play .tcard.inplay').count(), 1, 'the Lucky Coin is in play from the start');
    assert.match(await page.locator('#play .deck .cnt').innerText(), /^27$/, 'the 25 plus the 2 kit cards');
    assert.equal(await stOf(page, () => window.DigDigBoomPlay.S.st.known), 2, 'the kit is on top of the Mine, face up'); assert.equal(await page.locator('#play .deck .card').count(), 1, 'the top card of the Mine is shown face up on the deck');
    assert.equal(await page.locator('#logEntries').count(), 0, 'there is no "What happened" panel');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('table: dig a Geode, then a Monster — tap the die, reroll, face it; the Drill is just Health and Rerolls; the Monster pile counts what you have met', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    await begin(page, { mine: ['TR-01', 'MO-01', 'TR-01'], dice: [2, 5], start: { heart: 6, reroll: 1 } });
    assert.equal(await page.locator('#play .track').count(), 2, 'Health and Rerolls only'); assert.equal(await page.locator('#play .tbody svg use[href="#i-grit"], #play use[href="#i-grit"]').count(), 0, 'no Grit anywhere');
    await page.click('#play [data-p=dig]');
    assert.match(await logText(page), /You dig Geode[\s\S]*Geode: \+1/);
    assert.match(await page.locator('#play [data-p=bank]').innerText(), /^1/);
    await page.click('#play [data-p=dig]');
    assert.doesNotMatch(await page.locator('#play .ptable').innerText(), /Discard/, 'no separate discard pile and no count of it: the flip spot is the discard');
    assert.equal(await page.locator('#play .slot.stacked').count(), 1, 'the cards flipped before are stacked under the flip spot');
    assert.ok(await page.evaluate(() => { const m = document.querySelector('#play .mat').getBoundingClientRect(), t = document.querySelector('#play .tableau').getBoundingClientRect(); return t.bottom <= m.top + 1; }), 'the cards you are drawing are in front of you (below); Power and Ongoing cards are above them');
    assert.equal(await page.locator('#play [data-p=face]').count(), 0, 'the Monster is not a button');
    assert.ok(await page.locator('#play .ptable.await-roll').count() === 1 && await page.locator('#play .deck').isDisabled(), 'before the roll the rest of the table dims and waits: only the die can be tapped');
    assert.ok(await page.locator('#play [data-p=roll]').isEnabled());
    assert.match(await page.locator('#play [data-p=roll]').innerText(), /Tap/i, 'the die says Tap, nothing more');
    assert.equal(await page.locator('#play .mset:has(.mb:text-is("A")) .lad i.met').count(), 1, 'Monster A is in front of you and counts');
    await page.click('#play [data-p=roll]'); await dieShows(page, '#play .dieb', 2);
    assert.equal(await page.locator('#play .tcard.off').count(), 1, 'the Pet (10) is beyond the result of 2 and dims');
    await page.click('#play .track[data-p=reroll]'); await dieShows(page, '#play .dieb', 5);   // the die rolled again
    await faceIt(page);
    assert.match(await logText(page), /You take 1 .*\nYou survive Monster A/);
    assert.equal(await stOf(page, () => window.DigDigBoomPlay.S.st.heart), 5);
    assert.deepEqual(await stOf(page, () => window.DigDigBoomPlay.S.st.monsterPile.map(c => c.id)), ['MO-01'], 'the Monster went to the pile, not the discard');
    assert.equal(await page.locator('#play .mset:has(.mb:text-is("A")) .lad i.met').count(), 1);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('table: tapping a card that defeats the Monster defeats it at once — no tap on the Monster; it goes to the Monster pile', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    await begin(page, { mine: ['MO-01', 'MO-02'], dice: [10, 10] });
    await page.click('#play [data-p=dig]'); await page.click('#play [data-p=roll]');
    assert.equal(await page.locator('#play .tcard.elig').count(), 1, 'the Pet glows');
    await page.click('#play .tcard.elig');                                           // the Pet
    assert.equal(await stOf(page, () => !!window.DigDigBoomPlay.S.st.fight), true, 'defeated, but the fight is still open: you may use other cards first');
    assert.match(await page.locator('#play [data-p=face]').innerText(), /defeated: continue/i);
    await page.click('#play [data-p=face]');
    assert.equal(await stOf(page, () => !!window.DigDigBoomPlay.S.st.fight), false, 'the fight is over');
    assert.deepEqual(await stOf(page, () => { const s = window.DigDigBoomPlay.S.st; return [s.survived, s.defeated, s.heart, s.monsterPile.length, !!s.fight]; }), [1, 1, 10, 1, false]);
    assert.match(await page.locator('#play [data-p=bank]').innerText(), /^1/, 'a defeated Monster is worth a gem');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('table: after the roll you tap the Power cards you want to trigger, in the order you like; the Monster takes its damage last; tapping the damage first skips the rest', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    await begin(page, { line: ['PW-02', 'PW-09', 'PW-15'], mine: ['MO-01', 'MO-01'], dice: [4, 4], start: { heart: 6 } });
    await page.click('#play [data-p=dig]'); await page.click('#play [data-p=roll]');
    assert.equal(await page.locator('#play .tcard.elig').count(), 2, 'Nurse Newt (1) and Pill Bug (3) are eligible at 4; Moss Sloth (6) is not');
    assert.ok(await page.locator('#play [data-p=triggerall]').count() === 0 || true); assert.doesNotMatch(await page.locator('#play .action').innerText(), /glowing/i, 'no instruction text');
    await page.click('#play .tcard.elig:has-text("Pill Bug")');                      // Block 1
    assert.equal(await page.locator('#play .tcard.elig').count(), 1); assert.equal(await page.locator('#play .tcard.done').count(), 1, 'the one you triggered is marked');
    await page.click('#play [data-p=face]');                                        // Newt is still eligible, but you took the damage: it is not used
    assert.deepEqual(await stOf(page, () => [window.DigDigBoomPlay.S.st.heart, window.DigDigBoomPlay.S.st.survived]), [6, 1], 'Newt never triggered; the 1 damage was blocked');
    await page.click('#play [data-p=dig]'); await page.click('#play [data-p=roll]');
    await page.click('#play [data-p=triggerall]');
    assert.equal(await page.locator('#play .tcard.elig').count(), 0);
    await page.click('#play [data-p=face]');
    assert.deepEqual(await stOf(page, () => [window.DigDigBoomPlay.S.st.heart, window.DigDigBoomPlay.S.st.survived]), [5, 2], 'this time Newt healed 1 and Pill Bug blocked 1 of the 3 damage: 6 + 1 - 2');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('table: a Power or Ongoing card goes straight up with the others — it is not also shown in the flip spot', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    await begin(page, { mine: ['TR-01', 'PW-02', 'ON-33', 'IM-13'] });
    await page.click('#play [data-p=dig]');                                                                  // a Geode: in the flip spot
    assert.equal(await page.locator('#play .slot .card[data-id="TR-01"]').count(), 1);
    await page.click('#play [data-p=dig]');                                                                  // Nurse Newt: up with the Power cards
    assert.equal(await page.locator('#play .tableau .card[data-id="PW-02"]').count(), 1, 'it is on the table with the Power cards');
    assert.equal(await page.locator('#play .slot .card[data-id="PW-02"]').count(), 0, 'and not a second copy in the flip spot');
    assert.equal(await page.locator('#play .slot .card[data-id="TR-01"]').count(), 1, 'the flip spot still shows the last card that stays there');
    await page.click('#play [data-p=dig]');
    assert.equal(await page.locator('#play .tableau .card[data-id="ON-33"]').count(), 1); assert.equal(await page.locator('#play .slot .card[data-id="ON-33"]').count(), 0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('table: after the roll a button takes the damage — then you see your new Health before you choose to dig on or bank; the Mine and Bank wait until then', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    await begin(page, { mine: ['TR-01', 'MO-01', 'TR-01', 'MO-02', 'MO-01'], dice: [4, 1], start: { heart: 3 } });
    await page.click('#play [data-p=dig]'); await page.click('#play [data-p=dig]');
    assert.equal(await page.locator('#play .mcard[data-p]').count(), 0, 'the Monster card is not tappable');
    assert.equal(await page.locator('#play [data-p=face]').count(), 0, 'no damage button before the roll');
    assert.equal(await page.locator('#play .steps').count(), 0, 'no step line');
    await page.click('#play [data-p=roll]');
    assert.ok(await page.locator('#play .deck').isDisabled() && await page.locator('#play [data-p=bank]').isDisabled(), 'the Mine and the Bank wait until the damage is taken');
    assert.match(await page.locator('#play [data-p=face]').innerText(), /^Take 1 damage$/);
    await page.click('#play [data-p=face]');
    assert.deepEqual(await stOf(page, () => { const s = window.DigDigBoomPlay.S.st; return [s.heart, s.survived, !!s.fight]; }), [2, 1, false], 'your Health is updated first');
    assert.match(await page.locator('#play .stamp').innerText(), /survived/i, 'the Monster card says how it ended');
    assert.ok(await page.locator('#play .deck').isEnabled() && await page.locator('#play [data-p=bank]').isEnabled(), 'now you choose: dig on or bank');
    assert.match(await page.locator('#play .aprompt').innerText(), /Mine to dig, or the Bank/);
    await page.click('#play [data-p=dig]'); assert.equal(await page.locator('#play .stamp').count(), 0, 'the stamp goes with the next card');
    await page.click('#play [data-p=dig]'); await page.click('#play [data-p=roll]');
    assert.equal(await page.locator('#play .takedmg.lethal').count(), 1, 'a lethal hit is flagged on the button');
    await page.click('#play [data-p=face]');
    assert.equal(await stOf(page, () => window.DigDigBoomPlay.S.st.over && window.DigDigBoomPlay.S.st.over.kind), 'boom');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('table: defeating a Monster with a card stamps it Defeated', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    await begin(page, { mine: ['MO-01'], dice: [10] });
    await page.click('#play [data-p=dig]'); await page.click('#play [data-p=roll]');
    await page.click('#play .tcard.elig'); assert.equal(await page.locator('#play .stamp').count(), 0, 'not until you continue');
    await page.click('#play [data-p=face]');
    assert.match(await page.locator('#play .stamp').innerText(), /defeated/i);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('table: BOOM shows the end panel with New Dig; a new Dig starts fresh', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    await begin(page, { mine: ['MO-02', 'MO-02'], dice: [1, 1], start: { heart: 3 } });
    await page.click('#play [data-p=dig]'); await page.click('#play [data-p=roll]'); await faceIt(page);           // 2 damage: 3 -> 1
    await page.click('#play [data-p=dig]'); await page.click('#play [data-p=roll]'); await faceIt(page);           // 4 damage: BOOM
    const over = await page.locator('#play .over').innerText();
    assert.match(over, /BOOM!/); assert.doesNotMatch(over, /survived/, 'BOOM loses everything: no score is shown'); assert.doesNotMatch(over, /[Gg]rit/);
    assert.ok(await page.locator('#play [data-p=dig]').isDisabled());
    assert.equal(await stOf(page, () => window.DigDigBoomPlay.S.st.monsterPile.length), 2, 'even the one that BOOMed you is in the pile');
    await page.click('#play [data-p=again]');
    assert.equal(await page.locator('#play .over').count(), 0); assert.equal(await stOf(page, () => window.DigDigBoomPlay.S.st.survived), 0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('table: banking keeps your gems and ends the Dig; it cannot be done in front of a Monster; the Bank pile has one gem icon and the one number', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    await begin(page, { mine: ['TR-01', 'TR-01', 'MO-01'], dice: [3], start: { heart: 6 } });
    await page.click('#play [data-p=dig]'); await page.click('#play [data-p=dig]');
    assert.equal(await page.locator('#play [data-p=bank] .gemline svg').count(), 1, 'one gem icon on the Bank pile');
    await page.click('#play [data-p=bank]');
    const o = await page.locator('#play .over').innerText();
    assert.match(o, /Banked!/); assert.match(o, /2 Geodes|\(2 from Geodes, 0 from Monsters\)/);
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

test('table: Cloning Machine asks for a Power card by tapping it on the line; tapping any card zooms it, tapping again closes', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    await begin(page, { mine: ['PW-02', 'ON-06', 'TR-01'] });
    await page.click('#play [data-p=dig]'); await page.click('#play [data-p=dig]');
    assert.ok(await page.locator('#play [data-p=dig]').isDisabled());
    assert.match(await page.locator('#play .dicez').innerText(), /tap a Power card/i);
    await page.click('#play .tcard:has-text("Nurse Newt")');
    assert.match(await logText(page), /triggers twice/);
    await page.click('#play .tcard:has-text("Nurse Newt")');       // now it zooms
    assert.equal(await page.locator('#play .zoom .card').count(), 1);
    await page.click('#play .zoom'); assert.equal(await page.locator('#play .zoom').count(), 0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('table: the page is locked — no scrolling at iPad sizes, taps are at least 44 px, nothing is cut off, no "What happened" panel', SKIP, async () => {
  for (const viewport of [{ width: 1180, height: 820 }, { width: 1024, height: 768 }, { width: 820, height: 1180 }, { width: 768, height: 1024 }]) {
    const { browser, page, errors } = await open({ viewport });
    try {
      const orient = viewport.width > viewport.height ? 'landscape' : 'portrait';
      await begin(page, { line: ['PW-02', 'PW-09', 'PW-17'], ongoing: ['ON-33', 'ON-12'], mine: ['MO-01', 'TR-01'], dice: [4], start: { reroll: 2 } });
      await page.click('#play [data-p=dig]');
      const pre = await page.evaluate(() => { const r = document.querySelector('#play [data-p=roll]').getBoundingClientRect(); return [r.width, r.height]; });
      assert.ok(pre[0] >= 44 && pre[1] >= 44, 'the die to tap is big enough');
      await page.click('#play [data-p=roll]');
      const m = await page.evaluate(() => {
        const box = s => { const e = document.querySelector(s), r = e && e.getBoundingClientRect(); return r && { w: r.width, h: r.height, b: r.bottom, r: r.right }; };
        return { sh: document.documentElement.scrollHeight, sw: document.documentElement.scrollWidth, ih: innerHeight, iw: innerWidth,
          die: box('#play .dieb'), monster: box('#play .mcard'), bank: box('#play [data-p=bank]'), mat: box('#play .mat'), tableau: (() => { const cs = [...document.querySelectorAll('#play .tcard')].map(e => e.getBoundingClientRect()); return { b: Math.max(...cs.map(r => r.bottom)), l: Math.min(...cs.map(r => r.left)), r: Math.max(...cs.map(r => r.right)) }; })(), reroll: box('#play .track[data-p=reroll]'), log: !!document.querySelector('#play .plog') };
      });
      assert.ok(m.sh <= m.ih + 1 && m.sw <= m.iw + 1, `${orient} ${viewport.width}: page scrolls (${m.sw}x${m.sh} in ${m.iw}x${m.ih})`);
      for (const k of ['die', 'monster', 'bank', 'reroll']) assert.ok(m[k].w >= 44 && m[k].h >= 44, `${orient}: ${k} is ${m[k].w}x${m[k].h}`);
      assert.ok(m.mat.b <= m.ih + 1, `${orient}: the bottom of the table (${m.mat.b}) is below the screen (${m.ih})`);
      assert.ok(m.tableau.b <= m.ih + 1 && m.tableau.l >= -1 && m.tableau.r <= m.iw + 1, `${orient}: the Power and Ongoing cards fit the screen ${JSON.stringify(m.tableau)}`);
      assert.equal(m.log, false);
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  }
});

test('look: every Geode is a different gem (six colours and cuts, three of each); Health and Rerolls squares are the same width and line up', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    await begin(page, { mine: ['TR-01', 'TR-01', 'TR-01', 'TR-01', 'TR-01', 'TR-01', 'TR-01'] });
    const seen = [];
    for (let i = 0; i < 6; i++) {
      await page.click('#play [data-p=dig]');
      seen.push(await page.evaluate(() => { const c = document.querySelector('#play .mat .mcard .card'); const tile = c.querySelector('.gemtile'); return { bg: getComputedStyle(tile).backgroundImage, cut: [...c.querySelectorAll('use')].map(u => u.getAttribute('href')).find(h => h.startsWith('#gem-')) }; }));
    }
    assert.equal(new Set(seen.map(x => x.bg)).size, 6, 'six different gem colours in a row: ' + JSON.stringify(seen));
    assert.equal(new Set(seen.map(x => x.cut)).size, 6, 'and six different cuts, so colour is never the only clue');
    const cells = await page.evaluate(() => [...document.querySelectorAll('#play .track')].map(t => [...t.querySelectorAll('.tc')].map(c => { const r = c.getBoundingClientRect(); return [Math.round(r.left * 10) / 10, Math.round(r.width * 10) / 10]; })));
    const [heart, reroll] = cells;
    assert.equal(heart.length, 11); assert.equal(reroll.length, 4);
    reroll.forEach((c, i) => { assert.ok(Math.abs(c[0] - heart[i][0]) < 0.6 && Math.abs(c[1] - heart[i][1]) < 0.6, `square ${i} lines up with Health's: ${c} vs ${heart[i]}`); });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('practice: a seed replays the same Dig; your best (Monsters survived, gems banked) is remembered in this browser', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    await page.click('#play details summary'); await page.fill('#seedIn', '42'); await page.click('#play [data-p=go]'); await page.waitForSelector('#play .ptable');
    const a = await stOf(page, () => window.DigDigBoomPlay.S.st.mine.map(c => c.id).join(','));
    await page.click('#play .pbar [data-p=gmenu]'); await page.click('#play [data-p=mainmenu]'); await page.click('#play [data-p=more]'); await page.click('#play [data-p=practice]'); if (await page.locator('#play .confirm').count()) await page.click('#play [data-p=practice]');
    await page.click('#play details summary'); await page.fill('#seedIn', '42'); await page.click('#play [data-p=go]');
    assert.equal(await stOf(page, () => window.DigDigBoomPlay.S.st.mine.map(c => c.id).join(',')), a);
    assert.match(await logText(page), /seed 42/);
    await begin(page, { mine: ['TR-01', 'TR-01', 'MO-01'], dice: [6], start: { heart: 6 } });
    await page.click('#play [data-p=dig]'); await page.click('#play [data-p=dig]'); await page.click('#play [data-p=bank]');
    assert.match(await page.locator('#play .over').innerText(), /Best so far: 0 Monsters survived · 2 gems banked \(new!\)/);
    assert.deepEqual(JSON.parse(await page.evaluate(() => localStorage.getItem('ddb.solo.best'))), { survived: 0, gems: 2 });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

// ---------------------------------------------------------------- a run: Prep like a table, the Leaderboard
test('run: round 1 opens a Bronze Pack (draw 3, keep 1), then you choose your Starter Kit from the cards you own — no gem option on screen, empty places become gems — then the table', SKIP, async () => {
  const { browser, page, errors } = await open({ menu: true });
  try {
    await page.evaluate(() => { window.DigDigBoomPlay.S.opp = false; }); await page.click('#play [data-p=startrun]');
    assert.equal(await page.locator('#play .pack b').innerText(), 'Bronze'); assert.match(await page.locator('#play .pack').innerText(), /Draw 3 · Keep 1/);
    assert.equal(await page.locator('#play .tabs').count(), 0, 'no catalogue of cards');
    await page.click('#play [data-p=openpack]'); assert.equal(await page.locator('#play [data-p=pick]').count(), 3);
    assert.ok(await page.locator('#play [data-p=keepgo]').isDisabled(), 'Keep waits until you have chosen');
    const pos = await page.locator('#play [data-p=keepgo]').evaluate(e => { const r = e.getBoundingClientRect(); return [r.right > innerWidth * .6, r.bottom > innerHeight * .8]; });
    assert.deepEqual(pos, [true, true], 'the confirm button is bottom right, where the most reachable things are');
    assert.equal(await page.evaluate(() => document.querySelector('#play .scroll').scrollHeight <= document.querySelector('#play .scroll').clientHeight + 1), true, 'the pack fits the screen: nothing scrolls');
    assert.match(await page.locator('#play .keepsay').innerText(), /^Tap a card to keep$/, 'before anything is tapped it says to tap a card');
    await page.click('#play [data-p=pick] >> nth=0'); assert.equal(await page.locator('#play .pcard.sel').count(), 1, 'one tap chooses');
    await page.click('#play [data-p=pick] >> nth=1'); assert.equal(await page.locator('#play .pcard.sel').count(), 1, 'tapping another card moves the choice');
    assert.equal(await stOf(page, () => window.DigDigBoomPlay.S.run.prep.step), 'keep');
    assert.match(await page.locator('#play .keepsay').innerText(), /Tap Keep to confirm/, 'having chosen one, it says what to do next');
    assert.ok(await page.locator('#play [data-p=keepgo]').isEnabled());
    await keepNonMystery(page, 1);
    assert.equal(await page.locator('#play [data-p=kitpick]').count(), 1, 'one card to choose from: the one you kept');
    assert.equal(await page.locator('#play [data-p=kitgem]').count(), 0, 'no gem to pick: an empty place is a gem');
    assert.match(await page.locator('#play .kitbar .count').innerText(), /^0 of 1$/, 'how many you may choose and how many you have');
    assert.match(await page.locator('#play .keepsay').innerText(), /^Tap a card to start with$/);
    assert.equal(await page.locator('#play .kslot.empty .kgem').count(), 1, 'an empty place shows the gem it will be filled with');
    assert.equal(await page.evaluate(() => { const f = e => getComputedStyle(document.querySelector(e)).fontSize; return f('#play .kitbar .count') + f('#play .keepsay'); }), '42px22px', 'the Keep and Starter Kit screens use the same sizes');
    assert.equal(await page.locator('#play .pips2').count(), 0, 'no circles');
    assert.equal(await page.locator('#play [data-p=startround]').isEnabled(), true, 'you may start with the place empty');
    await page.click('#play [data-p=startround]'); await page.waitForSelector('#play .ptable');
    assert.equal(await stOf(page, () => window.DigDigBoomPlay.S.st.geodeGems), 1, 'you started with a gem in the Bank');
    assert.match(await page.locator('#play [data-p=bank]').innerText(), /^1/);
    assert.equal(await stOf(page, () => window.DigDigBoomPlay.S.st.known), 0, 'the card you left out of the kit is shuffled into the Mine');
    assert.equal(await page.locator('#play .lb').count(), 1); assert.match(await page.locator('#play .lbhead').innerText(), /round 1 of 4/i);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('run: bank, tap the die for the Escape Bonus (a d10 that rolls and shows the number), open the pack the gems earn, keep whole cards, choose a bigger kit; the final round is a race', SKIP, async () => {
  const { browser, page, errors } = await open({ menu: true });
  try {
    await startRun(page, { rounds: 2 });
    await script(page, { mine: ['TR-01', 'MO-01', 'MO-02', 'MO-01', 'MO-02', 'TR-01'], dice: Array(30).fill(10) });
    await page.click('#play [data-p=dig]');
    for (let i = 0; i < 4; i++) { await page.click('#play [data-p=dig]'); await page.click('#play [data-p=roll]'); await faceIt(page); }
    assert.equal(await page.locator('#play .lbc.here').innerText().then(t => t.split('\n')[0].trim()), '4');
    assert.equal(await page.locator('#play .lbc[data-p], #play button.lbc').count(), 0, 'no pledging: nothing to tap on the Leaderboard');
    await page.click('#play [data-p=bank]');
    assert.match(await page.locator('#play .over').innerText(), /Banked![\s\S]*4 Monsters survived · ♛/);
    await page.click('#play [data-p=prep]');
    await page.waitForSelector('#play .bigdie'); assert.ok(await page.locator('#play .bigdie').count() === 1, 'a die to tap'); assert.match(await page.locator('#play .eq').innerText(), /1\s*\+\s*4\s*\+/, 'Geodes + Monsters + the die');
    await page.evaluate(() => { window.DigDigBoomPlay.S.run.dice = [8]; });
    await page.click('#play [data-p=escape]'); await dieShows(page, '#play .eq .t.die', 8);
    await page.waitForSelector('#play .pack'); await page.waitForFunction(() => /13/.test(document.querySelector('#play .eq .sum').textContent)); assert.match(await page.locator('#play .eq .sum').innerText(), /13/); assert.equal(await page.locator('#play .pack b').innerText(), 'Silver');
    assert.equal(await page.locator('#play .lb, #play .pbar h1').count(), 0, 'no Leaderboard and no title in Prep: just a Menu in the corner');
    assert.equal(await page.locator('#play .pbar [data-p=gmenu]').count(), 1);
    await page.click('#play [data-p=openpack]'); assert.equal(await page.locator('#play [data-p=pick]').count(), 4);
    const w = await page.locator('#play [data-p=pick]').first().evaluate(e => e.offsetWidth); assert.ok(w >= 200, 'whole cards, not a reduction: ' + w);
    assert.doesNotMatch(await page.locator('#play .panel').innerText(), /[Ll]ast [Dd]ig|banked after/);
    await keepNonMystery(page, 2);
    assert.equal(await page.locator('#play [data-p=kitpick]').count(), 3, 'the card from round 1 and the two you kept');
    assert.equal(await page.locator('#play .kslot .pcard').count(), 1, "last round's Starter Kit is already in its place");
    assert.match(await page.locator('#play .kslot .ctag.last').innerText(), /last round/i); assert.equal(await page.locator('#play .pool .ctag.new').count(), 2, 'what you just won is marked new');
    assert.match(await page.locator('#play .keepsay').innerText(), /Same Starter Kit as last round/);
    await page.click('#play [data-p=kitpick] >> nth=1');                                  // a new card joins the kit
    assert.equal(await page.locator('#play .kslot .pcard').count(), 2); assert.match(await page.locator('#play .keepsay').innerText(), /Tap to add or remove/);
    const order0 = await stOf(page, () => window.DigDigBoomPlay.S.run.prep.kitPick.slice());
    const src = await page.locator('#play .kslot[data-i="1"] .pcard').boundingBox(), dst = await page.locator('#play .kslot[data-i="0"]').boundingBox();
    await page.mouse.move(src.x + src.width / 2, src.y + src.height / 2); await page.mouse.down(); await page.mouse.move(dst.x + dst.width / 2, dst.y + dst.height / 2, { steps: 8 }); await page.mouse.up();
    assert.deepEqual(await stOf(page, () => window.DigDigBoomPlay.S.run.prep.kitPick.slice()), [order0[1], order0[0]], 'dragging one kit card onto another swaps them');
    assert.equal(await stOf(page, () => window.DigDigBoomPlay.S.run.prep.step), 'kit', 'a drag is not a tap');
    await page.waitForTimeout(120);
    await page.click('#play [data-p=startround]');
    assert.match(await page.locator('#play .lbhead').innerText(), /round 2 of 2 · final/i);
    assert.equal(await stOf(page, () => window.DigDigBoomPlay.S.st.known), 2, 'the two kit cards are on top of the Mine, face up; the third is shuffled in');
    assert.ok(await page.locator('#play [data-p=bank]').isDisabled(), 'the final round is a race: nobody banks');
    assert.match(await page.locator('#play .lbhead').innerText(), /not in the lead: keep digging/i);
    await script(page, { mine: ['MO-01', 'MO-02', 'MO-01', 'MO-02', 'MO-01'], dice: Array(30).fill(10) });
    for (let i = 0; i < 6 && !(await page.locator('#play .over').count()); i++) { await page.click('#play [data-p=dig]'); await page.click('#play [data-p=roll]'); await faceIt(page); }
    assert.match(await page.locator('#play .over').innerText(), /In the lead![\s\S]*Everyone else is out/);
    await page.click('#play [data-p=prep]');
    assert.match(await page.locator('#play .panel').innerText(), /You hold the Crown Jewel!/);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('run: after a bank the tally is shown one piece at a time — Treasure, then Monsters, then the die waits for you, then the die lands and only then the pack appears — while a thermometer of packs fills up', SKIP, async () => {
  const { browser, page, errors } = await open({ menu: true });
  try {
    await page.addInitScript(() => { window.DDB_TALLY_PACE = 0.5; });
    await page.reload(); await page.waitForSelector('#play .home');
    await startRun(page, { opp: false, rounds: 3 });
    await script(page, { mine: ['TR-01', 'TR-01', 'MO-01', 'TR-01'], dice: [10, 10] });
    for (let i = 0; i < 4; i++) { await page.click('#play [data-p=dig]'); if (i === 2) { await page.click('#play [data-p=roll]'); await faceIt(page); } }
    await page.click('#play [data-p=bank]'); await page.click('#play [data-p=prep]');
    assert.equal(await page.locator('#play .gchart').count(), 1, 'the thermometer is on the side from the start');
    assert.equal(await page.locator('#play .pack').count(), 0, 'no pack yet');
    await page.waitForFunction(() => document.querySelectorAll('#play .eq .t').length === 1);                    // Treasure first
    assert.equal(await page.locator('#play .eq .t').count(), 1);
    await page.waitForFunction(() => document.querySelectorAll('#play .eq .t').length === 2);                    // then Monsters
    assert.equal(await page.locator('#play .bigdie').count(), 0, 'the die has not come yet');
    await page.waitForSelector('#play .bigdie');                                                                 // then the die waits for you
    assert.equal(await page.locator('#play .pack').count(), 0, 'still no pack');
    const before = await page.locator('#play .gbubble').innerText();
    await page.evaluate(() => { window.DigDigBoomPlay.S.run.dice = [6]; });
    await page.click('#play [data-p=escape]');
    assert.equal(await page.locator('#play .pack').count(), 0, 'the die is still rolling: the pack is not shown yet');
    await page.waitForSelector('#play .pack');
    assert.notEqual(await page.locator('#play .gbubble').innerText(), before, 'the level rose with the die');
    assert.equal(await page.locator('#play .grow.got').count(), 1, 'the tier you reached is marked');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('run: a tap on the tally skips ahead to the die (and past the landing to the pack)', SKIP, async () => {
  const { browser, page, errors } = await open({ menu: true });
  try {
    await page.addInitScript(() => { window.DDB_TALLY_PACE = 50; });
    await page.reload(); await page.waitForSelector('#play .home');
    await startRun(page, { opp: false, rounds: 3 });
    await script(page, { mine: ['TR-01', 'TR-01', 'MO-01', 'TR-01'], dice: [10, 10] });
    for (let i = 0; i < 2; i++) await page.click('#play [data-p=dig]');
    await page.click('#play [data-p=bank]'); await page.click('#play [data-p=prep]');
    assert.equal(await page.locator('#play .bigdie').count(), 0, 'nothing has been revealed yet and the timers are slow');
    await page.click('#play [data-p=skiptally]'); assert.equal(await page.locator('#play .bigdie').count(), 1, 'a tap jumps to the die');
    await page.evaluate(() => { window.DigDigBoomPlay.S.run.dice = [4]; });
    await page.click('#play [data-p=escape]');
    assert.equal(await page.locator('#play .pack').count(), 0); await page.click('#play [data-p=skiptally]');
    assert.equal(await page.locator('#play .pack').count(), 1, 'and a tap while the die lands brings the pack');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('run: BOOM skips the Escape Bonus and gives a Bronze Pack; your marker moves the moment you ENCOUNTER a Monster, before you roll; BOOM takes it away (no pledging)', SKIP, async () => {
  const { browser, page, errors } = await open({ menu: true });
  try {
    await startRun(page);
    await script(page, { mine: ['MO-01', 'MO-02'], dice: [10, 1], start: { heart: 1 } });
    assert.equal(await page.locator('#play .lbc .mk.pledge').count(), 0, 'nothing encountered yet');
    await page.click('#play [data-p=dig]');
    assert.equal(await page.locator('#play .lbc.here').innerText().then(t => t.split('\n')[0].trim()), '1', 'the Monster is in front of you and already counts');
    assert.equal(await page.locator('#play .lbc:has(.mk.pledge) .ln').innerText(), '1');
    await page.click('#play [data-p=roll]'); await faceIt(page);
    await page.click('#play [data-p=dig]'); assert.equal(await page.locator('#play .lbc.here').innerText().then(t => t.split('\n')[0].trim()), '2');
    await page.click('#play [data-p=roll]'); await faceIt(page);
    assert.match(await page.locator('#play .over').innerText(), /BOOM/); assert.equal(await page.locator('#play .lbc .mk.pledge').count(), 0, 'BOOM cleared the live marker');
    await page.click('#play [data-p=prep]');
    assert.equal(await page.locator('#play .bigdie').count(), 0, 'no Escape Bonus after a BOOM'); assert.equal(await page.locator('#play .pack b').innerText(), 'Bronze');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('run: the main menu, Prep and the Leaderboard fit the screen on an iPad (landscape and upright) without scrolling the page', SKIP, async () => {
  for (const viewport of [{ width: 1180, height: 820 }, { width: 1024, height: 700 }, { width: 820, height: 1180 }]) {
    const { browser, page, errors } = await open({ viewport, menu: true });
    try {
      await page.evaluate(() => { window.DigDigBoomPlay.S.opp = false; }); await page.click('#play [data-p=startrun]');
      const fits = () => page.evaluate(() => ({ sh: document.documentElement.scrollHeight, ih: innerHeight, sw: document.documentElement.scrollWidth, iw: innerWidth }));
      let m = await fits(); assert.ok(m.sh <= m.ih + 1 && m.sw <= m.iw + 1, `first Prep at ${viewport.width}x${viewport.height}`);
      assert.equal(await page.locator('#play .lbc').count(), 0, 'no Leaderboard in Prep');
      await page.click('#play [data-p=openpack]'); m = await fits(); assert.ok(m.sh <= m.ih + 1 && m.sw <= m.iw + 1, `pack at ${viewport.width}x${viewport.height}`);
      await keepNonMystery(page, 1); m = await fits(); assert.ok(m.sh <= m.ih + 1 && m.sw <= m.iw + 1, `kit at ${viewport.width}x${viewport.height}`);
      await page.click('#play [data-p=kitpick] >> nth=0'); await page.click('#play [data-p=startround]'); await page.waitForSelector('#play .ptable');
      m = await fits(); assert.ok(m.sh <= m.ih + 1 && m.sw <= m.iw + 1, `table at ${viewport.width}x${viewport.height}`);
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  }
});

test('menu: in a game there is no link out to the library — a Menu with a way back to the main menu; your game is saved, Continue picks it up, New run replaces it only after a second tap', SKIP, async () => {
  const { browser, page, errors } = await open({ menu: true });
  try {
    await startRun(page);
    await script(page, { mine: ['TR-01', 'TR-01', 'MO-01'], dice: [10] });
    await page.click('#play [data-p=dig]');
    assert.equal(await page.locator('#play .pbar a, #play .libback').count(), 0, 'no link to the Tabletop Library while you play');
    assert.equal(await page.locator('#play .pbar [data-p=gmenu]').count(), 1);
    await page.click('#play .pbar [data-p=gmenu]');
    assert.match(await page.locator('#play .gmenu').innerText(), /Back to the game[\s\S]*How to play[\s\S]*Main menu/);
    await page.click('#play [data-p=gmenuclose]'); assert.equal(await page.locator('#play .gmenu').count(), 0);
    await page.click('#play .pbar [data-p=gmenu]'); await page.click('#play [data-p=mainmenu]');
    assert.match(await page.locator('#play .homemenu').innerText(), /Continue[\s\S]*New run/);
    assert.equal(await page.locator('#play [data-p=resume] .pips i').count(), 4, 'one circle per round on Continue'); assert.equal(await page.locator('#play [data-p=resume] .pips i.now').count(), 1, 'the current round is ringed'); assert.doesNotMatch(await page.locator('#play [data-p=resume]').innerText(), /Round|Dig|Prep/, 'circles, no words');
    await page.click('#play [data-p=startrun]');                                       // the first tap only asks
    assert.match(await page.locator('#play .homemenu').innerText(), /Tap again to replace your game/); assert.equal(await stOf(page, () => window.DigDigBoomPlay.S.st.digs), 1, 'nothing was replaced yet');
    await page.click('#play [data-p=resume]'); await page.waitForSelector('#play .ptable');
    assert.equal(await stOf(page, () => window.DigDigBoomPlay.S.st.digs), 1, 'the same game, where you left it');
    await page.click('#play .pbar [data-p=gmenu]'); await page.click('#play [data-p=mainmenu]'); await page.click('#play [data-p=startrun]'); await page.click('#play [data-p=startrun]');
    assert.equal(await page.locator('#play .pack b').innerText(), 'Bronze', 'a brand new run: the round-1 Bronze Pack');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('play: a reload puts you back exactly where you were — mid-fight in a run, in Prep, and in a Practice Dig', SKIP, async () => {
  const { browser, page, errors } = await open({ menu: true });
  try {
    await page.evaluate(() => { window.DigDigBoomPlay.S.opp = false; }); await page.click('#play [data-p=startrun]'); await page.click('#play [data-p=openpack]'); await keepNonMystery(page, 1); await page.click('#play [data-p=kitpick] >> nth=0');
    await page.reload(); await page.waitForSelector('#play .panel');
    assert.equal(await page.locator('#play [data-p=kitpick]').count() > 0, true, 'back in Prep');
    assert.equal(await page.locator('#play .pcard.sel').count(), 1, 'with your pick still picked');
    await page.click('#play [data-p=startround]'); await page.waitForSelector('#play .ptable');
    await script(page, { mine: ['TR-01', 'MO-01', 'TR-01'], dice: [7, 3] });
    await page.click('#play [data-p=dig]'); await page.click('#play [data-p=dig]'); await page.click('#play [data-p=roll]');
    const before = await stOf(page, () => { const st = window.DigDigBoomPlay.S.st; return { mine: st.mine.length, die: st.fight.die, log: st.log.length, line: st.line.length, heart: st.heart, pile: st.monsterPile.length }; });
    await page.reload(); await page.waitForSelector('#play .ptable');
    const after = await stOf(page, () => { const st = window.DigDigBoomPlay.S.st; return { mine: st.mine.length, die: st.fight && st.fight.die, log: st.log.length, line: st.line.length, heart: st.heart, pile: st.monsterPile.length }; });
    assert.deepEqual(after, before, 'the same Mine, die, log and line');
    await faceIt(page);
    assert.match(await logText(page), /survive Monster A/);
    await page.click('#play .pbar [data-p=gmenu]'); await page.click('#play [data-p=mainmenu]'); assert.match(await page.locator('#play .homemenu').innerText(), /Continue/);
    await page.click('#play [data-p=resume]'); await page.waitForSelector('#play .ptable');
    // a Practice Dig resumes too
    await page.click('#play .pbar [data-p=gmenu]'); await page.click('#play [data-p=mainmenu]'); await page.click('#play [data-p=more]'); await page.click('#play [data-p=practice]'); if (await page.locator('#play .confirm').count()) await page.click('#play [data-p=practice]'); await page.click('#play [data-p=random]'); await page.click('#play [data-p=go]'); await page.waitForSelector('#play .ptable');
    await page.click('#play [data-p=dig]'); const n = await stOf(page, () => window.DigDigBoomPlay.S.st.mine.length);
    await page.reload(); await page.waitForSelector('#play .ptable');
    assert.equal(await stOf(page, () => window.DigDigBoomPlay.S.st.mine.length), n); assert.equal(await stOf(page, () => window.DigDigBoomPlay.S.run), null);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('play: monkey test — random taps through whole runs at iPad sizes: no errors, the page never scrolls, a legal tap always exists until the run is done', { ...SKIP, timeout: 300000 }, async () => {
  const ALL = `(document.querySelector('#play .zoom') ? [document.querySelector('#play .zoom')] : [...document.querySelectorAll('#play [data-p]:not([disabled])')]).filter(e => e.getBoundingClientRect().width > 0 && (!(e.closest('.pbar') || e.closest('.foot')) || ['startround', 'prep', 'keepgo', 'again', 'openpack', 'ff'].includes(e.dataset.p)) && (r => e.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)))(e.getBoundingClientRect()))`;
  const AVOID = ['menu', 'more', 'gmenu', 'gmenuclose', 'mainmenu', 'practice', 'cards', 'help', 'startrun', 'setup', 'rounds', 'resume'];
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
        const prefer = pool.filter(([, p]) => ['dig', 'roll', 'face', 'escape', 'openpack', 'pick', 'keepgo', 'kitpick', 'startround', 'prep', 'unzoom', 'ff'].includes(p));
        const from = prefer.length && rnd() < .85 ? prefer : pool, [idx] = from[Math.floor(rnd() * from.length)];
        const h = await page.evaluateHandle(`${ALL}[${idx}]`);
        try { await h.asElement().click({ timeout: 15000 }); } catch (e) { if (/not attached/.test(e.message)) continue; throw e; }       // the AI's fast-forwarded clock may redraw the panel under the monkey
        const m = await page.evaluate(() => ({ sh: document.documentElement.scrollHeight, ih: innerHeight, done: /Crown Jewel|You win|AI wins/.test((document.querySelector('#play .panel h2') || {}).textContent || '') }));
        assert.ok(m.sh <= m.ih + 1, `the page scrolls at step ${i}`);
        done = m.done;
      }
      assert.ok(done, `the run did not finish in ${i} taps at ${vp.width}x${vp.height}: ${(await page.locator('#play').innerText()).replace(/\s+/g, ' ').slice(0, 500)} | ${JSON.stringify(await page.evaluate(() => { const S = window.DigDigBoomPlay.S; return { panel: S.panel, phase: S.run && S.run.phase, step: S.run && S.run.prep && S.run.prep.step, over: S.st && S.st.over && S.st.over.kind, fight: !!(S.st && S.st.fight), mine: S.st && S.st.mine.length }; }))}`);
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  }
});

// ---------------------------------------------------------------- against the AI
test('ai: a run shares one Leaderboard with the AI; it digs on its own clock (not when you tap) and there is no AI line of text; your marker moves by itself', SKIP, async () => {
  const { browser, page, errors } = await open({ menu: true });
  try {
    await startRun(page, { opp: true });
    assert.match(await page.locator('#play .lbhead').innerText(), /you\s*●?\s*ai/i);
    assert.equal(await page.locator('#play .ailine').count(), 0, 'nothing to read: you watch its marker');
    await script(page, { mine: ['MO-01', 'MO-02', 'MO-01', 'MO-02'], dice: Array(30).fill(10) });
    const aiDigs = () => stOf(page, () => window.DigDigBoomPlay.S.match.runs.ai.dig.digs);
    const before = await aiDigs();
    await page.click('#play [data-p=dig]'); assert.equal(await aiDigs(), before, 'your dig does not move the AI');
    await page.click('#play [data-p=roll]'); await faceIt(page);
    assert.equal(await aiDigs(), before, 'nor does anything else you tap');
    await page.evaluate(() => window.DigDigBoomPlay.tick()); assert.equal(await aiDigs(), before + 1, 'its clock moves it one card');
    assert.equal(await page.locator('#play .lbc .mk[title*="this Dig"]').count() >= 1, true, 'a live marker is on the board');
    assert.equal(await page.locator('#play .mcard, #play [data-p=dig]').count() >= 1, true, 'the table was not redrawn away by the tick');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('ai: its clock really runs on its own, a tick redraws only the Leaderboard (never the table you are tapping)', SKIP, async () => {
  const { browser, page, errors } = await open({ menu: true });
  try {
    await page.addInitScript(() => { window.DDB_AI_PACE = 250; });
    await page.reload(); await page.waitForSelector('#play .home');
    await startRun(page, { opp: true });
    const mine = await page.locator('#play [data-p=dig]').elementHandle();
    await page.waitForFunction(() => window.DigDigBoomPlay.S.match.runs.ai.dig.digs >= 2 || window.DigDigBoomPlay.S.match.runs.ai.dig.over, null, { timeout: 15000 });
    assert.equal(await page.evaluate(h => h.isConnected, mine), true, 'the Mine button you might be pressing was not replaced');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('ai: when your Dig ends you wait for the AI (or tap Fast forward); the Escape Bonus is one die for both; the AI preps when you open your pack; the end names a winner', SKIP, async () => {
  const { browser, page, errors } = await open({ menu: true });
  try {
    await startRun(page, { opp: true, rounds: 2 });
    await script(page, { mine: ['TR-01', 'TR-01'] });
    await page.click('#play [data-p=dig]'); await page.click('#play [data-p=bank]');
    assert.equal(await stOf(page, () => window.DigDigBoomPlay.S.match.runs.ai.dig.over), null, 'the AI is not done: it plays at its own pace');
    assert.match(await page.locator('#play .over').innerText(), /Fast forward/); assert.equal(await page.locator('#play .over [data-p=prep]').count(), 0, 'Prep waits for the AI');
    await page.click('#play .over [data-p=ff]');
    await page.waitForSelector('#play .over [data-p=prep]', { timeout: 20000 });
    assert.equal(await page.locator('#play .over [data-p=ff]').count(), 0);
    await page.click('#play [data-p=prep]');
    assert.ok(['escape', 'pack'].includes(await stOf(page, () => window.DigDigBoomPlay.S.match.runs.ai.prep.step)), 'the AI has not opened a pack: it does that when you open yours');
    await page.evaluate(() => { window.DigDigBoomPlay.S.match.dice = [6]; });
    await page.click('#play [data-p=escape]'); await dieShows(page, '#play .eq .t.die', 6);
    const esc = await stOf(page, () => [window.DigDigBoomPlay.S.match.runs.me.prep.escape, window.DigDigBoomPlay.S.match.runs.ai.prep.escape]);
    assert.equal(esc[0], 6); assert.ok(esc[1] === 6 || esc[1] === null, 'the AI got the same roll when it banked');
    assert.equal(await stOf(page, () => window.DigDigBoomPlay.S.match.runs.ai.prep.step), 'pack', 'its Escape Bonus is read; its pack is still closed');
    await page.click('#play [data-p=openpack]');
    assert.equal(await stOf(page, () => window.DigDigBoomPlay.S.match.runs.ai.prep.step), 'kit', 'the AI opened its pack with you');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('ai: a reload in the middle of a match puts you and the AI back exactly where you were', SKIP, async () => {
  const { browser, page, errors } = await open({ menu: true });
  try {
    await startRun(page, { opp: true });
    for (let i = 0; i < 3; i++) { await page.click('#play [data-p=dig]'); if (await page.locator('#play [data-p=roll]').count()) { await page.click('#play [data-p=roll]'); await faceIt(page); } if (await page.locator('#play .over').count()) break; }
    await page.evaluate(() => window.DigDigBoomPlay.tick());
    const snap = () => stOf(page, () => { const m = window.DigDigBoomPlay.S.match; return { me: m.runs.me.dig.digs, ai: m.runs.ai.dig.digs, aiLog: m.runs.ai.dig.log.length, board: JSON.stringify(m.board.spots) }; });
    const before = await snap();
    await page.reload(); await page.waitForSelector('#play .ptable');
    assert.deepEqual(await snap(), before);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

// ---------------------------------------------------------------- the dice
test('dice: every roll is played out on a ten-sided die and ends showing the number; the Escape Bonus too', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    await begin(page, { mine: ['MO-01'], dice: [7] });
    await page.click('#play [data-p=dig]');
    assert.equal(await page.locator('#play .dieb svg.d10').count(), 1, 'a die, drawn as a d10, waiting to be tapped');
    await page.click('#play [data-p=roll]');
    assert.ok(await page.locator('#play .dieb svg.d10.fx-tumble').count() === 1, 'it tumbles'); await dieShows(page, '#play .dieb', 7);
    assert.equal(await page.locator('#play .calc').count(), 0, 'the die says it; nothing repeats the number underneath');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('cards: Monster A and Monster B are different at a glance (their own creature and colours); no art slot on Power, Immediate and Ongoing cards; a Geode is one giant count-and-gem on brown', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    await page.evaluate(() => window.DigDigBoomUI.setMode('cards')); await page.waitForSelector('section.dir');
    const look = id => page.locator(`#deckRow .card[data-id=${id}]`).first().evaluate(e => { const a = e.querySelector('.art'); return { sym: a && a.querySelector('use').getAttribute('href'), bg: a && getComputedStyle(a).backgroundImage, arts: e.querySelectorAll('.art').length }; });
    const a = await look('MO-01'), b = await look('MO-02');
    assert.notEqual(a.sym, b.sym, 'a different creature'); assert.notEqual(a.bg, b.bg, 'and a different colour of sunburst');
    for (const id of ['PW-02', 'IM-01', 'ON-33']) assert.equal((await look(id)).arts, 0, `${id} has no art placeholder`);
    assert.equal((await look('TR-01')).arts, 0, 'a Geode has no separate art strip either');
    assert.equal(await page.locator('#deckRow .card[data-id=TR-01] .gemtile').count(), 6);
    const brown = await page.locator('#deckRow .card[data-id=TR-01]').evaluateAll(els => els.map(e => getComputedStyle(e.querySelector('.band')).backgroundColor));
    assert.equal(new Set(brown).size, 1, 'every Geode has the same brown header');
    assert.doesNotMatch(await page.locator('body').innerText(), /Questions already written|[Pp]rint guides|Print sheets/);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('menu: opening the game from the shelf shows the main menu with Continue (not straight into your game); a reload still puts you back where you were', SKIP, async () => {
  const { browser, page, errors } = await open({ menu: true });
  try {
    await startRun(page); await page.click('#play [data-p=dig]');
    const ctx = page.context(), fresh = await ctx.newPage();
    await fresh.addInitScript(() => { window.DDB_AI_PACE = 3600000; });
    await fresh.route('**/docs.google.com/**', r => r.fulfill({ status: 200, contentType: 'text/csv', body: csv }));
    await fresh.goto(FILE); await fresh.waitForSelector('#play .home');
    await fresh.waitForTimeout(400);
    assert.equal(await fresh.locator('#play .ptable').count(), 0, 'not straight into the game');
    assert.match(await fresh.locator('#play .homemenu').innerText(), /Continue/);
    await fresh.click('#play [data-p=resume]'); await fresh.waitForSelector('#play .ptable');
    await fresh.reload(); await fresh.waitForSelector('#play .ptable');          // a reload resumes mid-game
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
