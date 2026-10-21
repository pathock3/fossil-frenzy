// The rules of a Dig (Dig engine). Cards come from tests/cards-full.csv — a test fixture, a snapshot of the v2.7 sheet.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const { Dig, Engine, DDB } = require('./load.js');
const cards = Engine.cards(Engine.parseCSV(fs.readFileSync(path.join(__dirname, 'cards-full.csv'), 'utf8')), DDB.columns);
const by = id => { const c = cards.find(x => x.id === id); assert.ok(c, 'card ' + id); return c; };
let n = 1;
// A Dig with a scripted Mine (ids, top first) and scripted dice. Defaults: no Starter Kit, plenty of room on the tracks.
function game({ kit = [], mine, dice = [], start = {}, seed = 1, ongoing = [], power = [] } = {}) {
  const st = Dig.start(cards, kit.map(by), { seed, dice, start });
  if (mine) st.mine = mine.map(id => ({ ...by(id), uid: 90000 + n++ }));
  for (const id of ongoing) st.ongoing.push({ ...by(id), uid: 90000 + n++ });
  for (const id of power) st.line.push({ card: { ...by(id), uid: 90000 + n++ }, at: by(id).number, base: by(id).number });
  st.known = 0; return st;
}
const text = st => st.log.map(l => l.text).join('\n');
// dig a Monster and play the roll through: spend `grit` before, roll, then face it
function fight(st, { grit = 0, then } = {}) { assert.ok(Dig.dig(st)); for (let i = 0; i < grit; i++) assert.ok(Dig.spendGrit(st)); assert.ok(Dig.roll(st)); if (then) then(st); if (st.fight) assert.ok(Dig.face(st)); return st; }

test('the rules are data: nothing the engine needs is missing from DDB.rules, and every card text is understood', () => {
  for (const k of ['die', 'caps', 'start', 'gritBefore', 'gritAfter', 'pet', 'beyond', 'rulings']) assert.ok(DDB.rules[k] !== undefined, k);
  const bad = cards.filter(c => !Dig.supported(c)).map(c => c.id + ': ' + Dig.compile(c).unsupported.join(' | '));
  assert.deepEqual(bad, []);
  assert.equal(cards.length, 106);
});

test('a new Dig: Mine of 25 (18 Geodes, 7 Monsters), the Pet on the line at 10, Health/Grit/Rerolls at their starting spaces', () => {
  const st = Dig.start(cards, [], { seed: 5 });
  assert.equal(st.mine.length, 25);
  assert.equal(st.mine.filter(c => c.type === 'Treasure').length, 18);
  assert.equal(st.mine.filter(c => c.type === 'Monster').length, 7);
  assert.deepEqual(st.mine.map(c => c.id).filter(i => i === 'MO-01').length, 4);
  assert.equal(st.line.length, 1); assert.equal(st.line[0].card.name, 'Drill Pup'); assert.equal(st.line[0].at, 10); assert.ok(st.line[0].pet);
  assert.deepEqual([st.heart, st.grit, st.reroll], [DDB.rules.start.heart, DDB.rules.start.grit, DDB.rules.start.reroll]);
  assert.deepEqual(Dig.start(cards, [], { seed: 5 }).mine.map(c => c.id), st.mine.map(c => c.id), 'same seed, same Mine');
  assert.notDeepEqual(Dig.start(cards, [], { seed: 6 }).mine.map(c => c.id), st.mine.map(c => c.id));
});

test('Starter Kit: Power cards go on the line, Ongoing cards in play, Immediate cards are shuffled into the Mine', () => {
  const st = Dig.start(cards, ['PW-02', 'ON-33', 'IM-13'].map(by), { seed: 1 });
  assert.equal(st.line.length, 2); assert.equal(st.ongoing.length, 1); assert.equal(st.mine.length, 26);
  assert.ok(st.mine.some(c => c.id === 'IM-13'));
});

test('digging a Geode scores 1 gem and discards it; the Mine shrinks', () => {
  const st = game({ mine: ['TR-01', 'TR-01'] });
  Dig.dig(st); Dig.dig(st);
  assert.equal(st.geodeGems, 2); assert.equal(st.discard.length, 2); assert.equal(st.mine.length, 0);
});

test('Monster damage: each copy dug deals the next number in its set — A: 1,3,5,7; B: 2,4,6; sets count separately', () => {
  const st = game({ mine: ['MO-01', 'MO-02', 'MO-01', 'MO-02', 'MO-01', 'MO-02', 'MO-01'], start: { heart: 12, grit: 6 }, dice: Array(10).fill(6) });
  const seen = [];
  for (let i = 0; i < 7; i++) { Dig.dig(st); seen.push(st.fight.damage); for (let g = 0; g < 4; g++) Dig.spendGrit(st); Dig.roll(st); Dig.face(st); st.grit = 6; }
  assert.deepEqual(seen, [1, 2, 3, 4, 5, 6, 7]);
});

