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
const make = (opts, now) => {
  const log = { contexts: 0, resumed: 0, suspended: 0, started: [] };
  const s = Sound.create({ data: GAME_DATA.sound, AudioContext: fakeContext(log, opts), now });
  return { s, log };
};

test('sound: nothing is created until a tap unlocks it, and nothing plays before then', () => {
  const { s, log } = make();
  assert.equal(log.contexts, 0);
  assert.equal(s.play('flip'), false);
  assert.equal(log.started.length, 0);
  s.unlock();
  assert.equal(log.contexts, 1);
  assert.equal(s.play('flip'), true);
  assert.ok(log.started.length >= 2, 'a flip is a click plus a thump');
});

test('sound: a browser that put the context to sleep is woken by the next tap, and plays nothing while asleep', () => {
  const { s, log } = make({ state: 'suspended' });
  s.unlock();
  assert.equal(log.resumed, 1);
  const Base = fakeContext({ contexts: 0, resumed: 0, suspended: 0, started: [] }, { state: 'suspended' });
  const quiet = Sound.create({ data: GAME_DATA.sound, AudioContext: class extends Base { resume() { return new Promise(() => {}); } } });   // never wakes
  quiet.unlock();
  assert.equal(quiet.play('flip'), false, 'not running yet: no sound scheduled');
});

test('sound: switched off, nothing plays (and it can be switched back on)', () => {
  const { s, log } = make();
  s.unlock();
  s.setEnabled(false);
  assert.equal(s.play('match'), false);
  assert.equal(log.started.length, 0);
  s.setEnabled(true);
  assert.equal(s.play('match'), true);
  assert.ok(log.started.length >= 2);
});

test('sound: the same sound is not stacked on itself faster than minGapMs, but different sounds are', () => {
  let t = 1000;
  const { s, log } = make({}, () => t);
  s.unlock();
  assert.equal(s.play('flip'), true);
  t += GAME_DATA.sound.minGapMs - 1;
  assert.equal(s.play('flip'), false, 'too soon');
  assert.equal(s.play('miss'), true, 'a different sound is fine');
  t += 5;
  assert.equal(s.play('flip'), true);
  assert.ok(log.started.length > 4);
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
  assert.equal(s.play('flip'), false);
  s.suspend();
});

test('sound: the voice count is capped', () => {
  const data = { ...GAME_DATA.sound, maxVoices: 3, minGapMs: 0 };
  const log = { contexts: 0, resumed: 0, suspended: 0, started: [] };
  const s = Sound.create({ data, AudioContext: fakeContext(log) });
  s.unlock();
  assert.equal(s.play('gem'), false, 'gem needs 5 voices: over the cap');
  assert.equal(s.play('tick'), true);
});

test('sound: every recipe is gentle — short, in a pleasant range, never loud — and every game moment has one', () => {
  const R = GAME_DATA.sound.sounds;
  for (const name of ['peek', 'flip', 'miss', 'match', 'gem', 'bank', 'slip', 'win', 'lose', 'unlock', 'tick']) assert.ok(R[name], 'missing ' + name);
  for (const [name, voices] of Object.entries(R)) {
    let end = 0, loud = 0;
    for (const v of voices) {
      assert.ok(['sine', 'triangle', 'square', 'sawtooth', 'noise'].includes(v.w), name + ' wave');
      for (const f of [].concat(v.f)) if (v.w !== 'noise') assert.ok(f >= 100 && f <= 4000, `${name}: ${f} Hz is out of the comfortable range`);
      assert.ok(v.g > 0 && v.g <= 0.3, `${name}: a single voice is too loud (${v.g})`);
      assert.ok(v.d >= 0.03 && v.d <= 1, `${name}: voice length ${v.d}`);
      end = Math.max(end, v.at + v.d);
      if (v.at < 0.05) loud += v.g;
    }
    assert.ok(end <= 1.5, `${name}: ${end}s is too long`);
    assert.ok(loud <= 0.6, `${name}: its opening is too loud (${loud.toFixed(2)})`);
  }
  assert.ok(GAME_DATA.sound.master > 0 && GAME_DATA.sound.master <= 0.7);
});
