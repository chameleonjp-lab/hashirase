import { assertModeContext } from '../../contracts/session.js';
import { finite, readonlyCopy } from '../../contracts/validation.js';
import { assertInputFrame, createInputFrame } from '../../contracts/vehicle.js';
import { createCarState, createPursuitState, createTimeAttackState, resetCarState, drivingSnapshot, DRIVING_TRIMS } from './state.js';
import { stepVehicleState, createRampProfile, legacyInput, beginKickflip } from './physics.js';
import { createDrivingRules } from './rules.js';
import { createLegacyEngine } from './legacy-adapter.js';

function numericalBackend(options) {
  const course=options.course||'PROVING_GROUND';
  const origin=course==='NYC'?{position:{x:0,y:0,z:0}}:{};
  const car=createCarState(options.initial??origin),pursuit=createPursuitState(),timeAttack=createTimeAttackState(),ramp=createRampProfile();
  const rules=createDrivingRules(car,pursuit,timeAttack);let trim=DRIVING_TRIMS[options.trim||'ROCKET'],previousKick=false,rcsSpin=false;
  if(!trim)throw new TypeError('Unknown driving trim');
  if(!['PROVING_GROUND','NYC'].includes(course))throw new TypeError('Unknown driving course');
  return {
    step(dt,frame=createInputFrame(),environment={}) {
      if(pursuit.gameOver)return;
      if(frame.kickflip&&!previousKick)beginKickflip(car,ramp.point);previousKick=frame.kickflip;
      const effects=stepVehicleState(car,dt,{...legacyInput(frame),rcsSpin},{...environment,trim,course,rampPoint:ramp.point});
      if(effects.trim)trim=DRIVING_TRIMS[effects.trim];rules.step(dt,environment);
    },
    snapshot(metadata){return drivingSnapshot(car,pursuit,timeAttack,{...metadata,course,trim:trim.id,score:car.score});},
    reset(initial=origin){resetCarState(car,initial);Object.assign(pursuit,createPursuitState());Object.assign(timeAttack,createTimeAttackState());rules.reset();previousKick=false;rcsSpin=false;},
    action(name,active){if(name==='rcsSpin')rcsSpin=active;},pause(){rcsSpin=false;},dispose(){rcsSpin=false;}
  };
}

/** Owns one game's state; the app alone advances time and draws frames. */
export async function createMode(context,options={}) {
  assertModeContext(context);
  const signal=context.abortSignal;
  const abortError=()=>new DOMException('Driving session creation aborted','AbortError');
  if(signal.aborted)throw abortError();
  if(options.trim!==undefined&&!Object.hasOwn(DRIVING_TRIMS,options.trim))throw new TypeError('Unknown driving trim');
  if(options.course!==undefined&&!['PROVING_GROUND','NYC'].includes(options.course))throw new TypeError('Unknown driving course');
  if(options.initial?.position)for(const key of ['x','y','z'])finite(options.initial.position[key],'position.'+key);
  let world,renderer,backend,status='READY',pauseReason=null,lastSnapshot;
  const disposed=new Set(),cleanupErrors=[];
  function cleanupError(error){cleanupErrors.push(String(error));}
  function release(service){if(service&&!disposed.has(service)){disposed.add(service);try{const result=service.dispose?.();result?.catch?.(cleanupError);}catch(error){cleanupError(error);}}}
  function metadata(){return {mode:'driving',sessionId:context.sessionId,status,pauseReason,cleanupErrors};}
  function snapshot(){return backend?backend.snapshot(metadata()):lastSnapshot&&readonlyCopy({...lastSnapshot,cleanupErrors});}
  function dispose(){
    if(status==='DISPOSED')return;
    status='DISPOSED';pauseReason=null;
    try{context.input.clear();}catch(error){cleanupError(error);}
    try{lastSnapshot=snapshot();}catch(error){cleanupError(error);}
    signal.removeEventListener('abort',dispose);
    for(const service of [backend,renderer,world,context.input,context.audio,context.events])release(service);
    backend=null;renderer=null;world=null;disposed.clear();
  }
  function live(){if(status==='DISPOSED')throw new Error('Driving session disposed');}
  try {
    world=typeof context.world==='function'?await context.world():context.world;
    if(signal.aborted)throw abortError();
    renderer=typeof context.renderer==='function'?await context.renderer():context.renderer;
    if(signal.aborted)throw abortError();
    backend=renderer.legacySurface?await createLegacyEngine(renderer.legacySurface,context,options):numericalBackend(options);
    if(signal.aborted)throw abortError();
    renderer.attachLegacy?.(backend);
    const session=Object.freeze({
      start(){live();if(status==='READY'){status='RUNNING';renderer?.setEnabled?.(true);}},
      pause(reason='manual'){live();if(status==='RUNNING'){status='PAUSED';pauseReason=reason;context.input.clear();backend.pause();renderer?.setEnabled?.(false);context.audio.pause?.();}},
      resume(){live();if(status==='PAUSED'){status='RUNNING';pauseReason=null;renderer?.setEnabled?.(true);context.audio.resume?.();}},
      step(dt,input){live();finite(dt,'dt',Number.MIN_VALUE);if(input!==undefined)assertInputFrame(input);if(status!=='RUNNING')return;world.step(dt);backend.step(dt,input,world.query(snapshot().vehicle.position));},
      snapshot,
      action(name,active){live();if(name!=='rcsSpin'||typeof active!=='boolean')throw new TypeError('Invalid driving action');backend.action?.(name,active);},
      reset(initial){live();if(initial?.position)for(const key of ['x','y','z'])finite(initial.position[key],'position.'+key);context.input.clear();backend.reset(initial);world.reset(options.seed??0x48415348);},
      dispose
    });
    signal.addEventListener('abort',dispose,{once:true});return session;
  } catch(error){dispose();throw error;}
}
