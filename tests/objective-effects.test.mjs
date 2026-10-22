import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {createWorld} from '../dist/world.js';
import {knownSurveyPath,visibleSurveyRay} from '../dist/survey-map.js';

// Canvas-generated materials are real Three objects; geometry, navigation and
// lifecycle checks run without a GPU or a network dependency.
const gradient={addColorStop(){}};
const context=new Proxy({}, {get(object,key){return object[key]??(key==='createRadialGradient'||key==='createLinearGradient'?()=>gradient:()=>{});},set(object,key,value){object[key]=value;return true;}});
globalThis.document={createElement(){return {width:0,height:0,getContext(){return context;}};}};
function fixture(index){const scene=new THREE.Scene(),world=createWorld(THREE,scene,index);return {world,scene};}
function assertClearEdges(world){
  for(let z=0;z<world.height;z++)for(let x=0;x<world.width;x++)if(world.grid[z][x]===0){
    const p=world.cellCenter(x,z);assert(world.isWalkable(p.x,p.z,.33),`Blocked floor centre ${x},${z}`);
    for(const [dx,dz]of [[1,0],[0,1]])if(world.grid[z+dz]?.[x+dx]===0)for(let n=0;n<=16;n++){
      assert(world.isWalkable(p.x+dx*world.cellSize*n/16,p.z+dz*world.cellSize*n/16,.33),`Blocked navigation edge ${x},${z} -> ${x+dx},${z+dz}`);
    }
  }
}

for(const index of [1,2])test(`${index===1?'Pool relays':'Pressure valves'} open a real optional shortcut for collision, AI and survey`,()=>{
  const {world,scene}=fixture(index),link=world.objectiveState.shortcut;
  assert(link,'The level must have an optional service link.');
  const before=world.grid.map(row=>[...row]);
  const start={x:link.x-link.dx,z:link.z-link.dz},goal={x:link.x+link.dx,z:link.z+link.dz};
  const a=world.cellCenter(start.x,start.z),b=world.cellCenter(goal.x,goal.z),center=world.cellCenter(link.x,link.z);
  const explored=new Set();world.grid.forEach((row,z)=>row.forEach((_,x)=>explored.add(`${x},${z}`)));
  const oldPath=world.findPath(a,b),oldSurvey=knownSurveyPath(world,explored,start,goal);
  assert(oldPath.length>3,'The preexisting path must remain usable around the lock.');
  assert(oldSurvey.length>3);assert(!world.isWalkable(center.x,center.z,.33));assert(!world.lineOfSight(a,b));
  assert(!visibleSurveyRay(world,a,goal).some(cell=>cell.x===goal.x&&cell.z===goal.z));
  world.setPower(1);assert.equal(world.grid[link.z][link.x],1);
  world.setPower(link.threshold);assert.equal(link.open,true);assert.equal(world.grid[link.z][link.x],0);
  assert.equal(scene.getObjectByName('OBJECTIVE_SERVICE_BULKHEAD').visible,false);
  assert(world.isWalkable(center.x,center.z,.33));assert(world.lineOfSight(a,b));
  assert(world.findPath(a,b).length<oldPath.length);
  assert.deepEqual(knownSurveyPath(world,explored,start,goal),[start,{x:link.x,z:link.z},goal]);
  assert(visibleSurveyRay(world,a,goal).some(cell=>cell.x===goal.x&&cell.z===goal.z));
  assertClearEdges(world);
  // Repeating a checkpoint count changes neither geometry nor route length.
  const openGrid=world.grid.map(row=>[...row]);world.setPower(link.threshold);assert.deepEqual(world.grid,openGrid);
  world.setPower(world.targetCount);world.update(10,.1);assertClearEdges(world);
  world.setPower(0);assert.deepEqual(world.grid,before);assert.equal(link.open,false);
  assert.equal(scene.getObjectByName('OBJECTIVE_SERVICE_BULKHEAD').visible,true);
  assert.equal(world.findPath(a,b).length,oldPath.length);assertClearEdges(world);
  world.dispose();assert.equal(scene.children.length,0);
});

test('Poolrooms drainage moves the existing water and fully restores it for a retry',()=>{
  const {world,scene}=fixture(1),water=scene.getObjectByName('POOL_CIRCULATION_SURFACE');
  assert(water);assert.equal(water.position.y,.26);
  world.setPower(1);const first=world.objectiveState.waterLevel;world.update(1,1);
  assert(water.position.y<.26&&water.position.y>first);
  world.setPower(world.targetCount);assert(world.objectiveState.waterLevel<0);world.update(10,5);
  assert(water.position.y<0,'Drained water must reveal the tile floor.');
  world.setPower(0);assert.equal(water.position.y,.26);world.dispose();
});

