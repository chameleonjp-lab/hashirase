import {readFile,writeFile} from 'node:fs/promises';import {fileURLToPath} from 'node:url';import {resolve} from 'node:path';
import postcss from 'postcss';import tailwindcss from 'tailwindcss';
const defaultRoot=fileURLToPath(new URL('../',import.meta.url)),scope='[data-mode-screen="driving"]';
export async function buildDrivingStyle({rootDir=defaultRoot,write=true,check=false}={}){
 const utility=(await postcss([tailwindcss({content:[resolve(rootDir,'src/assets/driving/screen.html'),resolve(rootDir,'src/runtime/*.js')],corePlugins:{preflight:false}})]).process('@tailwind utilities;',{from:undefined})).css;
 const legacy=await readFile(resolve(rootDir,'assets/css/simulator.css'),'utf8'),bridge=await readFile(resolve(rootDir,'src/assets/driving/bridge.css'),'utf8');
 const parsed=postcss.parse(legacy+'\n'+utility+'\n'+bridge);
 parsed.walkRules(rule=>{
  if(rule.parent.type==='atrule'&&/keyframes$/.test(rule.parent.name))return;
  const original=postcss.list.comma(rule.selector);rule.selector=original.map(selector=>['html','body',':root'].includes(selector)?scope:scope+' '+selector).join(', ');
  if(original.some(s=>['html','body'].includes(s)))rule.walkDecls('touch-action',d=>{d.value='auto';});
  rule.walkDecls('font-size',d=>{if(/^\d+(?:\.\d+)?px$/.test(d.value))d.value=`calc(${d.value} * var(--hashirase-ui-scale, 1))`;});
 });
 const css='/* Generated local game styles; edit legacy/bridge sources and run npm run build. */\n'+parsed.toString()+'\n',path=resolve(rootDir,'src/assets/driving/screen.css');
 if(check&&await readFile(path,'utf8')!==css)throw new Error('Driving styles are outdated; run npm run build');
 if(write)await writeFile(path,css);return css;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await buildDrivingStyle();
