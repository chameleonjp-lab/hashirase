import {mountHome} from './home.js';
import {loadMode} from './mode-loader.js';
import {createSessionHost} from './session-host.js';
import {createFixedClock} from '../platform/clock.js';
import {createEventChannel} from '../contracts/events.js';
import {createInputFrame} from '../contracts/vehicle.js';
import {createInputService} from '../platform/input-service.js';
import {detectDeviceProfile} from '../platform/device-profile.js';
import {createSettingsStore} from '../platform/settings-store.js';
import {mountTouchControls} from '../ui/touch-controls.js';
import {mountKeyboardControls,inputHelp} from '../ui/keyboard-controls.js';
import {mountSettings} from '../ui/settings.js';
import {listenerScope} from '../ui/listeners.js';

const app=document.querySelector('#app');
app.innerHTML='<header class="app-header"><a class="wordmark" href="./" aria-label="HASHIRASE ホーム">H<span>ASHIRASE</span></a><nav aria-label="モード操作"><button data-home>ホームへ</button><button data-pause>一時停止</button><button data-settings>設定</button><button data-help>操作</button></nav></header><main class="home-content"></main><div class="stages"></div><section class="state-panel" aria-live="polite"></section><div class="dialogs"></div>';
const homeRoot=app.querySelector('main'),stages=app.querySelector('.stages'),panel=app.querySelector('.state-panel'),dialogs=app.querySelector('.dialogs'),nav=app.querySelector('nav');
let storage;try{storage=window.localStorage;}catch{/* The store shows its memory fallback warning. */}
const store=createSettingsStore(storage);
let profile=detectDeviceProfile({maxTouchPoints:navigator.maxTouchPoints,finePointer:matchMedia('(pointer:fine)').matches}),active=null,homeView=null,homeSettings=null;
const host=createSessionHost({loadMode,prepare:prepareMode,onChange:drawState,countCanvases:()=>stages.querySelectorAll('canvas').length});

function choose(mode,{historyEntry=true}={}){
 homeSettings?.dispose();homeSettings=null;
 if(historyEntry){const url=new URL(location.href);url.searchParams.set('mode',mode);if(host.snapshot().state==='HOME')history.pushState({mode},'',url);else history.replaceState({mode},'',url);}
 void host.selectMode(mode);
}
function goHome(){const url=new URL(location.href);url.searchParams.delete('mode');history.replaceState(null,'',url);void host.leaveMode();}
function openHomeSettings(mode){
 homeSettings?.dispose();homeSettings=mountSettings(dialogs,{store,profile,mode,hiddenSettings:mode==='simulation'?['volume','viewpoint','reducedMotion']:[],onProfileChange(next){profile=next;openHomeSettings(mode);}});homeSettings.open();
}
function drawState(state){
 app.dataset.appState=state.state;app.dataset.mode=state.mode??'';
 if(state.state==='LOADING'&&document.visibilityState!=='visible')host.pause('hidden');
 const atHome=state.state==='HOME';homeRoot.hidden=!atHome;nav.hidden=!['RUNNING','PAUSED','RESULT'].includes(state.state);
 app.querySelector('.wordmark span').hidden=!atHome;
 if(atHome&&!homeView)homeView=mountHome(homeRoot,{onSelect:choose,onSettings:openHomeSettings});
 if(!atHome&&homeView){homeView.dispose();homeView=null;}
 if(active)active.stage.hidden=!['READY','RUNNING','PAUSED','RESULT'].includes(state.state);
 panel.replaceChildren();panel.hidden=['HOME','READY','RUNNING'].includes(state.state);
 const pauseButton=app.querySelector('[data-pause]');pauseButton.disabled=state.state!=='RUNNING';pauseButton.textContent=state.state==='PAUSED'?'中断中':'一時停止';
 const text=value=>{const p=document.createElement('p');p.textContent=value;panel.append(p);};
 const button=(label,callback)=>{const b=document.createElement('button');b.textContent=label;b.type='button';b.addEventListener('click',callback);panel.append(b);};
 if(state.state==='LOADING'){text('走る準備をしています…');button('キャンセル',goHome);button(state.mode==='driving'?'シミュレーターへ変更':'ゲームへ変更',()=>choose(state.mode==='driving'?'simulation':'driving'));}
 if(state.state==='ERROR'){text('開始できませんでした');text(/^[\u3000-\u9fff]/.test(state.error)?state.error:'必要なファイルや画面を準備できませんでした。通信を確認して再試行してください。');button('再試行',()=>location.reload());button('ホームへ',goHome);}
 if(state.state==='PAUSED'){
  const overloaded=state.pauseReason==='overload';text(overloaded?'計算の遅延により中断しました。リセットして再開してください。':'一時停止中');
  if(!overloaded)button('再開',()=>host.resume());
  button('リセットして再開',()=>{host.reset();host.resume();});
 }
 if(state.state==='DISPOSING')text('ホームに戻っています…');
 if(state.state==='RESULT'){text('走行が終了しました');button('リセットして再開',()=>{host.reset();host.resume();});}
}

