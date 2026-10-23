import assert from 'node:assert/strict';
import test from 'node:test';
import { createAudio } from '../dist/audio.js';

const settle = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
  let resolve;
  const promise = new Promise(complete => { resolve = complete; });
  return { promise, resolve };
}

function audioFixture({ fetchResult, decodeResult, initialState = 'running' } = {}) {
  const saved = new Map(['window', 'fetch'].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const previousRandom = Math.random;
  const nodes = [], contexts = [], captions = [];
  const sample = { duration: 17 };
  class Parameter {
    value = 0;
    changes = [];
    setValueAtTime(value, at) { this.changes.push({ kind: 'set', value, at }); }
    exponentialRampToValueAtTime(value, at) { this.changes.push({ kind: 'ramp', value, at }); }
    setTargetAtTime(value, at, constant) { this.changes.push({ kind: 'target', value, at, constant }); }
    cancelScheduledValues(at) { this.changes.push({ kind: 'cancel', at }); }
  }
  class Node {
    constructor(kind) {
      this.kind = kind;
      this.frequency = new Parameter(); this.gain = new Parameter();
      this.Q = new Parameter(); this.pan = new Parameter();
      this.outputs = []; this.stops = []; this.disconnects = 0;
      nodes.push(this);
    }
    connect(destination) { this.outputs.push(destination); }
    disconnect() { this.disconnects++; }
    start(at = 0, offset, duration) { this.started = true; this.startedAt = at; this.offset = offset; this.duration = duration; }
    stop(at) {
      this.stops.push(at);
      if (at === undefined) this.onended?.();
    }
  }
  class AudioContext {
    currentTime = 10;
    sampleRate = 1000;
    state = initialState;
    destination = {};
    resumeCalls = 0;
    decodeCalls = 0;
    closeCalls = 0;
    constructor() { contexts.push(this); }
    createBuffer(_channels, samples) { return { getChannelData: () => new Float32Array(samples) }; }
    createGain() { return new Node('gain'); }
    createOscillator() { return new Node('tone'); }
    createBufferSource() { return new Node('noise'); }
    createBiquadFilter() { return new Node('filter'); }
    createStereoPanner() { return new Node('pan'); }
    createDynamicsCompressor() { return Object.assign(new Node('compressor'), { threshold: {}, knee: {}, ratio: {}, attack: {}, release: {} }); }
    async decodeAudioData() { this.decodeCalls++; return decodeResult ?? sample; }
    async resume() { this.resumeCalls++; if (this.state !== 'closed') this.state = 'running'; }
    async suspend() { if (this.state !== 'closed') this.state = 'suspended'; }
    async close() { this.closeCalls++; this.state = 'closed'; }
  }
  Object.defineProperty(globalThis, 'window', { configurable: true, writable: true, value: { AudioContext, location: { protocol: 'https:' } } });
  Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: async () => fetchResult ?? { ok: true, arrayBuffer: async () => new ArrayBuffer(8) } });
  Math.random = () => .5;
  const audio = createAudio();
  audio.setCaptionHandler(text => captions.push(text));
  return {
    audio, nodes, contexts, captions, sample,
    sources: () => nodes.filter(node => node.kind === 'tone' || node.kind === 'noise'),
    advance(seconds, state = {}) {
      for (let remaining = seconds; remaining > 1e-8; remaining -= .1) {
        const dt = Math.min(.1, remaining);
        if (contexts[0]) contexts[0].currentTime += dt;
        audio.update({ distance: 100, level: 0, dt, ...state });
      }
    },
    cleanup() {
      audio.dispose();
      Math.random = previousRandom;
      for (const [name, descriptor] of saved) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else delete globalThis[name];
      }
    },
  };
}

function exerciseCues(audio) {
  audio.update({ dt: 100 });
  audio.step(); audio.collect(); audio.sting(); audio.knock();
  audio.entityCue('hound'); audio.chargeWarning();
  audio.scarePrelude('sahur', 'behind-you'); audio.jumpscare(true, 'sahur');
  audio.stunPulse(); audio.torchClick(); audio.crank(); audio.win();
}

test('audio starts immediately while the optional scare recording is still downloading', async () => {
  const response = deferred();
  const f = audioFixture({ fetchResult: response.promise, initialState: 'suspended' });
  let initialization;
  try {
    exerciseCues(f.audio);
    assert.equal(f.contexts.length, 0, 'Creating the sound controller and scheduling cues cannot autoplay.');
    let ready = false;
    initialization = f.audio.init().then(() => { ready = true; });
    await settle();
    assert.equal(f.contexts[0].state, 'running', 'The user gesture must resume Web Audio before an asset download finishes.');
    assert.equal(ready, true, 'Optional recording downloads must not hold up game startup.');
    const before = f.sources().length;
    f.audio.sting();
    assert.ok(f.sources().length > before, 'Generated horror cues remain available during the download.');
    response.resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) });
    await initialization; await settle();
    f.audio.jumpscare(true, 'sahur');
    assert.ok(f.sources().some(node => node.buffer === f.sample), 'A recording that finishes later becomes available for fatal scares.');
  } finally {
    response.resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) });
    await initialization; await settle(); f.cleanup();
  }
});

