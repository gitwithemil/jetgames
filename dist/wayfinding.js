import { routePlan } from './rooms.js';

// Painted navigation uses the same walkable grid as the actors. Nothing here
// emits light: the names and arrows appear only when caught by the flashlight.
export function buildWayfinding(T,root,{index,grid,edges,cellSize,rooms,placard}){
  const open=(x,z)=>grid[z]?.[x]===0;
  const nearest=([x,z])=>{
    for(let r=0;r<4;r++)for(let dz=-r;dz<=r;dz++)for(let dx=-r;dx<=r;dx++)if(Math.abs(dx)+Math.abs(dz)===r&&open(x+dx,z+dz))return [x+dx,z+dz];
    return null;
  };
  const firstStep=(from,to)=>{
    const queue=[from],seen=new Set([from.join(',')]);
    for(let i=0;i<queue.length;i++){
      const [x,z,first]=queue[i];if(x===to[0]&&z===to[1])return first||[0,-1];
      for(const [dx,dz]of [[0,-1],[1,0],[0,1],[-1,0]]){
        const nx=x+dx,nz=z+dz,key=`${nx},${nz}`;
        if(open(nx,nz)&&!seen.has(key)){seen.add(key);queue.push([nx,nz,first||[dx,dz]]);}
      }
    }
    return null;
  };
  const signs=new Map(),add=(cell,destinations)=>{
    const p=nearest(cell);if(!p)return;const key=p.join(','),sign=signs.get(key)||{cell:p,destinations:[]};
    for(const destination of destinations)if(!sign.destinations.some(d=>d.code===destination.code))sign.destinations.push(destination);
    signs.set(key,sign);
  };
  const target=i=>({code:rooms[i].code,name:rooms[i].shortName,cell:[rooms[i].anchor.x,rooms[i].anchor.z]});
  const exit={code:'EXIT',name:'RETURN / EXIT',cell:[11,21]};
  for(const route of routePlan(index)){
    const mouths=[route.cells[0],route.cells.at(-1)],spine=mouths.reduce((a,b)=>Math.abs(a[0]-10.5)<Math.abs(b[0]-10.5)?a:b),wing=mouths.find(p=>p!==spine);
    add(spine,[target(route.room)]);add(wing,[exit]);
    // A non-directional room plate identifies each new passage at its mouth.
    const point={x:(spine[0]+.5)*cellSize,z:(spine[1]+.5)*cellSize};
    const wall=edges.filter(e=>Math.hypot(e.x-point.x,e.z-point.z)<5.8).sort((a,b)=>Math.hypot(a.x-point.x,a.z-point.z)-Math.hypot(b.x-point.x,b.z-point.z))[0];
    if(wall)placard([`${rooms[route.room].code} / ${rooms[route.room].shortName.toUpperCase()}`,'SERVICE BYPASS'],wall.x+wall.dx*.085,1.65,wall.z+wall.dz*.085,Math.atan2(wall.dx,wall.dz),2.7,.64,{size:53,color:'#c6b88f',background:'#222d28',width:768,height:256});
  }
  add([11,5],[target(0),target(3)]);add([11,10],[target(1),target(4)]);add([11,16],[target(2),target(5)]);add([11,20],[target(6),exit]);
  const markers=[];
  for(const sign of signs.values()){
    const directions=sign.destinations.slice(0,2).map(d=>({...d,step:firstStep(sign.cell,d.cell)})).filter(d=>d.step);
    if(!directions.length)continue;
    const canvas=document.createElement('canvas');canvas.width=768;canvas.height=directions.length*190;
    const ctx=canvas.getContext('2d');ctx.fillStyle=index===1?'#263b3a':'#282c25';ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.strokeStyle='#8c8565';ctx.lineWidth=9;ctx.strokeRect(6,6,756,canvas.height-12);
    directions.forEach((d,i)=>{
      const y=95+i*190;ctx.fillStyle=d.code==='EXIT'?'#b0b994':'#bdb28e';
      ctx.save();ctx.translate(92,y);ctx.rotate(Math.atan2(d.step[0],-d.step[1]));ctx.beginPath();ctx.moveTo(0,-55);ctx.lineTo(43,-8);ctx.lineTo(17,-8);ctx.lineTo(17,52);ctx.lineTo(-17,52);ctx.lineTo(-17,-8);ctx.lineTo(-43,-8);ctx.closePath();ctx.fill();ctx.restore();
      ctx.font='700 39px monospace';ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillText(d.code==='EXIT'?'RETURN TO':`SECTOR ${d.code}`,168,y-28);
      ctx.font='700 49px monospace';ctx.fillText(d.code==='EXIT'?'EXIT':d.name.toUpperCase(),168,y+30,570);
      if(i){ctx.strokeStyle='#635f4c';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(26,190*i);ctx.lineTo(742,190*i);ctx.stroke();}
    });
    const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
    const material=new T.MeshStandardMaterial({map:texture,roughness:1,polygonOffset:true,polygonOffsetFactor:-2});
    const mesh=new T.Mesh(new T.PlaneGeometry(3.1,directions.length*.78),material);mesh.name='PAINTED_JUNCTION_SIGN';mesh.rotation.x=-Math.PI/2;
    mesh.position.set((sign.cell[0]+.5)*cellSize,index===1?.079:.046,(sign.cell[1]+.5)*cellSize);root.add(mesh);
    markers.push({cell:sign.cell,destinations:directions});
  }
  return {markers,routes:routePlan(index)};
}