async function prepareMode(module,{mode,scope,abortSignal,sessionId}){
 const stage=document.createElement('section');stage.className='mode-stage';stage.hidden=true;stages.append(stage);scope.own(()=>stage.remove());
 const root=document.createElement('div');root.className='mode-screen';stage.append(root);
 const pack=await module.prepare({root,scope,signal:abortSignal,settings:store.read(profile,mode)});
 if(abortSignal.aborted)throw new DOMException('Cancelled','AbortError');
 const surface=document.createElement('div');surface.className='drive-surface mode-input-area';surface.tabIndex=0;surface.setAttribute('aria-label','運転エリア');stage.append(surface);
 const toolbar=document.createElement('nav');toolbar.className='mode-toolbar';toolbar.setAttribute('aria-label','走行操作');stage.append(toolbar);
 let input,bindings,settingsUI,desiredEnabled=false,lastInput=createInputFrame(),disposed=false;
 const facade={sample(timing){return lastInput=input.sample(timing);},clear(){lastInput=createInputFrame();input?.clear();},setEnabled(value){desiredEnabled=value;input?.setEnabled(value);},dispose(){if(disposed)return;disposed=true;bindings?.dispose();settingsUI?.dispose();input?.dispose();lastInput=createInputFrame();}};
 scope.own(facade);
 const record={stage,root,surface,mode,pack,settings:()=>settingsUI,help:()=>showHelp(),lastInput:()=>lastInput};active=record;
 scope.own(()=>{if(active===record)active=null;document.documentElement.style.removeProperty('--hashirase-ui-scale');});
 function camera(){const viewpoint=pack.renderer.cycleCamera?.();if(mode==='driving'&&['chase','cockpit'].includes(viewpoint))store.write(profile,mode,{viewpoint});surface.focus({preventScroll:true});}
 function apply(next){bindings.touch.configure(next);bindings.keyboard.configure(next);pack.configure(next);document.documentElement.style.setProperty('--hashirase-ui-scale',next.uiScale);}
 function bind(){
  bindings?.dispose();settingsUI?.dispose();input?.dispose();input=createInputService(profile,{mode});input.setEnabled(desiredEnabled);const settings=store.read(profile,mode),events=listenerScope();
  const touch=mountTouchControls(surface,{input,profile,mode,settings,toolbar,cameraLabel:pack.cameraLabel,onCamera:camera});
  const keyboard=mountKeyboardControls(surface,{input,profile,mode,settings,onCamera:camera,onLook:(x,y)=>pack.renderer.look?.(x,y)});
  const rcsHolds=new Set(),rcs=root.querySelector('#btn-rcs-spin');
  function spin(){host.action('rcsSpin',rcsHolds.size>0);rcs?.setAttribute('aria-pressed',String(rcsHolds.size>0));}
  const offClear=input.onClear(()=>{const previous=[...rcsHolds];rcsHolds.clear();spin();for(const id of previous)if(typeof id==='number')try{if(rcs?.hasPointerCapture(id))rcs.releasePointerCapture(id);}catch{}});
  if(pack.hasRcs){
   if(rcs){events.on(rcs,'pointerdown',e=>{if(!input.isEnabled())return;e.preventDefault();rcsHolds.add(e.pointerId);spin();try{rcs.setPointerCapture(e.pointerId);}catch{}});events.on(window,'pointerup',e=>{rcsHolds.delete(e.pointerId);spin();});events.on(rcs,'pointercancel',()=>input.clear());events.on(rcs,'lostpointercapture',()=>input.clear());events.on(rcs,'click',e=>{if(e.detail===0&&input.isEnabled()){if(rcsHolds.has('assistive'))rcsHolds.delete('assistive');else rcsHolds.add('assistive');spin();}});}
   events.on(window,'keydown',e=>{if(!input.isEnabled()||profile==='touch'||e.target.closest?.('button,a,input,select,textarea,dialog')||!['KeyQ','KeyE'].includes(e.code)||Object.values(store.read(profile,mode).keys).includes(e.code))return;e.preventDefault();rcsHolds.add(e.code);spin();});
   if(rcs)events.on(rcs,'keydown',e=>{if(input.isEnabled()&&['Space','Enter'].includes(e.code)){e.preventDefault();rcsHolds.add('button:'+e.code);spin();}});
   events.on(window,'keyup',e=>{rcsHolds.delete(e.code);rcsHolds.delete('button:'+e.code);spin();});
  }
  bindings={touch,keyboard,dispose(){touch.dispose();keyboard.dispose();events.dispose();offClear();toolbar.replaceChildren();}};
  settingsUI=mountSettings(dialogs,{store,profile,mode,input:facade,hiddenSettings:pack.hiddenSettings,onOpen:()=>host.pause('settings'),onClose(){if(host.snapshot().state!=='RUNNING')facade.setEnabled(false);},onApply:apply,onProfileChange(next){host.pause('profile');profile=next;bind();settingsUI.open();}});
  apply(settings);
 }
 function showHelp(){
  host.pause('help');const dialog=document.createElement('dialog');dialog.className='settings-dialog';dialog.setAttribute('aria-label','運転操作');
  const p=document.createElement('p');p.textContent=inputHelp(profile,mode,store.read(profile,mode))+(mode==='driving'?' Q / E（未割当時）またはRCSボタン: 空中回転。':' この最小モデルでは操舵はまだ旋回に反映しません。');
  const close=document.createElement('button');close.textContent='閉じる';close.onclick=()=>dialog.close();dialog.append(p,close);dialogs.append(dialog);dialog.addEventListener('close',()=>dialog.remove(),{once:true});scope.own(()=>{dialog.close();dialog.remove();});dialog.showModal();
 }
 bind();
 const events=listenerScope();scope.own(events);
 events.on(root,'webglcontextlost',e=>{e.preventDefault();if(!abortSignal.aborted)host.reportError(new Error('描画が停止しました。再試行してください。'));},true);
 events.on(root,'click',e=>{if(e.target.closest('#btn-help'))host.pause('help');if(e.target.closest('#btn-toggle-course,#btn-reset-car'))facade.clear();});
 const renderer={...pack.renderer,render(snapshot,alpha){pack.renderer.render(snapshot,alpha);if(mode==='simulation'){const rect=root.querySelector('canvas')?.getBoundingClientRect();if(rect){surface.style.top=rect.top+'px';surface.style.height=rect.height+'px';surface.style.bottom='auto';}}},resize(size){pack.renderer.resize(size);}};
 renderer.resize({width:innerWidth,height:innerHeight,pixelRatio:devicePixelRatio});
 const world={step(){},query:()=>Object.freeze({}),reset(){},dispose(){}};
 return{clock:createFixedClock(),input:facade,settings:{read:(p=profile,m=mode)=>store.read(p,m),write:(p,m,value)=>store.write(p,m,value)},world,renderer,audio:pack.audio,events:createEventChannel(sessionId),abortSignal,sessionId};
}

