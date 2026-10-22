import {createRandom} from '../../platform/random.js';import {loadStylesheet} from '../../platform/style-resource.js';import {loadScreenAssets} from './index.js';import styleURL from '../../assets/driving/screen.css';
export async function prepareDriving({root,scope,signal,settings,createRendererHost,createAudioService}){
 const {screenURL}=await loadScreenAssets();if(signal.aborted)throw new DOMException('Cancelled','AbortError');
 const [markup]=await Promise.all([fetch(screenURL,{signal}).then(response=>{if(!response.ok)throw new Error('ゲームの画面を読み込めませんでした。');return response.text();}),loadStylesheet(styleURL,{document:root.ownerDocument,scope,signal})]);
 if(signal.aborted)throw new DOMException('Cancelled','AbortError');root.dataset.modeScreen='driving';
 const renderer=scope.own(createRendererHost(root,{markup,pixelRatio:1,singleCanvas:true})),view=root.ownerDocument.defaultView;
 const audio=scope.own(createAudioService({createContext:()=>new(view.AudioContext||view.webkitAudioContext)(),random:createRandom(0x48415348).fork('audio').next}));
 renderer.configure(settings);audio.configure(settings);
 for(const id of ['btn-steer-left','btn-brake']){const group=root.querySelector('#'+id)?.closest('.glass-bar');if(group)group.style.display='none';}
 for(const id of ['help-modal','gameover-modal','ta-finish-modal'])root.querySelector('#'+id)?.setAttribute('data-no-drive','');
 return{renderer,audio,cameraLabel:'視点を切替',hiddenSettings:[],hasRcs:true,hasResults:true,configure(next){renderer.configure(next);audio.configure(next);}};
}
