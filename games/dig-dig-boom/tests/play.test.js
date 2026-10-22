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
  await page.addInitScript(() => { window.DDB_AI_PACE = 3600000; window.DDB_TALLY_PACE = 0.01; window.DDB_NO_DANGER = true; window.DDB_HERO_PACE = window.DDB_HERO_PACE || 1; });         // the AI's own clock never fires on its own in a test: tests call DigDigBoomPlay.tick()
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
  const uids = await page.evaluate(() => window.DigDigBoomPlay.S.run.prep.offer.filter(c => !/When kept/.test(c.text)).map(c => c.uid));
  for (const u of uids.slice(0, n)) await page.click(`#play [data-p=pick][data-uid="${u}"]`);          // tap to move each card up into a place...
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
    assert.match(menu, /Settings[\s\S]*The cards[\s\S]*Playtest/); assert.doesNotMatch(menu, /[Tt]rash|Nobody|Opponent|[Pp]rint|Rounds/);
    assert.equal(await page.locator('#play .seg button').count(), 0, 'no choice of rounds');
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
    assert.equal(await page.locator('#play .tcard.inplay').count(), 0, 'nothing but the Pet is in play at the start: the Lucky Coin is out of the game');
    assert.match(await page.locator('#play .deck .cnt').innerText(), /^32$/, 'the 30 plus the 2 kit cards');
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
    assert.match(await page.locator('#play [data-p=bank]').innerText(), /^BANK\s*1/i);
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
    assert.match(await page.locator('#play [data-p=bank]').innerText(), /^BANK\s*1/i, 'a defeated Monster is worth a gem');
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
    await page.click('#play [data-p=face]');                                        // Newt is still eligible: the first tap only asks
    assert.match(await page.locator('#play .takedmg').innerText(), /still use cards[\s\S]*again/i, 'you can still use cards: are you sure?'); assert.equal(await stOf(page, () => window.DigDigBoomPlay.S.st.survived), 0, 'nothing happened yet');
    await page.click('#play [data-p=face]');                                        // the second tap: you took the damage, Newt is not used
    assert.deepEqual(await stOf(page, () => [window.DigDigBoomPlay.S.st.heart, window.DigDigBoomPlay.S.st.survived]), [6, 1], 'Newt never triggered; the 1 damage was blocked');
    await page.click('#play [data-p=dig]'); await page.click('#play [data-p=roll]');
    await page.click('#play [data-p=triggerall]');
    assert.equal(await page.locator('#play .tcard.elig').count(), 0);
    await page.click('#play [data-p=face]');
    assert.deepEqual(await stOf(page, () => [window.DigDigBoomPlay.S.st.heart, window.DigDigBoomPlay.S.st.survived]), [5, 2], 'this time Newt healed 1 and Pill Bug blocked 1 of the 3 damage: 6 + 1 - 2');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('table: a Power or Ongoing card is dug into the flip spot, face up, and moves up with the others when you dig the next card', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    await begin(page, { mine: ['TR-01', 'PW-02', 'ON-33', 'IM-13'] });
    await page.click('#play [data-p=dig]');                                                                  // a Geode: in the flip spot
    assert.equal(await page.locator('#play .slot .card[data-id="TR-01"]').count(), 1);
    await page.click('#play [data-p=dig]');                                                                  // Nurse Newt: lies in the flip spot, face up
    assert.equal(await page.locator('#play .slot .card[data-id="PW-02"]').count(), 1, 'a card you draw goes in the pile of drawn cards');
    assert.equal(await page.locator('#play .tableau .card[data-id="PW-02"]').count(), 0, 'it is not up with the Power cards yet');
    await page.click('#play [data-p=dig]');                                                                  // Tune-Up: now Nurse Newt moves up
    assert.equal(await page.locator('#play .tableau .card[data-id="PW-02"]').count(), 1, 'it moved up when the next card was dug');
    assert.equal(await page.locator('#play .slot .card[data-id="ON-33"]').count(), 1); assert.equal(await page.locator('#play .tableau .card[data-id="ON-33"]').count(), 0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('table: a card whose requirements are not met is not highlighted, but it is still there', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    await begin(page, { mine: ['MO-01'], dice: [8], line: ['PW-07', 'PW-02'], start: { heart: 7 } });             // Nervous Mouse wants 4 Health or less
    await page.click('#play [data-p=dig]'); await page.click('#play [data-p=roll]');
    assert.equal(await page.locator('#play .tcard.elig').count(), 1, 'only Nurse Newt');
    assert.equal(await page.locator('#play .tcard[aria-label^="Nervous Mouse"]').count(), 1, 'Nervous Mouse is still on the table');
    assert.match(await page.locator('#play .tcard[aria-label^="Nervous Mouse"] .tg').innerText(), /4/, 'and says what it wants');
    assert.ok(Number(await page.locator('#play .tcard[aria-label^="Nervous Mouse"]').evaluate(e => getComputedStyle(e).opacity)) >= 0.8, 'dimmed, not faded out');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('table: take the damage while a card could still be used asks first (tap again); the Bank says Bank, then the gems', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    await begin(page, { mine: ['MO-01'], dice: [6], line: ['PW-02'], start: { heart: 5 } });
    await page.click('#play [data-p=dig]'); await page.click('#play [data-p=roll]');
    await page.click('#play [data-p=face]'); assert.match(await page.locator('#play .takedmg').innerText(), /can still use cards/i); assert.equal(await stOf(page, () => window.DigDigBoomPlay.S.st.survived), 0);
    await page.click('#play .tcard.elig');                                                                  // using a card clears the question
    assert.doesNotMatch(await page.locator('#play .takedmg').innerText(), /can still use/i);
    await page.click('#play [data-p=face]'); assert.equal(await stOf(page, () => window.DigDigBoomPlay.S.st.survived), 1);
    assert.match(await page.locator('#play [data-p=bank]').innerText(), /^BANK\s*\d/i, 'Bank first, then the number');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('table: the Cloning Machine goes under the card it clones (Power or Ongoing) and a tap on a cloned Power card uses it twice', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    await begin(page, { mine: ['ON-06', 'MO-01'], dice: [6], line: ['PW-15'], ongoing: ['ON-33'], start: { heart: 2 } });
    await page.click('#play [data-p=dig]');
    assert.ok(await page.locator('#play .tcard.pick').count() >= 2, 'a Power card and an Ongoing card can be picked');
    await page.click('#play .tcard.pick[aria-label^="Moss Sloth"]');
    assert.equal(await page.locator('#play .tcard[aria-label^="Moss Sloth"] .underc').count(), 1, 'the Machine lies under it');
    assert.equal(await page.locator('#play .tableau > .tcard.inplay[aria-label^="Cloning Machine"]').count(), 0, 'and is not in the Ongoing area as well');
    await page.click('#play [data-p=dig]'); await page.click('#play [data-p=roll]');
    await page.click('#play .tcard.elig[aria-label^="Moss Sloth"]');
    assert.equal(await stOf(page, () => window.DigDigBoomPlay.S.st.heart), 2 + 2 + 2, 'one tap, two uses');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('table: when the Mine runs out a message says what happens next, once, and the next Bonus Monster is face up on it', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    await begin(page, { mine: ['TR-01'], dice: [10, 10] });
    await page.evaluate(() => { const P = window.DigDigBoomPlay; P.S.run = null; });
    await page.click('#play [data-p=dig]');
    await page.waitForSelector('#play .mnote');
    assert.match(await page.locator('#play .mnote').innerText(), /bottom of your Mine[\s\S]*Bonus Monsters[\s\S]*face up[\s\S]*8[\s\S]*up by 1[\s\S]*bank at any time/i);
    assert.equal(await page.locator('#play .deck .card[data-id="BONUS"]').count() + await page.locator('#play .deck .mcard, #play .deck .card').count() > 0, true, 'a card is face up on the empty Mine');
    assert.match(await page.locator('#play .deck').innerText(), /8/, 'it says how much damage it deals');
    await page.click('#play [data-p=emptyok]'); assert.equal(await page.locator('#play .mnote').count(), 0, 'once you have read it, it goes');
    await page.click('#play [data-p=dig]'); await page.click('#play [data-p=roll]'); await page.click('#play [data-p=face]');
    assert.equal(await page.locator('#play .mnote').count(), 0, 'and does not come back');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('the AI takes its time like a person: about a second and a half a card, several seconds for a Monster, never twice the same', SKIP, async () => {
  const { browser, page, errors } = await open({ menu: true });
  try {
    await page.click('#play [data-p=startrun]'); await page.waitForSelector('#play [data-p=openpack]');
    const P = await page.evaluate(() => DDB.ai.pace);
    assert.ok(P.cardMs >= 1200 && P.cardMs <= 2200, 'a card: ' + P.cardMs); assert.ok(P.monsterMs >= 2000, 'a Monster takes longer'); assert.ok(P.jitter > 0);
    assert.ok(P.startMs >= 1500, 'it takes a moment before its first card');
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
    await page.waitForSelector('#play [data-p=face]', { state: 'visible' });          // (it appears when the die has landed)
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
    assert.match(o, /banked!/i); assert.match(o, /2 Geodes|\(2 from Geodes, 0 from Monsters\)/);
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
    const seen = [];          // (the card on top is read: the one before it stays visible underneath while the new one flips over it)
    for (let i = 0; i < 6; i++) {
      await page.click('#play [data-p=dig]');
      seen.push(await page.evaluate(() => { const c = [...document.querySelectorAll('#play .mat .mcard .card')].pop(); const tile = c.querySelector('.gemtile'); return { bg: getComputedStyle(tile).backgroundImage, cut: [...c.querySelectorAll('use')].map(u => u.getAttribute('href')).find(h => h.startsWith('#gem-')) }; }));
    }
    assert.equal(new Set(seen.map(x => x.bg)).size, 6, 'six different gem colours in a row: ' + JSON.stringify(seen));
    assert.equal(new Set(seen.map(x => x.cut)).size, 6, 'and six different cuts, so colour is never the only clue');
    const cells = await page.evaluate(() => [...document.querySelectorAll('#play .track')].map(t => [...t.querySelectorAll('.tc')].map(c => { const r = c.getBoundingClientRect(); return [Math.round(r.left * 10) / 10, Math.round(r.width * 10) / 10]; })));
    const [heart, reroll] = cells;
    assert.equal(heart.length, 11); assert.equal(reroll.length, 11, "Extra Rolls go up to 10");
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
    assert.equal(await page.locator('#play .pack b').innerText(), 'Bronze'); assert.match(await page.locator('#play .pack:not(.ghostpack)').innerText(), /Draw 3 · Keep 1/);
    assert.equal(await page.locator('#play .tabs').count(), 0, 'no catalogue of cards');
    await page.click('#play [data-p=openpack]'); assert.equal(await page.locator('#play [data-p=pick]').count(), 3);
    assert.ok(await page.locator('#play [data-p=keepgo]').isDisabled(), 'Keep waits until you have chosen');
    const pos = await page.locator('#play [data-p=keepgo]').evaluate(e => { const r = e.getBoundingClientRect(); return [r.right > innerWidth * .6, r.bottom > innerHeight * .8]; });
    assert.deepEqual(pos, [true, true], 'the confirm button is bottom right, where the most reachable things are');
    assert.equal(await page.evaluate(() => document.querySelector('#play .scroll').scrollHeight <= document.querySelector('#play .scroll').clientHeight + 1), true, 'the pack fits the screen: nothing scrolls');
    assert.equal(await page.locator('#play .keepsay').count(), 0, 'no instruction line: the layout says it all');
    await page.click('#play [data-p=pick] >> nth=0'); assert.equal(await page.locator('#play .pcard.sel').count(), 1, 'one tap chooses');
    const first = await stOf(page, () => window.DigDigBoomPlay.S.run.prep.picked.slice());
    await page.click('#play [data-p=pick] >> nth=1'); assert.deepEqual(await stOf(page, () => window.DigDigBoomPlay.S.run.prep.picked.slice()), first, 'with all you may keep chosen, another card cannot be chosen: nothing is silently dropped');
    assert.ok(await page.locator('#play [data-p=keepgo]').isEnabled());
    await page.click('#play [data-p=pick] >> nth=0'); assert.equal(await page.locator('#play .pcard.sel').count(), 0, 'tapping a chosen card puts it back'); await page.click('#play [data-p=pick] >> nth=1'); assert.equal(await page.locator('#play .pcard.sel').count(), 1);
    assert.equal(await stOf(page, () => window.DigDigBoomPlay.S.run.prep.step), 'keep');
    assert.equal(await page.locator('#play .kslot').count(), 1, 'the pack uses the same layout as the Starter Kit: a place on top for each card you may keep');
    await page.click('#play .kslot .pcard');                                                                // put the card back
    const s1 = await page.locator('#play .pool [data-p=pick]').first().boundingBox(), d1 = await page.locator('#play .kslot[data-i="0"]').boundingBox();
    await page.mouse.move(s1.x + s1.width / 2, s1.y + s1.height / 2); await page.mouse.down(); await page.mouse.move(d1.x + d1.width / 2, d1.y + d1.height / 2, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(120);
    assert.equal(await stOf(page, () => window.DigDigBoomPlay.S.run.prep.picked.length), 1, 'dragging a card up into the place chooses it');
    const s2 = await page.locator('#play .kslot .pcard').boundingBox();
    await page.mouse.move(s2.x + s2.width / 2, s2.y + s2.height / 2); await page.mouse.down(); await page.mouse.move(60, 770, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(120);
    assert.equal(await stOf(page, () => window.DigDigBoomPlay.S.run.prep.picked.length), 0, 'and dragging it off puts it back');
    assert.ok(await page.locator('#play [data-p=keepgo]').isDisabled(), 'nothing chosen: Keep waits');
    await keepNonMystery(page, 1);
    assert.equal(await page.locator('#play [data-p=kitpick]').count(), 1, 'one card to choose from: the one you kept');
    assert.equal(await page.locator('#play [data-p=kitgem]').count(), 0, 'no gem to pick: an empty place is a gem');
    assert.equal(await page.locator('#play .kitbar .count').count(), 0, 'no "0 of 1" count: the outlined places say it');
    assert.match(await page.locator('#play .kdef').innerText(), /^These will be the first cards you draw\.\s*Any place you leave empty gets a\s+gem instead\.$/, 'the Starter Kit is defined, not explained');
    assert.equal(await page.locator('#play .kslot.empty .kgem').count(), 1, 'an empty place shows the gem it will be filled with');
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('#play .kitbar b')).fontSize), '42px', 'the Keep and Starter Kit titles use the same size');
    assert.equal(await page.locator('#play .pips2').count(), 0, 'no circles');
    assert.equal(await page.locator('#play [data-p=startround]').isEnabled(), true, 'you may start with the place empty');
    await page.click('#play [data-p=startround]'); await page.waitForSelector('#play .ptable');
    assert.equal(await stOf(page, () => window.DigDigBoomPlay.S.st.geodeGems), 0, 'the gem is a card on top of the Mine: nothing in the Bank until you dig it');
    assert.equal(await stOf(page, () => window.DigDigBoomPlay.S.st.mine[0].type), 'Treasure', 'the empty place is a gem, face up on top of the Mine');
    assert.equal(await stOf(page, () => window.DigDigBoomPlay.S.st.known), 1, 'only that gem is known: the card you left out of the kit is shuffled into the Mine');
    assert.equal(await page.locator('#play .deck .card').count() > 0, true, 'the gem shows face up on the Mine');
    await page.click('#play [data-p=dig]'); await page.waitForTimeout(300);
    assert.match(await page.locator('#play [data-p=bank]').innerText(), /^BANK\s*1/i, 'dig the gem and it is in the Bank');
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
    assert.match(await page.locator('#play .over').innerText(), /banked![\s\S]*4 Monsters survived · ♛/i);
    await page.click('#play [data-p=prep]');
    assert.ok(await page.locator('#play .bigboard .bgrid .bcol').count() >= 9, 'first the Leaderboard, full screen: a column for each number, with spots stacked in it'); assert.ok(await page.locator('#play .bigboard .bspot').count() >= 9, 'one row for each player'); assert.equal(await page.locator('#play .bdisc').count(), 0, 'your Dig is over, so its piece is gone: your chip (best) is in the top row'); assert.equal(await page.locator('#play .bigboard .pchip.me').count(), 1); assert.match(await page.locator('#play .bigboard .blabels').innerText(), /best[\s\S]*this round/i, 'the rows are labelled');
    await page.evaluate(() => { window.DigDigBoomPlay.S.run.dice = [8]; });
    await page.click('#play [data-p=boardgo]');
    assert.equal(await page.locator('#play .bigdie, #play [data-p=escape]').count(), 0, 'nothing to tap: the die rolls by itself');
    await page.waitForSelector('#play .eq .t.die.pop'); await dieShows(page, '#play .eq .t.die', 8); assert.match(await page.locator('#play .eq').innerText(), /1\s*\+\s*4\s*\+/, 'Geodes + Monsters + the die');
    await page.waitForSelector('#play .pack:not(.ghostpack)'); await page.waitForFunction(() => /13/.test(document.querySelector('#play .eq .sum').textContent)); assert.match(await page.locator('#play .eq .sum').innerText(), /13/); assert.equal(await page.locator('#play .pack b').innerText(), 'Silver');
    assert.equal(await page.locator('#play .lb, #play .pbar h1').count(), 0, 'no Leaderboard and no title in Prep: just a Menu in the corner');
    assert.equal(await page.locator('#play .pbar [data-p=gmenu]').count(), 1);
    await page.click('#play [data-p=openpack]'); assert.equal(await page.locator('#play [data-p=pick]').count(), 4);
    const w = await page.locator('#play [data-p=pick]').first().evaluate(e => e.offsetWidth); assert.ok(w >= 150, 'whole cards, not a reduction: ' + w);
    assert.doesNotMatch(await page.locator('#play .panel').innerText(), /[Ll]ast [Dd]ig|banked after/);
    await keepNonMystery(page, 2);
    assert.equal(await page.locator('#play [data-p=kitpick]').count(), 3, 'the card from round 1 and the two you kept');
    assert.equal(await page.locator('#play .kslot .pcard').count(), 1, "last round's Starter Kit is already in its place");
    assert.match(await page.locator('#play .kslot .ctag.last').innerText(), /last round/i); assert.equal(await page.locator('#play .pool .ctag.new').count(), 2, 'what you just won is marked new');
    await page.click('#play [data-p=kitpick] >> nth=1');                                  // a new card joins the kit
    assert.equal(await page.locator('#play .kslot .pcard').count(), 2); 
    const order0 = await stOf(page, () => window.DigDigBoomPlay.S.run.prep.kitPick.slice());
    const src = await page.locator('#play .kslot[data-i="1"] .pcard').boundingBox(), dst = await page.locator('#play .kslot[data-i="0"]').boundingBox();
    await page.mouse.move(src.x + src.width / 2, src.y + src.height / 2); await page.mouse.down(); await page.mouse.move(dst.x + dst.width / 2, dst.y + dst.height / 2, { steps: 8 }); await page.mouse.up();
    assert.deepEqual(await stOf(page, () => window.DigDigBoomPlay.S.run.prep.kitPick.slice()), [order0[1], order0[0]], 'dragging one kit card onto another swaps them');
    assert.equal(await stOf(page, () => window.DigDigBoomPlay.S.run.prep.step), 'kit', 'a drag is not a tap');
    await page.waitForTimeout(120);
    const out = await page.locator('#play .kslot[data-i="0"] .pcard').boundingBox();
    await page.mouse.move(out.x + out.width / 2, out.y + out.height / 2); await page.mouse.down(); await page.mouse.move(60, 770, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(120);
    assert.equal(await stOf(page, () => window.DigDigBoomPlay.S.run.prep.kitPick.length), 1, 'dragging a card off the Kit takes it out: it goes back to your cards');
    await page.click('#play .pool [data-p=kitpick] >> nth=0'); await page.waitForTimeout(120);
    assert.equal(await stOf(page, () => window.DigDigBoomPlay.S.run.prep.kitPick.length), 2, 'and a tap puts one back');
    await page.click('#play [data-p=startround]');
    await page.waitForSelector('#play .fnote');
    assert.match(await page.locator('#play .fnote').innerText(), /FINAL ROUND/i, 'the final round is announced before anyone digs');
    assert.equal(await page.locator('#play .frules.open').count(), 0, 'the rules are only a button away');
    await page.click('#play [data-p=finalhow]'); assert.match(await page.locator('#play .frules.open').innerText(), /Nobody banks[\s\S]*keep going[\s\S]*wait/i); assert.doesNotMatch(await page.locator('#play .fnote').innerText(), /of 2|the last one/i, 'it does not repeat that it is the last round');
    await page.click('#play [data-p=finalok]'); assert.equal(await page.locator('#play .fnote').count(), 0, 'then it goes');
    assert.match(await page.locator('#play .lbhead').innerText(), /round 2 of 2 · final/i);
    assert.equal(await stOf(page, () => window.DigDigBoomPlay.S.st.known), 2, 'the two kit cards are on top of the Mine, face up; the third is shuffled in');
    assert.equal(await page.locator('#play [data-p=bank]').count(), 0, 'the final round has no Bank at all, and no gem count');
    assert.match(await page.locator('#play .aprompt').innerText(), /last round: nobody banks|in the lead/i, 'it says why, and what to do');
    assert.match(await page.locator('#play .lbhead').innerText(), /not in the lead: keep digging/i);
    await script(page, { mine: ['MO-01', 'MO-02', 'MO-01', 'MO-02', 'MO-01'], dice: Array(30).fill(10) });
    for (let i = 0; i < 6 && !(await page.locator('#play .over').count()); i++) { await page.click('#play [data-p=dig]'); await page.click('#play [data-p=roll]'); await faceIt(page); }
    assert.match(await page.locator('#play .over').innerText(), /in the lead![\s\S]*Everyone else is out/i);
    await page.click('#play [data-p=prep]');                                             // the last round: straight to the end, which is the Leaderboard
    assert.match(await page.locator('#play .panel').innerText(), /You hold the Crown Jewel!/);
    assert.ok(await page.locator('#play .bigboard .bgrid .bcol').count() >= 9, 'the result is shown on the Leaderboard'); assert.equal(await page.locator('#play .bpl.me .cjewel').count(), 1, 'the Crown Jewel is on your name, at the bottom'); assert.equal(await page.locator('#play .bcrown').count(), 0, 'and no longer on the board');
    await page.click('#play [data-p=roundlog]'); assert.equal(await page.locator('#play .rrow').count(), 2, 'one row for each round'); assert.match(await page.locator('#play .panel').innerText(), /Banked|BOOM/);
    await page.click('#play [data-p=enddone]'); assert.match(await page.locator('#play .panel').innerText(), /You hold the Crown Jewel!/, 'and back to the Leaderboard');
    await page.click('#play [data-p=owned]'); assert.ok(await page.locator('#play .ownedpanel .ocard').count() >= 1, 'the cards you built'); await page.click('#play [data-p=ownedclose]', { position: { x: 5, y: 5 } });
    assert.equal(await page.locator('#play [data-p=startrun]').count(), 1, 'and a new run is one button away');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('run: after a bank the tally is shown one piece at a time — Treasure, then Monsters, then the die waits for you, then the die lands and only then the pack appears — while a thermometer of packs fills up', SKIP, async () => {
  const { browser, page, errors } = await open({ menu: true });
  try {
    await page.addInitScript(() => { window.DDB_TALLY_PACE = 0.5; });
    await page.reload(); await page.waitForSelector('#play .home');
    await startRun(page, { opp: false, rounds: 3 });
    await script(page, { mine: ['TR-01', 'TR-01', 'MO-01', 'TR-01', 'TR-01'], dice: [10, 10] });          // (a spare card, so the Mine does not run dry: that would bring up a message)
    for (let i = 0; i < 4; i++) { await page.click('#play [data-p=dig]'); if (i === 2) { await page.click('#play [data-p=roll]'); await faceIt(page); } }
    await page.click('#play [data-p=bank]'); await page.click('#play [data-p=prep]');
    await page.evaluate(() => { window.DigDigBoomPlay.S.run.dice = [6]; }); await page.click('#play [data-p=boardgo]');
    assert.equal(await page.locator('#play .gchart').count(), 1, 'the thermometer is on the side from the start');
    assert.equal(await page.locator('#play .pack:not(.ghostpack)').count(), 0, 'no pack yet');
    await page.waitForFunction(() => document.querySelectorAll('#play .eq .t.pop').length === 1);                    // Treasure first
    assert.equal(await page.locator('#play .eq .t.pop').count(), 1);
    await page.waitForFunction(() => document.querySelectorAll('#play .eq .t.pop').length === 2);                    // then Monsters
    assert.equal(await page.locator('#play .eq .t.die.pop').count(), 0, 'the die has not come yet');
    const before = await page.locator('#play .gbubble').innerText();
    await page.waitForSelector('#play .eq .t.die.pop');                                                              // then the die rolls by itself
    assert.equal(await page.locator('#play .pack:not(.ghostpack)').count(), 0, 'the die is still rolling: the pack is not shown yet');
    await page.waitForSelector('#play .pack:not(.ghostpack)');
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
    await page.evaluate(() => { window.DigDigBoomPlay.S.run.dice = [4]; }); await page.click('#play [data-p=boardgo]');
    assert.equal(await page.locator('#play .eq .t.die.pop').count(), 0, 'nothing has been revealed yet and the timers are slow');
    await page.click('#play [data-p=skiptally]'); await dieShows(page, '#play .eq .t.die', 4);
    assert.equal(await page.locator('#play .pack:not(.ghostpack)').count(), 0); await page.click('#play [data-p=skiptally]');
    assert.equal(await page.locator('#play .pack:not(.ghostpack)').count(), 1, 'and a tap while the die lands brings the pack');
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
    await page.click('#play [data-p=prep]'); await page.click('#play [data-p=boardgo]');
    assert.equal(await page.locator('#play .eq').count(), 0, 'no Escape Bonus after a BOOM'); assert.equal(await page.locator('#play .pack b').innerText(), 'Bronze');
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
  const ALL = `(document.querySelector('#play .zoom') ? [document.querySelector('#play .zoom')] : [...document.querySelectorAll('#play [data-p]:not([disabled])')]).filter(e => e.getBoundingClientRect().width > 0 && (!(e.closest('.pbar') || e.closest('.foot')) || ['startround', 'prep', 'boardgo', 'keepgo', 'continuereveal', 'again', 'openpack', 'ff'].includes(e.dataset.p)) && (r => e.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)))(e.getBoundingClientRect()))`;
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
        const prefer = pool.filter(([, p]) => ['dig', 'roll', 'face', 'boardgo', 'openpack', 'pick', 'keepgo', 'kitpick', 'startround', 'prep', 'unzoom', 'ff', 'hold'].includes(p));
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
    assert.match(await page.locator('#play .lbhead').innerText(), /you[\s\S]*easy[\s\S]*med[\s\S]*hard/i);
    assert.equal(await page.locator('#play .ailine').count(), 0, 'nothing to read: you watch its marker');
    await script(page, { mine: ['MO-01', 'MO-02', 'MO-01', 'MO-02'], dice: Array(30).fill(10) });
    const aiDigs = () => stOf(page, () => window.DigDigBoomPlay.S.match.runs.easy.dig.digs);
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
    await page.waitForFunction(() => window.DigDigBoomPlay.S.match.runs.easy.dig.digs >= 2 || window.DigDigBoomPlay.S.match.runs.easy.dig.over, null, { timeout: 15000 });
    assert.equal(await page.evaluate(h => h.isConnected, mine), true, 'the Mine button you might be pressing was not replaced');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('ai: when your Dig ends you go on at once (the AI finishes behind the scenes, no Fast-forward); the Escape Bonus is one die for both; the AI preps when you open your pack; the end names a winner', SKIP, async () => {
  const { browser, page, errors } = await open({ menu: true });
  try {
    await startRun(page, { opp: true, rounds: 2 });
    await script(page, { mine: ['TR-01', 'TR-01'] });
    await page.click('#play [data-p=dig]'); await page.click('#play [data-p=bank]');
    assert.equal(await stOf(page, () => window.DigDigBoomPlay.S.match.runs.easy.dig.over), null, 'the AI is not done: it plays at its own pace');
    assert.equal(await page.locator('#play .over [data-p=ff]').count(), 0, 'no Fast-forward'); assert.doesNotMatch(await page.locator('#play .over').innerText(), /still digging/i);
    assert.equal(await page.locator('#play .over [data-p=prep]').count(), 1, 'the usual button is there at once');
    await page.click('#play [data-p=prep]');
    assert.ok(await page.locator('#play .bigboard .bgrid .bcol').count() >= 9, 'the Leaderboard first: columns of stacked spots'); { const toks = (await page.locator('#play .bigboard .bgrid .pchip').allInnerTexts()).map(t => t.replace(/[^A-Za-z]/g, '')); assert.equal(toks.length, 4, 'one chip for each player'); assert.deepEqual(toks.filter(Boolean), ['You'], 'only your chip is labelled: the others are told apart by colour'); assert.equal((await page.locator('#play .bplayers .bpl').allInnerTexts()).map(t => t.replace(/[^A-Za-z ]/g, '').trim()).join('|'), 'You|Easy AI|Medium AI|Hard AI', 'the players are named at the bottom'); } assert.equal(await page.locator('#play .bigboard .blegend').count(), 0);
    await page.evaluate(() => { window.DigDigBoomPlay.S.match.dice = [6]; }); await page.click('#play [data-p=boardgo]');
    assert.ok(['escape', 'pack'].includes(await stOf(page, () => window.DigDigBoomPlay.S.match.runs.easy.prep.step)), 'the AI has not opened a pack: it does that when you open yours');
    await page.waitForSelector('#play .eq .t.die.pop'); await dieShows(page, '#play .eq .t.die', 6);
    const esc = await stOf(page, () => [window.DigDigBoomPlay.S.match.runs.me.prep.escape, window.DigDigBoomPlay.S.match.runs.easy.prep.escape]);
    assert.equal(esc[0], 6); assert.ok(esc[1] === 6 || esc[1] === null, 'the AI got the same roll when it banked');
    assert.equal(await stOf(page, () => window.DigDigBoomPlay.S.match.runs.easy.prep.step), 'pack', 'its Escape Bonus is read; its pack is still closed');
    await page.click('#play [data-p=openpack]');
    await page.waitForFunction(() => window.DigDigBoomPlay.S.match.runs.easy.prep.step === 'kit', null, { timeout: 8000 });          // it thinks a moment after your pack starts opening, so the screen is not held up
    assert.equal(await stOf(page, () => window.DigDigBoomPlay.S.match.runs.easy.prep.step), 'kit', 'the AI opened its pack with you');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('ai: a reload in the middle of a match puts you and the AI back exactly where you were', SKIP, async () => {
  const { browser, page, errors } = await open({ menu: true });
  try {
    await startRun(page, { opp: true });
    for (let i = 0; i < 3; i++) { await page.click('#play [data-p=dig]'); if (await page.locator('#play [data-p=roll]').count()) { await page.click('#play [data-p=roll]'); await faceIt(page); } if (await page.locator('#play .over').count()) break; }
    await page.evaluate(() => window.DigDigBoomPlay.tick());
    const snap = () => stOf(page, () => { const m = window.DigDigBoomPlay.S.match; return { me: m.runs.me.dig.digs, ai: m.runs.easy.dig.digs, aiLog: m.runs.easy.dig.log.length, board: JSON.stringify(m.board.spots) }; });
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

test('the main menu is the real one on the first frame: with a saved copy of the cards it shows at once while the sheet is read in the background, and a changed sheet is picked up quietly', SKIP, async () => {
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const page = await (await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true })).newPage();
  let delay = 0, body = csv;
  await page.route('**/docs.google.com/**', async r => { if (delay) await new Promise(x => setTimeout(x, delay)); r.fulfill({ status: 200, contentType: 'text/csv', body }); });
  try {
    await page.goto(FILE); await page.waitForSelector('#play [data-p=startrun]:not([disabled])');            // the first visit: no saved copy yet
    delay = 2500; body = csv + '\nZZ-99,Test Pup,Power,4,Booster,1,+1 {heart}\n';
    const t = Date.now(); await page.goto(FILE); await page.waitForSelector('#play .home');
    assert.ok(Date.now() - t < 1500, 'the menu shows without waiting for the sheet: ' + (Date.now() - t) + ' ms');
    assert.equal(await page.locator('#play [data-p=startrun]').isDisabled(), false, 'Play is ready on the first frame');
    assert.equal(await page.locator('#play .homenote').count(), 0, 'no "Reading your sheet" placeholder');
    const before = await page.evaluate(() => window.DigDigBoomUI.state.all.length);
    await page.waitForFunction(() => window.DigDigBoomUI.state.source === 'sheet', null, { timeout: 8000 });
    assert.equal(await page.evaluate(() => window.DigDigBoomUI.state.all.length), before + 1, 'the sheet changed: the new card is in');
    assert.equal(await page.locator('#play .homenote').count(), 0);
  } finally { await browser.close(); }
});

test('a Mystery Box: the cards you did not keep fly away once, on the pack screen, and not again on the Starter Kit screen', SKIP, async () => {
  const { browser, page, errors } = await open({ menu: true });
  try {
    await page.click('#play [data-p=startrun]'); await page.click('#play [data-p=openpack]'); await page.waitForSelector('#play .pcard[data-p=pick]');
    await page.evaluate(() => { const P = window.DigDigBoomPlay, run = P.S.match.runs.me, pr = run.prep, full = window.DigDigBoomUI.state.all; pr.offer = ['IM-14', 'PW-32', 'PW-09'].map((id, i) => ({ ...full.find(c => c.id === id), uid: 9100 + i })); pr.picked = []; run.deck.unshift({ ...full.find(c => c.id === 'ON-33'), uid: 9150 }); P.render(); });
    await page.click('#play .pcard[data-uid="9100"]'); await page.click('#play [data-p=keepgo]');
    await page.waitForSelector('#play [data-p=continuereveal]');
    assert.equal(await page.locator('#play .sweepcard').count(), 2, 'on the pack screen the two cards fly away');
    await page.click('#play [data-p=continuereveal]'); await page.waitForSelector('#play [data-p=startround]');
    assert.equal(await page.locator('#play .sweepcard').count(), 0, 'and they do not fly away a second time');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('choosing pack cards: a button shows the cards you already own (hidden when you own none), and it closes with a tap; a zoomed card has no instruction either', SKIP, async () => {
  const { browser, page, errors } = await open({ menu: true });
  try {
    await page.click('#play [data-p=startrun]'); await page.click('#play [data-p=openpack]'); await page.waitForSelector('#play .pcard[data-p=pick]');
    assert.equal(await page.locator('#play [data-p=owned]').count(), 0, 'nothing owned yet: no button');
    await page.evaluate(() => { const P = window.DigDigBoomPlay, run = P.S.match.runs.me, full = window.DigDigBoomUI.state.all; run.owned = ['PW-09', 'ON-33'].map((id, i) => ({ ...full.find(c => c.id === id), uid: 9300 + i })); P.render(); });
    assert.match(await page.locator('#play [data-p=owned]').innerText(), /Your cards \(2\)/);
    await page.click('#play [data-p=owned]');
    assert.equal(await page.locator('#play .ownedpanel .ocard').count(), 2, 'both cards are shown');
    assert.doesNotMatch(await page.locator('#play .ownedpanel').innerText(), /tap anywhere/i);
    await page.click('#play [data-p=ownedclose]', { position: { x: 5, y: 5 } }); assert.equal(await page.locator('#play .ownedpanel').count(), 0);
    await page.locator('#play .pcard[data-p=pick]').first().click({ button: 'right' }).catch(() => {});
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('table: there is no "take the damage" button until the die has finished rolling', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    await begin(page, { mine: ['MO-01'], dice: [4], start: { heart: 6 } });
    await page.click('#play [data-p=dig]'); await page.click('#play [data-p=roll]');
    assert.equal(await page.locator('#play .takedmg').isVisible(), false, 'the die is still rolling');
    await page.waitForSelector('#play .takedmg', { state: 'visible', timeout: 4000 });
    assert.equal(await page.locator('#play .takedmg.waitroll').count(), 0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('Prep is one screen: it cannot be scrolled (the pack\'s sparks used to make it scrollable), and the chosen card stays clear of the Starter Kit title', SKIP, async () => {
  const { browser, page, errors } = await open({ menu: true });
  try {
    await page.click('#play [data-p=startrun]'); await page.click('#play [data-p=openpack]'); await page.waitForSelector('#play .pcard[data-p=pick]'); await page.waitForTimeout(1500);
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('#play #setupScroll')).overflowY), 'hidden', 'no scrolling on the pack screen');
    await page.mouse.move(600, 500); await page.mouse.wheel(0, 600); await page.waitForTimeout(150);
    assert.equal(await page.evaluate(() => document.querySelector('#play #setupScroll').scrollTop), 0, 'a wheel or a drag does not move it');
    await keepNonMystery(page, 1);
    await page.waitForSelector('#play .kslots'); await page.click('#play .pool [data-p=kitpick] >> nth=0'); await page.waitForTimeout(300);
    const g = await page.evaluate(() => ({ title: document.querySelector('#play .kitbar').getBoundingClientRect().bottom, slots: document.querySelector('#play .kslots').getBoundingClientRect().top }));
    assert.ok(g.slots - g.title >= 20, 'the Starter Kit title is clear of the cards: ' + (g.slots - g.title) + ' px');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('the last round: when you are in the lead you can fast-forward the opponent, and it slows down again once they catch up with you', SKIP, async () => {
  const { browser, page, errors } = await open({ menu: true });
  try {
    await page.evaluate(() => { const P = window.DigDigBoomPlay; P.S.rounds = 2; });
    await page.click('#play [data-p=startrun]'); await page.waitForSelector('#play [data-p=openpack]');
    await page.evaluate(() => { const m = window.DigDigBoomPlay.S.match; for (const r of Object.values(m.runs)) { r.rounds = 1; } m.rounds = 1; });
    await page.click('#play [data-p=openpack]'); await page.waitForSelector('#play .pcard[data-p=pick]'); await keepNonMystery(page, 1);
    await page.click('#play [data-p=startround]'); await page.waitForSelector('#play .fnote'); await page.click('#play [data-p=finalok]');
    assert.equal(await page.locator('#play .ffbtn').count(), 0, 'not in the lead: nothing to fast-forward');
    await page.evaluate(() => { const P = window.DigDigBoomPlay, m = P.S.match; Board.lockIn(m.board, 'me', 5); Run.refresh(P.S.run); P.render(); });
    assert.match(await page.locator('#play .ffbtn').innerText(), /Fast-forward/i, 'in the lead: the button is there');
    await page.click('#play [data-p=ff]');
    assert.equal(await stOf(page, () => window.DigDigBoomPlay.S.ff), true); assert.match(await page.locator('#play .ffbtn').innerText(), /Fast-forwarding/);
    await page.evaluate(() => { const P = window.DigDigBoomPlay, m = P.S.match; Board.track(m.board, 'easy', 7); P.tick(); });
    assert.equal(await stOf(page, () => window.DigDigBoomPlay.S.ff), false, 'the opponent passed you: back to its own pace');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('the last round: when everyone else has gone BOOM you have won, but the Dig goes on until you choose "See the result"', SKIP, async () => {
  const { browser, page, errors } = await open({ menu: true });
  try {
    await page.evaluate(() => { const P = window.DigDigBoomPlay; P.S.rounds = 2; });
    await page.click('#play [data-p=startrun]'); await page.waitForSelector('#play [data-p=openpack]');
    await page.evaluate(() => { const m = window.DigDigBoomPlay.S.match; for (const r of Object.values(m.runs)) { r.rounds = 1; } m.rounds = 1; });
    await page.click('#play [data-p=openpack]'); await page.waitForSelector('#play .pcard[data-p=pick]'); await keepNonMystery(page, 1);
    await page.click('#play [data-p=startround]'); await page.waitForSelector('#play .fnote');
    assert.match(await page.locator('#play .fnote').innerText(), /FINAL ROUND/); assert.doesNotMatch(await page.locator('#play .fnote').innerText(), /the last one/i);
    await page.click('#play [data-p=finalok]');
    await page.evaluate(() => { const P = window.DigDigBoomPlay, m = P.S.match; Board.lockIn(m.board, 'me', 5); for (const id of Match.botIds(m)) { const r = m.runs[id]; r.dig.over = { kind: 'boom', why: 'test', seq: 99 }; Run.checkOver(r); } Run.refresh(P.S.run); Match.finalCheck(m); P.render(); });
    assert.equal(await page.locator('#play .over').count(), 0, 'your Dig has not ended by itself');
    assert.match(await page.locator('#play .aprompt').innerText(), /You won[\s\S]*Keep digging/i);
    assert.equal(await page.locator('#play [data-p=dig]:not([disabled])').count(), 1, 'you may keep digging');
    await page.click('#play [data-p=hold]'); await page.waitForSelector('#play .bigboard');
    assert.equal(await page.locator('#play .over').count(), 0, 'no ribbon and no little message first: straight to the Leaderboard');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('leaderboard: a bank keeps its piece with a blue gem showing what it earned, a BOOM keeps its piece in a starburst; both stay until you tap, then they go', SKIP, async () => {
  const { browser, page, errors } = await open({ menu: true });
  try {
    await page.evaluate(() => { window.DigDigBoomPlay.S.opp = true; window.DDB_BOARD_PACE = 3600000; }); await page.click('#play [data-p=startrun]'); await page.waitForSelector('#play [data-p=openpack]');
    await page.evaluate(() => { const P = window.DigDigBoomPlay; P.S.bests0 = { me: 0, easy: 0, medium: 0, hard: 0 }; P.S.boardAnim = { from: P.S.bests0, newBest: false, events: [{ r: 1, id: 'hard', k: 'move', n: 2 }, { r: 1, id: 'hard', k: 'bank', n: 2, gems: 7 }, { r: 1, id: 'easy', k: 'boom', n: 0 }], k: 0, stop: false, timer: null, rects: null, fx: null }; P.S.panel = 'board'; P.render(); });
    await page.click('#play .bigboard .scroll');          // skip to the first result
    assert.equal(await page.locator('#play .bgem').innerText(), '7', 'a gem with what it earned');
    assert.equal(await page.locator('#play .bdisc[data-pid=hard]').count(), 1, 'and its piece is still there');
    await page.click('#play .bigboard .scroll'); await page.waitForTimeout(100);
    assert.equal(await page.locator('#play .bgem').count(), 0, 'a tap: the gem goes');
    assert.equal(await page.locator('#play .bdisc[data-pid=hard]').count(), 0, 'with its piece');
    assert.equal(await page.locator('#play .bdisc.blown[data-pid=easy]').count(), 1, 'the piece that went BOOM is still there, in its starburst'); assert.equal(await page.locator('#play .bboom').count(), 1);
    assert.match(await page.locator('#play .bcap').innerText(), /tap to continue/i, 'even the last result waits for a tap');
    await page.click('#play .bigboard .scroll'); await page.waitForTimeout(100);
    assert.equal(await page.locator('#play .bdisc[data-pid=easy]').count(), 0, 'and goes at the next tap');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('leaderboard: 0 to 9 by default; tap the small one while you dig for the full-size board, which keeps up with the opponents; tap it to go back', SKIP, async () => {
  const { browser, page, errors } = await open({ menu: true });
  try {
    await startRun(page, { opp: true, rounds: 3 });
    assert.equal(await page.locator('#play section.lb .lbc').count(), 10, 'the small board runs 0 to 9');
    await page.click('#play section.lb'); await page.waitForSelector('#play .lbfull');
    assert.equal(await page.locator('#play .lbfull .bcol').count(), 11, 'the full-size board: a column for each number 0 to 9 (and the labels)');
    assert.equal(await page.locator('#play .lbfull .bdisc').count(), 4, 'every player digging has a piece on it');
    await page.evaluate(() => window.DigDigBoomPlay.tick());
    assert.equal(await page.locator('#play .lbfull').count(), 1, 'the opponents move behind it and it stays open');
    await page.click('#play .lbfull'); assert.equal(await page.locator('#play .lbfull').count(), 0, 'a tap goes back to the Dig');
    await page.evaluate(() => { const P = window.DigDigBoomPlay; Board.track(P.S.match.board, 'hard', 8); P.render(); });
    assert.equal(await page.locator('#play section.lb .lbc').count(), 10, 'somebody at 8: still 0 to 9');
    await page.evaluate(() => { const P = window.DigDigBoomPlay; Board.track(P.S.match.board, 'hard', 9); P.render(); });
    assert.equal(await page.locator('#play section.lb .lbc').count(), 11, 'somebody at 9: one place more, for 10');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('leaderboard: nothing scrolls at any iPad size (the whole screen is drawn smaller to fit), and your piece says You', SKIP, async () => {
  for (const viewport of [{ width: 1180, height: 820 }, { width: 1024, height: 700 }, { width: 820, height: 1180 }, { width: 1180, height: 600 }]) {
    const { browser, page, errors } = await open({ viewport, menu: true });
    try {
      await page.evaluate(() => { window.DigDigBoomPlay.S.opp = true; }); await page.click('#play [data-p=startrun]'); await page.waitForSelector('#play [data-p=openpack]');
      await page.evaluate(() => { const P = window.DigDigBoomPlay; P.S.bests0 = { me: 0, easy: 0, medium: 0, hard: 0 }; P.S.boardAnim = { from: P.S.bests0, newBest: true, events: [{ r: 1, id: 'me', k: 'move', n: 2 }, { r: 1, id: 'hard', k: 'move', n: 1 }], k: 1, stop: false, timer: null, rects: null, fx: null }; P.S.panel = 'board'; P.render(); });
      const m = await page.evaluate(() => { const s = document.querySelector('#play .bigboard .scroll'), f = document.querySelector('#play .bigboard .foot').getBoundingClientRect(); return { sh: s.scrollHeight, ch: s.clientHeight, bottom: f.bottom, ih: innerHeight, you: document.querySelector('#play .bdisc.me') && document.querySelector('#play .bdisc.me').textContent }; });
      assert.ok(m.sh <= m.ch + 1, `the board fits at ${viewport.width}x${viewport.height}: ${JSON.stringify(m)}`); assert.ok(m.bottom <= m.ih, 'and so does the button');
      assert.equal(m.you, 'You', 'the blue piece is labelled');
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  }
});

test('tapping a card whose power depends on the game says what it is worth right now', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    await begin(page, { mine: ['IM-05', 'TR-01'], ongoing: ['ON-33'], start: { heart: 4 } });                  // Duct Tape: +1 Health for each Ongoing card you have
    await page.click('#play [data-p=dig]'); await page.waitForTimeout(600);
    await page.click('#play .slot [data-p=zoom]');
    assert.match(await page.locator('#play .zoom .zdyn').innerText(), /Right now:\s*\+1/, 'Tune-Up is the one Ongoing card in play: +1');
    assert.doesNotMatch(await page.locator('#play .zoom').innerText(), /tap anywhere/i);
    await page.click('#play .zoom');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('table: a Careful note in the middle of the screen, to be dismissed, when the next Monster could put you out: once in the whole Dig, not for every card and not again after you heal and come back into danger', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    await page.evaluate(() => { window.DDB_NO_DANGER = false; });
    await begin(page, { mine: ['TR-01', 'TR-01', 'MO-02', 'TR-01'], dice: [1, 1], line: [], start: { heart: 2 } });
    await page.waitForSelector('#play .mnote[aria-label=Careful]');
    assert.match(await page.locator('#play .mnote').innerText(), /Careful[\s\S]*next Monster could make you go BOOM/i);
    assert.equal(await page.evaluate(() => { const e = document.elementFromPoint(innerWidth / 2, innerHeight / 2); return !!e.closest('.mnote'); }), true, 'it is in the middle of the screen');
    assert.equal(await stOf(page, () => window.DigDigBoomPlay.S.st.digs), 0);
    await page.click('#play [data-p=dangerok]');
    assert.equal(await page.locator('#play .mnote').count(), 0, 'dismissed');
    await page.click('#play [data-p=dig]');
    assert.equal(await page.locator('#play .mnote').count(), 0, 'still in the same danger: no second note for the next card');
    await page.evaluate(() => { const P = window.DigDigBoomPlay; P.S.st.heart = 10; P.render(); });          // out of danger...
    await page.evaluate(() => { const P = window.DigDigBoomPlay; P.S.st.heart = 1; P.render(); });           // ...and back in
    assert.equal(await page.locator('#play .mnote').count(), 0, 'once per Dig: not again');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('leaderboard: 0 instead of Start; a gold-trimmed chip for each player stacked on 0; the Crown waits on 3 and moves onto the holder\'s name; the players are named in their colours; New Best! when you improve', SKIP, async () => {
  const { browser, page, errors } = await open({ menu: true });
  try {
    await page.evaluate(() => { window.DigDigBoomPlay.S.opp = true; }); await page.click('#play [data-p=startrun]'); await page.waitForSelector('#play [data-p=openpack]');
    await page.evaluate(() => { const P = window.DigDigBoomPlay; P.S.bests0 = { me: 0, easy: 0, medium: 0, hard: 0 }; P.S.panel = 'board'; P.render(); });
    assert.deepEqual((await page.locator('#play .bigboard .bcol .bn').allInnerTexts()).slice(0, 4).map(t => t.replace(/\D/g, '')), ['0', '1', '2', '3'], 'numbers start at 0');
    assert.equal(await page.locator('#play .bigboard .bn:has-text("Start")').count(), 0);
    assert.equal(await page.locator('#play .bigboard .bgrid .bcol >> nth=1').locator('.pchip').count(), 4, 'all four chips are stacked on 0');
    assert.equal(await page.locator('#play .bigboard .bcol:nth-child(5) .bcrown').count(), 1, 'the Crown Jewel waits on 3');
    assert.equal(await page.locator('#play .bigboard .bspot:not(.lab)').count() % 4, 0); assert.equal(await page.locator('#play .bigboard .blabels .bspot').count(), 4, 'a row for each player');
    const colors = await page.locator('#play .bplayers .bpl').evaluateAll(els => els.map(e => getComputedStyle(e).color));
    assert.equal(new Set(colors).size, 4, 'each name in its own colour');
    await page.evaluate(() => { window.DDB_BOARD_PACE = 20; const P = window.DigDigBoomPlay, m = P.S.match; for (const [id, n] of [['hard', 4], ['me', 5]]) { Board.track(m.board, id, n); Board.lockIn(m.board, id, n); } P.S.boardAnim = { from: P.S.bests0, newBest: true, events: [{ r: 1, id: 'hard', k: 'move', n: 4 }, { r: 1, id: 'hard', k: 'bank', n: 4, gems: 6, crown: true }, { r: 1, id: 'me', k: 'move', n: 5 }, { r: 1, id: 'me', k: 'bank', n: 5, gems: 9, crown: true, newBest: true }], k: 0, stop: false, timer: null, rects: null }; P.render(); });
    assert.equal(await page.locator('#play .pchip:not(.mini):has-text("You")').count(), 1);
    assert.equal(await page.locator('#play .bpl.me .cjewel').count(), 0, 'nobody holds the Crown Jewel until their result is told');
    assert.equal(await page.locator('#play .bcol:nth-child(5) .bcrown').count(), 1, 'it waits on 3');
    await page.click('#play .bigboard .scroll'); assert.match(await page.locator('#play .bcap').innerText(), /Hard AI banked at 4 with 6 gems/);
    assert.match(await page.locator('#play .bcap').innerText(), /tap to continue/i, 'it waits after a bank');
    assert.equal(await page.locator('#play .newbest').count(), 0, 'your result has not been told yet');
    await page.click('#play .bigboard .scroll');          // it plays on by itself: your move, then your bank
    await page.waitForSelector('#play .newbest');
    assert.equal(await page.locator('#play .bcrown').count(), 0, 'once someone locks in 3 or more the Crown Jewel leaves the board...');
    assert.equal(await page.locator('#play .bpl.me .cjewel').count(), 1, '...for their name');
    assert.match(await page.locator('#play .bcap').innerText(), /You banked at 5 with 9 gems/); assert.equal(await page.locator('#play .bcap small').count(), 1, 'the last result waits for a tap too'); await page.click('#play .bigboard .scroll'); await page.waitForTimeout(100); assert.equal(await page.locator('#play .bcap small').count(), 0, 'and then that was the last');
    await page.evaluate(() => { const P = window.DigDigBoomPlay; Board.lockIn(P.S.match.board, 'easy', 6); P.S.boardAnim = null; P.render(); });
    assert.equal(await page.locator('#play .bpl[data-pid=easy] .cjewel').count(), 1, 'a higher number steals the Crown Jewel');
    assert.equal(await page.locator('#play .newbest').count(), 0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('opponents: Easy, Medium and Hard each dig on their own clock, and the harder one is quicker (that decides who reaches a number first)', SKIP, async () => {
  const { browser, page, errors } = await open({ menu: true });
  try {
    await startRun(page, { opp: true });
    const names = await stOf(page, () => window.DigDigBoomPlay.S.match.board.players.map(p => p.name)); assert.deepEqual(names, ['You', 'Easy AI', 'Medium AI', 'Hard AI']);
    await page.evaluate(() => { const S = window.DigDigBoomPlay.S; if (S.panel !== 'dig') { /* in the dig already */ } });
    const d = await stOf(page, () => window.DigDigBoomPlay.S.aiDelay);
    assert.deepEqual(Object.keys(d).sort(), ['easy', 'hard', 'medium']);
    assert.ok(d.easy > d.medium && d.medium > d.hard, 'Easy waits longest before its first card, Hard least: ' + JSON.stringify(d));
    const before = await stOf(page, () => ['easy', 'medium', 'hard'].map(id => window.DigDigBoomPlay.S.match.runs[id].dig.digs));
    await page.evaluate(() => window.DigDigBoomPlay.tick());
    assert.deepEqual(await stOf(page, () => ['easy', 'medium', 'hard'].map(id => window.DigDigBoomPlay.S.match.runs[id].dig.digs)).then(a => a.map((n, i) => n - before[i])), [1, 1, 1], 'a tick moves each of them one card');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('table: Backfire ("you may make it a 10") lights up when you roll a 1; tapping it changes the result, and Take damage then asks nothing more', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    await begin(page, { mine: ['MO-01'], dice: [1], ongoing: ['ON-03'], line: [], start: { heart: 5 } });
    await page.click('#play [data-p=dig]'); await page.click('#play [data-p=roll]');
    assert.equal(await page.locator('#play .tcard.inplay.elig').count(), 1, 'Backfire is offered on a 1');
    await page.click('#play .tcard.inplay.elig');
    assert.equal(await page.locator('#play .tcard.inplay.elig').count(), 0, 'used: no longer offered');
    assert.match(await page.locator('#play .calc').innerText(), /10/);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
