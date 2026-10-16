export const STUN={duration:8,range:12,charges:3,cooldown:4,partWork:2.8,assemblyWork:4};
export function buildArmory(T,root,{grid,box,placard,spawn,fuses}){
  const dark=new T.MeshStandardMaterial({color:0x293a37,roughness:.8,metalness:.4}),metal=new T.MeshStandardMaterial({color:0x7c9389,roughness:.5,metalness:.7}),amber=new T.MeshBasicMaterial({color:0xb49853});
  const distance=new Map(),queue=[[11,20,0]];distance.set('11,20',0);
  for(let i=0;i<queue.length;i++){const [x,z,d]=queue[i];for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,nz=z+dz,key=`${nx},${nz}`;if(nx>0&&nx<22&&nz>0&&nz<22&&!grid[nz][nx]&&!distance.has(key)){distance.set(key,d+1);queue.push([nx,nz,d+1]);}}}
  const regions=[[1,1,8,8],[14,1,21,8],[14,15,21,21]],labels=['RESONANCE COIL','CAPACITOR CELL','FOCUS LENS'];
  const parts=regions.map((bounds,i)=>{
    const candidates=[];for(let z=bounds[1];z<=bounds[3];z++)for(let x=bounds[0];x<=bounds[2];x++)if(!grid[z][x]&&distance.has(`${x},${z}`)&&!fuses.some(f=>Math.hypot(f.position.x-(x*4+2),f.position.z-(z*4+2))<5))candidates.push({x,z,d:distance.get(`${x},${z}`)});
    candidates.sort((a,b)=>b.d-a.d);const c=candidates[0];if(!c)throw new Error('Armory region is unreachable');
    const position=new T.Vector3(c.x*4+2,1.05,c.z*4+2),mesh=new T.Group();mesh.name='ARMORY_COMPONENT_'+i;mesh.position.copy(position);root.add(mesh);
    box(.58,.22,.4,dark,0,0,0,mesh);box(.44,.05,.28,metal,0,.14,0,mesh);box(.045,.03,.035,amber,.19,.181,.1,mesh);
    if(i===0){const coil=new T.Mesh(new T.TorusGeometry(.12,.033,8,20),metal);coil.rotation.x=Math.PI/2;coil.position.y=.21;mesh.add(coil);}else if(i===1)box(.22,.13,.12,metal,0,.22,0,mesh);else{const lens=new T.Mesh(new T.CylinderGeometry(.11,.11,.07,16),new T.MeshStandardMaterial({color:0x7cbeb8,roughness:.25,metalness:.5}));lens.position.y=.22;mesh.add(lens);}
    box(.74,.85,.6,dark,position.x,.425,position.z);
    placard(['LOCKED RESEARCH CASE',labels[i]],position.x,.52,position.z+.311,0,.66,.32,{size:40,color:'#bdad79',background:'#23302b'});
    return {id:'part'+i,kind:'weaponpart',hold:STUN.partWork,label:labels[i],position,mesh};
  });
  const position=new T.Vector3(43,1,82),mesh=new T.Group();mesh.name='STUN_ASSEMBLY_BENCH';mesh.position.copy(position);root.add(mesh);
  box(1.2,.12,.6,metal,0,0,0,mesh);for(const x of [-.5,.5])box(.06,1,.5,dark,x,-.5,0,mesh);box(.45,.28,.38,dark,0,.2,0,mesh);box(.25,.02,.23,amber,0,.352,0,mesh);
  placard(['STUN PROJECTOR','3 PARTS / ASSEMBLE HERE'],position.x,.78,position.z+.31,0,1.1,.26,{size:45,color:'#bad0bd',background:'#253c34'});
  const bench={id:'stunbench',kind:'workbench',hold:STUN.assemblyWork,label:'STUN PROJECTOR',position,mesh};
  return {parts,bench};
}
export function createStunView(T,camera){
  const group=new T.Group();group.name='HELD_STUN_PROJECTOR';group.position.set(-.33,-.32,-.58);camera.add(group);group.visible=false;
  const metal=new T.MeshStandardMaterial({color:0x344b45,metalness:.75,roughness:.45}),brass=new T.MeshStandardMaterial({color:0x9d8c55,metalness:.7,roughness:.5}),blue=new T.MeshBasicMaterial({color:0x75d7c6});
  const add=(geo,mat,x,y,z)=>{const m=new T.Mesh(geo,mat);m.position.set(x,y,z);group.add(m);return m;};
  add(new T.BoxGeometry(.14,.14,.26),metal,0,0,0);add(new T.BoxGeometry(.07,.18,.09),metal,0,-.1,.07);
  for(const x of [-.045,.045]){const tube=add(new T.CylinderGeometry(.014,.014,.18,10),brass,x,0,-.2);tube.rotation.x=Math.PI/2;add(new T.SphereGeometry(.02,8,6),blue,x,0,-.29);}
  for(let n=0;n<4;n++){const ring=add(new T.TorusGeometry(.071,.007,6,16),brass,0,0,-.09+n*.045);}
  const flash=new T.PointLight(0x7affdf,0,3,2);flash.position.set(-.3,-.25,-.85);camera.add(flash);
  const beam=new T.Mesh(new T.CylinderGeometry(.008,.012,1,8),blue);beam.name='STUN_DISCHARGE';beam.visible=false;camera.add(beam);
  let shotTime=-100;
  return {group,fire(time,distance){shotTime=time;const d=Math.max(.5,Math.min(12,distance));beam.scale.y=d;beam.position.set(-.12,-.05,-d/2);beam.rotation.x=Math.PI/2;},update(time,visible){group.visible=visible;const t=time-shotTime;flash.intensity=t<.12?2.5*(1-t/.12):0;beam.visible=visible&&t>=0&&t<.1;group.position.z=-.58+(t>=0&&t<.25?Math.sin(t/.25*Math.PI)*.045:0);},hide(){group.visible=false;beam.visible=false;flash.intensity=0;shotTime=-100;}};
}
export function selectStunTarget(T,actors,camera,world){
  camera.updateMatrixWorld(true);const origin=new T.Vector3(),dir=new T.Vector3();camera.getWorldPosition(origin);camera.getWorldDirection(dir);
  const ray=new T.Raycaster(origin,dir,.06,STUN.range);let closest=null;
  for(const a of actors){a.model.group.updateMatrixWorld(true);if(!world.lineOfSight(origin,a.model.group.position))continue;const hit=ray.intersectObject(a.model.group,true).find(h=>{for(let o=h.object;o;o=o.parent)if(!o.visible)return false;return true;});if(hit&&(!closest||hit.distance<closest.distance))closest={actor:a,distance:hit.distance};}
  return closest;
}
export function createStunAura(T,model){
  const aura=new T.Group();aura.name='STUN_AURA';aura.visible=false;model.group.add(aura);
  const material=new T.MeshBasicMaterial({color:0x66ab9d,transparent:true,opacity:.65,depthWrite:false});
  for(let n=0;n<3;n++){const ring=new T.Mesh(new T.TorusGeometry(.4,.012,6,24),material);ring.rotation.x=Math.PI/2;ring.rotation.z=n*.25;ring.position.y=(model.aimHeight||1.2)-.15+n*.17;aura.add(ring);}
  return aura;
}
