import { record, finite, identifier, readonlyCopy } from '../../../contracts/validation.js';

const parameter=(value,unit,min,max,source='T04 estimated demonstrator; uncalibrated')=>({value,unit,min,max,origin:'estimated',source,version:'1.0.0'});
export const DEMO_CAR=readonlyCopy({
  id:'estimated-demo-car',version:'1.0.0',label:'推定デモ車・直線の最小モデル（実車未検証）',
  parameters:{
    mass:parameter(1500,'kg',1,100000),maxDriveForce:parameter(4500,'N',0,1000000),
    maxBrakeForce:parameter(9000,'N',0,1000000),dragCoefficient:parameter(0.30,'1',0,3),
    frontalArea:parameter(2.2,'m²',0,100),rollingCoefficient:parameter(0.012,'1',0,1),
    airDensity:parameter(1.225,'kg/m³',0,10),
    gravity:{...parameter(9.80665,'m/s²',0,30),origin:'reference',source:'BIPM SI Brochure: conventional standard acceleration of free fall; flat road normal balances gravity'}
  }
});

export function validateConfig(config=DEMO_CAR){
  record(config,'config');identifier(config.id,'config.id');identifier(config.version,'config.version');identifier(config.label,'config.label');record(config.parameters,'parameters');
  for(const [name,expected]of Object.entries(DEMO_CAR.parameters)){
    const p=config.parameters[name];record(p,name);
    finite(p.min,`${name}.min`);finite(p.max,`${name}.max`,p.min);
    finite(p.value,name,Math.max(expected.min,p.min),Math.min(expected.max,p.max));
    if(p.unit!==expected.unit)throw new TypeError(`${name}.unit must be ${expected.unit}`);
    if(!['estimated','reference','measured'].includes(p.origin))throw new TypeError(`${name}.origin is invalid`);
    identifier(p.source,`${name}.source`);identifier(p.version,`${name}.version`);
  }
  for(const name of Object.keys(config.parameters))if(!Object.hasOwn(DEMO_CAR.parameters,name))throw new TypeError(`Unknown parameter ${name}`);
  return readonlyCopy(config,'config');
}
