export const BRAINROTS=['ballerina','bribri','spioniro','bombardino'];
// Original procedural interpretations; no downloaded models or audio samples.
export function createBrainrot(T,type){
  const group=new T.Group(),rig=new T.Group();group.add(rig);group.name=type;
  const material=(color,metalness=0,roughness=.8)=>new T.MeshStandardMaterial({color,metalness,roughness});
  const pink=material(0xc782a6),skin=material(0xd5b49b),white=material(0xe6ddc6),dark=material(0x1b2429),gold=material(0xb59945,.65,.5),red=material(0x70302b),green=material(0x416643),steel=material(0x788a86,.6,.5);
  const glow=new T.MeshBasicMaterial({color:0xffc38a});
  const mesh=(geo,mat,x=0,y=0,z=0,parent=rig)=>{const m=new T.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;parent.add(m);return m;};
  const box=(w,h,d,mat,x,y,z,parent=rig)=>mesh(new T.BoxGeometry(w,h,d),mat,x,y,z,parent);
  const ball=(mat,x,y,z,sx,sy,sz)=>{const m=mesh(new T.SphereGeometry(1,16,12),mat,x,y,z);m.scale.set(sx,sy,sz);return m;};
  const link=(a,b,r,mat=skin)=>{const v=new T.Vector3(...b).sub(new T.Vector3(...a)),m=mesh(new T.CylinderGeometry(r,r*.8,v.length(),8),mat,...new T.Vector3(...a).add(new T.Vector3(...b)).multiplyScalar(.5).toArray());m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.normalize());return m;};
  const legs=[],props=[];let name,faceHeight,frontDepth,aimHeight;
  if(type==='ballerina'){
    name='Ballerina Cappuccina';faceHeight=2.1;frontDepth=.41;aimHeight=1.5;
    mesh(new T.CylinderGeometry(.22,.16,.54,16),pink,0,1.48,0);
    mesh(new T.CylinderGeometry(.19,.57,.26,32),pink,0,1.09,0);
    for(let n=0;n<16;n++){const a=n/16*Math.PI*2;const fold=box(.018,.25,.12,white,Math.sin(a)*.39,1.07,Math.cos(a)*.39);fold.rotation.y=a;}
    for(const sign of [-1,1]){const upper=link([sign*.12,.99,0],[sign*.18,.51,.01],.045);link([sign*.18,.51,.01],[sign*.14,.1,.09],.035);ball(pink,sign*.14,.085,.13,.065,.085,.13);legs.push({m:upper,sign});link([sign*.2,1.67,0],[sign*.43,1.89,.05],.033);link([sign*.43,1.89,.05],[sign*.35,2.18,.02],.025);}
    mesh(new T.CylinderGeometry(.33,.28,.54,32),white,0,2.09,0);
    const rim=mesh(new T.TorusGeometry(.32,.023,8,32),gold,0,2.365,0);rim.rotation.x=Math.PI/2;
    const coffee=mesh(new T.CircleGeometry(.3,32),material(0x795033),0,2.37,0);coffee.rotation.x=-Math.PI/2;
    const foam=mesh(new T.TorusGeometry(.14,.025,7,24),white,0,2.377,0);foam.rotation.x=Math.PI/2;foam.scale.set(1,.7,1);
    const handle=mesh(new T.TorusGeometry(.15,.035,8,24),white,.4,2.12,0);handle.rotation.y=Math.PI/2;
    for(const x of [-.11,.11]){ball(dark,x,2.13,.303,.045,.07,.022);ball(glow,x-.01,2.16,.326,.012,.012,.008);}
    const smile=mesh(new T.TorusGeometry(.08,.012,6,16,Math.PI),dark,0,2.02,.295);smile.rotation.z=Math.PI;
  }else if(type==='bribri'){
    name='Brri Brri Bicus Dicus Bombicus';faceHeight=1.83;frontDepth=.8;aimHeight=1.1;
    ball(dark,0,1.1,0,.36,.6,.3);ball(dark,0,1.81,.03,.3,.34,.28);
    const beak=mesh(new T.ConeGeometry(.11,.43,8),gold,0,1.8,.49);beak.rotation.x=Math.PI/2;
    for(const sign of [-1,1]){ball(dark,sign*.37,1.2,0,.13,.42,.2);link([sign*.17,.68,0],[sign*.2,.13,.02],.07,gold);ball(skin,sign*.2,.08,.12,.16,.07,.2);ball(glow,sign*.17,1.89,.26,.039,.045,.018);}
    mesh(new T.CylinderGeometry(.33,.35,.18,24),gold,0,2.04,.03);
    const helmet=mesh(new T.SphereGeometry(.32,20,12,0,Math.PI*2,0,Math.PI/2),gold,0,2.11,.03);
    for(let n=0;n<7;n++)ball(red,0,2.35+n*.017,-.19+n*.06,.055,.1,.04);
    for(let n=0;n<7;n++)box(.55,.075,.13,gold,0,.87+n*.09,.27);
    for(let n=0;n<9;n++){const a=n/8*Math.PI;ball(red,Math.cos(a)*.27,1.55-Math.sin(a)*.15,.25+Math.sin(a)*.09,.045,.045,.045);}
    const cape=mesh(new T.PlaneGeometry(.67,.92),new T.MeshStandardMaterial({color:0x742a25,side:T.DoubleSide}),0,1.14,-.3);cape.rotation.x=-.12;
    box(.045,.95,.045,gold,.49,1.35,.06);const shield=mesh(new T.CylinderGeometry(.23,.23,.06,16),gold,-.43,1.2,.19);shield.rotation.x=Math.PI/2;
  }else if(type==='spioniro'){
    name='Spioniro Golubiro';faceHeight=1.78;frontDepth=.62;aimHeight=1.1;
    const coat=material(0x938061);mesh(new T.CylinderGeometry(.28,.43,1.16,20),coat,0,.99,0);ball(material(0x596c70),0,1.77,0,.29,.31,.26);
    for(const sign of [-1,1]){link([sign*.27,1.43,0],[sign*.42,.9,.16],.065,coat);link([sign*.18,.45,0],[sign*.18,.12,.04],.06,dark);ball(dark,sign*.18,.075,.12,.1,.065,.17);}
    const beak=mesh(new T.ConeGeometry(.075,.28,8),gold,0,1.73,.37);beak.rotation.x=Math.PI/2;
    for(const x of [-.13,.13]){ball(dark,x,1.83,.237,.1,.085,.055);ball(steel,x,1.85,.29,.024,.018,.009);}
    box(.12,.025,.025,dark,0,1.84,.3);mesh(new T.CylinderGeometry(.41,.41,.045,24),dark,0,2.055,0);mesh(new T.CylinderGeometry(.22,.28,.23,20),dark,0,2.17,0);
    box(.12,.53,.026,red,0,1.29,.283);box(.32,.24,.18,dark,0,1.02,.4);
    const lens=mesh(new T.CylinderGeometry(.095,.095,.13,20),steel,0,1.02,.52);lens.rotation.x=Math.PI/2;const glass=mesh(new T.CircleGeometry(.077,16),new T.MeshBasicMaterial({color:0x608e95}),0,1.02,.591);props.push(glass);
    for(const x of [-.12,.12])box(.025,.48,.025,dark,x,1.36,.29);
  }else{
    name='Bombardino Crocodilo';faceHeight=1.91;frontDepth=1.4;aimHeight=1.7;
    const body=mesh(new T.CylinderGeometry(.26,.19,1.85,20),steel,0,1.7,-.2);body.rotation.x=Math.PI/2;
    box(2.6,.075,.53,steel,0,1.68,-.12);box(1.05,.045,.27,steel,0,1.8,-1.13);box(.055,.43,.35,steel,0,2,-1.15);
    ball(green,0,1.9,.57,.28,.22,.36);ball(green,0,1.83,.95,.24,.15,.4);box(.42,.07,.68,dark,0,1.715,.95);
    for(const sign of [-1,1]){ball(glow,sign*.19,2.025,.67,.055,.06,.04);for(let n=0;n<6;n++)box(.035,.057,.045,white,sign*.18,1.74,.7+n*.1);
      const engine=mesh(new T.CylinderGeometry(.135,.135,.39,16),dark,sign*.8,1.69,.18);engine.rotation.x=Math.PI/2;
      const prop=new T.Group();prop.position.set(sign*.8,1.69,.41);rig.add(prop);box(.055,.65,.026,dark,0,0,0,prop);box(.65,.055,.026,dark,0,0,0,prop);props.push(prop);}
    for(let n=0;n<4;n++)box(.11,.07,.13,gold,0,1.89,-.25-n*.21);
  }
  return {group,type,name,faceHeight,frontDepth,aimHeight,animate(time,speed=0,angry=false){
    rig.position.y=type==='bombardino'?Math.sin(time*2.4)*.045:Math.abs(Math.sin(time*7))*speed*.025;
    rig.rotation.z=type==='ballerina'?Math.sin(time*3)*.07:0;rig.rotation.y=type==='ballerina'&&speed>0?Math.sin(time*(angry?8:2))*.7:0;
    for(const leg of legs)leg.m.rotation.x=Math.sin(time*9)*.08*speed*leg.sign;
    if(type==='bombardino')for(const prop of props)prop.rotation.z=time*(angry?39:24);
  }};
}
