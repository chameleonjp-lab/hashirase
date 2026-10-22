(function () {
if (window.__simAppBootstrapped) return;
window.__simAppBootstrapped = true;
const allContainers = document.querySelectorAll("#canvas-container");
if (allContainers.length > 1) {
for (let i = 1; i < allContainers.length; i++) {
if (allContainers[i].parentNode) allContainers[i].parentNode.removeChild(allContainers[i]);
}
}
const allLoaders = document.querySelectorAll("#loading-screen");
if (allLoaders.length > 1) {
for (let i = 1; i < allLoaders.length; i++) {
if (allLoaders[i].parentNode) allLoaders[i].parentNode.removeChild(allLoaders[i]);
}
}
var __simStarted = false;
async function initSimulatorApp() {
if (__simStarted) return;
__simStarted = true;
async function advanceLoadingStage(pct, stepMsg, phaseMsg) {
if (window.__setLoadingGauge) {
window.__setLoadingGauge(pct, stepMsg, phaseMsg);
}
await new Promise((resolve) => {
setTimeout(resolve, 140);
});
}
await advanceLoadingStage(24, "WebGL 3D空間・照明・アスファルト路面を初期化中...", "STAGE 2/6 // SCENE & RENDERER");
const COPV_MAX_KG = 375; // 1.5x increased thruster capacity (250kg * 1.5 = 375kg)
const TRIMS = {
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
let currentTrim = TRIMS.ROCKET;
let currentCourse = 'PROVING_GROUND'; // 'PROVING_GROUND' or 'NYC'
const CAMERA_MODES = [
{ id: 'chase', name: '第三者視点', nextHint: '視点: 第三者 ➔ 運転席(左ハンドル)' },
{ id: 'cockpit', name: '運転席視点 (左ハンドル)', nextHint: '視点: 運転席 ➔ 第三者' },
{ id: 'cinema', name: '横シネマ視点', nextHint: '視点: シネマ ➔ 運転席' },
{ id: 'drone', name: '上空ドローン視点', nextHint: '視点: 上空 ➔ 第三者' }
];
let currentCamIndex = 0;
let uiHidden = false;
const inputs = {
accel: false,
brake: false,
left: false,
right: false,
boost: false,
hover: false,
rcsSpin: false
};
const RAMP = {
entryZ: -36,
width: 11.2,
totalArc: 32.5,
maxAngle: Math.PI * 0.865 // ~155.7 degrees deep overhang hook!
};
const KICKFLIP_LANE = {
x: -24,
stageZ: -8
};
const carState = {
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
const topScrollStrip = document.getElementById('top-scroll-strip');
let isDraggingStrip = false;
let startStripX = 0;
let scrollLeftStart = 0;
topScrollStrip.addEventListener('mousedown', (e) => {
isDraggingStrip = true;
startStripX = e.pageX - topScrollStrip.offsetLeft;
scrollLeftStart = topScrollStrip.scrollLeft;
});
window.addEventListener('mouseup', () => { isDraggingStrip = false; });
topScrollStrip.addEventListener('mousemove', (e) => {
if (!isDraggingStrip) return;
const x = e.pageX - topScrollStrip.offsetLeft;
topScrollStrip.scrollLeft = scrollLeftStart - (x - startStripX);
});
let audioCtx = null;
let soundEnabled = false;
let motorOsc = null;
let motorGain = null;
let fanOsc = null;
let fanGain = null;
let thrusterNoiseNode = null;
let thrusterGain = null;
let thrusterFilter = null;
function initAudio() {
if (audioCtx) return;
try {
const AudioContextClass = window.AudioContext || window.webkitAudioContext;
audioCtx = new AudioContextClass();
motorOsc = audioCtx.createOscillator();
motorOsc.type = 'sawtooth';
motorOsc.frequency.value = 110;
const motorFilter = audioCtx.createBiquadFilter();
motorFilter.type = 'bandpass';
motorFilter.frequency.value = 420;
motorFilter.Q.value = 2.5;
motorGain = audioCtx.createGain();
motorGain.gain.value = 0.0;
motorOsc.connect(motorFilter);
motorFilter.connect(motorGain);
motorGain.connect(audioCtx.destination);
motorOsc.start();
fanOsc = audioCtx.createOscillator();
fanOsc.type = 'triangle';
fanOsc.frequency.value = 185;
fanGain = audioCtx.createGain();
fanGain.gain.value = 0.0;
fanOsc.connect(fanGain);
fanGain.connect(audioCtx.destination);
fanOsc.start();
const bufferSize = audioCtx.sampleRate * 2;
const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
const output = noiseBuffer.getChannelData(0);
for (let i = 0; i < bufferSize; i++) {
output[i] = Math.random() * 2 - 1;
}
thrusterNoiseNode = audioCtx.createBufferSource();
thrusterNoiseNode.buffer = noiseBuffer;
thrusterNoiseNode.loop = true;
thrusterFilter = audioCtx.createBiquadFilter();
thrusterFilter.type = 'bandpass';
thrusterFilter.frequency.value = 1200;
thrusterFilter.Q.value = 0.9;
thrusterGain = audioCtx.createGain();
thrusterGain.gain.value = 0.0;
thrusterNoiseNode.connect(thrusterFilter);
thrusterFilter.connect(thrusterGain);
thrusterGain.connect(audioCtx.destination);
thrusterNoiseNode.start();
} catch (e) {
console.warn('Web Audio init skipped:', e);
}
}
function updateAudio(isFiringLift, isFiringRcs, isFiringBoost) {
if (!audioCtx || !soundEnabled) return;
if (audioCtx.state === 'suspended') audioCtx.resume();
const absSpd = Math.abs(carState.speed) * 3.6;
motorOsc.frequency.setTargetAtTime(95 + Math.min(absSpd * 3.0, 820), audioCtx.currentTime, 0.04);
motorGain.gain.setTargetAtTime(Math.min(0.015 + (absSpd / 300) * 0.09, 0.11), audioCtx.currentTime, 0.05);
const suctionActive = carState.suctionEnabled && carState.mode !== 'AIR';
fanOsc.frequency.setTargetAtTime(carState.mode === 'RAMP' ? 280 : 180, audioCtx.currentTime, 0.06);
fanGain.gain.setTargetAtTime(suctionActive ? 0.045 : 0.0, audioCtx.currentTime, 0.06);
const anyGas = isFiringLift || isFiringRcs || isFiringBoost;
const freq = isFiringRcs && !isFiringLift ? 1650 : 950;
const gainVal = isFiringLift || isFiringBoost ? 0.28 : (isFiringRcs ? 0.18 : 0.0);
thrusterFilter.frequency.setTargetAtTime(freq, audioCtx.currentTime, 0.02);
thrusterGain.gain.setTargetAtTime(anyGas ? gainVal : 0.0, audioCtx.currentTime, 0.02);
}
function playCrashSound(impactIntensity = 1.0) {
if (!audioCtx || !soundEnabled) return;
try {
if (audioCtx.state === 'suspended') audioCtx.resume();
const now = audioCtx.currentTime;
const osc = audioCtx.createOscillator();
const gain = audioCtx.createGain();
osc.type = 'sawtooth';
osc.frequency.setValueAtTime(130 * Math.min(1.6, Math.max(0.6, impactIntensity)), now);
osc.frequency.exponentialRampToValueAtTime(28, now + 0.32);
gain.gain.setValueAtTime(Math.min(0.45, 0.18 * impactIntensity), now);
gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
osc.connect(gain);
gain.connect(audioCtx.destination);
osc.start(now);
osc.stop(now + 0.36);
} catch (e) {}
}
