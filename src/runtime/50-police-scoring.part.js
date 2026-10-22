// ==========================================
// POLICE PURSUIT & 2-HIT GAME OVER SYSTEM
// ==========================================
const policePursuitState = {
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
};

// ============================================================================
// GAME-BALANCED SPEED-BASED DAMAGE & OFFENSE SCORING ENGINE (MAX HP = 1000)
// - Civilian Vehicle (器物損壊): base speed-scaled damage
// - Police Cruiser (公務執行妨害): strictly 2x Civilian Vehicle damage at same speed!
// - Property Damage (物損: 壁・信号・電柱): moderate speed-scaled structural damage
// - Game Over ONLY when HP reaches 0 (car totaled / unable to reach destination)
// ============================================================================
function calculateBalancedCollisionDamage(category, impactSpeedMs) {
  const impactKmh = Math.max(12.0, impactSpeedMs * 3.6);
  // Normalized speed factor: 0.5 at 60 km/h, 1.0 at 120 km/h, 2.0 at 240 km/h
  const spdFactor = Math.max(0.16, Math.min(2.6, impactKmh / 120.0));

  // Base Civilian Car collision damage formula (器物損壊):
  // ~28 HP at 30 km/h, ~42 HP at 60 km/h, ~70 HP at 120 km/h, ~126 HP at 240 km/h
  const civilianBaseDamage = Math.round(14 + 56 * spdFactor);

  if (category === 'CIVILIAN_CAR') {
    return { hpLoss: civilianBaseDamage, impactKmh: Math.round(impactKmh), offenseName: '器物損壊', penaltyPt: 350 };
  }
  if (category === 'POLICE_CAR') {
    // Strictly 2x the damage of a civilian car at the same collision speed!
    return { hpLoss: civilianBaseDamage * 2, impactKmh: Math.round(impactKmh), offenseName: '公務執行妨害', penaltyPt: 700 };
  }
  if (category === 'WALL') {
    // Building wall impact (物損): ~29 HP at 60 km/h, ~48 HP at 120 km/h
    const wallDmg = Math.round(10 + 38 * spdFactor);
    return { hpLoss: wallDmg, impactKmh: Math.round(impactKmh), offenseName: '物損(壁)', penaltyPt: 150 };
  }
  // Utility pole or Traffic signal impact (物損: 信号・電柱): ~21 HP at 60 km/h, ~34 HP at 120 km/h
  const poleDmg = Math.round(8 + 26 * spdFactor);
  return { hpLoss: poleDmg, impactKmh: Math.round(impactKmh), offenseName: category === 'SIGNAL' ? '物損(信号)' : '物損(電柱)', penaltyPt: 150 };
}

function recalculatePlayerScore() {
  const distScore = Math.round(carState.totalDistanceTraveled * 3.0);
  const penalties =
    policePursuitState.propertyDamageHits * 150 +
    policePursuitState.carHits * 350 +
    policePursuitState.policeHits * 700;
  carState.score = distScore + (carState.goalBonusScore || 0) - penalties;
  return carState.score;
}

function applyCollisionDamageAndOffense(category, impactSpeedMs, detailLabel = '') {
  if (policePursuitState.gameOver) {
    return { hpLoss: 0, impactKmh: 0, offenseName: '', penaltyPt: 0 };
  }
  const info = calculateBalancedCollisionDamage(category, impactSpeedMs);

  if (category === 'WALL' || category === 'SIGNAL' || category === 'POLE') {
    policePursuitState.propertyDamageHits += 1;
  } else if (category === 'CIVILIAN_CAR') {
    policePursuitState.carHits += 1;
  } else if (category === 'POLICE_CAR') {
    policePursuitState.policeHits += 1;
  }

  carState.hp = Math.max(0, carState.hp - info.hpLoss);
  carState.integrity = Math.max(0, Math.round((carState.hp / carState.maxHp) * 100));
  applyVisualDamageToVehicle(carBodyGroup, 100 - carState.integrity);
  if (typeof triggerCameraImpactShake === 'function') triggerCameraImpactShake(impactSpeedMs);
  if (typeof updateSubsystemDamageOnImpact === 'function') updateSubsystemDamageOnImpact(category, impactSpeedMs);

  policePursuitState.lastDamageCause = `${info.offenseName}${detailLabel ? '・' + detailLabel : ''} (衝撃 ${info.impactKmh}km/h / -${info.hpLoss} HP)`;
  recalculatePlayerScore();
  updatePursuitHudUI();

  if (carState.hp <= 0) {
    triggerPoliceGameOver(policePursuitState.lastDamageCause);
  }
  return info;
}

