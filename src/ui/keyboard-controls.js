import {listenerScope} from './listeners.js';
export function inputHelp(profile,mode){
 const touch='触れた場所から上に加速、下に制動・停止後に後退。左右は操舵。離すと惰性走行。';
 const keys='W:前進 / S:制動 / R:停止後に後退 / A・D:操舵 / C:視点。マウスのドラッグで視点を操作。'+(mode==='driving'?' Space:ロケット / H:浮上 / F:ジャンプ。':'');
 return profile==='touch'?touch:profile==='desktop'?keys:touch+' '+keys;
}
const editable='input,select,textarea,button,a,[contenteditable="true"],dialog';
export function mountKeyboardControls(surface,{input,profile,mode,settings,onCamera=()=>{},onLook=()=>{}}){
 const win=surface.ownerDocument.defaultView,scope=listenerScope(),held=new Set();let current=settings,drag=null,disposed=false;
 const offClear=input.onClear(()=>{held.clear();drag=null;});
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
 for(const type of ['pointerup','pointercancel','lostpointercapture'])scope.on(win,type,event=>{if(drag?.id===event.pointerId)drag=null;});
 scope.on(win,'blur',()=>input.clear());scope.on(surface.ownerDocument,'visibilitychange',()=>{if(surface.ownerDocument.visibilityState!=='visible')input.clear();});
 return Object.freeze({configure(next){input.clear();current=next;},dispose(){if(disposed)return;disposed=true;input.clear();offClear();scope.dispose();}});
}
