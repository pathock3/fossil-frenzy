// You against the most basic AI: one Leaderboard, one Booster Deck, one Trash; the Board updates by itself.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const { Dig, Board, Run, AI, Match, Engine, DDB } = require('./load.js');
const cards = Engine.cards(Engine.parseCSV(fs.readFileSync(path.join(__dirname, 'cards-full.csv'), 'utf8')), DDB.columns);
const by = id => cards.find(c => c.id === id);
const boosterTotal = cards.filter(c => c.deck === 'Booster').reduce((a, c) => a + c.count, 0);
const roundtrip = o => JSON.parse(JSON.stringify(o));

// Play one whole round for the human with the same basic policy as the AI (so the test needs no screen), the AI stepping once per card dug.
function playRound(m, { humanPolicy = AI.act } = {}) {
  const me = Match.human(m); let guard = 0;
  while (!me.dig.over && guard++ < 2000) {
    const st = me.dig, before = st.digs;
    if (!humanPolicy(me)) { if (Match.finalCheck(m)) continue; if (!Match.aiStep(m)) throw new Error('the human policy is stuck'); continue; }       // the final-round leader waits while the AI digs
    Run.checkOver(me); Match.finalCheck(m);
    if (st.digs > before && !me.dig.over) Match.aiStep(m);
  }
  assert.ok(me.dig.over, 'the human Dig ended');
}
function prepHuman(m) {
  const me = Match.human(m);
  if (me.prep.step === 'escape') Match.rollEscape(m);
  assert.ok(Match.openPack(m)); AI.prep(me);          // the AI opens its pack as you open yours
  assert.equal(me.prep.step, 'kit'); assert.ok(Match.beginRound(m));
}
function playMatch(seed, rounds = 3) {
  const m = Match.start(cards, { seed, rounds });
  for (let r = 1; r <= rounds; r++) {
    prepHuman(m);
    playRound(m); assert.ok(Match.finishRound(m));
  }
  return m;
}

test('the Board updates by itself: your live marker follows every Monster you encounter, a BOOM clears it, a bank locks the score in', () => {
  const run = Run.start(cards, { seed: 5, rounds: 2 }); Run.openPack(run); Run.toggleKeep(run, run.prep.offer[0].uid); Run.confirmKeep(run); Run.beginDig(run, { seed: 1 });
  const st = run.dig; st.mine = ['MO-01', 'MO-02', 'MO-01', 'MO-02'].map((id, i) => ({ ...by(id), uid: 9900 + i })); st.dice = Array(30).fill(10);
  Run.refresh(run); assert.equal(Board.marker(run.board, 'me', 'pledge'), null, 'nothing survived yet');
  for (let i = 1; i <= 3; i++) { Dig.dig(st); Run.refresh(run); assert.equal(Board.marker(run.board, 'me', 'pledge').n, i, 'the marker moves the moment you ENCOUNTER the Monster, before you face it'); Dig.roll(st); Dig.autoFace(st); Run.refresh(run); assert.equal(Board.marker(run.board, 'me', 'pledge').n, i, 'and stays there once you survive it'); }
  assert.ok(!Run.pledge(run, 4), 'there is no pledging in the app: nothing to say, the marker already moves for you');
  Dig.dig(st); Dig.roll(st); Dig.autoFace(st); Run.refresh(run); assert.equal(Board.marker(run.board, 'me', 'pledge').n, 4, 'the marker follows the fourth Monster at once');
  assert.ok(Run.bank(run)); assert.equal(Board.marker(run.board, 'me', 'pledge'), null); assert.equal(run.best, 4);
});

test('the live marker takes the best open spot under each number, so the first to get there is ahead', () => {
  const b = Board.create([{ id: 'a' }, { id: 'b' }]);
  Board.track(b, 'a', 3); Board.track(b, 'b', 3);
  assert.equal(Board.marker(b, 'a', 'pledge').rank, 1); assert.equal(Board.marker(b, 'b', 'pledge').rank, 2);
  Board.track(b, 'a', 3); assert.equal(Board.marker(b, 'a', 'pledge').rank, 1, 'standing still changes nothing');
  Board.lockIn(b, 'b', 3); Board.lockIn(b, 'a', 3);
  assert.deepEqual([Board.marker(b, 'a', 'best').rank, Board.marker(b, 'b', 'best').rank], [1, 2], 'the spots you reached first are the spots you lock in');
});

