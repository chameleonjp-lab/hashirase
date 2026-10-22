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

  // If player presses HOVER on non-Rocket trim, auto-enable ROCKET trim so thruster hover always works!
  if (inputs.hover && !currentTrim.hasPerimeterFlight) {
    selectTrim('ROCKET');
  }

  const rawSteer = (inputs.left ? 1 : 0) - (inputs.right ? 1 : 0) + (playerSubsystems ? playerSubsystems.steerPullBias : 0);
  carState.steerAngle += (rawSteer - carState.steerAngle) * Math.min(1, dt * 11);
  yokeGroup.rotation.z = carState.steerAngle * 0.65;

  const targetWingAngle = inputs.brake ? 0.45 : (carState.suctionEnabled ? 0.22 : 0.05);
  activeWingGroup.rotation.x += (targetWingAngle - activeWingGroup.rotation.x) * Math.min(1, dt * 8);

  const hasGas = carState.airMassKg > 2;
  // Rear thruster boost fires when BOOST is held, or when hovering/airborne and pressing ACCEL/BOOST, or when steering while hovering
  const isHoveringMove = (carState.mode === 'AIR' && (inputs.accel || inputs.boost || (inputs.hover && Math.abs(rawSteer) > 0.05)));
  const usingBoost = (inputs.boost || isHoveringMove) && currentTrim.hasRearThrust && hasGas;

  let fireRollPulse1 = false;
  let fireRollPulse2 = false;
  let fireDownwardLift = false;
  let fireSideLeftRcs = false;
  let fireSideRightRcs = false;

  if (carState.mode === 'AIR' && currentTrim.hasPerimeterFlight && hasGas) {
    carState.airTimer += dt;
    const tAir = carState.airTimer;
    if (carState.airSubPhase === 'OVERHANG_DROP') {
      if (tAir >= 0.06 && tAir <= 0.34) {
        fireRollPulse1 = true;
      }
      if (tAir >= 0.48 && tAir <= 0.66) {
        fireRollPulse2 = true;
      }
      if (tAir > 0.75 && carState.y <= 11.5 && carState.y > 0.45 && carState.vy < -3.5) {
        fireDownwardLift = true;
        if (!inputs.left && !inputs.right && Math.sin(tAir * 55) > 0.15) {
          fireSideRightRcs = true;
        }
      }
    } else if (carState.airSubPhase === 'KICKFLIP_JUMP') {
      if (tAir <= 0.36) {
        fireDownwardLift = true;
      }
      if (tAir > 0.36 && tAir <= 0.62) {
        fireRollPulse1 = true;
      } else if (tAir > 0.68 && tAir <= 0.88) {
        fireRollPulse2 = true;
      }
      if (tAir > 0.92 && carState.y < 7.5 && carState.y > 0.45 && carState.vy < -3.5) {
        fireDownwardLift = true;
        if (!inputs.left && !inputs.right && Math.sin(tAir * 50) > 0.1) {
          fireSideLeftRcs = true;
        }
      }
    }

    if (inputs.hover) {
      fireDownwardLift = true;
    }

    // Mid-air directional RCS thrusters fire whenever turning left/right, spinning, or braking in mid-air
    if (inputs.rcsSpin || rawSteer > 0.06) {
      fireSideRightRcs = true;
      fireSideLeftRcs = false;
    } else if (rawSteer < -0.06) {
      fireSideLeftRcs = true;
      fireSideRightRcs = false;
    } else if (inputs.brake) {
      // Both front side RCS nozzles fire as retro-braking thrusters!
      fireSideLeftRcs = true;
      fireSideRightRcs = true;
    }
  } else if (carState.mode === 'GROUND' && currentTrim.hasPerimeterFlight && hasGas) {
    if (inputs.hover) {
      fireDownwardLift = true;
    }
    if (inputs.rcsSpin || (Math.abs(carState.speed) > 1.0 && rawSteer > 0.15)) {
      fireSideRightRcs = true;
      fireSideLeftRcs = false;
    } else if (Math.abs(carState.speed) > 1.0 && rawSteer < -0.15) {
      fireSideLeftRcs = true;
      fireSideRightRcs = false;
    }
  }

  const isCockpit = CAMERA_MODES[currentCamIndex].id === 'cockpit';
  thrusterPlumesGroup.visible = !isCockpit;
  hoverCones.forEach((c) => {
    c.visible = fireDownwardLift;
    if (fireDownwardLift) c.scale.set(0.92 + Math.random() * 0.16, 0.88 + Math.random() * 0.24, 0.92 + Math.random() * 0.16);
  });
  boostCones.forEach((c) => {
    c.visible = usingBoost;
    if (usingBoost) c.scale.set(1, 0.85 + Math.random() * 0.3, 1);
  });
  rollPulse1FL.visible = fireRollPulse1;
  rollPulse1RR.visible = fireRollPulse1;
  if (fireRollPulse1) {
    rollPulse1FL.scale.y = 0.85 + Math.random() * 0.3;
    rollPulse1RR.scale.y = 0.85 + Math.random() * 0.3;
  }
  rollPulse2FR.visible = fireRollPulse2;
  rollPulse2RL.visible = fireRollPulse2;
  if (fireRollPulse2) {
    rollPulse2FR.scale.y = 0.85 + Math.random() * 0.3;
    rollPulse2RL.scale.y = 0.85 + Math.random() * 0.3;
  }
  rcsLeftCone.visible = fireSideLeftRcs;
  rcsRightCone.visible = fireSideRightRcs;

  const anyRcs = fireRollPulse1 || fireRollPulse2 || fireSideLeftRcs || fireSideRightRcs;
  if (nozDots[0]) nozDots[0].classList.toggle('firing', fireDownwardLift || fireRollPulse1 || fireSideLeftRcs);
  if (nozDots[1]) nozDots[1].classList.toggle('firing', fireDownwardLift || fireRollPulse2 || fireSideRightRcs);
  if (nozDots[2]) nozDots[2].classList.toggle('firing', fireSideLeftRcs);
  if (nozDots[3]) nozDots[3].classList.toggle('firing', fireSideRightRcs);
  if (nozDots[4]) nozDots[4].classList.toggle('firing', usingBoost || fireDownwardLift);
  if (nozDots[5]) nozDots[5].classList.toggle('firing', usingBoost || fireDownwardLift);

  // COPV 1.5x Capacity (375 kg) Drain & Recharge
  if (fireDownwardLift || usingBoost || anyRcs) {
    const drain = (fireDownwardLift ? 42 : 0) + (usingBoost ? 34 : 0) + (anyRcs ? 14 : 0);
    carState.airMassKg = Math.max(0, carState.airMassKg - drain * dt);
  } else {
    carState.airMassKg = Math.min(COPV_MAX_KG, carState.airMassKg + 112.5 * dt);
  }

  suctionGlowRing.visible = carState.suctionEnabled && carState.mode !== 'AIR' && !isCockpit;
  if (suctionGlowRing.visible) suctionGlowRing.rotation.z += dt * 12;

  if ((fireDownwardLift || usingBoost) && carState.y < 11) {
    spawnSmokePuff(carState.x, Math.max(0.2, carState.y - 1.0), carState.z, fireDownwardLift ? 3.8 : 1.8);
    if (fireDownwardLift) {
      spawnSmokePuff(carState.x, 0.25, carState.z, 5.0);
    }
  }

  // ========================================================================
  // MODE 1: GROUND DRIVING WITH REALISTIC 2D INERTIA, SLIP ANGLE & WEIGHT TRANSFER
  // ========================================================================
  if (carState.mode === 'GROUND') {
    const fwdX = -Math.sin(carState.yaw);
    const fwdZ = -Math.cos(carState.yaw);
    const rightX = Math.cos(carState.yaw);
    const rightZ = -Math.sin(carState.yaw);

    // Decompose current world velocity (vx, vz) into car-local longitudinal & lateral slip components
    let vLong = carState.vx * fwdX + carState.vz * fwdZ;
    let vLat = carState.vx * rightX + carState.vz * rightZ;

    let longAcc = 0;
    if (inputs.accel) longAcc += currentTrim.accelBase;
    if (inputs.boost && usingBoost) longAcc += currentTrim.thrustBoost;
    if (inputs.brake) {
      if (vLong > 0.6) {
        longAcc -= (carState.suctionEnabled ? 46.0 : 34.0); // Carbon-ceramic + active aero braking
      } else {
        longAcc -= 24.0; // Reverse drive
      }
    }

    // Realistic aerodynamic drag (quadratic with speed) & rolling resistance
    const aeroDrag = 0.0024 * vLong * Math.abs(vLong);
    const rollingRes = (inputs.accel || inputs.brake || inputs.boost) ? 0.15 * vLong : 0.65 * vLong;
    const netLongAcc = longAcc - aeroDrag - rollingRes;

    const effPowerScale = playerSubsystems ? playerSubsystems.enginePowerScale * Math.max(0.68, 1.0 - playerSubsystems.tirePunctures * 0.08) : 1.0;
    vLong += netLongAcc * effPowerScale * dt;
    vLong = Math.max(-26, Math.min(currentTrim.maxSpeed * effPowerScale, vLong));
    if (!inputs.accel && !inputs.brake && !inputs.boost && Math.abs(vLong) < 0.08) {
      vLong = 0;
    }

    // Rotational Yaw Inertia: steering torque + side RCS torque accelerate yawVel smoothly
    let targetYawRate = 0;
    if (Math.abs(vLong) > 0.25) {
      const dir = vLong >= 0 ? 1 : -1;
      // High-speed understeer factor: at extreme speed, turn radius widens realistically unless Suction 4.7t is active
      const speedRatio = Math.min(1.0, Math.abs(vLong) / 75.0);
      const highSpeedFactor = carState.suctionEnabled ? (1.0 - speedRatio * 0.22) : (1.0 - speedRatio * 0.45);
      const baseTurnRate = carState.suctionEnabled ? 2.15 : 1.45;
      targetYawRate += carState.steerAngle * baseTurnRate * highSpeedFactor * dir;
    }
    if (inputs.rcsSpin && currentTrim.hasPerimeterFlight && hasGas) {
      targetYawRate += 4.2;
    } else if (Math.abs(vLong) <= 0.25 && Math.abs(rawSteer) > 0.1 && currentTrim.hasPerimeterFlight && hasGas) {
      // Stationary RCS pivot assist
      targetYawRate += rawSteer * 1.65;
    }

    const yawInertiaResponse = carState.suctionEnabled ? 13.5 : 8.5;
    carState.yawVel += (targetYawRate - carState.yawVel) * Math.min(1, dt * yawInertiaResponse);
    carState.yaw += carState.yawVel * dt;

    // Recompute new forward & right axes after yaw rotation
    const newFwdX = -Math.sin(carState.yaw);
    const newFwdZ = -Math.cos(carState.yaw);
    const newRightX = Math.cos(carState.yaw);
    const newRightZ = -Math.sin(carState.yaw);

    // Centrifugal lateral slip induced by turning at speed (vLong * yawVel) + existing lateral drift vLat
    const updatedVLat = carState.vx * newRightX + carState.vz * newRightZ;
    // ④ Weather (DRY/WET) & ① Tire Puncture grip scaling + 3D Skidmarks & Tire Smoke!
    const punctureGripPenalty = Math.max(0.48, 1.0 - (playerSubsystems ? playerSubsystems.tirePunctures * 0.14 : 0));
    const envGripMult = (weatherState ? weatherState.gripMultiplier : 1.0) * punctureGripPenalty;
    const maxTireGripAcc = (carState.suctionEnabled ? 42.0 : 19.5) * envGripMult;
    const corneringStiffness = (carState.suctionEnabled ? 11.5 : 5.8) * envGripMult;

    if ((Math.abs(updatedVLat) > 4.2 || (inputs.brake && Math.abs(vLong) > 9.0)) && Math.abs(vLong) > 3.5) {
      spawnTireSkidPair(carState.x, carState.z, carState.yaw);
      playTireScreechSound(Math.min(1.2, Math.abs(updatedVLat) / 8.0));
      if (Math.random() < 0.45) {
        spawnSmokePuff(carState.x, 0.18, carState.z, 1.4);
      }
    }
    const latGripDelta = Math.max(
      -maxTireGripAcc * dt,
      Math.min(maxTireGripAcc * dt, -updatedVLat * corneringStiffness * dt)
    );
    vLat = updatedVLat + latGripDelta;

    // Reconstruct world velocity vector (vx, vz) from longitudinal + lateral slip components
    carState.vx = newFwdX * vLong + newRightX * vLat;
    carState.vz = newFwdZ * vLong + newRightZ * vLat;
    carState.speed = vLong;

    const prevZ = carState.z;
    carState.x += carState.vx * dt;
    carState.z += carState.vz * dt;
    carState.y = 0;

    // Realistic Suspension Weight Transfer Inertia (Pitch under accel/braking, Roll under lateral G)
    const latG = (vLong * carState.yawVel) / 9.81;
    const longG = netLongAcc / 9.81;
    const targetSuspPitch = Math.max(-0.075, Math.min(0.075, -longG * 0.018));
    const targetSuspRoll = Math.max(-0.095, Math.min(0.095, -latG * 0.024));
    carState.suspPitchVel += ((targetSuspPitch - carState.suspPitch) * 65.0 - carState.suspPitchVel * 11.0) * dt;
    carState.suspRollVel += ((targetSuspRoll - carState.suspRoll) * 65.0 - carState.suspRollVel * 11.0) * dt;
    carState.suspPitch += carState.suspPitchVel * dt;
    carState.suspRoll += carState.suspRollVel * dt;

    carState.pitch = carState.suspPitch;
    carState.roll = carState.suspRoll;
    carState.gForce = Math.hypot(1.0, longG, latG);

    resolveBuildingCollisionForBody(carState, true);

    // Liftoff into Hover Flight when HOVER is pressed!
    if (fireDownwardLift && inputs.hover) {
      carState.mode = 'AIR';
      carState.airSubPhase = 'HOVER_FLIGHT';
      carState.airTimer = 0;
      carState.vy = 9.8;
      carState.y = 0.35;
    }

    if (
      currentCourse === 'PROVING_GROUND' &&
      ((prevZ >= RAMP.entryZ - 1.5 && carState.z <= RAMP.entryZ + 0.5) ||
      (carState.z <= RAMP.entryZ && carState.z >= RAMP.entryZ - 14.0)) &&
      Math.abs(carState.x) < RAMP.width * 0.48 &&
      carState.vz < -0.15
    ) {
      carState.mode = 'RAMP';
      carState.rampS = Math.max(0.1, RAMP.entryZ - carState.z);
      carState.speed = Math.max(carState.speed, Math.hypot(carState.vx, carState.vz));
      carState.yaw = 0;
    }

    const worldBound = currentCourse === 'NYC' ? NYC_RADIUS : 260;
    carState.x = Math.max(-worldBound, Math.min(worldBound, carState.x));
    carState.z = Math.max(-worldBound, Math.min(worldBound, carState.z));
  }
  // ========================================================================
  // MODE 2: OVERHANGING RAMP CLIMB & 4.7T SUCTION HOLD
  // ========================================================================
  else if (carState.mode === 'RAMP') {
    const curPt = getRampPoint(Math.max(0, carState.rampS), carState.x);
    const theta = curPt.theta;
    if (carState.suctionEnabled || inputs.boost || inputs.accel) {
      let wallAcc = 0;
      if (inputs.accel || inputs.boost) wallAcc += currentTrim.accelBase;
      if (inputs.brake) wallAcc -= 30;
      if (usingBoost) wallAcc += currentTrim.thrustBoost;
      carState.speed += wallAcc * dt;
      if (!inputs.accel && !inputs.brake && !inputs.boost && !usingBoost) {
        if (carState.suctionEnabled) {
          carState.speed *= Math.pow(0.84, dt * 60);
          if (Math.abs(carState.speed) < 0.35) carState.speed = 0;
        } else {
          carState.speed += (-16.5 * Math.sin(theta)) * dt;
        }
      } else {
        carState.speed *= Math.pow(0.992, dt * 60);
        carState.speed = Math.min(currentTrim.maxSpeed, carState.speed);
      }
    } else {
      const gravityTangential = -16.5 * Math.sin(theta);
      let wallAcc = gravityTangential;
      if (inputs.brake) wallAcc -= 25;
      carState.speed += wallAcc * dt;
    }
    carState.rampS += carState.speed * dt;
    if (Math.abs(carState.speed) > 0.2) {
      carState.x -= carState.steerAngle * 7.5 * dt;
    }
    carState.x = Math.max(-RAMP.width * 0.42, Math.min(RAMP.width * 0.42, carState.x));
    const pt = getRampPoint(Math.max(0, carState.rampS), carState.x);
    carState.y = pt.pos.y;
    carState.z = pt.pos.z;
    carState.pitch = pt.theta;
    carState.yaw = 0;
    carState.roll = 0;
    carState.gForce = carState.suctionEnabled ? 2.0 : 1.2;
    const maxArc = RAMP.totalArc;
    const lostWallGrip = !carState.suctionEnabled && !inputs.boost && !inputs.accel && pt.theta > 1.48;
    if (carState.rampS >= maxArc * 0.96 || inputs.hover || lostWallGrip) {
      detachFromOverhangIntoAir();
    } else if (carState.rampS <= 0 && carState.speed < 0) {
      carState.mode = 'GROUND';
      carState.y = 0;
      carState.pitch = 0;
      carState.z = RAMP.entryZ + 0.5;
    }
  }
  // ========================================================================
  // MODE 3: AIRBORNE / HOVER FLIGHT — FULL THRUSTER TURNING, VECTORED MOVEMENT & TRUE INERTIA
  // ========================================================================
  else if (carState.mode === 'AIR') {
    let verticalAcc = -20.5; // Gravity
    if (fireDownwardLift) {
      if (carState.airSubPhase === 'KICKFLIP_JUMP' && carState.airTimer <= 0.36) {
        verticalAcc += 28.5;
      } else if (inputs.hover) {
        // Active Hover Thruster Control: climbs smoothly and stabilizes vertical velocity for easy aerial maneuvering!
        const climbTargetVy = 7.5;
        const hoverAssist = (climbTargetVy - carState.vy) * 2.4;
        verticalAcc += 27.5 + Math.max(-8.0, Math.min(14.0, hoverAssist));
      } else if (carState.vy < -3.5) {
        verticalAcc += Math.min(38.0, Math.abs(carState.vy) * 4.2);
      } else {
        verticalAcc += 19.0;
      }
    }

    // 1) Mid-Air Rotational Inertia & RCS Yaw Turning (works even at 0 km/h while hovering in place!)
    let targetAirYawVel = 0;
    if (inputs.rcsSpin && currentTrim.hasPerimeterFlight && hasGas) {
      targetAirYawVel = 4.2;
    } else if (Math.abs(rawSteer) > 0.02) {
      // Side RCS nozzles provide strong yaw rotation while hovering/flying
      targetAirYawVel = carState.steerAngle * (inputs.hover ? 3.2 : 2.65);
    }
    const airYawResponsiveness = hasGas ? 10.5 : 3.5;
    carState.yawVel += (targetAirYawVel - carState.yawVel) * Math.min(1, dt * airYawResponsiveness);
    carState.yaw += carState.yawVel * dt;

    // 2) Mid-Air Linear Momentum & Thruster Vectoring Propulsion
    const fwdX = -Math.sin(carState.yaw);
    const fwdZ = -Math.cos(carState.yaw);
    const rightX = Math.cos(carState.yaw);
    const rightZ = -Math.sin(carState.yaw);

    let airForwardThrust = 0;
    if (inputs.accel) airForwardThrust += currentTrim.accelBase * 0.95;
    if (inputs.boost && usingBoost) airForwardThrust += currentTrim.thrustBoost * 0.90;
    if (inputs.brake) airForwardThrust -= 32.0; // Retro-thrusters brake & fly backward in mid-air!
    // When holding HOVER and steering without pressing ACCEL/BRAKE, provide gentle vectored hover-glide thrust so the car can move & turn while hovering!
    if (inputs.hover && !inputs.accel && !inputs.brake && !inputs.boost && Math.abs(rawSteer) > 0.05 && hasGas) {
      airForwardThrust += 14.5;
    }

    if (airForwardThrust !== 0 && hasGas) {
      carState.vx += fwdX * airForwardThrust * dt;
      carState.vz += fwdZ * airForwardThrust * dt;
    }

    // Realistic Airborne Inertia:
    // Momentum (vx, vz) is naturally conserved in mid-air!
    // When side RCS or main thrusters are actively firing, side-thruster vectoring gradually damps lateral drift
    // so you feel real aerial inertia (drifting along your velocity vector while curving into the new heading).
    const vLongAir = carState.vx * fwdX + carState.vz * fwdZ;
    const vLatAir = carState.vx * rightX + carState.vz * rightZ;

    const isActivelyThrusting = hasGas && (inputs.hover || inputs.accel || inputs.boost || inputs.brake || Math.abs(rawSteer) > 0.05);
    const latDampRate = isActivelyThrusting ? (inputs.hover ? 4.2 : 2.8) : 0.35;
    const newVLatAir = vLatAir * Math.exp(-latDampRate * dt);

    // Quadratic aerodynamic air drag on horizontal momentum
    const airHorizSpd = Math.hypot(vLongAir, newVLatAir);
    const airDragFactor = Math.max(0.92, 1.0 - (0.00075 * airHorizSpd + 0.08) * dt);

    carState.vx = (fwdX * vLongAir + rightX * newVLatAir) * airDragFactor;
    carState.vz = (fwdZ * vLongAir + rightZ * newVLatAir) * airDragFactor;

    const clampedHorizSpd = Math.hypot(carState.vx, carState.vz);
    if (clampedHorizSpd > currentTrim.maxSpeed) {
      carState.vx = (carState.vx / clampedHorizSpd) * currentTrim.maxSpeed;
      carState.vz = (carState.vz / clampedHorizSpd) * currentTrim.maxSpeed;
    }

    carState.vy += verticalAcc * dt;
    carState.x += carState.vx * dt;
    carState.y += carState.vy * dt;
    carState.z += carState.vz * dt;
    carState.speed = -Math.sin(carState.yaw) * carState.vx - Math.cos(carState.yaw) * carState.vz;

    // Expressive mid-air pitch & roll banking during thruster flight
    const targetAirPitch = (inputs.accel || inputs.boost) ? -0.085 : (inputs.brake ? 0.10 : 0);
    carState.pitch += (targetAirPitch - carState.pitch) * Math.min(1, dt * 6.0);

    if (Math.abs(carState.rollVel) > 0.05) {
      carState.roll += carState.rollVel * dt;
      if (carState.roll >= Math.PI * 2) {
        carState.roll = 0;
        carState.rollVel = 0;
      }
    } else if (Math.abs(carState.roll) > 0.28) {
      const rollSpeed = carState.airTimer >= 0.06 ? 6.2 : 1.2;
      const rollStep = rollSpeed * dt;
      if (carState.roll > 0) {
        carState.roll = Math.max(0, carState.roll - rollStep);
      } else {
        carState.roll = Math.min(0, carState.roll + rollStep);
      }
    } else {
      const targetBankRoll = -carState.steerAngle * 0.22;
      carState.roll += (targetBankRoll - carState.roll) * Math.min(1, dt * 7.5);
    }

    resolveBuildingCollisionForBody(carState, true);
    const worldBoundAir = currentCourse === 'NYC' ? NYC_RADIUS : 260;
    carState.x = Math.max(-worldBoundAir, Math.min(worldBoundAir, carState.x));
    carState.z = Math.max(-worldBoundAir, Math.min(worldBoundAir, carState.z));

    // Touchdown onto Ground: preserve true 2D momentum vector (vx, vz) without snapping!
    if (carState.y <= 0 && carState.vy <= 0) {
      if (carState.airTimer > 0.28) {
        for (let k = 0; k < 10; k++) {
          spawnSmokePuff(carState.x, 0.25, carState.z, 3.8);
        }
      }
      // Transfer vertical impact velocity into suspension compression impulse
      carState.suspPitchVel += Math.max(-0.8, carState.vy * 0.04);
      carState.y = 0;
      carState.vy = 0;
      carState.pitchVel = 0;
      carState.rollVel = 0;
      carState.mode = 'GROUND';
      carState.airSubPhase = 'NONE';
      // Keep carState.vx and carState.vz intact so landing at a slip angle smoothly scrubs via ground tire inertia!
      carState.speed = -Math.sin(carState.yaw) * carState.vx - Math.cos(carState.yaw) * carState.vz;
    }
  }

  wheels.forEach((w, idx) => {
    w.children[0].rotation.x -= carState.speed * dt * 1.4;
    w.children[1].rotation.x -= carState.speed * dt * 1.4;
    if (idx < 2) w.rotation.y = carState.steerAngle * 0.38;
  });

  carRoot.position.set(carState.x, carState.y, carState.z);
  carRoot.rotation.order = 'YXZ';
  carRoot.rotation.y = carState.yaw;
  carRoot.rotation.x = carState.pitch;
  carRoot.rotation.z = carState.roll;

  const stepDist = Math.hypot(carState.vx, carState.vz) * dt;
  if (!timeAttackState.finished && !policePursuitState.gameOver) {
    carState.totalDistanceTraveled += stepDist;
  }
  updatePursuitHudUI();
  const kmh = Math.round(Math.hypot(carState.vx, carState.vz) * 3.6);
  uiSpeed.textContent = kmh;
  uiAltFt.textContent = (carState.y * 3.28084).toFixed(1);
  const gasPct = Math.round((carState.airMassKg / COPV_MAX_KG) * 100);
  uiGasPct.textContent = `${gasPct}%`;

  const uiDmg = document.getElementById('val-damage-pct');
  if (uiDmg) {
    uiDmg.textContent = `${carState.integrity}%`;
    uiDmg.className = carState.integrity > 70 ? 'text-emerald-300' : (carState.integrity > 40 ? 'text-amber-300' : 'text-red-400');
  }

  if (carState.mode === 'RAMP') {
    const deg = Math.round((carState.pitch * 180) / Math.PI);
    uiBadge.textContent = kmh === 0 ? `WALL HOLD 0km/h (${deg}°)` : `WALL ${deg}° (4.7t吸着)`;
    uiBadge.className = 'text-[9px] font-mono-tech font-bold px-1.5 py-0.5 rounded bg-purple-500/25 text-purple-200 border border-purple-400/50';
  } else if (carState.mode === 'AIR') {
    uiBadge.textContent = inputs.hover ? 'HOVER FLIGHT (3D推進・旋回)' : (fireRollPulse1 || fireRollPulse2 ? 'RCS PULSE' : (fireDownwardLift ? 'THRUSTER BURST' : 'INERTIA ARC'));
    uiBadge.className = 'text-[9px] font-mono-tech font-bold px-1.5 py-0.5 rounded bg-sky-500/25 text-sky-300 border border-sky-400/50';
  } else {
    uiBadge.textContent = currentCourse === 'NYC' ? 'NYC DAYTIME (40種破損・慣性)' : (carState.suctionEnabled ? 'SUCTION 4.7t' : 'GROUND INERTIA');
    uiBadge.className = 'text-[9px] font-mono-tech font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40';
  }

  const rollDeg = ((-carState.roll * 180) / Math.PI).toFixed(1);
  const pitchOffsetPx = Math.max(-45, Math.min(45, carState.pitch * 24));
  hudHorizon.style.transform = `translateY(${pitchOffsetPx}px) rotate(${rollDeg}deg)`;
  updateAudio(fireDownwardLift, anyRcs, usingBoost);
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
function updateCamera(dt) {
const modeId = CAMERA_MODES[currentCamIndex].id;
const isPortrait = window.innerWidth < window.innerHeight;
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
const targetFov = baseFov + spdRatio * 9.5 + boostFovAdd;
camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 7.5);
camera.updateProjectionMatrix();

if (cameraEffectsState && cameraEffectsState.shakeIntensity > 0.005) {
  const s = cameraEffectsState.shakeIntensity;
  camera.position.x += (Math.random() - 0.5) * s * 0.45;
  camera.position.y += (Math.random() - 0.5) * s * 0.35;
  camera.position.z += (Math.random() - 0.5) * s * 0.45;
  cameraEffectsState.shakeIntensity *= Math.pow(0.78, dt * 60);
  if (cameraEffectsState.shakeIntensity < 0.01) cameraEffectsState.shakeIntensity = 0;
}
}
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
