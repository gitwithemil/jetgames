export const BEAM_MODES=['focus','flood','boost'];
export const BEAMS={
 focus:{label:'FOCUS',intensity:62,range:24,angle:.35,penumbra:.65,drain:.22,signature:1},
 flood:{label:'FLOOD',intensity:32,range:14,angle:.62,penumbra:.75,drain:.1,signature:.65},
 boost:{label:'BOOST',intensity:98,range:30,angle:.25,penumbra:.6,drain:.66,signature:1.4}
};
export function stepTorch(state,dt,{on=true,crank=false,stamina=100}={}){
 const next={...state},time=Math.max(0,Math.min(.1,dt));if(!crank)next.crankDone=false;next.cranking=crank&&!next.crankDone&&next.battery<25&&stamina>5;
 if(next.cranking){next.battery=Math.min(25,next.battery+time*2.5);next.heat=Math.max(0,next.heat-time*15);}
 else if(on&&next.battery>0){next.battery=Math.max(0,next.battery-BEAMS[next.mode].drain*time);next.heat=Math.max(0,Math.min(100,next.heat+(next.mode==='boost'?10:-9)*time));}
 else next.heat=Math.max(0,next.heat-time*16);
 if(crank&&next.battery>=25)next.crankDone=true;
 next.overheated=false;
 if(next.mode==='boost'&&next.heat>=100){next.mode='focus';next.locked=true;next.overheated=true;}
 if(next.heat<=30)next.locked=false;
 return next;
}
export function beamStrength({origin,direction,target,on,range,angle,power=1,blocked=false}){
 if(!on||blocked)return 0;const dx=target.x-origin.x,dy=target.y-origin.y,dz=target.z-origin.z,d=Math.hypot(dx,dy,dz);
 if(d<.01||d>=range)return 0;const cosine=(dx*direction.x+dy*direction.y+dz*direction.z)/d,edge=Math.cos(angle);
 if(cosine<=edge)return 0;const angular=Math.min(1,(cosine-edge)/(1-edge)*2),falloff=Math.pow(1-Math.pow(d/range,4),2);return angular*falloff*power;
}
export function createBeamCookie(T){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const c=canvas.getContext('2d'),g=c.createRadialGradient(128,128,0,128,128,128);
 g.addColorStop(0,'#ffffff');g.addColorStop(.2,'#f1f0e8');g.addColorStop(.55,'#969a91');g.addColorStop(.82,'#353b34');g.addColorStop(1,'#000000');c.fillStyle=g;c.fillRect(0,0,256,256);
 const texture=new T.CanvasTexture(canvas);return texture;
}
