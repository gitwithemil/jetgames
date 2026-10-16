import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameRuntime } from './helpers/game-runtime.mjs';
import { surveyLayout } from '../dist/survey-map.js';

// Run with Node 22+: node --experimental-default-type=module --test tests/*.test.mjs
// Uses real geometry/gameplay; GPU rendering and browser accessibility/layout
// remain visual QA responsibilities.
const roster = [
  ['sahur', 'bribri'], ['smiler', 'ballerina'],
  ['hound', 'bombardino'], ['watcher', 'sahur', 'spioniro'],
];

test('the generated stages and survey interface work together', async t => {
  const game = await createGameRuntime();
  t.after(() => game.dispose());
  const { qa, element, key, release, frames } = game;

  const click = id => element(id).dispatch('click');
  function keepEntitiesAway() { qa.actors.forEach(actor => { actor.stunnedUntil = Infinity; }); }
  function actorPositions() { return qa.actors.map(actor => actor.model.group.position.toArray()); }
  function pauseSnapshot() {
    const state = qa.state;
    return { elapsed: state.elapsed, totalElapsed: state.totalElapsed, battery: state.battery,
      stamina: state.stamina, heat: state.torchHeat, decoys: state.decoys,
      player: state.player, entities: actorPositions() };
  }
  async function start(index = 0) {
    for (const dialog of game.document.querySelectorAll('dialog')) if (dialog.open) await dialog.dispatch('cancel');
    qa.menu();
    await game.document.querySelectorAll('[data-level]')[index].dispatch('click');
    await click('play-button');
    assert.equal(qa.state.mode, 'playing');
    assert.equal(qa.state.levelIndex, index);
    qa.setSetting('scares', false);
  }
  // Choose an actual standing position with a clear interaction ray. This catches
  // furnishing/layout edits that leave an objective embedded in a wall or prop.
  function approach(item, world = qa.world) {
    for (const radius of [1.3, 1.8, 2.4, .65]) {
      for (let n = 0; n < 24; n++) {
        const angle = n / 24 * Math.PI * 2;
        const x = item.position.x + Math.sin(angle) * radius;
        const z = item.position.z + Math.cos(angle) * radius;
        if (!world.isWalkable(x, z, .27)) continue;
        if (!world.lineOfSight({ x, z }, item.position)) continue;
        qa.teleport(x, z);
        qa.look(Math.atan2(x - item.position.x, z - item.position.z));
        return;
      }
    }
    assert.fail(`No clear, walkable interaction approach for ${world.level.name}: ${item.label ?? item.id ?? 'exit'}`);
  }
  function clickCell(cell) {
    const canvas = element('map-canvas');
    const layout = surveyLayout(qa.world, canvas.width, canvas.height);
    const rectangle = canvas.getBoundingClientRect();
    const x = layout.left + (cell.x + .5) * layout.size;
    const y = layout.top + (cell.z + .5) * layout.size;
    return canvas.dispatch('click', { clientX: rectangle.left + x / canvas.width * rectangle.width,
      clientY: rectangle.top + y / canvas.height * rectangle.height });
  }

  await t.test('initializes real world geometry and binds the visible controls', () => {
    assert.ok(qa, 'The ?qa interface must be available after entry initialization.');
    assert.equal(qa.state.mode, 'menu');
    assert.equal(element('play-button').disabled, false);
    assert.equal(element('load-error').hidden, true);
    assert.ok(qa.world.rooms.length > 3);
    assert.ok(qa.scene.children.some(object => object.isGroup && object.children.some(child => child.isInstancedMesh)), 'World geometry was built.');
    assert.equal(String(element('brightness-input').value), '100');
    assert.equal(element('brightness-output').textContent, '100%');
    assert.equal(game.rendererInstances[0].toneMappingExposure, .92);
    for (const id of ['map-open-button', 'touch-map', 'map-resume', 'map-clear-waypoint']) {
      assert.ok((element(id).events.get('click') ?? []).length, `${id} must have a click binding.`);
    }
  });

  await t.test('screen brightness adjusts scene exposure, flashlight diameter and saves locally', async () => {
    await start();
    const slider = element('brightness-input');
    const flashlight = qa.scene.getObjectByName('PLAYER_FLASHLIGHT');
    assert.ok(Math.abs(flashlight.angle - .35) < 1e-12);
    slider.value = '150';
    await slider.dispatch('input');
    assert.equal(element('brightness-output').textContent, '150%');
    assert.ok(Math.abs(game.rendererInstances[0].toneMappingExposure - 1.38) < 1e-12);
    assert.ok(Math.abs(flashlight.angle - .525) < 1e-12);
    assert.equal(JSON.parse(game.storage.get('sahur-settings')).brightness, 150);
    slider.value = '50';
    await slider.dispatch('input');
    assert.equal(element('brightness-output').textContent, '50%');
    assert.ok(Math.abs(game.rendererInstances[0].toneMappingExposure - .46) < 1e-12);
    assert.ok(Math.abs(flashlight.angle - .175) < 1e-12);
    slider.value = '100';
    await slider.dispatch('input');
    assert.ok(Math.abs(flashlight.angle - .35) < 1e-12);
  });

  await t.test('every menu stage starts with its objectives, cast and limited lighting', async () => {
    for (let index = 0; index < roster.length; index++) {
      await start(index);
      frames(1);
      assert.equal(qa.world.targetCount, [5, 3, 4, 3][index]);
      assert.equal(qa.world.fuses.length, qa.world.targetCount);
      assert.deepEqual(qa.actors.map(actor => actor.model.type), roster[index]);
      assert.equal(qa.state.decoys, 3);
      assert.equal(qa.state.fuseCount, 0);
      assert.equal(game.document.querySelectorAll('#fuse-slots b').length, qa.world.targetCount);
      assert.ok(qa.world.isWalkable(qa.state.player[0], qa.state.player[2], .27), 'Spawn remains usable.');
      assert.ok(qa.scene.fog?.density >= .02, 'Distance remains obscured.');
      const lights = [];
      qa.scene.traverse(object => { if (object.isLight) lights.push(object); });
      assert.ok(lights.some(light => light.isHemisphereLight));
      assert.ok(lights.filter(light => light.isHemisphereLight).every(light => light.intensity <= .04), 'Map upgrades must preserve low ambient visibility.');
      assert.ok(lights.filter(light => light.isDirectionalLight).every(light => light.intensity === 0));
      assert.ok(qa.scene.getObjectByName('FLASHLIGHT_SPILL').intensity <= .03);
    }
  });

  await t.test('movement, walls, crouch, torch, scanner and decoys still respond to controls', async () => {
    await start();
    keepEntitiesAway();
    const origin = qa.state.player;
    await key('KeyW'); frames(10); await release('KeyW');
    assert.ok(qa.state.player[2] < origin[2] - 1, 'W moves forward in the spawn hall.');
    await key('KeyC'); frames(12); await release('KeyC');
    assert.ok(qa.state.player[1] < 1.1);
    const yaw = qa.state.yaw;
    await game.event('mousemove', { movementX: 50, movementY: 0 });
    assert.notEqual(qa.state.yaw, yaw);
    await key('KeyB'); await release('KeyB');
    assert.equal(qa.state.beamMode, 'flood');
    await key('KeyF'); await release('KeyF');
    assert.equal(qa.scene.getObjectByName('PLAYER_FLASHLIGHT').visible, false);
    await click('touch-flashlight');
    assert.equal(qa.scene.getObjectByName('PLAYER_FLASHLIGHT').visible, true);
    await key('KeyQ'); await release('KeyQ');
    assert.equal(qa.state.decoys, 2);
    await click('decoy-button');
    assert.equal(qa.state.decoys, 1);
    await key('KeyR'); await release('KeyR');
    assert.match(element('toast').textContent, /SCANNER/);
    await click('stun-button');
    assert.match(element('toast').textContent, /Weapon locked/);
    qa.battery(5);
    await key('KeyV'); frames(10); await release('KeyV');
    assert.ok(qa.state.battery > 5, 'Stationary hand-cranking restores battery.');
    const world = qa.world;
    const unit = world.cellSize;
    let edge;
    for (let z = 1; z < world.height - 1 && !edge; z++) for (let x = 1; x < world.width - 1 && !edge; x++) {
      const point = world.cellCenter(x, z);
      if (world.grid[z][x] === 0 && world.grid[z][x + 1] === 1 && world.isWalkable((x + 1) * unit - .35, point.z, .27)) edge = { x: (x + 1) * unit, z: point.z };
    }
    assert.ok(edge, 'There must be a reachable wall edge for the collision check.');
    qa.teleport(edge.x - .35, edge.z); qa.look(-Math.PI / 2);
    await key('KeyW'); frames(15); await release('KeyW');
    assert.ok(qa.state.player[0] < edge.x - .26, 'Player cannot cross a solid wall.');
  });

  await t.test('map input pauses the expedition and M, Escape, touch and Back resume correctly', async () => {
    await start();
    frames(240);
    const entityStart = actorPositions();
    frames(30);
    assert.notDeepEqual(actorPositions(), entityStart, 'Patrols are live before opening the map.');
    await key('KeyM');
    assert.equal(qa.state.mode, 'paused');
    assert.equal(element('map-dialog').open, true);
    assert.equal(game.document.activeElement, element('map-canvas'));
    const paused = pauseSnapshot(); frames(100);
    assert.deepEqual(pauseSnapshot(), paused, 'Time, battery, stamina, heat, decoys and actors freeze while consulting the map.');
    await key('KeyQ'); await key('KeyB'); await key('KeyR');
    assert.deepEqual(pauseSnapshot(), paused, 'Gameplay shortcuts have no side effects inside the map.');
    await key('KeyM');
    assert.equal(element('map-dialog').open, false);
    assert.equal(qa.state.mode, 'playing');
    frames(1); assert.ok(qa.state.elapsed > paused.elapsed);
    await click('map-open-button');
    await key('Escape');
    assert.equal(element('map-dialog').open, false);
    assert.equal(qa.state.mode, 'playing');
    await click('touch-map');
    assert.equal(qa.state.mode, 'paused');
    await click('map-resume');
    assert.equal(qa.state.mode, 'playing');
    await key('Escape');
    assert.equal(qa.state.mode, 'paused');
    await click('pause-settings');
    await element('settings-dialog').dispatch('cancel');
    assert.equal(qa.state.mode, 'paused', 'Closing settings opened from pause preserves the pause.');
    await click('resume-button');
    assert.equal(qa.state.mode, 'playing');
  });

  await t.test('the canvas pins and clears a known waypoint, and a new stage resets the survey', async () => {
    await start();
    keepEntitiesAway();
    await key('KeyW'); frames(12); await release('KeyW');
    await click('map-open-button');
    assert.match(element('map-explored').textContent, /\d+%/);
    assert.match(element('map-progress').textContent, /0\s*\/\s*5/);
    const cell = qa.world.cellAt(qa.state.player[0], qa.state.player[2]);
    await clickCell(cell);
    assert.deepEqual(qa.survey.waypoint, cell);
    assert.equal(element('map-clear-waypoint').disabled, false);
    assert.doesNotMatch(element('map-waypoint-status').textContent, /No waypoint/);
    await click('map-clear-waypoint');
    assert.equal(qa.survey.waypoint, null);
    assert.equal(element('map-clear-waypoint').disabled, true);
    await clickCell(cell);
    await element('map-canvas').dispatch('keydown', { code: 'Delete', key: 'Delete' });
    assert.equal(qa.survey.waypoint, null);
    await clickCell(cell);
    await click('map-resume');
    const oldTrail = qa.survey.trail;
    assert.ok(oldTrail.length > 1);
    await start(1);
    assert.equal(qa.survey.waypoint, null);
    assert.equal(qa.survey.trail.length, 1);
    assert.equal(qa.survey.visited.size, 1);
    assert.ok(qa.survey.explored.size < qa.world.width * qa.world.height / 4, 'Starting a stage charts only the nearby area.');
  });

  await t.test('all objectives remain interactable and every stage exit advances the campaign', async () => {
    await start();
    for (let index = 0; index < roster.length; index++) {
      assert.equal(qa.state.levelIndex, index);
      keepEntitiesAway();
      const world = qa.world;
      for (const item of world.fuses) {
        approach(item, world);
        const before = qa.state.fuseCount;
        await key('KeyE');
        if (world.level.hold) frames(Math.ceil(world.level.hold / .05) + 2);
        await release('KeyE');
        assert.equal(qa.state.fuseCount, before + 1, `${world.level.name} objective ${item.id} responds to E.`);
        assert.equal(item.mesh.visible, false);
      }
      assert.equal(qa.state.fuseCount, world.targetCount);
      assert.equal(element('objective-title').textContent, 'Get to the exit');
      approach(world.exit, world);
      await key('KeyE'); await release('KeyE');
      assert.equal(qa.state.mode, index === 3 ? 'won' : 'cleared');
      if (index < 3) {
        assert.equal(element('stage-screen').hidden, false);
        assert.equal(game.storage.get('sahur-checkpoint'), String(index + 1));
        await click('stage-continue');
        assert.equal(qa.state.mode, 'playing');
        assert.equal(qa.state.fuseCount, 0);
        assert.equal(qa.state.decoys, 3);
        assert.equal(qa.survey.waypoint, null);
      }
    }
    assert.equal(element('end-screen').hidden, false);
    assert.match(element('end-title').textContent, /MADE IT OUT/);
    assert.ok(Number(game.storage.get('sahur-best-score')) > 0);
    await click('retry-button');
    assert.equal(qa.state.levelIndex, 0);
    assert.equal(qa.state.mode, 'playing');
    assert.equal(qa.state.fuseCount, 0);
    assert.ok(qa.world.fuses.every(item => item.mesh.visible));
    qa.menu();
    assert.equal(element('menu').hidden, false);
    assert.equal(element('hud').hidden, true);
  });
});