app.querySelector('[data-home]').onclick=goHome;
app.querySelector('.wordmark').onclick=e=>{e.preventDefault();goHome();};
app.querySelector('[data-pause]').onclick=()=>host.pause();
app.querySelector('[data-settings]').onclick=()=>active?.settings().open();
app.querySelector('[data-help]').onclick=()=>active?.help();
window.addEventListener('blur',()=>host.pause('blur'));
document.addEventListener('visibilitychange',()=>{if(document.visibilityState!=='visible')host.pause('hidden');});
window.addEventListener('resize',()=>{active?.pack.renderer.resize({width:innerWidth,height:innerHeight,pixelRatio:devicePixelRatio});});
window.addEventListener('orientationchange',()=>host.pause('orientation'));
window.addEventListener('popstate',()=>{const mode=new URL(location.href).searchParams.get('mode');if(['driving','simulation'].includes(mode))choose(mode,{historyEntry:false});else void host.leaveMode();});
window.addEventListener('pagehide',()=>{void host.dispose();});
window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
export function appDiagnostics(){return{...host.snapshot(),input:active?.lastInput()??createInputFrame(),renderer:active?.pack.renderer.diagnostics?.()??null,audio:active?.pack.audio.diagnostics?.()??null};}
drawState(host.snapshot());
const initial=new URL(location.href).searchParams.get('mode');
if(['driving','simulation'].includes(initial))choose(initial,{historyEntry:false});
else if(initial!==null){const url=new URL(location.href);url.searchParams.delete('mode');history.replaceState(null,'',url);}
