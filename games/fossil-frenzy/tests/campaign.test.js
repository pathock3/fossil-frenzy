const test = require('node:test');
const assert = require('node:assert/strict');
const { GAME_DATA, Campaign } = require('./load');

const NAMES = ['Beginner', 'Novice', 'Normal', 'Challenging', 'Master'];
const id = i => GAME_DATA.campaign.levels[i].id;

test('campaign: five difficulty levels, in order — Beginner, Novice, Normal, Challenging, Master', () => {
  assert.deepEqual(GAME_DATA.campaign.levels.map(l => l.name), NAMES);
  assert.equal(new Set(GAME_DATA.campaign.levels.map(l => l.id)).size, 5);
});

test('campaign: each level remembers better than the last (and the abilities behind them only grow)', () => {
  const ai = GAME_DATA.campaign.levels.map(l => l.ai);
  for (let i = 1; i < ai.length; i++) {
    assert.ok(ai[i].memory > ai[i - 1].memory, `${NAMES[i]} should remember more than ${NAMES[i - 1]}`);
    for (const k of ['valueSense', 'leadSense', 'endSense', 'setsSense', 'gemSense']) assert.ok(ai[i][k] >= ai[i - 1][k], `${NAMES[i]}: ${k}`);
  }
  assert.ok(ai.every(a => a.memory >= 0.6 && a.memory < 1), 'the opponents forget now and then, and are never perfect');
});

test('campaign: only the easiest level is open at the start', () => {
  assert.deepEqual([0, 1, 2, 3, 4].map(i => Campaign.isUnlocked(i, [])), [true, false, false, false, false]);
});

test('campaign: beating a level unlocks the next, and only the next', () => {
  assert.deepEqual([0, 1, 2, 3, 4].map(i => Campaign.isUnlocked(i, [id(0)])), [true, true, false, false, false]);
  assert.deepEqual([0, 1, 2, 3, 4].map(i => Campaign.isUnlocked(i, [id(0), id(1), id(2)])), [true, true, true, true, false]);
  assert.equal(Campaign.isUnlocked(2, [id(0)]), false, 'beating level 1 alone does not open level 3');
});

test('campaign: "defeat" means winning outright — a loss or a shared win does not count', () => {
  assert.equal(Campaign.humanWon({ winners: [0] }), true);
  assert.equal(Campaign.humanWon({ winners: [1] }), false);
  assert.equal(Campaign.humanWon({ winners: [0, 1] }), false);
});

test('campaign: recording a win adds the level and names what it unlocked', () => {
  const r = Campaign.recordResult([], 0, true);
  assert.deepEqual(r.beaten, [id(0)]);
  assert.equal(r.newlyUnlocked, 'Novice');
  assert.equal(r.won, true);
  assert.equal(r.completed, false);
});

test('campaign: a loss records nothing and unlocks nothing', () => {
  const r = Campaign.recordResult([id(0)], 1, false);
  assert.deepEqual(r.beaten, [id(0)]);
  assert.equal(r.newlyUnlocked, null);
});

test('campaign: replaying a level you already beat announces nothing new', () => {
  const r = Campaign.recordResult([id(0), id(1)], 0, true);
  assert.deepEqual(r.beaten, [id(0), id(1)]);
  assert.equal(r.newlyUnlocked, null);
});

test('campaign: beating Master completes the campaign (there is nothing further to unlock)', () => {
  const r = Campaign.recordResult([id(0), id(1), id(2), id(3)], 4, true);
  assert.equal(r.newlyUnlocked, null);
  assert.equal(r.completed, true);
  assert.equal(Campaign.recordResult([id(0), id(1), id(2), id(3), id(4)], 4, true).completed, false, 'only announced once');
});

test('campaign: an opponent\'s settings come from the level data', () => {
  assert.equal(Campaign.botSpec(GAME_DATA.campaign.levels[2]), GAME_DATA.campaign.levels[2].ai);
  assert.equal(Campaign.botSpec(GAME_DATA.campaign.levels[2]).memory, 0.84);
});
