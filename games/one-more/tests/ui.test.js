// Browser tests, part 1: the screens and the moves of a turn. Touch taps on the real page.
const { test, assert, SKIP, SIZES, open, state, setup, start, errorsOf, rig, place, range, settled, H } = require('./browser');

test('home: the title, Play, How to play and Settings; a sound switch', SKIP, async () => {
  const { page, errors, close } = await open();
  try {
    assert.equal((await state(page)).screen, 'home');
    const text = await page.locator('.home').innerText();
    assert.match(text, /One More(…|\.\.\.)/);
    assert.equal(await page.locator('[data-act=play]').count(), 1);
    assert.equal(await page.locator('[data-act=help]').count(), 1);
    assert.equal(await page.locator('[data-act=settings]').count(), 1);
    assert.equal(await page.locator('[data-act=soundtog]').count(), 1);
    assert.deepEqual(errorsOf(errors), []);
  } finally { await close(); }
});

test('the page is locked: no scrolling, no zoom; the table never overflows, on iPad both ways and on phones', SKIP, async () => {
  for (const [name, viewport] of Object.entries(SIZES)) {
    const { page, errors, close } = await open({ viewport });
    try {
      assert.equal(await page.evaluate(() => getComputedStyle(document.body).overflow), 'hidden');
      assert.equal(await page.evaluate(() => getComputedStyle(document.body).position), 'fixed');
      assert.match(await page.evaluate(() => document.querySelector('meta[name=viewport]').content), /user-scalable=no/);
      await setup(page, { n: 6, kinds: ['human', 'computer', 'human', 'human', 'human', 'human'] });
      const m = await page.evaluate(() => ({ sh: document.documentElement.scrollHeight, sw: document.documentElement.scrollWidth, ih: innerHeight, iw: innerWidth }));
      assert.ok(m.sh <= m.ih + 1 && m.sw <= m.iw + 1, `${name}: nothing to scroll ${JSON.stringify(m)}`);
      await page.evaluate(() => window.scrollTo(0, 500));
      assert.equal(await page.evaluate(() => window.scrollY), 0);
      assert.deepEqual(errorsOf(errors), [], name);
    } finally { await close(); }
  }
});

// ---------- setup ----------
test('setup: 2 to 6 seats, each a human or a computer with one of three styles; remembered on this device', SKIP, async () => {
  const { page, errors, close } = await open();
  try {
    await page.tap('[data-act=play]');
    assert.deepEqual(await page.locator('[data-act=n]').allInnerTexts(), ['2', '3', '4', '5', '6']);
    assert.equal(await page.locator('input[data-act=name]').count(), 2, 'two seats to begin with');
    assert.equal(await page.inputValue('input[data-act=name][data-i="0"]'), 'You');
    assert.equal(await page.locator('[data-act=kind][data-i="0"].on').innerText(), 'Human');
    assert.equal(await page.locator('[data-act=kind][data-i="1"].on').innerText(), 'Computer', 'the default is you against a computer');
    assert.deepEqual(await page.locator('[data-act=style][data-i="1"]').allInnerTexts(), ['Careful', 'Steady', 'Daring']);
    assert.equal(await page.locator('[data-act=style][data-i="0"]').count(), 0, 'humans have no style');
    for (const n of [2, 3, 4, 5, 6]) { await page.tap(`[data-act=n][data-v="${n}"]`); assert.equal(await page.locator('input[data-act=name]').count(), n); }
    await page.tap('[data-act=kind][data-i="2"][data-v="computer"]');
    await page.tap('[data-act=style][data-i="2"][data-v="daring"]');
    assert.equal(await page.inputValue('input[data-act=name][data-i="2"]'), 'Daring');
    await page.fill('input[data-act=name][data-i="0"]', 'Ada');
    await page.reload();
    await page.tap('[data-act=play]');
    assert.equal(await page.locator('input[data-act=name]').count(), 6, 'the seat count is remembered');
    assert.equal(await page.inputValue('input[data-act=name][data-i="0"]'), 'Ada');
    assert.equal(await page.locator('[data-act=style][data-i="2"].on').innerText(), 'Daring');
    assert.equal(await page.locator('[data-act=kind][data-i="2"].on').innerText(), 'Computer');
    assert.deepEqual(errorsOf(errors), []);
  } finally { await close(); }
});