const policeGroup = new THREE.Group();
scene.add(policeGroup);
const policeUnits = [];

// Also register the 5 parked vehicles in Proving Ground so colliding with them on Proving Ground also counts as hitting a car!
const provingGroundParkedCars = [
  { x: KICKFLIP_LANE.x, z: KICKFLIP_LANE.stageZ, halfW: 3.8, halfL: 1.3, height: 3.5, mass: 8500 },
  { x: KICKFLIP_LANE.x - 1.2, z: KICKFLIP_LANE.stageZ + 3.4, halfW: 2.15, halfL: 1.0, height: 1.4, mass: 1600 },
  { x: KICKFLIP_LANE.x - 1.2, z: KICKFLIP_LANE.stageZ + 6.4, halfW: 2.8, halfL: 1.08, height: 1.8, mass: 2900 },
  { x: KICKFLIP_LANE.x - 1.2, z: KICKFLIP_LANE.stageZ - 3.4, halfW: 2.45, halfL: 1.0, height: 1.5, mass: 1800 },
  { x: KICKFLIP_LANE.x - 1.2, z: KICKFLIP_LANE.stageZ - 6.4, halfW: 2.5, halfL: 1.02, height: 1.65, mass: 2000 }
];

const sirenRedOnMat = new THREE.MeshBasicMaterial({ color: 0xff1122 });
const sirenBlueOnMat = new THREE.MeshBasicMaterial({ color: 0x1d4ed8 });
const sirenOffMat = new THREE.MeshBasicMaterial({ color: 0x1e293b });

function createPoliceCruiserMesh() {
  const pGroup = new THREE.Group();
  const bodyParts = new THREE.Group();
  pGroup.add(bodyParts);

  const blackMat = new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.25, metalness: 0.6 });
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.25, metalness: 0.4 });
  const glassMat = new THREE.MeshBasicMaterial({ color: 0x050811 });

  // Lower chassis (black front/rear fenders, white doors)
  const baseBody = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.66, 4.65), blackMat);
  baseBody.position.y = 0.54;
  bodyParts.add(baseBody);

  const whiteDoors = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.62, 2.15), whiteMat);
  whiteDoors.position.set(0, 0.55, 0.0);
  bodyParts.add(whiteDoors);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.52, 2.25), whiteMat);
  cabin.position.set(0, 1.08, -0.05);
  bodyParts.add(cabin);

  const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.44, 2.32), glassMat);
  windshield.position.set(0, 1.07, -0.05);
  bodyParts.add(windshield);

  // Front steel push-bumper (bullbar)
  const bullBar = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.48, 0.16), blackMat);
  bullBar.position.set(0, 0.52, -2.38);
  bodyParts.add(bullBar);

  // Headlights & Taillights
  const hl = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.10, 0.08), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  hl.position.set(0, 0.58, -2.34);
  bodyParts.add(hl);
  const tl = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.10, 0.08), new THREE.MeshBasicMaterial({ color: 0xff1e27 }));
  tl.position.set(0, 0.62, 2.34);
  bodyParts.add(tl);

  // Roof Siren Lightbar (Red Left / Blue Right)
  const barBase = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.08, 0.28), blackMat);
  barBase.position.set(0, 1.38, -0.1);
  pGroup.add(barBase);

  const redLight = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.15, 0.24), sirenRedOnMat);
  redLight.position.set(-0.30, 1.45, -0.1);
  pGroup.add(redLight);

  const blueLight = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.15, 0.24), sirenBlueOnMat);
  blueLight.position.set(0.30, 1.45, -0.1);
  pGroup.add(blueLight);

  return { pGroup, bodyParts, redLight, blueLight };
}

