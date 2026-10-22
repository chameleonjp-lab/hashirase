import { readonlyCopy, finite } from '../../contracts/validation.js';
export const COPV_CAPACITY = 375;
export const DRIVING_TRIMS = {
ROCKET: {
id: 'ROCKET',
name: 'ROCKET (1席・周囲10基スラスター)',
hasSuction: true,
hasRearThrust: true,
hasPerimeterFlight: true,
accelBase: 38,
thrustBoost: 54,
maxSpeed: 106
},
THRUST: {
id: 'THRUST',
name: 'THRUST (2席・リア4基スラスター)',
hasSuction: true,
hasRearThrust: true,
hasPerimeterFlight: false,
accelBase: 32,
thrustBoost: 40,
maxSpeed: 103
},
PERF: {
id: 'PERF',
name: 'PERFORMANCE (2席・吸引ファン4.7t)',
hasSuction: true,
hasRearThrust: false,
hasPerimeterFlight: false,
accelBase: 28,
thrustBoost: 0,
maxSpeed: 103
}
};
for (const trim of Object.values(DRIVING_TRIMS)) Object.freeze(trim);
Object.freeze(DRIVING_TRIMS);
export const GAME_RAMP = Object.freeze({
entryZ: -36,
width: 11.2,
totalArc: 32.5,
maxAngle: Math.PI * 0.865 // ~155.7 degrees deep overhang hook!
});
export function createCarState(initial = {}) {
  const COPV_MAX_KG = COPV_CAPACITY;
  const state = {
mode: 'GROUND', // 'GROUND', 'RAMP', 'AIR'
airSubPhase: 'NONE', // 'OVERHANG_DROP', 'KICKFLIP_JUMP', 'FREE_AIR', 'CRASH_TUMBLE'
airTimer: 0,
suctionEnabled: true,
x: 0,
y: 0,
z: 36,
vx: 0,
vy: 0,
vz: 0,
speed: 0,
yaw: 0,
pitch: 0,
roll: 0,
yawVel: 0,
pitchVel: 0,
rollVel: 0,
steerAngle: 0,
rampS: 0,
airMassKg: COPV_MAX_KG,
gForce: 1.0,
autoDemoMode: null,
demoTimer: 0,
launchTiming: false,
launchElapsed: 0,
manualHoverBurstTimer: 0,
mass: 1450, // kg (Tesla Roadster curb weight)
maxHp: 1000, // Maximum Health = 1000
hp: 1000,    // Current Health = 1000
integrity: 100, // 100% = pristine, synced with hp / 10
totalDistanceTraveled: 0,
score: 0,
goalBonusScore: 0,
overturnedTimer: 0,
collisionCooldown: 0,
suspPitch: 0,
suspRoll: 0,
suspPitchVel: 0,
suspRollVel: 0,
lastDamagePatternName: ''
};
  if (initial.position) for(const key of ['x','y','z']) { finite(initial.position[key], 'position.'+key); state[key]=initial.position[key]; }
  return state;
}
export function createPursuitState() { return {
  propertyDamageHits: 0, // 物損 (壁・信号・電柱)
  carHits: 0,            // 器物損壊 (一般車両・駐車車両)
  policeHits: 0,         // 公務執行妨害 (パトカー)
  active: false,
  gameOver: false,
  chaseElapsedSec: 0,
  nextSpawnTimer: 30.0,
  propHitCooldown: 0,
  carHitCooldown: 0,
  policeHitCooldown: 0,
  sirenPhase: 0,
  lastDamageCause: ''
}; }
export function createTimeAttackState() { return {
active: false,
finished: false,
elapsedSec: 0,
bestSec: null,
destX: 0,
destZ: -3800,
destName: 'UPPER MANHATTAN // 3.8KM GATE',
startDistKm: 3.80
}; }
export function resetCarState(state, initial = {}) { Object.assign(state, createCarState(initial)); }
export function drivingSnapshot(car, pursuit, timeAttack, metadata) {
  return readonlyCopy({ ...metadata, vehicle: vehicleSnapshot(car), pursuit, timeAttack }, 'driving session');
}
export function vehicleSnapshot(car) {
  // Three.js YXZ convention, expressed without a rendering dependency.
  const cx=Math.cos(car.pitch/2), sx=Math.sin(car.pitch/2), cy=Math.cos(car.yaw/2), sy=Math.sin(car.yaw/2), cz=Math.cos(car.roll/2), sz=Math.sin(car.roll/2);
  return readonlyCopy({
    position:{x:car.x,y:car.y,z:car.z},
    rotation:{x:sx*cy*cz+cx*sy*sz,y:cx*sy*cz-sx*cy*sz,z:cx*cy*sz-sx*sy*cz,w:cx*cy*cz+sx*sy*sz},
    velocity:{x:car.vx,y:car.vy,z:car.vz}, angularVelocity:{x:car.pitchVel,y:car.yawVel,z:car.rollVel},
    wheels:[null,null,null,null], damage:{hp:car.hp,maxHp:car.maxHp,integrity:car.integrity},
    telemetry:{speed:car.speed,mode:car.mode,airSubPhase:car.airSubPhase,gasMass:car.airMassKg,score:car.score,gForce:car.gForce,steerAngle:car.steerAngle,wheelModel:'legacy-visual-only',physicsVersion:'driving-legacy-v1'}
  },'vehicle');
}
