
(function () {
window.__installSoftwareThreeShim = function () {
class Vec3 {
constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
clone() { return new Vec3(this.x, this.y, this.z); }
add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
addScaledVector(v, s) { this.x += v.x * s; this.y += v.y * s; this.z += v.z * s; return this; }
normalize() {
const l = Math.hypot(this.x, this.y, this.z) || 1;
this.x /= l; this.y /= l; this.z /= l;
return this;
}
applyEuler(e) {
const cy = Math.cos(e.y || 0), sy = Math.sin(e.y || 0);
const cx = Math.cos(e.x || 0), sx = Math.sin(e.x || 0);
const cz = Math.cos(e.z || 0), sz = Math.sin(e.z || 0);
let x1 = this.x * cz - this.y * sz;
let y1 = this.x * sz + this.y * cz;
let z1 = this.z;
let y2 = y1 * cx - z1 * sx;
let z2 = y1 * sx + z1 * cx;
this.x = x1 * cy + z2 * sy;
this.y = y2;
this.z = -x1 * sy + z2 * cy;
return this;
}
lerp(v, a) {
this.x += (v.x - this.x) * a;
this.y += (v.y - this.y) * a;
this.z += (v.z - this.z) * a;
return this;
}
distanceTo(v) { return Math.hypot(this.x - v.x, this.y - v.y, this.z - v.z); }
setScalar(s) { this.x = s; this.y = s; this.z = s; return this; }
}
class Obj3D {
constructor() {
this.position = new Vec3();
this.rotation = { x: 0, y: 0, z: 0, order: "XYZ" };
this.scale = new Vec3(1, 1, 1);
this.children = [];
this.visible = true;
this.matrix = { x: 0, y: 0, z: 0, sx: 1, sy: 1, sz: 1 };
}
add(c) { if (c) this.children.push(c); }
updateMatrix() {
this.matrix = {
x: this.position.x, y: this.position.y, z: this.position.z,
sx: this.scale.x, sy: this.scale.y, sz: this.scale.z
};
}
setMatrixAt(i, m) {
if (!this._instances) this._instances = [];
this._instances[i] = Object.assign({}, m);
}
lookAt(t) { this._lookTarget = t ? new Vec3(t.x, t.y, t.z) : new Vec3(); }
}
class SoftRenderer {
constructor() {
this.domElement = document.createElement("canvas");
this.ctx = this.domElement.getContext("2d");
this.shadowMap = { enabled: false };
this.w = 390;
this.h = 844;
}
setSize(w, h) {
this.w = w; this.h = h;
this.domElement.width = w;
this.domElement.height = h;
this.domElement.style.width = w + "px";
this.domElement.style.height = h + "px";
}
setPixelRatio() {}
render(scene, cam) {
const ctx = this.ctx;
if (!ctx) return;
const w = this.w, h = this.h;
const grad = ctx.createLinearGradient(0, 0, 0, h);
if (window.__isNycDaytime) {
grad.addColorStop(0, "#38bdf8");
grad.addColorStop(0.52, "#bae6fd");
grad.addColorStop(0.53, "#64748b");
grad.addColorStop(1, "#334155");
} else {
grad.addColorStop(0, "#050814");
grad.addColorStop(0.5, "#0f172a");
grad.addColorStop(1, "#090d16");
}
ctx.fillStyle = grad;
ctx.fillRect(0, 0, w, h);
const camPos = cam.position;
const look = cam._lookTarget || new Vec3(camPos.x, camPos.y, camPos.z - 10);
const fx = look.x - camPos.x, fy = look.y - camPos.y, fz = look.z - camPos.z;
const fl = Math.hypot(fx, fy, fz) || 1;
const fwd = { x: fx / fl, y: fy / fl, z: fz / fl };
const rLen = Math.hypot(fwd.z, -fwd.x) || 1;
const right = { x: -fwd.z / rLen, y: 0, z: fwd.x / rLen };
const up = {
x: right.y * fwd.z - right.z * fwd.y,
y: right.z * fwd.x - right.x * fwd.z,
z: right.x * fwd.y - right.y * fwd.x
};
const fovScale = (h * 0.5) / Math.tan(((cam.fov || 68) * 0.5 * Math.PI) / 180);
function project(wx, wy, wz) {
const dx = wx - camPos.x, dy = wy - camPos.y, dz = wz - camPos.z;
const cz = dx * fwd.x + dy * fwd.y + dz * fwd.z;
if (cz <= 0.2) return null;
const cx = dx * right.x + dy * right.y + dz * right.z;
const cy = dx * up.x + dy * up.y + dz * up.z;
return {
x: w * 0.5 + (cx / cz) * fovScale,
y: h * 0.5 - (cy / cz) * fovScale,
d: cz
};
}
ctx.strokeStyle = "rgba(56, 189, 248, 0.16)";
ctx.lineWidth = 1;
const gx0 = Math.floor(camPos.x / 20) * 20;
const gz0 = Math.floor(camPos.z / 20) * 20;
for (let x = gx0 - 120; x <= gx0 + 120; x += 20) {
const p1 = project(x, 0, gz0 - 140);
const p2 = project(x, 0, gz0 + 140);
if (p1 && p2) { ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke(); }
}
for (let z = gz0 - 140; z <= gz0 + 140; z += 20) {
const p1 = project(gx0 - 120, 0, z);
const p2 = project(gx0 + 120, 0, z);
if (p1 && p2) { ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke(); }
}
const drawList = [];
function walk(node, px, py, pz) {
if (!node || !node.visible) return;
const wx = px + (node.position ? node.position.x : 0);
const wy = py + (node.position ? node.position.y : 0);
const wz = pz + (node.position ? node.position.z : 0);
if (node._instances && node._instances.length) {
const maxCount = typeof node.count === "number" ? node.count : node._instances.length;
for (let i = 0; i < maxCount; i += 2) {
const inst = node._instances[i];
if (!inst) continue;
const dist = Math.hypot(inst.x - camPos.x, inst.z - camPos.z);
if (dist <= 700) {
const p = project(inst.x, inst.y, inst.z);
if (p) drawList.push({ p, w: inst.sx || 12, h: inst.sy || 40, color: "#475569", stroke: "#38bdf8" });
}
}
} else if (node.geometry) {
const isBeacon = node.material && node.material.fog === false;
const dist = Math.hypot(wx - camPos.x, wz - camPos.z);
if (isBeacon || dist <= 700) {
const p = project(wx, wy, wz);
if (p && (isBeacon || p.d <= 700)) {
const hex = node.material && node.material.color ? "#" + ("000000" + node.material.color.toString(16)).slice(-6) : "#e2e8f0";
drawList.push({ p, w: isBeacon ? 28.0 : 2.2, h: isBeacon ? 1200.0 : 1.2, color: hex, stroke: "#ffffff" });
}
}
}
if (node.children) {
for (let i = 0; i < node.children.length; i++) walk(node.children[i], wx, wy, wz);
}
}
walk(scene, 0, 0, 0);
drawList.sort((a, b) => b.p.d - a.p.d);
for (let i = 0; i < drawList.length; i++) {
const it = drawList[i];
const rw = Math.max(2, (it.w / it.p.d) * fovScale * 0.65);
const rh = Math.max(2, (it.h / it.p.d) * fovScale * 0.65);
ctx.fillStyle = it.color;
ctx.fillRect(it.p.x - rw * 0.5, it.p.y - rh * 0.5, rw, rh);
}
}
}
return {
DoubleSide: 2, RepeatWrapping: 1000, PCFSoftShadowMap: 1,
Vector3: Vec3,
Euler: class { constructor(x, y, z) { this.x = x; this.y = y; this.z = z; } },
Color: class {},
FogExp2: class {},
Scene: Obj3D,
Group: Obj3D,
Object3D: Obj3D,
Mesh: class extends Obj3D { constructor(g, m) { super(); this.geometry = g || {}; this.material = m || {}; } },
InstancedMesh: class extends Obj3D { constructor(g, m, c) { super(); this.geometry = g || {}; this.material = m || {}; } },
PerspectiveCamera: class extends Obj3D { constructor(fov) { super(); this.fov = fov || 68; this.up = new Vec3(0, 1, 0); } updateProjectionMatrix() {} },
WebGLRenderer: SoftRenderer,
AmbientLight: Obj3D,
PointLight: Obj3D,
SpotLight: class extends Obj3D { constructor() { super(); this.target = new Obj3D(); } },
CanvasTexture: class { constructor() { this.repeat = { set: () => {} }; } },
MeshBasicMaterial: class { constructor(o) { Object.assign(this, o); } },
MeshStandardMaterial: class { constructor(o) { Object.assign(this, o); } },
PlaneGeometry: class { rotateZ() {} rotateY() {} translate() {} },
BoxGeometry: class { rotateZ() {} rotateY() {} translate() {} },
CylinderGeometry: class { rotateZ() {} rotateY() {} translate() {} },
SphereGeometry: class { rotateZ() {} rotateY() {} translate() {} },
ConeGeometry: class { rotateZ() {} rotateY() {} translate() {} },
RingGeometry: class { rotateZ() {} rotateY() {} translate() {} },
TorusGeometry: class { rotateZ() {} rotateY() {} translate() {} },
ExtrudeGeometry: class { rotateZ() {} rotateY() {} translate() {} },
Shape: class { moveTo() {} lineTo() {} quadraticCurveTo() {} closePath() {} }
};
};
})();
