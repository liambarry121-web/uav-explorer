// UAV preliminary design engine. JavaScript port of UAVModel.c (the C engine).
// Constants are based on the TU Dublin project proposal + later 15-minute update.
// NOT validated flight software; assumptions described in README.md.
export const defaults = {
  wingArea:1.2, meanChord:0.4, batteryCount:2, airframeMass:3,
  totalCurrent:30, liftMarginPct:10, cruiseSpeed:12, climbAngle:10,
  cruiseAltitude:175, waterReleased:100, clTakeoff:1.4, clCruise:1,
  clLanding:1.5, cdTakeoff:0.1, cdCruise:0.055,
  cdLanding:0.16, maxStaticThrust:35
};
export const controls = [
 {id:'wingArea', name:'Wing area',unit:'m²',min:0.3,max:3,step:0.01,group:'Airframe'},
 {id:'meanChord',name:'Mean chord',unit:'m',min:0.1,max:1.5,step:0.01,group:'Airframe'},
 {id:'batteryCount',name:'Number of batteries',unit:'packs',min:1,max:4,step:1,group:'Mass & power'},
 {id:'airframeMass',name:'Airframe & systems mass',unit:'kg',min:0.5,max:5,step:0.05,group:'Mass & power'},
 {id:'totalCurrent',name:'Total electrical current',unit:'A',min:5,max:100,step:0.5,group:'Mass & power'},
 {id:'liftMarginPct',name:'Lift margin',unit:'%',min:0,max:30,step:1,group:'Flight'},
 {id:'cruiseSpeed',name:'Cruise speed',unit:'m/s',min:6,max:25,step:0.1,group:'Flight'},
 {id:'climbAngle',name:'Climb angle',unit:'°',min:2,max:30,step:0.5,group:'Flight'},
 {id:'cruiseAltitude',name:'Cruise altitude',unit:'ft',min:150,max:200,step:1,group:'Flight'},
 {id:'waterReleased',name:'Water released',unit:'%',min:0,max:100,step:5,group:'Flight'},
 {id:'clTakeoff',name:'Takeoff CL (CLmax proxy)',unit:'',min:0.2,max:2.2,step:0.02,group:'Takeoff aerodynamics'},
 {id:'cdTakeoff',name:'Takeoff CD',unit:'',min:0.02,max:0.5,step:0.005,group:'Takeoff aerodynamics'},
 {id:'clCruise',name:'Cruise CL',unit:'',min:0.2,max:2,step:0.02,group:'Cruise aerodynamics'},
 {id:'cdCruise',name:'Cruise CD',unit:'',min:0.02,max:0.3,step:0.005,group:'Cruise aerodynamics'},
 {id:'clLanding',name:'Landing CL',unit:'',min:0.2,max:2.2,step:0.02,group:'Landing aerodynamics'},
 {id:'cdLanding',name:'Landing CD',unit:'',min:0.02,max:0.6,step:0.005,group:'Landing aerodynamics'},
 {id:'maxStaticThrust',name:'Assumed max static thrust',unit:'N',min:10,max:120,step:1,group:'Propulsion'}
];
const G=9.81, RHO=1.225, MU=1.7894e-5, MAX_MASS=10, PAYLOAD=5;
const PACK_MASS=1, VBAT=22.2, PACK_AH=6, ROUTE=2.5*1609.344;
const MAX_SPEED=40*0.514444, RESERVE=0.20, ENDURANCE=15*60;
const ETA=0.65, ROLL_MU=0.04, ROLL_DT=0.02;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const nonneg=x=>Math.max(0,x);
export function calculate(raw) {
  const a={...defaults,...raw};
  for(const c of controls) {
    let v=Number(a[c.id]);
    a[c.id]=clamp(Number.isFinite(v)?v:defaults[c.id],c.min,c.max);
  }
  a.batteryCount=Math.round(a.batteryCount);
  const bat=a.batteryCount, mass0=a.airframeMass+bat*PACK_MASS+PAYLOAD;
  const mass1=mass0-PAYLOAD*a.waterReleased/100;
  const takeoffV=0.8*a.cruiseSpeed, landingV=0.7*a.cruiseSpeed;
  const theta=a.climbAngle*Math.PI/180, margin=a.liftMarginPct/100;
  const stallV=Math.sqrt(2*mass0*G/(RHO*a.wingArea*a.clTakeoff));
  const requiredV=stallV*Math.sqrt(1+margin);
  const electricalW=VBAT*a.totalCurrent, propulsiveW=electricalW*ETA;
  const r={
    massBefore:mass0,massAfter:mass1,batteryCount:bat,stallSpeed:stallV,
    requiredTakeoffSpeed:requiredV,takeoffStageSpeed:takeoffV,
    electricalPowerW:electricalW,targetAltitudeFt:a.cruiseAltitude,
    massOK:mass0<=MAX_MASS+1e-8, takeoffStageSpeedOK:takeoffV>=requiredV,
    theoreticalTakeoffAreaM2:2*mass0*G*(1+margin)/(RHO*takeoffV*takeoffV*a.clTakeoff),
    theoreticalTakeoffCL:2*mass0*G*(1+margin)/(RHO*takeoffV*takeoffV*a.wingArea),
    suggestedCruiseSpeed:requiredV/0.8,
    suggestedAirframeMass:MAX_MASS-PAYLOAD-bat*PACK_MASS,
    runwayReachedSpeed:false,runwayStopped:false,roll:[],profile:[],
    maxThrustRequiredN:0,maxThrustAvailableN:0,minClimbThrustMarginN:Infinity,
    liftOK:true,climbThrustOK:true,cruiseThrustOK:true,descentThrustOK:true
  };
  // Euler time integration with trapezoidal distance; level ground, zero wind.
  let tv=0,vv=0,ss=0;
  for(let step=0;step<=6000;step++) {
    const lift=.5*RHO*vv*vv*a.wingArea*a.clTakeoff;
    const drag=.5*RHO*vv*vv*a.wingArea*a.cdTakeoff;
    const thrust=Math.min(a.maxStaticThrust,propulsiveW/Math.max(vv,2));
    const friction=ROLL_MU*nonneg(mass0*G-lift);
    const net=thrust-drag-friction;
    if(step%10===0 || vv>=requiredV || net<=0 || step===6000)
      r.roll.push({timeSec:tv,distanceM:ss,speed:vv,lift,drag,thrust,netForce:net});
    if(vv>=requiredV){r.runwayReachedSpeed=true;break;}
    if(net<=0){r.runwayStopped=true;break;}
    if(step===6000)break;
    const vn=vv+net/mass0*ROLL_DT;
    ss+=.5*(vv+vn)*ROLL_DT;
    vv=vn;tv+=ROLL_DT;
  }
  r.runwayTimeSec=tv;r.runwayDistanceM=ss;r.runwayEndSpeed=vv;
  const h=a.cruiseAltitude*.3048;
  const climbRate=takeoffV*Math.sin(theta), descentRate=landingV*Math.sin(theta);
  const tClimb=h/climbRate, tDescent=h/descentRate;
  const dxClimb=takeoffV*Math.cos(theta)*tClimb;
  const dxDescent=landingV*Math.cos(theta)*tDescent;
  const remainingX=ROUTE-dxClimb-dxDescent;
  const tCruise=nonneg(remainingX)/a.cruiseSpeed;
  const tAir=tClimb+tCruise+tDescent;
  const totalSec=tv+tAir;
  const dropT=tClimb+tCruise+(h-20*.3048)/descentRate;
  const cl=[a.clTakeoff,a.clCruise,a.clLanding], cd=[a.cdTakeoff,a.cdCruise,a.cdLanding];
  Object.assign(r,{
    climbSec:tClimb,cruiseSec:tCruise,descentSec:tDescent,
    routeTimeSec:totalSec,cruiseDistanceM:remainingX,
    routeOK:remainingX>=0,extraTimeTo15Sec:nonneg(ENDURANCE-totalSec),
    speedOK:Math.max(a.cruiseSpeed,takeoffV,landingV)<=MAX_SPEED,
  });
  const batteryWh=bat*VBAT*PACK_AH;
  r.energyWh=batteryWh;
  r.energyRemainingAfter15Pct=100*(1-electricalW*ENDURANCE/3600/batteryWh);
  r.energyRemainingAfterRoutePct=100*(1-electricalW*totalSec/3600/batteryWh);
  r.enduranceToReserveMin=60*(1-RESERVE)*batteryWh/electricalW;
  r.maxCurrentFor15A=(1-RESERVE)*bat*PACK_AH/(ENDURANCE/3600);
  r.endurance15OK=r.energyRemainingAfter15Pct+1e-8>=100*RESERVE;
  r.routeBatteryReserveOK=r.energyRemainingAfterRoutePct+1e-8>=100*RESERVE;
  for(let j=0;j<400;j++){
    const t=tAir*j/399;
    let stage=t<tClimb?1:(t<tClimb+tCruise && tCruise>0?2:3);
    const sp=stage===1?takeoffV:stage===2?a.cruiseSpeed:landingV;
    const vx=stage===2?sp:sp*Math.cos(theta);
    const vy=stage===1?sp*Math.sin(theta):stage===2?0:-sp*Math.sin(theta);
    const altitude=stage===1?vy*t:stage===2?h:nonneg(h-descentRate*(t-tClimb-tCruise));
    const mass=t>=dropT?mass1:mass0;
    const lift=.5*RHO*sp*sp*a.wingArea*cl[stage-1];
    const drag=.5*RHO*sp*sp*a.wingArea*cd[stage-1];
    const weight=mass*G;
    const thrustRequired=stage===1?drag+weight*Math.sin(theta):stage===2?drag:nonneg(drag-weight*Math.sin(theta));
    const thrustAvailable=Math.min(a.maxStaticThrust,propulsiveW/Math.max(sp,.1));
    const tm=thrustAvailable-thrustRequired;
    r.maxThrustRequiredN=Math.max(r.maxThrustRequiredN,thrustRequired);
    r.maxThrustAvailableN=Math.max(r.maxThrustAvailableN,thrustAvailable);
    if(lift+1e-8<weight*(1+margin))r.liftOK=false;
    if(stage===1){r.minClimbThrustMarginN=Math.min(r.minClimbThrustMarginN,tm);if(tm<0)r.climbThrustOK=false;}
    if(stage===2 && tm<0)r.cruiseThrustOK=false;
    if(stage===3 && tm<0)r.descentThrustOK=false;
    r.profile.push({timeSec:tv+t,altitudeFt:altitude/.3048,speed:sp,vx,vy,lift,weight,drag,
      cl:cl[stage-1],cd:cd[stage-1],reynolds:RHO*sp*a.meanChord/MU,
      thrustRequired,thrustAvailable,stage});
  }
  if(!Number.isFinite(r.minClimbThrustMarginN))r.minClimbThrustMarginN=0;
  r.points=[...r.roll.map(p=>({timeSec:p.timeSec,altitudeFt:0,speed:p.speed,vx:p.speed,vy:0,
    lift:p.lift,weight:mass0*G,drag:p.drag,cl:a.clTakeoff,cd:a.cdTakeoff,
    reynolds:RHO*p.speed*a.meanChord/MU,thrustRequired:NaN,
    thrustAvailable:p.thrust,stage:0})),...r.profile];
  return r;
}
export function suggestions(r) {
 const f=(v,n=1)=>Number(v).toFixed(n);
 const items=[];
 if(!r.massOK) items.push(`Reduce takeoff mass by at least ${f(r.massBefore-10,2)} kg. With ${r.batteryCount} batteries, airframe and systems must be ≤ ${f(r.suggestedAirframeMass,2)} kg.`);
 if(!r.runwayReachedSpeed) items.push(`Ground roll only reached ${f(r.runwayEndSpeed,2)} m/s versus ${f(r.requiredTakeoffSpeed,2)} m/s required. Investigate verified low-speed thrust, lower mass or a validated higher takeoff CLmax.`);
 if(!r.takeoffStageSpeedOK) items.push(`Takeoff-stage speed is too low. Estimate: cruise ≥ ${f(r.suggestedCruiseSpeed)} m/s, wing area ≥ ${f(r.theoreticalTakeoffAreaM2,2)} m² or takeoff CLmax ≥ ${f(r.theoreticalTakeoffCL,2)}. Check all against realistic limits.`);
 if(!r.climbThrustOK) items.push(`Climb thrust shortage of at least ${f(Math.max(0,-r.minClimbThrustMarginN))} N in the assumed model. Evaluate lower climb angle / drag and obtain measured propeller curves.`);
 if(!r.cruiseThrustOK||!r.descentThrustOK) items.push('Cruise or descent thrust check failed. Review stage aerodynamics and measured propulsion data.');
 if(!r.liftOK) items.push('At least one airborne stage lacks the selected lift margin. Review wing area, speed and airfoil CL data.');
 if(!r.endurance15OK) items.push(`Endurance/reserve fails. With ${r.batteryCount} batteries, nominal total current must be ≤ ${f(r.maxCurrentFor15A)} A for 15 minutes and 20% reserve. Reducing current may also reduce thrust.`);
 if(!r.speedOK) items.push('Speed exceeds 40 knots (20.58 m/s); lower the cruise-speed slider.');
 if(!r.routeOK) items.push('Climb and descent distances exceed the 4.02 km horizontal route. Revisit climb angle, speed or altitude.');
 if(r.extraTimeTo15Sec>0) items.push(`The plotted route takes ${f(r.routeTimeSec/60)} min; another ${f(r.extraTimeTo15Sec/60)} min of flight is needed for a 15-minute mission. That additional flight is not graphed.`);
 if(items.length===0)items.push('All simplified design checks pass. This does NOT establish physical feasibility or flight safety.');
 items.push('The 20-metre takeoff/landing box geometry remains unverified: the simulator does not apply a runway length limit.');
 return items;
}
