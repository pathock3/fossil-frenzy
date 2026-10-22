// The rules of a Dig (Dig engine). Cards come from tests/cards-full.csv — a test fixture, a snapshot of the v2.7 sheet.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const { Dig, Engine, DDB } = require('./load.js');
const cards = Engine.cards(Engine.parseCSV(fs.readFileSync(path.join(__dirname, 'cards-full.csv'), 'utf8')), DDB.columns);
const by = id => { const c = cards.find(x => x.id === id); assert.ok(c, 'card ' + id); return c; };
let n = 1;
// A card given by id comes from the fixture; a card object (see `card` below) is used as it is.
const get = x => typeof x === 'string' ? by(x) : x;
// A Dig with a scripted Mine (ids or cards, top first) and scripted dice. Defaults: no Starter Kit, plenty of room on the tracks.
function game({ kit = [], mine, dice = [], start = {}, seed = 1, ongoing = [], power = [] } = {}) {
  const st = Dig.start(cards, kit.map(get), { seed, dice, start });
  if (mine) st.mine = mine.map(x => ({ ...get(x), uid: 90000 + n++ }));
  for (const x of ongoing) st.ongoing.push({ ...get(x), uid: 90000 + n++ });
  for (const x of power) { const c = get(x); st.line.push({ card: { ...c, uid: 90000 + n++ }, at: c.number, base: c.number }); }
  st.known = 0; return st;
}
// A card made up for one test, for an effect none of the supported fixture cards has (the fixture is never edited).
const card = (text, o = {}) => ({ id: 'XX-' + n++, name: o.name || 'Test card', type: 'Power', number: 5, deck: 'Booster', count: 1, text, ...o });
// Burnout cards (made up for the tests): they move UP the Power line right after they trigger.
const burnCard = (n0, up = 2, max = 10, effect = '+1 {heart}') => card(`${effect}, then move this card up ${up} (max ${max})`, { number: n0, name: 'Test Burnout' });
// every Booster card the game can play (as the Booster Deck is), plus two Burnout cards, for the random-play tests
const playable = () => cards.filter(c => c.deck === 'Booster' && Dig.supported(c)).concat([burnCard(3), burnCard(9, 3, 10, '+1 {reroll}')]);
const text = st => st.log.map(l => l.text).join('\n');
// dig a Monster and play the roll through: roll, trigger everything eligible (highest first), then face it (a defeat has already ended the fight)
function fight(st) { assert.ok(Dig.dig(st)); assert.ok(Dig.roll(st)); if (st.fight) assert.ok(Dig.autoFace(st)); return st; }

const UNSUPPORTED = ["PW-04", "PW-06", "PW-08", "PW-10", "PW-11", "PW-13", "PW-18", "PW-23", "PW-25", "PW-26", "PW-29", "PW-30", "ON-01", "ON-07", "ON-10", "ON-13", "ON-16", "ON-18", "ON-24", "ON-25", "ON-26", "ON-28", "ON-30", "ON-32", "ON-36", "IM-02", "IM-09", "IM-10", "IM-12", "IM-15", "IM-18", "IM-19", "IM-27", "IM-29", "IM-31", "IM-34"];
test('the rules are data: nothing the engine needs is missing from DDB.rules; every card text is understood except the Grit cards and the two player-chosen moves, which are cut', () => {
  for (const k of ['die', 'caps', 'start', 'pet', 'beyond', 'rulings']) assert.ok(DDB.rules[k] !== undefined, k);
  assert.equal(cards.length, 107, 'the sheet\'s 108 cards (with Monster C), less the Lucky Coin (taken out of the game)');
  const bad = cards.filter(c => !Dig.supported(c)).map(c => c.id);
  assert.deepEqual(bad.slice().sort(), UNSUPPORTED.slice().sort(), 'exactly these cards are unsupported — everything else is understood');
  assert.equal(bad.length, 36);
  for (const c of cards) if (/\{grit\}/.test(c.text)) assert.ok(!Dig.supported(c), c.id + ' mentions Grit, which is cut');
  assert.ok(cards.filter(c => c.deck === 'Booster' && Dig.supported(c)).length > 60, 'the Booster Deck is the supported cards only');
});

test('a new Dig: Mine of 30 (21 Geodes, 9 Monsters in three sets: A 1-3-5-7, B 2-4-6, C 3-5), the Pet on the line at 9, Health and Rerolls at their starting spaces', () => {
  const st = Dig.start(cards, [], { seed: 5 });
  assert.equal(st.mine.length, 30);
  assert.equal(st.mine.filter(c => c.type === 'Treasure').length, 21);
  assert.equal(st.mine.filter(c => c.type === 'Monster').length, 9);
  assert.equal(st.mine.filter(c => c.id === 'MO-03').length, 2, 'Monster C: two cards (3, then 5)');
  assert.deepEqual(st.mine.map(c => c.id).filter(i => i === 'MO-01').length, 4);
  assert.equal(st.line.length, 1); assert.equal(st.line[0].card.name, 'Drill Pup'); assert.equal(st.line[0].at, 9, 'the Pet triggers on a 9 or more'); assert.ok(st.line[0].pet);
  assert.deepEqual([st.heart, st.reroll], [DDB.rules.start.heart, DDB.rules.start.reroll]);
  assert.deepEqual(Dig.start(cards, [], { seed: 5 }).mine.map(c => c.id), st.mine.map(c => c.id), 'same seed, same Mine');
  assert.notDeepEqual(Dig.start(cards, [], { seed: 6 }).mine.map(c => c.id), st.mine.map(c => c.id));
});

test('the Drill by the rules: a d10, Health 0-10 starting at 10, Extra Rolls 0-10 starting at 0 — and no Grit track at all', () => {
  assert.equal(DDB.rules.die, 10);
  assert.deepEqual(DDB.rules.caps, { heart: 10, reroll: 10 });
  assert.deepEqual(DDB.rules.start, { heart: 10, reroll: 0 });
  const st = Dig.start(cards, [], { seed: 3 });
  assert.deepEqual([st.heart, st.reroll], [10, 0]);
  assert.ok(!('grit' in st) && !('grit' in st.rules), 'Grit is cut: the Drill has only Health and Rerolls');
  for (const f of ['spendGrit', 'refundGrit', 'buyBonus', 'trade']) assert.equal(Dig[f], undefined, 'Dig.' + f + ' is gone');
  assert.ok(!DDB.rules.gritBefore && !DDB.rules.gritAfter && !('gritCarriesToReroll' in DDB.rules.rulings) && !('falconIncludesGrit' in DDB.rules.rulings));
  assert.ok(!('grit' in DDB.iconCodes), '{grit} is no longer an icon');
  const seen = new Set(); for (let i = 1; i <= 400; i++) { const g = Dig.start(cards, [], { seed: i }); g.mine = [{ ...by('MO-01'), uid: 1 }]; Dig.dig(g); Dig.roll(g); seen.add(g.fight.die); }
  assert.deepEqual([Math.min(...seen), Math.max(...seen), seen.size], [1, 10, 10], 'every face of a d10 comes up');
  const h = game({ mine: ['IM-13'], start: { heart: 8 } }); Dig.dig(h); assert.equal(h.heart, 10, 'Health stops at 10');
  const r = game({ mine: ['IM-11'], start: { reroll: 9 } }); Dig.dig(r); assert.equal(r.reroll, 10, 'Extra Rolls stop at 10');
  const c = Dig.can(game({ mine: ['MO-01'] })); assert.ok(!('grit' in c) && !('refund' in c) && !('bonus' in c));
});

test('Starter Kit: every kit card goes on top of the Mine, face up, in the order chosen; nothing else is in play at the start', () => {
  const st = Dig.start(cards, ['PW-02', 'ON-33', 'IM-13'].map(by), { seed: 1 });
  assert.equal(st.line.length, 1, 'only the Pet'); assert.deepEqual(st.ongoing.map(c => c.id), [], 'and no Ongoing card: the Lucky Coin is out of the game'); assert.equal(st.mine.length, 33);
  assert.deepEqual(st.mine.slice(0, 3).map(c => c.id), ['PW-02', 'ON-33', 'IM-13']); assert.equal(st.known, 3);
  const two = Dig.start(cards, ['IM-13', 'IM-11'].map(by), { seed: 1, start: { heart: 2 } }); Dig.dig(two); Dig.dig(two);
  assert.deepEqual([two.heart, two.reroll], [6, 2], 'both kit Immediates were the first two cards you dug');
  const three = Dig.start(cards, ['PW-02', 'ON-33'].map(by), { seed: 1 }); Dig.dig(three); Dig.dig(three);
  assert.equal(three.line.length, 2); assert.equal(three.ongoing.length, 1, 'digging the kit puts the cards in play');
  const rev = Dig.start(cards, ['ON-33', 'PW-02'].map(by), { seed: 1 }); assert.deepEqual(rev.mine.slice(0, 2).map(c => c.id), ['ON-33', 'PW-02'], 'the order you chose');
});

test('the Starter Kit goes on top of the Mine, face up, in the order chosen; every other card you own is shuffled into the Mine with the 30 Starting cards', () => {
  const kit = ['PW-02', 'ON-33'].map(by), extra = ['IM-13', 'IM-11', 'PW-28', 'ON-05'].map(by);
  const orders = new Set();
  for (let seed = 1; seed <= 40; seed++) {
    const st = Dig.start(cards, kit, { seed, extra });
    assert.equal(st.mine.length, 30 + 2 + 4);
    assert.deepEqual(st.mine.slice(0, 2).map(c => c.id), ['PW-02', 'ON-33'], 'the kit, in the order chosen');
    assert.equal(st.known, 2, 'only the kit is face up');
    assert.deepEqual(st.mine.slice(2).filter(c => extra.some(e => e.id === c.id)).map(c => c.id).sort(), extra.map(c => c.id).sort(), 'every other card you own is somewhere below');
    assert.ok(st.kit.every(k => k.fromKit) && !st.mine.slice(2).some(c => c.fromKit), 'only the kit is the kit');
    orders.add(st.mine.slice(2, 8).map(c => c.id).join());
  }
  assert.ok(orders.size > 20, 'your other cards are shuffled in among the Starting cards');
  const none = Dig.start(cards, [], { seed: 1, extra }); assert.equal(none.known, 0); assert.equal(none.kit.length, 0);
});

test('digging a Geode scores 1 gem and discards it; the Mine shrinks', () => {
  const st = game({ mine: ['TR-01', 'TR-01'] });
  Dig.dig(st); Dig.dig(st);
  assert.equal(st.geodeGems, 2); assert.equal(st.discard.length, 2); assert.equal(st.mine.length, 0);
});

test('Monster damage: each copy dug deals the next number in its set — A: 1,3,5,7; B: 2,4,6; sets count separately', () => {
  const st = game({ mine: ['MO-01', 'MO-02', 'MO-01', 'MO-02', 'MO-01', 'MO-02', 'MO-01'], start: { heart: 40 }, dice: Array(10).fill(6) });
  const seen = [];
  for (let i = 0; i < 7; i++) { Dig.dig(st); seen.push(st.fight.damage); Dig.roll(st); Dig.autoFace(st); }
  assert.deepEqual(seen, [1, 2, 3, 4, 5, 6, 7]);
});

test('the roll: the die plus your Ongoing bonuses; you roll once before facing the Monster, and only then can you trigger or reroll', () => {
  const st = game({ mine: ['MO-01'], ongoing: ['ON-33'], dice: [4] });
  Dig.dig(st);
  assert.ok(Dig.can(st).roll && !Dig.can(st).dig && !Dig.can(st).face && !Dig.can(st).reroll && !Dig.can(st).trigger);
  Dig.roll(st);
  assert.equal(Dig.result(st).total, 5, '4 + Tune-Up');
  assert.ok(!Dig.can(st).roll, 'no second roll'); assert.ok(Dig.can(st).face);
});

test('a reroll costs 1 Reroll and gives a new die; no reroll without a Reroll', () => {
  const st = game({ mine: ['MO-01'], start: { reroll: 1 }, dice: [2, 5, 6] });
  Dig.dig(st); Dig.roll(st);
  assert.equal(Dig.result(st).total, 2);
  assert.ok(Dig.reroll(st)); assert.equal(st.reroll, 0); assert.equal(Dig.result(st).total, 5);
  assert.ok(!Dig.reroll(st));
});

