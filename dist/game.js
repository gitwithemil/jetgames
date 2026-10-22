import { createSurveyState, resetSurvey, revealSurvey, renderSurveyMap, surveyLayout, surveyCellAt, selectSurveyWaypoint, surveyKey } from './survey-map.js';
import { BEAM_MODES, BEAMS, stepTorch, beamStrength, createBeamCookie } from './lighting.js';
import { STUN, createStunView, selectStunTarget, createStunAura } from './weapon.js';
import { scareTimeline, scarePose, SCARE_VARIANTS, createScareDirector, createScareEffects } from './scares.js';
import * as THREE from './vendor/three.module.js';
import { createWorld } from './world.js';
import { createEnemy, senseEnemy } from './enemies.js';
import { LEVELS } from './levels.js';
import { createAudio } from './audio.js';
import { readExpedition, writeExpedition, clearExpedition } from './expedition-save.js';
import { createPursuit, updatePursuit, createBrriCharge, updateBrriCharge, deathHint } from './encounters.js';

import {proximityStrength} from './enemy-motion.js';
import {inVisionCone,soundBearing,controlPuzzle,signalCode} from './survival.js';
const $ = id => document.getElementById(id);
const coarse = matchMedia('(pointer:coarse)').matches;
const defaultSettings = { volume:65, sensitivity:50, brightness:200, difficulty:'normal', challenge:'standard', motion:!matchMedia('(prefers-reduced-motion:reduce)').matches, reducedEffects:false, captions:true, leftHanded:false, touchSize:100, quality:coarse?'low':'high', scares:true };
let saved = {};
try { saved = JSON.parse(localStorage.getItem('sahur-settings') || '{}'); } catch {}
const settings = { ...defaultSettings, ...saved };
settings.volume = Math.max(0,Math.min(100,Number(settings.volume)||0));
settings.sensitivity = Math.max(10,Math.min(100,Number(settings.sensitivity)||50));
settings.brightness = Math.max(50,Math.min(250,Number(settings.brightness)||defaultSettings.brightness));
if (!['easy','normal','hard'].includes(settings.difficulty)) settings.difficulty='normal';
if (!['standard','scarcity'].includes(settings.challenge)) settings.challenge='standard';
settings.motion=settings.motion!==false;
settings.reducedEffects=settings.reducedEffects===true;
settings.captions=settings.captions!==false;
settings.leftHanded=settings.leftHanded===true;
settings.touchSize=Math.max(80,Math.min(140,Number(settings.touchSize)||100));
if (!['low','high'].includes(settings.quality)) settings.quality='high';
const audio = createAudio();
const scareDirector=createScareDirector();
let levelIndex=0,selectedLevel=0,checkpoint=0,score=0,totalElapsed=0,decoys=3,decoy=null,pingReady=0,holdTarget=null,holdProgress=0,interactHeld=false;
let actors=[],enemyModels={},nearestActor=null,stageBaseScore=0,lastAttacker="Entity";
let runSeed=0,puzzleTarget=null,archiveDecoded=false;
let stageCheckpoint=null,savedExpedition=null,runRules={difficulty:settings.difficulty,challenge:settings.challenge};
let lastDetection={type:'sahur',cause:'sight'},researchDiscovered=false;
let quietUntil=0,lastChaseAt=-100,enemyGraceUntil=0;
let training={active:false,step:0,complete:false,origin:null,crouchTime:0};
try{savedExpedition=readExpedition(localStorage);}catch{}
try{checkpoint=Math.max(0,Math.min(3,Number(localStorage.getItem('sahur-checkpoint'))||0));}catch{}
let renderer, scene, camera, world, sahur, flashlight, fillLight, heldFlashlight,stunView;
let weaponOwned=false,ammo=0,stunReady=0,weaponNoiseUntil=0,stageWeapon={owned:false,ammo:0};
const weaponParts=new Set();
let beamMode='focus',torchHeat=0,boostLocked=false,cranking=false,torchCrankDone=false;
const batteryWarnings=new Set();
let mode='menu', yaw=0, pitch=0, elapsed=0, elapsedWorld=0, stamina=100, battery=100, fuseCount=0;
let flashlightOn=true, exhausted=false, moving=false, sprinting=false, crouching=false, hadPointerLock=false;
let interaction=null, toastTimer=0, stepTimer=0, pathTimer=0, alertUntil=0, distanceToEnemy=100;
let enemyPath=[], patrolGoal=null, lastKnown=null, enemyMoving=false, difficulty=1, activeModal=null;
let player=new THREE.Vector3(), menuCamera=new THREE.Vector3(), enemyHome=new THREE.Vector3();
const keys=new Set(), explored=new Set(), collected=new Set();
const survey=createSurveyState(explored);
let mapKeyboard=false;
const direction=new THREE.Vector3(), toTarget=new THREE.Vector3();
const touch={x:0,y:0,sprint:false,crouch:false,crank:false,lookId:null,lastX:0,lastY:0,joyId:null};
let scare=null, scareFace, scareLight, scareEffects, scareCooldown=0, pendingScare=0, nextAmbientScare=24;
const scareRooms=new Set(),visitedRooms=new Set();
let scareSequence=0,lastRoomId=null;
let lastTime=performance.now(), fpsFrames=0, fpsTime=0, lowFpsSeconds=0;
let captionTimer=0,lastCaptionAt=-Infinity;

function notify(text,duration=3500) { $('toast').textContent=text; $('toast').classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('toast').classList.remove('show'),duration); }
function showAudioCaption(text) {
  if(!settings.captions||performance.now()-lastCaptionAt<650)return;
  lastCaptionAt=performance.now();$('audio-caption').textContent=text;$('audio-caption').hidden=false;
  clearTimeout(captionTimer);captionTimer=setTimeout(()=>$('audio-caption').hidden=true,2600);
}
audio.setCaptionHandler(showAudioCaption);
function saveSettings(){ try{localStorage.setItem('sahur-settings',JSON.stringify(settings));}catch{} }
function renderTraining(){
  const steps=[
    ['Find your footing',coarse?'Move with the movement stick. Walk a few steps down the hall.':'Use WASD or the arrow keys to walk a few steps down the hall.'],
    ['Move quietly',coarse?'Tap CROUCH, then stay low for a moment. Quiet movement keeps sound hunters away.':'Hold C for a moment to crouch. Quiet movement keeps sound hunters away.'],
    ['Send them the other way',coarse?'Tap DECOY to throw a noise lure down the hall. Sound hunters investigate it.':'Press Q to throw a noise lure down the hall. Sound hunters investigate it.'],
    ['Choose your light',coarse?'Tap FOCUS to cycle the beam. Flood saves power; Boost reaches farther and builds heat.':'Press B to cycle the beam. Flood saves power; Boost reaches farther and builds heat.']
  ];
  $('field-training').hidden=!training.active;
  if(training.active){$('training-step').textContent=`FIELD TRAINING / ${training.step+1} OF 4`;$('training-title').textContent=steps[training.step][0];$('training-detail').textContent=steps[training.step][1];}
  $('weapon-quest').hidden=!researchDiscovered||training.active;$('stun-button').hidden=!researchDiscovered||training.active;
  $('decoy-button').hidden=training.active&&training.step<2;$('beam-button').hidden=training.active&&training.step<3;
}
function finishTraining(skipped=false){
  if(!training.active)return;
  if(training.step>=3)decoys=Math.min(5,decoys+1);
  training.active=false;training.complete=true;
  try{localStorage.setItem('sahur-field-training-v1','complete');}catch{}
  enemyGraceUntil=elapsed+10/difficulty;quietUntil=elapsed+22;nextAmbientScare=Math.max(nextAmbientScare,quietUntil+12);
  renderTraining();notify(skipped?'TRAINING SKIPPED · Find the fuses and stay quiet.':'FIELD TRAINING COMPLETE · Your practice decoy is restored. Find the fuses and stay quiet.',5000);
}
function updateTraining(dt=0,action=''){
  if(!training.active)return;
  const previousStep=training.step;
  if(training.step===0&&Math.hypot(player.x-training.origin.x,player.z-training.origin.z)>=2)training.step=1;
  else if(training.step===1){training.crouchTime=crouching?training.crouchTime+dt:0;if(training.crouchTime>=.7)training.step=2;}
  else if(training.step===2&&action==='decoy')training.step=3;
  else if(training.step===3&&action==='beam'){finishTraining();return;}
  if(training.step!==previousStep)renderTraining();
}
function award(points){const earned=Math.round(points*(runRules.challenge==='scarcity'?1.25:1));score+=earned;return earned;}
function formatTime(seconds){return `${Math.floor(seconds/60).toString().padStart(2,'0')}:${Math.floor(seconds%60).toString().padStart(2,'0')}`;}
function setVolume(){audio.setVolume(settings.volume/100*.65);document.querySelectorAll('.sound-button').forEach(b=>{b.classList.toggle('muted',settings.volume===0);b.setAttribute('aria-label',settings.volume===0?'Unmute audio':'Mute audio');});}
function setBrightness(){
  if(renderer)renderer.toneMappingExposure=settings.brightness/100;
  if(flashlight)syncFlashlight();
}

