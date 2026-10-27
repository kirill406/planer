// Virtual clock: normal time or accelerated demo time (×10, ×60).
// The clock is stored inside the run, so a reload keeps the same pace.

export const SPEEDS = [1, 10, 60];

export function makeClock(speed = 1, realNow = Date.now()) {
  return { speed, realBase: realNow, virtualBase: realNow };
}

export function clockNow(clock, realNow = Date.now()) {
  if (!clock) return realNow;
  return clock.virtualBase + (realNow - clock.realBase) * clock.speed;
}

// Real milliseconds until the virtual moment `virtualAt`.
export function realDelay(clock, virtualAt, realNow = Date.now()) {
  const speed = clock?.speed ?? 1;
  return Math.max(0, (virtualAt - clockNow(clock, realNow)) / speed);
}
