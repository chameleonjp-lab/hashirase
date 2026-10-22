// ============================================================================
// 40 CRASH DAMAGE PATTERNS PER VEHICLE TYPE (40 FOR SEDAN + 40 FOR BOX TRUCK)
// Driven by exact local contact zone (8 zones) x inertia/momentum mode (5 modes)
// ============================================================================
const IMPACT_ZONES_8 = [
  { id: 'FRONT_CENTER', jp: '正面中央',     zx:  0.0, zz: -1.0, primaryPartsSedan: ['frontBumper', 'hoodFL', 'hoodFR', 'hlL', 'hlR'], primaryPartsTruck: ['frontBumper', 'grille', 'cabLeft', 'cabRight', 'windshield', 'hlL', 'hlR'] },
  { id: 'FRONT_LEFT',   jp: '左フロント角', zx: -0.8, zz: -0.8, primaryPartsSedan: ['frontBumper', 'hoodFL', 'hlL', 'wheelFL', 'doorLeft'], primaryPartsTruck: ['frontBumper', 'grille', 'cabLeft', 'hlL', 'wheelFL', 'cargoFL'] },
  { id: 'FRONT_RIGHT',  jp: '右フロント角', zx:  0.8, zz: -0.8, primaryPartsSedan: ['frontBumper', 'hoodFR', 'hlR', 'wheelFR', 'doorRight'], primaryPartsTruck: ['frontBumper', 'grille', 'cabRight', 'hlR', 'wheelFR', 'cargoFR'] },
  { id: 'SIDE_LEFT',    jp: '左側面Tボーン', zx: -1.0, zz:  0.0, primaryPartsSedan: ['doorLeft', 'cabinRoof', 'windshield', 'wheelFL', 'wheelRL'], primaryPartsTruck: ['cargoFL', 'cargoRL', 'chassis', 'cabLeft', 'wheelFL', 'wheelRL'] },
  { id: 'SIDE_RIGHT',   jp: '右側面Tボーン', zx:  1.0, zz:  0.0, primaryPartsSedan: ['doorRight', 'cabinRoof', 'windshield', 'wheelFR', 'wheelRR'], primaryPartsTruck: ['cargoFR', 'cargoRR', 'chassis', 'cabRight', 'wheelFR', 'wheelRR'] },
  { id: 'REAR_LEFT',    jp: '左リア角',     zx: -0.8, zz:  0.8, primaryPartsSedan: ['rearBumper', 'trunkRL', 'tlL', 'wheelRL', 'doorLeft'], primaryPartsTruck: ['rearBumper', 'cargoRL', 'tlL', 'wheelRL', 'chassis'] },
  { id: 'REAR_RIGHT',   jp: '右リア角',     zx:  0.8, zz:  0.8, primaryPartsSedan: ['rearBumper', 'trunkRR', 'tlR', 'wheelRR', 'doorRight'], primaryPartsTruck: ['rearBumper', 'cargoRR', 'tlR', 'wheelRR', 'chassis'] },
  { id: 'REAR_CENTER',  jp: '真後ろ追突',   zx:  0.0, zz:  1.0, primaryPartsSedan: ['rearBumper', 'trunkRL', 'trunkRR', 'tlL', 'tlR'], primaryPartsTruck: ['rearBumper', 'cargoRL', 'cargoRR', 'tlL', 'tlR', 'chassis'] }
];

const INERTIA_MODES_5 = [
  { id: 'DIRECT_CRUSH',       jp: '直撃バンパー・外板圧潰',         crushScale: 0.48, buckleY: 0.08, shearYaw:  0.00, pitchFold:  0.14, rollTwist:  0.10, camberBend: 0.22 },
  { id: 'ACCORDION_BUCKLE',   jp: '中速フレーム座屈・パネル山折り', crushScale: 0.72, buckleY: 0.22, shearYaw:  0.06, pitchFold:  0.28, rollTwist:  0.18, camberBend: 0.38 },
  { id: 'OBLIQUE_SHEAR_L',    jp: '斜め慣性左剪断・ノーズ捻れ',     crushScale: 0.80, buckleY: 0.16, shearYaw:  0.34, pitchFold:  0.20, rollTwist: -0.28, camberBend: 0.45 },
  { id: 'OBLIQUE_SHEAR_R',    jp: '斜め慣性右剪断・ノーズ捻れ',     crushScale: 0.80, buckleY: 0.16, shearYaw: -0.34, pitchFold:  0.20, rollTwist:  0.28, camberBend: 0.45 },
  { id: 'CATASTROPHIC_VCAVE', jp: '超高速V字陥没・車軸＆ルーフ崩壊', crushScale: 1.15, buckleY: 0.36, shearYaw:  0.22, pitchFold:  0.46, rollTwist:  0.42, camberBend: 0.72 }
];

function build40VehicleDamageCatalog(vehicleClass) {
  const catalog = [];
  for (let zIdx = 0; zIdx < IMPACT_ZONES_8.length; zIdx++) {
    const zone = IMPACT_ZONES_8[zIdx];
    for (let mIdx = 0; mIdx < INERTIA_MODES_5.length; mIdx++) {
      const mode = INERTIA_MODES_5[mIdx];
      const patternNum = zIdx * 5 + mIdx + 1;
      catalog.push({
        patternId: patternNum,
        vehicleClass,
        zoneIdx: zIdx,
        modeIdx: mIdx,
        zoneId: zone.id,
        modeId: mode.id,
        label: `${vehicleClass === 'TRUCK' ? 'トラック' : 'セダン'}破損#${String(patternNum).padStart(2, '0')}[${zone.jp}×${mode.jp}]`,
        zone,
        mode,
        primaryParts: vehicleClass === 'TRUCK' ? zone.primaryPartsTruck : zone.primaryPartsSedan
      });
    }
  }
  return catalog;
}

const SEDAN_DAMAGE_PATTERNS = build40VehicleDamageCatalog('SEDAN'); // 40 patterns for Sedan (セダン)
const TRUCK_DAMAGE_PATTERNS = build40VehicleDamageCatalog('TRUCK'); // 40 patterns for Box Truck (トラック)
window.__SEDAN_DAMAGE_PATTERNS_40 = SEDAN_DAMAGE_PATTERNS;
window.__TRUCK_DAMAGE_PATTERNS_40 = TRUCK_DAMAGE_PATTERNS;

function resetVehicleVisualDamage(group) {
  if (!group) return;
  group.children.forEach((child) => {
    const u = child.userData;
    if (u && typeof u.origX === 'number') {
      child.position.set(u.origX, u.origY, u.origZ);
      child.rotation.set(u.origRx, u.origRy, u.origRz);
      child.scale.set(u.origSx, u.origSy, u.origSz);
      if (u.dmg) {
        u.dmg.dx = 0; u.dmg.dy = 0; u.dmg.dz = 0;
        u.dmg.rx = 0; u.dmg.ry = 0; u.dmg.rz = 0;
        u.dmg.sx = 1; u.dmg.sy = 1; u.dmg.sz = 1;
      }
    } else {
      child.rotation.z = 0;
      child.rotation.x = 0;
      child.scale.set(1, 1, 1);
    }
  });
}

