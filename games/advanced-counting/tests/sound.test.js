const test = require('node:test');
const assert = require('node:assert/strict');
const { GAME_DATA, Engine, Sound } = require('./load');

// A stand-in for the browser's AudioContext that records what is scheduled.
function fakeContext(log, { state = 'running' } = {}) {
  return class FakeContext {
    constructor() { this.state = state; this.currentTime = 1; this.sampleRate = 8000; this.destination = {}; log.contexts++; }
    resume() { this.state = 'running'; log.resumed++; return Promise.resolve(); }
    suspend() { this.state = 'suspended'; return Promise.resolve(); }
    createGain() { return { gain: { value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} }; }
    createDynamicsCompressor() { return { threshold: {}, knee: {}, ratio: {}, attack: {}, release: {}, connect() {} }; }
    createBiquadFilter() { return { frequency: {}, connect() {} }; }
    createBuffer(c, len) { return { getChannelData: () => new Float32Array(len) }; }
    createBufferSource() { return { connect() {}, start: t => log.started.push({ noise: true, t }), stop() {} }; }
    createOscillator() { const o = { type: '', frequency: { setValueAtTime(f) { o.f0 = f; }, exponentialRampToValueAtTime(f) { o.f1 = f; } }, connect() {}, start: t => log.started.push({ type: o.type, f0: o.f0, f1: o.f1, t }), stop() {} }; return o; }
  };
}
const make = (opts, now) => {
  const log = { contexts: 0, resumed: 0, started: [] };
  return { s: Sound.create({ data: GAME_DATA.sound, AudioContext: fakeContext(log, opts), now }), log };
};

test('sound: nothing is created until a tap unlocks it, and nothing plays before then', () => {
  const { s, log } = make();
  assert.equal(log.contexts, 0); assert.equal(s.play('flip'), false);
  s.unlock(); assert.equal(log.contexts, 1); assert.equal(s.play('flip'), true);
  assert.ok(log.started.length >= 2);
});

test('sound: switched off, nothing plays (and it can be switched back on)', () => {
  const { s, log } = make(); s.unlock(); s.setEnabled(false);
  assert.equal(s.play('chime'), false); assert.equal(log.started.length, 0);
  s.setEnabled(true); assert.equal(s.play('chime'), true);
});

test('sound: a sleeping context is woken by a tap and plays nothing while asleep', () => {
  const { s, log } = make({ state: 'suspended' }); s.unlock(); assert.equal(log.resumed, 1);
  const Base = fakeContext({ contexts: 0, resumed: 0, started: [] }, { state: 'suspended' });
  const quiet = Sound.create({ data: GAME_DATA.sound, AudioContext: class extends Base { resume() { return new Promise(() => {}); } } });
  quiet.unlock(); assert.equal(quiet.play('flip'), false);
});

test('sound: the same sound is not stacked faster than minGapMs, but different sounds are; no audio support is harmless', () => {
  let t = 1000; const { s } = make({}, () => t); s.unlock();
  assert.equal(s.play('chime'), true); t += GAME_DATA.sound.minGapMs - 1;
  assert.equal(s.play('chime'), false); assert.equal(s.play('miss'), true);
  t += 5; assert.equal(s.play('chime'), true);
  const none = Sound.create({ data: GAME_DATA.sound, AudioContext: undefined });
  assert.equal(none.unlock(), false); assert.equal(none.play('flip'), false); none.suspend();
});

test('sound: a pitch multiplier raises the chime (and the play log remembers what was asked for)', () => {
  const { s, log } = make(); s.unlock();
  s.play('chime', 1); const lo = log.started.filter(v => v.f0).map(v => v.f0);
  log.started.length = 0; s.play('miss', 1); log.started.length = 0;
  s.play('sparkle', 1);
  const t = { v: 0 }; void t;
  const { s: s2, log: log2 } = make({}, () => 5000); s2.unlock(); s2.play('chime', 2);
  const hi = log2.started.filter(v => v.f0).map(v => v.f0);
  assert.deepEqual(hi, lo.map(f => f * 2));
  assert.deepEqual(s2.played, ['chime']); assert.deepEqual(s2.pitches, [2]);
});

test('sound: every game moment has a recipe: flip click, riffle, rising chime, soft low miss, fanfare, sparkle', () => {
  for (const name of ['tick', 'flip', 'riffle', 'chime', 'miss', 'fanfare', 'sparkle']) assert.ok(GAME_DATA.sound.sounds[name], 'missing ' + name);
});

test('sound: every recipe is gentle — short, in a pleasant range, never loud', () => {
  for (const [name, voices] of Object.entries(GAME_DATA.sound.sounds)) {
    let end = 0, loud = 0;
    for (const v of voices) {
      assert.ok(['sine', 'triangle', 'square', 'sawtooth', 'noise'].includes(v.w), name + ' wave');
      for (const f of [].concat(v.f)) if (v.w !== 'noise') assert.ok(f >= 90 && f <= 4000, `${name}: ${f} Hz is out of the comfortable range`);
      assert.ok(v.g > 0 && v.g <= 0.3, `${name}: a voice is too loud (${v.g})`);
      assert.ok(v.d >= 0.03 && v.d <= 1, `${name}: voice length ${v.d}`);
      end = Math.max(end, v.at + v.d); if (v.at < 0.05) loud += v.g;
    }
    assert.ok(end <= 1.5, `${name}: ${end}s is too long`); assert.ok(loud <= 0.6, `${name}: opening too loud`);
  }
  assert.ok(GAME_DATA.sound.master > 0 && GAME_DATA.sound.master <= 0.7);
});

test('sound: even the highest chime of the climb stays in a comfortable range', () => {
  const top = Math.pow(2, Math.max(...GAME_DATA.chime.scale) / 12);
  for (const v of GAME_DATA.sound.sounds.chime) if (v.w !== 'noise') assert.ok(v.f * top <= 4000, `${v.f} x ${top.toFixed(2)}`);
  const miss = GAME_DATA.sound.sounds.miss; assert.ok(miss.every(v => [].concat(v.f).every(f => f <= 260)), 'the mistake note is low');
  assert.ok(Engine.chimeSemitones(2, 4) < Engine.chimeSemitones(3, 4));
});