test('setup: two computers of the same style get different names; a way back to the home screen', SKIP, async () => {
  const { page, close } = await open();
  try {
    await page.tap('[data-act=play]');
    await page.tap('[data-act=n][data-v="3"]');
    await page.tap('[data-act=kind][data-i="2"][data-v="computer"]');
    assert.deepEqual([await page.inputValue('input[data-act=name][data-i="1"]'), await page.inputValue('input[data-act=name][data-i="2"]')], ['Steady', 'Steady 2']);
    await page.tap('[data-act=home]');
    assert.equal((await state(page)).screen, 'home');
  } finally { await close(); }
});

test('setup: the game starts with the seats the setup describes (computers marked), in a shuffled turn order', SKIP, async () => {
  const { page, close } = await open();
  try {
    await setup(page, { n: 4, kinds: ['human', 'computer', 'human', 'computer'], styles: [null, 'careful', null, 'daring'] });
    const seats = await page.evaluate(() => window.OneMoreUI.ui.seats.map(s => [s.name, s.kind, s.style]));
    assert.equal(seats.length, 4);
    assert.deepEqual(seats.map(s => s[0]).sort(), ['Careful', 'Daring', 'Player 3', 'You']);
    assert.equal(seats.filter(s => s[1] === 'computer').length, 2);
    assert.equal(await page.locator('.seat').count(), 4);
    assert.equal(await page.locator('.seat .sub:has-text("computer")').count(), 2);
  } finally { await close(); }
});

// ---------- the table ----------
test('the table: draw pile with its count, boom pile with booms out (0 of 6), a score for every seat', SKIP, async () => {
  const { page, errors, close } = await open();
  try {
    await setup(page, { n: 2, kinds: ['human', 'human'] });
    assert.equal((await state(page)).screen, 'play');
    assert.equal(await page.locator('.seat').count(), 2);
    assert.equal(await page.locator('.seat .score').count(), 2);
    assert.equal(await page.locator('.card').count(), 44, 'all 44 cards are on the table somewhere');
    assert.equal(await page.locator('.zdraw .zcount').innerText(), '44 cards');
    assert.match(await page.locator('.zboom .zcount').innerText(), /0\s*\/ 6 booms/);
    assert.equal(await page.locator('.zboom .pips i').count(), 6);
    assert.equal(await page.locator('.seat.cur').count(), 1, 'exactly one seat is lit');
    assert.equal(await page.locator('.menu').count(), 1);
    assert.equal(await page.locator('button:has-text("Draw"), button:has-text("Save")').count(), 0, 'no verb buttons');
    assert.deepEqual(errorsOf(errors), []);
  } finally { await close(); }
});

test('the table: a two-player game shows the target next to each score; a bigger game does not', SKIP, async () => {
  const { page, close } = await open();
  try {
    await start(page, [H, H]);
    assert.deepEqual(await page.locator('.seat .score small').allInnerTexts(), ['/20', '/20']);
    await start(page, [H, H, H]);
    assert.equal(await page.locator('.seat .score small').count(), 0);
  } finally { await close(); }
});

