// Wall-mounted landmarks enrich each room without changing routes or light levels.
export function buildAtmosphere(T,root,{level,rooms,edges,obstacles,grid,cellSize,placard}){
 const layer=new T.Group();layer.name='ENVIRONMENT_LANDMARKS';root.add(layer);
 const dynamicRoots=[],animations=[],landmarks=[];let clock=0,reduced=false;
 const metal=new T.MeshStandardMaterial({color:0x46534d,roughness:.8,metalness:.45});
 const paper=new T.MeshStandardMaterial({color:0xb7ac8a,roughness:1,side:T.DoubleSide});
 const black=new T.MeshStandardMaterial({color:0x151e1b,roughness:.65});
 const accent=new T.MeshStandardMaterial({color:level.kind==='pool'?0x72aaa4:level.kind==='archive'?0x865455:0xaa8950,roughness:.8});
 const glass=new T.MeshStandardMaterial({color:0x56716b,roughness:.18,metalness:.5});
 const geo={box:new T.BoxGeometry(1,1,1),disc:new T.CircleGeometry(1,24),ring:new T.TorusGeometry(1,.045,6,32),sphere:new T.SphereGeometry(1,8,6)};
 const add=(parent,shape,mat,x,y,z,sx,sy,sz)=>{const m=new T.Mesh(shape==='box'?new T.BoxGeometry(1,1,1):geo[shape],mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=shape==='box';m.receiveShadow=true;parent.add(m);return m;};
 const box=(g,x,y,z,w,h,d,mat=metal)=>add(g,'box',mat,x,y,z,w,h,d);
 const sign=(g,lines,y=2.1)=>{const m=placard(lines,0,0,0,0,1.65,.52,{color:'#d1d2b6',background:'#23312c',size:48});g.add(m);m.position.set(0,y,.08);};
 const stories={office:[['STAFF NOTICE','NIGHT SHIFT: 03:33'],['MISSING SINCE MONDAY','NO ONE CLOCKED OUT'],['RETURN ALL KEYS','DO NOT KNOCK BACK']],pool:[['DEPTH: UNKNOWN','NO SWIMMING AFTER DARK'],['FILTRATION OFFLINE','THE WATER REMEMBERS'],['LIFEGUARD STATION','LAST CHECK: 03:33']],industrial:[['EXHAUST CONTROL','KEEP CLEAR OF THE FAN'],['MAINTENANCE LOG','PRESSURE STILL RISING'],['SHIFT 333','NO OPERATOR FOUND']],archive:[['TRANSMISSION ROOM','RECORDING NEVER ENDED'],['RETURNED MAIL','ADDRESS DOES NOT EXIST'],['OBSERVATION LOG','SUBJECT STILL PRESENT']]};
 for(const [index,room] of rooms.entries()){
  // Pick a bare wall within this architectural zone, clear of existing furniture.
  const candidates=edges.filter(e=>{const x=e.x+e.dx*.3,z=e.z+e.dz*.3,cx=x/cellSize,cz=z/cellSize;
   return cx>=room.bounds[0]&&cx<=room.bounds[2]+1&&cz>=room.bounds[1]&&cz<=room.bounds[3]+1&&
    !obstacles.some(o=>Math.abs(x-o.x)<o.hx+.9&&Math.abs(z-o.z)<o.hz+.9)&&
    landmarks.every(l=>Math.hypot(e.x-l.x,e.z-l.z)>5);});
  const edge=candidates[Math.floor(candidates.length/2)];if(!edge)continue;
  const g=new T.Group();g.name=`LANDMARK_${level.kind}_${index}`;g.position.set(edge.x+edge.dx*.07,0,edge.z+edge.dz*.07);g.rotation.y=Math.atan2(edge.dx,edge.dz);layer.add(g);
  landmarks.push({name:g.name,room:room.name,x:g.position.x,z:g.position.z});
  const variant=index%3;
  if(level.kind==='office'){
   if(variant===0){
    add(g,'disc',black,0,1.65,.05,.62,.62,1);add(g,'ring',metal,0,1.65,.075,.64,.64,.64);
    for(let n=0;n<12;n++){const a=n/12*Math.PI*2;const tick=box(g,Math.sin(a)*.51,1.65+Math.cos(a)*.51,.08,.025,.075,.015,paper);tick.rotation.z=-a;}
    const hour=box(g,.14,1.65,.1,.3,.035,.025,accent);hour.rotation.z=-.3;
    const minute=box(g,-.06,1.48,.11,.025,.38,.025,paper);minute.rotation.z=.35;
   }else if(variant===1){
    box(g,0,1.55,.04,1.7,1,.08,accent);
    for(let n=0;n<6;n++){const page=box(g,-.55+n%3*.55,1.3+Math.floor(n/3)*.45,.09,.38,.34,.012,paper);page.rotation.z=(n%3-1)*.12;box(g,page.position.x,page.position.y+.1,.105,.2,.012,.01,black);}
   }else{
    box(g,0,1.4,.1,1.5,.8,.2,black);box(g,0,1.4,.21,1.27,.59,.018,glass);
    for(let n=0;n<5;n++)box(g,-.48+n*.24,1.4,.225,.012,.45,.006,accent);
    box(g,0,.9,.08,.15,.2,.12);box(g,0,.78,.1,.85,.04,.24);
   }
  }else if(level.kind==='pool'){
   add(g,'ring',accent,0,1.5,.07,.62,.62,.62);add(g,'ring',paper,0,1.5,.08,.45,.45,.45);
   box(g,0,1.5,.09,.04,1.1,.03,black);box(g,0,1.5,.1,1.1,.04,.03,black);
   for(let n=0;n<7;n++){box(g,-.85,.5+n*.21,.03,.2,.025,.025,paper);}
   const drops=[];for(let n=0;n<5;n++)drops.push(add(g,'sphere',glass,-.35+n*.17,1,.11,.012,.045,.012));
   animations.push(t=>drops.forEach((d,n)=>{d.position.y=.3+(1-(t*.22+n*.2)%1)*1.4;}));
   for(let n=0;n<3;n++){const tile=box(g,.7+n*.15,.2+n*.18,.025,.12,.14,.01,black);tile.rotation.z=n*.2;}
  }else if(level.kind==='industrial'){
   box(g,0,1.45,.025,1.65,1.55,.05,black);
   if(variant!==1){
    add(g,'ring',metal,0,1.45,.07,.66,.66,.66);
    const fan=new T.Group();fan.name='SLOW_EXHAUST_FAN';dynamicRoots.push(fan);fan.position.set(0,1.45,.11);g.add(fan);
    for(let n=0;n<5;n++){const blade=box(fan,0,.29,0,.19,.55,.025,accent);const holder=new T.Group();holder.rotation.z=n*Math.PI*2/5;fan.add(holder);holder.add(blade);}
    add(g,'sphere',metal,0,1.45,.16,.12,.12,.06);animations.push(t=>fan.rotation.z=t*.65);
    for(let n=0;n<7;n++)box(g,-.62+n*.21,1.45,.2,.018,1.2,.025,metal);
   }else{
    for(let n=0;n<3;n++){const x=-.5+n*.5;add(g,'disc',paper,x,1.55,.07,.2,.2,1);const needle=box(g,x,1.6,.09,.015,.22,.01,black);dynamicRoots.push(needle);animations.push(t=>needle.rotation.z=Math.sin(t*.7+n)*.18-.8);}
    for(let n=0;n<5;n++)box(g,-.5+n*.25,.98,.09,.07,.1,.04,accent);
   }
  }else{
   box(g,0,1.4,.04,1.75,1.1,.08,black);
   if(variant===0){
    for(const x of [-.45,.45]){add(g,'disc',metal,x,1.55,.09,.33,.33,1);const reel=new T.Group();reel.position.set(x,1.55,.12);g.add(reel);for(let n=0;n<3;n++){const a=n*Math.PI*2/3;add(reel,'disc',black,Math.sin(a)*.18,Math.cos(a)*.18,.01,.085,.085,1);}dynamicRoots.push(reel);animations.push(t=>reel.rotation.z=t*.3);}
    box(g,0,1.07,.1,1.4,.09,.03,accent);
   }else if(variant===1){
    for(let n=0;n<12;n++){const x=-.64+n%4*.43,y=1.08+Math.floor(n/4)*.32;box(g,x,y,.1,.34,.23,.03,paper);box(g,x,y,.13,.16,.012,.01,accent);}
   }else{
    box(g,0,1.45,.09,1.4,.8,.03,glass);for(let n=0;n<6;n++)box(g,-.58+n*.23,1.45,.14,.025,.85,.04,metal);
    box(g,0,1.23,.12,.19,.3,.015,black);add(g,'disc',black,0,1.5,.12,.12,.15,1);
   }
  }
  sign(g,stories[level.kind][variant],Math.min(room.height-.45,2.45));
 }
 // Sparse motes catch the flashlight; they emit no light and use one draw call.
 const dustPositions=[];for(let z=2;z<grid.length-1;z+=3)for(let x=2;x<grid[z].length-1;x+=3)if(grid[z][x]===0)dustPositions.push((x+.37)*cellSize,1.2,(z+.63)*cellSize);
 const dustGeo=new T.BufferGeometry();dustGeo.setAttribute('position',new T.Float32BufferAttribute(dustPositions,3));
 const dust=new T.Points(dustGeo,new T.PointsMaterial({color:0xacae9c,size:.018,transparent:true,opacity:.17,depthWrite:false,sizeAttenuation:true}));dust.name='FLASHLIGHT_MOTES';layer.add(dust);
 return {landmarks,dynamicRoots,setReduced(value){reduced=!!value;dust.visible=!reduced;},update(dt){clock+=Math.max(0,Math.min(.1,dt||0));if(reduced)return;animations.forEach(fn=>fn(clock));dust.position.y=Math.sin(clock*.23)*.12;}};
}
