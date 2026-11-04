// Opt-in timing only: overlaps identify measured JS, not GPU time or causal ownership.
const targets = [
  ['pv-flow-card', 'PV', '_renderLatest'],
  ['room-status-card', 'Rooms', '_flushRoomRender'],
  ['garage-sun-moon-card', 'Garage'],
  ['weather-strip-card', 'Wetter'],
  ['proplanta-sun-strip-card', 'Solar-Wetter']
];

function unionLength(intervals) {
  let total = 0, end = -Infinity;
  for (const [a, b] of intervals.sort((a, b) => a[0] - b[0])) {
    total += Math.max(0, b - Math.max(a, end));
    end = Math.max(end, b);
  }
  return total;
}

export class GarageUpdateTrace {
  constructor(isActive = () => true) {
    this.isActive = isActive;
    this.running = true;
    this.spans = new Array(1024);
    this.count = 0;
    this.restore = [];
    this.worst = null;
    const registry = globalThis.customElements;
    if (!registry) return;
    for (const [tag, label, render] of targets) {
      const attach = () => {
        if (!this.running) return;
        const proto = registry.get(tag)?.prototype;
        if (!proto) return;
        this.wrap(proto, 'hass', label, true);
        if (render) this.wrap(proto, render, label);
        if (tag === 'room-status-card') this.wrap(proto, '_roomMeasurePhase', args => 'Rooms: ' + String(args[0]).slice(0, 50), false, true);
      };
      if (registry.get(tag)) attach();
      else registry.whenDefined(tag).then(attach).catch(() => {});
    }
  }

  wrap(proto, key, label, setter = false, detail = false) {
    const descriptor = Object.getOwnPropertyDescriptor(proto, key);
    const fn = setter ? descriptor?.set : descriptor?.value;
    if (!descriptor?.configurable || typeof fn !== 'function') return;
    const trace = this;
    const wrapped = function (...args) {
      if (!trace.running || !trace.isActive()) return fn.apply(this, args);
      const start = performance.now();
      try { return fn.apply(this, args); }
      finally { trace.record(typeof label === 'function' ? label(args) : label, start, performance.now(), detail); }
    };
    Object.defineProperty(proto, key, { ...descriptor, [setter ? 'set' : 'value']: wrapped });
    this.restore.push(() => {
      const current = Object.getOwnPropertyDescriptor(proto, key);
      if ((setter ? current?.set : current?.value) === wrapped) Object.defineProperty(proto, key, descriptor);
    });
  }

  record(label, start, end, detail = false) {
    if (!this.running || !Number.isFinite(start) || !Number.isFinite(end) || end - start < 0.1) return;
    this.spans[this.count++ % this.spans.length] = { label, start, end, detail };
  }

  longTask(entry) {
    if (!this.running || (this.worst && this.worst.duration > entry.duration)) return;
    const start = entry.startTime, end = start + entry.duration;
    const intervals = [], byLabel = new Map(), details = new Map();
    for (const span of this.spans) {
      if (!span || span.start >= end || span.end <= start) continue;
      const pair = [Math.max(start, span.start), Math.min(end, span.end)];
      if (!span.detail) intervals.push(pair);
      const map = span.detail ? details : byLabel;
      if (!map.has(span.label)) map.set(span.label, []);
      map.get(span.label).push(pair);
    }
    const sorted = map => [...map].map(([label, ranges]) => ({ label, ms: unionLength(ranges) })).sort((a, b) => b.ms - a.ms);
    this.worst = { duration: entry.duration, known: unionLength(intervals), cards: sorted(byLabel), details: sorted(details) };
  }

  text() {
    const w = this.worst;
    if (!w) return '';
    const cards = w.cards.slice(0, 3).map(c => `${c.label} ${c.ms.toFixed(0)} ms`).join(', ') || 'keine erfassten Karten-Updates';
    const detail = w.details[0];
    return `\nBlock ${w.duration.toFixed(0)} ms: ${cards}\nNicht zugeordnet: ${Math.max(0, w.duration - w.known).toFixed(0)} ms` +
      (detail ? `\nDetail darin: ${detail.label} ${detail.ms.toFixed(0)} ms` : '');
  }

  stop() {
    this.running = false;
    for (const restore of this.restore.reverse()) restore();
    this.restore = [];
    this.spans.fill(undefined);
  }
}
