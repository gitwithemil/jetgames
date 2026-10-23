import assert from 'node:assert/strict';
import test from 'node:test';
import { senseEnemy } from '../dist/enemies.js';
import { createPursuit, updatePursuit, createBrriCharge, updateBrriCharge, deathHint } from '../dist/encounters.js';
import { createAudio } from '../dist/audio.js';

const position = { x: 0, z: 0 }, player = { x: 10, z: 0 };
const seen = { detect: true, visual: true, cause: 'sight' };
const heard = { detect: true, visual: false, cause: 'sound' };
const absent = { detect: false, visual: false, cause: null };

test('senses identify visual, torch, noise and close-contact causes without clock-based Brri bursts', () => {
  const base = { distance: 15, los: true, moving: false, sprinting: false, crouching: false,
    flashlight: false, observed: false, working: false };
  assert.deepEqual(senseEnemy('sahur', base), { detect: true, visual: true, cause: 'sight', frozen: false, speed: 2.65 });
  assert.equal(senseEnemy('smiler', { ...base, flashlight: true }).cause, 'light');
  assert.equal(senseEnemy('smiler', base).detect, false);
  assert.equal(senseEnemy('hound', { ...base, los: false, sprinting: true }).cause, 'sound');
  assert.equal(senseEnemy('hound', { ...base, distance: 1 }).cause, 'proximity');
  assert.equal(senseEnemy('watcher', { ...base, observed: true, illuminated: true }).frozen, true);
  assert.equal(senseEnemy('bribri', { ...base, time: 0 }).speed, senseEnemy('bribri', { ...base, time: 4 }).speed);
});

test('a visible player takes priority over a decoy; a sound hunter can follow the lure', () => {
  const decoy = { position: { x: 0, z: 8 }, until: 20 };
  const pursuit = createPursuit();
  const visual = updatePursuit(pursuit, { type: 'bribri', time: 12, position, player, senses: seen, decoy });
  assert.equal(visual.phase, 'pursue');
  assert.deepEqual(visual.target, player);
  const sound = updatePursuit(pursuit, { type: 'hound', time: 12, position, player, senses: heard, decoy });
  assert.equal(sound.phase, 'investigate');
  assert.deepEqual(sound.target, decoy.position);
  assert.equal(pursuit.phase, 'patrol', 'Stepping an encounter must not mutate its previous snapshot.');
  const contact = updatePursuit(pursuit, { type: 'hound', time: 12, position,
    player: { x: 1, z: 0 }, senses: { detect: true, visual: false, cause: 'proximity' }, decoy });
  assert.equal(contact.phase, 'pursue', 'A lure cannot hide a player in contact range.');
});

test('one decoy does not repeatedly refresh alert time or restart its investigation', () => {
  const decoy = { position: { x: 12, z: 0 }, until: 100 };
  let state = updatePursuit(null, { type: 'hound', time: 2, position, player, senses: absent, decoy });
  assert.equal(state.alertUntil, 8);
  state = updatePursuit(state, { type: 'hound', time: 7, position, player, senses: absent, decoy });
  assert.equal(state.alertUntil, 8);
  state = updatePursuit(state, { type: 'hound', time: 8, position, player, senses: absent, decoy });
  assert.equal(state.phase, 'search');
  state = updatePursuit(state, { type: 'hound', time: 14, position, player, senses: absent, decoy });
  assert.equal(state.phase, 'patrol');
  state = updatePursuit(state, { type: 'hound', time: 15, position, player, senses: absent, decoy });
  assert.equal(state.phase, 'patrol');
  const replacement = { position: decoy.position, until: 110 };
  assert.equal(updatePursuit(state, { type: 'hound', time: 16, position, player, senses: absent, decoy: replacement }).phase, 'investigate');
});

test('lost sight leads to last-seen position, reachable corner searches, then patrol', () => {
  let state = updatePursuit(null, { time: 10, position, player, senses: seen });
  state = updatePursuit(state, { time: 11, position, player: { x: 30, z: 30 }, senses: absent });
  assert.deepEqual(state.target, player, 'Occluded player coordinates must not leak into the chase.');
  const corners = [{ x: 10, z: 4 }, { x: 14, z: 0 }];
  state = updatePursuit(state, { time: 12, position: player, senses: absent });
  assert.equal(state.phase, 'search');
  assert.equal(state.event, 'search');
  state = updatePursuit(state, { time: 12.1, position: player, senses: absent, searchTargets: corners });
  assert.deepEqual(state.target, corners[0]);
  assert.equal(state.event, 'search-target');
  state = updatePursuit(state, { time: 13, position: corners[0], senses: absent, searchTargets: corners });
  assert.deepEqual(state.target, corners[1]);
  state = updatePursuit(state, { time: 14, position: corners[1], senses: absent, searchTargets: corners });
  assert.equal(state.phase, 'patrol');
  assert.equal(state.alertUntil, 0);
});