try {
  renderer=new THREE.WebGLRenderer({canvas:$('game'),antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,settings.quality==='high'?1.6:1));
  renderer.setSize(innerWidth,innerHeight);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  setBrightness();
  renderer.shadowMap.enabled=settings.quality==='high';
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  scene=new THREE.Scene();
  scene.background=new THREE.Color('#333820');
  scene.fog=new THREE.FogExp2('#353923',.035);
  camera=new THREE.PerspectiveCamera(72,innerWidth/innerHeight,.07,120);
  camera.rotation.order='YXZ';
  scene.add(camera);
  world=createWorld(THREE,scene);
  for(const type of ['sahur','smiler','hound','watcher','ballerina','bribri','spioniro','bombardino']){enemyModels[type]=createEnemy(THREE,type);enemyModels[type].stunAura=createStunAura(THREE,enemyModels[type]);}
  sahur=enemyModels.sahur;scene.add(sahur.group);actors=[makeActor(sahur,world.enemySpawn)];
  scareFace=sahur.group.clone(true);scareFace.name='SAHUR_ATTACK_CLOSEUP';scareFace.visible=false;camera.add(scareFace);
  scareLight=new THREE.PointLight(0xffb284,0,4,1);scareLight.position.set(0,.3,-.2);camera.add(scareLight);scareEffects=createScareEffects(THREE,camera);
  flashlight=new THREE.SpotLight(0xf3f5ce,52,22,.42,.55,1.6);
  flashlight.position.set(.18,-.16,.07);
  flashlight.target.position.set(0,-.08,-8);
  flashlight.castShadow=settings.quality==='high';
  flashlight.shadow.mapSize.set(1024,1024);
  flashlight.shadow.camera.near=.2;flashlight.shadow.camera.far=28;flashlight.shadow.bias=-.001;
  flashlight.map=createBeamCookie(THREE);flashlight.name='PLAYER_FLASHLIGHT';camera.add(flashlight,flashlight.target);
  fillLight=new THREE.PointLight(0xc8d49b,.025,2.2,2);fillLight.name='FLASHLIGHT_SPILL';camera.add(fillLight);
  heldFlashlight=new THREE.Group();heldFlashlight.position.set(.34,-.34,-.5);heldFlashlight.rotation.set(-.05,-.13,-.09);camera.add(heldFlashlight);
  const torchMetal=new THREE.MeshStandardMaterial({color:0x262c26,roughness:.5,metalness:.72});
  const rubber=new THREE.MeshStandardMaterial({color:0x141a16,roughness:.9});
  const sleeveMat=new THREE.MeshStandardMaterial({color:0x383e2d,roughness:1});
  const gloveMat=new THREE.MeshStandardMaterial({color:0x756d4e,roughness:.96});
  const part=(geometry,material,x,y,z)=>{const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);heldFlashlight.add(mesh);return mesh;};
  const tube=part(new THREE.CylinderGeometry(.058,.058,.26,16),rubber,0,0,0);tube.rotation.x=Math.PI/2;
  const torchHead=part(new THREE.CylinderGeometry(.084,.057,.08,20),torchMetal,0,0,-.17);torchHead.rotation.x=-Math.PI/2;
  const glass=part(new THREE.CircleGeometry(.07,20),new THREE.MeshStandardMaterial({color:0xd1dcc3,emissive:0x687f43,emissiveIntensity:.7,metalness:.65,roughness:.2}),0,0,-.212);glass.rotation.y=Math.PI;
  for(let n=0;n<4;n++){const ring=part(new THREE.TorusGeometry(.061,.006,6,16),torchMetal,0,0,-.07+n*.043);}
  const palm=part(new THREE.SphereGeometry(.085,12,10),gloveMat,0,-.045,.017);palm.scale.set(.78,.9,1.15);
  for(let n=0;n<4;n++){const finger=part(new THREE.CapsuleGeometry(.017,.083,3,6),gloveMat,-.03+n*.019,-.018,-.034+n*.009);finger.rotation.z=1.25;}
  const arm=part(new THREE.CylinderGeometry(.078,.105,.34,12),sleeveMat,.013,-.16,.18);arm.rotation.x=.8;
  stunView=createStunView(THREE,camera);
  player.copy(world.spawn);menuCamera.copy(world.introCameraPosition||world.spawn);
  yaw=world.introYaw||0;enemyHome.copy(actors[0].home||sahur.group.position);
  showMenu();
  $('play-button').disabled=false;
  requestAnimationFrame(frame);
} catch(error) {
  console.error(error);$('load-error').hidden=false;
  $('error-message').textContent='This game needs WebGL. Enable hardware acceleration or try a recent version of Chrome, Firefox, or Safari.';
}

