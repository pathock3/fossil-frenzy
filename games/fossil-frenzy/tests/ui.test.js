// Browser tests: drive the real page with touch taps. Skipped when Playwright/Chromium is unavailable.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function findChromium() {
  const tries = [() => require('playwright'), () => require(path.join(execSync('npm root -g').toString().trim(), 'playwright'))];
  for (const t of tries) { try { return t().chromium; } catch (e) { /* next */ } }
  return null;
}
const chromium = findChromium();
const exe = ['/opt/pw-browsers/chromium'].find(p => fs.existsSync(p));
const FILE = 'file://' + path.join(__dirname, '..', 'index.html');
const SKIP = { skip: !chromium && 'Playwright/Chromium not available', timeout: 120000 };
const LEVELS = ['Beginner', 'Novice', 'Normal', 'Challenging', 'Master'];

async function open({ viewport = { width: 1024, height: 768 }, query = '' } = {}) {
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const ctx = await browser.newContext({ viewport, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('dialog', d => d.accept());
  await page.goto(FILE + query);
  return { browser, page, errors };
}

// ---------- ways into a game ----------
const passAndPlay = async (page, n) => {
  await page.tap('[data-act=mode][data-v=pass]');
  await page.tap(`[data-act=n][data-v="${n}"]`);
  await page.tap('[data-act=deal]');
  await page.tap('[data-act=begin]');
};
const campaign = async (page, level = 0) => {
  await page.tap('[data-act=mode][data-v=campaign]');
  await page.tap(`[data-act=level][data-i="${level}"]`);
  await page.tap('[data-act=begin]');
};

// ---------- helpers ----------
const ui = (page, fn) => page.evaluate(fn);
const screenOf = page => page.evaluate(() => window.FossilFrenzyUI.ui.screen);
const gameState = page => page.evaluate(() => { const s = window.FossilFrenzyUI.ui.st; return s ? JSON.stringify([s.phase, s.current, s.turnNo, s.matchedCount, s.turn, s.players.map(p => [p.sets, p.points, p.banked])]) : null; });
const cellOf = (page, tid) => page.evaluate(i => window.FossilFrenzyUI.ui.st.tokens[i].cell, tid).then(c => `[data-act=cell][data-id="${c}"]`);

// Selectors for two fossils still on the board (the second differs from the one being peeked).
const firstFree = page => page.evaluate(() => `[data-act=cell][data-id="${window.FossilFrenzyUI.ui.st.tokens.find(t => !t.matched).cell}"]`);
const otherFree = page => page.evaluate(() => { const st = window.FossilFrenzyUI.ui.st; return `[data-act=cell][data-id="${st.tokens.find(t => !t.matched && t.id !== st.turn.T).cell}"]`; });
const takeATurn = async page => { await page.tap(await firstFree(page)); await page.tap(await otherFree(page)); await page.tap('[data-act=end]'); };

// Make specific fossils particular values by swapping with another fossil that has it (keeps the set intact).
const rig = (page, wanted) => page.evaluate(w => {
  const st = window.FossilFrenzyUI.ui.st, used = new Set();
  Object.entries(w).forEach(([id, value]) => {
    const a = st.tokens[Number(id)];
    used.add(a.id);
    if (a.value === value) return;
    const c = st.tokens.find(t => t.value === value && !used.has(t.id));
    [a.value, c.value] = [c.value, a.value]; [a.gem, c.gem] = [c.gem, a.gem];
  });
  window.FossilFrenzyUI.render();
}, wanted);

// Ends the game right now with the given points for players 0 and 1 (no sets popped, so every tie-break is level).
const forceFinish = (page, points) => page.evaluate(pts => {
  const { ui, render } = window.FossilFrenzyUI, st = ui.st;
  pts.forEach((p, i) => { st.players[i].points = p; });
  st.over = true; st.phase = 'over'; st.result = Engine.computeResult(st);
  render();
}, points);

const fingerprint = () => {
  const st = window.FossilFrenzyUI.ui.st;
  return JSON.stringify([st.phase, st.turnNo, st.matchedCount, st.turn.revealed, st.players.map(p => [p.sets.length, p.points])]);
};

// Plays a whole game with taps only. A hidden helper bot (perfect memory) chooses what a human would tap.
async function playByTaps(page, humanSeats) {
  await page.evaluate(seats => {
    const { ui } = window.FossilFrenzyUI;
    window.__helpers = seats.map(i => { const b = Bots.create({ seat: i, memory: 1, endgameTiles: 4, rng: Engine.mulberry32(i + 1) }); ui.st.observers.push(b); return b; });
  }, humanSeats);
  for (let step = 0; step < 6000; step++) {
    const plan = await page.evaluate(() => {
      const { ui } = window.FossilFrenzyUI, st = ui.st;
      if (st.over) return { done: true };
      if (ui.botWaiting) return { sel: '[data-act=end]' };
      const b = window.__helpers.find(h => h.seat === st.current);
      const a = b.decide(Engine.publicView(st, st.current));
      const cell = tid => `[data-act=cell][data-id="${st.tokens[tid].cell}"]`;
      switch (a.type) {
        case 'peek': case 'flipOther': case 'flipSecond': return { sel: cell(a.tid) };
        case 'flipOwn': return { sel: cell(st.turn.T) };
        case 'bank': return { sel: `[data-act=set][data-i="${a.set}"]` };
        default: return { sel: '[data-act=end]' };
      }
    });
    if (plan.done) return step;
    const before = await page.evaluate(fingerprint);
    await page.tap(plan.sel);
    assert.notEqual(await page.evaluate(fingerprint), before, 'tap had no effect: ' + plan.sel + ' in ' + before);
  }
  throw new Error('game did not finish');
}

// =====================================================================
test('home: two ways to play — Pass & Play and Campaign — and no rule-set toggle', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    assert.equal(await screenOf(page), 'home');
    assert.equal(await page.locator('[data-act=mode]').count(), 2);
    const text = await page.locator('.sheet').innerText();
    assert.match(text, /Pass & Play/);
    assert.match(text, /Campaign/);
    assert.doesNotMatch(text, /movement|delivery|original rules|peek, flip, bank|corner|pawn/i);
    assert.equal(await page.locator('[data-act=sys]').count(), 0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('page is locked (no scrolling or zooming) and the setup screens have a back route', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    assert.equal(await page.evaluate(() => getComputedStyle(document.body).overflow), 'hidden');
    assert.match(await page.evaluate(() => document.querySelector('meta[name=viewport]').content), /user-scalable=no/);
    await page.tap('[data-act=help]');
    assert.ok(await page.locator('.help').count());
    await page.tap('[data-act=closehelp]');
    assert.equal(await page.locator('.help').count(), 0);
    await page.tap('[data-act=mode][data-v=pass]');
    await page.tap('[data-act=home]');
    assert.equal(await screenOf(page), 'home');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

// ---------- Pass & Play ----------
test('Pass & Play: 2, 3 or 4 people — humans only; names are remembered', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    await page.tap('[data-act=mode][data-v=pass]');
    assert.equal(await page.locator('[data-act=n]').count(), 3);
    assert.deepEqual(await page.locator('[data-act=n]').allInnerTexts(), ['2', '3', '4']);
    for (const n of [2, 3, 4]) { await page.tap(`[data-act=n][data-v="${n}"]`); assert.equal(await page.locator('input[data-act=name]').count(), n); }
    assert.equal(await page.locator('text=/Bot|Human/').count(), 0, 'no bot seats in Pass & Play');
    await page.fill('input[data-act=name][data-i="0"]', 'Ada');
    await page.reload();
    await page.tap('[data-act=mode][data-v=pass]');
    assert.equal(await page.inputValue('input[data-act=name][data-i="0"]'), 'Ada');
    assert.equal(await page.locator('input[data-act=name]').count(), 4, 'the player count is remembered too');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('the board: 31 fossils, no corners, no pieces, no movement', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    await passAndPlay(page, 2);
    assert.equal(await page.locator('g.cell').count(), 31);
    assert.equal(await page.locator('.tile').count(), 31);
    assert.equal(await page.locator('.piece, .site, .sitenum').count(), 0);
    assert.doesNotMatch(await page.locator('.hint').innerText() + await page.locator('.tray').innerText(), /move|deliver|site/i);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

for (const n of [2, 4]) {
  test(`Pass & Play: a full ${n}-person game plays through by taps only, ending on a laid-out score screen`, SKIP, async () => {
    const { browser, page, errors } = await open();
    try {
      await passAndPlay(page, n);
      await playByTaps(page, [...Array(n).keys()]);
      assert.match(await page.locator('h1').first().innerText(), /wins|Shared/);
      assert.equal(await page.locator('.results .place').count(), n);
      assert.ok(await page.locator('.results .place.win').count() >= 1);
      assert.equal(await page.locator('table').count(), 0);
      const scores = await page.locator('.place .score').allInnerTexts();
      assert.deepEqual(scores, await page.evaluate(() => window.FossilFrenzyUI.ui.st.result.ranking.map(r => String(r.score))));
      const shown = await page.locator('.place .tiles:not(.lostrow) .mini').count();
      assert.equal(shown, await page.evaluate(() => window.FossilFrenzyUI.ui.st.players.reduce((k, p) => k + p.banked.length, 0)));
      assert.ok(await page.locator('[data-act=again]').count());
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  });
}

// ---------- Campaign ----------
test('Campaign: all five levels are shown by name, only the easiest is open, the rest are greyed and locked', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    await page.tap('[data-act=mode][data-v=campaign]');
    assert.deepEqual(await page.locator('.lvl b').allInnerTexts(), LEVELS);
    assert.equal(await page.locator('.lvl.locked').count(), 4);
    assert.equal(await page.locator('.lvl:not(.locked)').count(), 1);
    assert.match(await page.locator('.lvl:not(.locked)').innerText(), /Beginner/);
    assert.equal(await page.locator('.lvl.locked[aria-disabled="true"]').count(), 4);
    assert.equal((await page.locator('.lvl.locked .state').allInnerTexts()).every(t => t.includes('🔒')), true);
    assert.ok(await page.evaluate(() => Number(getComputedStyle(document.querySelector('.lvl.locked')).opacity)) < 0.6, 'locked levels are greyed out');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('Campaign: levels are named only — no percentages or memory figures anywhere in the screen', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    await page.tap('[data-act=mode][data-v=campaign]');
    assert.doesNotMatch(await page.locator('.sheet').innerText(), /%|\d\.\d|memory|remember/i);
    await page.tap('[data-act=home]');
    await page.tap('[data-act=help]');
    assert.doesNotMatch(await page.locator('.help').innerText(), /%|\d\.\d/);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('Campaign: a locked level cannot be started; Beginner starts a game against "Beginner"', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    await page.tap('[data-act=mode][data-v=campaign]');
    await page.tap('[data-act=level][data-i="1"]', { force: true });            // a finger can still land on a greyed-out level
    assert.equal(await screenOf(page), 'campaign', 'tapping a locked level does nothing');
    await page.tap('[data-act=level][data-i="0"]');
    await page.tap('[data-act=begin]');
    assert.equal(await screenOf(page), 'play');
    assert.deepEqual(await page.evaluate(() => window.FossilFrenzyUI.ui.names), ['You', 'Beginner']);
    assert.equal(await page.evaluate(() => window.FossilFrenzyUI.ui.bots.filter(Boolean).length), 1);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('Campaign: winning outright unlocks the next level, remembers it, and offers it', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    await campaign(page, 0);
    await forceFinish(page, [30, 10]);
    assert.match(await page.locator('h1').first().innerText(), /You beat Beginner!/);
    assert.match(await page.locator('.sheet > .sub').innerText(), /Novice unlocked/);
    assert.match(await page.locator('[data-act=next]').innerText(), /Novice/);
    await page.tap('[data-act=mode][data-v=campaign]');
    assert.equal(await page.locator('.lvl.locked').count(), 3);
    assert.match(await page.locator('.lvl').nth(0).innerText(), /Beaten/);
    assert.match(await page.locator('.lvl').nth(1).innerText(), /Ready/);
    await page.reload();                                                   // progress survives a reload
    await page.tap('[data-act=mode][data-v=campaign]');
    assert.equal(await page.locator('.lvl.locked').count(), 3);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('Campaign: the "next level" button starts that level', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    await campaign(page, 0);
    await forceFinish(page, [30, 10]);
    await page.tap('[data-act=next]');
    await page.tap('[data-act=begin]');
    assert.deepEqual(await page.evaluate(() => window.FossilFrenzyUI.ui.names), ['You', 'Novice']);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('Campaign: losing, or a shared win, does not unlock anything', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    await campaign(page, 0);
    await forceFinish(page, [5, 20]);
    assert.match(await page.locator('h1').first().innerText(), /Beginner wins/);
    assert.equal(await page.locator('[data-act=next]').count(), 0);
    await page.tap('[data-act=again]'); await page.tap('[data-act=begin]');
    await forceFinish(page, [12, 12]);
    assert.match(await page.locator('h1').first().innerText(), /not a win/i);
    await page.tap('[data-act=mode][data-v=campaign]');
    assert.equal(await page.locator('.lvl.locked').count(), 4, 'still only Beginner is open');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('Campaign: beating Master completes the campaign', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    await page.evaluate(() => localStorage.setItem('tabletop-library-fossil-frenzy-campaign', JSON.stringify({ beaten: ['beginner', 'novice', 'normal', 'challenging'] })));
    await page.reload();
    await campaign(page, 4);
    await forceFinish(page, [40, 1]);
    assert.match(await page.locator('.sheet > .sub').innerText(), /Campaign complete/);
    assert.equal(await page.locator('[data-act=next]').count(), 0);
    await page.tap('[data-act=mode][data-v=campaign]');
    assert.equal(await page.locator('.lvl.done').count(), 5);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('Campaign: ?unlock opens every level for testing (and saves nothing)', SKIP, async () => {
  const { browser, page, errors } = await open({ query: '?unlock' });
  try {
    await page.tap('[data-act=mode][data-v=campaign]');
    assert.equal(await page.locator('.lvl.locked').count(), 0);
    await page.tap('[data-act=level][data-i="4"]');
    await page.tap('[data-act=begin]');
    assert.deepEqual(await page.evaluate(() => window.FossilFrenzyUI.ui.names), ['You', 'Master']);
    assert.equal(await page.evaluate(() => localStorage.getItem('tabletop-library-fossil-frenzy-campaign')), null);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('Campaign: a full game against an opponent plays through by taps (its turns wait for a tap)', SKIP, async () => {
  const { browser, page, errors } = await open({ viewport: { width: 768, height: 1024 } });
  try {
    await campaign(page, 0);
    await playByTaps(page, [0]);
    assert.ok(await page.locator('.results .place').count() === 2);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

// ---------- how a turn looks and feels ----------
test('peek then flip: a gem sequence — peek a gem, flip a gem, tap your own gem, flip a third — makes the set', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    await passAndPlay(page, 2);
    await rig(page, { 0: 16, 1: 16, 2: 16 });
    await page.tap(await cellOf(page, 0));                                 // first tap: private peek
    await page.tap(await cellOf(page, 1));                                 // second tap: public flip — a gem
    assert.match(await page.locator('.hint').innerText(), /gem/i);
    await page.tap(await cellOf(page, 0));                                 // reveal my peeked gem
    assert.equal(await page.evaluate(() => window.FossilFrenzyUI.ui.st.phase), 'gemThird');
    await page.tap(await cellOf(page, 2));                                 // third space: a gem
    const r = await page.evaluate(() => { const st = window.FossilFrenzyUI.ui.st, p = st.players[st.current]; return [p.sets.length, p.sets[0].size, p.sets[0].gem]; });
    assert.deepEqual(r, [1, 3, true]);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('a match stays face up on the board until the turn ends', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    await passAndPlay(page, 2);
    await rig(page, { 0: 7, 1: 7 });
    await page.tap(await cellOf(page, 0)); await page.tap(await cellOf(page, 1));
    assert.equal(await page.locator('.tile.up').count(), 2);
    assert.equal(await page.evaluate(() => window.FossilFrenzyUI.ui.st.matchedCount), 2);
    await page.tap('[data-act=end]');
    assert.equal(await page.locator('.tile.up').count(), 0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('you bank ONE set, by tapping it, for the number on its fossil', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    await passAndPlay(page, 2);
    await page.evaluate(() => {
      const { ui, render } = window.FossilFrenzyUI;
      ui.st.players[ui.st.current].sets = [{ value: 7, gem: false, size: 2, ids: [] }, { value: 3, gem: false, size: 2, ids: [] }];
      ui.st.rng = () => 0.01;                                              // the bonus die shows a 1: no bonus
      render();
    });
    await page.tap('[data-act=set][data-i="1"]');                          // bank the 3, not the 7
    const r = await page.evaluate(() => { const st = window.FossilFrenzyUI.ui.st, p = st.players[st.current]; return [p.points, p.sets.map(x => x.value)]; });
    assert.deepEqual(r, [3, [7]]);
    assert.match(await page.locator('.note').innerText(), /Banked a 3: \+3/);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('an opponent\'s peek shows as a dashed ring on a face-down space (number hidden), its flip as a solid ring', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    await page.tap('[data-act=mode][data-v=campaign]');
    let checked = 0;
    for (let g = 0; g < 6 && checked < 2; g++) {
      await page.tap('[data-act=level][data-i="0"]');
      await page.tap('[data-act=begin]');
      for (let i = 0; i < 40 && checked < 2 && !(await page.evaluate(() => window.FossilFrenzyUI.ui.st.over)); i++) {
        if (await page.evaluate(() => window.FossilFrenzyUI.ui.botWaiting)) {
          const t = await page.evaluate(() => { const s = window.FossilFrenzyUI.ui.st.turn; return { banked: !!s.banked, matched: !!s.matched }; });
          if (!t.banked && !t.matched) {
            assert.equal(await page.locator('.ring.peekring').count(), 1, 'one dashed ring where it peeked');
            assert.ok(await page.locator('.ring:not(.peekring)').count() >= 1, 'a solid ring on what it flipped');
            assert.equal(await page.locator('.tile.peek').count(), 0, 'the opponent\'s number is never shown');
            checked++;
          }
          await page.tap('[data-act=end]');
        } else {
          await takeATurn(page);
        }
      }
      await page.tap('[data-act=newgame]');
      await page.tap('[data-act=mode][data-v=campaign]');
    }
    assert.ok(checked >= 1, 'saw at least one non-matching opponent turn');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

// ---------- quiet prompts ----------
test('prompts: shown to a new player, quiet after the first finished game, switchable in the help panel', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    await passAndPlay(page, 2);
    assert.notEqual((await page.locator('.hint').innerText()).trim(), '', 'a first-time player gets prompts');
    await forceFinish(page, [3, 1]);
    await page.tap('[data-act=again]'); await page.tap('[data-act=begin]');
    assert.equal((await page.locator('.hint').innerText()).trim(), '', 'quiet once a game has been finished');
    await page.tap('[data-act=help]'); await page.tap('[data-act=hints][data-v=on]'); await page.tap('[data-act=closehelp]');
    assert.notEqual((await page.locator('.hint').innerText()).trim(), '');
    await page.tap('[data-act=help]'); await page.tap('[data-act=hints][data-v=off]'); await page.tap('[data-act=closehelp]');
    assert.equal((await page.locator('.hint').innerText()).trim(), '');
    await page.reload();                                                  // the choice is remembered
    await page.tap('[data-act=help]');
    assert.equal(await page.locator('[data-act=hints].on').innerText(), 'Off');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

// ---------- save / resume ----------
test('save: reloading the page mid-turn resumes the same game, same phase, and play continues', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    await passAndPlay(page, 2);
    await rig(page, { 0: 7, 1: 5, 2: 7 });
    await page.tap(await cellOf(page, 0));                                // peek
    await page.tap(await cellOf(page, 1));                                // flip a miss
    const before = await gameState(page);
    await page.reload();
    assert.equal(await screenOf(page), 'play');
    assert.equal(await gameState(page), before, 'identical game state after the reload');
    assert.equal(await page.locator('.ring.peekring').count(), 1, 'the peeked space is still marked');
    await page.tap('[data-act=end]');                                     // carry on: end the turn…
    await page.tap(await cellOf(page, 2)); await page.tap(await cellOf(page, 0));   // …then the next player peeks and flips
    assert.equal(await page.evaluate(() => window.FossilFrenzyUI.ui.st.turnNo), 1);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('save: a campaign game resumes against the same opponent, with its turn still on the board', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    await campaign(page, 0);
    for (let i = 0; i < 20 && !(await page.evaluate(() => window.FossilFrenzyUI.ui.botWaiting)); i++) {
      await takeATurn(page);
    }
    assert.equal(await page.evaluate(() => window.FossilFrenzyUI.ui.botWaiting), true);
    const before = await gameState(page);
    await page.reload();
    assert.deepEqual(await page.evaluate(() => [window.FossilFrenzyUI.ui.mode, window.FossilFrenzyUI.ui.levelIdx, window.FossilFrenzyUI.ui.names, window.FossilFrenzyUI.ui.botWaiting]), ['campaign', 0, ['You', 'Beginner'], true]);
    assert.equal(await gameState(page), before);
    await page.tap('[data-act=end]');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('save: starting over clears the save, and a finished game is not resumed', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    await passAndPlay(page, 2);
    await page.tap('[data-act=newgame]');
    await page.reload();
    assert.equal(await screenOf(page), 'home');
    await passAndPlay(page, 2);
    await forceFinish(page, [4, 2]);
    await page.reload();
    assert.equal(await screenOf(page), 'home');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('save: a save from other rules, data from the app\'s earlier name, or a damaged one — cleared with a quiet note, never a crash', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    await passAndPlay(page, 2);
    await page.evaluate(() => { const k = 'tabletop-library-fossil-frenzy-save', sv = JSON.parse(localStorage.getItem(k)); sv.game.fingerprint = 'other'; localStorage.setItem(k, JSON.stringify(sv)); });
    await page.reload();
    assert.equal(await screenOf(page), 'home');
    assert.match(await page.locator('.sheet').innerText(), /changed the rules, so your saved game was cleared/);
    assert.equal(await page.evaluate(() => localStorage.getItem('tabletop-library-fossil-frenzy-save')), null);
    await page.evaluate(() => localStorage.setItem('tabletop-library-fossil-frenzy-save', '{not json'));
    await page.reload();
    assert.equal(await screenOf(page), 'home');
    assert.match(await page.locator('.sheet').innerText(), /could not be resumed/);
    await page.evaluate(() => { localStorage.setItem('fossil-frenzy-save-v2', '{"anything":1}'); localStorage.setItem('fossil-frenzy-campaign-v1', '{"beaten":["beginner"]}'); });   // data from the app's earlier name
    await page.reload();
    assert.equal(await screenOf(page), 'home');
    assert.equal(await page.evaluate(() => ['fossil-frenzy-save-v2', 'fossil-frenzy-campaign-v1'].map(k => localStorage.getItem(k)).join()), ',', 'old-name data is discarded, not read');
    await page.tap('[data-act=mode][data-v=campaign]');
    assert.equal(await page.locator('.lvl.locked').count(), 4, 'old campaign progress is not carried over');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
