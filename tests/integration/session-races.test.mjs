import {test} from 'node:test';import assert from 'node:assert/strict';
import {optionalModule} from '../support/foundation.mjs';import {createFixedClock} from '../../src/platform/clock.js';import {createInputFrame} from '../../src/contracts/vehicle.js';import {createEventChannel} from '../../src/contracts/events.js';
const hostModule=await optionalModule('src/app/session-host.js'),scopeModule=await optionalModule('src/platform/resource-scope.js'),loaderModule=await optionalModule('src/app/mode-loader.js');
function api(m,key){assert.equal(typeof m[key],'function',`T05 requires ${key}`);return m[key];}
const turn=()=>new Promise(setImmediate);function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
function harness(overrides={}){
 const frames=new Map(),metrics={created:{driving:0,simulation:0},started:0,disposed:0,active:0,max:0,steps:0,renders:0,inputClears:0},changes=[];let id=0;
 const module=mode=>({async createMode(context){metrics.created[mode]++;let status='READY',disposed=false;return{
 start(){status='RUNNING';metrics.started++;metrics.active++;metrics.max=Math.max(metrics.max,metrics.active);},pause(){status='PAUSED';},resume(){status='RUNNING';},reset(){metrics.steps=0;},
 step(){if(overrides.stepError)throw Error('step failed');metrics.steps++;},snapshot(){return{mode,status,vehicle:{position:{x:0,y:0,z:0},rotation:{x:0,y:0,z:0,w:1},velocity:{x:0,y:0,z:0}}};},dispose(){if(disposed)return;disposed=true;metrics.disposed++;if(status!=='READY')metrics.active--;status='DISPOSED';}
 };}});
 const prepare=async(_module,{abortSignal,sessionId})=>({sessionId,abortSignal,clock:createFixedClock(),events:createEventChannel(sessionId),settings:{read:()=>({fps:60}),write(){}},input:{sample:()=>createInputFrame(),clear(){metrics.inputClears++;},dispose(){}},world:{step(){},query:()=>({}),reset(){},dispose(){}},renderer:{render(){metrics.renders++;},resize(){},dispose(){}},audio:{pause(){},resume(){},dispose(){}}});
 const host=api(hostModule,'createSessionHost')({loadMode:overrides.loadMode??(async mode=>module(mode)),prepare:overrides.prepare??prepare,requestFrame:callback=>{frames.set(++id,callback);return id;},cancelFrame:frame=>frames.delete(frame),onChange:state=>changes.push(state)});
 return{host,metrics,frames,changes,module,prepare,flush(time){const pending=[...frames.values()];frames.clear();for(const callback of pending)callback(time);}};
}
test('latest_selection_wins',async()=>{
 const slow=deferred();const h=harness({loadMode:mode=>mode==='driving'?slow.promise:Promise.resolve(h.module(mode))});
 const first=h.host.selectMode('driving');await turn();await h.host.selectMode('simulation');assert.equal(h.host.snapshot().mode,'simulation');assert.equal(h.host.snapshot().state,'RUNNING');
 slow.resolve(h.module('driving'));await first;await turn();assert.equal(h.metrics.created.driving,0);assert.equal(h.metrics.max,1);assert.equal(h.frames.size,1);await h.host.leaveMode();assert.equal(h.frames.size,0);
});
test('leave_during_load_disposes_late_result',async()=>{
 const late=deferred();let lateDisposed=0,lateStarted=0;const h=harness({loadMode:async()=>({createMode:()=>late.promise})});
 const opening=h.host.selectMode('driving');await turn();await h.host.leaveMode();assert.equal(h.host.snapshot().state,'HOME');assert.equal(h.frames.size,0);
 late.resolve({start(){lateStarted++;},pause(){},resume(){},step(){},snapshot:()=>({}),dispose(){lateDisposed++;}});await opening;await turn();assert.equal(lateStarted,0);assert.equal(lateDisposed,1);assert.equal(h.host.snapshot().activeSession,0);
});
test('leave_during_prepare_disposes_late_context',async()=>{
 const late=deferred();let disposed=0;const h=harness({prepare:()=>late.promise});const opening=h.host.selectMode('driving');await turn();await h.host.leaveMode();
 const c=await h.prepare(null,{abortSignal:new AbortController().signal,sessionId:'late'});c.renderer.dispose=()=>disposed++;late.resolve(c);await opening;await turn();assert.equal(disposed,1);assert.equal(h.metrics.created.driving,0);
});
test('host_owns_one_loop_and_pause_resume_excludes_hidden_time',async()=>{
 const h=harness();await h.host.selectMode('driving');h.flush(1000);h.flush(1000+1000/60);assert.equal(h.metrics.steps,2);assert.equal(h.frames.size,1);
 h.host.pause('hidden');assert.equal(h.frames.size,0);assert.equal(h.host.snapshot().state,'PAUSED');h.host.resume();h.flush(60000);assert.equal(h.metrics.steps,2);h.flush(60000+1000/60);assert.equal(h.metrics.steps,4);
 h.host.reset();assert.equal(h.metrics.steps,0);await h.host.leaveMode();assert.equal(h.metrics.disposed,1);assert.equal(h.host.snapshot().activeSession,0);assert.equal(h.frames.size,0);
});
test('startup_failure_and_retry_do_not_retain_session_or_loop',async()=>{
 let fail=true;const h=harness({loadMode:async mode=>fail?{createMode(){throw Error('start failed');}}:h.module(mode)});await h.host.selectMode('driving');assert.equal(h.host.snapshot().state,'ERROR');assert.match(h.host.snapshot().error,/start failed/);assert.equal(h.frames.size,0);
 fail=false;await h.host.selectMode('driving');assert.equal(h.host.snapshot().state,'RUNNING');assert.equal(h.frames.size,1);await h.host.dispose();assert.equal(h.frames.size,0);
});
test('frame_failure_clears_input_and_releases_resources',async()=>{
 const h=harness({stepError:true});await h.host.selectMode('simulation');h.flush(1000);h.flush(1020);await turn();assert.equal(h.host.snapshot().state,'ERROR');assert.equal(h.frames.size,0);assert.equal(h.metrics.active,0);assert(h.metrics.inputClears>0);
});
test('resource_scope_is_idempotent_continues_cleanup_and_handles_late_owners',async()=>{
 const scope=api(scopeModule,'createResourceScope')();const released=[];scope.own({dispose(){released.push('one');}});scope.own({dispose(){released.push('bad');throw Error('release failed');}});scope.own({async dispose(){released.push('two');}});
 await scope.dispose();await scope.dispose();assert.deepEqual(released,['two','bad','one']);scope.own({dispose(){released.push('late');}});await scope.dispose();assert.equal(released.filter(v=>v==='late').length,1);assert.equal(scope.snapshot().resources,0);assert.match(scope.snapshot().errors.join(' '),/release failed/);
});
test('unknown_mode_is_rejected_without_fetch_or_destroying_current_session',async()=>{
 const h=harness();await h.host.selectMode('driving');await assert.rejects(()=>h.host.selectMode('https://invalid.test/code.js'),/mode/i);assert.equal(h.host.snapshot().mode,'driving');await h.host.leaveMode();
 await assert.rejects(()=>api(loaderModule,'loadMode')('https://invalid.test/code.js'),/mode/i);
});