test('the roll: die plus Grit spent before it (+1 each, spendable only before the roll); Grit can be taken back before rolling', () => {
  const st = game({ mine: ['MO-01'], start: { grit: 3 }, dice: [4] });
  Dig.dig(st);
  assert.ok(Dig.can(st).roll && Dig.can(st).grit && !Dig.can(st).dig && !Dig.can(st).bonus && !Dig.can(st).face);
  Dig.spendGrit(st); Dig.spendGrit(st); assert.equal(st.grit, 1);
  Dig.refundGrit(st); assert.equal(st.grit, 2);
  Dig.roll(st);
  assert.equal(Dig.result(st).total, 5, '4 + 1 Grit');
  assert.ok(!Dig.can(st).grit, 'no more Grit before a roll once rolled');
});

test('after the roll: 3 Grit buys +1 (as many as you can afford); each costs exactly 3', () => {
  const st = game({ mine: ['MO-01'], start: { grit: 6 }, dice: [3] });
  Dig.dig(st); Dig.roll(st);
  assert.ok(Dig.buyBonus(st)); assert.equal(st.grit, 3); assert.equal(Dig.result(st).total, 4);
  assert.ok(Dig.buyBonus(st)); assert.equal(st.grit, 0); assert.equal(Dig.result(st).total, 5);
  assert.ok(!Dig.buyBonus(st));
});

test('a reroll costs 1 Reroll and gives a new die; Grit already spent stays; no reroll without a Reroll', () => {
  const st = game({ mine: ['MO-01'], start: { grit: 2, reroll: 1 }, dice: [2, 5, 6] });
  Dig.dig(st); Dig.spendGrit(st); Dig.roll(st);
  assert.equal(Dig.result(st).total, 3);
  assert.ok(Dig.reroll(st)); assert.equal(st.reroll, 0); assert.equal(Dig.result(st).total, 6, 'new die 5 + the 1 Grit');
  assert.ok(!Dig.reroll(st));
});

test('Pet: a result of 10 or more triggers it — the Monster is defeated and you take no damage; it counts as survived and is worth 1 gem', () => {
  const st = game({ mine: ['MO-01'], start: { grit: 6, heart: 6 }, dice: [6] });
  fight(st, { grit: 4 });
  assert.equal(st.heart, 6); assert.equal(st.survived, 1); assert.equal(st.defeated, 1); assert.equal(st.monsterGems, 1);
});

test('a result above 10 triggers every card on the line', () => {
  const st = game({ mine: ['MO-01'], power: ['PW-02', 'PW-28'], start: { grit: 6, heart: 3 }, dice: [6] });
  fight(st, { grit: 5 });                                  // 6 + 5 = 11
  assert.equal(st.heart, 3 + 1 + 5, 'Nurse Newt +1, Carrot Bunny +5 — and the Pet defeats the Monster');
});

test('below the Pet: Power cards at or under the result trigger, others do not; damage is then taken', () => {
  const st = game({ mine: ['MO-01'], power: ['PW-02', 'PW-15'], start: { heart: 6 }, dice: [3] });
  fight(st);                                               // result 3: Newt (1) triggers, Sloth (6) does not
  assert.equal(st.heart, 6 + 1 - 1, 'Newt +1, then 1 damage');
  assert.ok(/Nurse Newt/.test(text(st)) && !/Moss Sloth trigger/.test(text(st)));
});

test('"Resolve all triggered cards, then take damage": healing first can keep you alive', () => {
  const st = game({ mine: ['MO-01', 'MO-01', 'MO-01'], power: ['PW-15'], start: { heart: 1, grit: 0 }, dice: [1, 1, 6] });
  Dig.dig(st); Dig.roll(st); Dig.face(st);                 // 1 damage at 1 heart, nothing triggers (result 1) -> BOOM
  assert.equal(st.over.kind, 'boom');
  const st2 = game({ mine: ['MO-01'], power: ['PW-15'], start: { heart: 1 }, dice: [6] });
  fight(st2);                                              // result 6: Sloth +2, then 1 damage
  assert.equal(st2.heart, 2); assert.equal(st2.over, null);
});

test('BOOM when health reaches 0: the Dig ends, no gems are kept, Monsters survived still count', () => {
  const st = game({ mine: ['TR-01', 'MO-01', 'MO-01'], start: { heart: 2 }, dice: [1, 1, 1] });
  Dig.dig(st); fight(st);                                  // geode, then Monster 1: 1 damage
  assert.equal(st.heart, 1);
  Dig.dig(st); Dig.roll(st); Dig.face(st);                 // Monster 2: 3 damage
  assert.equal(st.over.kind, 'boom'); assert.equal(st.heart, 0);
  assert.equal(st.survived, 1); assert.ok(!Dig.can(st).dig && !Dig.can(st).bank && !Dig.dig(st));
});

test('banking: between cards only; you keep the gems from Geodes and survived Monsters', () => {
  const st = game({ mine: ['TR-01', 'TR-01', 'MO-01', 'TR-01'], start: { heart: 6 }, dice: [2] });
  Dig.dig(st); Dig.dig(st); Dig.dig(st);                   // two Geodes and a Monster in progress
  assert.ok(!Dig.can(st).bank && !Dig.bank(st), 'not while a Monster is unresolved');
  Dig.roll(st); Dig.face(st);
  assert.ok(Dig.bank(st));
  assert.deepEqual([st.over.kind, st.over.total, st.over.geodes, st.over.monsters, st.over.survived], ['bank', 3, 2, 1, 1]);
});

