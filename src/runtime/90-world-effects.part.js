// ============================================================================
// REALISM UPGRADE SYSTEMS ①〜⑦ (ALL 7 SYSTEMS INTEGRATED)
// ============================================================================

// ① PLAYER SUBSYSTEM MECHANICAL DAMAGE & ENGINE SMOKE STATE
const playerSubsystems = {
  steerPullBias: 0,       // Left (-) or Right (+) steering alignment pull from front corner hits
  enginePowerScale: 1.0,  // 1.0 down to 0.72 when hood/cooling system is damaged
  tirePunctures: 0,       // Number of punctured tires from Spike Strips (0..4)
  thrusterStability: 1.0, // Rear thruster stability
  hoodSmokeTimer: 0
};

// ④ WEATHER SYSTEM (DRY vs WET RAIN) & 3D SKIDMARK POOL
const weatherState = {
  isWet: false,
  gripMultiplier: 1.0,
  screechCooldown: 0,
  hornCooldown: 0
};

const rainGroup = new THREE.Group();
rainGroup.visible = false;
scene.add(rainGroup);
const rainDrops = [];
(function initRainParticles() {
  const rainGeo = new THREE.BoxGeometry(0.035, 1.85, 0.035);
  const rainMat = new THREE.MeshBasicMaterial({ color: 0xbae6fd, transparent: true, opacity: 0.52 });
  for (let i = 0; i < 140; i++) {
    const drop = new THREE.Mesh(rainGeo, rainMat);
    drop.position.set((Math.random() - 0.5) * 45, Math.random() * 26, (Math.random() - 0.5) * 45);
    rainGroup.add(drop);
    rainDrops.push(drop);
  }
})();

const skidmarkGroup = new THREE.Group();
scene.add(skidmarkGroup);
const skidmarkPool = [];
let skidmarkCursor = 0;
(function initSkidmarkPool() {
  const skidGeo = new THREE.PlaneGeometry(0.32, 1.35);
  skidGeo.rotateX(-Math.PI / 2);
  const skidMat = new THREE.MeshBasicMaterial({
    color: 0x05070b,
    transparent: true,
    opacity: 0.68,
    depthWrite: false
  });
  for (let i = 0; i < 160; i++) {
    const m = new THREE.Mesh(skidGeo, skidMat);
    m.visible = false;
    skidmarkGroup.add(m);
    skidmarkPool.push(m);
  }
})();

function spawnTireSkidPair(carX, carZ, carYaw) {
  const cosY = Math.cos(carYaw);
  const sinY = Math.sin(carYaw);
  // Rear left & rear right wheel world positions
  const offsets = [-0.88, 0.88];
  for (let i = 0; i < 2; i++) {
    const ox = offsets[i];
    const oz = 1.35;
    const wx = carX + ox * cosY + oz * sinY;
    const wz = carZ - ox * sinY + oz * cosY;
    const m = skidmarkPool[skidmarkCursor];
    skidmarkCursor = (skidmarkCursor + 1) % skidmarkPool.length;
    m.position.set(wx, 0.028, wz);
    m.rotation.y = carYaw;
    m.visible = true;
  }
}

function clearAllSkidmarks() {
  for (let i = 0; i < skidmarkPool.length; i++) {
    skidmarkPool[i].visible = false;
  }
}

function playTireScreechSound(intensity = 0.5) {
  if (!audioCtx || !soundEnabled || weatherState.screechCooldown > 0) return;
  weatherState.screechCooldown = 0.18;
  try {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1420 + Math.random() * 240, now);
    osc.frequency.linearRampToValueAtTime(1180, now + 0.15);
    gain.gain.setValueAtTime(Math.min(0.08, 0.035 * intensity), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.17);
  } catch (e) {}
}

function playCarHornSound(pitchScale = 1.0) {
  if (!audioCtx || !soundEnabled || weatherState.hornCooldown > 0) return;
  weatherState.hornCooldown = 1.1;
  try {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const now = audioCtx.currentTime;
    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc1.type = 'sawtooth';
    osc2.type = 'sawtooth';
    osc1.frequency.setValueAtTime(410 * pitchScale, now);
    osc2.frequency.setValueAtTime(512 * pitchScale, now);
    gain.gain.setValueAtTime(0.065, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(audioCtx.destination);
    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.35);
    osc2.stop(now + 0.35);
  } catch (e) {}
}

