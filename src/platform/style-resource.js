export function loadStylesheet(url,{document,scope,signal}){
 if(signal.aborted)return Promise.reject(new DOMException('Cancelled','AbortError'));
 const link=document.createElement('link');link.rel='stylesheet';link.href=url;
 return new Promise((resolve,reject)=>{
  const clean=()=>{link.removeEventListener('load',loaded);link.removeEventListener('error',failed);signal.removeEventListener('abort',cancel);};
  const loaded=()=>{clean();resolve(link);};const failed=()=>{clean();reject(new Error('画面のスタイルを読み込めませんでした。'));};const cancel=()=>{clean();link.remove();reject(new DOMException('Cancelled','AbortError'));};
  link.addEventListener('load',loaded);link.addEventListener('error',failed);signal.addEventListener('abort',cancel,{once:true});scope.own({dispose(){cancel();}});document.head.append(link);
 });
}
