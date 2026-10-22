// The new Booster cards (NEW-BOOSTERS.csv: proposals not yet on the owner's sheet) and the rules they need.
// Each design space they open up has a test: chains that raise the die, defeating small Monsters, die-value triggers,
// damage caps, Extra Roll rules, one-shot (breaking) cards, and moving Monsters around the Mine and their ladders.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const { Dig, Engine, DDB } = require('./load.js');
const read = f => Engine.cards(Engine.parseCSV(fs.readFileSync(path.join(__dirname, f), 'utf8')), DDB.columns);
const base = read('cards-full.csv'), fresh = read('../NEW-BOOSTERS.csv'), cards = base.concat(fresh);
const by = id => { const c = cards.find(x => x.id === id); assert.ok(c, 'card ' + id); return c; };
let n = 1;
function game({ mine, dice = [], start = {}, ongoing = [], power = [], setCount } = {}) {
  const st = Dig.start(cards, [], { seed: 1, dice, start });
  if (mine) st.mine = mine.map(id => ({ ...by(id), uid: 70000 + n++ }));
  for (const id of ongoing) st.ongoing.push({ ...by(id), uid: 70000 + n++ });
  for (const id of power) { const c = by(id); st.line.push({ card: { ...c, uid: 70000 + n++ }, at: c.number, base: c.number }); }
  if (setCount) Object.assign(st.setCount, setCount);
  st.known = 0; return st;
}
const log = st => st.log.map(l => l.text).join('\n');
const fight = st => { assert.ok(Dig.dig(st)); assert.ok(Dig.roll(st)); return st; };
const faceAll = st => { Dig.triggerAll(st); if (st.fight) Dig.face(st); return st; };

test('the new cards: every one is understood, none uses Grit, and their ids are new', () => {
  assert.ok(fresh.length >= 30);
  for (const c of fresh) { assert.ok(Dig.supported(c), c.id + ': ' + c.text); assert.ok(!/grit/i.test(c.text)); assert.ok(!base.some(b => b.id === c.id), c.id + ' is taken'); }
  assert.equal(new Set(fresh.map(c => c.name)).size, fresh.length, 'names are unique');
  for (const c of fresh.filter(c => c.type === 'Power')) assert.ok(c.number >= 1 && c.number <= 10, c.id);
});

test('chains: a Power card that raises the die lets the next one in (4 → 6 → 9 reaches the Pet)', () => {
  const st = game({ mine: ['MO-01'], dice: [4], power: ['PW-61', 'PW-62'] });
  fight(st); assert.equal(Dig.eligible(st).map(e => e.card.id).join(), 'PW-61', 'only the Hare at 4');
  faceAll(st);
  assert.equal(st.survived, 1); assert.equal(st.defeated, 1, 'Hare +2 → 6, Gull +3 → 9, the Pet defeats it');
  assert.match(log(st), /slides up 2[\s\S]*slides up 3/);
});

test('Daredevil Gerbil costs a Health for +3; Tailwind Swift heals and raises; Mirror Mantis gives a Roll and raises', () => {
  const st = game({ mine: ['MO-01'], dice: [2], power: ['PW-64'], start: { heart: 6 } });
  fight(st); Dig.trigger(st, st.line[1]); assert.equal(st.heart, 5); assert.equal(Dig.result(st).total, 5);
  const t = game({ mine: ['MO-01'], dice: [5], power: ['PW-63'], start: { heart: 6 } });
  fight(t); Dig.trigger(t, t.line[1]); assert.equal(t.heart, 7); assert.equal(Dig.result(t).total, 6);
  const m = game({ mine: ['MO-01'], dice: [7], power: ['PW-67'] });
  fight(m); Dig.trigger(m, m.line[1]); assert.equal(m.reroll, 1); assert.equal(Dig.result(m).total, 8);
});

test('Brave Terrier and Bulldog Bouncer defeat only Monsters whose damage is small enough (and are not offered otherwise)', () => {
  const a = game({ mine: ['MO-01'], dice: [6], power: ['PW-65'] });          // Monster A #1: 1 damage
  fight(a); assert.equal(Dig.eligible(a).length, 1); faceAll(a); assert.equal(a.defeated, 1);
  const b = game({ mine: ['MO-01'], dice: [6], power: ['PW-65'], setCount: { 'MO-01': 3 } });          // #4: 7 damage
  fight(b); assert.equal(Dig.eligible(b).length, 0, 'the Terrier has nothing to do against 7 damage'); faceAll(b); assert.equal(b.defeated, 0); assert.equal(b.heart, 3);
  const c = game({ mine: ['MO-01'], dice: [8], power: ['PW-66'], setCount: { 'MO-01': 2 } });          // #3: 5 damage
  fight(c); faceAll(c); assert.equal(c.defeated, 1, 'the Bouncer takes 5 damage Monsters');
});