function toggleWeatherCondition() {
  weatherState.isWet = !weatherState.isWet;
  weatherState.gripMultiplier = weatherState.isWet ? 0.72 : 1.0;
  rainGroup.visible = weatherState.isWet;
  const btnW = document.getElementById('btn-weather-toggle');
  if (btnW) {
    btnW.textContent = weatherState.isWet ? '🌧️ 天候: 雨天(WET)' : '☀️ 天候: 晴天(DRY)';
    btnW.className = weatherState.isWet
      ? 'btn-game rounded-xl px-2.5 py-1.5 bg-blue-950/90 border border-blue-400/70 text-blue-200 font-bold text-xs cursor-pointer shadow-md'
      : 'btn-game rounded-xl px-2.5 py-1.5 bg-sky-950/75 border border-sky-400/50 text-sky-200 font-bold text-xs cursor-pointer';
  }
  if (groundMesh && groundMesh.material) {
    if (weatherState.isWet) {
      groundMesh.material.roughness = 0.20;
      groundMesh.material.metalness = 0.58;
      if (currentCourse === 'NYC') {
        scene.background = new THREE.Color(0x334155);
        scene.fog = new THREE.FogExp2(0x475569, 0.00038);
      }
    } else {
      applyCourseWeatherAndLighting(currentCourse);
    }
  }
  showToast(
    weatherState.isWet
      ? '🌧️ 雨天(WET)モード：路面が濡れてタイヤグリップが28%低下！吸引ファン4.7tやRCS制御が有効です'
      : '☀️ 晴天(DRY)モード：ドライアスファルトの最大グリップに復帰しました'
  );
}

const btnWeatherToggle = document.getElementById('btn-weather-toggle');
if (btnWeatherToggle) {
  btnWeatherToggle.addEventListener('click', toggleWeatherCondition);
}

// ⑦ CAMERA SHAKE, DYNAMIC FOV & WINDSHIELD CRACK CONTROLLER
const cameraEffectsState = {
  shakeIntensity: 0,
  shakeOffsetX: 0,
  shakeOffsetY: 0,
  shakeOffsetZ: 0,
  currentDynamicFov: 68
};

function triggerCameraImpactShake(impactSpeedMs) {
  const addShake = Math.min(1.35, Math.max(0.18, impactSpeedMs / 18.0));
  cameraEffectsState.shakeIntensity = Math.min(1.5, cameraEffectsState.shakeIntensity + addShake);
  updateWindshieldCrackUI();
}

function updateWindshieldCrackUI() {
  const overlay = document.getElementById('windshield-crack-overlay');
  const severeGroup = document.getElementById('crack-group-severe');
  if (!overlay) return;
  const isCockpit = CAMERA_MODES[currentCamIndex].id === 'cockpit';
  if (carState.hp >= 680) {
    overlay.style.opacity = '0';
    if (severeGroup) severeGroup.style.display = 'none';
  } else if (carState.hp >= 340) {
    overlay.style.opacity = isCockpit ? '0.78' : '0.42';
    if (severeGroup) severeGroup.style.display = 'none';
  } else {
    overlay.style.opacity = isCockpit ? '0.96' : '0.68';
    if (severeGroup) severeGroup.style.display = 'block';
  }
}

function updateSubsystemDamageOnImpact(category, impactSpeedMs) {
  if (impactSpeedMs < 5.0) return;
  const severity = Math.min(1.0, impactSpeedMs / 35.0);
  if (category === 'CIVILIAN_CAR' || category === 'POLICE_CAR' || category === 'WALL') {
    // Induce slight steering alignment bias and engine power reduction on heavy hits
    const sideSign = (Math.random() > 0.5 ? 1 : -1);
    playerSubsystems.steerPullBias = Math.max(-0.14, Math.min(0.14, playerSubsystems.steerPullBias + sideSign * severity * 0.045));
    const hpRatio = carState.hp / carState.maxHp;
    playerSubsystems.enginePowerScale = Math.max(0.72, 0.72 + 0.28 * hpRatio);
  }
  updateSubsystemBadgeUI();
}

function updateSubsystemBadgeUI() {
  const badge = document.getElementById('val-subsystem-status');
  if (!badge) return;
  const issues = [];
  if (playerSubsystems.tirePunctures > 0) issues.push(`🛞パンクx${playerSubsystems.tirePunctures}`);
  if (Math.abs(playerSubsystems.steerPullBias) > 0.035) issues.push('⚠️ステア偏り');
  if (carState.hp <= 280) issues.push('🔥黒煙・出力低下');
  else if (carState.hp <= 550) issues.push('💨冷却白煙');

  if (issues.length === 0) {
    badge.textContent = '🔧 機関: 正常';
    badge.className = 'text-[10px] font-mono-tech font-bold px-2 py-0.5 rounded bg-emerald-950/85 text-emerald-300 border border-emerald-500/40';
  } else {
    badge.textContent = issues.join(' / ');
    badge.className = 'text-[10px] font-mono-tech font-extrabold px-2 py-0.5 rounded bg-amber-950/90 text-amber-300 border border-amber-400/60 animate-pulse';
  }
}

// ② POLICE ROADBLOCK & SPIKE STRIP SYSTEM
const policeRoadblockGroup = new THREE.Group();
policeRoadblockGroup.visible = false;
scene.add(policeRoadblockGroup);