test('a match: you and the AI share a Leaderboard, one Booster Deck and one Trash; you prep at the same time, the AI opening its pack when you open yours', () => {
  const m = Match.start(cards, { seed: 3, rounds: 3 });
  assert.equal(Match.human(m).board, Match.bot(m).board); assert.equal(Match.human(m).deck, Match.bot(m).deck);
  assert.deepEqual(m.board.players.map(p => p.id), ['me', 'ai']);
  const ai = Match.bot(m); assert.equal(ai.prep.step, 'pack', 'the AI has not opened anything before you');
  assert.ok(Match.openPack(m)); assert.equal(Match.human(m).prep.step, 'keep'); assert.equal(Match.human(m).prep.offer.length, 3);
  assert.equal(ai.prep.step, 'kit'); assert.equal(ai.owned.length, 1); assert.equal(ai.prep.kitPick.length, 1);
  assert.equal(Match.human(m).owned.length, 0, 'you have not chosen yet'); AI.prep(Match.human(m));
  assert.equal(m.deck.length + m.trash.length + Match.human(m).owned.length + ai.owned.length, boosterTotal);
});

test('a step of the AI is one card dug (the screen\'s clock calls it); settle finishes its Dig', () => {
  const m = Match.start(cards, { seed: 4, rounds: 2 });
  Match.openPack(m); AI.prep(Match.human(m)); Match.beginRound(m);
  const ai = Match.bot(m); const d0 = ai.dig.digs;
  Match.aiStep(m); assert.equal(ai.dig.digs, d0 + 1, 'one card');
  Match.aiStep(m); assert.equal(ai.dig.digs, d0 + 2);
  const me = Match.human(m).dig; me.heart = 1; me.mine = [{ ...by('MO-01'), uid: 9800 }]; me.dice = [1]; Dig.dig(me); Dig.roll(me); Dig.autoFace(me); Run.checkOver(Match.human(m));
  assert.equal(me.over.kind, 'boom'); assert.ok(!ai.dig.over); Match.settle(m); assert.ok(ai.dig.over, 'the AI is done too');
});

const aiDig = (seed, rounds, heart) => {
  const m = Match.start(cards, { seed, rounds });
  Match.openPack(m); AI.prep(Match.human(m)); Match.beginRound(m);
  const ai = Match.bot(m), st = ai.dig; st.mine = Array.from({ length: 8 }, (_, i) => ({ ...by(i % 2 ? 'MO-02' : 'MO-01'), uid: 9700 + i })); st.dice = Array(60).fill(10); st.heart = heart;
  return { m, ai, st };
};

test('the AI banks to take the lead when it is not confident (low-ish Health)', () => {
  const { m, st } = aiDig(6, 2, 5);
  let steps = 0; while (!st.over && steps++ < 100) Match.aiStep(m);
  assert.equal(st.over.kind, 'bank'); assert.equal(st.survived, 4, 'it stopped as soon as it was past the Crown tracker (3)');
  assert.equal(Board.holder(m.board), 'ai');
});

