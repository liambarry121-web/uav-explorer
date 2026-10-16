import {calculate,defaults,controls,suggestions} from './model.js';
const q=s=>document.querySelector(s);
const qa=s=>Array.from(document.querySelectorAll(s));
const f=(n,d=1)=>Number.isFinite(n)?n.toFixed(d):'—';
const col=['#45c6d8','#f7b56b','#a8b7e6','#63d5a4','#ff8e94'];
let state={...defaults};
try{const saved=JSON.parse(localStorage.getItem('uavInputs-v1'));if(saved&&typeof saved==='object')state={...state,...saved};}catch{}
let r=calculate(state), tab='summary', chart='altitude';

function tile(label,value,subtitle,status=''){
 return `<div class="tile ${status}"><div class="label">${label}</div><div class="number">${value}</div><div class="subtitle">${subtitle}</div></div>`;
}
function check(label,ok){return `<div class="check-row"><span class="check-title">${label}</span><span class="check-pill ${ok?'pass':'review'}">${ok?'PASS':'REVIEW'}</span></div>`;}
function updateSummary(){
 q('#metrics').innerHTML=[
  tile('Takeoff mass',`${f(r.massBefore,2)} kg`,'10 kg maximum',r.massOK?'good':'bad'),
  tile('Required takeoff speed',`${f(r.requiredTakeoffSpeed,2)} m/s`,'Full payload · selected lift margin'),
  tile('Ground-roll distance',`${f(r.runwayDistanceM)} m`,r.runwayReachedSpeed?'Airspeed reached · not proven takeoff':'Could not reach required airspeed',r.runwayReachedSpeed?'good':'bad'),
  tile('Battery left at 15 min',`${f(r.energyRemainingAfter15Pct)}%`,'Target ≥ 20% · constant current',r.endurance15OK?'good':'bad')
 ].join('');
 q('#checks-summary').innerHTML=[
  check('Maximum takeoff mass ≤ 10 kg',r.massOK),
  check('Ground roll reaches required airspeed',r.runwayReachedSpeed),
  check('Airborne takeoff-stage speed sufficient',r.takeoffStageSpeedOK),
  check('Airborne lift meets margin',r.liftOK),
  check('Thrust during climb (assumed proxy)',r.climbThrustOK),
  check('Thrust during cruise & descent',r.cruiseThrustOK&&r.descentThrustOK),
  check('15 min with at least 20% battery reserve',r.endurance15OK),
  check('Airspeed at or below 40 knots',r.speedOK),
  check('Climb & descent fit inside horizontal route',r.routeOK)
 ].join('');
 q('#flight-plan').innerHTML=[
 ['Ground roll',`${f(r.runwayTimeSec)} s`],['Climb',`${f(r.climbSec)} s`],
 ['Cruise',`${f(r.cruiseSec/60,2)} min`],['Descent',`${f(r.descentSec)} s`],
 ['Plotted route',`${f(r.routeTimeSec/60,2)} min`],['Extra time to 15 min',`${f(r.extraTimeTo15Sec/60,2)} min`],
 ['Nominal energy',`${f(r.energyWh)} Wh`],['Max current for 15 min',`${f(r.maxCurrentFor15A)} A`]
 ].map(a=>`<div><span>${a[0]}</span><strong>${a[1]}</strong></div>`).join('');
 q('#ground-metrics').innerHTML=[
 tile('Required airspeed',`${f(r.requiredTakeoffSpeed,2)} m/s`,'With lift margin'),
 tile('Groundspeed reached',`${f(r.runwayEndSpeed,2)} m/s`,'From rest in assumed model',r.runwayReachedSpeed?'good':'bad'),
 tile('Distance',`${f(r.runwayDistanceM)} m`,'No verified runway limit'),
 tile('Ground-roll duration',`${f(r.runwayTimeSec)} s`,r.runwayReachedSpeed?'Speed threshold reached':'Failed / timed out')
 ].join('');
 q('#stage-details').innerHTML=[
 ['Ground roll',`${f(r.runwayTimeSec)} s`],['Climb to '+f(r.targetAltitudeFt,0)+' ft',`${f(r.climbSec)} s`],
 ['Level cruise',`${f(r.cruiseSec/60,2)} min`],['Descent to ground',`${f(r.descentSec)} s`],
 ['Additional flying (not plotted)',`${f(r.extraTimeTo15Sec/60,2)} min`]
 ].map(x=>`<div class="stage-time"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('');
 q('#recommendations').innerHTML=suggestions(r).map(x=>{const li=document.createElement('li');li.textContent=x;return li.outerHTML;}).join('');
}
function renderSliders(){
 const groups=[...new Set(controls.map(c=>c.group))];
 q('#slider-groups').innerHTML=groups.map(g=>`<div class="slider-group"><h2>${g}</h2>${controls.filter(c=>c.group===g).map(c=>`<div class="control"><label for="s-${c.id}"><span>${c.name}</span><output id="v-${c.id}"></output></label><input id="s-${c.id}" type="range" min="${c.min}" max="${c.max}" step="${c.step}" value="${state[c.id]}"><div class="range-endpoints"><span>${c.min} ${c.unit}</span><span>${c.max} ${c.unit}</span></div></div>`).join('')}</div>`).join('');
 for(const c of controls){
   const input=q(`#s-${c.id}`);
   input.addEventListener('input',()=>{state[c.id]=Number(input.value);recompute(false);});
 }
 updateSliderNumbers();
}
function updateSliderNumbers(){
 for(const c of controls){
  const n=Math.abs(c.step)<.01?3:(c.step<.1?2:(c.step<1?1:0));
  const el=q(`#v-${c.id}`);if(el)el.textContent=`${f(state[c.id],n)}${c.unit?' '+c.unit:''}`;
 }
}
function recompute(resetSliderValues=false){
 r=calculate(state);
 for(const pt of r.points)pt.timeMin=pt.timeSec/60;
 try{localStorage.setItem('uavInputs-v1',JSON.stringify(state));}catch{}
 if(resetSliderValues)for(const c of controls)q(`#s-${c.id}`).value=state[c.id];
 updateSliderNumbers();updateSummary();requestGraphs();
}
function requestGraphs(){if(tab==='graphs'||tab==='ground')requestAnimationFrame(updateCharts);}