function applyVisualDamageToVehicle(group, damageAmount) {
  if (!group) return;
  if (damageAmount <= 0.01) {
    resetVehicleVisualDamage(group);
    return;
  }
  const severity = Math.min(1.0, damageAmount / 100);
  group.children.forEach((child, idx) => {
    const u = child.userData;
    if (u && u.dmg) {
      child.position.set(u.origX + u.dmg.dx, u.origY + u.dmg.dy, u.origZ + u.dmg.dz);
      child.rotation.set(u.origRx + u.dmg.rx, u.origRy + u.dmg.ry, u.origRz + u.dmg.rz);
      child.scale.set(u.origSx * u.dmg.sx, u.origSy * u.dmg.sy, u.origSz * u.dmg.sz);
    } else {
      child.rotation.z = (idx % 2 === 0 ? 1 : -1) * severity * 0.14;
      child.rotation.x = (idx % 3 === 0 ? 1 : -1) * severity * 0.10;
      child.scale.x = 1.0 - severity * 0.12;
      child.scale.z = 1.0 - severity * 0.14;
    }
  });
}

// Apply localized, inertia-vector-driven crash damage using the 40-pattern catalog for each vehicle type!
function applyLocalizedInertiaCrashDamage(v, worldContactX, worldContactZ, worldImpX, worldImpZ, impactSpeed) {
  if (!v || !v.bodyPartsGroup) return null;

  // Transform world contact offset & world collision impulse vector into vehicle v's local frame
  const relWx = worldContactX - v.x;
  const relWz = worldContactZ - v.z;
  const cosY = Math.cos(-v.yaw);
  const sinY = Math.sin(-v.yaw);

  // In vehicle local coords: X is right (+halfW), Z is rear (+halfL), -Z is front (-halfL)
  const localHitX = relWx * cosY - relWz * sinY;
  const localHitZ = relWx * sinY + relWz * cosY;

  const impMag = Math.max(0.001, Math.hypot(worldImpX, worldImpZ));
  const normImpWx = worldImpX / impMag;
  const normImpWz = worldImpZ / impMag;
  const localImpDirX = normImpWx * cosY - normImpWz * sinY;
  const localImpDirZ = normImpWx * sinY + normImpWz * cosY;

  // Normalize hit coordinates by vehicle half-dimensions
  const nxHit = Math.max(-1.2, Math.min(1.2, localHitX / Math.max(0.8, v.halfW)));
  const nzHit = Math.max(-1.2, Math.min(1.2, localHitZ / Math.max(1.5, v.halfL)));

  // 1) Select 1 of the 8 Impact Zones based on localHitX, localHitZ
  let zoneIdx = 0;
  if (nzHit < -0.38) {
    if (nxHit < -0.32) zoneIdx = 1;      // FRONT_LEFT
    else if (nxHit > 0.32) zoneIdx = 2;  // FRONT_RIGHT
    else zoneIdx = 0;                    // FRONT_CENTER
  } else if (nzHit > 0.38) {
    if (nxHit < -0.32) zoneIdx = 5;      // REAR_LEFT
    else if (nxHit > 0.32) zoneIdx = 6;  // REAR_RIGHT
    else zoneIdx = 7;                    // REAR_CENTER
  } else {
    zoneIdx = nxHit < 0 ? 3 : 4;         // SIDE_LEFT or SIDE_RIGHT
  }

  // 2) Select 1 of the 5 Inertia Modes based on impactSpeed and shear angle between contact normal & impulse vector
  const crossShear = nxHit * localImpDirZ - nzHit * localImpDirX;
  let modeIdx = 0;
  if (impactSpeed >= 27.0) {
    modeIdx = 4; // CATASTROPHIC_VCAVE
  } else if (Math.abs(crossShear) > 0.38 && impactSpeed >= 9.0) {
    modeIdx = crossShear > 0 ? 2 : 3; // OBLIQUE_SHEAR_L or OBLIQUE_SHEAR_R
  } else if (impactSpeed >= 12.0) {
    modeIdx = 1; // ACCORDION_BUCKLE
  } else {
    modeIdx = 0; // DIRECT_CRUSH
  }

  const catalog = v.vehicleType === 'TRUCK' ? TRUCK_DAMAGE_PATTERNS : SEDAN_DAMAGE_PATTERNS;
  const pattern = catalog[zoneIdx * 5 + modeIdx];
  v.lastPatternId = pattern.patternId;
  v.lastPatternLabel = pattern.label;

  const energyFactor = Math.min(1.35, Math.max(0.22, impactSpeed / 24.0)) * pattern.mode.crushScale;

  // 3) Deform each anatomical sub-mesh according to its proximity to the impact point and the inertia vector!
  v.bodyPartsGroup.children.forEach((part) => {
    const u = part.userData;
    if (!u || !u.dmg) return;

    const distX = (u.zoneX - localHitX) / Math.max(1.0, v.halfW * 1.35);
    const distZ = (u.zoneZ - localHitZ) / Math.max(1.5, v.halfL * 1.15);
    const radialDist = Math.hypot(distX, distZ);

    // Localized proximity falloff: parts right at the impact point get maximum deformation; opposite end stays intact!
    const isPrimary = pattern.primaryParts.indexOf(u.partRole) !== -1;
    let weight = Math.max(0, 1.0 - radialDist * 0.78);
    if (isPrimary) weight = Math.max(weight, 0.68);
    if (weight <= 0.04) return;

    const wEff = weight * energyFactor;
    const isWheel = u.partRole.startsWith('wheel');
    const isLight = u.partRole === 'hlL' || u.partRole === 'hlR' || u.partRole === 'tlL' || u.partRole === 'tlR';

    // Push part inward along the inertia impulse vector (localImpDirX, localImpDirZ)
    const maxDispX = v.halfW * 0.46;
    const maxDispZ = v.halfL * 0.34;
    u.dmg.dx = Math.max(-maxDispX, Math.min(maxDispX, u.dmg.dx + localImpDirX * wEff * 0.48));
    u.dmg.dz = Math.max(-maxDispZ, Math.min(maxDispZ, u.dmg.dz + localImpDirZ * wEff * 0.56));

    // Accordion upward hood/roof/cargo buckle at impact zone
    if (!isWheel) {
      u.dmg.dy = Math.min(0.55, u.dmg.dy + pattern.mode.buckleY * wEff * (u.partRole.includes('hood') || u.partRole.includes('trunk') || u.partRole.includes('cargo') ? 1.25 : 0.65));
    }

    // Axial compression (crumple zone shortening along impact axis) + vertical tenting
    const compX = Math.abs(localImpDirX) * wEff * 0.34;
    const compZ = Math.abs(localImpDirZ) * wEff * 0.38;
    if (!isWheel) {
      u.dmg.sx = Math.max(0.52, u.dmg.sx * (1.0 - compX));
      u.dmg.sz = Math.max(0.48, u.dmg.sz * (1.0 - compZ));
      u.dmg.sy = Math.min(1.32, u.dmg.sy * (1.0 + (compX + compZ) * 0.25));
    }

    // Angular folding & twisting along the inertia vector
    const foldSignZ = localImpDirZ >= 0 ? 1 : -1;
    const foldSignX = localImpDirX >= 0 ? 1 : -1;
    if (isWheel) {
      // Broken axle / extreme camber & toe-out on struck wheel
      u.dmg.rx = Math.max(-0.65, Math.min(0.65, u.dmg.rx + foldSignZ * pattern.mode.camberBend * wEff));
      u.dmg.ry = Math.max(-0.65, Math.min(0.65, u.dmg.ry + foldSignX * pattern.mode.camberBend * wEff));
      u.dmg.rz = Math.max(-0.75, Math.min(0.75, u.dmg.rz + (u.zoneX < 0 ? 1 : -1) * pattern.mode.camberBend * wEff));
    } else if (isLight) {
      // Dangling/shattered headlight or taillight
      u.dmg.rx += foldSignZ * 0.55 * wEff;
      u.dmg.ry += pattern.mode.shearYaw * 1.4 * wEff;
      u.dmg.dz += localImpDirZ * 0.18 * wEff;
    } else {
      u.dmg.rx = Math.max(-0.55, Math.min(0.55, u.dmg.rx + foldSignZ * pattern.mode.pitchFold * wEff));
      u.dmg.ry = Math.max(-0.52, Math.min(0.52, u.dmg.ry + pattern.mode.shearYaw * wEff));
      u.dmg.rz = Math.max(-0.55, Math.min(0.55, u.dmg.rz + foldSignX * pattern.mode.rollTwist * wEff));
    }

    part.position.set(u.origX + u.dmg.dx, u.origY + u.dmg.dy, u.origZ + u.dmg.dz);
    part.rotation.set(u.origRx + u.dmg.rx, u.origRy + u.dmg.ry, u.origRz + u.dmg.rz);
    part.scale.set(u.origSx * u.dmg.sx, u.origSy * u.dmg.sy, u.origSz * u.dmg.sz);
  });

  return pattern;
}