test('the final round is a race: the AI never banks, waits once it is in the lead, digs again if you pass it, and stands when you go BOOM', () => {
  const { m, ai, st } = aiDig(6, 1, 5);
  const me = Match.human(m);
  let steps = 0; while (steps++ < 40) Match.aiStep(m);
  assert.ok(!st.over, 'it did not bank'); assert.equal(st.survived, 4, 'it dug to 4 (past the tracker, ahead of you) and then waited');
  assert.ok(!Dig.can(st).bank);
  me.dig.mine = Array.from({ length: 8 }, (_, i) => ({ ...by(i % 2 ? 'MO-02' : 'MO-01'), uid: 9300 + i })); me.dig.dice = Array(40).fill(10);
  for (let i = 0; i < 5; i++) { Dig.dig(me.dig); Dig.roll(me.dig); Dig.autoFace(me.dig); Run.refresh(me); }
  assert.ok(me.dig.board.lead, 'you passed it with 5'); Match.aiStep(m); assert.equal(st.survived, 5, 'so it had to dig again (and matched you, but you were there first)');
  Match.aiStep(m); assert.equal(st.survived, 6, 'and it digs on until it is ahead of you');
  me.dig.heart = 1; me.dig.dice = [1]; Dig.dig(me.dig); Dig.roll(me.dig); Dig.autoFace(me.dig); Run.checkOver(me);
  assert.equal(me.dig.over.kind, 'boom'); Match.aiStep(m);
  assert.ok(st.over && st.over.held, 'you are out and it is in the lead: it stands'); assert.equal(Board.holder(m.board), 'ai');
});

test('the AI does not bank for the lead while it is confident it can go further (high Health), but banks at 3 Health or less', () => {
  const hi = aiDig(6, 2, 10); for (let i = 0; i < 6; i++) Match.aiStep(hi.m);
  assert.ok(!hi.st.over, 'still digging'); assert.equal(hi.st.survived, 6, 'well past the Crown tracker without banking');
  const lo = aiDig(6, 2, 3); let steps = 0; while (!lo.st.over && steps++ < 20) Match.aiStep(lo.m);
  assert.equal(lo.st.over.kind, 'bank'); assert.equal(lo.st.survived, 1, 'low on Health: it banks after the first Monster');
});

test('the AI spends Grit for any useful effect (the Pet first), and rerolls when it wants an effect it did not get', () => {
  const fight = (grit, lineAts, dice, rerolls = 0) => {
    const { ai, st } = aiDig(7, 2, 10); st.grit = grit; st.reroll = rerolls; st.dice = dice.slice();
    st.line = lineAts.map(([id, at, pet]) => ({ card: { ...by(id), uid: 9800 + at }, at, base: at, ...(pet ? { pet: true } : {}) }));
    st.mine = [{ ...by('MO-01'), uid: 9899 }, ...st.mine]; Dig.dig(st); Dig.roll(st);
    return { ai, st };
  };
  let { ai, st } = fight(6, [['PW-02', 10, true]], [7]);                 // 7 on the die, Pet at 10: 3 more needs 9 Grit: out of reach (2 buys)
  assert.equal(Dig.result(st).total, 7); AI.act(ai); assert.equal(st.grit, 6, 'cannot reach the Pet by Grit, and has no rerolls: it keeps its Grit and takes the damage');
  ({ ai, st } = fight(6, [['PW-02', 9, true]], [7])); AI.act(ai); AI.act(ai); assert.equal(st.grit, 0, 'two Grit buys (6 Grit) reach the Pet at 9'); assert.equal(Dig.result(st).total, 9);
  ({ ai, st } = fight(3, [['TR-01', 8]], [7])); AI.act(ai); assert.equal(st.grit, 0, 'any useful card: 3 Grit for +1 reaches the 8'); assert.equal(Dig.result(st).total, 8);
  ({ ai, st } = fight(0, [['PW-02', 10, true]], [2, 9], 2)); AI.act(ai); assert.equal(st.fight.rolls, 2, 'the Pet is out of reach: it rerolled');
});

test('a whole match: the AI and a second AI-policy player finish 3 rounds, every card is somewhere, and the Board is consistent', () => {
  for (let seed = 1; seed <= 25; seed++) {
    const m = playMatch(seed, 3);
    assert.equal(Match.human(m).phase, 'done'); assert.ok(m.result, `seed ${seed}: a result`);
    const ids = [...m.deck, ...m.trash, ...Match.human(m).owned, ...Match.bot(m).owned].map(c => c.uid);
    assert.equal(new Set(ids).size, ids.length, `seed ${seed}: no card twice`); assert.equal(ids.length, boosterTotal, `seed ${seed}: no card lost`);
    for (const p of m.board.players) for (const kind of ['best', 'pledge']) {
      let n = 0; for (const row of Object.values(m.board.spots)) for (const sp of row) if (sp && sp.pid === p.id && sp.kind === kind) n++;
      assert.ok(n <= 1, `seed ${seed}: ${p.id} has ${n} ${kind} markers`);
    }
    for (const p of m.board.players) assert.equal(Board.marker(m.board, p.id, 'pledge'), null, 'nobody is mid-Dig at the end');
    const lead = Board.leader(m.board); assert.equal(m.result.winner, lead ? lead.pid : null);
  }
});

