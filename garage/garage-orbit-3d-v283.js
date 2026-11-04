import * as THREE from './three-r180.module.min.js';
import { holdGarageBackground } from '../garage-render-pause.js?v=1';
import { OrbitControls } from './OrbitControls-r180.js';
import { Line2 } from './Line2-r180.js';
import { LineGeometry } from './LineGeometry-r180.js';
import { LineMaterial } from './LineMaterial-r180.js';
import { GarageFrameMetrics } from './garage-frame-metrics-v1.js';
import { GarageUpdateTrace } from './garage-update-trace-v1.js';
import { GaragePaintTest, findPaintTestCards } from './garage-layer-test-v2.js';
import { SolarYearPreview } from './garage-solar-year-v282.js';

const RAD = Math.PI / 180;
const RADIUS = 11;
const COMPACT_RADIUS = RADIUS * 1.25;
// Reduce sky geometry only; retain the original radius for camera/building framing.
const SKY_RADIUS_SCALE = 0.85;
const SUN = 0xffff00;
const MOON = 0x29a9ff;
const SKY_MARKER_DIAMETER = 1.15;
const SKY_MARKER_MIN_PIXELS = 20;
const MOON_MARKER_SCALE = 0.8;
// Private neighborhood geometry is deliberately absent from this demo fork.
const ESTIMATED_NEIGHBORS = [];
const PLANETS = [['mercury', 'Me', 'Merkur'], ['venus', 'Ve', 'Venus'], ['mars', 'Ma', 'Mars'], ['jupiter', 'Ju', 'Jupiter']];

// East = +X, up = +Y, north = -Z. Azimuth is clockwise from north.
export function skyVector(azimuth, elevation, radius = RADIUS) {
  const a = azimuth * RAD, e = elevation * RAD;
  return new THREE.Vector3(radius * Math.cos(e) * Math.sin(a), radius * Math.sin(e), -radius * Math.cos(e) * Math.cos(a));
}

function release(group, retainedTexture) {
  group.traverse(object => {
    if (object.isInstancedMesh) object.dispose();
    object.geometry?.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (material?.map !== retainedTexture) material?.map?.dispose();
      material?.dispose();
    }
  });
  group.clear();
}

