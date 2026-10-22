const TIME_ATTACK_TARGET_DIST = 3800; // 3.8 km (3,800 meters) from NYC Center (0, 0)
const timeAttackState = createTimeAttackState();
const goalBeaconGroup = new THREE.Group();
goalBeaconGroup.visible = false;
goalBeaconGroup.frustumCulled = false;
nycCityGroup.add(goalBeaconGroup);

// Outer towering golden pillar of light (1,800m tall, 16m radius, fog: false so it shines clearly from 3.8km+ away!)
const skyBeamGeo = new THREE.CylinderGeometry(16.0, 16.0, 1800, 24, 1, true);
const skyBeamMat = new THREE.MeshBasicMaterial({
  color: 0xf59e0b,
  transparent: true,
  opacity: 0.55,
  side: THREE.DoubleSide,
  depthWrite: false,
  fog: false
});
const skyBeamMesh = new THREE.Mesh(skyBeamGeo, skyBeamMat);
skyBeamMesh.position.y = 900;
skyBeamMesh.frustumCulled = false;
goalBeaconGroup.add(skyBeamMesh);

// Mid cyan/gold energy column (7.5m radius, 1,800m tall, fog: false)
const midBeamGeo = new THREE.CylinderGeometry(7.5, 7.5, 1800, 20, 1, true);
const midBeamMat = new THREE.MeshBasicMaterial({
  color: 0xfef08a,
  transparent: true,
  opacity: 0.78,
  side: THREE.DoubleSide,
  depthWrite: false,
  fog: false
});
const midBeamMesh = new THREE.Mesh(midBeamGeo, midBeamMat);
midBeamMesh.position.y = 900;
midBeamMesh.frustumCulled = false;
goalBeaconGroup.add(midBeamMesh);

// Bright white laser core (3.0m radius, 1,800m tall, fog: false)
const innerBeamGeo = new THREE.CylinderGeometry(3.0, 3.0, 1800, 16, 1, true);
const innerBeamMat = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0.96,
  side: THREE.DoubleSide,
  depthWrite: false,
  fog: false
});
const innerBeamMesh = new THREE.Mesh(innerBeamGeo, innerBeamMat);
innerBeamMesh.position.y = 900;
innerBeamMesh.frustumCulled = false;
goalBeaconGroup.add(innerBeamMesh);

// High-altitude floating beacon rings (at Y=180m and Y=360m) so the pillar is unmistakable above skyscrapers
const highBeaconRing1 = new THREE.Mesh(
  new THREE.TorusGeometry(28, 3.2, 12, 32),
  new THREE.MeshBasicMaterial({ color: 0xfacc15, fog: false })
);
highBeaconRing1.rotation.x = Math.PI / 2;
highBeaconRing1.position.y = 190;
goalBeaconGroup.add(highBeaconRing1);

