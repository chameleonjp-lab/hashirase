import {test} from 'node:test';import assert from 'node:assert/strict';
import {optionalModule} from '../support/foundation.mjs';
const swipe=await optionalModule('src/platform/swipe-control.js');const inputs=await optionalModule('src/platform/input-service.js');
const point=(pointerId,clientX=100,clientY=100)=>({pointerId,clientX,clientY});
function create(){assert.equal(typeof swipe.createSwipeController,'function','T06 requires createSwipeController');return swipe.createSwipeController();}
function input(){assert.equal(typeof inputs.createInputService,'function','T06 requires createInputService');return inputs.createInputService('hybrid');}
test('touch_tap_is_zero',()=>{const c=create();assert(c.down(point(1,200,350)));assert.deepEqual(c.sample(),{horizontal:0,vertical:0,active:true,pointerId:1});assert.deepEqual(c.origin(),{x:200,y:350});});
test('swipe_up_accelerates',()=>{const c=create(),i=input();c.down(point(1));c.move(point(1,100,12));i.setSwipe(c.sample());assert.equal(i.sample().throttle,1);assert.equal(i.sample().brake,0);});
test('swipe_down_brakes_then_reverses_only_after_stop',()=>{
 const c=create(),i=input();c.down(point(1));c.move(point(1,100,188));i.setSwipe(c.sample());
 for(let n=0;n<120;n++){const f=i.sample({dt:1/120,longitudinalSpeed:10});assert.equal(f.brake,1);assert.equal(f.reverseThrottle,0);}
 for(let n=0;n<35;n++){const f=i.sample({dt:1/120,longitudinalSpeed:0});assert.equal(f.brake,1);assert.equal(f.reverseThrottle,0);}
 assert.equal(i.sample({dt:1/120,longitudinalSpeed:0}).reverseThrottle,1);
 assert.equal(i.sample({dt:1/120,longitudinalSpeed:-3}).reverseThrottle,1);
 assert.equal(i.sample({dt:1/120,longitudinalSpeed:2}).reverseThrottle,0);
 c.up(1);i.setSwipe(c.sample());assert.equal(i.sample().reverseThrottle,0);
});
test('swipe_left_right_steers',()=>{for(const sign of [-1,1]){const c=create();c.down(point(1));c.move(point(1,100+sign*88,100));assert.equal(c.sample().horizontal,sign);assert.equal(c.sample().vertical,0);}});
test('diagonal_swipe_combines_axes',()=>{const c=create(),i=input();c.down(point(1));c.move(point(1,188,12));i.setSwipe(c.sample());assert.equal(i.sample().throttle,1);assert.equal(i.sample().steer,1);});
test('swipe_returns_to_origin_is_zero',()=>{const c=create();c.down(point(1));c.move(point(1,188,12));c.move(point(1));assert.equal(c.sample().horizontal,0);assert.equal(c.sample().vertical,0);});
test('pointer_cancel_clears',()=>{const c=create();c.down(point(1));c.move(point(1,0,0));c.clear();assert.deepEqual(c.sample(),{horizontal:0,vertical:0,active:false,pointerId:null});assert.equal(c.origin(),null);});
test('primary_pointer_is_not_stolen_or_automatically_promoted',()=>{const c=create();c.down(point(1));assert.equal(c.down(point(2)),false);c.move(point(2,188,12));assert.equal(c.sample().horizontal,0);c.up(1);c.move(point(2,188,12));assert.equal(c.sample().active,false);});
test('second_finger_action_works',()=>{const c=create(),i=input();c.down(point(1));c.move(point(1,100,12));i.setSwipe(c.sample());i.setSource('button:2',{boost:true});assert.equal(i.sample().boost,true);assert.equal(i.sample().throttle,1);i.removeSource('button:2');assert.equal(i.sample().boost,false);assert.equal(i.sample().throttle,1);});
test('swipe_deadzone_linear_axes_clamping_and_edge_origin_are_stable',()=>{const c=create();c.down(point(1,3,620));c.move(point(1,8,615));assert.equal(c.sample().horizontal,0);assert.equal(c.sample().vertical,0);c.move(point(1,52,571));assert.equal(c.sample().horizontal,0.5);assert.equal(c.sample().vertical,0.5);c.move(point(1,1000,-1000));assert.equal(c.sample().horizontal,1);assert.deepEqual(c.origin(),{x:3,y:620});});
test('changing_swipe_settings_releases_the_origin_and_rejects_invalid_values',()=>{const c=create();c.down(point(1));c.configure({sensitivityX:2,sensitivityY:1,deadZone:10,maxDistance:88});assert.equal(c.sample().active,false);assert.throws(()=>c.configure({maxDistance:5}),/distance|Distance|dead/);assert.throws(()=>c.down(point(NaN)),/pointer/);});