function isPointInsideNycBuilding(wx, wz, margin = 2.0) {
  if (currentCourse !== 'NYC') return false;
  for (let i = 0; i < nycBuildingColliders.length; i++) {
    const b = nycBuildingColliders[i];
    if (wx > b.minX - margin && wx < b.maxX + margin && wz > b.minZ - margin && wz < b.maxZ + margin) {
      return true;
    }
  }
  return false;
}

function updatePolicePursuitSystem(dt) {
  if (policePursuitState.carHitCooldown > 0) {
    policePursuitState.carHitCooldown = Math.max(0, policePursuitState.carHitCooldown - dt);
  }
  if (policePursuitState.policeHitCooldown > 0) {
    policePursuitState.policeHitCooldown = Math.max(0, policePursuitState.policeHitCooldown - dt);
  }

  // Check collisions with parked cars on Proving Ground so 3-car-hit pursuit works on Proving Ground too!
  if (currentCourse === 'PROVING_GROUND' && !policePursuitState.gameOver) {
    for (let i = 0; i < provingGroundParkedCars.length; i++) {
      const pc = provingGroundParkedCars[i];
      if (carState.y > pc.height) continue;
      const dx = pc.x - carState.x;
      const dz = pc.z - carState.z;
      const minX = 1.05 + pc.halfW;
      const minZ = 2.15 + pc.halfL;
      if (Math.abs(dx) < minX && Math.abs(dz) < minZ) {
        const overlapX = minX - Math.abs(dx);
        const overlapZ = minZ - Math.abs(dz);
        if (overlapX < overlapZ) {
          carState.x -= (dx >= 0 ? 1 : -1) * (overlapX + 0.15);
          carState.vx *= -0.45;
        } else {
          carState.z -= (dz >= 0 ? 1 : -1) * (overlapZ + 0.15);
          carState.vz *= -0.45;
        }
        const impactSpd = Math.hypot(carState.vx, carState.vz) + Math.abs(carState.speed);
        carState.speed *= -0.35;
        spawnCrashDebris(carState.x, Math.max(0.5, carState.y), carState.z, Math.max(8, impactSpd));
        playCrashSound(1.2);
        registerPlayerCarCollision(impactSpd, '展示車両');
      }
    }
  }

  if (!policePursuitState.active || policePursuitState.gameOver) return;

  policePursuitState.chaseElapsedSec += dt;
  policePursuitState.nextSpawnTimer -= dt;
  policePursuitState.sirenPhase += dt * 11.0;

  // Spawn +1 additional police cruiser every 30 seconds!
  if (policePursuitState.nextSpawnTimer <= 0) {
    policePursuitState.nextSpawnTimer += 30.0;
    spawnPoliceCruiser();
    showToast(`🚓 30秒経過！進行方向・サイドからパトカーが1台増援！（現在 ${policeUnits.length}台が追跡中）`);
  }

  const flashRed = Math.sin(policePursuitState.sirenPhase) > 0;

  for (let i = 0; i < policeUnits.length; i++) {
    const p = policeUnits[i];
    p.redLight.material = flashRed ? sirenRedOnMat : sirenOffMat;
    p.blueLight.material = flashRed ? sirenOffMat : sirenBlueOnMat;

    if (p.hitStunTimer > 0) {
      p.hitStunTimer = Math.max(0, p.hitStunTimer - dt);
    }

    // Lead-pursuit target toward player's position + velocity lookahead
    const toPlayerX = (carState.x + carState.vx * 0.28) - p.x;
    const toPlayerZ = (carState.z + carState.vz * 0.28) - p.z;
    const distToPlayer = Math.hypot(carState.x - p.x, carState.z - p.z);

    // If a police car falls far behind the player or > 190m away, re-deploy it ahead in the direction of travel or from the side!
    const moveSpd = Math.hypot(carState.vx, carState.vz);
    const travelYaw = moveSpd > 1.5 ? Math.atan2(-carState.vx, -carState.vz) : carState.yaw;
    const tFwdX = -Math.sin(travelYaw);
    const tFwdZ = -Math.cos(travelYaw);
    const relToPoliceX = p.x - carState.x;
    const relToPoliceZ = p.z - carState.z;
    const policeFwdProj = relToPoliceX * tFwdX + relToPoliceZ * tFwdZ;

    if (distToPlayer > 190 || (distToPlayer > 95 && policeFwdProj < -45)) {
      const { sx, sz } = selectPoliceForwardOrSideSpawnPoint(i + Math.floor(policePursuitState.chaseElapsedSec));
      p.x = sx;
      p.z = sz;
      const newYaw = Math.atan2(-(carState.x - p.x), -(carState.z - p.z));
      p.yaw = newYaw;
      p.vx = -Math.sin(newYaw) * 26;
      p.vz = -Math.cos(newYaw) * 26;
    }

    let desiredYaw = Math.atan2(-toPlayerX, -toPlayerZ);

    // =========================================================================
    // ACTIVE GENERAL TRAFFIC AVOIDANCE AI FOR CHASING POLICE CRUISERS
    // Police cruisers scan ahead for civilian vehicles (Sedans & Trucks) and
    // weave/steer into the clearest lane to avoid colliding with traffic!
    // =========================================================================
    const pFwdX = -Math.sin(p.yaw);
    const pFwdZ = -Math.cos(p.yaw);
    const pRightX = Math.cos(p.yaw);
    const pRightZ = -Math.sin(p.yaw);

    let avoidSteerYaw = 0;
    let avoidLateralVel = 0;
    const obstacles = currentCourse === 'NYC' ? nycTrafficVehicles : provingGroundParkedCars;

    for (let k = 0; k < obstacles.length; k++) {
      const obs = obstacles[k];
      if (obs.y && obs.y > 2.2) continue;

      // Predict civilian vehicle position 0.50s ahead
      const obsFutureX = obs.x + (obs.vx || 0) * 0.50;
      const obsFutureZ = obs.z + (obs.vz || 0) * 0.50;
      const rx = obsFutureX - p.x;
      const rz = obsFutureZ - p.z;

      // Project onto police car's forward and right axes
      const fwdProj = rx * pFwdX + rz * pFwdZ;
      const latProj = rx * pRightX + rz * pRightZ;

      const obsRadius = (obs.halfW || 1.1) + (obs.halfL || 2.3) * 0.35 + p.halfW + 2.4;
      if (fwdProj > -2.5 && fwdProj < 44.0 && Math.abs(latProj) < obsRadius) {
        const proximity = Math.max(0.05, 1.0 - fwdProj / 44.0);
        const latOverlap = 1.0 - Math.abs(latProj) / obsRadius;
        const urgency = proximity * (0.55 + 0.85 * latOverlap);

        // Determine which side (Left vs Right) has open road clearance away from buildings
        let passLeftSign = latProj >= 0 ? 1 : -1; // +1 = steer left (-pRight), -1 = steer right (+pRight)
        const testLeftX = p.x - pRightX * 4.8 + pFwdX * 8.0;
        const testLeftZ = p.z - pRightZ * 4.8 + pFwdZ * 8.0;
        const testRightX = p.x + pRightX * 4.8 + pFwdX * 8.0;
        const testRightZ = p.z + pRightZ * 4.8 + pFwdZ * 8.0;

        if (passLeftSign > 0 && isPointInsideNycBuilding(testLeftX, testLeftZ, 2.5)) {
          passLeftSign = -1;
        } else if (passLeftSign < 0 && isPointInsideNycBuilding(testRightX, testRightZ, 2.5)) {
          passLeftSign = 1;
        }

        avoidSteerYaw += passLeftSign * urgency * 1.45;
        avoidLateralVel += -passLeftSign * urgency * 16.5;

        // If extremely close (< 11m), also deflect position laterally so police smoothly skirts past civilian bumper
        if (fwdProj > -1.8 && fwdProj < 11.0 && Math.abs(latProj) < obsRadius * 0.72) {
          p.x += -passLeftSign * pRightX * 5.5 * dt;
          p.z += -passLeftSign * pRightZ * 5.5 * dt;
        }
      }
    }

    desiredYaw += Math.max(-1.15, Math.min(1.15, avoidSteerYaw));

    let angleDiff = Math.atan2(Math.sin(desiredYaw - p.yaw), Math.cos(desiredYaw - p.yaw));
    const turnRate = p.hitStunTimer > 0 ? 1.8 : 4.8;
    p.yaw += Math.max(-turnRate * dt, Math.min(turnRate * dt, angleDiff * 4.0 * dt));

    const fwdX = -Math.sin(p.yaw);
    const fwdZ = -Math.cos(p.yaw);
    const rightX = Math.cos(p.yaw);
    const rightZ = -Math.sin(p.yaw);
    const targetSpeed = Math.max(38.0, Math.min(p.maxSpeed, Math.abs(carState.speed) * 1.12 + 12.0));

    p.vx += (fwdX * p.accel + rightX * avoidLateralVel) * dt;
    p.vz += (fwdZ * p.accel + rightZ * avoidLateralVel) * dt;

    // Realistic lateral tire grip & inertia on police cruiser
    const curSpd = Math.hypot(p.vx, p.vz);
    if (curSpd > 0.1) {
      const clampedSpd = Math.min(targetSpeed, curSpd);
      p.vx = p.vx * 0.84 + fwdX * clampedSpd * 0.16;
      p.vz = p.vz * 0.84 + fwdZ * clampedSpd * 0.16;
    }

    p.x += p.vx * dt;
    p.z += p.vz * dt;

    // Physical non-penetration with civilian vehicles if a tight gap occurs
    if (currentCourse === 'NYC') {
      for (let k = 0; k < nycTrafficVehicles.length; k++) {
        const tv = nycTrafficVehicles[k];
        const dxT = tv.x - p.x;
        const dzT = tv.z - p.z;
        const minXT = p.halfW + (tv.axis === 'EW' ? tv.halfL : tv.halfW) * 0.85;
        const minZT = p.halfL + (tv.axis === 'NS' ? tv.halfL : tv.halfW) * 0.85;
        if (Math.abs(dxT) < minXT && Math.abs(dzT) < minZT) {
          const overX = minXT - Math.abs(dxT);
          const overZ = minZT - Math.abs(dzT);
          if (overX < overZ) {
            const s = dxT >= 0 ? -1 : 1;
            p.x += s * (overX + 0.08);
            p.vx += s * 6.0;
          } else {
            const s = dzT >= 0 ? -1 : 1;
            p.z += s * (overZ + 0.08);
            p.vz += s * 6.0;
          }
        }
      }
    }

    // Avoid/slide along buildings in NYC mode
    if (currentCourse === 'NYC') {
      const radius = 1.25;
      for (let bIdx = 0; bIdx < nycBuildingColliders.length; bIdx++) {
        const b = nycBuildingColliders[bIdx];
        if (p.x + radius < b.minX || p.x - radius > b.maxX) continue;
        if (p.z + radius < b.minZ || p.z - radius > b.maxZ) continue;
        const penLeft = (p.x + radius) - b.minX;
        const penRight = b.maxX - (p.x - radius);
        const penNorth = (p.z + radius) - b.minZ;
        const penSouth = b.maxZ - (p.z - radius);
        const minPen = Math.min(penLeft, penRight, penNorth, penSouth);
        if (minPen === penLeft) { p.x = b.minX - radius - 0.05; p.vx = Math.min(0, p.vx); }
        else if (minPen === penRight) { p.x = b.maxX + radius + 0.05; p.vx = Math.max(0, p.vx); }
        else if (minPen === penNorth) { p.z = b.minZ - radius - 0.05; p.vz = Math.min(0, p.vz); }
        else { p.z = b.maxZ + radius + 0.05; p.vz = Math.max(0, p.vz); }
      }
    }

    // Keep police cars separated from each other
    for (let j = i + 1; j < policeUnits.length; j++) {
      const p2 = policeUnits[j];
      const dxP = p2.x - p.x;
      const dzP = p2.z - p.z;
      const dP = Math.hypot(dxP, dzP);
      if (dP > 0.01 && dP < 3.2) {
        const push = (3.2 - dP) * 0.5;
        p.x -= (dxP / dP) * push;
        p.z -= (dzP / dP) * push;
        p2.x += (dxP / dP) * push;
        p2.z += (dzP / dP) * push;
      }
    }

    p.mesh.position.set(p.x, p.y, p.z);
    p.mesh.rotation.y = p.yaw;
    p.mesh.rotation.z = Math.max(-0.18, Math.min(0.18, -angleDiff * 0.22));

    // Check collision between this Police Cruiser and Player Car!
    if (Math.abs(carState.y - p.y) <= 2.1) {
      const dx = p.x - carState.x;
      const dz = p.z - carState.z;
      const minDistX = 2.05;
      const minDistZ = 4.15;
      if (Math.abs(dx) < minDistX && Math.abs(dz) < minDistZ) {
        const dist = Math.max(0.1, Math.hypot(dx, dz));
        const nx = dx / dist;
        const nz = dz / dist;
        // Separate player and police cruiser
        carState.x -= nx * 1.4;
        carState.z -= nz * 1.4;
        p.x += nx * 2.2;
        p.z += nz * 2.2;

        // Relative impact speed between Player Car and Police Cruiser
        const relImpactSpeed = Math.hypot(carState.vx - p.vx, carState.vz - p.vz);

        // Impulse bounce + ③ PIT Maneuver rear-flank spin torque!
        carState.vx -= nx * 12.0;
        carState.vz -= nz * 12.0;
        carState.speed = -Math.sin(carState.yaw) * carState.vx - Math.cos(carState.yaw) * carState.vz;
        const pCos = Math.cos(-carState.yaw), pSin = Math.sin(-carState.yaw);
        const localPx = dx * pCos - dz * pSin;
        const localPz = dx * pSin + dz * pCos;
        if (localPz > 0.45 && Math.abs(localPx) > 0.35) {
          // Police cruiser struck the rear quarter panel -> induce realistic PIT spin!
          carState.yawVel += (localPx > 0 ? 1 : -1) * 3.85;
        }
        p.vx = nx * 16.0;
        p.vz = nz * 16.0;
        p.hitStunTimer = 0.85;

        spawnCrashDebris((carState.x + p.x) / 2, 0.6, (carState.z + p.z) / 2, Math.max(14.0, relImpactSpeed));
        playCrashSound(1.8);

        if (policePursuitState.policeHitCooldown <= 0) {
          policePursuitState.policeHitCooldown = 0.75;
          // Police collision = 公務執行妨害 + 2x Civilian Car Damage at this impact speed!
          const dmgInfo = applyCollisionDamageAndOffense('POLICE_CAR', Math.max(carState.speed, relImpactSpeed), 'パトカー');
          if (policePursuitState.gameOver) return;
          showToast(`🚨 【公務執行妨害】パトカーと接触！(通常の2倍ダメージ: -${dmgInfo.hpLoss} HP / 残HP ${carState.hp})`);
        }
      }
    }
  }

  updatePursuitHudUI();
}