test('Pipeworks steam diminishes with each valve and stops when pressure is released',()=>{
  const {world,scene}=fixture(2),vents=[];scene.traverse(object=>{if(object.name.startsWith('PRESSURE_VENT_'))vents.push(object);});
  assert.equal(vents.length,4);world.update(1,.1);
  const vapor=vents[0].children.find(object=>object.geometry?.type==='SphereGeometry');assert.equal(vapor.material.opacity,.2);
  world.setPower(1);world.update(2,.1);assert.equal(world.objectiveState.steamPressure,.75);assert(vapor.material.opacity<.2);
  world.setPower(world.targetCount);world.update(3,.1);assert.equal(vapor.material.opacity,0);assert(vents.every(vent=>!vent.visible));
  world.setPower(0);world.update(4,.1);assert(vents.every(vent=>vent.visible));assert.equal(vapor.material.opacity,.2);world.dispose();
});

test('Lobby circuits restore real local lights and respect temporary blackouts',()=>{
  const {world,scene}=fixture(0),fixtureLight=scene.getObjectByName('RESTORABLE_CIRCUIT_1').children.find(object=>object.isPointLight);
  world.update(0,.01);const darkIntensity=world.lights[4].light.intensity;assert.equal(fixtureLight.intensity,0);
  world.setPower(1);world.update(0,.01);assert.equal(world.objectiveState.restoredCircuits,1);assert.equal(fixtureLight.intensity,.8);assert(world.lights[4].light.intensity>darkIntensity);
  world.setBlackout(1);world.update(0,.1);assert.equal(fixtureLight.intensity,.015);
  world.update(2,2);assert.equal(fixtureLight.intensity,.8);
  world.setPower(0);world.update(3,.1);assert.equal(fixtureLight.intensity,0);assert.equal(world.objectiveState.restoredCircuits,0);world.dispose();
});

test('Archive tapes restore the same coherent clue sequence at all signal receivers',()=>{
  const {world,scene}=fixture(3);const receivers=[];scene.traverse(object=>{if(object.name.startsWith('ARCHIVE_SIGNAL_'))receivers.push(object);});
  assert.equal(receivers.length,12);assert.equal(receivers.filter(object=>object.visible).length,3);
  for(let count=1;count<=3;count++){
    world.setPower(count);assert.equal(world.objectiveState.signalClues.length,count);
    assert(receivers.filter(object=>object.visible).every(object=>object.name===`ARCHIVE_SIGNAL_${count}`));
    const previous=world.objectiveState.signalClues.slice();world.setPower(count);assert.deepEqual(world.objectiveState.signalClues,previous);
  }
  assert.match(world.objectiveState.signalClues[2],/SOUTH SERVICE HALL/);
  world.setPower(0);assert.deepEqual(world.objectiveState.signalClues,[]);assert(receivers.filter(object=>object.visible).every(object=>object.name==='ARCHIVE_SIGNAL_0'));world.dispose();
});

test('power inputs are bounded and all environment resources use world disposal',()=>{
  for(let index=0;index<4;index++){
    const {world,scene}=fixture(index),persistent=new THREE.Group();scene.add(persistent);
    world.setPower(Infinity);assert.equal(world.objectiveState.count,0);
    world.setPower(-2);assert.equal(world.objectiveState.count,0);
    world.setPower(1.8);assert.equal(world.objectiveState.count,1);
    world.setPower(100);assert.equal(world.objectiveState.count,world.targetCount);
    const resources=new Set();scene.traverse(object=>{
      if(object.geometry)resources.add(object.geometry);
      for(const material of object.material?[object.material].flat():[]){resources.add(material);for(const value of Object.values(material))if(value?.isTexture)resources.add(value);}
    });
    const disposed=new Map();resources.forEach(resource=>resource.addEventListener('dispose',()=>disposed.set(resource,(disposed.get(resource)||0)+1)));
    world.dispose();assert.deepEqual(scene.children,[persistent]);
    for(const resource of resources)assert.equal(disposed.get(resource),1,`Resource ${resource.type} leaked or disposed repeatedly in stage ${index}`);
  }
});
