// ============================================================================
// UTILITY POLE (電柱) SYSTEM — DEPLOYED IN PROVING GROUND & NYC
// Breaks/snaps on collision and reduces player speed by 60 km/h (16.67 m/s) once!
// ============================================================================
const utilityPoles = [];
const pgUtilityPoleGroup = new THREE.Group();
provingGroundGroup.add(pgUtilityPoleGroup);
const nycUtilityPoleGroup = new THREE.Group();
nycCityGroup.add(nycUtilityPoleGroup);

const uPoleConcreteMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.65, metalness: 0.18 });
const uPoleBaseDarkMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.7, metalness: 0.25 });
const uPoleHazardMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
const uPoleCrossarmMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.45, metalness: 0.65 });
const uPoleTransformerMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.35, metalness: 0.55 });
const uPoleInsulatorMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
const uPoleLampGlowMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });

const uStumpGeo = new THREE.CylinderGeometry(0.19, 0.22, 0.90, 10);
const uHazardBandGeo = new THREE.CylinderGeometry(0.205, 0.215, 0.38, 10);
const uUpperShaftGeo = new THREE.CylinderGeometry(0.13, 0.185, 8.2, 10);
const uTransformerGeo = new THREE.CylinderGeometry(0.27, 0.27, 1.05, 10);
const uCrossarmGeo = new THREE.BoxGeometry(2.35, 0.11, 0.11);
const uInsulatorGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.20, 8);
const uStreetLampGeo = new THREE.BoxGeometry(0.85, 0.09, 0.24);

function createUtilityPole(x, z, courseType, yawAngle = 0) {
  const root = new THREE.Group();
  root.position.set(x, 0, z);

  // Lower fixed stump (remains anchored when the pole snaps at y = 0.90m)
  const stump = new THREE.Mesh(uStumpGeo, uPoleBaseDarkMat);
  stump.position.y = 0.45;
  root.add(stump);

  const hazardBand = new THREE.Mesh(uHazardBandGeo, uPoleHazardMat);
  hazardBand.position.y = 0.52;
  root.add(hazardBand);

  // Upper breakable assembly pivoted at the fracture point (y = 0.90m)
  const upperGroup = new THREE.Group();
  upperGroup.position.set(0, 0.90, 0);
  upperGroup.rotation.order = "YXZ";
  upperGroup.rotation.y = yawAngle;

  const shaft = new THREE.Mesh(uUpperShaftGeo, uPoleConcreteMat);
  shaft.position.y = 4.1;
  upperGroup.add(shaft);

  // Pole-mounted cylindrical transformer (変圧器)
  const transformer = new THREE.Mesh(uTransformerGeo, uPoleTransformerMat);
  transformer.position.set(0.32, 4.6, 0);
  upperGroup.add(transformer);

  // Two horizontal cross-arms (腕金) with ceramic insulators (がいし)
  const arm1 = new THREE.Mesh(uCrossarmGeo, uPoleCrossarmMat);
  arm1.position.set(0, 6.4, 0);
  upperGroup.add(arm1);

  const arm2 = new THREE.Mesh(uCrossarmGeo, uPoleCrossarmMat);
  arm2.position.set(0, 7.3, 0);
  upperGroup.add(arm2);

  [-0.95, -0.35, 0.35, 0.95].forEach((ix) => {
    const ins1 = new THREE.Mesh(uInsulatorGeo, uPoleInsulatorMat);
    ins1.position.set(ix, 6.54, 0);
    upperGroup.add(ins1);
    const ins2 = new THREE.Mesh(uInsulatorGeo, uPoleInsulatorMat);
    ins2.position.set(ix, 7.44, 0);
    upperGroup.add(ins2);
  });

  // Street lamp bracket
  const lamp = new THREE.Mesh(uStreetLampGeo, uPoleLampGlowMat);
  lamp.position.set(-0.48, 5.4, 0);
  upperGroup.add(lamp);

  root.add(upperGroup);

  if (courseType === "PROVING_GROUND") {
    pgUtilityPoleGroup.add(root);
  } else {
    nycUtilityPoleGroup.add(root);
  }

  const poleObj = {
    id: utilityPoles.length,
    course: courseType,
    root,
    upperGroup,
    x,
    z,
    baseYaw: yawAngle,
    radius: 0.42,
    broken: false,
    fallAxisYaw: 0,
    fallAngle: 0,
    fallAngleVel: 0,
    detachOffsetX: 0,
    detachOffsetZ: 0
  };
  utilityPoles.push(poleObj);
  return poleObj;
}

