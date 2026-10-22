import assert from 'node:assert/strict';
import test from 'node:test';
import {createGameRuntime} from './helpers/game-runtime.mjs';
import {EXPEDITION_KEY} from '../dist/expedition-save.js';
import {createPursuit,updatePursuit} from '../dist/encounters.js';

const settings={scares:false,difficulty:'hard',challenge:'scarcity'};
const initialStorage=()=>new Map([
  ['sahur-field-training-v1','complete'],['sahur-settings',JSON.stringify(settings)]
]);
const baseline=()=>({levelIndex:2,score:1800,totalElapsed:80,weaponOwned:true,ammo:2,difficulty:'hard',challenge:'scarcity'});
const baselineStorage=()=>new Map([...initialStorage(),[EXPEDITION_KEY,JSON.stringify({version:1,checkpoint:baseline(),suspended:null})]]);
const copy=value=>JSON.parse(JSON.stringify(value));
async function withGame(storage,callback){
  const game=await createGameRuntime({initialStorage:storage});
  try{return await callback(game);}finally{await game.dispose();}
}
function craft(qa){
  for(const part of qa.world.armory.parts)qa.work(part,part.hold);
  assert.equal(qa.state.weaponParts,3);
  qa.work(qa.world.armory.bench,qa.world.armory.bench.hold);
  assert.equal(qa.state.weaponOwned,true);assert.equal(qa.state.ammo,3);assert.equal(qa.state.weaponParts,0);
}
function approach(qa,item){
  for(const radius of [1.3,1.8,2.4,.65])for(let n=0;n<24;n++){
    const angle=n/24*Math.PI*2,x=item.position.x+Math.sin(angle)*radius,z=item.position.z+Math.cos(angle)*radius;
    if(!qa.world.isWalkable(x,z,.27)||!qa.world.lineOfSight({x,z},item.position))continue;
    qa.teleport(x,z);qa.look(Math.atan2(x-item.position.x,z-item.position.z));return;
  }
  assert.fail('The supply must have a usable interaction approach.');
}
function assertBaselineState(qa,expected=baseline()){
  assert.equal(qa.state.mode,'playing');assert.equal(qa.state.levelIndex,expected.levelIndex);
  assert.equal(qa.state.score,expected.score);assert.equal(qa.state.totalElapsed,expected.totalElapsed);
  assert.equal(qa.state.elapsed,0);assert.equal(qa.state.weaponOwned,expected.weaponOwned);assert.equal(qa.state.ammo,expected.ammo);
  assert.deepEqual(qa.state.runRules,{difficulty:expected.difficulty,challenge:expected.challenge});
}

test('stage transitions save the full campaign loadout, score, elapsed time and original rules across a reload',async()=>{
  const result=await withGame(initialStorage(),async game=>{
    const {qa}=game;await qa.start(0);craft(qa);qa.fire();assert.equal(qa.state.ammo,2);
    for(let index=0;index<3;index++){
      game.frames(4);qa.complete(qa.world.fuses[0]);qa.finish();
      const saved=JSON.parse(game.storage.get(EXPEDITION_KEY));
      assert.equal(saved.checkpoint.levelIndex,index+1);assert.equal(saved.suspended,null);
      assert.equal(saved.checkpoint.score,qa.state.score);assert.equal(saved.checkpoint.totalElapsed,qa.state.totalElapsed);
      assert.equal(saved.checkpoint.weaponOwned,true);assert.equal(saved.checkpoint.ammo,2);
      assert.equal(saved.checkpoint.difficulty,'hard');assert.equal(saved.checkpoint.challenge,'scarcity');
      if(index<2){await game.element('stage-continue').dispatch('click');assertBaselineState(qa,saved.checkpoint);}
    }
    const expected=JSON.parse(game.storage.get(EXPEDITION_KEY)).checkpoint;
    // Menu settings may change independently; a continued expedition keeps its rules.
    game.storage.set('sahur-settings',JSON.stringify({...settings,difficulty:'easy',challenge:'standard'}));
    return {storage:new Map(game.storage),expected};
  });
  await withGame(result.storage,async game=>{
    assert.equal(game.element('continue-button').hidden,false);
    await game.element('continue-button').dispatch('click');
    assertBaselineState(game.qa,result.expected);assert.deepEqual(game.qa.checkpoint,result.expected);
    assert.equal(game.qa.settings.difficulty,'easy');assert.equal(game.qa.settings.challenge,'standard');
  });
});

