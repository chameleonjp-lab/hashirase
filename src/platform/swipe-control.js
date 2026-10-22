import {finite,integer} from '../contracts/validation.js';import {createSwipeFrame} from '../contracts/vehicle.js';
export function createSwipeController(initial={}){
 let settings,owner=null,origin=null,current=null;
 function configure(values={}){const next={sensitivityX:1,sensitivityY:1,deadZone:10,maxDistance:88,...settings,...values};
  finite(next.sensitivityX,'sensitivityX',0.25,3);finite(next.sensitivityY,'sensitivityY',0.25,3);finite(next.deadZone,'deadZone',0,30);finite(next.maxDistance,'maxDistance',32,200);if(next.maxDistance<=next.deadZone)throw new TypeError('maxDistance must exceed deadZone');settings=next;clear();}
 function point(value){integer(value.pointerId,'pointerId');finite(value.clientX,'clientX');finite(value.clientY,'clientY');return{x:value.clientX,y:value.clientY};}
 function clear(){owner=null;origin=null;current=null;}
 configure(initial);
 const axis=(distance,sensitivity)=>Math.sign(distance)*Math.min(1,Math.max(0,Math.abs(distance)-settings.deadZone)/(settings.maxDistance-settings.deadZone)*sensitivity)||0;
 return Object.freeze({configure,clear,
  down(value){const p=point(value);if(owner!==null)return false;owner=value.pointerId;origin=p;current=p;return true;},
  move(value){const p=point(value);if(value.pointerId!==owner)return false;current=p;return true;},
  up(pointerId){if(pointerId!==owner)return false;clear();return true;},origin:()=>origin&&Object.freeze({...origin}),
  sample(){return owner===null?createSwipeFrame():createSwipeFrame({horizontal:axis(current.x-origin.x,settings.sensitivityX),vertical:axis(origin.y-current.y,settings.sensitivityY),active:true,pointerId:owner});}
 });
}