test('searches have a fixed deadline and fresh visual contact immediately interrupts them', () => {
  let state = updatePursuit(null, { time: 2, position, player, senses: heard });
  assert.equal(state.phase, 'investigate');
  state = updatePursuit(state, { time: 10, position, player, senses: absent });
  assert.equal(state.phase, 'search');
  const reacquired = updatePursuit(state, { time: 11, position, player, senses: seen });
  assert.equal(reacquired.phase, 'pursue');
  assert.equal(reacquired.event, 'pursue');
  state = updatePursuit(state, { time: 15, position, player, senses: absent });
  assert.equal(state.phase, 'patrol');
  assert.deepEqual(updatePursuit(reacquired, { time: 12, reset: true }), createPursuit(12));
});

test('Brri telegraphs on detection, commits its charge direction and exposes a recovery window', () => {
  let state = updateBrriCharge(createBrriCharge(), { time: 42, position, target: player, detected: true });
  assert.equal(state.phase, 'windup');
  assert.equal(state.event, 'windup');
  assert.equal(state.canAttack, false);
  assert.equal(state.speedMultiplier, 0);
  state = updateBrriCharge(state, { time: 42.99, position, target: { x: 0, z: 10 }, detected: true });
  assert.equal(state.phase, 'windup');
  assert.equal(state.event, null);
  state = updateBrriCharge(state, { time: 43, position, target: { x: 0, z: 10 }, detected: true });
  assert.equal(state.phase, 'charge');
  assert.equal(state.canAttack, true);
  assert.deepEqual(state.direction, { x: 0, z: 1 });
  state = updateBrriCharge(state, { time: 43.7, position, target: { x: 10, z: 0 }, detected: true });
  assert.deepEqual(state.direction, { x: 0, z: 1 }, 'The charge must not home in on a dodging player.');
  state = updateBrriCharge(state, { time: 44.2, position, target: player, detected: true });
  assert.equal(state.phase, 'recovery');
  assert.equal(state.canAttack, false);
  assert.ok(state.speedMultiplier < 1);
  state = updateBrriCharge(state, { time: 45.4, position, target: player, detected: true });
  assert.equal(state.phase, 'idle');
  assert.equal(state.direction, null);
  state = updateBrriCharge(state, { time: 45.5, position, target: player, detected: true });
  assert.equal(state.phase, 'windup', 'Every fresh charge needs another readable wind-up.');
});

test('pause, in-game freezing, stun and walls cannot bypass Brri telegraphing', () => {
  let state = updateBrriCharge(null, { time: 8, position, target: player, detected: true });
  for (let i = 0; i < 5; i++) state = updateBrriCharge(state, { time: 8, position, target: player, detected: true });
  assert.equal(state.phase, 'windup', 'Gameplay time determines charge timing, not wall time or frame count.');
  state = updateBrriCharge(state, { time: 8.5, position, target: player, frozen: true, dt: .5 });
  assert.equal(state.phaseUntil, 9.5);
  assert.equal(state.canAttack, false);
  state = updateBrriCharge(state, { time: 9.5, position, target: player, detected: true });
  assert.equal(state.phase, 'charge');
  state = updateBrriCharge(state, { time: 9.6, position, blocked: true });
  assert.equal(state.phase, 'recovery', 'A wall stops the charge and opens recovery.');
  state = updateBrriCharge(state, { time: 10, reset: true });
  assert.deepEqual(state, createBrriCharge(10));
  state = updateBrriCharge(state, { time: 16, position, target: { x: .3, z: 0 }, detected: true });
  assert.equal(state.canAttack, false, 'Even point-blank reacquisition after a stun gets a wind-up.');
});

test('death hints explain the detection cause and a useful response for every entity', () => {
  for (const type of ['sahur', 'smiler', 'hound', 'watcher', 'ballerina', 'bribri', 'spioniro', 'bombardino']) {
    assert.match(deathHint(type, 'sound'), /^Your noise was heard\./);
    assert.ok(deathHint(type).length > 60);
  }
  assert.match(deathHint('bribri', 'light'), /flashlight.*sidestep.*cannot turn/s);
  assert.match(deathHint('hound', 'proximity'), /too close.*Crouch/s);
});

test('incomplete saved Brri attacks recover safely and require another full warning', () => {
  const invalid = [
    { ...createBrriCharge(), phase: 'windup', phaseUntil: 20, target: null },
    { ...createBrriCharge(), phase: 'charge', phaseUntil: 20, direction: null },
    { ...createBrriCharge(), phase: 'charge', phaseUntil: 20, direction: { x: 0, z: 0 } },
    { ...createBrriCharge(), phase: 'charge', phaseUntil: 20, direction: { x: NaN, z: 1 } },
    { ...createBrriCharge(), phase: 'windup', phaseUntil: Infinity, target: player },
    { ...createBrriCharge(), phase: 'toString' },
  ];
  for (const snapshot of invalid) {
    assert.deepEqual(updateBrriCharge(snapshot, { time: 19, position }), createBrriCharge(19));
    const warned = updateBrriCharge(snapshot, { time: 19, position, target: player, detected: true });
    assert.equal(warned.phase, 'windup');
    assert.equal(warned.phaseUntil, 20);
    assert.equal(warned.canAttack, false);
    assert.equal(warned.event, 'windup');
  }
  const repaired = updateBrriCharge({ ...createBrriCharge(), phase: 'charge', phaseUntil: 20,
    target: player, direction: { x: 300, z: 400 } }, { time: 19, position });
  assert.deepEqual(repaired.direction, { x: .6, z: .8 }, 'Valid committed headings keep a safe unit speed after repair.');
});