test('Pet: a result of 10 or more triggers it — the Monster is defeated and you take no damage; it counts as survived and is worth 1 gem', () => {
  const st = game({ mine: ['MO-01'], start: { heart: 6 }, dice: [10] });
  fight(st);
  assert.equal(st.heart, 6); assert.equal(st.survived, 1); assert.equal(st.defeated, 1); assert.equal(st.monsterGems, 1);
  const tap = game({ mine: ['MO-01'], start: { heart: 6 }, dice: [10] }); Dig.dig(tap); Dig.roll(tap); assert.ok(Dig.trigger(tap, Dig.eligible(tap)[0]));
  assert.ok(tap.fight && tap.fight.defeat, 'the Monster is defeated but the fight is not over: you may still use other cards'); Dig.face(tap); assert.equal(tap.fight, null); assert.deepEqual([tap.heart, tap.survived, tap.defeated, tap.monsterGems], [6, 1, 1, 1]);
});

test('a result above 10 triggers every card on the line', () => {
  const st = game({ mine: ['MO-01'], power: ['PW-02', 'PW-28'], ongoing: ['ON-33'], start: { heart: 3 }, dice: [10] });
  Dig.dig(st); Dig.roll(st); assert.equal(Dig.result(st).total, 11);
  Dig.autoFace(st);                                        // 10 + 1 = 11
  assert.equal(st.heart, 3 + 1 + 5, 'Nurse Newt +1, Carrot Bunny +5 — and the Pet defeats the Monster'); assert.equal(st.defeated, 1);
});

test('below the Pet: Power cards at or under the result trigger, others do not; damage is then taken', () => {
  const st = game({ mine: ['MO-01'], power: ['PW-02', 'PW-15'], start: { heart: 6 }, dice: [3] });
  fight(st);                                               // result 3: Newt (1) triggers, Sloth (6) does not
  assert.equal(st.heart, 6 + 1 - 1, 'Newt +1, then 1 damage');
  assert.ok(/Nurse Newt/.test(text(st)) && !/Moss Sloth trigger/.test(text(st)));
});

test('"Resolve all triggered cards, then take damage": healing first can keep you alive', () => {
  const st = game({ mine: ['MO-01', 'MO-01', 'MO-01'], power: ['PW-15'], start: { heart: 1 }, dice: [1, 1, 6] });
  Dig.dig(st); Dig.roll(st); Dig.autoFace(st);                 // 1 damage at 1 heart, nothing triggers (result 1) -> BOOM
  assert.equal(st.over.kind, 'boom');
  const st2 = game({ mine: ['MO-01'], power: ['PW-15'], start: { heart: 1 }, dice: [6] });
  fight(st2);                                              // result 6: Sloth +2, then 1 damage
  assert.equal(st2.heart, 2); assert.equal(st2.over, null);
});

test('BOOM when health reaches 0: the Dig ends, no gems are kept, Monsters survived still count', () => {
  const st = game({ mine: ['TR-01', 'MO-01', 'MO-01'], start: { heart: 2 }, dice: [1, 1, 1] });
  Dig.dig(st); fight(st);                                  // geode, then Monster 1: 1 damage
  assert.equal(st.heart, 1);
  Dig.dig(st); Dig.roll(st); Dig.autoFace(st);                 // Monster 2: 3 damage
  assert.equal(st.over.kind, 'boom'); assert.equal(st.heart, 0);
  assert.equal(st.survived, 1); assert.ok(!Dig.can(st).dig && !Dig.can(st).bank && !Dig.dig(st));
});

test('banking: between cards only; you keep the gems from Geodes and survived Monsters', () => {
  const st = game({ mine: ['TR-01', 'TR-01', 'MO-01', 'TR-01'], start: { heart: 6 }, dice: [2] });
  Dig.dig(st); Dig.dig(st); Dig.dig(st);                   // two Geodes and a Monster in progress
  assert.ok(!Dig.can(st).bank && !Dig.bank(st), 'not while a Monster is unresolved');
  Dig.roll(st); Dig.autoFace(st);
  assert.ok(Dig.bank(st));
  assert.deepEqual([st.over.kind, st.over.total, st.over.geodes, st.over.monsters, st.over.survived], ['bank', 3, 2, 1, 1]);
});

test('Beyond the Mine: after the Mine runs out, Bonus Monsters deal 8, 9, ... and are worth 1 gem each, like every Monster', () => {
  const st = game({ mine: [], start: { heart: 12 }, dice: [1, 1] });
  Dig.dig(st); assert.equal(st.fight.damage, 8); assert.ok(st.fight.monster.bonus);
  Dig.roll(st); Dig.autoFace(st);
  assert.equal(st.heart, 4); assert.equal(st.monsterGems, 1, 'a Bonus Monster pays 1 gem of Loot');
  Dig.dig(st); assert.equal(st.fight.damage, 9);
});

// ---------- Power cards ----------
test('Power cards: resource gains, caps, Lose then gain', () => {
  const lg = card('Lose 1 {heart}, then +2 {reroll}', { number: 1 });
  const st = game({ mine: ['MO-01'], power: [lg, 'PW-17', 'PW-27'], start: { heart: 6, reroll: 2 }, dice: [7] });
  fight(st);                                               // result 7: the test card (1) loses 1 heart then +2 rerolls; Dodo (7) +1; Owl (9) needs 9
  assert.equal(st.heart, 6 - 1 - 1, 'lose 1, then the Monster\'s 1 damage');
  assert.equal(st.reroll, 2 + 2 + 1, 'the test card +2, Dodo +1');
  const low = game({ mine: ['MO-01'], power: ['PW-17', 'PW-27'], start: { reroll: 0 }, dice: [9] }); fight(low);
  assert.equal(low.reroll, 3, 'Dodo +1 and Owl +2');
});

test('Unlucky Duck: when no other card can trigger, "if no other card triggers" is settled at once — the +1 Reroll is there before you take the damage', () => {
  const only = game({ mine: ['MO-01'], power: ['PW-05'], start: { reroll: 0 }, dice: [3] }); Dig.dig(only); Dig.roll(only);
  Dig.trigger(only, only.line.find(e => e.card.id === 'PW-05'));
  assert.equal(only.reroll, 1, 'the only card that could trigger: the Reroll comes now, not later');
  const more = game({ mine: ['MO-01'], power: ['PW-05', 'PW-02'], start: { reroll: 0, heart: 6 }, dice: [3] }); Dig.dig(more); Dig.roll(more);
  Dig.trigger(more, more.line.find(e => e.card.id === 'PW-05'));
  assert.equal(more.reroll, 0, 'another card could still trigger: it waits until you have chosen');
  Dig.face(more); assert.equal(more.reroll, 1, 'and happens when you take the damage');
});

test('"for each other card that triggers" counts the others; Unlucky Duck only fires when nothing else does', () => {
  const crab = card('+1 {reroll} for each other card that triggers', { number: 5, name: 'Test Crab' });
  const st = game({ mine: ['MO-01'], power: [crab, 'PW-09', 'PW-02'], start: { heart: 6, reroll: 0 }, dice: [6] });
  fight(st);                                               // result 6: Crab (5), Pill Bug (3), Newt (1) all trigger
  assert.equal(st.reroll, 2, 'the Crab counts the 2 others');
  const st1 = game({ mine: ['MO-01'], power: [crab, 'PW-05'], start: { reroll: 0 }, dice: [6] }); fight(st1);
  assert.equal(st1.reroll, 1, 'the Crab counts the Duck (1 other); the Duck does not fire because the Crab triggered');
  const duck = game({ mine: ['MO-01'], power: ['PW-05', 'PW-02', 'PW-09'], start: { heart: 6, reroll: 0 }, dice: [6] }); fight(duck);
  assert.equal(duck.reroll, 0, 'Duck did not fire: other cards triggered');
  const st2 = game({ mine: ['MO-01'], power: ['PW-05'], dice: [3] }); fight(st2);
  assert.equal(st2.reroll, 1);
});

test('conditions: Nervous Mouse needs 4 or less Health; Jolt Eel needs 3 or less', () => {
  const lo = game({ mine: ['MO-01'], power: ['PW-07', 'PW-19'], start: { heart: 3 }, dice: [6] });
  fight(lo);                                               // result 6: Mouse (2) fires, Eel (7) does not
  assert.equal(lo.reroll, 1); assert.equal(lo.heart, 3 - 1);
  const hi = game({ mine: ['MO-01'], power: ['PW-07'], start: { heart: 6 }, dice: [6] }); fight(hi);
  assert.equal(hi.reroll, 0);
  const eel = game({ mine: ['MO-01'], power: ['PW-19'], start: { heart: 3 }, dice: [7] }); fight(eel);
  assert.equal(eel.heart, 3 + 5 - 1, '7 triggers the Eel (+5), then the Monster\'s 1 damage');
  const eel4 = game({ mine: ['MO-01'], power: ['PW-19'], start: { heart: 4 }, dice: [7] }); fight(eel4);
  assert.equal(eel4.heart, 4 - 1, 'at 4 Health the Eel\'s condition is not met');
});

test('Block, Venom Spider (half damage, rounded down) and Lucky Cricket', () => {
  const blk = game({ mine: ['MO-01', 'MO-01', 'MO-01'], power: ['PW-09', 'PW-12'], start: { heart: 6 }, dice: [6, 6, 6] });
  fight(blk);                                              // damage 1, block 1+2: no damage
  assert.equal(blk.heart, 6);
  const half = game({ mine: ['MO-01', 'MO-01'], power: ['PW-16'], start: { heart: 12 }, dice: [6, 6] });
  Dig.dig(half); Dig.roll(half); Dig.autoFace(half);           // 1 damage halved = 0
  assert.equal(half.heart, 12);
  Dig.dig(half); Dig.roll(half); Dig.autoFace(half);           // 3 damage halved = 1
  assert.equal(half.heart, 11);
  const cricket = game({ mine: ['MO-01', 'MO-01'], power: ['PW-14'], start: { heart: 3 }, dice: [6, 6] });
  Dig.dig(cricket); Dig.roll(cricket); Dig.autoFace(cricket);  // 1 damage -> 2
  Dig.dig(cricket); Dig.roll(cricket); Dig.autoFace(cricket);  // 3 damage would BOOM at 2 -> survive with 1
  assert.equal(cricket.over, null); assert.equal(cricket.heart, 1);
});

test('"When dug" effects happen the moment the card is dug, not when it triggers', () => {
  const bat = card('+1 {heart}. When dug, +2 {reroll}', { number: 7, name: 'Test Bat' });
  assert.ok(Dig.supported(bat));
  const st = game({ mine: [bat], start: { heart: 5, reroll: 0 } });
  Dig.dig(st);
  assert.equal(st.reroll, 2); assert.equal(st.heart, 5, 'the +1 heart waits for the trigger'); assert.equal(st.line.length, 2); assert.equal(st.line[1].at, 7);
});

