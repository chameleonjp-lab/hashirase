import {createSwipeController} from '../platform/swipe-control.js';import {createSwipeGuide} from './swipe-guide.js';import {listenerScope} from './listeners.js';
const excluded='button,a,form,input,select,textarea,label,dialog,[role="button"],[data-no-drive]';
/** Bind only the supplied play surface; never the page, home, or settings. */
export function mountTouchControls(surface,{input,profile,mode,settings,toolbar,cameraLabel='視点を切替',onCamera=()=>{}}){
 const document=surface.ownerDocument,win=document.defaultView,scope=listenerScope(),guide=createSwipeGuide(surface),swipe=createSwipeController(settings),buttons=[],held=new Map(),keyHolds=new Map(),toggles=new Map();let current=settings,disposed=false,buttonScope=listenerScope();
 function capture(node,id){try{node.setPointerCapture(id);}catch{/* Synthetic events and already-cancelled pointers have no active capture. */}}
 function release(node,id){try{if(node.hasPointerCapture(id))node.releasePointerCapture(id);}catch{/* The browser may have released it first. */}}
 function changed(){const frame=swipe.sample();input.setSwipe(frame);guide.update(frame,swipe.origin(),current);}
 function pressed(button){const active=toggles.has(button)||[...held.values(),...keyHolds.values()].some(hold=>hold.button===button);button.setAttribute('aria-pressed',String(active));}
 function clear(){const owner=swipe.sample().pointerId;swipe.clear();guide.clear();const holds=[...held];held.clear();keyHolds.clear();toggles.clear();for(const b of buttons)pressed(b);if(owner!==null)release(surface,owner);for(const [id,{button}]of holds)release(button,id);}
 function endPointer(event){const hold=held.get(event.pointerId);if(!hold)return;held.delete(event.pointerId);input.removeSource(hold.key);pressed(hold.button);release(hold.button,event.pointerId);}
 const offClear=input.onClear(clear);
 scope.on(surface,'pointerdown',event=>{if(disposed||profile==='desktop'||!input.isEnabled()||!['touch','pen'].includes(event.pointerType)||event.target.closest(excluded))return;if(swipe.down(event)){capture(surface,event.pointerId);changed();event.preventDefault();}});
 scope.on(win,'pointermove',event=>{if(swipe.sample().pointerId===event.pointerId&&swipe.move(event)){changed();event.preventDefault();}},{passive:false});
 scope.on(win,'pointerup',event=>{endPointer(event);if(swipe.up(event.pointerId)){input.setSwipe(swipe.sample());guide.clear();release(surface,event.pointerId);}});
 scope.on(win,'keyup',event=>{const hold=keyHolds.get(event.code);if(!hold)return;keyHolds.delete(event.code);input.removeSource(hold.key);pressed(hold.button);});
 for(const name of ['pointercancel','lostpointercapture'])scope.on(surface,name,event=>{if(swipe.sample().pointerId===event.pointerId)input.clear();});
 scope.on(win,'blur',()=>input.clear());scope.on(document,'visibilitychange',()=>{if(document.visibilityState!=='visible')input.clear();});
 scope.on(win,'orientationchange',()=>input.clear());scope.on(win,'resize',()=>input.clear());
 function addButton(action,label,alternative=false){
  const button=document.createElement('button');button.type='button';button.textContent=label;button.dataset.action=action;button.setAttribute('aria-pressed','false');if(alternative)button.dataset.alternative='';toolbar.append(button);buttons.push(button);
  if(action==='camera'){buttonScope.on(button,'click',onCamera);return;}
  const value=action==='left'?{steer:-1}:action==='right'?{steer:1}:{[action]:['boost','hover','kickflip'].includes(action)?true:1};
  buttonScope.on(button,'pointerdown',event=>{if(!input.isEnabled()||held.has(event.pointerId))return;event.stopPropagation();event.preventDefault();const key='button:pointer:'+event.pointerId;held.set(event.pointerId,{button,key});capture(button,event.pointerId);input.setSource(key,value);pressed(button);});
  buttonScope.on(button,'pointerup',endPointer);
  buttonScope.on(button,'lostpointercapture',event=>{if(held.has(event.pointerId))input.clear();});
  buttonScope.on(button,'pointercancel',()=>input.clear());
  buttonScope.on(button,'keydown',event=>{if(!['Space','Enter'].includes(event.code)||!input.isEnabled())return;event.preventDefault();if(keyHolds.has(event.code))return;const key='button:key:'+event.code;keyHolds.set(event.code,{button,key});input.setSource(key,value);pressed(button);});
  buttonScope.on(button,'click',event=>{if(event.detail!==0||!input.isEnabled())return;const key='button:toggle:'+action;if(toggles.has(button)){toggles.delete(button);input.removeSource(key);}else{toggles.set(button,key);input.setSource(key,value);}pressed(button);});
 }
 function drawButtons(){buttonScope.dispose();buttonScope=listenerScope();for(const b of buttons.splice(0))b.remove();held.clear();if(profile!=='desktop'&&mode==='driving'){addButton('boost','ロケット');addButton('hover','浮上');addButton('kickflip','ジャンプ');}addButton('camera',cameraLabel);if(profile!=='desktop'&&current.alternativeControls){addButton('throttle','前進',true);addButton('brake','制動',true);addButton('reverseThrottle','後退',true);addButton('left','左',true);addButton('right','右',true);}}
 drawButtons();
 return Object.freeze({configure(next){input.clear();current=next;swipe.configure(next);drawButtons();},dispose(){if(disposed)return;disposed=true;input.clear();offClear();scope.dispose();buttonScope.dispose();guide.dispose();for(const b of buttons)b.remove();buttons.length=0;}});
}
