import test from 'node:test';
import assert from 'node:assert/strict';
import {createSurveyState,resetSurvey,revealSurvey,visibleSurveyRay,knownSurveyPath,selectSurveyWaypoint,surveyGuidance,surveyLayout,surveyPoint,surveyCellAt,surveyMarkers,surveyStats,renderSurveyMap,surveyRoutePoints} from '../dist/survey-map.js';

const fixture=(width=7,height=6,cellSize=5)=>({width,height,cellSize,grid:Array.from({length:height},(_,z)=>Array.from({length:width},(_,x)=>x===0||z===0||x===width-1||z===height-1?1:0)),rooms:[]});
const at=(world,x,z)=>({x:(x+.5)*world.cellSize,z:(z+.5)*world.cellSize});
const chart=(world,state)=>{for(let z=0;z<world.height;z++)for(let x=0;x<world.width;x++)state.explored.add(`${x},${z}`);};

test('a survey ray includes its first wall and stops before the room behind it',()=>{
  const world=fixture();world.grid[2][3]=1;
  assert.deepEqual(visibleSurveyRay(world,at(world,1,2),{x:5,z:2}),[{x:1,z:2},{x:2,z:2},{x:3,z:2}]);
});
test('a diagonal cannot reveal a floor through a sealed corner',()=>{
  const world=fixture();world.grid[1][2]=1;world.grid[2][1]=1;
  const cells=visibleSurveyRay(world,at(world,1,1),{x:3,z:3});
  assert(cells.some(c=>c.x===2&&c.z===1));assert(cells.some(c=>c.x===1&&c.z===2));
  assert(!cells.some(c=>c.x===2&&c.z===2));
});
test('fog discovery reveals first walls without discovering adjacent hidden rooms',()=>{
  const world=fixture(),state=createSurveyState();for(let z=0;z<world.height;z++)world.grid[z][3]=1;
  revealSurvey(world,state,at(world,2,2),3.5);
  assert(state.explored.has('3,2'));assert(!state.explored.has('4,2'));assert(state.visited.has('2,2'));
  assert.equal(state.trail.length,1);
});
test('known routes take a longer charted path rather than using an unseen shortcut',()=>{
  const world=fixture(),known=new Set(['1,2','1,1','2,1','3,1','3,2']);
  const path=knownSurveyPath(world,known,{x:1,z:2},{x:3,z:2});
  assert.equal(path.length,5);assert(!path.some(c=>c.x===2&&c.z===2));
  known.delete('2,1');assert.deepEqual(knownSurveyPath(world,known,{x:1,z:2},{x:3,z:2}),[]);
});
test('a shortest route is cardinal and never cuts through partitions',()=>{
  const world=fixture(),state=createSurveyState();chart(world,state);world.grid[2][2]=1;
  const route=knownSurveyPath(world,state.explored,{x:1,z:2},{x:3,z:2});assert.equal(route.length,5);
  assert(route.every((c,i)=>world.grid[c.z][c.x]===0&&(!i||Math.abs(c.x-route[i-1].x)+Math.abs(c.z-route[i-1].z)===1)));
});
test('route edges account for furniture collision rather than drawing through it',()=>{
  const world=fixture(),state=createSurveyState();chart(world,state);
  world.isWalkable=(x,z)=>!(Math.abs(x-10)<.1&&Math.abs(z-12.5)<.1);
  const path=knownSurveyPath(world,state.explored,{x:1,z:2},{x:2,z:2});assert.equal(path.length,4);
});
test('waypoint guidance follows a charted route relative to the camera and reports arrival',()=>{
  const world=fixture(),state=createSurveyState();state.explored=new Set(['1,1','2,1','3,1']);
  const waypoint={x:3,z:1},player=at(world,1,1);
  const north=surveyGuidance(world,state.explored,player,0,waypoint);
  assert.equal(north.distance,10);assert(Math.abs(north.angle-Math.PI/2)<1e-9);assert.equal(north.arrived,false);
  const facingRoute=surveyGuidance(world,state.explored,player,Math.PI/2,waypoint);
  assert(Math.abs(facingRoute.angle)<1e-9);
  assert.equal(surveyGuidance(world,state.explored,at(world,3,1),0,waypoint).arrived,true);
  state.explored.delete('2,1');
  assert.equal(surveyGuidance(world,state.explored,player,0,waypoint),null);
});
test('waypoints reject unknown, wall and unreachable cells and toggle when reselected',()=>{
  const world=fixture(),state=createSurveyState(),position=at(world,1,1);state.explored.add('1,1');
  assert.equal(selectSurveyWaypoint(world,state,position,{x:2,z:1}),'unknown');
  state.explored.add('0,1');assert.equal(selectSurveyWaypoint(world,state,position,{x:0,z:1}),'wall');
  state.explored.add('3,1');assert.equal(selectSurveyWaypoint(world,state,position,{x:3,z:1}),'unreachable');
  state.explored.add('2,1');assert.equal(selectSurveyWaypoint(world,state,position,{x:3,z:1}),'selected');
  assert.deepEqual(state.waypoint,{x:3,z:1});assert.equal(selectSurveyWaypoint(world,state,position,{x:3,z:1}),'cleared');assert.equal(state.waypoint,null);
});
test('furniture at a destination cannot become a waypoint',()=>{
  const world=fixture(),state=createSurveyState();chart(world,state);world.isWalkable=(x,z)=>x!==12.5||z!==7.5;
  assert.equal(selectSurveyWaypoint(world,state,at(world,1,1),{x:2,z:1}),'blocked');
});
test('world projection moves continuously and click conversion uses the real cell size',()=>{
  const world=fixture(8,5,6),layout=surveyLayout(world,900,700),first=surveyPoint(world,layout,{x:7,z:7}),next=surveyPoint(world,layout,{x:8,z:7});
  assert(Math.abs(next.x-first.x-layout.size/6)<1e-9);assert.equal(next.y,first.y);
  assert.deepEqual(surveyCellAt(world,layout,next.x,next.y),{x:1,z:1});assert.equal(surveyCellAt(world,layout,0,0),null);
  assert(layout.left>=0&&layout.top>=0);
});
test('stage reset clears discovery, trail, keyboard cursor and route while retaining the shared Set',()=>{
  const explored=new Set(['1,1']),state=createSurveyState(explored);state.visited.add('1,1');state.trail.push({x:1,z:1});state.waypoint={x:1,z:1};state.cursor={x:2,z:2};state.notice='old';
  resetSurvey(state);assert.equal(state.explored,explored);assert.equal(explored.size,0);assert.equal(state.visited.size,0);assert.equal(state.trail.length,0);assert.equal(state.waypoint,null);assert.equal(state.cursor,null);assert.equal(state.notice,'');
});
test('exploration percentage counts walkable cells instead of exterior walls',()=>{
  const world=fixture(5,5),state=createSurveyState();state.explored.add('0,0');state.explored.add('1,1');
  assert.deepEqual(surveyStats(world,state),{total:9,known:1,percent:11,visited:0});
});
test('only discovered objective, armory, supply and exit markers are included',()=>{
  const world=fixture(),state=createSurveyState();
  world.fuses=[{id:1,position:at(world,1,1)},{id:2,position:at(world,5,4)}];
  world.armory={parts:[{id:'part0',position:at(world,2,1),mesh:{visible:false}}],bench:{position:at(world,4,1)}};
  world.supplies=[{position:at(world,1,2),mesh:{visible:false}}];world.exit={position:at(world,5,1)};
  world.enemies=[{position:at(world,1,1)}];world.decoy={position:at(world,1,1)};
  for(const key of ['1,1','2,1','1,2'])state.explored.add(key);
  const markers=surveyMarkers(world,state,new Set([1]),new Set(['part0']));
  assert.deepEqual(markers.map(m=>m.type),['objective','part','supply']);assert(markers.every(m=>m.done));
  state.explored.add('4,1');state.explored.add('5,1');assert.deepEqual(surveyMarkers(world,state).map(m=>m.type),['objective','part','bench','supply','exit']);
});
test('canvas output retains continuous camera heading and a route confined to known geometry',()=>{
  const world=fixture(),state=createSurveyState();chart(world,state);state.waypoint={x:3,z:1};const rotations=[],translations=[];
  const ctx=new Proxy({measureText:t=>({width:t.length*7}),rotate:a=>rotations.push(a),translate:(x,y)=>translations.push({x,y})},{get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>(o[k]=v,true)});
  const canvas={width:900,height:900,getContext:()=>ctx},player={x:7,z:8},view=renderSurveyMap(canvas,world,state,{player,yaw:.73});
  assert.equal(rotations.at(-1),-.73);assert.deepEqual(translations.at(-1),surveyPoint(world,view.layout,player));
  assert.equal(view.path.length,3);assert(view.path.every(c=>state.explored.has(`${c.x},${c.z}`)));assert(view.distance>0);
});

