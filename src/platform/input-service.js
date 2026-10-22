import {finite,identifier} from '../contracts/validation.js';import {createInputFrame,createSwipeFrame,assertSwipeFrame} from '../contracts/vehicle.js';import {DEVICE_PROFILES} from './device-profile.js';
/** Input sources own their holds. Sampling once per fixed tick advances only the reverse interlock. */
export function createInputService(profile,{mode='driving'}={}){
 if(!DEVICE_PROFILES.includes(profile)||!['driving','simulation'].includes(mode))throw new TypeError('Invalid input profile or mode');
 const sources=new Map(),clearListeners=new Set();let swipe=createSwipeFrame(),enabled=true,disposed=false,stoppedTime=0,reverseArmed=false;
 function clear(){sources.clear();swipe=createSwipeFrame();stoppedTime=0;reverseArmed=false;for(const listener of [...clearListeners])listener();}
 return Object.freeze({
  setSource(id,value){identifier(id,'source');const frame=createInputFrame(value);if(enabled&&!disposed)sources.set(id,frame);},removeSource(id){sources.delete(id);},
  setSwipe(frame){assertSwipeFrame(frame);if(enabled&&!disposed)swipe=createSwipeFrame(frame);},
  sample({dt=0,longitudinalSpeed=0}={}){
   finite(dt,'dt',0,1);finite(longitudinalSpeed,'longitudinalSpeed');if(!enabled||disposed)return createInputFrame();
   const raw={throttle:Math.max(0,swipe.vertical),brake:0,reverseThrottle:Math.max(0,-swipe.vertical),steer:swipe.horizontal,boost:false,hover:false,kickflip:false};
   for(const source of sources.values()){for(const channel of ['throttle','brake','reverseThrottle'])raw[channel]=Math.max(raw[channel],source[channel]);raw.steer+=source.steer;for(const channel of ['boost','hover','kickflip'])raw[channel]||=source[channel];}
   raw.steer=Math.max(-1,Math.min(1,raw.steer));
   if(raw.reverseThrottle>0&&raw.throttle===0&&raw.brake===0){
    if(longitudinalSpeed>0.15){reverseArmed=false;stoppedTime=0;}
    if(!reverseArmed){if(Math.abs(longitudinalSpeed)<=0.15)stoppedTime+=dt;else stoppedTime=0;reverseArmed=stoppedTime>=0.3-1e-12;}
    if(!reverseArmed){raw.brake=raw.reverseThrottle;raw.reverseThrottle=0;}
   }else{stoppedTime=0;reverseArmed=false;}
   if(mode==='simulation')raw.boost=raw.hover=raw.kickflip=false;
   return createInputFrame(raw);
  },clear,
  onClear(listener){if(typeof listener!=='function')throw new TypeError('clear listener');clearListeners.add(listener);return()=>clearListeners.delete(listener);},
  setEnabled(value){if(typeof value!=='boolean')throw new TypeError('enabled');enabled=value;if(!enabled)clear();},
  dispose(){if(disposed)return;disposed=true;enabled=false;clear();clearListeners.clear();}
 });
}
