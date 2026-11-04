// Pause presentation only. Cards keep receiving current HA states and bus events.
const holds = new Set();
const listeners = new Set();

export const garageBackgroundPaused = () => holds.size > 0;

function notify() {
  for (const listener of [...listeners]) {
    try { listener(); } catch (error) { console.warn('Garage background visibility', error); }
  }
}

export function holdGarageBackground() {
  const token = {};
  holds.add(token);
  if (holds.size === 1) notify();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holds.delete(token);
    if (!holds.size) notify();
  };
}

export function watchGarageBackground(card, changed) {
  let saved = null;
  const restore = () => {
    if (!saved) return;
    const { visibility, priority, animations, svgs } = saved;
    saved = null;
    if (visibility) card.style.setProperty('visibility', visibility, priority);
    else card.style.removeProperty('visibility');
    for (const animation of animations) {
      try { if (animation.playState === 'paused') animation.play(); } catch (_) {}
    }
    for (const svg of svgs) {
      try { svg.unpauseAnimations(); } catch (_) {}
    }
  };
  const update = () => {
    const paused = garageBackgroundPaused();
    if (paused && !saved) {
      saved = { visibility: card.style.getPropertyValue('visibility'), priority: card.style.getPropertyPriority('visibility'), animations: [], svgs: [] };
      for (const animation of card.getAnimations?.({ subtree: true }) || []) {
        if (animation.playState === 'running') { animation.pause(); saved.animations.push(animation); }
      }
      for (const svg of card.querySelectorAll('svg')) {
        if (typeof svg.animationsPaused === 'function' && !svg.animationsPaused()) { svg.pauseAnimations(); saved.svgs.push(svg); }
      }
      // Retain layout dimensions; hidden content no longer needs painting behind the dialog.
      card.style.setProperty('visibility', 'hidden', 'important');
    } else if (!paused) restore();
    changed(paused);
  };
  listeners.add(update);
  update();
  return () => { listeners.delete(update); restore(); };
}
