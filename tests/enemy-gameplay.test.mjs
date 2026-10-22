import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameRuntime } from './helpers/game-runtime.mjs';

// Use the real generated rooms and collision checks. A straight clear lane plus
// a lateral escape lets these tests exercise actual steering, rather than only
// inspecting a state machine with enemies placed through walls.
function encounterArena(world) {
  const clear = (a, b) => {
    if (!world.lineOfSight(a, b)) return false;
    const length = Math.hypot(b.x - a.x, b.z - a.z), samples = Math.ceil(length / .2);
    for (let i = 0; i <= samples; i++) {
      if (!world.isWalkable(a.x + (b.x - a.x) * i / samples, a.z + (b.z - a.z) * i / samples, .33)) return false;
    }
    return true;
  };
  for (const room of world.rooms) {
    const [x0, z0, x1, z1] = room.bounds;
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      if (world.grid[z]?.[x] !== 0) continue;
      const enemy = world.cellCenter(x, z);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const player = { x: enemy.x + dx * 12, z: enemy.z + dz * 12 };
        if (world.roomAt(player.x, player.z)?.id !== room.id || !clear(enemy, player)) continue;
        for (const side of [1, -1]) {
          const dodge = { x: player.x - dz * 2.5 * side, z: player.z + dx * 2.5 * side };
          if (world.roomAt(dodge.x, dodge.z)?.id === room.id && clear(player, dodge)) return { enemy, player, dodge };
        }
      }
    }
  }
  assert.fail(`No collision-clear 12 m encounter lane and lateral dodge in ${world.level.name}.`);
}

async function prepare(game, level, type) {
  const { qa } = game;
  qa.menu();
  game.storage.set('sahur-field-training-v1', 'complete');
  await qa.start(level);
  qa.skipTraining?.();
  qa.setSetting('scares', false);
  const actor = qa.actors.find(candidate => candidate.model.type === type);
  assert.ok(actor, `Missing ${type} in level ${level}.`);
  qa.actors.forEach(candidate => { candidate.stunnedUntil = candidate === actor ? 0 : Infinity; });
  const arena = encounterArena(qa.world);
  actor.model.group.position.set(arena.enemy.x, 0, arena.enemy.z);
  actor.path = []; actor.pathTimer = 0;
  qa.teleport(arena.player.x, arena.player.z);
  qa.look(Math.atan2(arena.player.x - arena.enemy.x, arena.player.z - arena.enemy.z));
  qa.advance(20);
  return { actor, arena };
}

function phaseFrame(game, actor, wanted, maximum = 60) {
  for (let i = 0; i < maximum && actor.charge.phase !== wanted; i++) game.frames(1);
  assert.equal(actor.charge.phase, wanted, `Brri must reach its ${wanted} phase.`);
}

test('Brri wind-up, paused timing, committed charge and recovery drive the actual model', async t => {
  const game = await createGameRuntime();
  t.after(() => game.dispose());
  const { qa, frames, element } = game;
  const { actor, arena } = await prepare(game, 0, 'bribri');
  const initial = actor.model.group.position.toArray();
  frames(1);
  assert.equal(actor.charge.phase, 'windup');
  assert.equal(actor.charge.canAttack, false);
  assert.deepEqual(actor.model.group.position.toArray(), initial, 'Brri plants its feet during the warning.');
  assert.match(element('toast').textContent + element('audio-caption').textContent, /brri|charge|sidestep/i, 'The warning reaches the visible interface.');
  frames(8);
  assert.equal(actor.charge.phase, 'windup');
  const paused = { time: qa.state.elapsed, charge: structuredClone(actor.charge), position: actor.model.group.position.toArray() };
  qa.pause(); frames(60);
  assert.equal(qa.state.elapsed, paused.time);
  assert.deepEqual(actor.charge, paused.charge);
  assert.deepEqual(actor.model.group.position.toArray(), paused.position);
  qa.resume();
  phaseFrame(game, actor, 'charge');
  assert.equal(actor.charge.canAttack, true);
  const committed = { ...actor.charge.direction }, chargeStart = actor.model.group.position.clone();
  qa.teleport(arena.dodge.x, arena.dodge.z);
  frames(6);
  assert.equal(actor.charge.phase, 'charge');
  assert.deepEqual(actor.charge.direction, committed);
  const displacement = actor.model.group.position.clone().sub(chargeStart);
  assert.ok(Math.hypot(displacement.x, displacement.z) > .5, 'The committed charge actually moves the enemy.');
  assert.ok(Math.abs(displacement.x * committed.z - displacement.z * committed.x) < .001, 'A dodging player cannot steer a live charge.');
  phaseFrame(game, actor, 'recovery');
  assert.equal(actor.charge.canAttack, false);
  assert.ok(actor.charge.speedMultiplier < 1);
  frames(10);
  assert.equal(actor.charge.phase, 'recovery', 'The recovery window lasts long enough to escape.');
  assert.equal(qa.state.mode, 'playing');
});

test('an actual decoy cannot override direct sight of the player', async t => {
  const game = await createGameRuntime();
  t.after(() => game.dispose());
  const { actor, arena } = await prepare(game, 0, 'sahur');
  const before = game.qa.state.decoys;
  game.qa.decoy(); game.frames(1);
  assert.equal(game.qa.state.decoys, before - 1);
  assert.equal(actor.pursuit.phase, 'pursue');
  assert.equal(actor.pursuit.cause, 'sight');
  assert.equal(actor.pursuit.decoyId, null);
  assert.deepEqual(actor.pursuit.target, arena.player);
});

test('a sounding decoy draws the Hound away from a noisy player', async t => {
  const game = await createGameRuntime();
  t.after(() => game.dispose());
  const { actor, arena } = await prepare(game, 2, 'hound');
  game.qa.decoy();
  game.qa.battery(10);
  game.qa.crank(true);
  game.frames(1);
  assert.equal(game.qa.state.cranking, true, 'The player is generating a real sound stimulus.');
  assert.equal(actor.pursuit.phase, 'investigate');
  assert.equal(actor.pursuit.cause, 'sound');
  assert.ok(actor.pursuit.decoyId);
  assert.ok(Math.hypot(actor.pursuit.target.x - arena.player.x, actor.pursuit.target.z - arena.player.z) > 2,
    'The investigation target is the thrown decoy, away from the player.');
  const deadline = actor.pursuit.alertUntil;
  game.frames(3);
  assert.equal(actor.pursuit.alertUntil, deadline, 'Repeated lure noise does not refresh the same investigation forever.');
  game.qa.crank(false);
});

test('a real fatal encounter shows its detection cause and an actionable survival hint', async t => {
  const game = await createGameRuntime();
  t.after(() => game.dispose());
  const { actor, arena } = await prepare(game, 0, 'sahur');
  actor.model.group.position.set(arena.player.x + .35, 0, arena.player.z);
  assert.ok(game.qa.world.isWalkable(actor.model.group.position.x, actor.model.group.position.z, .3));
  assert.ok(game.qa.world.lineOfSight(actor.model.group.position, { x: arena.player.x, z: arena.player.z }));
  game.frames(1);
  assert.equal(game.qa.state.mode, 'dead');
  assert.equal(game.element('end-screen').hidden, false);
  assert.equal(game.element('end-hint').hidden, false);
  assert.match(game.element('end-hint').textContent, /You were seen\./);
  assert.match(game.element('end-hint').textContent, /corner.*crouch|crouch.*corner/i);
});
