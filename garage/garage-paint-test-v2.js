const PHASES = [
  { label: 'All active', tag: null },
  { label: 'Room graphics paused', tag: 'room-status-card' },
  { label: 'PV graphics paused', tag: 'pv-flow-card' },
  { label: 'Weather graphics paused', tag: 'weather-strip-card' }
];
let activeTest = null;
let serial = 0;

export function findPaintTestCards(root = document) {
  const found = new Map(PHASES.filter(p => p.tag).map(p => [p.tag, []]));
  const roots = [root];
  while (roots.length) {
    for (const node of roots.pop().querySelectorAll('*')) {
      if (node.shadowRoot) roots.push(node.shadowRoot);
      if (found.has(node.localName) && node.isConnected && node.getClientRects().length &&
          getComputedStyle(node).visibility !== 'hidden') found.get(node.localName).push(node);
    }
  }
  return found;
}

// Only paint/animation isolation: no hass setter, subscriptions or card methods are replaced.
export function pauseCardPaint(cards) {
  const undo = [];
  const release = () => {
    for (const restore of undo.splice(0).reverse()) {
      try { restore(); } catch (error) { console.warn('Garage paint test restore', error); }
    }
  };
  try {
    for (const card of cards) {
      const key = `garage-test-${++serial}`, attr = 'data-garage-paint-test';
      const previous = card.getAttribute(attr), animations = [], svgs = [];
      const style = document.createElement('style');
      undo.push(() => {
        style.remove();
        if (card.getAttribute(attr) === key) {
          if (previous == null) card.removeAttribute(attr); else card.setAttribute(attr, previous);
        }
        for (const animation of animations) {
          try { if (animation.playState === 'paused') animation.play(); } catch (_) {}
        }
        for (const svg of svgs) {
          try { if (svg.animationsPaused()) svg.unpauseAnimations(); } catch (_) {}
        }
      });
      for (const animation of card.getAnimations?.({ subtree: true }) || []) {
        if (animation.playState === 'running') { animations.push(animation); animation.pause(); }
      }
      for (const svg of card.querySelectorAll('svg')) {
        if (typeof svg.animationsPaused === 'function' && !svg.animationsPaused()) {
          svgs.push(svg); svg.pauseAnimations();
        }
      }
      card.setAttribute(attr, key);
      // Keep layout unchanged and cover newly patched descendants during the phase.
      style.textContent = `[${attr}="${key}"],[${attr}="${key}"] *{visibility:hidden!important;animation-play-state:paused!important}`;
      const root = card.getRootNode();
      (root.head || root).appendChild(style);
    }
    return release;
  } catch (error) { release(); throw error; }
}

export class GaragePaintTest {
  constructor({ cards, onPhase, onMeasure, sample, onDone, schedule = (fn, ms) => setTimeout(fn, ms), cancel = timer => clearTimeout(timer), now = () => performance.now() }) {
    Object.assign(this, { cards, onPhase, onMeasure, sample, onDone, schedule, cancel, now });
    this.results = [];
    this.index = -1;
    this.running = false;
  }

  start() {
    activeTest?.stop('Cancelled');
    activeTest = this;
    this.running = true;
    this.advance();
  }

  advance() {
    if (!this.running) return;
    try {
      this.release?.(); this.release = null;
      const phase = PHASES[++this.index];
      if (!phase) { this.stop('Done'); return; }
      const cards = phase.tag ? (this.cards.get(phase.tag) || []).filter(c => c.isConnected) : [];
      if (phase.tag && !cards.length) {
        this.results.push({ label: phase.label, missing: true });
        this.advance(); return;
      }
      if (phase.tag) this.release = pauseCardPaint(cards);
      this.phase = phase;
      this.measuring = false;
      this.deadline = this.now() + 21000;
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
    this.running = false;
    this.cancel(this.timer);
    try { this.release?.(); }
    finally {
      this.release = null;
      if (activeTest === this) activeTest = null;
      this.onDone(this.results, reason);
    }
  }
}