function playSirenBurstSound() {
  if (!audioCtx || !soundEnabled) return;
  try {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(680, now);
    osc.frequency.linearRampToValueAtTime(1180, now + 0.28);
    osc.frequency.linearRampToValueAtTime(680, now + 0.55);
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.58);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.60);
  } catch (e) {}
}

function updatePursuitHudUI() {
  recalculatePlayerScore();

  const hpBarFill = document.getElementById('hp-bar-fill');
  const hpTextEl = document.getElementById('val-hp-text');
  const scoreEl = document.getElementById('val-live-score');
  const propHitsEl = document.getElementById('val-prop-hits');
  const carHitsEl = document.getElementById('val-car-hits');
  const policeHitsEl = document.getElementById('val-police-hits');
  const statusBadge = document.getElementById('pursuit-status-badge');
  const activeDetails = document.getElementById('pursuit-active-details');
  const policeCountEl = document.getElementById('val-police-count');
  const nextSecEl = document.getElementById('val-next-police-sec');

  const hpPct = Math.max(0, Math.min(100, (carState.hp / carState.maxHp) * 100));
  if (hpBarFill) {
    hpBarFill.style.width = `${hpPct}%`;
    if (hpPct > 60) {
      hpBarFill.className = 'h-full rounded-full bg-emerald-400 transition-all duration-150';
    } else if (hpPct > 30) {
      hpBarFill.className = 'h-full rounded-full bg-amber-400 transition-all duration-150';
    } else {
      hpBarFill.className = 'h-full rounded-full bg-red-500 transition-all duration-150 animate-pulse';
    }
  }
  if (hpTextEl) {
    const colorCls = hpPct > 60 ? 'text-emerald-300' : (hpPct > 30 ? 'text-amber-300' : 'text-red-400');
    hpTextEl.className = `text-[11px] font-mono-tech font-extrabold ${colorCls}`;
    hpTextEl.innerHTML = `${carState.hp}<span class="text-[9px] text-slate-400">/${carState.maxHp}</span>`;
  }
  if (scoreEl) {
    scoreEl.textContent = `${carState.score.toLocaleString()}`;
    scoreEl.className = carState.score >= 0 ? 'text-white font-extrabold text-xs' : 'text-red-400 font-extrabold text-xs';
  }
  if (propHitsEl) propHitsEl.textContent = String(policePursuitState.propertyDamageHits);
  if (carHitsEl) carHitsEl.textContent = String(policePursuitState.carHits);
  if (policeHitsEl) policeHitsEl.textContent = String(policePursuitState.policeHits);

  if (policePursuitState.active) {
    if (statusBadge) {
      statusBadge.innerHTML = `🚨 警察追跡中 (公務執行妨害: 2倍ダメージ)`;
      statusBadge.className = 'text-[10px] font-mono-tech font-extrabold px-2 py-0.5 rounded bg-red-600 text-white border border-red-300 shadow-md animate-pulse';
    }
    if (activeDetails) {
      activeDetails.classList.remove('hidden');
      activeDetails.classList.add('flex');
    }
    if (policeCountEl) policeCountEl.textContent = String(policeUnits.length);
    if (nextSecEl) nextSecEl.textContent = policePursuitState.nextSpawnTimer.toFixed(1);
  } else {
    const rem = Math.max(0, 3 - policePursuitState.carHits);
    if (statusBadge) {
      statusBadge.innerHTML = `🚓 警察出動まで器物損壊あと<strong class="text-amber-300 mx-0.5">${rem}</strong>回`;
      statusBadge.className = 'text-[10px] font-mono-tech font-bold px-2 py-0.5 rounded bg-slate-800/90 text-slate-200 border border-white/15';
    }
    if (activeDetails) {
      activeDetails.classList.add('hidden');
      activeDetails.classList.remove('flex');
    }
  }
}