const roadblockState = {
  active: false,
  x: 0,
  z: -120,
  yaw: 0,
  evaded: false,
  spikeHit: false,
  redeployTimer: 0
};

(function buildPoliceRoadblockMesh() {
  // Left & Right angled police cruisers forming a V-funnel roadblock
  const cruiserL = createPoliceCruiserMesh().pGroup;
  cruiserL.position.set(-5.6, 0, -1.2);
  cruiserL.rotation.y = 0.42;
  policeRoadblockGroup.add(cruiserL);

  const cruiserR = createPoliceCruiserMesh().pGroup;
  cruiserR.position.set(5.6, 0, -1.2);
  cruiserR.rotation.y = -0.42;
  policeRoadblockGroup.add(cruiserR);

  // Center Spike Strip (スパイクストリップ) across the 7.5m center gap
  const stripBase = new THREE.Mesh(
    new THREE.BoxGeometry(7.8, 0.09, 0.55),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.8 })
  );
  stripBase.position.set(0, 0.05, 0);
  policeRoadblockGroup.add(stripBase);

  const spikeConeGeo = new THREE.ConeGeometry(0.06, 0.24, 6);
  const spikeMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
  for (let sx = -3.6; sx <= 3.6; sx += 0.45) {
    const sp = new THREE.Mesh(spikeConeGeo, spikeMat);
    sp.position.set(sx, 0.17, 0);
    policeRoadblockGroup.add(sp);
  }

  // Flashing orange/red hazard cones flanking the spike strip
  const coneGeo = new THREE.ConeGeometry(0.28, 0.75, 10);
  const coneMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
  [-4.1, 4.1].forEach((cx) => {
    const c = new THREE.Mesh(coneGeo, coneMat);
    c.position.set(cx, 0.38, 0.4);
    policeRoadblockGroup.add(c);
  });
})();

function deployPoliceRoadblockAhead() {
  const moveSpd = Math.hypot(carState.vx, carState.vz);
  const travelYaw = moveSpd > 1.5 ? Math.atan2(-carState.vx, -carState.vz) : carState.yaw;
  const fwdX = -Math.sin(travelYaw);
  const fwdZ = -Math.cos(travelYaw);

  let rx = carState.x + fwdX * 115;
  let rz = carState.z + fwdZ * 115;
  let blockYaw = travelYaw;

  if (currentCourse === 'NYC') {
    // Snap roadblock to the nearest Avenue or Cross-Street ahead of player
    let nearestAve = NYC_AVES[0], minAveD = 99999;
    for (let a = 0; a < NYC_AVES.length; a++) {
      const d = Math.abs(NYC_AVES[a] - rx);
      if (d < minAveD) { minAveD = d; nearestAve = NYC_AVES[a]; }
    }
    rx = nearestAve;
    blockYaw = (fwdZ <= 0) ? 0 : Math.PI;
  }

  roadblockState.active = true;
  roadblockState.x = rx;
  roadblockState.z = rz;
  roadblockState.yaw = blockYaw;
  roadblockState.evaded = false;
  roadblockState.spikeHit = false;
  roadblockState.redeployTimer = 18.0;

  policeRoadblockGroup.position.set(rx, 0, rz);
  policeRoadblockGroup.rotation.y = blockYaw;
  policeRoadblockGroup.visible = true;
}