let debrisCursor = 0;
function spawnCrashDebris(x, y, z, impactSpeed) {
  const count = Math.min(24, Math.max(6, Math.floor(impactSpeed * 0.8)));
  for (let i = 0; i < count; i++) {
    const d = crashDebrisList[debrisCursor];
    debrisCursor = (debrisCursor + 1) % crashDebrisList.length;
    d.life = 0.01;
    d.maxLife = 0.55 + Math.random() * 0.65;
    d.mesh.position.set(
      x + (Math.random() - 0.5) * 1.8,
      Math.max(0.25, y + 0.5 + Math.random() * 0.8),
      z + (Math.random() - 0.5) * 1.8
    );
    const ang = Math.random() * Math.PI * 2;
    const spd = 4 + Math.random() * Math.min(28, impactSpeed * 0.9);
    d.vx = Math.cos(ang) * spd;
    d.vy = 3.5 + Math.random() * 9.5;
    d.vz = Math.sin(ang) * spd;
    d.rx = (Math.random() - 0.5) * 18;
    d.ry = (Math.random() - 0.5) * 18;
    d.mesh.visible = true;
  }
}

function updateCrashDebris(dt) {
  for (let i = 0; i < crashDebrisList.length; i++) {
    const d = crashDebrisList[i];
    if (d.life > 0) {
      d.life += dt;
      if (d.life >= d.maxLife) {
        d.life = 0;
        d.mesh.visible = false;
      } else {
        d.vy -= 22.0 * dt;
        d.mesh.position.x += d.vx * dt;
        d.mesh.position.y += d.vy * dt;
        d.mesh.position.z += d.vz * dt;
        if (d.mesh.position.y < 0.08) {
          d.mesh.position.y = 0.08;
          d.vy = -d.vy * 0.35;
          d.vx *= 0.7;
          d.vz *= 0.7;
        }
        d.mesh.rotation.x += d.rx * dt;
        d.mesh.rotation.y += d.ry * dt;
      }
    }
  }
}

