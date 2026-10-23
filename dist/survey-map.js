// North-up field survey. Discovery and routes use only charted geometry;
// characters and sound decoys deliberately never enter the survey model.
export const surveyKey = (x, z) => `${x},${z}`;
const inside = (world, x, z) => x >= 0 && z >= 0 && x < world.width && z < world.height;
const floor = (world, x, z) => inside(world, x, z) && world.grid[z][x] === 0;
const directions = [[0,-1],[1,0],[0,1],[-1,0]];

export function createSurveyState(explored = new Set()) {
  return { explored, visited:new Set(), trail:[], waypoint:null, cursor:null, notice:'', sample:null };
}
export function resetSurvey(state) {
  state.explored.clear();state.visited.clear();state.trail.length=0;
  state.waypoint=null;state.cursor=null;state.notice='';state.sample=null;
}
// Grid traversal stops at the first wall, including that wall in the survey.
// Exact diagonal crossings check both side cells so a sealed corner cannot leak.
export function visibleSurveyRay(world, position, target) {
  const unit=world.cellSize, sx=position.x/unit, sz=position.z/unit;
  let x=Math.floor(sx),z=Math.floor(sz);
  const dx=target.x+.5-sx,dz=target.z+.5-sz,stepX=Math.sign(dx),stepZ=Math.sign(dz);
  const deltaX=dx?Math.abs(1/dx):Infinity,deltaZ=dz?Math.abs(1/dz):Infinity;
  let nextX=dx?((stepX>0?x+1:x)-sx)/dx:Infinity,nextZ=dz?((stepZ>0?z+1:z)-sz)/dz:Infinity;
  const result=[];
  for(let guard=0;guard<world.width+world.height+4;guard++){
    if(!inside(world,x,z))break;
    result.push({x,z});
    if(!floor(world,x,z)||(x===target.x&&z===target.z))break;
    if(Math.abs(nextX-nextZ)<1e-9){
      const sides=[{x:x+stepX,z},{x,z:z+stepZ}];
      const blocked=sides.filter(c=>!floor(world,c.x,c.z));
      if(blocked.length){for(const c of blocked)if(inside(world,c.x,c.z))result.push(c);break;}
      x+=stepX;z+=stepZ;nextX+=deltaX;nextZ+=deltaZ;
    }else if(nextX<nextZ){x+=stepX;nextX+=deltaX;}
    else{z+=stepZ;nextZ+=deltaZ;}
  }
  return result;
}
export function revealSurvey(world,state,position,radius=2.55) {
  const unit=world.cellSize,c={x:Math.floor(position.x/unit),z:Math.floor(position.z/unit)};
  if(!floor(world,c.x,c.z))return;
  state.visited.add(surveyKey(c.x,c.z));
  const last=state.trail.at(-1);
  if(!last||Math.hypot(position.x-last.x,position.z-last.z)>unit*.18){
    state.trail.push({x:position.x,z:position.z});if(state.trail.length>240)state.trail.shift();
  }
  const sample=`${Math.floor(position.x/unit*8)},${Math.floor(position.z/unit*8)}`;
  if(state.sample===sample)return;state.sample=sample;
  for(let z=c.z-Math.ceil(radius);z<=c.z+Math.ceil(radius);z++)for(let x=c.x-Math.ceil(radius);x<=c.x+Math.ceil(radius);x++){
    if(!inside(world,x,z)||Math.hypot(x+.5-position.x/unit,z+.5-position.z/unit)>radius)continue;
    for(const visible of visibleSurveyRay(world,position,{x,z}))state.explored.add(surveyKey(visible.x,visible.z));
  }
}
export function surveyStats(world,state) {
  let total=0,known=0;
  for(let z=0;z<world.height;z++)for(let x=0;x<world.width;x++)if(floor(world,x,z)){total++;if(state.explored.has(surveyKey(x,z)))known++;}
  return {total,known,percent:total?Math.round(known/total*100):0,visited:state.visited.size};
}
function clearStep(world,a,b) {
  if(!world.isWalkable)return true;
  const unit=world.cellSize,ax=(a.x+.5)*unit,az=(a.z+.5)*unit,bx=(b.x+.5)*unit,bz=(b.z+.5)*unit;
  const count=Math.max(2,Math.ceil(unit/.5));
  for(let i=0;i<=count;i++){const t=i/count;if(!world.isWalkable(ax+(bx-ax)*t,az+(bz-az)*t,.27))return false;}
  return true;
}
export function knownSurveyPath(world,explored,start,goal) {
  const known=(x,z)=>floor(world,x,z)&&explored.has(surveyKey(x,z));
  if(!known(start.x,start.z)||!known(goal.x,goal.z))return [];
  const key=surveyKey(start.x,start.z),target=surveyKey(goal.x,goal.z),queue=[{x:start.x,z:start.z}],previous=new Map([[key,null]]);
  for(let i=0;i<queue.length&&!previous.has(target);i++){
    const at=queue[i];
    for(const [dx,dz]of directions){const next={x:at.x+dx,z:at.z+dz},nextKey=surveyKey(next.x,next.z);
      if(known(next.x,next.z)&&!previous.has(nextKey)&&clearStep(world,at,next)){previous.set(nextKey,at);queue.push(next);}
    }
  }
  if(!previous.has(target))return [];
  const path=[];for(let at={x:goal.x,z:goal.z};at;at=previous.get(surveyKey(at.x,at.z)))path.push(at);
  return path.reverse();
}
export function selectSurveyWaypoint(world,state,position,cell) {
  if(!cell||!inside(world,cell.x,cell.z)||!state.explored.has(surveyKey(cell.x,cell.z)))return 'unknown';
  if(!floor(world,cell.x,cell.z))return 'wall';
  if(world.isWalkable&&!world.isWalkable((cell.x+.5)*world.cellSize,(cell.z+.5)*world.cellSize,.27))return 'blocked';
  if(state.waypoint?.x===cell.x&&state.waypoint?.z===cell.z){state.waypoint=null;return 'cleared';}
  const start={x:Math.floor(position.x/world.cellSize),z:Math.floor(position.z/world.cellSize)};
  if(!knownSurveyPath(world,state.explored,start,cell).length)return 'unreachable';
  state.waypoint={x:cell.x,z:cell.z};return 'selected';
}
function clearSurveySegment(world,explored,a,b){
  const distance=Math.hypot(b.x-a.x,b.z-a.z),count=Math.max(1,Math.ceil(distance/.12));
  for(let i=0;i<=count;i++){
    const t=i/count,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t,cx=Math.floor(x/world.cellSize),cz=Math.floor(z/world.cellSize);
    if(!floor(world,cx,cz)||!explored.has(surveyKey(cx,cz))||(world.isWalkable&&!world.isWalkable(x,z,.34)))return false;
  }
  return true;
}
// A player can stand beside a cabinet even when the corridor centre is clear.
// Validate the first line from their real position, then try a bounded detour
// inside that charted cell. If no connector exists, leave an explicit gap.
export function surveyRoutePoints(world,explored,player,path){
  if(!path.length)return {points:[],connected:false};
  const unit=world.cellSize,centres=path.map(c=>({x:(c.x+.5)*unit,z:(c.z+.5)*unit})),position={x:player.x,z:player.z};
  const next=centres[1]||centres[0];
  if(clearSurveySegment(world,explored,position,next))return {points:[position,...(centres.length>1?centres.slice(1):centres)],connected:true};
  if(clearSurveySegment(world,explored,position,centres[0]))return {points:[position,...centres],connected:true};
  const start=path[0],nodes=[position],lattice=new Map(),previous=new Map([[0,null]]),queue=[];
  for(let z=1;z<8;z++)for(let x=1;x<8;x++){
    const p={x:(start.x+x/8)*unit,z:(start.z+z/8)*unit};
    if(!world.isWalkable||world.isWalkable(p.x,p.z,.27)){const i=nodes.length;nodes.push(p);lattice.set(`${x},${z}`,i);if(clearSurveySegment(world,explored,position,p)){previous.set(i,0);queue.push({i,x,z});}}
  }
  const target=lattice.get('4,4');
  for(let at=0;at<queue.length&&!previous.has(target);at++){
    const current=queue[at];
    for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
      if(!dx&&!dz)continue;const x=current.x+dx,z=current.z+dz,i=lattice.get(`${x},${z}`);
      if(i!==undefined&&!previous.has(i)&&clearSurveySegment(world,explored,nodes[current.i],nodes[i])){previous.set(i,current.i);queue.push({i,x,z});}
    }
  }
  if(target!==undefined&&previous.has(target)){
    const connector=[];for(let i=target;i!==null;i=previous.get(i))connector.push(nodes[i]);
    return {points:[...connector.reverse(),...centres.slice(1)],connected:true};
  }
  return {points:centres,connected:false};
}
export function surveyGuidance(world,explored,player,yaw,waypoint){
  if(!waypoint)return null;
  const start={x:Math.floor(player.x/world.cellSize),z:Math.floor(player.z/world.cellSize)};
  const path=knownSurveyPath(world,explored,start,waypoint);
  if(!path.length)return null;
  const route=surveyRoutePoints(world,explored,player,path);
  if(!route.connected)return null;
  let distance=0;
  for(let i=1;i<route.points.length;i++)distance+=Math.hypot(route.points[i].x-route.points[i-1].x,route.points[i].z-route.points[i-1].z);
  const next=route.points.find((point,index)=>index>0&&Math.hypot(point.x-player.x,point.z-player.z)>.35)
    ||{x:(waypoint.x+.5)*world.cellSize,z:(waypoint.z+.5)*world.cellSize};
  const bearing=Math.atan2(next.x-player.x,player.z-next.z);
  return {angle:Math.atan2(Math.sin(bearing-yaw),Math.cos(bearing-yaw)),distance,arrived:distance<1.4};
}