function selectPoliceForwardOrSideSpawnPoint(unitIndex) {
  // Determine player's actual travel heading (or nose heading if stationary)
  const moveSpd = Math.hypot(carState.vx, carState.vz);
  const travelYaw = moveSpd > 1.5 ? Math.atan2(-carState.vx, -carState.vz) : carState.yaw;
  const fwdX = -Math.sin(travelYaw);
  const fwdZ = -Math.cos(travelYaw);
  const rightX = Math.cos(travelYaw);
  const rightZ = -Math.sin(travelYaw);

  // Strictly Forward (進行方向) and Side (左右サイド / 交差点横) spawn sectors — NEVER behind!
  // 0: Dead-ahead on road, 1: Right side flank, 2: Left side flank, 3: Front-Right diagonal, 4: Front-Left diagonal
  const sectorPatterns = [
    { name: '進行方向(正面)',     fwdDist: 56, sideDist:   4 * (unitIndex % 2 === 0 ? 1 : -1) },
    { name: '右サイド',           fwdDist: 16, sideDist:  44 },
    { name: '左サイド',           fwdDist: 16, sideDist: -44 },
    { name: '進行方向・右斜め前', fwdDist: 44, sideDist:  28 },
    { name: '進行方向・左斜め前', fwdDist: 44, sideDist: -28 }
  ];
  const chosen = sectorPatterns[unitIndex % sectorPatterns.length];

  let sx = carState.x + fwdX * (chosen.fwdDist + (Math.random() - 0.5) * 6) + rightX * (chosen.sideDist + (Math.random() - 0.5) * 5);
  let sz = carState.z + fwdZ * (chosen.fwdDist + (Math.random() - 0.5) * 6) + rightZ * (chosen.sideDist + (Math.random() - 0.5) * 5);

  if (currentCourse === 'NYC' && isPointInsideNycBuilding(sx, sz, 3.2)) {
    // Snap to nearest open Manhattan Avenue or Cross-Street in the forward or side sector
    let nearestAve = NYC_AVES[0], minAveD = 99999;
    for (let a = 0; a < NYC_AVES.length; a++) {
      const d = Math.abs(NYC_AVES[a] - sx);
      if (d < minAveD) { minAveD = d; nearestAve = NYC_AVES[a]; }
    }
    let nearestSt = NYC_STS[0], minStD = 99999;
    for (let s = 0; s < NYC_STS.length; s++) {
      const d = Math.abs(NYC_STS[s] - sz);
      if (d < minStD) { minStD = d; nearestSt = NYC_STS[s]; }
    }

    if (Math.abs(chosen.sideDist) >= 24) {
      // Side appearance: emerge from the nearest Cross-Street or adjacent Avenue to the side
      const cand1X = sx, cand1Z = nearestSt + (chosen.sideDist > 0 ? 4.2 : -4.2);
      const cand2X = nearestAve + (chosen.sideDist > 0 ? 6.5 : -6.5), cand2Z = sz;
      if (!isPointInsideNycBuilding(cand1X, cand1Z, 2.8)) {
        sx = cand1X; sz = cand1Z;
      } else if (!isPointInsideNycBuilding(cand2X, cand2Z, 2.8)) {
        sx = cand2X; sz = cand2Z;
      } else {
        sx = nearestAve; sz = nearestSt;
      }
    } else {
      // Forward appearance: emerge ahead along the road or intersection in front of player
      const candFX = nearestAve + (unitIndex % 2 === 0 ? 4.5 : -4.5);
      const candFZ = sz;
      const candF2X = sx;
      const candF2Z = nearestSt + (unitIndex % 2 === 0 ? 4.2 : -4.2);
      if (!isPointInsideNycBuilding(candFX, candFZ, 2.8)) {
        sx = candFX; sz = candFZ;
      } else if (!isPointInsideNycBuilding(candF2X, candF2Z, 2.8)) {
        sx = candF2X; sz = candF2Z;
      } else {
        sx = nearestAve; sz = nearestSt;
      }
    }

    // Final safety guarantee: never behind the player (forward projection >= 4m)
    const relX = sx - carState.x;
    const relZ = sz - carState.z;
    const projFwd = relX * fwdX + relZ * fwdZ;
    if (projFwd < 4.0) {
      sx += fwdX * (28.0 - projFwd);
      sz += fwdZ * (28.0 - projFwd);
      if (isPointInsideNycBuilding(sx, sz, 2.5)) {
        sx = nearestAve;
        sz = nearestSt;
      }
    }
  }

  return { sx, sz, spawnSectorName: chosen.name };
}

