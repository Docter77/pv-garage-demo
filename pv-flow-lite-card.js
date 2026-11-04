import {watchGarageBackground} from './garage-render-pause.js?v=1';
const KEYS=['pv','east','west','pv_day','east_day','west_day','home','home_day','battery','battery_in','battery_out','soc','capacity','current','voltage','grid','frequency','import_day','export_day','car','car_soc','wr_temp','actuator_temp','battery_temp','ambient_temp','phase1','phase2','phase3','forecast_rest','forecast_tomorrow','forecast_next','autarky'];
const DAILY=['pv_day','east_day','west_day','home_day','import_day','export_day','battery_in','battery_out'];
const fmt=(v,unit='',digits=1)=>Number.isFinite(v)?v.toLocaleString('de-DE',{minimumFractionDigits:digits,maximumFractionDigits:digits})+(unit?' '+unit:''):'--';
const read=e=>typeof e?.state==='string'&&e.state.trim()!==''&&Number.isFinite(Number(e.state))?Number(e.state):null;
const ramp=(v,max=6000)=>Number.isFinite(v)?`hsl(${Math.max(0,200-Math.min(Math.abs(v)/max,1)*200)} 100% 58%)`:'#84939b';
export class PvFlowLiteCard extends HTMLElement {
 constructor(){super();this.attachShadow({mode:'open'});this._config={};this._y=false;}
 connectedCallback(){this._unwatch=watchGarageBackground(this,()=>{});}
 disconnectedCallback(){this._unwatch?.();}
 setConfig(c){this._config={...c,entities:{...c.entities},yesterday_entities:{...c.yesterday_entities}};this._signature=null;this._render();}
 set hass(h){this._hass=h;this._render();}
 getCardSize(){return 6;}
 _values(y=false){const m=y?this._config.yesterday_entities:this._config.entities;return Object.fromEntries(KEYS.map(k=>[k,read(this._hass?.states?.[m?.[k]])]));}
 _render(){
  const v={...this._values()},day=this._values(this._y);for(const k of DAILY)v[k]=day[k];const key=JSON.stringify([v,this._y]);if(key===this._signature)return;this._signature=key;
  const t=(x,y,s,c='#37d7ff',size=12,cls='digital')=>`<text x="${x}" y="${y}" text-anchor="middle" fill="${c}" font-size="${size}" class="${cls}">${s}</text>`;
  const glow=c=>`filter:drop-shadow(0 0 3px ${c}) drop-shadow(0 0 7px ${c})`;
  const line=(x1,y1,x2,y2,p,c)=>{if(!Number.isFinite(p))return `<path d="M${x1} ${y1}L${x2} ${y2}" fill="none" stroke="#63727c" stroke-dasharray="2 5"/>`;const r=p<0,a=Math.abs(p)>5;return `<path d="M${r?x2:x1} ${r?y2:y1}L${r?x1:x2} ${r?y1:y2}" fill="none" stroke="${a?c:'#34414a'}" stroke-width="${a?2:1}" ${a?'class="flow" marker-end="url(#arrow)"':''}/>`;};
  const panel=(x,c)=>`<g transform="translate(${x} 28)" style="${glow(c)}" stroke="#94c8df" stroke-width=".7"><path d="M12 0H84L100 54H0Z" fill="#1e5374"/><path d="M27 0L22 54M46 0L46 54M65 0L70 54M8 16H89M4 34H94"/><path d="M0 54H100L95 59H3Z" fill="#b5c0c9"/></g>`;
  const soc=Number.isFinite(v.soc)&&v.soc>=0&&v.soc<=100?v.soc:null,bc=soc===null?'#8a969b':soc<20?'#ff554d':soc<40?'#ffdc32':'#39ee91',hc=ramp(v.home),pc=ramp(v.pv),gc=v.grid===null?'#8a969b':v.grid>5?'#ff7652':'#53edb5';
  const energy=soc!==null&&Number.isFinite(v.capacity)?soc*v.capacity/100:null,fill=(soc??0)*.555;
  this.shadowRoot.innerHTML=`<style>
   @font-face{font-family:DemoDseg;src:url('./assets/DSEG7Classic-Bold.woff2') format('woff2');font-weight:700;font-display:swap;unicode-range:U+0030-0039,U+002C-002E}
   :host{display:block;color:#e5edf0;font:13px Arial,sans-serif;letter-spacing:0}*{box-sizing:border-box}.surface{background:#10191e;border:1px solid #34434b;border-radius:6px;padding:10px}.toolbar{display:flex;gap:8px;align-items:center;justify-content:flex-end}.toolbar span{margin-right:auto;color:#a6b4bd;font-size:12px}button{font:inherit;color:#37d7ff;background:#1b2a31;border:1px solid #58717c;border-radius:4px;min-height:36px;min-width:40px;padding:5px 9px;cursor:pointer}button[aria-pressed=true]{border-color:#f3d252;color:#f3d252}
   svg{display:block;width:100%;height:auto;overflow:visible}.digital{font-family:DemoDseg,Arial,sans-serif;font-weight:700}.label{font:8px Arial,sans-serif}.flow{stroke-dasharray:6 5;animation:flow 1.8s linear infinite}@keyframes flow{to{stroke-dashoffset:-22}}@media(prefers-reduced-motion:reduce){.flow{animation:none}}
   dialog{background:#172027;color:inherit;border:1px solid #62747f;border-radius:6px;max-width:min(480px,calc(100vw - 24px));width:100%;max-height:90dvh;overflow:auto;padding:18px}dialog::backdrop{background:#0009}dialog h3{margin:0;font-size:17px}table{width:100%;border-collapse:collapse;margin:16px 0}th,td{text-align:right;padding:9px 4px;border-bottom:1px solid #364750}th:first-child,td:first-child{text-align:left}dialog button{float:right}
   </style><div class="surface"><div class="toolbar"><span>Leistung jetzt · Energie ${this._y?'gestern':'heute'}</span><button id="y" title="Energie gestern; Leistungen bleiben aktuell" aria-pressed="${this._y}">Y</button><button id="stat" title="Energiestatistik">STAT</button></div>
   <svg viewBox="0 0 430 362" role="img" aria-label="PV Flow Demo mit Temperaturen, Energie und farbigen Fluessen"><defs><marker id="arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L8 4L0 8Z" fill="context-stroke"/></marker><linearGradient id="batteryFill"><stop stop-color="#b7ffe0"/><stop offset=".45" stop-color="${bc}"/><stop offset="1" stop-color="#21af76"/></linearGradient><linearGradient id="batteryEmpty"><stop stop-color="#e7edef"/><stop offset=".5" stop-color="#a3adb4"/><stop offset="1" stop-color="#f1f4f5"/></linearGradient></defs>
   <rect x="145" y="7" width="140" height="29" rx="2" fill="none" stroke="#425b68" stroke-width=".6"/>
   ${[['Rest',v.forecast_rest],['Morgen',v.forecast_tomorrow],['+2',v.forecast_next]].map(([s,n],i)=>t(169+i*46,17,s,'#b9c6cd',8,'label')+t(169+i*46,30,fmt(n),'#f3db38',9)).join('')}
   ${t(76,19,fmt(v.east_day,'kWh'),'#f3df34',12)}${t(354,19,fmt(v.west_day,'kWh'),'#73e875',12)}${panel(26,ramp(v.east,3000))}${panel(304,ramp(v.west,3000))}
   ${t(76,100,'Ost','#b8c6cc',8,'label')}${t(354,100,'West','#b8c6cc',8,'label')}${t(165,108,fmt(v.east,'W',0),ramp(v.east,3000),11)}${t(263,108,fmt(v.west,'W',0),ramp(v.west,3000),11)}${t(215,52,fmt(v.pv_day,'kWh'),'#f3db38',12)}${t(215,71,fmt(v.pv,'W',0),pc,15)}
   ${line(129,83,205,83,v.east,ramp(v.east,3000))}${line(302,83,225,83,v.west,ramp(v.west,3000))}${line(215,102,215,138,v.pv,pc)}
   ${t(174,126,'H: '+fmt(v.wr_temp,'°C'),ramp(v.wr_temp,85),9)}${t(250,126,'B: '+fmt(v.actuator_temp,'°C'),ramp(v.actuator_temp,85),9)}
   <g style="${glow(pc)}"><rect x="182" y="143" width="66" height="69" rx="5" fill="#ced3d6" stroke="#829097" stroke-width="2"/><rect x="191" y="151" width="48" height="44" rx="2" fill="#192a34"/><rect x="197" y="157" width="36" height="6" rx="1" fill="#4aa2bf"/>${t(215,185,'WR','#c5e4ef',14,'plain')}<path d="M193 202H237" stroke="#69777f" stroke-width="2"/></g>
   ${t(68,129,fmt(v.car,'W',0),ramp(v.car,7400),14)}<g style="${glow(ramp(v.car,7400))}" transform="translate(24 147)" fill="#c7d5de" stroke="#839ca9"><path d="M12 20L24 2H72L84 20L90 41H6Z"/><path d="M28 6H68L76 21H20Z" fill="#183445"/><circle cx="18" cy="43" r="7" fill="#19272f"/><circle cx="78" cy="43" r="7" fill="#19272f"/></g>${t(70,215,fmt(v.car_soc,'%'),'#70da93',11)}${t(70,229,'Auto · Beispieldaten','#b4c2c9',8,'label')}
   ${t(358,123,'H: '+fmt(v.ambient_temp)+'  B: '+fmt(v.battery_temp)+' °C','#8cdea0',9)}
   <g transform="translate(-70 -20) scale(1.2)" style="${glow(bc)}"><image href="./assets/battery.svg" x="314.5" y="125.4" width="66.5" height="69.1" preserveAspectRatio="none"/><rect x="337.8" y="135" width="38.4" height="55.5" fill="url(#batteryEmpty)"/><rect x="337.8" y="${190.5-fill}" width="38.4" height="${fill}" fill="url(#batteryFill)"/></g>
   ${line(253,173,320,173,v.battery===null?null:-v.battery,bc)}${t(284,162,fmt(v.battery,'W',0),bc,10)}${t(284,190,fmt(v.current,'A'),bc,10)}${t(284,205,fmt(v.voltage,'V'),'#a7bbc6',9)}${t(358,230,fmt(soc,'%',1),bc,18)}${t(358,246,fmt(energy,'kWh'),bc,12)}
   <image href="./assets/house.png" x="24" y="251" width="95" height="71" style="${glow(hc)}"/>${t(73,245,fmt(v.autarky,'%'),'#75de90',11)}${t(73,338,fmt(v.home,'W',0),hc,15)}${t(73,356,fmt(v.home_day,'kWh'),hc,12)}
   ${line(215,219,215,287,v.home,hc)}${line(206,293,126,293,v.home,hc)}${line(110,254,110,213,v.car,ramp(v.car,7400))}${line(310,293,225,293,v.grid,gc)}
   <g transform="translate(331 265)" stroke="#a8bcc7" stroke-width="2" fill="none" style="${glow(gc)}"><path d="M3 44L26 0L49 44M14 21H38M8 34H44M21 9L41 44M31 9L11 44M12 15H40M6 28H46"/></g>${t(270,270,fmt(v.grid===null?null:Math.abs(v.grid),'W',0),gc,11)}${t(270,280,v.grid===null?'Netz':v.grid<0?'Einspeisung':'Bezug',gc,8,'label')}
   ${t(358,327,fmt(v.frequency,'Hz',2),'#54cfff',10)}${t(358,343,'Bezug '+fmt(v.import_day,'kWh'),'#ffbe54',10)}${t(358,358,'Einsp. '+fmt(v.export_day,'kWh'),'#61e69f',10)}${t(215,326,'L1 / L2 / L3 · W','#a4b5bf',8,'label')}${t(215,340,[v.phase1,v.phase2,v.phase3].map(n=>fmt(n,'',0)).join(' / '),'#3cd6ff',10)}
   </svg></div>`;
  this.shadowRoot.getElementById('y').onclick=()=>{this._y=!this._y;this._render();};this.shadowRoot.getElementById('stat').onclick=()=>this._stats();
 }
 _stats(){const a=this._values(),b=this._values(true),d=document.createElement('dialog');d.innerHTML=`<h3>Energiestatistik</h3><table><thead><tr><th>kWh</th><th>Heute</th><th>Gestern</th></tr></thead><tbody>${[['PV','pv_day'],['Ost','east_day'],['West','west_day'],['Haus','home_day'],['Netzbezug','import_day'],['Einspeisung','export_day'],['Batterie geladen','battery_in'],['Batterie entladen','battery_out']].map(([n,k])=>`<tr><td>${n}</td><td>${fmt(a[k])}</td><td>${fmt(b[k])}</td></tr>`).join('')}</tbody></table><button>OK</button>`;this.shadowRoot.append(d);d.querySelector('button').onclick=()=>d.close();d.onclose=()=>d.remove();d.showModal();}
}
if(!customElements.get('pv-flow-lite-card'))customElements.define('pv-flow-lite-card',PvFlowLiteCard);
