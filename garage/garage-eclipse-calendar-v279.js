const TYPES = { partial:'Partiell', total:'Total', annular:'Ringfoermig', penumbral:'Halbschatten' };
const bodyName = event => event.body === 'sun' ? 'Sonnenfinsternis' : 'Mondfinsternis';

export function eclipseTimeline(days, events, duration = 30000) {
  const marked = new Set(events.map(e=>e.day));
  const hold = marked.size ? Math.min(1800, duration * .45 / marked.size) : 0;
  const step = (duration - hold * marked.size) / (days - marked.size);
  let total = 0;
  return Array.from({ length:days }, (_, i)=>(total += marked.has(i) ? hold : step));
}

export class EclipseCalendar {
  constructor(preview) {
    this.preview = preview;
    const root = preview.view.root;
    this.layout = root.querySelector('.expanded-layout');
    this.style = document.createElement('style');
    this.style.textContent = `
      .expanded-layout.eclipse-calendar-running{grid-template-rows:auto auto minmax(0,1fr) auto}
      .eclipse-calendar[hidden]{display:none}
      .eclipse-calendar{display:grid;grid-template-columns:minmax(120px,220px) 76px minmax(0,1fr);align-items:center;gap:8px;padding:6px 12px;border-bottom:1px solid #324451;min-height:78px;box-sizing:border-box;font:12px Arial;color:#e7edf0}
      .eclipse-calendar select{min-width:0;width:100%;height:28px;color:inherit;background:#17232b;border:1px solid #53616c;border-radius:4px;font:12px Arial}
      .eclipse-calendar canvas{width:72px;height:72px}
      .eclipse-calendar strong,.eclipse-calendar span{display:block;overflow-wrap:anywhere;line-height:1.4}
      .eclipse-calendar .eclipse-note{color:#b7c2c8;font-size:11px}
      .year-timeline{grid-column:1/-1;display:grid;grid-template-columns:28px minmax(0,1fr) 84px;align-items:center;gap:8px;min-width:0;padding-top:4px;border-top:1px solid #324451}
      .year-timeline button{width:28px;height:26px;padding:4px;color:#61d4ff;background:#17232b;border:1px solid #53616c;border-radius:4px;cursor:pointer}
      .year-timeline button svg{display:block;width:16px;height:16px;margin:auto}
      .year-timeline input{width:100%;min-width:0;margin:0;accent-color:#61d4ff;cursor:ew-resize}
      .year-timeline output{font:12px Arial;color:#e7edf0;text-align:right;white-space:nowrap}
      @media(max-width:600px){.eclipse-calendar{grid-template-columns:60px minmax(0,1fr);gap:2px 8px;padding:5px 10px}.eclipse-calendar select{grid-column:1/-1;height:24px}.eclipse-calendar canvas{width:56px;height:56px}.eclipse-calendar strong,.eclipse-calendar span{line-height:1.2;font-size:11px}}
    `;
    root.append(this.style);
    this.panel = document.createElement('section'); this.panel.className = 'eclipse-calendar'; this.panel.hidden = true;
    this.panel.setAttribute('aria-label', 'Finsternisse im Kalenderflug');
    this.select = document.createElement('select'); this.select.setAttribute('aria-label', 'Zu einer Finsternis springen');
    this.canvas = document.createElement('canvas'); this.canvas.width = this.canvas.height = 144;
    this.canvas.title = 'Geometrie am Maximum; Ausrichtung und Schattenhelligkeit schematisch. Sichtbarkeit ohne Wetter, Gebaeude und Gelaende.';
    this.text = document.createElement('div');
    this.title = document.createElement('strong'); this.when = document.createElement('span');
    this.sight = document.createElement('span'); this.note = document.createElement('span'); this.note.className = 'eclipse-note';
    this.text.append(this.title, this.when, this.sight, this.note);
    this.panel.append(this.select, this.canvas, this.text);
    this.timeline = document.createElement('div'); this.timeline.className = 'year-timeline';
    this.play = document.createElement('button'); this.play.type = 'button';
    this.play.onclick = () => preview.togglePlayback();
    this.slider = document.createElement('input'); this.slider.type = 'range';
    this.slider.min = '0'; this.slider.step = '1';
    this.slider.setAttribute('aria-label', 'Datum im Kalenderflug');
    this.slider.addEventListener('pointerdown', () => preview.pausePlayback());
    this.slider.addEventListener('input', () => preview.seekDay(Number(this.slider.value)));
    this.slider.addEventListener('wheel', event => {
      if (!preview.running || !event.deltaY) return;
      event.preventDefault();
      preview.seekDay(Number(this.slider.value) + Math.sign(event.deltaY) * (event.shiftKey ? 7 : 1));
    }, { passive:false });
    this.date = document.createElement('output');
    this.timeline.append(this.play, this.slider, this.date);
    this.panel.append(this.timeline);
    this.layout.insertBefore(this.panel, root.querySelector('.expanded-body'));
    this.select.onchange = () => {
      const event = this.events[Number(this.select.value)];
      if (!event || !preview.running) return;
      preview.seekDay(event.day, false);
    };
  }