test('thumb zone: the draw pile (the most-tapped thing) sits in the bottom-right corner at every size; Settings can mirror it to the left', SKIP, async () => {
  for (const [name, viewport] of Object.entries(SIZES)) {
    const { page, errors, close } = await open({ viewport });
    try {
      await setup(page, { n: 2, kinds: ['human', 'human'] });
      const rect = sel => page.locator(sel).first().boundingBox();
      const d = await rect('.zdraw'), b = await rect('.zboom'), t = await rect('.ztable');
      const cx = d.x + d.width / 2, cy = d.y + d.height / 2;
      assert.ok(cx > viewport.width * 0.6, `${name}: the draw pile is on the right (${Math.round(cx)} of ${viewport.width})`);
      assert.ok(cy > viewport.height * 0.6, `${name}: and low on the screen (${Math.round(cy)} of ${viewport.height})`);
      assert.ok(d.x + d.width <= viewport.width && d.y + d.height <= viewport.height, name + ': inside the screen');
      assert.ok(b.x + b.width / 2 < cx || b.y + b.height / 2 < cy, name + ': the boom pile, which is only looked at, is out of the corner');
      assert.ok(Math.max(d.width, d.height) >= 70, name + ': a pile big enough for a thumb');
      // tapping near the pile still draws (generous target)
      const nearTap = d.y + d.height - 4 < viewport.height ? [d.x + d.width / 2, Math.min(viewport.height - 2, d.y + d.height + 4)] : [d.x + d.width / 2, d.y + d.height - 2];
      await page.touchscreen.tap(...nearTap);
      assert.equal(await page.locator('.zdraw .zcount').innerText(), '43 cards', name + ': a tap just beside the pile still digs');
      // left-handed: mirrored
      await page.evaluate(() => { window.OneMoreUI.ui.hand = 'left'; window.OneMoreUI.render(); });
      const l = await rect('.zdraw');
      assert.ok(l.x + l.width / 2 < viewport.width * 0.4 && l.y + l.height / 2 > viewport.height * 0.6, `${name}: left-handed puts it bottom-left`);
      assert.deepEqual(errorsOf(errors), [], name);
    } finally { await close(); }
  }
});

test('settings: "Draw pile" Right hand / Left hand is remembered on the device', SKIP, async () => {
  const { page, errors, close } = await open();
  try {
    await page.tap('[data-act=settings]');
    assert.equal(await page.locator('[data-act=hand].on').innerText(), 'Right hand');
    await page.tap('[data-act=hand][data-v=left]');
    assert.equal(await page.locator('[data-act=hand].on').innerText(), 'Left hand');
    assert.equal(await page.evaluate(() => localStorage.getItem('tabletop-library-one-more-hand')), 'left');
    await page.reload();
    await page.tap('[data-act=settings]');
    assert.equal(await page.locator('[data-act=hand].on').innerText(), 'Left hand');
    assert.deepEqual(errorsOf(errors), []);
  } finally { await close(); }
});

test('dig: tapping the draw pile turns a card onto the table; the pile shrinks and its edge gets thinner', SKIP, async () => {
  const { page, errors, close } = await open();
  try {
    await setup(page, { n: 2, kinds: ['human', 'human'] });
    const edge = () => page.evaluate(() => parseFloat(document.querySelector('.stackedge').style.getPropertyValue('--t')));
    const e0 = await edge();
    await rig(page, ['g', 'g', 'g']);
    await page.tap('[data-act=draw]');
    let s = await state(page);
    assert.deepEqual([s.table, s.draw], [1, 43]);
    assert.equal(await page.locator('.zdraw .zcount').innerText(), '43 cards');
    await page.tap('[data-act=draw]'); await page.tap('[data-act=draw]');
    s = await state(page);
    assert.deepEqual([s.table, s.draw], [3, 41]);
    assert.equal(await page.locator('.card.up.atrisk').count(), 3, 'three gems face up on the table');
    assert.ok(await edge() <= e0);
    assert.match(await page.locator('.ztable .risk').innerText(), /3\s*at risk/);
    await settled(page);
    const inside = await page.evaluate(() => { const r = document.querySelector('.ztable').getBoundingClientRect(); return [...document.querySelectorAll('.card.atrisk')].every(c => { const b = c.getBoundingClientRect(); return b.left >= r.left - 2 && b.right <= r.right + 2 && b.top >= r.top - 2 && b.bottom <= r.bottom + 2; }); });
    assert.ok(inside, 'gems stay inside the table');
    assert.deepEqual(errorsOf(errors), []);
  } finally { await close(); }
});

test('dig: a long run of gems stays on the table (the row overlaps or wraps), on iPad and on a phone', SKIP, async () => {
  for (const viewport of [SIZES.ipadLand, SIZES.phone]) {
    const { page, errors, close } = await open({ viewport });
    try {
      await setup(page, { n: 2, kinds: ['human', 'human'] });
      await rig(page, Array(24).fill('g'));
      for (let i = 0; i < 24; i++) await page.tap('[data-act=draw]');
      assert.equal((await state(page)).table, 24);
      await settled(page);
      const inside = await page.evaluate(() => { const r = document.querySelector('.ztable').getBoundingClientRect(); return [...document.querySelectorAll('.card.atrisk')].every(c => { const b = c.getBoundingClientRect(); return b.left >= r.left - 2 && b.right <= r.right + 2 && b.top >= r.top - 2 && b.bottom <= r.bottom + 2; }); });
      assert.ok(inside, `all 24 gems inside the table at ${viewport.width}x${viewport.height}`);
      assert.deepEqual(errorsOf(errors), []);
    } finally { await close(); }
  }
});

