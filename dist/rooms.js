// Architectural zones are used by rendering, exploration labels and the survey map.
const bounds=[[1,1,8,7],[1,10,8,14],[1,18,8,21],[14,1,21,7],[14,10,21,14],[14,18,21,21],[10,1,11,11],[10,12,11,21]];
const plans=[
 [['Conference Suite','conference','#999c76','#3c493d',3.2],['Server Annex','server','#596b63','#263633',2.72],['Records Storage','storage','#897358','#504838',2.85],['Break Room','breakroom','#b6a990','#7b755c',3.1],['Abandoned Offices','office','#a89676','#585942',3.2],['Dispatch Room','reception','#7f998b','#363d32',3.1],['Narrow Service Hall','service','#7c846e','#30392f',2.55],['Reception Gallery','reception','#b7ad7c','#5b6044',3.32]],
 [['Changing Rooms','lockers','#9aa9b0','#546c71',2.8],['Filtration Room','server','#5c9794','#315552',2.7],['Flooded Baths','baths','#b2d2c6','#608f87',3.3],['Lap Pool Gallery','baths','#94ccd0','#396e76',3.3],['Maintenance Baths','service','#719b94','#375953',2.7],['Shower Wing','showers','#c4d5c4','#769791',2.95],['Blue Tile Passage','arches','#6b9ca8','#365f70',2.65],['Poolside Colonnade','arches','#c6d6bb','#6c9c91',3.3]],
 [['Boiler Chamber','boiler','#8a7660','#373a33',3.3],['Pressure Station','boiler','#837c68','#3e473d',2.9],['Machine Workshop','workshop','#849081','#3b4038',3.2],['Turbine Bay','turbine','#5e7976','#2d3c3b',3.3],['Valve Gallery','service','#aa8559','#554332',2.7],['Control Room','server','#839e99','#3d5957',2.85],['Cable Tunnel','service','#565f57','#29332c',2.5],['Hazard Passage','hazard','#978e62','#43483b',3.1]],
 [['Reading Room','reading','#9e8377','#493b36',3.3],['Signal Vault','vault','#526664','#2a3736',2.75],['Compact Stacks','storage','#826e5e','#42332d',2.85],['Observation Ward','observation','#a3a79d','#52625c',3.1],['Dead Letter Office','office','#7f6058','#453432',3.05],['Evidence Room','vault','#82635e','#412c2b',2.8],['Restricted Corridor','hazard','#684644','#382829',2.55],['Red Reading Gallery','reading','#967267','#503c38',3.3]]
];
const shortNames=[
 ['Conference','Server Annex','Records','Break Room','Offices','Dispatch','Service Hall','Gallery'],
 ['Changing','Filtration','Flooded Baths','Lap Pool','Maintenance','Showers','Blue Passage','Colonnade'],
 ['Boilers','Pressure','Workshop','Turbines','Valve Gallery','Control','Cable Tunnel','Hazard Hall'],
 ['Reading','Signal Vault','Stacks','Observation','Dead Letters','Evidence','Restricted','Red Gallery']
];
export function roomPlan(index){return plans[index].map((p,i)=>({id:`${index}-${i}`,code:String(i+1).padStart(2,'0'),shortName:shortNames[index][i],name:p[0],design:p[1],wall:p[2],floor:p[3],height:p[4],bounds:[...bounds[i]],color:p[3],scare:['glimpse','blackout','ambush'][i%3]}));}
export function roomAt(rooms,x,z){return rooms.find(r=>x>=r.bounds[0]&&z>=r.bounds[1]&&x<=r.bounds[2]&&z<=r.bounds[3])||null;}
// Short, bent cross-links give hunted players a second way out of the side wings.
// Their mouths and names are shared with the painted wayfinding arrows.
const routes=[
 [{name:'Records return',room:2,cells:[[7,20],[8,20],[9,20],[9,19],[10,19]]},{name:'Break room bypass',room:3,cells:[[11,2],[12,2],[12,3],[13,3],[14,3]]},{name:'Office service loop',room:4,cells:[[11,12],[12,12],[13,12],[13,11],[14,11],[15,11]]}],
 [{name:'Baths return',room:2,cells:[[7,13],[8,13],[9,13],[9,14],[10,14]]},{name:'Pool inspection loop',room:3,cells:[[11,2],[12,2],[12,3],[13,3],[14,3]]},{name:'Shower return',room:5,cells:[[11,20],[12,20],[13,20],[13,19],[14,19]]}],
 [{name:'Boiler bypass',room:0,cells:[[7,5],[8,5],[9,5],[9,6],[10,6]]},{name:'Turbine bypass',room:3,cells:[[11,6],[12,6],[13,6],[13,5],[14,5]]},{name:'Valve return',room:4,cells:[[11,15],[12,15],[13,15],[13,14],[14,14]]}],
 [{name:'Reading return',room:0,cells:[[8,2],[9,2],[10,2]]},{name:'Stacks return',room:2,cells:[[8,20],[9,20],[9,19],[10,19]]},{name:'Dead letter bypass',room:4,cells:[[11,12],[12,12],[13,12],[14,12]]},{name:'Evidence return',room:5,cells:[[11,20],[12,20],[13,20],[13,19],[14,19]]}]
];
export function routePlan(index){return routes[index].map(r=>({...r,cells:r.cells.map(p=>[...p])}));}
export function subdivideRooms(grid,index){
  const wall=(x,z)=>{if(x>0&&x<22&&z>0&&z<22)grid[z][x]=1;};
  if(index===0){for(const z of [1,3])wall(4,z);for(const z of [1,3])wall(17,z);grid[2][17]=0;for(const x of [1,2,4,6,7])wall(x,19);}
  if(index===1){for(const x of [1,2,4,5,7])wall(x,4);for(const x of [14,15,17,18,19,21])wall(x,4);for(const x of [1,2,4,5,7])wall(x,18);}
  if(index===2){for(const z of [2,5,6,7,10,11,14,15,16,17])wall(10,z);}
  if(index===3){for(const x of [1,2,4,5,7,8])wall(x,4);for(const x of [14,15,17,18,20,21])wall(x,4);for(const x of [1,2,4,5,7,8])wall(x,18);}
  // Sightline-breaking doglegs connect into the same service network.
  const turns=[{z:8,x:9},{z:11,x:12},{z:10,x:12},{z:14,x:9}],turn=turns[index];
  wall(10,turn.z);wall(11,turn.z);
  for(let z=turn.z-1;z<=turn.z+1;z++)grid[z][turn.x]=0;
  for(const z of [turn.z-1,turn.z+1])for(let x=Math.min(turn.x,10);x<=Math.max(turn.x,11);x++)grid[z][x]=0;
  // Machinery chambers replace empty pipe intersections with a ring around a
  // structural island. Every island remains represented in collision and AI.
  if(index===2){
    for(const [x0,z0,x1,z1] of [[4,2,8,6],[14,2,18,7],[14,10,18,14]])for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++)grid[z][x]=0;
  }
  const islands=[
    [[4,5],[16,11],[16,12]],
    [[4,5],[4,14],[4,15],[17,14],[17,15]],
    [[5,3],[6,3],[5,4],[6,4],[16,3],[16,4],[16,5],[15,11],[16,11],[15,12],[16,12]],
    [[4,14],[7,14],[17,12],[17,13],[17,14],[4,20],[7,20]]
  ];
  for(const [x,z] of islands[index])wall(x,z);
  for(const route of routes[index])for(const [x,z] of route.cells)grid[z][x]=0;
  // Keep the entire immediate play/interaction area free around fixed anchors.
  // Objective cabinets occupy their centre; the surrounding walkable ring is
  // how the player reaches the front of each control in low visibility.
  for(const [x,z] of [[3,3],[6,12],[3,20],[19,3],[20,12],[18,5],[3,6],[19,17],[11,20]])grid[z][x]=0;
}
export function buildRooms(T,root,{index,grid,edges,cellSize,wallHeight,box,placard,random,occupied=[]}){
  const rooms=roomPlan(index),obstacles=[],animated=[];
  const texture=(room,kind)=>{
    const cv=document.createElement('canvas');cv.width=cv.height=256;const c=cv.getContext('2d');
    const color=kind==='floor'?room.floor:kind==='ceiling'?'#aaa897':room.wall;c.fillStyle=color;c.fillRect(0,0,256,256);
    const tiles=['lockers','baths','showers','arches','observation'].includes(room.design);
    c.strokeStyle=tiles?'rgba(21,46,44,.35)':'rgba(18,24,18,.22)';c.lineWidth=tiles?3:1;
    if(tiles){for(let n=0;n<=256;n+=32){c.beginPath();c.moveTo(n,0);c.lineTo(n,256);c.moveTo(0,n);c.lineTo(256,n);c.stroke();}}
    else if(['server','boiler','turbine','hazard','service','vault'].includes(room.design)){for(let n=0;n<=256;n+=64){c.strokeRect(1,n+1,254,62);for(const x of [6,250]){c.fillStyle='rgba(0,0,0,.4)';c.fillRect(x,n+6,3,3);}}}
    else if(kind==='floor'){for(let n=0;n<256;n+=16){c.fillStyle='rgba(200,164,104,.12)';c.fillRect(n,0,3,256);c.strokeRect(n,0,16,256);}}
    else {for(let n=0;n<256;n+=16){c.fillStyle='rgba(236,219,171,.07)';c.fillRect(n,0,8,256);}c.fillStyle='rgba(30,39,27,.15)';c.fillRect(0,180,256,76);}
    for(let n=0;n<1600;n++){c.fillStyle=random()>.5?'rgba(240,225,190,.045)':'rgba(11,20,16,.08)';c.fillRect(random()*256,random()*256,1+random()*2,1+random()*5);}
    const tex=new T.CanvasTexture(cv);tex.colorSpace=T.SRGBColorSpace;tex.wrapS=tex.wrapT=T.RepeatWrapping;return tex;
  };
  const steel=new T.MeshStandardMaterial({color:0x44544f,metalness:.55,roughness:.65}),wood=new T.MeshStandardMaterial({color:0x66563d,roughness:.93}),dark=new T.MeshStandardMaterial({color:0x101f1b,roughness:.9});
  const white=new T.MeshStandardMaterial({color:0xa5b4a6,roughness:.8}),brass=new T.MeshStandardMaterial({color:0xb4a36b,metalness:.6,roughness:.65});
  const makeInstances=(geo,mat,entries,fn,name)=>{if(!entries.length)return;const mesh=new T.InstancedMesh(geo,mat,entries.length),dummy=new T.Object3D();mesh.name=name;entries.forEach((e,i)=>{dummy.scale.set(1,1,1);fn(dummy,e,i);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});if(name.startsWith('ROOM_WALL')||name.startsWith('ROOM_CEILING'))mesh.castShadow=true;if(name.startsWith('ROOM_FLOOR')||name.startsWith('ROOM_WALL'))mesh.receiveShadow=true;root.add(mesh);return mesh;};
  for(const room of rooms){
    const cells=[];for(let z=room.bounds[1];z<=room.bounds[3];z++)for(let x=room.bounds[0];x<=room.bounds[2];x++)if(!grid[z][x])cells.push({x,z});
    if(!cells.length)continue;
    const cx=(room.bounds[0]+room.bounds[2])/2,cz=(room.bounds[1]+room.bounds[3])/2;
    room.anchor={...cells.reduce((best,p)=>Math.hypot(p.x-cx,p.z-cz)<Math.hypot(best.x-cx,best.z-cz)?p:best)};
    const wallMat=new T.MeshStandardMaterial({map:texture(room,'wall'),roughness:.87,side:T.DoubleSide});
    const floorMat=new T.MeshStandardMaterial({map:texture(room,'floor'),roughness:index===1?.38:.9});
    const ceilMat=new T.MeshStandardMaterial({map:texture(room,'ceiling'),color:room.design==='server'?0x61736b:room.design==='hazard'?0x7b7061:0xb9b3a1,side:T.DoubleSide,roughness:1});
    makeInstances(new T.PlaneGeometry(4,4),floorMat,cells,(d,p)=>{d.position.set(p.x*4+2,index===1?['baths','arches'].includes(room.design)?.018:.065:.028,p.z*4+2);d.rotation.set(-Math.PI/2,0,0);},`ROOM_FLOOR_${room.id}`);
    makeInstances(new T.PlaneGeometry(4,4),ceilMat,cells,(d,p)=>{d.position.set(p.x*4+2,room.height,p.z*4+2);d.rotation.set(Math.PI/2,0,0);},`ROOM_CEILING_${room.id}`);
    const roomEdges=edges.filter(e=>roomAt(rooms,Math.floor((e.x+e.dx*.2)/4),Math.floor((e.z+e.dz*.2)/4))===room);
    makeInstances(new T.PlaneGeometry(4,wallHeight),wallMat,roomEdges,(d,e)=>{d.position.set(e.x+e.dx*.055,wallHeight/2,e.z+e.dz*.055);d.rotation.set(0,Math.atan2(e.dx,e.dz),0);},`ROOM_WALL_${room.id}`);
    const strip=new T.MeshBasicMaterial({color:room.design==='server'?0x74c7bc:room.design==='hazard'?0xd3ac56:index===1?0xb3e0d9:index===3?0xbd7166:0xe2d5a2});
    strip.color.multiplyScalar(.12);
    const lampCells=cells.filter((p,i)=>(p.x*3+p.z)%9===0);
    makeInstances(new T.BoxGeometry(.16,.025,1.4),strip,lampCells,(d,p)=>{d.position.set(p.x*4+2,room.height-.045,p.z*4+2);d.rotation.set(0,0,0);},`ROOM_LIGHT_${room.id}`);
    const trim=new T.MeshStandardMaterial({color:room.floor,roughness:.9});
    makeInstances(new T.BoxGeometry(4,.1,.035),trim,roomEdges,(d,e)=>{d.position.set(e.x+e.dx*.08,1.05,e.z+e.dz*.08);d.rotation.set(0,Math.atan2(e.dx,e.dz),0);},`ROOM_RAIL_${room.id}`);
    const gateways=cells.filter(p=>[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dz])=>grid[p.z+dz]?.[p.x+dx]===0&&roomAt(rooms,p.x+dx,p.z+dz)!==room));
    gateways.sort((a,b)=>Math.hypot(a.x-10.5,a.z-cz)-Math.hypot(b.x-10.5,b.z-cz));
    const entryCell=gateways[0]||room.anchor;
    const entry=roomEdges.reduce((best,e)=>!best||Math.hypot(e.x-(entryCell.x+.5)*4,e.z-(entryCell.z+.5)*4)<Math.hypot(best.x-(entryCell.x+.5)*4,best.z-(entryCell.z+.5)*4)?e:best,null);
    if(entry)placard([`${room.code} / ${room.name.toUpperCase()}`,`SECTOR ${room.id.toUpperCase()}`],entry.x+entry.dx*.09,2.15,entry.z+entry.dz*.09,Math.atan2(entry.dx,entry.dz),3.2,.72,{color:'#d7cfb1',background:room.floor,size:43});
    // A central landmark changes the room silhouette while routes skirt the island.
    const candidates=[];
    for(let z=room.bounds[1]+1;z<=room.bounds[3];z++)for(let x=room.bounds[0]+1;x<=room.bounds[2];x++){
      if([[x,z],[x-1,z],[x,z-1],[x-1,z-1]].every(([cx,cz])=>!grid[cz][cx])&&!occupied.some(o=>Math.hypot(o.x-x*4,o.z-z*4)<2.8)&&![[14,14],[26,50],[14,82],[78,14],[82,50]].some(([px,pz])=>Math.hypot(px-x*4,pz-z*4)<3.5))candidates.push({x,z});
    }
    candidates.sort((a,b)=>Math.hypot(a.x-room.anchor.x,a.z-room.anchor.z)-Math.hypot(b.x-room.anchor.x,b.z-room.anchor.z));
    if(candidates.length&&['conference','reading','workshop','boiler','turbine','observation','baths'].includes(room.design)){
      const p=candidates[0],g=new T.Group();g.name=`CENTRAL_${room.design}`;g.position.set(p.x*4,0,p.z*4);root.add(g);const b=(w,h,d,m,x,y,z)=>box(w,h,d,m,x,y,z,g);
      if(['conference','reading','workshop'].includes(room.design)){
        b(2.6,.1,1.05,wood,0,.83,0);for(const x of [-1.1,1.1])for(const z of [-.4,.4])b(.06,.78,.06,steel,x,.39,z);
        for(const x of [-.7,.7])for(const z of [-.88,.88]){b(.43,.07,.42,dark,x,.45,z);b(.43,.43,.05,steel,x,.65,z*1.19);b(.04,.42,.04,steel,x,.21,z);}
        for(let n=0;n<4;n++)b(.28,.016,.36,white,-.85+n*.5,.895,0);
      }else if(['boiler','turbine'].includes(room.design)){
        b(2.6,.22,1.4,steel,0,.11,0);
        const barrel=new T.Mesh(new T.CylinderGeometry(.56,.56,1.9,20),steel);barrel.rotation.z=Math.PI/2;barrel.position.set(0,1.03,0);g.add(barrel);
        for(const x of [-.7,.7]){const ring=new T.Mesh(new T.TorusGeometry(.58,.06,8,24),brass);ring.rotation.y=Math.PI/2;ring.position.set(x,1.03,0);g.add(ring);}
        for(const x of [-1,1])b(.16,.6,.65,dark,x,.46,0);
      }else if(room.design==='observation'){
        b(2.3,.11,.85,white,0,.56,0);b(2.2,.1,.8,dark,0,.66,0);for(const x of [-.9,.9])b(.07,.5,.75,steel,x,.25,0);b(.32,.09,.65,white,-.7,.76,0);
      }else{
        b(2.4,.08,1.15,white,0,.04,0);for(const x of [-1,1]){const column=new T.Mesh(new T.CylinderGeometry(.14,.14,room.height,12),white);column.position.set(x,room.height/2,0);g.add(column);}b(2.6,.12,.45,white,0,room.height-.14,0);
      }
      obstacles.push({x:p.x*4,z:p.z*4,hx:1.55,hz:1.15});
    }
    // Purpose-specific furniture is wall mounted, leaving cell-centre routes clear.
    const decor=roomEdges.filter((e,i)=>i%17===5&&!occupied.some(o=>Math.hypot(o.x-e.x,o.z-e.z)<2)).slice(0,4);
    decor.forEach((e,i)=>{
      const g=new T.Group();g.name=`LANDMARK_${room.design}`;g.position.set(e.x+e.dx*.12,0,e.z+e.dz*.12);g.rotation.y=Math.atan2(e.dx,e.dz);root.add(g);
      const b=(w,h,d,m,x,y,z)=>box(w,h,d,m,x,y,z,g);
      if(['server','vault'].includes(room.design)){
        b(1.1,2.15,.52,steel,0,1.075,.28);for(let n=0;n<9;n++){b(.98,.12,.035,dark,0,.22+n*.21,.558);b(.055,.02,.02,strip,-.37,.22+n*.21,.581);}
      }else if(['boiler','turbine'].includes(room.design)){
        const tank=new T.Mesh(new T.CylinderGeometry(.42,.42,1.9,16),steel);tank.position.set(0,1.05,.48);g.add(tank);for(const y of [.3,.8,1.4,1.9]){const hoop=new T.Mesh(new T.TorusGeometry(.43,.025,6,16),brass);hoop.rotation.x=Math.PI/2;hoop.position.set(0,y,.48);g.add(hoop);}b(.18,.07,.15,brass,.4,1.3,.83);
      }else if(['lockers','storage'].includes(room.design)){
        for(const x of [-.5,0,.5]){b(.46,1.9,.45,white,x,.95,.26);b(.02,.14,.025,dark,x+.13,1,.5);for(let n=0;n<4;n++)b(.26,.018,.022,steel,x,1.7+n*.04,.502);}
      }else if(room.design==='showers'){
        for(const x of [-.8,.8]){b(.025,1.3,.025,steel,x,1.6,.08);b(.18,.025,.18,steel,x,2.26,.2);b(.15,.05,.08,brass,x,1.15,.1);}
        b(2,.08,.55,white,0,.4,.32);
      }else if(['baths','arches'].includes(room.design)){
        // Tiled benches and paired columns make the pool wings recognisable.
        b(1.6,.12,.55,white,0,.46,.32);for(const x of [-.65,.65])b(.14,.4,.5,white,x,.2,.32);
        for(const x of [-.7,.7])b(.12,1.6,.12,white,x,1.6,.12);b(1.55,.15,.2,white,0,2.44,.12);
      }else if(room.design==='service'){
        b(1.3,.9,.24,steel,0,1.45,.16);b(1.06,.65,.035,dark,0,1.45,.305);
        for(let n=0;n<3;n++){b(.16,.25,.04,n===1?brass:white,-.35+n*.35,1.45,.34);b(.04,1.35,.04,steel,-.35+n*.35,.65,.15);}
        b(1.45,.15,.45,steel,0,.12,.3);
      }else if(room.design==='hazard'){
        b(1.6,1.3,.25,dark,0,.65,.18);
        for(let n=0;n<6;n++){const slat=b(.13,1.25,.05,n%2?brass:steel,-.65+n*.26,.67,.34);slat.rotation.z=-.25;}
        b(1.75,.1,.38,steel,0,1.35,.22);
      }else if(room.design==='observation'){
        b(1.3,.1,.65,white,0,.6,.42);b(1.25,.1,.6,dark,0,.69,.42);for(const x of [-.55,.55])b(.05,.6,.6,steel,x,.3,.42);b(.25,.1,.55,white,-.45,.79,.42);
        b(1.1,.55,.04,steel,0,2,.1);b(.8,.38,.02,dark,0,2,.13);
      }else if(room.design==='breakroom'){
        b(1.4,.85,.55,white,0,.425,.3);b(1.5,.08,.65,wood,0,.89,.3);b(.34,.35,.25,dark,-.4,1.1,.32);b(.5,.1,.34,steel,.35,.95,.32);
      }else if(['conference','reading','workshop','office','reception'].includes(room.design)){
        b(1.7,.08,.8,wood,0,.8,.5);for(const x of [-.72,.72])b(.055,.78,.65,steel,x,.39,.5);b(.4,.04,.26,white,.1,.87,.48);b(.14,.24,.13,steel,-.48,.95,.45);
        if(room.design==='reading')for(let n=0;n<5;n++)b(.12,.3,.22,n%2?brass:dark,.5+n*.13,.99,.42);
        if(room.design==='reception'){b(1.6,.75,.12,white,0,.4,.1);b(.45,.32,.18,steel,-.4,1,.4);b(.3,.22,.012,strip,-.4,1,.497);}
      }
      const depth=['boiler','turbine'].includes(room.design)?1:1.05,width=1.85;
      const p=new T.Vector3(0,0,depth/2);g.localToWorld(p);obstacles.push({x:p.x,z:p.z,hx:e.dx?depth/2:width/2,hz:e.dx?width/2:depth/2});
    });
  }
  // Repeated doorway rhythms and side recesses distinguish the two main corridors.
  for(let z=3;z<=20;z+=3){
    if(grid[z][10]||grid[z][11])continue;const room=roomAt(rooms,11,z),mat=index===1?white:index===3?wood:steel;
    const y=(room?.height||3.2)-.18;box(7.8,.16,.23,mat,44,y,z*4+2);
    for(const x of [40.2,47.8])box(.16,y,.23,mat,x,y/2,z*4+2);
    if(index===1){for(let n=0;n<5;n++){const step=box(.8,.12,.23,white,42.4+n*.8,y+.08-Math.abs(n-2)*.055,z*4+2);}}
    if(index===2)for(const x of [40.3,47.7])for(let n=0;n<5;n++)box(.02,.09,.25,n%2?brass:dark,x,.8+n*.18,z*4+2);
  }
  return {rooms,obstacles,at(x,z){return roomAt(rooms,Math.floor(x/4),Math.floor(z/4));},update(time){animated.forEach(fn=>fn(time));}};
}
