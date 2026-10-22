import {assertModeContext,assertModeSession} from '../contracts/session.js';
import {finite,readonlyCopy} from '../contracts/validation.js';
import {createResourceScope} from '../platform/resource-scope.js';

const modes=['driving','simulation'];
const aborted=()=>new DOMException('Mode selection cancelled','AbortError');
function abortable(promise,signal){return new Promise((resolve,reject)=>{
 const cancel=()=>{signal.removeEventListener('abort',cancel);reject(aborted());};
 if(signal.aborted){Promise.resolve(promise).catch(()=>{});reject(aborted());return;}
 signal.addEventListener('abort',cancel,{once:true});Promise.resolve(promise).then(value=>{signal.removeEventListener('abort',cancel);resolve(value);},error=>{signal.removeEventListener('abort',cancel);reject(error);});
});}
function signedSpeed(snapshot){const v=snapshot?.vehicle?.velocity,q=snapshot?.vehicle?.rotation;if(!v||!q)return 0;const x=-2*(q.x*q.z+q.w*q.y),z=-(1-2*(q.x*q.x+q.y*q.y)),length=Math.hypot(x,z);return length>1e-9?(v.x*x+v.z*z)/length:0;}

/** One host owns time and RAF. A cancelled import/factory is never allowed to start. */
export function createSessionHost({loadMode,prepare,requestFrame=callback=>globalThis.requestAnimationFrame(callback),cancelFrame=id=>globalThis.cancelAnimationFrame(id),onChange=()=>{},countCanvases=()=>0,loadTimeoutMs=15000}={}){
 if(typeof loadMode!=='function'||typeof prepare!=='function')throw new TypeError('Host requires loadMode and prepare');
 finite(loadTimeoutMs,'loadTimeoutMs',0);
 let generation=0,current=null,state='HOME',error=null,disposed=false,maxActiveSession=0,maxCanvas=0;
 const liveSessions=new Set(),frames=new Set(),initialized={driving:0,simulation:0},cleanupErrors=[];
 function snapshot(){maxCanvas=Math.max(maxCanvas,countCanvases());return readonlyCopy({state,mode:current?.mode??null,error,pauseReason:current?.context?.clock.snapshot().pauseReason??null,activeSession:liveSessions.size,activeRAF:frames.size,maxActiveSession,maxCanvas,initialized,cleanupErrors,generation});}
 function emit(){onChange(snapshot());}
 function cancelLoop(record){if(record?.frame!==null&&record?.frame!==undefined){cancelFrame(record.frame);frames.delete(record.frame);record.frame=null;}}
 function adopt(context,scope){for(const key of ['input','world','renderer','audio','events'])if(context[key]&&typeof context[key]!=='function'&&typeof context[key].dispose==='function')scope.own(context[key]);return context;}
 function teardown(record){
  if(!record)return Promise.resolve();if(record.teardown)return record.teardown;
  record.controller.abort();cancelLoop(record);
  try{record.context?.input.clear();record.context?.input.setEnabled?.(false);record.context?.clock.pause('leave');}catch(e){cleanupErrors.push(String(e));}
  record.teardown=record.scope.dispose().then(()=>{cleanupErrors.push(...record.scope.snapshot().errors);record.session=null;record.context=null;});return record.teardown;
 }
 function valid(record){return current===record&&!record.controller.signal.aborted&&!disposed;}
 async function fail(record,cause){if(!valid(record))return;state='ERROR';error=String(cause?.message??cause);await teardown(record);if(current===record)emit();}
 function schedule(record){if(!valid(record)||state!=='RUNNING'||record.frame!==null)return;record.frame=requestFrame(now=>frame(record,now));frames.add(record.frame);}
 function frame(record,now){
  frames.delete(record.frame);record.frame=null;if(!valid(record)||state!=='RUNNING')return;
  try{
   finite(now,'frame time',0);const elapsed=record.lastTime===null?0:(now-record.lastTime)/1000;record.lastTime=now;
   const clock=record.context.clock.advance(elapsed,dt=>record.session.step(dt,record.context.input.sample({dt,longitudinalSpeed:signedSpeed(record.session.snapshot())})));
   if(!clock.valid){pause('overload');return;}
   const view=record.session.snapshot(),finished=view.pursuit?.gameOver||view.timeAttack?.finished;
   const fps=record.context.settings.read?.()?.fps??60;
   if(finished||record.lastRender===null||now-record.lastRender>=1000/fps-0.01){record.context.renderer.render(view,clock.alpha);record.lastRender=now;}
   if(finished){record.context.input.clear();record.context.input.setEnabled?.(false);record.context.clock.pause('result');record.session.pause('result');state='RESULT';emit();return;}
   maxCanvas=Math.max(maxCanvas,countCanvases());schedule(record);
  }catch(cause){void fail(record,cause);}
 }
 function pause(reason='manual'){
  const record=current;if(record&&state==='LOADING'){record.pendingPause=reason;return;}if(!record?.session||state!=='RUNNING')return;
  cancelLoop(record);record.context.input.clear();record.context.input.setEnabled?.(false);record.context.clock.pause(reason);record.session.pause(reason);state='PAUSED';emit();
 }
 async function selectMode(mode){
  if(!modes.includes(mode))throw new TypeError('Unknown mode');if(disposed)throw new Error('Session host disposed');
  const previous=current,record={mode,generation:++generation,controller:new AbortController(),scope:createResourceScope(),context:null,session:null,frame:null,lastTime:null,lastRender:null,teardown:null};current=record;state='LOADING';error=null;emit();
  await teardown(previous);if(!valid(record))return;
  let timer;if(loadTimeoutMs>0){timer=setTimeout(()=>void fail(record,new Error('読み込みが時間内に完了しませんでした。再試行してください。')),loadTimeoutMs);record.scope.own(()=>clearTimeout(timer));}
  try{
   const module=await abortable(loadMode(mode),record.controller.signal);if(!valid(record))return;
   const contextPromise=Promise.resolve(prepare(module,{mode,abortSignal:record.controller.signal,sessionId:`${mode}-${record.generation}`,scope:record.scope})).then(context=>adopt(context,record.scope));
   const context=await abortable(contextPromise,record.controller.signal);if(!valid(record))return;assertModeContext(context);record.context=context;context.input.setEnabled?.(false);
   initialized[mode]++;
   const sessionPromise=Promise.resolve(module.createMode(context,{legacyControls:false})).then(session=>{record.scope.own(session);return session;});
   const session=await abortable(sessionPromise,record.controller.signal);if(!valid(record))return;assertModeSession(session);record.session=session;
   clearTimeout(timer);state='READY';emit();if(!valid(record))return;
   record.scope.own(()=>liveSessions.delete(session));liveSessions.add(session);maxActiveSession=Math.max(maxActiveSession,liveSessions.size);
   context.clock.reset();session.start();context.input.setEnabled?.(true);state='RUNNING';if(record.pendingPause)pause(record.pendingPause);else{emit();schedule(record);}
  }catch(cause){if(valid(record))await fail(record,cause);}
 }
 async function leaveMode(){const record=current,currentGeneration=++generation;current=null;state='DISPOSING';error=null;emit();await teardown(record);if(generation===currentGeneration){state='HOME';emit();}}
 return Object.freeze({selectMode,leaveMode,pause,
  action(name,active){if(current?.session&&valid(current)&&(state==='RUNNING'||!active))current.session.action?.(name,active);},
  reportError(cause){if(current)void fail(current,cause);},
  resume(){const record=current;if(!record?.session||state!=='PAUSED')return;try{record.context.clock.resume();record.session.resume();record.context.input.setEnabled?.(true);record.lastTime=record.lastRender=null;state='RUNNING';emit();schedule(record);}catch(cause){void fail(record,cause);}},
  reset(){const record=current;if(!record?.session)return;record.context.input.clear();record.session.reset?.();record.context.clock.reset();record.lastTime=record.lastRender=null;if(state==='RESULT')state='PAUSED';if(state==='PAUSED')record.context.clock.pause('manual');record.context.renderer.render(record.session.snapshot(),0);emit();},
  snapshot,async dispose(){if(disposed)return;await leaveMode();disposed=true;}
 });
}
