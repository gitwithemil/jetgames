// These service links are additions to the floor plan. Closing them never
// removes a route the expedition, its objectives or its enemies already use.
export function prepareObjectiveShortcut(grid,kind){
  const plan=kind==='pool'?{x:13,z:12,dx:1,dz:0,threshold:2,name:'Maintenance drain passage'}:
    kind==='industrial'?{x:7,z:7,dx:0,dz:1,threshold:2,name:'Boiler pressure bypass'}:null;
  if(!plan||grid[plan.z]?.[plan.x]!==1||grid[plan.z-plan.dz]?.[plan.x-plan.dx]!==0||grid[plan.z+plan.dz]?.[plan.x+plan.dx]!==0)return null;
  // Build the surrounding architecture with a real doorway on both sides.
  // The world restores this cell to solid before placing items or navigation.
  grid[plan.z][plan.x]=0;
  return plan;
}

export function buildObjectiveEffects(T,root,scene,{level,grid,cellSize,wallHeight,shortcut,lights,fuses,box,placard}){
  const dynamicRoots=[];
  const state={count:0,progress:0,notice:'',restoredCircuits:0,signalClues:[],waterLevel:null,steamPressure:null,
    shortcut:shortcut?{...shortcut,open:false}:null};
  const steel=level.kind==='archive'?null:new T.MeshStandardMaterial({color:0x405d58,metalness:.62,roughness:.6});
  let bulkhead=null;
  if(shortcut){
    const amber=new T.MeshBasicMaterial({color:0xc6a455});
    const green=new T.MeshBasicMaterial({color:0x9bffd6});
    bulkhead=new T.Group();bulkhead.name='OBJECTIVE_SERVICE_BULKHEAD';
    bulkhead.position.set((shortcut.x+.5)*cellSize,0,(shortcut.z+.5)*cellSize);root.add(bulkhead);dynamicRoots.push(bulkhead);
    box(cellSize,wallHeight,cellSize,steel,0,wallHeight/2,0,bulkhead);
    // Both approaches explain the optional opening before it becomes usable.
    for(const direction of [-1,1]){
      const face=cellSize/2+.025;
      const sign=placard([level.kind==='pool'?'DRAIN INTERLOCK':'PRESSURE INTERLOCK',`OPENS AT ${shortcut.threshold} ${level.plural.toUpperCase()}`],0,0,0,0,3,.8,{size:55,color:'#e3d6a0',background:'#243d37'});
      bulkhead.add(sign);sign.position.set(shortcut.dx*face*direction,1.8,shortcut.dz*face*direction);
      sign.rotation.y=shortcut.dx?direction*Math.PI/2:direction<0?Math.PI:0;
      const strip=box(shortcut.dx?.035:3.6,.11,shortcut.dx?3.6:.035,amber,shortcut.dx*face*direction,.65,shortcut.dz*face*direction,bulkhead);
      strip.name='INTERLOCK_WARNING_STRIPE';
    }
    // The illuminated lintel remains as a landmark after the bulkhead retracts.
    const p={x:(shortcut.x+.5)*cellSize,z:(shortcut.z+.5)*cellSize};
    const lintel=box(shortcut.dx?.18:3.7,.07,shortcut.dx?3.7:.18,green,p.x,wallHeight-.2,p.z);
    lintel.name='SERVICE_PASSAGE_LINTEL';
  }

  // Keep the actual Poolrooms water made by the theme, rather than layering a
  // second surface over it. The drop exposes the tile and the service opening.
  const water=level.kind==='pool'?root.children.find(o=>o.isMesh&&o.geometry.type==='PlaneGeometry'&&o.geometry.parameters.width===92&&o.material.transparent&&Math.abs(o.position.y-.035)<.001):null;
  const ripples=level.kind==='pool'?root.children.find(o=>o.isInstancedMesh&&o.geometry.type==='RingGeometry'):null;
  if(water)water.name='POOL_CIRCULATION_SURFACE';
  let waterTarget=.26;
  const jets=[];
  if(level.kind==='industrial'&&shortcut){
    const vapor=new T.MeshBasicMaterial({color:0xc6d6cf,transparent:true,opacity:.2,depthWrite:false});
    const vaporGeometry=new T.SphereGeometry(.45,8,6);
    const center={x:(shortcut.x+.5)*cellSize,z:(shortcut.z+.5)*cellSize};
    for(let i=0;i<4;i++){
      const g=new T.Group();g.name=`PRESSURE_VENT_${i+1}`;
      g.position.set(center.x+(i%2?1:-1)*1.6,0,center.z+(i<2?-1:1)*1.6);root.add(g);dynamicRoots.push(g);
      box(.28,.16,.28,steel,0,.08,0,g);
      const puffs=[];for(let n=0;n<3;n++){const puff=new T.Mesh(vaporGeometry,vapor);g.add(puff);puffs.push(puff);}
      jets.push({group:g,puffs});
    }
  }

  const circuitFixtures=[];
  const lightCircuits=lights.map(({light})=>fuses.reduce((best,f,i)=>light.position.distanceToSquared(f.position)<light.position.distanceToSquared(fuses[best].position)?i:best,0));
  if(level.kind==='office')fuses.forEach((f,i)=>{
    const g=new T.Group();g.name=`RESTORABLE_CIRCUIT_${i+1}`;g.position.set(f.position.x,wallHeight-.22,f.position.z);root.add(g);dynamicRoots.push(g);
    const material=new T.MeshStandardMaterial({color:0x686854,emissive:0xd9f4b3,emissiveIntensity:.015,roughness:.55});
    box(.8,.08,1.1,steel,0,0,0,g);box(.52,.025,.85,material,0,-.055,0,g);
    const light=new T.PointLight(0xdbf3b2,0,6,2);light.position.y=-.2;g.add(light);circuitFixtures.push({material,light});
  });

  const fragments=['THE WATCHER MOVES IN DARKNESS.','KEEP IT IN THE BEAM. BACK AWAY.','THE SOUTH SERVICE HALL LEADS OUT.'];
  const signalPanels=[];
  if(level.kind==='archive'){
    // All three receivers repeat the recovered sequence, so fragments form one
    // useful instruction even when the tapes are found in a different order.
    for(const [x,z,rotation]of [[47.92,72,-Math.PI/2],[40.08,48,Math.PI/2],[47.92,32,-Math.PI/2]]){
      const versions=[];
      for(let count=0;count<=level.count;count++){
        const lines=count?[`SIGNAL ${count} / ${level.count}`,...fragments.slice(0,count)]:['SIGNAL LOST','RECOVER THE THREE TAPES'];
        const panel=placard(lines,x,1.5,z,rotation,3.2,1.05,{size:count>1?36:48,color:count?'#d8f1c8':'#9b8272',background:'#1c302b'});
        panel.name=`ARCHIVE_SIGNAL_${count}`;panel.visible=false;versions.push(panel);
      }
      signalPanels.push(versions);
    }
  }

  let restoredIds=new Set();
  function setPower(value,ids){
    const count=Math.max(0,Math.min(level.count,Number.isFinite(value)?Math.floor(value):0));
    state.count=count;state.progress=count/level.count;
    restoredIds=new Set(ids||Array.from({length:count},(_,i)=>i+1));
    if(shortcut){
      state.shortcut.open=count>=shortcut.threshold;
      grid[shortcut.z][shortcut.x]=state.shortcut.open?0:1;
      // Commit collision and appearance together; no invisible closing door or
      // AI route through a gate that is still visibly crossing the corridor.
      bulkhead.visible=!state.shortcut.open;
    }
    if(level.kind==='pool'){
      waterTarget=.26-state.progress*.34;state.waterLevel=waterTarget;
      if(count===0){if(water)water.position.y=waterTarget;if(ripples)ripples.position.y=waterTarget-.035;}
      state.notice=count===0?'Circulation offline. Relays lower the water.':count>=2?`${state.shortcut?.name||'Drain system'} open. Water level falling.`:'Circulation restarted. The water is draining.';
    }else if(level.kind==='industrial'){
      state.steamPressure=1-state.progress;
      jets.forEach(jet=>{jet.group.visible=count<level.count;});
      state.notice=count===0?'Pressure high. Valves vent the service system.':count===level.count?'Pressure released. Steam vents shut down.':count>=2?`${state.shortcut?.name||'Service bypass'} open. Pressure dropping.`:'Steam pressure falling. Keep releasing the valves.';
    }else if(level.kind==='office'){
      state.restoredCircuits=count;
      circuitFixtures.forEach((fixture,i)=>{fixture.material.emissiveIntensity=restoredIds.has(i+1)?.85:.015;fixture.light.intensity=restoredIds.has(i+1)?.8:0;});
      state.notice=count?`Circuit ${String([...restoredIds].at(-1)).padStart(2,'0')} restored. Local fixtures are lit.`:'Local circuits are waiting for power.';
    }else if(level.kind==='archive'){
      state.signalClues=fragments.slice(0,count);
      signalPanels.forEach(versions=>versions.forEach((panel,i)=>{panel.visible=i===count;}));
      state.notice=count?fragments[count-1]:'The receivers are silent. Recover a signal tape.';
    }
  }
  function update(time,dt,blackout){
    if(water){water.position.y+=(waterTarget-water.position.y)*(1-Math.exp(-Math.max(0,dt)*1.8));if(ripples)ripples.position.y=water.position.y-.035;}
    jets.forEach((jet,i)=>jet.puffs.forEach((puff,n)=>{
      const phase=(time*.65+n/3+i*.17)%1;puff.position.set(Math.sin(time+i+n)*.08,.3+phase*2.2,Math.cos(time*.8+i)*.08);
      puff.scale.set(.35+phase*.7,.65+phase,.35+phase*.7);puff.material.opacity=.2*state.steamPressure;
    }));
    circuitFixtures.forEach((fixture,i)=>{fixture.light.intensity=restoredIds.has(i+1)?(blackout?.015:.8):0;fixture.material.emissiveIntensity=restoredIds.has(i+1)?(blackout?.005:.85):.015;});
  }
  setPower(0);
  return {state,dynamicRoots,setPower,update,lightMultiplier(index){return level.kind==='office'?(restoredIds.has(lightCircuits[index]+1)?1.18:.62):1;}};
}
