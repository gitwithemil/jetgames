import test from 'node:test';
import assert from 'node:assert/strict';
import {EXPEDITION_KEY, normalizeExpedition, readExpedition, writeExpedition, clearExpedition} from '../dist/expedition-save.js';

const baseline = () => ({levelIndex:2,score:2400,totalElapsed:125,weaponOwned:true,ammo:2,difficulty:'hard',challenge:'scarcity'});
const suspension = () => ({
  elapsed:58,score:2675,totalElapsed:183,player:{x:23,y:1.65,z:42},yaw:.75,pitch:-.2,
  stamina:35,battery:17.5,decoys:0,weaponOwned:true,ammo:1,collected:[1,3],usedSupplies:[0,2],weaponParts:['part1'],usedCases:['part0','part1','part2'],
  flashlightOn:false,beamMode:'flood',torchHeat:28,boostLocked:true,stunReady:60,weaponNoiseUntil:59,pingReady:64,
  survey:{explored:['1,2','2,2'],visited:['1,2'],trail:[{x:23,z:40},{x:23,z:42}],waypoint:{x:4,z:5}},
  actors:[{type:'hound',position:{x:30,y:0,z:40},yaw:1,alert:62,lastKnown:{x:23,y:1.65,z:42},goal:null,path:[{x:24,y:0,z:42}],pathTimer:.2,stunnedUntil:64}],
  decoy:{position:{x:20,y:.15,z:39},until:64,id:'2-decoy-1'},lastDetection:{type:'hound',cause:'sound'},
  visitedRooms:['2-0'],scareRooms:['hall-2'],lastRoomId:'2-0',researchDiscovered:true,
  onboarding:{active:true,step:2,complete:false},tension:{quietUntil:69,lastChaseAt:55,nextAmbientScare:80,scareCooldown:75,pendingScare:0,scareRooms:['hall-2'],enemyGraceUntil:60}
});
const memoryStorage = () => {
  const entries = new Map();
  return {getItem:key=>entries.get(key)??null,setItem:(key,value)=>entries.set(key,value),removeItem:key=>entries.delete(key)};
};

test('stage checkpoint round trip preserves the expedition loadout, score, time and rules',()=>{
  const storage=memoryStorage();
  assert.equal(writeExpedition(storage,{checkpoint:baseline(),suspended:null}),true);
  assert.deepEqual(readExpedition(storage),{version:1,checkpoint:baseline(),suspended:null});
});

test('suspension round trip keeps depleted resources, objectives, survey and enemy state with an independent retry baseline',()=>{
  const storage=memoryStorage(),input={version:1,checkpoint:baseline(),suspended:suspension()};
  assert.equal(writeExpedition(storage,input),true);
  const result=readExpedition(storage),saved=result.suspended;
  for(const key of ['elapsed','score','totalElapsed','player','stamina','battery','decoys','collected','usedSupplies','weaponParts','usedCases','ammo','survey','visitedRooms','scareRooms','lastRoomId','onboarding','researchDiscovered','tension','decoy','lastDetection'])assert.deepEqual(saved[key],input.suspended[key],key);
  assert.equal(saved.actors[0].stunnedUntil,64);
  assert.deepEqual(saved.actors[0].lastKnown,input.suspended.actors[0].lastKnown);
  assert.deepEqual(result.checkpoint,baseline());
  assert.equal(result.checkpoint.ammo,2);
  assert.equal(saved.ammo,1);
  input.checkpoint.score=999;input.suspended.player.x=999;
  assert.equal(result.checkpoint.score,2400);assert.equal(saved.player.x,23);
});

