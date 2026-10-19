#!/usr/bin/env node
// Computer-versus-computer simulation for tuning the three styles.   node games/one-more/tools/simulate.js [games=2000]
// (The tests run only a few hundred games; this is the longer version.)
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
for (const id of ['data', 'engine', 'bots']) vm.runInThisContext(html.match(new RegExp('<script id="' + id + '">([\\s\\S]*?)</script>'))[1]);
const { GAME_DATA, Engine, Bots } = vm.runInThisContext('({ GAME_DATA, Engine, Bots })');
const STYLES = GAME_DATA.styles.map(s => s.id);
const N = +process.argv[2] || 2000;

function run(styles, games) {
  const wins = Object.fromEntries(STYLES.map(s => [s, 0])), sat = Object.fromEntries(STYLES.map(s => [s, 0]));
  let ties = 0, moves = 0, booms = 0;
  for (let g = 0; g < games; g++) {
    const order = styles.map((_, i) => styles[(i + g) % styles.length]);
    const r = Bots.playGame({ styles: order, seed: g + 1 });
    moves += r.steps; booms += r.booms;
    order.forEach(s => { sat[s]++; });
    if (r.result.tie) ties++; else wins[order[r.result.winners[0]]]++;
  }
  const pct = s => (sat[s] ? (100 * wins[s] / sat[s]).toFixed(1) : '-').padStart(5) + '%';
  return `${styles.join(' / ').padEnd(44)} ` + STYLES.map(s => `${s} ${pct(s)}`).join('  ') + `  ties ${(100 * ties / games).toFixed(1)}%  moves ${(moves / games).toFixed(0)}  booms ${(booms / games).toFixed(1)}`;
}
function digLength(style) {          // how many gems it digs for from a fresh pile before saving or busting
  let total = 0, M = 3000;
  for (let seed = 1; seed <= M; seed++) {
    const s = Engine.createGame({ players: 3, seed });
    while (s.phase === 'turn') { if (Bots.decide(Engine.publicView(s, 0), style) === 'save') break; if (Engine.draw(s).type === 'boom') break; }
    total += s.table.length || s.lastBoom.lost.length;
  }
  return (total / M).toFixed(2);
}

console.log(`${N} games per line (seats rotate so nobody always goes first)`);
console.log('gems dug per turn from a fresh pile:', STYLES.map(s => `${s} ${digLength(s)}`).join('  '));
for (const [a, b] of [['careful', 'steady'], ['steady', 'daring'], ['careful', 'daring']]) console.log(run([a, b], N));
console.log(run(['careful', 'steady', 'daring'], N));
console.log(run(['careful', 'steady', 'daring', 'careful', 'steady', 'daring'], N));
console.log(run(['steady', 'steady'], N));
