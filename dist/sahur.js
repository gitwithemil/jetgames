// A procedural, articulated wooden Sahur. All face geometry points toward +Z.
import {createGait} from './enemy-motion.js';
export function createSahur(THREE) {
  const group = new THREE.Group();
  group.name = 'Tung Tung Tung Sahur';
  const rig = new THREE.Group();
  group.add(rig);

  function grainTexture(end = false) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 512;
    const c = canvas.getContext('2d');
    c.fillStyle = '#996739';
    c.fillRect(0, 0, 512, 512);
    let seed = 131;
    const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    if (end) {
      c.fillStyle = '#bc8b55'; c.fillRect(0, 0, 512, 512);
      for (let n = 0; n < 40; n++) {
        c.beginPath();
        c.strokeStyle = `rgba(74,38,17,${0.12 + random() * 0.2})`;
        c.lineWidth = 1 + random() * 3;
        c.ellipse(240, 263, 9 + n * 7, 8 + n * 6.1, 0.1, 0, Math.PI * 2);
        c.stroke();
      }
      for (let n = 0; n < 6; n++) {
        const angle = random() * Math.PI * 2;
        c.beginPath(); c.strokeStyle = '#57351d'; c.lineWidth = 2;
        c.moveTo(240 + Math.cos(angle) * 70, 263 + Math.sin(angle) * 70);
        c.lineTo(240 + Math.cos(angle + .03) * 270, 263 + Math.sin(angle + .03) * 270); c.stroke();
      }
    } else {
      for (let n = 0; n < 270; n++) {
        const x = random() * 512, wobble = random() * 6;
        c.beginPath();
        c.lineWidth = .5 + random() * 2.5;
        c.strokeStyle = random() > .46 ? `rgba(56,28,9,${.07 + random() * .18})` : `rgba(237,177,91,${.06 + random() * .12})`;
        c.moveTo(x, 0);
        for (let y = 0; y <= 512; y += 12) c.lineTo(x + Math.sin(y * .025 + n) * wobble + Math.sin(y * .009 + n) * 4, y);
        c.stroke();
      }
      for (let n = 0; n < 12; n++) {
        const x = 24 + random() * 464, y = 20 + random() * 472;
        for (let ring = 1; ring < 7; ring++) {
          c.beginPath(); c.lineWidth = 1.2; c.strokeStyle = 'rgba(58,29,10,.15)';
          c.ellipse(x, y, ring * 2.6, ring * 8.2, .06, 0, Math.PI * 2); c.stroke();
        }
      }
      for (let n = 0; n < 1300; n++) {
        c.fillStyle = random() > .5 ? 'rgba(29,17,8,.035)' : 'rgba(245,196,117,.045)';
        c.fillRect(random() * 512, random() * 512, 1 + random() * 3, 1 + random() * 8);
      }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 4;
    return texture;
  }

  const wood = new THREE.MeshStandardMaterial({map: grainTexture(), color: 0xc29a68, roughness: .84});
  const endWood = new THREE.MeshStandardMaterial({map: grainTexture(true), roughness: .87, color: 0xc6a073});
  const darkWood = new THREE.MeshStandardMaterial({color: 0x553018, roughness: .92});
  const mouthMaterial = new THREE.MeshStandardMaterial({color: 0x170908, roughness: .95});
  const toothMaterial = new THREE.MeshStandardMaterial({color: 0xddd1ac, roughness: .52});
  const white = new THREE.MeshStandardMaterial({color: 0xe6dfbc, roughness: .32});
  const irisMaterial = new THREE.MeshStandardMaterial({color: 0x6d3a16, roughness: .48});
  const pupilMaterial = new THREE.MeshStandardMaterial({color: 0x080604, roughness: .18});
  const glintMaterial = new THREE.MeshBasicMaterial({color: 0xfff4d9});
  const eyeRims = new THREE.MeshStandardMaterial({color: 0x795030, roughness: .85});

  function mesh(geometry, material, parent, x=0, y=0, z=0) {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(x,y,z); m.castShadow = true; m.receiveShadow = true;
    parent.add(m); return m;
  }
  function ball(parent, x, y, z, sx, sy, sz, material = wood) {
    const m = mesh(new THREE.SphereGeometry(1, 16, 12), material, parent, x,y,z);
    m.scale.set(sx,sy,sz); return m;
  }
  function stick(parent, length, top, bottom, y, material = wood) {
    return mesh(new THREE.CylinderGeometry(top, bottom, length, 12), material, parent, 0,y,0);
  }
  function curve(points, radius, material, parent) {
    return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))), 24, radius, 7, false), material, parent);
  }

  // The face and torso are carved from one tall log, with a visible cut top.
  const body = new THREE.Group(); body.name='SAHUR_FACE';rig.add(body);
  const log = mesh(new THREE.CylinderGeometry(.39, .355, 1.66, 40, 4), [wood,endWood,endWood], body, 0,2.015,0);
  log.scale.z = .91;
  const cut = mesh(new THREE.CylinderGeometry(.387,.387,.026,40), endWood, body,0,2.854,0);
  cut.scale.z = .91;
  for (let i=0; i<3; i++) {
    const ring = mesh(new THREE.TorusGeometry(.372-i*.003,.004,5,48),darkWood,body,0,2.802+i*.014,0);
    ring.rotation.x = Math.PI/2; ring.scale.y=.91;
  }
  // Small splitting cracks and knots make the silhouette read as timber.
  curve([[.27,1.31,.23],[.29,1.51,.225],[.26,1.64,.24],[.27,1.89,.24]],.0038,darkWood,body);
  curve([[-.31,2.14,.18],[-.32,2.32,.17],[-.30,2.42,.19],[-.32,2.65,.17]],.003,darkWood,body);
  const knot = mesh(new THREE.TorusGeometry(.046,.006,5,24),darkWood,body,.17,1.58,.322);
  knot.scale.set(.7,1.55,1); knot.rotation.y = .35;
  ball(body,.17,1.58,.323,.015,.035,.008,darkWood);

  const pupils = [];
  for (const sign of [-1,1]) {
    const x = sign*.171;
    ball(body,x,2.485,.335,.18,.219,.083,eyeRims);
    ball(body,x,2.485,.405,.153,.189,.105,white);
    const iris = ball(body,x,2.475,.501,.076,.089,.022,irisMaterial);
    const pupil = ball(body,x,2.475,.522,.039,.057,.012,pupilMaterial);
    ball(body,x-.023,2.51,.536,.014,.019,.004,glintMaterial);
    pupils.push({iris,pupil,x});
    curve([[x-sign*.12,2.669,.39],[x,2.698,.426],[x+sign*.115,2.65,.399]],.026,darkWood,body);
    curve([[x-.113,2.325,.403],[x,2.308,.431],[x+.1,2.332,.407]],.007,darkWood,body);
  }
  ball(body,0,2.352,.432,.061,.085,.09,wood);
  ball(body,0,2.317,.476,.074,.042,.065,wood);
  ball(body,-.035,2.301,.519,.012,.008,.004,darkWood);
  ball(body,.035,2.301,.519,.012,.008,.004,darkWood);

  const smileShape = new THREE.Shape();
  smileShape.moveTo(-.224,.063);
  smileShape.bezierCurveTo(-.13,.006,.13,.006,.224,.063);
  smileShape.bezierCurveTo(.204,-.107,.105,-.155,0,-.153);
  smileShape.bezierCurveTo(-.105,-.155,-.204,-.107,-.224,.063);
  const mouth = mesh(new THREE.ExtrudeGeometry(smileShape,{depth:.016,bevelEnabled:true,bevelSize:.005,bevelThickness:.005,bevelSegments:2,steps:1}),mouthMaterial,body,0,2.191,.349);
  mouth.name='SAHUR_MOUTH';
  curve([[-.226,2.254,.366],[-.12,2.205,.39],[0,2.195,.403],[.12,2.205,.39],[.226,2.254,.366]],.010, darkWood,body);
  curve([[-.224,2.246,.365],[-.15,2.092,.383],[0,2.03,.401],[.15,2.092,.383],[.224,2.246,.365]],.012, darkWood,body);
  for (let i=0; i<8; i++) {
    const x=(i-3.5)*.046;
    const y=2.194 + Math.pow(x/.19,2)*.024;
    const tooth=mesh(new THREE.BoxGeometry(.039,.058,.029),toothMaterial,body,x,y,.377);
    tooth.rotation.z=-x*.35;
  }
  for (let i=0; i<6; i++) {
    const x=(i-2.5)*.046;
    const y=2.071+Math.pow(x/.17,2)*.019;
    mesh(new THREE.BoxGeometry(.038,.032,.028),toothMaterial,body,x,y,.382);
  }
  curve([[-.24,2.235,.333],[-.267,2.267,.303],[-.265,2.315,.303]],.008,darkWood,body);
  curve([[.24,2.235,.333],[.267,2.267,.303],[.265,2.315,.303]],.008,darkWood,body);

  const arms = [];
  function hand(parent, holding) {
    ball(parent,0,-.035,0,.085,.102,.063);
    for (let i=0; i<4; i++) {
      const finger = new THREE.Group();
      finger.position.set((i-1.5)*.034,-.095,.025);
      parent.add(finger);
      finger.rotation.x=holding?-1.3:-.23;
      stick(finger,.083,.015,.012,-.039);
      ball(finger,0,-.083,0,.016,.017,.016);
      const tip=stick(finger,.060,.013,.008,-.112);
      tip.rotation.x=holding?-.64:-.15;
    }
    const thumb=new THREE.Group(); parent.add(thumb); thumb.position.set(.071,-.012,.015);
    thumb.rotation.z=.7; thumb.rotation.x=holding?-.8:-.1;
    stick(thumb,.075,.022,.017,-.034);
    ball(thumb,0,-.075,0,.018,.023,.018);
  }
  for (const sign of [-1,1]) {
    const shoulder=new THREE.Group(); shoulder.position.set(sign*.415,2.067,0); rig.add(shoulder);
    if(sign===-1)shoulder.name='SAHUR_BAT_SHOULDER';
    ball(shoulder,0,0,0,.078,.083,.078);
    stick(shoulder,.53,.058,.045,-.264);
    const elbow=new THREE.Group(); elbow.position.y=-.526; shoulder.add(elbow);
    ball(elbow,0,0,0,.059,.063,.059);
    stick(elbow,.54,.043,.035,-.27);
    const wrist=new THREE.Group(); wrist.position.set(0,-.535,0); elbow.add(wrist);
    hand(wrist,sign===-1);
    arms.push({shoulder,elbow,wrist,sign});
    if(sign===-1) {
      const bat=new THREE.Group(); bat.name='Wooden baseball bat'; wrist.add(bat);
      bat.position.set(0,-.048,.065); bat.rotation.set(.13,0,-.32);
      stick(bat,.36,.028,.025,-.10,darkWood);
      ball(bat,0,-.286,0,.042,.026,.042,wood);
      stick(bat,.23,.060,.028,.194);
      stick(bat,.66,.079,.06,.64);
      ball(bat,0,.974,0,.079,.055,.079,wood);
      for(let i=0;i<6;i++) {
        const grip=mesh(new THREE.TorusGeometry(.027,.003,5,12),darkWood,bat,0,-.03-i*.035,0);
        grip.rotation.x=Math.PI/2;
      }
    }
  }

  const legs=[];
  for (const sign of [-1,1]) {
    const hip=new THREE.Group(); hip.position.set(sign*.185,1.206,0); rig.add(hip);
    ball(hip,0,0,0,.066,.068,.066);
    stick(hip,.52,.057,.045,-.26);
    const knee=new THREE.Group(); knee.position.set(0,-.52,0); hip.add(knee);
    ball(knee,0,0,0,.058,.064,.055);
    stick(knee,.55,.044,.036,-.275);
    const ankle=new THREE.Group(); ankle.position.y=-.55; knee.add(ankle);
    ball(ankle,0,-.047,.065,.082,.065,.176);
    mesh(new THREE.BoxGeometry(.145,.037,.247),darkWood,ankle,0,-.085,.069);
    for(let i=0;i<4;i++) ball(ankle,(i-1.5)*.032,-.043,.193,.018,.03,.029);
    legs.push({hip,knee,ankle,sign});
  }

  // Offset the idle bat hand away from the body to preserve the outline.
  arms[0].shoulder.rotation.z=-.15;
  arms[1].shoulder.rotation.z=.12;
  const gait=createGait();
  function animate(time, speed=0, angry=false) {
    const {weight:walking,phase}=gait(time,speed);
    const stride=Math.sin(phase)*.52*walking;
    rig.position.y=(Math.abs(Math.sin(phase))*.025*walking)+Math.sin(time*1.9)*.009;
    rig.rotation.z=Math.sin(phase)*.035*walking;
    body.rotation.z=-Math.sin(phase)*.045*walking;
    body.rotation.x=angry?-.06*walking:0;
    body.rotation.y=Math.sin(time*.8)*.017*(1-walking);
    for(const leg of legs) {
      leg.hip.rotation.x=stride*leg.sign;
      leg.knee.rotation.x=Math.max(0,-Math.sin(phase)*leg.sign)*.85*walking;
      leg.ankle.rotation.x=-leg.knee.rotation.x*.27;
    }
    for(const arm of arms) {
      const batArm=arm.sign===-1;
      arm.shoulder.rotation.x=-stride*arm.sign*.7+(batArm&&angry?-.53:0);
      arm.shoulder.rotation.z=arm.sign*(batArm?.15:.12)+(batArm&&angry?-.17:0);
      arm.elbow.rotation.x=batArm?-.23-(angry?.25+.10*Math.sin(time*4):0):-.12;
      arm.wrist.rotation.z=Math.sin(time*2+arm.sign)*.035;
    }
    for(const eye of pupils) {
      const glance=Math.sin(time*.37)*.007;
      eye.iris.position.x=eye.x+glance;
      eye.pupil.position.x=eye.x+glance;
    }
    mouth.scale.x=1+Math.sin(time*1.7)*.008;
  }
  animate(0);
  return {group,animate};
}