const highBeaconRing2 = new THREE.Mesh(
  new THREE.TorusGeometry(42, 4.0, 12, 32),
  new THREE.MeshBasicMaterial({ color: 0x38bdf8, fog: false })
);
highBeaconRing2.rotation.x = Math.PI / 2;
highBeaconRing2.position.y = 360;
goalBeaconGroup.add(highBeaconRing2);
const goalRingGeo = new THREE.RingGeometry(16.0, 21.0, 40);
const goalRingMat = new THREE.MeshBasicMaterial({
color: 0xfacc15,
side: THREE.DoubleSide,
transparent: true,
opacity: 0.88
});
const goalRingMesh = new THREE.Mesh(goalRingGeo, goalRingMat);
goalRingMesh.rotation.x = -Math.PI / 2;
goalRingMesh.position.y = 0.15;
goalBeaconGroup.add(goalRingMesh);
const archPillarGeo = new THREE.BoxGeometry(1.2, 16, 1.2);
const archMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
const archLeft = new THREE.Mesh(archPillarGeo, archMat);
archLeft.position.set(-14, 8, 0);
goalBeaconGroup.add(archLeft);
const archRight = new THREE.Mesh(archPillarGeo, archMat);
archRight.position.set(14, 8, 0);
goalBeaconGroup.add(archRight);
const archTop = new THREE.Mesh(new THREE.BoxGeometry(30, 2.2, 1.6), new THREE.MeshBasicMaterial({ color: 0x10b981 }));
archTop.position.set(0, 16.5, 0);
goalBeaconGroup.add(archTop);
const navArrowGroup = new THREE.Group();
navArrowGroup.visible = false;
scene.add(navArrowGroup);
const arrowCone = new THREE.Mesh(
new THREE.ConeGeometry(0.55, 1.6, 12),
new THREE.MeshBasicMaterial({ color: 0xfacc15 })
);
arrowCone.rotation.x = -Math.PI / 2;
arrowCone.position.z = -0.6;
navArrowGroup.add(arrowCone);
const arrowTail = new THREE.Mesh(
new THREE.BoxGeometry(0.35, 0.22, 1.1),
new THREE.MeshBasicMaterial({ color: 0x10b981 })
);
arrowTail.position.z = 0.5;
navArrowGroup.add(arrowTail);
function formatTimeAttackSec(sec) {
const mins = Math.floor(sec / 60);
const rem = sec - mins * 60;
const sInt = Math.floor(rem);
const hund = Math.floor((rem - sInt) * 100);
return `${String(mins).padStart(2, '0')}:${String(sInt).padStart(2, '0')}.${String(hund).padStart(2, '0')}`;
}
function pickRandom38KmDestination() {
const candidates = [];
const sectorNames = [
{ dir: 'NORTH', label: 'HARLEM / UPPER MANHATTAN' },
{ dir: 'SOUTH', label: 'LOWER MANHATTAN / BATTERY' },
{ dir: 'EAST',  label: 'EAST RIVER / QUEENS GATE' },
{ dir: 'WEST',  label: 'HUDSON / WEST SIDE HWY' }
];
NYC_AVES.forEach((ax) => {
NYC_STS.forEach((sz) => {
const euclidDist = Math.hypot(ax, sz);
if (euclidDist >= 3680 && euclidDist <= 3920) {
let area = 'MANHATTAN OUTER RING';
if (sz <= -2600) area = 'NORTH UPTOWN // 3.8KM GATE';
else if (sz >= 2600) area = 'SOUTH FINANCIAL // 3.8KM GATE';
else if (ax >= 2600) area = 'EAST SIDE // 3.8KM GATE';
else if (ax <= -2600) area = 'WEST SIDE // 3.8KM GATE';
candidates.push({ x: ax, z: sz, dist: euclidDist, name: `${area} (${(euclidDist / 1000).toFixed(2)}km)` });
}
});
});
if (!candidates.length) {
candidates.push({ x: 0, z: -3800, dist: 3800, name: 'NORTH AVENUE // 3.80km GATE' });
}
const chosen = candidates[Math.floor(Math.random() * candidates.length)];
timeAttackState.destX = chosen.x;
timeAttackState.destZ = chosen.z;
timeAttackState.destName = chosen.name;
timeAttackState.startDistKm = chosen.dist / 1000;
goalBeaconGroup.position.set(chosen.x, 0, chosen.z);
goalBeaconGroup.visible = true;
}
function startNycTimeAttack() {
stopAutoDemo();
if (currentCourse !== 'NYC') {
currentCourse = 'NYC';
provingGroundGroup.visible = false;
nycCityGroup.visible = true;
applyCourseWeatherAndLighting('NYC');
const nycExtras = document.getElementById('nyc-hud-extras');
if (nycExtras) {
nycExtras.classList.remove('hidden');
nycExtras.classList.add('flex');
}
document.getElementById('course-label-text').textContent = '🗽 コース: NY市街地(半径2km+) ➔ テスト場へ';
}
resetVehicle(0, 0);
pickRandom38KmDestination();
const angleToGoal = Math.atan2(-(timeAttackState.destX - 0), -(timeAttackState.destZ - 0));
const snapAngles = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
let bestSnap = 0;
let minDiff = 999;
snapAngles.forEach((sa) => {
const diff = Math.abs(Math.atan2(Math.sin(angleToGoal - sa), Math.cos(angleToGoal - sa)));
if (diff < minDiff) {
minDiff = diff;
bestSnap = sa;
}
});
carState.yaw = bestSnap;
timeAttackState.active = true;
timeAttackState.finished = false;
timeAttackState.elapsedSec = 0;
navArrowGroup.visible = true;
const taHud = document.getElementById('time-attack-hud');
if (taHud) {
taHud.classList.remove('hidden');
taHud.classList.add('flex');
}
const finishModal = document.getElementById('ta-finish-modal');
if (finishModal) {
finishModal.classList.add('hidden');
finishModal.classList.remove('flex');
}
const destLabel = document.getElementById('ta-dest-name');
if (destLabel) destLabel.textContent = timeAttackState.destName;
const btnLabel = document.getElementById('time-attack-btn-label');
if (btnLabel) btnLabel.textContent = '🏁 3.8kmタイムアタック中 (再抽選)';
showToast(`🏁 NY中心(0,0)からスタート！3.8km先の黄金ビーコンを目指せ！`);
}
function stopNycTimeAttack() {
timeAttackState.active = false;
timeAttackState.finished = false;
goalBeaconGroup.visible = false;
navArrowGroup.visible = false;
const taHud = document.getElementById('time-attack-hud');
if (taHud) {
taHud.classList.add('hidden');
taHud.classList.remove('flex');
}
const finishModal = document.getElementById('ta-finish-modal');
if (finishModal) {
finishModal.classList.add('hidden');
finishModal.classList.remove('flex');
}
const btnLabel = document.getElementById('time-attack-btn-label');
if (btnLabel) btnLabel.textContent = '🏁 NY 3.8kmタイムアタック';
}
function renderTimeAttackMiniMap(distMeters, relAngle) {
  const canvas = document.getElementById('ta-minimap-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  const cx = w * 0.5;
  const cy = h * 0.5;

  ctx.clearRect(0, 0, w, h);

  // Dark radar background
  ctx.fillStyle = '#070c18';
  ctx.fillRect(0, 0, w, h);

  // Scale: map covers [-4200 .. +4200] across 136px -> 1px = ~65m
  const mapRadiusMeters = 4300;
  const scale = (w * 0.46) / mapRadiusMeters;
  const toMapX = (wx) => cx + wx * scale;
  const toMapY = (wz) => cy + wz * scale;

  // Draw Manhattan Avenue & Street Grid lines
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
  ctx.lineWidth = 1;
  for (let i = 0; i < NYC_AVES.length; i++) {
    const mx = toMapX(NYC_AVES[i]);
    ctx.beginPath();
    ctx.moveTo(mx, 4);
    ctx.lineTo(mx, h - 4);
    ctx.stroke();
  }
  for (let j = 0; j < NYC_STS.length; j += 2) {
    const my = toMapY(NYC_STS[j]);
    ctx.beginPath();
    ctx.moveTo(4, my);
    ctx.lineTo(w - 4, my);
    ctx.stroke();
  }

  // Draw 700m Active Render Radius Circle around Player
  const px = toMapX(carState.x);
  const py = toMapY(carState.z);
  const cullRadiusPx = Math.max(8, 700 * scale);
  ctx.strokeStyle = 'rgba(16, 185, 129, 0.55)';
  ctx.fillStyle = 'rgba(16, 185, 129, 0.10)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(px, py, cullRadiusPx, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Draw Guiding Line from Player to Destination
  const gx = toMapX(timeAttackState.destX);
  const gy = toMapY(timeAttackState.destZ);
  ctx.strokeStyle = 'rgba(250, 204, 21, 0.85)';
  ctx.lineWidth = 1.8;
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(gx, gy);
  ctx.stroke();
  ctx.setLineDash([]);

  // Draw Chasing Police Cars (Red/Blue dots)
  if (typeof policeUnits !== 'undefined') {
    for (let i = 0; i < policeUnits.length; i++) {
      const pu = policeUnits[i];
      ctx.fillStyle = (Math.floor(performance.now() / 150) + i) % 2 === 0 ? '#ef4444' : '#3b82f6';
      ctx.beginPath();
      ctx.arc(toMapX(pu.x), toMapY(pu.z), 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Draw Destination Pillar of Light Beacon (Pulsing Gold Star/Circle)
  const pulseR = 4.5 + Math.sin(performance.now() * 0.008) * 1.8;
  ctx.fillStyle = 'rgba(250, 204, 21, 0.35)';
  ctx.beginPath();
  ctx.arc(gx, gy, pulseR + 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#facc15';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(gx, gy, 4.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Draw Player Car Directional Triangle
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(-carState.yaw);
  ctx.fillStyle = '#38bdf8';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, -6.5);
  ctx.lineTo(4.5, 5.0);
  ctx.lineTo(0, 2.8);
  ctx.lineTo(-4.5, 5.0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function updateNycTimeAttack(dt) {
if (!timeAttackState.active || currentCourse !== 'NYC') return;
goalRingMesh.rotation.z += dt * 1.8;
skyBeamMesh.material.opacity = 0.45 + 0.20 * Math.sin(performance.now() * 0.006);
midBeamMesh.material.opacity = 0.70 + 0.20 * Math.cos(performance.now() * 0.008);
highBeaconRing1.position.y = 180 + Math.sin(performance.now() * 0.004) * 25;
highBeaconRing2.position.y = 360 + Math.cos(performance.now() * 0.004) * 30;

const dx = timeAttackState.destX - carState.x;
const dz = timeAttackState.destZ - carState.z;
const distMeters = Math.hypot(dx, dz);
const distKm = distMeters / 1000;
navArrowGroup.position.set(carState.x, carState.y + 2.65, carState.z);
const targetYaw = Math.atan2(-dx, -dz);
navArrowGroup.rotation.y = targetYaw;

const relAngle = Math.atan2(Math.sin(targetYaw - carState.yaw), Math.cos(targetYaw - carState.yaw));
const deg = Math.round((-relAngle * 180) / Math.PI);

const compassEl = document.getElementById('ta-compass-arrow');
if (compassEl) {
  compassEl.style.transform = `rotate(${deg}deg)`;
}
const dirTextEl = document.getElementById('ta-dir-text');
if (dirTextEl) {
  const absDeg = Math.abs(deg);
  let dirHint = '▲ 直進';
  if (absDeg <= 15) dirHint = `▲ 直進 (${absDeg}°)`;
  else if (deg > 15 && deg < 135) dirHint = `↱ 右方向 (${deg}°)`;
  else if (deg < -15 && deg > -135) dirHint = `↰ 左方向 (${Math.abs(deg)}°)`;
  else dirHint = `🔄 後方Uターン (${absDeg}°)`;
  dirTextEl.textContent = dirHint;
}
const distEl = document.getElementById('ta-dist-val');
if (distEl) distEl.textContent = distKm.toFixed(2);
const distMetersEl = document.getElementById('ta-dist-meters');
if (distMetersEl) distMetersEl.textContent = `(${Math.round(distMeters)}m)`;

renderTimeAttackMiniMap(distMeters, relAngle);
if (!timeAttackState.finished) {
timeAttackState.elapsedSec += dt;
const timerEl = document.getElementById('ta-timer-val');
if (timerEl) timerEl.textContent = formatTimeAttackSec(timeAttackState.elapsedSec);
if (distMeters <= 24.0) {
timeAttackState.finished = true;
const clearTime = timeAttackState.elapsedSec;
if (timeAttackState.bestSec === null || clearTime < timeAttackState.bestSec) {
timeAttackState.bestSec = clearTime;
}
const timeBonus = Math.max(0, Math.round((150 - clearTime) * 100));
const hpBonus = Math.round(carState.hp * 8);
carState.goalBonusScore = 15000 + timeBonus + hpBonus;
updatePursuitHudUI();
const fTimeEl = document.getElementById('ta-finish-time');
const fScoreEl = document.getElementById('ta-finish-score');
const fBestEl = document.getElementById('ta-finish-best');
const fDestEl = document.getElementById('ta-finish-dest');
const fDistEl = document.getElementById('ta-finish-dist');
const fIntEl = document.getElementById('ta-finish-integrity');
const fPropEl = document.getElementById('ta-finish-prop');
const fVanEl = document.getElementById('ta-finish-van');
const fObsEl = document.getElementById('ta-finish-obs');
if (fTimeEl) fTimeEl.textContent = formatTimeAttackSec(clearTime);
if (fScoreEl) fScoreEl.textContent = `🏆 最終スコア: ${carState.score.toLocaleString()} pt`;
if (fBestEl) fBestEl.textContent = `🏆 ベストタイム: ${formatTimeAttackSec(timeAttackState.bestSec)}`;
if (fDestEl) fDestEl.textContent = `到達地点: ${timeAttackState.destName}`;
if (fDistEl) fDistEl.textContent = `${timeAttackState.startDistKm.toFixed(2)} km`;
if (fIntEl) fIntEl.textContent = `${carState.hp} / ${carState.maxHp}`;
if (fPropEl) fPropEl.textContent = `${policePursuitState.propertyDamageHits}回`;
if (fVanEl) fVanEl.textContent = `${policePursuitState.carHits}回`;
if (fObsEl) fObsEl.textContent = `${policePursuitState.policeHits}回`;
const finishModal = document.getElementById('ta-finish-modal');
if (finishModal) {
finishModal.classList.remove('hidden');
finishModal.classList.add('flex');
}
showToast(`🏁 3.8km ゴール到達！タイム: ${formatTimeAttackSec(clearTime)}`);
}
}
}
