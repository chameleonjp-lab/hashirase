/** A small flat test track. Allocated only after the simulation is selected. No loop. */
export function createTrackRenderer(root){
  const document=root.ownerDocument,section=document.createElement('section');
  section.style.cssText='padding:24px;box-sizing:border-box;background:#101c2a;color:#e9f0f5;font-family:system-ui';
  section.innerHTML='<p style="margin:0;color:#74dacb;font-size:13px;letter-spacing:.14em">HASHIRASE / SIMULATION</p><h1 style="font-size:24px;margin:12px 0" data-model></h1><p style="color:#b8c9d7">平坦路で駆動力・抵抗・加速度を確認します。旋回・四輪接地・車体回転は今後追加します。</p><div style="display:flex;flex-wrap:wrap;gap:24px;margin:18px 0"><strong style="font-size:28px;color:#ffbb76" data-speed>0.0 km/h</strong><span data-force></span><span data-mass></span><span data-acceleration></span></div><canvas aria-label="直線試験場を上から見た表示" style="display:block;width:100%;height:300px;border-radius:16px;background:#203245"></canvas><p style="font-size:13px;color:#b8c9d7" data-distance></p>';
  root.append(section);const canvas=section.querySelector('canvas'),ctx=canvas.getContext('2d');
  if(!ctx){section.remove();throw new Error('直線試験場の描画を開始できません');}
  let disposed=false,width=800,height=300,pixelRatio=1,last;
  const fields=Object.fromEntries(['model','speed','force','mass','acceleration','distance'].map(name=>[name,section.querySelector(`[data-${name}]`)]));
  function draw(){
    if(!last||disposed)return;
    const vehicle=last.vehicle??last,t=vehicle.telemetry;
    fields.model.textContent=t.label;fields.speed.textContent=(t.speed*3.6).toFixed(1)+' km/h';
    fields.force.textContent='合力 '+Math.hypot(...Object.values(t.forces.total)).toFixed(0)+' N';
    fields.mass.textContent='質量 '+t.mass.toFixed(0)+' kg';fields.acceleration.textContent='加速度 '+Math.hypot(...Object.values(t.acceleration)).toFixed(2)+' m/s²';
    fields.distance.textContent=`位置 ${vehicle.position.z.toFixed(2)} m / 計算時間 ${t.time.toFixed(2)} s — 車両の数値は推定値。実車との比較・校正は未実施。`;
    ctx.setTransform(pixelRatio,0,0,pixelRatio,0,0);ctx.clearRect(0,0,width,height);ctx.fillStyle='#203245';ctx.fillRect(0,0,width,height);
    const left=width*0.27,right=width*0.73,center=width/2;
    ctx.fillStyle='#30455b';ctx.fillRect(left,0,right-left,height);
    ctx.strokeStyle='#92adbc';ctx.lineWidth=2;ctx.setLineDash([]);ctx.beginPath();ctx.moveTo(left+8,0);ctx.lineTo(left+8,height);ctx.moveTo(right-8,0);ctx.lineTo(right-8,height);ctx.stroke();
    const offset=((vehicle.position.z*12)%60+60)%60;
    ctx.strokeStyle='#b8c9d7';ctx.setLineDash([20,40]);ctx.lineDashOffset=offset;ctx.beginPath();ctx.moveTo(center,0);ctx.lineTo(center,height);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle='#ffbb76';ctx.fillRect(center-30,height*0.60-42,60,84);ctx.fillStyle='#152637';ctx.fillRect(center-23,height*0.60-29,46,22);
    ctx.fillStyle='#74dacb';ctx.font='13px system-ui';ctx.fillText('FLAT ROAD · 直線試験場',18,28);
    ctx.fillStyle='#b8c9d7';for(let y=-offset;y<height;y+=60){ctx.fillRect(right+16,y,12,2);ctx.fillText((-vehicle.position.z+(height*0.6-y)/12).toFixed(0)+' m',right+38,y+5);}
  }
  return Object.freeze({
    render(snapshot){if(disposed)return;last=snapshot;draw();},
    resize(size){if(disposed)return;width=Math.max(1,Math.min(8192,Number.isFinite(size.width)?size.width-48:800));height=Math.max(1,Math.min(4096,Number.isFinite(size.height)?size.height-220:300));pixelRatio=Math.max(1,Math.min(3,Number.isFinite(size.pixelRatio)?size.pixelRatio:1));canvas.width=Math.round(width*pixelRatio);canvas.height=Math.round(height*pixelRatio);canvas.style.height=height+'px';draw();},
    dispose(){if(disposed)return;disposed=true;last=null;canvas.width=canvas.height=0;section.remove();},
    diagnostics(){return{disposed,canvases:disposed?0:1};}
  });
}
