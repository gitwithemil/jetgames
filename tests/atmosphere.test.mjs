import test from 'node:test';
import assert from 'node:assert/strict';
import {createGameRuntime} from './helpers/game-runtime.mjs';

test('all stages have themed landmarks, retain clear navigation, and dispose their decorations',async t=>{
 const game=await createGameRuntime();t.after(()=>game.dispose());const {qa}=game;
 for(let index=0;index<4;index++){
  qa.load(index);const w=qa.world;
  assert(w.atmosphere.landmarks.length>=4,`${w.level.name} has room landmarks`);
  assert.equal(new Set(w.atmosphere.landmarks.map(l=>l.room)).size,w.atmosphere.landmarks.length);
  const layer=qa.scene.getObjectByName('ENVIRONMENT_LANDMARKS');assert(layer);
  for(let z=0;z<w.height;z++)for(let x=0;x<w.width;x++)if(w.grid[z][x]===0){const p=w.cellCenter(x,z);assert(w.isWalkable(p.x,p.z,.33));}
  for(const item of [...w.fuses,...w.supplies,...w.armory.parts,w.armory.bench])assert(w.findPath(w.spawn,item.position).length);
  const motes=qa.scene.getObjectByName('FLASHLIGHT_MOTES');assert(motes);w.setAtmosphereEffects(true);assert.equal(motes.visible,false);w.setAtmosphereEffects(false);assert.equal(motes.visible,true);
  const fan=qa.scene.getObjectByName('SLOW_EXHAUST_FAN');if(fan){w.update(1,.1);const angle=fan.rotation.z;w.update(2,0);assert.equal(fan.rotation.z,angle);w.update(3,.1);assert.notEqual(fan.rotation.z,angle);w.setAtmosphereEffects(true);const frozen=fan.rotation.z;w.update(4,.1);assert.equal(fan.rotation.z,frozen);}
 }
 const old=qa.scene.getObjectByName('ENVIRONMENT_LANDMARKS');qa.load(0);assert.notEqual(qa.scene.getObjectByName('ENVIRONMENT_LANDMARKS'),old);
});
