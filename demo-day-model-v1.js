export const dailyKeys=['pv_day','east_day','west_day','home_day','import_day','export_day','battery_in','battery_out'];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const bump=(minute,center,width)=>Math.exp(-(((minute-center)/width)**2));
export function loadsAt(minute,weather='sun'){
 const daylight=Math.max(0,Math.sin(Math.PI*(minute-360)/720));
 const cloud=weather==='overcast'?.25:weather==='cloud'?.72:1;
 const dip=1-(weather==='sun'?.12:.82)*bump(minute,775,32)-.25*bump(minute,610,24);
 const pv=minute>360&&minute<1080?Math.round(5800*daylight**1.65*cloud*dip):0;
 const house=Math.round(210+45*Math.sin(minute/37)**2+1650*bump(minute,430,27)+1100*bump(minute,750,34)+2200*bump(minute,1130,40)+450*bump(minute,1260,85));
 const car=minute>=690&&minute<840?2300:minute>=1110&&minute<1200?1800:0;
 return{pv,house,car};
}
function expectedRest(minute,weather){let total=0;for(let m=Math.max(minute,360);m<1080;m+=10)total+=loadsAt(m+5,weather).pv/1000/6;return total;}
export function initialValues(){return{pv:0,east:0,west:0,...Object.fromEntries(dailyKeys.map(k=>[k,0])),home:0,battery:0,soc:52,capacity:7.44,current:0,voltage:313,grid:0,frequency:50,car:0,car_soc:38,wr_temp:22,actuator_temp:20,battery_temp:18,ambient_temp:11,phase1:0,phase2:0,phase3:0,forecast_rest:0,forecast_tomorrow:22,forecast_next:15,autarky:0};}
export function advanceDay(previous,minute,weather='sun',hours=1/6){
 const v={...previous},load=loadsAt(minute,weather);hours=Math.max(0,hours);
 // A daily example drive consumes car energy while it is not charging.
 if(minute===360&&hours>0)v.car_soc=Math.max(15,v.car_soc-18);
 const car=hours?Math.min(load.car,Math.max(0,90-v.car_soc)/100*44*1000/hours):load.car;
 const home=load.house+car,pv=load.pv;
 let battery=clamp(home-pv,-2400,1400);
 if(hours)battery=clamp(battery,-Math.max(0,95-v.soc)/100*v.capacity*1000/hours,Math.max(0,v.soc-15)/100*v.capacity*1000/hours);
 const grid=home-pv-battery,east=Math.round(pv*clamp(.85-(minute-360)/720*.7,.15,.85)),west=pv-east;
 const energy=w=>w*hours/1000;
 v.soc=clamp(v.soc-energy(battery)/v.capacity*100,15,95);v.car_soc=clamp(v.car_soc+energy(car)/44*100,0,90);
 Object.assign(v,{pv,east,west,home,car,battery,grid,phase1:load.house*.4+car,phase2:load.house*.35,phase3:load.house*.25,
  voltage:300+v.soc*.22,ambient_temp:11+9*Math.max(0,Math.sin(Math.PI*(minute-360)/900)),wr_temp:22+pv/420,actuator_temp:20+pv/600,battery_temp:18+Math.abs(battery)/900,
  frequency:50+.01*Math.sin(minute/19),forecast_rest:expectedRest(minute,weather)});
 v.current=battery/v.voltage;
 for(const [k,p]of Object.entries({pv_day:pv,east_day:east,west_day:west,home_day:home,import_day:Math.max(0,grid),export_day:Math.max(0,-grid),battery_in:Math.max(0,-battery),battery_out:Math.max(0,battery)}))v[k]+=energy(p);
 v.autarky=clamp(100*(1-v.import_day/Math.max(.001,v.home_day)),0,100);return v;
}
