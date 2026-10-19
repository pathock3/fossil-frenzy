const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { GAME_DATA, Engine, scriptText, FILE } = require('./load');
const { gems } = require('./helpers');

const html = fs.readFileSync(FILE, 'utf8');
const strip = js => js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

test('data block: the deck, the race, three computer styles, seat colours and texts are all there', () => {
  const D = GAME_DATA;
  assert.deepEqual([D.deck.gems, D.deck.booms], [38, 6]);
  assert.deepEqual([D.players.min, D.players.max], [2, 6]);
  assert.deepEqual(D.rules.race, { players: 2, target: 20 });
  assert.equal(D.styles.length, 3);
  assert.deepEqual(D.styles.map(s => s.name), ['Careful', 'Steady', 'Daring']);
  assert.equal(new Set(D.styles.map(s => s.id)).size, 3);
  assert.ok(D.styles[0].risk < D.styles[1].risk && D.styles[1].risk < D.styles[2].risk, 'bolder to the right');
  assert.ok(D.styles.some(s => s.id === D.bots.defaultStyle));
  assert.ok(D.seatColours.length >= D.players.max && new Set(D.seatColours).size === D.seatColours.length);
  assert.equal(D.expansions.boobyPrizes.available, false, 'the expansion is not built (the rulebook does not say what the cards do)');
  assert.ok(D.texts.judgments.length >= 8);
  assert.ok(D.sound.sounds && D.sound.master > 0);
});

test('logic reads the rules from the data block: no rule number is written into the engine or the bots', () => {
  for (const id of ['engine', 'bots']) {
    const code = strip(scriptText(id));
    for (const n of ['38', '44', '20', '19', '6']) assert.doesNotMatch(code, new RegExp('(?<![\\w.])' + n + '(?![\\w.])'), `${id} must not hard-code ${n}`);
  }
});

test('changing the data changes the game: a different race target and a smaller deck', () => {
  const data = JSON.parse(JSON.stringify(GAME_DATA));
  data.rules.race.target = 5; data.deck.gems = 12; data.deck.booms = 2;
  const s = Engine.createGame({ players: 2, seed: 1, data });
  assert.equal(s.draw.length, 14);
  const top = [0, 1, 2, 3, 4];
  s.draw = s.draw.filter(c => !top.includes(c)).concat(top.slice().reverse());
  for (let i = 0; i < 5; i++) Engine.draw(s);
  assert.equal(s.over, false);
  Engine.save(s);
  assert.equal(s.over, true, 'five saved gems win this variant');
  assert.equal(s.result.reason, 'target');
});

test('the page is one self-contained file with the scripts in order and no network', () => {
  assert.deepEqual([...html.matchAll(/<script id="(\w+)">/g)].map(m => m[1]), ['data', 'engine', 'bots', 'sound', 'ui']);
  assert.doesNotMatch(html, /<script[^>]*\ssrc=/i);
  assert.doesNotMatch(html, /<link[^>]*rel="stylesheet"/i);
  assert.doesNotMatch(html, /\b(fetch|XMLHttpRequest|WebSocket|importScripts)\s*\(/);
  assert.doesNotMatch(html, /(src|href)="https?:/i);
  assert.match(html, /<meta name="build" content="__BUILD__">/);
  assert.match(html, /<link rel="icon" type="image\/png" href="\.\.\/\.\.\/assets\/favicon\.png">/);
  assert.match(html, /<link rel="apple-touch-icon" href="\.\.\/\.\.\/assets\/apple-touch-icon\.png">/);
  assert.match(html, /<title>One More…<\/title>/);
});

test('the page is locked for touch: no scrolling, no rubber-banding, no zoom, no double-tap delay', () => {
  assert.match(html, /user-scalable=no/);
  assert.match(html, /viewport-fit=cover/);
  assert.match(html, /html, body \{[^}]*position: fixed[^}]*overflow: hidden[^}]*overscroll-behavior: none/);
  assert.match(html, /touch-action: manipulation/);
  assert.match(html, /apple-mobile-web-app-capable/);
});

test('storage keys are namespaced under the Tabletop Library and this game', () => {
  const ui = scriptText('ui');
  const keys = [...ui.matchAll(/NS \+ '([\w-]+)'/g)].map(m => m[1]).sort();
  assert.deepEqual(keys, ['games-finished', 'hints', 'save', 'setup', 'sound']);
  assert.match(ui, /const NS = 'tabletop-library-one-more-'/);
});

test('every judgment call in the data block is also written in DECISIONS.md', () => {
  const dec = fs.readFileSync(FILE.replace('index.html', 'DECISIONS.md'), 'utf8');
  assert.match(dec, /Booby Prizes/);
  assert.match(dec, /auto/i);
  assert.match(dec, /shared win/i);
  assert.match(dec, /fewest/i);
  assert.ok(gems.length === 38);
});
