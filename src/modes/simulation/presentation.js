import {createTrackRenderer} from './renderer.js';
import {loadStylesheet} from '../../platform/style-resource.js';import styleURL from '../../assets/simulation/screen.css';
export async function prepareSimulation({root,scope,signal,settings}){
 if(signal.aborted)throw new DOMException('Cancelled','AbortError');root.dataset.modeScreen='simulation';root.style.paddingTop='64px';await loadStylesheet(styleURL,{document:root.ownerDocument,scope,signal});
 const renderer=scope.own(createTrackRenderer(root));renderer.configure({...settings,compact:true});let disposed=false;
 const audio=scope.own({pause(){},resume(){},dispose(){disposed=true;},diagnostics:()=>({disposed,contexts:0})});
 return{renderer,audio,cameraLabel:'表示を拡大・縮小',hiddenSettings:['volume','viewpoint','reducedMotion'],hasRcs:false,configure(next){renderer.configure({...next,compact:true});}};
}