function populateAllUtilityPoles() {
  // 1) Proving Ground Utility Poles along both sides of the main runway & Kickflip lane
  for (let z = -190; z <= 170; z += 22) {
    // Keep clear of the Overhanging Ramp entry apron (-44.. -28)
    if (z >= -46 && z <= -26) continue;
    createUtilityPole(-8.2, z, "PROVING_GROUND", 0);
    createUtilityPole( 8.2, z, "PROVING_GROUND", Math.PI);
  }
  for (let z = -140; z <= 140; z += 26) {
    if (Math.abs(z - KICKFLIP_LANE.stageZ) < 14) continue;
    createUtilityPole(KICKFLIP_LANE.x - 6.8, z, "PROVING_GROUND", 0);
    createUtilityPole(KICKFLIP_LANE.x + 6.8, z, "PROVING_GROUND", Math.PI);
  }

  // 2) NYC Metropolis Utility Poles along Avenue curbs & Cross-Streets
  NYC_AVES.forEach((aveX) => {
    for (let z = -3760; z <= 3760; z += 40) {
      // Skip intersection openings with cross-streets
      let nearIntersection = false;
      for (let s = 0; s < NYC_STS.length; s++) {
        if (Math.abs(z - NYC_STS[s]) < 15.5) {
          nearIntersection = true;
          break;
        }
      }
      if (nearIntersection) continue;
      createUtilityPole(aveX - 13.8, z, "NYC", 0);
      createUtilityPole(aveX + 13.8, z, "NYC", Math.PI);
    }
  });

  // Additional poles along major NYC Cross-Streets near core area
  NYC_STS.forEach((stZ) => {
    if (Math.abs(stZ) > 1800) return;
    for (let x = -1450; x <= 1450; x += 60) {
      let nearAve = false;
      for (let a = 0; a < NYC_AVES.length; a++) {
        if (Math.abs(x - NYC_AVES[a]) < 19.0) {
          nearAve = true;
          break;
        }
      }
      if (nearAve) continue;
      createUtilityPole(x, stZ - 10.4, "NYC", Math.PI / 2);
      createUtilityPole(x, stZ + 10.4, "NYC", -Math.PI / 2);
    }
  });
}
populateAllUtilityPoles();

function resetAllUtilityPoles() {
  for (let i = 0; i < utilityPoles.length; i++) {
    const p = utilityPoles[i];
    if (p.broken) {
      p.broken = false;
      p.fallAngle = 0;
      p.fallAngleVel = 0;
      p.detachOffsetX = 0;
      p.detachOffsetZ = 0;
      p.upperGroup.position.set(0, 0.90, 0);
      p.upperGroup.rotation.set(0, p.baseYaw, 0);
    }
  }
}