function resolveBuildingCollisionForBody(body, isPlayer = false) {
  if (currentCourse !== 'NYC') return false;
  const radius = isPlayer ? 1.35 : Math.min(body.halfW, body.halfL);
  for (let i = 0; i < nycBuildingColliders.length; i++) {
    const b = nycBuildingColliders[i];
    if (body.x + radius < b.minX || body.x - radius > b.maxX) continue;
    if (body.z + radius < b.minZ || body.z - radius > b.maxZ) continue;
    if (body.y > b.height) continue;
    const penLeft = (body.x + radius) - b.minX;
    const penRight = b.maxX - (body.x - radius);
    const penNorth = (body.z + radius) - b.minZ;
    const penSouth = b.maxZ - (body.z - radius);
    const minPen = Math.min(penLeft, penRight, penNorth, penSouth);
    if (minPen > 0) {
      const impactSpd = Math.hypot(body.vx, body.vz);
      let wallNx = 0, wallNz = 0;
      if (minPen === penLeft) {
        body.x = b.minX - radius - 0.02;
        wallNx = -1;
      } else if (minPen === penRight) {
        body.x = b.maxX + radius + 0.02;
        wallNx = 1;
      } else if (minPen === penNorth) {
        body.z = b.minZ - radius - 0.02;
        wallNz = -1;
      } else {
        body.z = b.maxZ + radius + 0.02;
        wallNz = 1;
      }
      // Realistic inelastic wall impact with slight restitution + friction along wall
      const vn = body.vx * wallNx + body.vz * wallNz;
      if (vn < 0) {
        body.vx -= (1.18 * vn) * wallNx;
        body.vz -= (1.18 * vn) * wallNz;
        body.vx *= 0.55;
        body.vz *= 0.55;
      }
      if (isPlayer) {
        body.speed = -Math.sin(body.yaw) * body.vx - Math.cos(body.yaw) * body.vz;
        if (impactSpd > 3.5 && body.collisionCooldown <= 0) {
          body.collisionCooldown = 0.45;
          const dmgInfo = applyCollisionDamageAndOffense('WALL', impactSpd, 'ビル壁面');
          spawnCrashDebris(body.x, body.y, body.z, impactSpd);
          playCrashSound(Math.min(1.8, impactSpd / 12));
          if (!policePursuitState.gameOver) {
            showToast(`🧱 【物損】ビル壁面に衝突！（-${dmgInfo.hpLoss} HP / 残HP ${carState.hp}）`);
          }
        }
      } else {
        body.currentSpeed = 0;
        body.yawVel *= 0.25;
      }
      return true;
    }
  }
  return false;
}

