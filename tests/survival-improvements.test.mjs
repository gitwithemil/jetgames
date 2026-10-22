import test from 'node:test';
import assert from 'node:assert/strict';
import {inVisionCone,soundBearing,controlPuzzle,signalCode} from '../dist/survival.js';
import {senseEnemy} from '../dist/enemies.js';
import {createGameRuntime} from './helpers/game-runtime.mjs';
import {createWorld} from '../dist/world.js';
import * as THREE from '../dist/vendor/three.module.js';

function approach(game,item){
  const {qa}=game,w=qa.world;
  for(const r of [1.3,1.8,2.4,.65])for(let n=0;n<24;n++){
    const a=n/24*Math.PI*2,x=item.position.x+Math.sin(a)*r,z=item.position.z+Math.cos(a)*r;
    if(w.isWalkable(x,z,.27)&&w.lineOfSight({x,z},item.position)){qa.teleport(x,z);qa.look(Math.atan2(x-item.position.x,z-item.position.z));return;}
  }
  assert.fail('No accessible interaction approach');
}

test('forward patrol vision permits stealth behind enemies while hearing and Watcher freezing remain active',()=>{
  const pos={x:0,z:0};
  assert(inVisionCone(pos,{x:0,z:10},0));assert(!inVisionCone(pos,{x:0,z:-10},0));
  assert(inVisionCone(pos,{x:0,z:-1},0));
  assert(!inVisionCone(pos,{x:10,z:0},0));assert(inVisionCone(pos,{x:10,z:0},0,true));
  const senses={distance:10,los:true,vision:false,moving:false,crouching:true,flashlight:true,observed:true,illuminated:true};
  for(const type of ['sahur','bombardino','spioniro','ballerina','smiler'])assert.equal(senseEnemy(type,senses).detect,false,type);
  assert.equal(senseEnemy('sahur',{...senses,sprinting:true}).detect,true);
  assert.equal(senseEnemy('hound',{...senses,working:true}).detect,true);
  assert.equal(senseEnemy('watcher',senses).frozen,true);
});

test('sound follows camera-relative bearing, distance and walls',()=>{
  const l={x:0,z:0},s={x:10,z:0};
  assert.equal(soundBearing(l,s,0).pan,1);assert.equal(soundBearing(l,s,Math.PI).pan,-1);
  assert(soundBearing(l,s,0,true).gain<soundBearing(l,s,0).gain);
  assert(soundBearing(l,s,0,true).cutoff<soundBearing(l,s,0).cutoff);
  assert(soundBearing(l,{x:40,z:0},0).gain<soundBearing(l,s,0).gain);
});

test('seeded expeditions preserve retry and reload placements, with reachable objectives, supplies and enemies',async t=>{
  const game=await createGameRuntime();t.after(()=>game.dispose());
  const {qa}=game;game.storage.set('sahur-field-training-v1','complete');await qa.start(0);
  const seed=qa.checkpoint.seed;assert(seed>0);
  const signature=w=>w.fuses.map(f=>f.position.toArray());const initial=signature(qa.world);
  qa.pause();assert.equal(qa.save(),true);await qa.continue();assert.equal(qa.checkpoint.seed,seed);assert.deepEqual(signature(qa.world),initial);
  let different=false;
  for(let level=0;level<4;level++)for(const seed of [1,42,4294967295]){
    const scene=new THREE.Scene(),w=createWorld(THREE,scene,level,seed),again=createWorld(THREE,new THREE.Scene(),level,seed);
    assert.deepEqual(signature(w),signature(again));if(level===0&&JSON.stringify(signature(w))!==JSON.stringify(initial))different=true;
    for(const item of [...w.fuses,...w.supplies,...w.armory.parts,w.armory.bench]){
      assert(w.findPath(w.spawn,item.position).length,'All items remain reachable');
      assert(w.isWalkable(item.position.x,item.position.z,.27),'Item cell is unobstructed');
    }
    for(const home of w.enemyHomes){assert(w.isWalkable(home.x,home.z,.33));assert(home.distanceTo(w.spawn)>32);assert(w.findPath(w.spawn,home).length);}
    w.dispose();again.dispose();
  }
  assert(different);
});

test('specific fuse circuits illuminate the collected region and survive a blackout',async t=>{
  const game=await createGameRuntime();t.after(()=>game.dispose());const {qa}=game;await qa.start(0);qa.skipTraining();
  qa.complete(qa.world.fuses[4]);qa.world.update(1,.1);
  const light=id=>qa.scene.getObjectByName(`RESTORABLE_CIRCUIT_${id}`).children.find(c=>c.isPointLight);
  assert.equal(light(5).intensity,.8);assert.equal(light(1).intensity,0);
  qa.world.setBlackout(1);qa.world.update(2,.1);assert.equal(light(5).intensity,.015);
  qa.world.update(4,2);assert.equal(light(5).intensity,.8);assert.equal(light(1).intensity,0);
});

test('machine terminals reject incorrect settings, cancel cleanly and commit a solved machine only once',async t=>{
  const game=await createGameRuntime();t.after(()=>game.dispose());const {qa,element}=game;
  await qa.start(1);qa.actors.forEach(a=>a.stunnedUntil=Infinity);const item=qa.world.fuses[0];approach(game,item);
  await game.key('KeyE');game.frames(28);await game.release('KeyE');assert.equal(qa.state.mode,'paused');
  await element('control-submit').dispatch('click');assert.equal(qa.state.fuseCount,0);assert.match(element('control-result').textContent,/mismatch/);
  await game.key('Escape');assert.equal(qa.state.mode,'playing');assert.equal(qa.state.fuseCount,0);
  await game.key('KeyE');game.frames(28);await game.release('KeyE');
  const rule=controlPuzzle('pool',item.id,qa.world.seed);element('control-a').value=String(rule.a);element('control-b').value=String(rule.b);
  await element('control-submit').dispatch('click');assert.equal(qa.state.fuseCount,1);assert.equal(qa.state.mode,'playing');
  await element('control-submit').dispatch('click');assert.equal(qa.state.fuseCount,1);
});

test('Archive decoding persists, extraction cancels on release and wins only after eight continuous seconds',async t=>{
  const game=await createGameRuntime();t.after(()=>game.dispose());const {qa,element}=game;
  await qa.start(3);qa.setSetting('scares',false);qa.actors.forEach(a=>a.stunnedUntil=Infinity);qa.world.fuses.forEach(qa.complete);
  approach(game,qa.world.exit);await game.key('KeyE');await game.release('KeyE');
  element('signal-input').value='000';await element('control-submit').dispatch('click');assert.equal(qa.state.mode,'paused');
  element('signal-input').value=signalCode(qa.world.seed);await element('control-submit').dispatch('click');
  assert.equal(qa.capture().archiveDecoded,true);qa.pause();assert.equal(qa.save(),true);await qa.continue();qa.actors.forEach(a=>a.stunnedUntil=Infinity);
  assert.equal(qa.capture().archiveDecoded,true);approach(game,qa.world.exit);
  await game.key('KeyE');game.frames(80);await game.release('KeyE');assert.equal(qa.state.mode,'playing');game.frames(100);assert.equal(qa.state.mode,'playing');
  await game.key('KeyE');game.frames(162);await game.release('KeyE');assert.equal(qa.state.mode,'won');assert.match(element('end-description').textContent,/Lobby.*pools.*pipes.*Archive/);
});
