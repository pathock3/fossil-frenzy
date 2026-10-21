// A run: rounds of Dig + Prep, the Leaderboard and the Crown Jewel, for one player (the Run engine and the pledge rules of the Dig engine).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const { Dig, Run, Engine, DDB } = require('./load.js');
const cards = Engine.cards(Engine.parseCSV(fs.readFileSync(path.join(__dirname, 'cards-full.csv'), 'utf8')), DDB.columns);
const by = id => cards.find(c => c.id === id);
const RN = DDB.run;

// Run through the first Prep, choosing the offered cards in order, and begin round 1.
function firstRound(opts = {}) {
  const run = Run.start(cards, { seed: 11, ...opts });
  Run.openPack(run);
  const want = opts.keepIds;
  if (want) { run.prep.offer = want.map((id, i) => ({ ...by(id), uid: 7000 + i })); }
  for (const c of run.prep.offer.slice(0, Run.keepCount(run))) Run.toggleKeep(run, c.uid);
  Run.confirmKeep(run);
  return run;
}
// Replace the Dig's Mine and play it out: `plan` is a list of 'dig' / 'bank'; Monsters are rolled with `die`, no Grit.
function play(run, mine, plan, die = 1) {
  const st = run.dig; st.mine = mine.map((id, i) => ({ ...by(id), uid: 9000 + i })); st.dice = Array(50).fill(die);
  for (const a of plan) {
    if (a === 'bank') { assert.ok(Dig.bank(st), 'bank allowed'); continue; }
    assert.ok(Dig.dig(st), 'dig allowed');
    if (st.fight) { Dig.roll(st); Dig.autoFace(st); }
  }
  return st;
}

test('a run starts with the Booster Deck (every Booster card, by its count) and a Bronze Pack to open before round 1', () => {
  const run = Run.start(cards, { seed: 1 });
  assert.equal(run.deck.length, 103); assert.equal(run.round, 1); assert.equal(run.rounds, RN.rounds); assert.deepEqual(run.crown, { tracker: 3, holder: false });
  assert.equal(run.prep.step, 'pack'); assert.deepEqual(Run.packInfo(run), { name: 'Bronze', draw: 3, keep: 1 });
  assert.ok(run.deck.every(c => c.deck === 'Booster'));
});

test('Booster Pack: draw the pack\'s number of cards, keep exactly the keep number, the rest are trashed; then choose a Starter Kit', () => {
  const run = Run.start(cards, { seed: 1 });
  assert.ok(Run.openPack(run)); assert.equal(run.prep.offer.length, 3); assert.equal(run.deck.length, 100);
  assert.ok(!Run.confirmKeep(run), 'you must keep your cards first');
  const [a, b, c] = run.prep.offer;
  assert.ok(Run.toggleKeep(run, a.uid)); assert.ok(!Run.toggleKeep(run, b.uid), 'only one keep'); assert.ok(Run.toggleKeep(run, a.uid)); assert.ok(Run.toggleKeep(run, c.uid));
  assert.ok(Run.confirmKeep(run));
  assert.deepEqual(run.owned.map(x => x.uid), [c.uid]); assert.equal(run.trash.length, 2); assert.equal(run.prep.step, 'kit'); assert.equal(run.prep.kitMax, 1);
});

test('Starter Kit: up to the round tracker (1, 2, 2, 3); the Mine is the 25 starting cards plus every card you own that is not in the kit', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6].map(r => Run.kitSize({}, r)), [1, 2, 2, 3, 3, 3]);
  const run = firstRound({ keepIds: ['PW-10'] });
  assert.ok(!Run.toggleKit(run, 12345), 'only cards you own'); assert.ok(Run.toggleKit(run, run.owned[0].uid));
  Run.beginDig(run, { seed: 3 });
  assert.equal(run.phase, 'dig'); assert.equal(run.dig.line.length, 1, 'the Pet'); assert.equal(run.dig.mine.length, 26, 'the kit card is on top of the Mine'); assert.equal(run.dig.mine[0].id, 'PW-10');
  const r2 = firstRound({ keepIds: ['PW-10'] }); Run.beginDig(r2, { seed: 3 });   // no kit chosen: the card is shuffled into the Mine
  assert.equal(r2.dig.mine.length, 26); assert.equal(r2.dig.line.length, 1); assert.notEqual(r2.dig.mine[0].id, 'PW-10', 'a card not in the kit is shuffled in');
});

