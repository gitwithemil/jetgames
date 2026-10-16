export const SCARE_VARIANTS=['glimpse','ambush','blackout','shadow-cross','ceiling-drop','behind-you','door-slam','steam-burst','signal','doubletake','footsteps'];
const geometry={ballerina:{height:2.1,depth:.41,scale:1},bribri:{height:1.83,depth:.8,scale:1},spioniro:{height:1.78,depth:.62,scale:1},bombardino:{height:1.91,depth:1.4,scale:1},sahur:{height:2.4,depth:.55,scale:1},smiler:{height:2.15,depth:.36,scale:1.08},hound:{height:1.25,depth:1.12,scale:1},watcher:{height:2.65,depth:.17,scale:1.2}};
const smooth=v=>{const t=Math.max(0,Math.min(1,v));return t*t*(3-2*t);};
const timing={glimpse:[.18,1.25,.32],ambush:[.12,1.3,.12],blackout:[.48,1.65,.48],'shadow-cross':[.22,1.5,.3],'ceiling-drop':[.32,1.65,.38],'behind-you':[.55,1.7,.65],'door-slam':[.25,1.4,.58],'steam-burst':[.35,1.55,.38],signal:[.18,1.75,.75],doubletake:[.18,2.15,1.12],footsteps:[.25,1.65,.6]};
// A shuffle bag exhausts its repertoire before refill; the last two events cannot repeat.
export function createScareDirector(random=Math.random){
  let bag=[],recent=[],level=-1;
  const eligible=(index,audible=true)=>SCARE_VARIANTS.filter(v=>(v!=='steam-burst'||index===1||index===2)&&(audible||v!=='footsteps'));
  function draw(index,design='',source='room',audible=true){
    if(level!==index){bag=[];level=index;}
    if(!audible)bag=bag.filter(v=>v!=='footsteps');
    if(!bag.length){bag=eligible(index,audible);for(let i=bag.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[bag[i],bag[j]]=[bag[j],bag[i]];}}
    const preferences=source==='objective'?['signal','doubletake','blackout','door-slam']:['boiler','turbine','service'].includes(design)?['steam-burst','ceiling-drop','behind-you']:['server','vault'].includes(design)?['signal','door-slam','doubletake']:['baths','showers','arches'].includes(design)?['shadow-cross','ceiling-drop','behind-you']:['storage','reading','observation'].includes(design)?['footsteps','shadow-cross','doubletake']:[];
    const choices=bag.map((v,i)=>({v,i})).filter(c=>!recent.includes(c.v));
    const selected=choices.find(c=>preferences.includes(c.v))||choices[0]||{v:bag[0],i:0};
    bag.splice(selected.i,1);recent.push(selected.v);recent=recent.slice(-2);return selected.v;
  }
  return {draw,reset(){bag=[];recent=[];level=-1;}};
}
export function scareTimeline(type='sahur',variant='ambush',fatal=false){
  const valid=SCARE_VARIANTS.includes(variant)?variant:'ambush',t=timing[valid];
  return {type,variant:fatal?'attack':valid,lead:fatal?.1:t[0],duration:fatal?1.45:t[1],impact:fatal?.1:t[2]};
}
export function scarePose(event,time,motion=true){
  const spec=geometry[event.type]||geometry.sahur,impact=event.impact??event.lead,side=event.side||1,v=event.variant;
  const strike=smooth((time-impact)/.22),fade=smooth((time-(event.duration-.3))/.3),scale=spec.scale,nearest=spec.depth*scale+.55;
  let visible=time>=event.lead&&time<event.duration-.08,x=side*(1-strike)*1.35,distance=3.4+(spec.depth-1)*.5-strike*(3.4+(spec.depth-1)*.5-nearest),y=-spec.height*scale;
  let roll=motion?Math.sin(time*22)*.025:0,yaw=0,overlay=(.18+strike*.65)*(1-fade),shutter=0,light=7*(1-fade*.7),effect='',effectProgress=0,staticAmount=0,caption=event.fatal?'SIGNAL LOST':'DID YOU SEE THAT?';
  if(v==='glimpse'){distance=4-strike*1.1;x=side*((1-strike)*.9+smooth((time-.72)/.3)*2.5);yaw=-side*.1;overlay=.25*(1-fade);caption='RECORDING ANOMALY';}
  if(v==='blackout'){shutter=time<event.lead?.92:Math.max(0,.92-(time-event.lead)*10);}
  if(v==='shadow-cross'){const travel=smooth((time-event.lead)/.6);x=side*(3.4-travel*6.8);distance=4.8;y=-spec.height*scale*.55;visible=visible&&time<event.lead+.75;y+=Math.sin(travel*Math.PI)*.12;overlay=.13*(1-fade);light=.7;caption='SOMETHING CROSSED';}
  if(v==='ceiling-drop'){roll=Math.PI;y=spec.height*scale+1.8*(1-strike);x=side*.14;distance=nearest+.65+(1-strike)*1.4;caption='ABOVE YOU';}
  if(v==='behind-you'){x=side*(1.7-strike*1.05);distance=nearest+.2;visible=visible&&time<event.duration-.35;light=3.5;caption='DON’T TURN AROUND';}
  if(v==='door-slam'||v==='steam-burst'){visible=false;effect=v;effectProgress=smooth((time-event.lead)/.4);overlay=.18*(1-fade);light=6;caption=v==='door-slam'?'NOBODY TOUCHED THE DOOR':'PRESSURE SURGE';}
  if(v==='signal'){distance=2.5;x=0;visible=time>=.72&&time<1.13;staticAmount=(1-fade)*.8;overlay=.45*(1-fade);light=2.5;caption='SIGNAL CORRUPTED';}
  if(v==='doubletake'){const first=time>=event.lead&&time<.55,second=time>=impact;visible=(first||second)&&time<event.duration-.12;distance=first?5:nearest+.3*(1-strike);x=first?-side*.7:side*(1-strike)*.65;shutter=time>=.58&&time<.9?.6:0;caption=first?'':second?'IT CAME BACK':'';overlay=.16+(second?.4:0);}
  if(v==='footsteps'){visible=false;overlay=.08*(1-fade);light=0;caption=time>.75?'THE FOOTSTEPS STOPPED':'';}
  if(event.type==='hound'&&!['ceiling-drop','shadow-cross'].includes(v))y+=Math.sin(strike*Math.PI)*.45;
  const noZoom=['glimpse','shadow-cross','footsteps','door-slam','steam-burst','signal'].includes(v);
  const shake=motion&&!noZoom?Math.sin(time*37)*.018*(1-strike*.4)*(1-fade):0;
  return {visible,x:x+shake,y,z:-Math.max(nearest,distance),scale,roll,yaw,light:visible||effect?light:0,
    fov:motion&&!noZoom?72+Math.sin(strike*Math.PI)*11:72,shutter,overlay,strike,fade,impact,done:time>=event.duration,
    effect,effectProgress,staticAmount,stage:time<event.lead?'dread':strike<1?'impact':fade>0?'recover':'hold',caption};
}
// Temporary props are reused and hidden at the end; they never alter map collision.
export function createScareEffects(T,camera){
  const root=new T.Group();root.name='TEMPORARY_SCARE_EFFECTS';camera.add(root);root.visible=false;
  const door=new T.Group();door.position.set(-1.05,-1.55,-2.25);root.add(door);
  const metal=new T.MeshStandardMaterial({color:0x736647,roughness:.85,metalness:.15});
  const panel=new T.Mesh(new T.BoxGeometry(2.1,3.1,.07),metal);panel.position.set(1.05,1.55,0);door.add(panel);
  const handle=new T.Mesh(new T.BoxGeometry(.12,.06,.17),new T.MeshStandardMaterial({color:0xa99b6b,metalness:.8,roughness:.4}));handle.position.set(1.82,1.45,.12);door.add(handle);
  const cv=document.createElement('canvas');cv.width=cv.height=128;const c=cv.getContext('2d'),g=c.createRadialGradient(64,64,2,64,64,64);g.addColorStop(0,'rgba(203,223,213,.65)');g.addColorStop(.55,'rgba(171,193,183,.23)');g.addColorStop(1,'rgba(171,193,183,0)');c.fillStyle=g;c.fillRect(0,0,128,128);
  const mistMat=new T.MeshBasicMaterial({map:new T.CanvasTexture(cv),transparent:true,depthWrite:false,opacity:.8,side:T.DoubleSide});
  const mist=new T.InstancedMesh(new T.PlaneGeometry(1,1),mistMat,22);root.add(mist);const dummy=new T.Object3D();
  return {hide(){root.visible=false;},update(p,event){root.visible=!!p.effect;door.visible=p.effect==='door-slam';mist.visible=p.effect==='steam-burst';door.rotation.y=-(1-p.effectProgress)*1.45;metal.color.setHex(event.type==='hound'?0x65756c:0x736647);mistMat.opacity=(1-p.fade)*.8;for(let i=0;i<22;i++){const a=i*2.399,spread=.15+p.effectProgress*1.6;dummy.position.set(Math.cos(a)*spread*(.4+(i%4)*.14),Math.sin(a)*spread-.3,-.6-(i%5)*.23);dummy.rotation.set(0,0,a);dummy.scale.setScalar(.3+p.effectProgress*(.6+(i%3)*.15));dummy.updateMatrix();mist.setMatrixAt(i,dummy.matrix);}mist.instanceMatrix.needsUpdate=true;}};
}