test('save and return resumes objectives, supplies, crafted cases, resources, camera, survey and live threats',async()=>{
  const result=await withGame(initialStorage(),async game=>{
    const {qa}=game;await qa.start(0);craft(qa);qa.complete(qa.world.fuses[0]);
    const supply=qa.world.supplies[0];approach(qa,supply);qa.interact();assert.equal(supply.mesh.visible,false);
    game.frames(1);qa.battery(17.5);qa.beam();qa.fire();qa.decoy();qa.look(.73,-.2);
    const cell=qa.world.cellAt(qa.state.player[0],qa.state.player[2]);qa.waypoint(cell.x,cell.z);
    const lure=qa.capture().decoy;assert.ok(lure);
    const actor=qa.actors[0];actor.stunnedUntil=qa.state.elapsed+5;
    const nearby=[];
    for(let z=1;z<qa.world.height-1;z++)for(let x=1;x<qa.world.width-1;x++){
      const point=qa.world.cellCenter(x,z),distance=Math.hypot(point.x-lure.position.x,point.z-lure.position.z);
      if(distance>3&&distance<20&&qa.world.isWalkable(point.x,point.z,.3))nearby.push(point);
    }
    assert.ok(nearby.length);actor.model.group.position.copy(nearby[0]);actor.model.group.position.y=0;
    actor.pursuit=updatePursuit(createPursuit(),{type:actor.model.type,time:qa.state.elapsed,position:actor.model.group.position,
      player:{x:qa.state.player[0],z:qa.state.player[2]},decoy:lure,senses:{detect:false}});
    assert.equal(actor.pursuit.phase,'investigate');
    qa.pause();const expected=copy(qa.capture()),retryBaseline=qa.checkpoint;
    assert.equal(qa.save(),true);assert.equal(qa.state.mode,'menu');assert.match(game.element('continue-button').textContent,/RESUME/);
    return {storage:new Map(game.storage),expected,retryBaseline};
  });
  await withGame(result.storage,async game=>{
    const {qa}=game;await qa.continue();const actual=qa.capture(),expected=result.expected;
    assert.equal(qa.state.mode,'playing');assert.equal(qa.state.fuseCount,1);assert.equal(qa.world.fuses[0].mesh.visible,false);
    assert.deepEqual(qa.checkpoint,result.retryBaseline);
    for(const key of ['elapsed','score','totalElapsed','player','stamina','battery','decoys','weaponOwned','ammo','weaponParts','usedCases','usedSupplies','collected','beamMode','flashlightOn','torchHeat','stunReady','weaponNoiseUntil','pingReady','decoy'])assert.deepEqual(actual[key],expected[key],key);
    assert.ok(Math.abs(actual.yaw-expected.yaw)<1e-12);assert.equal(actual.pitch,expected.pitch);
    assert.equal(actual.weaponParts.length,0);assert.equal(actual.usedCases.length,3);
    assert.ok(qa.world.armory.parts.every(item=>!item.mesh.visible),'Crafting must not respawn looted research cases.');
    assert.equal(qa.world.supplies[0].mesh.visible,false);
    assert.deepEqual(actual.survey,expected.survey);
    for(let index=0;index<actual.actors.length;index++){
      assert.equal(actual.actors[index].type,expected.actors[index].type);
      assert.deepEqual(actual.actors[index].position,expected.actors[index].position);
      assert.equal(actual.actors[index].stunnedUntil,expected.actors[index].stunnedUntil);
      assert.deepEqual(actual.actors[index].pursuit,{...expected.actors[index].pursuit,event:null});
    }
  });
});

test('death and retry restore the stage baseline score, loadout, rules and total time',async()=>{
  await withGame(baselineStorage(),async game=>{
    const {qa}=game;await qa.continue();assertBaselineState(qa);game.frames(10);
    qa.complete(qa.world.fuses[0]);qa.fire();qa.battery(9);qa.decoy();
    assert.ok(qa.state.totalElapsed>baseline().totalElapsed);assert.ok(qa.state.score>baseline().score);assert.equal(qa.state.ammo,1);
    qa.scare(true);assert.equal(qa.state.mode,'dead');
    const saved=JSON.parse(game.storage.get(EXPEDITION_KEY));assert.deepEqual(saved.checkpoint,baseline());assert.equal(saved.suspended,null);
    await game.element('retry-button').dispatch('click');assertBaselineState(qa);
    assert.equal(qa.state.fuseCount,0);assert.equal(qa.state.battery,65);assert.equal(qa.state.decoys,1);
    assert.ok(qa.world.fuses.every(item=>item.mesh.visible));assert.equal(qa.state.weaponParts,0);
  });
});

