export function updateGameCamera(view,dt) {
let {camOrbitYawOffset,camOrbitPitchOffset}=view;
const {THREE,CAMERA_MODES,currentCamIndex,isSwipingCanvas,carState,carRoot,camera,RAMP,KICKFLIP_LANE,smoothCamPos,smoothLookAt,inputs,cameraEffectsState,getAdaptiveFov,random}=view;

const modeId = CAMERA_MODES[currentCamIndex].id;
const isPortrait = view.width < view.height;
if (!isSwipingCanvas && Math.abs(carState.speed) > 1.5) {
camOrbitYawOffset *= Math.pow(0.88, dt * 60);
camOrbitPitchOffset *= Math.pow(0.88, dt * 60);
}
if (modeId === 'cockpit') {
const localEye = new THREE.Vector3(-0.36, 1.03, 0.08);
localEye.applyEuler(carRoot.rotation);
camera.position.copy(carRoot.position).add(localEye);
const localTarget = new THREE.Vector3(-0.36 - carState.steerAngle * 1.8, 0.72, -12.0);
localTarget.applyEuler(carRoot.rotation);
const worldTarget = carRoot.position.clone().add(localTarget);
const localUp = new THREE.Vector3(0, 1, 0).applyEuler(carRoot.rotation);
camera.up.copy(localUp);
camera.lookAt(worldTarget);
} else if (modeId === 'chase') {
camera.up.set(0, 1, 0);
let desiredPos;
if (carState.mode === 'RAMP' || (carState.mode === 'AIR' && carState.airSubPhase === 'OVERHANG_DROP')) {
const sideDist = isPortrait ? -22.5 : -19.5;
const zDist = isPortrait ? RAMP.entryZ + 14.5 : RAMP.entryZ + 11.5;
desiredPos = new THREE.Vector3(carState.x + sideDist, Math.max(2.6, carState.y * 0.36), zDist);
} else if (carState.autoDemoMode === 'KICKFLIP' && carState.mode === 'AIR') {
desiredPos = new THREE.Vector3(carState.x + (isPortrait ? 18.5 : 15), 3.2, KICKFLIP_LANE.stageZ + 2);
} else {
const baseZ = isPortrait ? 7.8 : 6.8;
const baseY = ( isPortrait ? 2.65 : 2.3 ) + camOrbitPitchOffset * 4.0;
const localOffset = new THREE.Vector3(0, baseY, baseZ);
const chaseEuler = new THREE.Euler(0, carState.yaw + camOrbitYawOffset, 0, 'YXZ');
localOffset.applyEuler(chaseEuler);
desiredPos = carRoot.position.clone().add(localOffset);
desiredPos.y = Math.max(1.1, desiredPos.y);
}
if (carState.mode === 'RAMP' || (carState.mode === 'AIR' && carState.airSubPhase === 'OVERHANG_DROP') || (carState.autoDemoMode === 'KICKFLIP' && carState.mode === 'AIR')) {
smoothCamPos.lerp(desiredPos, Math.min(1, dt * 8.5));
camera.position.copy(smoothCamPos);
const desiredLook = carRoot.position.clone().add(new THREE.Vector3(0, 0.65, 0));
smoothLookAt.lerp(desiredLook, Math.min(1, dt * 15));
camera.lookAt(smoothLookAt);
} else {
smoothCamPos.copy(desiredPos);
camera.position.copy(smoothCamPos);
smoothLookAt.copy(carRoot.position).add(new THREE.Vector3(0, 0.65, 0));
camera.lookAt(smoothLookAt);
}
} else if (modeId === 'cinema') {
camera.up.set(0, 1, 0);
const desiredPos = carState.autoDemoMode === 'KICKFLIP'
? new THREE.Vector3(KICKFLIP_LANE.x + 16, 2.5, KICKFLIP_LANE.stageZ)
: new THREE.Vector3(22, 4.0, -14);
smoothCamPos.lerp(desiredPos, Math.min(1, dt * 5));
camera.position.copy(smoothCamPos);
smoothLookAt.lerp(carRoot.position.clone().add(new THREE.Vector3(0, 0.7, 0)), Math.min(1, dt * 12));
camera.lookAt(smoothLookAt);
} else if (modeId === 'drone') {
camera.up.set(0, 1, 0);
const desiredPos = new THREE.Vector3(carState.x * 0.5 + 18, Math.max(32, carState.y + 20), carState.z + 24);
smoothCamPos.lerp(desiredPos, Math.min(1, dt * 4));
camera.position.copy(smoothCamPos);
smoothLookAt.lerp(new THREE.Vector3(carState.x * 0.7, carState.y * 0.6, carState.z - 6), Math.min(1, dt * 6));
camera.lookAt(smoothLookAt);
}
// ⑦ Dynamic Speed/Boost FOV Warp + 3D Impact Camera Shake
const baseFov = getAdaptiveFov();
const spdRatio = Math.min(1.0, Math.hypot(carState.vx, carState.vz) / 95.0);
const boostFovAdd = inputs.boost ? 5.5 : 0.0;
const targetFov = baseFov + (view.reducedMotion?0:spdRatio * 9.5 + boostFovAdd);
camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 7.5);
camera.updateProjectionMatrix();

if(view.reducedMotion&&cameraEffectsState)cameraEffectsState.shakeIntensity=0;
if (cameraEffectsState && cameraEffectsState.shakeIntensity > 0.005) {
  const s = cameraEffectsState.shakeIntensity;
  camera.position.x += (random() - 0.5) * s * 0.45;
  camera.position.y += (random() - 0.5) * s * 0.35;
  camera.position.z += (random() - 0.5) * s * 0.45;
  cameraEffectsState.shakeIntensity *= Math.pow(0.78, dt * 60);
  if (cameraEffectsState.shakeIntensity < 0.01) cameraEffectsState.shakeIntensity = 0;
}

return {camOrbitYawOffset,camOrbitPitchOffset};
}
