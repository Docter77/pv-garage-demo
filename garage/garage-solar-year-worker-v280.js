import SunCalc from './suncalc-1.9.0.esm.js';
import { planetPosition } from './garage-planet-position-v1.js';
import { buildEclipses } from './garage-eclipses-v280.js';

const DAY = 86400000;
const POINTS = 97;
const MOON_STEPS = 144;
const MOON_SEGMENTS = MOON_STEPS + 2;
const PLANET_STEPS = 96;
const PLANET_SEGMENTS = PLANET_STEPS + 4;
const PLANETS = ['mercury', 'venus', 'mars', 'jupiter'];

export function calendarYearRange(startDate) {
  if (typeof startDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) throw Error('Startdatum ungueltig');
  const date = new Date(startDate + 'T00:00:00Z'), start = +date;
  if (!Number.isFinite(start) || date.toISOString().slice(0,10) !== startDate) throw Error('Startdatum ungueltig');
  const year = date.getUTCFullYear(), month = date.getUTCMonth(), day = date.getUTCDate();
  if (year < 1900 || year > 2200) throw Error('Jahr ungueltig');
  // Calendar dates, not elapsed hours: DST cannot add or remove a preview day.
  const lastDay = new Date(Date.UTC(year + 1, month + 1, 0)).getUTCDate();
  const end = Date.UTC(year + 1, month, Math.min(day,lastDay));
  return { start, end, days:(end - start) / DAY + 1, endDate:new Date(end).toISOString().slice(0,10) };
}

function planetDay(id, start, end, latitude, longitude, day, output) {
  const at = time => {
    const p = planetPosition(id, new Date(time), latitude, longitude);
    const a = p.azimuth * Math.PI / 180, e = p.elevation * Math.PI / 180;
    return { time, elevation:e, sun:SunCalc.getPosition(new Date(time), latitude, longitude).altitude,
      vector:[Math.cos(e) * Math.sin(a), Math.sin(e), -Math.cos(e) * Math.cos(a)] };
  };
  const crossing = (a, b, key) => {
    let lo = a.time, hi = b.time;
    for (let j = 0; j < 18; j++) {
      const mid = (lo + hi) / 2;
      if ((at(mid)[key] >= 0) === (a[key] >= 0)) lo = mid; else hi = mid;
    }
    const p = at((lo + hi) / 2);
    if (key === 'elevation') { p.elevation = 0; p.vector[1] = 0; }
    return p;
  };
  let previous = at(start);
  for (let i = 1; i <= PLANET_STEPS; i++) {
    const current = at(start + (end - start) * i / PLANET_STEPS);
    const split = [previous, current];
    for (const key of ['sun', 'elevation']) if ((previous[key] >= 0) !== (current[key] >= 0)) split.push(crossing(previous, current, key));
    split.sort((a,b) => a.time - b.time);
    for (let j = 1; j < split.length; j++) {
      const a = split[j-1], b = split[j], mid = at((a.time + b.time) / 2);
      // Match live visibility: night/twilight only; horizon remains a user choice.
      if (mid.sun > 0) continue;
      const part = mid.elevation >= 0 ? 0 : 1;
      const count = output.counts[day * 2 + part]++;
      if (count >= PLANET_SEGMENTS) throw Error('Zu viele Planetenbahnabschnitte');
      const offset = ((day * 2 + part) * PLANET_SEGMENTS + count) * 6;
      output.positions.set(a.vector, offset); output.positions.set(b.vector, offset + 3);
    }
    previous = current;
  }
}

function localNoon(date, formatter, hour = 12) {
  const wanted = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hour);
  let time = wanted;
  for (let i = 0; i < 3; i++) {
    const p = Object.fromEntries(formatter.formatToParts(new Date(time)).map(p => [p.type, p.value]));
    time += wanted - Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  }
  return time;
}

function moonPosition(time, latitude, longitude) {
  const p = SunCalc.getMoonPosition(new Date(time), latitude, longitude);
  const a = p.azimuth + Math.PI, e = p.altitude;
  return { time, elevation:e, vector:[Math.cos(e) * Math.sin(a), Math.sin(e), -Math.cos(e) * Math.cos(a)] };
}

function moonDay(start, end, latitude, longitude, day, output) {
  const at = time => moonPosition(time, latitude, longitude);
  const event = (index, point) => {
    output.moonEvents.set(point.vector, day * 9 + index * 3);
    output.moonTimes[day * 3 + index] = point.time;
  };
  const segment = (part, a, b) => {
    const count = output.moonCounts[day * 2 + part]++;
    if (count >= MOON_SEGMENTS) throw Error('Zu viele Mondbahnabschnitte');
    const offset = ((day * 2 + part) * MOON_SEGMENTS + count) * 6;
    output.moonPositions.set(a.vector, offset);
    output.moonPositions.set(b.vector, offset + 3);
  };
  let previous = at(start), maximum = previous, maximumIndex = 0;
  const step = (end - start) / MOON_STEPS;
  for (let i = 1; i <= MOON_STEPS; i++) {
    const current = at(start + i * step);
    if (current.elevation > maximum.elevation) { maximum = current; maximumIndex = i; }
    const before = previous.elevation >= 0, after = current.elevation >= 0;
    if (before !== after) {
      let lo = previous.time, hi = current.time;
      for (let n = 0; n < 24; n++) {
        const middle = (lo + hi) / 2;
        if ((at(middle).elevation >= 0) === before) lo = middle; else hi = middle;
      }
      const crossing = at((lo + hi) / 2);
      event(after ? 0 : 2, crossing);
      segment(before ? 0 : 1, previous, crossing);
      segment(after ? 0 : 1, crossing, current);
    } else segment(before ? 0 : 1, previous, current);
    previous = current;
  }
  // Only label a culmination inside this local day, never a midnight boundary as MN.
  if (maximumIndex > 0 && maximumIndex < MOON_STEPS) {
    let lo = maximum.time - step, hi = maximum.time + step;
    for (let i = 0; i < 36; i++) {
      const a = lo + (hi - lo) / 3, b = hi - (hi - lo) / 3;
      if (at(a).elevation < at(b).elevation) lo = a; else hi = b;
    }
    event(1, at((lo + hi) / 2));
  }
}