test('Beyond the Mine: after the Mine runs out, Bonus Monsters deal 8, 9, ... and are worth 2 gems', () => {
  const st = game({ mine: [], start: { heart: 12, grit: 6 }, dice: [1, 1] });
  Dig.dig(st); assert.equal(st.fight.damage, 8); assert.ok(st.fight.monster.bonus);
  Dig.roll(st); Dig.face(st);
  assert.equal(st.heart, 4); assert.equal(st.monsterGems, 2);
  Dig.dig(st); assert.equal(st.fight.damage, 9);
});

// ---------- Power cards ----------
test('Power cards: resource gains, caps, Lose then gain', () => {
  const st = game({ mine: ['MO-01'], power: ['PW-04', 'PW-10', 'PW-30'], start: { heart: 6, grit: 5, reroll: 2 }, dice: [6] });
  fight(st, { grit: 0 });                                  // result 6: Porcupine (1) lose 1 heart +2 grit; Gopher (4) +2 grit; Ferret needs 10
  assert.equal(st.heart, 6 - 1 - 1, 'Porcupine, then the Monster\'s 1 damage');
  assert.equal(st.grit, 6, 'capped at 6');
});

test('Conga Crab counts the other cards that trigger; Unlucky Duck only fires when nothing else does', () => {
  const st = game({ mine: ['MO-01'], power: ['PW-11', 'PW-06', 'PW-10', 'PW-05'], start: { heart: 6, grit: 0, reroll: 0 }, dice: [6] });
  fight(st);                                               // result 6: Crab(5), Gecko(2), Gopher(4), Duck(1) all trigger
  assert.equal(st.grit, 3 + 1 + 2, 'Crab +1 x3 others, Gecko +1, Gopher +2');
  assert.equal(st.reroll, 0, 'Duck did not fire: other cards triggered');
  const st2 = game({ mine: ['MO-01'], power: ['PW-05'], dice: [3] }); fight(st2);
  assert.equal(st2.reroll, 1);
});

test('conditions: Nervous Mouse needs 4 or less Health; Jolt Eel needs 3 or less', () => {
  const lo = game({ mine: ['MO-01'], power: ['PW-07', 'PW-19'], start: { heart: 3 }, dice: [7 - 0] });
  lo.dice = [6]; fight(lo, { grit: 0 });                   // result 6: Mouse (2) fires, Eel (7) does not
  assert.equal(lo.reroll, 1);
  const hi = game({ mine: ['MO-01'], power: ['PW-07'], start: { heart: 6 }, dice: [6] }); fight(hi);
  assert.equal(hi.reroll, 0);
  const eel = game({ mine: ['MO-01'], power: ['PW-19'], start: { heart: 3, grit: 6 }, dice: [3] }); fight(eel, { grit: 4 });
  assert.equal(eel.heart, 3 + 5 - 1, '7 triggers the Eel (+5), then the Monster\'s 1 damage');
});

test('Block, Venom Spider (half damage, rounded down) and Lucky Cricket', () => {
  const blk = game({ mine: ['MO-01', 'MO-01', 'MO-01'], power: ['PW-09', 'PW-12'], start: { heart: 6 }, dice: [6, 6, 6] });
  fight(blk);                                              // damage 1, block 1+2: no damage
  assert.equal(blk.heart, 6);
  const half = game({ mine: ['MO-01', 'MO-01'], power: ['PW-16'], start: { heart: 12, grit: 6 }, dice: [6, 6] });
  Dig.dig(half); Dig.roll(half); Dig.face(half);           // 1 damage halved = 0
  assert.equal(half.heart, 12);
  Dig.dig(half); Dig.roll(half); Dig.face(half);           // 3 damage halved = 1
  assert.equal(half.heart, 11);
  const cricket = game({ mine: ['MO-01', 'MO-01'], power: ['PW-14'], start: { heart: 3 }, dice: [6, 6] });
  Dig.dig(cricket); Dig.roll(cricket); Dig.face(cricket);  // 1 damage -> 2
  Dig.dig(cricket); Dig.roll(cricket); Dig.face(cricket);  // 3 damage would BOOM at 2 -> survive with 1
  assert.equal(cricket.over, null); assert.equal(cricket.heart, 1);
});

test('"When dug" effects happen the moment the card is dug, not when it triggers', () => {
  const st = game({ mine: ['PW-18'], start: { grit: 0, reroll: 0 } });
  Dig.dig(st);
  assert.equal(st.grit, 2); assert.equal(st.reroll, 0); assert.equal(st.line.length, 2); assert.equal(st.line[1].at, 7);
});

