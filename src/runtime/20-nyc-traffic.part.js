const NYC_RADIUS = 4200; // Expanded to 4.2km radius (-4200m to +4200m) to support 3.8km straight-line Time Attack destinations!
const NYC_AVES = [-3800, -3000, -2200, -1500, -900, -600, -300, 0, 300, 600, 900, 1500, 2200, 3000, 3800];
const NYC_STS = [-3800, -3400, -3000, -2600, -2200, -1800, -1400, -1000, -600, -400, -200, 0, 200, 400, 600, 1000, 1400, 1800, 2200, 2600, 3000, 3400, 3800];
const nycBuildingColliders = []; // Solid AABB physical colliders for all city blocks & skyscrapers (Requirement ②)
const nycTrafficVehicles = [];   // 90 rigid-body vehicles with mass, collision, damage & rollover physics (Requirement ①)
const nycTrafficSignals = [];    // Interactive Traffic Signal meshes at intersections (Requirement ④)
const crashDebrisList = [];      // Flying sparks & crumpled debris on collision
// Shared by city geometry, traffic, utility poles and urban props in this app.
const ACTIVE_RENDER_RADIUS = 700.0;
const ACTIVE_RENDER_RADIUS_SQ = ACTIVE_RENDER_RADIUS * ACTIVE_RENDER_RADIUS;
let signalCycleTimer = 0;
const sigMatRedOn = new THREE.MeshBasicMaterial({ color: 0xff1e27 });
const sigMatYellowOn = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
const sigMatGreenOn = new THREE.MeshBasicMaterial({ color: 0x10b981 });
const sigMatOff = new THREE.MeshBasicMaterial({ color: 0x1e293b });
function getSignalPhaseForIntersection(aveIdx, stIdx, timer) {
const t = (timer + (aveIdx + stIdx) * 1.5) % 16.0;
if (t < 6.5) return { ns: 'GREEN', ew: 'RED' };
if (t < 8.0) return { ns: 'YELLOW', ew: 'RED' };
if (t < 14.5) return { ns: 'RED', ew: 'GREEN' };
return { ns: 'RED', ew: 'YELLOW' };
}
function buildNewYorkCityCourse() {
const yellowLineMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
const whiteLineMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.72, metalness: 0.10 });
const parkGrassMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.85, metalness: 0.05 });
const aveCenterGeo = new THREE.PlaneGeometry(0.22, 8400);
const aveLaneGeo = new THREE.PlaneGeometry(0.14, 8400);
const stCenterGeo = new THREE.PlaneGeometry(8400, 0.22);
const stopNGeo = new THREE.PlaneGeometry(13.5, 0.65);
const stopEGeo = new THREE.PlaneGeometry(0.65, 9.5);
NYC_AVES.forEach((aveX) => {
const centerLine1 = new THREE.Mesh(aveCenterGeo, yellowLineMat);
centerLine1.rotation.x = -Math.PI / 2;
centerLine1.position.set(aveX - 0.22, 0.03, 0);
nycCityGroup.add(centerLine1);
const centerLine2 = new THREE.Mesh(aveCenterGeo, yellowLineMat);
centerLine2.rotation.x = -Math.PI / 2;
centerLine2.position.set(aveX + 0.22, 0.03, 0);
nycCityGroup.add(centerLine2);
[-6.5, 6.5].forEach((lx) => {
const laneLine = new THREE.Mesh(aveLaneGeo, whiteLineMat);
laneLine.rotation.x = -Math.PI / 2;
laneLine.position.set(aveX + lx, 0.025, 0);
nycCityGroup.add(laneLine);
});
});
NYC_STS.forEach((stZ) => {
const stCenter = new THREE.Mesh(stCenterGeo, yellowLineMat);
stCenter.rotation.x = -Math.PI / 2;
stCenter.position.set(0, 0.03, stZ);
nycCityGroup.add(stCenter);
if (Math.abs(stZ) <= 1400) {
[-600, -300, 0, 300, 600].forEach((aveX) => {
const stopN = new THREE.Mesh(stopNGeo, whiteLineMat);
stopN.rotation.x = -Math.PI / 2;
stopN.position.set(aveX + 7.2, 0.035, stZ + 14.0);
nycCityGroup.add(stopN);
const stopS = new THREE.Mesh(stopNGeo, whiteLineMat);
stopS.rotation.x = -Math.PI / 2;
stopS.position.set(aveX - 7.2, 0.035, stZ - 14.0);
nycCityGroup.add(stopS);
const stopE = new THREE.Mesh(stopEGeo, whiteLineMat);
stopE.rotation.x = -Math.PI / 2;
stopE.position.set(aveX - 17.5, 0.035, stZ + 5.2);
nycCityGroup.add(stopE);
const stopW = new THREE.Mesh(stopEGeo, whiteLineMat);
stopW.rotation.x = -Math.PI / 2;
stopW.position.set(aveX + 17.5, 0.035, stZ - 5.2);
nycCityGroup.add(stopW);
});
}
});
function createSkyscraperTexture(neonHue, bgHex, winColor1, winColor2) {
const c = document.createElement('canvas');
c.width = 128;
c.height = 256;
const ctx = c.getContext('2d');
ctx.fillStyle = bgHex || '#0b111e';
ctx.fillRect(0, 0, 128, 256);
for (let row = 6; row < 248; row += 8) {
for (let col = 6; col < 122; col += 10) {
if (Math.random() > 0.24) {
ctx.fillStyle = Math.random() > 0.25 ? (winColor1 || '#fef08a') : (winColor2 || '#bae6fd');
ctx.fillRect(col, row, 6, 4);
}
}
}
if (neonHue) {
ctx.fillStyle = neonHue;
ctx.fillRect(8, 172, 112, 46);
ctx.fillStyle = '#ffffff';
ctx.font = 'bold 15px sans-serif';
ctx.fillText('TIMES SQ // NY', 12, 200);
}
const tex = new THREE.CanvasTexture(c);
tex.wrapS = THREE.RepeatWrapping;
tex.wrapT = THREE.RepeatWrapping;
return tex;
}
const bldgMaterials = [
new THREE.MeshStandardMaterial({ map: createSkyscraperTexture('#ef4444', '#475569', '#e0f2fe', '#bae6fd'), roughness: 0.28, metalness: 0.45 }),
new THREE.MeshStandardMaterial({ map: createSkyscraperTexture('#2563eb', '#334155', '#dbeafe', '#f8fafc'), roughness: 0.25, metalness: 0.55 }),
new THREE.MeshStandardMaterial({ map: createSkyscraperTexture('#0284c7', '#64748b', '#f1f5f9', '#bae6fd'), roughness: 0.30, metalness: 0.40 }),
new THREE.MeshStandardMaterial({ map: createSkyscraperTexture(null, '#94a3b8', '#e2e8f0', '#cbd5e1'), roughness: 0.35, metalness: 0.35 }),
new THREE.MeshStandardMaterial({ map: createSkyscraperTexture(null, '#78716c', '#f5f5f4', '#e7e5e4'), roughness: 0.40, metalness: 0.30 })
];
const bldgBuckets = [[], [], [], [], []];
const sidewalkInstances = [];
for (let ai = 0; ai < NYC_AVES.length - 1; ai++) {
const xLeft = NYC_AVES[ai] + 15.5;   // East edge of Avenue ai
const xRight = NYC_AVES[ai + 1] - 15.5; // West edge of Avenue ai+1
const blockW = xRight - xLeft;       // ~269m block width
const blockCenterX = (xLeft + xRight) / 2;
for (let si = 0; si < NYC_STS.length - 1; si++) {
const zNorth = NYC_STS[si] + 11.5;
const zSouth = NYC_STS[si + 1] - 11.5;
const blockD = zSouth - zNorth;    // ~97m block depth
const blockCenterZ = (zNorth + zSouth) / 2;
const isCentralPark = (blockCenterX > -290 && blockCenterX < 290 && blockCenterZ < -700 && blockCenterZ > -1560);
if (isCentralPark) {
const parkPad = new THREE.Mesh(new THREE.BoxGeometry(blockW, 0.3, blockD), parkGrassMat);
parkPad.position.set(blockCenterX, 0.15, blockCenterZ);
nycCityGroup.add(parkPad);
continue;
}
sidewalkInstances.push({
x: blockCenterX,
y: 0.14,
z: blockCenterZ,
w: blockW,
h: 0.28,
d: blockD
});
const subCols = 2;
const margin = 4.0; // 4m pedestrian sidewalk setback
const usableW = blockW - margin * 2;
const usableD = blockD - margin * 2;
const subW = usableW / subCols;
for (let c = 0; c < subCols; c++) {
const bx = xLeft + margin + subW * (c + 0.5);
const bz = blockCenterZ;
const bw = subW - 4.5;
const bd = usableD - 2.0;
const distFromCenter = Math.hypot(bx, bz);
const seed = Math.abs(Math.sin(bx * 0.017 + bz * 0.031) * 43758.5453);
const rand01 = seed - Math.floor(seed);
let bh = 36 + rand01 * 85;
if (distFromCenter < 650) {
bh = 65 + rand01 * 175; // Midtown / Times Square supertall canyon (65m - 240m)
} else if (bz > 1100 && Math.abs(bx) < 600) {
bh = 55 + rand01 * 160; // Lower Manhattan / Financial District towers
}
nycBuildingColliders.push({
minX: bx - bw / 2,
maxX: bx + bw / 2,
minZ: bz - bd / 2,
maxZ: bz + bd / 2,
height: bh
});
const bucketIdx = (ai * 7 + si * 3 + c) % bldgBuckets.length;
bldgBuckets[bucketIdx].push({ x: bx, y: bh / 2, z: bz, w: bw, h: bh, d: bd });
if (bh > 135) {
const topH = bh * 0.36;
bldgBuckets[(bucketIdx + 1) % bldgBuckets.length].push({
x: bx,
y: bh + topH / 2,
z: bz,
w: bw * 0.58,
h: topH,
d: bd * 0.58
});
}
}
}
}
const swGeo = new THREE.BoxGeometry(1, 1, 1);
const swInst = new THREE.InstancedMesh(swGeo, sidewalkMat, sidewalkInstances.length);
const dummy = new THREE.Object3D();
swInst.receiveShadow = true;
nycCityGroup.add(swInst);

