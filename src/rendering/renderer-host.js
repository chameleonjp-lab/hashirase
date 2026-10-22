import * as Three from 'three';
import { applyDrivingVisuals } from './vehicle-view.js';
import { updateGameCamera } from './camera.js';

/** Owns DOM listeners, timers, WebGL objects and the temporary legacy surface. No RAF. */
export function createRendererHost(container,quality={}) {
  const ownerDocument=container.ownerDocument,view=ownerDocument.defaultView;
  let disposed=false,enabled=false,legacyControls=true,engine=null,disposedResources=0;
  const resources=new Set(),listeners=new Set(),timers=new Set(),wrappedElements=new WeakMap(),constructors=new Map();
  if(quality.markup!==undefined)container.innerHTML=quality.markup;
  function track(resource){
    if(typeof resource?.dispose!=='function')return resource;
    resources.add(resource);
    if(typeof resource.clone==='function'){
      const originalClone=resource.clone;
      resource.clone=function(...args){return track(originalClone.apply(this,args));};
    }
    return resource;
  }
  const THREE=new Proxy(Three,{get(target,key){
    const value=target[key];
    if(typeof value!=='function'||!value.prototype)return value;
    if(!constructors.has(key))constructors.set(key,new Proxy(value,{construct(type,args){return track(Reflect.construct(type,args));}}));
    return constructors.get(key);
  }});
  function listen(target,type,callback,options){
    const oldInput=(target===view&&['keydown','keyup','pointermove','pointerup','pointercancel','contextmenu'].includes(type))||
      (target.id==='canvas-container'&&type==='pointerdown')||target.matches?.('[data-touch-key],#btn-auto-accel');
    const wrapped=event=>{if(!disposed&&(!oldInput||legacyControls)&&(enabled||['resize','orientationchange'].includes(type)))callback.call(target,event);};
    target.addEventListener(type,wrapped,options);const entry={target,type,wrapped,options};listeners.add(entry);
    return ()=>{target.removeEventListener(type,wrapped,options);listeners.delete(entry);};
  }
  function wrap(element){
    if(!element)return element;
    if(!wrappedElements.has(element))wrappedElements.set(element,new Proxy(element,{
      get(target,key){if(key==='addEventListener')return (type,callback,options)=>listen(target,type,callback,options);const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;},
      set(target,key,value){return Reflect.set(target,key,value,target);}
    }));
    return wrappedElements.get(element);
  }
  const document={
    getElementById:id=>wrap(container.querySelector(`[id="${id}"]`)),
    querySelector:selector=>wrap(container.querySelector(selector)),querySelectorAll:selector=>container.querySelectorAll(selector),
    createElement:tag=>ownerDocument.createElement(tag),documentElement:ownerDocument.documentElement,
    elementFromPoint:(x,y)=>ownerDocument.elementFromPoint(x,y),addEventListener:(...args)=>listen(ownerDocument,...args)
  };
  const hostWindow={
    get innerWidth(){return view.innerWidth;},get innerHeight(){return view.innerHeight;},get devicePixelRatio(){return quality.pixelRatio??view.devicePixelRatio;},
    AudioContext:view.AudioContext,webkitAudioContext:view.webkitAudioContext,
    addEventListener:(...args)=>listen(view,...args),__setLoadingGauge(){},__hideLoadingScreen(){container.querySelector('#loading-screen')?.remove();},
    __installSoftwareThreeShim(){throw new Error('WebGL is unavailable');}
  };
  function ownedTimeout(callback,delay){const id=view.setTimeout(()=>{timers.delete(id);if(!disposed)callback();},delay);timers.add(id);return id;}
  function clearOwnedTimeout(id){view.clearTimeout(id);timers.delete(id);}
  function detach(){engine=null;}
  const legacySurface={document,window:hostWindow,navigator:view.navigator,THREE,setTimeout:ownedTimeout,clearTimeout:clearOwnedTimeout,ports:{applyDrivingVisuals,updateGameCamera},setLegacyControls(value){legacyControls=Boolean(value);},detach};
  return Object.freeze({
    legacySurface,
    attachLegacy(backend){if(disposed)throw new Error('Renderer disposed');engine=backend;},
    setEnabled(value){enabled=Boolean(value);},
    render(snapshot,alpha){if(disposed)return;if(!Number.isFinite(alpha)||alpha<0||alpha>1)throw new TypeError('alpha must be 0..1');engine?.render(snapshot,alpha);},
    resize(){if(!disposed)view.dispatchEvent(new Event('resize'));},
    diagnostics(){return {disposed,listeners:listeners.size,timers:timers.size,liveResources:resources.size,disposedResources};},
    dispose(){
      if(disposed)return;disposed=true;enabled=false;engine=null;
      for(const {target,type,wrapped,options}of listeners)target.removeEventListener(type,wrapped,options);listeners.clear();
      for(const id of timers)view.clearTimeout(id);timers.clear();
      for(const resource of resources){try{resource.dispose();resource.forceContextLoss?.();disposedResources++;}catch{}}
      resources.clear();constructors.clear();for(const key of Object.keys(hostWindow))delete hostWindow[key];container.replaceChildren();
    }
  });
}
