/** Own resources before fallible initialization. Closing also releases late arrivals. */
export function createResourceScope(){
 const entries=[],seen=new Set(),pending=new Set(),errors=[];let closed=false;
 function release(resource){
  const task=(async()=>{try{await(typeof resource==='function'?resource():resource.dispose());}catch(error){errors.push(String(error));}})();
  pending.add(task);task.then(()=>pending.delete(task));return task;
 }
 async function dispose(){closed=true;while(entries.length)await release(entries.pop());while(pending.size)await Promise.all([...pending]);}
 return Object.freeze({
  own(resource){if(!resource||(typeof resource!=='function'&&typeof resource.dispose!=='function'))throw new TypeError('Owned resource must be disposable');if(seen.has(resource))return resource;seen.add(resource);if(closed)release(resource);else entries.push(resource);return resource;},
  dispose,snapshot(){return Object.freeze({closed,resources:entries.length+pending.size,errors:Object.freeze([...errors])});}
 });
}
