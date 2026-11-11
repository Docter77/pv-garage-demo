import { findPaintTestCards } from './garage-paint-test-v2.js';
export { findPaintTestCards };

const PHASES = [
  { label: 'Original before', tags: [] },
  { label: 'PV separate layer', tags: ['pv-flow-card'] },
  { label: 'Room separate layer', tags: ['room-status-card'] },
  { label: 'Both separate layers', tags: ['pv-flow-card', 'room-status-card'] },
  { label: 'Original after', tags: [] }
];
let activeTest = null, serial = 0;

// Promote only the SVG's HTML wrapper, never the card containing fixed dialogs.
// No containment/clipping, animation overrides, reparenting or state interception.
export function separatePaintLayers(cards) {
  const undo = [];
  const release = () => {
    for (const restore of undo.splice(0).reverse()) restore();
  };
  try {
    for (const card of cards) {
      const wrapper = card.querySelector(':scope > ha-card > div');
      if (!wrapper || wrapper.children.length !== 1 || wrapper.children[0].localName !== 'svg') {
        throw Error('Graphics wrapper is ambiguous: ' + card.localName);
      }
      if (getComputedStyle(wrapper).transform !== 'none') throw Error('Graphics wrapper already transformed');
      const attr = 'data-garage-layer-test', key = 'layer-' + ++serial;
      const previous = card.getAttribute(attr), style = document.createElement('style');
      undo.push(() => {
        style.remove();
        if (card.getAttribute(attr) === key) {
          if (previous == null) card.removeAttribute(attr); else card.setAttribute(attr, previous);
        }
      });
      card.setAttribute(attr, key);
      style.textContent = `[${attr}="${key}"] > ha-card > div{transform:translateZ(0)!important;will-change:transform!important;isolation:isolate!important}`;
      const root = card.getRootNode();
      (root.head || root).appendChild(style);
    }
    return release;
  } catch (error) { release(); throw error; }
}

// Temporarily remove the production Room layer for an honest original baseline.
// Phase rules are appended later with equal specificity, so they can enable it.
export function originalRoomLayers(cards) {
  const undo = [];
  const release = () => { for (const restore of undo.splice(0).reverse()) restore(); };
  try {
    for (const card of cards) {
      const attr = 'data-garage-layer-baseline', key = 'baseline-' + ++serial;
      const previous = card.getAttribute(attr), style = document.createElement('style');
      undo.push(() => {
        style.remove();
        if (card.getAttribute(attr) === key) {
          if (previous == null) card.removeAttribute(attr); else card.setAttribute(attr, previous);
        }
      });
      card.setAttribute(attr, key);
      style.textContent = `[${attr}="${key}"] > ha-card > div{transform:none!important;will-change:auto!important;isolation:auto!important}`;
      const root = card.getRootNode();
      (root.head || root).appendChild(style);
    }
    return release;
  } catch (error) { release(); throw error; }
}

export class GaragePaintTest {
  constructor({ cards, onPhase, onMeasure, sample, onDone, schedule = (fn, ms) => setTimeout(fn, ms), cancel = timer => clearTimeout(timer), now = () => performance.now() }) {
    Object.assign(this, { cards, onPhase, onMeasure, sample, onDone, schedule, cancel, now });
    this.results = []; this.index = -1; this.running = false;
  }
  start() {
    activeTest?.stop('Cancelled');
    activeTest = this; this.running = true;
    try {
      this.releaseBaseline = originalRoomLayers((this.cards.get('room-status-card') || []).filter(c => c.isConnected));
      this.advance();
    } catch (_) { this.stop('Error: test stopped'); }
  }
  advance() {
    if (!this.running) return;
    try {
      this.release?.(); this.release = null;
      const phase = PHASES[++this.index];
      if (!phase) { this.stop('Done'); return; }
      const groups = phase.tags.map(tag => (this.cards.get(tag) || []).filter(c => c.isConnected));
      if (groups.some(cards => !cards.length)) {
        this.results.push({ label: phase.label, missing: true }); this.advance(); return;
      }
      const cards = groups.flat();
      this.release = separatePaintLayers(cards);
      this.phase = phase; this.measuring = false; this.deadline = this.now() + 21000;
      this.onPhase(phase);
      this.timer = this.schedule(() => {
        if (!this.running) return;
        try {
          this.onMeasure(); this.measuring = true;
          this.started = this.now(); this.deadline = this.started + 20000;
          this.timer = this.schedule(() => {
            if (!this.running) return;
            try {
              this.results.push({ label: phase.label, cards: cards.length, seconds: (this.now() - this.started) / 1000, ...this.sample() });
              this.advance();
            } catch (_) { this.stop('Error: test stopped'); }
          }, 20000);
        } catch (_) { this.stop('Error: test stopped'); }
      }, 1000);
    } catch (_) { this.stop('Error: test stopped'); }
  }
  stop(reason = 'Cancelled') {
    if (!this.running) return;
    this.running = false; this.cancel(this.timer);
    try { this.release?.(); }
    finally {
      this.release = null;
      this.releaseBaseline?.(); this.releaseBaseline = null;
      if (activeTest === this) activeTest = null;
      this.onDone(this.results, reason);
    }
  }
}
