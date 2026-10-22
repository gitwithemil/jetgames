import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameRuntime } from './helpers/game-runtime.mjs';

const veteran = new Map([['sahur-field-training-v1', 'complete']]);

test('a new player learns through movement, crouching, a practice decoy and a beam change', async t => {
  const game = await createGameRuntime();
  t.after(() => game.dispose());
  const { qa, element, frames, key, release } = game;
  await qa.start(0,{training:true});
  assert.equal(qa.state.training.active, true);
  assert.equal(element('field-training').hidden, false);
  assert.equal(element('weapon-quest').hidden, true);
  assert.equal(element('stun-button').hidden, true);
  assert.equal(element('decoy-button').hidden, true);
  const positions = qa.actors.map(a => a.model.group.position.toArray());
  qa.advance(25); frames(2);
  assert.deepEqual(qa.actors.map(a => a.model.group.position.toArray()), positions);
  assert.equal(qa.scare(false, 'glimpse'), false, 'Training remains safe even after normal enemy grace ends.');
  await key('KeyW'); frames(15); await release('KeyW');
  assert.equal(qa.state.training.step, 1);
  await key('KeyC'); frames(16); await release('KeyC');
  assert.equal(qa.state.training.step, 2);
  assert.equal(element('decoy-button').hidden, false);
  await key('KeyQ'); await release('KeyQ');
  assert.equal(qa.state.training.step, 3);
  assert.equal(qa.state.decoys, 2);
  assert.equal(element('beam-button').hidden, false);
  await key('KeyB'); await release('KeyB');
  assert.equal(qa.state.training.active, false);
  assert.equal(qa.state.beamMode, 'flood');
  assert.equal(qa.state.decoys, 3, 'The practice throw does not reduce the expedition loadout.');
  assert.equal(element('field-training').hidden, true);
  assert.equal(game.storage.get('sahur-field-training-v1'), 'complete');
  assert.ok(qa.state.enemyGraceUntil > qa.state.elapsed);
});

test('guided start can be replayed, paused on the map, and skipped', async t => {
  const game = await createGameRuntime({ initialStorage: veteran });
  t.after(() => game.dispose());
  const { qa, element, frames, key } = game;
  await qa.start(0);
  assert.equal(qa.state.training.active, false);
  qa.menu(); await element('training-button').dispatch('click');
  assert.equal(qa.state.training.active, true);
  await key('KeyM');
  const paused = qa.state.elapsed;
  assert.equal(qa.state.mode, 'paused');
  assert.equal(element('field-training').hidden, true);
  frames(30);
  assert.equal(qa.state.elapsed, paused);
  await key('KeyM');
  assert.equal(element('field-training').hidden, false);
  await element('training-skip').dispatch('click');
  assert.equal(qa.state.training.active, false);
  assert.equal(qa.state.decoys, 3, 'Skipping before the practice throw never grants a free decoy.');
});

test('touch crouch changes the player stance and completes the quiet-movement lesson', async t => {
  const game = await createGameRuntime({ coarse: true });
  t.after(() => game.dispose());
  const { qa, element, frames, key, release } = game;
  await qa.start(0,{training:true});
  assert.match(element('training-detail').textContent, /stick/);
  await key('KeyW'); frames(15); await release('KeyW');
  await element('touch-crouch').dispatch('click'); frames(16);
  assert.equal(element('touch-crouch').getAttribute('aria-pressed'), 'true');
  assert.ok(qa.state.player[1] < 1.1);
  assert.equal(qa.state.training.step, 2);
  await element('touch-crouch').dispatch('click'); frames(12);
  assert.equal(element('touch-crouch').getAttribute('aria-pressed'), 'false');
  assert.ok(qa.state.player[1] > 1.6);
});

test('research controls stay quiet until a case is actually discovered', async t => {
  const game = await createGameRuntime({ initialStorage: veteran });
  t.after(() => game.dispose());
  const { qa, element } = game;
  await qa.start(0);
  assert.equal(element('weapon-quest').hidden, true);
  const part = qa.world.armory.parts[0];
  let approached = false;
  for (const radius of [1.3, 1.8, 2.4, .65]) {
    for (let n = 0; n < 24 && !approached; n++) {
      const angle = n / 24 * Math.PI * 2;
      const x = part.position.x + Math.sin(angle) * radius, z = part.position.z + Math.cos(angle) * radius;
      if (!qa.world.isWalkable(x, z, .27) || !qa.world.lineOfSight({ x, z }, part.position)) continue;
      qa.teleport(x, z); qa.look(Math.atan2(x - part.position.x, z - part.position.z));
      qa.interact(); approached = qa.state.researchDiscovered;
    }
    if (approached) break;
  }
  assert.equal(approached, true);
  assert.equal(element('weapon-quest').hidden, false);
  assert.equal(element('stun-button').hidden, false);
});

test('chases, recovery time, low battery and pause prevent staged fake-outs', async t => {
  const game = await createGameRuntime({ initialStorage: veteran });
  t.after(() => game.dispose());
  const { qa, frames } = game;
  await qa.start(0);
  const sahur = qa.actors.find(a => a.model.type === 'sahur');
  qa.actors.filter(a => a !== sahur).forEach(a => a.stunnedUntil = Infinity);
  const nearby = qa.world.cellCenter(11, 18);
  assert.ok(qa.world.isWalkable(nearby.x, nearby.z, .3));
  sahur.model.group.position.copy(nearby);
  qa.advance(25); frames(2);
  assert.equal(qa.state.chasing, true);
  assert.equal(qa.scare(false, 'glimpse'), false);
  assert.ok(qa.state.quietUntil > qa.state.elapsed + 19);
  sahur.stunnedUntil = Infinity; frames(1);
  assert.equal(qa.state.chasing, false);
  assert.equal(qa.scare(false, 'glimpse'), false, 'The end of a chase leaves time to recover.');
  qa.advance(22); frames(1);
  qa.battery(5);
  assert.equal(qa.scare(false, 'glimpse'), false);
  qa.battery(100); qa.pause();
  assert.equal(qa.scare(false, 'glimpse'), false);
  qa.resume();
  assert.equal(qa.scare(false, 'glimpse'), true, 'Scares can return once the player has recovered.');
});
