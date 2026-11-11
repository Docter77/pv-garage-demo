import * as THREE from './three-r180.module.min.js';
import { Line2 } from './Line2-r180.js';
import { LineGeometry } from './LineGeometry-r180.js';
import { LineMaterial } from './LineMaterial-r180.js';
import { LineSegments2 } from './LineSegments2-r180.js';
import { LineSegmentsGeometry } from './LineSegmentsGeometry-r180.js';
import { EclipseCalendar, eclipseTimeline } from './garage-eclipse-calendar-v279.js';

const DURATION = 30000;
import { GARAGE_LOCATIONS as LOCATIONS } from './garage-locations-v1.js';
const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 2v6M17 2v6M3 10h18"/><path d="m10 13 5 3-5 3z" fill="currentColor"/></svg>';

export class SolarYearPreview {
  constructor(view) {
    this.view = view;
    this.button = document.createElement('button');
    this.button.className = 'year-view';
    this.button.onclick = () => this.running || this.loading ? this.stop() : this.start();
    view.root.querySelector('.tools').append(this.button);
    this.locationId = 'home';
    this.caches = new Map();
    this.locationSelect = document.createElement('select');
    this.locationSelect.className = 'year-location';
    this.locationSelect.title = 'Location for annual preview only';
    this.locationSelect.setAttribute('aria-label', 'Annual preview location');
    for (const { id, label } of LOCATIONS) this.locationSelect.add(new Option(label, id));
    this.locationSelect.onchange = () => {
      const restart = this.running || this.loading;
      this.stop();
      this.locationId = this.locationSelect.value;
      if (restart) this.start();
    };
    view.root.querySelector('.tools').append(this.locationSelect);
    this.status = document.createElement('div');
    this.status.className = 'year-status'; this.status.hidden = true;
    this.status.title = 'Preview of the sun, moon and selected planets. Values outside the scene remain on the selected demo day.';
    view.root.append(this.status);
    this.eclipseCalendar = new EclipseCalendar(this);
    this.syncButton();
  }

