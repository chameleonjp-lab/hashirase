const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x030407);
scene.fog = new THREE.FogExp2(0x030407, 0.00055);
const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || (window.innerWidth <= 900 && 'ontouchstart' in window);
function triggerHaptic(ms = 12) {
try {
if (navigator.vibrate) navigator.vibrate(ms);
} catch (e) {}
}
function getViewportW() {
return Math.max(300, window.innerWidth || document.documentElement.clientWidth || 375);
}
function getViewportH() {
return Math.max(300, window.innerHeight || document.documentElement.clientHeight || 667);
}
function getAdaptiveFov() {
const aspect = getViewportW() / Math.max(1, getViewportH());
return aspect < 0.75 ? 74 : (aspect < 1.0 ? 68 : 62);
}
const camera = new THREE.PerspectiveCamera(getAdaptiveFov(), getViewportW() / getViewportH(), 0.1, 6500);
let renderer;
try {
renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
} catch (e1) {
try {
renderer = new THREE.WebGLRenderer({ antialias: false });
} catch (e2) {
const softThree = window.__installSoftwareThreeShim();
renderer = new softThree.WebGLRenderer();
}
}
renderer.setSize(getViewportW(), getViewportH());
let currentPixelRatio = Math.min(window.devicePixelRatio || 1, 2.0);
renderer.setPixelRatio(currentPixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.innerHTML = "";
container.appendChild(renderer.domElement);
const ambientLight = new THREE.AmbientLight(0x1e293b, 1.15);
scene.add(ambientLight);
const nycDaySunLight = new THREE.SpotLight(0xfffbeb, 0.0);
nycDaySunLight.position.set(450, 1200, 350);
nycDaySunLight.angle = Math.PI / 1.5;
nycDaySunLight.penumbra = 0.3;
nycDaySunLight.decay = 0.0;
nycDaySunLight.distance = 9000;
scene.add(nycDaySunLight);
const mainSpot = new THREE.SpotLight(0xf8fafc, 2.6);
mainSpot.position.set(0, 80, 10);
mainSpot.angle = Math.PI / 2.2;
mainSpot.penumbra = 0.65;
mainSpot.decay = 1.0;
mainSpot.distance = 360;
mainSpot.castShadow = true;
scene.add(mainSpot);

function applyCourseWeatherAndLighting(course) {
  if (course === 'NYC') {
    window.__isNycDaytime = true;
    scene.background = new THREE.Color(0x60a5fa); // Clear sunny daytime blue sky
    scene.fog = new THREE.FogExp2(0xbae6fd, 0.00024); // Light daytime horizon haze
    ambientLight.color = new THREE.Color(0xf8fafc);
    ambientLight.intensity = 2.65;
    nycDaySunLight.intensity = 2.2;
    if (groundMesh && groundMesh.material) {
      groundMesh.material.color = new THREE.Color(0x475569); // Sunlit daytime asphalt
      groundMesh.material.roughness = 0.68;
    }
  } else {
    window.__isNycDaytime = false;
    scene.background = new THREE.Color(0x030407);
    scene.fog = new THREE.FogExp2(0x030407, 0.00055);
    ambientLight.color = new THREE.Color(0x1e293b);
    ambientLight.intensity = 1.15;
    nycDaySunLight.intensity = 0.0;
    if (groundMesh && groundMesh.material) {
      groundMesh.material.color = new THREE.Color(0xffffff);
      groundMesh.material.roughness = 0.78;
    }
  }
}
const rampSpot = new THREE.SpotLight(0xf1f5f9, 2.8);
rampSpot.position.set(0, 32, -8);
rampSpot.target.position.set(0, 14, -48);
rampSpot.angle = Math.PI / 2.5;
rampSpot.penumbra = 0.5;
scene.add(rampSpot);
scene.add(rampSpot.target);
function createAsphaltTexture() {
const c = document.createElement('canvas');
c.width = 512;
c.height = 512;
const ctx = c.getContext('2d');
ctx.fillStyle = '#0d1015';
ctx.fillRect(0, 0, 512, 512);
for (let i = 0; i < 2800; i++) {
const v = 13 + Math.floor(Math.random() * 16);
ctx.fillStyle = `rgb(${v},${v + 2},${v + 5})`;
ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
}
const tex = new THREE.CanvasTexture(c);
tex.wrapS = THREE.RepeatWrapping;
tex.wrapT = THREE.RepeatWrapping;
tex.repeat.set(280, 280);
return tex;
}
const groundMesh = new THREE.Mesh(
new THREE.PlaneGeometry(9200, 9200),
new THREE.MeshStandardMaterial({ map: createAsphaltTexture(), roughness: 0.78, metalness: 0.15 })
);
groundMesh.rotation.x = -Math.PI / 2;
groundMesh.receiveShadow = true;
scene.add(groundMesh);
const provingGroundGroup = new THREE.Group();
scene.add(provingGroundGroup);
const nycCityGroup = new THREE.Group();
nycCityGroup.visible = false;
scene.add(nycCityGroup);
const rampProfile = createRampProfile(RAMP);
const rampLUT = rampProfile.samples;
function getRampPoint(s, lateralX = 0) { const p = rampProfile.point(s,lateralX); return { ...p, pos:new THREE.Vector3(p.pos.x,p.pos.y,p.pos.z), tangent:new THREE.Vector3(p.tangent.x,p.tangent.y,p.tangent.z), normal:new THREE.Vector3(p.normal.x,p.normal.y,p.normal.z) }; }
function buildProvingGroundAndRamp() {
const lineMat = new THREE.MeshBasicMaterial({ color: 0xdbeafe });
const centerRunwayLine = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 120), lineMat);
centerRunwayLine.rotation.x = -Math.PI / 2;
centerRunwayLine.position.set(0, 0.02, 16);
provingGroundGroup.add(centerRunwayLine);
const xLine1 = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 150), lineMat);
xLine1.rotation.x = -Math.PI / 2;
xLine1.rotation.z = 0.42;
xLine1.position.set(0, 0.02, -5);
provingGroundGroup.add(xLine1);
const xLine2 = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 150), lineMat);
xLine2.rotation.x = -Math.PI / 2;
xLine2.rotation.z = -0.42;
xLine2.position.set(0, 0.02, -5);
provingGroundGroup.add(xLine2);
const redNeonMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
const leftRedStrip = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.22, 110), redNeonMat);
leftRedStrip.position.set(-42, 0.12, -18);
provingGroundGroup.add(leftRedStrip);
const rampGroup = new THREE.Group();
const segments = 76;
const maxArc = RAMP.totalArc;
const ds = maxArc / segments;
const concreteMat = new THREE.MeshStandardMaterial({
color: 0xcbd5e1,
roughness: 0.48,
metalness: 0.15,
side: THREE.DoubleSide
});
const sideWallMat = new THREE.MeshStandardMaterial({
color: 0x64748b,
roughness: 0.5,
metalness: 0.45
});
const darkSteelMat = new THREE.MeshStandardMaterial({
color: 0x475569,
roughness: 0.45,
metalness: 0.65
});
const trussWireMat = new THREE.MeshBasicMaterial({
color: 0x94a3b8,
wireframe: true,
transparent: true,
opacity: 0.55
});
const redEdgeMat = new THREE.MeshBasicMaterial({ color: 0xff1e27 });
const whiteCenterMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
const apron = new THREE.Mesh(new THREE.BoxGeometry(RAMP.width, 0.06, 6), concreteMat);
apron.position.set(0, 0.02, RAMP.entryZ + 3);
rampGroup.add(apron);
let minBackZ = RAMP.entryZ;
let maxTopY = 0;
for (let i = 0; i < segments; i++) {
const sMid = (i + 0.5) * ds;
const pt = getRampPoint(sMid, 0);
if (pt.pos.z < minBackZ) minBackZ = pt.pos.z;
if (pt.pos.y > maxTopY) maxTopY = pt.pos.y;
const segGeo = new THREE.BoxGeometry(RAMP.width, 0.34, ds + 0.08);
const segMesh = new THREE.Mesh(segGeo, concreteMat);
segMesh.position.copy(pt.pos).addScaledVector(pt.normal, -0.17);
segMesh.rotation.x = pt.theta;
segMesh.receiveShadow = true;
rampGroup.add(segMesh);
const stripeGeo = new THREE.BoxGeometry(0.18, 0.03, ds + 0.04);
const stripeMesh = new THREE.Mesh(stripeGeo, whiteCenterMat);
stripeMesh.position.copy(pt.pos).addScaledVector(pt.normal, 0.02);
stripeMesh.rotation.x = pt.theta;
rampGroup.add(stripeMesh);
[-RAMP.width / 2 + 0.12, RAMP.width / 2 - 0.12].forEach((edgeX) => {
const ledGeo = new THREE.BoxGeometry(0.20, 0.22, ds + 0.05);
const ledMesh = new THREE.Mesh(ledGeo, redEdgeMat);
const edgePt = getRampPoint(sMid, edgeX);
ledMesh.position.copy(edgePt.pos).addScaledVector(edgePt.normal, 0.05);
ledMesh.rotation.x = edgePt.theta;
rampGroup.add(ledMesh);
const flangeGeo = new THREE.BoxGeometry(0.24, 0.85, ds + 0.06);
const flangeMesh = new THREE.Mesh(flangeGeo, sideWallMat);
flangeMesh.position.copy(edgePt.pos).addScaledVector(edgePt.normal, -0.45);
flangeMesh.rotation.x = edgePt.theta;
rampGroup.add(flangeMesh);
});
if (i % 3 === 0) {
const backPos = pt.pos.clone().addScaledVector(pt.normal, -1.15);
const trussBox = new THREE.Mesh(new THREE.BoxGeometry(RAMP.width * 0.96, 1.9, 1.4), trussWireMat);
trussBox.position.copy(backPos);
trussBox.rotation.x = pt.theta;
rampGroup.add(trussBox);
}
}
const backSpineZ = minBackZ - 1.3;
const towerTopY = maxTopY + 1.2;
[-RAMP.width / 2 + 0.45, RAMP.width / 2 - 0.45].forEach((px) => {
const colRear = new THREE.Mesh(new THREE.BoxGeometry(0.55, towerTopY, 0.55), darkSteelMat);
colRear.position.set(px, towerTopY / 2, backSpineZ);
rampGroup.add(colRear);
const colInner = new THREE.Mesh(new THREE.BoxGeometry(0.42, towerTopY * 0.94, 0.42), darkSteelMat);
colInner.position.set(px, (towerTopY * 0.94) / 2, backSpineZ + 2.2);
rampGroup.add(colInner);
for (let by = 2.5; by < towerTopY - 1.0; by += 3.2) {
const hStrut = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 2.4), darkSteelMat);
hStrut.position.set(px, by, backSpineZ + 1.1);
rampGroup.add(hStrut);
const dStrut = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 3.8), darkSteelMat);
dStrut.position.set(px, by + 1.5, backSpineZ + 1.1);
dStrut.rotation.x = 0.72;
rampGroup.add(dStrut);
}
});
const lipPt = getRampPoint(maxArc, 0);
const cantileverLen = Math.abs(lipPt.pos.z - backSpineZ) + 1.2;
const cantilever = new THREE.Mesh(new THREE.BoxGeometry(RAMP.width * 0.98, 1.45, cantileverLen), trussWireMat);
cantilever.position.set(0, towerTopY - 0.55, (backSpineZ + lipPt.pos.z) / 2);
cantilever.rotation.x = -0.14;
rampGroup.add(cantilever);
provingGroundGroup.add(rampGroup);
const kfGroup = new THREE.Group();
const lx = KICKFLIP_LANE.x;
const sz = KICKFLIP_LANE.stageZ;
const kfCenterline = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 95), whiteCenterMat);
kfCenterline.rotation.x = -Math.PI / 2;
kfCenterline.position.set(lx, 0.02, 5);
kfGroup.add(kfCenterline);
const stagePlatform = new THREE.Mesh(
new THREE.BoxGeometry(11.5, 0.16, 18.0),
new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.5, metalness: 0.5 })
);
stagePlatform.position.set(lx, 0.08, sz);
kfGroup.add(stagePlatform);
const stageRedBorderF = new THREE.Mesh(new THREE.BoxGeometry(11.6, 0.14, 0.18), redEdgeMat);
stageRedBorderF.position.set(lx, 0.12, sz + 9.0);
kfGroup.add(stageRedBorderF);
const stageRedBorderB = new THREE.Mesh(new THREE.BoxGeometry(11.6, 0.14, 0.18), redEdgeMat);
stageRedBorderB.position.set(lx, 0.12, sz - 9.0);
kfGroup.add(stageRedBorderB);
const semiGroup = new THREE.Group();
semiGroup.position.set(lx, 0.16, sz);
const semiChassis = new THREE.Mesh(
new THREE.BoxGeometry(7.6, 0.65, 2.5),
new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6, metalness: 0.5 })
);
semiChassis.position.set(0, 0.55, 0);
semiGroup.add(semiChassis);
const semiCabMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.2, metalness: 0.35 });
const semiCabMain = new THREE.Mesh(new THREE.BoxGeometry(3.6, 3.2, 2.48), semiCabMat);
semiCabMain.position.set(-1.2, 2.1, 0);
semiGroup.add(semiCabMain);
const semiNose = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.4, 2.42), semiCabMat);
semiNose.position.set(-3.1, 1.45, 0);
semiNose.rotation.z = 0.38;
semiGroup.add(semiNose);
const semiWindshield = new THREE.Mesh(
new THREE.BoxGeometry(1.4, 1.25, 2.44),
new THREE.MeshBasicMaterial({ color: 0x090d16 })
);
semiWindshield.position.set(-2.95, 2.35, 0);
semiWindshield.rotation.z = 0.38;
semiGroup.add(semiWindshield);
const semiLed = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 2.3), new THREE.MeshBasicMaterial({ color: 0xffffff }));
semiLed.position.set(-3.75, 0.85, 0);
semiGroup.add(semiLed);
const semiWheelGeo = new THREE.CylinderGeometry(0.54, 0.54, 0.35, 20);
const semiWheelMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5, metalness: 0.6 });
[-2.8, 1.2, 2.5].forEach((wx) => {
[-1.25, 1.25].forEach((wz) => {
const sw = new THREE.Mesh(semiWheelGeo, semiWheelMat);
sw.rotation.x = Math.PI / 2;
sw.position.set(wx, 0.54, wz);
semiGroup.add(sw);
});
});
kfGroup.add(semiGroup);
const lineupSpecs = [
{ zOff: 3.4, len: 4.3, h: 1.22, w: 1.95, color: 0xd4af37, isCybertruck: false },
{ zOff: 6.4, len: 5.6, h: 1.75, w: 2.10, color: 0x94a3b8, isCybertruck: true },
{ zOff: -3.4, len: 4.9, h: 1.38, w: 1.98, color: 0x1e293b, isCybertruck: false },
{ zOff: -6.4, len: 5.0, h: 1.62, w: 2.02, color: 0x0f172a, isCybertruck: false }
];
lineupSpecs.forEach((sp) => {
const vGroup = new THREE.Group();
vGroup.position.set(lx - 1.2, 0.16, sz + sp.zOff);
const vMat = new THREE.MeshStandardMaterial({ color: sp.color, roughness: 0.22, metalness: 0.78 });
const lower = new THREE.Mesh(new THREE.BoxGeometry(sp.len, sp.h * 0.55, sp.w), vMat);
lower.position.y = sp.h * 0.35;
vGroup.add(lower);
const cabin = new THREE.Mesh(
new THREE.BoxGeometry(sp.len * 0.58, sp.h * 0.45, sp.w * 0.86),
sp.isCybertruck ? vMat : new THREE.MeshBasicMaterial({ color: 0x090d16 })
);
cabin.position.set(0.2, sp.h * 0.78, 0);
if (sp.isCybertruck) cabin.rotation.z = 0.15;
vGroup.add(cabin);
const fLed = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, sp.w * 0.88), new THREE.MeshBasicMaterial({ color: 0xf8fafc }));
fLed.position.set(-sp.len / 2 - 0.02, sp.h * 0.48, 0);
vGroup.add(fLed);
kfGroup.add(vGroup);
});
provingGroundGroup.add(kfGroup);
}
await advanceLoadingStage(44, "McGregorテスト場・155°反り立つ壁・Kickflipステージを構築中...", "STAGE 3/6 // PROVING GROUND");
buildProvingGroundAndRamp();