export class GarageOrbit3D {
  constructor(host) {
    this.host = host;
    this.root = host.shadowRoot || host.attachShadow({ mode: 'open' });
    this.root.innerHTML = `<style>
      :host{display:block;position:relative;width:100%;height:100%;min-width:0}
      canvas{display:block;width:100%;height:100%;touch-action:none;outline:none}
      .tools{position:absolute;top:22px;left:calc(100% + 4px);width:var(--garage-rail-width,48px);display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:2px;z-index:2;pointer-events:none}
      .tools > *{pointer-events:auto}
      :host > .tools > .play-view{grid-column:2;grid-row:1}
      :host > .tools > .year-view{grid-column:1;grid-row:1}
      .year-view{order:0}
      .tools.year-running > :not(.year-view):not(.year-location){display:none!important}
      .expanded-dialog .tools.year-running{width:120px;grid-template-columns:26px 1fr}
      .tools .year-location{display:none;order:0;grid-column:1 / -1;box-sizing:border-box;width:100%;min-width:0;height:26px;padding:0 2px;border:1px solid #53616c;border-radius:4px;color:#e7edf0;background:#142029;font:10px Arial;cursor:pointer;touch-action:manipulation}
      :is(.expanded-dialog,.options-dialog) .tools .year-location{display:block}
      .year-location:focus-visible{outline:2px solid #2ccfff;outline-offset:2px}
      .year-status{position:absolute;left:4px;top:4px;max-width:calc(100% - 140px);padding:3px 5px;background:rgba(16,24,32,.9);color:#ffff00;font:11px Arial;pointer-events:none;z-index:1}
      :host > .tools > .expand-view{grid-column:1;grid-row:2}
      :host > .tools > .options-view{grid-column:2;grid-row:2}
      .tools button{box-sizing:border-box;width:100%;height:20px;padding:1px;font-size:14px}
      .tools button svg{width:14px;height:14px}
      .tools .flight-mode,.tools .house-mode{box-sizing:border-box;grid-column:1 / -1;width:100%;height:26px;min-width:0;padding:0 2px;border:1px solid #53616c;border-radius:4px;color:#e7edf0;background:#142029;font:10px Arial;cursor:pointer;touch-action:manipulation}
      .flight-mode:focus-visible,.house-mode:focus-visible{outline:2px solid #2ccfff;outline-offset:2px}
      .play-view{order:1}.reset-view{order:2}.planet-toggle{order:3}.flight-mode{order:4}.house-mode{order:5}.measure-view{order:6}.expand-view{order:7;grid-column:2}.options-view{order:8;grid-column:3}
      .planet-choice,.horizon-toggle{order:8}
      .tools > .reset-view,.tools > .planet-toggle,.tools > .flight-mode,.tools > .house-mode,.tools > .measure-view{display:none}
      :is(.expanded-dialog,.options-dialog) .tools > :is(.reset-view,.planet-toggle,.flight-mode,.house-mode,.measure-view){display:block}
      .expanded-dialog .tools{left:auto;right:4px;top:4px;width:88px;gap:3px;grid-template-columns:repeat(3,minmax(0,1fr))}
      :is(.expanded-dialog,.options-dialog) .tools button{height:26px}
      .expanded-dialog .options-view{display:none}
      .options-dialog{box-sizing:border-box;width:230px;max-width:calc(100vw - 24px);padding:10px;border:1px solid #53616c;border-radius:8px;background:#101820;color:#e7edf0;font:12px Arial}
      .options-dialog::backdrop{background:rgba(0,0,0,.45)}
      .options-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
      .options-dialog .tools{position:static;width:100%;gap:6px;grid-template-columns:repeat(3,minmax(0,1fr))}
      .options-dialog :is(.play-view,.expand-view,.options-view){display:none}
      .tools .planet-choice,.tools .horizon-toggle{display:none}
      .expanded-dialog .tools .planet-choice,.expanded-dialog .tools .horizon-toggle{display:block}
      .tools .planet-choice{font-size:10px;font-weight:700}
      button{width:28px;height:28px;border:1px solid #53616c;border-radius:4px;color:#e7edf0;background:#142029;cursor:pointer;font:18px Arial;touch-action:manipulation}
      button:focus-visible{outline:2px solid #2ccfff;outline-offset:2px}
      button[aria-pressed="true"]{border-color:#2ccfff;color:#2ccfff;background:#223743}
      .planet-toggle svg{display:block;width:18px;height:18px;margin:auto}
      .expand-view svg,.close-expanded svg{display:block;width:18px;height:18px;margin:auto}
      .expanded-dialog{box-sizing:border-box;width:min(1100px,calc(100vw - 24px));height:min(800px,90dvh);max-width:none;max-height:none;padding:0;border:1px solid #53616c;border-radius:8px;background:#101820;color:#e7edf0;overflow:hidden}
      .expanded-dialog::backdrop{background:rgba(0,0,0,.72)}
      .expanded-layout{height:100%;display:grid;grid-template-rows:auto minmax(0,1fr) auto;font-family:Arial,Helvetica,sans-serif}
      .expanded-header{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-bottom:1px solid #324451}
      .expanded-header h2{font-size:16px;font-weight:600;margin:0}
      .close-expanded{width:32px;height:32px}
      .expanded-body{display:grid;grid-template-columns:minmax(0,1fr) 150px;min-height:0}
      .expanded-scene{position:relative;min-width:0;min-height:0}
      .expanded-dialog .expand-view{display:none}
      .expanded-dialog .paint-test-view{display:none}
      .tools .paint-test-view{width:30px;font:10px Arial}
      .expanded-times{display:grid;align-content:center;gap:14px;padding:12px;margin:0;list-style:none}
      .expanded-times li{display:flex;gap:8px;align-items:baseline}
      .expanded-time-label{font:13px Arial;min-width:25px;color:#e7edf0}
      .expanded-time{font:700 20px DSEG7PV,monospace;white-space:nowrap}
      .expanded-metrics{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px;padding:16px;border-top:1px solid #324451}
      .expanded-metrics[data-live-location]::before{content:attr(data-live-location);grid-column:1 / -1;font:10px Arial;color:#b7c2c8}
      .expanded-metric{min-width:0}
      .expanded-metric-label{font:13px Arial;color:#b7c2c8;display:block;margin-bottom:8px}
      .expanded-metric-value{display:flex;align-items:baseline;gap:3px;white-space:nowrap}
      .expanded-number{font:700 20px DSEG7PV,monospace}
      .expanded-direction{font:700 16px DSEG14Garage,monospace}
      .expanded-slash{font:16px Arial;color:#ffff00}
      [data-number-mode="matrix"] .expanded-number{font:24px MatrixSansGarage,monospace}
      [data-number-mode="matrix"] .expanded-direction{font:20px MatrixSansGarage,monospace}
      @media(max-width:650px){
        .expanded-body{grid-template-columns:1fr;grid-template-rows:minmax(0,1fr) auto}
        .expanded-times{grid-template-columns:repeat(4,minmax(0,1fr));gap:10px 4px;padding:10px}
        .expanded-times li{display:flex;flex-direction:column;align-items:center;gap:5px}
        .expanded-time-label{font-size:11px;min-width:0}.expanded-time{font-size:14px}
        .expanded-metrics{grid-template-columns:repeat(3,minmax(0,1fr));gap:14px 8px;padding:12px}
        .expanded-number{font-size:17px}.expanded-direction{font-size:14px}
        [data-number-mode="matrix"] .expanded-number{font-size:21px}
      }
      .shadow-marker{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:hidden}
      .frame-metrics{position:absolute;left:8px;bottom:8px;box-sizing:border-box;max-width:calc(100% - 16px);max-height:calc(100% - 16px);overflow:auto;overscroll-behavior:contain;padding:6px 8px;border:1px solid #53616c;border-radius:4px;background:rgba(16,24,32,.94);color:#e7edf0;font:11px/1.4 monospace;white-space:pre-wrap;pointer-events:auto;z-index:2}
      .error{position:absolute;inset:0;display:grid;place-content:center;color:#fff;background:#101820;font:12px Arial;text-align:center;padding:20px}
      [hidden]{display:none!important}
    </style><div class="tools"><button class="reset-view" title="Ansicht zuruecksetzen" aria-label="Ansicht zuruecksetzen">&#8634;</button><button class="planet-toggle" title="Planetenbahnen einblenden" aria-label="Planetenbahnen einblenden" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="5"/><ellipse cx="12" cy="12" rx="11" ry="3" transform="rotate(-30 12 12)"/></svg></button><button class="expand-view" title="Grosse Ansicht oeffnen" aria-label="Grosse Ansicht oeffnen"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M9 3H3v6M15 3h6v6M3 15v6h6M21 15v6h-6"/></svg></button></div>
    <svg class="shadow-marker" hidden role="img"><title></title><line stroke="#101820" stroke-width="6" stroke-linecap="round"/><line class="shadow-color" stroke-width="4" stroke-linecap="round"/></svg>
    <div class="error" hidden></div>
    <dialog class="expanded-dialog" aria-labelledby="garage-expanded-title"><div class="expanded-layout"><header class="expanded-header"><h2 id="garage-expanded-title">Garage</h2><button class="close-expanded" aria-label="Grosse Ansicht schliessen" title="Schliessen"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></header><div class="expanded-body"><div class="expanded-scene"></div><ul class="expanded-times"></ul></div><div class="expanded-metrics"></div></div></dialog>`;
    this.active = true;
    this.optionsDialog = document.createElement('dialog');
    this.optionsDialog.className = 'options-dialog';
    this.optionsDialog.setAttribute('aria-label', '3D Optionen');
    this.optionsDialog.innerHTML = '<div class="options-header"><span>3D Optionen</span><button class="close-options" title="Schliessen" aria-label="Optionen schliessen">&#215;</button></div><div class="options-body"></div>';
    this.root.append(this.optionsDialog);
    this.optionsDialog.querySelector('.close-options').onclick = () => this.closeOptions();
    this.optionsDialog.addEventListener('cancel', event => { event.preventDefault(); this.closeOptions(); });
    this.optionsDialog.addEventListener('close', () => this.restoreOptions());
    this.disposed = false;
    this.viewport = host;
    this.expandedDialog = this.root.querySelector('.expanded-dialog');
    this.selectedPlanets = Object.fromEntries(PLANETS.map(([id]) => [id, true]));
    this.showPlanetsBelow = false;
    try {
      const saved = JSON.parse(localStorage.getItem('pvGarageDemoRich.planetSelection'));
      for (const [id] of PLANETS) if (typeof saved?.[id] === 'boolean') this.selectedPlanets[id] = saved[id];
      this.showPlanetsBelow = localStorage.getItem('pvGarageDemoRich.planetsBelow') === 'true';
    } catch (_) {}
    const tools = this.root.querySelector('.tools'), expand = this.root.querySelector('.expand-view');
    const options = document.createElement('button');
    options.className = 'options-view';
    options.title = 'Flugmodus, Haeuser, Planeten und Messung';
    options.setAttribute('aria-label', '3D Optionen');
    options.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18M8 3v6M16 9v6M10 15v6"/></svg>';
    options.onclick = () => this.openOptions();
    tools.append(options);
    const houseMode = document.createElement('select');
    houseMode.className = 'house-mode';
    houseMode.title = 'Nachbarhaeuser: Auto zeigt Schattenwerfer nahe Sonne oder Mond, mit 5 Minuten Vor-/Nachlauf (geschaetzte Geometrie)';
    houseMode.setAttribute('aria-label', 'Nachbarhaeuser');
    houseMode.innerHTML = '<option value="auto">Haus Auto</option><option value="all">Haus Alle</option><option value="off">Haus Aus</option>';
    let savedHouseMode;
    try { savedHouseMode = localStorage.getItem('pvGarageDemoRich.houseMode'); } catch (_) {}
    this.houseMode = ['auto', 'all', 'off'].includes(savedHouseMode) ? savedHouseMode : 'auto';
    houseMode.value = this.houseMode;
    houseMode.onchange = () => {
      this.houseMode = houseMode.value;
      try { localStorage.setItem('pvGarageDemoRich.houseMode', this.houseMode); } catch (_) {}
      this.refreshNeighborhood();
      this.requestRender();
    };
    tools.insertBefore(houseMode, expand);
    const playButton = document.createElement('button');
    playButton.className = 'play-view';
    playButton.onclick = () => this.setPlaying(!this.playing, true);
    tools.insertBefore(playButton, tools.firstChild);
    this.setPlaying(false);
    const flightMode = document.createElement('select');
    flightMode.className = 'flight-mode';
    flightMode.title = 'Flugmodus: Einfach = Garage im Mittelpunkt; Sonne = bisherige Kamerafahrt';
    flightMode.setAttribute('aria-label', flightMode.title);
    flightMode.innerHTML = '<option value="simple">Einfach</option><option value="sun">Sonne</option>';
    flightMode.onchange = () => this.setFlightMode(flightMode.value);
    tools.insertBefore(flightMode, playButton.nextSibling);
    let savedFlightMode;
    try { savedFlightMode = localStorage.getItem('pvGarageDemoRich.flightMode'); } catch (_) {}
    this.setFlightMode(savedFlightMode, false);
    const measureButton = document.createElement('button');
    measureButton.className = 'measure-view';
    measureButton.title = 'Bildtakt messen (erneut einschalten startet neu)';
    measureButton.setAttribute('aria-label', measureButton.title);
    measureButton.setAttribute('aria-pressed', 'false');
    measureButton.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M3 3v18h18M7 16v-5m5 5V7m5 9V4"/></svg>';
    measureButton.onclick = () => this.setMeasurement(!this.frameMetrics, true);
    tools.insertBefore(measureButton, expand);
    this.metricsPanel = document.createElement('div');
    this.metricsPanel.className = 'frame-metrics';
    this.metricsPanel.hidden = true;
    this.root.append(this.metricsPanel);
    for (const [id, short, name] of PLANETS) {
      const button = document.createElement('button');
      button.className = 'planet-choice'; button.dataset.planet = id; button.textContent = short;
      button.title = `${name}: Bahn ein-/ausblenden`; button.setAttribute('aria-label', button.title);
      button.onclick = () => {
        this.selectedPlanets[id] = !this.planetPathsEnabled || !this.selectedPlanets[id];
        this.planetPathsEnabled = true;
        try {
          localStorage.setItem('pvGarageDemoRich.planetSelection', JSON.stringify(this.selectedPlanets));
          localStorage.setItem('pvGarageDemoRich.planetPaths', 'true');
        } catch (_) {}
        this.refreshPlanets(); this.requestRender();
      };
      tools.insertBefore(button, expand);
    }
    const horizonButton = document.createElement('button');
    horizonButton.className = 'horizon-toggle';
    horizonButton.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M2 12h20M12 3v7m-4-3 4-4 4 4"/><path class="below-arrow" d="M12 14v7m-4-4 4 4 4-4"/></svg>';
    horizonButton.onclick = () => {
      this.showPlanetsBelow = !this.showPlanetsBelow;
      try { localStorage.setItem('pvGarageDemoRich.planetsBelow', String(this.showPlanetsBelow)); } catch (_) {}
      this.refreshPlanets(); this.requestRender();
    };
    tools.insertBefore(horizonButton, expand);
    this.root.querySelector('.expand-view').onclick = () => this.openExpanded();
    this.root.querySelector('.close-expanded').onclick = () => this.closeExpanded();
    this.expandedDialog.addEventListener('cancel', event => {
      event.preventDefault();
      this.closeExpanded();
    });
    this.expandedDialog.addEventListener('close', () => this.restoreCompact());
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x101820);
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
      this.renderPixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
      this.renderer.setPixelRatio(this.renderPixelRatio);
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.setClearColor(0x101820);
      this.renderer.domElement.setAttribute('aria-label', 'Drehbare Garage mit Sonnenbahn und Mondbahn');
      this.renderer.domElement.tabIndex = 0;
      this.root.prepend(this.renderer.domElement);
      this.controls = new OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = false;
      this.controls.enablePan = false;
      this.controls.minDistance = 10;
      this.controls.maxDistance = 80;
      this.controls.minPolarAngle = 0.05;
      this.controls.maxPolarAngle = Math.PI - 0.05;
      this.controls.addEventListener('change', () => this.requestRender());
      this.onOrbitStart = () => this.setPlaying(false, true);
      this.controls.addEventListener('start', this.onOrbitStart);
      this.root.querySelector('.reset-view').onclick = () => { this.setPlaying(false, true); this.resetCamera(); };
      this.root.querySelector('.reset-view').onpointerup = event => {
        if (event.pointerType === 'touch') { event.preventDefault(); this.setPlaying(false, true); this.resetCamera(); }
      };
      const planetButton = this.root.querySelector('.planet-toggle');
      this.onPlanetToggle = () => {
        this.planetPathsEnabled = !this.planetPathsEnabled;
        try { localStorage.setItem('pvGarageDemoRich.planetPaths', String(this.planetPathsEnabled)); } catch (_) {}
        this.refreshPlanets();
        this.requestRender();
      };
      planetButton.onclick = () => {
        if (performance.now() < (this.ignorePlanetClickUntil || 0)) return;
        this.onPlanetToggle();
      };
      planetButton.onpointerup = event => {
        if (event.pointerType === 'touch') {
          event.preventDefault();
          this.ignorePlanetClickUntil = performance.now() + 700;
          this.onPlanetToggle();
        }
      };
      this.onKey = event => {
        if (event.key === 'Home') { event.preventDefault(); this.resetCamera(); }
      };
      this.renderer.domElement.addEventListener('keydown', this.onKey);
      this.onLost = event => {
        event.preventDefault();
        this.annualPreview?.stop(false);
        this.setPlaying(false);
        this.showError('3D-Grafik unterbrochen. Bitte auf 2D und wieder auf 3D wechseln.');
      };
      this.renderer.domElement.addEventListener('webglcontextlost', this.onLost);
      this.scene.add(new THREE.HemisphereLight(0xe5f3ff, 0x68716f, 2.5));
      const key = new THREE.DirectionalLight(0xffffff, 2);
      key.position.set(8, 16, 12);
      this.scene.add(key);
      this.building = new THREE.Group();
      this.neighborhood = new THREE.Group();
      this.horizon = new THREE.Group();
      this.paths = new THREE.Group();
      this.current = new THREE.Group();
      this.planetPaths = new THREE.Group();
      this.planetCurrent = new THREE.Group();
      this.planetPaths.visible = this.planetCurrent.visible = false;
      this.scene.add(this.building, this.neighborhood, this.horizon, this.paths, this.current, this.planetPaths, this.planetCurrent);
      this.annualPreview = new SolarYearPreview(this);
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(host);
      this.cardScene = host.closest('.scene-three');
      if (this.cardScene) this.resizeObserver.observe(this.cardScene);
      this.visibility = () => {
        this.playTimestamp = null;
        this.nextFlightFrame = null;
        this.frameMetrics?.breakSequence();
        if (document.visibilityState === 'hidden') {
          clearTimeout(this.renderRetry); this.renderRetry = 0;
          this.annualPreview?.suspend();
          this.paintTest?.stop('Abgebrochen: Ansicht verborgen');
          cancelAnimationFrame(this.frame); this.frame = 0;
        } else { this.annualPreview?.resume(); this.requestRender(); }
      };
      document.addEventListener('visibilitychange', this.visibility);
    } catch (error) {
      this.dispose();
      throw error;
    }
  }

  showError(message) {
    const element = this.root.querySelector('.error');
    element.textContent = message;
    element.hidden = false;
    this.failed = true;
  }

  setPlaying(playing, persist = false) {
    if (playing) this.annualPreview?.stop();
    if (!playing) this.paintTest?.stop('Abgebrochen: Flug pausiert');
    this.playing = !!playing && !this.disposed && !!this.origin && !this.failed;
    if (!this.playing) { clearTimeout(this.renderRetry); this.renderRetry = 0; }
    if (persist) {
      try { localStorage.setItem('pvGarageDemoRich.playing', String(this.playing)); } catch (_) {}
    }
    this.playTimestamp = null;
    this.nextFlightFrame = null;
    this.frameMetrics?.breakSequence();
    if (this.syncPixelRatio()) this.requestRender();
    const button = this.root.querySelector('.play-view');
    button.setAttribute('aria-pressed', String(this.playing));
    button.title = this.playing ? 'Kamerafahrt pausieren' : 'Langsame Kamerafahrt starten';
    button.setAttribute('aria-label', button.title);
    button.innerHTML = this.playing
      ? '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m7 3 14 9-14 9z"/></svg>';
    if (!this.playing) return;
    const offset = this.camera.position.clone().sub(this.origin);
    this.flyRadius = THREE.MathUtils.clamp(offset.length(), this.controls.minDistance, this.controls.maxDistance);
    this.flyAzimuth = Math.atan2(offset.x, offset.z);
    this.flyStartElevation = THREE.MathUtils.clamp(Math.asin(THREE.MathUtils.clamp(offset.y / (offset.length() || 1), -1, 1)), 15 * RAD, 55 * RAD);
    this.flyElapsed = 0;
    this.flyPitchOffset = 0;
    this.advanceFlight(0);
    this.frameFlight(0);
    this.requestRender();
  }

  setFlightMode(mode, persist = true) {
    const next = mode === 'sun' ? 'sun' : 'simple';
    const changed = this.flightMode !== next;
    this.flightMode = next;
    const select = this.root.querySelector('.flight-mode');
    if (select) select.value = next;
    if (persist) {
      try { localStorage.setItem('pvGarageDemoRich.flightMode', next); } catch (_) {}
    }
    if (!changed) return;
    this.playTimestamp = this.nextFlightFrame = null;
    this.flyPitchOffset = 0;
    if (this.frameMetrics) this.setMeasurement(true);
    if (this.playing) {
      this.frameFlight(0);
      this.requestRender();
    }
  }

  frameFlight(seconds) {
    if (this.flightMode !== 'simple') { this.frameFlightSun(seconds); return; }
    const horizontal = this.flyRadius * Math.cos(this.flyElevation);
    this.controls.target.copy(this.origin);
    this.camera.position.set(
      this.origin.x + horizontal * Math.sin(this.flyAzimuth),
      this.origin.y + this.flyRadius * Math.sin(this.flyElevation),
      this.origin.z + horizontal * Math.cos(this.flyAzimuth));
    this.controls.update();
  }

  syncPixelRatio() {
    if (!this.renderer || this.disposed) return false;
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    if (ratio === this.renderPixelRatio) return false;
    this.renderPixelRatio = ratio;
    this.renderer.setPixelRatio(ratio);
    return true;
  }

  advanceFlight(seconds) {
    this.flyElapsed += seconds;
    this.flyAzimuth += seconds * 6 * RAD;
    const targetElevation = (32 + 17 * Math.sin(this.flyElapsed * Math.PI * 2 / 100)) * RAD;
    const elevation = THREE.MathUtils.lerp(this.flyStartElevation, targetElevation, 1 - Math.exp(-this.flyElapsed / 3));
    this.flyElevation = elevation;
  }

  frameFlightSun(seconds = 0) {
    const direction = new THREE.Vector3(Math.cos(this.flyElevation) * Math.sin(this.flyAzimuth),
      Math.sin(this.flyElevation), Math.cos(this.flyElevation) * Math.cos(this.flyAzimuth));
    this.camera.position.copy(this.origin).addScaledVector(direction, this.flyRadius);
    const forward = new THREE.Vector3(-Math.sin(this.flyAzimuth), 0, -Math.cos(this.flyAzimuth));
    let requiredOffset = 0;
    const sun = this.data?.sun;
    if (Number.isFinite(sun?.azimuth) && Number.isFinite(sun?.elevation) && this.renderHeight && this.renderWidth) {
      const point = skyVector(sun.azimuth, sun.elevation, this.skyRadius).add(this.origin).sub(this.camera.position);
      const sunPitch = Math.atan2(point.y, point.dot(forward));
      const tanV = Math.tan(this.camera.fov * RAD / 2);
      // Account for the marker's apparent size after pitching, without changing distance or FOV.
      for (let i = 0; i < 5; i++) {
        const offset = Math.max(requiredOffset, this.flyPitchOffset || 0);
        const referenceDepth = Math.max(.1, this.flyRadius * Math.cos(offset));
        const halfSymbol = Math.max(SKY_MARKER_MIN_PIXELS, SKY_MARKER_DIAMETER * this.renderHeight / (2 * referenceDepth * tanV)) / 2;
        const top = 1 - 2 * Math.min(this.renderHeight * .42, halfSymbol + 32) / this.renderHeight;
        requiredOffset = Math.max(0, sunPitch + this.flyElevation - Math.atan(tanV * top));
      }
    }
    // Prioritize the garage: its center stays within 10% of viewport height below center.
    const maxPitchOffset = Math.atan(Math.tan(this.camera.fov * RAD / 2) * 0.2);
    this.flyPitchOffset = Math.min(maxPitchOffset, Math.max(requiredOffset, (this.flyPitchOffset || 0) * Math.exp(-seconds / 1.5)));
    const pitch = THREE.MathUtils.clamp(-this.flyElevation + this.flyPitchOffset, -85 * RAD, 85 * RAD);
    const look = forward.multiplyScalar(Math.cos(pitch)); look.y = Math.sin(pitch);
    this.controls.target.copy(this.camera.position).addScaledVector(look, this.flyRadius);
    this.controls.update();
  }

  requestRender() {
    if (this.frame || this.disposed || !this.active || document.visibilityState === 'hidden') return;
    clearTimeout(this.renderRetry); this.renderRetry = 0;
    this.frame = requestAnimationFrame(timestamp => {
      this.frame = 0;
      if (!this.disposed && this.active) {
        if (!this.viewport.clientWidth || !this.viewport.clientHeight) {
          this.playTimestamp = this.nextFlightFrame = null;
          this.zoomTimestamp = undefined;
          // Brief DOM hiding may not produce a ResizeObserver notification on return.
          if (this.playing) this.renderRetry = setTimeout(() => { this.renderRetry = 0; this.requestRender(); }, 250);
          return;
        }
        if (this.playing && !this.expanded && this.flightMode !== 'simple') {
          // Tolerate small vsync jitter; rebase after stalls instead of a short catch-up frame.
          const interval = 1000 / 30;
          const due = this.nextFlightFrame ?? timestamp;
          if (timestamp < due - 2) { this.requestRender(); return; }
          this.nextFlightFrame = (timestamp - due > interval / 4 ? timestamp : due) + interval;
        } else this.nextFlightFrame = null;
        const measureStart = this.frameMetrics && this.playing ? performance.now() : null;
        let seconds = 0;
        if (this.playing) {
          // Avoid camera jumps after a suspended or overloaded browser.
          seconds = this.playTimestamp == null ? 0 : Math.min(0.1, Math.max(0, (timestamp - this.playTimestamp) / 1000));
          this.playTimestamp = timestamp;
          this.advanceFlight(seconds);
        }
        const zooming = this.advanceZoom(timestamp);
        if (this.playing) this.frameFlight(seconds);
        this.renderer.render(this.scene, this.camera);
        this.updateShadowMarker();
        if (measureStart != null) {
          this.updateTrace?.record('3D Bild', measureStart, performance.now());
          if (!this.paintTest?.running || this.paintTest.measuring) this.frameMetrics.frame(timestamp, performance.now() - measureStart);
          if (timestamp >= this.metricsNextUpdate) {
            this.metricsNextUpdate = timestamp + 1000;
            this.refreshMeasurement();
          }
        }
        if (this.playing || zooming) this.requestRender();
      }
    });
  }

  setActive(active) {
    if (!active) this.annualPreview?.stop();
    this.zoomTimestamp = undefined;
    const changed = this.active !== active;
    this.active = active;
    if (active) {
      this.resize();
      if (changed) this.restoreBrowserSettings();
      if (changed) this.requestRender();
    }
    else { this.closeOptions(); this.setMeasurement(false); this.setPlaying(false); cancelAnimationFrame(this.frame); this.frame = 0; }
  }

  openOptions() {
    if (this.disposed || this.expanded || this.optionsDialog.open) return;
    this.optionsDialog.querySelector('.options-body').append(this.root.querySelector('.tools'));
    this.optionsDialog.showModal();
    this.optionsDialog.querySelector('.close-options').focus();
  }

  closeOptions() {
    if (!this.optionsDialog?.open) return;
    this.optionsDialog.close();
    this.restoreOptions();
  }

  restoreOptions() {
    const tools = this.optionsDialog?.querySelector('.tools');
    if (!tools) return;
    this.root.append(tools);
    if (!this.disposed && this.active) tools.querySelector('.options-view').focus();
  }

  restoreBrowserSettings() {
    if (!this.origin || this.disposed || this.failed) return;
    let playing = true, measurement = false;
    try {
      playing = localStorage.getItem('pvGarageDemoRich.playing') !== 'false';
      measurement = localStorage.getItem('pvGarageDemoRich.measurement') === 'true';
    } catch (_) {}
    this.setPlaying(playing);
    this.setMeasurement(measurement);
  }

  setMeasurement(enabled, persist = false) {
    if (persist) {
      try { localStorage.setItem('pvGarageDemoRich.measurement', String(!!enabled)); } catch (_) {}
    }
    this.paintTest?.stop('Abgebrochen: Messung umgeschaltet');
    this.paintTestReport = null;
    this.metricsObserver?.disconnect();
    this.metricsObserver = null;
    this.updateTrace?.stop();
    this.updateTrace = null;
    this.frameMetrics = enabled && !this.disposed ? new GarageFrameMetrics() : null;
    this.metricsNextUpdate = 0;
    this.root.querySelector('.measure-view')?.setAttribute('aria-pressed', String(!!this.frameMetrics));
    if (this.metricsPanel) this.metricsPanel.hidden = !this.frameMetrics;
    if (!this.frameMetrics) return;
    this.updateTrace = new GarageUpdateTrace(() => !!this.playing && this.active && document.visibilityState !== 'hidden');
    this.updateTrace.wrap(GarageOrbit3D.prototype, 'update', '3D Update');
    this.updateTrace.wrap(GarageOrbit3D.prototype, 'makeCurrent', '3D Sonne/Mond', false, true);
    this.metricsHasLongTasks = false;
    try {
      if (typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes?.includes('longtask')) {
        this.metricsObserver = new PerformanceObserver(list => {
          if (!this.frameMetrics || !this.playing || !this.active || document.visibilityState === 'hidden' || (this.paintTest?.running && !this.paintTest.measuring)) return;
          for (const entry of list.getEntries()) {
            this.frameMetrics.longTask(entry);
            if (entry.startTime >= this.frameMetrics.startedAt) this.updateTrace?.longTask(entry);
          }
        });
        this.metricsObserver.observe({ entryTypes: ['longtask'] });
        this.metricsHasLongTasks = true;
      }
    } catch (_) { this.metricsObserver?.disconnect(); this.metricsObserver = null; }
    this.refreshMeasurement();
  }

  refreshMeasurement() {
    if (this.paintTestReport && this.metricsPanel) { this.metricsPanel.textContent = this.paintTestReport; return; }
    if (!this.frameMetrics || !this.metricsPanel) return;
    const s = this.frameMetrics.summary();
    const phase = this.paintTest?.running ? `${this.paintTest.phase.label}: ${Math.max(0, Math.ceil((this.paintTest.deadline - performance.now()) / 1000))} s\n` : '';
    this.metricsPanel.textContent = `${phase}FPS ${s.fps.toFixed(1)} | Abstand P95 ${s.p95.toFixed(0)} ms\nMax ${s.maxGap.toFixed(0)} ms | >50 ms: ${s.slow}\nJS ${s.jsMean.toFixed(1)} / ${s.jsMax.toFixed(1)} ms (ohne GPU)\nBrowser >50 ms: ${this.metricsHasLongTasks ? `${s.longTasks} / Max ${s.longTaskMax.toFixed(0)} ms` : 'nicht verfuegbar'}`;
    this.metricsPanel.textContent += this.updateTrace?.text() || '';
  }

  startPaintTest() {
    try {
      this.paintTestReport = 'Ebenenvergleich startet - alles bleibt aktiv ...';
      this.metricsPanel.hidden = false;
      this.refreshMeasurement();
      this.beginPaintTest();
    } catch (error) {
      try { this.paintTest?.stop('Startfehler'); } catch (_) {}
      this.metricsObserver?.disconnect(); this.metricsObserver = null;
      this.frameMetrics = null;
      const button = this.root.querySelector('.paint-test-view');
      button?.setAttribute('aria-pressed', 'false');
      if (button) button.textContent = 'A/B';
      this.paintTestReport = `A/B konnte nicht starten\n${String(error?.message || error).slice(0, 160)}\nRoom-Ebene aktiv`;
      this.metricsPanel.hidden = false;
      this.refreshMeasurement();
      console.warn('Garage A/B start failed', error);
    }
  }

  bindPaintTestButton(button) {
    const activate = () => this.paintTest?.running ? this.paintTest.stop() : this.startPaintTest();
    button.onclick = event => {
      event?.preventDefault();
      if (performance.now() < (this.ignorePaintTestClickUntil || 0)) return;
      activate();
    };
    button.onpointerup = event => {
      if (event.pointerType !== 'touch') return;
      event.preventDefault();
      this.ignorePaintTestClickUntil = performance.now() + 700;
      activate();
    };
  }

  beginPaintTest() {
    if (this.disposed || !this.active || document.visibilityState === 'hidden') throw new Error('Garage-Ansicht ist nicht aktiv');
    if (this.expanded) throw new Error('A/B bitte in der kleinen Solar-2-Ansicht starten');
    if (!this.playing) this.setPlaying(true);
    if (!this.playing) throw new Error('Kamerafahrt konnte nicht gestartet werden');
    this.setMeasurement(true);
    const flight = Object.fromEntries(['flyElapsed', 'flyAzimuth', 'flyStartElevation', 'flyElevation', 'flyPitchOffset', 'flyRadius'].map(key => [key, this[key]]));
    const button = this.root.querySelector('.paint-test-view');
    this.paintTest = new GaragePaintTest({
      cards: findPaintTestCards(),
      onPhase: () => {
        // Repeat the same camera segment; do not compare different viewing angles.
        Object.assign(this, flight);
        this.playTimestamp = this.nextFlightFrame = null;
        this.frameMetrics = new GarageFrameMetrics();
        this.metricsNextUpdate = 0;
        this.refreshMeasurement();
      },
      onMeasure: () => { this.frameMetrics = new GarageFrameMetrics(); },
      sample: () => ({ ...this.frameMetrics.summary(), frames: this.frameMetrics.frames, longTasksSupported: this.metricsHasLongTasks }),
      onDone: (rows, reason) => {
        button?.setAttribute('aria-pressed', 'false');
        if (button) button.textContent = 'A/B';
        this.metricsObserver?.disconnect(); this.metricsObserver = null;
        this.frameMetrics = null;
        const lines = rows.map(r => r.missing ? `${r.label}: nicht gefunden` : !r.frames ? `${r.label}: keine Bilder` :
          `${r.label}: ${r.fps.toFixed(1)} FPS | P95 ${r.p95.toFixed(0)} ms | B ${r.longTasksSupported ? r.longTasks : '-'}`);
        this.paintTestReport = `${reason} - Room-Ebene wieder aktiv\n${lines.join('\n')}\nAlles durchgehend aktiv. B: Blockaden >50 ms`;
        this.metricsPanel.hidden = false;
        this.root.querySelector('.measure-view')?.setAttribute('aria-pressed', 'false');
        this.refreshMeasurement();
      }
    });
    button?.setAttribute('aria-pressed', 'true');
    if (button) button.textContent = 'STOP';
    this.paintTest.start();
  }

  resize() {
    const width = this.viewport.clientWidth, height = this.viewport.clientHeight;
    if (this.disposed) return;
    if (!width || !height) {
      this.playTimestamp = this.nextFlightFrame = null;
      this.zoomTimestamp = undefined;
      return;
    }
    const oldAspect = this.camera.aspect;
    const changed = width !== this.renderWidth || height !== this.renderHeight;
    if (changed) {
      this.renderWidth = width;
      this.renderHeight = height;
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height, false);
    }
    // The calendar detail row changes aspect ratio without ending its active preview.
    if (!this.annualPreview?.running && (!this.cameraReady || Math.abs(oldAspect - this.camera.aspect) > 0.35)) {
      const wasPlaying = this.playing;
      this.resetCamera();
      if (wasPlaying) this.setPlaying(true);
    }
    // A hidden viewport can stop the frame loop without changing its restored dimensions.
    if (changed || this.playing) this.requestRender();
  }

  resetCamera() {
    if (!this.origin) return;
    this.annualPreview?.stop();
    this.setPlaying(false);
    this.applySkyRadius(this.fullOrbitRadius);
    this.zoomTimestamp = undefined;
    const vertical = THREE.MathUtils.degToRad(this.camera.fov);
    const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * this.camera.aspect);
    let distance = (13.5 * this.skyRadius / RADIUS) / ((this.expanded ? 1.05 : 1.85) * Math.sin(Math.min(vertical, horizontal) / 2));
    const direction = new THREE.Vector3(0.6, 0.28, 1).normalize();
    if (this.expanded && this.neighborhood.visible && this.neighborMeshes.length) {
      const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), direction).normalize();
      const up = new THREE.Vector3().crossVectors(direction, right);
      let fit = 0;
      this.neighborhood.updateMatrixWorld(true);
      for (const house of this.neighborMeshes) {
        if (!house.visible) continue;
        house.geometry.computeBoundingBox();
        const box = house.geometry.boundingBox.clone().applyMatrix4(house.matrixWorld);
        for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
          const offset = new THREE.Vector3(x, y, z).sub(this.origin);
          fit = Math.max(fit, offset.dot(direction) + Math.abs(offset.dot(right)) / Math.tan(horizontal / 2),
            offset.dot(direction) + Math.abs(offset.dot(up)) / Math.tan(vertical / 2));
        }
      }
      distance = Math.max(distance, fit * 1.1);
    }
    this.controls.maxDistance = Math.max(80, distance * 1.5);
    this.zoomReferenceDistance = distance;
    this.camera.far = Math.max(200, distance * 3);
    this.camera.updateProjectionMatrix();
    // Start compact view closer; retain the full-view reference for manual zoom.
    if (!this.expanded) distance = Math.max(this.controls.minDistance, distance * 0.45);
    this.controls.target.copy(this.origin);
    this.camera.position.copy(this.origin).addScaledVector(direction, distance);
    this.camera.lookAt(this.origin);
    this.applySkyRadius(this.zoomRadius());
    this.controls.update();
    this.cameraReady = true;
    this.requestRender();
  }

  openExpanded() {
    if (this.disposed || this.expandedDialog.open) return;
    this.annualPreview?.stop();
    this.setPlaying(false);
    this.compactCamera = { position: this.camera.position.clone(), target: this.controls.target.clone(),
      skyRadius: this.skyRadius, zoomReferenceDistance: this.zoomReferenceDistance };
    this.expandedDialog.showModal();
    this.releaseBackground = holdGarageBackground();
    this.expanded = true;
    this.update(this.data);
    this.refreshPlanets();
    this.resizeObserver.unobserve(this.viewport);
    this.viewport = this.root.querySelector('.expanded-scene');
    for (const node of [this.renderer.domElement, this.root.querySelector('.tools'), this.root.querySelector('.shadow-marker'), this.root.querySelector('.error'), this.metricsPanel, this.annualPreview.status]) this.viewport.append(node);
    this.resizeObserver.observe(this.viewport);
    this.cameraReady = false;
    this.resize();
    this.root.querySelector('.close-expanded').focus();
  }

  closeExpanded() {
    this.expandedDialog.close();
    this.restoreCompact();
  }

  restoreCompact() {
    if (!this.expanded || this.disposed) return;
    this.annualPreview?.stop();
    this.releaseBackground?.();
    this.releaseBackground = null;
    this.setPlaying(false);
    this.resizeObserver?.unobserve(this.viewport);
    for (const node of [this.renderer.domElement, this.root.querySelector('.tools'), this.root.querySelector('.shadow-marker'), this.root.querySelector('.error'), this.metricsPanel, this.annualPreview.status]) this.root.prepend(node);
    this.viewport = this.host;
    this.expanded = false;
    this.update(this.data);
    this.refreshPlanets();
    if (this.disposed) return;
    this.resizeObserver.observe(this.viewport);
    this.resize();
    if (this.compactCamera) {
      this.camera.position.copy(this.compactCamera.position);
      this.controls.target.copy(this.compactCamera.target);
      this.controls.update();
      this.zoomReferenceDistance = this.compactCamera.zoomReferenceDistance;
      this.applySkyRadius(this.compactCamera.skyRadius);
      this.zoomTimestamp = undefined;
    }
    this.compactCamera = null;
    this.requestRender();
    this.root.querySelector('.expand-view').focus();
  }

  updateExpandedDetails(data) {
    const key = JSON.stringify(data);
    if (key === this.displayKey) return;
    this.displayKey = key;
    const layout = this.root.querySelector('.expanded-layout');
    layout.dataset.numberMode = data?.numberMode || 'dseg';
    const times = this.root.querySelector('.expanded-times');
    times.replaceChildren();
    for (const [label, value, color] of data?.times || []) {
      const row = document.createElement('li');
      const name = document.createElement('span'); name.className = 'expanded-time-label'; name.textContent = label + ':';
      const number = document.createElement('span'); number.className = 'expanded-time'; number.textContent = value; number.style.color = color;
      row.append(name, number); times.append(row);
    }
    const metrics = this.root.querySelector('.expanded-metrics');
    metrics.replaceChildren();
    for (const metric of data?.metrics || []) {
      const item = document.createElement('div'); item.className = 'expanded-metric';
      const label = document.createElement('span'); label.className = 'expanded-metric-label'; label.textContent = metric.label;
      const value = document.createElement('div'); value.className = 'expanded-metric-value';
      const number = document.createElement('span'); number.className = 'expanded-number'; number.textContent = metric.value; number.style.color = metric.color;
      value.append(number);
      if (metric.direction) {
        const slash = document.createElement('span'); slash.className = 'expanded-slash'; slash.textContent = '/';
        const direction = document.createElement('span'); direction.className = 'expanded-direction'; direction.textContent = metric.direction; direction.style.color = metric.directionColor;
        value.append(slash, direction);
      }
      item.append(label, value); metrics.append(item);
    }
  }

  label(text, color, scale = 1) {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.font = 'bold 32px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 6; ctx.strokeStyle = '#101820'; ctx.strokeText(text, 128, 32);
    ctx.fillStyle = color; ctx.fillText(text, 128, 32);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: true, depthWrite: false }));
    sprite.scale.set(4.8 * scale, 1.2 * scale, 1);
    return sprite;
  }

  mesh(geometry, color, position, parent = this.building) {
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.12, side: THREE.DoubleSide }));
    mesh.position.copy(position);
    parent.add(mesh);
    return mesh;
  }

  makeBuilding(model) {
    release(this.building); release(this.horizon);
    this.model = model;
    const { width, length, wallHeight, pitch, roofAzimuth } = model;
    const half = width / 2, slope = Math.tan(pitch * RAD);
    const ridge = wallHeight + half * slope;
    // Same surface height as the incident-ray targets, including module mounting offsets.
    const panelCenterHeight = ridge - half / 2 * slope + 0.12 + 0.04 * Math.cos(pitch * RAD);
    this.origin = new THREE.Vector3(0, panelCenterHeight, 0);
    this.building.rotation.y = (90 - roofAzimuth) * RAD;
    this.mesh(new THREE.BoxGeometry(width, wallHeight, length), 0xc9cfcf, new THREE.Vector3(0, wallHeight / 2, 0));
    this.mesh(new THREE.BoxGeometry(width + 1, 0.12, length + 1), 0x6c787c, new THREE.Vector3(0, -0.06, 0));
    for (const side of [-1, 1]) {
      const roof = this.mesh(new THREE.BoxGeometry(half / Math.cos(pitch * RAD) + 0.28, 0.11, length + 0.4), 0xae5e4f,
        new THREE.Vector3(side * half / 2, ridge - half / 2 * slope, 0));
      roof.rotation.z = -side * pitch * RAD;
      const shape = new THREE.Shape();
      shape.moveTo(-half, wallHeight); shape.lineTo(half, wallHeight); shape.lineTo(0, ridge); shape.closePath();
      this.mesh(new THREE.ShapeGeometry(shape), 0x805333, new THREE.Vector3(0, 0, side * (length / 2 + 0.005)));
      // Nine modules per roof slope: three rows along the slope, three columns along the ridge.
      for (let row = 0; row < 3; row++) for (let column = 0; column < 3; column++) {
        const x = side * (0.2 + (row + 0.5) * (half - 0.4) / 3);
        const z = -length / 2 + 0.2 + (column + 0.5) * (length - 0.4) / 3;
        const panel = new THREE.Group();
        panel.name = 'pv-module';
        panel.position.set(x, ridge - Math.abs(x) * slope + 0.12, z);
        panel.rotation.z = -side * pitch * RAD;
        this.building.add(panel);
        const w = (half - 0.4) / 3 / Math.cos(pitch * RAD) - 0.08;
        const l = (length - 0.4) / 3 - 0.09;
        this.mesh(new THREE.BoxGeometry(w, 0.045, l), 0xaebfc7, new THREE.Vector3(), panel);
        this.mesh(new THREE.BoxGeometry(w - 0.055, 0.012, l - 0.055), 0x213e52, new THREE.Vector3(0, 0.03, 0), panel);
        for (let cell = 1; cell < 6; cell++) {
          this.mesh(new THREE.BoxGeometry(w - 0.065, 0.006, 0.009), 0x668595, new THREE.Vector3(0, 0.039, -l / 2 + cell * l / 6), panel);
        }
      }
    }
    for (const x of [-width / 4, width / 4]) {
      const door = this.mesh(new THREE.BoxGeometry(width / 2 - 0.3, wallHeight * 0.82, 0.04), 0x6c7c84,
        new THREE.Vector3(x, wallHeight * 0.41, -(length / 2 + 0.035)));
      door.name = 'garage-door';
      for (let row = 1; row < 6; row++) this.mesh(new THREE.BoxGeometry(width / 2 - 0.34, 0.025, 0.01), 0x95a3a8,
        new THREE.Vector3(x, row * wallHeight * 0.82 / 6, -(length / 2 + 0.062)));
    }
    // Rear wall is local +Z; right when looking at it is local +X.
    const rearZ = length / 2, doorX = width * 0.32;
    const doorWidth = Math.min(0.95, width * 0.18), doorHeight = wallHeight * 0.82;
    const rearDoor = new THREE.Group();
    rearDoor.name = 'rear-person-door';
    rearDoor.position.set(doorX, 0, rearZ);
    this.building.add(rearDoor);
    this.mesh(new THREE.BoxGeometry(doorWidth + 0.12, doorHeight + 0.08, 0.08), 0x46535a,
      new THREE.Vector3(0, (doorHeight + 0.08) / 2, 0.045), rearDoor);
    this.mesh(new THREE.BoxGeometry(doorWidth, doorHeight, 0.025), 0x829197,
      new THREE.Vector3(0, doorHeight / 2 + 0.025, 0.095), rearDoor);
    this.mesh(new THREE.BoxGeometry(0.045, 0.19, 0.025), 0xcbd3d5,
      new THREE.Vector3(-doorWidth * 0.35, doorHeight * 0.49, 0.12), rearDoor);
    this.mesh(new THREE.BoxGeometry(0.17, 0.035, 0.045), 0xe0e5e6,
      new THREE.Vector3(-doorWidth * 0.29, doorHeight * 0.51, 0.145), rearDoor);

    this.batchPanelMeshes();
    this.prepareStaticTransforms(this.building);
    this.makeNeighborhood(model.surroundings);
  }

  batchPanelMeshes() {
    // Only identical, fixed PV parts share a draw call. Building rotation stays on the parent.
    const groups = new Map();
    for (const panel of this.building.children.filter(object => object.name === 'pv-module')) {
      panel.updateMatrix();
      for (const mesh of [...panel.children]) {
        mesh.updateMatrix();
        const key = JSON.stringify([mesh.geometry.parameters, mesh.material.color.getHex()]);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push({ mesh, matrix: panel.matrix.clone().multiply(mesh.matrix) });
      }
    }
    for (const parts of groups.values()) {
      const first = parts[0].mesh;
      const batch = new THREE.InstancedMesh(first.geometry, first.material, parts.length);
      batch.name = 'pv-module-parts';
      parts.forEach(({ mesh, matrix }, index) => {
        batch.setMatrixAt(index, matrix);
        mesh.removeFromParent();
        if (index) { mesh.geometry.dispose(); mesh.material.dispose(); }
      });
      batch.instanceMatrix.needsUpdate = true;
      batch.computeBoundingBox();
      batch.computeBoundingSphere();
      this.building.add(batch);
    }
  }

  prepareStaticTransforms(group) {
    // Rebuild local matrices only when the static model changes; world transforms stay automatic.
    group.traverse(object => {
      object.updateMatrix();
      object.matrixAutoUpdate = false;
    });
    group.updateMatrixWorld(true);
  }

  orbitRadius() {
    const nearest = [...this.neighborMeshes].sort((a, b) =>
      Math.hypot(a.position.x, a.position.z) - Math.hypot(b.position.x, b.position.z));
    const houses = this.expanded ? nearest : nearest.slice(0, 3);
    let outerCorner = 0;
    this.neighborhood.updateMatrixWorld(true);
    for (const house of houses) {
      house.geometry.computeBoundingBox();
      const box = house.geometry.boundingBox;
      for (const x of [box.min.x, box.max.x]) for (const z of [box.min.z, box.max.z]) {
        const corner = new THREE.Vector3(x, 0, z).applyMatrix4(house.matrixWorld);
        outerCorner = Math.max(outerCorner, Math.hypot(corner.x - this.origin.x, corner.z - this.origin.z));
      }
    }
    // Enclose complete rotated footprints, not just their centers. Visibility is cosmetic.
    return Math.max(this.expanded ? (this.model.detailOrbitRadius || 33) : COMPACT_RADIUS,
      houses.length ? outerCorner + 2 : 0);
  }

  zoomRadius() {
    if (!this.zoomReferenceDistance || !this.origin) return this.fullOrbitRadius * SKY_RADIUS_SCALE;
    const full = this.fullOrbitRadius, nearRadius = Math.min(COMPACT_RADIUS, full);
    const far = this.zoomReferenceDistance;
    const near = Math.min(far - 0.001, Math.max(this.controls.minDistance, far * nearRadius / full));
    const distance = this.playing ? this.flyRadius : this.camera.position.distanceTo(this.controls.target);
    const t = THREE.MathUtils.clamp((distance - near) / (far - near), 0, 1);
    return THREE.MathUtils.lerp(nearRadius, full, t * t * (3 - 2 * t)) * SKY_RADIUS_SCALE;
  }

  advanceZoom(timestamp) {
    if (!this.data || !Number.isFinite(this.skyRadius)) return false;
    const target = this.zoomRadius();
    const delta = target - this.skyRadius;
    if (Math.abs(delta) < 0.0001) {
      if (delta) this.applySkyRadius(target);
      this.zoomTimestamp = undefined;
      return false;
    }
    const dt = this.zoomTimestamp === undefined ? 16 : Math.min(64, Math.max(0, timestamp - this.zoomTimestamp));
    this.zoomTimestamp = timestamp;
    this.applySkyRadius(this.skyRadius + delta * (1 - Math.exp(-dt / 120)));
    return true;
  }

  applySkyRadius(radius) {
    if (!Number.isFinite(radius) || !this.skyRadius || Math.abs(radius - this.skyRadius) < 1e-10) return;
    const factor = radius / this.skyRadius;
    const matrix = new THREE.Matrix4().makeScale(factor, factor, factor);
    matrix.setPosition(this.origin.clone().multiplyScalar(1 - factor));
    const move = object => {
      if (Number.isFinite(object.userData.skyAzimuth)) {
        object.position.copy(skyVector(object.userData.skyAzimuth, 0, radius + 1).add(this.origin));
      } else if (object.isLine || object.isLine2 || object.name === 'horizon-tint') {
        object.geometry.applyMatrix4(matrix);
        object.computeLineDistances?.();
      } else {
        const offset = object.userData.skyLabelOffset || 0;
        object.position.y -= offset;
        object.position.applyMatrix4(matrix);
        object.position.y += offset;
      }
    };
    // Reuse geometry and textures during wheel/pinch animation; no astronomy or building rebuild.
    for (const group of [this.horizon, this.paths, this.planetPaths, this.planetCurrent]) {
      for (const object of group.children) move(object);
    }
    for (const object of this.current.children) {
      if (object.userData.skyScaled) move(object);
      if (object.name === 'sun-ray-lit') {
        const direction = skyVector(this.data.sun.azimuth, this.data.sun.elevation, 1);
        const end = this.origin.clone().addScaledVector(direction, Math.max(radius, object.userData.obstructionEnd || 0));
        const positions = object.geometry.attributes.position;
        positions.setXYZ(1, end.x, end.y, end.z); positions.needsUpdate = true;
        object.geometry.computeBoundingSphere(); object.computeLineDistances();
      }
    }
    this.shadowState?.point.applyMatrix4(matrix);
    this.skyRadius = radius;
    this.annualPreview?.syncProjection();
  }

  makeHorizon() {
    release(this.horizon);
    const tint = new THREE.Mesh(
      new THREE.CircleGeometry(this.skyRadius, 96).rotateX(-Math.PI / 2).translate(this.origin.x, this.origin.y, this.origin.z),
      new THREE.MeshBasicMaterial({ color: 0x67b981, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false })
    );
    tint.name = 'horizon-tint';
    // Draw the translucent base before the other transparent objects, without masking paths below it.
    tint.renderOrder = -1;
    this.horizon.add(tint);
    for (const [body, color, opacity] of [['sun', 0xaebbc2, 0.24], ['moon', MOON, 0.30], ['planet', 0xaebbc2, 0.20]]) {
      const ring = [];
      const radius = this.skyRadius * this.orbitScale(body);
      for (let angle = 0; angle <= 360; angle += 2) ring.push(skyVector(angle, 0, radius).add(this.origin));
      const line = this.line(ring, color, false, this.horizon, opacity);
      line.name = 'horizon-ring-' + body;
      line.userData.body = body;
    }
    for (let angle = 0; angle < 360; angle += 45) {
      this.line([this.origin, skyVector(angle, 0, this.skyRadius).add(this.origin)], 0xaebbc2, true, this.horizon, 0.25);
    }
    for (const [a, name, color] of [[0, 'N', '#ff4355'], [90, 'O', '#55ec69'], [180, 'S', '#439cff'], [270, 'W', '#ffff00']]) {
      const label = this.label(name, color, 1.25);
      label.userData.skyAzimuth = a;
      label.position.copy(skyVector(a, 0, this.skyRadius + 1).add(this.origin));
      this.horizon.add(label);
    }
  }

  makeNeighborhood(config = {}) {
    release(this.neighborhood);
    this.neighborMeshes = [];
    const enabled = config !== false && config?.enabled !== false;
    const houses = enabled ? (Array.isArray(config?.buildings) ? config.buildings : ESTIMATED_NEIGHBORS) : [];
    for (const house of houses.slice(0, 20)) {
      if (!house || typeof house !== 'object') continue;
      const values = ['east', 'north', 'width', 'length', 'wall_height', 'ridge_height', 'roof_azimuth']
        .map(key => key === 'roof_azimuth' && house.parallel_to_garage === true ? this.model.roofAzimuth : house[key]);
      if (!values.every(value => typeof value === 'number' && Number.isFinite(value))) continue;
      const [east, north, width, length, wall, ridge, azimuth] = values;
      const ground = house.ground_height ?? 0;
      if (!Number.isFinite(ground) || Math.abs(ground) > 30 || Math.abs(east) > 100 || Math.abs(north) > 100 ||
          width <= 0 || length <= 0 || width > 50 || length > 50 || wall <= 0 || ridge < wall || ridge > 40) continue;
      const shape = new THREE.Shape();
      shape.moveTo(-width / 2, 0); shape.lineTo(width / 2, 0);
      shape.lineTo(width / 2, wall); shape.lineTo(0, ridge); shape.lineTo(-width / 2, wall); shape.closePath();
      const geometry = new THREE.ExtrudeGeometry(shape, { depth: length, bevelEnabled: false, steps: 1 });
      geometry.translate(0, 0, -length / 2);
      const name = String(house.name || 'Haus').slice(0, 40);
      const direction = name.trim().toLowerCase().replace(/\u00fc/g, 'ue');
      const tint = { ost:0xb0b5b8, sued:0x8ad29a, suedwest:0xe5a6b8, west:0x8ad29a, nord:0xe6d986 }[direction] ?? null;
      const material = new THREE.MeshBasicMaterial({ color: tint ?? 0xa8c7d3, transparent: true, opacity: 0.10,
        depthTest: true, depthWrite: false, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = 'estimated-neighbor'; mesh.userData.label = name;
      mesh.position.set(east, ground, -north); mesh.rotation.y = (90 - azimuth) * RAD;
      mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry),
        new THREE.LineBasicMaterial({ color: tint ?? 0xb7d0da, transparent: true, opacity: 0.48, depthWrite: false })));
      this.neighborhood.add(mesh); this.neighborMeshes.push(mesh);
    }
    this.neighborhood.visible = enabled;
    this.prepareStaticTransforms(this.neighborhood);
    this.houseDayKey = undefined;
    this.root.querySelector('.house-mode').hidden = !this.neighborMeshes.length;
  }

  refreshNeighborhood() {
    if (!this.neighborhood || !this.data) return false;
    const day = this.data.houseDay, now = this.data.now;
    const validDay = day && Number.isFinite(now) && now >= day.start && now < day.end;
    if (this.houseMode === 'auto' && validDay) {
      const key = JSON.stringify(['house-windows-v2', day.key, this.geometryKey]);
      if (key !== this.houseDayKey) {
        let cached;
        try { cached = JSON.parse(localStorage.getItem('pvGarageDemoRich.houseDay')); } catch (_) {}
        const validWindows = rows => Array.isArray(rows) && rows.length === this.neighborMeshes.length && rows.every(row =>
          ['sun', 'moon'].every(body => Array.isArray(row?.[body]) && row[body].length <= 128 && row[body].every(w =>
            Array.isArray(w) && w.length === 2 && w.every(Number.isFinite) && w[0] >= day.start && w[1] <= day.end && w[1] >= w[0])));
        if (cached?.key === key && validWindows(cached.windows)) {
          this.houseWindows = cached.windows;
        } else {
          this.houseWindows = this.dailyHouseWindows(day);
          if (this.houseWindows) {
            try { localStorage.setItem('pvGarageDemoRich.houseDay', JSON.stringify({key, windows:this.houseWindows})); } catch (_) {}
          }
        }
        this.houseDayKey = key;
      }
    } else if (!validDay) {
      this.houseDayKey = undefined;
      this.houseWindows = undefined;
    }
    const groupVisible = this.houseMode !== 'off';
    let changed = this.neighborhood.visible !== groupVisible;
    this.neighborhood.visible = groupVisible;
    this.neighborMeshes.forEach((house, i) => {
      const windows = this.houseWindows?.[i];
      const visible = this.houseMode !== 'auto' || !windows || ['sun', 'moon'].some(body =>
        this.data[body]?.elevation > 0 && windows[body].some(([start, end]) => now >= start && now <= end));
      changed ||= house.visible !== visible;
      house.visible = visible;
    });
    return changed;
  }

  dailyHouseWindows(day) {
    // Conservative box sweep: keep borderline houses; display filtering never changes physical rays.
    if (!['sun', 'moon'].every(body => Array.isArray(day[body]) && day[body].length >= 2 && day[body].every((s, i, samples) =>
      [s.time, s.azimuth, s.elevation].every(Number.isFinite) && (!i || s.time > samples[i - 1].time)))) return null;
    this.building.updateMatrixWorld(true);
    this.neighborhood.updateMatrixWorld(true);
    const garage = new THREE.Box3().setFromObject(this.building);
    const origin = garage.getCenter(new THREE.Vector3());
    // Half-metre tolerance covers sampling boundaries and estimated footprints.
    const extent = garage.getSize(new THREE.Vector3()).multiplyScalar(0.5).addScalar(0.5);
    const ray = new THREE.Ray(origin), hit = new THREE.Vector3();
    const boxes = this.neighborMeshes.map(house => {
      house.geometry.computeBoundingBox();
      const box = house.geometry.boundingBox.clone().applyMatrix4(house.matrixWorld);
      box.min.sub(extent); box.max.add(extent);
      return box;
    });
    const windows = boxes.map(() => ({sun:[], moon:[]})), padding = 5 * 60000;
    for (const body of ['sun', 'moon']) {
      const samples = day[body];
      for (let i = 0; i < samples.length - 1; i++) {
        const a = samples[i], b = samples[i + 1];
        const delta = ((b.azimuth - a.azimuth + 540) % 360) - 180;
        const steps = Math.max(1, Math.ceil(Math.max(Math.abs(delta), Math.abs(b.elevation - a.elevation)) / 0.25));
        for (let j = 0; j <= steps; j++) {
          const t = j / steps, elevation = a.elevation + (b.elevation - a.elevation) * t;
          if (elevation <= 0) continue;
          ray.direction.copy(skyVector(a.azimuth + delta * t, elevation, 1));
          const time = a.time + (b.time - a.time) * t;
          const start = Math.max(day.start, time - padding), end = Math.min(day.end, time + padding);
          boxes.forEach((box, index) => {
            if (!ray.intersectBox(box, hit)) return;
            const runs = windows[index][body], last = runs[runs.length - 1];
            if (last && start <= last[1]) last[1] = Math.max(last[1], end);
            else runs.push([start, end]);
          });
        }
      }
    }
    return windows;
  }

  neighborObstruction(origin, direction) {
    // Infinite physical ray: the symbolic sky radius must not exclude distant buildings.
    this.neighborRay ||= new THREE.Raycaster();
    this.neighborRay.set(origin, direction);
    this.neighborRay.near = 0.001;
    this.neighborRay.far = Infinity;
    this.neighborhood.updateMatrixWorld(true);
    const hits = this.neighborRay.intersectObjects(this.neighborMeshes, false);
    return hits.length ? hits[hits.length - 1] : null;
  }

  sunlightLine(origin, direction, minimumLength, parent = this.current) {
    const hit = this.neighborObstruction(origin, direction);
    const shadowEnd = hit?.distance || 0;
    const length = Math.max(minimumLength, shadowEnd ? shadowEnd + 2 : 0);
    if (shadowEnd) {
      const dim = this.currentLine('sun-ray-attenuated', [origin, origin.clone().addScaledVector(direction, shadowEnd)], SUN, 0.20);
      dim.name = 'sun-ray-attenuated';
      dim.userData = { estimated: true, building: hit.object.userData.label };
    }
    const lit = this.currentLine('sun-ray-lit', [origin.clone().addScaledVector(direction, shadowEnd), origin.clone().addScaledVector(direction, length)], SUN, 0.85);
    lit.name = 'sun-ray-lit';
    lit.userData.obstructionEnd = shadowEnd ? shadowEnd + 2 : 0;
    return hit;
  }

  currentLine(key, points, color, opacity) {
    this._currentLines ||= new Map();
    let line = this._currentLines.get(key);
    if (!line) {
      line = this.line(points, color, true, this.current, opacity);
      line.name = key;
      this._currentLines.set(key, line);
    } else {
      const positions = line.geometry.attributes.position;
      points.forEach((point, i) => positions.setXYZ(i, point.x, point.y, point.z));
      positions.needsUpdate = true;
      const distances = line.geometry.attributes.lineDistance;
      distances.setX(0, 0); distances.setX(1, points[0].distanceTo(points[1]));
      distances.needsUpdate = true;
      line.geometry.computeBoundingSphere();
    }
    line.visible = true;
    line.userData.skyScaled = !key.startsWith('sun-ray-');
    return line;
  }

  line(points, color, dashed, parent, opacity = 1) {
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = dashed
      ? new THREE.LineDashedMaterial({ color, dashSize: 0.19, gapSize: 0.13, transparent: opacity < 1, opacity })
      : new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity });
    const line = new THREE.Line(geometry, material);
    if (dashed) line.computeLineDistances();
    parent.add(line);
    return line;
  }

  orbitScale(body) {
    return body === 'sun' ? 1 : body === 'moon' ? 0.90 : 0.95;
  }

  horizonIntersections(points, segments = false) {
    const hits = [], epsilon = 1e-7;
    const add = point => {
      point.y = 0;
      if (point.lengthSq() < epsilon * epsilon) return;
      point.normalize();
      if (!hits.some(hit => hit.distanceToSquared(point) < 1e-8)) hits.push(point);
    };
    for (let i = 1; i < points.length; i += segments ? 2 : 1) {
      const a = points[i - 1], b = points[i];
      if (![a.x,a.y,a.z,b.x,b.y,b.z].every(Number.isFinite)) continue;
      if (Math.abs(a.y) <= epsilon && Math.abs(b.y) <= epsilon) continue;
      if (Math.abs(a.y) <= epsilon) add(a.clone());
      if (Math.abs(b.y) <= epsilon) add(b.clone());
      if (a.y * b.y < 0) add(a.clone().lerp(b, -a.y / (b.y - a.y)));
    }
    return hits;
  }

  horizonCrossingMarker(color) {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 32;
    const ctx = canvas.getContext('2d');
    ctx.beginPath(); ctx.arc(16,16,11,0,Math.PI*2);
    ctx.fillStyle = new THREE.Color(color).getStyle(); ctx.fill();
    ctx.strokeStyle = '#000000'; ctx.lineWidth = 4; ctx.stroke();
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const marker = this.skyMarker(new THREE.SpriteMaterial({ map:texture, transparent:true, depthTest:true, depthWrite:false }), .26, 8);
    marker.name = 'horizon-crossing';
    return marker;
  }

  trajectory(samples, color, body) {
    let run = [], previous;
    const flush = () => {
      if (run.length > 1) {
        if (previous < 0) {
          // Mesh-based lines support subpixel widths, unlike native WebGL lines.
          const geometry = new LineGeometry().setPositions(run.flatMap(point => point.toArray()));
          const material = new LineMaterial({ color, linewidth: 0.5, dashed: true,
            dashSize: 0.19, gapSize: 0.13, alphaToCoverage: true });
          const line = new Line2(geometry, material);
          line.name = 'night-trajectory';
          line.userData.body = body;
          line.computeLineDistances();
          this.paths.add(line);
        } else this.line(run, color, false, this.paths).userData.body = body;
      }
      run = [];
    };
    for (const sample of samples) {
      if (!Number.isFinite(sample.azimuth) || !Number.isFinite(sample.elevation)) continue;
      const point = skyVector(sample.azimuth, sample.elevation, this.skyRadius * this.orbitScale(body)).add(this.origin);
      if (previous !== undefined && (sample.elevation >= 0) !== (previous >= 0)) {
        run.push(point); flush(); run.push(point);
      } else run.push(point);
      previous = sample.elevation;
    }
    flush();
    const points = samples.map(sample => skyVector(sample.azimuth, sample.elevation, 1));
    for (const point of this.horizonIntersections(points)) {
      const marker = this.horizonCrossingMarker(color);
      marker.userData.body = body;
      marker.position.copy(point).multiplyScalar(this.skyRadius * this.orbitScale(body)).add(this.origin);
      this.paths.add(marker);
    }
  }

  makePaths(data) {
    release(this.paths);
    this.trajectory(data.tracks.sun, SUN, 'sun');
    this.trajectory(data.tracks.moon, MOON, 'moon');
    for (const event of data.tracks.events) {
      if (!Number.isFinite(event.azimuth) || !Number.isFinite(event.elevation)) continue;
      const body = event.label.startsWith('M') ? 'moon' : 'sun';
      const point = skyVector(event.azimuth, event.elevation, this.skyRadius * this.orbitScale(body)).add(this.origin);
      const color = event.label.startsWith('M') ? MOON : SUN;
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), new THREE.MeshBasicMaterial({ color }));
      dot.userData.body = body;
      dot.position.copy(point); this.paths.add(dot);
      const text = this.label(event.label, color === SUN ? '#ffff00' : '#58bcff', 0.85);
      text.userData.skyLabelOffset = 0.65;
      text.userData.body = body;
      text.position.copy(point).add(new THREE.Vector3(0, 0.65, 0)); this.paths.add(text);
    }
  }

  moonTexture(icon) {
    if (this._moonTexture?.icon === icon) return this._moonTexture;
    this._moonTexture?.texture.dispose();
    const entry = { icon, ready: false, texture: null };
    this._moonTexture = entry;
    entry.texture = new THREE.TextureLoader().load(icon, () => {
      // A position update may have replaced the sprite while this image loaded.
      if (this.disposed || this._moonTexture !== entry) return;
      // Rasterize the unchanged SVG before upload: direct SVG WebGL uploads fail on some browsers.
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 128;
      canvas.getContext('2d').drawImage(entry.texture.image, 0, 0, 128, 128);
      entry.texture.image = canvas;
      entry.texture.needsUpdate = true;
      entry.ready = true;
      if (this._moonIconActive && this._moonBall) this._moonBall.visible = false;
      if (this._moonIconActive && this._moonSprite) this._moonSprite.visible = true;
      this.requestRender();
    }, undefined, () => {
      if (this.disposed || this._moonTexture !== entry) return;
      entry.texture.dispose();
      this._moonTexture = null;
      this.currentKey = undefined;
      if (this._moonIconActive && this._moonBall) this._moonBall.visible = true;
      if (this._moonSprite) this._moonSprite.visible = false;
      this.requestRender();
    });
    entry.texture.colorSpace = THREE.SRGBColorSpace;
    return entry;
  }

  skyMarker(material, diameter, minimumPixels) {
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(diameter, diameter, 1);
    const cameraPoint = new THREE.Vector3(), referencePoint = new THREE.Vector3();
    sprite.onBeforeRender = (renderer, scene, camera) => {
      cameraPoint.copy(sprite.position).applyMatrix4(camera.matrixWorldInverse);
      referencePoint.copy(this.origin).applyMatrix4(camera.matrixWorldInverse);
      const pixelSize = 2 * Math.max(0, -cameraPoint.z) * Math.tan(camera.fov * RAD / 2) / Math.max(1, this.renderHeight);
      // Use the common scene-center distance: neither body grows when its symbolic orbit comes closer.
      const referencePixelSize = 2 * Math.max(0.1, -referencePoint.z) * Math.tan(camera.fov * RAD / 2) / Math.max(1, this.renderHeight);
      const size = Math.max(diameter / referencePixelSize, minimumPixels) * pixelSize;
      sprite.scale.set(size, size, 1);
      sprite.updateMatrixWorld();
    };
    return sprite;
  }

  sunMarker(point, elevation) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 80;
    const ctx = canvas.getContext('2d');
    ctx.lineCap = 'round';
    for (const [color, width] of [['#000000', 4], ['#ffbd28', 2]]) {
      ctx.strokeStyle = color; ctx.lineWidth = width;
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        ctx.beginPath(); ctx.moveTo(40 + 32 * Math.cos(a), 40 + 32 * Math.sin(a));
        ctx.lineTo(40 + 36 * Math.cos(a), 40 + 36 * Math.sin(a)); ctx.stroke();
      }
    }
    ctx.beginPath(); ctx.arc(40, 40, 28, 0, Math.PI * 2);
    if (elevation >= 0) { ctx.fillStyle = '#ffdf32'; ctx.fill(); }
    ctx.strokeStyle = '#000000'; ctx.lineWidth = elevation < 0 ? 9 : 4; ctx.stroke();
    if (elevation < 0) { ctx.strokeStyle = '#ffdf32'; ctx.lineWidth = 6; ctx.stroke(); }
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = this.skyMarker(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: true, depthWrite: false, opacity: 1 }), SKY_MARKER_DIAMETER, SKY_MARKER_MIN_PIXELS);
    sprite.name = 'sun-marker'; sprite.position.copy(point);
    return sprite;
  }

  eclipseMoonMarker(newMoon) {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.beginPath(); ctx.arc(32,32,28,0,Math.PI*2);
    ctx.fillStyle = newMoon ? '#101820' : '#d9e4ef'; ctx.fill();
    ctx.strokeStyle = '#000000'; ctx.lineWidth = 6; ctx.stroke();
    ctx.strokeStyle = '#58bcff'; ctx.lineWidth = 2; ctx.stroke();
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    return this.skyMarker(new THREE.SpriteMaterial({ map:texture, transparent:true, depthTest:true, depthWrite:false }),
      SKY_MARKER_DIAMETER * MOON_MARKER_SCALE, SKY_MARKER_MIN_PIXELS * MOON_MARKER_SCALE);
  }

  makeCurrent(data) {
    // Keep GPU resources across position updates. Inactive branches remain hidden for reuse.
    for (const object of this.current.children) object.visible = false;
    this._moonIconActive = false;
    this.shadowState = data.sun.elevation > 0 && data.sun.shadowLevel > 0
      ? { point: skyVector(data.sun.azimuth, data.sun.elevation, this.skyRadius).add(this.origin), level: data.sun.shadowLevel, color: data.sun.shadowColor }
      : null;
    for (const [name, body, color] of [['Sonne', data.sun, SUN], ['Mond', data.moon, MOON]]) {
      if (!Number.isFinite(body.azimuth) || !Number.isFinite(body.elevation)) continue;
      const point = skyVector(body.azimuth, body.elevation, this.skyRadius * this.orbitScale(name === 'Mond' ? 'moon' : 'sun')).add(this.origin);
      let ball;
      if (name === 'Mond') {
        if (!this._moonBall) {
          this._moonBall = new THREE.Mesh(new THREE.SphereGeometry(0.29 * MOON_MARKER_SCALE, 20, 14), new THREE.MeshBasicMaterial({ color: 0xc6dafa }));
          this._moonBall.userData.skyScaled = true;
          this.current.add(this._moonBall);
        }
        ball = this._moonBall; ball.position.copy(point); ball.visible = true;
      } else {
        const above = body.elevation >= 0;
        if (!this._sunMarker || this._sunAbove !== above) {
          const fresh = this.sunMarker(point, body.elevation);
          if (this._sunMarker) {
            this._sunMarker.material.map.dispose();
            this._sunMarker.material.map = fresh.material.map;
            this._sunMarker.material.needsUpdate = true;
            fresh.material.dispose();
          } else {
            this._sunMarker = fresh; this.current.add(fresh);
            fresh.userData.skyScaled = true;
          }
          this._sunAbove = above;
        }
        this._sunMarker.position.copy(point); this._sunMarker.visible = true;
      }
      if (name === 'Mond' && body.icon) {
        this._moonIconActive = true;
        const entry = this.moonTexture(body.icon);
        if (!this._moonRim) {
          const disc = document.createElement('canvas');
          disc.width = disc.height = 64;
          const ctx = disc.getContext('2d');
          ctx.beginPath(); ctx.arc(32, 32, 28, 0, Math.PI * 2);
          ctx.fillStyle = '#101820'; ctx.fill();
          ctx.strokeStyle = '#000000'; ctx.lineWidth = 7; ctx.stroke();
          ctx.strokeStyle = '#d9efff'; ctx.lineWidth = 3; ctx.stroke();
          const rimTexture = new THREE.CanvasTexture(disc);
          rimTexture.colorSpace = THREE.SRGBColorSpace;
          const rim = this.skyMarker(new THREE.SpriteMaterial({ map: rimTexture, transparent: true, depthTest: true, depthWrite: false }), SKY_MARKER_DIAMETER * MOON_MARKER_SCALE, SKY_MARKER_MIN_PIXELS * MOON_MARKER_SCALE);
          rim.name = 'moon-contrast-rim';
          rim.userData.skyScaled = true;
          this._moonRim = rim;
          this.current.add(rim);
          const sprite = this.skyMarker(new THREE.SpriteMaterial({ map: entry.texture, transparent: true, depthTest: true, depthWrite: false }), SKY_MARKER_DIAMETER * 0.85 * MOON_MARKER_SCALE, SKY_MARKER_MIN_PIXELS * 0.85 * MOON_MARKER_SCALE);
          sprite.name = 'moon-phase';
          this._moonSprite = sprite;
          sprite.userData.skyScaled = true;
          this.current.add(sprite);
        }
        const sprite = this._moonSprite;
        if (sprite.material.map !== entry.texture) {
          sprite.material.map = entry.texture;
          sprite.material.needsUpdate = true;
        }
        this._moonRim.position.copy(point); this._moonRim.visible = true;
        ball.visible = !entry.ready;
        sprite.visible = entry.ready;
        sprite.position.copy(point);
      }
      if (name === 'Sonne' && body.elevation > 0) {
        this.sunlightLine(this.origin, skyVector(body.azimuth, body.elevation, 1), this.skyRadius);
      } else this.currentLine(name + '-radius', [this.origin, point], color, 0.75);
      this.currentLine(name + '-height', [point, new THREE.Vector3(point.x, this.origin.y, point.z)], color, 0.35);
    }
    this.panelSunVectors(data.sun);
  }

  updateShadowMarker() {
    if (this.annualPreview?.running) {
      if (this.shadowDom) this.setShadowVisible(false);
      else this.root.querySelector('.shadow-marker').hidden = true;
      return;
    }
    if (!this.shadowDom) {
      const marker = this.root.querySelector('.shadow-marker');
      this.shadowDom = { marker, lines: Array.from(marker.querySelectorAll('line')),
        color: marker.querySelector('.shadow-color'), title: marker.querySelector('title'),
        visible: !marker.hasAttribute('hidden') };
    }
    const dom = this.shadowDom;
    const state = this.shadowState;
    if (!state || !this.renderWidth || !this.renderHeight) return this.setShadowVisible(false);
    this.shadowOcclusionRay ||= new THREE.Raycaster();
    const toSun = state.point.clone().sub(this.camera.position);
    this.shadowOcclusionRay.set(this.camera.position, toSun.clone().normalize());
    this.shadowOcclusionRay.far = toSun.length();
    if (this.shadowOcclusionRay.intersectObject(this.building, true).length) return this.setShadowVisible(false);
    const p = state.point.clone().project(this.camera);
    if (![p.x, p.y, p.z].every(Number.isFinite) || p.z < -1 || p.z > 1 || Math.abs(p.x) > 1 || Math.abs(p.y) > 1) return this.setShadowVisible(false);
    const o = this.origin.clone().project(this.camera);
    const width = this.renderWidth, height = this.renderHeight;
    const dx = (o.x - p.x) * width, dy = -(o.y - p.y) * height;
    const length = Math.hypot(dx, dy);
    const ux = length > 0.01 ? dx / length : 0, uy = length > 0.01 ? dy / length : 1;
    // Screen-space tangent keeps the bar visible at the inner edge while rotating.
    const sunRadius = (this.current.getObjectByName('sun-marker')?.scale.x || 0.9) * 0.4;
    const edge = state.point.clone().addScaledVector(new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0), sunRadius).project(this.camera);
    const radius = Math.abs(edge.x - p.x) * width / 2;
    const cx = (p.x + 1) * width / 2 + ux * (radius + 4);
    const cy = (1 - p.y) * height / 2 + uy * (radius + 4);
    const half = Math.max(6, radius + 2);
    const coordinates = [cx - uy * half, cy + ux * half, cx + uy * half, cy - ux * half];
    for (const [i, attribute] of ['x1', 'y1', 'x2', 'y2'].entries()) {
      if (dom.coordinates?.[i] === coordinates[i]) continue;
      for (const line of dom.lines) line.setAttribute(attribute, coordinates[i]);
    }
    dom.coordinates = coordinates;
    const color = state.color || (state.level >= 1 ? '#ff4355' : '#ffff00');
    if (dom.stroke !== color) { dom.color.setAttribute('stroke', color); dom.stroke = color; }
    const title = state.level >= 1 ? 'Vollschatten (Objektmodell)' : 'Halbschatten (Objektmodell)';
    if (dom.label !== title) {
      dom.title.textContent = title;
      dom.marker.setAttribute('aria-label', title);
      dom.label = title;
    }
    this.setShadowVisible(true);
  }

  setShadowVisible(visible) {
    const dom = this.shadowDom;
    if (dom.visible === visible) return;
    if (visible) dom.marker.removeAttribute('hidden');
    else dom.marker.setAttribute('hidden', '');
    dom.visible = visible;
  }

  panelSunVectors(sun) {
    if (!Number.isFinite(sun.azimuth) || !Number.isFinite(sun.elevation) || sun.elevation <= 0) return;
    const { width, wallHeight, pitch } = this.model;
    const sunDirection = skyVector(sun.azimuth, sun.elevation, 1);
    const slope = pitch * RAD;
    const ridge = wallHeight + width / 2 * Math.tan(slope);
    this.building.updateMatrixWorld(true);
    for (const side of [-1, 1]) {
      const normal = new THREE.Vector3(side * Math.sin(slope), Math.cos(slope), 0)
        .transformDirection(this.building.matrixWorld);
      const incidence = normal.dot(sunDirection);
      if (incidence <= 1e-6) continue;
      const target = this.building.localToWorld(new THREE.Vector3(side * width / 4,
        ridge - width / 4 * Math.tan(slope) + 0.12, 0)).addScaledVector(normal, 0.04);
      // Parallel incident rays preserve the real solar direction despite the symbolic sky radius.
      const length = 3.5;
      const start = target.clone().addScaledVector(sunDirection, length);
      this._panelArrows ||= new Map();
      let arrow = this._panelArrows.get(side);
      if (!arrow) {
        arrow = new THREE.ArrowHelper(sunDirection.clone().negate(), start, length, SUN, 0.45, 0.24);
        arrow.name = 'panel-sun-vector';
        this._panelArrows.set(side, arrow); this.current.add(arrow);
      } else {
        arrow.position.copy(start); arrow.setDirection(sunDirection.clone().negate());
      }
      arrow.visible = true;
      arrow.userData = { side, incidence, target: target.toArray(), direction: sunDirection.clone().negate().toArray(), length };
      const blocked = !!this.neighborObstruction(target, sunDirection);
      for (const part of [arrow.line, arrow.cone]) {
        if (part.material.transparent !== blocked) part.material.needsUpdate = true;
        part.material.transparent = blocked; part.material.opacity = blocked ? 0.20 : 1;
        part.material.depthWrite = !blocked;
      }
      if (blocked) arrow.userData.estimatedObstruction = true;
    }
  }

  refreshPlanets() {
    const enabled = !!this.planetPathsEnabled;
    const fullOrbit = !!this.expanded && this.showPlanetsBelow;
    const selected = id => !this.expanded || this.selectedPlanets[id];
    for (const button of this.root.querySelectorAll('.planet-choice')) {
      button.setAttribute('aria-pressed', String(enabled && this.selectedPlanets[button.dataset.planet]));
    }
    const horizonButton = this.root.querySelector('.horizon-toggle');
    horizonButton.setAttribute('aria-pressed', String(this.showPlanetsBelow));
    horizonButton.title = this.showPlanetsBelow ? 'Ober- und unterhalb: auf nur oberhalb umschalten' : 'Nur oberhalb: auf ober- und unterhalb umschalten';
    horizonButton.setAttribute('aria-label', horizonButton.title);
    horizonButton.querySelector('.below-arrow').style.display = this.showPlanetsBelow ? '' : 'none';
    const sunElevation = this.data?.sun?.elevation;
    const darkEnough = Number.isFinite(sunElevation) && sunElevation <= 0;
    this.planetPaths.visible = this.planetCurrent.visible = enabled && darkEnough;
    const button = this.root.querySelector('.planet-toggle');
    button.setAttribute('aria-pressed', String(enabled));
    const title = enabled ? 'Planetenbahnen ausblenden' : 'Planetenbahnen einblenden';
    button.title = title;
    button.setAttribute('aria-label', title);
    const data = this.planetData;
    if (!enabled || !darkEnough || !data) return;
    if (this.planetTrackKey !== data.key) {
      release(this.planetPaths);
      for (const body of data.bodies) {
        const hits = [];
        for (const samples of body.segments) {
          for (const point of this.horizonIntersections(samples.map(sample => skyVector(sample.azimuth, sample.elevation, 1)))) {
            if (!hits.some(hit => hit.distanceToSquared(point) < 1e-8)) hits.push(point);
          }
        }
        for (const point of hits) {
          const marker = this.horizonCrossingMarker(body.color);
          marker.userData = { planet:body.id, body:body.id, below:false };
          marker.position.copy(point).multiplyScalar(this.skyRadius * this.orbitScale(body.id)).add(this.origin);
          this.planetPaths.add(marker);
        }
      }
      for (const body of data.bodies) for (const [below, segments] of [[false, body.segments], [true, body.nightSegments || []]]) for (const samples of segments) {
        // Defensive clipping also prevents below-horizon chords in malformed data.
        let run = [];
        const flush = () => {
          if (run.length > 1) {
            const line = this.line(run, body.color, below, this.planetPaths, below ? 0.35 : 0.65);
            line.material.depthWrite = false;
            line.name = 'planet-path'; line.userData.planet = body.id;
            line.userData.below = below;
          }
          run = [];
        };
        for (const sample of samples) {
          if (Number.isFinite(sample.azimuth) && Number.isFinite(sample.elevation) && (below ? sample.elevation <= 0 : sample.elevation >= 0)) run.push(skyVector(sample.azimuth, sample.elevation, this.skyRadius * this.orbitScale(body.id)).add(this.origin));
          else flush();
        }
        flush();
      }
      this.planetTrackKey = data.key;
    }
    const aboveHorizon = new Set(data.bodies
      .filter(body => Number.isFinite(body.azimuth) && Number.isFinite(body.elevation) && body.elevation > 0)
      .map(body => body.id));
    const validPositions = new Set(data.bodies.filter(body => Number.isFinite(body.azimuth) && Number.isFinite(body.elevation)).map(body => body.id));
    for (const path of this.planetPaths.children) {
      const id = path.userData.planet;
      path.visible = !!selected(id) && validPositions.has(id) && (fullOrbit || (!path.userData.below && aboveHorizon.has(id)));
    }
    const key = JSON.stringify([fullOrbit, data.bodies.map(({ id, azimuth, elevation }) => [id, azimuth, elevation, selected(id)])]);
    if (key !== this.planetCurrentKey) {
      release(this.planetCurrent);
      for (const body of data.bodies) {
        if (!selected(body.id) || !Number.isFinite(body.azimuth) || !Number.isFinite(body.elevation) || (!fullOrbit && body.elevation <= 0)) continue;
        const point = skyVector(body.azimuth, body.elevation, this.skyRadius * this.orbitScale(body.id)).add(this.origin);
        const marker = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), new THREE.MeshBasicMaterial({ color: body.color }));
        marker.name = 'planet-marker'; marker.userData.planet = body.id;
        marker.position.copy(point); this.planetCurrent.add(marker);
        const label = this.label(body.label, body.color, 0.6);
        label.position.copy(point).add(new THREE.Vector3(0, 0.45, 0));
        label.name = 'planet-label'; label.userData.planet = body.id;
        label.userData.skyLabelOffset = 0.45;
        this.planetCurrent.add(label);
      }
      this.planetCurrentKey = key;
    }
  }

  update(data) {
    if (this.disposed) return;
    if (this.annualPreview?.deferUpdate(data)) return;
    this.data = data;
    const previousRadius = this.skyRadius;
    this.updateExpandedDetails(data.display);
    const geometryKey = JSON.stringify(data.model);
    const geometryChanged = this.geometryKey !== geometryKey;
    if (geometryChanged) {
      this.geometryKey = geometryKey;
      this.makeBuilding(data.model);
      this.cameraReady = false;
    }
    const housesChanged = this.refreshNeighborhood();
    this.fullOrbitRadius = this.orbitRadius();
    const radiusModeChanged = this.radiusMode !== !!this.expanded;
    if (geometryChanged || radiusModeChanged || !this.skyRadius) {
      this.skyRadius = this.fullOrbitRadius;
      this.zoomTimestamp = undefined;
    }
    this.radiusMode = !!this.expanded;
    const projectionChanged = previousRadius !== this.skyRadius;
    if (projectionChanged || geometryChanged) this.makeHorizon();
    const tracksChanged = radiusModeChanged || projectionChanged || geometryChanged || this.trackKey !== data.tracks.key;
    if (tracksChanged) {
      this.trackKey = data.tracks.key;
      this.makePaths(data);
    }
    const currentKey = JSON.stringify([data.sun.azimuth, data.sun.elevation, data.sun.shadowLevel, data.sun.shadowColor,
      data.moon.azimuth, data.moon.elevation, data.moon.icon]);
    const currentChanged = projectionChanged || geometryChanged || this.currentKey !== currentKey;
    if (currentChanged) {
      this.makeCurrent(data);
      this.currentKey = currentKey;
    }
    this.planetData = data.planets;
    if (this.planetPathsEnabled === undefined) {
      let saved;
      try { saved = localStorage.getItem('pvGarageDemoRich.planetPaths'); } catch (_) {}
      this.planetPathsEnabled = saved === 'true' || (saved !== 'false' && data.planets?.defaultVisible === true);
    }
    const oldPlanetTrackKey = this.planetTrackKey, oldPlanetCurrentKey = this.planetCurrentKey;
    if (geometryChanged || projectionChanged) this.planetTrackKey = this.planetCurrentKey = undefined;
    this.refreshPlanets();
    this.resize();
    if (!this.browserSettingsRestored) {
      this.browserSettingsRestored = true;
      this.restoreBrowserSettings();
    }
    if (housesChanged || geometryChanged || tracksChanged || currentChanged || oldPlanetTrackKey !== this.planetTrackKey || oldPlanetCurrentKey !== this.planetCurrentKey) this.requestRender();
  }

  dispose() {
    this.releaseBackground?.();
    this.releaseBackground = null;
    this.disposed = true;
    this.annualPreview?.dispose();
    this.closeOptions();
    this.setMeasurement(false);
    this.setPlaying(false);
    if (this.expandedDialog?.open) this.expandedDialog.close();
    cancelAnimationFrame(this.frame);
    this.resizeObserver?.disconnect();
    document.removeEventListener('visibilitychange', this.visibility);
    this.controls?.dispose();
    if (this.renderer) {
      this.renderer.domElement.removeEventListener('webglcontextlost', this.onLost);
      this.renderer.domElement.removeEventListener('keydown', this.onKey);
      release(this.scene, this._moonTexture?.texture);
      this._moonTexture?.texture.dispose();
      this._moonTexture = null;
      this._moonBall = null;
      this._moonSprite = null;
      this.renderer.dispose();
      this.renderer.forceContextLoss();
      this.renderer.domElement.remove();
    }
  }
}
