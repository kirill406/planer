// Pure plan engine: schedule, start classification, compression, live
// status, summary and suggestions. No DOM, no Date.now(), no storage —
// every time value comes in as an argument (ms), so Node tests cover it.
// Algorithm: specs/001-engine/spec.md.

export const SECOND = 1000;
export const MINUTE = 60 * SECOND;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export const ONTIME_TOLERANCE = MINUTE;
export const DEFAULT_MAX_COMPRESSION = 0.5;
export const SUGGEST_THRESHOLD = 0.1;
export const HISTORY_LIMIT = 10;
export const MEDIAN_WINDOW = 5;
export const MEDIAN_MIN_SAMPLES = 3;

const sum = (values) => values.reduce((acc, value) => acc + value, 0);
const roundToSecond = (ms) => Math.round(ms / SECOND) * SECOND;

export function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function parseTime(hhmm) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm ?? "").trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * HOUR + minutes * MINUTE;
}

export function totalMinutes(plan) {
  return sum(plan.items.map((item) => Number(item.minutes) || 0));
}

// Schedule of the plan for the day that starts at `dayBase` (local midnight).
export function planSchedule(plan, dayBase) {
  const offset = parseTime(plan.time) ?? 0;
  const total = totalMinutes(plan) * MINUTE;
  const anchorAt = dayBase + offset;
  const start = plan.anchor === "finish" ? anchorAt - total : anchorAt;
  let cursor = start;
  const items = plan.items.map((item) => {
    const at = cursor;
    cursor += item.minutes * MINUTE;
    return { id: item.id, at, end: cursor };
  });
  return { start, finish: start + total, items };
}

// Pick yesterday/today/tomorrow so the plan start is nearest to `now`:
// a 07:00 plan opened at 23:30 belongs to tomorrow, not 16 h late.
export function nearestDayBase(plan, now, todayBase) {
  const candidates = [todayBase - DAY, todayBase, todayBase + DAY];
  return candidates.reduce((best, base) => {
    const distance = Math.abs(planSchedule(plan, base).start - now);
    const bestDistance = Math.abs(planSchedule(plan, best).start - now);
    return distance < bestDistance ? base : best;
  });
}

export function classifyStart(now, plannedAt, tolerance = ONTIME_TOLERANCE) {
  const delta = now - plannedAt;
  if (Math.abs(delta) <= tolerance) return { kind: "ontime", delta };
  return { kind: delta < 0 ? "early" : "late", delta };
}

// Share `available` ms between items. Spare time never stretches items;
// a deficit compresses non-fixed items proportionally, but not below
// (1 - maxCompression) of their nominal length.
export function allocate(items, available, maxCompression = DEFAULT_MAX_COMPRESSION) {
  const total = sum(items.map((item) => item.nominal));
  if (available >= total) {
    return {
      allotted: items.map((item) => item.nominal),
      factor: 1,
      shortfall: 0,
      spare: available - total,
    };
  }
  const fixed = sum(items.filter((item) => item.fixed).map((item) => item.nominal));
  const flexible = total - fixed;
  const minFactor = 1 - maxCompression;
  const wanted = flexible > 0 ? (available - fixed) / flexible : 1;
  const factor = Math.min(1, Math.max(minFactor, wanted));
  const allotted = items.map((item) =>
    item.fixed ? item.nominal : roundToSecond(item.nominal * factor),
  );
  return {
    allotted,
    factor,
    shortfall: Math.max(0, sum(allotted) - available),
    spare: 0,
  };
}

function cloneRun(run) {
  return { ...run, items: run.items.map((item) => ({ ...item })) };
}

