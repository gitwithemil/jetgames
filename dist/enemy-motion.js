// Advance gait by movement speed, so standing entities never walk in place.
export function createGait(){
  let last=null,phase=0,weight=0;
  return (time,speed=0)=>{const dt=last===null?0:Math.max(0,Math.min(.1,time-last));last=time;
    const movement=Math.max(0,Math.min(2,Math.abs(speed)||0));
    weight+=(Math.min(1,movement)-weight)*(1-Math.exp(-dt*12));
    if(movement>0)phase+=dt*(4+movement*5);
    return {phase,weight,step:Math.sin(phase)*weight,lift:Math.abs(Math.sin(phase))*weight};};
}
// Reparent existing geometry about an anatomical joint, preserving the rest pose.
export function pivot(T,parent,origin,children,name){
  const joint=new T.Group();joint.name=name;joint.position.set(...origin);parent.add(joint);
  for(const child of children){child.position.sub(joint.position);joint.add(child);}return joint;
}
export function rigBiped(T,rig,hipHeight,kneeHeight){
  return [-1,1].map(sign=>{
    const pieces=rig.children.filter(m=>m.isMesh&&m.position.y<hipHeight-.04&&m.position.x*sign>.04);
    const x=sign*.17,hip=pivot(T,rig,[x,hipHeight,0],pieces,`GAIT_HIP_${sign}`);
    const lower=pieces.filter(m=>m.position.y<kneeHeight-hipHeight);
    const knee=pivot(T,hip,[0,kneeHeight-hipHeight,0],lower,`GAIT_KNEE_${sign}`);
    return {hip,knee,sign};
  });
}
export function proximityStrength(distance,enabled=true){return enabled?Math.max(0,Math.min(1,(12-distance)/9)):0;}