function setQuality(){if(!renderer)return;renderer.setPixelRatio(Math.min(devicePixelRatio,settings.quality==='high'?1.6:1));renderer.shadowMap.enabled=settings.quality==='high';flashlight.castShadow=settings.quality==='high';renderer.setSize(innerWidth,innerHeight);}
function positionMenuEnemy(){
  if(world.introEnemyPosition){sahur.group.position.copy(world.introEnemyPosition);}
  else {const forward=new THREE.Vector3(-Math.sin(world.introYaw||0),0,-Math.cos(world.introYaw||0));const right=new THREE.Vector3(Math.cos(world.introYaw||0),0,-Math.sin(world.introYaw||0));sahur.group.position.copy(menuCamera).addScaledVector(forward,11).addScaledVector(right,2.2);sahur.group.position.y=0;}
  const dx=menuCamera.x-sahur.group.position.x,dz=menuCamera.z-sahur.group.position.z;
  sahur.group.rotation.y=Math.atan2(dx,dz);
}
function showMenu(){
  $('proximity-cue').hidden=true;
  clearScare();$('stage-screen').hidden=true;updateLevelCards();
  stunView?.hide();Object.values(enemyModels).forEach(m=>m.stunAura.visible=false);mode='menu';keys.clear();touch.x=0;touch.y=0;touch.sprint=false;
  if(document.pointerLockElement)document.exitPointerLock();
  document.body.classList.remove('playing');$('menu').hidden=false;$('hud').hidden=true;$('pause-screen').hidden=true;$('end-screen').hidden=true;
  $('danger-overlay').style.opacity=0;$('flash').style.opacity=0;
  camera.position.copy(menuCamera);camera.rotation.set(0,world.introYaw||0,0);
  positionMenuEnemy();sahur.group.visible=true;flashlight.visible=false;heldFlashlight.visible=false;fillLight.intensity=.5;
  $('field-training').hidden=true;$('audio-caption').hidden=true;clearTimeout(toastTimer);$('toast').classList.remove('show');audio.pause();
}
async function lockPointer(){
  if(coarse||mode!=='playing')return;
  try{const promise=$('game').requestPointerLock();if(promise)await promise;}catch{notify('Drag to look around. Click the scene to lock your mouse.',4500);}
}
function baselineFor(index,fresh=false){
  return {seed:fresh?Math.floor(Math.random()*4294967295):runSeed,levelIndex:index,score:fresh?0:score,totalElapsed:fresh?0:totalElapsed,
    weaponOwned:fresh?false:weaponOwned,ammo:fresh?0:ammo,
    difficulty:fresh?settings.difficulty:runRules.difficulty,challenge:fresh?settings.challenge:runRules.challenge};
}
function persistExpedition(suspended=null,baseline=stageCheckpoint){
  if(!baseline)return false;
  try{
    const ok=writeExpedition(localStorage,{checkpoint:baseline,suspended});
    if(ok)savedExpedition=readExpedition(localStorage);
    return ok;
  }catch{return false;}
}
const savedPoint=v=>v?{x:v.x,y:v.y??0,z:v.z}:null;
function captureSuspension(){
  return {archiveDecoded,elapsed,score,totalElapsed,player:savedPoint(player),yaw,pitch,stamina,battery,decoys,
    collected:[...collected],usedSupplies:world.supplies.flatMap((item,i)=>item.mesh.visible?[]:[i]),
    usedCases:world.armory.parts.filter(item=>!item.mesh.visible).map(item=>item.id),
    weaponOwned,ammo,weaponParts:[...weaponParts],flashlightOn,beamMode,torchHeat,boostLocked,stunReady,weaponNoiseUntil,pingReady,
    survey:{explored:[...explored],visited:[...survey.visited],trail:survey.trail.map(p=>({...p})),waypoint:survey.waypoint},
    actors:actors.map(a=>({type:a.model.type,position:savedPoint(a.model.group.position),yaw:a.model.group.rotation.y,
      alert:a.alert,lastKnown:savedPoint(a.lastKnown),goal:savedPoint(a.goal),path:[],pathTimer:0,
      stunnedUntil:a.stunnedUntil,frozen:a.frozen,pursuit:a.pursuit,charge:a.charge})),
    decoy:decoy?{position:savedPoint(decoy.position),until:decoy.until,id:decoy.id}:null,
    scareCooldown,pendingScare,nextAmbientScare,visitedRooms:[...visitedRooms],scareRooms:[...scareRooms],scareSequence,lastRoomId,
    onboarding:{active:training.active,step:training.step,complete:training.complete},researchDiscovered,lastDetection,
    tension:{quietUntil,lastChaseAt,enemyGraceUntil}};
}
function restoreSuspension(snapshot){
  const restoredIds=new Set(snapshot.collected.filter(id=>world.fuses.some(item=>item.id===id)));
  world.setPower(restoredIds.size,restoredIds);
  const validPosition=world.isWalkable(snapshot.player.x,snapshot.player.z,.27);
  const validCast=snapshot.actors.length===actors.length&&actors.every(a=>snapshot.actors.some(saved=>saved.type===a.model.type&&world.isWalkable(saved.position.x,saved.position.z,.3)));
  if(!validPosition||!validCast||snapshot.score<stageCheckpoint.score||snapshot.totalElapsed<stageCheckpoint.totalElapsed){world.setPower(0);return false;}
  archiveDecoded=snapshot.archiveDecoded===true;elapsed=snapshot.elapsed;score=snapshot.score;totalElapsed=snapshot.totalElapsed;
  player.set(snapshot.player.x,Math.max(1.05,Math.min(1.65,snapshot.player.y)),snapshot.player.z);yaw=snapshot.yaw;pitch=Math.max(-1.3,Math.min(1.3,snapshot.pitch));
  stamina=snapshot.stamina;battery=snapshot.battery;decoys=snapshot.decoys;
  collected.clear();restoredIds.forEach(id=>collected.add(id));fuseCount=collected.size;
  world.fuses.forEach(item=>item.mesh.visible=!collected.has(item.id));
  world.supplies.forEach((item,i)=>item.mesh.visible=!snapshot.usedSupplies.includes(i));
  weaponParts.clear();snapshot.weaponParts.forEach(id=>weaponParts.add(id));
  world.armory.parts.forEach(item=>item.mesh.visible=!snapshot.usedCases.includes(item.id));
  weaponOwned=snapshot.weaponOwned;ammo=snapshot.ammo;stunReady=snapshot.stunReady;weaponNoiseUntil=snapshot.weaponNoiseUntil;pingReady=snapshot.pingReady;
  flashlightOn=snapshot.flashlightOn;beamMode=snapshot.beamMode;torchHeat=snapshot.torchHeat;boostLocked=snapshot.boostLocked;
  resetSurvey(survey);
  const inBounds=key=>{const [x,z]=key.split(',').map(Number);return x<world.width&&z<world.height;};
  snapshot.survey.explored.filter(inBounds).forEach(key=>explored.add(key));
  snapshot.survey.visited.filter(inBounds).forEach(key=>survey.visited.add(key));
  survey.trail=snapshot.survey.trail.filter(p=>world.isWalkable(p.x,p.z,0));
  const waypoint=snapshot.survey.waypoint;
  if(waypoint&&explored.has(surveyKey(waypoint.x,waypoint.z))&&world.grid[waypoint.z]?.[waypoint.x]===0)survey.waypoint=waypoint;
  for(const a of actors){
    const state=snapshot.actors.find(saved=>saved.type===a.model.type);
    a.model.group.position.set(state.position.x,0,state.position.z);a.model.group.rotation.y=state.yaw;
    a.stunnedUntil=state.stunnedUntil;a.alert=state.alert;
    a.lastKnown=state.lastKnown?new THREE.Vector3(state.lastKnown.x,0,state.lastKnown.z):null;
    a.goal=state.goal?new THREE.Vector3(state.goal.x,0,state.goal.z):null;
    a.pursuit=state.pursuit||createPursuit();a.charge=state.charge||createBrriCharge();a.path=[];a.pathTimer=0;
  }
  if(snapshot.decoy&&snapshot.decoy.until>elapsed&&world.isWalkable(snapshot.decoy.position.x,snapshot.decoy.position.z,.1))placeDecoy(new THREE.Vector3(snapshot.decoy.position.x,.16,snapshot.decoy.position.z),snapshot.decoy.until,snapshot.decoy.id);
  scareCooldown=snapshot.scareCooldown;pendingScare=snapshot.pendingScare;nextAmbientScare=snapshot.nextAmbientScare;
  snapshot.visitedRooms.forEach(id=>visitedRooms.add(id));snapshot.scareRooms.forEach(id=>scareRooms.add(id));scareSequence=snapshot.scareSequence;lastRoomId=snapshot.lastRoomId;
  researchDiscovered=snapshot.researchDiscovered||weaponOwned;lastDetection=snapshot.lastDetection||lastDetection;
  quietUntil=snapshot.tension.quietUntil;lastChaseAt=snapshot.tension.lastChaseAt;enemyGraceUntil=snapshot.tension.enemyGraceUntil;
  training={...training,...snapshot.onboarding,origin:player.clone(),crouchTime:0};
  return true;
}
async function continueExpedition(){
  try{savedExpedition=readExpedition(localStorage);}catch{savedExpedition=null;}
  return savedExpedition?startGame(savedExpedition.checkpoint.levelIndex,{resume:savedExpedition}):startGame(checkpoint);
}
function saveAndQuit(){
  if(mode!=='paused'||scare?.fatal)return false;
  if(!persistExpedition(captureSuspension())){notify('Could not save on this device. Your expedition is still paused.',6000);$('pause-save-status').textContent='Save unavailable. Keep this tab open or resume your expedition.';return false;}
  showMenu();return true;
}
async function startGame(requested,options={}){
  if(!world)return;
  const index=Number.isInteger(requested)&&requested>=0&&requested<LEVELS.length?requested:selectedLevel;
  const fresh=mode==='menu'||mode==='won';
  const baseline=options.resume?.checkpoint||(mode==='dead'&&stageCheckpoint?stageCheckpoint:baselineFor(index,fresh));
  runSeed=baseline.seed||0;archiveDecoded=false;puzzleTarget=null;loadLevel(baseline.levelIndex);
  stageCheckpoint={...baseline};runRules={difficulty:baseline.difficulty,challenge:baseline.challenge};
  score=baseline.score;stageBaseScore=score;totalElapsed=baseline.totalElapsed;
  weaponOwned=baseline.weaponOwned;ammo=baseline.ammo;stageWeapon={owned:weaponOwned,ammo};
  scareDirector.reset();
  beamMode='focus';torchHeat=0;boostLocked=false;cranking=false;torchCrankDone=false;touch.crank=false;batteryWarnings.clear();
  weaponParts.clear();stunReady=0;weaponNoiseUntil=0;stunView.hide();
  decoys=runRules.challenge==='scarcity'?1:3;decoy=null;pingReady=0;holdTarget=null;holdProgress=0;interactHeld=false;
  $('stage-screen').hidden=true;
  clearScare();scareCooldown=0;pendingScare=0;nextAmbientScare=30+Math.random()*16;scareRooms.clear();visitedRooms.clear();lastRoomId=null;scareSequence=0;
  quietUntil=12;lastChaseAt=-100;enemyGraceUntil=10/({easy:.78,normal:1,hard:1.25}[runRules.difficulty]);
  mode='playing';elapsed=0;stamina=100;battery=runRules.challenge==='scarcity'?65:100;fuseCount=0;collected.clear();resetSurvey(survey);mapKeyboard=false;keys.clear();enemyPath=[];patrolGoal=null;lastKnown=null;pathTimer=0;alertUntil=0;stepTimer=0;exhausted=false;hadPointerLock=false;pitch=0;yaw=world.introYaw||0;flashlightOn=true;
  moving=false;sprinting=false;crouching=false;touch.crouch=false;touch.x=0;touch.y=0;touch.sprint=false;$('touch-crouch').setAttribute('aria-pressed','false');
  difficulty={easy:.78,normal:1,hard:1.25}[runRules.difficulty]||1;
  player.copy(world.spawn);sahur.group.position.copy(enemyHome);sahur.group.position.y=0;sahur.group.visible=true;
  world.fuses.forEach(f=>f.mesh.visible=true);world.setPower(0);heldFlashlight.visible=true;
  researchDiscovered=weaponOwned;lastDetection={type:world.level.enemy,cause:'sight'};
  let trained=false;try{trained=localStorage.getItem('sahur-field-training-v1')==='complete';}catch{}
  training={active:levelIndex===0&&(options.training||(!trained&&fresh&&!options.resume)),step:0,complete:trained,origin:player.clone(),crouchTime:0};
  const restored=options.resume?.suspended?restoreSuspension(options.resume.suspended):false;
  $('objective-title').textContent=fuseCount===world.targetCount?'Get to the exit':world.level.objective;
  $('objective-detail').textContent=fuseCount===world.targetCount?'Exit unlocked. Return to the green door.':world.level.brief;
  $('hud-level').textContent=`LEVEL ${world.level.code} / ${world.level.name.toUpperCase()}`;
  $('progress-total').textContent=` / ${world.targetCount} ${world.level.plural.toUpperCase()}`;
  $('fuse-slots').innerHTML='<b></b>'.repeat(world.targetCount);
  $('ability-tip').textContent=world.level.tip;
  $('fuse-count').textContent=String(fuseCount);$('audio-caption').hidden=true;document.querySelectorAll('#fuse-slots b').forEach((b,i)=>b.classList.toggle('found',i<fuseCount));
  $('menu').hidden=true;$('hud').hidden=false;$('pause-screen').hidden=true;$('end-screen').hidden=true;
  document.body.classList.add('playing');$('danger-overlay').style.opacity=0;
  camera.position.copy(player);camera.rotation.set(pitch,yaw,0);syncFlashlight();renderTraining();updateHUD(0);
  clearTimeout(toastTimer);$('toast').classList.remove('show');
  lastTime=performance.now();lockPointer();
  try{await audio.init();setVolume();audio.resume();}catch{}
  markExplored();
  if(!options.resume||!restored)persistExpedition();
  notify(restored?'EXPEDITION RESUMED · Your progress and equipment are restored.':options.resume?.suspended?'Saved position unavailable. Your stage checkpoint and equipment are restored.':`LEVEL ${world.level.code} — ${world.level.tip}`,6500);
}
function pauseGame(){
  $('proximity-cue').hidden=true;
  if(mode!=='playing')return;mode='paused';touch.crank=false;cranking=false;interactHeld=false;holdTarget=null;holdProgress=0;keys.clear();touch.x=0;touch.y=0;touch.sprint=false;
  if(document.pointerLockElement)document.exitPointerLock();
  $('pause-screen').hidden=false;$('interaction').hidden=true;audio.pause();
  $('field-training').hidden=true;$('audio-caption').hidden=true;clearTimeout(toastTimer);$('toast').classList.remove('show');
  $('save-quit-button').disabled=!!scare?.fatal;
  $('pause-save-status').textContent=scare?.fatal?'Finish this encounter before saving.':'';
}
function resumeGame(){
  if(mode!=='paused')return;mode='playing';$('pause-screen').hidden=true;lastTime=performance.now();renderTraining();audio.resume();lockPointer();
}
function endGame(won){
  $('proximity-cue').hidden=true;
  if(mode!=='playing')return;clearScare();mode=won?'won':'dead';keys.clear();touch.x=0;touch.y=0;
  if(document.pointerLockElement)document.exitPointerLock();
  $('hud').hidden=true;$('end-screen').hidden=false;
  $('end-eyebrow').textContent=won?'EXPEDITION COMPLETE / SIGNAL RESTORED':`EXPEDITION TERMINATED / ${lastAttacker.toUpperCase()}`;
  $('end-title').textContent=won?'YOU MADE IT OUT.':'IT FOUND YOU.';
  $('end-description').textContent=won?'The door opens. The humming fades. For now, you are safe.':'The knocking stopped. You didn’t.';
  $('end-time').textContent=formatTime(totalElapsed);$('end-fuses').textContent=`${score} PTS`;
  $('end-description').textContent=won?'The Lobby lights burn steady. The pools fall still. The pipes go silent. Your recovered signal opens the Archive door—and this time, the dawn beyond it is real.':'Checkpoint preserved. Try this level again, or change stages from the menu.';
  $('end-hint').hidden=won;$('end-hint').textContent=won?'':deathHint(lastDetection.type,lastDetection.cause);
  if(won){try{clearExpedition(localStorage);}catch{}savedExpedition=null;}else persistExpedition();
  if(won){try{const best=Number(localStorage.getItem('sahur-best-score'))||0;localStorage.setItem('sahur-best-score',String(Math.max(best,score)));}catch{}}
  $('retry-button').firstElementChild.textContent=won?'PLAY AGAIN':'RETRY THIS LEVEL';
  if(won){audio.win();$('flash').style.opacity=settings.reducedEffects?.18:.5;setTimeout(()=>$('flash').style.opacity=0,250);}
  else{$('danger-overlay').style.opacity=.9;}
  setTimeout(()=>{if(mode==='dead'||mode==='won')audio.pause();},1200);
}
function openModal(id){
  activeModal={id,wasPlaying:mode==='playing'};if(activeModal.wasPlaying)pauseGame();
  $(id).showModal();if(id==='map-dialog'){mapKeyboard=false;survey.cursor=world.cellAt(player.x,player.z);survey.notice='';drawMap();$('map-canvas').focus({preventScroll:true});}
}
function closeModal(){
  if(!activeModal)return;const {id,wasPlaying}=activeModal;activeModal=null;if(id==='control-dialog')puzzleTarget=null;$(id).close();if(wasPlaying)resumeGame();
}
function updateSettingsUI(){
  world?.setAtmosphereEffects(settings.reducedEffects);
  $('volume-input').value=settings.volume;$('volume-output').textContent=`${settings.volume}%`;
  $('sensitivity-input').value=settings.sensitivity;$('sensitivity-output').textContent=`${settings.sensitivity}%`;
  $('brightness-input').value=settings.brightness;$('brightness-output').textContent=`${settings.brightness}%`;
  document.querySelectorAll('[data-difficulty]').forEach(b=>b.classList.toggle('selected',b.dataset.difficulty===settings.difficulty));
  document.querySelectorAll('[data-quality]').forEach(b=>b.classList.toggle('selected',b.dataset.quality===settings.quality));
  document.querySelectorAll('[data-challenge]').forEach(b=>b.classList.toggle('selected',b.dataset.challenge===settings.challenge));
  for(const [id,value] of [['scares-toggle',settings.scares],['motion-toggle',settings.motion],['effects-toggle',settings.reducedEffects],['captions-toggle',settings.captions],['handed-toggle',settings.leftHanded]]){$(id).classList.toggle('on',value);$(id).setAttribute('aria-checked',String(value));}
  $('touch-size-input').value=settings.touchSize;$('touch-size-output').textContent=`${settings.touchSize}%`;
  document.body.classList.toggle('left-handed',settings.leftHanded);document.documentElement.style.setProperty('--touch-size',String(settings.touchSize/100));
  $('touch-look-hint').textContent=settings.leftHanded?'Drag the left side to look':'Drag the right side to look';
  if(!settings.captions){$('audio-caption').textContent='';$('audio-caption').hidden=true;}else $('audio-caption').hidden=!$('audio-caption').textContent;setVolume();
}

