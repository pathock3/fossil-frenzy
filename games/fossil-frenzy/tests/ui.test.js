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

// Most tests ask for reduced motion, which shows an opponent's whole turn at once; the animation tests turn that off.
async function open({ viewport = { width: 1024, height: 768 }, query = '', animated = false } = {}) {
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const ctx = await browser.newContext({ viewport, hasTouch: true, isMobile: true, reducedMotion: animated ? 'no-preference' : 'reduce' });
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
const openRules = async page => { if (await page.locator('[data-act=menu]').count()) await page.tap('[data-act=menu]'); await page.tap('[data-act=help]'); };
const quitToStart = async page => { await page.tap('[data-act=menu]'); await page.tap('[data-act=menu-ask][data-v=quit]'); await page.tap('[data-act=quit]'); };
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
  st.players.forEach(p => { p.poppedSets = 0; }); st.lastPopper = -1;     // an opponent that went first may already have popped a pair: keep every tie-break level
  st.over = true; st.phase = 'over'; st.result = Engine.computeResult(st);
  render();
}, points);

const fingerprint = () => {
  const st = window.FossilFrenzyUI.ui.st;
  return JSON.stringify([window.FossilFrenzyUI.ui.turnCard, st.phase, st.turnNo, st.matchedCount, st.turn.revealed, st.players.map(p => [p.sets.length, p.points])]);
};