  request(data = this.view.data) {
    const selected = LOCATIONS.find(location => location.id === this.locationId);
    const location = selected?.id === 'home' ? data?.solarYear : selected;
    if (!location || !Number.isFinite(location.latitude) || !Number.isFinite(location.longitude) || !Number.isFinite(data.now)) return null;
    try {
      const parts = Object.fromEntries(new Intl.DateTimeFormat('en', { timeZone:location.timeZone,
        year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(new Date(data.now)).map(p => [p.type,p.value]));
      const startDate = `${parts.year}-${parts.month}-${parts.day}`;
      const planets = this.view.planetPathsEnabled
        ? ['mercury','venus','mars','jupiter'].filter(id => this.view.selectedPlanets[id]) : [];
      return { latitude:location.latitude, longitude:location.longitude, timeZone:location.timeZone, startDate, planets };
    } catch (_) { return null; }
  }

  syncButton() {
    this.view.root.querySelector('.tools').classList.toggle('year-running', !!(this.running || this.loading));
    this.button.setAttribute('aria-pressed', String(!!(this.running || this.loading)));
    this.button.title = this.running || this.loading ? 'Stop annual preview' : 'Sun, moon and selected planets: one year from the selected date (30 seconds)';
    this.button.setAttribute('aria-label', this.button.title);
    this.button.innerHTML = this.running || this.loading
      ? '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 6h12v12H6z"/></svg>' : ICON;
  }

  start() {
    const v = this.view, request = this.request();
    if (v.disposed || !v.active || v.failed) return;
    v.closeOptions();
    this.status.hidden = false;
    if (!request) { this.status.textContent = 'Annual preview: location missing'; return; }
    if (!v.expanded) v.openExpanded();
    this.status.hidden = false;
    v.setPlaying(false);
    this.key = JSON.stringify(request);
    this.locationLabel = LOCATIONS.find(location => location.id === this.locationId)?.label || 'Demo';
    this.timeFormatter = new Intl.DateTimeFormat('en-GB', { timeZone:request.timeZone, hour:'2-digit', minute:'2-digit', hourCycle:'h23' });
    const cached = this.caches.get(this.key);
    if (cached) {
      this.caches.delete(this.key); this.caches.set(this.key, cached);
      this.cache = cached; this.begin(); return;
    }
    this.loading = true; this.syncButton();
    this.status.textContent = `${this.locationLabel}: Preparing annual preview ...`;
    try {
      const worker = new Worker(new URL('./garage-solar-year-worker-v280.js', import.meta.url), { type:'module' });
      this.worker = worker;
      worker.onerror = event => { event.preventDefault(); if (this.worker === worker) this.fail(); };
      worker.onmessage = ({ data }) => {
        if (this.worker !== worker || v.disposed) return;
        if (data.error) { this.fail(); return; }
        worker.terminate(); this.worker = null;
        this.cache = { ...data, key:this.key };
        this.loading = false;
        if (JSON.stringify(this.request()) !== this.key) { this.stop(); return; }
        this.caches.set(this.key, this.cache);
        // Bound memory even when planet selections or start dates change.
        while (this.caches.size > 4) this.caches.delete(this.caches.keys().next().value);
        this.begin();
      };
      worker.postMessage(request);
    } catch (_) { this.fail(); }
  }

  fail() {
    this.stop();
    this.status.hidden = false;
    this.status.textContent = 'Annual preview unavailable. Try again.';
  }

  createGeometry() {
    if (this.group) return;
    const n = this.cache.points;
    this.group = new THREE.Group(); this.group.name = 'solar-year-preview';
    this.day = new THREE.Line(new THREE.BufferGeometry().setAttribute('position',
      new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage)),
      new THREE.LineBasicMaterial({ color:0xffff00 }));
    const nightGeometry = new LineGeometry().setPositions(new Float32Array(n * 3));
    nightGeometry.attributes.instanceStart.data.setUsage(THREE.DynamicDrawUsage);
    this.night = new Line2(nightGeometry, new LineMaterial({ color:0xffff00, linewidth:.5,
      transparent:true, opacity:.65, alphaToCoverage:true }));
    this.day.frustumCulled = this.night.frustumCulled = false;
    this.group.add(this.day, this.night);
    const m = this.cache.moonSegments;
    this.moonDay = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',
      new THREE.BufferAttribute(new Float32Array(m * 6), 3).setUsage(THREE.DynamicDrawUsage)),
      new THREE.LineBasicMaterial({ color:0x29a9ff }));
    const moonNightGeometry = new LineSegmentsGeometry().setPositions(new Float32Array(m * 6));
    moonNightGeometry.attributes.instanceStart.data.setUsage(THREE.DynamicDrawUsage);
    this.moonNight = new LineSegments2(moonNightGeometry, new LineMaterial({ color:0x29a9ff, linewidth:.5,
      transparent:true, opacity:.65, alphaToCoverage:true }));
    this.moonDay.frustumCulled = this.moonNight.frustumCulled = false;
    this.moonDay.scale.setScalar(this.view.orbitScale('moon'));
    this.moonNight.scale.setScalar(this.view.orbitScale('moon'));
    this.group.add(this.moonDay, this.moonNight);
    this.events = ['SR','SN','SS','MR','MN','MS'].map(label => {
      const color = label.startsWith('M') ? '#29a9ff' : '#ffff00';
      const dot = new THREE.Mesh(new THREE.SphereGeometry(.12, 10, 8), new THREE.MeshBasicMaterial({ color }));
      const text = this.view.label(label, color, .85);
      const scale = text.scale.clone();
      const cameraPoint = new THREE.Vector3();
      text.onBeforeRender = (renderer, scene, camera) => {
        text.getWorldPosition(cameraPoint).applyMatrix4(camera.matrixWorldInverse);
        const pixel = 2 * Math.max(.1, -cameraPoint.z) * Math.tan(camera.fov * Math.PI / 360) / Math.max(1, this.view.renderHeight);
        text.scale.set(80 * pixel / this.view.skyRadius, 20 * pixel / this.view.skyRadius, 1);
        text.updateMatrixWorld();
      };
      this.group.add(dot, text);
      return { dot, text, scale };
    });
    this.view.scene.add(this.group);
    // Event markers live outside the scaled annual group so their screen sizes stay stable.
    this.eventBodies = new THREE.Group(); this.eventBodies.name = 'eclipse-event-bodies';
    this.eventMarkers = {
      sunAbove:this.view.sunMarker(new THREE.Vector3(), 1),
      sunBelow:this.view.sunMarker(new THREE.Vector3(), -1),
      moonNew:this.view.eclipseMoonMarker(true), moonFull:this.view.eclipseMoonMarker(false)
    };
    for (const [name, marker] of Object.entries(this.eventMarkers)) {
      marker.name = 'eclipse-' + name; this.eventBodies.add(marker);
    }
    this.eventBodies.visible = false; this.view.scene.add(this.eventBodies);
    this.crossingGroup = new THREE.Group(); this.crossingGroup.name = 'annual-horizon-crossings';
    this.crossingGroup.visible = false; this.view.scene.add(this.crossingGroup);
    this.crossingMarkers = new Map();
  }

  begin() {
    this.createGeometry();
    this.createPlanets();
    this.createCurveFamily();
    const v = this.view;
    this.running = true; this.loading = false; this.elapsed = 0; this.index = -1;
    this.manualPaused = false;
    this.dayEnds = eclipseTimeline(this.cache.days, this.cache.eclipses || [], DURATION);
    this.eclipseCalendar.begin(this.cache, this.request().timeZone);
    this.group.visible = true;
    this.hiddenGroups = [v.paths, v.current, v.planetPaths, v.planetCurrent].map(group => [group, group.visible]);
    for (const [group] of this.hiddenGroups) group.visible = false;
    this.previewTimes = [...v.root.querySelectorAll('.expanded-times li')].map(row => ({
      label:row.querySelector('.expanded-time-label').textContent.replace(':',''),
      value:row.querySelector('.expanded-time')
    }));
    const panel = v.root.querySelector('.expanded-times');
    panel.title = `${this.locationLabel}: local time in annual preview`;
    v.root.querySelector('.expanded-metrics').title = 'Selected demo-day values, not annual preview';
    v.root.querySelector('.expanded-metrics').dataset.liveLocation = 'Demo day';
    this.syncButton();
    this.drawDay(0);
    this.resume();
  }

  createCurveFamily() {
    if (this.familyKey === this.cache.key) return;
    if (this.curveFamily) {
      this.group.remove(this.curveFamily);
      this.curveFamily.traverse(object => { object.geometry?.dispose(); object.material?.dispose(); });
    }
    const family = this.curveFamily = new THREE.Group();
    family.name = 'annual-curve-family';
    const c = this.cache;
    // Batch the cached daily curves into four static draws, without links between days.
    for (const moon of [false, true]) for (let part = 0; part < 2; part++) {
      const counts = moon ? c.moonCounts : c.counts;
      const source = moon ? c.moonPositions : c.positions;
      const stride = moon ? c.moonSegments * 6 : c.points * 3;
      let segments = 0;
      for (let day = 0; day < c.days; day++) {
        segments += Math.max(0, counts[day * 2 + part] - (moon ? 0 : 1));
      }
      const positions = new Float32Array(segments * 6);
      let cursor = 0;
      for (let day = 0; day < c.days; day++) {
        const start = (day * 2 + part) * stride;
        const count = counts[day * 2 + part];
        if (moon) {
          positions.set(source.subarray(start, start + count * 6), cursor);
          cursor += count * 6;
        } else {
          for (let i = 1; i < count; i++) {
            positions.set(source.subarray(start + (i - 1) * 3, start + (i + 1) * 3), cursor);
            cursor += 6;
          }
        }
      }
      const geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const line = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({
        color: moon ? 0x29a9ff : 0xffff00, transparent: true,
        opacity: part ? 0.025 : 0.055, depthTest: true, depthWrite: false
      }));
      line.name = `annual-family-${moon ? 'moon' : 'sun'}-${part ? 'night' : 'day'}`;
      line.scale.setScalar(this.view.orbitScale(moon ? 'moon' : 'sun'));
      line.renderOrder = -1;
      family.add(line);
    }
    family.visible = !!this.view.expanded;
    this.group.add(family);
    this.familyKey = c.key;
  }

  createPlanets() {
    const key = this.cache.planetTracks.map(track => track.id).join(',');
    if (this.planetKey === key) return;
    for (const line of this.planetLines || []) {
      this.group.remove(line.above, line.below);
      for (const mesh of [line.above, line.below]) { mesh.geometry.dispose(); mesh.material.dispose(); }
    }
    this.planetKey = key;
    const n = this.cache.planetSegments;
    this.planetLines = this.cache.planetTracks.map(track => {
      const body = this.view.data.planets.bodies.find(body => body.id === track.id);
      const color = body?.color || '#ffffff';
      const above = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',
        new THREE.BufferAttribute(new Float32Array(n * 6), 3).setUsage(THREE.DynamicDrawUsage)),
        new THREE.LineBasicMaterial({ color, transparent:true, opacity:.75, depthWrite:false }));
      const geometry = new LineSegmentsGeometry().setPositions(new Float32Array(n * 6));
      geometry.attributes.instanceStart.data.setUsage(THREE.DynamicDrawUsage);
      const below = new LineSegments2(geometry, new LineMaterial({ color, linewidth:.5,
        transparent:true, opacity:.35, depthWrite:false, alphaToCoverage:true }));
      above.frustumCulled = below.frustumCulled = false;
      above.scale.setScalar(this.view.orbitScale(track.id));
      below.scale.setScalar(this.view.orbitScale(track.id));
      above.name = below.name = 'annual-planet-' + track.id;
      this.group.add(above, below);
      return { id:track.id, label:body?.label || track.id, above, below };
    });
  }

  drawDay(index) {
    this.index = index;
    this.peakEvent = this.cache.eclipses?.find(event => event.day === index) || null;
    this.eclipseCalendar.draw(index);
    const { points:n, positions, counts, events, dates } = this.cache;
    const start = index * n * 6;
    this.day.geometry.attributes.position.array.set(positions.subarray(start, start + n * 3));
    this.day.geometry.attributes.position.needsUpdate = true;
    this.day.visible = counts[index * 2] > 0;
    this.night.visible = counts[index * 2 + 1] > 0;
    const buffer = this.night.geometry.attributes.instanceStart.data;
    for (let i = 0; i < n - 1; i++) for (let axis = 0; axis < 3; axis++) {
      buffer.array[i * 6 + axis] = positions[start + n * 3 + i * 3 + axis];
      buffer.array[i * 6 + axis + 3] = positions[start + n * 3 + (i + 1) * 3 + axis];
    }
    buffer.needsUpdate = true;
    const { moonPositions, moonCounts, moonSegments:m } = this.cache;
    const moonStart = index * m * 12;
    this.moonDay.geometry.attributes.position.array.set(moonPositions.subarray(moonStart, moonStart + m * 6));
    this.moonDay.geometry.attributes.position.needsUpdate = true;
    this.moonDay.geometry.setDrawRange(0, moonCounts[index * 2] * 2);
    const moonBuffer = this.moonNight.geometry.attributes.instanceStart.data;
    moonBuffer.array.set(moonPositions.subarray(moonStart + m * 6, moonStart + m * 12));
    moonBuffer.needsUpdate = true;
    this.moonNight.geometry.instanceCount = moonCounts[index * 2 + 1];
    this.moonDay.visible = moonCounts[index * 2] > 0;
    this.moonNight.visible = moonCounts[index * 2 + 1] > 0;
    this.events.forEach(({ dot, text }, j) => {
      const source = j < 3 ? events : this.cache.moonEvents;
      const offset = index * 9 + (j % 3) * 3;
      dot.visible = text.visible = Number.isFinite(source[offset]);
      if (dot.visible) dot.position.fromArray(source, offset).multiplyScalar(this.view.orbitScale(j < 3 ? 'sun' : 'moon'));
    });
    const size = this.cache.planetSegments * 6;
    this.planetLines.forEach(({ above, below }, j) => {
      const track = this.cache.planetTracks[j], offset = index * size * 2;
      above.geometry.attributes.position.array.set(track.positions.subarray(offset, offset + size));
      above.geometry.attributes.position.needsUpdate = true;
      above.geometry.setDrawRange(0, track.counts[index * 2] * 2);
      above.visible = track.counts[index * 2] > 0;
      const buffer = below.geometry.attributes.instanceStart.data;
      buffer.array.set(track.positions.subarray(offset + size, offset + size * 2));
      buffer.needsUpdate = true;
      below.geometry.instanceCount = track.counts[index * 2 + 1];
      below.visible = this.view.showPlanetsBelow && track.counts[index * 2 + 1] > 0;
    });
    this.updateHorizonCrossings(index);
    const planetNames = this.planetLines.map(line => line.label).join(', ');
    this.status.textContent = `${this.locationLabel} · ${dates[index]}${planetNames ? ' · ' + planetNames : ''}`;
    const labels = ['SR','SN','SS','MR','MN','MS'];
    for (const { label, value } of this.previewTimes) {
      const j = labels.indexOf(label);
      const time = j < 0 ? NaN : (j < 3 ? this.cache.times : this.cache.moonTimes)[index * 3 + j % 3];
      value.textContent = Number.isFinite(time) ? this.timeFormatter.format(time) : '--:--';
    }
    this.syncProjection();
    this.view.requestRender();
  }

  updateHorizonCrossings(index) {
    for (const marker of this.crossingGroup.children) marker.visible = false;
    const c = this.cache;
    const update = (body, color, positions, counts, capacity, segments) => {
      const hits = [], vertices = segments ? 2 : 1;
      for (let part = 0; part < 2; part++) {
        const offset = (index * 2 + part) * capacity * vertices * 3;
        const points = Array.from({ length:counts[index * 2 + part] * vertices }, (_, i) => new THREE.Vector3().fromArray(positions, offset + i * 3));
        for (const point of this.view.horizonIntersections(points, segments)) {
          if (!hits.some(hit => hit.distanceToSquared(point) < 1e-8)) hits.push(point);
        }
      }
      // Reuse marker textures while scrubbing instead of allocating new GPU resources each day.
      const pool = this.crossingMarkers.get(body) || [];
      hits.forEach((point, i) => {
        if (!pool[i]) { pool[i] = this.view.horizonCrossingMarker(color); this.crossingGroup.add(pool[i]); }
        pool[i].visible = true; pool[i].userData.body = body; pool[i].userData.unitPosition = point;
      });
      this.crossingMarkers.set(body, pool);
    };
    update('sun', 0xffff00, c.positions, c.counts, c.points, false);
    update('moon', 0x29a9ff, c.moonPositions, c.moonCounts, c.moonSegments, true);
    for (const track of c.planetTracks) {
      const color = this.view.data.planets.bodies.find(body => body.id === track.id)?.color || '#ffffff';
      update(track.id, color, track.positions, track.counts, c.planetSegments, true);
    }
  }

  syncProjection() {
    if (!this.running) return;
    this.curveFamily.visible = !!this.view.expanded;
    const radius = this.view.skyRadius;
    this.group.position.copy(this.view.origin); this.group.scale.setScalar(radius);
    this.crossingGroup.visible = true;
    for (const marker of this.crossingGroup.children) {
      if (marker.visible) marker.position.copy(marker.userData.unitPosition).multiplyScalar(radius * this.view.orbitScale(marker.userData.body)).add(this.view.origin);
    }
    this.eventBodies.visible = !!this.peakEvent?.positions;
    if (this.eventBodies.visible) {
      const { sun, moon } = this.peakEvent.positions;
      const visible = new Set([sun.elevation >= 0 ? 'sunAbove' : 'sunBelow', this.peakEvent.body === 'sun' ? 'moonNew' : 'moonFull']);
      for (const [name, marker] of Object.entries(this.eventMarkers)) {
        marker.visible = visible.has(name);
        const body = name.startsWith('sun') ? 'sun' : 'moon';
        marker.position.fromArray(body === 'sun' ? sun.vector : moon.vector).multiplyScalar(radius * this.view.orbitScale(body)).add(this.view.origin);
      }
    }
    for (const { dot, text, scale } of this.events) {
      dot.scale.setScalar(1 / radius);
      text.scale.copy(scale).divideScalar(radius);
      text.position.copy(dot.position); text.position.y += .65 / radius;
    }
  }

  pausePlayback() {
    if (!this.running) return;
    this.manualPaused = true;
    this.suspend();
    this.eclipseCalendar.syncPlayback();
  }

  togglePlayback() {
    if (!this.running) return;
    if (!this.manualPaused) { this.pausePlayback(); return; }
    this.manualPaused = false;
    this.eclipseCalendar.syncPlayback();
    this.resume();
  }

  seekDay(value, pause = true) {
    if (!this.running || !Number.isFinite(value)) return;
    const day = Math.max(0, Math.min(this.cache.days - 1, Math.round(value)));
    if (pause) this.manualPaused = true;
    this.suspend();
    // Slider distance is linear in calendar days, independently of eclipse dwell times.
    this.elapsed = day ? this.dayEnds[day - 1] : 0;
    this.drawDay(day);
    this.eclipseCalendar.syncPlayback();
    this.resume();
  }

  tick() {
    clearTimeout(this.timer); this.timer = null;
    if (!this.running || this.manualPaused || this.stamp == null || document.visibilityState === 'hidden' || !this.view.active) return;
    const elapsed = this.elapsed + performance.now() - this.stamp;
    if (elapsed >= DURATION) { this.stop(); return; }
    const found = this.dayEnds.findIndex(end => elapsed < end);
    const day = found < 0 ? this.cache.days - 1 : found;
    if (day !== this.index) this.drawDay(day);
    this.timer = setTimeout(() => this.tick(), Math.max(1, this.dayEnds[day] - elapsed));
  }

  suspend() {
    clearTimeout(this.timer); this.timer = null;
    if (this.running && this.stamp != null) this.elapsed += performance.now() - this.stamp;
    this.stamp = null;
  }

  resume() {
    if (!this.running || this.manualPaused || this.stamp != null || document.visibilityState === 'hidden' || !this.view.active) return;
    this.stamp = performance.now(); this.tick();
  }

  deferUpdate(data) {
    if (!this.running) return false;
    if (JSON.stringify(this.request(data)) !== this.key) { this.stop(false); return false; }
    this.view.data = data;
    return true;
  }

  stop(restore = true) {
    const wasActive = this.running || this.loading;
    this.suspend(); this.worker?.terminate(); this.worker = null;
    this.running = this.loading = false;
    this.eclipseCalendar.stop();
    if (this.group) this.group.visible = false;
    if (this.eventBodies) this.eventBodies.visible = false;
    if (this.crossingGroup) this.crossingGroup.visible = false;
    for (const [group, visible] of this.hiddenGroups || []) group.visible = visible;
    this.hiddenGroups = null;
    if (wasActive && !this.view.disposed) {
      this.view.displayKey = null;
      this.view.updateExpandedDetails(this.view.data?.display);
      this.view.root.querySelector('.expanded-times').removeAttribute('title');
      this.view.root.querySelector('.expanded-metrics').removeAttribute('title');
      delete this.view.root.querySelector('.expanded-metrics').dataset.liveLocation;
    }
    this.status.hidden = true; this.syncButton();
    if (wasActive && restore && !this.view.disposed) {
      this.view.update(this.view.data); this.view.requestRender();
    }
  }

  dispose() {
    this.stop(false);
    this.eclipseCalendar.dispose();
    if (this.group) {
      this.view.scene.remove(this.group);
      this.group.traverse(object => { object.geometry?.dispose(); object.material?.map?.dispose(); object.material?.dispose(); });
    }
    if (this.eventBodies) {
      this.view.scene.remove(this.eventBodies);
      this.eventBodies.traverse(object => { object.geometry?.dispose(); object.material?.map?.dispose(); object.material?.dispose(); });
    }
    if (this.crossingGroup) {
      this.view.scene.remove(this.crossingGroup);
      this.crossingGroup.traverse(object => { object.material?.map?.dispose(); object.material?.dispose(); });
    }
    this.cache = null; this.caches.clear(); this.locationSelect.remove(); this.button.remove(); this.status.remove();
  }
}
