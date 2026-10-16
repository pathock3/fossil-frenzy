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