test('Brri charge warning has a distinct rising two-beat cue and respects sound controls', async () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const previousFetch = Object.getOwnPropertyDescriptor(globalThis, 'fetch');
  const nodes = [], captions = [];
  const decodedScare = { duration: 17 };
  let requestedAsset = '';
  class Parameter {
    value = 0;
    changes = [];
    setValueAtTime(value, at) { this.changes.push({ kind: 'set', value, at }); }
    exponentialRampToValueAtTime(value, at) { this.changes.push({ kind: 'ramp', value, at }); }
    setTargetAtTime() {}
    cancelScheduledValues() {}
  }
  class Node {
    constructor(kind) {
      this.kind = kind; this.frequency = new Parameter(); this.gain = new Parameter();
      this.Q = new Parameter(); this.pan = new Parameter(); nodes.push(this);
    }
    connect() {}
    disconnect() {}
    start(at, offset, duration) { this.startedAt = at; this.offset = offset; this.duration = duration; }
    stop(at) { this.stoppedAt = at; }
  }
  class AudioContext {
    currentTime = 10;
    sampleRate = 1000;
    state = 'running';
    destination = {};
    createBuffer(_channels, samples) { return { getChannelData: () => new Float32Array(samples) }; }
    createGain() { return new Node('gain'); }
    createOscillator() { return new Node('tone'); }
    createBufferSource() { return new Node('noise'); }
    createBiquadFilter() { return new Node('filter'); }
    createStereoPanner() { return new Node('pan'); }
    createDynamicsCompressor() { return Object.assign(new Node('compressor'), { threshold: {}, knee: {}, ratio: {}, attack: {}, release: {} }); }
    async decodeAudioData() { return decodedScare; }
    async resume() { this.state = 'running'; }
    async suspend() { this.state = 'suspended'; }
    async close() { this.state = 'closed'; }
  }
  Object.defineProperty(globalThis, 'window', { configurable: true, writable: true, value: { AudioContext, location: { protocol: 'https:' } } });
  Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: async url => {
    requestedAsset = String(url);
    return { ok: true, async arrayBuffer() { return new ArrayBuffer(8); } };
  } });
  const audio = createAudio();
  try {
    audio.setCaptionHandler(text => captions.push(text));
    audio.chargeWarning();
    assert.equal(nodes.length, 0, 'A warning cannot initialize audio or autoplay.');
    await audio.init();
    assert.match(requestedAsset, /audio-assets\/creepy-footsteps-scream-growl\.wav$/);
    const start = nodes.length;
    audio.chargeWarning();
    const warning = nodes.slice(start), tones = warning.filter(node => node.kind === 'tone');
    const beats = [...new Set(tones.filter(node => node.startedAt > 10).map(node => node.startedAt))];
    assert.equal(beats.length, 2, 'The warning has two distinct metal beats.');
    assert.ok(beats[1] - beats[0] >= .3);
    assert.ok(tones.every(node => node.frequency.changes.at(-1).value > node.frequency.changes[0].value), 'The warning rises instead of repeating the ordinary descending growl.');
    assert.match(captions[0], /Brri.*charge.*Sidestep/);
    audio.jumpscare(true, 'sahur');
    const sampledImpact = nodes.find(node => node.kind === 'noise' && node.buffer === decodedScare);
    assert.ok(sampledImpact, 'Fatal impacts include the bundled recording.');
    assert.deepEqual([sampledImpact.startedAt, sampledImpact.offset, sampledImpact.duration], [10, 5.35, 1.45]);
    assert.equal(sampledImpact.stoppedAt, 11.47);
    const scheduled = nodes.length;
    audio.setVolume(0); audio.chargeWarning();
    assert.equal(nodes.length, scheduled);
    assert.equal(captions.length, 1);
    audio.setVolume(.4); audio.pause(); audio.chargeWarning();
    assert.equal(nodes.length, scheduled, 'Paused warnings schedule no live sources.');
    await audio.resume(); audio.chargeWarning();
    assert.ok(nodes.length > scheduled);
    audio.dispose();
    const disposedCount = nodes.length;
    audio.chargeWarning();
    assert.equal(nodes.length, disposedCount);
  } finally {
    audio.dispose();
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else delete globalThis.window;
    if (previousFetch) Object.defineProperty(globalThis, 'fetch', previousFetch);
    else delete globalThis.fetch;
  }
});