test('save: tap your gems on the table — they join your pile for good, your score goes up, the turn passes', SKIP, async () => {
  const { page, errors, close } = await open();
  try {
    await setup(page, { n: 2, kinds: ['human', 'human'] });
    await rig(page, ['g', 'g', 'g', 'g', 'g']);
    for (let i = 0; i < 3; i++) await page.tap('[data-act=draw]');
    const first = (await state(page)).cur;
    await page.tap('.ztable');                                   // the gems on the table
    let s = await state(page);
    assert.deepEqual(s.scores[first], 3);
    assert.notEqual(s.cur, first, 'the turn passed');
    assert.equal(s.table, 0);
    assert.equal(await page.locator(`.seat[data-seat="${first}"] .score`).innerText().then(t => t.replace(/\D.*$/, '')), '3');
    assert.equal(await page.locator('.seat.cur').getAttribute('data-seat'), String(s.cur), 'the lit seat follows the turn');
    // the second player saves with a tap on their own pile instead
    await page.tap('[data-act=draw]'); await page.tap('[data-act=draw]');
    await page.tap('.seat.cur .pilezone');
    s = await state(page);
    assert.equal(s.scores[1 - first], 2);
    assert.equal(s.cur, first);
    assert.deepEqual(errorsOf(errors), []);
  } finally { await close(); }
});

test('save: only a tap on the gems (or just beside them) saves — a stray tap on the empty felt does not bank the turn', SKIP, async () => {
  const { page, close } = await open();
  try {
    await setup(page, { n: 2, kinds: ['human', 'human'] });
    await rig(page, ['g', 'g', 'g']);
    await page.tap('[data-act=draw]'); await page.tap('[data-act=draw]');
    await settled(page);
    const before = await state(page);
    await page.tap('.ztable', { position: { x: 12, y: 12 } });                   // the empty corner of the table
    await page.tap('.ztable', { position: { x: 580, y: 520 } });
    assert.deepEqual([(await state(page)).table, (await state(page)).cur], [2, before.cur], 'nothing happened');
    const c = await page.evaluate(() => { const b = document.querySelector('.card.atrisk').getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; });
    await page.touchscreen.tap(c[0], c[1]);                                      // on a gem
    const s = await state(page);
    assert.deepEqual([s.scores[before.cur], s.table], [2, 0]);
  } finally { await close(); }
});

test('save: nothing to save, nothing happens (a tap on the empty table or on the other seat’s pile does nothing)', SKIP, async () => {
  const { page, close } = await open();
  try {
    await setup(page, { n: 2, kinds: ['human', 'human'] });
    const before = JSON.stringify(await state(page));
    await page.tap('.ztable');
    await page.tap('.seat:not(.cur) .pilezone');
    assert.equal(JSON.stringify(await state(page)), before);
  } finally { await close(); }
});