test('Falcon Finisher rolls again: 10 or more defeats the Monster at once; below 10 the fight goes on', () => {
  const four = () => [{ ...by('ON-33') }, { ...by('ON-33') }, { ...by('ON-33') }, { ...by('ON-33') }];   // +4 to rolls
  const win = game({ mine: ['MO-02'], power: ['PW-21'], start: { heart: 6 }, dice: [6, 6] });
  win.ongoing = four();
  Dig.dig(win); Dig.roll(win);                              // 6+4 = 10: Falcon (8) is eligible
  assert.ok(Dig.trigger(win, entryOf(win, 'PW-21')));       // Falcon rolls 6+4 = 10 -> defeat
  assert.ok(win.fight.defeat, 'the Monster is defeated'); Dig.face(win); assert.equal(win.fight, null); assert.equal(win.defeated, 1); assert.equal(win.heart, 6);
  const lose = game({ mine: ['MO-02'], power: ['PW-21'], start: { heart: 6 }, dice: [6, 2] });
  fight(lose);                                              // result 6 does not reach Falcon (8)
  assert.equal(lose.heart, 4);
  const low = game({ mine: ['MO-02'], power: ['PW-21'], start: { heart: 6 }, dice: [6, 2] });
  low.ongoing = [{ ...by('ON-33') }, { ...by('ON-33') }];
  Dig.dig(low); Dig.roll(low); assert.ok(Dig.trigger(low, entryOf(low, 'PW-21')));     // 8 reaches Falcon; it rolls 2+2 = 4
  assert.ok(low.fight, 'not defeated: the fight goes on'); Dig.face(low); assert.equal(low.defeated, 0); assert.equal(low.heart, 4);
  const miss = game({ mine: ['MO-02'], power: ['PW-21'], start: { heart: 6 }, dice: [4, 5] });
  miss.ongoing = four();
  Dig.dig(miss); Dig.roll(miss); Dig.trigger(miss, entryOf(miss, 'PW-21'));            // 4+4 = 8; Falcon rolls 5+4 = 9 -> not 10
  assert.equal(miss.defeated, 0); assert.ok(miss.fight); Dig.face(miss); assert.equal(miss.heart, 4);
});

test('Magpie and Echo copy the top Immediate card in the discard pile', () => {
  const st = game({ mine: ['IM-13', 'IM-06'], start: { heart: 2 } });
  Dig.dig(st); assert.equal(st.heart, 6); Dig.dig(st); assert.equal(st.heart, 10, 'Echo did Med Kit again');
  const none = game({ mine: ['IM-06'] }); Dig.dig(none); assert.equal(none.heart, none.rules.heart);
  const mag = game({ mine: ['IM-13', 'MO-01'], power: ['PW-22'], start: { heart: 2 }, dice: [8] }); Dig.dig(mag); fight(mag);
  assert.equal(mag.heart, 6 + 4 - 1, 'Magpie copied Med Kit, then the Monster hit');
});

// ---------- Immediate cards ----------
test('Immediate cards happen when dug, then go to the discard pile', () => {
  const st = game({ mine: ['IM-13', 'IM-23'], start: { heart: 4, reroll: 0 } });
  Dig.dig(st); assert.deepEqual([st.heart, st.reroll], [8, 0]);
  Dig.dig(st); assert.deepEqual([st.heart, st.reroll], [6, 2]); assert.equal(st.discard.length, 2);
});

test('Immediate cards can BOOM you (Risky Shortcut at 2 Health); All In sets Health to 1 and fills Rerolls; Reset Button sets Health to 7', () => {
  const st = game({ mine: ['IM-23'], start: { heart: 2 } }); Dig.dig(st); assert.equal(st.over.kind, 'boom');
  const a = game({ mine: ['IM-01', 'IM-21'], start: { heart: 9 } }); Dig.dig(a); assert.deepEqual([a.heart, a.reroll], [1, 10]); Dig.dig(a); assert.equal(a.heart, 7);
});

test('count-based Immediates: Duct Tape (Ongoing cards), Scrap Heap (Immediates in discard, including itself), Second Wind and Repair Kit', () => {
  const st = game({ mine: ['IM-05'], ongoing: ['ON-33', 'ON-14'], start: { heart: 2 } });
  Dig.dig(st); assert.equal(st.heart, 4, '+1 for each of 2 Ongoing cards');
  const s2 = game({ mine: ['IM-13', 'IM-25'], start: { heart: 1 } }); Dig.dig(s2); Dig.dig(s2); assert.equal(s2.heart, 5 + 2, 'Med Kit +4, then 2 Immediates (itself included) = +2');
  const s3 = game({ mine: ['MO-01', 'IM-26', 'IM-20'], start: { heart: 6 }, dice: [6] });
  fight(s3); Dig.dig(s3); assert.equal(s3.heart, 5 + 1); Dig.dig(s3); assert.equal(s3.reroll, 0, 'nothing defeated');
  const s4 = game({ mine: ['MO-01', 'IM-20'], start: { heart: 6 }, dice: [10] });
  fight(s4); Dig.dig(s4); assert.equal(s4.reroll, 1, 'one Monster defeated: +1 Reroll');
});

test('Four-Leaf Clover: your next Monster is a 10 without a roll (the Pet defeats it)', () => {
  const st = game({ mine: ['IM-07', 'MO-01'], start: { heart: 6 } });
  Dig.dig(st); Dig.dig(st);
  assert.equal(st.fight.phase, 'after'); assert.equal(Dig.result(st).total, 10); assert.ok(!Dig.can(st).roll && !Dig.can(st).reroll);
  Dig.autoFace(st); assert.equal(st.heart, 6); assert.equal(st.defeated, 1);
});


// ---------- the Mine ----------
test('Cave Scout digs until a Monster and puts it back on top, face up; Old Map moves a Monster on top to the bottom', () => {
  const st = game({ mine: ['IM-03', 'TR-01', 'IM-13', 'MO-01', 'TR-01'], start: { heart: 2 } });
  Dig.dig(st);
  assert.equal(st.geodeGems, 1); assert.equal(st.heart, 6); assert.equal(st.mine[0].id, 'MO-01'); assert.equal(st.known, 1);
  const m = game({ mine: ['IM-17', 'MO-01', 'TR-01'] }); Dig.dig(m); assert.deepEqual(m.mine.map(c => c.id), ['TR-01', 'MO-01']);
  const k = game({ mine: ['IM-17', 'TR-01', 'MO-01'] }); Dig.dig(k); assert.deepEqual(k.mine.map(c => c.id), ['TR-01', 'MO-01']);
});

test('Stink Bomb, Crystal Ball, Fuzzy Radar, Rewind Tape, Wishing Well; Look, Shoo and Slide texts (cards made up for the test)', () => {
  const sb = game({ mine: ['IM-30', 'MO-01', 'TR-01', 'MO-02', 'TR-01'] }); Dig.dig(sb);
  assert.deepEqual(sb.mine.map(c => c.id), ['TR-01', 'TR-01', 'MO-01', 'MO-02']);
  const cb = game({ mine: ['IM-04', 'TR-01', 'PW-02', 'ON-33', 'MO-01'] }); Dig.dig(cb);
  assert.equal(cb.ongoing.length, 1); assert.equal(cb.line.length, 2); assert.deepEqual(cb.mine.map(c => c.id), ['TR-01', 'MO-01']);
  const fr = game({ mine: ['IM-08', 'MO-01', 'MO-02', 'TR-01', 'TR-01', 'TR-01', 'TR-01'], start: { heart: 6 } }); Dig.dig(fr); assert.equal(fr.heart, 10); assert.equal(fr.mine.length, 6);
  const rw = game({ mine: ['IM-13', 'IM-22', 'TR-01'], start: { heart: 1 } }); Dig.dig(rw); Dig.dig(rw); assert.equal(rw.mine[0].id, 'IM-13'); Dig.dig(rw); assert.equal(rw.heart, 9);
  const wl = game({ mine: ['IM-13', 'IM-11', 'IM-32'] }); Dig.dig(wl); Dig.dig(wl); Dig.dig(wl); assert.equal(wl.mine.length, 2); assert.equal(wl.discard.length, 1);
  const look = card('+1 {reroll}. Look at the top 3 cards of your Mine', { type: 'Immediate', number: null });
  const ps = game({ mine: [look, 'TR-01', 'MO-01', 'TR-01'] }); Dig.dig(ps); assert.equal(ps.reroll, 1); assert.equal(ps.known, 3);
  const shoo = card('+1 {reroll}. Move the top card of your Mine to the bottom without looking', { type: 'Immediate', number: null });
  const sh = game({ mine: [shoo, 'MO-01', 'TR-01'] }); Dig.dig(sh); assert.equal(sh.reroll, 1); assert.deepEqual(sh.mine.map(c => c.id), ['TR-01', 'MO-01']);
  const slide = card('+1 {reroll}. Slide this card back into the middle of your Mine', { type: 'Immediate', number: null });
  const bo = game({ mine: [slide, 'TR-01', 'TR-01', 'TR-01', 'TR-01'] }); Dig.dig(bo); assert.equal(bo.reroll, 1); assert.equal(bo.mine.length, 5); assert.equal(bo.discard.length, 0, 'it is back in the Mine');
});

test('Salvage Yard plays the first Power or Ongoing card found; Wormhole does the first Immediate; the rest are shuffled back', () => {
  const sy = game({ mine: ['IM-24', 'TR-01', 'MO-01', 'ON-33', 'TR-01'] }); Dig.dig(sy);
  assert.equal(sy.ongoing.length, 1); assert.equal(sy.mine.length, 3); assert.deepEqual(sy.mine.map(c => c.id).sort(), ['MO-01', 'TR-01', 'TR-01']);
  const wh = game({ mine: ['IM-33', 'TR-01', 'IM-13', 'TR-01'], start: { heart: 2 } }); Dig.dig(wh); assert.equal(wh.heart, 6); assert.equal(wh.mine.length, 2);
});

test('Sneak Attack digs a card: a Monster is defeated without a roll, anything else is dug as normal', () => {
  const st = game({ mine: ['IM-28', 'MO-01'], start: { heart: 6 } }); Dig.dig(st);
  assert.equal(st.defeated, 1); assert.equal(st.survived, 1); assert.equal(st.heart, 6); assert.equal(st.fight, null);
  const g = game({ mine: ['IM-28', 'TR-01'] }); Dig.dig(g); assert.equal(g.geodeGems, 1); assert.equal(g.defeated, 0);
});

// ---------- Ongoing cards ----------
test('roll bonuses: Tune-Up, Redline (3 Health or less), Monster Scope / Giant Slayer (by the Monster\'s damage), Depth Gauge, Flywheel (up to +3)', () => {
  const d = [4];
  const tu = game({ mine: ['MO-01'], ongoing: ['ON-33'], dice: d.slice() }); Dig.dig(tu); Dig.roll(tu); assert.equal(Dig.result(tu).total, 5);
  const rl = game({ mine: ['MO-01'], ongoing: ['ON-27'], start: { heart: 3 }, dice: d.slice() }); Dig.dig(rl); Dig.roll(rl); assert.equal(Dig.result(rl).total, 6);
  const rl2 = game({ mine: ['MO-01'], ongoing: ['ON-27'], start: { heart: 4 }, dice: d.slice() }); Dig.dig(rl2); Dig.roll(rl2); assert.equal(Dig.result(rl2).total, 4);
  const ms = game({ mine: ['MO-01', 'MO-01', 'MO-01', 'MO-01'], ongoing: ['ON-20'], start: { heart: 40 }, dice: [4, 4, 4, 4] });
  const got = []; for (let i = 0; i < 4; i++) { Dig.dig(ms); Dig.roll(ms); got.push(Dig.result(ms).total); Dig.autoFace(ms); }
  assert.deepEqual(got, [4, 4, 4, 6], 'only the 7-damage fourth Monster gets +2');
  const gs = game({ mine: ['MO-01', 'MO-01', 'MO-01', 'MO-01'], ongoing: ['ON-17'], start: { heart: 40 }, dice: [4, 4, 4, 4] });
  for (let i = 0; i < 3; i++) { Dig.dig(gs); Dig.roll(gs); Dig.autoFace(gs); } Dig.dig(gs); Dig.roll(gs); assert.equal(Dig.result(gs).total, 7);
  const dg = game({ mine: ['MO-01'], ongoing: ['ON-11'], dice: [4] }); dg.survived = 6; Dig.dig(dg); Dig.roll(dg); assert.equal(Dig.result(dg).total, 6);
  const fw = game({ mine: ['MO-01'], ongoing: ['ON-15'], dice: [4] }); fw.discard = Array(5).fill(0).map(() => ({ ...by('IM-13') })); Dig.dig(fw); Dig.roll(fw); assert.equal(Dig.result(fw).total, 7);
});