test('Panic Possum: two Extra Rolls when you are low, nothing when you are not', () => {
  const lo = game({ mine: ['MO-01'], dice: [4], power: ['PW-68'], start: { heart: 3 } });
  fight(lo); faceAll(lo); assert.equal(lo.reroll, 2);
  const hi = game({ mine: ['MO-01'], dice: [4], power: ['PW-68'], start: { heart: 8 } });
  fight(hi); assert.equal(Dig.eligible(hi).length, 0);
});

test('rolling a number: Snake Eyes (1), Lucky Seven (7), Boxcars (10) react to the die itself, Extra Rolls included', () => {
  const s = game({ mine: ['MO-01'], dice: [1], ongoing: ['ON-60'] }); fight(s); assert.equal(s.reroll, 2);
  const l = game({ mine: ['MO-01'], dice: [7], ongoing: ['ON-61'], start: { heart: 5 } }); fight(l); assert.deepEqual([l.reroll, l.heart], [1, 7]);
  const b = game({ mine: ['MO-01'], dice: [10], ongoing: ['ON-62'], start: { heart: 5 } }); fight(b); assert.equal(b.heart, 8);
  const x = game({ mine: ['MO-01'], dice: [4, 10], ongoing: ['ON-62'], start: { heart: 5, reroll: 1 } }); fight(x); assert.equal(x.heart, 5); Dig.reroll(x); assert.equal(x.heart, 8, 'an Extra Roll that lands on 10 counts');
  const o = game({ mine: ['MO-01'], dice: [6], ongoing: ['ON-62'], start: { heart: 5 } }); fight(o); assert.equal(o.heart, 5, 'a 6 is not a 10');
});

test('damage rules: Bump Stop caps at 5, Tough Hide ignores 2 or less, Lucky Number makes every 3rd Monster harmless', () => {
  const cap = game({ mine: ['MO-01'], dice: [1], ongoing: ['ON-63'], setCount: { 'MO-01': 3 } }); fight(cap); assert.equal(Dig.previewDamage(cap), 5); faceAll(cap); assert.equal(cap.heart, 5);
  const low = game({ mine: ['MO-01'], dice: [1], ongoing: ['ON-63'] }); fight(low); assert.equal(Dig.previewDamage(low), 1, 'the cap does not raise small damage');
  const hide = game({ mine: ['MO-02', 'MO-01'], dice: [1, 1], ongoing: ['ON-64'], setCount: { 'MO-01': 1 } });          // B#1 = 2 (ignored); A#2 = 3 (not)
  fight(hide); assert.equal(Dig.previewDamage(hide), 0); faceAll(hide); assert.equal(hide.heart, 10);
  fight(hide); assert.equal(Dig.previewDamage(hide), 3);
  const nth = game({ mine: ['MO-01', 'MO-01', 'MO-01', 'MO-01'], dice: [1, 1, 1, 1], ongoing: ['ON-65'] });
  const dmg = []; for (let i = 0; i < 4; i++) { fight(nth); dmg.push(Dig.previewDamage(nth)); faceAll(nth); }
  assert.deepEqual(dmg, [1, 3, 0, 7], 'A deals 1, 3, then the 3rd Monster is harmless, then 7');
});

test('Loaded Dice: an Extra Roll keeps the higher die; without it the new die replaces the old', () => {
  const k = game({ mine: ['MO-01'], dice: [8, 3], ongoing: ['ON-66'], start: { reroll: 1 } }); fight(k); Dig.reroll(k); assert.equal(k.fight.die, 8); assert.equal(k.reroll, 0);
  const u = game({ mine: ['MO-01'], dice: [3, 8], ongoing: ['ON-66'], start: { reroll: 1 } }); fight(u); Dig.reroll(u); assert.equal(u.fight.die, 8);
  const p = game({ mine: ['MO-01'], dice: [8, 3], start: { reroll: 1 } }); fight(p); Dig.reroll(p); assert.equal(p.fight.die, 3, 'the rule everyone plays by');
});