test('boom: the boom stays on the table until a tap passes the turn; the lost gems are shown beside it; taps right after it are ignored', SKIP, async () => {
  const { page, errors, close } = await open();
  try {
    await setup(page, { n: 2, kinds: ['human', 'human'] });
    await page.evaluate(() => { window.OneMoreUI.ui.pace.boomGuardMs = 400; });
    await rig(page, ['g', 'g', 'b']);
    const first = (await state(page)).cur;
    await page.tap('[data-act=draw]'); await page.tap('[data-act=draw]');
    await page.tap('[data-act=draw]');
    let s = await state(page);
    assert.equal(s.phase, 'boomed');
    assert.match(await page.locator('#banner').innerText(), /BOOM/);
    assert.match(await page.locator('#banner').innerText(), /loses 2 gems/);
    assert.ok(await page.locator('.card.boom.up').count() >= 1);
    assert.equal(await page.locator('.card.lost').count(), 2, 'the two lost gems are greyed beside the boom');
    assert.equal(s.cur, first, 'still the same player');
    await page.tap('.ztable');                                   // an eager tap (inside the guard) does not skip the boom
    assert.equal((await state(page)).phase, 'boomed');
    await page.waitForTimeout(900);                              // it stays as long as it likes: nothing advances on a timer
    s = await state(page);
    assert.equal(s.phase, 'boomed');
    assert.equal(await page.locator('#banner .big').count(), 1);
    await page.tap('.ztable');                                   // now a tap passes the turn
    s = await state(page);
    assert.equal(s.phase, 'turn');
    assert.notEqual(s.cur, first);
    assert.equal(s.boomsOut, 1);
    assert.match(await page.locator('.zboom .zcount').innerText(), /1\s*\/ 6 booms/);
    assert.equal(await page.locator('.zboom .pips i.on').count(), 1);
    assert.equal(await page.locator('#banner .big').count(), 0, 'the banner is gone');
    assert.deepEqual(s.scores, [0, 0]);
    assert.deepEqual(errorsOf(errors), []);
  } finally { await close(); }
});

test('boom: a tap on the draw pile while a boom is showing only passes the turn — it does not also draw', SKIP, async () => {
  const { page, close } = await open();
  try {
    await setup(page, { n: 2, kinds: ['human', 'human'] });
    await rig(page, ['b', 'g', 'g']);
    await page.tap('[data-act=draw]');
    const drawBefore = (await state(page)).draw;
    await page.tap('[data-act=draw]');
    const s = await state(page);
    assert.equal(s.phase, 'turn');
    assert.equal(s.draw, drawBefore, 'the tap passed the turn, it did not also draw');
  } finally { await close(); }
});

test('refresh: the 6th boom shows until tapped, then everything not saved is shuffled into a new draw pile', SKIP, async () => {
  const { page, errors, close } = await open();
  try {
    await setup(page, { n: 3, kinds: ['human', 'human', 'human'] });
    await rig(page, ['g', 'g']);
    await page.tap('[data-act=draw]'); await page.tap('[data-act=draw]'); await page.tap('.ztable');     // 2 gems saved
    for (let i = 0; i < 6; i++) {
      await rig(page, ['b']);
      await page.tap('[data-act=draw]');
      assert.equal((await state(page)).phase, 'boomed');
      if (i === 5) assert.equal(await page.locator('.zboom .pips i.on').count(), 6, 'six booms out, all six pips lit');
      await page.tap('.ztable');
    }
    const s = await state(page);
    assert.equal(s.boomsOut, 0);
    assert.equal(s.draw, 42, 'all 42 unsaved cards are back in the draw pile');
    assert.equal(await page.locator('.zdraw .zcount').innerText(), '42 cards');
    assert.equal(s.scores.reduce((a, b) => a + b, 0), 2);
    assert.equal(await page.locator('.zboom .pips i.on').count(), 0);
    assert.deepEqual(errorsOf(errors), []);
  } finally { await close(); }
});

test('the only-booms refresh happens by itself and the gems at risk stay on the table', SKIP, async () => {
  const { page, errors, close } = await open();
  try {
    await setup(page, { n: 3, kinds: ['human', 'human', 'human'] });
    await place(page, { current: 0, draw: [38, 39, 40, 41, 42, 0], boomPile: [1, 2, 3, 4, 5, 43], safe: [[], range(6, 31), range(31, 38)] });   // one gem on top of five booms
    await page.tap('[data-act=draw]');
    const s = await state(page);
    assert.equal(s.table, 1, 'the gem stays on the table');
    assert.equal(s.draw, 11, 'the 5 booms plus the boom pile (5 gems and a boom)');
    assert.equal(s.boomsOut, 0);
    assert.equal(s.phase, 'turn');
    assert.equal(await page.locator('.zdraw .zcount').innerText(), '11 cards');
    await page.waitForFunction(() => window.OneMoreUI.audio.played.includes('refresh'));
    assert.deepEqual(errorsOf(errors), []);
  } finally { await close(); }
});