test('result changes: Floor Jack (below 4 becomes 4), Backfire (you may make a 1 a 10), Wrecking Ball doubles the first Monster each Dig; in the ruled order', () => {
  const fj = game({ mine: ['MO-01'], ongoing: ['ON-14'], dice: [2] }); Dig.dig(fj); Dig.roll(fj); assert.equal(Dig.result(fj).total, 4);
  const bf = game({ mine: ['MO-01'], ongoing: ['ON-03'], dice: [1, 4], start: { reroll: 1 } }); Dig.dig(bf); Dig.roll(bf);
  assert.equal(Dig.result(bf).total, 1, 'Backfire is a choice: until you use it the result is still 1'); assert.deepEqual(Dig.mayUse(bf).map(o => o.id), ['ON-03']);
  assert.equal(Dig.can(bf).reroll, true); assert.ok(Dig.useMod(bf, Dig.mayUse(bf)[0])); assert.equal(Dig.result(bf).total, 10); assert.deepEqual(Dig.mayUse(bf), [], 'once');
  assert.equal(Dig.can(bf).reroll, true, 'an Extra Roll can still follow');
  const nb = game({ mine: ['MO-01'], ongoing: ['ON-03'], dice: [5] }); Dig.dig(nb); Dig.roll(nb); assert.deepEqual(Dig.mayUse(nb), [], 'not on any other number');
  const hurry = game({ mine: ['MO-01'], ongoing: ['ON-03'], power: ['PW-01'], start: { heart: 3 }, dice: [1] }); Dig.dig(hurry); Dig.roll(hurry); Dig.autoFace(hurry); assert.equal(hurry.heart, 3, 'a hurried player (and the AI) uses it, and the Pet then triggers on the 10');
  const wb = game({ mine: ['MO-01', 'MO-01'], ongoing: ['ON-37'], start: { heart: 12 }, dice: [3, 3] });
  Dig.dig(wb); Dig.roll(wb); assert.equal(Dig.result(wb).total, 6); Dig.autoFace(wb);
  Dig.dig(wb); Dig.roll(wb); assert.equal(Dig.result(wb).total, 3, 'only the first Monster');
  const both = game({ mine: ['MO-01'], ongoing: ['ON-37', 'ON-14'], dice: [1] }); Dig.dig(both); Dig.roll(both); assert.equal(Dig.result(both).total, 4, '1 doubled is 2, then the floor makes it 4');
});

test('the Lucky Coin is out of the game (the sheet may still list it), and the Pet triggers on a roll of 9 or more', () => {
  assert.ok(!cards.some(c => c.id === 'ON-38'), 'it is not read from the sheet'); assert.deepEqual(DDB.rules.removedCards, ['ON-38']);
  const d = Dig.start(cards, [], { seed: 3 }); assert.deepEqual(d.ongoing, [], 'nothing is in play at the start'); assert.equal(d.kit.length, 0);
  const roll = (heart, die, id = 'MO-01') => { const st = game({ mine: [id], start: { heart }, dice: [die] }); Dig.dig(st); Dig.roll(st); return st; };
  assert.equal(Dig.result(roll(1, 4)).total, 4, 'no bonus to the roll at the brink any more');
  const nine = roll(1, 9); assert.deepEqual(Dig.eligible(nine).map(e => e.pet), [true], 'a 9 reaches the Pet');
  Dig.autoFace(nine); assert.ok(!nine.over, 'the Drill Pup saved you'); assert.equal(nine.survived, 1);
  assert.deepEqual(Dig.eligible(roll(1, 8)).map(e => e.pet), [], 'an 8 does not');
});

test('Pet Whistle is gone: there is no way to move the Pet, so its text is not playable and it stays out of the game', () => {
  assert.ok(!Dig.supported(by('ON-25')));
});

test('Cowcatcher: your first Monster each Dig deals no damage; Bumper blocks 1 from every Monster', () => {
  const st = game({ mine: ['MO-01', 'MO-01'], ongoing: ['ON-08'], start: { heart: 6 }, dice: [2, 2] });
  fight(st); assert.equal(st.heart, 6); fight(st); assert.equal(st.heart, 3);
  const b = game({ mine: ['MO-01', 'MO-01'], ongoing: ['ON-05'], start: { heart: 6 }, dice: [2, 2] }); fight(b); assert.equal(b.heart, 6); fight(b); assert.equal(b.heart, 4);
});

test('Bounty Poster: Monsters you defeat are worth 2 gems (a Monster you merely survive stays at 1)', () => {
  const st = game({ mine: ['MO-01', 'MO-01'], ongoing: ['ON-04'], start: { heart: 12 }, dice: [10, 1] });
  fight(st); assert.equal(st.monsterGems, 2); fight(st); assert.equal(st.monsterGems, 3);
});

test('"Whenever you gain" cards: a watcher for Health gains (made up for the test), Nurse Bot (gain 1 more); amplified gains still cap', () => {
  const pump = card('Whenever you gain {heart}, +1 {reroll}', { type: 'Ongoing', number: null, name: 'Test Pump' });
  const ad = game({ mine: ['IM-13'], ongoing: [pump], start: { heart: 2 } }); Dig.dig(ad); assert.deepEqual([ad.heart, ad.reroll], [6, 1]);
  const nb = game({ mine: ['IM-13'], ongoing: ['ON-21'], start: { heart: 2 } }); Dig.dig(nb); assert.equal(nb.heart, 7);
  const both = game({ mine: ['IM-13'], ongoing: [pump, 'ON-21'], start: { heart: 2 } }); Dig.dig(both); assert.deepEqual([both.heart, both.reroll], [7, 1], 'Nurse Bot +1 heart, and the gain fires the watcher once');
  const cap = game({ mine: ['IM-13'], ongoing: [pump, 'ON-21'], start: { heart: 8 } }); Dig.dig(cap); assert.deepEqual([cap.heart, cap.reroll], [10, 1], 'amplified gains still cap at 10');
  const full = game({ mine: ['IM-13'], ongoing: [pump], start: { heart: 10 } }); Dig.dig(full); assert.equal(full.reroll, 0, 'no gain at a full track means no trigger');
});

test('dig watchers: Disco Ball (Immediate), a Danger Siren-style watcher (Monster with 6+ damage; made up for the test)', () => {
  const st = game({ mine: ['IM-13'], ongoing: ['ON-12'], start: { heart: 2 } }); Dig.dig(st); assert.equal(st.heart, 2 + 4 + 1);
  const siren = card('Whenever you dig a Monster with 6+ {damage}, +2 {reroll}', { type: 'Ongoing', number: null, name: 'Test Siren' });
  const ds = game({ mine: ['MO-01', 'MO-01', 'MO-01', 'MO-01'], ongoing: [siren], start: { heart: 12, reroll: 0 }, dice: [6, 6, 6, 6] });
  for (let i = 0; i < 3; i++) { Dig.dig(ds); Dig.roll(ds); Dig.autoFace(ds); } assert.equal(ds.reroll, 0); Dig.dig(ds); assert.equal(ds.reroll, 2, 'the 7 damage Monster, before you roll');
});

test('damage and defeat watchers: Patch Kit, Crumple Zone (5+), Monster Jerky, Victory Bell', () => {
  const pk = game({ mine: ['MO-01'], ongoing: ['ON-23'], start: { heart: 6 }, dice: [2] }); fight(pk); assert.equal(pk.heart, 6, '1 damage, then +1');
  const cz = game({ mine: ['MO-01', 'MO-01', 'MO-01'], ongoing: ['ON-09'], start: { heart: 12, reroll: 0 }, dice: [2, 2, 2] }); fight(cz); fight(cz); assert.equal(cz.reroll, 0); fight(cz); assert.equal(cz.reroll, 1);
  const mj = game({ mine: ['MO-01'], ongoing: ['ON-19', 'ON-35'], start: { heart: 3 }, dice: [10] });
  fight(mj); assert.deepEqual([mj.heart, mj.reroll], [3 + 3, 1], 'defeat: +3 heart (Jerky), +1 reroll (Bell)');
  const none = game({ mine: ['MO-01'], ongoing: ['ON-19', 'ON-35'], start: { heart: 6 }, dice: [2] }); fight(none);
  assert.deepEqual([none.heart, none.reroll], [5, 0], 'surviving is not defeating');
});

test('"Whenever 4+ cards trigger on one roll" (Applause Meter)', () => {
  const ap = game({ mine: ['MO-01'], power: ['PW-02', 'PW-03', 'PW-09'], ongoing: ['ON-02'], start: { heart: 6, reroll: 0 }, dice: [3] }); fight(ap); assert.equal(ap.reroll, 0, 'only 3 cards trigger at a 3 (the Pet needs 10)');
  const ap2 = game({ mine: ['MO-01'], power: ['PW-02', 'PW-03', 'PW-07', 'PW-09'], ongoing: ['ON-02'], start: { heart: 3, reroll: 0 }, dice: [4] });       // (3 Health: Nervous Mouse wants 4 or less) fight(ap2); assert.equal(ap2.reroll, 1);
});

test('"At the start of each Dig": a kit card does it when you dig it (made up for the test); the Grit Generator is no longer understood', () => {
  const gen = card('At the start of each Dig, +2 {reroll}', { type: 'Ongoing', number: null, name: 'Test Generator' });
  assert.ok(Dig.supported(gen));
  const g = Dig.start(cards, [gen], { seed: 1 }); assert.equal(g.reroll, 0, 'not in play until you dig it'); Dig.dig(g); assert.equal(g.reroll, 2, 'the Starter Kit is how a Dig starts');
  const late = game({ mine: [gen, 'TR-01'] }); Dig.dig(late); assert.equal(late.reroll, 0, 'only a Starter Kit card starts the Dig');
  assert.ok(!Dig.supported(card('At the start of each Dig, +2 {grit}', { type: 'Ongoing' })), 'a text with only Grit in it does nothing, so it is not supported');
  assert.ok(!Dig.supported(by('ON-16')));
});

test('Panic Button: the first time each Dig a roll would BOOM you, a free reroll (once); Second Spark: a result of 3 or less rerolls free', () => {
  const st = game({ mine: ['MO-02', 'MO-02', 'MO-02'], ongoing: ['ON-22'], start: { heart: 2 }, dice: [1, 6] });
  Dig.dig(st); Dig.roll(st); Dig.autoFace(st);                 // 2 damage at 2 heart: reroll to 6 (no triggers beyond Pet) -> still 2 damage... BOOM anyway
  assert.ok(st.panicUsed && /free Extra Roll/.test(text(st)));
  const saved = game({ mine: ['MO-01', 'MO-01'], power: ['PW-15'], ongoing: ['ON-22'], start: { heart: 1 }, dice: [1, 6] });
  Dig.dig(saved); Dig.roll(saved); Dig.autoFace(saved); assert.equal(saved.over, null, 'rerolled into 6: Moss Sloth heals 2 before the damage');
  const ss = game({ mine: ['MO-01'], ongoing: ['ON-29'], dice: [2, 5, 6] }); Dig.dig(ss); Dig.roll(ss); assert.equal(Dig.result(ss).total, 5, 'free reroll from 2'); 
  const once = game({ mine: ['MO-01'], ongoing: ['ON-29'], dice: [1, 2, 6] }); Dig.dig(once); Dig.roll(once); assert.equal(Dig.result(once).total, 2, 'only one free reroll');
});

test('Twin Drill keeps the higher die on a reroll; Thorned Gadget pays Health for a reroll when you have none', () => {
  const td = game({ mine: ['MO-01'], ongoing: ['ON-34'], start: { reroll: 1, heart: 12 }, dice: [5, 2] }); Dig.dig(td); Dig.roll(td); Dig.reroll(td); assert.equal(Dig.result(td).total, 5);
  const tg = game({ mine: ['MO-01'], ongoing: ['ON-31'], start: { reroll: 0, heart: 6 }, dice: [1, 4] }); Dig.dig(tg); Dig.roll(tg); assert.ok(Dig.can(tg).reroll); Dig.reroll(tg); assert.deepEqual([tg.heart, Dig.result(tg).total], [4, 4]);
  const no = game({ mine: ['MO-01'], ongoing: ['ON-31'], start: { reroll: 0, heart: 2 }, dice: [1] }); Dig.dig(no); Dig.roll(no); assert.ok(!Dig.can(no).reroll, 'it would BOOM you');
});

