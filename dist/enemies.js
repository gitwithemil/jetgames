import {createGait,pivot} from './enemy-motion.js';
import { BRAINROTS, createBrainrot } from './brainrots.js';
import { createSahur } from './sahur.js';
export function createEnemy(T,type){
  if(BRAINROTS.includes(type))return createBrainrot(T,type);
  if(type==='sahur'){const e=createSahur(T);return {...e,type,name:'Tung Tung Tung Sahur',faceHeight:2.4};}
  const group=new T.Group();group.name=type;const rig=new T.Group();group.add(rig);
  const flesh=new T.MeshStandardMaterial({color:type==='watcher'?0x858981:0x272426,roughness:.94});
  const voidMat=new T.MeshStandardMaterial({color:0x08080b,roughness:1});
  const glow=new T.MeshBasicMaterial({color:type==='smiler'?0xeefff1:0xffbd92});
  const bone=new T.MeshStandardMaterial({color:0xc4bba1,roughness:.7});
  function m(geo,mat,x,y,z,sx=1,sy=1,sz=1){const mesh=new T.Mesh(geo,mat);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);rig.add(mesh);return mesh;}
  const sphere=(mat,x,y,z,sx,sy,sz)=>m(new T.SphereGeometry(1,16,12),mat,x,y,z,sx,sy,sz);
  const limb=(a,b,r,mat=flesh)=>{const v=new T.Vector3(...b).sub(new T.Vector3(...a)),mesh=m(new T.CylinderGeometry(r*.7,r,v.length(),8),mat,...new T.Vector3(...a).add(new T.Vector3(...b)).multiplyScalar(.5).toArray());mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.normalize());return mesh;};
  let legs=[];
  if(type==='smiler'){
    sphere(voidMat,0,2.1,0,.52,.58,.32);
    for(const x of [-.22,.22]){sphere(glow,x,2.29,.31,.115,.05,.025);sphere(voidMat,x,2.29,.338,.035,.038,.014);}
    const smile=new T.Mesh(new T.TorusGeometry(.29,.035,6,32,Math.PI),glow);smile.position.set(0,2.13,.335);smile.rotation.z=Math.PI;rig.add(smile);
    for(let i=0;i<11;i++){const a=Math.PI+i/10*Math.PI;m(new T.BoxGeometry(.037,.07,.018),glow,Math.cos(a)*.285,2.13+Math.sin(a)*.285,.34);}
    for(const sign of [-1,1]){limb([sign*.38,1.95,0],[sign*.7,.7,-.12],.06,voidMat);limb([sign*.7,.7,-.12],[sign*.8,.12,.1],.03,voidMat);}
  }else if(type==='hound'){
    sphere(flesh,0,.92,0,.32,.32,.67);sphere(flesh,0,1.25,.6,.32,.3,.34);sphere(voidMat,0,1.16,.92,.24,.14,.16);
    for(let i=0;i<9;i++){const tooth=m(new T.ConeGeometry(.023,.12,6),bone,(i-4)*.052,1.18,1.065);tooth.rotation.z=Math.PI;}
    for(const sign of [-1,1])for(const z of [-.45,.4]){const upper=limb([sign*.25,.95,z],[sign*.5,.4,z+.15],.055);const lower=limb([sign*.5,.4,z+.15],[sign*.46,.05,z+.45],.035);const foot=sphere(voidMat,sign*.46,.06,z+.45,.1,.06,.18);const hip=pivot(T,rig,[sign*.25,.95,z],[upper,lower,foot],`HOUND_HIP_${sign}_${z}`),knee=pivot(T,hip,[sign*.25,-.55,.15],[lower,foot],'HOUND_KNEE');legs.push({hip,knee,phase:sign*(z>0?1:-1)});}
    for(let i=0;i<8;i++)sphere(bone,0,1.24,-.5+i*.11,.045,.065,.045);
    for(const sign of [-1,1])limb([sign*.2,1.43,.48],[sign*.25,1.77,.29],.065);
  }else{
    sphere(flesh,0,1.73,0,.24,.69,.18);sphere(flesh,0,2.65,0,.19,.27,.15);
    for(const x of [-.065,.065])sphere(glow,x,2.68,.145,.032,.04,.01);
    sphere(voidMat,0,2.51,.146,.052,.08,.012);
    for(const sign of [-1,1]){limb([sign*.22,2.14,0],[sign*.45,1.2,.07],.045);limb([sign*.45,1.2,.07],[sign*.49,.51,.1],.028);for(let i=0;i<3;i++)limb([sign*.49+(i-1)*.027,.52,.1],[sign*.5+(i-1)*.04,.31,.16],.009);const leg=limb([sign*.15,1.2,0],[sign*.2,.05,.04],.05);const hip=pivot(T,rig,[sign*.15,1.2,0],[leg],`WATCHER_HIP_${sign}`);legs.push({hip,phase:sign});}
  }
  const gait=createGait();
  return {group,type,name:{smiler:'The Smiler',hound:'The Hound',watcher:'The Watcher'}[type],faceHeight:type==='hound'?1.25:type==='smiler'?2.15:2.65,animate(time,speed=0,angry=false){const {phase,weight,step,lift}=gait(time,speed);rig.position.y=type==='smiler'?Math.sin(time*1.6)*.08:type==='hound'?lift*.055:lift*.018;for(const l of legs){const swing=Math.sin(phase+(l.phase<0?Math.PI:0));l.hip.rotation.x=swing*(type==='hound'?.45:.3)*weight;if(l.knee)l.knee.rotation.x=Math.max(0,-swing)*.65*weight;}rig.rotation.z=type==='smiler'?Math.sin(time*.8)*.055:step*(type==='hound'?.025:.035);rig.rotation.x=type==='hound'&&angry?-.05*weight:0;}};
}
// Enemy senses are separate from steering, so each encounter rewards a different response.
export function senseEnemy(type,{distance,los,moving,sprinting,crouching,flashlight,observed,working,difficulty=1,vision=los,illuminated=flashlight&&observed,signature=1}){
  const result=(visual,sound,proximity,speed,frozen=false,light=false)=>({detect:!!(visual||sound||proximity),visual:!!visual,cause:visual?(light?'light':'sight'):proximity?'proximity':sound?'sound':null,frozen:!!frozen,speed});
  if(type==='ballerina')return result(vision&&distance<22,moving&&!crouching&&distance<12,false,illuminated?1.65:3.4);
  // Brri's burst is now an encounter-relative telegraph/charge/recovery cycle.
  if(type==='bribri')return result(vision&&distance<24,(working||sprinting)&&distance<(working?23:26),!working&&!sprinting&&distance<4,2.1);
  if(type==='spioniro')return result(vision&&distance<(flashlight?Math.min(30,24*signature):10),sprinting&&distance<18,false,2.55,false,flashlight&&distance>=10);
  if(type==='bombardino')return result(vision&&distance<30,working&&distance<22,false,2.4);
  if(type==='watcher')return result(vision&&distance<28,false,false,3.15,los&&observed&&illuminated);
  if(type==='smiler')return result(vision&&distance<(flashlight?Math.min(32,24*signature):4),false,false,flashlight?3.45:1.8,false,flashlight&&distance>=4);
  if(type==='hound')return result(false,(working||sprinting||(moving&&!crouching))&&distance<(working?24:sprinting?34:12)*difficulty,distance<1.4*difficulty,3.6);
  return result(vision&&distance<26,(sprinting||(!crouching&&moving))&&distance<(sprinting?27:8)*difficulty,distance<(crouching?2.5:1.5)*difficulty,2.65);
}
