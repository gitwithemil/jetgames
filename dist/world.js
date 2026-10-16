import { buildArmory } from './weapon.js';
import { buildRooms, subdivideRooms } from './rooms.js';
import { buildWayfinding } from './wayfinding.js';
import { LEVELS } from './levels.js';
import { dressLevel } from './themes.js';
import { addDetails } from './details.js';
// The building is generated locally: every texture, prop and route belongs to it.
export function createWorld(THREE, scene, levelIndex=0) {
  const level=LEVELS[levelIndex]||LEVELS[0], initialObjects=new Set(scene.children);
  const width = 23, height = 23, cellSize = 4, wallHeight = 3.35;
  let seed = 19041996+levelIndex*91421;
  const random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
  const grid = Array.from({ length: height }, () => Array(width).fill(1));
  const carve = (x0, z0, x1, z1) => {
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) grid[z][x] = 0;
  };
  // Two longitudinal arteries, connecting rooms, and the main eight-metre hall.
  [[10,1,11,21],[1,5,21,6],[1,16,21,17],[2,1,3,21],[19,1,20,21],
   [1,1,7,4],[5,3,8,10],[1,10,7,13],[6,12,8,18],[1,18,7,21],
   [14,1,21,4],[14,4,17,10],[15,10,21,14],[13,13,16,20],[17,18,21,21],
   [7,9,10,10],[7,13,10,14],[11,9,15,10],[11,19,19,20]].forEach(r => carve(...r));
  [[5,2],[6,2],[7,5],[7,6],[7,7],[4,11],[5,11],[5,19],[5,20],
   [17,2],[18,2],[15,7],[15,8],[18,11],[18,12],[19,19],[20,19]].forEach(([x,z]) => grid[z][x] = 1);
  if(levelIndex>0){
    grid.forEach(row=>row.fill(1));
    // Every stage has a distinct floor plan and connected north/south service spine.
    carve(10,1,11,21);
    if(levelIndex===1){
      [[1,1,7,7],[14,1,21,7],[1,12,7,21],[14,12,21,21],[1,5,21,6],[1,16,21,17],[6,9,16,10],[6,8,7,13],[15,7,16,14]].forEach(r=>carve(...r));
      [[4,4],[4,16],[17,4],[17,16],[6,19],[20,19]].forEach(([x,z])=>grid[z][x]=1);
    }else if(levelIndex===2){
      [[2,1,3,21],[19,1,20,21],[1,3,21,4],[1,8,21,9],[1,12,21,13],[1,18,21,20],[5,10,7,13],[1,1,4,4],[17,1,21,4]].forEach(r=>carve(...r));
    }else{
      [[1,1,8,7],[14,1,21,7],[1,11,8,21],[14,11,21,21],[1,5,21,6],[1,16,21,17],[6,9,16,10],[6,7,7,13],[15,7,16,13]].forEach(r=>carve(...r));
      for(const x of [4,7,16,19])for(const z of [2,3,12,13,19])if(grid[z][x]===0)grid[z][x]=1;
    }
    // Objective cells and enemy start are connected by the nearby service corridors.
    [[3,3],[6,12],[3,20],[19,3],[20,12],[18,5]].forEach(([x,z])=>carve(x,z,x,z));
    carve(17,5,20,6);
  }
  subdivideRooms(grid,levelIndex);
  const cellCenter = (x,z) => new THREE.Vector3((x + .5) * cellSize, 0, (z + .5) * cellSize);
  const cellAt = (x,z) => ({ x: Math.floor(x / cellSize), z: Math.floor(z / cellSize) });
  const openCell = (x,z) => x >= 0 && z >= 0 && x < width && z < height && grid[z][x] === 0;
  const spawn = cellCenter(11,20); spawn.y = 1.65;
  const enemySpawn = cellCenter(18,5);
  // A final flood fill also makes map edits safe: unreachable pockets are solid.
  const reached = new Set(['11,20']), queue = [[11,20]];
  for (let i = 0; i < queue.length; i++) {
    const [x,z] = queue[i];
    for (const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const key = `${x+dx},${z+dz}`;
      if (openCell(x+dx,z+dz) && !reached.has(key)) { reached.add(key); queue.push([x+dx,z+dz]); }
    }
  }
  for (let z = 1; z < height-1; z++) for (let x = 1; x < width-1; x++) if (!grid[z][x] && !reached.has(`${x},${z}`)) grid[z][x] = 1;

  const root = new THREE.Group(); root.name = 'LEVEL_00_THE_FORGOTTEN_OFFICES'; scene.add(root);
  scene.background = new THREE.Color(0x17170f);
  scene.fog = new THREE.FogExp2(0x84774e, .021);
  const canvasTexture = (size, draw, repeatX = 1, repeatY = 1) => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d'); draw(ctx, size);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeatX, repeatY);
    if (THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
  };
  const wallpaper = canvasTexture(512, (ctx,s) => {
    ctx.fillStyle = '#bdb184'; ctx.fillRect(0,0,s,s);
    for (let x = 0; x < s; x += 32) {
      ctx.fillStyle = x % 64 ? 'rgba(79,69,33,.10)' : 'rgba(247,231,163,.12)'; ctx.fillRect(x,0,16,s);
      ctx.strokeStyle = 'rgba(104,93,55,.23)'; ctx.lineWidth = 1;
      for (let y = -32; y < s+32; y += 48) {
        const cy = y + (x % 64 ? 24 : 0), cx = x+8;
        ctx.beginPath(); ctx.moveTo(cx,cy-15); ctx.bezierCurveTo(cx-15,cy-6,cx-11,cy+8,cx,cy+15);
        ctx.bezierCurveTo(cx+11,cy+8,cx+15,cy-6,cx,cy-15); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx,cy-13); ctx.lineTo(cx,cy+13); ctx.stroke();
      }
    }
    for (let i=0;i<10500;i++) { const shade = random() > .5 ? 255 : 22; ctx.fillStyle = `rgba(${shade},${shade},${shade},${random()*.09})`; ctx.fillRect(random()*s,random()*s,random()*3+1,random()*2+1); }
    for (let i=0;i<28;i++) {
      const x=random()*s,y=random()*s,r=10+random()*70,g=ctx.createRadialGradient(x,y,0,x,y,r);
      g.addColorStop(0,'rgba(81,66,21,.16)'); g.addColorStop(1,'rgba(81,66,21,0)'); ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);
    }
    const damp=ctx.createLinearGradient(0,s*.76,0,s); damp.addColorStop(0,'rgba(27,29,13,0)');damp.addColorStop(1,'rgba(38,39,21,.42)');ctx.fillStyle=damp;ctx.fillRect(0,s*.76,s,s*.24);
    ctx.strokeStyle='rgba(52,42,14,.22)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(1,0);ctx.lineTo(1,s);ctx.stroke();
    ctx.fillStyle='rgba(236,223,170,.48)';ctx.beginPath();ctx.moveTo(315,337);ctx.lineTo(327,360);ctx.lineTo(338,338);ctx.lineTo(333,390);ctx.lineTo(313,364);ctx.closePath();ctx.fill();
  });
  const carpet = canvasTexture(512, (ctx,s) => {
    ctx.fillStyle='#817550';ctx.fillRect(0,0,s,s);
    for(let i=0;i<41000;i++) { const light=random()>.43;ctx.fillStyle=light?'rgba(206,190,135,.15)':'rgba(22,27,15,.18)';const x=random()*s,y=random()*s;ctx.fillRect(x,y,.5+random()*1.5,1+random()*4); }
    for(let i=0;i<40;i++) {const x=random()*s,y=random()*s,r=12+random()*75,g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'rgba(34,36,20,.29)');g.addColorStop(1,'rgba(34,36,20,0)');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);}
    ctx.strokeStyle='rgba(31,29,15,.2)';ctx.lineWidth=2;ctx.strokeRect(1,1,s-2,s-2);
  }, width, height);
  const ceiling = canvasTexture(512,(ctx,s)=>{
    ctx.fillStyle='#a9a791';ctx.fillRect(0,0,s,s);
    for(let y=0;y<s;y+=64) for(let x=0;x<s;x+=64){ctx.fillStyle=`rgb(${162+Math.floor(random()*25)},${160+Math.floor(random()*23)},${141+Math.floor(random()*21)})`;ctx.fillRect(x+2,y+2,60,60);ctx.strokeStyle='rgba(235,235,204,.45)';ctx.strokeRect(x+2,y+2,60,60);}
    for(let i=0;i<8500;i++){ctx.fillStyle='rgba(41,39,27,.16)';ctx.fillRect(random()*s,random()*s,1,1);}
    for(let i=0;i<5;i++){const x=random()*s,y=random()*s,r=16+random()*45,g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'rgba(92,62,18,.32)');g.addColorStop(.6,'rgba(132,92,40,.15)');g.addColorStop(1,'rgba(94,64,25,0)');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);}
  },width,height);
  const wallMat = new THREE.MeshStandardMaterial({map:wallpaper,roughness:.95,bumpMap:wallpaper,bumpScale:.025,color:0xfff1cb});
  const floorMat = new THREE.MeshStandardMaterial({map:carpet,roughness:1,color:0xd1c8a4});
  const ceilingMat = new THREE.MeshStandardMaterial({map:ceiling,roughness:.95,color:0xe8e7cf,side:THREE.DoubleSide});
  const trimMat = new THREE.MeshStandardMaterial({color:0x635f42,roughness:.84});
  const metalMat = new THREE.MeshStandardMaterial({color:0x62695f,roughness:.67,metalness:.5});
  const darkMetal = new THREE.MeshStandardMaterial({color:0x252e28,roughness:.8,metalness:.36});
  const housingMat = new THREE.MeshStandardMaterial({color:0xd6d3b5,roughness:.68,metalness:.15});
  const fluorescentMat = new THREE.MeshStandardMaterial({color:0xffffdf,emissive:0xeaf2cb,emissiveIntensity:.22,roughness:.45});
  const box = (w,h,d,mat,x,y,z,parent=root) => {const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);parent.add(m);return m;};
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(width*cellSize,height*cellSize),floorMat);floor.rotation.x=-Math.PI/2;floor.position.set(width*cellSize/2,0,height*cellSize/2);floor.receiveShadow=true;root.add(floor);
  const top = new THREE.Mesh(new THREE.PlaneGeometry(width*cellSize,height*cellSize),ceilingMat);top.rotation.x=Math.PI/2;top.position.set(width*cellSize/2,wallHeight,height*cellSize/2);top.castShadow=true;root.add(top);
  const wallCells=[]; const edges=[];
  for(let z=0;z<height;z++) for(let x=0;x<width;x++) if(grid[z][x]){
    wallCells.push([x,z]);
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]) if(openCell(x+dx,z+dz)) edges.push({x:(x+.5)*cellSize+dx*cellSize*.5,z:(z+.5)*cellSize+dz*cellSize*.5,dx,dz});
  }
  const dummy=new THREE.Object3D();
  const walls=new THREE.InstancedMesh(new THREE.BoxGeometry(cellSize,wallHeight,cellSize),wallMat,wallCells.length);
  wallCells.forEach(([x,z],i)=>{dummy.position.set((x+.5)*cellSize,wallHeight/2,(z+.5)*cellSize);dummy.rotation.set(0,0,0);dummy.scale.set(1,1,1);dummy.updateMatrix();walls.setMatrixAt(i,dummy.matrix);});walls.instanceMatrix.needsUpdate=true;walls.castShadow=true;walls.receiveShadow=true;root.add(walls);
  const skirting=new THREE.InstancedMesh(new THREE.BoxGeometry(cellSize,.14,.07),trimMat,edges.length);
  const cornice=new THREE.InstancedMesh(new THREE.BoxGeometry(cellSize,.075,.08),housingMat,edges.length);
  edges.forEach((e,i)=>{dummy.rotation.set(0,e.dx?Math.PI/2:0,0);dummy.position.set(e.x+e.dx*.036,.09,e.z+e.dz*.036);dummy.updateMatrix();skirting.setMatrixAt(i,dummy.matrix);dummy.position.y=wallHeight-.05;dummy.updateMatrix();cornice.setMatrixAt(i,dummy.matrix);});root.add(skirting,cornice);

  const hemi = new THREE.HemisphereLight(0xd8dcc1,0x6b5939,.025);scene.add(hemi);
  const daylight = new THREE.DirectionalLight(0xfff7d2,0);daylight.position.set(-20,40,12);scene.add(daylight);
  const fixtureCells=[];
  for(let z=1;z<height-1;z++) for(let x=1;x<width-1;x++) if(openCell(x,z) && ((x===11&&z%3===1) || (x!==10&&x!==11&&(x*3+z)%9===0))) fixtureCells.push([x,z]);
  const housings=new THREE.InstancedMesh(new THREE.BoxGeometry(.68,.08,1.65),housingMat,fixtureCells.length);
  const lamps=new THREE.InstancedMesh(new THREE.BoxGeometry(.13,.035,1.46),fluorescentMat,fixtureCells.length*2);
  fixtureCells.forEach(([x,z],i)=>{const p=cellCenter(x,z);dummy.rotation.set(0,0,0);dummy.position.set(p.x,wallHeight-.09,p.z);dummy.updateMatrix();housings.setMatrixAt(i,dummy.matrix);for(let j=0;j<2;j++){dummy.position.set(p.x+(j?1:-1)*.17,wallHeight-.145,p.z);dummy.updateMatrix();lamps.setMatrixAt(i*2+j,dummy.matrix);}});root.add(housings,lamps);
  const lights=[];
  [[11,20],[11,16],[11,10],[11,4],[3,3],[4,12],[4,19],[19,3],[19,12],[18,19]].forEach(([x,z],i)=>{
    const p=cellCenter(x,z),light=new THREE.PointLight(i===5?0xc4e4be:0xffeec0,.9,4.8,2);light.position.set(p.x,wallHeight-.28,p.z);scene.add(light);lights.push({light,baseIntensity:.9,phase:random()*8,index:i});
  });
  // The luminous floor pools provide the sense of fluorescent falloff cheaply.
  const glowTexture=canvasTexture(128,(ctx,s)=>{const g=ctx.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);g.addColorStop(0,'rgba(255,246,188,.25)');g.addColorStop(.5,'rgba(255,246,188,.10)');g.addColorStop(1,'rgba(255,246,188,0)');ctx.fillStyle=g;ctx.fillRect(0,0,s,s);});
  const poolMat=new THREE.MeshBasicMaterial({map:glowTexture,transparent:true,depthWrite:false,opacity:.055,blending:THREE.AdditiveBlending});
  const pools=new THREE.InstancedMesh(new THREE.PlaneGeometry(4.8,4.8),poolMat,fixtureCells.length);
  fixtureCells.forEach(([x,z],i)=>{dummy.position.set((x+.5)*cellSize,.012,(z+.5)*cellSize);dummy.rotation.set(-Math.PI/2,0,0);dummy.updateMatrix();pools.setMatrixAt(i,dummy.matrix);});root.add(pools);

  const textTexture=(lines,{color='#d5c39a',background='#242b25',width:tw=768,height:th=384,size=68}={})=>{
    const cv=document.createElement('canvas');cv.width=tw;cv.height=th;const ctx=cv.getContext('2d');ctx.fillStyle=background;ctx.fillRect(0,0,tw,th);ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillStyle=color;ctx.font=`700 ${size}px monospace`;lines.forEach((line,i)=>ctx.fillText(line,tw/2,th/2+(i-(lines.length-1)/2)*size*1.3));
    ctx.strokeStyle=color;ctx.lineWidth=3;ctx.globalAlpha=.35;ctx.strokeRect(12,12,tw-24,th-24);
    const tex=new THREE.CanvasTexture(cv);if(THREE.SRGBColorSpace)tex.colorSpace=THREE.SRGBColorSpace;return tex;
  };
  const placard=(lines,x,y,z,rotation=0,w=2.1,h=1,options={})=>{const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({map:textTexture(lines,options),roughness:.86,transparent:!!options.transparent,side:THREE.DoubleSide}));mesh.position.set(x,y,z);mesh.rotation.y=rotation;root.add(mesh);return mesh;};
  // Grounded, readable storytelling at the start and throughout the corridors.
  placard([`LEVEL ${level.code}`,level.name.toUpperCase()],47.93,2.2,76, -Math.PI/2,2.5,.9,{size:61,color:'#c1b588'});
  placard(['DO NOT FOLLOW','THE KNOCKING'],40.045,1.75,68,Math.PI/2,2.55,1.15,{size:61,color:'#7e2620',background:'#b6a67a'});
  placard(['YOU HAVE BEEN','HERE BEFORE'],40.045,1.9,36,Math.PI/2,2.4,.95,{size:57,color:'#713125',background:'#b5a67c'});
  placard(['STAFF ONLY','→'],53.99,2.25,42,Math.PI/2,1.85,.85,{size:70});
  placard(['KEEP QUIET'],30,1.8,59.95,0,2,.65,{size:75,color:'#8f322b',background:'#bbac80'});

  const cardboard=canvasTexture(256,(ctx,s)=>{ctx.fillStyle='#856e45';ctx.fillRect(0,0,s,s);for(let i=0;i<3000;i++){ctx.fillStyle='rgba(44,28,8,.08)';ctx.fillRect(random()*s,random()*s,2,random()*8);}ctx.fillStyle='rgba(192,164,112,.7)';ctx.fillRect(s*.43,0,s*.14,s);ctx.strokeStyle='#534326';ctx.strokeRect(1,1,s-2,s-2);ctx.fillStyle='#443723';ctx.font='bold 18px monospace';ctx.fillText('ARCHIVE',20,170);ctx.fillText('1989 / B-14',20,194);});
  const cartonMat=new THREE.MeshStandardMaterial({map:cardboard,roughness:1});
  const cabinetMat=new THREE.MeshStandardMaterial({color:0x60644d,roughness:.78,metalness:.12});
  const paperTexture=textTexture(['PERSONNEL RECORD','----------------','POSITION: VACANT','ACCESS: REVOKED','----------------'],{color:'#655d43',background:'#c6bd95',size:26});
  const paperMat=new THREE.MeshStandardMaterial({map:paperTexture,roughness:1,side:THREE.DoubleSide});
  const propCells=[[6,4],[8,8],[1,12],[6,13],[6,18],[15,3],[16,8],[21,13],[14,15],[21,20]];
  propCells.forEach(([x,z],i)=>{
    const p=cellCenter(x,z);p.x+=i%2?-.95:1.05;p.z+=.85;
    for(let j=0;j<2+(i%3);j++){const w=.55+random()*.4,h=.5+random()*.45;const b=box(w,h,.65,cartonMat,p.x+(j%2)*.67,h/2+Math.floor(j/2)*.61,p.z);b.rotation.y=(random()-.5)*.22;}
    for(let j=0;j<3;j++){const sheet=new THREE.Mesh(new THREE.PlaneGeometry(.35,.46),paperMat);sheet.rotation.set(-Math.PI/2,0,random()*6.28);sheet.position.set(p.x-1+random()*1.5,.018,p.z-1-random()*1.4);root.add(sheet);}
  });
  // Rusted service piping and wall-mounted ventilation repeat across the building.
  const pipeMat=new THREE.MeshStandardMaterial({color:0x74694a,roughness:.85,metalness:.32});
  [[40.13,60,16],[47.85,26,16],[54.13,62,12],[12.12,34,12]].forEach(([x,z,len])=>{
    const pipe=new THREE.Mesh(new THREE.CylinderGeometry(.055,.055,len,8),pipeMat);pipe.rotation.x=Math.PI/2;pipe.position.set(x,2.95,z);root.add(pipe);
    for(let zz=z-len/2+.8;zz<z+len/2;zz+=2.7)box(.13,.17,.12,darkMetal,x,2.95,zz);
  });
  [[47.92,62,-Math.PI/2],[40.08,50,Math.PI/2],[55.92,34,-Math.PI/2],[12.08,70,Math.PI/2]].forEach(([x,z,angle])=>{
    const vent=new THREE.Group();vent.position.set(x,2.7,z);vent.rotation.y=angle;root.add(vent);box(.9,.48,.065,metalMat,0,0,0,vent);
    for(let n=0;n<6;n++)box(.79,.026,.025,darkMetal,0,-.18+n*.067,.039,vent);
  });
  const stainMat=new THREE.MeshStandardMaterial({color:0x373c29,roughness:.42,transparent:true,opacity:.3,depthWrite:false});
  [[11,13],[3,15],[16,6],[19,16]].forEach(([x,z])=>{const p=cellCenter(x,z);const stain=new THREE.Mesh(new THREE.CircleGeometry(1.35,24),stainMat);stain.rotation.x=-Math.PI/2;stain.scale.set(1,.6,1);stain.position.set(p.x,.015,p.z);root.add(stain);});

  // Five power fuses, on tangible maintenance cabinets with lighted indicators.
  const fusePositions=[[3,3],[6,12],[3,20],[19,3],[20,12]].slice(0,level.count);
  const fuseLabels=['ARCHIVE','SERVICE','STORAGE','EAST WING','UTILITY'];
  const fuses=[];
  const glassMat=new THREE.MeshStandardMaterial({color:0x86fff0,emissive:0x48c8b6,emissiveIntensity:.8,roughness:.22,metalness:.35});
  const brassMat=new THREE.MeshStandardMaterial({color:0xc4a259,roughness:.38,metalness:.82});
  fusePositions.forEach(([x,z],i)=>{
    const p=cellCenter(x,z);
    box(1.32,.84,.68,cabinetMat,p.x,.42,p.z);
    box(1.16,.055,.73,metalMat,p.x,.86,p.z);
    for(let row=0;row<3;row++){box(1.12,.19,.028,darkMetal,p.x,.17+row*.23,p.z+.352);box(.23,.025,.04,metalMat,p.x,.18+row*.23,p.z+.38);}
    const mesh=new THREE.Group();mesh.name=`POWER_FUSE_${i+1}`;mesh.position.set(p.x,1.07,p.z);root.add(mesh);
    const core=new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,.47,16),glassMat);core.rotation.z=Math.PI/2;mesh.add(core);
    for(const side of [-1,1]){const cap=new THREE.Mesh(new THREE.CylinderGeometry(.13,.13,.12,16),brassMat);cap.rotation.z=Math.PI/2;cap.position.x=side*.26;mesh.add(cap);}
    const strip=new THREE.Mesh(new THREE.BoxGeometry(.34,.035,.035),new THREE.MeshBasicMaterial({color:0xc1fff0}));strip.position.z=.122;mesh.add(strip);
    const indicator=new THREE.Mesh(new THREE.SphereGeometry(.045,8,6),new THREE.MeshBasicMaterial({color:0xbfffee}));indicator.position.set(p.x+.46,.9,p.z+.15);root.add(indicator);
    placard([`${level.item.toUpperCase()} 0${i+1}`,fuseLabels[i]],p.x,.55,p.z+.368,0,1.03,.27,{size:61,color:'#d6d9a9',background:'#222e28',width:768,height:260});
    const halo=new THREE.Mesh(new THREE.PlaneGeometry(1.7,1.7),new THREE.MeshBasicMaterial({map:glowTexture,color:0x64ffcf,transparent:true,opacity:.18,depthWrite:false,blending:THREE.AdditiveBlending}));halo.rotation.x=-Math.PI/2;halo.position.set(0,-1.05,0);mesh.add(halo);
    if(levelIndex>0){
      // Replace collectible fuses with physical level-specific controls and signal tapes.
      while(mesh.children.length)mesh.remove(mesh.children[0]);
      if(level.kind==='industrial'){
        const wheel=new THREE.Mesh(new THREE.TorusGeometry(.29,.042,8,24),new THREE.MeshStandardMaterial({color:0xb44128,metalness:.45,roughness:.7}));wheel.rotation.x=-Math.PI/2;mesh.add(wheel);
        for(let n=0;n<3;n++){const spoke=box(.5,.035,.035,metalMat,0,0,0,mesh);spoke.rotation.y=n*Math.PI/3;}
        box(.09,.22,.09,brassMat,0,-.12,0,mesh);
      }else if(level.kind==='pool'){
        box(.53,.18,.38,darkMetal,0,0,0,mesh);box(.22,.03,.23,new THREE.MeshBasicMaterial({color:0x8affdb}),0,.11,0,mesh);
      }else{
        box(.36,.11,.25,darkMetal,0,0,0,mesh);box(.25,.012,.18,brassMat,0,.061,0,mesh);for(const x of [-.075,.075])box(.045,.015,.045,metalMat,x,.072,0,mesh);
      }
    }
    fuses.push({id:i+1,position:mesh.position.clone(),mesh,label:fuseLabels[i]});
  });

  // Exit is directly behind the starting corridor, visibly unpowered.
  const exitGroup=new THREE.Group();exitGroup.name='EMERGENCY_EXIT';exitGroup.position.set(46,0,87.91);exitGroup.rotation.y=Math.PI;root.add(exitGroup);
  box(2.2,2.88,.12,metalMat,0,1.44,0,exitGroup);
  const doorMat=new THREE.MeshStandardMaterial({color:0x424b3a,roughness:.8,metalness:.27});
  box(1.93,2.68,.075,doorMat,0,1.34,.075,exitGroup);
  box(1.5,.1,.16,brassMat,0,1.16,.15,exitGroup);
  box(.52,.36,.08,darkMetal,.67,1.65,.155,exitGroup);
  const exitIndicators=[];
  for(let i=0;i<5;i++)exitIndicators.push(box(.055,.12,.04,new THREE.MeshBasicMaterial({color:0x9b422a}),.51+i*.08,1.65,.205,exitGroup));
  const exitSign=new THREE.Mesh(new THREE.PlaneGeometry(2,.44),new THREE.MeshStandardMaterial({map:textTexture(['EXIT  ↑'],{color:'#d3edb1',background:'#284932',size:115,width:768,height:190}),emissive:0x56833e,emissiveIntensity:.4,roughness:.8}));exitSign.position.set(0,3.04,.1);exitGroup.add(exitSign);
  const doorNotice=new THREE.Mesh(new THREE.PlaneGeometry(1.22,.6),new THREE.MeshStandardMaterial({map:textTexture(['EXIT LOCKED',`${level.count} ${level.plural.toUpperCase()} REQUIRED`],{color:'#d0ae76',background:'#242a21',size:62}),roughness:.9}));doorNotice.position.set(0,2.1,.12);exitGroup.add(doorNotice);
  const exit={position:new THREE.Vector3(46,1.1,85.7),mesh:exitGroup};
  let currentPower=0;
  const exitGlow=new THREE.PointLight(0xa7df87,0,8,1.8);exitGlow.position.set(46,2.5,85);scene.add(exitGlow);
  function setPower(count){
    exitIndicators.forEach((lamp,i)=>lamp.material.color.setHex(i<count?0xb8ff91:i<level.count?0x9b422a:0x262a22));
    exitGlow.intensity=count===level.count?1.5:0;
    if((count===level.count)!==(currentPower===level.count)){
      doorNotice.material.map.dispose();
      doorNotice.material.map=textTexture(count===level.count?['POWER RESTORED','PRESS E TO ESCAPE']:['EXIT LOCKED',`${level.count} ${level.plural.toUpperCase()} REQUIRED`],{color:count===level.count?'#d6f5a9':'#d0ae76',background:'#242a21',size:62});
      doorNotice.material.needsUpdate=true;
    }
    currentPower=count;
  }

  const details=level.kind==='office'||level.kind==='archive'?addDetails(THREE,root,{edges,grid,cellSize,wallHeight,random,box,metalMat,darkMetal,paperMat,placard}):{obstacles:[],update(){}};
  const dressing=dressLevel(THREE,root,scene,{level,grid,edges,cellSize,wallHeight,random,box,wallMat,floorMat,ceilingMat,hemi,daylight,lights,fluorescentMat,placard});
  const architecture=buildRooms(THREE,root,{index:levelIndex,grid,edges,cellSize,wallHeight,box,placard,random,occupied:details.obstacles});
  const wayfinding=buildWayfinding(THREE,root,{index:levelIndex,grid,edges,cellSize,rooms:architecture.rooms,placard});
  const collisionProps=[...details.obstacles,...architecture.obstacles];
  const armory=buildArmory(THREE,root,{grid,box,placard,spawn,fuses});
  let blackout=0;
  function setBlackout(seconds){blackout=Math.max(blackout,seconds);}
  function isWalkable(x,z,radius=.25){
    if(!Number.isFinite(x)||!Number.isFinite(z))return false;
    const minX=Math.floor((x-radius)/cellSize),maxX=Math.floor((x+radius)/cellSize),minZ=Math.floor((z-radius)/cellSize),maxZ=Math.floor((z+radius)/cellSize);
    for(let gz=minZ;gz<=maxZ;gz++)for(let gx=minX;gx<=maxX;gx++)if(!openCell(gx,gz)){
      const nearX=Math.max(gx*cellSize,Math.min(x,(gx+1)*cellSize)),nearZ=Math.max(gz*cellSize,Math.min(z,(gz+1)*cellSize));
      if((x-nearX)**2+(z-nearZ)**2 < radius*radius+.00001)return false;
    }
    for(const o of collisionProps){const nx=Math.max(o.x-o.hx,Math.min(x,o.x+o.hx)),nz=Math.max(o.z-o.hz,Math.min(z,o.z+o.hz));if((x-nx)**2+(z-nz)**2<radius*radius)return false;}
    return true;
  }
  function findPath(fromPosition,toPosition){
    const start=cellAt(fromPosition.x,fromPosition.z),goal=cellAt(toPosition.x,toPosition.z);
    if(!openCell(start.x,start.z)||!openCell(goal.x,goal.z))return [];
    const key=(x,z)=>z*width+x,startKey=key(start.x,start.z),goalKey=key(goal.x,goal.z);
    const prev=new Int32Array(width*height).fill(-1),todo=[startKey];prev[startKey]=startKey;
    for(let i=0;i<todo.length&&prev[goalKey]===-1;i++){
      const at=todo[i],x=at%width,z=Math.floor(at/width);
      for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1]])if(openCell(x+dx,z+dz)){
        const next=key(x+dx,z+dz);if(prev[next]===-1){prev[next]=at;todo.push(next);}
      }
    }
    if(prev[goalKey]===-1)return [];
    const route=[];for(let at=goalKey;at!==startKey;at=prev[at])route.push(cellCenter(at%width,Math.floor(at/width)));route.reverse();
    route.push(new THREE.Vector3(toPosition.x,0,toPosition.z));return route;
  }
  function lineOfSight(from,to){
    const distance=Math.hypot(to.x-from.x,to.z-from.z),steps=Math.max(1,Math.ceil(distance/.35));
    for(let i=0;i<=steps;i++){const t=i/steps;if(!isWalkable(from.x+(to.x-from.x)*t,from.z+(to.z-from.z)*t,.035))return false;}return true;
  }
  function update(time,dt){
    blackout=Math.max(0,blackout-dt);details.update(time);dressing.update(time);architecture.update(time);hemi.intensity=blackout>0?.002:dressing.baseHemi;daylight.intensity=0;
    lights.forEach(({light,baseIntensity,phase,index})=>{const flutter=.975+Math.sin(time*17+phase)*.02+Math.sin(time*31+phase)*.015;const failing=index===2&&Math.sin(time*2.3+phase)>.973?.38:1;light.intensity=baseIntensity*flutter*failing*(blackout>0?.015:1);});
    fluorescentMat.emissiveIntensity=blackout>0?.005:.2+Math.sin(time*22)*.018;
    fuses.forEach((f,i)=>{if(f.mesh.visible){f.mesh.rotation.y=Math.sin(time*.8+i)*.12;f.mesh.position.y=f.position.y+Math.sin(time*1.8+i)*.035;}});
  }
  const introCameraPosition=new THREE.Vector3(43,1.6,82);
  const introEnemyPosition=new THREE.Vector3(46.15,0,72.5);
  // Batch static box props by material; detailed rooms need dozens, not hundreds, of draw calls.
  root.updateMatrixWorld(true);
  const dynamic=new Set();[...fuses.map(f=>f.mesh),...armory.parts.map(p=>p.mesh),armory.bench.mesh,exitGroup].forEach(g=>g.traverse(o=>dynamic.add(o)));
  const batches=new Map();root.traverse(m=>{
    if(!m.isMesh||m.isInstancedMesh||m.geometry.type!=='BoxGeometry'||Array.isArray(m.material)||dynamic.has(m)||m.children.length)return;
    const list=batches.get(m.material)||[];list.push(m);batches.set(m.material,list);
  });
  for(const [material,meshes] of batches){
    if(meshes.length<3)continue;
    const instance=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),material,meshes.length);instance.name='STATIC_DETAIL_BATCH';instance.receiveShadow=true;instance.castShadow=true;
    meshes.forEach((m,i)=>{const p=m.geometry.parameters,matrix=m.matrixWorld.clone().multiply(new THREE.Matrix4().makeScale(p.width,p.height,p.depth));instance.setMatrixAt(i,matrix);m.parent.remove(m);m.geometry.dispose();});root.add(instance);
  }
  const owned=scene.children.filter(o=>!initialObjects.has(o));
  function dispose(){
    const geometries=new Set(),materials=new Set(),textures=new Set();
    owned.forEach(o=>{scene.remove(o);o.traverse(n=>{if(n.geometry)geometries.add(n.geometry);for(const m of n.material?(Array.isArray(n.material)?n.material:[n.material]):[]){materials.add(m);for(const value of Object.values(m))if(value?.isTexture)textures.add(value);}});if(o.shadow)o.shadow.dispose();});
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());
  }
  return {armory,rooms:architecture.rooms,roomAt:architecture.at,wayfinding,level,levelIndex,targetCount:level.count,supplies:dressing.supplies,dispose,grid,width,height,cellSize,spawn,introYaw:0,introCameraPosition,introEnemyPosition,enemySpawn,fuses,exit,lights,update,setPower,setBlackout,isWalkable,cellAt,cellCenter,findPath,lineOfSight};
}