test('unknown versions, malformed JSON and invalid stage or rule identifiers cannot be resumed',()=>{
  const storage=memoryStorage();
  for(const raw of ['{','null','[]',JSON.stringify({version:7,checkpoint:baseline()}),JSON.stringify({version:1,checkpoint:{...baseline(),levelIndex:4}}),JSON.stringify({version:1,checkpoint:{...baseline(),difficulty:'nightmare'}}),JSON.stringify({version:1,checkpoint:{...baseline(),score:'2400'}})]){
    storage.setItem(EXPEDITION_KEY,raw);assert.equal(readExpedition(storage),null,raw);
  }
  assert.equal(normalizeExpedition({version:1,checkpoint:{...baseline(),score:NaN}}),null);
});

test('a corrupted suspension retains a valid checkpoint so retry can safely restart the stage',()=>{
  const storage=memoryStorage();storage.setItem(EXPEDITION_KEY,JSON.stringify({version:1,checkpoint:baseline(),suspended:{...suspension(),player:{x:'23',y:1,z:42}}}));
  assert.deepEqual(readExpedition(storage),{version:1,checkpoint:baseline(),suspended:null});
});

test('out of range resources clamp to real game limits and an unowned weapon never acquires charges',()=>{
  const result=normalizeExpedition({version:1,checkpoint:{...baseline(),score:-20,ammo:99,totalElapsed:-3},suspended:{...suspension(),stamina:500,battery:-10,decoys:100,ammo:99,weaponOwned:false,pitch:7}});
  assert.equal(result.checkpoint.score,0);assert.equal(result.checkpoint.ammo,3);assert.equal(result.checkpoint.totalElapsed,0);
  assert.equal(result.suspended.stamina,100);assert.equal(result.suspended.battery,0);assert.equal(result.suspended.decoys,5);assert.equal(result.suspended.ammo,0);assert.equal(result.suspended.pitch,Math.PI/2);
});

test('angle normalization preserves camera facing after many turns',()=>{
  const result=normalizeExpedition({version:1,checkpoint:baseline(),suspended:{...suspension(),yaw:Math.PI*60+.4}});
  assert(Math.abs(result.suspended.yaw-.4)<1e-12);
});

test('pursuit and committed Brri charge preserve their absolute timing, targets and stun state',()=>{
  const state=suspension();state.actors[0].type='bribri';
  state.actors[0].pursuit={phase:'search',target:{x:23,z:42},lastKnown:{x:23,z:40},cause:'sound',alertUntil:62,phaseStartedAt:55,searchUntil:67,searchIndex:2,event:'search-started',decoyId:'23,42,54.25',consumedDecoyId:'20,38,50'};
  state.actors[0].charge={phase:'charge',phaseStartedAt:57,phaseUntil:60,target:{x:23,z:42},direction:{x:.6,z:.8},event:'charge-started',speedMultiplier:2.25,canAttack:true};
  const storage=memoryStorage();assert.equal(writeExpedition(storage,{checkpoint:baseline(),suspended:state}),true);
  const saved=readExpedition(storage).suspended.actors[0];
  assert.deepEqual(saved.pursuit,{...state.actors[0].pursuit,event:null});assert.deepEqual(saved.charge,{...state.actors[0].charge,event:null});assert.equal(saved.stunnedUntil,64);
  const malformed={...state.actors[0],charge:{...state.actors[0].charge,direction:{x:300,z:400},speedMultiplier:200}};
  const safe=normalizeExpedition({version:1,checkpoint:baseline(),suspended:{...state,actors:[malformed]}}).suspended.actors[0];
  assert.equal(safe.charge.speedMultiplier,2.25);assert.deepEqual(safe.charge.direction,{x:.6,z:.8});
});