test('Cloning Machine makes one Power card trigger twice', () => {
  const cl = game({ mine: ['ON-06', 'MO-01'], power: ['PW-15'], start: { heart: 2 }, dice: [6] });
  Dig.dig(cl); assert.ok(cl.pending && !Dig.can(cl).dig, 'choose a Power card first');
  assert.ok(Dig.chooseClone(cl, cl.line.find(e => e.card.id === 'PW-15'))); assert.equal(cl.pending, null);
  fight(cl); assert.equal(cl.heart, 2 + 2 + 2 - 1, 'Moss Sloth triggered twice: +2 +2, then 1 damage');
});

// ---------- the whole Dig ----------
test('after the end of a Dig nothing can be done', () => {
  const st = game({ mine: ['TR-01'] }); Dig.dig(st); Dig.bank(st);
  const c = Dig.can(st); assert.ok(!Object.values(c).some(Boolean));
  assert.ok(!Dig.dig(st) && !Dig.bank(st) && !Dig.roll(st) && !Dig.autoFace(st));
});

test('random play never breaks the rules: tracks stay inside their caps, no NaN, every Dig ends, and the log never says undefined', () => {
  const caps = DDB.rules.caps;
  for (let seed = 1; seed <= 300; seed++) {
    const kit = []; const rr = Dig.makeRng(seed * 7);
    const boosters = playable();
    for (let i = 0; i < 1 + (seed % 3); i++) kit.push(boosters[Math.floor(rr() * boosters.length)]);
    const st = Dig.start(cards, kit, { seed }); let steps = 0;
    while (!st.over && steps++ < 400) {
      const c = Dig.can(st), acts = Object.keys(c).filter(k => c[k]);
      if (!acts.length) break;
      const pick = rr();
      if (c.choose) { const e = st.line[Math.floor(rr() * st.line.length)]; Dig.chooseClone(st, e); }
      else if (st.fight && st.fight.phase === 'before') Dig.roll(st);
      else if (st.fight) { if (c.reroll && rr() < 0.4) Dig.reroll(st); else Dig.autoFace(st); }
      else if (c.bank && pick < 0.04) Dig.bank(st); else Dig.dig(st);
      for (const k of ['heart', 'reroll']) assert.ok(Number.isInteger(st[k]) && st[k] >= 0 && st[k] <= caps[k], `seed ${seed}: ${k}=${st[k]}`);
      assert.ok(st.line.every(e => Number.isInteger(e.at) && e.at >= 1 && e.at <= 10), `seed ${seed}: line ${JSON.stringify(st.line.map(e => e.at))}`);
    }
    assert.ok(st.over, `seed ${seed}: did not end in ${steps} steps`);
    assert.ok(!st.log.some(l => /undefined|NaN/.test(l.text)), `seed ${seed}: ` + st.log.find(l => /undefined|NaN/.test(l.text)));
    assert.ok(st.survived >= 0 && st.geodeGems >= 0);
  }
});

// ---------- found by an audit of the engine against every card text ----------
const put = (id, uid = 70000 + n++) => ({ ...by(id), uid });
test('audit: Magpie copying Sneak Attack mid-fight defeats the extra Monster and still lets you face the first one', () => {
  const st = game({ mine: ['MO-01', 'MO-02'], power: ['PW-22'], start: { heart: 6 }, dice: [8] });
  st.discard.push(put('IM-28'));
  Dig.dig(st); Dig.roll(st); Dig.autoFace(st);
  assert.equal(st.over, null); assert.equal(st.fight, null);
  assert.equal(st.survived, 2, 'both Monsters survived'); assert.equal(st.defeated, 1, 'only the Sneak Attack one was defeated');
  assert.equal(st.heart, 5, 'the first Monster still dealt its 1 damage');
});
test('audit: Cave Scout digging a card that slides back into the Mine (or Echo and Rewind Tape bouncing) cannot loop forever', () => {
  const slide = card('+1 {reroll}. Slide this card back into the middle of your Mine', { type: 'Immediate', number: null, name: 'Test Boomerang' });
  const a = game({ mine: ['IM-03', slide, 'TR-01', 'MO-01'] }); Dig.dig(a); assert.ok(!a.over);
  const b = game({ mine: ['IM-03', 'IM-06', 'MO-01'] }); b.discard.push(put('IM-22')); Dig.dig(b); assert.ok(!b.over);
});
test('audit: Backfire (used) turns a 1 into a 10; Twin Drill keeps the higher result only when an Extra Roll (not Health) paid for it', () => {
  const st = game({ mine: ['MO-01'], ongoing: ['ON-34', 'ON-03'], start: { reroll: 1 }, dice: [1, 5] });
  Dig.dig(st); Dig.roll(st); Dig.useMod(st, Dig.mayUse(st)[0]); assert.equal(Dig.result(st).total, 10); assert.equal(Dig.can(st).reroll, true, 'an Extra Roll can still follow Backfire');
  const tw = game({ mine: ['MO-01'], ongoing: ['ON-34'], start: { reroll: 1 }, dice: [6, 2] }); Dig.dig(tw); Dig.roll(tw); Dig.reroll(tw); assert.equal(Dig.result(tw).total, 6, 'Twin Drill keeps the higher result');
  const nt = game({ mine: ['MO-01'], start: { reroll: 1 }, dice: [6, 2] }); Dig.dig(nt); Dig.roll(nt); Dig.reroll(nt); assert.equal(Dig.result(nt).total, 2, 'without it the Extra Roll replaces your result');
  const th = game({ mine: ['MO-01'], ongoing: ['ON-34', 'ON-31'], start: { reroll: 0, heart: 8 }, dice: [6, 2] });
  Dig.dig(th); Dig.roll(th); Dig.reroll(th); assert.equal(Dig.result(th).total, 2, 'Twin Drill only applies when you spend an Extra Roll, not when you pay Health');
});
test('audit: damage watchers see the damage actually taken (Lucky Cricket saves you, so Patch Kit and Crumple Zone do not fire for what was saved)', () => {
  const st = game({ mine: ['MO-01'], power: ['PW-14'], ongoing: ['ON-23'], start: { heart: 1 }, dice: [6] });
  Dig.dig(st); Dig.roll(st); Dig.autoFace(st);
  assert.equal(st.heart, 1, 'nothing was taken, so no Patch Kit');
  const big = game({ mine: ['MO-01', 'MO-01', 'MO-01', 'MO-01'], power: ['PW-14'], ongoing: ['ON-09'], start: { heart: 12, reroll: 0 }, dice: [6, 6, 6, 6] });
  for (let i = 0; i < 3; i++) { Dig.dig(big); Dig.roll(big); Dig.autoFace(big); } big.heart = 3; big.reroll = 0;
  Dig.dig(big); Dig.roll(big); Dig.autoFace(big);                        // 7 damage at 3 Health: Lucky Cricket takes it down to 2 damage
  assert.equal(big.heart, 1); assert.equal(big.reroll, 0, 'only 2 was taken: Crumple Zone needs 5+');
});
test('audit: a cloned card is not "another card" for itself ("for each other card that triggers", Unlucky Duck)', () => {
  const crabCard = card('+1 {reroll} for each other card that triggers', { number: 5, name: 'Test Crab' });
  const crab = game({ mine: ['MO-01'], power: [crabCard], start: { heart: 6, reroll: 0 }, dice: [6] }); crab.line.find(e => e.card.id === crabCard.id).cloned = true; Dig.dig(crab); Dig.roll(crab); Dig.autoFace(crab);
  assert.equal(crab.reroll, 0);
  const duck = game({ mine: ['MO-01'], power: ['PW-05'], start: { heart: 6, reroll: 0 }, dice: [3] }); duck.line.find(e => e.card.id === 'PW-05').cloned = true; Dig.dig(duck); Dig.roll(duck); Dig.autoFace(duck);
  assert.equal(duck.reroll, 2, 'it triggers twice and nothing else triggers');
});
test('audit: a Monster dug by Sneak Attack still counts as a Monster dug (a Danger Siren-style watcher); Wormhole revealing an Immediate card is not a second dig (Disco Ball)', () => {
  const siren = card('Whenever you dig a Monster with 6+ {damage}, +2 {reroll}', { type: 'Ongoing', number: null, name: 'Test Siren' });
  const st = game({ mine: ['IM-28', 'MO-01', 'MO-01', 'MO-01', 'MO-01'], ongoing: [siren], start: { reroll: 0, heart: 12 } });
  st.setCount['MO-01'] = 3; Dig.dig(st); assert.equal(st.reroll, 2, 'the 7-damage Monster was dug, so +2 Rerolls');
  const w = game({ mine: ['IM-33', 'TR-01', 'IM-13'], ongoing: ['ON-12'], start: { heart: 2 } }); Dig.dig(w);
  assert.equal(w.heart, 2 + 4 + 1, 'Med Kit +4, and Disco Ball +1 once for the one card you dug');
});

test('dense random play (8-14 kit cards, a stocked discard, a tiny Mine full of chain Immediates) never hangs, crashes or breaks a track', () => {
  const caps = DDB.rules.caps, boosters = playable(), imm = boosters.filter(c => c.type === 'Immediate');
  for (let seed = 1; seed <= 250; seed++) {
    const rr = Dig.makeRng(seed * 31), pick = list => list[Math.floor(rr() * list.length)];
    const kit = Array.from({ length: 8 + (seed % 7) }, () => pick(boosters));
    const st = Dig.start(cards, kit, { seed });
    if (seed % 2) { st.mine = Array.from({ length: 6 + (seed % 5) }, () => ({ ...pick([...imm, by('MO-01'), by('TR-01'), by('MO-02')]), uid: 95000 + n++ })); st.discard = Array.from({ length: 3 }, () => ({ ...pick(imm), uid: 96000 + n++ })); }
    st.known = 0; let steps = 0;
    while (!st.over && steps++ < 500) {
      const c = Dig.can(st);
      if (c.choose) { Dig.chooseClone(st, st.line[Math.floor(rr() * st.line.length)]); continue; }
      if (st.fight && st.fight.phase === 'before') Dig.roll(st);
      else if (st.fight) { if (c.reroll && rr() < .4) Dig.reroll(st); else Dig.autoFace(st); }
      else if (c.bank && rr() < .03) Dig.bank(st); else if (c.dig) Dig.dig(st); else assert.fail(`seed ${seed}: no move`);
      for (const k of ['heart', 'reroll']) assert.ok(Number.isInteger(st[k]) && st[k] >= 0 && st[k] <= caps[k], `seed ${seed}: ${k}=${st[k]}`);
      assert.ok(st.line.every(e => e.at >= 1 && e.at <= 10));
    }
    assert.ok(st.over, `seed ${seed}: did not end`);
    assert.ok(!st.log.some(l => /undefined|NaN/.test(l.text)), `seed ${seed}`);
  }
});