test('Falcon Finisher rolls again: 10 or more defeats the Monster (extra Grit is not included by default)', () => {
  const win = game({ mine: ['MO-02'], power: ['PW-21'], start: { heart: 6 }, ongoing: ['ON-17'], dice: [6, 6] });
  win.ongoing = [{ ...by('ON-33') }, { ...by('ON-33') }, { ...by('ON-33') }, { ...by('ON-33') }]; // +4 to rolls
  fight(win, { grit: 0 });                                  // first result 6+4=10 already triggers everything; Falcon rolls 6+4 = 10 -> defeat
  assert.equal(win.defeated, 1);
  const lose = game({ mine: ['MO-02'], power: ['PW-21'], start: { heart: 6 }, dice: [6, 2] });
  fight(lose);                                              // result 6 does not reach Falcon (8)
  assert.equal(lose.heart, 4);
  const miss = game({ mine: ['MO-02'], power: ['PW-21'], start: { heart: 6, grit: 6 }, dice: [3, 4] });
  fight(miss, { grit: 5 });                                 // 3+5 = 8: Falcon rolls a 4 (no Grit) -> not 10
  assert.equal(miss.defeated, 0); assert.equal(miss.heart, 4);
});

test('Magpie and Echo copy the top Immediate card in the discard pile', () => {
  const st = game({ mine: ['IM-13', 'IM-06'], start: { heart: 2 } });
  Dig.dig(st); assert.equal(st.heart, 6); Dig.dig(st); assert.equal(st.heart, 10, 'Echo did Med Kit again');
  const none = game({ mine: ['IM-06'] }); Dig.dig(none); assert.equal(none.heart, none.rules.heart);
  const mag = game({ mine: ['IM-13', 'MO-01'], power: ['PW-22'], start: { heart: 2 }, dice: [8] }); Dig.dig(mag); fight(mag);
  assert.equal(mag.heart, 6 + 4 - 1, 'Magpie copied Med Kit, then the Monster hit');
});

test('Snowball Beetle moves itself down 1 after it triggers; Wrench Rat moves your highest Power (not the Pet) down 2', () => {
  const st = game({ mine: ['MO-01', 'MO-01'], power: ['PW-25'], start: { heart: 12 }, dice: [8, 8] });
  Dig.dig(st); Dig.roll(st); Dig.face(st);
  assert.equal(st.line.find(e => e.card.id === 'PW-25').at, 7);
  const w = game({ mine: ['IM-34'], power: ['PW-25', 'PW-02'] });
  Dig.dig(w); assert.equal(w.line.find(e => e.card.id === 'PW-25').at, 6); assert.equal(w.line.find(e => e.pet).at, 10);
});

// ---------- Immediate cards ----------
test('Immediate cards happen when dug, then go to the discard pile', () => {
  const st = game({ mine: ['IM-09', 'IM-23'], start: { heart: 6, grit: 0, reroll: 0 } });
  Dig.dig(st); assert.deepEqual([st.grit, st.heart], [2, 9]);
  Dig.dig(st); assert.deepEqual([st.heart, st.reroll], [7, 2]); assert.equal(st.discard.length, 2);
});

test('Immediate cards can BOOM you (Risky Shortcut at 2 Health); All In sets Health to 1 and fills Rerolls; Reset Button sets Health to 7', () => {
  const st = game({ mine: ['IM-23'], start: { heart: 2 } }); Dig.dig(st); assert.equal(st.over.kind, 'boom');
  const a = game({ mine: ['IM-01', 'IM-21'], start: { heart: 9 } }); Dig.dig(a); assert.deepEqual([a.heart, a.reroll], [1, 3]); Dig.dig(a); assert.equal(a.heart, 7);
});

test('count-based Immediates: Duct Tape/Tool Shed (Ongoing cards), Scrap Heap (Immediates in discard, including itself), Second Wind and Repair Kit', () => {
  const st = game({ mine: ['IM-05', 'IM-31'], ongoing: ['ON-33', 'ON-14'], start: { heart: 2, grit: 0 } });
  Dig.dig(st); assert.equal(st.heart, 4); Dig.dig(st); assert.equal(st.grit, 2);
  const s2 = game({ mine: ['IM-13', 'IM-25'], start: { heart: 1 } }); Dig.dig(s2); Dig.dig(s2); assert.equal(s2.heart, 5 + 2, 'Med Kit +4, then 2 Immediates (itself included) = +2');
  const s3 = game({ mine: ['MO-01', 'IM-26', 'IM-20'], start: { heart: 6 }, dice: [6] });
  fight(s3); Dig.dig(s3); assert.equal(s3.heart, 5 + 1); Dig.dig(s3); assert.equal(s3.reroll, 0, 'nothing defeated');
});

test('Four-Leaf Clover: your next Monster is a 10 without a roll (the Pet defeats it)', () => {
  const st = game({ mine: ['IM-07', 'MO-01'], start: { heart: 6 } });
  Dig.dig(st); Dig.dig(st);
  assert.equal(st.fight.phase, 'after'); assert.equal(Dig.result(st).total, 10); assert.ok(!Dig.can(st).roll && !Dig.can(st).reroll && !Dig.can(st).bonus);
  Dig.face(st); assert.equal(st.heart, 6); assert.equal(st.defeated, 1);
});

