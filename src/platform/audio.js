/** Session-owned Web Audio. Constructing/importing is silent and lazy. */
export function createAudioService({createContext,random=()=>0.5}={}) {
let audioCtx = null;
let soundEnabled = false;
let motorOsc = null;
let motorGain = null;
let fanOsc = null;
let fanGain = null;
let thrusterNoiseNode = null;
let thrusterGain = null;
let thrusterFilter = null;

let carState;let disposed=false;const persistent=[],transients=new Set();let closedContexts=0;
function trackTransient(oscillators,gain){const group={oscillators,gain};transients.add(group);let remaining=oscillators.length;for(const osc of oscillators)osc.onended=()=>{osc.disconnect();if(--remaining===0){gain.disconnect();transients.delete(group);}};}
function silence(){if(!audioCtx)return;for(const gain of [motorGain,fanGain,thrusterGain])if(gain)gain.gain.setTargetAtTime(0,audioCtx.currentTime,0.05);}
function initAudio() {
if (audioCtx) return;
try {
audioCtx = createContext();
motorOsc = audioCtx.createOscillator();
motorOsc.type = 'sawtooth';
motorOsc.frequency.value = 110;
const motorFilter = audioCtx.createBiquadFilter();
motorFilter.type = 'bandpass';
motorFilter.frequency.value = 420;
motorFilter.Q.value = 2.5;
motorGain = audioCtx.createGain();
motorGain.gain.value = 0.0;
motorOsc.connect(motorFilter);
motorFilter.connect(motorGain);
motorGain.connect(audioCtx.destination);
motorOsc.start();
fanOsc = audioCtx.createOscillator();
fanOsc.type = 'triangle';
fanOsc.frequency.value = 185;
fanGain = audioCtx.createGain();
fanGain.gain.value = 0.0;
fanOsc.connect(fanGain);
fanGain.connect(audioCtx.destination);
fanOsc.start();
const bufferSize = audioCtx.sampleRate * 2;
const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
const output = noiseBuffer.getChannelData(0);
for (let i = 0; i < bufferSize; i++) {
output[i] = random() * 2 - 1;
}
thrusterNoiseNode = audioCtx.createBufferSource();
thrusterNoiseNode.buffer = noiseBuffer;
thrusterNoiseNode.loop = true;
thrusterFilter = audioCtx.createBiquadFilter();
thrusterFilter.type = 'bandpass';
thrusterFilter.frequency.value = 1200;
thrusterFilter.Q.value = 0.9;
thrusterGain = audioCtx.createGain();
thrusterGain.gain.value = 0.0;
thrusterNoiseNode.connect(thrusterFilter);
thrusterFilter.connect(thrusterGain);
thrusterGain.connect(audioCtx.destination);
thrusterNoiseNode.start();
persistent.push(motorOsc,motorFilter,motorGain,fanOsc,fanGain,thrusterNoiseNode,thrusterFilter,thrusterGain);
} catch (e) {
console.warn('Web Audio init skipped:', e);
}
}
function updateAudio(isFiringLift, isFiringRcs, isFiringBoost) {
if (!audioCtx || !soundEnabled) return;
if (audioCtx.state === 'suspended') audioCtx.resume();
const absSpd = Math.abs(carState.speed) * 3.6;
motorOsc.frequency.setTargetAtTime(95 + Math.min(absSpd * 3.0, 820), audioCtx.currentTime, 0.04);
motorGain.gain.setTargetAtTime(Math.min(0.015 + (absSpd / 300) * 0.09, 0.11), audioCtx.currentTime, 0.05);
const suctionActive = carState.suctionEnabled && carState.mode !== 'AIR';
fanOsc.frequency.setTargetAtTime(carState.mode === 'RAMP' ? 280 : 180, audioCtx.currentTime, 0.06);
fanGain.gain.setTargetAtTime(suctionActive ? 0.045 : 0.0, audioCtx.currentTime, 0.06);
const anyGas = isFiringLift || isFiringRcs || isFiringBoost;
const freq = isFiringRcs && !isFiringLift ? 1650 : 950;
const gainVal = isFiringLift || isFiringBoost ? 0.28 : (isFiringRcs ? 0.18 : 0.0);
thrusterFilter.frequency.setTargetAtTime(freq, audioCtx.currentTime, 0.02);
thrusterGain.gain.setTargetAtTime(anyGas ? gainVal : 0.0, audioCtx.currentTime, 0.02);
}
function playCrashSound(impactIntensity = 1.0) {
if (!audioCtx || !soundEnabled) return;
try {
if (audioCtx.state === 'suspended') audioCtx.resume();
const now = audioCtx.currentTime;
const osc = audioCtx.createOscillator();
const gain = audioCtx.createGain();
osc.type = 'sawtooth';
osc.frequency.setValueAtTime(130 * Math.min(1.6, Math.max(0.6, impactIntensity)), now);
osc.frequency.exponentialRampToValueAtTime(28, now + 0.32);
gain.gain.setValueAtTime(Math.min(0.45, 0.18 * impactIntensity), now);
gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
osc.connect(gain);
gain.connect(audioCtx.destination);
osc.start(now);
osc.stop(now + 0.36); trackTransient([osc],gain);
} catch (e) {}
}
function playTireScreechSound(intensity = 0.5, weatherState) {
  if (!audioCtx || !soundEnabled || weatherState.screechCooldown > 0) return;
  weatherState.screechCooldown = 0.18;
  try {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1420 + random() * 240, now);
    osc.frequency.linearRampToValueAtTime(1180, now + 0.15);
    gain.gain.setValueAtTime(Math.min(0.08, 0.035 * intensity), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.17); trackTransient([osc],gain);
  } catch (e) {}
}
function playCarHornSound(pitchScale = 1.0, weatherState) {
  if (!audioCtx || !soundEnabled || weatherState.hornCooldown > 0) return;
  weatherState.hornCooldown = 1.1;
  try {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const now = audioCtx.currentTime;
    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc1.type = 'sawtooth';
    osc2.type = 'sawtooth';
    osc1.frequency.setValueAtTime(410 * pitchScale, now);
    osc2.frequency.setValueAtTime(512 * pitchScale, now);
    gain.gain.setValueAtTime(0.065, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(audioCtx.destination);
    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.35);
    osc2.stop(now + 0.35); trackTransient([osc1,osc2],gain);
  } catch (e) {}
}
function playSirenBurstSound() {
  if (!audioCtx || !soundEnabled) return;
  try {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(680, now);
    osc.frequency.linearRampToValueAtTime(1180, now + 0.28);
    osc.frequency.linearRampToValueAtTime(680, now + 0.55);
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.58);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.60); trackTransient([osc],gain);
  } catch (e) {}
}
return Object.freeze({
  init(){if(!disposed)initAudio();},
  toggle(){if(disposed)return false;initAudio();soundEnabled=!soundEnabled;if(!soundEnabled)silence();return soundEnabled;},
  update(state,lift,rcs,boost){if(disposed)return;carState=state;updateAudio(lift,rcs,boost);},
  siren(){if(!disposed)playSirenBurstSound();},
  crash(intensity){if(!disposed)playCrashSound(intensity);},
  screech(intensity,weather){if(!disposed)playTireScreechSound(intensity,weather);},
  horn(pitch,weather){if(!disposed)playCarHornSound(pitch,weather);},
  pause(){silence();if(audioCtx?.state==='running')audioCtx.suspend().catch(()=>{});},
  resume(){if(soundEnabled&&audioCtx?.state==='suspended')audioCtx.resume().catch(()=>{});},
  dispose(){if(disposed)return;disposed=true;soundEnabled=false;silence();for(const node of persistent){try{node.stop?.();}catch{}try{node.disconnect();}catch{}}persistent.length=0;for(const {oscillators,gain}of transients){for(const osc of oscillators){osc.onended=null;try{osc.stop();}catch{}osc.disconnect();}gain.disconnect();}transients.clear();if(audioCtx){closedContexts++;return audioCtx.close().catch(()=>{});}},
  diagnostics(){return {disposed,contexts:audioCtx&&!disposed?1:0,closedContexts,nodes:persistent.length+transients.size};}
});
}