function updateNycTrafficAndCollisions(dt) {
  if (currentCourse !== 'NYC') return;

  // Dynamically cull buildings & sidewalks outside 700m radius of the player car
  if (window.__updateNyc700mGeometryCulling) {
    window.__updateNyc700mGeometryCulling(false);
  }

  signalCycleTimer = (signalCycleTimer + dt) % 16.0;
  for (let i = 0; i < nycTrafficSignals.length; i++) {
    const sig = nycTrafficSignals[i];
    const distSq = (sig.aveX - carState.x) * (sig.aveX - carState.x) + (sig.stZ - carState.z) * (sig.stZ - carState.z);
    if (distSq > ACTIVE_RENDER_RADIUS_SQ) {
      if (sig.intGroup.visible) sig.intGroup.visible = false;
      continue;
    }
    if (!sig.intGroup.visible) sig.intGroup.visible = true;
    const phase = getSignalPhaseForIntersection(sig.aveIdx, sig.stIdx, signalCycleTimer);
    const isRed = phase.ns === 'RED';
    const isYel = phase.ns === 'YELLOW';
    const isGrn = phase.ns === 'GREEN';
    sig.nsRed1.material = isRed ? sigMatRedOn : sigMatOff;
    sig.nsYel1.material = isYel ? sigMatYellowOn : sigMatOff;
    sig.nsGrn1.material = isGrn ? sigMatGreenOn : sigMatOff;
    sig.nsRed2.material = isRed ? sigMatRedOn : sigMatOff;
    sig.nsYel2.material = isYel ? sigMatYellowOn : sigMatOff;
    sig.nsGrn2.material = isGrn ? sigMatGreenOn : sigMatOff;
  }

  const uiSignal = document.getElementById('val-signal-state');
  if (uiSignal) {
    const nearestAveIdx = Math.max(0, Math.min(NYC_AVES.length - 1, Math.round((carState.x + 1800) / 300)));
    const nearestStIdx = Math.max(0, Math.min(NYC_STS.length - 1, Math.round((carState.z + 1920) / 120)));
    const localPhase = getSignalPhaseForIntersection(nearestAveIdx, nearestStIdx, signalCycleTimer);
    if (localPhase.ns === 'GREEN') {
      uiSignal.textContent = '信号: 青 (進行可)';
      uiSignal.className = 'text-[9px] font-mono-tech font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40';
    } else if (localPhase.ns === 'YELLOW') {
      uiSignal.textContent = '信号: 黄 (注意)';
      uiSignal.className = 'text-[9px] font-mono-tech font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40';
    } else {
      uiSignal.textContent = '信号: 赤 (停止)';
      uiSignal.className = 'text-[9px] font-mono-tech font-bold px-1.5 py-0.5 rounded bg-red-500/25 text-red-300 border border-red-500/50';
    }
  }

  for (let i = 0; i < nycTrafficVehicles.length; i++) {
    const v = nycTrafficVehicles[i];
    if (v.crashed) {
      v.recoverTimer += dt;
      if (v.y > 0 || v.vy !== 0) {
        v.vy -= 21.0 * dt;
        v.y += v.vy * dt;
        if (v.y <= 0) {
          v.y = 0;
          if (Math.abs(v.vy) > 3.5) {
            v.vy = -v.vy * 0.32;
            v.rollVel += (Math.random() - 0.5) * 4.5;
          } else {
            v.vy = 0;
          }
        }
      }
      // Realistic post-impact sliding inertia & tire/metal scrub deceleration
      const decel = v.overturned ? 11.5 : 7.8;
      const curSpd = Math.hypot(v.vx, v.vz);
      if (curSpd > 0.05) {
        const newSpd = Math.max(0, curSpd - decel * dt);
        v.vx = (v.vx / curSpd) * newSpd;
        v.vz = (v.vz / curSpd) * newSpd;
      } else {
        v.vx = 0;
        v.vz = 0;
      }
      v.x += v.vx * dt;
      v.z += v.vz * dt;
      v.yaw += v.yawVel * dt;
      v.pitch += v.pitchVel * dt;
      v.roll += v.rollVel * dt;
      v.yawVel *= Math.pow(0.93, dt * 60);
      v.pitchVel *= Math.pow(0.90, dt * 60);
      v.rollVel *= Math.pow(0.92, dt * 60);
      if (v.y <= 0.05 && Math.abs(v.rollVel) < 0.8) {
        const targetRoll = v.overturned ? (Math.sign(v.roll || 1) * Math.PI * (Math.abs(v.roll) > 2.1 ? 1.0 : 0.52)) : 0;
        v.roll += (targetRoll - v.roll) * Math.min(1, dt * 5);
        v.pitch *= Math.pow(0.85, dt * 60);
      }
      resolveBuildingCollisionForBody(v, false);
      if (v.recoverTimer > 11.0 && !v.overturned) {
        v.crashed = false;
        v.roll = 0;
        v.pitch = 0;
        v.yaw = v.axis === 'NS' ? (v.dir === 1 ? Math.PI : 0) : (v.dir === 1 ? -Math.PI / 2 : Math.PI / 2);
      }
    } else {
      let shouldStop = false;
      if (v.axis === 'NS') {
        const aveIdx = Math.max(0, Math.min(NYC_AVES.length - 1, Math.round((v.x + 1800) / 300)));
        for (let s = 0; s < NYC_STS.length; s++) {
          const stZ = NYC_STS[s];
          const stopLineZ = stZ - v.dir * 14.5;
          const distToStop = (stopLineZ - v.z) * v.dir;
          if (distToStop > 0.5 && distToStop < 26.0) {
            const phase = getSignalPhaseForIntersection(aveIdx, s, signalCycleTimer);
            if (phase.ns !== 'GREEN' && v.y < 0.5) {
              shouldStop = true;
              break;
            }
          }
        }
      } else {
        const stIdx = Math.max(0, Math.min(NYC_STS.length - 1, Math.round((v.z + 1920) / 120)));
        for (let a = 0; a < NYC_AVES.length; a++) {
          const aveX = NYC_AVES[a];
          const stopLineX = aveX - v.dir * 18.0;
          const distToStop = (stopLineX - v.x) * v.dir;
          if (distToStop > 0.5 && distToStop < 26.0) {
            const phase = getSignalPhaseForIntersection(a, stIdx, signalCycleTimer);
            if (phase.ew !== 'GREEN') {
              shouldStop = true;
              break;
            }
          }
        }
      }
      for (let j = 0; j < nycTrafficVehicles.length; j++) {
        if (i === j) continue;
        const other = nycTrafficVehicles[j];
        if (v.axis === 'NS') {
          if (Math.abs(other.x - v.x) < 2.2) {
            const gap = (other.z - v.z) * v.dir;
            if (gap > 0 && gap < (v.halfL + other.halfL + 6.5) && other.y < 2.0) {
              shouldStop = true;
              break;
            }
          }
        } else {
          if (Math.abs(other.z - v.z) < 2.2) {
            const gap = (other.x - v.x) * v.dir;
            if (gap > 0 && gap < (v.halfL + other.halfL + 6.5)) {
              shouldStop = true;
              break;
            }
          }
        }
      }
      if (v.axis === 'NS' && Math.abs(carState.x - v.x) < 2.2 && carState.y < 2.0) {
        const gapP = (carState.z - v.z) * v.dir;
        if (gapP > 0 && gapP < v.halfL + 8.0) shouldStop = true;
      } else if (v.axis === 'EW' && Math.abs(carState.z - v.z) < 2.2 && carState.y < 2.0) {
        const gapP = (carState.x - v.x) * v.dir;
        if (gapP > 0 && gapP < v.halfL + 8.0) shouldStop = true;
      }
      const targetSpd = shouldStop ? 0 : v.cruiseSpeed;
      const accelRate = shouldStop ? 24.0 : 11.0;
      if (v.currentSpeed < targetSpd) {
        v.currentSpeed = Math.min(targetSpd, v.currentSpeed + accelRate * dt);
      } else {
        v.currentSpeed = Math.max(targetSpd, v.currentSpeed - accelRate * dt);
      }
      if (v.axis === 'NS') {
        v.vx = (v.baseLaneCoord - v.x) * 2.0;
        v.vz = v.dir * v.currentSpeed;
        v.yaw = v.dir === 1 ? Math.PI : 0;
      } else {
        v.vx = v.dir * v.currentSpeed;
        v.vz = (v.baseLaneCoord - v.z) * 2.0;
        v.yaw = v.dir === 1 ? -Math.PI / 2 : Math.PI / 2;
      }
      v.x += v.vx * dt;
      v.z += v.vz * dt;

      // Keep general traffic vehicles within a 700m active radius around the player car
      const relDx = v.x - carState.x;
      const relDz = v.z - carState.z;
      if (relDx * relDx + relDz * relDz > ACTIVE_RENDER_RADIUS_SQ) {
        if (v.axis === 'NS') {
          let nearestAve = NYC_AVES[0];
          let bestD = 99999;
          for (let a = 0; a < NYC_AVES.length; a++) {
            const d = Math.abs(NYC_AVES[a] - carState.x);
            if (d < bestD) { bestD = d; nearestAve = NYC_AVES[a]; }
          }
          const laneOffsets = [-9.2, -3.6, 3.6, 9.2];
          const laneOff = laneOffsets[v.id % 4];
          v.dir = laneOff < 0 ? 1 : -1;
          v.x = nearestAve + laneOff;
          v.baseLaneCoord = v.x;
          v.z = carState.z + ((v.id % 2 === 0 ? 1 : -1) * (180 + (v.id * 37) % 480));
          v.yaw = v.dir === 1 ? Math.PI : 0;
        } else {
          let nearestSt = NYC_STS[0];
          let bestD = 99999;
          for (let s = 0; s < NYC_STS.length; s++) {
            const d = Math.abs(NYC_STS[s] - carState.z);
            if (d < bestD) { bestD = d; nearestSt = NYC_STS[s]; }
          }
          const laneOff = (v.id % 2 === 0) ? 4.2 : -4.2;
          v.dir = laneOff > 0 ? 1 : -1;
          v.z = nearestSt + laneOff;
          v.baseLaneCoord = v.z;
          v.x = carState.x + ((v.id % 2 === 0 ? 1 : -1) * (180 + (v.id * 41) % 480));
          v.yaw = v.dir === 1 ? -Math.PI / 2 : Math.PI / 2;
        }
      }
    }

    const distSqToPlayer = (v.x - carState.x) * (v.x - carState.x) + (v.z - carState.z) * (v.z - carState.z);
    v.mesh.visible = distSqToPlayer <= ACTIVE_RENDER_RADIUS_SQ;
    if (v.mesh.visible) {
      v.mesh.position.set(v.x, v.y + (v.overturned ? 0.55 : 0), v.z);
      v.mesh.rotation.order = 'YXZ';
      v.mesh.rotation.y = v.yaw;
      v.mesh.rotation.x = v.pitch;
      v.mesh.rotation.z = v.roll;
    }
  }

  // Player vs Civilian Vehicle Collision with 2D Momentum Transfer + 40-Pattern Localized Inertia Deformation!
  for (let i = 0; i < nycTrafficVehicles.length; i++) {
    const v = nycTrafficVehicles[i];
    if (Math.abs(carState.y - v.y) > 2.2) continue;
    const dx = v.x - carState.x;
    const dz = v.z - carState.z;
    const minDistX = 1.05 + (v.axis === 'EW' ? v.halfL : v.halfW) * 0.88;
    const minDistZ = 2.15 + (v.axis === 'NS' ? v.halfL : v.halfW) * 0.88;
    if (Math.abs(dx) < minDistX && Math.abs(dz) < minDistZ) {
      const overlapX = minDistX - Math.abs(dx);
      const overlapZ = minDistZ - Math.abs(dz);
      let nx = 0, nz = 0, pen = 0;
      if (overlapX < overlapZ) {
        nx = dx >= 0 ? 1 : -1;
        pen = overlapX;
      } else {
        nz = dz >= 0 ? 1 : -1;
        pen = overlapZ;
      }
      const m1 = carState.mass;
      const m2 = v.mass;
      const totalM = m1 + m2;
      carState.x -= nx * pen * (m2 / totalM + 0.05);
      carState.z -= nz * pen * (m2 / totalM + 0.05);
      v.x += nx * pen * (m1 / totalM + 0.05);
      v.z += nz * pen * (m1 / totalM + 0.05);

      const rvx = v.vx - carState.vx;
      const rvz = v.vz - carState.vz;
      const velAlongNormal = rvx * nx + rvz * nz;
      if (velAlongNormal < 0) {
        const restitution = 0.54;
        const jImpulse = -(1 + restitution) * velAlongNormal / (1 / m1 + 1 / m2);
        // Include tangential momentum transfer (friction impulse during collision) for realistic inertia!
        const tangentX = -nz;
        const tangentZ = nx;
        const velAlongTangent = rvx * tangentX + rvz * tangentZ;
        const jTangent = Math.max(-0.35 * jImpulse, Math.min(0.35 * jImpulse, -velAlongTangent / (1 / m1 + 1 / m2) * 0.35));

        const impX = jImpulse * nx + jTangent * tangentX;
        const impZ = jImpulse * nz + jTangent * tangentZ;

        carState.vx -= impX / m1;
        carState.vz -= impZ / m1;
        v.vx += impX / m2;
        v.vz += impZ / m2;
        carState.speed = -Math.sin(carState.yaw) * carState.vx - Math.cos(carState.yaw) * carState.vz;

        const impactSpeed = Math.hypot(rvx, rvz);
        const playerApproachSpd = Math.max(impactSpeed, Math.hypot(carState.vx, carState.vz));
        const vTypeName = v.vehicleType === 'TRUCK' ? 'トラック' : 'セダン';
        const civDmgInfo = registerPlayerCarCollision(playerApproachSpd, vTypeName);

        if (impactSpeed > 2.2) {
          v.crashed = true;
          v.recoverTimer = 0;
          const dmgAdd = Math.min(65, impactSpeed * 2.2);
          v.damage = Math.min(100, v.damage + dmgAdd);

          // Exact world contact point between player car and struck vehicle
          const contactX = carState.x + dx * 0.45;
          const contactZ = carState.z + dz * 0.45;
          const appliedPattern = applyLocalizedInertiaCrashDamage(v, contactX, contactZ, impX, impZ, impactSpeed);

          // Realistic Angular Impulse (Torque = r x J / I)
          const leverX = contactX - v.x;
          const leverZ = contactZ - v.z;
          const torqueY = (leverZ * impX - leverX * impZ) / (m2 * 1.45);
          v.yawVel += torqueY;
          carState.yawVel -= torqueY * (m2 / m1) * 0.35;

          if (impactSpeed > 13.5) {
            v.vy = Math.min(11.5, 2.8 + impactSpeed * 0.26 * (m1 / m2));
            v.rollVel = (nx !== 0 ? -nx : (Math.random() > 0.5 ? 1 : -1)) * (5.2 + impactSpeed * 0.22);
            v.pitchVel = (nz !== 0 ? nz : (Math.random() - 0.5)) * 3.0;
            v.overturned = impactSpeed > 17.5;
          }

          if (impactSpeed > 28.0 && (!carState.suctionEnabled || impactSpeed > 40.0)) {
            carState.mode = 'AIR';
            carState.airSubPhase = 'CRASH_TUMBLE';
            carState.airTimer = 0;
            carState.vy = Math.min(9.5, 3.5 + impactSpeed * 0.16);
            carState.rollVel = (nx !== 0 ? nx : 1) * 6.2;
            carState.pitchVel = (Math.random() - 0.5) * 4.0;
          }

          spawnCrashDebris(contactX, 0.6, contactZ, impactSpeed);
          playCrashSound(Math.min(2.0, impactSpeed / 10));
          if (!policePursuitState.gameOver && civDmgInfo) {
            const patMsg = appliedPattern ? appliedPattern.label : '車両破損';
            showToast(`🚗 【器物損壊】${patMsg} (-${civDmgInfo.hpLoss} HP / 残HP ${carState.hp})`);
          }
        }
      }
    }
  }

  // Secondary AI-to-AI Chain Collisions with Localized Inertia Deformation!
  for (let i = 0; i < nycTrafficVehicles.length; i++) {
    const v1 = nycTrafficVehicles[i];
    if (!v1.crashed) continue;
    for (let j = 0; j < nycTrafficVehicles.length; j++) {
      if (i === j) continue;
      const v2 = nycTrafficVehicles[j];
      if (Math.abs(v1.y - v2.y) > 2.2) continue;
      const dx = v2.x - v1.x;
      const dz = v2.z - v1.z;
      if (Math.abs(dx) < 2.3 && Math.abs(dz) < 4.4) {
        const dist = Math.max(0.1, Math.hypot(dx, dz));
        const nx = dx / dist;
        const nz = dz / dist;
        v1.x -= nx * 0.35;
        v1.z -= nz * 0.35;
        v2.x += nx * 0.35;
        v2.z += nz * 0.35;
        const rvx = v1.vx - v2.vx;
        const rvz = v1.vz - v2.vz;
        const relSpd = Math.hypot(rvx, rvz);
        if (relSpd > 3.5) {
          v2.crashed = true;
          v2.recoverTimer = 0;
          const mRatio = v1.mass / (v1.mass + v2.mass);
          const impX = rvx * v2.mass * mRatio;
          const impZ = rvz * v2.mass * mRatio;
          v2.vx += rvx * mRatio * 1.15;
          v2.vz += rvz * mRatio * 1.15;
          v1.vx *= 0.45;
          v1.vz *= 0.45;
          v2.damage = Math.min(100, v2.damage + 35);
          const cx = (v1.x + v2.x) * 0.5;
          const cz = (v1.z + v2.z) * 0.5;
          applyLocalizedInertiaCrashDamage(v2, cx, cz, impX, impZ, relSpd);
          applyLocalizedInertiaCrashDamage(v1, cx, cz, -impX, -impZ, relSpd * 0.8);
          if (relSpd > 14.0) {
            v2.vy = 4.5;
            v2.rollVel = (Math.random() > 0.5 ? 1 : -1) * 6.5;
            v2.overturned = true;
          }
          spawnCrashDebris(cx, 0.6, cz, relSpd);
        }
      }
    }
  }
}