$('play-button').addEventListener('click',()=>startGame(selectedLevel));$('retry-button').addEventListener('click',()=>startGame(mode==='won'?0:levelIndex));
$('stage-continue').addEventListener('click',()=>startGame(levelIndex+1));
$('stage-menu').addEventListener('click',showMenu);
$('continue-button').addEventListener('click',continueExpedition);
$('training-button').addEventListener('click',()=>startGame(0,{training:true}));
$('training-skip').addEventListener('click',()=>finishTraining(true));
$('save-quit-button').addEventListener('click',saveAndQuit);
$('touch-crouch').addEventListener('click',()=>{if(mode!=='playing')return;touch.crouch=!touch.crouch;$('touch-crouch').setAttribute('aria-pressed',String(touch.crouch));});
document.querySelectorAll('[data-level]').forEach(b=>b.addEventListener('click',()=>{if(mode!=='menu')return;selectedLevel=Number(b.dataset.level);loadLevel(selectedLevel);positionMenuEnemy();updateLevelCards();$('chapter-select').open=false;}));
$('beam-button').addEventListener('click',cycleBeam);
$('crank-button').addEventListener('pointerdown',e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);touch.crank=true;});
$('crank-button').addEventListener('pointerup',()=>touch.crank=false);$('crank-button').addEventListener('pointercancel',()=>touch.crank=false);
$('stun-button').addEventListener('click',fireStun);$('decoy-button').addEventListener('click',throwDecoy);$('ping-button').addEventListener('click',pingObjective);
$('guide-button').addEventListener('click',()=>openModal('guide-dialog'));
$('settings-button').addEventListener('click',()=>openModal('settings-dialog'));
$('pause-settings').addEventListener('click',()=>openModal('settings-dialog'));
for(const id of ['map-open-button','touch-map'])$(id)?.addEventListener('click',()=>{if(mode==='playing'&&!scare&&!activeModal)openModal('map-dialog');});
$('map-resume')?.addEventListener('click',closeModal);
$('map-clear-waypoint')?.addEventListener('click',()=>{survey.waypoint=null;survey.notice='Waypoint cleared.';drawMap();});
$('map-canvas').addEventListener('click',event=>{
  if(activeModal?.id!=='map-dialog')return;
  const canvas=event.currentTarget,rect=canvas.getBoundingClientRect();mapKeyboard=false;
  const cell=surveyCellAt(world,surveyLayout(world,canvas.width,canvas.height),(event.clientX-rect.left)*canvas.width/rect.width,(event.clientY-rect.top)*canvas.height/rect.height);
  selectMapWaypoint(cell);
});
$('map-canvas').addEventListener('keydown',event=>{
  if(activeModal?.id!=='map-dialog')return;
  const movement={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];
  if(movement){
    event.preventDefault();event.stopPropagation();mapKeyboard=true;
    const at=survey.cursor||world.cellAt(player.x,player.z);survey.cursor={x:Math.max(0,Math.min(world.width-1,at.x+movement[0])),z:Math.max(0,Math.min(world.height-1,at.z+movement[1]))};
    const c=survey.cursor,known=explored.has(surveyKey(c.x,c.z));
    survey.notice=`Column ${c.x+1}, row ${c.z+1}. ${!known?'Uncharted area.':world.grid[c.z][c.x]?'Surveyed wall.':'Charted corridor. Press Enter to place a waypoint.'}`;drawMap();
  }else if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();mapKeyboard=true;selectMapWaypoint(survey.cursor||world.cellAt(player.x,player.z));}
  else if(event.key==='Delete'||event.key==='Backspace'){event.preventDefault();event.stopPropagation();survey.waypoint=null;survey.notice='Waypoint cleared.';drawMap();}
});
$('pause-button').addEventListener('click',pauseGame);$('resume-button').addEventListener('click',resumeGame);
$('quit-button').addEventListener('click',showMenu);$('end-menu-button').addEventListener('click',showMenu);
document.querySelector('.brand').addEventListener('click',e=>{e.preventDefault();if(mode==='menu')return;showMenu();});
document.querySelectorAll('.close-dialog,.close-guide,.close-settings').forEach(b=>b.addEventListener('click',closeModal));
document.querySelectorAll('dialog').forEach(dialog=>{
  dialog.addEventListener('cancel',e=>{e.preventDefault();closeModal();});
  dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeModal();});
});
$('volume-input').addEventListener('input',e=>{settings.volume=Number(e.target.value);$('volume-output').textContent=`${settings.volume}%`;setVolume();saveSettings();});
$('sensitivity-input').addEventListener('input',e=>{settings.sensitivity=Number(e.target.value);$('sensitivity-output').textContent=`${settings.sensitivity}%`;saveSettings();});
$('brightness-input').addEventListener('input',e=>{settings.brightness=Number(e.target.value);$('brightness-output').textContent=`${settings.brightness}%`;setBrightness();saveSettings();});
document.querySelectorAll('[data-challenge]').forEach(b=>b.addEventListener('click',()=>{settings.challenge=b.dataset.challenge;updateSettingsUI();saveSettings();}));
document.querySelectorAll('[data-difficulty]').forEach(b=>b.addEventListener('click',()=>{settings.difficulty=b.dataset.difficulty;updateSettingsUI();saveSettings();}));
document.querySelectorAll('[data-quality]').forEach(b=>b.addEventListener('click',()=>{settings.quality=b.dataset.quality;setQuality();updateSettingsUI();saveSettings();}));
$('scares-toggle').addEventListener('click',()=>{settings.scares=!settings.scares;updateSettingsUI();saveSettings();});
$('motion-toggle').addEventListener('click',()=>{settings.motion=!settings.motion;updateSettingsUI();saveSettings();});
$('effects-toggle').addEventListener('click',()=>{settings.reducedEffects=!settings.reducedEffects;updateSettingsUI();saveSettings();});
$('captions-toggle').addEventListener('click',()=>{settings.captions=!settings.captions;updateSettingsUI();saveSettings();});
$('handed-toggle').addEventListener('click',()=>{settings.leftHanded=!settings.leftHanded;updateSettingsUI();saveSettings();});
$('touch-size-input').addEventListener('input',e=>{settings.touchSize=Number(e.target.value);updateSettingsUI();saveSettings();});
let previousVolume=settings.volume||65;
document.querySelectorAll('.sound-button').forEach(b=>b.addEventListener('click',()=>{if(settings.volume>0){previousVolume=settings.volume;settings.volume=0;}else settings.volume=previousVolume;updateSettingsUI();saveSettings();}));
$('fullscreen-button').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{if(mode==='playing')notify('Fullscreen is not available in this browser.');}});
updateSettingsUI();
addEventListener('resize',()=>{if(!renderer)return;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode==='playing')pauseGame();});
addEventListener('blur',()=>{keys.clear();touch.sprint=false;if(mode==='playing')pauseGame();});
document.addEventListener('pointerlockchange',()=>{if(document.pointerLockElement){hadPointerLock=true;}else if(mode==='playing'&&hadPointerLock){pauseGame();}});
$('game').addEventListener('click',()=>{if(mode==='playing'&&!document.pointerLockElement&&!coarse)lockPointer();});
let mouseDragging=false;
$('game').addEventListener('mousedown',e=>{mouseDragging=true;if(e.button===0&&document.pointerLockElement)fireStun();});addEventListener('mouseup',()=>mouseDragging=false);
function look(dx,dy){yaw-=dx*.000045*settings.sensitivity;pitch=Math.max(-1.3,Math.min(1.3,pitch-dy*.000045*settings.sensitivity));}
function touchLook(dx,dy){look(dx*1.2,dy*1.2);}
addEventListener('mousemove',e=>{if(mode==='playing'&&!activeModal&&(document.pointerLockElement||mouseDragging))look(e.movementX,e.movementY);});
addEventListener('keydown',e=>{
  if(activeModal){if(e.code==='KeyM'&&activeModal.id==='map-dialog'){e.preventDefault();closeModal();}return;}
  if(e.code==='Escape'){if(mode==='playing')pauseGame();else if(mode==='paused')resumeGame();return;}
  if(mode!=='playing')return;
  if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','ShiftLeft','ShiftRight','KeyC','KeyE','KeyF','KeyM','KeyQ','KeyR','KeyB','KeyV'].includes(e.code))e.preventDefault();
  keys.add(e.code);
  if(e.repeat)return;
  if(e.code==='KeyB')cycleBeam();if(e.code==='KeyF')toggleFlashlight();if(e.code==='KeyE')interact();if(e.code==='KeyM')openModal('map-dialog');if(e.code==='Space')fireStun();if(e.code==='KeyQ')throwDecoy();if(e.code==='KeyR')pingObjective();
});
addEventListener('keyup',e=>{keys.delete(e.code);if(e.code==='KeyE'){holdTarget=null;holdProgress=0;}});
function syncFlashlight(suppressed=false){
 const profile=BEAMS[beamMode],enabled=flashlightOn&&battery>0&&!suppressed&&!cranking;
 flashlight.visible=enabled;flashlight.angle=profile.angle*settings.brightness/100;flashlight.distance=profile.range;flashlight.penumbra=profile.penumbra;
 flashlight.intensity=profile.intensity*Math.sqrt(settings.brightness/100)*(battery<20?.6+.4*battery/20:1);fillLight.intensity=enabled?.018:0;
}
function cycleBeam(){
 if(mode!=='playing'||scare)return;let next=BEAM_MODES[(BEAM_MODES.indexOf(beamMode)+1)%BEAM_MODES.length];
 if(next==='boost'&&boostLocked){notify('BOOST cooling down. Let heat fall below 30%.');next='focus';}
 beamMode=next;syncFlashlight();audio.torchClick();notify(`${BEAMS[next].label} BEAM · ${BEAMS[next].range} m · ${Math.round(BEAMS[next].drain*60)}% battery/min`,2200);
 updateTraining(0,'beam');
}
function updateTorch(dt){
 const wantsCrank=(keys.has('KeyV')||touch.crank)&&!moving;
 const next=stepTorch({mode:beamMode,battery,heat:torchHeat,locked:boostLocked,crankDone:torchCrankDone},dt,{on:flashlightOn,crank:wantsCrank,stamina});
 battery=next.battery;beamMode=next.mode;torchHeat=next.heat;boostLocked=next.locked;cranking=next.cranking;torchCrankDone=next.crankDone;
 if(cranking){audio.crank();stamina=Math.max(0,stamina-dt*8);heldFlashlight.rotation.z=Math.sin(elapsed*13)*.06;}else heldFlashlight.rotation.z=-.09;
 if(next.overheated){audio.torchClick();notify('BOOST OVERHEATED · Focus beam restored. Allow it to cool.',3500);}
 if(battery>25)batteryWarnings.clear();
 for(const threshold of [20,5])if(battery<=threshold&&!batteryWarnings.has(threshold)){batteryWarnings.add(threshold);notify(threshold===20?'LOW BATTERY · Switch to Flood or find supplies.':'CRITICAL BATTERY · Hold V while still to hand-crank.',3500);}
 if(battery<=0&&flashlightOn){flashlightOn=false;notify('BATTERY EMPTY · Hold V while still to recover up to 25%.',4000);}
 syncFlashlight();
}
function toggleFlashlight(){if(mode!=='playing')return;if(battery<=0){notify('Flashlight depleted. Find an objective or a supply box to recharge.');return;}flashlightOn=!flashlightOn;syncFlashlight();audio.torchClick();}
function markExplored(){revealSurvey(world,survey,player);}
function detectInteraction(){
  interaction=null;direction.set(-Math.sin(yaw),0,-Math.cos(yaw));
  let best=3;
  world.fuses.forEach(f=>{if(collected.has(f.id))return;toTarget.copy(f.position).sub(player);toTarget.y=0;const d=toTarget.length();if(d<best&&direction.dot(toTarget.normalize())>.05&&world.lineOfSight(player,f.position)){best=d;interaction={type:'fuse',item:f};}});
  world.supplies.forEach(f=>{if(!f.mesh.visible)return;toTarget.copy(f.position).sub(player);toTarget.y=0;const d=toTarget.length();if(d<best&&direction.dot(toTarget.normalize())>.05&&world.lineOfSight(player,f.position)){best=d;interaction={type:'supply',item:f};}});
  for(const f of [...world.armory.parts,world.armory.bench]){if(f.kind==='weaponpart'&&(!f.mesh.visible||weaponParts.has(f.id)))continue;toTarget.copy(f.position).sub(player);toTarget.y=0;const d=toTarget.length();if(d<best&&direction.dot(toTarget.normalize())>.05&&world.lineOfSight(player,f.position)){best=d;interaction={type:f.kind,item:f};}}
  const e=world.exit.position;toTarget.copy(e).sub(player);toTarget.y=0;const d=toTarget.length();if(d<3&&direction.dot(toTarget.normalize())>-.2)interaction={type:'exit'};
  $('interaction').hidden=!interaction;$('crosshair').classList.toggle('active',!!interaction);
  if(interaction?.type==='weaponpart'&&!researchDiscovered){researchDiscovered=true;renderTraining();notify('RESEARCH DISCOVERED · Three components unlock an optional stun projector.',4500);}
  if(interaction&&['weaponpart','workbench'].includes(interaction.type)){$('interaction-label').textContent=interaction.type==='weaponpart'?`Hold E · unlock ${interaction.item.label}${holdTarget?` · ${Math.round(holdProgress/interaction.item.hold*100)}%`:''}`:weaponParts.size===3?`Hold E · ${weaponOwned?'recharge':'assemble'} stun projector${holdTarget?` · ${Math.round(holdProgress/STUN.assemblyWork*100)}%`:''}`:`Stun workbench · ${weaponParts.size} / 3 parts`;return;}
  if(interaction)$('interaction-label').textContent=interaction.type==='supply'?'Take supplies · battery + decoy':interaction.type==='fuse'?`${world.level.hold?'Hold E · ':''}${world.level.action}${holdTarget?` · ${Math.round(holdProgress/world.level.hold*100)}%`:''}`:fuseCount===world.targetCount?(levelIndex===3?(archiveDecoded?'Hold E · transmit extraction signal':'Decode the exit signal'):'Enter the next level'):`Exit requires ${world.targetCount-fuseCount} ${world.level.plural}`;
}
function interact(){
  if(mode!=='playing'||scare)return;detectInteraction();if(!interaction)return;
  if(interaction.type==='exit'){if(fuseCount===world.targetCount){if(levelIndex===3&&!archiveDecoded)openControlPuzzle('archive');else if(levelIndex===3){holdTarget={kind:'extraction',mesh:world.exit.mesh,hold:8};holdProgress=0;interactHeld=true;notify('EXTRACTION SIGNAL · Hold E for 8 seconds. The archive can hear you.',5000);}else finishLevel();}else notify(`Exit locked. ${world.targetCount-fuseCount} ${world.level.plural} remaining.`);return;}
  if(interaction.type==='supply'){interaction.item.mesh.visible=false;battery=Math.min(100,battery+35);stamina=100;decoys=Math.min(5,decoys+1);const points=award(75);audio.collect();notify(`SUPPLIES · +35% battery · +1 decoy · +${points} points`);return;}
  if(interaction.type==='workbench'){researchDiscovered=true;renderTraining();if(weaponParts.size<3){notify('Find the coil, capacitor and lens in remote research cases.');return;}if(weaponOwned&&ammo===STUN.charges){notify('Projector fully charged. Keep the spare components.');return;}}
  if(interaction.item?.hold||world.level.hold){holdTarget=interaction.item;holdProgress=0;return;}
  completeObjective(interaction.item);
}
function completeObjective(f){
  if(collected.has(f.id))return;collected.add(f.id);f.mesh.visible=false;fuseCount++;const points=award(250);battery=Math.min(100,battery+24);audio.collect();
  holdTarget=null;holdProgress=0;world.setPower(fuseCount,collected);
  if(fuseCount===2)pendingScare=elapsed+8+Math.random()*12;
  $('fuse-count').textContent=String(fuseCount);document.querySelectorAll('#fuse-slots b').forEach((b,i)=>b.classList.toggle('found',i<fuseCount));
  if(fuseCount===world.targetCount){pendingScare=0;quietUntil=Math.max(quietUntil,elapsed+12);$('objective-title').textContent='Get to the exit';$('objective-detail').textContent=levelIndex===3?'Signal recovered. Escape the archive.':'Exit unlocked. Return to the green door.';notify(`EXIT UNLOCKED · Return to the green door. ${world.objectiveState.notice}`,6000);}
  else notify(`${world.level.item.toUpperCase()} ${fuseCount} / ${world.targetCount} · +${points} points · ${world.objectiveState.notice}`,5000);
  if(levelIndex===3)notify(`TAPE ${f.id} · ENCODED SIGNAL ${10+Number(signalCode(runSeed)[f.id-1])} · ${fuseCount===world.targetCount?'All tapes recovered. Decode the exit signal.':'Find the remaining tapes.'}`,6500);
  interaction=null;$('interaction').hidden=true;
}
function updateWork(dt){
  if(!holdTarget)return;
  if(!(keys.has('KeyE')||interactHeld)||(holdTarget.kind==='extraction'?interaction?.type!=='exit':interaction?.item!==holdTarget)||moving){holdTarget=null;holdProgress=0;return;}
  holdProgress+=dt;if(holdTarget.kind!=='extraction')holdTarget.mesh.rotation.y+=dt*1.8;
  if(holdTarget.kind==='extraction'){$('interaction-label').textContent=`HOLD E · EXTRACTING ${Math.round(holdProgress/8*100)}%`;weaponNoiseUntil=elapsed+1;}
  if(holdProgress>=(holdTarget.hold||world.level.hold)){const item=holdTarget;holdTarget=null;holdProgress=0;if(item.kind==='weaponpart'){weaponParts.add(item.id);item.mesh.visible=false;award(100);audio.collect();notify(`${item.label} RECOVERED · ${weaponParts.size}/3 parts`);}else if(item.kind==='workbench'){weaponOwned=true;ammo=STUN.charges;weaponParts.clear();audio.collect();notify('STUN PROJECTOR READY · 3 charges · aim and press SPACE / click',5000);}else if(item.kind==='extraction')finishLevel();else openControlPuzzle(world.level.kind,item);}
}

