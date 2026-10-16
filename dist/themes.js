export function dressLevel(T,root,scene,{level,grid,edges,cellSize,wallHeight,random,box,wallMat,floorMat,ceilingMat,hemi,daylight,lights,fluorescentMat,placard}){
  const kind=level.kind;
  const cv=document.createElement('canvas');cv.width=cv.height=512;const c=cv.getContext('2d');
  const tiled=(base,grout,size)=>{c.fillStyle=grout;c.fillRect(0,0,512,512);for(let y=0;y<512;y+=size)for(let x=0;x<512;x+=size){c.fillStyle=base;c.fillRect(x+2,y+2,size-4,size-4);c.strokeStyle='rgba(255,255,255,.18)';c.strokeRect(x+3,y+3,size-6,size-6);for(let n=0;n<8;n++){c.fillStyle='rgba(30,42,35,.09)';c.fillRect(x+random()*size,y+random()*size,2,random()*12);}}};
  if(kind==='pool')tiled('#a5cac5','#5e7772',32);
  if(kind==='industrial'){c.fillStyle='#575650';c.fillRect(0,0,512,512);for(let n=0;n<8000;n++){c.fillStyle='rgba(22,24,24,.12)';c.fillRect(random()*512,random()*512,2,4);}for(let y=0;y<512;y+=128){c.fillStyle='#252d2a';c.fillRect(0,y,512,3);}for(let n=0;n<12;n++){c.fillStyle='rgba(143,70,27,.3)';c.fillRect(random()*512,random()*512,8,120);}}
  if(kind==='archive')tiled('#59423c','#302928',128);
  if(kind!=='office'){
    const tex=new T.CanvasTexture(cv);tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.colorSpace=T.SRGBColorSpace;wallMat.map=tex;wallMat.bumpMap=tex;wallMat.color.setHex(0xffffff);
    const floorTex=tex.clone();floorTex.needsUpdate=true;floorTex.repeat.set(23,23);floorMat.map=floorTex;floorMat.color.setHex(kind==='pool'?0xb8e2de:kind==='industrial'?0x8a8876:0x807269);floorMat.roughness=kind==='pool'?.35:.93;
    ceilingMat.color.setHex(kind==='pool'?0xc2d9d0:kind==='industrial'?0x6e726b:0x615c55);
  }
  scene.fog=new T.FogExp2(kind==='pool'?0x030909:kind==='industrial'?0x080704:kind==='archive'?0x080405:0x060805,.026);
  scene.background.copy(scene.fog.color);
  const baseHemi=kind==='pool'?.035:kind==='industrial'?.018:kind==='archive'?.016:.025;
  hemi.color.setHex(kind==='pool'?0xa8e8e9:kind==='archive'?0xe8a7a1:0xd8dcc1);hemi.intensity=baseHemi;
  daylight.intensity=0;
  for(const {light} of lights)light.color.setHex(kind==='pool'?0xacefee:kind==='industrial'?0xffbb68:kind==='archive'?0xff7064:0xffeec0);
  fluorescentMat.emissive.setHex(kind==='pool'?0x96ece7:kind==='archive'?0xf35c51:0xeaf2cb);
  const steel=new T.MeshStandardMaterial({color:0x5b6865,metalness:.7,roughness:.55});
  const rust=new T.MeshStandardMaterial({color:0x885d35,metalness:.3,roughness:.9});
  const black=new T.MeshStandardMaterial({color:0x182320,roughness:.95});
  const warning=new T.MeshStandardMaterial({color:0xc6a04c,roughness:.8});
  const animations=[];
  if(kind==='pool'){
    const waterMat=new T.MeshStandardMaterial({color:0x66bcb6,metalness:.4,roughness:.18,transparent:true,opacity:.36,depthWrite:false});
    const water=new T.Mesh(new T.PlaneGeometry(92,92,1,1),waterMat);water.rotation.x=-Math.PI/2;water.position.set(46,.035,46);root.add(water);
    const rings=new T.InstancedMesh(new T.RingGeometry(.6,.615,32),new T.MeshBasicMaterial({color:0xc9ffff,transparent:true,opacity:.035,depthWrite:false,side:T.DoubleSide}),30),dummy=new T.Object3D();
    const spots=[];for(let z=2;z<21;z+=3)for(let x=2;x<21;x+=4)if(!grid[z][x])spots.push([x*4+2,z*4+2]);
    const active=spots.slice(0,30);rings.count=active.length;root.add(rings);animations.push(time=>{active.forEach(([x,z],i)=>{const scale=.2+(time*.22+i*.13)%1.5;dummy.position.set(x,.05,z);dummy.rotation.set(-Math.PI/2,0,0);dummy.scale.set(scale,scale,scale);dummy.updateMatrix();rings.setMatrixAt(i,dummy.matrix);});rings.instanceMatrix.needsUpdate=true;waterMat.opacity=.34+Math.sin(time*.7)*.035;});
    edges.filter((e,i)=>i%15===0).forEach(e=>{const g=new T.Group();g.position.set(e.x+e.dx*.12,0,e.z+e.dz*.12);g.rotation.y=Math.atan2(e.dx,e.dz);root.add(g);for(const x of [-.35,.35]){const rail=new T.Mesh(new T.CylinderGeometry(.028,.028,1.4,8),steel);rail.position.set(x,.7,.18);g.add(rail);}for(let n=0;n<5;n++)box(.7,.04,.04,steel,0,.18+n*.25,.18,g);});
    placard(['POOL 03','NO LIFEGUARD'],40.05,2.25,68,Math.PI/2,2.4,.7,{color:'#3b6665',background:'#b8d6cd',size:60});
    placard(['TURN OFF YOUR LIGHT','WHEN IT SMILES'],47.95,1.8,52,-Math.PI/2,2.6,1,{color:'#254d4b',background:'#b8d6cd',size:54});
  }
  if(kind==='industrial'){
    edges.filter((e,i)=>i%5===0).forEach(e=>{const g=new T.Group();g.position.set(e.x+e.dx*.16,0,e.z+e.dz*.16);g.rotation.y=Math.atan2(e.dx,e.dz);root.add(g);
      for(const y of [2.6,2.92]){const pipe=new T.Mesh(new T.CylinderGeometry(.11,.11,3.8,10),rust);pipe.rotation.z=Math.PI/2;pipe.position.set(0,y,.08);g.add(pipe);for(const x of [-1.2,1.2])box(.1,.33,.25,steel,x,y,.08,g);}
      const gauge=new T.Mesh(new T.CylinderGeometry(.13,.13,.07,16),warning);gauge.rotation.x=Math.PI/2;gauge.position.set(0,2.3,.08);g.add(gauge);box(.02,.14,.02,black,.035,2.32,.13,g);
    });
    for(let z=4;z<21;z+=4)for(let x=2;x<22;x+=4)if(!grid[z][x]){const grate=new T.Group();grate.position.set(x*4+2,.018,z*4+2);root.add(grate);for(let n=0;n<9;n++)box(.05,.02,1.4,black,-.6+n*.15,0,0,grate);box(1.5,.02,.07,steel,0,0,.7,grate);box(1.5,.02,.07,steel,0,0,-.7,grate);}
    placard(['PRESSURE LOCK','4 VALVES TO RELEASE'],40.05,2.2,76,Math.PI/2,2.6,.9,{color:'#1c241f',background:'#cbaa59',size:57});
    placard(['BLIND ENTITY','SOUND CARRIES'],47.95,1.9,52,-Math.PI/2,2.4,.9,{color:'#e0bb75',background:'#34372b',size:64});
  }
  if(kind==='archive'){
    const pages=new T.MeshStandardMaterial({color:0xb2a486,roughness:1}),cover=new T.MeshStandardMaterial({color:0x453b34,roughness:.9});
    const entries=[];
    edges.filter((e,i)=>i%4===0).forEach(e=>{for(let row=0;row<4;row++)for(let n=0;n<10;n++)entries.push({e,x:-1.55+n*.33,y:.4+row*.63,h:.25+random()*.18});});
    const books=new T.InstancedMesh(new T.BoxGeometry(.24,1,.2),pages,entries.length),dummy=new T.Object3D();
    entries.forEach(({e,x,y,h},i)=>{const a=Math.atan2(e.dx,e.dz);dummy.position.set(e.x+e.dx*.18+x*Math.cos(a),y+h/2,e.z+e.dz*.18-x*Math.sin(a));dummy.rotation.set(0,a,0);dummy.scale.set(1,h,1);dummy.updateMatrix();books.setMatrixAt(i,dummy.matrix);});root.add(books);
    edges.filter((e,i)=>i%4===0).forEach(e=>{const a=Math.atan2(e.dx,e.dz);for(let row=0;row<4;row++){const shelf=box(3.6,.05,.32,cover,e.x+e.dx*.17,.39+row*.63,e.z+e.dz*.17);shelf.rotation.y=a;}});
    placard(['KEEP THE WATCHER','IN YOUR LIGHT'],40.05,2.05,76,Math.PI/2,2.6,.9,{color:'#d8c3ad',background:'#482a29',size:58});
    placard(['SIGNAL VAULT','LAST TRANSMISSION'],47.95,2.25,52,-Math.PI/2,2.6,.9,{color:'#d8c3ad',background:'#482a29',size:58});
  }
  // Supply boxes reward optional exploration rather than mandatory backtracking.
  const supplies=[];
  [[11,14],[7,10],[19,17],[3,6]].forEach(([x,z],i)=>{if(grid[z][x])return;const p=new T.Vector3((x+.5)*4,.5,(z+.5)*4);const g=new T.Group();g.position.copy(p);root.add(g);box(.35,.46,.22,black,0,0,0,g);box(.18,.27,.025,warning,0,0,.125,g);box(.16,.055,.035,new T.MeshBasicMaterial({color:0xa3ffd1}),0,.06,.15,g);supplies.push({id:'supply'+i,position:p,mesh:g});});
  return {supplies,baseHemi,update(time){animations.forEach(fn=>fn(time));}};
}