test('Free Spin: the first Extra Roll of a Dig costs nothing, even with none; the second is paid for', () => {
  const st = game({ mine: ['MO-01'], dice: [2, 3, 4], ongoing: ['ON-67'], start: { reroll: 0 } }); fight(st);
  assert.ok(Dig.can(st).reroll); assert.ok(Dig.freeSpin(st)); assert.ok(Dig.reroll(st)); assert.equal(st.reroll, 0);
  assert.ok(!Dig.can(st).reroll, 'the next one needs a real Extra Roll');
  const two = game({ mine: ['MO-01'], dice: [2, 3, 4], ongoing: ['ON-67'], start: { reroll: 2 } }); fight(two); Dig.reroll(two); assert.equal(two.reroll, 2); Dig.reroll(two); assert.equal(two.reroll, 1);
});

test('Phoenix Feather: the first BOOM from a Monster sets your Health to 4 and the card breaks; the second time you BOOM', () => {
  const st = game({ mine: ['MO-01', 'MO-01'], dice: [1, 1], ongoing: ['ON-68'], start: { heart: 3 }, setCount: { 'MO-01': 3 } });
  fight(st); assert.equal(Dig.previewDamage(st), 7); Dig.face(st);
  assert.equal(st.over, null); assert.equal(st.heart, 4); assert.equal(st.survived, 1); assert.ok(st.flags.phoenixUsed); assert.match(log(st), /set to 4 instead/);
  fight(st); Dig.face(st); assert.equal(st.over.kind, 'boom', 'it broke: the second time is BOOM');
  const small = game({ mine: ['MO-01'], dice: [1], ongoing: ['ON-68'], start: { heart: 5 } }); fight(small); Dig.face(small); assert.ok(!small.flags.phoenixUsed, 'a Monster that would not BOOM you does not use it up');
});

test('Hoarder\'s Chest and Full Tank: bonuses that depend on your tracks', () => {
  for (const [r, bonus] of [[0, 0], [2, 2], [3, 3], [4, 3]]) { const st = game({ mine: ['MO-01'], dice: [5], ongoing: ['ON-69'], start: { reroll: r } }); fight(st); assert.equal(Dig.result(st).total, 5 + bonus, r + ' Extra Rolls'); }
  for (const [h, bonus] of [[10, 2], [8, 2], [7, 0]]) { const st = game({ mine: ['MO-01'], dice: [5], ongoing: ['ON-70'], start: { heart: h } }); fight(st); assert.equal(Dig.result(st).total, 5 + bonus, h + ' Health'); }
  const st = game({ mine: ['MO-01'], dice: [5], ongoing: ['ON-69'], start: { reroll: 3 } }); fight(st); assert.match(Dig.dynamic(st, st.ongoing[0]), /\+3 to your rolls/);
});

test('Extra Roll economy: Overflow Valve pays when you have no room, Reroll Rebate pays when you spend one', () => {
  const o = game({ mine: ['IM-11'], ongoing: ['ON-71'], start: { reroll: 4, heart: 5 } }); Dig.dig(o); assert.equal(o.reroll, 4); assert.equal(o.heart, 8);
  const part = game({ mine: ['IM-11'], ongoing: ['ON-71'], start: { reroll: 3, heart: 5 } }); Dig.dig(part); assert.deepEqual([part.reroll, part.heart], [4, 8], 'one of the two did not fit');
  const roomy = game({ mine: ['IM-11'], ongoing: ['ON-71'], start: { reroll: 0, heart: 5 } }); Dig.dig(roomy); assert.deepEqual([roomy.reroll, roomy.heart], [2, 5]);
  const r = game({ mine: ['MO-01'], dice: [2, 3], ongoing: ['ON-72'], start: { reroll: 1, heart: 5 } }); fight(r); Dig.reroll(r); assert.equal(r.heart, 6);
});

test('result triggers: Consolation Prize on a low result, Hot Streak on a 10 or more — once per Monster, as you face it', () => {
  const lo = game({ mine: ['MO-01'], dice: [2], ongoing: ['ON-73'], start: { heart: 5 } }); fight(lo); assert.equal(lo.heart, 5, 'not yet'); Dig.face(lo); assert.equal(lo.heart, 5 - 1 + 2);
  const mid = game({ mine: ['MO-01'], dice: [5], ongoing: ['ON-73'], start: { heart: 5 } }); fight(mid); Dig.face(mid); assert.equal(mid.heart, 4);
  const hi = game({ mine: ['MO-01'], dice: [10], ongoing: ['ON-74'] }); fight(hi); Dig.face(hi); assert.equal(hi.reroll, 1);
  const up = game({ mine: ['MO-01'], dice: [8], ongoing: ['ON-74'], power: ['PW-61'] }); fight(up); Dig.trigger(up, up.line[1]); Dig.face(up); assert.equal(up.reroll, 1, 'a Power card raised 8 to 10 before you faced it (the Pet was left alone)');
});

