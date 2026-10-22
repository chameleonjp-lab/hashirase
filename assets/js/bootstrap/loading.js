
(function () {
var curPct = 5;
window.__setLoadingGauge = function (pct, stepMsg, phaseMsg) {
curPct = Math.max(curPct, Math.min(100, Math.round(pct)));
var bars = document.querySelectorAll("#loading-bar-fill, .loader-bar-fill");
for (var i = 0; i < bars.length; i++) bars[i].style.width = curPct + "%";
var pcts = document.querySelectorAll("#loading-pct-num, .loader-pct-value");
for (var j = 0; j < pcts.length; j++) pcts[j].textContent = curPct + "%";
if (stepMsg) {
var steps = document.querySelectorAll("#loading-step-text, .loader-step-text");
for (var k = 0; k < steps.length; k++) steps[k].textContent = stepMsg;
}
if (phaseMsg) {
var phases = document.querySelectorAll("#loading-phase-label, .loader-phase-label");
for (var m = 0; m < phases.length; m++) phases[m].textContent = phaseMsg;
}
};
window.__hideLoadingScreen = function () {
var screens = document.querySelectorAll("#loading-screen");
for (var i = 0; i < screens.length; i++) {
screens[i].classList.add("loaded-hide");
}
setTimeout(function () {
var s2 = document.querySelectorAll("#loading-screen");
for (var j = 0; j < s2.length; j++) {
s2[j].style.display = "none";
}
}, 400);
};
window.__setLoadingGauge(8, "3Dエンジン (Three.js) とシェーダーを読み込み中...", "LOADING ENGINE // STEP 1/6");
var earlyTimer = setInterval(function () {
if (curPct < 20) {
window.__setLoadingGauge(curPct + 3, "3Dエンジン (Three.js) とシェーダーを読み込み中...", "LOADING ENGINE // STEP 1/6");
} else {
clearInterval(earlyTimer);
}
}, 80);
})();