test('Pet Treat makes the Pet trigger 1 lower, and it stays lower until Prep', () => {
  const st = game({ mine: ['IM-18'] }); Dig.dig(st); assert.equal(st.line.find(e => e.pet).at, 9);
  const w = game({ mine: ['ON-25', 'IM-18'] }); Dig.dig(w); assert.equal(w.line.find(e => e.pet).at, 9); Dig.dig(w); assert.equal(w.line.find(e => e.pet).at, 8);
});

// ---------- the Mine ----------
test('Cave Scout digs until a Monster and puts it back on top, face up; Old Map moves a Monster on top to the bottom', () => {
  const st = game({ mine: ['IM-03', 'TR-01', 'IM-09', 'MO-01', 'TR-01'], start: { grit: 0, heart: 6 } });
  Dig.dig(st);
  assert.equal(st.geodeGems, 1); assert.equal(st.grit, 2); assert.equal(st.mine[0].id, 'MO-01'); assert.equal(st.known, 1);
  const m = game({ mine: ['IM-17', 'MO-01', 'TR-01'] }); Dig.dig(m); assert.deepEqual(m.mine.map(c => c.id), ['TR-01', 'MO-01']);
  const k = game({ mine: ['IM-17', 'TR-01', 'MO-01'] }); Dig.dig(k); assert.deepEqual(k.mine.map(c => c.id), ['TR-01', 'MO-01']);
});

test('Stink Bomb, Crystal Ball, Fuzzy Radar, Pocket Scanner, Shoo Spray, Rewind Tape, Wishing Well, Boomerang', () => {
  const sb = game({ mine: ['IM-30', 'MO-01', 'TR-01', 'MO-02', 'TR-01'] }); Dig.dig(sb);
  assert.deepEqual(sb.mine.map(c => c.id), ['TR-01', 'TR-01', 'MO-01', 'MO-02']);
  const cb = game({ mine: ['IM-04', 'TR-01', 'PW-02', 'ON-33', 'MO-01'] }); Dig.dig(cb);
  assert.equal(cb.ongoing.length, 1); assert.equal(cb.line.length, 2); assert.deepEqual(cb.mine.map(c => c.id), ['TR-01', 'MO-01']);
  const fr = game({ mine: ['IM-08', 'MO-01', 'MO-02', 'TR-01', 'TR-01', 'TR-01', 'TR-01'], start: { heart: 6 } }); Dig.dig(fr); assert.equal(fr.heart, 10); assert.equal(fr.mine.length, 6);
  const ps = game({ mine: ['IM-19', 'TR-01', 'MO-01', 'TR-01'], start: { grit: 0 } }); Dig.dig(ps); assert.equal(ps.grit, 1); assert.equal(ps.known, 3);
  const sh = game({ mine: ['IM-27', 'MO-01', 'TR-01'], start: { grit: 0 } }); Dig.dig(sh); assert.equal(sh.grit, 2); assert.deepEqual(sh.mine.map(c => c.id), ['TR-01', 'MO-01']);
  const rw = game({ mine: ['IM-13', 'IM-22', 'TR-01'], start: { heart: 1 } }); Dig.dig(rw); Dig.dig(rw); assert.equal(rw.mine[0].id, 'IM-13'); Dig.dig(rw); assert.equal(rw.heart, 9);
  const wl = game({ mine: ['IM-13', 'IM-10', 'IM-32'] }); Dig.dig(wl); Dig.dig(wl); Dig.dig(wl); assert.equal(wl.mine.length, 2); assert.equal(wl.discard.length, 1);
  const bo = game({ mine: ['IM-02', 'TR-01', 'TR-01', 'TR-01', 'TR-01'], start: { grit: 0 } }); Dig.dig(bo); assert.equal(bo.grit, 2); assert.equal(bo.mine.length, 5); assert.equal(bo.discard.length, 0, 'it is back in the Mine');
});

test('Salvage Yard plays the first Power or Ongoing card found; Wormhole does the first Immediate; the rest are shuffled back', () => {
  const sy = game({ mine: ['IM-24', 'TR-01', 'MO-01', 'ON-33', 'TR-01'] }); Dig.dig(sy);
  assert.equal(sy.ongoing.length, 1); assert.equal(sy.mine.length, 3); assert.deepEqual(sy.mine.map(c => c.id).sort(), ['MO-01', 'TR-01', 'TR-01']);
  const wh = game({ mine: ['IM-33', 'TR-01', 'IM-10', 'TR-01'], start: { grit: 0 } }); Dig.dig(wh); assert.equal(wh.grit, 4); assert.equal(wh.mine.length, 2);
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
  const ms = game({ mine: ['MO-01', 'MO-01', 'MO-01', 'MO-01'], ongoing: ['ON-20'], start: { heart: 12, grit: 6 }, dice: [4, 4, 4, 4] });
  const got = []; for (let i = 0; i < 4; i++) { Dig.dig(ms); Dig.roll(ms); got.push(Dig.result(ms).total); Dig.face(ms); }
  assert.deepEqual(got, [4, 4, 4, 6], 'only the 7-damage fourth Monster gets +2');
  const gs = game({ mine: ['MO-01', 'MO-01', 'MO-01', 'MO-01'], ongoing: ['ON-17'], start: { heart: 12 }, dice: [4, 4, 4, 4] });
  for (let i = 0; i < 3; i++) { Dig.dig(gs); Dig.roll(gs); Dig.face(gs); } Dig.dig(gs); Dig.roll(gs); assert.equal(Dig.result(gs).total, 7);
  const dg = game({ mine: ['MO-01'], ongoing: ['ON-11'], dice: [4] }); dg.survived = 6; Dig.dig(dg); Dig.roll(dg); assert.equal(Dig.result(dg).total, 6);
  const fw = game({ mine: ['MO-01'], ongoing: ['ON-15'], dice: [4] }); fw.discard = Array(5).fill(0).map(() => ({ ...by('IM-13') })); Dig.dig(fw); Dig.roll(fw); assert.equal(Dig.result(fw).total, 7);
});