export function surveyLayout(world,width,height) {
  const pad=Math.max(30,Math.min(width,height)*.055),size=Math.min((width-pad*2)/world.width,(height-pad*2)/world.height);
  return {size,left:(width-size*world.width)/2,top:(height-size*world.height)/2,width:world.width*size,height:world.height*size};
}
export function surveyPoint(world,layout,position) {
  return {x:layout.left+position.x/world.cellSize*layout.size,y:layout.top+position.z/world.cellSize*layout.size};
}
export function surveyCellAt(world,layout,x,y) {
  const cell={x:Math.floor((x-layout.left)/layout.size),z:Math.floor((y-layout.top)/layout.size)};
  return inside(world,cell.x,cell.z)?cell:null;
}
export function surveyMarkers(world,state,collected=new Set(),weaponParts=new Set()) {
  const markers=[];
  const add=(item,type,color,label,done=false)=>{
    if(!item?.position)return;
    const c={x:Math.floor(item.position.x/world.cellSize),z:Math.floor(item.position.z/world.cellSize)};
    if(!state.explored.has(surveyKey(c.x,c.z)))return;
    markers.push({position:item.position,cell:c,type,color,label,done});
  };
  for(const item of world.fuses||[])add(item,'objective','#8bdddf',String(item.id),collected.has(item.id));
  for(const item of world.armory?.parts||[])add(item,'part','#edbd77','',weaponParts.has(item.id)||item.mesh?.visible===false);
  add(world.armory?.bench,'bench','#edbd77','');
  for(const item of world.supplies||[])add(item,'supply','#9dd7b1','',item.mesh?.visible===false);
  add(world.exit,'exit','#dbea79','');
  return markers;
}
function intersects(a,b,gap=0){return a.x<b.x+b.w+gap&&a.x+a.w+gap>b.x&&a.y<b.y+b.h+gap&&a.y+a.h+gap>b.y;}
function drawRoomLabels(ctx,world,state,layout,markers,reserved) {
  const size=layout.size,font=Math.max(11,size*.38),placed=[...reserved];
  ctx.font=`600 ${font}px monospace`;ctx.textAlign='center';ctx.textBaseline='middle';
  for(const room of world.rooms||[]){
    if(!room.bounds)continue;
    const [x0,z0,x1,z1]=room.bounds,visited=[...state.visited].some(k=>{const [x,z]=k.split(',').map(Number);return x>=x0&&z>=z0&&x<=x1&&z<=z1;});
    if(!visited)continue;
    const words=(room.shortName||room.name).toUpperCase().split(' '),lines=words.length>1?[words.slice(0,-1).join(' '),words.at(-1)]:words;
    if(room.code)lines[0]=`${room.code}  ${lines[0]}`;
    const w=Math.max(...lines.map(line=>ctx.measureText(line).width))+12,h=font*lines.length*1.18+9;
    const anchor=room.anchor||{x:(x0+x1)/2,z:(z0+z1)/2},candidates=[];
    for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++)if(floor(world,x,z)&&state.explored.has(surveyKey(x,z)))candidates.push({x,z});
    candidates.sort((a,b)=>Math.hypot(a.x-anchor.x,a.z-anchor.z)-Math.hypot(b.x-anchor.x,b.z-anchor.z));
    for(const cell of candidates){
      const p={x:layout.left+(cell.x+.5)*size,y:layout.top+(cell.z+.5)*size},rect={x:p.x-w/2,y:p.y-h/2,w,h};
      let charted=true;
      for(let z=Math.floor((rect.y-layout.top)/size);z<=Math.floor((rect.y+h-layout.top)/size);z++)for(let x=Math.floor((rect.x-layout.left)/size);x<=Math.floor((rect.x+w-layout.left)/size);x++)if(!floor(world,x,z)||!state.explored.has(surveyKey(x,z)))charted=false;
      if(!charted||placed.some(r=>intersects(rect,r,5)))continue;
      ctx.fillStyle='#111d19ed';ctx.fillRect(rect.x,rect.y,rect.w,rect.h);ctx.strokeStyle='#c8d9b32b';ctx.lineWidth=1;ctx.strokeRect(rect.x+.5,rect.y+.5,rect.w-1,rect.h-1);
      ctx.fillStyle='#cad7bc';lines.forEach((line,i)=>ctx.fillText(line,p.x,p.y+(i-(lines.length-1)/2)*font*1.18));placed.push(rect);break;
    }
  }
}
export function renderSurveyMap(canvas,world,state,{player,yaw=0,collected,weaponParts,keyboard=false}={}) {
  const ctx=canvas.getContext('2d'),layout=surveyLayout(world,canvas.width,canvas.height),size=layout.size;
  const point=p=>surveyPoint(world,layout,p),center=c=>point({x:(c.x+.5)*world.cellSize,z:(c.z+.5)*world.cellSize});
  ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#101a16';ctx.fillRect(0,0,canvas.width,canvas.height);
  for(let z=0;z<world.height;z++)for(let x=0;x<world.width;x++){
    const known=state.explored.has(surveyKey(x,z)),isFloor=floor(world,x,z),px=layout.left+x*size,py=layout.top+z*size;
    ctx.fillStyle=known?(isFloor?(world.roomAt?.((x+.5)*world.cellSize,(z+.5)*world.cellSize)?.color||'#405745'):'#27392e'):'#17251f';
    ctx.fillRect(px+.65,py+.65,size-1.3,size-1.3);
    if(known&&isFloor){
      ctx.fillStyle=state.visited.has(surveyKey(x,z))?'#dfebaf1a':'#ffffff05';ctx.fillRect(px+.65,py+.65,size-1.3,size-1.3);
      ctx.strokeStyle='#aabb805e';ctx.lineWidth=Math.max(1,size*.045);
      for(const [dx,dz]of directions)if(!floor(world,x+dx,z+dz)){
        ctx.beginPath();if(dx){const edge=px+(dx>0?size:0);ctx.moveTo(edge,py);ctx.lineTo(edge,py+size);}else{const edge=py+(dz>0?size:0);ctx.moveTo(px,edge);ctx.lineTo(px+size,edge);}ctx.stroke();
      }
    }
  }
  // Subtle survey intervals orient the player without marking uncharted content.
  ctx.font=`${Math.max(10,size*.3)}px monospace`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#809682';
  for(let x=0;x<world.width;x+=5)ctx.fillText(String(x+1).padStart(2,'0'),layout.left+(x+.5)*size,layout.top-13);
  ctx.textAlign='right';for(let z=0;z<world.height;z+=5)ctx.fillText(String(z+1).padStart(2,'0'),layout.left-10,layout.top+(z+.5)*size);
  if(state.trail.length>1){ctx.strokeStyle='#dce6a64b';ctx.lineWidth=Math.max(1.5,size*.06);ctx.setLineDash([2,5]);ctx.beginPath();state.trail.forEach((p,i)=>{const at=point(p);if(i)ctx.lineTo(at.x,at.y);else ctx.moveTo(at.x,at.y);});ctx.stroke();ctx.setLineDash([]);}
  const start={x:Math.floor(player.x/world.cellSize),z:Math.floor(player.z/world.cellSize)},path=state.waypoint?knownSurveyPath(world,state.explored,start,state.waypoint):[];
  let distance=0;const route=surveyRoutePoints(world,state.explored,player,path);
  if(path.length){const points=route.points.map(point);
    ctx.strokeStyle='#f1c77a';ctx.lineWidth=Math.max(2.5,size*.08);ctx.lineJoin='round';ctx.lineCap='round';ctx.setLineDash([size*.2,size*.15]);ctx.beginPath();points.forEach((p,i)=>{if(i){ctx.lineTo(p.x,p.y);distance+=Math.hypot(p.x-points[i-1].x,p.y-points[i-1].y)/size*world.cellSize;}else ctx.moveTo(p.x,p.y);});ctx.stroke();ctx.setLineDash([]);
  }
  const markers=surveyMarkers(world,state,collected,weaponParts),r=Math.max(6,size*.2),reserved=markers.map(m=>{const p=point(m.position);return {x:p.x-r-4,y:p.y-r-4,w:r*2+8,h:r*2+8};});
  const pp=point(player);reserved.push({x:pp.x-size*.6,y:pp.y-size*.6,w:size*1.2,h:size*1.2});
  if(state.waypoint){const p=center(state.waypoint);reserved.push({x:p.x-size*.5,y:p.y-size*.5,w:size,h:size});}
  drawRoomLabels(ctx,world,state,layout,markers,reserved);
  for(const marker of markers){const p=point(marker.position);ctx.save();ctx.translate(p.x,p.y);ctx.globalAlpha=marker.done?.46:1;ctx.fillStyle='#14211a';ctx.strokeStyle=marker.color;ctx.lineWidth=2;
    ctx.beginPath();if(marker.type==='objective'){ctx.moveTo(0,-r);ctx.lineTo(r,0);ctx.lineTo(0,r);ctx.lineTo(-r,0);ctx.closePath();}
    else if(marker.type==='part'){ctx.moveTo(0,-r);ctx.lineTo(r,r);ctx.lineTo(-r,r);ctx.closePath();}
    else ctx.rect(-r,-r,r*2,r*2);ctx.fill();ctx.stroke();
    ctx.strokeStyle=marker.color;ctx.fillStyle=marker.color;ctx.lineWidth=2;
    if(marker.done){ctx.beginPath();ctx.moveTo(-r*.5,0);ctx.lineTo(-r*.08,r*.4);ctx.lineTo(r*.65,-r*.4);ctx.stroke();}
    else if(marker.type==='supply'){ctx.fillRect(-r*.15,-r*.6,r*.3,r*1.2);ctx.fillRect(-r*.6,-r*.15,r*1.2,r*.3);}
    else if(marker.type==='bench'){ctx.beginPath();ctx.moveTo(-r*.6,-r*.2);ctx.lineTo(r*.6,-r*.2);ctx.moveTo(-r*.4,-r*.2);ctx.lineTo(-r*.4,r*.6);ctx.moveTo(r*.4,-r*.2);ctx.lineTo(r*.4,r*.6);ctx.stroke();}
    else if(marker.type==='exit'){ctx.strokeRect(-r*.45,-r*.65,r*.9,r*1.3);ctx.fillRect(r*.15,0,2,2);}
    else if(marker.label){ctx.font=`700 ${r*1.1}px monospace`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(marker.label,0,.5);}
    ctx.restore();
  }
  if(state.waypoint){const p=center(state.waypoint);ctx.strokeStyle='#ffd58c';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,size*.4,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(p.x,p.y-size*.5);ctx.lineTo(p.x,p.y+size*.5);ctx.moveTo(p.x-size*.5,p.y);ctx.lineTo(p.x+size*.5,p.y);ctx.stroke();}
  if(keyboard&&state.cursor){const p=center(state.cursor);ctx.strokeStyle='#eaf3d2';ctx.lineWidth=2;ctx.setLineDash([4,3]);ctx.strokeRect(p.x-size*.45,p.y-size*.45,size*.9,size*.9);ctx.setLineDash([]);}
  // A continuous arrow matches the world camera: yaw 0 points north (-Z).
  ctx.save();ctx.translate(pp.x,pp.y);ctx.rotate(-yaw);ctx.fillStyle='#eaf4ae';ctx.shadowColor='#dbea7970';ctx.shadowBlur=12;ctx.strokeStyle='#142019';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,-size*.42);ctx.lineTo(size*.27,size*.3);ctx.lineTo(0,size*.16);ctx.lineTo(-size*.27,size*.3);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
  const nx=canvas.width-layout.left*.5,ny=layout.top*.45;
  ctx.fillStyle='#dbe9ba';ctx.font=`700 ${Math.max(12,size*.45)}px monospace`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('N',nx,ny);ctx.strokeStyle='#dbe9ba';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(nx,ny+10);ctx.lineTo(nx,ny+23);ctx.moveTo(nx-4,ny+14);ctx.lineTo(nx,ny+10);ctx.lineTo(nx+4,ny+14);ctx.stroke();
  const bar=size*5,bx=layout.left,by=canvas.height-layout.top*.45;ctx.strokeStyle='#829a80';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(bx,by-4);ctx.lineTo(bx,by);ctx.lineTo(bx+bar,by);ctx.lineTo(bx+bar,by-4);ctx.stroke();ctx.font=`${Math.max(10,size*.3)}px monospace`;ctx.textAlign='left';ctx.fillStyle='#9eb094';ctx.fillText(`${world.cellSize*5} m`,bx+bar+8,by-1);
  return {layout,path,connected:route.connected,distance:Math.round(distance),stats:surveyStats(world,state),markers};
}
