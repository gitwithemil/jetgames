// Gameplay-time encounter state. These helpers do not move models or play effects;
// callers use phase events for animation, captions and audio, and supply reachable
// collision-clear search positions from the current world.
const point = value => value && Number.isFinite(value.x) && Number.isFinite(value.z) ? { x: value.x, z: value.z } : null;
const distance = (a, b) => a && b ? Math.hypot(a.x - b.x, a.z - b.z) : Infinity;
const lureTypes = new Set(['sahur', 'hound', 'bribri', 'ballerina']);
const SEARCH_TIME = 5;
const REACHED_DISTANCE = .8;

export function createPursuit(time = 0) {
  return { phase: 'patrol', target: null, lastKnown: null, cause: null, alertUntil: 0,
    phaseStartedAt: time, searchUntil: 0, searchIndex: -1, event: null,
    decoyId: null, consumedDecoyId: null };
}

function beginSearch(state, time) {
  return { ...state, phase: 'search', phaseStartedAt: time, searchUntil: time + SEARCH_TIME,
    alertUntil: time + SEARCH_TIME, searchIndex: -1, target: point(state.lastKnown),
    consumedDecoyId: state.decoyId || state.consumedDecoyId, decoyId: null, event: 'search' };
}

function returnToPatrol(state, time) {
  return { ...createPursuit(time), consumedDecoyId: state.consumedDecoyId, event: 'patrol' };
}

/** Return a fresh pursuit state. Decoys have a fixed investigation deadline, so a
 * sounding lure cannot perpetually refresh aggro once its location is checked.
 * `reached` is optional; otherwise horizontal distance to the target is used. */
export function updatePursuit(previous, { type = 'sahur', time, position, player, senses = {},
  decoy = null, searchTargets = [], reached, reset = false } = {}) {
  const now = Number.isFinite(time) ? time : 0;
  if (reset) return createPursuit(now);
  let state = { ...(previous || createPursuit(now)), event: null };
  const detected = !!senses.detect;
  const visual = detected && !!senses.visual;
  const closeContact = detected && senses.cause === 'proximity' && distance(position, player) < 1.8;
  const lurePosition = point(decoy?.position);
  const lureId = lurePosition ? `${lurePosition.x},${lurePosition.z},${decoy.until}` : null;
  const lure = lurePosition && decoy.until > now && distance(position, lurePosition) < 34 &&
    lureTypes.has(type) && !visual && !closeContact && lureId !== state.consumedDecoyId;
  const atTarget = reached ?? (distance(position, state.target) < REACHED_DISTANCE);

  if (lure) {
    if (state.decoyId === lureId && state.phase === 'investigate') {
      // Keep the original deadline. Sound repeated every frame is one stimulus.
      if (atTarget || now >= state.alertUntil) state = beginSearch(state, now);
      else return { ...state, target: lurePosition };
    } else {
      return { ...state, phase: 'investigate', phaseStartedAt: now, target: lurePosition,
        lastKnown: lurePosition, cause: 'sound', decoyId: lureId,
        alertUntil: Math.min(decoy.until, now + 6), searchUntil: 0, searchIndex: -1, event: 'investigate' };
    }
  } else if (detected && point(player)) {
    const phase = visual || senses.cause === 'proximity' ? 'pursue' : 'investigate';
    const changed = state.phase !== phase || state.decoyId !== null;
    return { ...state, phase, phaseStartedAt: changed ? now : state.phaseStartedAt,
      target: point(player), lastKnown: point(player), cause: senses.cause || (visual ? 'sight' : 'sound'),
      alertUntil: now + (type === 'smiler' ? 2.5 : 7), searchUntil: 0, searchIndex: -1,
      decoyId: null, event: changed ? phase : null };
  } else if (state.phase === 'pursue' || state.phase === 'investigate') {
    if (atTarget || now >= state.alertUntil) state = beginSearch(state, now);
  }

  if (state.phase !== 'search') return state;
  if (now >= state.searchUntil) return returnToPatrol(state, now);
  const targets = searchTargets.map(point).filter(Boolean);
  if (!targets.length) return state; // World may supply the corners on the next step.
  let index = state.searchIndex;
  if (index < 0 || distance(position, state.target) < REACHED_DISTANCE) {
    do { index++; } while (index < targets.length && distance(position, targets[index]) < REACHED_DISTANCE);
    if (index >= targets.length) return returnToPatrol(state, now);
    return { ...state, searchIndex: index, target: targets[index],
      event: state.event || 'search-target' };
  }
  return state;
}