test('result changes: Floor Jack (below 4 becomes 4), Backfire (1 becomes 10), Wrecking Ball doubles the first Monster each Dig; in the ruled order', () => {
  const fj = game({ mine: ['MO-01'], ongoing: ['ON-14'], dice: [2] }); Dig.dig(fj); Dig.roll(fj); assert.equal(Dig.result(fj).total, 4);
  const bf = game({ mine: ['MO-01'], ongoing: ['ON-03'], dice: [1] }); Dig.dig(bf); Dig.roll(bf); assert.equal(Dig.result(bf).total, 10);
  const wb = game({ mine: ['MO-01', 'MO-01'], ongoing: ['ON-37'], start: { heart: 12 }, dice: [3, 3] });
  Dig.dig(wb); Dig.roll(wb); assert.equal(Dig.result(wb).total, 6); Dig.face(wb);
  Dig.dig(wb); Dig.roll(wb); assert.equal(Dig.result(wb).total, 3, 'only the first Monster');
  const both = game({ mine: ['MO-01'], ongoing: ['ON-37', 'ON-14'], dice: [1] }); Dig.dig(both); Dig.roll(both); assert.equal(Dig.result(both).total, 4, '1 doubled is 2, then the floor makes it 4');
});

test('Pet Whistle: the Pet triggers on 9', () => {
  const st = game({ mine: ['MO-01'], ongoing: ['ON-25'], start: { grit: 6 }, dice: [6] }); Dig.dig(st);
  assert.equal(st.line.find(e => e.pet).at, 9);
  for (let i = 0; i < 3; i++) Dig.spendGrit(st); Dig.roll(st); Dig.face(st); assert.equal(st.defeated, 1);
});

test('Cowcatcher: your first Monster each Dig deals no damage; Bumper blocks 1 from every Monster', () => {
  const st = game({ mine: ['MO-01', 'MO-01'], ongoing: ['ON-08'], start: { heart: 6 }, dice: [2, 2] });
  fight(st); assert.equal(st.heart, 6); fight(st); assert.equal(st.heart, 3);
  const b = game({ mine: ['MO-01', 'MO-01'], ongoing: ['ON-05'], start: { heart: 6 }, dice: [2, 2] }); fight(b); assert.equal(b.heart, 6); fight(b); assert.equal(b.heart, 4);
});

test('Bounty Poster: Monsters you defeat are worth 2 gems (a Monster you merely survive stays at 1)', () => {
  const st = game({ mine: ['MO-01', 'MO-01'], ongoing: ['ON-04'], start: { grit: 6, heart: 12 }, dice: [6, 1] });
  fight(st, { grit: 4 }); assert.equal(st.monsterGems, 2); fight(st); assert.equal(st.monsterGems, 3);
});

test('"Whenever you gain" cards: Adrenaline Pump, Nurse Bot (gain 1 more), Pep Horn; amplified gains still cap', () => {
  const ad = game({ mine: ['IM-13'], ongoing: ['ON-01'], start: { heart: 2, grit: 0 } }); Dig.dig(ad); assert.deepEqual([ad.heart, ad.grit], [6, 1]);
  const nb = game({ mine: ['IM-13'], ongoing: ['ON-21'], start: { heart: 2 } }); Dig.dig(nb); assert.equal(nb.heart, 7);
  const ph = game({ mine: ['IM-10'], ongoing: ['ON-24'], start: { grit: 0 } }); Dig.dig(ph); assert.equal(ph.grit, 5);
  const both = game({ mine: ['IM-13'], ongoing: ['ON-01', 'ON-21', 'ON-24'], start: { heart: 2, grit: 0 } }); Dig.dig(both); assert.deepEqual([both.heart, both.grit], [7, 2], 'Nurse Bot +1 heart; Adrenaline +1 grit, which Pep Horn makes 2');
  const full = game({ mine: ['IM-13'], ongoing: ['ON-01'], start: { heart: 12, grit: 0 } }); Dig.dig(full); assert.equal(full.grit, 0, 'no gain at a full track means no trigger');
});