test('after a Dig the Mine is rebuilt from scratch: Drill reset, Power cards back at their numbers, everything shuffled in', () => {
  const run = firstRound({ keepIds: ['PW-25'] }); Run.toggleKit(run, run.owned[0].uid); Run.beginDig(run, { seed: 4 });
  play(run, ['TR-01', 'MO-01'], ['dig', 'dig', 'bank'], 1);
  Run.finishDig(run); run.prep.step = 'kit';
  Run.beginDig(run, { seed: 5 });
  assert.equal(run.dig.heart, DDB.rules.start.heart); assert.equal(run.dig.grit, 0); assert.equal(run.dig.reroll, 0);
  assert.equal(run.dig.mine.length + run.dig.kit.length, 26);
});

test('Escape Bonus: after banking, one roll of the die adds gems; gems = Geodes + Monsters survived + Escape Bonus', () => {
  const run = firstRound({ keepIds: ['PW-02'] }); Run.beginDig(run, { seed: 6 });
  play(run, ['TR-01', 'TR-01', 'TR-01', 'MO-01', 'TR-01'], ['dig', 'dig', 'dig', 'dig', 'dig', 'bank'], 6);
  Run.finishDig(run);
  assert.equal(run.prep.step, 'escape'); assert.equal(run.prep.banked, true);
  run.dice = [7]; assert.ok(Run.rollEscape(run));
  assert.deepEqual([run.prep.geodes, run.prep.monsters, run.prep.escape, run.prep.gems], [4, 1, 7, 12]);
  assert.deepEqual(Run.packInfo(run), { name: 'Silver', draw: 4, keep: 2 }, '12 gems');
  assert.ok(!Run.rollEscape(run), 'only once');
});

test('BOOM: no Escape Bonus, 0 gems, and a Bronze Pack', () => {
  const run = firstRound({ keepIds: ['PW-02'] }); Run.beginDig(run, { seed: 7 });
  run.dig.heart = 1; play(run, ['TR-01', 'MO-01'], ['dig', 'dig'], 1);
  assert.equal(run.dig.over.kind, 'boom');
  Run.finishDig(run);
  assert.equal(run.prep.step, 'pack'); assert.equal(run.prep.boom, true); assert.equal(run.prep.gems, 0); assert.deepEqual(Run.packInfo(run), { name: 'Bronze', draw: 3, keep: 1 });
  assert.equal(run.round, 2); assert.equal(run.prep.kitMax, 2);
});

test('the reward ladder (the owner\'s): gems -> draw:keep, in steps of 5', () => {
  const at = g => { const p = Run.ladderFor(g); return `${p.draw}:${p.keep}`; };
  assert.deepEqual([0, 4, 5, 9, 10, 14, 15, 19, 20, 24, 25, 29, 30, 34, 35, 99].map(at),
    ['3:1', '3:1', '4:1', '4:1', '4:2', '4:2', '5:2', '5:2', '5:3', '5:3', '6:3', '6:3', '6:4', '6:4', '7:4', '7:4']);
});