// ---------- the player chooses which eligible Power cards to trigger, and in what order (owner) ----------
const entryOf = (st, id) => st.line.find(e => e.card.id === id);
test('triggers are your choice: only cards at or below the result are eligible; one you do not trigger does nothing; a card triggers once', () => {
  const st = game({ mine: ['MO-01'], power: ['PW-02', 'PW-15', 'PW-09'], start: { heart: 6 }, dice: [3] });
  Dig.dig(st); Dig.roll(st);                                      // result 3: Newt (1) and Pill Bug (3) are eligible; Sloth (6) is not
  assert.deepEqual(Dig.eligible(st).map(e => e.card.id), ['PW-09', 'PW-02'], 'highest number first');
  assert.ok(!Dig.trigger(st, entryOf(st, 'PW-15')), 'above the result');
  assert.ok(Dig.trigger(st, entryOf(st, 'PW-02'))); assert.equal(st.heart, 7);
  assert.ok(!Dig.trigger(st, entryOf(st, 'PW-02')), 'only once');
  Dig.face(st);                                                   // the Pill Bug was never triggered: no Block; then 1 damage
  assert.equal(st.heart, 6);
});
test('skipping every trigger is allowed — you just take the damage', () => {
  const st = game({ mine: ['MO-01'], power: ['PW-02'], start: { heart: 6 }, dice: [5] });
  Dig.dig(st); Dig.roll(st); assert.ok(Dig.can(st).trigger); Dig.face(st);
  assert.equal(st.heart, 5); assert.equal(st.survived, 1);
});
test('Extra Rolls can be spent at any time in a battle, even after cards have fired: the new roll replaces your result, used cards stay used, and the new result may reach different cards', () => {
  const st = game({ mine: ['MO-01'], power: ['PW-02', 'PW-17'], start: { heart: 6, reroll: 2 }, dice: [3, 7, 2] });
  Dig.dig(st); Dig.roll(st); assert.deepEqual(Dig.eligible(st).map(e => e.card.id), ['PW-02']);        // 3: Newt (1) is upright and at or below the die; Dodo (7) is out of reach
  Dig.trigger(st, entryOf(st, 'PW-02')); assert.ok(Dig.can(st).reroll, 'still allowed after a card fired');
  Dig.reroll(st); assert.equal(Dig.result(st).total, 7, 'a 7: the die slides up'); assert.deepEqual(Dig.eligible(st).map(e => e.card.id), ['PW-17'], 'Newt is used; Dodo is now reached');
  Dig.reroll(st); assert.equal(Dig.result(st).total, 2, 'a 2 replaces it: the result can go down too'); assert.equal(st.reroll, 0); assert.deepEqual(Dig.eligible(st), [], 'nothing new is reached');
});test('"For each other card that triggers" and Unlucky Duck count the other cards you chose, once you have chosen', () => {
  const crabCard = card('+1 {reroll} for each other card that triggers', { number: 5, name: 'Test Crab' });
  const crab = game({ mine: ['MO-01', 'MO-01'], power: [crabCard, 'PW-02', 'PW-09'], start: { heart: 6, reroll: 0 }, dice: [6, 6] });
  Dig.dig(crab); Dig.roll(crab);
  Dig.trigger(crab, entryOf(crab, crabCard.id)); Dig.trigger(crab, entryOf(crab, 'PW-02'));
  assert.equal(crab.reroll, 0, 'the Crab waits while another card could still trigger'); Dig.trigger(crab, entryOf(crab, 'PW-09')); assert.equal(crab.reroll, 2, 'once every card has been chosen the Crab counted the 2 others, at once');
  const alone = game({ mine: ['MO-01'], power: [crabCard, 'PW-02'], start: { heart: 6, reroll: 0 }, dice: [6] });
  Dig.dig(alone); Dig.roll(alone); Dig.trigger(alone, entryOf(alone, crabCard.id)); Dig.face(alone); assert.equal(alone.reroll, 0, 'chosen alone: no others');
  const duck = game({ mine: ['MO-01', 'MO-01'], power: ['PW-05', 'PW-02'], start: { heart: 6, reroll: 0 }, dice: [6, 6] });
  Dig.dig(duck); Dig.roll(duck); Dig.trigger(duck, entryOf(duck, 'PW-05')); Dig.face(duck); assert.equal(duck.reroll, 1, 'chosen alone: +1');
  Dig.dig(duck); Dig.roll(duck); Dig.trigger(duck, entryOf(duck, 'PW-05')); Dig.trigger(duck, entryOf(duck, 'PW-02')); Dig.face(duck); assert.equal(duck.reroll, 1, 'with another card: nothing');
});
test('Applause Meter fires when the fourth different card triggers', () => {
  const st = game({ mine: ['MO-01'], power: ['PW-02', 'PW-03', 'PW-09', 'PW-07'], ongoing: ['ON-02'], start: { heart: 1, reroll: 0 }, dice: [4] });          // (Nervous Mouse wants 4 Health or less when it triggers: 1 + 1 + 2)
  Dig.dig(st); Dig.roll(st);
  for (const id of ['PW-02', 'PW-03', 'PW-09']) Dig.trigger(st, entryOf(st, id)); assert.equal(st.reroll, 0);
  Dig.trigger(st, entryOf(st, 'PW-07')); assert.equal(st.reroll, 2, 'Nervous Mouse gives its own Reroll (at 4 Health or less), and the fourth card gives the Applause Meter\'s');
});
test('triggerAll (what the AI and a hurried player use) is highest number first; the Pet defeats the Monster only if you trigger it', () => {
  const st = game({ mine: ['MO-01', 'MO-01'], power: ['PW-02'], start: { heart: 6 }, dice: [10, 10] });
  Dig.dig(st); Dig.roll(st);                                // 10: the Pet is eligible
  assert.ok(Dig.eligible(st).some(e => e.pet)); Dig.face(st);
  assert.equal(st.defeated, 0, 'you did not trigger the Pet'); assert.equal(st.heart, 5);
  Dig.dig(st); Dig.roll(st); Dig.triggerAll(st);
  assert.ok(st.fight.defeat); Dig.face(st); assert.equal(st.defeated, 1); assert.equal(st.fight, null, 'everything was triggered, then you continued'); assert.equal(st.heart, 5 + 1, 'Newt went too, and the second Monster dealt no damage');
});
test('Panic Button: the free Extra Roll keeps tapped cards tapped, and a better roll lets more upright cards fire before the damage', () => {
  const st = game({ mine: ['MO-01'], power: ['PW-15', 'PW-17'], ongoing: ['ON-22'], start: { heart: 1 }, dice: [6, 8] });
  Dig.dig(st); Dig.roll(st); Dig.trigger(st, entryOf(st, 'PW-15'));            // 6: Moss Sloth +2 heart (3)
  st.heart = 1;                                                               // ...make the 1 damage a BOOM
  Dig.face(st);
  assert.ok(st.fight, 'still facing the Monster'); assert.ok(st.panicUsed); assert.equal(st.fight.trig.length, 1, 'Moss Sloth stays tapped'); assert.equal(Dig.result(st).total, 8);
  assert.deepEqual(Dig.eligible(st).map(e => e.card.id), ['PW-17'], 'the better roll reached Do-Over Dodo');
});test('a Dig saved in the middle of choosing triggers resumes with the same choices made', () => {
  const st = game({ mine: ['MO-01'], power: ['PW-02', 'PW-09'], start: { heart: 6 }, dice: [6] });
  Dig.dig(st); Dig.roll(st); Dig.trigger(st, entryOf(st, 'PW-09'));
  const back = Dig.load(cards, JSON.parse(JSON.stringify(Dig.save(st))));
  assert.deepEqual(Dig.eligible(back).map(e => e.card.id), ['PW-02']); assert.equal(back.fight.trig.length, 1);
  Dig.trigger(back, entryOf(back, 'PW-02')); Dig.face(back); assert.equal(back.heart, 6 + 1, 'Newt +1; the saved Block stopped the 1 damage');
});

test('randomness: without a seed dice and shuffles come from the secure random source (unbiased, never the same twice); a seed still replays a Dig', () => {
  const a = Dig.start(cards, [], {}), b = Dig.start(cards, [], {});
  assert.equal(a.seed, null, 'no seed: nothing to replay or predict'); assert.notDeepEqual(a.mine.map(c => c.id + c.uid), b.mine.map(c => c.id + c.uid), 'two fresh Digs are shuffled differently');
  const rng = Dig.makeRng(), counts = Array(10).fill(0); for (let i = 0; i < 30000; i++) counts[rng.int(10)]++;
  for (const c of counts) assert.ok(c > 2600 && c < 3400, 'a fair d10: ' + counts);
  const first = Array(25).fill(0); for (let i = 0; i < 5000; i++) { const arr = Dig.shuffle({ rng }, Array.from({ length: 25 }, (_, k) => k)); first[arr[0]]++; }
  for (const c of first) assert.ok(c > 120 && c < 290, 'every card is equally likely on top: ' + first);
  assert.deepEqual(Dig.start(cards, [], { seed: 7 }).mine.map(c => c.id), Dig.start(cards, [], { seed: 7 }).mine.map(c => c.id), 'a seed replays');
  const real = Dig.start(cards, [], {}); const d = []; for (let i = 0; i < 200; i++) { const st = game({ mine: ['MO-01'] }); st.dice = null; st.rng = Dig.makeRng(); Dig.dig(st); Dig.roll(st); d.push(st.fight.die); }
  assert.ok(d.every(x => x >= 1 && x <= 10) && new Set(d).size === 10, 'rolls cover 1 to 10');
});

test('Monster pile: a Monster you are done with — defeated, or after its damage, or the one that BOOMs you — goes to the pile, so you can count each set', () => {
  const st = game({ mine: ['MO-01', 'MO-01', 'MO-02', 'MO-01'], start: { heart: 20 }, dice: [10, 5, 5, 1] });
  Dig.dig(st); Dig.roll(st); assert.deepEqual(Dig.eligible(st).map(e => e.pet), [true]);
  Dig.trigger(st, Dig.eligible(st)[0]); Dig.face(st);
  assert.equal(st.fight, null); assert.equal(st.survived, 1); assert.equal(st.defeated, 1); assert.deepEqual(st.monsterPile.map(c => c.id), ['MO-01']);
  Dig.dig(st); Dig.roll(st); Dig.autoFace(st); Dig.dig(st); Dig.roll(st); Dig.autoFace(st);
  assert.deepEqual(st.monsterPile.map(c => c.id), ['MO-01', 'MO-01', 'MO-02'], 'by order met; the pile is not the discard'); assert.ok(!st.discard.some(c => c.type === 'Monster'));
  st.heart = 1; Dig.dig(st); Dig.roll(st); Dig.autoFace(st);
  assert.equal(st.over.kind, 'boom'); assert.equal(st.monsterPile.length, 4, 'even the one that BOOMed you');
  const back = Dig.load(cards, JSON.parse(JSON.stringify(Dig.save(st)))); assert.equal(back.monsterPile.length, 4);
});

test('"Trigger all" still lets the other cards go before a defeating Pet ends the fight; tapping the Pet first ends it at once', () => {
  const st = game({ mine: ['MO-01'], power: ['PW-02', 'PW-28'], start: { heart: 3 }, dice: [10] });
  Dig.dig(st); Dig.roll(st); Dig.triggerAll(st); Dig.face(st);
  assert.equal(st.fight, null); assert.equal(st.heart, 3 + 1 + 5, 'Nurse Newt and Carrot Bunny both went, then the Pet');
  const tap = game({ mine: ['MO-01'], power: ['PW-02', 'PW-28'], start: { heart: 3 }, dice: [10] });
  Dig.dig(tap); Dig.roll(tap); Dig.trigger(tap, tap.line.find(e => e.pet));
  assert.ok(tap.fight.defeat, 'the Pet defeated it, and the fight waits for you'); Dig.trigger(tap, entryOf(tap, 'PW-02')); assert.equal(tap.heart, 3 + 1, 'you can still use another card after the defeat'); Dig.face(tap); assert.equal(tap.fight, null);
});


// ---------- Burnout cards: the only cards that move — up, right after they trigger ----------
test('Burnout: a Power card "..., then move this card up N (max M)" is understood, and a card without a max, or moving down, is not', () => {
  const b = burnCard(2);
  assert.ok(Dig.supported(b)); const eff = Dig.compile(b).effects;
  assert.equal(eff.length, 1); assert.equal(eff[0].op, 'seq'); assert.deepEqual(eff[0].list.map(e => e.op), ['list', 'burnout']); assert.deepEqual([eff[0].list[1].n, eff[0].list[1].max], [2, 10]);
  assert.ok(Dig.supported(burnCard(2, 3, 10, 'Block 1 {damage}')), 'any supported effect can burn');
  assert.ok(Dig.supported(burnCard(2, 2, 10, '+1 {reroll}')));
  assert.ok(!Dig.supported(card('+1 {heart}, then move this card up 2', { number: 2 })), 'no (max N): not understood');
  assert.ok(!Dig.supported(card('+1 {heart}, then move this card down 2', { number: 2 })), 'nothing moves down');
  assert.ok(!Dig.supported(card('+1 {grit}, then move this card up 2 (max 10)', { number: 2 })), 'the effect itself must be understood (Grit is cut)');
  assert.ok(!Dig.supported(by('PW-25')), 'Snowball Beetle (down) is unsupported'); assert.ok(!Dig.supported(by('IM-34')), 'Wrench Rat (moves a card down) is unsupported');
  assert.equal(Dig.compile(burnCard(9, 3, 15)).effects[0].list[1].max, 10, 'a max above the line is the top of the line');
});