function updateAndCollideUtilityPoles(dt) {
  const DECEL_60KMH_MS = 60.0 / 3.6; // 16.6667 m/s (exact 60 km/h speed reduction)
  const playerHitRadius = 1.48; // Player car half-width + pole radius

  for (let i = 0; i < utilityPoles.length; i++) {
    const p = utilityPoles[i];
    if (p.course !== currentCourse) continue;

    // 700m active radius culling in NYC
    const dxP = p.x - carState.x;
    const dzP = p.z - carState.z;
    const distSq = dxP * dxP + dzP * dzP;
    if (currentCourse === "NYC") {
      if (distSq > ACTIVE_RENDER_RADIUS_SQ) {
        if (p.root.visible) p.root.visible = false;
        continue;
      } else if (!p.root.visible) {
        p.root.visible = true;
      }
    }

    // Animate falling/snapped utility poles
    if (p.broken) {
      if (p.fallAngle < Math.PI * 0.485) {
        p.fallAngleVel += 9.8 * Math.max(0.25, Math.sin(Math.max(0.18, p.fallAngle))) * dt;
        p.fallAngle += p.fallAngleVel * dt;
        if (p.fallAngle >= Math.PI * 0.485) {
          p.fallAngle = Math.PI * 0.485;
          if (p.fallAngleVel > 1.2) {
            p.fallAngleVel = -p.fallAngleVel * 0.22;
          } else {
            p.fallAngleVel = 0;
          }
        }
        p.upperGroup.rotation.set(p.fallAngle, p.fallAxisYaw, 0);
      }
      continue;
    }

    // Check collision with Player Car (when car is below pole top height 8.8m)
    if (distSq < playerHitRadius * playerHitRadius && carState.y < 8.5) {
      // Snap the utility pole!
      p.broken = true;
      const moveSpd = Math.hypot(carState.vx, carState.vz);
      let pushDirX = -dxP;
      let pushDirZ = -dzP;
      if (moveSpd > 0.5) {
        pushDirX = carState.vx / moveSpd;
        pushDirZ = carState.vz / moveSpd;
      } else {
        const d = Math.max(0.01, Math.hypot(dxP, dzP));
        pushDirX = dxP / d;
        pushDirZ = dzP / d;
      }

      // Orient upperGroup so +X rotation tilts it away along (pushDirX, pushDirZ)
      p.fallAxisYaw = Math.atan2(pushDirX, pushDirZ);
      p.fallAngle = 0.14;
      p.fallAngleVel = Math.min(8.5, 2.6 + moveSpd * 0.14);
      p.upperGroup.position.set(pushDirX * 0.28, 0.86, pushDirZ * 0.28);
      p.upperGroup.rotation.set(p.fallAngle, p.fallAxisYaw, 0);

      // Apply exact one-time 60 km/h (16.6667 m/s) speed reduction to the player car!
      const prevKmh = Math.round(moveSpd * 3.6);
      const newSpd = Math.max(0, moveSpd - DECEL_60KMH_MS);
      if (moveSpd > 0.001) {
        const scale = newSpd / moveSpd;
        carState.vx *= scale;
        carState.vz *= scale;
      } else {
        carState.vx = 0;
        carState.vz = 0;
      }
      carState.speed = -Math.sin(carState.yaw) * carState.vx - Math.cos(carState.yaw) * carState.vz;
      const newKmh = Math.round(newSpd * 3.6);

      // Slight suspension pitch jolt & speed-based 物損 (Property Damage) HP reduction
      carState.suspPitchVel -= 0.35;
      const dmgInfo = applyCollisionDamageAndOffense("POLE", moveSpd, "電柱");

      spawnCrashDebris(p.x, 1.0, p.z, Math.max(10, moveSpd));
      playCrashSound(1.25);
      triggerHaptic(22);
      if (!policePursuitState.gameOver) {
        showToast(`⚡ 【物損】電柱に衝突して折れました！（-${dmgInfo.hpLoss} HP / 60km/h減速: ${prevKmh}➔${newKmh}km/h）`);
      }
    }
  }

  // Also check physical collision with NYC Traffic Signal Poles (信号機 -> 物損)
  if (currentCourse === "NYC" && !policePursuitState.gameOver) {
    for (let sIdx = 0; sIdx < nycTrafficSignals.length; sIdx++) {
      const sig = nycTrafficSignals[sIdx];
      if (!sig.intGroup.visible) continue;
      // Pole 1 at (aveX + 16.2, stZ + 12.2), Pole 2 at (aveX - 16.2, stZ - 12.2)
      const poles = [
        { key: "pole1Broken", wx: sig.aveX + 16.2, wz: sig.stZ + 12.2, meshes: [sig.pole1, sig.arm1, sig.box1, sig.nsRed1, sig.nsYel1, sig.nsGrn1] },
        { key: "pole2Broken", wx: sig.aveX - 16.2, wz: sig.stZ - 12.2, meshes: [sig.pole2, sig.arm2, sig.box2, sig.nsRed2, sig.nsYel2, sig.nsGrn2] }
      ];
      for (let pIdx = 0; pIdx < poles.length; pIdx++) {
        const sp = poles[pIdx];
        if (sig[sp.key]) continue;
        const dxS = sp.wx - carState.x;
        const dzS = sp.wz - carState.z;
        if (dxS * dxS + dzS * dzS < playerHitRadius * playerHitRadius && carState.y < 7.2) {
          sig[sp.key] = true;
          const moveSpd = Math.hypot(carState.vx, carState.vz);
          const prevKmh = Math.round(moveSpd * 3.6);
          const newSpd = Math.max(0, moveSpd - DECEL_60KMH_MS);
          if (moveSpd > 0.001) {
            const scale = newSpd / moveSpd;
            carState.vx *= scale;
            carState.vz *= scale;
          } else {
            carState.vx = 0;
            carState.vz = 0;
          }
          carState.speed = -Math.sin(carState.yaw) * carState.vx - Math.cos(carState.yaw) * carState.vz;
          const newKmh = Math.round(newSpd * 3.6);

          // Visually tilt/knock down the struck traffic signal assembly
          sp.meshes.forEach((m) => {
            if (m) {
              m.rotation.z = 0.65;
              m.rotation.x = 0.45;
              m.position.y *= 0.65;
            }
          });

          const dmgInfo = applyCollisionDamageAndOffense("SIGNAL", moveSpd, "信号機");
          spawnCrashDebris(sp.wx, 1.2, sp.wz, Math.max(10, moveSpd));
          playCrashSound(1.3);
          triggerHaptic(22);
          if (!policePursuitState.gameOver) {
            showToast(`🚦 【物損】信号機に衝突・破損！（-${dmgInfo.hpLoss} HP / 60km/h減速: ${prevKmh}➔${newKmh}km/h）`);
          }
        }
      }
    }
  }
}
