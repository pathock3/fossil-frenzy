const test = require('node:test');
const assert = require('node:assert/strict');
const { GAME_DATA, Sound } = require('./load');

// A stand-in for the browser's AudioContext that records what is scheduled.
function fakeContext(log, { state = 'running' } = {}) {
  return class FakeContext {
    constructor() { this.state = state; this.currentTime = 1; this.sampleRate = 8000; this.destination = {}; log.contexts++; }
    resume() { this.state = 'running'; log.resumed++; return Promise.resolve(); }
    suspend() { this.state = 'suspended'; log.suspended++; return Promise.resolve(); }
    createGain() { return { gain: { value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} }; }
    createDynamicsCompressor() { return { threshold: {}, knee: {}, ratio: {}, attack: {}, release: {}, connect() {} }; }
    createBiquadFilter() { return { frequency: {}, connect() {} }; }
    createBuffer(c, len) { return { getChannelData: () => new Float32Array(len) }; }
    createBufferSource() { return { connect() {}, start: (t) => log.started.push({ noise: true, t }), stop() {} }; }
    createOscillator() { const o = { type: '', frequency: { setValueAtTime(f) { o.f0 = f; }, exponentialRampToValueAtTime(f) { o.f1 = f; } }, connect() {}, start: t => log.started.push({ type: o.type, f0: o.f0, f1: o.f1, t }), stop() {} }; return o; }
  };
}
const make = (opts, now, data = GAME_DATA.sound) => {
  const log = { contexts: 0, resumed: 0, suspended: 0, started: [] };
  const s = Sound.create({ data, AudioContext: fakeContext(log, opts), now });
  return { s, log };
};
const NAMES = ['draw', 'glint', 'clink', 'save', 'boom', 'rumble', 'refresh', 'win', 'tie', 'lose', 'tick'];

test('sound: nothing is created until a tap unlocks it, and nothing plays before then', () => {
  const { s, log } = make();
  assert.equal(log.contexts, 0);
  assert.equal(s.play('draw'), false);
  assert.equal(log.started.length, 0);
  s.unlock();
  assert.equal(log.contexts, 1);
  assert.equal(s.play('draw'), true);
  assert.ok(log.started.length >= 2, 'a card is a swish plus a thump');
});

test('sound: a browser that put the context to sleep is woken by the next tap, and plays nothing while asleep', () => {
  const { s, log } = make({ state: 'suspended' });
  s.unlock();
  assert.equal(log.resumed, 1);
  const Base = fakeContext({ contexts: 0, resumed: 0, suspended: 0, started: [] }, { state: 'suspended' });
  const quiet = Sound.create({ data: GAME_DATA.sound, AudioContext: class extends Base { resume() { return new Promise(() => {}); } } });   // never wakes
  quiet.unlock();
  assert.equal(quiet.play('draw'), false, 'not running yet: no sound scheduled');
});

test('sound: switched off, nothing plays (and it can be switched back on)', () => {
  const { s, log } = make();
  s.unlock();
  s.setEnabled(false);
  assert.equal(s.isEnabled(), false);
  assert.equal(s.play('boom'), false);
  assert.equal(log.started.length, 0);
  s.setEnabled(true);
  assert.equal(s.play('boom'), true);
  assert.ok(log.started.length >= 3);
});

test('sound: the same sound is not stacked on itself faster than minGapMs, but different sounds are', () => {
  let t = 1000;
  const { s } = make({}, () => t);
  s.unlock();
  assert.equal(s.play('draw'), true);
  t += GAME_DATA.sound.minGapMs - 1;
  assert.equal(s.play('draw'), false, 'too soon');
  assert.equal(s.play('glint'), true, 'a different sound is fine');
  t += 5;
  assert.equal(s.play('draw'), true);
});

test('sound: an unknown name is ignored, and the log remembers what was asked for', () => {
  const { s } = make();
  s.unlock();
  assert.equal(s.play('nope'), false);
  s.play('tick');
  assert.deepEqual(s.played.slice(-2), ['nope', 'tick']);
});

test('sound: no audio support at all is harmless', () => {
  const s = Sound.create({ data: GAME_DATA.sound, AudioContext: undefined });
  assert.equal(s.unlock(), false);
  assert.equal(s.play('draw'), false);
  s.suspend();
});