test('Burnout: it triggers at its number, moves up N right after it triggers, and triggers again on a later Monster at its new, higher number', () => {
  const b = burnCard(2, 2, 10, '+1 {reroll}');
  const st = game({ mine: ['MO-01', 'MO-01', 'MO-01', 'MO-01'], power: [b], start: { heart: 20 }, dice: [2, 3, 4, 7] });
  const at = () => entryOf(st, b.id).at;
  Dig.dig(st); Dig.roll(st); assert.deepEqual(Dig.eligible(st).map(e => e.card.id), [b.id], 'at a 2 it is eligible');
  Dig.trigger(st, entryOf(st, b.id)); assert.equal(st.reroll, 1, 'its effect: +1 Reroll'); assert.equal(at(), 4, 'then it burns up to 4');
  assert.ok(/burns up to 4/.test(text(st)), 'the log says so'); Dig.face(st);
  Dig.dig(st); Dig.roll(st); assert.deepEqual(Dig.eligible(st), [], 'a 3 no longer reaches it (it is at 4)'); Dig.face(st); assert.equal(at(), 4, 'it did not trigger, so it did not move'); assert.equal(st.reroll, 1);
  Dig.dig(st); Dig.roll(st); assert.deepEqual(Dig.eligible(st).map(e => e.card.id), [b.id], 'a 4 reaches it again');
  Dig.trigger(st, entryOf(st, b.id)); assert.equal(st.reroll, 2); assert.equal(at(), 6); Dig.face(st);
  Dig.dig(st); Dig.roll(st); Dig.autoFace(st); assert.equal(at(), 8, 'a 7 reaches it at 6'); assert.equal(st.reroll, 3);
});

test('Burnout: climbing step by step — each trigger moves it up, it fades as it climbs, and it stops at 10 (then it only fires on a 10)', () => {
  const b = burnCard(2, 3, 10, '+1 {reroll}');
  const st = game({ mine: Array(6).fill('MO-01'), power: [b], start: { heart: 40 }, dice: [2, 4, 5, 6, 7, 10] });
  const at = () => entryOf(st, b.id).at, seen = [];
  for (let i = 0; i < 6; i++) {
    Dig.dig(st); Dig.roll(st); const el = Dig.eligible(st).find(e => e.card === entryOf(st, b.id).card);
    if (el) Dig.trigger(st, el); seen.push([i, !!el, at()]); Dig.face(st);
  }
  // 2 -> (triggers at 2) 5 -> (4 no) -> (5 yes) 8 -> (6 no) -> (7 no) -> (10 yes) 10 (max) stays
  assert.deepEqual(seen, [[0, true, 5], [1, false, 5], [2, true, 8], [3, false, 8], [4, false, 8], [5, true, 10]]);
  assert.ok(/at its top|burns up to 10/.test(text(st)));
});

test('Burnout: it never goes past 10 — a card at 9 moving up 2 goes to 10 and stays at 10 when it triggers again', () => {
  const b = burnCard(9, 2);
  const st = game({ mine: ['MO-01', 'MO-01'], power: [b], start: { heart: 3 }, dice: [9, 10] });
  Dig.dig(st); Dig.roll(st); Dig.trigger(st, entryOf(st, b.id)); assert.equal(entryOf(st, b.id).at, 10); Dig.face(st);
  Dig.dig(st); Dig.roll(st); Dig.trigger(st, entryOf(st, b.id)); assert.equal(entryOf(st, b.id).at, 10, 'still 10'); assert.ok(/at its top/.test(text(st)));
  assert.ok(st.line.every(e => e.at <= 10));
  const low = burnCard(4, 2, 6); const s2 = game({ mine: ['MO-01', 'MO-01'], power: [low], start: { heart: 3 }, dice: [4, 6] });
  Dig.dig(s2); Dig.roll(s2); Dig.trigger(s2, entryOf(s2, low.id)); Dig.face(s2); assert.equal(entryOf(s2, low.id).at, 6, 'a lower max stops it there');
  Dig.dig(s2); Dig.roll(s2); Dig.trigger(s2, entryOf(s2, low.id)); assert.equal(entryOf(s2, low.id).at, 6, '(max 6) holds');
});

test('Burnout: a card you do not trigger does not move, and no other card ever moves it (nor does it move the Pet or other cards)', () => {
  const b = burnCard(2), other = card('+1 {heart}', { number: 1, name: 'Other' });
  const st = game({ mine: ['MO-01', 'MO-01'], power: [b, other], start: { heart: 6 }, dice: [6, 1] });
  Dig.dig(st); Dig.roll(st); Dig.trigger(st, entryOf(st, other.id)); Dig.face(st);        // eligible but you chose not to trigger it
  assert.equal(entryOf(st, b.id).at, 2); assert.equal(entryOf(st, other.id).at, 1);
  Dig.dig(st); Dig.roll(st);                                                              // a 1: below it
  assert.deepEqual(Dig.eligible(st).map(e => e.card.id), [other.id]); Dig.face(st);
  assert.equal(entryOf(st, b.id).at, 2); assert.equal(st.line.find(e => e.pet).at, 9);
  const t = game({ mine: ['MO-01'], power: [b, other], start: { heart: 6 }, dice: [6] }); Dig.dig(t); Dig.roll(t); Dig.autoFace(t);
  assert.equal(entryOf(t, b.id).at, 4); assert.equal(entryOf(t, other.id).at, 1, 'only the Burnout card moved');
});

test('Burnout: each new Dig starts every card at its printed number (the card itself is never changed)', () => {
  const b = burnCard(2, 4);
  const one = Dig.start(cards, [b], { seed: 1, dice: [5] }); one.mine = [one.mine[0], { ...by('MO-01'), uid: 77001 }];
  Dig.dig(one); assert.equal(one.line.find(e => e.card.id === b.id).at, 2, 'it comes onto the line at its number');
  Dig.dig(one); Dig.roll(one); Dig.autoFace(one); assert.equal(one.line.find(e => e.card.id === b.id).at, 6);
  assert.equal(b.number, 2, 'the card still says 2');
  const two = Dig.start(cards, [b], { seed: 2 }); Dig.dig(two);
  assert.equal(two.line.find(e => e.card.id === b.id).at, 2, 'a new Dig: back at its printed number'); assert.equal(two.line.find(e => e.card.id === b.id).base, 2);
  const back = Dig.load(cards.concat([b]), JSON.parse(JSON.stringify(Dig.save(one))));
  assert.equal(back.line.find(e => e.card.id === b.id).at, 6, 'a saved Dig keeps where it has burned up to');
});

test('Burnout with Cloning Machine: it triggers twice and moves up after each trigger', () => {
  const b = burnCard(2, 2, 10, '+2 {heart}');
  const st = game({ mine: ['MO-01'], power: [b], start: { heart: 2 }, dice: [6] }); entryOf(st, b.id).cloned = true;
  Dig.dig(st); Dig.roll(st); const e = entryOf(st, b.id);
  assert.ok(Dig.trigger(st, e)); assert.equal(e.at, 4, 'after the first trigger');
  assert.ok(Dig.trigger(st, e), 'it can trigger a second time at 4 (the result is 6)'); assert.equal(e.at, 6, 'after the second');
  assert.equal(st.heart, 2 + 2 + 2); assert.ok(!Dig.trigger(st, e), 'only twice');
});

test('Burnout cards in other effects: Block and a burnout reroll card go up too', () => {
  const blk = burnCard(1, 3, 10, 'Block 1 {damage}');
  const st = game({ mine: ['MO-01'], power: [blk], start: { heart: 6 }, dice: [2] }); Dig.dig(st); Dig.roll(st); Dig.autoFace(st);
  assert.equal(st.heart, 6, 'blocked'); assert.equal(entryOf(st, blk.id).at, 4);
});

// ---------- Grit is cut; defeat is immediate ----------
test('Grit is cut: the effects of a Grit card are not played, and nothing in a Dig has Grit', () => {
  const g = game({ mine: ['IM-10', 'MO-01'], start: { heart: 6 }, dice: [2] });
  assert.ok(!Dig.supported(by('IM-10')), 'Iron Vein (+4 Grit) is not understood');
  for (let i = 0; i < 2; i++) { assert.ok(Dig.dig(g)); if (g.fight) { Dig.roll(g); Dig.autoFace(g); } }
  assert.ok(!('grit' in g)); assert.ok(!g.over);
  assert.equal(Dig.compile(by('PW-02')).unsupported.length, 0);
});

test('Defeating a Monster does not end the fight: you may still use other cards (heal, say), then continue', () => {
  const st = game({ mine: ['MO-01', 'MO-02'], power: ['PW-02'], start: { heart: 6 }, dice: [10, 10] });
  Dig.dig(st); Dig.roll(st);
  assert.ok(Dig.trigger(st, st.line.find(e => e.pet)), 'tap the Pet');
  assert.ok(st.fight && st.fight.defeat && Dig.can(st).face && !Dig.can(st).dig, 'defeated, but the fight is still open: continue with face');
  assert.ok(Dig.eligible(st).length > 0, 'Nurse Newt can still be used'); assert.ok(Dig.trigger(st, entryOf(st, 'PW-02'))); assert.equal(st.heart, 7);
  assert.ok(Dig.face(st)); assert.equal(st.fight, null); assert.equal(st.survived, 1); assert.equal(st.defeated, 1); assert.deepEqual(st.monsterPile.map(c => c.id), ['MO-01']); assert.equal(st.heart, 7, 'no damage');
  Dig.dig(st); Dig.roll(st); Dig.triggerAll(st); assert.ok(st.fight.defeat); Dig.face(st);
  assert.equal(st.fight, null); assert.equal(st.defeated, 2); assert.equal(st.heart, 8, 'Newt went too'); assert.deepEqual(st.monsterPile.map(c => c.id), ['MO-01', 'MO-02']);
  assert.ok(!st.discard.some(c => c.type === 'Monster'), 'Monsters go to the pile, not the discard');
});

test('Cloning Machine can go under an Ongoing card too: it does everything twice (rolls, "whenever" reactions, Block); and it lies under the card', () => {
  // Tune-Up: +1 to your rolls -> +2
  const tu = game({ mine: ['ON-06', 'MO-01'], ongoing: ['ON-33'], start: { heart: 10 }, dice: [4] });
  Dig.dig(tu); assert.ok(tu.pending); assert.deepEqual(Dig.cloneTargets(tu).filter(t => t.id === 'ON-33').length, 1, 'an Ongoing card is a target');
  assert.ok(!Dig.cloneTargets(tu).includes(tu.pending.card), 'but not the Machine itself');
  const tune = tu.ongoing.find(o => o.id === 'ON-33'); assert.ok(Dig.chooseClone(tu, tune)); assert.equal(tu.pending, null);
  assert.deepEqual(tu.under[tune.uid].map(c => c.id), ['ON-06'], 'the Machine lies under it');
  Dig.dig(tu); Dig.roll(tu); assert.equal(Dig.result(tu).total, 4 + 2, 'Tune-Up is +2 now');
  // Bumper: Block 1 from every Monster -> 2
  const bu = game({ mine: ['ON-06', 'MO-02'], ongoing: ['ON-05'], start: { heart: 10 }, dice: [1] });
  Dig.dig(bu); Dig.chooseClone(bu, bu.ongoing.find(o => o.id === 'ON-05')); Dig.dig(bu); Dig.roll(bu); assert.equal(Dig.previewDamage(bu), 2 - 2, 'Block 2 against a 2');
  // Patch Kit: whenever you take damage +1 heart -> +2
  const pk = game({ mine: ['ON-06', 'MO-02'], ongoing: ['ON-23'], start: { heart: 6 }, dice: [1] });
  Dig.dig(pk); Dig.chooseClone(pk, pk.ongoing.find(o => o.id === 'ON-23')); Dig.dig(pk); Dig.roll(pk); Dig.autoFace(pk); assert.equal(pk.heart, 6 - 2 + 2, 'took 2, healed 2 (twice)');
  // it survives a save and a copy
  const back = Dig.load(cards, JSON.parse(JSON.stringify(Dig.save(pk)))); assert.deepEqual(back.cloned, pk.cloned); assert.deepEqual(Object.keys(back.under), Object.keys(pk.under));
  assert.deepEqual(Dig.clone(pk, 1).cloned, pk.cloned);
});