function spawnPoliceCruiser() {
  const { pGroup, bodyParts, redLight, blueLight } = createPoliceCruiserMesh();
  // Spawn strictly from the player's direction of travel (ahead) or from the sides (left/right)!
  const { sx, sz, spawnSectorName } = selectPoliceForwardOrSideSpawnPoint(policeUnits.length);

  const initYaw = Math.atan2(-(carState.x - sx), -(carState.z - sz));
  pGroup.position.set(sx, 0, sz);
  pGroup.rotation.order = 'YXZ';
  pGroup.rotation.y = initYaw;
  policeGroup.add(pGroup);

  const unit = {
    id: policeUnits.length + 1,
    mesh: pGroup,
    bodyPartsGroup: bodyParts,
    redLight,
    blueLight,
    x: sx,
    y: 0,
    z: sz,
    vx: -Math.sin(initYaw) * 24,
    vy: 0,
    vz: -Math.cos(initYaw) * 24,
    yaw: initYaw,
    pitch: 0,
    roll: 0,
    yawVel: 0,
    rollVel: 0,
    halfW: 1.04,
    halfL: 2.35,
    mass: 1850,
    maxSpeed: 54.0,
    accel: 34.0,
    hitStunTimer: 0
  };
  policeUnits.push(unit);
  playSirenBurstSound();
  updatePursuitHudUI();
  return unit;
}

function registerPlayerCarCollision(impactSpeedMs = 15.0, vehicleLabel = '一般車両') {
  if (policePursuitState.gameOver || policePursuitState.carHitCooldown > 0) return null;
  policePursuitState.carHitCooldown = 0.55;

  const dmgInfo = applyCollisionDamageAndOffense('CIVILIAN_CAR', impactSpeedMs, vehicleLabel);
  if (policePursuitState.gameOver) return dmgInfo;

  if (!policePursuitState.active) {
    if (policePursuitState.carHits >= 3) {
      policePursuitState.active = true;
      policePursuitState.chaseElapsedSec = 0;
      policePursuitState.nextSpawnTimer = 30.0;
      spawnPoliceCruiser();
      showToast(`🚨 【器物損壊3回】パトカーが緊急出動！（-${dmgInfo.hpLoss} HP / パトカー接触は通常の2倍ダメージ！）`);
    } else {
      const rem = 3 - policePursuitState.carHits;
      showToast(`🚗 【器物損壊】${vehicleLabel}と接触！(-${dmgInfo.hpLoss} HP / 残HP ${carState.hp} / あと${rem}回で警察出動)`);
    }
  } else {
    showToast(`🚗 【器物損壊】${vehicleLabel}と接触！(-${dmgInfo.hpLoss} HP / 残HP ${carState.hp})`);
  }
  updatePursuitHudUI();
  return dmgInfo;
}

