import test from 'node:test';
import assert from 'node:assert/strict';
import {createGameRuntime} from './helpers/game-runtime.mjs';

test('enemies leave their natural spawn and continue patrolling after the grace period',async t=>{
 const g=await createGameRuntime();t.after(()=>g.dispose());const {qa}=g;

 for(let level=0;level<4;level++){
  qa.menu();await qa.start(level);qa.setSetting('scares',false);qa.torch();assert.equal(qa.state.training.active,false);qa.advance(20);
  const positions=qa.actors.map(a=>a.model.group.position.clone());g.frames(160);
  for(let i=0;i<qa.actors.length;i++){
   const a=qa.actors[i];
   assert(a.model.group.position.distanceTo(positions[i])>1,`${a.model.type} must leave its spawn`);
  }
 }
});

test('a patrol finishes its current waypoint before replanning across a corner',async t=>{
 const g=await createGameRuntime();t.after(()=>g.dispose());const {qa}=g;
 await qa.start(2);qa.setSetting('scares',false);qa.torch();qa.advance(20);
 const w=qa.world,a=qa.actors.find(a=>a.model.type==='bombardino');qa.actors.filter(x=>x!==a).forEach(x=>x.stunnedUntil=Infinity);
 let lane;
 for(let z=1;z<w.height-1&&!lane;z++)for(let x=1;x<w.width-1&&!lane;x++){
  if(w.grid[z][x]!==0)continue;
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]])for(const [sx,sz] of [[-dz,dx],[dz,-dx]]){
   if(w.grid[z+dz]?.[x+dx]!==0||w.grid[z+dz+sz]?.[x+dx+sx]!==0||w.grid[z+sz]?.[x+sx]!==1)continue;
   const origin=w.cellCenter(x,z),next=w.cellCenter(x+dx,z+dz),goal=w.cellCenter(x+dx+sx,z+dz+sz);
   const position=origin.clone();position.x+=dx*2.5;position.z+=dz*2.5;
   if(position.distanceTo(w.spawn)>35&&w.isWalkable(position.x,position.z,.33))lane={position,next,goal};
  }
 }
 assert(lane,'A real corner outside detection range exists');a.model.group.position.copy(lane.position);a.path=[lane.next.clone(),lane.goal.clone()];a.goal=lane.goal.clone();a.pathTimer=0;
 g.frames(1);assert(a.path[0].distanceTo(lane.next)<.001,'The pending waypoint cannot be skipped by a timer');
 g.frames(15);assert(a.model.group.position.distanceTo(lane.position)>.5,'Enemy continues physically moving through the bend');
});