test('sound: the voice count is capped', () => {
  const data = { ...GAME_DATA.sound, maxVoices: 3, minGapMs: 0 };
  const { s } = make({}, undefined, data);
  s.unlock();
  assert.equal(s.play('boom'), false, 'boom needs 4 voices: over the cap');
  assert.equal(s.play('tick'), true);
});

test('sound: a run of gems climbs — each step of a run plays the same glint a little higher', () => {
  const steps = GAME_DATA.sound.run.scale;
  assert.ok(steps.length >= 6 && steps.every((v, i) => i === 0 || v > steps[i - 1]), 'the scale goes up');
  let t = 0;
  const { s, log } = make({}, () => (t += 1000));
  s.unlock();
  const base = [];
  for (const semis of steps) {
    log.started.length = 0;
    assert.equal(s.play('glint', { rate: Math.pow(2, semis / 12) }), true);
    base.push(log.started.filter(v => v.type).map(v => v.f0)[0]);
  }
  for (let i = 1; i < base.length; i++) assert.ok(base[i] > base[i - 1], 'pitch climbs: ' + base.join(', '));
  assert.ok(Math.abs(base[0] - GAME_DATA.sound.sounds.glint[0].f) < 1e-6, 'the first gem plays the recipe as written');
});

test('sound: pitch scaling never pushes a climbing sound out of a comfortable range', () => {
  const top = Math.pow(2, Math.max(...GAME_DATA.sound.run.scale) / 12);
  for (const name of ['glint', 'clink']) for (const v of GAME_DATA.sound.sounds[name]) assert.ok([].concat(v.f)[0] * top <= 4200, `${name} at the top of a run`);
});

test('sound: every recipe is gentle — short, in a pleasant range, never loud — and every game moment has one', () => {
  const R = GAME_DATA.sound.sounds;
  for (const name of NAMES) assert.ok(R[name], 'missing ' + name);
  for (const [name, voices] of Object.entries(R)) {
    let end = 0, loud = 0;
    for (const v of voices) {
      assert.ok(['sine', 'triangle', 'square', 'sawtooth', 'noise'].includes(v.w), name + ' wave');
      for (const f of [].concat(v.f)) if (v.w !== 'noise') assert.ok(f >= 35 && f <= 4000, `${name}: ${f} Hz is out of the comfortable range`);
      assert.ok(v.g > 0 && v.g <= 0.3, `${name}: a single voice is too loud (${v.g})`);
      assert.ok(v.d >= 0.03 && v.d <= 1.5, `${name}: voice length ${v.d}`);
      end = Math.max(end, v.at + v.d);
      if (v.at < 0.05) loud += v.g;
    }
    assert.ok(end <= 1.5, `${name}: ${end}s is too long`);
    assert.ok(loud <= 0.9, `${name}: its opening is too loud (${loud.toFixed(2)})`);
    assert.ok(voices.length <= GAME_DATA.sound.maxVoices, name + ' fits under the voice cap');
  }
  assert.ok(GAME_DATA.sound.master > 0 && GAME_DATA.sound.master <= 0.7);
});

test('sound: the boom is big and low (noise + a falling thump), and the rumble sits underneath it', () => {
  const R = GAME_DATA.sound.sounds;
  assert.ok(R.boom.some(v => v.w === 'noise') && R.boom.some(v => Array.isArray(v.f) && v.f[1] < v.f[0] && v.f[1] <= 60), 'noise and a falling low thump');
  assert.ok(R.rumble.every(v => v.w === 'noise' || [].concat(v.f).every(f => f <= 100)), 'low');
  assert.ok(Math.max(...R.rumble.map(v => v.at + v.d)) >= 1, 'it lingers');
});

test('sound: the win fanfare rises and ends on a chord', () => {
  const win = GAME_DATA.sound.sounds.win;
  const starts = win.filter(v => v.at === 0 || v.at < 0.3).map(v => v.f);
  assert.ok(starts[0] < starts[1] && starts[1] < starts[2]);
  const last = Math.max(...win.map(v => v.at));
  assert.ok(win.filter(v => v.at === last || v.at >= last - 0.2).length >= 3, 'several notes at the end');
});