export function createRun(plan, { now, todayBase, clock, id, fromIndex = 0, autoNext = true }) {
  if (!plan.items.length) throw new Error("plan has no items");
  if (fromIndex < 0 || fromIndex >= plan.items.length) {
    throw new Error(`fromIndex out of range: ${fromIndex}`);
  }
  const dayBase = nearestDayBase(plan, now, todayBase);
  const schedule = planSchedule(plan, dayBase);
  const run = {
    id,
    planId: plan.id,
    title: plan.title,
    status: "running",
    maxCompression: plan.maxCompression ?? DEFAULT_MAX_COMPRESSION,
    plannedStart: schedule.start,
    plannedFinish: schedule.finish,
    startedAt: now,
    finishedAt: null,
    current: fromIndex,
    autoNext,
    waiting: false,
    clock: clock ?? null,
    items: plan.items.map((item, index) => ({
      itemId: item.id,
      title: item.title,
      nominal: item.minutes * MINUTE,
      fixed: Boolean(item.fixed),
      plannedAt: schedule.items[index].at,
      allotted: null,
      startedAt: null,
      finishedAt: null,
      skipped: index < fromIndex,
      stopped: false,
      notified: false,
      startKind: null,
      startDelta: 0,
      factor: 1,
      shortfall: 0,
    })),
  };
  const start = classifyStart(now, run.items[fromIndex].plannedAt);
  run.startKind = start.kind;
  run.startDelta = start.delta;
  return startItem(run, now);
}

// Start the current item: classify against its slot in the original
// schedule and allot its time so the plan still ends at plannedFinish.
export function startItem(run, now) {
  const next = cloneRun(run);
  const index = next.current;
  const rest = next.items.slice(index);
  const allocation = allocate(rest, next.plannedFinish - now, next.maxCompression);
  const start = classifyStart(now, next.items[index].plannedAt);
  Object.assign(next.items[index], {
    allotted: allocation.allotted[0],
    startedAt: now,
    startKind: start.kind,
    startDelta: start.delta,
    factor: allocation.factor,
    shortfall: allocation.shortfall,
    notified: false,
  });
  next.waiting = false;
  return next;
}

function advance(run, now) {
  if (run.current + 1 >= run.items.length) {
    run.status = "finished";
    run.finishedAt = now;
    run.waiting = false;
    return run;
  }
  run.current += 1;
  if (run.autoNext) return startItem(run, now);
  run.waiting = true;
  return run;
}

export function finishItem(run, now) {
  if (run.status !== "running" || run.waiting) return run;
  const next = cloneRun(run);
  next.items[next.current].finishedAt = now;
  return advance(next, now);
}

export function skipItem(run, now) {
  if (run.status !== "running") return run;
  const next = cloneRun(run);
  Object.assign(next.items[next.current], { skipped: true, finishedAt: now });
  return advance(next, now);
}

export function beginWaiting(run, now) {
  if (run.status !== "running" || !run.waiting) return run;
  return startItem(run, now);
}

export function stopRun(run, now) {
  if (run.status !== "running") return run;
  const next = cloneRun(run);
  const item = next.items[next.current];
  if (item.startedAt !== null && item.finishedAt === null) {
    Object.assign(item, { finishedAt: now, stopped: true });
  }
  next.status = "stopped";
  next.finishedAt = now;
  next.waiting = false;
  return next;
}

export function markNotified(run) {
  const next = cloneRun(run);
  next.items[next.current].notified = true;
  return next;
}

// Live numbers for the status bar. scheduleDelta > 0 — behind the original
// schedule; finishDelta > 0 — expected to finish early.
export function runStatus(run, now) {
  const item = run.items[run.current];
  const waiting = run.waiting || item.startedAt === null;
  const elapsed = waiting ? 0 : now - item.startedAt;
  const remaining = waiting ? item.nominal : item.allotted - elapsed;
  const overtime = waiting ? 0 : Math.max(0, -remaining);
  const after = run.items.slice(run.current + 1);
  const upcoming = waiting ? run.items.slice(run.current) : after;

  const nominalLeft = waiting ? 0 : Math.max(item.nominal - elapsed, 0);
  const scheduleDelta =
    now + nominalLeft + sum(upcoming.map((next) => next.nominal)) - run.plannedFinish;

  const readyAt = now + (waiting ? 0 : Math.max(remaining, 0));
  const forecast = allocate(upcoming, run.plannedFinish - readyAt, run.maxCompression);
  const projectedFinish = readyAt + sum(forecast.allotted);
  const finishDelta = run.plannedFinish - projectedFinish;

  let level = "good";
  const compressed = forecast.factor < 1 || (!waiting && item.factor < 1);
  if (finishDelta < -ONTIME_TOLERANCE) level = "bad";
  else if (overtime > 0 || compressed) level = "warn";

  return {
    waiting,
    item,
    elapsed,
    remaining,
    overtime,
    overdue: overtime > 0,
    progress: waiting || !item.allotted ? 0 : Math.min(1, elapsed / item.allotted),
    scheduleDelta,
    projectedFinish,
    finishDelta,
    forecast: forecast.allotted,
    forecastFactor: forecast.factor,
    compressed,
    level,
  };
}

