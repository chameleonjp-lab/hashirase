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
const TRIMS = DRIVING_TRIMS;
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
const carState = createCarState();
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
const audioService = typeof __drivingAudio === 'object' ? __drivingAudio : createAudioService({createContext:()=>new (window.AudioContext||window.webkitAudioContext)(),random:Math.random});
function initAudio(){audioService.init();}
function updateAudio(lift,rcs,boost){audioService.update(carState,lift,rcs,boost);}
function playCrashSound(intensity=1){audioService.crash(intensity);}