function updatePoliceRoadblock(dt) {
  if (!policePursuitState.active || policePursuitState.gameOver) {
    policeRoadblockGroup.visible = false;
    roadblockState.active = false;
    return;
  }

  roadblockState.redeployTimer -= dt;
  const distToBlock = Math.hypot(carState.x - roadblockState.x, carState.z - roadblockState.z);
  const moveSpd = Math.hypot(carState.vx, carState.vz);
  const travelYaw = moveSpd > 1.5 ? Math.atan2(-carState.vx, -carState.vz) : carState.yaw;
  const fwdProj = (roadblockState.x - carState.x) * (-Math.sin(travelYaw)) + (roadblockState.z - carState.z) * (-Math.cos(travelYaw));

  if (!roadblockState.active || distToBlock > 210 || (distToBlock > 45 && fwdProj < -25) || roadblockState.redeployTimer <= 0) {
    deployPoliceRoadblockAhead();
  }

  // Transform player position into roadblock local coordinates
  const dx = carState.x - roadblockState.x;
  const dz = carState.z - roadblockState.z;
  const cosY = Math.cos(-roadblockState.yaw);
  const sinY = Math.sin(-roadblockState.yaw);
  const localX = dx * cosY - dz * sinY;
  const localZ = dx * sinY + dz * cosY;

  // 1) Check if player jumped cleanly over the roadblock in mid-air!
  if (!roadblockState.evaded && Math.abs(localX) < 8.5 && Math.abs(localZ) < 2.8 && carState.y >= 1.25) {
    roadblockState.evaded = true;
    carState.goalBonusScore = (carState.goalBonusScore || 0) + 500;
    recalculatePlayerScore();
    updatePursuitHudUI();
    showToast('🦅 【検問ジャンプ突破！】スパイクストリップを華麗に飛び越えた！(+500 SCORE)');
  }

  // 2) Check if player hit the center Spike Strip on the ground
  if (!roadblockState.spikeHit && Math.abs(localX) < 3.9 && Math.abs(localZ) < 1.35 && carState.y < 0.65) {
    roadblockState.spikeHit = true;
    playerSubsystems.tirePunctures = Math.min(4, playerSubsystems.tirePunctures + 1);
    const curSpd = Math.hypot(carState.vx, carState.vz);
    const newSpd = Math.max(8.0, curSpd - 11.5);
    if (curSpd > 0.1) {
      carState.vx *= (newSpd / curSpd);
      carState.vz *= (newSpd / curSpd);
    }
    carState.speed = -Math.sin(carState.yaw) * carState.vx - Math.cos(carState.yaw) * carState.vz;
    spawnCrashDebris(carState.x, 0.25, carState.z, 18.0);
    playTireScreechSound(1.2);
    triggerCameraImpactShake(16.0);
    updateSubsystemBadgeUI();
    showToast(`🛞 【スパイクストリップ踏破！】タイヤがパンク(計${playerSubsystems.tirePunctures}輪)！グリップ＆最高速が低下！`);
  }

  // 3) Check if player collided with the left or right roadblock police cruisers
  if (Math.abs(localZ + 1.2) < 2.2 && (Math.abs(localX + 5.6) < 2.2 || Math.abs(localX - 5.6) < 2.2) && carState.y < 2.0) {
    if (policePursuitState.policeHitCooldown <= 0) {
      policePursuitState.policeHitCooldown = 0.75;
      const impSpd = Math.max(14.0, Math.hypot(carState.vx, carState.vz));
      carState.vx *= -0.45;
      carState.vz *= -0.45;
      carState.speed *= -0.45;
      spawnCrashDebris(carState.x, 0.7, carState.z, impSpd);
      playCrashSound(1.8);
      triggerCameraImpactShake(impSpd);
      const dmgInfo = applyCollisionDamageAndOffense('POLICE_CAR', impSpd, '検問パトカー');
      if (!policePursuitState.gameOver) {
        showToast(`🚨 【検問突破衝突】ロードブロックのパトカーに激突！(-${dmgInfo.hpLoss} HP)`);
      }
    }
  }
}

// ③ POLICE HELICOPTER & OVERHEAD SEARCHLIGHT SYSTEM
const policeHeliGroup = new THREE.Group();
policeHeliGroup.visible = false;
scene.add(policeHeliGroup);
let heliMainRotor = null;
let heliTailRotor = null;
let heliBeamCone = null;

(function buildPoliceHelicopterMesh() {
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3, metalness: 0.7 });
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3, metalness: 0.4 });
  const rotorMat = new THREE.MeshBasicMaterial({ color: 0x1e293b });

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.8, 4.2), bodyMat);
  policeHeliGroup.add(cabin);

  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.3, 1.8), whiteMat);
  nose.position.set(0, -0.15, -2.6);
  policeHeliGroup.add(nose);

  const tailBoom = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.65, 5.2), bodyMat);
  tailBoom.position.set(0, 0.25, 4.4);
  policeHeliGroup.add(tailBoom);

  heliMainRotor = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.08, 0.45), rotorMat);
  heliMainRotor.position.set(0, 1.15, 0);
  policeHeliGroup.add(heliMainRotor);

  heliTailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.2, 0.28), rotorMat);
  heliTailRotor.position.set(0.38, 0.45, 6.8);
  policeHeliGroup.add(heliTailRotor);

  // Volumetric searchlight cone shining down from helicopter to street
  const coneGeo = new THREE.ConeGeometry(8.5, 42.0, 20, 1, true);
  const coneMat = new THREE.MeshBasicMaterial({
    color: 0xe0f2fe,
    transparent: true,
    opacity: 0.19,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  heliBeamCone = new THREE.Mesh(coneGeo, coneMat);
  heliBeamCone.position.set(0, -21.0, -2.5);
  policeHeliGroup.add(heliBeamCone);
})();

