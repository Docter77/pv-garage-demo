import './pv-flow-lite-card.js';
import './garage-sun-moon-demo.js?v=20261114a';
import {advanceDay,initialValues,dailyKeys} from './demo-day-model-v1.js';
import {garageBackgroundPaused} from './garage-render-pause.js?v=1';
import {demoWeather} from './demo-weather.js?v=20261114a';
const card=document.querySelector('pv-flow-lite-card'),weather=document.getElementById('scenario'),play=document.getElementById('animate'),clock=document.getElementById('demo-clock');
let values=initialValues(),minute=360,day=1,timer=null,weatherTick=0;
function currentWeather(){return demoWeather(weather.value,weatherTick);}
function renderWeather(){const w={...currentWeather(),pvEastWatts:values.east,pvWestWatts:values.west};document.querySelector('garage-sun-moon-demo').setWeather(w);document.getElementById('weather-now').textContent=w.label;}
let yesterday={pv_day:24,east_day:13,west_day:11,home_day:18,import_day:4,export_day:6,battery_in:6,battery_out:5};
card.setConfig({entities:Object.fromEntries(Object.keys(values).map(k=>[k,'sensor.demo_'+k])),yesterday_entities:Object.fromEntries(dailyKeys.map(k=>[k,'sensor.demo_yesterday_'+k])),grid_values:2});
// Start at dawn with counters and SOC consistent with the preceding night.
for(let m=0;m<360;m+=10)values=advanceDay(values,m,currentWeather().energy);
function render(){
 const states={};for(const [k,v]of Object.entries(values))states['sensor.demo_'+k]={state:String(v)};
 for(const [k,v]of Object.entries(yesterday))states['sensor.demo_yesterday_'+k]={state:String(v)};
 card.hass={states};clock.textContent=`Day ${day} · ${String(Math.floor(minute/60)).padStart(2,'0')}:${String(minute%60).padStart(2,'0')}`;
}
function cancel(){clearTimeout(timer);timer=null;}
function schedule(){
 cancel();if(!play.checked||document.hidden||!card.isConnected)return;
 timer=setTimeout(()=>{
  timer=null;
  if(!document.hidden)weatherTick++;
  if(!document.hidden&&!garageBackgroundPaused()&&!card.shadowRoot.querySelector('dialog[open]')){
   values=advanceDay(values,minute,currentWeather().energy);minute+=10;
   if(minute>=1440){minute=0;day++;yesterday=Object.fromEntries(dailyKeys.map(k=>[k,values[k]]));for(const k of dailyKeys)values[k]=0;}
   render();
  }if(!document.hidden)renderWeather();schedule();
 },2000);
}
// Weather changes do not reset the clock, battery or accumulated energy.
weather.addEventListener('change',()=>{renderWeather();schedule();});play.addEventListener('change',schedule);
document.addEventListener('visibilitychange',schedule);window.addEventListener('pagehide',cancel);window.addEventListener('pageshow',schedule);
render();renderWeather();schedule();