// Canvas charts use local drawing only: no cloud, external APIs or libraries.
function drawGraph(canvasId,data,config){
 const canvas=q('#'+canvasId); if(!canvas)return;
 const width=canvas.getBoundingClientRect().width; if(width<100)return;
 const height=canvas.getBoundingClientRect().height;
 const dpr=Math.min(2,window.devicePixelRatio||1);
 canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
 const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);
 ctx.clearRect(0,0,width,height);
 const pad={left:46,right:14,top:17,bottom:31};
 const W=width-pad.left-pad.right,H=height-pad.top-pad.bottom;
 if(!data.length)return;
 let x1=Math.min(...data.map(p=>p[config.x])),x2=Math.max(...data.map(p=>p[config.x]));
 const values=[];
 for(const series of config.series)for(const p of data){const y=p[series.key];if(Number.isFinite(y))values.push(y);}
 for(const ref of config.refs||[])if(Number.isFinite(ref.value))values.push(ref.value);
 let y1=Number.isFinite(config.minY)?config.minY:Math.min(0,...values);
 let y2=Math.max(1,...values);
 if(y2<=y1)y2=y1+1;
 if(y1!==0)y1-=Math.abs(y2-y1)*.08;
 y2+=Math.abs(y2-y1)*.08;
 if(x2<=x1)x2=x1+1;
 const xp=v=>pad.left+(v-x1)/(x2-x1)*W;
 const yp=v=>pad.top+H-(v-y1)/(y2-y1)*H;
 if(config.bands){
  const bounds=[0,r.runwayTimeSec,r.runwayTimeSec+r.climbSec,r.runwayTimeSec+r.climbSec+r.cruiseSec,r.routeTimeSec].map(v=>v/60);
  const colors=['#77859d','#45c6d8','#718de0','#f7b56b'];
  bounds.forEach((b,j)=>{if(j===4)return;ctx.fillStyle=colors[j]+'10';ctx.fillRect(xp(b),pad.top,Math.max(0,xp(bounds[j+1])-xp(b)),H);});
 }
 ctx.font='11px system-ui, sans-serif';ctx.textAlign='right';ctx.textBaseline='middle';
 for(let i=0;i<=4;i++){
  let y=y1+(y2-y1)*i/4, py=yp(y);
  ctx.strokeStyle='#2a4059';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(pad.left,py);ctx.lineTo(width-pad.right,py);ctx.stroke();
  ctx.fillStyle='#a2b4c8';ctx.fillText(Math.abs(y)>=10000?(y/1000).toFixed(0)+'k':f(y,Math.abs(y)<10?1:0),pad.left-8,py);
 }
 ctx.textAlign='center';ctx.textBaseline='top';
 for(let i=0;i<=4;i++){
  const x=x1+(x2-x1)*i/4, px=xp(x);
  ctx.strokeStyle='#22384d';ctx.beginPath();ctx.moveTo(px,pad.top);ctx.lineTo(px,pad.top+H);ctx.stroke();
  ctx.fillStyle='#a2b4c8';ctx.fillText(x2<10?f(x,1):f(x,0),px,pad.top+H+8);
 }
 for(const ref of config.refs||[]){
  const py=yp(ref.value);ctx.strokeStyle=ref.color||'#f7b56b';ctx.setLineDash([6,5]);ctx.lineWidth=1.5;
  ctx.beginPath();ctx.moveTo(pad.left,py);ctx.lineTo(width-pad.right,py);ctx.stroke();ctx.setLineDash([]);
 }
 for(const line of config.series){
  ctx.strokeStyle=line.color;ctx.lineWidth=2.2;ctx.lineJoin='round';ctx.lineCap='round';
  ctx.beginPath();let started=false;
  for(const p of data){const y=p[line.key];if(!Number.isFinite(y)){started=false;continue;}
   const x=xp(p[config.x]),py=yp(y);
   if(!started){ctx.moveTo(x,py);started=true;}else ctx.lineTo(x,py);
  }
  ctx.stroke();
 }
}
const series=(key,label,color)=>({key,label,color});
const chartConfigs={
 altitude:{title:'Altitude vs time',unit:'ft AGL',series:[series('altitudeFt','Altitude',col[0])],refs:[{value:150,label:'150 ft lower cruise altitude',color:'#8fa2ba'},{value:200,label:'200 ft upper cruise altitude',color:'#8fa2ba'}],minY:0},
 velocity:{title:'Velocity vs time',unit:'m/s',series:[series('speed','|V|',col[0]),series('vx','Vx',col[1]),series('vy','Vy',col[2])],refs:[{value:r.requiredTakeoffSpeed,label:'Takeoff speed',color:'#63d5a4'},{value:40*.514444,label:'40 kn',color:'#ff8e94'}]},
 forces:{title:'Aerodynamic forces vs time',unit:'N',series:[series('lift','Lift',col[0]),series('weight','Weight',col[1]),series('drag','Drag',col[2])],minY:0},
 thrust:{title:'Available and required thrust',unit:'N (proxy)',series:[series('thrustRequired','Required thrust',col[1]),series('thrustAvailable','Available thrust (proxy)',col[0])],minY:0},
 coefficients:{title:'CL & CD vs time',unit:'dimensionless',series:[series('cl','CL',col[0]),series('cd','CD',col[1])],minY:0},
 reynolds:{title:'Reynolds number vs time',unit:'dimensionless',series:[series('reynolds','Re',col[2])],minY:0}
};
function legendHTML(lines,refs=[]){return [...lines.map(x=>`<span><i class="legend-line" style="background:${x.color}"></i>${x.label}</span>`),...refs.map(x=>`<span><i class="legend-line dashed" style="background:${x.color||'#f7b56b'}"></i>${x.label}</span>`)].join('');}
function updateCharts(){
 if(tab==='graphs'){
  const spec={...chartConfigs[chart]};
  if(chart==='velocity')spec.refs=[{value:r.requiredTakeoffSpeed,label:'Required takeoff airspeed',color:'#63d5a4'},{value:40*.514444,label:'40-kn max',color:'#ff8e94'}];
  q('#chart-title').textContent=spec.title;q('#chart-unit').textContent=spec.unit;
  drawGraph('flight-chart',r.points,{x:'timeMin',series:spec.series,refs:spec.refs,minY:spec.minY,bands:true});
  q('#chart-legend').innerHTML=legendHTML(spec.series,spec.refs);
 }
 if(tab==='ground'){
  const speedPoints=r.roll.map(p=>({...p,requiredSpeed:r.requiredTakeoffSpeed}));
  drawGraph('ground-speed-chart',speedPoints,{x:'timeSec',series:[series('speed','Speed',col[0])],refs:[{value:r.requiredTakeoffSpeed,color:col[1]}],minY:0});
  drawGraph('ground-forces-chart',r.roll.map(p=>({...p,distance:p.distanceM})),{x:'distanceM',series:[series('thrust','Thrust',col[0]),series('drag','Drag',col[1]),series('netForce','Net force',col[2])]});
 }
}
qa('[data-view]').forEach(b=>b.addEventListener('click',()=>{
 tab=b.dataset.view;
 qa('[data-view]').forEach(el=>el.classList.toggle('selected',el===b));
 qa('.view').forEach(el=>el.classList.toggle('active',el.id==='view-'+tab));
 window.scrollTo({top:0,behavior:'instant'});requestGraphs();
}));
qa('[data-chart]').forEach(b=>b.addEventListener('click',()=>{
 chart=b.dataset.chart;
 qa('[data-chart]').forEach(el=>el.classList.toggle('selected',el===b));
 requestGraphs();
}));
q('#reset').addEventListener('click',()=>{if(confirm('Reset all 17 settings to the default example?')){state={...defaults};recompute(true);}});
q('#export').addEventListener('click',()=>{
 const data=JSON.stringify({description:'UAV Design Explorer settings (not validated)',created:new Date().toISOString(),inputs:state},null,2);
 const url=URL.createObjectURL(new Blob([data],{type:'application/json'}));
 const a=document.createElement('a');a.href=url;a.download='uav-design-settings.json';a.click();
 setTimeout(()=>URL.revokeObjectURL(url),3000);
});
window.addEventListener('resize',()=>requestGraphs());
renderSliders();recompute(false);
if('serviceWorker' in navigator && location.protocol==='https:')navigator.serviceWorker.register('./sw.js').catch(()=>{});