function position(time, latitude, longitude, output, offset) {
  const p = SunCalc.getPosition(new Date(time), latitude, longitude);
  const a = p.azimuth + Math.PI, e = p.altitude;
  output[offset] = Math.cos(e) * Math.sin(a);
  output[offset + 1] = Math.sin(e);
  output[offset + 2] = -Math.cos(e) * Math.cos(a);
}

export function buildSolarYear({ startDate, latitude, longitude, timeZone, planets = [] }) {
  if (!Number.isFinite(latitude) ||
      Math.abs(latitude) > 90 || !Number.isFinite(longitude) || Math.abs(longitude) > 180) throw Error('Standort/Jahr ungueltig');
  const formatter = new Intl.DateTimeFormat('en-GB', { timeZone, year:'numeric', month:'2-digit', day:'2-digit',
    hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23' });
  const { start, days, endDate } = calendarYearRange(startDate);
  const positions = new Float32Array(days * 2 * POINTS * 3);
  const planetTracks = PLANETS.filter(id => planets.includes(id)).map(id => ({ id,
    positions:new Float32Array(days * 2 * PLANET_SEGMENTS * 6), counts:new Uint16Array(days * 2) }));
  const events = new Float32Array(days * 9), times = new Float64Array(days * 3);
  const counts = new Uint16Array(days * 2), dates = [];
  const moon = {
    moonSegments:MOON_SEGMENTS,
    moonPositions:new Float32Array(days * 2 * MOON_SEGMENTS * 6),
    moonCounts:new Uint16Array(days * 2),
    moonEvents:new Float32Array(days * 9), moonTimes:new Float64Array(days * 3)
  };
  moon.moonEvents.fill(NaN); moon.moonTimes.fill(NaN);
  events.fill(NaN); times.fill(NaN);
  for (let day = 0; day < days; day++) {
    const date = new Date(start + day * DAY), noon = localNoon(date, formatter);
    for (const track of planetTracks) planetDay(track.id, localNoon(date, formatter, 0),
      localNoon(new Date(start + (day + 1) * DAY), formatter, 0), latitude, longitude, day, track);
    moonDay(localNoon(date, formatter, 0), localNoon(new Date(start + (day + 1) * DAY), formatter, 0), latitude, longitude, day, moon);
    const solar = SunCalc.getTimes(new Date(noon), latitude, longitude);
    const next = SunCalc.getTimes(new Date(localNoon(new Date(start + (day + 1) * DAY), formatter)), latitude, longitude);
    const rise = +solar.sunrise, set = +solar.sunset, nextRise = +next.sunrise;
    dates.push(`${String(date.getUTCDate()).padStart(2, '0')}.${String(date.getUTCMonth() + 1).padStart(2, '0')}.${date.getUTCFullYear()}`);
    for (const [j, time] of [rise, +solar.solarNoon, set].entries()) {
      if (!Number.isFinite(time)) continue;
      times[day * 3 + j] = time;
      position(time, latitude, longitude, events, day * 9 + j * 3);
    }
    const normal = Number.isFinite(rise) && Number.isFinite(set) && Number.isFinite(nextRise) && set > rise && nextRise > set;
    const polarDay = SunCalc.getPosition(new Date(+solar.solarNoon), latitude, longitude).altitude > 0;
    for (let part = 0; part < 2; part++) {
      if (!normal && (part === 0) !== polarDay) continue;
      counts[day * 2 + part] = POINTS;
      const from = normal ? (part ? set : rise) : +solar.solarNoon - DAY / 2;
      const to = normal ? (part ? nextRise : set) : from + DAY;
      for (let point = 0; point < POINTS; point++) {
        position(from + (to - from) * point / (POINTS - 1), latitude, longitude, positions,
          ((day * 2 + part) * POINTS + point) * 3);
      }
    }
  }
  const eclipses = buildEclipses({ startDate, endDate, latitude, longitude, timeZone });
  return { startDate, endDate, days, points:POINTS, positions, events, times, counts, dates, ...moon, planetTracks, planetSegments:PLANET_SEGMENTS, eclipses };
}

self.onmessage = ({ data }) => {
  try {
    const result = buildSolarYear(data);
    self.postMessage(result, [result.positions.buffer, result.events.buffer, result.times.buffer, result.counts.buffer,
      result.moonPositions.buffer, result.moonCounts.buffer, result.moonEvents.buffer, result.moonTimes.buffer,
      ...result.planetTracks.flatMap(track => [track.positions.buffer, track.counts.buffer])]);
  } catch (error) { self.postMessage({ error: String(error.message || error) }); }
};