test('the Escape Bonus is one roll for the table: whoever banked adds the same number', () => {
  const m = Match.start(cards, { seed: 8, rounds: 2, dice: [7] });
  const me = Match.human(m), ai = Match.bot(m);
  Match.openPack(m); AI.prep(me); Match.beginRound(m);
  me.dig.mine = ['TR-01', 'TR-01'].map((id, i) => ({ ...by(id), uid: 9600 + i })); Dig.dig(me.dig); Dig.bank(me.dig); Run.checkOver(me);
  ai.dig.mine = ['TR-01'].map((id, i) => ({ ...by(id), uid: 9650 + i })); ai.dig.over || (Dig.dig(ai.dig), Dig.bank(ai.dig)); Run.checkOver(ai);
  assert.ok(Match.finishRound(m));
  assert.equal(me.prep.step, 'escape'); assert.equal(ai.prep.step, 'escape');
  assert.equal(Match.rollEscape(m), 7); assert.equal(me.prep.escape, 7); assert.equal(ai.prep.escape, 7);
  assert.equal(ai.prep.step, 'pack', 'the AI preps when you open your pack, not before'); assert.ok(Match.openPack(m)); assert.equal(ai.prep.step, 'kit');
});

test('if you go BOOM but the AI banked, the Escape Bonus is rolled for it without waiting for you', () => {
  const m = Match.start(cards, { seed: 9, rounds: 2, dice: [4] });
  const me = Match.human(m), ai = Match.bot(m);
  Match.openPack(m); AI.prep(me); Match.beginRound(m);
  me.dig.heart = 1; me.dig.mine = [{ ...by('MO-01'), uid: 9500 }]; me.dig.dice = [1]; Dig.dig(me.dig); Dig.roll(me.dig); Dig.autoFace(me.dig); Run.checkOver(me);
  ai.dig.mine = ['TR-01', 'TR-01'].map((id, i) => ({ ...by(id), uid: 9550 + i })); Dig.dig(ai.dig); Dig.bank(ai.dig); Run.checkOver(ai);
  Match.finishRound(m);
  assert.equal(me.prep.step, 'pack'); assert.equal(me.prep.gems, 0); assert.equal(ai.prep.escape, 4); assert.equal(m.escape, 4);
});

test('a match saves and resumes exactly, mid-Dig and mid-Prep', () => {
  for (let seed = 1; seed <= 12; seed++) {
    const a = Match.start(cards, { seed, rounds: 3 });
    Match.openPack(a); AI.prep(Match.human(a)); Match.beginRound(a);
    const stepA = m => { const me = Match.human(m), st = me.dig; if (st.over) return false; const before = st.digs; AI.act(me); Run.checkOver(me); if (st.digs > before && !st.over) Match.aiStep(m); return true; };
    for (let i = 0; i < 6 + seed; i++) stepA(a);
    const b = Match.load(cards, roundtrip(Match.save(a)));
    for (let i = 0; i < 60; i++) { const x = stepA(a), y = stepA(b); assert.equal(x, y); }
    assert.deepEqual(roundtrip(Match.save(b).board), roundtrip(Match.save(a).board), `seed ${seed}: the same Leaderboard`);
    assert.deepEqual(Match.bot(b).dig.log.map(l => l.text), Match.bot(a).dig.log.map(l => l.text), `seed ${seed}: the AI played the same`);
    if (Match.human(a).dig.over) { Match.finishRound(a); Match.finishRound(b); const c = Match.load(cards, roundtrip(Match.save(b))); assert.equal(c.runs.me.prep && c.runs.me.prep.step, a.runs.me.prep && a.runs.me.prep.step); }
  }
});