test('Leaderboard and Crown Jewel: the tracker starts at 3; banking above it takes the Crown and moves the tracker; BOOM locks in nothing', () => {
  const run = firstRound({ keepIds: ['PW-02'] }); Run.beginDig(run, { seed: 8 });
  run.dig.heart = 10;
  play(run, ['MO-01', 'MO-02', 'MO-01', 'TR-01'], ['dig', 'dig', 'dig', 'bank'], 10);          // three Monsters, each beaten by the Pet: survived 3, not more than 3
  Run.finishDig(run);
  assert.deepEqual([run.best, run.crown.tracker, run.crown.holder], [3, 3, false], 'matching the Crown is not the lead');
  run.prep.step = 'kit'; Run.beginDig(run, { seed: 9 });
  play(run, ['MO-01', 'MO-02', 'MO-01', 'MO-02'], ['dig', 'dig', 'dig', 'dig', 'bank'], 10);
  Run.finishDig(run);
  assert.deepEqual([run.best, run.crown.tracker, run.crown.holder], [4, 4, true]);
  run.prep.step = 'kit'; Run.beginDig(run, { seed: 10 });
  run.dig.heart = 1; play(run, ['MO-01', 'MO-01', 'MO-01'], ['dig'], 1);                      // die 1: the Pet does not trigger, 1 damage at 1 Health: BOOM
  assert.equal(run.dig.over.kind, 'boom'); Run.finishDig(run);
  assert.deepEqual([run.best, run.crown.tracker, run.crown.holder], [4, 4, true], 'BOOM leaves your best and the Crown alone');
  assert.deepEqual(run.history.map(h => [h.round, h.kind, h.survived, h.stoleCrown]), [[1, 'bank', 3, false], [2, 'bank', 4, true], [3, 'boom', 0, false]]);
});

test('Pledge: only once you have survived as many Monsters as the Crown tracker, and only your current number or 1 more; you cannot bank below it; BOOM removes it', () => {
  const run = firstRound({ keepIds: ['PW-02'] }); Run.beginDig(run, { seed: 12 });
  const st = run.dig; st.mine = ['MO-01', 'MO-02', 'MO-01', 'MO-02', 'MO-01'].map((id, i) => ({ ...by(id), uid: 9000 + i })); st.dice = Array(50).fill(10);
  assert.ok(!Dig.canPledge(st, 1) && !Dig.canPledge(st, 0), 'before the Crown you dig or bank freely');
  for (let i = 0; i < 3; i++) { Dig.dig(st); Dig.roll(st); Dig.autoFace(st); }
  assert.equal(st.survived, 3);
  assert.ok(!Dig.canPledge(st, 5) && !Dig.canPledge(st, 2), 'only 3 or 4'); assert.ok(Dig.canPledge(st, 3) && Dig.canPledge(st, 4));
  assert.ok(Dig.pledge(st, 4)); assert.equal(st.pledge, 4);
  assert.ok(!Dig.can(st).bank, 'cannot bank before reaching the pledge');
  Dig.dig(st); Dig.roll(st); Dig.autoFace(st);
  assert.ok(Dig.can(st).bank, 'reached it'); assert.ok(Dig.canPledge(st, 5) && Dig.canPledge(st, 4) === false);
  const st2 = Dig.start(cards, [], { seed: 5, board: { crown: 3 } }); st2.survived = 3; Dig.pledge(st2, 4); st2.heart = 1; st2.mine = [{ ...by('MO-01'), uid: 1 }]; st2.dice = [1]; Dig.dig(st2); Dig.roll(st2); Dig.autoFace(st2);
  assert.equal(st2.over.kind, 'boom'); assert.equal(st2.pledge, null);
});