function openControlPuzzle(kind,item=null){
  puzzleTarget={kind,item};$('control-result').textContent='';
  const archive=kind==='archive',rule=archive?null:controlPuzzle(kind,item.id,runSeed);
  $('control-title').textContent=archive?'DECODE THE EXIT SIGNAL':rule.title;
  $('control-detail').textContent=archive?`Each tape has a signal offset of +10. Subtract 10 from each value, then enter the digits in tape-number order: ${signalCode(runSeed).split('').map((n,i)=>`Tape 0${i+1}: ${10+Number(n)}`).join(' · ')}`:rule.detail;
  $('machine-controls').hidden=archive;$('signal-controls').hidden=!archive;
  $('control-a').value='0';$('control-b').value='0';$('signal-input').value='';updateControlReadout();
  openModal('control-dialog');
}
function updateControlReadout(){const a=Number($('control-a').value),b=Number($('control-b').value);$('control-readout').textContent=puzzleTarget?.kind==='pool'?`Branch A: ${a} · Branch B: ${b}`:`Inlet: ${a} bar · Outlet: ${b} bar · Total: ${a+b} · Difference: ${Math.abs(a-b)}`;}
for(const id of ['control-a','control-b'])$(id).addEventListener('input',updateControlReadout);
$('control-submit').addEventListener('click',()=>{
  if(!puzzleTarget)return;const {kind,item}=puzzleTarget,rule=kind==='archive'?null:controlPuzzle(kind,item.id,runSeed);
  const valid=kind==='archive'?$('signal-input').value.trim()===signalCode(runSeed):Number($('control-a').value)===rule.a&&Number($('control-b').value)===rule.b;
  if(!valid){$('control-result').textContent=kind==='archive'?'Signal mismatch. Check tape-number order.':'Control mismatch. Check the service label and adjust both controls.';return;}
  puzzleTarget=null;closeModal();if(kind==='archive'){archiveDecoded=true;notify('SIGNAL ACCEPTED · Hold E at the exit for 8 seconds to transmit and escape.',6000);}else completeObjective(item);
});

function selectMapWaypoint(cell){
  const result=selectSurveyWaypoint(world,survey,player,cell);
  const messages={unknown:'Uncharted area. Explore it before placing a waypoint.',wall:'Choose a charted corridor instead of a wall.',blocked:'Furniture blocks this spot. Choose a nearby corridor.',unreachable:'No route through charted corridors yet. Explore a connection first.',cleared:'Waypoint cleared.',selected:''};
  survey.notice=messages[result];if(cell)survey.cursor={...cell};drawMap();
}
function drawMap(){
  const canvas=$('map-canvas'),view=renderSurveyMap(canvas,world,survey,{player,yaw,collected,weaponParts,keyboard:mapKeyboard});
  const location=world.roomAt(player.x,player.z)?.name||'Connecting corridor',cell=world.cellAt(player.x,player.z);
  const text=(id,value)=>{const element=$(id);if(element)element.textContent=value;};
  text('map-level',`FIELD SURVEY / LEVEL ${world.level.code}`);text('map-title',world.level.name.toUpperCase());
  text('map-location',`${location} · ${String(cell.x+1).padStart(2,'0')} / ${String(cell.z+1).padStart(2,'0')}`);
  text('map-explored',`${view.stats.percent}%`);text('map-progress',`${fuseCount} / ${world.targetCount} ${world.level.plural}`);
  let status='Choose a charted corridor to place a waypoint.';
  if(survey.waypoint){const at=survey.waypoint;status=view.path.length&&!view.connected?'Waypoint saved. Move clear of nearby furniture to join the marked corridor.':view.path.length?`Waypoint · ${view.distance} m along charted corridors · column ${at.x+1}, row ${at.z+1}. Select it again to clear.`:'Waypoint saved. No charted route from this position.';}
  text('map-waypoint-status',survey.notice||status);
  if($('map-clear-waypoint'))$('map-clear-waypoint').disabled=!survey.waypoint;
  canvas.setAttribute('aria-label',`North-up explored map of ${world.level.name}. ${location}. ${view.stats.percent} percent charted. ${fuseCount} of ${world.targetCount} ${world.level.plural} complete. ${status}`);
}