test('the route from the real player position detours around furniture in its first cell',()=>{
  const world=fixture(),state=createSurveyState();chart(world,state);
  // Cabinet separates the player from the centre but leaves side passages.
  world.isWalkable=(x,z,radius=0)=>!(x>6.9-radius&&x<8.1+radius&&z>6.3-radius&&z<7+radius);
  const player={x:7.5,z:5.8},path=[{x:1,z:1},{x:2,z:1},{x:3,z:1}],route=surveyRoutePoints(world,state.explored,player,path);
  assert(route.connected);assert.deepEqual(route.points[0],player);assert(route.points.length>3);
  for(let i=1;i<route.points.length;i++)for(let t=0;t<=1;t+=.02){const a=route.points[i-1],b=route.points[i];assert(world.isWalkable(a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t,.27));}
});
test('a trapped start never draws a false connector through a prop',()=>{
  const world=fixture(),state=createSurveyState();chart(world,state);const player={x:5.4,z:5.4};
  world.isWalkable=(x,z)=>Math.hypot(x-player.x,z-player.z)<.1||(x>6.5&&z>6.5);
  const route=surveyRoutePoints(world,state.explored,player,[{x:1,z:1},{x:2,z:1}]);
  assert.equal(route.connected,false);assert.notDeepEqual(route.points[0],player);
});