test('dig watchers: Confetti Cannon and Disco Ball (Immediate), Danger Siren (Monster with 6+ damage)', () => {
  const st = game({ mine: ['IM-10'], ongoing: ['ON-07', 'ON-12'], start: { grit: 0, heart: 6 } }); Dig.dig(st); assert.deepEqual([st.grit, st.heart], [5, 7]);
  const ds = game({ mine: ['MO-01', 'MO-01', 'MO-01', 'MO-01'], ongoing: ['ON-10'], start: { heart: 12, grit: 0 }, dice: [6, 6, 6, 6] });
  for (let i = 0; i < 3; i++) { Dig.dig(ds); Dig.roll(ds); Dig.face(ds); } assert.equal(ds.grit, 0); Dig.dig(ds); assert.equal(ds.grit, 2, 'the 7 damage Monster, before you roll');
});

test('damage and defeat watchers: Patch Kit, Stubborn Engine, Rage Valve / Crumple Zone (3+/5+), Monster Jerky, Salvage Claw, Trophy Case, Victory Bell', () => {
  const pk = game({ mine: ['MO-01'], ongoing: ['ON-23', 'ON-30'], start: { heart: 6, grit: 0 }, dice: [2] }); fight(pk); assert.deepEqual([pk.heart, pk.grit], [6, 1]);
  const rv = game({ mine: ['MO-01', 'MO-01'], ongoing: ['ON-26'], start: { heart: 12, grit: 0 }, dice: [2, 2] }); fight(rv); assert.equal(rv.grit, 0); fight(rv); assert.equal(rv.grit, 2);
  const cz = game({ mine: ['MO-01', 'MO-01', 'MO-01'], ongoing: ['ON-09'], start: { heart: 12, reroll: 0 }, dice: [2, 2, 2] }); fight(cz); fight(cz); assert.equal(cz.reroll, 0); fight(cz); assert.equal(cz.reroll, 1);
  const mj = game({ mine: ['MO-01'], ongoing: ['ON-19', 'ON-28', 'ON-32', 'ON-35'], start: { heart: 3, grit: 6 }, dice: [6] });
  mj.grit = 4; fight(mj, { grit: 4 }); assert.deepEqual([mj.heart, mj.grit, mj.reroll], [3 + 3 + 1, 0 + 1 + 2, 1], 'defeat: +3 heart, +1 grit +1 heart, +2 grit, +1 reroll');
});

test('"Whenever 4+ cards trigger on one roll" (Applause Meter) and Grit Caddy (spend 3+ Grit on one roll, get 1 back)', () => {
  const ap = game({ mine: ['MO-01'], power: ['PW-02', 'PW-06', 'PW-09'], ongoing: ['ON-02'], start: { heart: 6, reroll: 0 }, dice: [3] }); fight(ap); assert.equal(ap.reroll, 0, 'only 3 cards trigger at a 3 (the Pet needs 10)');
  const ap2 = game({ mine: ['MO-01'], power: ['PW-02', 'PW-06', 'PW-09', 'PW-10'], ongoing: ['ON-02'], start: { heart: 6, reroll: 0 }, dice: [4] }); fight(ap2); assert.equal(ap2.reroll, 1);
  const gc = game({ mine: ['MO-01'], ongoing: ['ON-18'], start: { grit: 5, heart: 12 }, dice: [2] }); fight(gc, { grit: 3 }); assert.equal(gc.grit, 3, '5 - 3 + 1');
  const gc2 = game({ mine: ['MO-01'], ongoing: ['ON-18'], start: { grit: 5, heart: 12 }, dice: [2] }); fight(gc2, { grit: 2 }); assert.equal(gc2.grit, 3);
});

test('Generator gives Grit at the start of each Dig; Drone Booster makes the first Grit you spend before a roll worth +2', () => {
  const g = Dig.start(cards, ['ON-16'].map(by), { seed: 1 }); assert.equal(g.grit, 2);
  const st = game({ mine: ['MO-01'], ongoing: ['ON-13'], start: { grit: 3 }, dice: [2] }); Dig.dig(st); Dig.spendGrit(st); Dig.spendGrit(st); Dig.roll(st);
  assert.equal(Dig.result(st).total, 2 + 2 + 1);
});

test('Panic Button: the first time each Dig a roll would BOOM you, a free reroll (once); Second Spark: a result of 3 or less rerolls free', () => {
  const st = game({ mine: ['MO-02', 'MO-02', 'MO-02'], ongoing: ['ON-22'], start: { heart: 2 }, dice: [1, 6] });
  Dig.dig(st); Dig.roll(st); Dig.face(st);                 // 2 damage at 2 heart: reroll to 6 (no triggers beyond Pet) -> still 2 damage... BOOM anyway
  assert.ok(st.panicUsed && /free reroll/.test(text(st)));
  const saved = game({ mine: ['MO-01', 'MO-01'], power: ['PW-15'], ongoing: ['ON-22'], start: { heart: 1 }, dice: [1, 6] });
  Dig.dig(saved); Dig.roll(saved); Dig.face(saved); assert.equal(saved.over, null, 'rerolled into 6: Moss Sloth heals 2 before the damage');
  const ss = game({ mine: ['MO-01'], ongoing: ['ON-29'], dice: [2, 5, 6] }); Dig.dig(ss); Dig.roll(ss); assert.equal(Dig.result(ss).total, 5, 'free reroll from 2'); 
  const once = game({ mine: ['MO-01'], ongoing: ['ON-29'], dice: [1, 2, 6] }); Dig.dig(once); Dig.roll(once); assert.equal(Dig.result(once).total, 2, 'only one free reroll');
});

