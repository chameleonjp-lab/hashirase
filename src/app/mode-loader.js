/** The only mode lookup. URL/input strings can never become import specifiers. */
export async function loadMode(mode){
 if(mode==='driving'){
  const [engine,presentation,view,audio]=await Promise.all([import('../modes/driving/index.js'),import('../modes/driving/presentation.js'),import('../rendering/renderer-host.js'),import('../platform/audio.js')]);
  return{createMode:engine.createMode,prepare:options=>presentation.prepareDriving({...options,createRendererHost:view.createRendererHost,createAudioService:audio.createAudioService})};
 }
 if(mode==='simulation'){
  const [engine,presentation]=await Promise.all([import('../modes/simulation/index.js'),import('../modes/simulation/presentation.js')]);
  return{createMode:engine.createMode,prepare:presentation.prepareSimulation};
 }
 throw new TypeError('Unknown mode');
}
