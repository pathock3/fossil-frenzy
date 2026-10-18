// Browser smoke tests: drive the real page with touch taps. Skipped when Playwright/Chromium is unavailable.
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

async function open(viewport = { width: 1024, height: 768 }) {
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const ctx = await browser.newContext({ viewport, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(FILE);
  return { browser, page, errors };
}

const setup = async (page, { n, system, bots = [] }) => {
  await page.tap(`[data-act=n][data-v="${n}"]`);
  await page.tap(`[data-act=sys][data-v="${system ? 'on' : 'off'}"]`);
  for (let i = 0; i < n; i++) await page.tap(`[data-act=bot][data-i="${i}"][data-v="${bots.includes(i) ? 'bot' : 'human'}"]`);
  await page.tap('[data-act=start]');
  await page.tap('[data-act=begin]');
};

const fingerprint = () => {
  const st = window.FossilFrenzyUI.ui.st;
  return JSON.stringify([st.phase, st.turnNo, st.matchedCount, st.turn.revealed, st.players.map(p => [p.pos, p.assign, p.sets.length, p.stash.length, p.points])]);
};

// Plays the whole game with taps only. A hidden helper bot (perfect memory) chooses what a human would tap.
async function playByTaps(page, humanSeats) {
  await page.evaluate(seats => {
    const { ui } = window.FossilFrenzyUI;
    window.__helpers = seats.map(i => { const b = Bots.create({ seat: i, memory: 1, rng: Engine.mulberry32(i + 1) }); ui.st.observers.push(b); return b; });
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
        case 'move': return { sel: `[data-act=cell][data-id="${a.to}"]`, then: a.victimTo !== undefined ? `[data-act=cell][data-id="${a.victimTo}"]` : null };
        case 'peek': case 'flipOther': case 'flipSecond': return { sel: cell(a.tid) };
        case 'flipOwn': return { sel: cell(st.turn.T) };
        case 'deliver': return { sel: `[data-act=set][data-i="${a.set}"]` };
        case 'bank': return { sel: '[data-act=set][data-i="0"]' };
        default: return { sel: '[data-act=end]' };
      }
    });
    if (plan.done) return step;
    const before = await page.evaluate(fingerprint);
    await page.tap(plan.sel);
    if (plan.then) { const pushing = await page.evaluate(() => window.FossilFrenzyUI.ui.pushing !== null); if (pushing) await page.tap(plan.then); }
    const after = await page.evaluate(fingerprint);
    assert.notEqual(after, before, 'tap had no effect: ' + plan.sel + ' in ' + before);
  }
  throw new Error('game did not finish');
}