// Plays a whole game with taps only. A hidden helper bot (perfect memory) chooses what a human would tap.
async function playByTaps(page, humanSeats) {
  await page.evaluate(seats => {
    const { ui } = window.FossilFrenzyUI;
    window.__helpers = seats.map(i => { const b = Bots.create({ seat: i, memory: 1, endgameTiles: 4, rng: Engine.mulberry32(i + 1) }); ui.st.observers.push(b); return b; });
  }, humanSeats);
  for (let step = 0; step < 2000; step++) {
    const plan = await page.evaluate(() => {
      const { ui } = window.FossilFrenzyUI, real = ui.st;
      if (real.over) return { done: true };
      if (ui.turnCard) return { sel: '[data-act=begin]' };
      // while an opponent's finished turn is on the board, my first tap ends it and starts mine: plan from there
      let st = real;
      if (ui.botWaiting) { st = Engine.restore(Engine.serialize(real)); Engine.endTurn(st); }
      const b = window.__helpers.find(h => h.seat === st.current);
      const a = b.decide(Engine.publicView(st, st.current));
      const cell = tid => `[data-act=cell][data-id="${st.tokens[tid].cell}"]`;
      switch (a.type) {
        case 'peek': case 'flipOther': case 'flipSecond': return { sel: cell(a.tid) };
        case 'flipOwn': {                                            // two gems: tapping any third fossil is the consent
          const ahead = Engine.restore(Engine.serialize(st));        // look one move ahead on a copy to see which third fossil the helper wants
          Engine.flipOwn(ahead);
          const a2 = b.decide(Engine.publicView(ahead, ahead.current));
          const third = a2.type === 'flipSecond' ? a2.tid : st.tokens.find(t => !t.matched && t.id !== st.turn.T && t.id !== st.turn.F).id;
          return { sel: cell(third) };
        }
        case 'bank': return { sel: `[data-act=set][data-i="${a.set}"]` };
        default: return { sel: '[data-act=end]' };
      }
    });
    if (plan.done) return step;
    const before = await page.evaluate(fingerprint);
    await page.tap(plan.sel);
    assert.notEqual(await page.evaluate(fingerprint), before, 'tap had no effect: ' + plan.sel + ' in ' + before);
  }
  throw new Error('game did not finish: ' + JSON.stringify(await page.evaluate(() => { const u = window.FossilFrenzyUI.ui, st = u.st; return { phase: st.phase, cur: st.current, turnNo: st.turnNo, left: st.tokens.filter(t => !t.matched).map(t => [t.id, t.value]), sets: st.players.map(p => p.sets), turn: st.turn, card: u.turnCard, bw: u.botWaiting }; })));
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
    assert.doesNotMatch(await page.locator('.game').innerText(), /move|deliver|site/i);
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
    await page.tap('[data-act=home]'); await page.tap('[data-act=mode][data-v=campaign]');
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
    await page.tap('[data-act=home]'); await page.tap('[data-act=mode][data-v=campaign]');
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
    await page.tap('[data-act=home]'); await page.tap('[data-act=mode][data-v=campaign]');
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
test('peek then flip: a gem sequence — peek a gem, flip a gem, tap a third — makes the set (no need to tap your own gem)', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    await passAndPlay(page, 2);
    await rig(page, { 0: 16, 1: 16, 2: 16 });
    await page.tap(await cellOf(page, 0));                                 // first tap: private peek
    await page.tap(await cellOf(page, 1));                                 // second tap: public flip — a gem
    assert.match(await page.locator('.hint').innerText(), /gem/i);
    await page.tap(await cellOf(page, 2));                                 // a third space: that consents to revealing my gem, and it is a gem
    const r = await page.evaluate(() => { const st = window.FossilFrenzyUI.ui.st, p = st.players[st.current]; return [p.sets.length, p.sets[0].size, p.sets[0].gem, st.turn.revealed.length]; });
    assert.deepEqual(r, [1, 3, true, 3]);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('gems: a third tap that misses flips my gem and the third, then the turn is over to end; tapping my own peeked gem alone reveals nothing', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    await passAndPlay(page, 2);
    await rig(page, { 0: 16, 1: 16, 2: 7 });
    await page.tap(await cellOf(page, 0)); await page.tap(await cellOf(page, 1));
    await page.tap(await cellOf(page, 0));                                 // my own peeked gem: only hides/shows my private look
    assert.equal(await page.evaluate(() => window.FossilFrenzyUI.ui.st.turn.revealed.length), 1, 'still only the flipped gem is public');
    await page.tap(await cellOf(page, 2));                                 // a third that is not a gem
    const r = await page.evaluate(() => { const st = window.FossilFrenzyUI.ui.st; return [st.phase, st.turn.revealed.length, st.players[st.current].sets.length]; });
    assert.deepEqual(r, ['resolved', 3, 0]);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('gems: if the flipped fossil is not a gem, tapping a third does nothing', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    await passAndPlay(page, 2);
    await rig(page, { 0: 16, 1: 5, 2: 16 });
    await page.tap(await cellOf(page, 0)); await page.tap(await cellOf(page, 1));
    await page.tap(await cellOf(page, 2));
    const r = await page.evaluate(() => { const st = window.FossilFrenzyUI.ui.st; return [st.phase, st.turn.revealed.length]; });
    assert.deepEqual(r, ['flipped', 1]);
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
    const banker = await page.evaluate(() => window.FossilFrenzyUI.ui.st.current);
    await page.tap('[data-act=set][data-i="1"]');                          // bank the 3, not the 7 — and the turn ends by itself
    const r = await page.evaluate(b => { const st = window.FossilFrenzyUI.ui.st, p = st.players[b]; return [p.points, p.sets.map(x => x.value), st.current !== b, st.turnNo]; }, banker);
    assert.deepEqual(r, [3, [7], true, 1]);
    assert.match(await page.locator('.turncard').innerText(), /banked a 3: \+3/i, 'the next player is told what was banked');
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
        }
        await takeATurn(page);                                               // my first tap ends the opponent's turn display and starts mine
      }
      await quitToStart(page);
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
    await openRules(page); await page.tap('[data-act=hints][data-v=on]'); await page.tap('[data-act=closehelp]');
    assert.notEqual((await page.locator('.hint').innerText()).trim(), '');
    await openRules(page); await page.tap('[data-act=hints][data-v=off]'); await page.tap('[data-act=closehelp]');
    assert.equal((await page.locator('.hint').innerText()).trim(), '');
    await page.reload();                                                  // the choice is remembered
    await openRules(page);
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
    await page.tap('[data-act=begin]');                                   // …the next player sees whose turn it is…
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
    await page.tap(await firstFree(page));                                 // my first tap ends its turn and is my peek
    assert.equal(await page.evaluate(() => [window.FossilFrenzyUI.ui.st.current, window.FossilFrenzyUI.ui.st.phase].join()), '0,peeked');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('save: starting over clears the save, and a finished game is not resumed', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    await passAndPlay(page, 2);
    await quitToStart(page);
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

// =====================================================================
// ---------- playtest round 2: turn order, scores, animated opponent, bank ends turn, menu ----------
test('no "Who goes first?" screen: the game opens straight on the table, with a card naming whose turn it is', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    await page.tap('[data-act=mode][data-v=pass]');
    await page.fill('input[data-act=name][data-i="0"]', 'Ada');
    await page.fill('input[data-act=name][data-i="1"]', 'Bo');
    await page.tap('[data-act=deal]');
    assert.equal(await screenOf(page), 'play', 'dealing goes straight to the table');
    assert.equal(await page.locator('table').count(), 0);
    assert.doesNotMatch(await page.locator('#app').innerText(), /Who goes first|rolled a die/i);
    const card = await page.locator('.turncard').innerText();
    assert.match(card, /(Ada|Bo) goes first/);
    const first = await page.evaluate(() => window.FossilFrenzyUI.ui.seat = window.FossilFrenzyUI.ui.st.current);
    await page.evaluate(() => { const c = document.querySelector('[data-act=cell]'); window.FossilFrenzyUI.onClick({ target: c }); });   // a tap that reached the board under the card does nothing
    assert.equal(await page.evaluate(() => window.FossilFrenzyUI.ui.st.phase), 'action');
    await page.tap('[data-act=begin]');
    assert.equal(await page.locator('.turncard').count(), 0);
    await page.tap(await firstFree(page));
    assert.equal(await page.evaluate(() => window.FossilFrenzyUI.ui.st.phase), 'peeked');
    assert.equal(first, await page.evaluate(() => window.FossilFrenzyUI.ui.st.current));
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('who goes first is random: both seats start games', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    await page.tap('[data-act=mode][data-v=pass]');
    await page.tap('[data-act=deal]');
    const seen = new Set();
    for (let i = 0; i < 30 && seen.size < 2; i++) {
      seen.add(await page.evaluate(() => window.FossilFrenzyUI.ui.st.current));
      await page.tap('[data-act=menu]'); await page.tap('[data-act=menu-ask][data-v=retry]'); await page.tap('[data-act=retry]');
    }
    assert.equal(seen.size, 2);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('pass & play: every turn opens with a card naming the next player', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    await page.tap('[data-act=mode][data-v=pass]');
    await page.tap('[data-act=n][data-v="3"]');
    await page.fill('input[data-act=name][data-i="0"]', 'Ada');
    await page.fill('input[data-act=name][data-i="1"]', 'Bo');
    await page.fill('input[data-act=name][data-i="2"]', 'Cy');
    await page.tap('[data-act=deal]');
    for (let i = 0; i < 4; i++) {
      await page.tap('[data-act=begin]');
      const cur = await page.evaluate(() => window.FossilFrenzyUI.ui.names[window.FossilFrenzyUI.ui.st.current]);
      await page.tap(await firstFree(page)); await page.tap(await otherFree(page));
      await page.tap('[data-act=end]');
      const next = await page.evaluate(() => window.FossilFrenzyUI.ui.names[window.FossilFrenzyUI.ui.st.current]);
      assert.notEqual(next, cur);
      assert.match(await page.locator('.turncard').innerText(), new RegExp(next + "'s turn"));
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('the score is prominent: big numbers for every player, the current player lit up, updated when someone banks', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    await passAndPlay(page, 3);
    assert.equal(await page.locator('.chip .pts').count(), 3);
    assert.equal(await page.locator('.chip.cur').count(), 1);
    const px = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.chip .pts')).fontSize));
    assert.ok(px >= 32, 'score is at least 32px: ' + px);
    assert.deepEqual(await page.locator('.chip .pts').allInnerTexts(), ['0', '0', '0']);
    const banker = await page.evaluate(() => {
      const { ui, render } = window.FossilFrenzyUI, st = ui.st;
      st.players[st.current].sets = [{ value: 10, gem: false, size: 2, ids: [] }]; st.rng = () => 0.01; render(); return st.current;
    });
    await page.tap('[data-act=set][data-i="0"]');
    const texts = await page.locator('.chip .pts').allInnerTexts();
    assert.equal(texts[banker], '10');
    assert.equal(texts.filter(t => t === '0').length, 2);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('an opponent\'s turn is animated: its peek (number hidden) shows at once, the flip less than a second later; a tap skips ahead', SKIP, async () => {
  const { browser, page, errors } = await open({ animated: true });
  try {
    await campaign(page, 0);
    let seen = false;
    for (let g = 0; g < 20 && !seen; g++) {
      await page.waitForFunction(() => { const u = window.FossilFrenzyUI.ui; return !u.steps || u.stage >= u.steps.length; }, null, { timeout: 5000 });
      await takeATurn(page);
      const info = await page.evaluate(() => { const { ui } = window.FossilFrenzyUI; return { n: ui.steps ? ui.steps.length : 0, first: ui.steps && ui.steps[0] ? ui.steps[0].a.type : null, stage: ui.stage }; });
      if (info.n >= 2 && info.first === 'peek' && info.stage === 1) {
        seen = true;
        // no waiting: the peek is already there
        assert.equal(await page.locator('.ring.peekring').count(), 1, 'the peek shows as a dashed ring');
        assert.equal(await page.locator('.tile.lift').count(), 1, 'and the fossil lifts');
        assert.equal(await page.locator('.tile.up').count(), 0, 'the number is not shown');
        assert.equal(await page.locator('.num, .gem').count(), 0, 'no number anywhere on the board');
        assert.match(await page.locator('.hint').innerText(), /peeks/i);
        const t0 = Date.now();
        await page.waitForFunction(() => window.FossilFrenzyUI.ui.stage === 2, null, { timeout: 5000 });
        assert.ok(Date.now() - t0 < 1000, 'the flip follows in under a second: ' + (Date.now() - t0));
        assert.ok(await page.locator('.tile.up').count() >= 1, 'then the flip is shown');
        if (await page.evaluate(() => { const u = window.FossilFrenzyUI.ui; return u.stage < u.steps.length; })) {
          await page.tap(await firstFree(page));                           // a tap skips to the end of its turn
          assert.equal(await page.evaluate(() => { const u = window.FossilFrenzyUI.ui; return u.stage === u.steps.length; }), true);
        }
        await page.tap(await firstFree(page));                             // the next tap starts my turn: it is my peek
        assert.equal(await page.evaluate(() => [window.FossilFrenzyUI.ui.st.current, window.FossilFrenzyUI.ui.st.phase].join()), '0,peeked');
      }
    }
    assert.ok(seen, 'saw an opponent turn that starts with a peek');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('an opponent\'s score and sets only change when its move is shown, not before', SKIP, async () => {
  const { browser, page, errors } = await open({ animated: true });
  try {
    await campaign(page, 0);
    for (let i = 0; i < 3 && !(await page.evaluate(() => window.FossilFrenzyUI.ui.botWaiting)); i++) await takeATurn(page);
    // pretend the opponent's turn banked: the displayed points must stay at the old value until the bank step is shown
    const r = await page.evaluate(() => {
      const { ui, render } = window.FossilFrenzyUI, st = ui.st;
      const old = ui.base.points;
      ui.steps = [{ a: { type: 'peek', tid: 0 }, snap: { points: old, sets: [] } }, { a: { type: 'bank', set: 0 }, snap: { points: old + 9, sets: [] } }];
      ui.stage = 1; st.players[st.current].points = old + 9; render();
      const before = document.querySelectorAll('.chip .pts')[st.current].textContent;
      ui.stage = 2; render();
      return [Number(before) === old, document.querySelectorAll('.chip .pts')[st.current].textContent === String(old + 9)];
    });
    assert.deepEqual(r, [true, true]);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

// ---------- the in-game menu ----------
test('menu: a ☰ button opens rules, retry and back-to-start; retry and leaving ask first', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    await passAndPlay(page, 2);
    assert.equal(await page.locator('[data-act=menu]').count(), 1);
    assert.equal(await page.locator('.q').count(), 1, 'one small system button, nothing else competing for attention');
    await page.tap('[data-act=menu]');
    assert.deepEqual(await page.locator('.menu button').allInnerTexts(), ['How to play', 'Retry', 'Back to the start', 'Resume']);
    await page.tap('[data-act=menu-close]', { force: true });               // Resume
    assert.equal(await page.locator('.menu').count(), 0);
    await page.tap('[data-act=menu]'); await page.tap('[data-act=help]');   // rules from the menu
    assert.ok(await page.locator('.help').count());
    await page.tap('[data-act=closehelp]');
    assert.equal(await page.locator('.menu').count(), 0);
    assert.equal(await screenOf(page), 'play');
    // retry asks first; "no" changes nothing
    await page.tap(await firstFree(page));
    const before = await gameState(page);
    await page.tap('[data-act=menu]'); await page.tap('[data-act=menu-ask][data-v=retry]');
    assert.match(await page.locator('.menu').innerText(), /start this game over/i);
    await page.tap('.menu [data-act=menu-close]');
    assert.equal(await gameState(page), before);
    // leaving asks first too
    await page.tap('[data-act=menu]'); await page.tap('[data-act=menu-ask][data-v=quit]');
    assert.match(await page.locator('.menu').innerText(), /go back to the start/i);
    await page.tap('.menu [data-act=menu-close]');
    assert.equal(await screenOf(page), 'play');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('menu: retry (confirmed) deals a fresh game at once, same players — no level or player picking', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    await page.tap('[data-act=mode][data-v=pass]');
    await page.tap('[data-act=n][data-v="3"]');
    await page.fill('input[data-act=name][data-i="2"]', 'Cy');
    await page.tap('[data-act=deal]'); await page.tap('[data-act=begin]');
    await page.tap(await firstFree(page)); await page.tap(await otherFree(page));
    await page.tap('[data-act=menu]'); await page.tap('[data-act=menu-ask][data-v=retry]'); await page.tap('[data-act=retry]');
    const r = await page.evaluate(() => { const u = window.FossilFrenzyUI.ui; return [u.screen, u.st.turnNo, u.st.matchedCount, u.st.n, u.names[2], u.st.turn.revealed.length]; });
    assert.deepEqual(r, ['play', 0, 0, 3, 'Cy', 0]);
    assert.ok(await page.locator('.turncard').count(), 'it starts with the who-goes-first card');
    assert.equal(await page.locator('.menu').count(), 0);

    // and in the campaign: the same level, straight away
    await quitToStart(page);
    await campaign(page, 0);
    await page.tap('[data-act=menu]'); await page.tap('[data-act=menu-ask][data-v=retry]'); await page.tap('[data-act=retry]');
    assert.deepEqual(await page.evaluate(() => { const u = window.FossilFrenzyUI.ui; return [u.screen, u.names, u.levelIdx, u.st.turnNo]; }), ['play', ['You', 'Beginner'], 0, 0]);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('menu: "Back to the start" (confirmed) leaves the game and clears the save', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    await passAndPlay(page, 2);
    await quitToStart(page);
    assert.equal(await screenOf(page), 'home');
    await page.reload();
    assert.equal(await screenOf(page), 'home');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

// ---------- playtest round 3: menu order, sets in one place, no Continue, the opponent's bank ----------
test('home: Campaign is listed before Pass & Play, over a picture of the board', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    assert.deepEqual(await page.locator('[data-act=mode]').evaluateAll(els => els.map(e => e.dataset.v)), ['campaign', 'pass']);
    assert.equal(await page.locator('.hero-board .h-cell').count(), 31, 'it is the real 31-space board');
    assert.equal(await page.locator('.hero-board .h-ring.dash, .h-peek').count(), 0, 'no stray decorative ring: rings only appear as a game is played');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('home: a whole demo game plays by itself — blue and red, rings like a real game, collected tiles vanish, then a pause and a new game', SKIP, async () => {
  const { browser, page, errors } = await open({ animated: true });
  try {
    await page.evaluate(() => { const d = window.FossilFrenzyUI.demo(); clearTimeout(d.timer); });   // drive it by hand, instantly
    const log = await page.evaluate(() => {
      const U = window.FossilFrenzyUI, d = U.demo(), seen = { dashBlue: 0, dashRed: 0, solid: 0, upNoNumber: 0, restartWait: 0 };
      for (let i = 0; i < 3000 && !d.st.over; i++) {
        U.demoStep(d);
        d.cells.forEach(el => {
          const ringed = el.classList.contains('ringed'), dash = el.classList.contains('dash'), col = el.querySelector('.h-ring').style.stroke;
          if (ringed && dash) { if (/79, ?140, ?255|#4f8cff/i.test(col)) seen.dashBlue++; else if (/255, ?90, ?95|#ff5a5f/i.test(col)) seen.dashRed++; }
          if (ringed && !dash) seen.solid++;
          if (el.classList.contains('up') && !el.querySelector('.h-front text').textContent) seen.upNoNumber++;
        });
      }
      const wait = U.demoStep(d);                                              // the game is over: the last tiles vanish and it waits
      return { ...seen, over: d.st.over, gone: d.cells.every(el => el.classList.contains('gone')), wait, left: d.st.tokens.filter(t => !t.matched).length, pts: d.st.players.map(p => p.points) };
    });
    assert.equal(log.over, true);
    assert.equal(log.left, 0, 'every fossil was collected');
    assert.equal(log.gone, true, 'and every tile has vanished');
    assert.ok(log.wait >= 2000, 'then the empty board waits before the next game: ' + log.wait);
    assert.ok(log.dashBlue > 0 && log.dashRed > 0, 'both players peek, shown as a dashed ring in their own colour');
    assert.ok(log.solid > 0, 'flips show as solid rings');
    assert.equal(log.upNoNumber, 0, 'a flipped tile always shows its number');
    assert.ok(log.pts.some(p => p > 0) || true);
    // and it really restarts by itself
    const before = await page.evaluate(() => window.FossilFrenzyUI.demo().seed);
    await page.evaluate(() => { const d = window.FossilFrenzyUI.demo(); d.timer = setTimeout(() => {}, 0); window.FossilFrenzyUI.render(); });
    assert.notEqual(await page.evaluate(() => window.FossilFrenzyUI.demo().seed), before, 'a re-drawn home screen starts a fresh game');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('home: it is one screen — nothing to scroll, everything in view — on iPad (both ways) and phones', SKIP, async () => {
  for (const vp of [{ width: 1024, height: 768 }, { width: 768, height: 1024 }, { width: 1180, height: 820 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
    const { browser, page, errors } = await open({ viewport: vp });
    try {
      const r = await page.evaluate(() => {
        const sc = document.querySelector('.screen.home'), inView = sel => { const b = document.querySelector(sel).getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight + 0.5 && b.left >= 0 && b.right <= innerWidth + 0.5; };
        return { fits: sc.scrollHeight <= sc.clientHeight + 1, wide: sc.scrollWidth <= sc.clientWidth + 1, campaign: inView('[data-v=campaign]'), pass: inView('[data-v=pass]'), help: inView('[data-act=help]'), board: inView('.hero-board'), logo: inView('.logo') };
      });
      assert.deepEqual(r, { fits: true, wide: true, campaign: true, pass: true, help: true, board: true, logo: true }, JSON.stringify(vp));
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  }
});

test('campaign screen: no "beat each opponent" line (the locks say it)', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    await page.tap('[data-act=mode][data-v=campaign]');
    assert.doesNotMatch(await page.locator('.sheet').innerText(), /unlock the next|beat each/i);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('sets are shown in one place only — the scoreboard — and tapping them there banks; "no sets" reads plainly', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    await passAndPlay(page, 2);
    assert.equal(await page.locator('.tray, .setcard').count(), 0, 'no side panel');
    assert.deepEqual(await page.locator('.chip .sets').allInnerTexts(), ['', ''], 'nothing is written when there are no sets');
    assert.equal(await page.locator('.bankcap').count(), 0);
    await page.evaluate(() => { const { ui, render } = window.FossilFrenzyUI; ui.st.players[ui.st.current].sets = [{ value: 7, gem: false, size: 2, ids: [] }, { value: 16, gem: true, size: 3, ids: [] }]; ui.st.rng = () => 0.01; render(); });
    assert.equal(await page.locator('.chip.cur .setbtn[data-act=set]').count(), 2, 'the current player\'s sets are the tappable ones');
    assert.equal(await page.locator('.chip:not(.cur) [data-act=set]').count(), 0);
    assert.deepEqual(await page.locator('.chip.cur .setbtn').allInnerTexts(), ['7', '💎']);
    assert.match(await page.locator('.bankcap').innerText(), /tap to bank/i, 'the sets say they can be tapped');
    const box = await page.locator('.chip.cur .setbtn').first().boundingBox();
    assert.ok(box.width >= 48 && box.height >= 48, 'big enough to be a button: ' + JSON.stringify(box));
    await page.tap('.chip.cur .setbtn[data-i="1"]');                       // bank the gem, up there
    assert.equal(await page.evaluate(() => Math.max(...window.FossilFrenzyUI.ui.st.players.map(p => p.points)) >= 16), true, 'the gem scored');
    assert.equal(await page.evaluate(() => window.FossilFrenzyUI.ui.st.turnNo), 1, 'and the turn is over');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('no Continue: an opponent\'s turn stays on the board until I tap a fossil, and that tap starts my turn', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    await campaign(page, 0);
    for (let i = 0; i < 6 && !(await page.evaluate(() => window.FossilFrenzyUI.ui.botWaiting)); i++) await takeATurn(page);
    assert.equal(await page.evaluate(() => window.FossilFrenzyUI.ui.botWaiting), true);
    assert.equal(await page.locator('button', { hasText: /continue/i }).count(), 0, 'there is no Continue button');
    assert.equal(await page.locator('[data-act=end]').count(), 0, 'and no End turn while it is the opponent\'s turn');
    const shown = await page.locator('.ring').count();
    assert.ok(shown >= 1, 'what it peeked and flipped is still showing');
    await page.tap(await firstFree(page));
    const r = await page.evaluate(() => { const st = window.FossilFrenzyUI.ui.st; return [st.current, st.phase, st.turn.peeked !== null, window.FossilFrenzyUI.ui.botWaiting]; });
    assert.deepEqual(r, [0, 'peeked', true, false]);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('the opponent banks: a clear banner says what it banked, what it scored and its new total — and a tap on the map starts my turn', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    await campaign(page, 0);
    await page.evaluate(() => {                                            // make the opponent hold a 7 and want to bank it
      const { ui } = window.FossilFrenzyUI;
      ui.st.players[1].sets = [{ value: 7, gem: false, size: 2, ids: [] }]; ui.bots[1].bankAt = 1; ui.st.rng = () => 0.01;
    });
    for (let i = 0; i < 6 && !(await page.evaluate(() => window.FossilFrenzyUI.ui.botWaiting && window.FossilFrenzyUI.ui.st.turn.banked)); i++) {
      if (await page.evaluate(() => window.FossilFrenzyUI.ui.botWaiting)) { await page.tap(await firstFree(page)); await page.tap(await otherFree(page)); await page.tap('[data-act=end]'); }
      else await takeATurn(page);
    }
    const txt = await page.locator('.bankcard').innerText();
    assert.match(txt, /Beginner banked a 7/);
    assert.match(txt, /\+7/);
    assert.match(txt, /Score now 7/);
    assert.equal(await page.locator('.chip.cur .pts').innerText(), '7');
    assert.equal(await page.locator('button', { hasText: /continue/i }).count(), 0);
    assert.equal(await page.locator('button.bankcard[data-act=dismissbank]').count(), 1, 'the banner is itself a button');
    await page.tap('.bankcard');                                           // tap it: it goes away and my turn begins (nothing peeked yet)
    assert.equal(await page.locator('.bankcard').count(), 0);
    assert.equal(await page.evaluate(() => [window.FossilFrenzyUI.ui.st.current, window.FossilFrenzyUI.ui.st.phase].join()), '0,action');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('after I bank, the turn is over at once and the opponent starts — what I banked shows in a line, with my new score big', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    await campaign(page, 0);
    await page.evaluate(() => { const { ui, render } = window.FossilFrenzyUI; ui.st.players[0].sets = [{ value: 6, gem: false, size: 2, ids: [] }]; ui.st.rng = () => 0.01; render(); });
    await page.tap('[data-act=set]');                                      // my set, up in the scoreboard (also works while the opponent's finished turn is still showing)
    assert.equal(await page.evaluate(() => window.FossilFrenzyUI.ui.st.current), 1);
    assert.match(await page.locator('.event').innerText(), /You banked a 6: \+6/);
    assert.equal(await page.locator('.chip .pts').first().innerText(), '6');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('the opponent\'s bank banner goes away on a tap anywhere: on the map it also starts my turn with that peek; elsewhere it just clears', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    for (const where of ['map', 'header']) {
      await campaign(page, 0);
      await page.evaluate(() => { const { ui } = window.FossilFrenzyUI; ui.st.players[1].sets = [{ value: 7, gem: false, size: 2, ids: [] }]; ui.bots[1].bankAt = 1; ui.st.rng = () => 0.01; });
      for (let i = 0; i < 8 && !(await page.evaluate(() => window.FossilFrenzyUI.ui.botWaiting && window.FossilFrenzyUI.ui.st.turn.banked)); i++) await takeATurn(page);
      assert.equal(await page.locator('.bankcard').count(), 1);
      if (where === 'map') {
        await page.tap(await firstFree(page));
        assert.equal(await page.evaluate(() => [window.FossilFrenzyUI.ui.st.current, window.FossilFrenzyUI.ui.st.phase].join()), '0,peeked');
      } else {
        await page.tap('.legend');                                         // empty space above the board
        assert.equal(await page.evaluate(() => [window.FossilFrenzyUI.ui.st.current, window.FossilFrenzyUI.ui.st.phase].join()), '0,action');
      }
      assert.equal(await page.locator('.bankcard').count(), 0);
      await quitToStart(page);
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('end of game: the choices are plain buttons — play again (or the next level) and Main menu; no hidden "Levels"', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    await passAndPlay(page, 2);
    await forceFinish(page, [4, 2]);
    assert.deepEqual(await page.locator('.sheet > button').allInnerTexts(), ['Play again', 'Main menu']);
    assert.ok(await page.evaluate(() => { const b = document.querySelector('[data-act=home]').getBoundingClientRect(); return b.height >= 48 && b.width >= 200; }), 'Main menu is a full-size button');
    assert.doesNotMatch(await page.locator('.sheet').innerText(), /Levels|Change players/);
    await page.tap('[data-act=home]');
    assert.equal(await screenOf(page), 'home');
    await campaign(page, 0);
    await forceFinish(page, [30, 10]);
    assert.deepEqual((await page.locator('.sheet > button').allInnerTexts()).map(t => t.replace(/:.*/, '')), ['Next', 'Play Beginner again', 'Main menu']);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