function updatePoliceHelicopter(dt) {
  if (!policePursuitState.active || policePursuitState.gameOver) {
    policeHeliGroup.visible = false;
    return;
  }
  policeHeliGroup.visible = true;
  const t = performance.now() * 0.001;
  // Orbit slightly ahead and above the player car at y = 42m
  const targetX = carState.x + carState.vx * 0.45 + Math.cos(t * 0.9) * 10.0;
  const targetZ = carState.z + carState.vz * 0.45 + Math.sin(t * 0.9) * 10.0;
  policeHeliGroup.position.x += (targetX - policeHeliGroup.position.x) * Math.min(1, dt * 3.5);
  policeHeliGroup.position.z += (targetZ - policeHeliGroup.position.z) * Math.min(1, dt * 3.5);
  policeHeliGroup.position.y = 42.0 + Math.sin(t * 2.2) * 1.2;

  const dx = carState.x - policeHeliGroup.position.x;
  const dz = carState.z - policeHeliGroup.position.z;
  policeHeliGroup.rotation.y = Math.atan2(-dx, -dz);

  if (heliMainRotor) heliMainRotor.rotation.y += dt * 28.0;
  if (heliTailRotor) heliTailRotor.rotation.x += dt * 34.0;
}

// ⑤ URBAN LIVING WORLD PROPS: FIRE HYDRANTS (WITH 12M WATER GEYSERS), TREES/TRASH CANS & EVADING PEDESTRIANS
const nycUrbanPropsGroup = new THREE.Group();
nycCityGroup.add(nycUrbanPropsGroup);

const nycFireHydrants = [];
const nycStreetProps = [];
const nycPedestrians = [];
const waterGeyserGroup = new THREE.Group();
waterGeyserGroup.visible = false;
nycCityGroup.add(waterGeyserGroup);
const waterGeyserState = {
  active: false,
  timer: 0,
  x: 0,
  z: 0,
  columnMesh: null,
  droplets: []
};

(function initUrbanPropsAndPedestrians() {
  // 1) Water Geyser 12m Column & Spray Droplets
  const colGeo = new THREE.CylinderGeometry(0.85, 0.28, 12.0, 14, 1, true);
  const colMat = new THREE.MeshBasicMaterial({
    color: 0xbae6fd,
    transparent: true,
    opacity: 0.78,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  waterGeyserState.columnMesh = new THREE.Mesh(colGeo, colMat);
  waterGeyserState.columnMesh.position.y = 6.0;
  waterGeyserGroup.add(waterGeyserState.columnMesh);

  const dropGeo = new THREE.BoxGeometry(0.28, 0.55, 0.28);
  for (let i = 0; i < 24; i++) {
    const dm = new THREE.Mesh(dropGeo, colMat);
    waterGeyserGroup.add(dm);
    waterGeyserState.droplets.push({ mesh: dm, phase: i * 0.26, angle: (i / 24) * Math.PI * 2 });
  }

  // 2) Fire Hydrants (消火栓) at intersection corners
  const hydBodyGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.78, 10);
  const hydCapGeo = new THREE.SphereGeometry(0.20, 8, 8);
  const hydMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.35, metalness: 0.45 });

  // 3) Sidewalk Trees & Trash Cans (街路樹・ゴミ箱)
  const trunkGeo = new THREE.CylinderGeometry(0.14, 0.20, 2.4, 8);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.8 });
  const crownGeo = new THREE.SphereGeometry(1.35, 8, 8);
  const crownMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.75 });
  const binGeo = new THREE.CylinderGeometry(0.28, 0.25, 0.88, 10);
  const binMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4, metalness: 0.7 });

  const coreAves = [-900, -600, -300, 0, 300, 600, 900];
  const coreSts = [-1400, -1000, -600, -400, -200, 0, 200, 400, 600, 1000, 1400];

  coreAves.forEach((ax) => {
    coreSts.forEach((sz) => {
      // Fire Hydrant on NE & SW curb corners
      [[-14.2, -13.5], [14.2, 13.5]].forEach(([ox, oz]) => {
        const hGroup = new THREE.Group();
        const body = new THREE.Mesh(hydBodyGeo, hydMat);
        body.position.y = 0.39;
        hGroup.add(body);
        const cap = new THREE.Mesh(hydCapGeo, hydMat);
        cap.position.y = 0.80;
        hGroup.add(cap);
        const wx = ax + ox;
        const wz = sz + oz;
        hGroup.position.set(wx, 0, wz);
        nycUrbanPropsGroup.add(hGroup);
        nycFireHydrants.push({
          mesh: hGroup,
          x: wx,
          z: wz,
          origX: wx,
          origZ: wz,
          broken: false,
          flyVx: 0,
          flyVy: 0,
          flyVz: 0
        });
      });

      // Street Tree & Trash Can along the avenue sidewalk mid-block
      const treeGroup = new THREE.Group();
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 1.2;
      treeGroup.add(trunk);
      const crown = new THREE.Mesh(crownGeo, crownMat);
      crown.position.y = 2.9;
      treeGroup.add(crown);
      const tx = ax + 15.2;
      const tz = sz + 45.0;
      treeGroup.position.set(tx, 0, tz);
      nycUrbanPropsGroup.add(treeGroup);
      nycStreetProps.push({
        type: '街路樹',
        mesh: treeGroup,
        x: tx,
        z: tz,
        origX: tx,
        origZ: tz,
        broken: false,
        fallAngle: 0,
        fallAxis: 0
      });

      const binMesh = new THREE.Mesh(binGeo, binMat);
      const bx = ax - 14.6;
      const bz = sz + 28.0;
      binMesh.position.set(bx, 0.44, bz);
      nycUrbanPropsGroup.add(binMesh);
      nycStreetProps.push({
        type: 'ゴミ箱',
        mesh: binMesh,
        x: bx,
        z: bz,
        origX: bx,
        origZ: bz,
        broken: false,
        fallAngle: 0,
        fallAxis: 0
      });
    });
  });

  // 4) 60 Animated Evading Sidewalk Pedestrians (歩行者緊急回避AI)
  const pedHeadGeo = new THREE.SphereGeometry(0.18, 8, 8);
  const pedTorsoGeo = new THREE.BoxGeometry(0.42, 0.72, 0.26);
  const pedLegGeo = new THREE.BoxGeometry(0.16, 0.65, 0.18);
  const skinMat = new THREE.MeshLambertMaterial({ color: 0xfde68a });
  const coatColors = [0x38bdf8, 0xf43f5e, 0x10b981, 0xfacc15, 0xa855f7, 0xf8fafc];
  const pantsMat = new THREE.MeshLambertMaterial({ color: 0x1e293b });

  for (let i = 0; i < 60; i++) {
    const pGroup = new THREE.Group();
    const coatMat = new THREE.MeshLambertMaterial({ color: coatColors[i % coatColors.length] });
    const head = new THREE.Mesh(pedHeadGeo, skinMat);
    head.position.y = 1.52;
    pGroup.add(head);
    const torso = new THREE.Mesh(pedTorsoGeo, coatMat);
    torso.position.y = 1.02;
    pGroup.add(torso);
    const legL = new THREE.Mesh(pedLegGeo, pantsMat);
    legL.position.set(-0.11, 0.35, 0);
    pGroup.add(legL);
    const legR = new THREE.Mesh(pedLegGeo, pantsMat);
    legR.position.set(0.11, 0.35, 0);
    pGroup.add(legR);

    const aveX = coreAves[i % coreAves.length];
    const sideSign = (i % 2 === 0) ? 1 : -1;
    const baseSidewalkX = aveX + sideSign * 16.5;
    const startZ = -900 + ((i * 37) % 1800);
    pGroup.position.set(baseSidewalkX, 0, startZ);
    nycUrbanPropsGroup.add(pGroup);

    nycPedestrians.push({
      mesh: pGroup,
      legL,
      legR,
      sideSign,
      baseX: baseSidewalkX,
      x: baseSidewalkX,
      y: 0,
      z: startZ,
      dirZ: (i % 2 === 0) ? 1 : -1,
      walkPhase: i * 0.7,
      evadeTimer: 0
    });
  }
})();

