import { finite, keysOnly, record, readonlyCopy } from '../../../contracts/validation.js';
import { assertInputFrame, createVehicleSnapshot } from '../../../contracts/vehicle.js';
import { validateConfig } from '../config/demo-car.js';
import { calculateForces, vector } from './forces.js';

const zero=()=>({x:0,y:0,z:0});
/** Three translations, no rotation/tyre/contact simulation. Flat-road straight-line foundation. */
export function createVehicleModel(config){
  const settings=validateConfig(config),mass=settings.parameters.mass.value;
  let position,velocity,rotation,time,acceleration,forces;
  function reset(initial={}){
    record(initial,'initial');keysOnly(initial,['position','velocity','rotation'],'initial');
    const nextPosition=vector(initial.position??zero(),'position'),nextVelocity=vector(initial.velocity??zero(),'velocity');
    const nextRotation=initial.rotation??{x:0,y:0,z:0,w:1};
    // Validate the full initial state before changing the existing model.
    const validated=createVehicleSnapshot({position:nextPosition,velocity:nextVelocity,rotation:nextRotation,angularVelocity:zero(),wheels:[null,null,null,null],damage:{},telemetry:{}});
    position={...validated.position};velocity={...validated.velocity};rotation=validated.rotation;time=0;acceleration=zero();
    forces={drive:zero(),drag:zero(),rolling:zero(),brake:zero(),external:zero(),total:zero()};
  }
  reset();
  return Object.freeze({
    reset,
    step(dt,input,environment={}){
      finite(dt,'dt',Number.MIN_VALUE);assertInputFrame(input);
      const nextForces=calculateForces(settings.parameters,velocity,rotation,input,environment,dt);
      const nextPosition=zero(),nextVelocity=zero(),nextAcceleration=zero();
      for(const axis of ['x','y','z']){
        const a=finite(nextForces.total[axis]/mass,`acceleration.${axis}`);
        nextAcceleration[axis]=a;nextVelocity[axis]=finite(velocity[axis]+a*dt,`velocity.${axis}`);
        nextPosition[axis]=finite(position[axis]+velocity[axis]*dt+0.5*a*dt*dt,`position.${axis}`);
        if(nextVelocity[axis]===0)nextVelocity[axis]=0;
      }
      const nextTime=finite(time+dt,'time');
      position=nextPosition;velocity=nextVelocity;acceleration=nextAcceleration;forces=nextForces;time=nextTime;
    },
    snapshot(){return createVehicleSnapshot({position,velocity,rotation,angularVelocity:zero(),wheels:[null,null,null,null],damage:{},telemetry:{
      model:'T04-three-translations',rotationModel:'not-modelled',roadModel:'flat-normal-balances-gravity',
      label:settings.label,configId:settings.id,configVersion:settings.version,parameters:settings.parameters,
      mass,time,acceleration,forces,speed:Math.hypot(velocity.x,velocity.y,velocity.z)
    }});}
  });
}
