await advanceLoadingStage(95, "タッチ操作・物理衝突エンジン・タイムアタックシステムを接続中...", "STAGE 6/6 // SYSTEMS READY");
const btnToggleCamera = document.getElementById('btn-toggle-camera');
const btnSubCamera = document.getElementById('btn-sub-camera');
const btnToggleCourse = document.getElementById('btn-toggle-course');
const courseLabelText = document.getElementById('course-label-text');
const btnToggleUi = document.getElementById('btn-toggle-ui');
const uiToggleLabel = document.getElementById('ui-toggle-label');
const topTelemetryPill = document.getElementById('top-telemetry-pill');
const bottomControlsPanel = document.getElementById('bottom-controls-panel');
const cameraLabelText = document.getElementById('camera-label-text');
const cockpitHud = document.getElementById('cockpit-hud');
const stuntToast = document.getElementById('stunt-toast');
let toastTimer = null;
function showToast(msg) {
stuntToast.textContent = msg;
stuntToast.classList.remove('opacity-0', 'translate-y-2');
stuntToast.classList.add('opacity-100', 'translate-y-0');
if (toastTimer) clearTimeout(toastTimer);
toastTimer = setTimeout(() => {
stuntToast.classList.remove('opacity-100', 'translate-y-0');
stuntToast.classList.add('opacity-0', 'translate-y-2');
}, 1600);
}
const nycHudExtras = document.getElementById('nyc-hud-extras');
btnToggleCourse.addEventListener('click', () => {
stopAutoDemo();
stopNycTimeAttack();
if (currentCourse === 'PROVING_GROUND') {
currentCourse = 'NYC';
provingGroundGroup.visible = false;
nycCityGroup.visible = true;
applyCourseWeatherAndLighting('NYC');
if (nycHudExtras) {
nycHudExtras.classList.remove('hidden');
nycHudExtras.classList.add('flex');
}
courseLabelText.textContent = '🗽 コース: NY市街地(昼) ➔ テスト場へ';
resetVehicle(0, 0); // Start at NYC Center (0, 0)!
showToast('☀️ NY市街地コース（晴天の昼間・セダン＆トラック交通・中心(0,0)スタート）');
} else {
currentCourse = 'PROVING_GROUND';
provingGroundGroup.visible = true;
nycCityGroup.visible = false;
applyCourseWeatherAndLighting('PROVING_GROUND');
if (nycHudExtras) {
nycHudExtras.classList.add('hidden');
nycHudExtras.classList.remove('flex');
}
courseLabelText.textContent = '🗽 コース: テスト場 ➔ NY市街地へ';
resetVehicle(0, 36);
showToast('🏟️ McGregor テストコースへ移動しました');
}
});
document.getElementById('btn-time-attack').addEventListener('click', () => {
startNycTimeAttack();
});
document.getElementById('btn-ta-reroll').addEventListener('click', () => {
startNycTimeAttack();
});
document.getElementById('btn-ta-quit').addEventListener('click', () => {
stopNycTimeAttack();
showToast('🗽 タイムアタックを終了し、NYフリー走行に切り替えました');
});
document.getElementById('btn-ta-retry').addEventListener('click', () => {
startNycTimeAttack();
});
document.getElementById('btn-ta-close-modal').addEventListener('click', () => {
stopNycTimeAttack();
});
function setUiHidden(hide) {
uiHidden = hide;
if (uiHidden) {
bottomControlsPanel.classList.add('ui-hidden-bottom');
topTelemetryPill.classList.add('ui-hidden-top');
const pBar = document.getElementById('pursuit-hud-bar');
if (pBar) pBar.classList.add('ui-hidden-top');
uiToggleLabel.textContent = '👁️ UI表示';
} else {
bottomControlsPanel.classList.remove('ui-hidden-bottom');
topTelemetryPill.classList.remove('ui-hidden-top');
const pBar = document.getElementById('pursuit-hud-bar');
if (pBar) pBar.classList.remove('ui-hidden-top');
uiToggleLabel.textContent = '👁️ UI消す';
}
}
btnToggleUi.addEventListener('click', () => {
setUiHidden(!uiHidden);
showToast(uiHidden ? '👁️ 下部パッド・計器を非表示にしました' : '👁️ 下部パッド・計器を表示しました');
});
const trimBtns = {
ROCKET: document.getElementById('trim-rocket'),
THRUST: document.getElementById('trim-thrust'),
PERF: document.getElementById('trim-perf')
};
function selectTrim(key) {
currentTrim = TRIMS[key];
Object.keys(trimBtns).forEach((k) => {
if (k === key) {
trimBtns[k].className = 'px-2 py-1 rounded-lg font-bold bg-red-600 text-white cursor-pointer';
} else {
trimBtns[k].className = 'px-2 py-1 rounded-lg font-semibold text-slate-300 hover:text-white cursor-pointer';
}
});
copvGroup.visible = key === 'ROCKET';
document.getElementById('btn-hover').style.opacity = currentTrim.hasPerimeterFlight ? '1' : '0.45';
document.getElementById('btn-boost').style.opacity = currentTrim.hasRearThrust ? '1' : '0.45';
showToast(`🔧 ${currentTrim.name}`);
}
trimBtns.ROCKET.addEventListener('click', () => selectTrim('ROCKET'));
trimBtns.THRUST.addEventListener('click', () => selectTrim('THRUST'));
trimBtns.PERF.addEventListener('click', () => selectTrim('PERF'));
const btnSuction = document.getElementById('btn-suction-toggle');
const indSuctionCore = document.getElementById('ind-suction-core');
function updateSuctionUI() {
btnSuction.textContent = carState.suctionEnabled ? '🌀 吸引4.7t: ON (壁面静止可)' : '🌀 吸引4.7t: OFF';
indSuctionCore.style.opacity = carState.suctionEnabled ? '1' : '0.2';
}
btnSuction.addEventListener('click', () => {
carState.suctionEnabled = !carState.suctionEnabled;
updateSuctionUI();
showToast(
carState.suctionEnabled
? '🌀 吸引ファン ON (速度0km/hでも反り立つ壁に完全吸着！)'
: '🌀 吸引ファン OFF (壁面吸着解除)'
);
});
function applyCameraMode(idx) {
currentCamIndex = idx;
const mode = CAMERA_MODES[currentCamIndex];
cameraLabelText.textContent = mode.nextHint;
const isCockpit = mode.id === 'cockpit';
exteriorHullGroup.visible = !isCockpit;
cockpitHud.style.opacity = isCockpit && !uiHidden ? '1' : '0';
showToast(`🎥 ${mode.name}`);
}
btnToggleCamera.addEventListener('click', () => {
applyCameraMode(currentCamIndex === 1 ? 0 : 1);
});
btnSubCamera.addEventListener('click', () => {
const nextIdx = currentCamIndex < 2 ? 2 : (currentCamIndex === 2 ? 3 : 0);
applyCameraMode(nextIdx);
});
window.addEventListener('contextmenu', (e) => e.preventDefault());
let autoAccelLocked = false;
const btnAutoAccel = document.getElementById('btn-auto-accel');
function updateAutoAccelUI() {
if (!btnAutoAccel) return;
btnAutoAccel.textContent = autoAccelLocked ? '🔒 自動ACCEL: ON' : '🔒 自動ACCEL: OFF';
btnAutoAccel.className = autoAccelLocked
? 'btn-game glass-bar rounded-xl px-2.5 py-1.5 text-[10px] sm:text-xs font-mono-tech font-bold text-emerald-200 bg-emerald-950/80 border-emerald-400/70 cursor-pointer shadow-md'
: 'btn-game glass-bar rounded-xl px-2.5 py-1.5 text-[10px] sm:text-xs font-mono-tech font-bold text-slate-300 border-white/20 cursor-pointer shadow-md';
document.getElementById('btn-accel').classList.toggle('active', autoAccelLocked || inputs.accel);
}
if (btnAutoAccel) {
btnAutoAccel.addEventListener('click', () => {
initAudio();
triggerHaptic(15);
autoAccelLocked = !autoAccelLocked;
inputs.accel = autoAccelLocked;
if (autoAccelLocked && carState.autoDemoMode) stopAutoDemo();
updateAutoAccelUI();
showToast(autoAccelLocked ? '🔒 自動アクセル巡航 ON（親指を離しても加速維持）' : '🔓 自動アクセル巡航 OFF');
});
}
const touchKeyElements = {
accel: document.getElementById('btn-accel'),
brake: document.getElementById('btn-brake'),
left: document.getElementById('btn-steer-left'),
right: document.getElementById('btn-steer-right'),
boost: document.getElementById('btn-boost'),
hover: document.getElementById('btn-hover'),
rcsSpin: document.getElementById('btn-rcs-spin')
};
const activePointers = new Map(); // pointerId -> inputKey
function syncTouchInputsFromPointers() {
const heldKeys = new Set(activePointers.values());
Object.keys(touchKeyElements).forEach((k) => {
const el = touchKeyElements[k];
const isHeld = heldKeys.has(k) || (k === 'accel' && autoAccelLocked && !heldKeys.has('brake'));
const wasHeld = inputs[k];
inputs[k] = isHeld;
if (el) el.classList.toggle('active', isHeld);
if (isHeld && !wasHeld) {
triggerHaptic(8);
if (k === 'hover') carState.manualHoverBurstTimer = 0;
if (carState.autoDemoMode) stopAutoDemo();
}
});
}
function resolveTouchKeyAtPoint(clientX, clientY) {
const el = document.elementFromPoint(clientX, clientY);
if (!el) return null;
const btn = el.closest('[data-touch-key]');
return btn ? btn.getAttribute('data-touch-key') : null;
}
function bindHoldButton(btnId, inputKey) {
const el = document.getElementById(btnId);
if (!el) return;
el.addEventListener('pointerdown', (e) => {
e.preventDefault();
initAudio();
if (el.setPointerCapture) {
try { el.setPointerCapture(e.pointerId); } catch (err) {}
}
if (inputKey === 'brake' && autoAccelLocked) {
autoAccelLocked = false;
updateAutoAccelUI();
}
activePointers.set(e.pointerId, inputKey);
syncTouchInputsFromPointers();
});
el.addEventListener('pointermove', (e) => {
if (!activePointers.has(e.pointerId)) return;
const hoveredKey = resolveTouchKeyAtPoint(e.clientX, e.clientY);
if (hoveredKey && hoveredKey !== activePointers.get(e.pointerId)) {
activePointers.set(e.pointerId, hoveredKey);
syncTouchInputsFromPointers();
}
});
const releasePointer = (e) => {
if (activePointers.has(e.pointerId)) {
activePointers.delete(e.pointerId);
syncTouchInputsFromPointers();
}
};
el.addEventListener('pointerup', releasePointer);
el.addEventListener('pointercancel', releasePointer);
el.addEventListener('lostpointercapture', releasePointer);
}
bindHoldButton('btn-accel', 'accel');
bindHoldButton('btn-brake', 'brake');
bindHoldButton('btn-steer-left', 'left');
bindHoldButton('btn-steer-right', 'right');
bindHoldButton('btn-boost', 'boost');
bindHoldButton('btn-hover', 'hover');
bindHoldButton('btn-rcs-spin', 'rcsSpin');
document.getElementById('btn-kickflip').addEventListener('click', () => {
if (!currentTrim.hasPerimeterFlight) selectTrim('ROCKET');
if (carState.mode === 'GROUND') {
carState.mode = 'AIR';
carState.airSubPhase = 'KICKFLIP_JUMP';
carState.airTimer = 0;
carState.vy = 13.5; // Powerful 4-nozzle vertical jump burst!
carState.y = 0.4;
} else if (carState.mode === 'RAMP') {
detachFromOverhangIntoAir();
}
carState.rollVel = Math.PI * 2.9;
showToast('🔄 スラスター垂直ジャンプ＆360° Kickflip！');
});
window.addEventListener('keydown', (e) => {
const code = e.code;
if (['KeyW', 'ArrowUp'].includes(code)) { inputs.accel = true; document.getElementById('btn-accel').classList.add('active'); }
if (['KeyS', 'ArrowDown'].includes(code)) { inputs.brake = true; document.getElementById('btn-brake').classList.add('active'); }
if (['KeyA', 'ArrowLeft'].includes(code)) { inputs.left = true; document.getElementById('btn-steer-left').classList.add('active'); }
if (['KeyD', 'ArrowRight'].includes(code)) { inputs.right = true; document.getElementById('btn-steer-right').classList.add('active'); }
if (['ShiftLeft', 'ShiftRight'].includes(code)) { inputs.boost = true; document.getElementById('btn-boost').classList.add('active'); }
if (code === 'Space') { e.preventDefault(); inputs.hover = true; document.getElementById('btn-hover').classList.add('active'); }
if (['KeyQ', 'KeyE'].includes(code)) { inputs.rcsSpin = true; document.getElementById('btn-rcs-spin').classList.add('active'); }
if (code === 'KeyF') { document.getElementById('btn-kickflip').click(); }
if (code === 'KeyG') { btnSuction.click(); }
if (code === 'KeyH') { btnToggleUi.click(); }
if (['KeyV', 'KeyC'].includes(code)) { applyCameraMode(currentCamIndex === 1 ? 0 : 1); }
if (code === 'KeyR') {
if (timeAttackState.active) startNycTimeAttack();
else resetVehicle(currentCourse === 'NYC' ? 0 : 0, currentCourse === 'NYC' ? 0 : 36);
}
});
window.addEventListener('keyup', (e) => {
const code = e.code;
if (['KeyW', 'ArrowUp'].includes(code)) { inputs.accel = false; document.getElementById('btn-accel').classList.remove('active'); }
if (['KeyS', 'ArrowDown'].includes(code)) { inputs.brake = false; document.getElementById('btn-brake').classList.remove('active'); }
if (['KeyA', 'ArrowLeft'].includes(code)) { inputs.left = false; document.getElementById('btn-steer-left').classList.remove('active'); }
if (['KeyD', 'ArrowRight'].includes(code)) { inputs.right = false; document.getElementById('btn-steer-right').classList.remove('active'); }
if (['ShiftLeft', 'ShiftRight'].includes(code)) { inputs.boost = false; document.getElementById('btn-boost').classList.remove('active'); }
if (code === 'Space') { inputs.hover = false; document.getElementById('btn-hover').classList.remove('active'); }
if (['KeyQ', 'KeyE'].includes(code)) { inputs.rcsSpin = false; document.getElementById('btn-rcs-spin').classList.remove('active'); }
});
function resetVehicle(xPos = 0, zPos = 36) {
carState.mode = 'GROUND';
carState.airSubPhase = 'NONE';
carState.airTimer = 0;
carState.suctionEnabled = true;
updateSuctionUI();
carState.x = xPos;
carState.y = 0;
carState.z = zPos;
carState.vx = 0;
carState.vy = 0;
carState.vz = 0;
carState.speed = 0;
carState.yaw = 0;
carState.pitch = 0;
carState.roll = 0;
carState.yawVel = 0;
carState.pitchVel = 0;
carState.rollVel = 0;
carState.rampS = 0;
carState.airMassKg = COPV_MAX_KG;
carState.gForce = 1.0;
carState.launchTiming = false;
carState.launchElapsed = 0;
carState.maxHp = 1000;
carState.hp = 1000;
carState.integrity = 100;
carState.totalDistanceTraveled = 0;
carState.score = 0;
carState.goalBonusScore = 0;
carState.collisionCooldown = 0;
applyVisualDamageToVehicle(carBodyGroup, 0);
carState.suspPitch = 0;
carState.suspRoll = 0;
carState.suspPitchVel = 0;
carState.suspRollVel = 0;
for (let i = 0; i < nycTrafficVehicles.length; i++) {
  const tv = nycTrafficVehicles[i];
  tv.damage = 0;
  tv.crashed = false;
  tv.overturned = false;
  tv.pitch = 0;
  tv.roll = 0;
  resetVehicleVisualDamage(tv.bodyPartsGroup);
}
const uiDmg = document.getElementById('val-damage-pct');
if (uiDmg) {
uiDmg.textContent = '100%';
uiDmg.className = 'text-emerald-300';
}
if (window.__updateNyc700mGeometryCulling) window.__updateNyc700mGeometryCulling(true);
if (typeof resetPolicePursuitState === 'function') {
resetPolicePursuitState();
}
if (typeof resetAllUtilityPoles === 'function') {
resetAllUtilityPoles();
}
if (typeof playerSubsystems !== 'undefined') {
  playerSubsystems.steerPullBias = 0;
  playerSubsystems.enginePowerScale = 1.0;
  playerSubsystems.tirePunctures = 0;
  playerSubsystems.thrusterStability = 1.0;
  updateSubsystemBadgeUI();
}
if (typeof clearAllSkidmarks === 'function') clearAllSkidmarks();
if (typeof resetUrbanProps === 'function') resetUrbanProps();
if (typeof updateWindshieldCrackUI === 'function') updateWindshieldCrackUI();
}
const btnGameoverRetry = document.getElementById('btn-gameover-retry');
if (btnGameoverRetry) {
btnGameoverRetry.addEventListener('click', () => {
if (timeAttackState.active) {
startNycTimeAttack();
} else {
resetVehicle(currentCourse === 'NYC' ? 0 : 0, currentCourse === 'NYC' ? 0 : 36);
showToast('↺ ゲームオーバーからリセットしました');
}
});
}
document.getElementById('btn-reset-car').addEventListener('click', () => {
stopAutoDemo();
if (timeAttackState.active) {
startNycTimeAttack();
} else {
resetVehicle(currentCourse === 'NYC' ? 0 : 0, currentCourse === 'NYC' ? 0 : 36);
showToast('↺ リセットしました');
}
});
const btnAutoDemo = document.getElementById('btn-auto-demo');
const btnKickflipDemo = document.getElementById('btn-kickflip-demo');
function stopAutoDemo() {
carState.autoDemoMode = null;
inputs.accel = inputs.boost = inputs.hover = inputs.rcsSpin = false;
btnAutoDemo.innerHTML = '<span>🚀 壁面静止＆反転着地デモ</span>';
btnKickflipDemo.innerHTML = '<span>🚛 トラック＆4台越えKickflipデモ</span>';
setUiHidden(false);
}
btnAutoDemo.addEventListener('click', () => {
if (carState.autoDemoMode === 'OVERHANG') {
stopAutoDemo();
} else {
if (currentCourse !== 'PROVING_GROUND') btnToggleCourse.click();
selectTrim('ROCKET');
resetVehicle(0, 36);
carState.autoDemoMode = 'OVERHANG';
carState.demoTimer = 0;
btnAutoDemo.innerHTML = '<span>⏹ デモ停止</span>';
setUiHidden(true);
showToast('🚀 反り立つ壁での0km/h完全吸着 ➔ 再加速 ➔ 慣性飛び出し＆パルス反転着地デモ！');
}
});
btnKickflipDemo.addEventListener('click', () => {
if (carState.autoDemoMode === 'KICKFLIP') {
stopAutoDemo();
} else {
if (currentCourse !== 'PROVING_GROUND') btnToggleCourse.click();
selectTrim('ROCKET');
resetVehicle(KICKFLIP_LANE.x, 34);
carState.autoDemoMode = 'KICKFLIP';
carState.demoTimer = 0;
btnKickflipDemo.innerHTML = '<span>⏹ 停止</span>';
btnAutoDemo.innerHTML = '<span>⏹ デモ停止</span>';
setUiHidden(true);
showToast('🚛 公式『The Kickflip』大型セミトラック＋4台をスラスター噴射ジャンプで飛び越えるデモ！');
}
});
const btnSound = document.getElementById('btn-sound');
btnSound.addEventListener('click', () => {
initAudio();
soundEnabled = !soundEnabled;
btnSound.textContent = soundEnabled ? '🔊 音ON' : '🔇 音OFF';
if (!soundEnabled && motorGain && thrusterGain && fanGain) {
motorGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.05);
thrusterGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.05);
fanGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.05);
}
});
const helpModal = document.getElementById('help-modal');
document.getElementById('btn-help').addEventListener('click', () => {
helpModal.classList.remove('hidden');
helpModal.classList.add('flex');
});
['btn-close-help', 'btn-close-help-bottom'].forEach((id) => {
document.getElementById(id).addEventListener('click', () => {
helpModal.classList.add('hidden');
helpModal.classList.remove('flex');
});
});
const uiSpeed = document.getElementById('val-speed');
const uiAltFt = document.getElementById('val-alt-ft');
const ui060 = document.getElementById('val-060');
const uiGasPct = document.getElementById('val-gas-pct');
const uiBadge = document.getElementById('flight-state-badge');
const hudHorizon = document.getElementById('hud-horizon');
const nozDots = [
document.getElementById('noz-fl'),
document.getElementById('noz-fr'),
document.getElementById('noz-ml'),
document.getElementById('noz-mr'),
document.getElementById('noz-rl'),
document.getElementById('noz-rr')
];
function detachFromOverhangIntoAir() {
const pt = getRampPoint(Math.max(0, carState.rampS), carState.x);
carState.mode = 'AIR';
carState.airTimer = 0;
const launchSpeed = Math.max(18, carState.speed);
if (pt.theta > Math.PI * 0.52) {
carState.yaw = Math.PI;
carState.pitch = Math.PI - pt.theta;
carState.roll = Math.PI;
carState.airSubPhase = 'OVERHANG_DROP';
carState.vx = 0;
carState.vy = pt.tangent.y * launchSpeed * 0.62;
carState.vz = pt.tangent.z * launchSpeed * 0.92;
} else {
carState.airSubPhase = 'FREE_AIR';
carState.vx = 0;
carState.vy = pt.tangent.y * launchSpeed;
carState.vz = pt.tangent.z * launchSpeed;
}
}
function updateAutoDemoAI(dt) {
if (!carState.autoDemoMode) return;
carState.demoTimer += dt;
const t = carState.demoTimer;
inputs.accel = false;
inputs.brake = false;
inputs.left = false;
inputs.right = false;
inputs.boost = false;
inputs.hover = false;
inputs.rcsSpin = false;
const maxArc = RAMP.totalArc;
if (carState.autoDemoMode === 'OVERHANG') {
if (carState.mode === 'GROUND' && t < 3.0) {
carState.suctionEnabled = true;
inputs.accel = true;
} else if (carState.mode === 'RAMP') {
carState.suctionEnabled = true;
if (carState.rampS > maxArc * 0.62 && carState.rampS < maxArc * 0.86 && t < 3.5) {
inputs.accel = false; // Zero throttle -> 4.7t suction holds the car locked at 0 km/h on the deep overhanging wall!
} else {
inputs.accel = true;  // Then re-accelerate from 0 km/h straight up the overhang and launch off the lip!
}
} else if (carState.mode === 'GROUND' && t >= 3.0) {
inputs.brake = carState.speed > 2;
if (t > 8.4) {
carState.demoTimer = 0;
resetVehicle(0, 36);
}
}
} else if (carState.autoDemoMode === 'KICKFLIP') {
if (carState.mode === 'GROUND' && carState.z > KICKFLIP_LANE.stageZ + 11.5) {
inputs.accel = true;
} else if (carState.mode === 'GROUND' && carState.z <= KICKFLIP_LANE.stageZ + 11.5 && carState.z > KICKFLIP_LANE.stageZ + 4) {
carState.mode = 'AIR';
carState.airSubPhase = 'KICKFLIP_JUMP';
carState.airTimer = 0;
carState.y = 0.45;
carState.vy = 15.2; // Jumps 7.2m high right over the roof of the White Semi Truck!
carState.vz = -22.5;
carState.rollVel = Math.PI * 2.85;
showToast('🚛 大型セミトラック＆4台の手前で4基リフト噴射ジャンプ➔頭上で360° Kickflip！');
} else if (carState.mode === 'GROUND' && carState.z < KICKFLIP_LANE.stageZ - 4) {
inputs.brake = carState.speed > 2;
if (t > 6.4) {
carState.demoTimer = 0;
resetVehicle(KICKFLIP_LANE.x, 34);
}
}
}
}