test('an impossible saved world position safely restarts its stage baseline without leaking suspended resources',async()=>{
  const storage=await withGame(baselineStorage(),async game=>{
    const {qa}=game;await qa.continue();game.frames(2);qa.complete(qa.world.fuses[0]);qa.fire();qa.battery(7);qa.decoy();qa.pause();assert.equal(qa.save(),true);
    const saved=JSON.parse(game.storage.get(EXPEDITION_KEY));saved.suspended.player={x:0,y:1.65,z:0};
    game.storage.set(EXPEDITION_KEY,JSON.stringify(saved));return new Map(game.storage);
  });
  await withGame(storage,async game=>{
    const {qa}=game;await qa.continue();assertBaselineState(qa);
    assert.equal(qa.state.fuseCount,0);assert.equal(qa.state.battery,65);assert.equal(qa.state.stamina,100);assert.equal(qa.state.decoys,1);
    assert.deepEqual(qa.state.player,qa.world.spawn.toArray());assert.equal(qa.capture().decoy,null);
    assert.ok(qa.world.fuses.every(item=>item.mesh.visible));assert.equal(qa.survey.waypoint,null);
    assert.equal(JSON.parse(game.storage.get(EXPEDITION_KEY)).suspended,null);
    assert.match(game.element('toast').textContent,/Saved position unavailable/);
  });
});

test('storage quota failure keeps the run paused and preserves the previous usable save',async()=>{
  await withGame(baselineStorage(),async game=>{
    const {qa}=game;await qa.continue();game.frames(2);qa.complete(qa.world.fuses[0]);qa.pause();
    const previous=game.storage.get(EXPEDITION_KEY),resources=copy(qa.capture());
    const original=globalThis.localStorage.setItem;
    globalThis.localStorage.setItem=()=>{throw new Error('QuotaExceededError');};
    try{assert.equal(qa.save(),false);}finally{globalThis.localStorage.setItem=original;}
    assert.equal(qa.state.mode,'paused');assert.equal(game.element('pause-screen').hidden,false);
    assert.match(game.element('pause-save-status').textContent,/Save unavailable/);
    assert.equal(game.storage.get(EXPEDITION_KEY),previous);assert.deepEqual(qa.capture(),resources);
    qa.resume();assert.equal(qa.state.mode,'playing');
  });
});

test('a browser that blocks the storage getter still allows play and keeps an unsuccessful save paused',async()=>{
  await withGame(initialStorage(),async game=>{
    const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
    Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw new Error('SecurityError');}});
    try{
      await game.qa.start(0);
      assert.equal(game.qa.state.mode,'playing');
      game.qa.pause();assert.equal(game.qa.save(),false);
      assert.equal(game.qa.state.mode,'paused');
      assert.match(game.element('pause-save-status').textContent,/Save unavailable/);
      game.qa.resume();game.frames(1);assert.equal(game.qa.state.mode,'playing');
    }finally{Object.defineProperty(globalThis,'localStorage',descriptor);}
  });
});

test('a damaged saved charge cannot crash the resumed expedition',async()=>{
  const storage=await withGame(initialStorage(),async game=>{
    await game.qa.start(0);game.qa.advance(20);game.frames(1);game.qa.pause();assert.equal(game.qa.save(),true);
    const saved=JSON.parse(game.storage.get(EXPEDITION_KEY));
    saved.suspended.actors.find(a=>a.type==='bribri').charge={phase:'charge',phaseStartedAt:20,phaseUntil:22,direction:null,target:null};
    game.storage.set(EXPEDITION_KEY,JSON.stringify(saved));return new Map(game.storage);
  });
  await withGame(storage,async game=>{
    await game.qa.continue();game.frames(5);
    assert.equal(game.qa.state.mode,'playing');
    assert.equal(game.qa.actors.find(a=>a.model.type==='bribri').charge.phase,'idle');
  });
});
