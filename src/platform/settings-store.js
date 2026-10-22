import {record,keysOnly,finite,boolean,readonlyCopy} from '../contracts/validation.js';
import {DEVICE_PROFILES} from './device-profile.js';
export const KEY_LABELS=Object.freeze({throttle:'前進',brake:'制動',reverseThrottle:'後退',left:'左',right:'右',camera:'視点',boost:'ロケット',hover:'浮上',kickflip:'ジャンプ'});
export const KEY_CODES=Object.freeze([...Array.from({length:26},(_,i)=>'Key'+String.fromCharCode(65+i)),'ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','ShiftLeft','ShiftRight']);
const common=[
 {key:'quality',label:'画質',type:'select',default:'balanced',options:[['low','低'],['balanced','標準'],['high','高']]},
 {key:'fps',label:'描画頻度',type:'select',default:60,options:[[30,'30fps'],[60,'60fps']]},
 {key:'volume',label:'音量',type:'number',default:0.5,min:0,max:1,step:0.1},
 {key:'viewpoint',label:'視点',type:'select',default:'chase',options:[['chase','車外'],['cockpit','運転席']]},
 {key:'reducedMotion',label:'揺れ・動きを軽減',type:'checkbox',default:false},
 {key:'speedUnit',label:'速度の単位',type:'select',default:'kmh',options:[['kmh','km/h'],['mph','mph']]},
 {key:'uiScale',label:'表示サイズ',type:'number',default:1,min:1,max:2,step:0.1}
];
const touch=[
 {key:'sensitivityX',label:'左右のスワイプ感度',type:'number',default:1,min:0.25,max:3,step:0.05},
 {key:'sensitivityY',label:'前後のスワイプ感度',type:'number',default:1,min:0.25,max:3,step:0.05},
 {key:'deadZone',label:'無反応範囲 (CSS px)',type:'number',default:10,min:0,max:30,step:1},
 {key:'maxDistance',label:'最大入力までの移動距離 (CSS px)',type:'number',default:88,min:32,max:200,step:1},
 {key:'guideVisible',label:'操作位置ガイドを表示',type:'checkbox',default:true},
 {key:'alternativeControls',label:'代替の明示操作を表示',type:'checkbox',default:false}
];
const desktop=[{key:'mouseSensitivity',label:'マウス感度',type:'number',default:1,min:0.1,max:3,step:0.1},{key:'dragView',label:'マウスドラッグで視点を動かす',type:'checkbox',default:true}];
function pair(profile,mode){if(!DEVICE_PROFILES.includes(profile)||!['driving','simulation'].includes(mode))throw new TypeError('Invalid settings profile or mode');}
export function settingsFields(profile,mode){pair(profile,mode);return readonlyCopy([...common,...(profile!=='desktop'?touch:[]),...(profile!=='touch'?desktop:[])]);}
function defaultKeys(mode){return{throttle:'KeyW',brake:'KeyS',reverseThrottle:'KeyR',left:'KeyA',right:'KeyD',camera:'KeyC',...(mode==='driving'?{boost:'Space',hover:'KeyH',kickflip:'KeyF'}:{})};}
export function defaultSettings(profile,mode){const fields=settingsFields(profile,mode);return readonlyCopy({...Object.fromEntries(fields.map(f=>[f.key,f.default])),...(profile!=='touch'?{keys:defaultKeys(mode)}:{})});}
function validate(profile,mode,value){
 record(value,'settings');const fields=settingsFields(profile,mode);keysOnly(value,[...fields.map(f=>f.key),...(profile!=='touch'?['keys']:[])],'settings');
 for(const f of fields){const v=value[f.key];if(f.type==='checkbox')boolean(v,f.key);else if(f.type==='number')finite(v,f.key,f.min,f.max);else if(!f.options.some(([allowed])=>allowed===v))throw new TypeError('Invalid '+f.key);}
 if(profile!=='desktop'&&value.maxDistance<=value.deadZone)throw new TypeError('maxDistance must exceed deadZone');
 if(profile!=='touch'){
  record(value.keys,'keys');const actions=Object.keys(defaultKeys(mode));keysOnly(value.keys,actions,'keys');const used=new Set();
  for(const action of actions){const code=value.keys[action];if(!KEY_CODES.includes(code)||used.has(code))throw new TypeError('Invalid or duplicate key: '+action);used.add(code);}
 }
 return readonlyCopy(value,'settings');
}
/** Only six named settings records; storage exceptions fall back to isolated memory. */
export function createSettingsStore(storage){
 const cache=new Map();let persistent=!!storage,message=storage?'':'この端末へ保存できません。今回の設定はメモリに保持します。';
 const key=(profile,mode)=>{pair(profile,mode);return`hashirase:settings:v1:${profile}:${mode}`;};
 const failed=()=>{persistent=false;message='この端末へ保存できません。今回の設定はメモリに保持します。';};
 function read(profile,mode){
  const id=key(profile,mode);if(cache.has(id))return cache.get(id);let value=defaultSettings(profile,mode);
  try{const raw=storage?.getItem(id);if(raw!==null&&raw!==undefined){if(typeof raw!=='string'||raw.length>16384)throw Error('settings length');const payload=JSON.parse(raw);record(payload,'saved settings');keysOnly(payload,['schemaVersion','values'],'saved settings');if(payload.schemaVersion!==1)throw Error('settings version');record(payload.values,'values');value=validate(profile,mode,{...value,...payload.values});}}
  catch(error){if(error instanceof SyntaxError||error instanceof TypeError||String(error).includes('settings'))message='保存した設定を読み取れないため、この設定だけ初期値を使います。';else failed();}
  cache.set(id,value);return value;
 }
 return Object.freeze({read,
  write(profile,mode,patch){record(patch,'settings patch');const id=key(profile,mode),value=validate(profile,mode,{...read(profile,mode),...patch});cache.set(id,value);try{if(!storage)throw Error('unavailable');storage.setItem(id,JSON.stringify({schemaVersion:1,values:value}));}catch{failed();}return value;},
  reset(profile,mode){const id=key(profile,mode);cache.set(id,defaultSettings(profile,mode));try{if(!storage)throw Error('unavailable');storage.removeItem(id);}catch{failed();}return cache.get(id);},
  status(){return readonlyCopy({persistent,message});}
 });
}