test('Twin Drill keeps the higher die on a reroll; Thorned Gadget pays Health for a reroll when you have none', () => {
  const td = game({ mine: ['MO-01'], ongoing: ['ON-34'], start: { reroll: 1, heart: 12 }, dice: [5, 2] }); Dig.dig(td); Dig.roll(td); Dig.reroll(td); assert.equal(Dig.result(td).total, 5);
  const tg = game({ mine: ['MO-01'], ongoing: ['ON-31'], start: { reroll: 0, heart: 6 }, dice: [1, 4] }); Dig.dig(tg); Dig.roll(tg); assert.ok(Dig.can(tg).reroll); Dig.reroll(tg); assert.deepEqual([tg.heart, Dig.result(tg).total], [4, 4]);
  const no = game({ mine: ['MO-01'], ongoing: ['ON-31'], start: { reroll: 0, heart: 2 }, dice: [1] }); Dig.dig(no); Dig.roll(no); assert.ok(!Dig.can(no).reroll, 'it would BOOM you');
});

test('Workbench trades 3 Grit for a Reroll or a Reroll for 3 Grit any time; Cloning Machine makes one Power card trigger twice', () => {
  const wb = game({ ongoing: ['ON-36'], start: { grit: 4, reroll: 0 } }); assert.ok(Dig.trade(wb, 'grit')); assert.deepEqual([wb.grit, wb.reroll], [1, 1]); assert.ok(Dig.trade(wb, 'reroll')); assert.deepEqual([wb.grit, wb.reroll], [4, 0]); assert.ok(!Dig.trade(wb, 'reroll'));
  const cl = game({ mine: ['ON-06', 'MO-01'], power: ['PW-10'], start: { grit: 0, heart: 12 }, dice: [5] });
  Dig.dig(cl); assert.ok(cl.pending && !Dig.can(cl).dig, 'choose a Power card first');
  assert.ok(Dig.chooseClone(cl, cl.line.find(e => e.card.id === 'PW-10'))); assert.equal(cl.pending, null);
  fight(cl); assert.equal(cl.grit, 4, 'Grit Gopher triggered twice: +2 +2');
});

// ---------- the whole Dig ----------
test('after the end of a Dig nothing can be done', () => {
  const st = game({ mine: ['TR-01'] }); Dig.dig(st); Dig.bank(st);
  const c = Dig.can(st); assert.ok(!Object.values(c).some(Boolean));
  assert.ok(!Dig.dig(st) && !Dig.bank(st) && !Dig.roll(st) && !Dig.face(st));
});

test('random play never breaks the rules: tracks stay inside their caps, no NaN, every Dig ends, and the log never says undefined', () => {
  const caps = DDB.rules.caps;
  for (let seed = 1; seed <= 300; seed++) {
    const kit = []; const rr = Dig.makeRng(seed * 7);
    const boosters = cards.filter(c => c.deck === 'Booster');
    for (let i = 0; i < 1 + (seed % 3); i++) kit.push(boosters[Math.floor(rr() * boosters.length)]);
    const st = Dig.start(cards, kit, { seed }); let steps = 0;
    while (!st.over && steps++ < 400) {
      const c = Dig.can(st), acts = Object.keys(c).filter(k => c[k]);
      if (!acts.length) break;
      const pick = rr();
      if (c.choose) { const e = st.line[Math.floor(rr() * st.line.length)]; Dig.chooseClone(st, e); }
      else if (st.fight && st.fight.phase === 'before') { if (c.grit && rr() < 0.5) Dig.spendGrit(st); else Dig.roll(st); }
      else if (st.fight) { if (c.bonus && rr() < 0.3) Dig.buyBonus(st); else if (c.reroll && rr() < 0.4) Dig.reroll(st); else Dig.face(st); }
      else if (c.bank && pick < 0.04) Dig.bank(st); else Dig.dig(st);
      for (const k of ['heart', 'grit', 'reroll']) assert.ok(Number.isInteger(st[k]) && st[k] >= 0 && st[k] <= caps[k], `seed ${seed}: ${k}=${st[k]}`);
      assert.ok(st.line.every(e => Number.isInteger(e.at) && e.at >= 1 && e.at <= 10), `seed ${seed}: line ${JSON.stringify(st.line.map(e => e.at))}`);
    }
    assert.ok(st.over, `seed ${seed}: did not end in ${steps} steps`);
    assert.ok(!st.log.some(l => /undefined|NaN/.test(l.text)), `seed ${seed}: ` + st.log.find(l => /undefined|NaN/.test(l.text)));
    assert.ok(st.survived >= 0 && st.geodeGems >= 0);
  }
});