function resetUrbanProps() {
  waterGeyserState.active = false;
  waterGeyserGroup.visible = false;
  for (let i = 0; i < nycFireHydrants.length; i++) {
    const h = nycFireHydrants[i];
    h.broken = false;
    h.x = h.origX;
    h.z = h.origZ;
    h.mesh.position.set(h.origX, 0, h.origZ);
    h.mesh.rotation.set(0, 0, 0);
  }
  for (let i = 0; i < nycStreetProps.length; i++) {
    const sp = nycStreetProps[i];
    sp.broken = false;
    sp.fallAngle = 0;
    sp.mesh.position.set(sp.origX, sp.type === 'ゴミ箱' ? 0.44 : 0, sp.origZ);
    sp.mesh.rotation.set(0, 0, 0);
  }
}

function updateUrbanPropsAndPedestrians(dt) {
  if (currentCourse !== 'NYC') return;

  // 1) Update Active 12m Fire Hydrant Water Geyser
  if (waterGeyserState.active) {
    waterGeyserState.timer -= dt;
    if (waterGeyserState.timer <= 0) {
      waterGeyserState.active = false;
      waterGeyserGroup.visible = false;
    } else {
      const t = performance.now() * 0.005;
      waterGeyserState.columnMesh.scale.set(
        0.9 + Math.sin(t * 3) * 0.15,
        0.95 + Math.cos(t * 4) * 0.08,
        0.9 + Math.sin(t * 3) * 0.15
      );
      for (let i = 0; i < waterGeyserState.droplets.length; i++) {
        const d = waterGeyserState.droplets[i];
        const cycle = (t + d.phase) % 1.0;
        const r = cycle * 3.8;
        const y = Math.sin(cycle * Math.PI) * 13.5;
        d.mesh.position.set(Math.cos(d.angle) * r, Math.max(0.2, y), Math.sin(d.angle) * r);
      }
    }
  }

  // 2) Fire Hydrants collision & flying physics
  for (let i = 0; i < nycFireHydrants.length; i++) {
    const h = nycFireHydrants[i];
    const distSq = (h.x - carState.x) * (h.x - carState.x) + (h.z - carState.z) * (h.z - carState.z);
    if (distSq > ACTIVE_RENDER_RADIUS_SQ) {
      h.mesh.visible = false;
      continue;
    }
    h.mesh.visible = true;
    if (h.broken) {
      if (h.mesh.position.y > 0.15 || h.flyVy > 0) {
        h.flyVy -= 19.6 * dt;
        h.mesh.position.x += h.flyVx * dt;
        h.mesh.position.y = Math.max(0.15, h.mesh.position.y + h.flyVy * dt);
        h.mesh.position.z += h.flyVz * dt;
        h.mesh.rotation.x += 9.0 * dt;
        h.mesh.rotation.z += 7.0 * dt;
      }
      continue;
    }
    if (distSq < 1.55 * 1.55 && carState.y < 1.6) {
      h.broken = true;
      const moveSpd = Math.hypot(carState.vx, carState.vz);
      h.flyVx = carState.vx * 0.85 + (Math.random() - 0.5) * 6;
      h.flyVy = 6.5 + Math.min(8.0, moveSpd * 0.2);
      h.flyVz = carState.vz * 0.85 + (Math.random() - 0.5) * 6;

      // Erupt 12m high-pressure water geyser at hydrant origin!
      waterGeyserState.active = true;
      waterGeyserState.timer = 9.5;
      waterGeyserGroup.position.set(h.origX, 0, h.origZ);
      waterGeyserGroup.visible = true;

      // Slight speed reduction & 物損 offense
      carState.vx *= 0.86;
      carState.vz *= 0.86;
      carState.speed *= 0.86;
      const dmgInfo = applyCollisionDamageAndOffense('POLE', moveSpd, '消火栓');
      triggerCameraImpactShake(moveSpd * 0.7);
      playCrashSound(1.1);
      if (!policePursuitState.gameOver) {
        showToast(`💦 【物損・消火栓破損！】消火栓が吹き飛び、高さ12mの高圧水柱が噴出！(-${dmgInfo.hpLoss} HP)`);
      }
    }
  }

  // 3) Street Trees & Trash Cans collision
  for (let i = 0; i < nycStreetProps.length; i++) {
    const sp = nycStreetProps[i];
    const distSq = (sp.x - carState.x) * (sp.x - carState.x) + (sp.z - carState.z) * (sp.z - carState.z);
    if (distSq > ACTIVE_RENDER_RADIUS_SQ) {
      sp.mesh.visible = false;
      continue;
    }
    sp.mesh.visible = true;
    if (sp.broken) {
      if (sp.fallAngle < Math.PI * 0.48) {
        sp.fallAngle = Math.min(Math.PI * 0.48, sp.fallAngle + 4.8 * dt);
        sp.mesh.rotation.set(sp.fallAngle, sp.fallAxis, 0);
      }
      continue;
    }
    if (distSq < 1.65 * 1.65 && carState.y < 2.8) {
      sp.broken = true;
      const moveSpd = Math.hypot(carState.vx, carState.vz);
      sp.fallAxis = Math.atan2(carState.vx, carState.vz);
      sp.fallAngle = 0.2;
      carState.vx *= 0.82;
      carState.vz *= 0.82;
      carState.speed *= 0.82;
      const dmgInfo = applyCollisionDamageAndOffense('POLE', moveSpd, sp.type);
      spawnCrashDebris(sp.x, 0.8, sp.z, Math.max(8, moveSpd));
      triggerCameraImpactShake(moveSpd * 0.75);
      playCrashSound(1.15);
      if (!policePursuitState.gameOver) {
        showToast(`🌳 【物損】歩道の${sp.type}をなぎ倒しました！(-${dmgInfo.hpLoss} HP)`);
      }
    }
  }

  // 4) Sidewalk Pedestrians (Dramatic Dive Evasion when player car approaches)
  for (let i = 0; i < nycPedestrians.length; i++) {
    const ped = nycPedestrians[i];
    const dx = ped.x - carState.x;
    const dz = ped.z - carState.z;
    const distSq = dx * dx + dz * dz;
    if (distSq > 260 * 260) {
      ped.mesh.visible = false;
      continue;
    }
    ped.mesh.visible = true;

    const dist = Math.sqrt(distSq);
    if (dist < 17.5 && Math.hypot(carState.vx, carState.vz) > 4.0) {
      // Panic Dive away from the road toward the building wall!
      ped.evadeTimer = 1.6;
      const safeWallX = ped.baseX + ped.sideSign * 3.2;
      ped.x += (safeWallX - ped.x) * Math.min(1, dt * 12.0);
      ped.y = Math.abs(Math.sin(performance.now() * 0.015)) * 0.55;
      ped.mesh.rotation.z = -ped.sideSign * 0.38;
    } else if (ped.evadeTimer > 0) {
      ped.evadeTimer -= dt;
      ped.y *= 0.85;
      ped.mesh.rotation.z *= 0.85;
    } else {
      ped.x += (ped.baseX - ped.x) * Math.min(1, dt * 4.0);
      ped.y = 0;
      ped.mesh.rotation.z = 0;
      ped.z += ped.dirZ * 1.65 * dt;
      ped.walkPhase += dt * 6.5;
      ped.legL.rotation.x = Math.sin(ped.walkPhase) * 0.45;
      ped.legR.rotation.x = -Math.sin(ped.walkPhase) * 0.45;
      ped.mesh.rotation.y = ped.dirZ > 0 ? 0 : Math.PI;
    }
    ped.mesh.position.set(ped.x, ped.y, ped.z);
  }
}