const BRRI_PHASES = { windup: 1, charge: 1.2, recovery: 1.2 };
const BRRI_SPEED = { idle: 1, windup: 0, charge: 2.25, recovery: .28 };

export function createBrriCharge(time = 0) {
  return { phase: 'idle', phaseStartedAt: time, phaseUntil: 0, target: null, direction: null,
    event: null, speedMultiplier: 1, canAttack: false };
}

function chargePhase(state, phase, time) {
  return { ...state, phase, phaseStartedAt: time, phaseUntil: time + (BRRI_PHASES[phase] || 0),
    event: phase, speedMultiplier: BRRI_SPEED[phase], canAttack: phase === 'charge' };
}

/** Brri must telegraph each encounter before becoming dangerous. The charge uses
 * one committed horizontal direction; ordinary navigation must not steer it.
 * Gameplay `time` naturally pauses with the game. Optional frozen/dt also pauses
 * the deadlines during an in-game freeze; stun/reset discards the attack. */
export function updateBrriCharge(previous, { time, position, target, detected = false,
  reset = false, frozen = false, dt = 0, blocked = false } = {}) {
  const now = Number.isFinite(time) ? time : 0;
  if (reset) return createBrriCharge(now);
  let state = { ...(previous || createBrriCharge(now)), event: null };
  // Saved data can be partial even when the actor position is valid. An
  // incomplete attack must earn a new telegraph instead of crashing or becoming
  // dangerous immediately after a reload.
  const active = state.phase !== 'idle';
  const direction = point(state.direction);
  const directionLength = direction ? Math.hypot(direction.x, direction.z) : 0;
  if (typeof state.phase !== 'string' || !Object.hasOwn(BRRI_SPEED, state.phase) || active && (!Number.isFinite(state.phaseUntil) ||
    !Number.isFinite(state.phaseStartedAt)) || state.phase === 'windup' && !point(state.target) ||
    state.phase === 'charge' && (!Number.isFinite(directionLength) || directionLength < .000001)) state = createBrriCharge(now);
  else if (state.phase === 'charge') state.direction = { x: direction.x / directionLength, z: direction.z / directionLength };
  if (frozen) return { ...state, phaseStartedAt: state.phaseStartedAt + Math.max(0, dt),
    phaseUntil: state.phaseUntil ? state.phaseUntil + Math.max(0, dt) : 0, canAttack: false };
  state.speedMultiplier = BRRI_SPEED[state.phase];
  state.canAttack = state.phase === 'charge';
  if (state.phase === 'idle') {
    if (detected && point(target)) return chargePhase({ ...state, target: point(target), direction: null }, 'windup', now);
    return state;
  }
  if (state.phase === 'windup') {
    if (detected && point(target)) state.target = point(target);
    if (now + 1e-9 < state.phaseUntil) return state;
    if (!point(position)) return createBrriCharge(now);
    const dx = state.target.x - position.x, dz = state.target.z - position.z, length = Math.hypot(dx, dz);
    return chargePhase({ ...state, direction: length ? { x: dx / length, z: dz / length } : { x: 0, z: 0 } }, 'charge', now);
  }
  if (state.phase === 'charge') return blocked || now + 1e-9 >= state.phaseUntil ? chargePhase(state, 'recovery', now) : state;
  if (now + 1e-9 >= state.phaseUntil) return chargePhase({ ...state, target: null, direction: null }, 'idle', now);
  return state;
}

export function deathHint(type, cause = 'sight') {
  const detection = { sight: 'You were seen.', light: 'Your flashlight gave you away.',
    sound: 'Your noise was heard.', proximity: 'You got too close.' }[cause] || 'Your trail was followed.';
  const advice = {
    bribri: 'When Brri plants its feet, sidestep behind cover. Its charge cannot turn; move during its recovery.',
    hound: 'Crouch and stop sprinting or cranking near the Hound. Throw a decoy away from your escape route.',
    watcher: 'Keep the Watcher in your lit beam while facing it, then back toward cover.',
    smiler: 'Switch off your torch and break line of sight before the Smiler reaches you.',
    sahur: 'Break line of sight around a corner, then crouch away from your last seen position.',
    ballerina: 'Light slows Ballerina. Use the beam to create space, then leave its last seen corridor.',
    spioniro: 'Use a narrow beam and avoid sprinting near Spioniro; it can alert nearby entities.',
    bombardino: 'Break line of sight before working on an objective; its machinery noise attracts Bombardino.'
  }[type] || 'Break line of sight, crouch, and move away from your last seen position.';
  return `${detection} ${advice}`;
}