test('Crowd Pleaser: three cards triggering on one roll pay 2 Health', () => {
  const st = game({ mine: ['MO-01'], dice: [6], ongoing: ['ON-75'], power: ['PW-02', 'PW-61', 'PW-62'], start: { heart: 5 }, setCount: { 'MO-01': 3 } });
  fight(st); Dig.triggerAll(st); assert.ok(st.heart >= 5 + 1 + 2 - 0, 'the heal and the +2 for three cards: ' + st.heart);
});

test('Smoke Bomb halves the next Monster, Decoy makes it harmless, Dull Claws steps every set back, Trapdoor drops a Monster to the bottom', () => {
  const sb = game({ mine: ['IM-60', 'MO-01'], dice: [1], setCount: { 'MO-01': 3 } }); Dig.dig(sb); fight(sb); assert.equal(Dig.previewDamage(sb), 3, '7 halved, rounded down');
  const dc = game({ mine: ['IM-61', 'MO-01'], dice: [1], setCount: { 'MO-01': 3 } }); Dig.dig(dc); fight(dc); assert.equal(Dig.previewDamage(dc), 0); faceAll(dc); assert.equal(dc.heart, 10);
  const next = game({ mine: ['IM-61', 'MO-01', 'MO-01'], dice: [1, 1] }); Dig.dig(next); fight(next); faceAll(next); fight(next); assert.equal(Dig.previewDamage(next), 3, 'it is for one Monster only');
  const dull = game({ mine: ['IM-62', 'MO-01'], dice: [1], setCount: { 'MO-01': 2, 'MO-02': 1, 'MO-03': 0 } }); Dig.dig(dull);
  assert.deepEqual([dull.setCount['MO-01'], dull.setCount['MO-02'], dull.setCount['MO-03']], [1, 0, 0]); fight(dull); assert.equal(Dig.previewDamage(dull), 3, 'the 2nd A, not the 3rd');
  const td = game({ mine: ['IM-63', 'TR-01', 'MO-01', 'TR-01'] }); Dig.dig(td); assert.deepEqual(td.mine.map(c => c.id), ['TR-01', 'TR-01', 'MO-01']);
  const none = game({ mine: ['IM-63', 'TR-01'] }); Dig.dig(none); assert.match(log(none), /no Monster in your Mine/);
});

test('Crimson Vial, Rejuvenating Spring and Sampler', () => {
  const v = game({ mine: ['IM-64'], start: { heart: 8 } }); Dig.dig(v); assert.deepEqual([v.heart, v.reroll], [5, 3]);
  const lethal = game({ mine: ['IM-64'], start: { heart: 3 } }); Dig.dig(lethal); assert.equal(lethal.over.kind, 'boom', 'it costs Health, and you may not have it');
  const s = game({ mine: ['IM-65'], start: { heart: 5 } }); Dig.dig(s); assert.deepEqual([s.heart, s.reroll], [7, 1]);
  const m = game({ mine: ['IM-66', 'TR-01', 'MO-01', 'TR-01'], start: { heart: 5 } }); Dig.dig(m); assert.equal(m.heart, 7); assert.equal(m.known, 3);
});

test('random play with the new cards in the Kit and the Mine: no crash, tracks stay in range, every Dig ends cleanly', () => {
  for (let seed = 1; seed <= 150; seed++) {
    const pool = fresh.slice(), kit = []; for (let i = 0; i < 4; i++) kit.push(pool.splice((seed * 7 + i * 13) % pool.length, 1)[0]);
    const extra = fresh.filter((_, i) => (i + seed) % 3 === 0);
    const st = Dig.start(cards, kit, { seed, extra });
    for (let guard = 0; guard < 400 && !st.over; guard++) {
      if (st.pending) { Dig.chooseClone && Dig.chooseClone(st, st.line[0]); st.pending = null; continue; }
      if (st.fight) { if (st.fight.phase === 'before') Dig.roll(st); else { if (Dig.can(st).reroll && st.fight.die < 4) Dig.reroll(st); Dig.autoFace(st); } }
      else if (st.survived >= 6 && Dig.can(st).bank) Dig.bank(st); else Dig.dig(st);
      assert.ok(st.heart >= 0 && st.heart <= 10 && st.reroll >= 0 && st.reroll <= 4, `seed ${seed}: tracks ${st.heart}/${st.reroll}`);
    }
    assert.ok(st.over, 'seed ' + seed + ' ended');
  }
});