test('each stage has a distinct, directional environmental horror cue with a quiet opening', async () => {
  const captions = [/creak/i, /water/i, /pipe/i, /paper/i];
  const signatures = [];
  for (let level = 0; level < captions.length; level++) {
    const f = audioFixture();
    try {
      await f.audio.init();
      f.audio.update({ level, distance: 100, dt: 0 });
      f.advance(3.8, { level });
      assert.equal(f.captions.filter(text => captions[level].test(text)).length, 0, `Stage ${level} opens without an immediate environmental interruption.`);
      const first = f.nodes.length;
      f.advance(.4, { level });
      assert.equal(f.captions.filter(text => captions[level].test(text)).length, 1, `Stage ${level} announces its environmental sound through captions.`);
      const cue = f.nodes.slice(first);
      assert.ok(cue.some(node => node.started && (node.kind === 'tone' || node.kind === 'noise')), 'The caption accompanies an audible cue.');
      assert.ok(cue.some(node => node.kind === 'pan' && Math.abs(node.pan.value) > .1), 'Environmental sounds have an audible direction.');
      signatures.push(JSON.stringify(cue.filter(node => ['filter', 'tone'].includes(node.kind)).map(node => [node.kind, node.frequency.value, node.frequency.changes])));
      f.advance(8.7, { level });
      assert.equal(f.captions.filter(text => captions[level].test(text)).length, 1, 'Environmental sounds leave at least nine seconds of recovery.');
      f.advance(8.5, { level });
      assert.equal(f.captions.filter(text => captions[level].test(text)).length, 2, 'The next environmental sound occurs within its seventeen-second window.');
    } finally { f.cleanup(); }
  }
  assert.equal(new Set(signatures).size, captions.length, 'Stages differ in sound as well as caption text.');
});

test('changing stages retunes the drone and starts a fresh environmental quiet period', async () => {
  const f = audioFixture();
  try {
    await f.audio.init();
    f.advance(4.2);
    assert.equal(f.captions.filter(text => /creak/i.test(text)).length, 1);
    const drones = f.nodes.filter(node => node.kind === 'tone' && node.stops.length === 0 && node.frequency.changes.some(change => change.kind === 'target'));
    const pitches = drones.map(node => node.frequency.changes.at(-1).value);
    f.audio.update({ level: 1, distance: 100, dt: 0 });
    assert.ok(drones.some((node, index) => node.frequency.changes.at(-1).value !== pitches[index]), 'The room drone follows the new stage.');
    f.advance(3.8, { level: 1 });
    assert.equal(f.captions.filter(text => /water/i.test(text)).length, 0);
    f.advance(.4, { level: 1 });
    assert.equal(f.captions.filter(text => /water/i.test(text)).length, 1, 'The new stage uses its own opening delay instead of the previous stage cooldown.');
  } finally { f.cleanup(); }
});

test('restarting the same stage clears old cues and gives the new run its full quiet opening', async () => {
  const f = audioFixture();
  try {
    await f.audio.init();
    f.advance(3.9);
    f.audio.sting();
    const oldCues = f.sources().filter(node => node.onended);
    assert.ok(oldCues.length > 0);
    f.audio.reset(0);
    assert.ok(oldCues.every(node => node.stops.includes(undefined)), 'A restarted run cannot inherit pending one-shot sounds.');
    f.advance(3.8);
    assert.equal(f.captions.filter(text => /creak/i.test(text)).length, 0, 'Restarting the same stage resets the nearly due environmental cue.');
    f.advance(.4);
    assert.equal(f.captions.filter(text => /creak/i.test(text)).length, 1, 'The restarted run gets its first environmental cue after four fresh seconds.');
    f.audio.dispose();
    const operations = () => f.nodes.map(node => [node.stops.length, node.gain.changes.length, node.frequency.changes.length]);
    const before = operations();
    f.audio.reset(0);
    assert.deepEqual(operations(), before, 'Resetting a disposed controller cannot schedule gain changes or touch stopped sources.');
    assert.equal(f.contexts[0].state, 'closed');
  } finally { f.cleanup(); }
});