test('the final round: no banking until you are in the lead (past the Crown tracker); then the run ends and the Crown Jewel is yours', () => {
  const run = Run.start(cards, { seed: 14, rounds: 2 });
  Run.openPack(run); Run.toggleKeep(run, run.prep.offer[0].uid); Run.confirmKeep(run); Run.beginDig(run, { seed: 1 });
  play(run, ['TR-01'], ['dig', 'bank'], 1); Run.finishDig(run);                              // round 1: survived 0, banked
  assert.equal(run.round, 2); assert.equal(run.phase, 'prep');
  run.dice = [4]; Run.rollEscape(run); Run.openPack(run); for (const c of run.prep.offer.slice(0, Run.keepCount(run))) Run.toggleKeep(run, c.uid); Run.confirmKeep(run); Run.beginDig(run, { seed: 2 });
  const st = run.dig; assert.ok(st.board.final);
  st.mine = ['TR-01', 'MO-01', 'MO-02', 'MO-01', 'MO-02', 'TR-01'].map((id, i) => ({ ...by(id), uid: 9100 + i })); st.dice = Array(30).fill(10);
  assert.ok(!Dig.can(st).bank, 'no banking in the final round');
  Dig.dig(st); for (let i = 0; i < 3; i++) { Dig.dig(st); Dig.roll(st); Dig.autoFace(st); }
  assert.equal(st.survived, 3); assert.ok(!Dig.can(st).bank, '3 only ties the Crown tracker');
  Dig.dig(st); Dig.roll(st); Dig.autoFace(st);
  assert.ok(Dig.can(st).bank, 'in the lead');
  Dig.bank(st); Run.finishDig(run);
  assert.equal(run.phase, 'done'); assert.deepEqual(run.result, { crown: true, best: 4, tracker: 4 });
});

test('the final round BOOM leaves the Crown on the table', () => {
  const run = Run.start(cards, { seed: 15, rounds: 1 });
  Run.openPack(run); Run.toggleKeep(run, run.prep.offer[0].uid); Run.confirmKeep(run); Run.beginDig(run, { seed: 1 });
  run.dig.heart = 1; play(run, ['MO-01'], ['dig'], 1); Run.finishDig(run);
  assert.equal(run.phase, 'done'); assert.equal(run.result.crown, false);
});

test('Mystery Box: when kept from a Booster Pack, also keep the top card of the Booster Deck', () => {
  const run = firstRound({ keepIds: ['IM-14', 'PW-02', 'PW-06'] });
  assert.equal(run.owned.length, 2); assert.equal(run.prep.extra.length, 1); assert.equal(run.deck.length, 103 - 3 - 1, '3 drawn for the pack (the test swaps them for chosen ones) and 1 more taken from the top');
});

test('optional Advanced trash: before opening a pack, trash a card you own for +1 draw each (off by default)', () => {
  const run = firstRound({ keepIds: ['PW-10'] }); Run.toggleKit(run, run.owned[0].uid); Run.beginDig(run, { seed: 1 });
  play(run, ['TR-01'], ['dig', 'bank'], 1); Run.finishDig(run); run.dice = [3]; Run.rollEscape(run);
  assert.ok(!Run.trashOwned(run, run.owned[0].uid), 'off by default');
  const on = firstRound({ keepIds: ['PW-10'], advancedTrash: true }); Run.toggleKit(on, on.owned[0].uid); Run.beginDig(on, { seed: 1 });
  play(on, ['TR-01'], ['dig', 'bank'], 1); Run.finishDig(on); on.dice = [3]; Run.rollEscape(on);
  assert.ok(Run.trashOwned(on, on.owned[0].uid)); assert.equal(on.owned.length, 0); assert.deepEqual(Run.packInfo(on), { name: 'Bronze', draw: 4, keep: 1 });
  Run.openPack(on); assert.equal(on.prep.offer.length, 4);
});

