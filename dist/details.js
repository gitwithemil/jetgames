// Seeded environmental dressing. Large props sit against walls and use collision.
export function addDetails(T, root, {edges,grid,cellSize,wallHeight,random,box,metalMat,darkMetal,paperMat,placard}) {
  const obstacles=[], animated=[];
  const wood=new T.MeshStandardMaterial({color:0x635139,roughness:.96});
  const fabric=new T.MeshStandardMaterial({color:0x454c3c,roughness:1});
  const enamel=new T.MeshStandardMaterial({color:0xaaa887,roughness:.8,metalness:.15});
  const black=new T.MeshStandardMaterial({color:0x0b1410,roughness:.5});
  const screen=new T.MeshBasicMaterial({color:0x376951});
  const wallEdges=edges.filter(e=>Math.floor(e.x/cellSize)!==10&&Math.floor(e.x/cellSize)!==11);
  const local=(g,w,h,d,mat,x,y,z)=>box(w,h,d,mat,x,y,z,g);
  const mount=e=>{const g=new T.Group();g.position.set(e.x+e.dx*.05,0,e.z+e.dz*.05);g.rotation.y=Math.atan2(e.dx,e.dz);root.add(g);return g;};
  const collider=(g,w,d)=>{const p=new T.Vector3(0,0,d/2+.08);g.localToWorld(p);obstacles.push({x:p.x,z:p.z,hx:Math.abs(Math.cos(g.rotation.y))*w/2+Math.abs(Math.sin(g.rotation.y))*d/2,hz:Math.abs(Math.sin(g.rotation.y))*w/2+Math.abs(Math.cos(g.rotation.y))*d/2});};
  let furnishings=0;
  wallEdges.forEach((e,i)=>{
    if(i%19===4 && furnishings<28){
      const g=mount(e);const type=furnishings++%4;
      if(type===0){ // abandoned workstation: desk, CRT, keyboard, chair
        local(g,1.65,.08,.72,wood,0,.78,.47);
        for(const x of [-.7,.7])for(const z of [.2,.73])local(g,.06,.74,.06,metalMat,x,.37,z);
        local(g,.48,.38,.36,enamel,-.3,1.04,.37);local(g,.38,.26,.02,black,-.3,1.04,.558);
        local(g,.33,.21,.025,screen,-.3,1.04,.572);local(g,.52,.035,.18,enamel,-.2,.84,.71);
        for(let n=0;n<12;n++)local(g,.026,.007,.12,darkMetal,-.42+n*.038,.864,.71);
        local(g,.16,.23,.14,metalMat,.52,.94,.42);
        local(g,.44,.09,.4,fabric,.3,.45,1);local(g,.44,.4,.07,fabric,.3,.68,1.16);
        local(g,.07,.4,.07,metalMat,.3,.2,1);local(g,.57,.05,.06,darkMetal,.3,.05,1);
        collider(g,1.7,1.4);
      }else if(type===1){
        local(g,.7,1.65,.48,metalMat,0,.825,.28);
        for(let row=0;row<5;row++){local(g,.64,.28,.03,enamel,0,.18+row*.31,.54);local(g,.2,.025,.045,darkMetal,0,.2+row*.31,.575);}
        local(g,.72,.09,.5,wood,0,1.74,.28);collider(g,.75,.6);
      }else if(type===2){
        for(const x of [-.68,.68])local(g,.055,2.45,.055,metalMat,x,1.225,.2);
        for(let j=0;j<4;j++){local(g,1.45,.05,.58,metalMat,0,.23+j*.63,.36);for(let n=0;n<3;n++)local(g,.32,.4,.36,wood,-.45+n*.43,.45+j*.63,.35);}
        collider(g,1.5,.7);
      }else{
        local(g,.68,1.1,.46,enamel,0,.55,.3);local(g,.42,.1,.2,black,0,.88,.55);
        const bottle=new T.Mesh(new T.CylinderGeometry(.21,.21,.48,16),new T.MeshStandardMaterial({color:0x607f83,transparent:true,opacity:.7,roughness:.35}));bottle.position.set(0,1.37,.3);g.add(bottle);
        collider(g,.75,.6);
      }
    }
    if(i%11===0){
      const g=mount(e);local(g,.28,.42,.06,darkMetal,0,1.6,.01);
      local(g,.17,.27,.015,enamel,0,1.6,.05);local(g,.025,.09,.03,black,.04,1.6,.068);
    }
    if(i%23===7){const g=mount(e);local(g,.36,.65,.1,metalMat,0,1.4,.02);local(g,.27,.54,.02,darkMetal,0,1.4,.082);for(let n=0;n<4;n++)local(g,.16,.03,.025,enamel,0,1.2+n*.12,.099);}
  });
  // Transparent shared damage atlas: plaster losses, branching cracks and damp runs.
  const cv=document.createElement('canvas');cv.width=512;cv.height=512;const c=cv.getContext('2d');
  for(let n=0;n<18;n++){const x=random()*512,y=random()*512,r=20+random()*55;c.fillStyle='rgba(46,43,25,.24)';c.beginPath();for(let k=0;k<12;k++){const a=k/12*Math.PI*2,rr=r*(.5+random()*.5);c.lineTo(x+Math.cos(a)*rr,y+Math.sin(a)*rr);}c.closePath();c.fill();}
  for(let n=0;n<12;n++){let x=random()*512,y=random()*180;c.strokeStyle='rgba(34,30,19,.55)';c.lineWidth=1+random()*2;c.beginPath();c.moveTo(x,y);for(let k=0;k<6;k++){x+=(random()-.5)*40;y+=random()*50;c.lineTo(x,y);}c.stroke();}
  for(let n=0;n<30;n++){const x=random()*512;c.fillStyle='rgba(41,48,24,.14)';c.fillRect(x,300+random()*100,2+random()*7,200);}
  const texture=new T.CanvasTexture(cv);texture.colorSpace=T.SRGBColorSpace;
  const damage=new T.MeshStandardMaterial({map:texture,transparent:true,depthWrite:false,roughness:1,polygonOffset:true,polygonOffsetFactor:-1});
  const decals=wallEdges.filter((e,i)=>i%3===0),dummy=new T.Object3D();
  const patches=new T.InstancedMesh(new T.PlaneGeometry(3.4,2.9),damage,decals.length);
  decals.forEach((e,i)=>{dummy.position.set(e.x+e.dx*.025,1.7,e.z+e.dz*.025);dummy.rotation.set(0,Math.atan2(e.dx,e.dz),0);dummy.updateMatrix();patches.setMatrixAt(i,dummy.matrix);});root.add(patches);
  // Sagging electrical wiring, leaking ceiling tiles and scattered records.
  for(let z=2;z<21;z+=3){const cable=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3([new T.Vector3(40.1,3.29,z*4),new T.Vector3(44,2.93,z*4+.4),new T.Vector3(47.9,3.29,z*4)]),12,.018,5,false),black);root.add(cable);}
  const litter=[];
  for(let z=1;z<22;z++)for(let x=1;x<22;x++)if(!grid[z][x]&&(x*7+z)%13===0)for(let n=0;n<3;n++)litter.push({x:(x+.2+random()*.6)*4,z:(z+.2+random()*.6)*4,a:random()*6.28});
  const papers=new T.InstancedMesh(new T.PlaneGeometry(.23,.32),paperMat,litter.length);
  litter.forEach((p,i)=>{dummy.position.set(p.x,.023,p.z);dummy.rotation.set(-Math.PI/2,0,p.a);dummy.updateMatrix();papers.setMatrixAt(i,dummy.matrix);});root.add(papers);
  const dustPositions=[];for(let n=0;n<520;n++){const x=1+Math.floor(random()*21),z=1+Math.floor(random()*21);if(!grid[z][x])dustPositions.push((x+random())*4,.3+random()*2.8,(z+random())*4);}
  const dustGeo=new T.BufferGeometry();dustGeo.setAttribute('position',new T.Float32BufferAttribute(dustPositions,3));
  const dust=new T.Points(dustGeo,new T.PointsMaterial({color:0xe1d7ae,size:.018,transparent:true,opacity:.35,depthWrite:false}));root.add(dust);
  [['RECORDS / 1989','ALL STAFF MISSING'],['SERVICE WING','DO NOT ANSWER'],['NO WINDOWS','NO SIGNAL'],['ARCHIVE B','TIME: 03:33']].forEach((lines,i)=>{const e=wallEdges[15+i*29];if(e)placard(lines,e.x+e.dx*.04,2.35,e.z+e.dz*.04,Math.atan2(e.dx,e.dz),1.5,.58,{size:55});});
  return {obstacles,update(time){dust.position.y=Math.sin(time*.12)*.12;}};
}
