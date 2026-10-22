// Saves contain data only. World-specific collision and entity checks belong to
// the caller, after the corresponding level has been built.
export const EXPEDITION_KEY = 'sahur-expedition-v1';
export const EXPEDITION_VERSION = 1;
const MAX_SAVE_LENGTH = 200000;
const MAX_TIME = 1e9;
const PART_IDS = ['part0', 'part1', 'part2'];
const ENEMY_TYPES = ['sahur','smiler','hound','watcher','ballerina','bribri','spioniro','bombardino'];
const DETECTION_CAUSES = ['sight','light','sound','proximity'];
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const finite = value => typeof value === 'number' && Number.isFinite(value);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const number = (value, min, max, fallback = 0) => finite(value) ? clamp(value, min, max) : fallback;
const integer = (value, min, max, fallback = 0) => Math.floor(number(value, min, max, fallback));
const time = value => number(value, 0, MAX_TIME);
const angle = value => finite(value) ? Math.atan2(Math.sin(value),Math.cos(value)) : 0;
const optionalPoint = value => record(value) && finite(value.x) && finite(value.y) && finite(value.z)
  ? {x:clamp(value.x,-10000,10000), y:clamp(value.y,-100,100), z:clamp(value.z,-10000,10000)} : null;
const flatPoint = value => record(value) && finite(value.x) && finite(value.z)
  ? {x:clamp(value.x,-10000,10000), z:clamp(value.z,-10000,10000)} : null;
const cell = value => record(value) && Number.isInteger(value.x) && Number.isInteger(value.z) && value.x >= 0 && value.z >= 0 && value.x < 256 && value.z < 256
  ? {x:value.x,z:value.z} : null;
const list = (value, limit, transform) => Array.isArray(value) ? value.slice(0,limit).map(transform).filter(value=>value!==null) : [];
const unique = values => [...new Set(values)];
const ids = (value, max, numericMin = 0) => unique(list(value,max,id => Number.isInteger(id) && id >= numericMin && id < 256 ? id : null));
const cellKeys = value => unique(list(value,4096,key => typeof key === 'string' && /^(?:0|[1-9]\d{0,2}),(?:0|[1-9]\d{0,2})$/.test(key) && key.split(',').every(n=>Number(n)<256) ? key : null));
const identifier = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(value) ? value : null;
const roomIds = value => unique(list(value,256,identifier));
const token = value => typeof value === 'string' && /^[a-zA-Z0-9_,.:-]{1,160}$/.test(value) ? value : null;

function checkpoint(value) {
  if (!record(value) || !Number.isInteger(value.levelIndex) || value.levelIndex < 0 || value.levelIndex > 3
    || !finite(value.score) || !finite(value.totalElapsed) || typeof value.weaponOwned !== 'boolean' || !finite(value.ammo)
    || !['easy','normal','hard'].includes(value.difficulty) || !['standard','scarcity'].includes(value.challenge)) return null;
  return {
    ...(finite(value.seed)?{seed:integer(value.seed,0,4294967295)}:{}), levelIndex:value.levelIndex, score:integer(value.score,0,1e9), totalElapsed:time(value.totalElapsed),
    weaponOwned:value.weaponOwned, ammo:value.weaponOwned ? integer(value.ammo,0,3) : 0,
    difficulty:value.difficulty, challenge:value.challenge
  };
}

function actor(value) {
  const position = record(value) && optionalPoint(value.position);
  if (!position || !ENEMY_TYPES.includes(value.type)) return null;
  return {
    type:value.type, position, yaw:angle(value.yaw),
    alert:time(value.alert), lastKnown:optionalPoint(value.lastKnown), goal:optionalPoint(value.goal),
    path:list(value.path,1024,optionalPoint), pathTimer:number(value.pathTimer,-10,60),
    stunnedUntil:time(value.stunnedUntil), frozen:value.frozen===true,
    pursuit:pursuit(value.pursuit), charge:charge(value.charge)
  };
}

function pursuit(value) {
  if (!record(value)) return null;
  return {
    phase:['patrol','pursue','investigate','search'].includes(value.phase)?value.phase:'patrol',
    target:flatPoint(value.target),lastKnown:flatPoint(value.lastKnown),
    cause:DETECTION_CAUSES.includes(value.cause)?value.cause:null,
    alertUntil:time(value.alertUntil),phaseStartedAt:time(value.phaseStartedAt),searchUntil:time(value.searchUntil),
    searchIndex:integer(value.searchIndex,-1,1000,-1),event:null,
    decoyId:token(value.decoyId),consumedDecoyId:token(value.consumedDecoyId)
  };
}

function charge(value) {
  if (!record(value)) return null;
  const raw = flatPoint(value.direction), length = raw ? Math.hypot(raw.x,raw.z) : 0;
  return {
    phase:['idle','windup','charge','recovery'].includes(value.phase)?value.phase:'idle',
    phaseStartedAt:time(value.phaseStartedAt),phaseUntil:time(value.phaseUntil),target:flatPoint(value.target),
    direction:length>.000001?{x:raw.x/length,z:raw.z/length}:null,
    event:null,speedMultiplier:number(value.speedMultiplier,0,2.25),canAttack:value.canAttack===true
  };
}

