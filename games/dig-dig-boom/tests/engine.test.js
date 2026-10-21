const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const { DDB, DDB_SAMPLE_CSV, Engine: E } = require('./load');
const fixture = fs.readFileSync(path.join(__dirname, 'fixture.csv'), 'utf8');
const rows = () => E.parseCSV(fixture);

test('csv: quoted commas, doubled quotes and newlines inside quotes survive; blank lines are dropped', () => {
  const r = E.parseCSV('a,b,c\n1,"x, y",3\n"he said ""hi""","line1\nline2",\n\n');
  assert.deepEqual(r, [['a', 'b', 'c'], ['1', 'x, y', '3'], ['he said "hi"', 'line1\nline2', '']]);
  assert.deepEqual(E.parseCSV('a,b\r\n1,2\r\n'), [['a', 'b'], ['1', '2']]);
});

test('cards: read by column name, Number only on Power cards, Count defaults to 1, notes kept apart from the card', () => {
  const cards = E.cards(rows(), DDB.columns);
  assert.equal(cards.length, 11);
  const bat = cards.find(c => c.id === 'PW-18');
  assert.deepEqual([bat.name, bat.type, bat.number, bat.deck, bat.count, bat.text], ['Energy Bat', 'Power', 7, 'Booster', 1, '+1 {reroll}. When dug, +2 {grit}']);
  assert.equal(cards.find(c => c.id === 'TR-01').number, null);
  assert.equal(cards.find(c => c.id === 'TR-01').count, 18);
  assert.equal(cards.find(c => c.id === 'IM-29').count, 2);
  assert.ok(cards.filter(c => c.type !== 'Power').every(c => c.number === null), 'only Power cards carry a number');
});

test('cards: every type in the sheet is a known type with a colour, an icon and a pattern (type never relies on colour alone)', () => {
  const cards = E.cards(rows(), DDB.columns);
  for (const c of cards) assert.ok(DDB.types[c.type], c.id + ' has an unknown type ' + c.type);
  const colours = Object.values(DDB.types).map(t => t.color), icons = Object.values(DDB.types).map(t => t.icon), pats = Object.values(DDB.types).map(t => t.pattern);
  for (const list of [colours, icons, pats]) assert.equal(new Set(list).size, list.length, 'all different');
  assert.deepEqual(Object.keys(DDB.types).sort(), ['Immediate', 'Monster', 'Ongoing', 'Power', 'Treasure']);
});

test('questions: notes that start with "Question:" are collected; design notes are never part of the card text', () => {
  const cards = E.cards(rows(), DDB.columns), qs = E.questions(cards);
  assert.deepEqual(qs.map(q => q.id), ['PW-04', 'PW-21', 'ON-14']);
  assert.match(qs[2].q, /floor be 4, 5 or 6/);
  assert.ok(cards.every(c => !/Why|Notes|Question/i.test(c.text)));
});

test('tokens: {heart} {grit} {reroll} {damage} {gem} become icons; unknown codes stay as text', () => {
  const t = E.tokens('+1 {reroll}. When dug, +2 {grit} {nope}', DDB.iconCodes);
  assert.deepEqual(t.filter(x => x.t === 'icon').map(x => x.v), ['reroll', 'grit']);
  assert.equal(t.map(x => x.v).join('').includes('{nope}'), true);
  assert.deepEqual(Object.keys(DDB.iconCodes).sort(), ['damage', 'gem', 'grit', 'heart', 'reroll']);
});

test('fitting: the largest size that still fits, in quarter steps', () => {
  assert.equal(E.largestFitting(s => s <= 17.6, 10, 44), 17.5);
  assert.equal(E.largestFitting(s => true, 10, 44), 44);
  assert.equal(E.largestFitting(s => false, 10, 44), 10);
});

test('data: the card sheet and rules tab are the owner\'s Google Sheet; the page does not carry the card list', () => {
  assert.equal(DDB.sheet.id, '1cKcNNs38CydvvhW7rUJIc4DWHgEvT-deluLdhrIpk04');
  assert.deepEqual(DDB.sheet.tabs, { cards: 2, rules: 3 });
  assert.match(DDB.sheet.urls[0](DDB.sheet.id, 2), /^https:\/\/docs\.google\.com\/spreadsheets\/d\/e\/2PACX-[\w-]+\/pub\?gid=2&single=true&output=csv$/, 'the published-to-web link comes first');
  assert.match(DDB.sheet.urls[1](DDB.sheet.id, 2), /\/gviz\/tq\?tqx=out:csv&gid=2$/);
  assert.match(DDB.sheet.urls[2](DDB.sheet.id, 3), /export\?format=csv&gid=3$/);
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.ok((html.match(/Salvage Yard|Panic Button|Drill Pup/g) || []).length <= 2, 'only the six-row design sample mentions card names');
  const sample = E.cards(E.parseCSV(DDB_SAMPLE_CSV), DDB.columns);
  assert.equal(sample.length, 7);
  assert.deepEqual(new Set(sample.map(c => c.type)), new Set(['Power', 'Ongoing', 'Immediate', 'Treasure', 'Monster']), 'the sample has every type');
});

test('card geometry: poker size with a 0.125 in bleed and a 0.125 in safe zone', () => {
  assert.deepEqual(DDB.card, { trimW: 250, trimH: 350, bleed: 12.5, safe: 12.5 });
});

test('stats: a Monster\'s damage ladder and a Treasure\'s gem worth are read from the card text', () => {
  assert.deepEqual(E.damageSteps('{damage} 1 → 3 → 5 → 7'), [1, 3, 5, 7]);
  assert.deepEqual(E.damageSteps('{damage} 2 → 4 → 6'), [2, 4, 6]);
  assert.equal(E.damageSteps('Block 1 {damage}'), null);
  assert.equal(E.gemWorth('1 {gem}'), 1); assert.equal(E.gemWorth('2 {gem}'), 2); assert.equal(E.gemWorth('+1 {heart}'), null);
});
