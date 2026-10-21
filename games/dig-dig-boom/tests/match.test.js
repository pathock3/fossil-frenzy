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
    if (!humanPolicy(me)) throw new Error('the human policy is stuck');
    Run.checkOver(me);
    if (st.digs > before && !me.dig.over) Match.aiStep(m);
  }
  assert.ok(me.dig.over, 'the human Dig ended');
}
function prepHuman(m) {
  const me = Match.human(m);
  if (me.prep.step === 'escape') Match.rollEscape(m);
  AI.prep(me);
  assert.equal(me.prep.step, 'kit'); assert.ok(Match.beginRound(m));
}
function playMatch(seed, rounds = 3) {
  const m = Match.start(cards, { seed, rounds });
  for (let r = 1; r <= rounds; r++) {
    if (r === 1) { AI.prep(Match.human(m)); assert.ok(Match.beginRound(m)); } else prepHuman(m);
    playRound(m); assert.ok(Match.finishRound(m));
  }
  return m;
}

test('the Board updates by itself: your live marker follows every Monster you survive, a BOOM clears it, a bank locks the score in', () => {
  const run = Run.start(cards, { seed: 5, rounds: 2 }); Run.openPack(run); Run.toggleKeep(run, run.prep.offer[0].uid); Run.confirmKeep(run); Run.beginDig(run, { seed: 1 });
  const st = run.dig; st.mine = ['MO-01', 'MO-02', 'MO-01', 'MO-02'].map((id, i) => ({ ...by(id), uid: 9900 + i })); st.dice = Array(30).fill(10);
  Run.refresh(run); assert.equal(Board.marker(run.board, 'me', 'pledge'), null, 'nothing survived yet');
  for (let i = 1; i <= 3; i++) { Dig.dig(st); Dig.roll(st); Dig.autoFace(st); Run.refresh(run); assert.equal(Board.marker(run.board, 'me', 'pledge').n, i, 'the marker is on your number'); }
  assert.ok(Run.pledge(run, 4)); assert.equal(Board.marker(run.board, 'me', 'pledge').n, 4, 'a pledge puts it ahead');
  Dig.dig(st); Dig.roll(st); Dig.autoFace(st); Run.refresh(run); assert.equal(Board.marker(run.board, 'me', 'pledge').n, 4, 'it stays until you catch up');
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

test('a match: you and the AI share a Leaderboard, one Booster Deck and one Trash; the AI has already opened its first pack', () => {
  const m = Match.start(cards, { seed: 3, rounds: 3 });
  assert.equal(Match.human(m).board, Match.bot(m).board); assert.equal(Match.human(m).deck, Match.bot(m).deck);
  assert.deepEqual(m.board.players.map(p => p.id), ['me', 'ai']);
  const ai = Match.bot(m); assert.equal(ai.prep.step, 'kit'); assert.equal(ai.owned.length, 1); assert.equal(ai.prep.kitPick.length, 1);
  assert.equal(m.deck.length + m.trash.length + Match.human(m).owned.length + ai.owned.length, boosterTotal);
});

test('the AI digs one card each time you dig one, and finishes its Dig as soon as yours is over', () => {
  const m = Match.start(cards, { seed: 4, rounds: 2 });
  AI.prep(Match.human(m)); Match.beginRound(m);
  const ai = Match.bot(m); const d0 = ai.dig.digs;
  Match.aiStep(m); assert.equal(ai.dig.digs, d0 + 1, 'one card');
  Match.aiStep(m); assert.equal(ai.dig.digs, d0 + 2);
  const me = Match.human(m).dig; me.heart = 1; me.mine = [{ ...by('MO-01'), uid: 9800 }]; me.dice = [1]; Dig.dig(me); Dig.roll(me); Dig.autoFace(me); Run.checkOver(Match.human(m));
  assert.equal(me.over.kind, 'boom'); assert.ok(!ai.dig.over); Match.settle(m); assert.ok(ai.dig.over, 'the AI is done too');
});

test('the AI banks when that would put it in the lead, and in the final round takes the Crown at once when it can', () => {
  const m = Match.start(cards, { seed: 6, rounds: 1 });
  AI.prep(Match.human(m)); Match.beginRound(m);
  const ai = Match.bot(m), st = ai.dig; st.mine = Array.from({ length: 8 }, (_, i) => ({ ...by(i % 2 ? 'MO-02' : 'MO-01'), uid: 9700 + i })); st.dice = Array(60).fill(10);
  let steps = 0; while (!st.over && steps++ < 100) { Match.aiStep(m); }
  assert.equal(st.over.kind, 'bank'); assert.equal(st.survived, 4, 'it stopped as soon as it was past the Crown tracker (3)');
  assert.equal(Board.holder(m.board), 'ai');
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
  AI.prep(me); Match.beginRound(m);
  me.dig.mine = ['TR-01', 'TR-01'].map((id, i) => ({ ...by(id), uid: 9600 + i })); Dig.dig(me.dig); Dig.bank(me.dig); Run.checkOver(me);
  ai.dig.mine = ['TR-01'].map((id, i) => ({ ...by(id), uid: 9650 + i })); ai.dig.over || (Dig.dig(ai.dig), Dig.bank(ai.dig)); Run.checkOver(ai);
  assert.ok(Match.finishRound(m));
  assert.equal(me.prep.step, 'escape'); assert.equal(ai.prep.step, 'escape');
  assert.equal(Match.rollEscape(m), 7); assert.equal(me.prep.escape, 7); assert.equal(ai.prep.escape, 7);
  assert.equal(ai.prep.step, 'kit', 'and the AI carries on with its own Prep');
});

test('if you go BOOM but the AI banked, the Escape Bonus is rolled for it without waiting for you', () => {
  const m = Match.start(cards, { seed: 9, rounds: 2, dice: [4] });
  const me = Match.human(m), ai = Match.bot(m);
  AI.prep(me); Match.beginRound(m);
  me.dig.heart = 1; me.dig.mine = [{ ...by('MO-01'), uid: 9500 }]; me.dig.dice = [1]; Dig.dig(me.dig); Dig.roll(me.dig); Dig.autoFace(me.dig); Run.checkOver(me);
  ai.dig.mine = ['TR-01', 'TR-01'].map((id, i) => ({ ...by(id), uid: 9550 + i })); Dig.dig(ai.dig); Dig.bank(ai.dig); Run.checkOver(ai);
  Match.finishRound(m);
  assert.equal(me.prep.step, 'pack'); assert.equal(me.prep.gems, 0); assert.equal(ai.prep.escape, 4); assert.equal(m.escape, 4);
});

test('a match saves and resumes exactly, mid-Dig and mid-Prep', () => {
  for (let seed = 1; seed <= 12; seed++) {
    const a = Match.start(cards, { seed, rounds: 3 });
    AI.prep(Match.human(a)); Match.beginRound(a);
    const stepA = m => { const me = Match.human(m), st = me.dig; if (st.over) return false; const before = st.digs; AI.act(me); Run.checkOver(me); if (st.digs > before && !st.over) Match.aiStep(m); return true; };
    for (let i = 0; i < 6 + seed; i++) stepA(a);
    const b = Match.load(cards, roundtrip(Match.save(a)));
    for (let i = 0; i < 60; i++) { const x = stepA(a), y = stepA(b); assert.equal(x, y); }
    assert.deepEqual(roundtrip(Match.save(b).board), roundtrip(Match.save(a).board), `seed ${seed}: the same Leaderboard`);
    assert.deepEqual(Match.bot(b).dig.log.map(l => l.text), Match.bot(a).dig.log.map(l => l.text), `seed ${seed}: the AI played the same`);
    if (Match.human(a).dig.over) { Match.finishRound(a); Match.finishRound(b); const c = Match.load(cards, roundtrip(Match.save(b))); assert.equal(c.runs.me.prep && c.runs.me.prep.step, a.runs.me.prep && a.runs.me.prep.step); }
  }
});
