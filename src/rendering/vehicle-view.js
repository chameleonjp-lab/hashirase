/** Read-only car data is translated into the existing meshes/HUD. */
export function applyDrivingVisuals(view,carState,dt,effects) {
  const {yokeGroup,activeWingGroup,thrusterPlumesGroup,hoverCones,boostCones,rollPulse1FL,rollPulse1RR,rollPulse2FR,rollPulse2RL,rcsLeftCone,rcsRightCone,nozDots,suctionGlowRing,wheels,carRoot,uiSpeed,uiAltFt,uiGasPct,uiBadge,hudHorizon,document,inputs,CAMERA_MODES,currentCamIndex,currentCourse,COPV_MAX_KG,spawnSmokePuff,spawnTireSkidPair,playTireScreechSound,updatePursuitHudUI,random}=view;
  const {fireDownwardLift,fireRollPulse1,fireRollPulse2,fireSideLeftRcs,fireSideRightRcs,usingBoost,anyRcs}=effects;
  yokeGroup.rotation.z=carState.steerAngle*0.65;
  const targetWingAngle=inputs.brake?0.45:(carState.suctionEnabled?0.22:0.05);
  activeWingGroup.rotation.x+=(targetWingAngle-activeWingGroup.rotation.x)*Math.min(1,dt*8);
  const isCockpit = CAMERA_MODES[currentCamIndex].id === 'cockpit';
  thrusterPlumesGroup.visible = !isCockpit;
  hoverCones.forEach((c) => {
    c.visible = fireDownwardLift;
    if (fireDownwardLift) c.scale.set(0.92 + random() * 0.16, 0.88 + random() * 0.24, 0.92 + random() * 0.16);
  });
  boostCones.forEach((c) => {
    c.visible = usingBoost;
    if (usingBoost) c.scale.set(1, 0.85 + random() * 0.3, 1);
  });
  rollPulse1FL.visible = fireRollPulse1;
  rollPulse1RR.visible = fireRollPulse1;
  if (fireRollPulse1) {
    rollPulse1FL.scale.y = 0.85 + random() * 0.3;
    rollPulse1RR.scale.y = 0.85 + random() * 0.3;
  }
  rollPulse2FR.visible = fireRollPulse2;
  rollPulse2RL.visible = fireRollPulse2;
  if (fireRollPulse2) {
    rollPulse2FR.scale.y = 0.85 + random() * 0.3;
    rollPulse2RL.scale.y = 0.85 + random() * 0.3;
  }
  rcsLeftCone.visible = fireSideLeftRcs;
  rcsRightCone.visible = fireSideRightRcs;


  if (nozDots[0]) nozDots[0].classList.toggle('firing', fireDownwardLift || fireRollPulse1 || fireSideLeftRcs);
  if (nozDots[1]) nozDots[1].classList.toggle('firing', fireDownwardLift || fireRollPulse2 || fireSideRightRcs);
  if (nozDots[2]) nozDots[2].classList.toggle('firing', fireSideLeftRcs);
  if (nozDots[3]) nozDots[3].classList.toggle('firing', fireSideRightRcs);
  if (nozDots[4]) nozDots[4].classList.toggle('firing', usingBoost || fireDownwardLift);
  if (nozDots[5]) nozDots[5].classList.toggle('firing', usingBoost || fireDownwardLift);


  suctionGlowRing.visible = carState.suctionEnabled && carState.mode !== 'AIR' && !isCockpit;
  if (suctionGlowRing.visible) suctionGlowRing.rotation.z += dt * 12;

  if ((fireDownwardLift || usingBoost) && carState.y < 11) {
    spawnSmokePuff(carState.x, Math.max(0.2, carState.y - 1.0), carState.z, fireDownwardLift ? 3.8 : 1.8);
    if (fireDownwardLift) {
      spawnSmokePuff(carState.x, 0.25, carState.z, 5.0);
    }
  }


  if(effects.skid){ const s=effects.skid;spawnTireSkidPair(s.x,s.z,s.yaw);playTireScreechSound(s.intensity);if(random()<0.45)spawnSmokePuff(carState.x,0.18,carState.z,1.4); }
  if(effects.touchdown)for(let k=0;k<10;k++)spawnSmokePuff(carState.x,0.25,carState.z,3.8);
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

}
export function applyVehicleSnapshot(mesh,snapshot) {
  mesh.position.set(snapshot.position.x,snapshot.position.y,snapshot.position.z);
  mesh.quaternion.set(snapshot.rotation.x,snapshot.rotation.y,snapshot.rotation.z,snapshot.rotation.w);
}
