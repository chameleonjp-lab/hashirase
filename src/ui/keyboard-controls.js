import {listenerScope} from './listeners.js';
import {defaultSettings} from '../platform/settings-store.js';
export function inputHelp(profile,mode,settings=defaultSettings(profile,mode)){
 const touch='触れた場所から上に加速、下に制動・停止後に後退。左右は操舵。離すと惰性走行。';
 const pretty=action=>(settings.keys?.[action]??'').replace(/^Key/,'');
 const keys=`${pretty('throttle')}:前進 / ${pretty('brake')}:制動 / ${pretty('reverseThrottle')}:停止後に後退 / ${pretty('left')}・${pretty('right')}:操舵 / ${pretty('camera')}:視点。マウスのドラッグで視点を操作。`+(mode==='driving'?` ${pretty('boost')}:ロケット / ${pretty('hover')}:浮上 / ${pretty('kickflip')}:ジャンプ。`:'');
 return profile==='touch'?touch:profile==='desktop'?keys:touch+' '+keys;
}
const editable='input,select,textarea,button,a,[contenteditable="true"],dialog';
export function mountKeyboardControls(surface,{input,profile,mode,settings,onCamera=()=>{},onLook=()=>{}}){
 const win=surface.ownerDocument.defaultView,scope=listenerScope(),held=new Set();let current=settings,drag=null,disposed=false;
 function releaseDrag(){const previous=drag;drag=null;if(previous)try{if(surface.hasPointerCapture(previous.id))surface.releasePointerCapture(previous.id);}catch{/* Capture may already have been released by the browser. */}}
 const offClear=input.onClear(()=>{held.clear();releaseDrag();});
 scope.on(win,'keydown',event=>{
  if(disposed||profile==='touch'||!input.isEnabled()||event.target.closest?.(editable))return;
  const action=Object.keys(current.keys).find(action=>current.keys[action]===event.code);if(!action)return;event.preventDefault();
  if(event.repeat||held.has(event.code))return;held.add(event.code);
  if(action==='camera'){onCamera();return;}
  const frame=action==='left'?{steer:-1}:action==='right'?{steer:1}:{[action]:['boost','hover','kickflip'].includes(action)?true:1};input.setSource('keyboard:'+event.code,frame);
 });
 scope.on(win,'keyup',event=>{held.delete(event.code);input.removeSource('keyboard:'+event.code);});
 scope.on(surface,'pointerdown',event=>{if(profile==='touch'||!input.isEnabled()||!current.dragView||event.pointerType!=='mouse'||event.button!==0||event.target.closest?.(editable))return;drag={id:event.pointerId,x:event.clientX,y:event.clientY};try{surface.setPointerCapture(event.pointerId);}catch{};});
 scope.on(win,'pointermove',event=>{if(!drag||event.pointerId!==drag.id)return;onLook((event.clientX-drag.x)*current.mouseSensitivity,(event.clientY-drag.y)*current.mouseSensitivity);drag.x=event.clientX;drag.y=event.clientY;});
 scope.on(win,'pointerup',event=>{if(drag?.id===event.pointerId)releaseDrag();});
 for(const type of ['pointercancel','lostpointercapture'])scope.on(win,type,event=>{if(drag?.id===event.pointerId)input.clear();});
 scope.on(win,'blur',()=>input.clear());scope.on(surface.ownerDocument,'visibilitychange',()=>{if(surface.ownerDocument.visibilityState!=='visible')input.clear();});
 return Object.freeze({configure(next){input.clear();current=next;},dispose(){if(disposed)return;disposed=true;input.clear();offClear();scope.dispose();}});
}
