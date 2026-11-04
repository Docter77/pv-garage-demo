import * as A from './astronomy-engine-2.1.19.js';

const DAY = 86400000, AU = 149597870.7;
const ms = time => +time.date;
function eventPosition(body, time, observer) {
  const date = new Date(time), eq = A.Equator(body, date, observer, true, true);
  const h = A.Horizon(date, observer, eq.ra, eq.dec, 'normal');
  const az = h.azimuth * Math.PI / 180, el = h.altitude * Math.PI / 180;
  return { azimuth:h.azimuth, elevation:h.altitude,
    vector:[Math.cos(el)*Math.sin(az), Math.sin(el), -Math.cos(el)*Math.cos(az)] };
}
function altitude(body, time, observer) {
  const eq = A.Equator(body, new Date(time), observer, true, true);
  return A.Horizon(new Date(time), observer, eq.ra, eq.dec, 'normal').altitude;
}
function visibility(body, start, end, peak, observer) {
  let visible = false;
  // Include the exact peak as well as one-minute samples of every eclipse phase.
  for (let t = start; t <= end; t += 60000) visible ||= altitude(body, t, observer) > 0;
  const peakAltitude = altitude(body, peak, observer);
  return { visible: visible || peakAltitude > 0 || altitude(body, end, observer) > 0, peakAltitude };
}
function solarDiscs(time, observer) {
  const sun = A.Equator(A.Body.Sun, new Date(time), observer, false, true);
  const moon = A.Equator(A.Body.Moon, new Date(time), observer, false, true);
  const r = Math.asin(695700 / (sun.dist * AU));
  return { radius: Math.asin(1736 / (moon.dist * AU)) / r,
    separation: A.AngleBetween(sun.vec, moon.vec) * Math.PI / 180 / r };
}
function lunarDiscs(time) {
  // Shadow-cone geometry and radii match Astronomy Engine EarthShadow/CalcShadow (MIT).
  const sun = A.GeoVector(A.Body.Sun, new Date(time), true), moon = A.GeoMoon(new Date(time));
  const e = { x:-sun.x, y:-sun.y, z:-sun.z };
  const u = (e.x*moon.x + e.y*moon.y + e.z*moon.z) / (e.x*e.x + e.y*e.y + e.z*e.z);
  return { radius: (695700 - (1+u)*(695700-6459)) / 1737.4,
    penumbra: (-695700 + (1+u)*(695700+6459)) / 1737.4,
    separation: AU * Math.hypot(u*e.x-moon.x, u*e.y-moon.y, u*e.z-moon.z) / 1737.4 };
}

export function buildEclipses({ startDate, endDate, latitude, longitude, timeZone }) {
  const observer = new A.Observer(latitude, longitude, 0);
  const start = Date.parse(startDate+'T00:00:00Z') - DAY;
  const end = Date.parse(endDate+'T00:00:00Z') + 2*DAY;
  const dateFormat = new Intl.DateTimeFormat('en-CA', { timeZone, year:'numeric', month:'2-digit', day:'2-digit' });
  const dayKey = time => {
    const p = Object.fromEntries(dateFormat.formatToParts(new Date(time)).map(p=>[p.type,p.value]));
    return `${p.year}-${p.month}-${p.day}`;
  };
  const local = [];
  for (let e = A.SearchLocalSolarEclipse(new Date(start), observer); ms(e.peak.time) < end;
       e = A.NextLocalSolarEclipse(e.peak.time, observer)) local.push(e);
  const events = [];
  for (let e = A.SearchGlobalSolarEclipse(new Date(start)); ms(e.peak) < end;
       e = A.NextGlobalSolarEclipse(e.peak)) {
    const match = local.find(l=>Math.abs(ms(l.peak.time)-ms(e.peak)) < DAY);
    const peak = match ? ms(match.peak.time) : ms(e.peak);
    const sight = match ? visibility(A.Body.Sun, ms(match.partial_begin.time), ms(match.partial_end.time), peak, observer)
      : { visible:false, peakAltitude:altitude(A.Body.Sun, peak, observer) };
    events.push({ body:'sun', kind:match?.kind || e.kind, globalKind:e.kind, peak,
      local:!!match, ...sight, obscuration:match?.obscuration ?? null,
      discs:match ? solarDiscs(peak, observer) : null });
  }
  for (let e = A.SearchLunarEclipse(new Date(start)); ms(e.peak) < end;
       e = A.NextLunarEclipse(e.peak)) {
    const peak = ms(e.peak), duration = e.sd_penum*60000;
    events.push({ body:'moon', kind:e.kind, globalKind:e.kind, local:true, peak,
      ...visibility(A.Body.Moon, peak-duration, peak+duration, peak, observer),
      obscuration:e.obscuration, discs:lunarDiscs(peak) });
  }
  return events.map(e=>({ ...e, date:dayKey(e.peak),
    day:Math.round((Date.parse(dayKey(e.peak)+'T00:00:00Z') - Date.parse(startDate+'T00:00:00Z'))/DAY) }))
    .filter(e=>e.date>=startDate && e.date<=endDate).sort((a,b)=>a.peak-b.peak)
    .map(e=>({ ...e, positions:{ sun:eventPosition(A.Body.Sun,e.peak,observer), moon:eventPosition(A.Body.Moon,e.peak,observer) } }));
}