test('random runs of 5 rounds always finish, never lose or duplicate a Booster card, and the Dig screen always has a legal move', () => {
  const total = cards.filter(c => c.deck === 'Booster').reduce((a, c) => a + c.count, 0);
  for (let seed = 1; seed <= 60; seed++) {
    const rr = Dig.makeRng(seed * 13), run = Run.start(cards, { seed, rounds: 5 }); let guard = 0;
    while (run.phase !== 'done' && guard++ < 4000) {
      if (run.phase === 'prep') {
        const pr = run.prep;
        if (pr.step === 'escape') Run.rollEscape(run);
        else if (pr.step === 'pack') Run.openPack(run);
        else if (pr.step === 'keep') { for (const c of pr.offer.slice(0, Run.keepCount(run))) Run.toggleKeep(run, c.uid); Run.confirmKeep(run); }
        else if (pr.step === 'kit') { for (const c of run.owned.slice(0, pr.kitMax)) Run.toggleKit(run, c.uid); Run.beginDig(run); }
      } else {
        const st = run.dig, c = Dig.can(st);
        if (st.over) Run.finishDig(run);
        else if (c.choose) Dig.chooseClone(st, st.line[0]);
        else if (st.fight && st.fight.phase === 'before') Dig.roll(st);
        else if (st.fight) { if (c.reroll && rr() < .5) Dig.reroll(st); else Dig.autoFace(st); }
        else if (c.bank && st.survived >= 2 && rr() < .3) Dig.bank(st);
        else if (c.dig) Dig.dig(st); else assert.fail(`seed ${seed}: stuck ${JSON.stringify(c)}`);
      }
    }
    assert.equal(run.phase, 'done', `seed ${seed}`);
    const ids = [...run.deck, ...run.owned, ...run.trash].map(c => c.uid);
    assert.equal(new Set(ids).size, ids.length, 'no duplicates'); assert.equal(ids.length, total, `seed ${seed}: every Booster card is in the deck, owned or trashed`);
  }
});

test('saving and resuming: a Dig and a run survive a reload — same cards, same next dice and shuffles, nothing duplicated or lost', () => {
  const roundtrip = o => JSON.parse(JSON.stringify(o));
  const step = st => { const c = Dig.can(st); if (c.choose) Dig.chooseClone(st, st.line[0]); else if (st.fight && st.fight.phase === 'before') { if (c.grit && st.survived % 2 === 0) Dig.spendGrit(st); else Dig.roll(st); } else if (st.fight) { if (c.reroll && st.fight.die < 5) Dig.reroll(st); else Dig.autoFace(st); } else if (c.dig) Dig.dig(st); else return false; return true; };
  for (let seed = 1; seed <= 40; seed++) {
    const kit = ['PW-10', 'ON-33', 'IM-13', 'ON-36', 'PW-25'].map(by).slice(0, 1 + seed % 5);
    const a = Dig.start(cards, kit, { seed, board: { crown: 3 }, start: { grit: 4, reroll: 2 } });
    for (let i = 0; i < 6 + (seed % 15) && !a.over; i++) step(a);
    const b = Dig.load(cards, roundtrip(Dig.save(a)));
    for (let i = 0; i < 80 && !a.over; i++) { assert.ok(step(a)); assert.ok(step(b)); }
    assert.equal(b.heart, a.heart); assert.equal(b.survived, a.survived); assert.deepEqual(b.log.map(l => l.text), a.log.map(l => l.text), `seed ${seed}: the resumed Dig plays out the same`);
    assert.deepEqual(b.line.map(e => [e.card.id, e.at]), a.line.map(e => [e.card.id, e.at]));
    assert.deepEqual(b.mine.map(c => c.id), a.mine.map(c => c.id));
  }
  const run = firstRound({ keepIds: ['PW-10'] }); Run.toggleKit(run, run.owned[0].uid);
  const r2 = Run.load(cards, roundtrip(Run.save(run)));
  assert.deepEqual(r2.owned.map(c => c.id), run.owned.map(c => c.id)); assert.equal(r2.deck.length, run.deck.length); assert.deepEqual(r2.prep.kitPick, run.prep.kitPick);
  assert.ok(Run.beginDig(r2, { seed: 3 })); assert.equal(r2.dig.line.length, 1); assert.equal(r2.dig.mine[0].id, r2.kit[0].id);
  const r3 = Run.load(cards, roundtrip(Run.save(r2))); assert.equal(r3.dig.mine[0].uid, r2.dig.mine[0].uid);
  play(r3, ['TR-01', 'MO-01'], ['dig', 'dig', 'bank'], 10); Run.finishDig(r3);
  const r4 = Run.load(cards, roundtrip(Run.save(r3))); assert.equal(r4.prep.step, 'escape'); r4.dice = [5]; assert.ok(Run.rollEscape(r4)); assert.equal(r4.prep.escape, 5);
  assert.equal(new Set([...r4.deck, ...r4.owned, ...r4.trash].map(c => c.uid)).size, r4.deck.length + r4.owned.length + r4.trash.length);
});