  begin(cache, timeZone) {
    this.slider.max = String(cache.days - 1);
    this.slider.title = `${cache.dates[0]} - ${cache.dates.at(-1)}`;
    this.syncPlayback();
    this.events = cache.eclipses || [];
    this.format = new Intl.DateTimeFormat('de-DE', { timeZone, day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit', hourCycle:'h23' });
    this.select.replaceChildren(new Option(`Finsternisse (${this.events.length})`, '-1'));
    this.events.forEach((event,i)=>this.select.add(new Option(`${event.date.slice(8)}.${event.date.slice(5,7)}. ${bodyName(event)}${event.visible ? ' *' : ''}`, String(i))));
    this.select.title = '* Am gewaehlten Standort zumindest zeitweise ueber dem Horizont';
    this.select.disabled = !this.events.length;
    this.panel.hidden = !this.preview.view.expanded;
    this.layout.classList.toggle('eclipse-calendar-running', !this.panel.hidden);
  }

  draw(day) {
    this.slider.value = String(day);
    this.date.textContent = this.preview.cache.dates[day];
    this.slider.setAttribute('aria-valuetext', this.preview.cache.dates[day]);
    const index = this.events.findIndex(e=>e.day === day), event = this.events[index];
    this.select.value = String(index);
    const ctx = this.canvas.getContext('2d'); ctx.clearRect(0,0,144,144);
    if (!event) {
      this.title.textContent = 'Finsternisse im Jahreslauf';
      this.when.textContent = `${this.events.length} Ereignisse · ${this.preview.locationLabel}`;
      this.sight.textContent = ''; this.note.textContent = '';
      this.canvas.setAttribute('aria-label', 'Kein Finsternis-Ereignis am angezeigten Tag');
      return;
    }
    this.title.textContent = `${bodyName(event)} · ${TYPES[event.kind] || event.kind}`;
    this.when.textContent = `${this.format.format(event.peak)} · Maximum (${event.local ? 'lokal' : 'global'})`;
    this.sight.textContent = event.visible ? (event.peakAltitude > 0 ? 'Hier sichtbar (astronomisch)' : 'Hier teilweise sichtbar; Maximum unter Horizont')
      : event.body === 'sun' && !event.local ? 'Hier keine sichtbare Bedeckung' : 'Hier unter dem Horizont';
    this.note.textContent = event.obscuration == null ? `Weltweit: ${TYPES[event.globalKind]}`
      : event.kind === 'penumbral' ? 'Halbschatten: leichte Abdunklung, kein Kernschatten'
      : `${event.body === 'sun' ? 'Sonnenflaeche bedeckt' : 'Mondflaeche im Kernschatten'}: ${(event.obscuration*100).toFixed(1)} %`;
    this.canvas.setAttribute('role','img'); this.canvas.setAttribute('aria-label', `${this.title.textContent}. ${this.note.textContent}`);
    const circle = (x,r,color)=>{ctx.beginPath();ctx.arc(x,72,r,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();};
    const radius=46;
    circle(72,radius,event.body==='sun'?'#ffe94d':'#e1e8ee');
    if (!event.discs) { ctx.fillStyle='#101820';ctx.font='bold 16px Arial';ctx.textAlign='center';ctx.fillText('--',72,78);return; }
    ctx.save();ctx.beginPath();ctx.arc(72,72,radius,0,Math.PI*2);ctx.clip();
    const x=72+event.discs.separation*radius;
    if (event.body==='moon') {
      const inner=Math.max(0,event.discs.radius*radius), outer=event.discs.penumbra*radius;
      const gradient=ctx.createRadialGradient(x,72,inner,x,72,outer);
      gradient.addColorStop(0,'rgba(20,16,24,0.9)');gradient.addColorStop(1,'rgba(20,16,24,0)');
      circle(x,outer,gradient);circle(x,inner,'#542d29');
    } else circle(x,event.discs.radius*radius,'#101820');
    ctx.restore();
  }

  syncPlayback() {
    const paused = !!this.preview.manualPaused;
    this.play.title = paused ? 'Kalenderflug fortsetzen' : 'Kalenderflug pausieren';
    this.play.setAttribute('aria-label', this.play.title);
    this.play.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${paused ? '<path d="m7 4 14 8-14 8z"/>' : '<path d="M6 4h4v16H6zm8 0h4v16h-4z"/>'}</svg>`;
  }

  stop() { this.panel.hidden = true; this.layout.classList.remove('eclipse-calendar-running'); }
  dispose() { this.stop(); this.panel.remove(); this.style.remove(); }
}