const bldgInstMeshes = [];
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
bldgBuckets.forEach((list, bIdx) => {
  if (!list.length) return;
  const inst = new THREE.InstancedMesh(boxGeo, bldgMaterials[bIdx], list.length);
  inst.castShadow = false;
  inst.receiveShadow = true;
  nycCityGroup.add(inst);
  bldgInstMeshes.push({ inst, list });
});

// Expose 700m radius culling updater for buildings & sidewalks so only objects within 700m of player are rendered!
let lastCullCenterX = -99999;
let lastCullCenterZ = -99999;

window.__updateNyc700mGeometryCulling = function(forceUpdate = false) {
  const px = carState.x;
  const pz = carState.z;
  // Re-pack instanced meshes whenever player moves by 18m or on forceUpdate
  if (!forceUpdate && Math.hypot(px - lastCullCenterX, pz - lastCullCenterZ) < 18.0) return;
  lastCullCenterX = px;
  lastCullCenterZ = pz;

  // 1) Cull Sidewalk blocks outside 700m radius
  let swCount = 0;
  if (swInst._instances) swInst._instances.length = 0;
  for (let i = 0; i < sidewalkInstances.length; i++) {
    const s = sidewalkInstances[i];
    const dx = s.x - px;
    const dz = s.z - pz;
    if (dx * dx + dz * dz <= ACTIVE_RENDER_RADIUS_SQ) {
      dummy.position.set(s.x, s.y, s.z);
      dummy.scale.set(s.w, s.h, s.d);
      dummy.updateMatrix();
      swInst.setMatrixAt(swCount, dummy.matrix);
      swCount++;
    }
  }
  swInst.count = swCount;
  if (swInst.instanceMatrix) swInst.instanceMatrix.needsUpdate = true;

  // 2) Cull Skyscraper buildings outside 700m radius
  for (let b = 0; b < bldgInstMeshes.length; b++) {
    const { inst, list } = bldgInstMeshes[b];
    let bCount = 0;
    if (inst._instances) inst._instances.length = 0;
    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      const dx = item.x - px;
      const dz = item.z - pz;
      if (dx * dx + dz * dz <= ACTIVE_RENDER_RADIUS_SQ) {
        dummy.position.set(item.x, item.y, item.z);
        dummy.scale.set(item.w, item.h, item.d);
        dummy.updateMatrix();
        inst.setMatrixAt(bCount, dummy.matrix);
        bCount++;
      }
    }
    inst.count = bCount;
    if (inst.instanceMatrix) inst.instanceMatrix.needsUpdate = true;
  }
};
window.__updateNyc700mGeometryCulling(true);
const poleMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4, metalness: 0.7 });
const housingMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5, metalness: 0.5 });
const sharedPoleGeo = new THREE.CylinderGeometry(0.16, 0.20, 6.8, 8);
const sharedArmGeo = new THREE.BoxGeometry(6.5, 0.16, 0.16);
const sharedBoxGeo = new THREE.BoxGeometry(0.55, 1.45, 0.55);
const lensGeo = new THREE.SphereGeometry(0.19, 8, 8);
NYC_AVES.forEach((aveX, aveIdx) => {
if (Math.abs(aveX) > 900) return; // Populate signals across the core avenues (-900m..+900m)
NYC_STS.forEach((stZ, stIdx) => {
if (Math.abs(stZ) > 1400) return;
const intGroup = new THREE.Group();
intGroup.position.set(aveX, 0, stZ);
const pole1 = new THREE.Mesh(sharedPoleGeo, poleMat);
pole1.position.set(16.2, 3.4, 12.2);
intGroup.add(pole1);
const arm1 = new THREE.Mesh(sharedArmGeo, poleMat);
arm1.position.set(13.0, 6.4, 12.2);
intGroup.add(arm1);
const box1 = new THREE.Mesh(sharedBoxGeo, housingMat);
box1.position.set(10.5, 5.8, 12.2);
intGroup.add(box1);
const pole2 = new THREE.Mesh(sharedPoleGeo, poleMat);
pole2.position.set(-16.2, 3.4, -12.2);
intGroup.add(pole2);
const arm2 = new THREE.Mesh(sharedArmGeo, poleMat);
arm2.position.set(-13.0, 6.4, -12.2);
intGroup.add(arm2);
const box2 = new THREE.Mesh(sharedBoxGeo, housingMat);
box2.position.set(-10.5, 5.8, -12.2);
intGroup.add(box2);
const nsRed1 = new THREE.Mesh(lensGeo, sigMatRedOn); nsRed1.position.set(10.5, 6.22, 12.5); intGroup.add(nsRed1);
const nsYel1 = new THREE.Mesh(lensGeo, sigMatOff);   nsYel1.position.set(10.5, 5.80, 12.5); intGroup.add(nsYel1);
const nsGrn1 = new THREE.Mesh(lensGeo, sigMatOff);   nsGrn1.position.set(10.5, 5.38, 12.5); intGroup.add(nsGrn1);
const nsRed2 = new THREE.Mesh(lensGeo, sigMatRedOn); nsRed2.position.set(-10.5, 6.22, -12.5); intGroup.add(nsRed2);
const nsYel2 = new THREE.Mesh(lensGeo, sigMatOff);   nsYel2.position.set(-10.5, 5.80, -12.5); intGroup.add(nsYel2);
const nsGrn2 = new THREE.Mesh(lensGeo, sigMatOff);   nsGrn2.position.set(-10.5, 5.38, -12.5); intGroup.add(nsGrn2);
nycCityGroup.add(intGroup);
nycTrafficSignals.push({
intGroup,
aveIdx,
stIdx,
aveX,
stZ,
pole1, arm1, box1,
pole2, arm2, box2,
nsRed1, nsYel1, nsGrn1,
nsRed2, nsYel2, nsGrn2,
pole1Broken: false,
pole2Broken: false
});
});
});
const totalVehicles = 85;
const trafficWheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 12);
const trafficWheelMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6, metalness: 0.3 });
const windowGlassMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.15, metalness: 0.8 });