// ⑥ CIVILIAN AI PANIC EVASION, HORN HONKING & HAZARD LIGHTS
const hazardAmberMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
const normalTailRedMat = new THREE.MeshBasicMaterial({ color: 0xff1e27 });

function updateCivilianPanicAndHazards(dt) {
  if (currentCourse !== 'NYC') return;
  const playerSpd = Math.hypot(carState.vx, carState.vz);
  const flashHazard = Math.floor(performance.now() / 220) % 2 === 0;

  for (let i = 0; i < nycTrafficVehicles.length; i++) {
    const v = nycTrafficVehicles[i];
    if (!v.mesh.visible || v.crashed) continue;
    const dx = v.x - carState.x;
    const dz = v.z - carState.z;
    const dist = Math.hypot(dx, dz);

    // Trigger panic if player is hurtling at > 25 m/s (90 km/h) within 38m, or if police pursuit siren is active within 42m
    const isThreatened = (dist < 38.0 && playerSpd > 25.0) || (policePursuitState.active && dist < 42.0);
    if (isThreatened) {
      // Swerve slightly toward outer curb lane to yield way
      if (v.axis === 'NS') {
        const curbShift = (v.x >= 0 ? 1.8 : -1.8);
        v.x += curbShift * dt * 2.4;
      }
      if (dist < 22.0 && playerSpd > 28.0) {
        playCarHornSound(0.95 + (i % 3) * 0.08);
      }
      // Flash rear hazard lights
      v.bodyPartsGroup.children.forEach((part) => {
        if (part.userData && (part.userData.partRole === 'tlL' || part.userData.partRole === 'tlR')) {
          part.material = flashHazard ? hazardAmberMat : normalTailRedMat;
        }
      });
    }
  }
}

