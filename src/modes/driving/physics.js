import { finite } from '../../contracts/validation.js';
import { assertInputFrame, createInputFrame } from '../../contracts/vehicle.js';
import { createCarState, resetCarState, vehicleSnapshot, DRIVING_TRIMS, GAME_RAMP, COPV_CAPACITY } from './state.js';
export function createRampProfile(RAMP = GAME_RAMP) {
const RAMP_LUT_STEPS = 200;
const rampLUT = [];
(function buildRampLUT() {
let curY = 0;
let curZ = RAMP.entryZ;
const ds = RAMP.totalArc / RAMP_LUT_STEPS;
for (let i = 0; i <= RAMP_LUT_STEPS; i++) {
const s = i * ds;
const u = s / RAMP.totalArc; // 0 .. 1
let theta;
if (u < 0.22) {
const t = u / 0.22;
theta = (t * t * (3 - 2 * t)) * 0.56;
} else if (u < 0.62) {
const t = (u - 0.22) / 0.40;
theta = 0.56 + t * 1.15;
} else {
const t = (u - 0.62) / 0.38;
theta = 1.71 + (1 - Math.pow(1 - t, 1.35)) * (RAMP.maxAngle - 1.71);
}
rampLUT.push({
s,
y: curY,
z: curZ,
theta
});
if (i < RAMP_LUT_STEPS) {
curY += Math.sin(theta) * ds;
curZ -= Math.cos(theta) * ds;
}
}
})();

function point(s,lateralX=0){
const clampedS = Math.min(Math.max(s, 0), RAMP.totalArc);
const fIdx = (clampedS / RAMP.totalArc) * RAMP_LUT_STEPS;
const i0 = Math.min(Math.floor(fIdx), RAMP_LUT_STEPS - 1);
const i1 = i0 + 1;
const frac = fIdx - i0;
const p0 = rampLUT[i0];
const p1 = rampLUT[i1];
const y = p0.y + (p1.y - p0.y) * frac;
const z = p0.z + (p1.z - p0.z) * frac;
const theta = p0.theta + (p1.theta - p0.theta) * frac;
const tangent = {x:0,y:Math.sin(theta),z:-Math.cos(theta)};
const normal = {x:0,y:Math.cos(theta),z:Math.sin(theta)};
return {
pos: {x:lateralX,y,z},
tangent,
normal,
theta
};
}
return {point,samples:rampLUT};
}
export function detachVehicle(carState, getRampPoint) {
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
export function beginKickflip(carState,getRampPoint) {
  if(carState.mode==='GROUND'){carState.mode='AIR';carState.airSubPhase='KICKFLIP_JUMP';carState.airTimer=0;carState.vy=13.5;carState.y=0.4;}
  else if(carState.mode==='RAMP') detachVehicle(carState,getRampPoint);
  carState.rollVel=Math.PI*2.9;
}
/** Migrated numeric update. hooks are private to the one legacy compatibility adapter. */
export function stepVehicleState(carState,dt,inputs,environment={},hooks={}) {
  let currentTrim=environment.trim || DRIVING_TRIMS.ROCKET;
  const currentCourse=environment.course || 'PROVING_GROUND';
  const RAMP=environment.ramp || GAME_RAMP, NYC_RADIUS=environment.nycRadius??4200, COPV_MAX_KG=COPV_CAPACITY;
  const playerSubsystems=environment.subsystems, weatherState={gripMultiplier:environment.gripMultiplier??1};
  const getRampPoint=environment.rampPoint || createRampProfile(RAMP).point;
  const effects={};
  // If player presses HOVER on non-Rocket trim, auto-enable ROCKET trim so thruster hover always works!
  if (inputs.hover && !currentTrim.hasPerimeterFlight) {
    currentTrim = DRIVING_TRIMS.ROCKET; effects.trim = 'ROCKET';
  }

  const rawSteer = Number(inputs.left) - Number(inputs.right) + (playerSubsystems ? playerSubsystems.steerPullBias : 0);
  carState.steerAngle += (rawSteer - carState.steerAngle) * Math.min(1, dt * 11);



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

  const anyRcs = fireRollPulse1 || fireRollPulse2 || fireSideLeftRcs || fireSideRightRcs;
  // COPV 1.5x Capacity (375 kg) Drain & Recharge
  if (fireDownwardLift || usingBoost || anyRcs) {
    const drain = (fireDownwardLift ? 42 : 0) + (usingBoost ? 34 : 0) + (anyRcs ? 14 : 0);
    carState.airMassKg = Math.max(0, carState.airMassKg - drain * dt);
  } else {
    carState.airMassKg = Math.min(COPV_MAX_KG, carState.airMassKg + 112.5 * dt);
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
    if (inputs.accel) longAcc += currentTrim.accelBase * inputs.accel;
    if (inputs.boost && usingBoost) longAcc += currentTrim.thrustBoost;
    if (inputs.brake) {
      if (!hooks.legacyBrakeReverse) {
        longAcc -= Math.sign(vLong) * (carState.suctionEnabled ? 46.0 : 34.0) * inputs.brake;
      } else if (vLong > 0.6) {
        longAcc -= (carState.suctionEnabled ? 46.0 : 34.0) * inputs.brake; // Carbon-ceramic + active aero braking
      } else {
        if (hooks.legacyBrakeReverse) longAcc -= 24.0 * inputs.brake; // Legacy keyboard compatibility only
      }
    }

    if (inputs.reverseThrottle) longAcc -= 24.0 * inputs.reverseThrottle;
    const beforeDrive = vLong;
    // Realistic aerodynamic drag (quadratic with speed) & rolling resistance
    const aeroDrag = 0.0024 * vLong * Math.abs(vLong);
    const rollingRes = (inputs.accel || inputs.brake || inputs.boost) ? 0.15 * vLong : 0.65 * vLong;
    const netLongAcc = longAcc - aeroDrag - rollingRes;

    const effPowerScale = playerSubsystems ? playerSubsystems.enginePowerScale * Math.max(0.68, 1.0 - playerSubsystems.tirePunctures * 0.08) : 1.0;
    vLong += netLongAcc * effPowerScale * dt;
    if (inputs.brake && !hooks.legacyBrakeReverse && beforeDrive * vLong <= 0) vLong = 0;
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
      effects.skid = {x:carState.x,z:carState.z,yaw:carState.yaw,intensity:Math.min(1.2,Math.abs(updatedVLat)/8.0)};
    }
    const latGripDelta = Math.max(
      -maxTireGripAcc * dt,
      Math.min(maxTireGripAcc * dt, -updatedVLat * corneringStiffness * dt)
    );
    vLat = updatedVLat + latGripDelta;

    // Reconstruct world velocity vector (vx, vz) from longitudinal + lateral slip components
    carState.vx = newFwdX * vLong + newRightX * vLat;
    carState.vz = newFwdZ * vLong + newRightZ * vLat;
    if (!hooks.legacyBrakeReverse && inputs.brake && vLong === 0 && vLat === 0) carState.vx = carState.vz = 0;
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

    if (hooks.collide) hooks.collide(carState);

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
      detachVehicle(carState,getRampPoint);
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
    if (inputs.brake && hooks.legacyBrakeReverse) airForwardThrust -= 32.0; // Old keyboard retro-thrust.
    if (inputs.reverseThrottle) airForwardThrust -= 32.0 * inputs.reverseThrottle;
    // When holding HOVER and steering without pressing ACCEL/BRAKE, provide gentle vectored hover-glide thrust so the car can move & turn while hovering!
    if (inputs.hover && !inputs.accel && !inputs.brake && !inputs.boost && Math.abs(rawSteer) > 0.05 && hasGas) {
      airForwardThrust += 14.5;
    }

    if (airForwardThrust !== 0 && hasGas) {
      carState.vx += fwdX * airForwardThrust * dt;
      carState.vz += fwdZ * airForwardThrust * dt;
    }
    if (inputs.brake && !hooks.legacyBrakeReverse && hasGas) {
      const longitudinal = carState.vx * fwdX + carState.vz * fwdZ;
      const brakingDelta = Math.sign(longitudinal) * Math.min(Math.abs(longitudinal), 32.0 * inputs.brake * dt);
      carState.vx -= fwdX * brakingDelta;
      carState.vz -= fwdZ * brakingDelta;
    }

    // Realistic Airborne Inertia:
    // Momentum (vx, vz) is naturally conserved in mid-air!
    // When side RCS or main thrusters are actively firing, side-thruster vectoring gradually damps lateral drift
    // so you feel real aerial inertia (drifting along your velocity vector while curving into the new heading).
    const vLongAir = carState.vx * fwdX + carState.vz * fwdZ;
    const vLatAir = carState.vx * rightX + carState.vz * rightZ;

    const isActivelyThrusting = hasGas && (inputs.hover || inputs.accel || inputs.reverseThrottle || inputs.boost || inputs.brake || Math.abs(rawSteer) > 0.05);
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

    if (hooks.collide) hooks.collide(carState);
    const worldBoundAir = currentCourse === 'NYC' ? NYC_RADIUS : 260;
    carState.x = Math.max(-worldBoundAir, Math.min(worldBoundAir, carState.x));
    carState.z = Math.max(-worldBoundAir, Math.min(worldBoundAir, carState.z));

    // Touchdown onto Ground: preserve true 2D momentum vector (vx, vz) without snapping!
    if (carState.y <= 0 && carState.vy <= 0) {
      if (carState.airTimer > 0.28) {
        effects.touchdown = true;
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


  return {...effects,fireDownwardLift,fireRollPulse1,fireRollPulse2,fireSideLeftRcs,fireSideRightRcs,usingBoost,anyRcs};
}
export function legacyInput(frame) {
  assertInputFrame(frame);
  return {accel:frame.throttle,brake:frame.brake,reverseThrottle:frame.reverseThrottle??0,left:Math.max(0,-frame.steer),right:Math.max(0,frame.steer),boost:frame.boost,hover:frame.hover,rcsSpin:false};
}
export function createVehicleModel(config={}) {
  const car=createCarState(config.initial), ramp=createRampProfile(); let trim=DRIVING_TRIMS[config.trim||'ROCKET']; let previousKick=false;
  if(!trim) throw new TypeError('Unknown driving trim');
  return Object.freeze({
    step(dt,frame=createInputFrame(),environment={}) {
      finite(dt,'dt',Number.MIN_VALUE); assertInputFrame(frame);
      if(frame.kickflip&&!previousKick) beginKickflip(car,ramp.point); previousKick=frame.kickflip;
      const effects=stepVehicleState(car,dt,legacyInput(frame),{...environment,trim,course:config.course,rampPoint:ramp.point});
      if(effects.trim)trim=DRIVING_TRIMS[effects.trim];
      return effects;
    },
    reset(initial={}){resetCarState(car,initial);previousKick=false;},
    snapshot(){return vehicleSnapshot(car);}
  });
}