test('tapping a cloned Power card triggers it twice at once', () => {
  const st = game({ mine: ['MO-01'], power: ['PW-15'], start: { heart: 2, reroll: 0 }, dice: [6] }); st.line.find(e => e.card.id === 'PW-15').cloned = true;
  Dig.dig(st); Dig.roll(st); const e = st.line.find(x => x.card.id === 'PW-15');
  assert.ok(Dig.triggerFully(st, e)); assert.equal(st.fight.trig.filter(x => x === e).length, 2, 'both triggers happened on one tap'); assert.equal(st.heart, 2 + 2 + 2);
  assert.ok(!Dig.eligible(st).includes(e), 'nothing left of it this roll');
});

test('a Power card is only offered when its requirements are met as well as the roll: Nervous Mouse does nothing above 4 Health', () => {
  const rich = game({ mine: ['MO-01'], power: ['PW-07'], start: { heart: 7, reroll: 0 }, dice: [9] });
  Dig.dig(rich); Dig.roll(rich); assert.ok(!Dig.eligible(rich).some(e => e.card.id === 'PW-07'), 'the roll reaches it (2), but at 7 Health it would do nothing');
  assert.equal(Dig.unmetFor(rich, rich.line.find(e => e.card.id === 'PW-07')), 4, 'it wants 4 Health or less');
  assert.ok(!Dig.trigger(rich, rich.line.find(e => e.card.id === 'PW-07')), 'it cannot be used');
  const poor = game({ mine: ['MO-01'], power: ['PW-07'], start: { heart: 4, reroll: 0 }, dice: [9] });
  Dig.dig(poor); Dig.roll(poor); assert.ok(Dig.eligible(poor).some(e => e.card.id === 'PW-07'), 'at 4 Health it is offered'); assert.ok(Dig.trigger(poor, poor.line.find(e => e.card.id === 'PW-07'))); assert.equal(poor.reroll, 1);
  // Jolt Eel: 3 Health or less
  const eel = game({ mine: ['MO-01'], power: ['PW-19'], start: { heart: 9 }, dice: [9] }); Dig.dig(eel); Dig.roll(eel); assert.ok(!Dig.eligible(eel).some(e => e.card.id === 'PW-19'));
});

test('beyond the Mine: the next Bonus Monster is known and does not change until you dig it; 8, 9, ... never more than 19', () => {
  const st = game({ mine: [], start: { heart: 10 }, dice: [10, 10, 10] });
  const a = Dig.peekBonus(st); assert.equal(a.damageNow, 8); assert.equal(Dig.peekBonus(st), a, 'the same card until it is dug');
  Dig.dig(st); assert.equal(st.last, a, 'and that is the card you dig'); assert.equal(Dig.peekBonus(st).damageNow, 9, 'the next one is a 9');
  st.beyond = 30; assert.equal(Dig.peekBonus(st).damageNow, DDB.rules.beyond.maxDamage, 'there is no card above 19');
});

test('a Bonus Monster is worth what the rules say (2 gems), a Starting Monster 1: the card and the notice agree with what the engine pays', () => {
  assert.equal(DDB.rules.beyond.gems, 1, "a Bonus Monster pays 1 gem of Loot, like every Monster"); assert.equal(DDB.rules.survivedGems, 1);
  const st = game({ mine: [], start: { heart: 10 }, dice: [10] }); Dig.dig(st); Dig.roll(st); Dig.autoFace(st);
  assert.equal(st.monsterGems, DDB.rules.beyond.gems, 'surviving a Bonus Monster pays the rules\' number');
});

test('a card whose power depends on the game can say what it is worth right now (Duct Tape, Scrap Heap, Second Wind, Depth Gauge, Flywheel)', () => {
  const st = game({ mine: [], ongoing: ['ON-33', 'ON-14'], start: { heart: 5 } });
  const tape = cards.find(c => c.id === 'IM-05');                  // +1 {heart} for each Ongoing card you have
  assert.equal(Dig.dynamic(st, tape), '+2 {heart}', 'Tune-Up and Floor Jack are in play');
  st.discard.push(cards.find(c => c.id === 'IM-13'), cards.find(c => c.id === 'IM-13'));
  assert.equal(Dig.dynamic(st, cards.find(c => c.id === 'IM-25')), '+3 {heart}', 'Scrap Heap counts itself too: 2 in the discard pile + 1');
  st.survived = 4; assert.equal(Dig.dynamic(st, cards.find(c => c.id === 'IM-26')), '+4 {heart}', 'Second Wind: one for each Monster survived');
  assert.equal(Dig.dynamic(st, cards.find(c => c.id === 'ON-11')), '+1 to your rolls', 'Depth Gauge: +1 for every 3 survived');
  assert.equal(Dig.dynamic(st, cards.find(c => c.id === 'ON-15')), '+2 to your rolls', 'Flywheel: +1 for each Immediate in the discard pile');
  assert.equal(Dig.dynamic(st, cards.find(c => c.id === 'IM-13')), null, 'Med Kit does not depend on anything');
});

test('review fixes: a Monster whose text is no damage ladder deals nothing instead of crashing the Dig', () => {
  const odd = { id: 'XX-odd', name: 'Odd', type: 'Monster', number: null, deck: 'Starting', count: 1, text: '{damage} X' };
  const st = game({ mine: [odd], start: { heart: 5 }, dice: [3] });
  assert.doesNotThrow(() => { Dig.dig(st); Dig.roll(st); Dig.autoFace(st); });
  assert.equal(st.heart, 5, 'it dealt no damage');
});

test('review fixes: "N+ cards trigger on one roll" fires when the Nth card triggers, not again when a cloned card triggers a second time', () => {
  const a = card('+1 {heart}', { number: 3, name: 'A' }), b = card('+1 {heart}', { number: 4, name: 'B' });
  const watcher = card('Whenever 2+ cards trigger on one roll, +1 {reroll}', { type: 'Ongoing', number: null, name: 'Watcher' });
  const st = game({ mine: ['MO-01'], power: [a, b], ongoing: [watcher], start: { heart: 5, reroll: 0 }, dice: [6] });
  entryOf(st, a.id).cloned = true;
  fight(st);
  assert.equal(st.reroll, 1);
});

test('a card that only blocks or halves damage is not offered once there is no damage left to take (the Monster is defeated, or the damage is already nothing)', () => {
  const st = game({ mine: ['MO-01'], power: ['PW-09'], start: { heart: 6 }, dice: [10] });          // the Pet (10) defeats the Monster; Pill Bug (Block 1) has nothing left to do
  Dig.dig(st); Dig.roll(st);
  assert.deepEqual(Dig.eligible(st).map(e => e.card.id).sort(), ['PW-01', 'PW-09'], 'before the Pet: both are offered');
  assert.ok(Dig.trigger(st, Dig.eligible(st).find(e => e.card.id === 'PW-01')));
  assert.deepEqual(Dig.eligible(st).map(e => e.card.id), [], 'the Monster is defeated: Block does nothing, so it is not offered');
  const small = game({ mine: ['MO-01'], power: ['PW-09', 'PW-12'], start: { heart: 6 }, dice: [6] });          // the Monster deals 1: after Pill Bug's Block 1 there is nothing left for Dart Frog to block
  Dig.dig(small); Dig.roll(small);
  const bug = Dig.eligible(small).find(e => e.card.id === 'PW-09'); assert.ok(bug); assert.ok(Dig.eligible(small).some(e => e.card.id === 'PW-12'), 'Dart Frog is offered first'); assert.ok(Dig.trigger(small, bug));
  assert.ok(Dig.eligible(small).length === 0, 'no damage left to block: Dart Frog is not offered');
});

test('maxNextDamage: the worst the next card could do — the next Monster of each set left in the Mine, only the top card when it is known, and the Bonus Monster at the bottom', () => {
  const st = game({ mine: ['MO-01', 'MO-02', 'TR-01'], start: { heart: 6 } });
  assert.equal(Dig.maxNextDamage(st), 2, 'A would deal 1 and B 2');
  st.known = 1; st.mine = [st.mine[2], st.mine[0], st.mine[1]]; assert.equal(Dig.maxNextDamage(st), 0, 'a known Geode on top: nothing to fear');
  st.known = 0; Dig.dig(st); Dig.roll(st); Dig.autoFace(st);
  assert.equal(Dig.maxNextDamage(st), 2, 'a Geode was dug: both sets are still at their first Monster');
  const empty = game({ mine: [], start: { heart: 9 } });
  assert.equal(Dig.maxNextDamage(empty), DDB.rules.beyond.firstDamage, 'the Bonus Monster');
});

test('a card that only heals you is not offered at full Health (but is when you are hurt, and a card that does more still is)', () => {
  const full = game({ mine: ['MO-01'], power: ['PW-02'], start: { heart: 10 }, dice: [6] });          // Nurse Newt: +1 Health
  Dig.dig(full); Dig.roll(full);
  assert.deepEqual(Dig.eligible(full).map(e => e.card.id), [], 'full Health: nothing to heal');
  const hurt = game({ mine: ['MO-01'], power: ['PW-02'], start: { heart: 9 }, dice: [6] });
  Dig.dig(hurt); Dig.roll(hurt);
  assert.deepEqual(Dig.eligible(hurt).map(e => e.card.id), ['PW-02'], 'one Health down: it is offered');
  const mixed = game({ mine: ['MO-01'], power: [card('+1 {heart}, +1 {reroll}', { number: 3 })], start: { heart: 10, reroll: 0 }, dice: [6] });
  Dig.dig(mixed); Dig.roll(mixed);
  assert.equal(Dig.eligible(mixed).length, 1, 'it also gives a Reroll, so it still does something');
});

test('cards that count how many cards trigger also count the cards the roll reached that could do nothing (a heal at full Health, a Block with no damage left)', () => {
  const run = hp => { const st = game({ mine: ['MO-01'], power: ['PW-05', 'PW-02'], start: { heart: hp, reroll: 0 }, dice: [6] }); Dig.dig(st); Dig.roll(st); Dig.trigger(st, Dig.eligible(st).find(e => e.card.id === 'PW-05')); Dig.face(st); return st; };
  assert.equal(run(9).reroll, 1, 'hurt: Nurse Newt could be used but was not, so the Duck triggered alone and gets its Reroll');
  assert.equal(run(10).reroll, 0, 'full Health: Nurse Newt cannot be used, but it passed the number, so the Duck is not alone');
});

test('Monster C: two cards, the first deals 3 and the second 5; it counts separately from A and B', () => {
  const st = game({ mine: ['MO-03', 'MO-01', 'MO-03', 'MO-02'], start: { heart: 40 }, dice: Array(10).fill(6) });
  const seen = [];
  for (let i = 0; i < 4; i++) { Dig.dig(st); seen.push([st.fight.monster.id, st.fight.damage]); Dig.roll(st); Dig.autoFace(st); }
  assert.deepEqual(seen, [['MO-03', 3], ['MO-01', 1], ['MO-03', 5], ['MO-02', 2]]);
});

test('every Dig that ends is stamped with the order in which Digs ended (the Leaderboard tells the round in that order)', () => {
  const a = game({ mine: ['TR-01'] }), b = game({ mine: ['TR-01'] }), c = game({ mine: ['MO-01'], start: { heart: 1 }, dice: [1] });
  Dig.dig(b); Dig.dig(a); Dig.dig(c); Dig.roll(c); Dig.autoFace(c);          // c goes BOOM first
  Dig.bank(b); Dig.bank(a);
  assert.ok(c.over.seq < b.over.seq && b.over.seq < a.over.seq, 'BOOM, then b banked, then a: ' + [c.over.seq, b.over.seq, a.over.seq]);
});