function updateAll7RealismSystems(dt) {
  if (weatherState.screechCooldown > 0) weatherState.screechCooldown = Math.max(0, weatherState.screechCooldown - dt);
  if (weatherState.hornCooldown > 0) weatherState.hornCooldown = Math.max(0, weatherState.hornCooldown - dt);

  // ① Hood Steam / Black Smoke when HP is low
  if (carState.hp <= 550 && !policePursuitState.gameOver) {
    playerSubsystems.hoodSmokeTimer += dt;
    const interval = carState.hp <= 280 ? 0.07 : 0.16;
    if (playerSubsystems.hoodSmokeTimer >= interval) {
      playerSubsystems.hoodSmokeTimer = 0;
      const fwdX = -Math.sin(carState.yaw);
      const fwdZ = -Math.cos(carState.yaw);
      spawnSmokePuff(carState.x + fwdX * 1.55, carState.y + 0.68, carState.z + fwdZ * 1.55, 0.55);
      if (carState.hp <= 250 && Math.random() < 0.35) {
        spawnCrashDebris(carState.x + fwdX * 1.55, carState.y + 0.65, carState.z + fwdZ * 1.55, 6.0);
      }
    }
  }

  // ② Police Roadblock & Spike Strip
  updatePoliceRoadblock(dt);

  // ③ Police Helicopter & Searchlight
  updatePoliceHelicopter(dt);

  // ④ Rain Particles animation around camera
  if (weatherState.isWet && rainGroup.visible) {
    rainGroup.position.set(camera.position.x, 0, camera.position.z);
    for (let i = 0; i < rainDrops.length; i++) {
      const r = rainDrops[i];
      r.position.y -= 36.0 * dt;
      if (r.position.y < 0) {
        r.position.y = 24.0 + Math.random() * 4.0;
        r.position.x = (Math.random() - 0.5) * 45;
        r.position.z = (Math.random() - 0.5) * 45;
      }
    }
  }

  // ⑤ Urban Fire Hydrants, Water Geysers, Trees/Bins & Evading Pedestrians
  updateUrbanPropsAndPedestrians(dt);

  // ⑥ Civilian Panic Evasion, Horns & Hazard Lights
  updateCivilianPanicAndHazards(dt);
}