test('crafted cases remain looted separately from spent components, and an active decoy keeps its identity and deadline',()=>{
  const state=suspension();state.weaponParts=[];
  const storage=memoryStorage();assert.equal(writeExpedition(storage,{checkpoint:baseline(),suspended:state}),true);
  const saved=readExpedition(storage).suspended;
  assert.deepEqual(saved.usedCases,['part0','part1','part2']);assert.deepEqual(saved.weaponParts,[]);
  assert.deepEqual(saved.decoy,state.decoy);assert.equal(saved.decoy.until-saved.elapsed,6);
  const invalid=normalizeExpedition({version:1,checkpoint:baseline(),suspended:{...state,usedCases:['part1','part1','constructor'],decoy:{...state.decoy,id:'<invalid>'},lastDetection:{type:'hound',cause:'wallhack'},onboarding:{active:true,step:99},tension:{enemyGraceUntil:Infinity}}}).suspended;
  assert.deepEqual(invalid.usedCases,['part1']);assert.equal(invalid.decoy,null);assert.equal(invalid.lastDetection,null);assert.equal(invalid.onboarding.step,3);assert.equal(invalid.tension.enemyGraceUntil,0);
});

test('malicious keys, invalid ids and large lists do not become game objects or unbounded collections',()=>{
  const input=JSON.parse(JSON.stringify({version:1,checkpoint:baseline(),suspended:suspension()}));
  input.suspended.__proto__={polluted:true};
  input.suspended.collected=[1,1,-1,'2',{},null];input.suspended.usedSupplies=[0,0,999,-1];input.suspended.weaponParts=['part0','constructor','__proto__'];
  input.suspended.survey.explored=['2,2','2,2','-1,0','999,1','01,1','__proto__'];
  input.suspended.survey.trail=Array.from({length:1000},()=>({x:1,z:2,untrusted:'discard'}));
  input.suspended.actors.push({type:'hacker',position:{x:1,y:0,z:2}});
  input.checkpoint.extra='drop';input.suspended.constructor={prototype:{polluted:true}};
  const output=normalizeExpedition(input);
  assert.deepEqual(output.suspended.collected,[1]);assert.deepEqual(output.suspended.usedSupplies,[0]);assert.deepEqual(output.suspended.weaponParts,['part0']);assert.deepEqual(output.suspended.survey.explored,['2,2']);
  assert.equal(output.suspended.survey.trail.length,240);assert.deepEqual(output.suspended.survey.trail[0],{x:1,z:2});assert.equal(output.suspended.actors.length,1);
  assert.equal(output.checkpoint.extra,undefined);assert.equal(Object.hasOwn(output.suspended,'constructor'),false);assert.equal(output.suspended.polluted,undefined);assert.equal({}.polluted,undefined);
});

test('a failed or invalid write leaves the previous usable expedition intact',()=>{
  const storage=memoryStorage();writeExpedition(storage,{checkpoint:baseline()});const previous=storage.getItem(EXPEDITION_KEY);
  assert.equal(writeExpedition(storage,{checkpoint:baseline(),suspended:{...suspension(),ammo:Infinity}}),false);
  assert.equal(storage.getItem(EXPEDITION_KEY),previous);
  assert.equal(writeExpedition(storage,{checkpoint:{...baseline(),levelIndex:3.5}}),false);
  assert.equal(storage.getItem(EXPEDITION_KEY),previous);
});

test('storage quota and unavailable storage fail without throwing',()=>{
  const unavailable={getItem(){throw new Error('SecurityError');},setItem(){throw new Error('QuotaExceededError');},removeItem(){throw new Error('SecurityError');}};
  assert.equal(readExpedition(unavailable),null);assert.equal(writeExpedition(unavailable,{checkpoint:baseline()}),false);assert.equal(clearExpedition(unavailable),false);
  assert.equal(readExpedition(undefined),null);assert.equal(writeExpedition(undefined,{checkpoint:baseline()}),false);
});

test('oversized input is rejected before parsing and clearing removes only the expedition key',()=>{
  const storage=memoryStorage();storage.setItem(EXPEDITION_KEY,' '.repeat(200001));assert.equal(readExpedition(storage),null);
  storage.setItem('sahur-settings','keep');assert.equal(clearExpedition(storage),true);assert.equal(storage.getItem(EXPEDITION_KEY),null);assert.equal(storage.getItem('sahur-settings'),'keep');
});