for (const system of [true, false]) {
  test(`UI: a full 3-player hot-seat game plays through by taps only (movement/delivery ${system ? 'on' : 'off'})`, { skip: !chromium && 'Playwright/Chromium not available', timeout: 180000 }, async () => {
    const { browser, page, errors } = await open();
    try {
      await setup(page, { n: 3, system });
      assert.equal(await page.evaluate(() => window.FossilFrenzyUI.ui.st.system), system);
      await playByTaps(page, [0, 1, 2]);
      assert.equal(await page.locator('h1').first().innerText().then(t => /wins|Shared/.test(t)), true);
      assert.ok(await page.locator('[data-act=again]').count());
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  });
}

test('UI: humans mixed with bots — bot turns wait on the board until a tap ("Continue")', { skip: !chromium && 'Playwright/Chromium not available', timeout: 180000 }, async () => {
  const { browser, page, errors } = await open({ width: 768, height: 1024 });
  try {
    await setup(page, { n: 3, system: true, bots: [1] });
    assert.equal(await page.evaluate(() => window.FossilFrenzyUI.ui.bots.filter(Boolean).length), 1);
    await playByTaps(page, [0, 2]);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('UI: setup screen, help panel and page lock', { skip: !chromium && 'Playwright/Chromium not available' }, async () => {
  const { browser, page, errors } = await open();
  try {
    assert.equal(await page.evaluate(() => getComputedStyle(document.body).overflow), 'hidden');
    assert.match(await page.evaluate(() => document.querySelector('meta[name=viewport]').content), /user-scalable=no/);
    await page.tap('[data-act=help]');
    assert.ok(await page.locator('.help').count());
    await page.tap('[data-act=closehelp]');
    assert.equal(await page.locator('.help').count(), 0);
    for (const n of [2, 3, 4, 5, 6]) { await page.tap(`[data-act=n][data-v="${n}"]`); assert.equal(await page.locator('.seatrow').count(), n); }
    await page.tap('[data-act=bot][data-i="1"][data-v=bot]');
    assert.equal(await page.locator('[data-act=mem][data-i="1"]').count(), 5);   // Beginner … Master
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('UI: your delivered pile is private — it opens on your tap and shows your total', { skip: !chromium && 'Playwright/Chromium not available' }, async () => {
  const { browser, page, errors } = await open();
  try {
    await setup(page, { n: 2, system: true });
    await page.evaluate(() => { const { ui, render } = window.FossilFrenzyUI; ui.st.players[ui.st.current].stash.push(7, 16); render(); });
    assert.match(await page.locator('.pile').innerText(), /Delivered ×2/);
    await page.tap('.pile');
    assert.match(await page.locator('.pile').innerText(), /7.*💎.*= 23/);
    await page.tap('.pile');
    assert.match(await page.locator('.pile').innerText(), /Delivered ×2/);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

// Make the first tiles specific values by swapping with the tile that has it (keeps the tile set intact).
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
const tile = (page, id) => page.evaluate(i => window.FossilFrenzyUI.ui.st.tokens[i].cell, id).then(c => `[data-act=cell][data-id="${c}"]`);

test('UI (redesign): peek a gem, flip a gem, tap your own gem, flip a third — three gems match', { skip: !chromium && 'Playwright/Chromium not available' }, async () => {
  const { browser, page, errors } = await open();
  try {
    await setup(page, { n: 2, system: false });
    await rig(page, { 0: 16, 1: 16, 2: 16 });
    await page.tap(await tile(page, 0));                                   // peek
    await page.tap(await tile(page, 1));                                   // public flip: a gem
    assert.match(await page.locator('.hint').innerText(), /gem/i);
    await page.tap(await tile(page, 0));                                   // reveal my peeked gem
    assert.equal(await page.evaluate(() => window.FossilFrenzyUI.ui.st.phase), 'gemThird');
    await page.tap(await tile(page, 2));                                   // third space: a gem
    const r = await page.evaluate(() => { const p = window.FossilFrenzyUI.ui.st.players[window.FossilFrenzyUI.ui.st.current]; return [p.sets.length, p.sets[0].size, p.sets[0].gem]; });
    assert.deepEqual(r, [1, 3, true]);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('UI (redesign): a match stays face up on the board until the turn ends', { skip: !chromium && 'Playwright/Chromium not available' }, async () => {
  const { browser, page, errors } = await open();
  try {
    await setup(page, { n: 2, system: false });
    await rig(page, { 0: 7, 1: 7 });
    await page.tap(await tile(page, 0)); await page.tap(await tile(page, 1));
    assert.equal(await page.locator('.tile.up').count(), 2);               // both matched fossils still shown
    assert.equal(await page.evaluate(() => window.FossilFrenzyUI.ui.st.matchedCount), 2);
    await page.tap('[data-act=end]');
    assert.equal(await page.locator('.tile.up').count(), 0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('UI (redesign): you bank ONE set, by tapping it, for the number on its fossil', { skip: !chromium && 'Playwright/Chromium not available' }, async () => {
  const { browser, page, errors } = await open();
  try {
    await setup(page, { n: 2, system: false });
    await page.evaluate(() => {
      const { ui, render } = window.FossilFrenzyUI;
      ui.st.players[ui.st.current].sets = [{ value: 7, gem: false, size: 2, ids: [] }, { value: 3, gem: false, size: 2, ids: [] }];
      ui.st.rng = () => 0.01;                                              // bonus die shows a 1: no bonus
      render();
    });
    await page.tap('[data-act=set][data-i="1"]');                          // bank the 3, not the 7
    const r = await page.evaluate(() => { const st = window.FossilFrenzyUI.ui.st, p = st.players[st.current]; return [p.points, p.sets.map(x => x.value)]; });
    assert.deepEqual(r, [3, [7]]);
    assert.match(await page.locator('.note').innerText(), /Banked a 3: \+3/);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('UI (redesign): a bot\'s peek shows as a dashed ring on a face-down space, its flip as a solid ring', { skip: !chromium && 'Playwright/Chromium not available' }, async () => {
  const { browser, page, errors } = await open();
  try {
    await setup(page, { n: 2, system: false, bots: [0, 1] });
    let checked = 0;
    for (let i = 0; i < 80 && checked < 3 && !(await page.evaluate(() => window.FossilFrenzyUI.ui.st.over)); i++) {
      const t = await page.evaluate(() => { const s = window.FossilFrenzyUI.ui.st.turn; return { banked: !!s.banked, matched: !!s.matched, revealed: s.revealed.length, peeked: s.peeked !== null }; });
      if (!t.banked && !t.matched) {
        assert.equal(await page.locator('.ring.peekring').count(), 1, 'one dashed ring where it peeked');
        assert.ok(await page.locator('.ring:not(.peekring)').count() >= 1, 'a solid ring on what it flipped');
        assert.equal(await page.locator('.tile.peek').count(), 0, 'the bot\'s number is never shown');
        checked++;
      }
      await page.tap('[data-act=end]');
    }
    assert.ok(checked >= 1, 'saw at least one non-matching bot turn');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

// ---------- save / resume ----------
const gameState = page => page.evaluate(() => { const s = window.FossilFrenzyUI.ui.st; return s ? JSON.stringify([s.phase, s.current, s.turnNo, s.matchedCount, s.turn, s.players.map(p => [p.pos, p.assign, p.sets, p.stash, p.points])]) : null; });
const screenOf = page => page.evaluate(() => window.FossilFrenzyUI.ui.screen);
const SKIP = { skip: !chromium && 'Playwright/Chromium not available', timeout: 90000 };

test('save: reloading the page mid-turn resumes the same game, same phase, and play continues', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    await setup(page, { n: 2, system: false });
    await rig(page, { 0: 7, 1: 5, 2: 7 });
    await page.tap(await tile(page, 0));                                  // peek
    await page.tap(await tile(page, 1));                                  // flip a miss
    const before = await gameState(page);
    await page.reload();
    assert.equal(await screenOf(page), 'play');
    assert.equal(await gameState(page), before, 'identical game state after the reload');
    assert.equal(await page.locator('.ring.peekring').count(), 1, 'the peeked space is still marked');
    await page.tap('[data-act=end]');                                     // carry on: end the turn…
    await page.tap(await tile(page, 2)); await page.tap(await tile(page, 0));   // …then the next player peeks and flips
    assert.equal(await page.evaluate(() => window.FossilFrenzyUI.ui.st.turnNo), 1);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('save: a bot\'s turn left on the board survives a reload and Continue still works', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    await setup(page, { n: 2, system: false, bots: [0, 1] });
    assert.equal(await page.evaluate(() => window.FossilFrenzyUI.ui.botWaiting), true);
    const before = await gameState(page);
    await page.reload();
    assert.equal(await page.evaluate(() => window.FossilFrenzyUI.ui.botWaiting), true);
    assert.equal(await gameState(page), before);
    assert.equal(await page.evaluate(() => window.FossilFrenzyUI.ui.bots.filter(Boolean).length), 2);
    await page.tap('[data-act=end]');
    assert.equal(await page.evaluate(() => window.FossilFrenzyUI.ui.st.turnNo), 1);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('save: starting a new game clears the save, and a finished game is not resumed', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    page.on('dialog', d => d.accept());
    await setup(page, { n: 2, system: false });
    await page.tap('[data-act=newgame]');
    await page.reload();
    assert.equal(await screenOf(page), 'setup');
    await setup(page, { n: 2, system: false, bots: [0, 1] });
    for (let i = 0; i < 400 && !(await page.evaluate(() => window.FossilFrenzyUI.ui.st.over)); i++) await page.tap('[data-act=end]');
    assert.equal(await page.evaluate(() => window.FossilFrenzyUI.ui.st.over), true);
    await page.reload();
    assert.equal(await screenOf(page), 'setup');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('save: a save from other rules, or a damaged one, is cleared with a quiet note — never a crash', SKIP, async () => {
  const { browser, page, errors } = await open();
  try {
    await setup(page, { n: 2, system: false });
    await page.evaluate(() => { const k = 'fossil-frenzy-save-v1', sv = JSON.parse(localStorage.getItem(k)); sv.game.fingerprint = 'other'; localStorage.setItem(k, JSON.stringify(sv)); });
    await page.reload();
    assert.equal(await screenOf(page), 'setup');
    assert.match(await page.locator('.sheet').innerText(), /changed the rules, so your saved game was cleared/);
    assert.equal(await page.evaluate(() => localStorage.getItem('fossil-frenzy-save-v1')), null);
    await page.evaluate(() => localStorage.setItem('fossil-frenzy-save-v1', '{not json'));
    await page.reload();
    assert.equal(await screenOf(page), 'setup');
    assert.match(await page.locator('.sheet').innerText(), /could not be resumed/);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
