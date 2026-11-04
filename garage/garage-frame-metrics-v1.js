// Bounded, opt-in diagnostics. Render timings measure JS submission, not GPU completion.
export class GarageFrameMetrics {
  constructor() {
    this.gaps = new Float64Array(600);
    this.costs = new Float64Array(600);
    this.frames = this.gapCount = this.slow = this.longTasks = this.longTaskMax = 0;
    this.previous = null;
    this.startedAt = performance.now();
    this.maxGap = this.maxCost = 0;
  }

  breakSequence() { this.previous = null; }

  frame(timestamp, cost) {
    if (this.previous != null) {
      const gap = timestamp - this.previous;
      this.gaps[this.gapCount++ % this.gaps.length] = gap;
      this.maxGap = Math.max(this.maxGap, gap);
      if (gap > 50) this.slow++;
    }
    this.previous = timestamp;
    this.costs[this.frames++ % this.costs.length] = cost;
    this.maxCost = Math.max(this.maxCost, cost);
  }

  longTask(entry) {
    if (entry.startTime < this.startedAt) return;
    this.longTasks++;
    this.longTaskMax = Math.max(this.longTaskMax, entry.duration);
  }

  summary() {
    const gaps = Array.from(this.gaps.subarray(0, Math.min(this.gapCount, this.gaps.length))).sort((a, b) => a - b);
    const costs = this.costs.subarray(0, Math.min(this.frames, this.costs.length));
    const total = gaps.reduce((a, b) => a + b, 0);
    return {
      fps: total ? 1000 * gaps.length / total : 0,
      p95: gaps.length ? gaps[Math.ceil(gaps.length * .95) - 1] : 0,
      maxGap: this.maxGap, slow: this.slow,
      jsMean: costs.length ? costs.reduce((a, b) => a + b, 0) / costs.length : 0,
      jsMax: this.maxCost, longTasks: this.longTasks, longTaskMax: this.longTaskMax
    };
  }
}