export function needsNotification(run, now) {
  if (run.status !== "running") return false;
  const status = runStatus(run, now);
  return status.overdue && !status.item.notified;
}

// Rows for the results screen; `actual` is null for skipped/stopped items.
export function summarize(run) {
  const rows = run.items.map((item) => {
    const done = item.startedAt !== null && item.finishedAt !== null;
    const actual = done && !item.skipped && !item.stopped
      ? item.finishedAt - item.startedAt
      : null;
    return {
      itemId: item.itemId,
      title: item.title,
      nominal: item.nominal,
      allotted: item.allotted,
      actual,
      skipped: item.skipped,
      stopped: item.stopped,
      diff: actual === null ? null : actual - item.nominal,
    };
  });
  const end = run.finishedAt ?? run.startedAt;
  return {
    rows,
    plannedStart: run.plannedStart,
    plannedFinish: run.plannedFinish,
    startedAt: run.startedAt,
    finishedAt: end,
    finishDelta: run.plannedFinish - end,
    status: run.status,
  };
}

// Append actual durations (seconds) of finished items to the plan history.
export function recordHistory(plan, summary) {
  const history = { ...(plan.history ?? {}) };
  for (const row of summary.rows) {
    if (row.actual === null) continue;
    const samples = [...(history[row.itemId] ?? []), Math.round(row.actual / SECOND)];
    history[row.itemId] = samples.slice(-HISTORY_LIMIT);
  }
  return { ...plan, history };
}

// FR-13..15: compare actual time (or the median of recent runs) with the
// planned minutes; suggest only when the gap exceeds 10%.
export function suggest(plan, summary) {
  const suggestions = [];
  for (const row of summary.rows) {
    if (row.actual === null) continue;
    const item = plan.items.find((candidate) => candidate.id === row.itemId);
    if (!item) continue;
    const samples = plan.history?.[row.itemId] ?? [];
    const useMedian = samples.length >= MEDIAN_MIN_SAMPLES;
    const baseSeconds = useMedian
      ? median(samples.slice(-MEDIAN_WINDOW))
      : row.actual / SECOND;
    const nominalSeconds = item.minutes * 60;
    const ratio = baseSeconds / nominalSeconds;
    const toMinutes = Math.max(1, Math.round(baseSeconds / 60));
    const common = {
      itemId: item.id,
      title: item.title,
      from: item.minutes,
      basis: useMedian ? "median" : "last",
      samples: useMedian ? Math.min(samples.length, MEDIAN_WINDOW) : 1,
    };
    if (ratio < 1 - SUGGEST_THRESHOLD && toMinutes < item.minutes) {
      suggestions.push({ ...common, type: "shorten", to: toMinutes });
    } else if (ratio > 1 + SUGGEST_THRESHOLD) {
      suggestions.push({
        ...common,
        type: "extend",
        to: Math.max(item.minutes + 1, toMinutes),
      });
    }
  }
  return suggestions;
}

export function setItemMinutes(plan, itemId, minutes) {
  return {
    ...plan,
    items: plan.items.map((item) =>
      item.id === itemId ? { ...item, minutes: Math.max(1, Math.round(minutes)) } : item,
    ),
  };
}

// Replace one item with sub-items; history of the original is dropped
// because it no longer describes any single item.
export function splitItem(plan, itemId, parts, makeId) {
  const index = plan.items.findIndex((item) => item.id === itemId);
  if (index === -1) return plan;
  const original = plan.items[index];
  const subItems = parts
    .filter((part) => part.title.trim() && part.minutes > 0)
    .map((part) => ({
      id: makeId(),
      title: part.title.trim(),
      minutes: Math.max(1, Math.round(part.minutes)),
      fixed: original.fixed,
    }));
  if (!subItems.length) return plan;
  const items = [...plan.items];
  items.splice(index, 1, ...subItems);
  const history = { ...(plan.history ?? {}) };
  delete history[itemId];
  return { ...plan, items, history };
}
