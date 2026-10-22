function stepPhysics(dt) {
  if (policePursuitState.gameOver) {
    updateCrashDebris(dt);
    updateAudio(false, false, false);
    return;
  }
  if (carState.collisionCooldown > 0) carState.collisionCooldown = Math.max(0, carState.collisionCooldown - dt);
  updateAutoDemoAI(dt);
  updateNycTrafficAndCollisions(dt);
  updateAndCollideUtilityPoles(dt);
  updatePolicePursuitSystem(dt);
  if (policePursuitState.gameOver) return;
  updateNycTimeAttack(dt);
  updateCrashDebris(dt);
  updateAll7RealismSystems(dt);


const effects=stepVehicleState(carState,dt,inputs,{trim:currentTrim,course:currentCourse,ramp:RAMP,rampPoint:rampProfile.point,subsystems:playerSubsystems,gripMultiplier:weatherState.gripMultiplier},{collide:()=>resolveBuildingCollisionForBody(carState,true),legacyBrakeReverse:typeof __legacyBrakeReverse==='boolean'?__legacyBrakeReverse:true});
if(effects.trim)selectTrim(effects.trim);
advanceDistance(carState,policePursuitState,timeAttackState,dt);
applyDrivingVisuals({yokeGroup,activeWingGroup,thrusterPlumesGroup,hoverCones,boostCones,rollPulse1FL,rollPulse1RR,rollPulse2FR,rollPulse2RL,rcsLeftCone,rcsRightCone,nozDots,suctionGlowRing,wheels,carRoot,uiSpeed,uiAltFt,uiGasPct,uiBadge,hudHorizon,document,inputs,CAMERA_MODES,currentCamIndex,currentCourse,COPV_MAX_KG,spawnSmokePuff,spawnTireSkidPair,playTireScreechSound,updatePursuitHudUI,random:Math.random},carState,dt,effects);
updateAudio(effects.fireDownwardLift,effects.anyRcs,effects.usingBoost);
}
const smoothCamPos = new THREE.Vector3(0, 3.2, 45);
const smoothLookAt = new THREE.Vector3(0, 1.0, 15);
let camOrbitYawOffset = 0;
let camOrbitPitchOffset = 0;
let isSwipingCanvas = false;
let swipePointerId = null;
let lastSwipeX = 0;
let lastSwipeY = 0;
container.addEventListener('pointerdown', (e) => {
initAudio();
isSwipingCanvas = true;
swipePointerId = e.pointerId;
lastSwipeX = e.clientX;
lastSwipeY = e.clientY;
});
window.addEventListener('pointermove', (e) => {
if (!isSwipingCanvas || e.pointerId !== swipePointerId) return;
const dx = e.clientX - lastSwipeX;
const dy = e.clientY - lastSwipeY;
lastSwipeX = e.clientX;
lastSwipeY = e.clientY;
camOrbitYawOffset -= dx * 0.0065;
camOrbitPitchOffset = Math.max(-0.25, Math.min(0.65, camOrbitPitchOffset + dy * 0.0045));
});
window.addEventListener('pointerup', (e) => {
if (e.pointerId === swipePointerId) {
isSwipingCanvas = false;
swipePointerId = null;
}
});
window.addEventListener('pointercancel', (e) => {
if (e.pointerId === swipePointerId) {
isSwipingCanvas = false;
swipePointerId = null;
}
});
function updateCamera(dt) { ({camOrbitYawOffset,camOrbitPitchOffset}=updateGameCamera({camOrbitYawOffset,camOrbitPitchOffset,THREE,CAMERA_MODES,currentCamIndex,isSwipingCanvas,carState,carRoot,camera,RAMP,KICKFLIP_LANE,smoothCamPos,smoothLookAt,inputs,cameraEffectsState,getAdaptiveFov,random:Math.random,width:window.innerWidth,height:window.innerHeight},dt)); }
function handleViewportResize() {
const w = getViewportW();
const h = getViewportH();
camera.fov = getAdaptiveFov();
camera.aspect = w / Math.max(1, h);
camera.updateProjectionMatrix();
renderer.setSize(w, h);
}
window.addEventListener('resize', handleViewportResize);
window.addEventListener('orientationchange', () => {
setTimeout(handleViewportResize, 120);
});
setTimeout(handleViewportResize, 150);
setTimeout(handleViewportResize, 600);
handleViewportResize();
stepPhysics(0.016);
updateCamera(0.016);
renderer.render(scene, camera);
await advanceLoadingStage(100, "読み込み完了！シミュレーターを起動します", "COMPLETE // 100%");
if (window.__hideLoadingScreen) {
window.__hideLoadingScreen();
}
let lastTime = performance.now();
let fpsFrameCount = 0;
let fpsAccumSec = 0;
function animate(now) {
requestAnimationFrame(animate);
const rawDt = (now - lastTime) / 1000;
const dt = Math.min(rawDt, 0.05);
lastTime = now;
fpsFrameCount++;
fpsAccumSec += rawDt;
if (fpsAccumSec >= 2.0) {
const avgFps = fpsFrameCount / fpsAccumSec;
if (avgFps < 42 && currentPixelRatio > 1.0) {
currentPixelRatio = Math.max(0.85, currentPixelRatio - 0.25);
renderer.setPixelRatio(currentPixelRatio);
}
fpsFrameCount = 0;
fpsAccumSec = 0;
}
stepPhysics(dt);
updateSmoke(dt);
updateCamera(dt);
renderer.render(scene, camera);
}
requestAnimationFrame(animate);
}
(function bootstrapWhenThreeReady() {
let attempts = 0;
function reportStartupFailure(err) {
console.error("Simulator init error:", err);
if (window.__setLoadingGauge) {
window.__setLoadingGauge(0, "起動に失敗しました。ページを再読み込みして再試行してください。", "ERROR");
}
const title = document.getElementById('loading-title');
if (title) title.textContent = '起動に失敗しました';
const hint = document.getElementById('loading-sub-hint');
if (hint) hint.textContent = '再読み込みしても続く場合は、ブラウザのエラー情報を確認してください。';
const screen = document.getElementById('loading-screen');
if (screen) screen.setAttribute('role', 'alert');
}
const timer = setInterval(function () {
attempts++;
if (!window.THREE && attempts >= 45 && window.__installSoftwareThreeShim) {
window.THREE = window.__installSoftwareThreeShim();
}
if (window.THREE) {
clearInterval(timer);
initSimulatorApp().catch(reportStartupFailure);
}
}, 35);
window.addEventListener("load", function () {
if (!window.THREE && window.__installSoftwareThreeShim) {
window.THREE = window.__installSoftwareThreeShim();
}
if (window.THREE && !__simStarted) {
clearInterval(timer);
initSimulatorApp().catch(reportStartupFailure);
}
});
})();
})();