function decoy(value) {
  const position = record(value) && optionalPoint(value.position);
  const id = record(value) && token(value.id);
  return position && id && finite(value.until) ? {position,until:time(value.until),id} : null;
}

function detection(value) {
  return record(value) && ENEMY_TYPES.includes(value.type) && DETECTION_CAUSES.includes(value.cause)
    ? {type:value.type,cause:value.cause} : null;
}

function snapshot(value, baseline) {
  const player = record(value) && optionalPoint(value.player);
  const required = ['elapsed','score','totalElapsed','yaw','pitch','stamina','battery','decoys','ammo'];
  if (!player || required.some(key=>!finite(value[key])) || typeof value.weaponOwned !== 'boolean') return null;
  const survey = record(value.survey) ? value.survey : {};
  return {
    archiveDecoded:value.archiveDecoded===true, levelIndex:baseline.levelIndex,
    elapsed:time(value.elapsed), score:integer(value.score,0,1e9), totalElapsed:time(value.totalElapsed), player,
    yaw:angle(value.yaw), pitch:number(value.pitch,-Math.PI/2,Math.PI/2),
    stamina:number(value.stamina,0,100), battery:number(value.battery,0,100), decoys:integer(value.decoys,0,5),
    weaponOwned:value.weaponOwned, ammo:value.weaponOwned ? integer(value.ammo,0,3) : 0,
    collected:ids(value.collected,64,1), usedSupplies:ids(value.usedSupplies,64),
    weaponParts:unique(list(value.weaponParts,3,id=>PART_IDS.includes(id)?id:null)),
    usedCases:unique(list(value.usedCases,3,id=>PART_IDS.includes(id)?id:null)),
    survey:{explored:cellKeys(survey.explored), visited:cellKeys(survey.visited), trail:list(survey.trail,240,flatPoint), waypoint:cell(survey.waypoint)},
    flashlightOn:value.flashlightOn!==false, beamMode:['focus','flood','boost'].includes(value.beamMode)?value.beamMode:'focus',
    torchHeat:number(value.torchHeat,0,100), boostLocked:value.boostLocked===true,
    stunReady:time(value.stunReady), weaponNoiseUntil:time(value.weaponNoiseUntil), pingReady:time(value.pingReady),
    actors:list(value.actors,16,actor),decoy:decoy(value.decoy),lastDetection:detection(value.lastDetection),
    scareCooldown:time(value.scareCooldown), pendingScare:time(value.pendingScare), nextAmbientScare:time(value.nextAmbientScare),
    visitedRooms:roomIds(value.visitedRooms), scareRooms:roomIds(value.scareRooms),
    scareSequence:integer(value.scareSequence,0,1e6), lastRoomId:identifier(value.lastRoomId),
    onboarding:{active:value.onboarding?.active===true,step:integer(value.onboarding?.step,0,3),complete:value.onboarding?.complete===true},
    researchDiscovered:value.researchDiscovered===true,
    tension:{quietUntil:time(value.tension?.quietUntil),lastChaseAt:number(value.tension?.lastChaseAt,-MAX_TIME,MAX_TIME),nextAmbientScare:time(value.tension?.nextAmbientScare),scareCooldown:time(value.tension?.scareCooldown),pendingScare:time(value.tension?.pendingScare),scareRooms:roomIds(value.tension?.scareRooms),enemyGraceUntil:time(value.tension?.enemyGraceUntil)}
  };
}

// A damaged suspension falls back to the independently validated stage baseline.
export function normalizeExpedition(value) {
  try {
    if (!record(value) || value.version !== EXPEDITION_VERSION) return null;
    const baseline = checkpoint(value.checkpoint);
    if (!baseline) return null;
    return {version:EXPEDITION_VERSION, checkpoint:baseline, suspended:value.suspended == null ? null : snapshot(value.suspended,baseline)};
  } catch { return null; }
}

export function readExpedition(storage) {
  try {
    const raw = storage.getItem(EXPEDITION_KEY);
    if (typeof raw !== 'string' || raw.length > MAX_SAVE_LENGTH) return null;
    return normalizeExpedition(JSON.parse(raw));
  } catch { return null; }
}

export function writeExpedition(storage, value) {
  try {
    const normalized = normalizeExpedition({version:EXPEDITION_VERSION, checkpoint:value?.checkpoint, suspended:value?.suspended});
    if (!normalized) return false;
    // Never silently replace a requested in-stage save with a baseline save.
    if (value?.suspended != null && !normalized.suspended) return false;
    const raw = JSON.stringify(normalized);
    if (raw.length > MAX_SAVE_LENGTH) return false;
    storage.setItem(EXPEDITION_KEY,raw);
    return true;
  } catch { return false; }
}

export function clearExpedition(storage) {
  try { storage.removeItem(EXPEDITION_KEY); return true; } catch { return false; }
}
