import {GarageOrbit3D} from './garage/garage-orbit-3d-v283.js';
import SunCalc from './garage/suncalc-1.9.0.esm.js';
import {planetPosition} from './garage/garage-planet-position-v1.js';
const D=180/Math.PI,lat=52,lon=13;
const at=(time,moon=false)=>{const p=moon?SunCalc.getMoonPosition(new Date(time),lat,lon):SunCalc.getPosition(new Date(time),lat,lon);return {time,azimuth:(p.azimuth*D+180)%360,elevation:p.altitude*D};};
const clock=d=>d instanceof Date&&Number.isFinite(+d)?d.toISOString().slice(11,16):'--:--';
export class GarageSunMoonDemo extends HTMLElement {
 constructor(){super();this.attachShadow({mode:'open'});this.minute=720;}
 connectedCallback(){
  if(this.view)return;
  this.shadowRoot.innerHTML=`<style>:host{display:block;color:#e7edf0;font:13px Arial,sans-serif;letter-spacing:0}*{box-sizing:border-box}.tools{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:0 0 12px}input{font:inherit;background:#18262e;color:inherit;border:1px solid #506b79;border-radius:4px;padding:6px;min-height:36px;max-width:100%}.stage{height:480px;max-height:70vh;display:grid;grid-template-columns:minmax(0,1fr) 54px;min-width:0}.host{height:100%;min-width:0}.time{display:flex;align-items:center;gap:8px;margin-top:12px}.time input{flex:1;min-width:0}output{min-width:42px;font-variant-numeric:tabular-nums}.legend{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;color:#9dafb9;margin-top:12px;font-size:12px}@media(max-width:500px){.stage{height:360px}}.error{padding:20px;color:#ffa172}</style>
   <style>.stage{position:relative}.rail-times{position:absolute;right:0;top:96px;width:52px;margin:0;padding:0;list-style:none;display:grid;gap:9px}.rail-times li{display:flex;align-items:baseline;justify-content:space-between;gap:2px}.rail-times .name{font:8px Arial}.rail-times .number{font:700 9px DemoDseg,Arial}.metrics{margin-top:16px;display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px}.metric{min-width:0;display:flex;flex-direction:column;gap:7px}.metric label{font-size:10px;color:#a9bac5}.metric .number{font:700 15px DemoDseg,Arial;white-space:nowrap}.metric .direction{font:11px Arial;color:#8ed8ef;min-height:13px}@media(max-width:600px){.metrics{grid-template-columns:repeat(3,minmax(0,1fr));row-gap:14px}}</style>
   <div class="tools"><input type="date" aria-label="Datum" id="date"><span>Demo-Standort 52° N / 13° O</span></div><div class="stage"><div class="host"></div><ul class="rail-times" id="times" aria-label="Sonnen- und Mondzeiten"></ul></div><div class="metrics" id="metrics" aria-label="Sonnen- und Mondwerte"></div><label class="time"><input type="range" min="0" max="1439" value="720" aria-label="Uhrzeit UTC" id="time"><output>12:00</output><span>UTC</span></label><div class="legend"><span id="sun"></span><span id="moon"></span></div>`;
  this.shadowRoot.getElementById('date').value=new Date().toISOString().slice(0,10);
  try{this.view=new GarageOrbit3D(this.shadowRoot.querySelector('.host'));}catch{this.shadowRoot.querySelector('.stage').innerHTML='<div class="error">3D nicht verfuegbar (WebGL).</div>';return;}
  this.shadowRoot.getElementById('date').onchange=()=>{this.view.annualPreview.stop();this.update(true);};
  this.shadowRoot.getElementById('time').oninput=e=>{this.view.annualPreview.stop();this.minute=Number(e.target.value);this.update();};
  this.update(true);this.view.setActive(true);
  this.observer=new IntersectionObserver(entries=>{this.view?.setActive(entries.some(e=>e.isIntersecting)||!!this.view?.expanded);});this.observer.observe(this);
 }
 update(rebuild=false){
  const date=this.shadowRoot.getElementById('date').value,base=Date.parse(date+'T00:00:00Z');if(!Number.isFinite(base)||!this.view)return;
  const now=base+this.minute*60000,sun=at(now),moon=at(now,true),times=SunCalc.getTimes(new Date(base+43200000),lat,lon),mt=SunCalc.getMoonTimes(new Date(base),lat,lon,true);
  if(rebuild||this.day!==date){
   this.day=date;this.tracks={key:date,sunDayKey:date,sun:[],moon:[],events:[]};this.planetTracks={};
   for(let m=0;m<=1440;m+=10){const time=base+m*60000;this.tracks.sun.push(at(time));this.tracks.moon.push(at(time,true));}
   for(const [label,time]of [['SR',times.sunrise],['SN',times.solarNoon],['SS',times.sunset],['MR',mt.rise],['MS',mt.set]])if(time&&Number.isFinite(+time))this.tracks.events.push({label,...at(+time,label.startsWith('M'))});
   for(const id of ['mercury','venus','mars','jupiter']){
    const upper=[],lower=[];let run=[],last=null;
    for(let m=0;m<=1440;m+=10){const time=base+m*60000,p=planetPosition(id,new Date(time),lat,lon),part=p.elevation>=0;
     if(at(time).elevation>0){if(run.length>1)(last?upper:lower).push(run);run=[];last=null;continue;}
     if(last!==null&&part!==last){if(run.length>1)(last?upper:lower).push(run);run=[];}
     run.push({...p,time});last=part;
    }if(run.length>1)(last?upper:lower).push(run);this.planetTracks[id]={segments:upper,nightSegments:lower};
   }
  }
  const tomorrow=SunCalc.getTimes(new Date(base+86400000+43200000),lat,lon);
  const dl=(+times.sunset-+times.sunrise)/3600000,metrics=[['Sun',sun.elevation,'#ffff00'],['Moon',moon.elevation,'#29a9ff'],['DayL',dl,'#6be997'],['NightL',24-dl,'#7dbaff'],['T2SS',((now<=+times.sunset?+times.sunset:+tomorrow.sunset)-now)/3600000,'#ffff00'],['T2SR',((now<=+times.sunrise?+times.sunrise:+tomorrow.sunrise)-now)/3600000,'#7dbaff']].map(([label,value,color])=>({label,value:Number.isFinite(value)?value.toFixed(1):'--',color}));
  const bearing=a=>['N','NO','O','SO','S','SW','W','NW'][Math.round(a/45)%8];
  metrics[0].direction=bearing(sun.azimuth);metrics[1].direction=bearing(moon.azimuth);
  const highest=this.tracks.moon.reduce((a,b)=>a.elevation>b.elevation?a:b);let peak=null;
  if(highest.time>base&&highest.time<base+86400000){let lo=highest.time-600000,hi=highest.time+600000;for(let i=0;i<24;i++){const a=lo+(hi-lo)/3,b=hi-(hi-lo)/3;if(at(a,true).elevation<at(b,true).elevation)lo=a;else hi=b;}peak=new Date((lo+hi)/2);}
  const eventTimes=[['SR',clock(times.sunrise),'#ffff00'],['SE','--:--','#7c8d97'],['SN',clock(times.solarNoon),'#6ad8ff'],['SS',clock(times.sunset),'#ffbd57'],['MR',clock(mt.rise),'#29a9ff'],['MN',clock(peak),'#29a9ff'],['MS',clock(mt.set),'#29a9ff']];
  this.shadowRoot.getElementById('times').innerHTML=eventTimes.map(([label,value,color])=>`<li title="${label==='SE'?'Schattenende: kein Schattenmodell am Demo-Standort':'Uhrzeit UTC'}"><span class="name">${label}</span><span class="number" style="color:${color}">${value}</span></li>`).join('');
  this.shadowRoot.getElementById('metrics').innerHTML=metrics.map(m=>`<div class="metric"><label>${m.label}</label><span class="number" style="color:${m.color}">${m.value}</span><span class="direction">${m.direction||'h'}</span></div>`).join('');
  this.view.update({now,solarYear:{latitude:lat,longitude:lon,timeZone:'UTC'},houseDay:null,
   display:{numberMode:'dseg',times:eventTimes,metrics},
   model:{width:6,length:6,wallHeight:2.5,pitch:34,roofAzimuth:90,surroundings:{enabled:false,buildings:[]},detailOrbitRadius:20},
   sun:{...sun,shadowLevel:0,shadowColor:'#ffff00'},moon:{...moon,icon:new URL('./assets/moon.svg',import.meta.url).href},tracks:this.tracks,
   planets:{key:date,defaultVisible:false,bodies:[['mercury','Merkur','#d7d2c4'],['venus','Venus','#b9e5ff'],['mars','Mars','#ff7b55'],['jupiter','Jupiter','#ffe0a3']].map(([id,label,color])=>({id,label,color,...planetPosition(id,new Date(now),lat,lon),...this.planetTracks[id]}))}
  });
  this.shadowRoot.querySelector('output').textContent=clock(new Date(now));
  this.shadowRoot.getElementById('sun').textContent=`Sonne ${sun.elevation.toFixed(1)}° · SR ${clock(times.sunrise)} / SS ${clock(times.sunset)}`;
  this.shadowRoot.getElementById('moon').textContent=`Mond ${moon.elevation.toFixed(1)}°`;
 }
 disconnectedCallback(){this.observer?.disconnect();this.view?.dispose();this.view=null;}
}
customElements.define('garage-sun-moon-demo',GarageSunMoonDemo);
