import { finite, record } from '../../../contracts/validation.js';

export function vector(value,label){
  record(value,label);return Object.fromEntries(['x','y','z'].map(axis=>[axis,finite(value[axis],`${label}.${axis}`)]));
}
const zero=()=>({x:0,y:0,z:0});

/** Newtons only. Resistance cannot drive a resting body or overshoot its velocity. */
export function calculateForces(parameters,velocity,rotation,input,environment,dt){
  record(environment,'environment');
  const external=environment.externalForce===undefined?zero():vector(environment.externalForce,'externalForce');
  const p=Object.fromEntries(Object.entries(parameters).map(([key,item])=>[key,item.value]));
  const q=rotation;
  const driveMagnitude=p.maxDriveForce*(input.throttle-(input.reverseThrottle??0));
  // Rotate local forward (0,0,-1) by the fixed initial unit quaternion.
  const drive={x:-2*(q.x*q.z+q.w*q.y)*driveMagnitude,y:-2*(q.y*q.z-q.w*q.x)*driveMagnitude,z:-(1-2*(q.x*q.x+q.y*q.y))*driveMagnitude};
  const speed=Math.hypot(velocity.x,velocity.y,velocity.z),horizontal=Math.hypot(velocity.x,velocity.z);
  const drag=zero(),rolling=zero(),brake=zero();
  for(const axis of ['x','y','z'])drag[axis]=(-0.5*p.airDensity*p.dragCoefficient*p.frontalArea*speed*velocity[axis])||0;
  if(horizontal>0)for(const axis of ['x','z']){
    rolling[axis]=-velocity[axis]/horizontal*p.mass*p.gravity*p.rollingCoefficient;
    brake[axis]=-velocity[axis]/horizontal*p.maxBrakeForce*input.brake;
  }
  const horizontalResistance=Math.hypot(drag.x+rolling.x+brake.x,drag.z+rolling.z+brake.z);
  if(horizontalResistance>0){
    const scale=Math.min(1,p.mass*horizontal/dt/horizontalResistance);
    for(const force of [drag,rolling,brake])for(const axis of ['x','z'])force[axis]*=scale;
  }
  if(drag.y!==0)drag.y*=Math.min(1,p.mass*Math.abs(velocity.y)/dt/Math.abs(drag.y));
  const total=zero();for(const axis of ['x','y','z'])total[axis]=finite(drive[axis]+drag[axis]+rolling[axis]+brake[axis]+external[axis],`forces.total.${axis}`);
  return {drive,drag,rolling,brake,external,total};
}