test('chases add recurring breathing and a stronger drone without stacking environmental scares', async () => {
  const f = audioFixture();
  try {
    await f.audio.init();
    const drones = f.nodes.filter(node => node.kind === 'tone' && node.frequency.value >= 35 && node.frequency.value < 50 && node.stops.length === 0);
    assert.ok(drones.length >= 2, 'Detuned low drones sustain the room atmosphere.');
    f.audio.update({ distance: 100, dt: .1 });
    const quietTargets = new Map(f.nodes.filter(node => node.kind === 'gain').map(node => [node, node.gain.changes.filter(change => change.kind === 'target').at(-1)?.value]));
    const before = f.nodes.length;
    f.audio.update({ chasing: true, distance: 100, dt: .1 });
    const breathing = () => f.captions.filter(text => /breath/i.test(text));
    assert.equal(breathing().length, 1, 'Entering a chase announces the breathing cue.');
    assert.ok(f.nodes.slice(before).some(node => node.kind === 'noise'), 'Breathing is audible alongside the heartbeat.');
    const pathsToDrone = drone => [drone.outputs[0], drone.outputs[0]?.outputs?.[0]];
    assert.ok(drones.some(drone => pathsToDrone(drone).some(gain => {
      const quiet = quietTargets.get(gain);
      const chase = gain?.gain?.changes.filter(change => change.kind === 'target').at(-1)?.value;
      return Number.isFinite(quiet) && chase > quiet;
    })), 'Chase tension raises the drone even when the enemy is still distant.');
    const noises = f.sources().filter(node => node.kind === 'noise').length;
    f.advance(.8, { chasing: true });
    assert.equal(f.sources().filter(node => node.kind === 'noise').length, noises, 'Breathing has recovery time between phrases.');
    f.advance(.8, { chasing: true });
    assert.ok(f.sources().filter(node => node.kind === 'noise').length > noises, 'Breathing repeats during a continuing chase.');
    assert.equal(breathing().length, 1, 'Repeated breathing does not flood captions.');
    f.advance(22, { chasing: true });
    assert.equal(f.captions.filter(text => /creak/i.test(text)).length, 0, 'Environmental scares do not compete with an active chase.');
    f.advance(5.8);
    assert.equal(f.captions.filter(text => /creak/i.test(text)).length, 0, 'The player gets a quiet recovery period after escaping.');
    f.advance(.4);
    assert.equal(f.captions.filter(text => /creak/i.test(text)).length, 1, 'Room atmosphere returns after the recovery period.');
  } finally { f.cleanup(); }
});

test('muting and pausing stop new cues and freeze environmental scheduling; disposal stops loops', async () => {
  const f = audioFixture();
  try {
    exerciseCues(f.audio);
    assert.equal(f.nodes.length, 0);
    await f.audio.init();
    f.audio.setVolume(0);
    const mutedNodes = f.nodes.length, mutedCaptions = f.captions.length;
    exerciseCues(f.audio); f.advance(30);
    assert.equal(f.nodes.length, mutedNodes, 'Muted sounds allocate no sources.');
    assert.equal(f.captions.length, mutedCaptions);
    f.audio.setVolume(.4);
    f.advance(3.8);
    assert.equal(f.captions.filter(text => /creak/i.test(text)).length, 0, 'Muted and pre-init updates do not skip the quiet opening.');
    f.audio.sting();
    const active = f.sources().filter(node => !node.loop && node.onended);
    assert.ok(active.length > 0);
    f.audio.pause();
    assert.equal(f.contexts[0].state, 'suspended');
    assert.ok(active.every(node => node.stops.includes(undefined)), 'Pausing cancels already scheduled one-shot sounds.');
    const pausedNodes = f.nodes.length;
    exerciseCues(f.audio); f.advance(30);
    assert.equal(f.nodes.length, pausedNodes);
    await f.audio.resume();
    f.advance(.4);
    assert.equal(f.captions.filter(text => /creak/i.test(text)).length, 1, 'Resuming continues the frozen schedule without replaying accumulated events.');
    const loops = f.sources().filter(node => node.stops.length === 0);
    assert.ok(loops.length > 0);
    f.audio.dispose();
    assert.ok(loops.every(node => node.stops.includes(undefined) && node.disconnects > 0));
    const disposedNodes = f.nodes.length, resumes = f.contexts[0].resumeCalls;
    exerciseCues(f.audio); await f.audio.init(); await f.audio.resume();
    assert.equal(f.nodes.length, disposedNodes);
    assert.equal(f.contexts[0].state, 'closed');
    assert.equal(f.contexts[0].resumeCalls, resumes);
  } finally { f.cleanup(); }
});

test('a recording that finishes decoding after disposal cannot revive audio', async () => {
  const decoding = deferred();
  const f = audioFixture({ decodeResult: decoding.promise });
  try {
    await f.audio.init(); await settle();
    assert.equal(f.contexts[0].decodeCalls, 1);
    f.audio.dispose();
    const count = f.nodes.length, resumes = f.contexts[0].resumeCalls;
    decoding.resolve(f.sample); await settle();
    await f.audio.init(); await f.audio.resume(); f.audio.jumpscare(true, 'sahur');
    assert.equal(f.nodes.length, count);
    assert.equal(f.contexts[0].resumeCalls, resumes);
    assert.equal(f.contexts[0].state, 'closed');
  } finally { decoding.resolve(f.sample); await settle(); f.cleanup(); }
});

test('disposing during a recording download skips unnecessary decoding', async () => {
  const response = deferred();
  const f = audioFixture({ fetchResult: response.promise });
  try {
    await f.audio.init();
    f.audio.dispose();
    response.resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) });
    await settle();
    assert.equal(f.contexts[0].decodeCalls, 0, 'An unloaded controller must not decode into its closed audio context.');
    assert.equal(f.contexts[0].state, 'closed');
  } finally {
    response.resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) });
    await settle(); f.cleanup();
  }
});