function tagVehiclePart(mesh, partRole, zoneX, zoneZ) {
  mesh.userData = {
    partRole,
    zoneX,
    zoneZ,
    dmg: { dx: 0, dy: 0, dz: 0, rx: 0, ry: 0, rz: 0, sx: 1, sy: 1, sz: 1 }
  };
  return mesh;
}

for (let i = 0; i < totalVehicles; i++) {
  // Civilian vehicles are strictly Sedans (セダン) and Trucks (トラック) with multi-segment anatomical parts for localized inertia crash deformation!
  const isRocketRoadster = false;
  const isBoxTruck = (i % 3 === 0); // 1/3 Trucks (トラック), 2/3 Sedans (セダン)
  const vehicleType = isBoxTruck ? 'TRUCK' : 'SEDAN';
  const onCrossStreet = (i % 4 === 3);
  const vGroup = new THREE.Group();
  const bodyPartsGroup = new THREE.Group();
  vGroup.add(bodyPartsGroup);
  let hoverJetGroup = null;
  let halfW = 1.0;
  let halfL = 2.25;
  let massKg = 1650;

  if (isBoxTruck) {
    // Segmented Commercial Box Truck (トラック) - 15 anatomical sub-parts
    halfW = 1.28;
    halfL = 3.85;
    massKg = 5200;
    const cabColors = [0xf8fafc, 0x38bdf8, 0xfacc15, 0xe2e8f0];
    const boxColors = [0xf1f5f9, 0xe2e8f0, 0xcbd5e1, 0x94a3b8];
    const cabMat = new THREE.MeshStandardMaterial({ color: cabColors[i % cabColors.length], roughness: 0.35, metalness: 0.3 });
    const boxMat = new THREE.MeshStandardMaterial({ color: boxColors[i % boxColors.length], roughness: 0.45, metalness: 0.25 });
    const chassisMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6, metalness: 0.5 });

    const frontBumper = tagVehiclePart(new THREE.Mesh(new THREE.BoxGeometry(2.42, 0.42, 0.32), chassisMat), 'frontBumper', 0, -3.55);
    frontBumper.position.set(0, 0.52, -3.55);
    bodyPartsGroup.add(frontBumper);

    const grille = tagVehiclePart(new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.68, 0.14), chassisMat), 'grille', 0, -3.48);
    grille.position.set(0, 1.08, -3.48);
    bodyPartsGroup.add(grille);

    const cabLeft = tagVehiclePart(new THREE.Mesh(new THREE.BoxGeometry(1.19, 2.15, 2.35), cabMat), 'cabLeft', -0.60, -2.35);
    cabLeft.position.set(-0.60, 1.55, -2.35);
    bodyPartsGroup.add(cabLeft);

    const cabRight = tagVehiclePart(new THREE.Mesh(new THREE.BoxGeometry(1.19, 2.15, 2.35), cabMat), 'cabRight', 0.60, -2.35);
    cabRight.position.set(0.60, 1.55, -2.35);
    bodyPartsGroup.add(cabRight);

    const cabWindshield = tagVehiclePart(new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.82, 0.12), windowGlassMat), 'windshield', 0, -3.50);
    cabWindshield.position.set(0, 1.85, -3.50);
    bodyPartsGroup.add(cabWindshield);

    const chassis = tagVehiclePart(new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.45, 7.3), chassisMat), 'chassis', 0, 0);
    chassis.position.set(0, 0.48, 0);
    bodyPartsGroup.add(chassis);

    // 4-Quadrant Segmented Cargo Box (Front-Left, Front-Right, Rear-Left, Rear-Right) so impacts cave in the exact quadrant hit!
    const cargoFL = tagVehiclePart(new THREE.Mesh(new THREE.BoxGeometry(1.26, 3.05, 2.58), boxMat), 'cargoFL', -0.63, 0.16);
    cargoFL.position.set(-0.63, 2.05, 0.16);
    bodyPartsGroup.add(cargoFL);

    const cargoFR = tagVehiclePart(new THREE.Mesh(new THREE.BoxGeometry(1.26, 3.05, 2.58), boxMat), 'cargoFR', 0.63, 0.16);
    cargoFR.position.set(0.63, 2.05, 0.16);
    bodyPartsGroup.add(cargoFR);

    const cargoRL = tagVehiclePart(new THREE.Mesh(new THREE.BoxGeometry(1.26, 3.05, 2.58), boxMat), 'cargoRL', -0.63, 2.72);
    cargoRL.position.set(-0.63, 2.05, 2.72);
    bodyPartsGroup.add(cargoRL);

    const cargoRR = tagVehiclePart(new THREE.Mesh(new THREE.BoxGeometry(1.26, 3.05, 2.58), boxMat), 'cargoRR', 0.63, 2.72);
    cargoRR.position.set(0.63, 2.05, 2.72);
    bodyPartsGroup.add(cargoRR);

    const rearBumper = tagVehiclePart(new THREE.Mesh(new THREE.BoxGeometry(2.46, 0.38, 0.26), chassisMat), 'rearBumper', 0, 3.82);
    rearBumper.position.set(0, 0.50, 3.82);
    bodyPartsGroup.add(rearBumper);

    const wheelRoles = [
      ['wheelFL', -1.12, -2.4],
      ['wheelFR',  1.12, -2.4],
      ['wheelRL', -1.12,  2.3],
      ['wheelRR',  1.12,  2.3]
    ];
    wheelRoles.forEach(([role, wx, wz]) => {
      const w = tagVehiclePart(new THREE.Mesh(trafficWheelGeo, trafficWheelMat), role, wx, wz);
      w.rotation.z = Math.PI / 2;
      w.position.set(wx, 0.38, wz);
      bodyPartsGroup.add(w);
    });
  } else {
    // Segmented 3-Box Sedan (セダン) - 15 anatomical sub-parts for authentic localized crash crumpling
    halfW = 0.98;
    halfL = 2.28;
    massKg = 1580;
    const sedanColors = [0xf8fafc, 0x2563eb, 0xdc2626, 0xfacc15, 0x475569, 0x0ea5e9, 0xe2e8f0, 0x10b981];
    const bodyColor = sedanColors[i % sedanColors.length];
    const carMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.25, metalness: 0.45 });
    const bumperMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5, metalness: 0.4 });

    // Front Bumper
    const frontBumper = tagVehiclePart(new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.36, 0.28), bumperMat), 'frontBumper', 0, -2.22);
    frontBumper.position.set(0, 0.42, -2.22);
    bodyPartsGroup.add(frontBumper);

    // Left & Right Front Hood / Fenders
    const hoodFL = tagVehiclePart(new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.56, 1.42), carMat), 'hoodFL', -0.48, -1.48);
    hoodFL.position.set(-0.48, 0.55, -1.48);
    bodyPartsGroup.add(hoodFL);

    const hoodFR = tagVehiclePart(new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.56, 1.42), carMat), 'hoodFR', 0.48, -1.48);
    hoodFR.position.set(0.48, 0.55, -1.48);
    bodyPartsGroup.add(hoodFR);

    // Left & Right Doors / Center Sill
    const doorLeft = tagVehiclePart(new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.58, 1.72), carMat), 'doorLeft', -0.48, 0.0);
    doorLeft.position.set(-0.48, 0.56, 0.0);
    bodyPartsGroup.add(doorLeft);

    const doorRight = tagVehiclePart(new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.58, 1.72), carMat), 'doorRight', 0.48, 0.0);
    doorRight.position.set(0.48, 0.56, 0.0);
    bodyPartsGroup.add(doorRight);

    // Left & Right Rear Trunk / Quarter Panels
    const trunkRL = tagVehiclePart(new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.56, 1.36), carMat), 'trunkRL', -0.48, 1.50);
    trunkRL.position.set(-0.48, 0.56, 1.50);
    bodyPartsGroup.add(trunkRL);

    const trunkRR = tagVehiclePart(new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.56, 1.36), carMat), 'trunkRR', 0.48, 1.50);
    trunkRR.position.set(0.48, 0.56, 1.50);
    bodyPartsGroup.add(trunkRR);

    // Rear Bumper
    const rearBumper = tagVehiclePart(new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.38, 0.26), bumperMat), 'rearBumper', 0, 2.22);
    rearBumper.position.set(0, 0.44, 2.22);
    bodyPartsGroup.add(rearBumper);

    // Cabin Roof & Greenhouse
    const cabinRoof = tagVehiclePart(new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.48, 2.15), carMat), 'cabinRoof', 0, -0.05);
    cabinRoof.position.set(0, 1.06, -0.05);
    bodyPartsGroup.add(cabinRoof);

    const windshieldBand = tagVehiclePart(new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.40, 2.25), windowGlassMat), 'windshield', 0, -0.05);
    windshieldBand.position.set(0, 1.04, -0.05);
    bodyPartsGroup.add(windshieldBand);

    const wheelRoles = [
      ['wheelFL', -0.92, -1.42],
      ['wheelFR',  0.92, -1.42],
      ['wheelRL', -0.92,  1.42],
      ['wheelRR',  0.92,  1.42]
    ];
    wheelRoles.forEach(([role, wx, wz]) => {
      const w = tagVehiclePart(new THREE.Mesh(trafficWheelGeo, trafficWheelMat), role, wx, wz);
      w.rotation.z = Math.PI / 2;
      w.position.set(wx, 0.36, wz);
      bodyPartsGroup.add(w);
    });
  }

  // Left & Right Headlights and Taillights
  const hlL = tagVehiclePart(new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.09, 0.09), new THREE.MeshBasicMaterial({ color: 0xffffff })), 'hlL', -0.55, -halfL);
  hlL.position.set(-0.55, 0.58, -halfL);
  bodyPartsGroup.add(hlL);

  const hlR = tagVehiclePart(new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.09, 0.09), new THREE.MeshBasicMaterial({ color: 0xffffff })), 'hlR', 0.55, -halfL);
  hlR.position.set(0.55, 0.58, -halfL);
  bodyPartsGroup.add(hlR);

  const tlL = tagVehiclePart(new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.09, 0.09), new THREE.MeshBasicMaterial({ color: 0xff1e27 })), 'tlL', -0.55, halfL);
  tlL.position.set(-0.55, 0.62, halfL);
  bodyPartsGroup.add(tlL);

  const tlR = tagVehiclePart(new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.09, 0.09), new THREE.MeshBasicMaterial({ color: 0xff1e27 })), 'tlR', 0.55, halfL);
  tlR.position.set(0.55, 0.62, halfL);
  bodyPartsGroup.add(tlR);

  // Capture once, after every part has its final configured transform.
  bodyPartsGroup.children.forEach((part) => {
    Object.assign(part.userData, {
      origX: part.position.x, origY: part.position.y, origZ: part.position.z,
      origRx: part.rotation.x, origRy: part.rotation.y, origRz: part.rotation.z,
      origSx: part.scale.x, origSy: part.scale.y, origSz: part.scale.z
    });
  });

  let xPos, zPos, vx = 0, vz = 0, yaw = 0, axis = 'NS', dir = 1, baseLaneCoord = 0;
  const coreAves = [0, 0, -300, 300, -600, 600];
  if (!onCrossStreet) {
    axis = 'NS';
    const aveX = coreAves[i % coreAves.length];
    const laneOffsets = [-9.2, -3.6, 3.6, 9.2];
    const laneOff = laneOffsets[i % 4];
    dir = laneOff < 0 ? 1 : -1;
    xPos = aveX + laneOff;
    baseLaneCoord = xPos;
    zPos = -1650 + ((i * 67) % 3300);
    if (Math.abs(xPos - 3.6) < 3 && Math.abs(zPos - 85) < 22) zPos -= 35;
    yaw = dir === 1 ? Math.PI : 0;
  } else {
    axis = 'EW';
    const stIdx = (i * 3) % NYC_STS.length;
    const stZ = NYC_STS[stIdx];
    const laneOff = (i % 2 === 0) ? 4.2 : -4.2;
    dir = laneOff > 0 ? 1 : -1;
    zPos = stZ + laneOff;
    baseLaneCoord = zPos;
    xPos = -1500 + ((i * 83) % 3000);
    yaw = dir === 1 ? -Math.PI / 2 : Math.PI / 2;
  }
  const cruiseSpeed = (isBoxTruck ? 13.5 : 16.5) + (i % 4);
  vGroup.position.set(xPos, 0, zPos);
  vGroup.rotation.order = 'YXZ';
  vGroup.rotation.y = yaw;
  nycCityGroup.add(vGroup);
  nycTrafficVehicles.push({
    id: i,
    vehicleType,
    mesh: vGroup,
    bodyPartsGroup,
    isRocket: isRocketRoadster,
    hoverJetGroup,
    axis,
    dir,
    baseLaneCoord,
    x: xPos,
    y: 0,
    z: zPos,
    vx: axis === 'EW' ? dir * cruiseSpeed : 0,
    vy: 0,
    vz: axis === 'NS' ? dir * cruiseSpeed : 0,
    yaw,
    pitch: 0,
    roll: 0,
    yawVel: 0,
    pitchVel: 0,
    rollVel: 0,
    cruiseSpeed,
    currentSpeed: cruiseSpeed,
    halfW,
    halfL,
    mass: massKg,
    damage: 0,
    lastPatternId: 0,
    lastPatternLabel: '',
    crashed: false,
    overturned: false,
    recoverTimer: 0,
    flightPhase: i * 1.9
  });
}
const sparkGeo = new THREE.BoxGeometry(0.22, 0.12, 0.28);
for (let i = 0; i < 60; i++) {
const isSpark = i % 2 === 0;
const mat = new THREE.MeshBasicMaterial({
color: isSpark ? 0xfbbf24 : 0x475569
});
const m = new THREE.Mesh(sparkGeo, mat);
m.visible = false;
scene.add(m);
crashDebrisList.push({
mesh: m,
life: 0,
maxLife: 0.8,
vx: 0,
vy: 0,
vz: 0,
rx: 0,
ry: 0
});
}
}
await advanceLoadingStage(68, "NY市街地 (半径2km・3.8kmタイムアタック対応) ビル群＆信号機を構築中...", "STAGE 4/6 // NYC METROPOLIS");
buildNewYorkCityCourse();
