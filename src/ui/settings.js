import {settingsFields,KEY_LABELS,KEY_CODES} from '../platform/settings-store.js';import {listenerScope} from './listeners.js';
export function mountSettings(container,{store,profile,mode,input,hiddenSettings=[],onApply=()=>{},onClose=()=>{},onOpen=()=>{},onProfileChange=()=>{}}){
 const document=container.ownerDocument,dialog=document.createElement('dialog'),scope=listenerScope();dialog.className='settings-dialog';dialog.dataset.noDrive='';dialog.setAttribute('aria-label','操作と表示の設定');container.append(dialog);
 const form=document.createElement('form');form.method='dialog';dialog.append(form);let restoreFocus=null,disposed=false,opened=false;const controls=new Map();
 const title=document.createElement('h2');title.textContent='操作と表示の設定';form.append(title);
 const context=document.createElement('p');context.textContent=`${profile} / ${mode} の設定だけを保存します。`;form.append(context);
 function select(options,value){const node=document.createElement('select');for(const [key,text]of options){const option=document.createElement('option');option.value=String(key);option.textContent=text;node.append(option);}node.value=String(value);return node;}
 function field(label,control){const wrapper=document.createElement('label');wrapper.className='settings-field';const text=document.createElement('span');text.textContent=label;wrapper.append(text,control);form.append(wrapper);return control;}
 const profileSelect=field('操作する端末',select([['touch','スマホ / タッチ'],['desktop','PC / キーボード・マウス'],['hybrid','タッチPC / 両方']],profile));
 const values=store.read(profile,mode),fields=settingsFields(profile,mode).filter(field=>!hiddenSettings.includes(field.key));
 for(const spec of fields){let control;if(spec.type==='select')control=select(spec.options,values[spec.key]);else{control=document.createElement('input');control.type=spec.type==='checkbox'?'checkbox':'number';if(spec.type==='checkbox')control.checked=values[spec.key];else{control.min=spec.min;control.max=spec.max;control.step=spec.step;control.value=values[spec.key];}}field(spec.label,control);controls.set(spec.key,{control,spec});}
 const keyControls=new Map();if(profile!=='touch'){
  const note=document.createElement('p');note.textContent='キーは同時押しできます。制動が駆動に優先し、後退は停止確認後に始まります。';form.append(note);
  for(const [action,code]of Object.entries(values.keys)){const control=field('キー割当: '+KEY_LABELS[action],select(KEY_CODES.map(k=>[k,k]),code));keyControls.set(action,control);}
 }
 const status=document.createElement('p');status.setAttribute('role','status');status.textContent=store.status().message;form.append(status);
 const errors=document.createElement('p');errors.setAttribute('role','alert');form.append(errors);
 const actions=document.createElement('div');actions.className='settings-actions';form.append(actions);
 function button(label){const b=document.createElement('button');b.type='button';b.textContent=label;actions.append(b);return b;}
 const apply=button('適用'),close=button('閉じる'),reset=button('この端末・このモードの設定を初期化');
 function populate(){const next=store.read(profile,mode);for(const [key,{control,spec}]of controls)if(spec.type==='checkbox')control.checked=next[key];else control.value=String(next[key]);for(const [key,c]of keyControls)c.value=next.keys[key];}
 function finishClose(){if(!opened)return;opened=false;input?.clear();input?.setEnabled(true);onClose();restoreFocus?.focus();}
 function closeDialog(){if(dialog.open)dialog.close();finishClose();}
 scope.on(dialog,'close',()=>{if(!dialog.open)finishClose();});
 scope.on(close,'click',closeDialog);scope.on(form,'submit',event=>event.preventDefault());
 scope.on(apply,'click',()=>{try{const next={};for(const [key,{control,spec}]of controls)next[key]=spec.type==='checkbox'?control.checked:spec.type==='number'||spec.key==='fps'?Number(control.value):control.value;if(keyControls.size)next.keys=Object.fromEntries([...keyControls].map(([key,c])=>[key,c.value]));const saved=store.write(profile,mode,next);onApply(saved);status.textContent=store.status().message;if(store.status().persistent)closeDialog();}catch(error){errors.textContent='設定を適用できません: '+error.message;}});
 scope.on(reset,'click',()=>{store.reset(profile,mode);populate();input?.clear();onApply(store.read(profile,mode));status.textContent=store.status().message||'この端末・このモードの設定を初期化しました。';});
 scope.on(profileSelect,'change',()=>{input?.clear();closeDialog();onProfileChange(profileSelect.value);});
 return Object.freeze({open(){if(disposed||dialog.open)return;restoreFocus=document.activeElement;opened=true;input?.setEnabled(false);onOpen();populate();errors.textContent='';status.textContent=store.status().message;dialog.showModal();},close:closeDialog,dispose(){if(disposed)return;disposed=true;closeDialog();scope.dispose();dialog.remove();}});
}
