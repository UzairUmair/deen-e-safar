// Dependency-free so the DOM side can share these without pulling three.js into the first load.

/** Shared between the scroll controller (writes target) and the scene (reads p / open). */
export type Story = { target: number; p: number; open: number; apply?: (progress: number) => void };

/** Exact exponential response in seconds; no frame-count or slow-frame time clamp. */
export function dampProgress(current: number, target: number, delta: number, rate = 9) {
  const goal = Math.min(1, Math.max(0, target));
  const next = current + (goal - current) * -Math.expm1(-rate * Math.max(0, delta));
  return Math.abs(goal - next) < 0.00001 ? goal : next;
}

// Scroll window (fractions of the story track) in which the Quran opens.
export const OPEN_START = 0.3;
export const OPEN_END = 0.58;