function triggerPoliceGameOver(causeText = '') {
  if (policePursuitState.gameOver) return;
  policePursuitState.gameOver = true;
  inputs.accel = false;
  inputs.brake = false;
  inputs.left = false;
  inputs.right = false;
  inputs.boost = false;
  inputs.hover = false;
  inputs.rcsSpin = false;
  if (typeof autoAccelLocked !== 'undefined' && autoAccelLocked) {
    autoAccelLocked = false;
    if (typeof updateAutoAccelUI === 'function') updateAutoAccelUI();
  }
  carState.speed = 0;
  carState.vx = 0;
  carState.vy = 0;
  carState.vz = 0;

  recalculatePlayerScore();

  const goReason = document.getElementById('go-reason-text');
  const goScore = document.getElementById('go-final-score');
  const goHp = document.getElementById('go-hp-val');
  const goProp = document.getElementById('go-prop-hits');
  const goCarHits = document.getElementById('go-car-hits');
  const goPolHits = document.getElementById('go-police-hits');
  const goCount = document.getElementById('go-police-count');
  const goTime = document.getElementById('go-chase-time');

  if (goReason) {
    goReason.textContent = causeText
      ? `決定打: ${causeText} — 体力(HP)が0になり目的地へ到達不能となりました`
      : '激しい衝突により体力(HP 1000)が0になり、目的地へ到達不能となりました';
  }
  if (goScore) goScore.textContent = `${carState.score.toLocaleString()} pt`;
  if (goHp) goHp.textContent = `0 / ${carState.maxHp}`;
  if (goProp) goProp.textContent = `${policePursuitState.propertyDamageHits}回 (-${policePursuitState.propertyDamageHits * 150}pt)`;
  if (goCarHits) goCarHits.textContent = `${policePursuitState.carHits}回 (-${policePursuitState.carHits * 350}pt)`;
  if (goPolHits) goPolHits.textContent = `${policePursuitState.policeHits}回 (-${policePursuitState.policeHits * 700}pt)`;
  if (goCount) goCount.textContent = `${policeUnits.length}台`;
  if (goTime) goTime.textContent = formatTimeAttackSec(policePursuitState.chaseElapsedSec);

  const goModal = document.getElementById('gameover-modal');
  if (goModal) {
    goModal.classList.remove('hidden');
    goModal.classList.add('flex');
  }
  playCrashSound(2.0);
  showToast('💥 GAME OVER // 体力(HP)が0になり車両が走行不能となりました！');
}

function resetPolicePursuitState() {
  for (let i = 0; i < policeUnits.length; i++) {
    policeGroup.remove(policeUnits[i].mesh);
  }
  policeUnits.length = 0;
  policePursuitState.propertyDamageHits = 0;
  policePursuitState.carHits = 0;
  policePursuitState.policeHits = 0;
  policePursuitState.active = false;
  policePursuitState.gameOver = false;
  policePursuitState.chaseElapsedSec = 0;
  policePursuitState.nextSpawnTimer = 30.0;
  policePursuitState.propHitCooldown = 0;
  policePursuitState.carHitCooldown = 0;
  policePursuitState.policeHitCooldown = 0;
  policePursuitState.lastDamageCause = '';

  // Also reset any broken traffic signal poles
  for (let s = 0; s < nycTrafficSignals.length; s++) {
    const sig = nycTrafficSignals[s];
    sig.pole1Broken = false;
    sig.pole2Broken = false;
    if (sig.pole1) { sig.pole1.rotation.set(0, 0, 0); sig.pole1.position.set(16.2, 3.4, 12.2); }
    if (sig.arm1)  { sig.arm1.rotation.set(0, 0, 0);  sig.arm1.position.set(13.0, 6.4, 12.2); }
    if (sig.box1)  { sig.box1.rotation.set(0, 0, 0);  sig.box1.position.set(10.5, 5.8, 12.2); }
    if (sig.pole2) { sig.pole2.rotation.set(0, 0, 0); sig.pole2.position.set(-16.2, 3.4, -12.2); }
    if (sig.arm2)  { sig.arm2.rotation.set(0, 0, 0);  sig.arm2.position.set(-13.0, 6.4, -12.2); }
    if (sig.box2)  { sig.box2.rotation.set(0, 0, 0);  sig.box2.position.set(-10.5, 5.8, -12.2); }
  }

  const goModal = document.getElementById('gameover-modal');
  if (goModal) {
    goModal.classList.add('hidden');
    goModal.classList.remove('flex');
  }
  updatePursuitHudUI();
}