function pickPatrol(){
  const cells=[];for(let z=1;z<world.height-1;z++)for(let x=1;x<world.width-1;x++)if(world.grid[z][x]===0)cells.push({x,z});
  const choice=cells[Math.floor(Math.random()*cells.length)];return choice?world.cellCenter(choice.x,choice.z):enemyHome.clone();
}
function makeActor(model,home){return {model,stunnedUntil:0,home:home.clone(),path:[],goal:null,lastKnown:null,alert:0,pathTimer:0,frozen:false,pursuit:createPursuit(),charge:createBrriCharge(),searchTargets:[],searchOrigin:null,chasing:false};}
function useScareModel(model){
  if(scareFace)camera.remove(scareFace);scareFace=model.group.clone(true);scareFace.visible=false;scareFace.userData.faceHeight=model.faceHeight;scareFace.userData.type=model.type;const aura=scareFace.getObjectByName('STUN_AURA');if(aura)aura.visible=false;camera.add(scareFace);
}
function loadLevel(index){
  resetSurvey(survey);mapKeyboard=false;
  clearScare();stunView?.hide();if(decoy){scene.remove(decoy.mesh);decoy.mesh.geometry.dispose();decoy.mesh.material.dispose();decoy=null;}
  if(world)world.dispose();Object.values(enemyModels).forEach(m=>{m.stunAura.visible=false;scene.remove(m.group);});
  levelIndex=index;selectedLevel=index;world=createWorld(THREE,scene,index,runSeed);world.setAtmosphereEffects(settings.reducedEffects);
  sahur=enemyModels[world.level.enemy];actors=world.level.enemies.map((type,i)=>{const model=enemyModels[type],home=world.enemyHomes?.[i]||(i===1?world.cellCenter(3,6):i===2?world.cellCenter(19,17):world.enemySpawn);model.group.position.copy(home);model.group.rotation.x=0;model.group.rotation.y=0;model.group.visible=true;scene.add(model.group);return makeActor(model,home);});
  useScareModel(sahur);nearestActor=actors[0];enemyHome.copy(actors[0].home||sahur.group.position);player.copy(world.spawn);menuCamera.copy(world.introCameraPosition);yaw=0;pitch=0;
  document.documentElement.style.setProperty('--accent',world.level.color);
}
function updateLevelCards(){
  document.querySelectorAll('[data-level]').forEach(b=>{const i=Number(b.dataset.level);b.classList.toggle('selected',i===selectedLevel);b.setAttribute('aria-pressed',String(i===selectedLevel));});
  const resumeLevel=savedExpedition?.checkpoint.levelIndex??checkpoint;
  $('continue-button').hidden=!savedExpedition&&checkpoint===0;$('continue-button').textContent=`${savedExpedition?.suspended?'RESUME':'CONTINUE'} · ${LEVELS[resumeLevel].name.toUpperCase()}`;
  $('play-label').textContent=savedExpedition?'NEW EXPEDITION':'ENTER THE BACKROOMS';
  $('menu').classList.toggle('has-saved-run',!$('continue-button').hidden);
  $('selected-level-code').textContent=LEVELS[selectedLevel].code;$('selected-level-name').textContent=LEVELS[selectedLevel].name;
  let best=0;try{best=Number(localStorage.getItem('sahur-best-score'))||0;}catch{}$('best-score').textContent=best?`BEST EXPEDITION / ${best} PTS`:'NO RECORDED ESCAPES';$('best-score').hidden=!best;$('selected-level-brief').textContent=LEVELS[selectedLevel].brief;
  $('entity-name-menu').textContent=enemyModels[LEVELS[selectedLevel].enemy]?.name||'Tung Tung Tung Sahur';
}
function finishLevel(){
  $('proximity-cue').hidden=true;
  award(Math.max(100,Math.round(900-elapsed*2)));
  if(levelIndex===LEVELS.length-1){endGame(true);return;}
  clearScare();mode='cleared';keys.clear();touch.x=0;touch.y=0;touch.sprint=false;interactHeld=false;hadPointerLock=false;
  if(document.pointerLockElement)document.exitPointerLock();
  checkpoint=Math.max(checkpoint,levelIndex+1);try{localStorage.setItem('sahur-checkpoint',String(checkpoint));}catch{}
  const checkpointSaved=persistExpedition(null,baselineFor(levelIndex+1));
  document.querySelector('#stage-screen .eyebrow').textContent=checkpointSaved?'CHECKPOINT SAVED':'LEVEL CLEARED · KEEP THIS TAB OPEN';
  $('hud').hidden=true;$('stage-screen').hidden=false;$('stage-title').textContent=`${world.level.name.toUpperCase()} CLEARED`;
  $('stage-score').textContent=`${score} PTS · ${formatTime(totalElapsed)} TOTAL`;
  const next=LEVELS[levelIndex+1];$('stage-next').textContent=`NEXT / LEVEL ${next.code} — ${next.name}`;$('stage-brief').textContent=next.brief;$('stage-tip').textContent=next.tip;
  audio.win();setTimeout(()=>{if(mode==='cleared')audio.pause();},1000);
}
function throwDecoy(){
  if(mode!=='playing'||scare)return;if(decoys<=0){notify('No decoys left. Look for supply boxes.');return;}
  const target=player.clone();target.y=.16;const forward=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw));
  for(let d=.4;d<9;d+=.4){const next=player.clone().addScaledVector(forward,d);if(!world.isWalkable(next.x,next.z,.2))break;target.x=next.x;target.z=next.z;}
  placeDecoy(target,elapsed+9,`lure:${elapsed}`);decoys--;audio.knock();notify('DECOY THROWN · Sound hunters investigate the noise.');updateTraining(0,'decoy');
}
function placeDecoy(position,until,id){
  if(decoy){scene.remove(decoy.mesh);decoy.mesh.geometry.dispose();decoy.mesh.material.dispose();}
  const mesh=new THREE.Mesh(new THREE.SphereGeometry(.09,10,8),new THREE.MeshBasicMaterial({color:0xffba6e}));mesh.position.copy(position);scene.add(mesh);decoy={position,until,id,mesh};
}
function pingObjective(){
  if(mode!=='playing'||scare)return;if(elapsed<pingReady){notify(`Scanner recharging · ${Math.ceil(pingReady-elapsed)} s`);return;}pingReady=elapsed+12;
  const targets=world.fuses.filter(f=>!collected.has(f.id)).map(f=>f.position);if(!targets.length)targets.push(world.exit.position);
  targets.sort((a,b)=>a.distanceTo(player)-b.distanceTo(player));const p=targets[0];let angle=Math.atan2(-(p.x-player.x),-(p.z-player.z))-yaw;angle=Math.atan2(Math.sin(angle),Math.cos(angle));
  const bearing=Math.abs(angle)<.55?'ahead':Math.abs(angle)>2.5?'behind you':angle>0?'to your left':'to your right';
  notify(`SCANNER · ${targets.length===1&&fuseCount===world.targetCount?'Exit':world.level.item} ${bearing} · ${Math.round(Math.hypot(p.x-player.x,p.z-player.z))} m`,4500);audio.collect();
}
function fireStun(){
  if(mode!=='playing'||scare||activeModal||cranking)return;
  if(!weaponOwned){notify('Weapon locked · recover 3 components and assemble at the workbench.',3500);return;}
  if(ammo<=0){notify('No charges. Recover three research components to recharge.');return;}
  if(elapsed<stunReady){notify(`Projector cooling down · ${Math.ceil(stunReady-elapsed)} s`);return;}
  const hit=selectStunTarget(THREE,actors,camera,world);ammo--;stunReady=elapsed+STUN.cooldown;weaponNoiseUntil=elapsed+2;
  stunView.fire(elapsed,hit?.distance||STUN.range);audio.stunPulse();
  if(hit){hit.actor.stunnedUntil=elapsed+STUN.duration;hit.actor.alert=0;hit.actor.path=[];hit.actor.pathTimer=0;hit.actor.pursuit=createPursuit(elapsed);hit.actor.charge=createBrriCharge(elapsed);notify(`${hit.actor.model.name.toUpperCase()} STUNNED · ${STUN.duration} s`,2500);}
  else notify('PULSE MISSED · one charge spent',1800);
}
function searchCorners(actor){
  const origin=actor.pursuit.lastKnown;if(!origin)return [];
  const cell=world.cellAt(origin.x,origin.z),key=surveyKey(cell.x,cell.z);
  if(actor.searchOrigin===key)return actor.searchTargets;
  actor.searchOrigin=key;actor.searchTargets=[];
  for(const [dx,dz] of [[-1,0],[0,-1],[1,0],[0,1],[-2,0],[0,-2],[2,0],[0,2]]){
    const x=cell.x+dx,z=cell.z+dz;if(world.grid[z]?.[x]!==0)continue;
    const point=world.cellCenter(x,z);
    if(world.isWalkable(point.x,point.z,.3)&&world.findPath(actor.model.group.position,point).length)actor.searchTargets.push({x:point.x,z:point.z});
    if(actor.searchTargets.length===4)break;
  }
  return actor.searchTargets;
}
function updateEnemy(dt){
  distanceToEnemy=100;alertUntil=0;nearestActor=null;
  if(decoy&&elapsed>=decoy.until){scene.remove(decoy.mesh);decoy.mesh.geometry.dispose();decoy.mesh.material.dispose();decoy=null;}
  camera.updateMatrixWorld(true);const beamOrigin=new THREE.Vector3(),beamDirection=new THREE.Vector3();flashlight.getWorldPosition(beamOrigin);flashlight.target.getWorldPosition(beamDirection);beamDirection.sub(beamOrigin).normalize();
  for(const a of actors){
    const model=a.model,pos=model.group.position;let d=Math.hypot(pos.x-player.x,pos.z-player.z);
    model.stunAura.visible=a.stunnedUntil>elapsed;
    if(model.stunAura.visible){model.stunAura.rotation.y=elapsed*1.8;a.pursuit=createPursuit(elapsed);a.charge=createBrriCharge(elapsed);a.chasing=false;a.alert=0;model.group.rotation.x=0;continue;}
    if(d<distanceToEnemy){distanceToEnemy=d;nearestActor=a;}
    if(training.active||elapsed<enemyGraceUntil){model.animate(elapsedWorld,0,false);continue;}
    const los=d<30&&world.lineOfSight(pos,player);
    audio.setSpatial(soundBearing(player,pos,yaw,!los),model.type);
    const observedDirection=new THREE.Vector3(pos.x-player.x,model.faceHeight-player.y,pos.z-player.z).normalize(),view=new THREE.Vector3(-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch));
    const observed=view.dot(observedDirection)>.8;
    const roomHeight=world.roomAt(pos.x,pos.z)?.height||3.35,target=new THREE.Vector3(pos.x,Math.min(model.faceHeight,roomHeight-.15),pos.z);
    const illumination=beamStrength({origin:beamOrigin,direction:beamDirection,target,on:flashlight.visible,range:flashlight.distance,angle:flashlight.angle,power:battery<20?.6+.4*battery/20:1,blocked:!los});
    const vision=los&&inVisionCone(pos,player,model.group.rotation.y,a.pursuit.phase==='pursue');
    const senses=senseEnemy(model.type,{distance:d,los,vision,moving,sprinting,crouching,flashlight:flashlight.visible,observed,illuminated:illumination>.12,signature:BEAMS[beamMode].signature,working:!!holdTarget||cranking||weaponNoiseUntil>elapsed,difficulty,time:elapsed});a.frozen=senses.frozen;
    a.pursuit=updatePursuit(a.pursuit,{type:model.type,time:elapsed,position:pos,player,senses,decoy,searchTargets:a.pursuit.phase==='search'?searchCorners(a):[]});
    a.alert=a.pursuit.alertUntil;a.lastKnown=a.pursuit.lastKnown?new THREE.Vector3(a.pursuit.lastKnown.x,0,a.pursuit.lastKnown.z):null;
    if(a.pursuit.event){a.pathTimer=0;if(model.type!=='bribri'&&(a.pursuit.event==='pursue'||a.pursuit.event==='investigate'))audio.entityCue(model.type);}
    if(model.type==='spioniro'&&senses.detect&&elapsed>=(a.nextBroadcast||0)){
      a.nextBroadcast=elapsed+3;
      for(const other of actors){
        if(other===a||other.stunnedUntil>elapsed||other.model.group.position.distanceTo(pos)>=24||other.pursuit.phase==='pursue'||other.pursuit.decoyId)continue;
        other.pursuit={...createPursuit(elapsed),phase:'investigate',target:{x:player.x,z:player.z},lastKnown:{x:player.x,z:player.z},cause:'sound',alertUntil:elapsed+5};other.pathTimer=0;
      }
    }
    a.chasing=a.pursuit.phase==='pursue'||a.pursuit.phase==='investigate'&&!a.pursuit.decoyId;
    if(a.chasing){alertUntil=Math.max(alertUntil,a.alert);lastChaseAt=elapsed;quietUntil=Math.max(quietUntil,elapsed+20);}
    if(model.type==='bribri'){
      a.charge=updateBrriCharge(a.charge,{time:elapsed,position:pos,target:a.pursuit.target,detected:a.chasing&&senses.detect&&d<13});
      if(a.charge.event==='windup'){audio.chargeWarning();notify('BRRI PLANTS ITS FEET · Sidestep the charge!',2200);}
      model.group.rotation.x=a.charge.phase==='windup'?-.16:a.charge.phase==='recovery'?.1:0;
    }
    let speed=0;
    if(model.type==='bribri'&&a.charge.phase==='charge'){
      const heading=a.charge.direction,step=senses.speed*difficulty*dt*a.charge.speedMultiplier;
      const nx=pos.x+heading.x*step,nz=pos.z+heading.z*step;
      if(world.isWalkable(nx,nz,.3)){pos.x=nx;pos.z=nz;speed=step/dt;model.group.rotation.y=Math.atan2(heading.x,heading.z);}
      else{a.charge=updateBrriCharge(a.charge,{time:elapsed,position:pos,blocked:true});a.pathTimer=0;}
    }else{
      a.pathTimer-=dt;
      if(a.pathTimer<=0){
        a.pathTimer=a.pursuit.phase==='patrol'?2:.45;
        const destination=a.pursuit.target?new THREE.Vector3(a.pursuit.target.x,0,a.pursuit.target.z):a.goal&&pos.distanceTo(a.goal)>1?a.goal:(a.goal=pickPatrol());
        a.path=world.findPath(pos,destination);
      }
      if(a.path.length&&!senses.frozen){
        const next=a.path[0],v=next.clone().sub(pos);v.y=0;const distance=v.length();
        if(distance<.16)a.path.shift();else{
          v.divideScalar(distance);speed=(a.pursuit.phase==='patrol'?1.2:a.pursuit.phase==='search'?1.5:senses.speed)*difficulty;
          if(model.type==='bribri')speed*=a.charge.speedMultiplier;
          const step=Math.min(speed*dt,distance),nx=pos.x+v.x*step,nz=pos.z+v.z*step;
          if(world.isWalkable(nx,nz,.3)){pos.x=nx;pos.z=nz;}else{a.path=[];a.pathTimer=0;}
          const targetYaw=Math.atan2(v.x,v.z);model.group.rotation.y+=Math.atan2(Math.sin(targetYaw-model.group.rotation.y),Math.cos(targetYaw-model.group.rotation.y))*Math.min(1,dt*9);
        }
      }
    }
    if(!senses.frozen)model.animate(elapsedWorld,speed?speed/3:0,a.chasing);
    d=Math.hypot(pos.x-player.x,pos.z-player.z);
    const canAttack=model.type!=='bribri'||a.charge.canAttack;
    if(!senses.frozen&&canAttack&&d<.9&&world.lineOfSight(pos,player)){
      lastAttacker=model.name;lastDetection={type:model.type,cause:a.pursuit.cause||senses.cause||'proximity'};useScareModel(model);triggerScare(true);return;
    }
  }
}
function clearScare(){
  scare=null;scareEffects?.hide();if(scareFace)scareFace.visible=false;if(scareLight)scareLight.intensity=0;
  document.body.classList.remove('scaring');$('scare-overlay').hidden=true;$('scare-shutter').style.opacity=0;$('scare-overlay').style.setProperty('--signal-noise',0);
  if(camera){camera.fov=72;camera.updateProjectionMatrix();camera.rotation.z=0;}
}
function applyScarePose(p){
  scareFace.visible=p.visible;scareFace.position.set(p.x,p.y,p.z);scareFace.scale.setScalar(p.scale);scareFace.rotation.set(0,p.yaw,p.roll);
  scareLight.intensity=p.light;scareLight.color.setHex(scare?.type==='smiler'?0xb0ffe0:scare?.type==='watcher'?0xd5e0dd:0xffb284);
  const effects=settings.reducedEffects?.3:1;scareEffects?.update(p,scare);$('scare-overlay').style.setProperty('--signal-noise',p.staticAmount*effects);$('scare-overlay').dataset.variant=scare?.variant||'';
  camera.fov=p.fov;camera.updateProjectionMatrix();
  $('scare-overlay').style.opacity=Math.max(p.overlay,p.shutter)*effects;syncFlashlight(scare?.variant==='blackout'&&p.stage==='dread');$('scare-overlay').dataset.stage=p.stage;$('scare-caption').textContent=p.caption;
  $('scare-shutter').style.opacity=p.shutter*effects;
  const shoulder=scareFace.getObjectByName('SAHUR_BAT_SHOULDER'),mouth=scareFace.getObjectByName('SAHUR_MOUTH');
  if(shoulder){shoulder.rotation.x=-1.2+p.strike*.9;shoulder.rotation.z=-.3-p.strike*.3;}
  if(mouth)mouth.scale.y=1+p.strike*.55;
}
function triggerScare(fatal=false,variant){
  if(mode!=='playing'||scare||(!fatal&&elapsed<scareCooldown))return false;
  if(!fatal&&!safeScareMoment())return false;
  if(!settings.scares){if(fatal)endGame(false);return false;}
  if(!fatal)useScareModel(actors[Math.floor(Math.random()*actors.length)]?.model||sahur);
  const type=scareFace.userData.type||world.level.enemy;
  const zone=world.roomAt(player.x,player.z);
  const selected=variant||scareDirector.draw(levelIndex,zone?.design,'room',settings.volume>0),side=Math.random()<.5?-1:1;scareSequence++;
  scare={...scareTimeline(type,selected,fatal),fatal,time:0,side,hitSound:false};scareCooldown=elapsed+38;
  keys.clear();touch.x=0;touch.y=0;touch.sprint=false;holdTarget=null;holdProgress=0;interactHeld=false;
  touch.crank=false;cranking=false;stunView.hide();heldFlashlight.visible=false;$('interaction').hidden=true;$('scare-overlay').hidden=false;document.body.classList.add('scaring');$('proximity-cue').hidden=true;
  world.setBlackout(scare.variant==='blackout'?3:1.5);audio.scarePrelude(type,scare.variant,scare.side);applyScarePose(scarePose(scare,0,settings.motion));return true;
}
function updateScare(dt){
  if(!scare)return;scare.time+=dt;const p=scarePose(scare,scare.time,settings.motion);
  applyScarePose(p);
  if(!scare.hitSound&&scare.time>=p.impact){scare.hitSound=true;audio.jumpscare(scare.fatal,scare.type,scare.variant,scare.side);}
  if(p.done){const fatal=scare.fatal,variant=scare.variant;clearScare();heldFlashlight.visible=true;quietUntil=Math.max(quietUntil,elapsed+14);if(fatal)endGame(false);else if(variant==='door-slam')notify('The doorway is gone.',1800);else if(variant==='signal')notify('Recording restored.',1800);else if(variant==='steam-burst')notify('Pressure stabilised.',1800);}
}
function safeScareMoment(){
  return !training.active&&elapsed>=quietUntil&&elapsed>=enemyGraceUntil&&alertUntil<=elapsed&&distanceToEnemy>=10&&battery>=10&&!holdTarget&&!cranking;
}
function updateHaunting(){
  if(!safeScareMoment())return;
  const zone=world.roomAt(player.x,player.z),cell=world.cellAt(player.x,player.z),room=zone?.id||`hall-${Math.floor(cell.z/4)}`;
  if(pendingScare&&elapsed>=pendingScare&&elapsed>=scareCooldown){pendingScare=0;triggerScare(false,scareDirector.draw(levelIndex,zone?.design,'objective',settings.volume>0));return;}
  if(elapsed>=nextAmbientScare&&elapsed>=scareCooldown&&moving&&!scareRooms.has(room)&&scareRooms.size<3){
    scareRooms.add(room);nextAmbientScare=elapsed+48+Math.random()*24;triggerScare(false);
  }
}
function updateRoomLocation(){
  const room=world.roomAt(player.x,player.z),id=room?.id||'connecting-halls';
  $('room-location').textContent=room?.name.toUpperCase()||'CONNECTING HALLS';
  if(id!==lastRoomId){lastRoomId=id;if(room&&!visitedRooms.has(id)){visitedRooms.add(id);if(elapsed>4)notify(`SECTOR ${room.id} / ${room.name.toUpperCase()}`,2000);}}
}
function updatePlayer(dt){
  let forward=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-touch.y;
  let side=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)+touch.x;
  const length=Math.hypot(forward,side);if(length>1){forward/=length;side/=length;}
  moving=length>.1;crouching=keys.has('KeyC')||touch.crouch;
  if(stamina<=.1)exhausted=true;if(stamina>24)exhausted=false;
  sprinting=moving&&!crouching&&!exhausted&&(keys.has('ShiftLeft')||keys.has('ShiftRight')||touch.sprint);
  const speed=crouching?1.55:sprinting?5.4:3.1;
  if(sprinting)stamina=Math.max(0,stamina-dt*20);else if(!cranking)stamina=Math.min(100,stamina+dt*(moving?9:17));
  const dx=(side*Math.cos(yaw)-forward*Math.sin(yaw))*speed*dt;
  const dz=(-side*Math.sin(yaw)-forward*Math.cos(yaw))*speed*dt;
  if(world.isWalkable(player.x+dx,player.z,.27))player.x+=dx;
  if(world.isWalkable(player.x,player.z+dz,.27))player.z+=dz;
  const targetY=crouching?1.05:1.65;player.y+=(targetY-player.y)*Math.min(1,dt*12);
  const bob=settings.motion&&moving?Math.sin(elapsed*(sprinting?16:10))*(crouching?.013:sprinting?.055:.03):0;
  camera.position.set(player.x,player.y+bob,player.z);
  const shake=settings.motion&&distanceToEnemy<8&&alertUntil>elapsed?Math.sin(elapsed*27)*.005*(1-distanceToEnemy/8):0;
  camera.rotation.set(pitch+shake,yaw,settings.motion&&sprinting?Math.sin(elapsed*8)*.008:0);
  heldFlashlight.position.y=-.34+(settings.motion&&moving?Math.sin(elapsed*(sprinting?16:10))*.018:0);
  heldFlashlight.rotation.x=-.05+(sprinting?.13:0);
  updateTorch(dt);
  if(moving){stepTimer-=dt;if(stepTimer<=0){if(!crouching)audio.step(sprinting);stepTimer=sprinting?.3:crouching?.7:.48;}}else stepTimer=.1;
  markExplored();detectInteraction();updateWork(dt);updateRoomLocation();updateTraining(dt);
}
function updateHUD(dt){
  $('run-time').textContent=formatTime(elapsed);$('stamina-fill').style.width=`${stamina}%`;$('stamina-fill').style.background=stamina<25?'#e8a675':'var(--accent)';$('stamina-label').textContent=stamina<=.1?'EXHAUSTED':stamina<25?'LOW STAMINA':'STAMINA';$('stamina-meter').setAttribute('aria-valuenow',String(Math.round(stamina)));$('battery-fill').style.width=`${battery}%`;$('battery-value').textContent=`${Math.ceil(battery)}%`;$('battery-meter-row').setAttribute('aria-valuenow',String(Math.round(battery)));
  const chasing=!training.active&&elapsed>=enemyGraceUntil&&alertUntil>elapsed,close=distanceToEnemy<13;
  document.querySelector('.entity-meter').classList.toggle('threat',chasing&&close);
  const threat=actors.filter(a=>a.chasing).sort((a,b)=>a.model.group.position.distanceTo(player)-b.model.group.position.distanceTo(player))[0]||nearestActor;
  $('entity-status').textContent=training.active?'FIELD TRAINING · SAFE TO PRACTICE':threat?.charge.phase==='windup'?'BRRI IS WINDING UP':chasing?`${threat?.model.name.toUpperCase()} / ALERT`:nearestActor?.frozen?'WATCHER HELD IN SIGHT':threat?.pursuit.phase==='search'?`${threat.model.name.toUpperCase()} / SEARCHING`:threat?.model.name.toUpperCase()||'LISTEN';
  $('entity-detail').textContent=nearestActor?.frozen&&!chasing?'Keep your flashlight pointed at it.':world.level.tip;
  document.querySelector('.heat-row').hidden=beamMode!=='boost'&&torchHeat<1&&!boostLocked;
  $('crank-button').hidden=battery>25&&!cranking;
  $('hud-hint').hidden=elapsed>45&&!training.active;
  $('weapon-quest').hidden=!researchDiscovered||training.active||(weaponOwned&&ammo>0&&weaponParts.size===0);
  $('beam-mode').textContent=BEAMS[beamMode].label;$('heat-fill').style.width=`${torchHeat}%`;$('heat-value').textContent=`${Math.round(torchHeat)}%`;$('torch-status').textContent=cranking?'CRANKING · NOISY':!flashlightOn?'OFF':boostLocked?'BOOST COOLING':battery<20?'LOW VOLTAGE':`${BEAMS[beamMode].range} m BEAM`;
  $('stun-status').textContent=!weaponOwned?'LOCKED':ammo<=0?'EMPTY':elapsed<stunReady?`${Math.ceil(stunReady-elapsed)}s`:String(ammo);
  $('weapon-quest').textContent=weaponOwned?`STUN PROJECTOR · ${ammo}/3 CHARGES · ${weaponParts.size}/3 SPARE PARTS`:`RARE WEAPON · ${weaponParts.size}/3 PARTS · COIL / CAPACITOR / LENS → WORKBENCH`;
  $('decoy-count').textContent=String(decoys);$('score-value').textContent=String(score);$('ping-status').textContent=elapsed<pingReady?`${Math.ceil(pingReady-elapsed)}s`:'READY';
  const proximity=proximityStrength(distanceToEnemy,!training.active&&elapsed>=enemyGraceUntil&&!scare);
  const cue=$('proximity-cue');cue.hidden=proximity<=0;cue.style.setProperty('--proximity',String(proximity));cue.classList.toggle('still',settings.reducedEffects||!settings.motion);
  const proximityLabel=proximity>.65?'SOMETHING IS VERY CLOSE':proximity>0?'SOMETHING IS CLOSE':'';if($('proximity-label').textContent!==proximityLabel)$('proximity-label').textContent=proximityLabel;
  $('danger-overlay').style.opacity=chasing?Math.max(0,1-distanceToEnemy/15)*.7:0;
  audio.update({distance:training.active||elapsed<enemyGraceUntil?50:distanceToEnemy,moving,sprinting,chasing,enemyType:threat?.model.type||world.level.enemy,level:levelIndex,dt});
}
function frame(now){
  const dt=Math.min(.05,Math.max(.001,(now-lastTime)/1000));lastTime=now;elapsedWorld+=dt;
  world.update?.(elapsedWorld,mode==='paused'||mode==='cleared'?0:dt);
  if(mode==='menu'){
    camera.position.copy(menuCamera);camera.rotation.set(Math.sin(elapsedWorld*.15)*.012,(world.introYaw||0)+Math.sin(elapsedWorld*.12)*.025,0);
    sahur.animate(elapsedWorld,0,false);
  }else if(mode==='playing'){
    if(scare){updateScare(dt);}else{elapsed+=dt;totalElapsed+=dt;updatePlayer(dt);if(mode==='playing')updateEnemy(dt);if(mode==='playing'&&!scare){updateHUD(dt);updateHaunting();}}
  }
  stunView.update(elapsed,mode==='playing'&&weaponOwned&&!scare&&!cranking);
  renderer.render(scene,camera);
  if(mode==='playing'){fpsFrames++;fpsTime+=dt;if(fpsTime>3){if(fpsFrames/fpsTime<24&&settings.quality==='high')lowFpsSeconds+=3;else lowFpsSeconds=0;if(lowFpsSeconds>=9){settings.quality='low';setQuality();updateSettingsUI();notify('Render quality adjusted for smoother play.');lowFpsSeconds=0;}fpsFrames=0;fpsTime=0;}}
  requestAnimationFrame(frame);
}

