import { assertModeContext } from '../../contracts/session.js';
import { finite, readonlyCopy } from '../../contracts/validation.js';
import { assertInputFrame, createInputFrame } from '../../contracts/vehicle.js';
import { createVehicleModel } from './physics/vehicle-model.js';

/** Owns only this model and its injected services. The application owns all time advancement. */
export async function createMode(context,options={}){
  assertModeContext(context);const signal=context.abortSignal;
  const abortError=()=>new DOMException('Simulation creation aborted','AbortError');
  let model,world,renderer,status='READY',pauseReason=null,lastVehicle,initializing=true;
  const errors=[],released=new Set(),owned=new Set([context.input,context.audio,context.events]);
  for(const service of [context.world,context.renderer])if(typeof service!=='function')owned.add(service);
  const note=error=>errors.push(String(error));
  function release(service){if(!service||released.has(service))return;released.add(service);try{service.dispose?.()?.catch?.(note);}catch(error){note(error);}}
  function snapshot(){return readonlyCopy({mode:'simulation',sessionId:context.sessionId,status,pauseReason,vehicle:model?.snapshot()??lastVehicle,cleanupErrors:errors});}
  function dispose(){
    if(status==='DISPOSED')return;
    try{if(model)lastVehicle=model.snapshot();}catch(error){note(error);}
    status='DISPOSED';pauseReason=null;
    signal.removeEventListener('abort',dispose);try{context.input.clear();}catch(error){note(error);}
    for(const service of owned)release(service);
    owned.clear();model=null;world=null;renderer=null;if(!initializing)released.clear();
  }
  function live(){if(status==='DISPOSED')throw new Error('Simulation session disposed');}
  function accept(service){if(status==='DISPOSED'||signal.aborted){release(service);throw abortError();}owned.add(service);return service;}
  signal.addEventListener('abort',dispose,{once:true});
  try{
    if(signal.aborted)throw abortError();
    model=createVehicleModel(options.config);if(options.initial)model.reset(options.initial);
    world=accept(typeof context.world==='function'?await context.world():context.world);
    renderer=accept(typeof context.renderer==='function'?await context.renderer():context.renderer);
    const session=Object.freeze({
      start(){live();if(status==='READY')status='RUNNING';},
      pause(reason='manual'){live();if(status==='RUNNING'){status='PAUSED';pauseReason=reason;context.input.clear();context.audio.pause?.();}},
      resume(){live();if(status==='PAUSED'){status='RUNNING';pauseReason=null;context.audio.resume?.();}},
      step(dt,input=createInputFrame()){live();finite(dt,'dt',Number.MIN_VALUE);assertInputFrame(input);if(status!=='RUNNING')return;world.step(dt);model.step(dt,input,world.query(model.snapshot().position));},
      reset(initial={}){live();model.reset(initial);context.input.clear();world.reset(options.seed??0);},snapshot,dispose
    });
    return session;
  }catch(error){dispose();throw error;}finally{initializing=false;if(status==='DISPOSED')released.clear();}
}
