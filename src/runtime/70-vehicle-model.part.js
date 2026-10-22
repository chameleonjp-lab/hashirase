await advanceLoadingStage(84, "2026 Tesla Roadster 車体・左ハンドル運転席・10基スラスターを生成中...", "STAGE 5/6 // ROADSTER & RCS");
const carRoot = new THREE.Group();
scene.add(carRoot);
const carBodyGroup = new THREE.Group();
carRoot.add(carBodyGroup);
const exteriorHullGroup = new THREE.Group();
carBodyGroup.add(exteriorHullGroup);
const anoWhiteMat = new THREE.MeshStandardMaterial({
color: 0xeef2f6,
roughness: 0.18,
metalness: 0.42
});
const carbonMat = new THREE.MeshStandardMaterial({
color: 0x0f141d,
roughness: 0.48,
metalness: 0.45
});
const recessedBlackMat = new THREE.MeshStandardMaterial({
color: 0x07090e,
roughness: 0.35,
metalness: 0.6
});
const canopyGlassMat = new THREE.MeshStandardMaterial({
color: 0x080b11,
roughness: 0.06,
metalness: 0.94,
transparent: true,
opacity: 0.92
});
const titaniumMat = new THREE.MeshStandardMaterial({
color: 0x64748b,
roughness: 0.25,
metalness: 0.85
});
const redLedMat = new THREE.MeshBasicMaterial({ color: 0xff1a24 });
const frontLedMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
const sideProfileShape = new THREE.Shape();
sideProfileShape.moveTo(-2.28, 0.22);
sideProfileShape.lineTo(-2.22, 0.48);
sideProfileShape.lineTo(-1.45, 0.74);
sideProfileShape.lineTo(-0.35, 0.84);
sideProfileShape.lineTo(1.25, 0.92);
sideProfileShape.lineTo(2.26, 0.88);
sideProfileShape.lineTo(2.28, 0.56);
sideProfileShape.lineTo(1.85, 0.20);
sideProfileShape.lineTo(-2.15, 0.18);
sideProfileShape.closePath();
const bodyExtrudeGeo = new THREE.ExtrudeGeometry(sideProfileShape, {
depth: 1.72,
bevelEnabled: true,
bevelSegments: 4,
steps: 1,
bevelSize: 0.14,
bevelThickness: 0.14
});
bodyExtrudeGeo.rotateY(Math.PI / 2);
bodyExtrudeGeo.translate(-1.72 / 2, 0, 0);
const sculptedCoreMesh = new THREE.Mesh(bodyExtrudeGeo, anoWhiteMat);
sculptedCoreMesh.castShadow = true;
exteriorHullGroup.add(sculptedCoreMesh);
const visibleFrontHood = new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.12, 1.35), anoWhiteMat);
visibleFrontHood.position.set(0, 0.64, -1.52);
visibleFrontHood.rotation.x = 0.16;
carBodyGroup.add(visibleFrontHood);
[-0.86, 0.86].forEach((sideX) => {
const frontFenderGeo = new THREE.CylinderGeometry(0.49, 0.49, 0.34, 24, 1, false, 0, Math.PI);
frontFenderGeo.rotateZ(Math.PI / 2);
const frontFender = new THREE.Mesh(frontFenderGeo, anoWhiteMat);
frontFender.position.set(sideX, 0.42, -1.38);
frontFender.scale.set(1, 0.92, 1.35);
carBodyGroup.add(frontFender);
const rearFenderGeo = new THREE.CylinderGeometry(0.52, 0.52, 0.38, 24, 1, false, 0, Math.PI);
rearFenderGeo.rotateZ(Math.PI / 2);
const rearFender = new THREE.Mesh(rearFenderGeo, anoWhiteMat);
rearFender.position.set(sideX * 1.03, 0.44, 1.38);
rearFender.scale.set(1, 0.96, 1.42);
exteriorHullGroup.add(rearFender);
const wellGeo = new THREE.CylinderGeometry(0.43, 0.43, 0.36, 20);
wellGeo.rotateZ(Math.PI / 2);
const fWell = new THREE.Mesh(wellGeo, recessedBlackMat);
fWell.position.set(sideX, 0.40, -1.38);
carBodyGroup.add(fWell);
const rWell = new THREE.Mesh(wellGeo, recessedBlackMat);
rWell.position.set(sideX * 1.03, 0.40, 1.38);
exteriorHullGroup.add(rWell);
const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 2.15), carbonMat);
skirt.position.set(sideX * 1.06, 0.22, 0.0);
exteriorHullGroup.add(skirt);
const buttress = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 1.55), anoWhiteMat);
buttress.position.set(sideX * 0.72, 1.01, 0.82);
buttress.rotation.x = -0.15;
buttress.rotation.y = sideX < 0 ? 0.09 : -0.09;
exteriorHullGroup.add(buttress);
});
const canopyShape = new THREE.Shape();
canopyShape.moveTo(-1.18, 0.74);
canopyShape.quadraticCurveTo(-0.35, 1.15, 0.25, 1.13);
canopyShape.lineTo(1.65, 0.89);
canopyShape.lineTo(1.65, 0.80);
canopyShape.lineTo(-1.18, 0.70);
canopyShape.closePath();
const canopyExtrude = new THREE.ExtrudeGeometry(canopyShape, {
depth: 1.16,
bevelEnabled: true,
bevelSegments: 3,
steps: 1,
bevelSize: 0.12,
bevelThickness: 0.12
});
canopyExtrude.rotateY(Math.PI / 2);
canopyExtrude.translate(-1.16 / 2, 0, 0);
const canopyMesh = new THREE.Mesh(canopyExtrude, canopyGlassMat);
exteriorHullGroup.add(canopyMesh);
const rearGlassRedRing = new THREE.Mesh(
new THREE.TorusGeometry(0.11, 0.022, 12, 24),
redLedMat
);
rearGlassRedRing.scale.set(0.65, 1.35, 1);
rearGlassRedRing.rotation.x = -Math.PI * 0.35;
rearGlassRedRing.position.set(-0.16, 0.99, 1.05);
exteriorHullGroup.add(rearGlassRedRing);
const frontSplitter = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.06, 0.45), carbonMat);
frontSplitter.position.set(0, 0.15, -2.18);
carBodyGroup.add(frontSplitter);
const frontLightBar = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.045, 0.06), frontLedMat);
frontLightBar.position.set(0, 0.44, -2.38);
carBodyGroup.add(frontLightBar);
[-0.68, 0.68].forEach((hx) => {
const headlamp = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.07, 0.08), frontLedMat);
headlamp.position.set(hx, 0.58, -2.28);
headlamp.rotation.y = hx < 0 ? 0.15 : -0.15;
carBodyGroup.add(headlamp);
});
const carHeadlight = new THREE.SpotLight(0xf8fafc, 2.4, 70, Math.PI / 4, 0.5, 1.2);
carHeadlight.position.set(0, 0.65, -2.3);
carHeadlight.target.position.set(0, 0.2, -20);
carRoot.add(carHeadlight);
carRoot.add(carHeadlight.target);
const rearBlackFascia = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.12, 0.08), recessedBlackMat);
rearBlackFascia.position.set(0, 0.84, 2.38);
exteriorHullGroup.add(rearBlackFascia);
const tailLightBar = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.032, 0.09), redLedMat);
tailLightBar.position.set(0, 0.845, 2.385);
exteriorHullGroup.add(tailLightBar);
const rearDiffuserBay = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.48, 0.35), carbonMat);
rearDiffuserBay.position.set(0, 0.38, 2.26);
exteriorHullGroup.add(rearDiffuserBay);
[-0.58, -0.20, 0.20, 0.58].forEach((fx) => {
const fin = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.22, 0.25), recessedBlackMat);
fin.position.set(fx, 0.26, 2.34);
exteriorHullGroup.add(fin);
});
function createPlateTexture() {
const c = document.createElement('canvas');
c.width = 256;
c.height = 128;
const ctx = c.getContext('2d');
ctx.fillStyle = '#f1f5f9';
ctx.fillRect(0, 0, 256, 128);
ctx.strokeStyle = '#64748b';
ctx.lineWidth = 6;
ctx.strokeRect(3, 3, 250, 122);
ctx.fillStyle = '#0f172a';
ctx.font = 'bold 56px monospace';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillText('RDSTR', 128, 68);
return new THREE.CanvasTexture(c);
}
const plateMesh = new THREE.Mesh(
new THREE.PlaneGeometry(0.38, 0.19),
new THREE.MeshBasicMaterial({ map: createPlateTexture() })
);
plateMesh.position.set(0, 0.65, 2.442);
exteriorHullGroup.add(plateMesh);
const nozzleOuterGeo = new THREE.CylinderGeometry(0.068, 0.072, 0.16, 20, 1, true);
const nozzleInnerGeo = new THREE.CylinderGeometry(0.058, 0.058, 0.14, 16);
[-0.36, -0.12, 0.12, 0.36].forEach((nx) => {
const nozRing = new THREE.Mesh(nozzleOuterGeo, titaniumMat);
nozRing.rotation.x = Math.PI / 2;
nozRing.position.set(nx, 0.46, 2.40);
exteriorHullGroup.add(nozRing);
const nozCore = new THREE.Mesh(nozzleInnerGeo, recessedBlackMat);
nozCore.rotation.x = Math.PI / 2;
nozCore.position.set(nx, 0.46, 2.38);
exteriorHullGroup.add(nozCore);
});
const activeWingGroup = new THREE.Group();
activeWingGroup.position.set(0, 0.93, 2.12);
exteriorHullGroup.add(activeWingGroup);
const wingBlade = new THREE.Mesh(new THREE.BoxGeometry(1.74, 0.035, 0.28), carbonMat);
activeWingGroup.add(wingBlade);
const suctionGlowRing = new THREE.Mesh(
new THREE.RingGeometry(0.45, 1.32, 32),
new THREE.MeshBasicMaterial({ color: 0xa855f7, side: THREE.DoubleSide, transparent: true, opacity: 0.42, depthWrite: false })
);
suctionGlowRing.rotation.x = Math.PI / 2;
suctionGlowRing.position.set(0, 0.03, 0);
carRoot.add(suctionGlowRing);
const wheels = [];
const tireGeo = new THREE.CylinderGeometry(0.37, 0.37, 0.32, 28);
const tireMat = new THREE.MeshStandardMaterial({ color: 0x0b0e14, roughness: 0.65, metalness: 0.2 });
const aeroDiscGeo = new THREE.CylinderGeometry(0.27, 0.27, 0.33, 24);
const aeroDiscMat = new THREE.MeshStandardMaterial({ color: 0x1e2530, roughness: 0.28, metalness: 0.8 });
const redRimRingGeo = new THREE.TorusGeometry(0.26, 0.012, 8, 24);
[
[-0.92, 0.37, -1.38],
[0.92, 0.37, -1.38],
[-0.95, 0.37, 1.38],
[0.95, 0.37, 1.38]
].forEach(([wx, wy, wz]) => {
const wGroup = new THREE.Group();
wGroup.position.set(wx, wy, wz);
const tire = new THREE.Mesh(tireGeo, tireMat);
tire.rotation.z = Math.PI / 2;
const disc = new THREE.Mesh(aeroDiscGeo, aeroDiscMat);
disc.rotation.z = Math.PI / 2;
const redRing = new THREE.Mesh(redRimRingGeo, redLedMat);
redRing.rotation.y = Math.PI / 2;
redRing.position.x = wx < 0 ? -0.168 : 0.168;
wGroup.add(tire);
wGroup.add(disc);
wGroup.add(redRing);
carBodyGroup.add(wGroup);
wheels.push(wGroup);
});
const cockpitGroup = new THREE.Group();
carRoot.add(cockpitGroup);
const cabinLight = new THREE.PointLight(0xe2e8f0, 0.9, 3.0);
cabinLight.position.set(-0.2, 1.22, -0.15);
cockpitGroup.add(cabinLight);
const dashMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.65, metalness: 0.2 });
const whiteLeatherMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.3, metalness: 0.1 });
const dashCowling = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.22, 0.55), dashMat);
dashCowling.position.set(0, 0.72, -0.82);
cockpitGroup.add(dashCowling);
const dashTrimStrip = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.025, 0.08), whiteLeatherMat);
dashTrimStrip.position.set(0, 0.835, -0.58);
cockpitGroup.add(dashTrimStrip);
[-0.74, 0.74].forEach((px) => {
const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.58, 0.07), dashMat);
pillar.position.set(px, 1.04, -0.68);
pillar.rotation.x = -0.55;
pillar.rotation.z = px < 0 ? -0.16 : 0.16;
cockpitGroup.add(pillar);
});
const digitalMirror = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.06, 0.04), dashMat);
digitalMirror.position.set(0, 1.24, -0.52);
cockpitGroup.add(digitalMirror);
function createDashDisplayTex(title, val, colorHex) {
const c = document.createElement('canvas');
c.width = 256;
c.height = 128;
const ctx = c.getContext('2d');
ctx.fillStyle = '#050b16';
ctx.fillRect(0, 0, 256, 128);
ctx.strokeStyle = colorHex;
ctx.lineWidth = 6;
ctx.strokeRect(4, 4, 248, 120);
ctx.fillStyle = '#94a3b8';
ctx.font = 'bold 22px monospace';
ctx.fillText(title, 18, 44);
ctx.fillStyle = colorHex;
ctx.font = 'bold 34px monospace';
ctx.fillText(val, 18, 94);
return new THREE.CanvasTexture(c);
}
const driverBinnacle = new THREE.Mesh(
new THREE.PlaneGeometry(0.22, 0.10),
new THREE.MeshBasicMaterial({ map: createDashDisplayTex('STEER-BY-WIRE', 'ROCKET ARMED', '#38bdf8') })
);
driverBinnacle.position.set(-0.36, 0.89, -0.64);
driverBinnacle.rotation.x = -0.2;
cockpitGroup.add(driverBinnacle);
const centerTouchscreen = new THREE.Mesh(
new THREE.PlaneGeometry(0.26, 0.22),
new THREE.MeshBasicMaterial({ map: createDashDisplayTex('COPV 1.5X CAP', 'SUCTION 4.7T', '#a855f7') })
);
centerTouchscreen.position.set(0.06, 0.83, -0.56);
centerTouchscreen.rotation.x = -0.32;
centerTouchscreen.rotation.y = -0.15;
cockpitGroup.add(centerTouchscreen);
const steeringCol = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.28, 16), dashMat);
steeringCol.rotation.x = Math.PI / 2 - 0.22;
steeringCol.position.set(-0.36, 0.85, -0.52);
cockpitGroup.add(steeringCol);
const yokeGroup = new THREE.Group();
yokeGroup.position.set(-0.36, 0.87, -0.38);
yokeGroup.rotation.x = -0.20;
cockpitGroup.add(yokeGroup);
const yokeHub = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.085, 0.04), dashMat);
yokeGroup.add(yokeHub);
const yokeSpokeBar = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.032, 0.03), titaniumMat);
yokeSpokeBar.position.set(0, -0.01, 0);
yokeGroup.add(yokeSpokeBar);
const yokeBottomRim = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.026, 0.032), dashMat);
yokeBottomRim.position.set(0, -0.075, 0);
yokeGroup.add(yokeBottomRim);
[-0.155, 0.155].forEach((gx) => {
const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.17, 16), whiteLeatherMat);
grip.position.set(gx, 0.005, 0.005);
yokeGroup.add(grip);
const thumbBtn = new THREE.Mesh(
new THREE.SphereGeometry(0.012, 12, 12),
new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
);
thumbBtn.position.set(gx * 0.82, 0.025, 0.02);
yokeGroup.add(thumbBtn);
});
const yokeShiftLight = new THREE.Mesh(
new THREE.BoxGeometry(0.11, 0.012, 0.042),
redLedMat
);
yokeShiftLight.position.set(0, 0.032, 0.004);
yokeGroup.add(yokeShiftLight);
const copvGroup = new THREE.Group();
[0.32, 0.54].forEach((tx) => {
const tank = new THREE.Mesh(
new THREE.CylinderGeometry(0.15, 0.15, 1.1, 20),
new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.25, metalness: 0.85 })
);
tank.rotation.x = Math.PI / 2;
tank.position.set(tx, 0.68, 0.18);
copvGroup.add(tank);
});
cockpitGroup.add(copvGroup);
const thrusterPlumesGroup = new THREE.Group();
carRoot.add(thrusterPlumesGroup);
function createJetGradientTexture() {
const c = document.createElement('canvas');
c.width = 64;
c.height = 256;
const ctx = c.getContext('2d');
const grad = ctx.createLinearGradient(0, 0, 0, 256);
grad.addColorStop(0.0, 'rgba(255, 255, 255, 0.98)');
grad.addColorStop(0.18, 'rgba(224, 242, 254, 0.88)');
grad.addColorStop(0.45, 'rgba(186, 230, 253, 0.55)');
grad.addColorStop(0.75, 'rgba(226, 232, 240, 0.22)');
grad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
ctx.fillStyle = grad;
ctx.fillRect(0, 0, 64, 256);
return new THREE.CanvasTexture(c);
}
const jetGradientTex = createJetGradientTexture();
function createRealisticGasPlume(radius, length) {
const group = new THREE.Group();
const outerMat = new THREE.MeshBasicMaterial({
map: jetGradientTex,
transparent: true,
opacity: 0.92,
depthWrite: false,
side: THREE.DoubleSide
});
const outerCone = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.22, radius * 1.35, length, 16, 1, true), outerMat);
outerCone.position.y = -length / 2;
group.add(outerCone);
const coreMat = new THREE.MeshBasicMaterial({
map: jetGradientTex,
color: 0xffffff,
transparent: true,
opacity: 0.98,
depthWrite: false
});
const innerCore = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.12, radius * 0.55, length * 0.65, 12, 1, true), coreMat);
innerCore.position.y = -(length * 0.65) / 2;
group.add(innerCore);
group.visible = false;
return group;
}
const hoverCones = [];
[
[-0.72, 0.18, -1.12],
[0.72, 0.18, -1.12],
[-0.72, 0.18, 1.12],
[0.72, 0.18, 1.12]
].forEach(([hx, hy, hz]) => {
const plume = createRealisticGasPlume(0.24, 3.0);
plume.position.set(hx, hy, hz);
thrusterPlumesGroup.add(plume);
hoverCones.push(plume);
});
const boostCones = [];
[-0.36, -0.12, 0.12, 0.36].forEach((bx) => {
const plume = createRealisticGasPlume(0.14, 2.6);
plume.rotation.x = -Math.PI / 2;
plume.position.set(bx, 0.46, 2.42);
thrusterPlumesGroup.add(plume);
boostCones.push(plume);
});
const rollPulse1FL = createRealisticGasPlume(0.16, 2.8);
rollPulse1FL.rotation.z = -Math.PI * 0.36;
rollPulse1FL.position.set(-0.98, 0.52, -1.42);
thrusterPlumesGroup.add(rollPulse1FL);
const rollPulse1RR = createRealisticGasPlume(0.16, 2.8);
rollPulse1RR.rotation.z = Math.PI * 0.64;
rollPulse1RR.position.set(0.98, 0.52, 1.42);
thrusterPlumesGroup.add(rollPulse1RR);
const rollPulse2FR = createRealisticGasPlume(0.15, 2.4);
rollPulse2FR.rotation.z = Math.PI * 0.36;
rollPulse2FR.position.set(0.98, 0.52, -1.42);
thrusterPlumesGroup.add(rollPulse2FR);
const rollPulse2RL = createRealisticGasPlume(0.15, 2.4);
rollPulse2RL.rotation.z = -Math.PI * 0.64;
rollPulse2RL.position.set(-0.98, 0.52, 1.42);
thrusterPlumesGroup.add(rollPulse2RL);
const rcsLeftCone = createRealisticGasPlume(0.15, 2.3);
rcsLeftCone.rotation.z = -Math.PI / 2;
rcsLeftCone.position.set(-1.02, 0.50, -1.35);
thrusterPlumesGroup.add(rcsLeftCone);
const rcsRightCone = createRealisticGasPlume(0.15, 2.3);
rcsRightCone.rotation.z = Math.PI / 2;
rcsRightCone.position.set(1.02, 0.50, -1.35);
thrusterPlumesGroup.add(rcsRightCone);
const smokeParticles = [];
const smokeGeo = new THREE.SphereGeometry(1.0, 10, 10);
for (let i = 0; i < 80; i++) {
const smMat = new THREE.MeshBasicMaterial({
color: 0xe2e8f0,
transparent: true,
opacity: 0,
depthWrite: false
});
const mesh = new THREE.Mesh(smokeGeo, smMat);
mesh.visible = false;
scene.add(mesh);
smokeParticles.push({ mesh, life: 0, maxLife: 1, vx: 0, vy: 0, vz: 0, scale: 1 });
}
let smokeIdx = 0;
function spawnSmokePuff(x, y, z, spread = 2.8) {
const p = smokeParticles[smokeIdx];
smokeIdx = (smokeIdx + 1) % smokeParticles.length;
p.life = 0.01;
p.maxLife = 0.9 + Math.random() * 0.7;
p.scale = 0.85 + Math.random() * 1.25;
const angle = Math.random() * Math.PI * 2;
const ringRadius = 2.2 + Math.random() * spread;
p.mesh.position.set(
x + Math.cos(angle) * ringRadius,
Math.max(0.25, Math.min(0.65, y)),
z + Math.sin(angle) * ringRadius
);
const outSpd = 4.5 + Math.random() * 7.5;
p.vx = Math.cos(angle) * outSpd;
p.vy = 0.4 + Math.random() * 1.4;
p.vz = Math.sin(angle) * outSpd;
p.mesh.scale.setScalar(p.scale);
p.mesh.material.opacity = 0.55;
p.mesh.visible = true;
}
function updateSmoke(dt) {
const isCockpit = CAMERA_MODES[currentCamIndex].id === 'cockpit';
for (let i = 0; i < smokeParticles.length; i++) {
const p = smokeParticles[i];
if (p.life > 0) {
p.life += dt;
if (p.life >= p.maxLife) {
p.life = 0;
p.mesh.visible = false;
} else {
const t = p.life / p.maxLife;
p.mesh.position.x += p.vx * dt;
p.mesh.position.y += p.vy * dt;
p.mesh.position.z += p.vz * dt;
p.vx *= 0.95;
p.vz *= 0.95;
const curScale = p.scale * (1 + t * 2.6);
p.mesh.scale.setScalar(curScale);
if (isCockpit) {
const distToCam = p.mesh.position.distanceTo(camera.position);
if (distToCam < curScale + 2.8) {
p.mesh.visible = false;
continue;
}
}
p.mesh.visible = true;
p.mesh.material.opacity = (1 - t) * 0.46;
}
}
}
}
