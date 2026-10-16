import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import { createWorld } from '../dist/world.js';
import { routePlan } from '../dist/rooms.js';

// Canvas textures do not need a GPU to verify the real collision world.
const gradient={addColorStop(){}};
const context=new Proxy({}, {get(t,key){return t[key]??(key==='createRadialGradient'||key==='createLinearGradient'?()=>gradient:()=>{});},set(t,key,value){t[key]=value;return true;}});
globalThis.document={createElement(){return {width:0,height:0,getContext(){return context;}};}};
const steps=[[1,0],[-1,0],[0,1],[0,-1]];
function reachable(grid,start,blocked=null){
  const queue=[start],seen=new Set([start.join(',')]);
  for(let i=0;i<queue.length;i++)for(const [dx,dz]of steps){
    const [x,z]=queue[i],nx=x+dx,nz=z+dz,key=`${nx},${nz}`;
    if(grid[nz]?.[nx]===0&&key!==blocked&&!seen.has(key)){seen.add(key);queue.push([nx,nz]);}
  }
  return seen;
}
for(let index=0;index<4;index++){
  const scene=new THREE.Scene(),world=createWorld(THREE,scene,index),name=world.level.name,grid=world.grid;
  const seen=reachable(grid,[11,20]);let openCount=0,edgeCount=0;
  for(let z=0;z<grid.length;z++)for(let x=0;x<grid[z].length;x++){
    if(grid[z][x])continue;openCount++;assert(seen.has(`${x},${z}`),`${name}: unreachable open cell ${x},${z}`);
    const from=world.cellCenter(x,z);
    // Every AI route is made of these exact centre-to-centre segments.
    for(const radius of [.27,.33]){
      assert(world.isWalkable(from.x,from.z,radius),`${name}: obstructed centre ${x},${z} radius ${radius}`);
      for(const [dx,dz]of [[1,0],[0,1]])if(grid[z+dz]?.[x+dx]===0){
        if(radius===.27)edgeCount++;
        for(let sample=1;sample<=16;sample++)assert(world.isWalkable(from.x+dx*4*sample/16,from.z+dz*4*sample/16,radius),`${name}: blocked AI edge ${x},${z} -> ${x+dx},${z+dz} radius ${radius}`);
      }
    }
  }
  for(const position of [world.spawn,world.enemySpawn,world.cellCenter(3,6),world.cellCenter(19,17),world.introCameraPosition,world.introEnemyPosition,world.exit.position]){
    const cell=world.cellAt(position.x,position.z);assert(seen.has(`${cell.x},${cell.z}`),`${name}: unreachable fixed spawn/exit`);
    assert(world.isWalkable(position.x,position.z,.33),`${name}: unsafe spawn/exit ${position.x},${position.z}`);
  }
  for(const item of [...world.fuses,...world.armory.parts,world.armory.bench,...world.supplies]){
    const cell=world.cellAt(item.position.x,item.position.z);assert(seen.has(`${cell.x},${cell.z}`),`${name}: unreachable item ${item.label||item.id}`);
    const stands=[];
    for(let n=0;n<16;n++){const angle=n*Math.PI/8,x=item.position.x+Math.cos(angle)*1.7,z=item.position.z+Math.sin(angle)*1.7;
      if(world.isWalkable(x,z,.27)&&world.lineOfSight({x,z},item.position))stands.push({x,z});
    }
    assert(stands.length>=2,`${name}: no clear interaction approach for ${item.label||item.id}`);
    const route=world.findPath(world.spawn,stands[0]);assert(route.length,`${name}: no interaction path for ${item.label||item.id}`);
  }
  for(const route of routePlan(index)){
    assert(route.cells.every(([x,z])=>grid[z][x]===0),`${name}: blocked bypass ${route.name}`);
    // Closing its interior still leaves an escape route around the other side.
    const middle=route.cells[Math.floor(route.cells.length/2)].join(','),end=route.cells.at(-1).join(',');
    assert(reachable(grid,route.cells[0],middle).has(end),`${name}: ${route.name} is a dead end, not a loop`);
  }
  assert.equal(world.rooms.length,8);
  for(const room of world.rooms){assert(room.code&&room.shortName);assert(grid[room.anchor.z][room.anchor.x]===0,`${name}: room anchor in wall`);}
  assert(world.wayfinding.markers.length>=8,`${name}: missing navigation signs`);
  for(const marker of world.wayfinding.markers)for(const target of marker.destinations){
    const [dx,dz]=target.step;assert(grid[marker.cell[1]+dz]?.[marker.cell[0]+dx]===0,`${name}: arrow points into a wall`);
  }
  console.log(`${name}: ${openCount} connected cells, ${edgeCount} clear AI edges, ${routePlan(index).length} bypass loops; all objectives, supplies, armory and spawns reachable.`);
  world.dispose();assert.equal(scene.children.length,0,`${name}: dispose leaked scene nodes`);
}
