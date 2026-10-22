// Pure rules shared by gameplay, audio and regression tests.
export function inVisionCone(position, target, yaw, pursuing=false) {
  const dx=target.x-position.x,dz=target.z-position.z,d=Math.hypot(dx,dz);
  return d<2 || (dx*Math.sin(yaw)+dz*Math.cos(yaw))/d > Math.cos((pursuing?100:65)*Math.PI/180);
}
export function soundBearing(listener, source, yaw, blocked=false) {
  if(!listener||!source)return {pan:0,gain:1,cutoff:6000};
  const dx=source.x-listener.x,dz=source.z-listener.z,d=Math.hypot(dx,dz);
  return {pan:Math.max(-1,Math.min(1,(dx*Math.cos(yaw)-dz*Math.sin(yaw))/Math.max(1,d))),
    gain:(blocked?.32:1)/(1+d/18),cutoff:blocked?650:6000};
}
export function seededRandom(seed) {
  let value=seed>>>0;return ()=>{value=(Math.imul(1664525,value)+1013904223)>>>0;return value/4294967296;};
}
export function shuffled(values,random) {
  const result=[...values];for(let i=result.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}return result;
}
export function controlPuzzle(kind,id,seed=0) {
  const r=seededRandom((seed+id*7919)>>>0);
  if(kind==='pool'){const a=1+Math.floor(r()*3),b=1+Math.floor(r()*3);return {title:'ROUTE THE CIRCUIT',detail:`Set branch A to ${a} and branch B to ${b}. Both branches must match the service label.`,a,b};}
  const a=2+Math.floor(r()*3);return {title:'BALANCE THE PRESSURE',detail:`Set inlet + outlet to ${a*2} bar with a pressure difference of 0. Equal pressure releases this valve safely.`,a,b:a};
}
export function signalCode(seed=0) {const r=seededRandom(seed+333);return Array.from({length:3},()=>1+Math.floor(r()*8)).join('');}
