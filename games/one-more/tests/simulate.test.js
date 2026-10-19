// A quick computer-versus-computer sanity run (a few hundred games at most). The long version for tuning is in tools/.
const test = require('node:test');
const assert = require('node:assert/strict');
const { GAME_DATA, Bots } = require('./load');

const STYLES = GAME_DATA.styles.map(s => s.id);

function table(styles, games, seedBase = 0) {
  const wins = Object.fromEntries(STYLES.map(s => [s, 0])), seen = Object.fromEntries(STYLES.map(s => [s, 0]));
  let ties = 0, steps = 0, finished = 0;
  for (let g = 0; g < games; g++) {
    const order = styles.map((_, i) => styles[(i + g) % styles.length]);            // rotate who sits first
    const r = Bots.playGame({ styles: order, seed: seedBase + g + 1 });
    finished += r.state.over ? 1 : 0; steps += r.steps;
    order.forEach(s => { seen[s]++; });
    if (r.result.tie) ties++;
    else wins[order[r.result.winners[0]]]++;
  }
  return { wins, seen, ties, steps, finished };
}

test('simulation: 2 players — every pairing of styles finishes; nobody wins everything; ties are rare but real', () => {
  const out = [];
  for (const [a, b] of [['careful', 'steady'], ['steady', 'daring'], ['careful', 'daring']]) {
    const t = table([a, b], 60);
    assert.equal(t.finished, 60);
    assert.ok(t.wins[a] >= 10 && t.wins[b] >= 10, `${a} v ${b}: ${JSON.stringify(t.wins)}`);
    assert.ok(t.ties < 20, 'ties are the exception');
    out.push(`${a} v ${b}: ${t.wins[a]}-${t.wins[b]} (${t.ties} ties)`);
  }
  if (process.env.SHOW) console.log(out.join('\n'));
});

test('simulation: 3–6 players — all games finish and every style wins its share', () => {
  const out = [];
  for (const n of [3, 4, 6]) {
    const styles = Array.from({ length: n }, (_, i) => STYLES[i % 3]);
    const t = table(styles, 30, 1000);
    assert.equal(t.finished, 30);
    for (const s of STYLES) assert.ok(t.wins[s] >= 1, `${n} players: ${s} never won: ${JSON.stringify(t.wins)}`);
    out.push(`${n} players: ${JSON.stringify(t.wins)} ties ${t.ties}`);
  }
  if (process.env.SHOW) console.log(out.join('\n'));
});

test('simulation: games are a sensible length', () => {
  const t = table(['steady', 'steady'], 40, 500);
  const perGame = t.steps / 40;
  assert.ok(perGame > 20 && perGame < 300, 'moves per game ' + perGame);
});