const joystick=$('joystick'),knob=$('joystick-knob');
joystick.addEventListener('pointerdown',e=>{if(mode!=='playing')return;e.preventDefault();touch.joyId=e.pointerId;joystick.setPointerCapture(e.pointerId);moveJoystick(e);});
joystick.addEventListener('pointermove',e=>{if(e.pointerId===touch.joyId)moveJoystick(e);});
function moveJoystick(e){const r=joystick.getBoundingClientRect(),radius=r.width*.33;const dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2;const l=Math.hypot(dx,dy),scale=l>radius?radius/l:1;touch.x=dx*scale/radius;touch.y=dy*scale/radius;knob.style.transform=`translate(${dx*scale}px,${dy*scale}px)`;}
function resetJoystick(){touch.joyId=null;touch.x=0;touch.y=0;knob.style.transform='';}
joystick.addEventListener('pointerup',resetJoystick);joystick.addEventListener('pointercancel',resetJoystick);
$('touch-sprint').addEventListener('pointerdown',e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);touch.sprint=true;});
$('touch-sprint').addEventListener('pointerup',()=>touch.sprint=false);$('touch-sprint').addEventListener('pointercancel',()=>touch.sprint=false);
$('touch-interact').addEventListener('pointerdown',e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);interactHeld=true;interact();});
$('touch-interact').addEventListener('pointerup',()=>{interactHeld=false;holdTarget=null;holdProgress=0;});$('touch-interact').addEventListener('pointercancel',()=>{interactHeld=false;holdTarget=null;holdProgress=0;});$('touch-flashlight').addEventListener('click',toggleFlashlight);
$('game').addEventListener('pointerdown',e=>{if(!coarse||mode!=='playing')return;if((!settings.leftHanded&&e.clientX<innerWidth*.4)||(settings.leftHanded&&e.clientX>innerWidth*.6))return;touch.lookId=e.pointerId;touch.lastX=e.clientX;touch.lastY=e.clientY;$('game').setPointerCapture(e.pointerId);});
$('game').addEventListener('pointermove',e=>{if(e.pointerId!==touch.lookId||mode!=='playing')return;touchLook(e.clientX-touch.lastX,e.clientY-touch.lastY);touch.lastX=e.clientX;touch.lastY=e.clientY;});
$('game').addEventListener('pointerup',e=>{if(e.pointerId===touch.lookId)touch.lookId=null;});$('game').addEventListener('pointercancel',()=>touch.lookId=null);