test('the Board changes the moment a Dig ends: a bank locks in and may take the Crown at once, a BOOM removes the Pledge marker (no waiting for Prep)', () => {
  const run = firstRound({ keepIds: ['PW-02'] }); Run.beginDig(run, { seed: 20 });
  const st = run.dig; st.mine = Array.from({ length: 6 }, (_, i) => ({ ...by(i % 2 ? 'MO-02' : 'MO-01'), uid: 9400 + i })); st.dice = Array(30).fill(10);
  for (let i = 0; i < 4; i++) { Dig.dig(st); Dig.roll(st); Dig.autoFace(st); }
  assert.ok(Run.pledge(run, 5)); assert.equal(Board.marker(run.board, 'me', 'pledge').n, 5);
  assert.ok(!Run.pledge(run, 4), 'a pledge cannot be lowered');
  assert.ok(!Run.bank(run), 'cannot bank below the pledge');
  Dig.dig(st); Dig.roll(st); Dig.autoFace(st);
  assert.ok(Run.bank(run)); assert.equal(run.crown.holder, true, 'the Crown moved at the moment of banking'); assert.equal(run.crown.tracker, 5); assert.equal(run.best, 5);
  assert.equal(Board.marker(run.board, 'me', 'pledge'), null);
  const r2 = firstRound({ keepIds: ['PW-02'] }); Run.beginDig(r2, { seed: 21 });
  const s2 = r2.dig; s2.mine = Array.from({ length: 6 }, (_, i) => ({ ...by('MO-01'), uid: 9500 + i })); s2.dice = Array(30).fill(10);
  for (let i = 0; i < 3; i++) { Dig.dig(s2); Dig.roll(s2); Dig.autoFace(s2); }
  Run.pledge(r2, 4); assert.ok(Board.marker(r2.board, 'me', 'pledge'));
  s2.heart = 1; s2.dice = [1]; Dig.dig(s2); Dig.roll(s2); Dig.autoFace(s2);
  assert.equal(s2.over.kind, 'boom'); Run.checkOver(r2);
  assert.equal(Board.marker(r2.board, 'me', 'pledge'), null, 'BOOM removed the Pledge marker right away');
  Run.finishDig(r2); assert.equal(r2.history[0].kind, 'boom');
});

test('the Dig\'s copy of the Leaderboard is refreshed from the live Board before it is asked (another player can change what it takes to lead)', () => {
  const run = Run.start(cards, { seed: 30, rounds: 2 }); Run.openPack(run); Run.toggleKeep(run, run.prep.offer[0].uid); Run.confirmKeep(run); Run.beginDig(run, { seed: 1 });
  run.board.players.push({ id: 'ai', name: 'AI', color: '#000' });
  const first = run.dig; Dig.bank(first); Run.checkOver(run); Run.finishDig(run);
  run.dice = [3]; Run.rollEscape(run); Run.openPack(run); for (const c of run.prep.offer.slice(0, Run.keepCount(run))) Run.toggleKeep(run, c.uid); Run.confirmKeep(run); Run.beginDig(run, { seed: 2 });
  const st = run.dig; st.mine = Array.from({ length: 9 }, (_, i) => ({ ...by(i % 2 ? 'MO-02' : 'MO-01'), uid: 9600 + i })); st.dice = Array(40).fill(10);
  assert.equal(st.board.leadN, 4);
  Board.lockIn(run.board, 'ai', 7);                       // the AI banks 7 while I am digging
  Run.refresh(run); assert.equal(st.board.leadN, 8); assert.equal(st.board.crown, 7);
  for (let i = 0; i < 7; i++) { Dig.dig(st); Dig.roll(st); Dig.autoFace(st); }
  assert.ok(!Dig.can(st).bank, '7 only ties the AI, and the AI has the better spot: banking now would not lead');
  Dig.dig(st); Dig.roll(st); Dig.autoFace(st); assert.ok(Dig.can(st).bank);
});