if(new URLSearchParams(location.search).has('qa'))window.__backrooms={get state(){return {beamMode,torchHeat,boostLocked,cranking,weaponOwned,ammo,weaponParts:weaponParts.size,scare:scare?{type:scare.type,variant:scare.variant,time:scare.time}:null,mode,levelIndex,score,decoys,totalElapsed,elapsed,stamina,battery,fuseCount,player:player.toArray(),enemy:sahur?.group.position.toArray(),chasing:alertUntil>elapsed,yaw,pitch,drawCalls:renderer?.info.render.calls,researchDiscovered,training:{active:training.active,step:training.step,complete:training.complete},quietUntil,lastChaseAt,enemyGraceUntil,pendingScare,nextAmbientScare,scareCooldown,runRules:{...runRules}};},get checkpoint(){return {...stageCheckpoint};},get settings(){return {...settings};},get survey(){return survey;},map(){markExplored();openModal('map-dialog');},waypoint(x,z){selectMapWaypoint({x,z});},get world(){return world;},get actors(){return actors;},load:loadLevel,skipTraining:()=>finishTraining(true),save:saveAndQuit,continue:continueExpedition,capture:captureSuspension,complete:completeObjective,finish:finishLevel,decoy:throwDecoy,ping:pingObjective,work(f,dt){holdTarget=f;interactHeld=true;interaction={type:"fuse",item:f};moving=false;updateWork(dt);},get scene(){return scene;},get camera(){return camera;},beam:cycleBeam,torchStep: updateTorch,crank(value){touch.crank=value;},battery(value){battery=value;syncFlashlight();},fire:fireStun,torch:toggleFlashlight,scare:triggerScare,start:startGame,interact,pause:pauseGame,resume:resumeGame,menu:showMenu,teleport(x,z,y=1.65){player.set(x,y,z);camera.position.copy(player);},look(y,p=0){yaw=y;pitch=p;},lookInput:look,touchLook,caption:showAudioCaption,advance(seconds){elapsed+=seconds;},enemyAt(x,z){sahur.group.position.set(x,0,z);},render(){renderer.render(scene,camera);},setSetting(k,v){settings[k]=v;updateSettingsUI();}};
