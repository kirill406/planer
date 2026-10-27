import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  DAY,
  HOUR,
  MINUTE,
  allocate,
  beginWaiting,
  classifyStart,
  createRun,
  finishItem,
  markNotified,
  median,
  nearestDayBase,
  needsNotification,
  parseTime,
  planSchedule,
  recordHistory,
  runStatus,
  setItemMinutes,
  skipItem,
  splitItem,
  stopRun,
  suggest,
  summarize,
} from "../../frontend/static/js/engine.js";

const TODAY = 100 * DAY; // local midnight, arbitrary
const at = (hhmm) => TODAY + parseTime(hhmm);

function makePlan(overrides = {}) {
  return {
    id: "p1",
    title: "Утро",
    anchor: "start",
    time: "09:00",
    maxCompression: 0.5,
    items: [
      { id: "a", title: "Душ", minutes: 10, fixed: false },
      { id: "b", title: "Завтрак", minutes: 20, fixed: false },
      { id: "c", title: "Дорога", minutes: 30, fixed: true },
    ],
    history: {},
    ...overrides,
  };
}

const start = (plan, now, extra = {}) =>
  createRun(plan, { now, todayBase: TODAY, id: "r1", ...extra });

describe("helpers", () => {
  test("parseTime: valid and invalid input", () => {
    assert.equal(parseTime("09:30"), 9 * HOUR + 30 * MINUTE);
    assert.equal(parseTime("7:05"), 7 * HOUR + 5 * MINUTE);
    assert.equal(parseTime("24:00"), null);
    assert.equal(parseTime("abc"), null);
  });

  test("median: odd, even, empty", () => {
    assert.equal(median([3, 1, 2]), 2);
    assert.equal(median([4, 1, 2, 3]), 2.5);
    assert.equal(median([]), null);
  });

  test("classifyStart: within a minute is ontime", () => {
    assert.equal(classifyStart(at("09:00") + 59_000, at("09:00")).kind, "ontime");
    assert.equal(classifyStart(at("08:55"), at("09:00")).kind, "early");
    assert.equal(classifyStart(at("09:05"), at("09:00")).kind, "late");
  });
});

describe("planSchedule", () => {
  test("anchor start: items follow each other", () => {
    const schedule = planSchedule(makePlan(), TODAY);
    assert.equal(schedule.start, at("09:00"));
    assert.deepEqual(
      schedule.items.map((item) => item.at),
      [at("09:00"), at("09:10"), at("09:30")],
    );
    assert.equal(schedule.finish, at("10:00"));
  });

  test("anchor finish: start is computed backwards", () => {
    const schedule = planSchedule(makePlan({ anchor: "finish", time: "08:50" }), TODAY);
    assert.equal(schedule.start, at("07:50"));
    assert.equal(schedule.finish, at("08:50"));
  });

  test("nearestDayBase: late evening picks tomorrow for a morning plan", () => {
    const plan = makePlan({ time: "07:00" });
    assert.equal(nearestDayBase(plan, at("23:30"), TODAY), TODAY + DAY);
    assert.equal(nearestDayBase(plan, at("07:20"), TODAY), TODAY);
  });
});

describe("allocate", () => {
  const items = [
    { nominal: 10 * MINUTE, fixed: false },
    { nominal: 20 * MINUTE, fixed: false },
    { nominal: 30 * MINUTE, fixed: true },
  ];

  test("enough time: nominal, spare is not spread", () => {
    const result = allocate(items, 70 * MINUTE, 0.5);
    assert.deepEqual(result.allotted, [10 * MINUTE, 20 * MINUTE, 30 * MINUTE]);
    assert.equal(result.factor, 1);
    assert.equal(result.spare, 10 * MINUTE);
  });

  test("deficit: only flexible items shrink proportionally", () => {
    const result = allocate(items, 54 * MINUTE, 0.5);
    assert.deepEqual(result.allotted, [8 * MINUTE, 16 * MINUTE, 30 * MINUTE]);
    assert.equal(result.factor, 0.8);
    assert.equal(result.shortfall, 0);
  });

  test("deficit beyond limit: clamp and report shortfall", () => {
    const result = allocate(items, 40 * MINUTE, 0.5);
    assert.deepEqual(result.allotted, [5 * MINUTE, 10 * MINUTE, 30 * MINUTE]);
    assert.equal(result.factor, 0.5);
    assert.equal(result.shortfall, 5 * MINUTE);
  });

  test("all fixed: nothing shrinks, shortfall shows the gap", () => {
    const fixed = [{ nominal: 10 * MINUTE, fixed: true }];
    const result = allocate(fixed, 4 * MINUTE, 0.5);
    assert.deepEqual(result.allotted, [10 * MINUTE]);
    assert.equal(result.shortfall, 6 * MINUTE);
  });

  test("negative available: clamps to the limit", () => {
    const result = allocate(items, -5 * MINUTE, 0.5);
    assert.equal(result.factor, 0.5);
  });
});

describe("run lifecycle", () => {
  test("ontime start: first item gets nominal time", () => {
    const run = start(makePlan(), at("09:00"));
    assert.equal(run.startKind, "ontime");
    assert.equal(run.items[0].allotted, 10 * MINUTE);
    assert.equal(run.plannedFinish, at("10:00"));
  });

  test("early start: says early, keeps nominal, finishes earlier", () => {
    const run = start(makePlan(), at("08:50"));
    assert.equal(run.startKind, "early");
    assert.equal(run.startDelta, -10 * MINUTE);
    assert.equal(run.items[0].allotted, 10 * MINUTE);
    const status = runStatus(run, at("08:50"));
    assert.equal(status.projectedFinish, at("09:50"));
    assert.equal(status.finishDelta, 10 * MINUTE);
    assert.equal(status.level, "good");
  });

  test("late start: compresses flexible items to finish on time", () => {
    const run = start(makePlan(), at("09:06"));
    assert.equal(run.startKind, "late");
    // 54 min left: flexible 30 → 24 (factor 0.8), fixed road stays 30
    assert.equal(run.items[0].allotted, 8 * MINUTE);
    assert.equal(run.items[0].factor, 0.8);
    const status = runStatus(run, at("09:06"));
    assert.equal(status.projectedFinish, at("10:00"));
    assert.deepEqual(status.forecast, [16 * MINUTE, 30 * MINUTE]);
    assert.equal(status.level, "warn");
  });

  test("next item is recalculated when it starts", () => {
    let run = start(makePlan(), at("09:00"));
    run = finishItem(run, at("09:15")); // 5 min over
    assert.equal(run.current, 1);
    assert.equal(run.items[1].startKind, "late");
    // 45 min left: road 30 fixed, breakfast 20 → 15
    assert.equal(run.items[1].allotted, 15 * MINUTE);
  });

  test("finishing early does not stretch the next item", () => {
    let run = start(makePlan(), at("09:00"));
    run = finishItem(run, at("09:04"));
    assert.equal(run.items[1].startKind, "early");
    assert.equal(run.items[1].allotted, 20 * MINUTE);
  });

  test("overtime: overdue status and single notification", () => {
    let run = start(makePlan(), at("09:00"));
    assert.equal(needsNotification(run, at("09:09")), false);
    const status = runStatus(run, at("09:12"));
    assert.equal(status.overdue, true);
    assert.equal(status.overtime, 2 * MINUTE);
    assert.equal(needsNotification(run, at("09:12")), true);
    run = markNotified(run);
    assert.equal(needsNotification(run, at("09:13")), false);
  });

  test("scheduleDelta: behind while overdue, ahead after early finish", () => {
    let run = start(makePlan(), at("09:00"));
    assert.equal(runStatus(run, at("09:12")).scheduleDelta, 2 * MINUTE);
    run = start(makePlan(), at("09:00"));
    run = finishItem(run, at("09:05"));
    assert.equal(runStatus(run, at("09:05")).scheduleDelta, -5 * MINUTE);
  });

  test("too late: projected finish after deadline, level bad", () => {
    const run = start(makePlan(), at("09:25"));
    // 35 min left, minimum is 15 + 30 = 45
    assert.equal(run.items[0].shortfall, 10 * MINUTE);
    const status = runStatus(run, at("09:25"));
    assert.equal(status.projectedFinish, at("10:10"));
    assert.equal(status.level, "bad");
  });

  test("skip: item marked skipped and plan advances", () => {
    let run = start(makePlan(), at("09:25"));
    run = skipItem(run, at("09:26"));
    assert.equal(run.items[0].skipped, true);
    assert.equal(run.current, 1);
    // 34 min left: road 30 fixed, breakfast compressed to the 50% limit
    assert.equal(run.items[1].allotted, 10 * MINUTE);
  });

  test("start from a middle item: earlier ones are skipped", () => {
    const run = start(makePlan(), at("09:10"), { fromIndex: 1 });
    assert.equal(run.items[0].skipped, true);
    assert.equal(run.current, 1);
    assert.equal(run.startKind, "ontime");
    assert.equal(run.items[1].allotted, 20 * MINUTE);
  });

  test("autoNext off: waits, then recalculates on begin", () => {
    let run = start(makePlan(), at("09:00"), { autoNext: false });
    run = finishItem(run, at("09:10"));
    assert.equal(run.waiting, true);
    assert.equal(runStatus(run, at("09:12")).waiting, true);
    assert.equal(runStatus(run, at("09:12")).scheduleDelta, 2 * MINUTE);
    run = beginWaiting(run, at("09:14"));
    assert.equal(run.items[1].startKind, "late");
    assert.equal(run.items[1].allotted, 16 * MINUTE);
  });

  test("finishing the last item finishes the run", () => {
    let run = start(makePlan(), at("09:00"));
    run = finishItem(run, at("09:10"));
    run = finishItem(run, at("09:30"));
    run = finishItem(run, at("09:58"));
    assert.equal(run.status, "finished");
    assert.equal(run.finishedAt, at("09:58"));
    assert.equal(finishItem(run, at("10:00")), run);
  });

  test("stop: current item marked stopped", () => {
    let run = start(makePlan(), at("09:00"));
    run = stopRun(run, at("09:03"));
    assert.equal(run.status, "stopped");
    assert.equal(run.items[0].stopped, true);
  });

  test("state is immutable", () => {
    const run = start(makePlan(), at("09:00"));
    const snapshot = JSON.stringify(run);
    finishItem(run, at("09:05"));
    skipItem(run, at("09:05"));
    assert.equal(JSON.stringify(run), snapshot);
  });

  test("empty plan cannot start", () => {
    assert.throws(() => start(makePlan({ items: [] }), at("09:00")));
  });
});

describe("summary and suggestions", () => {
  function finishedRun(plan, durations) {
    let now = at("09:00");
    let run = start(plan, now);
    for (const minutes of durations) {
      now += minutes * MINUTE;
      run = finishItem(run, now);
    }
    return run;
  }

  test("summarize: actual and diff per item", () => {
    const summary = summarize(finishedRun(makePlan(), [8, 25, 30]));
    assert.deepEqual(
      summary.rows.map((row) => row.actual / MINUTE),
      [8, 25, 30],
    );
    assert.equal(summary.rows[1].diff, 5 * MINUTE);
    assert.equal(summary.finishDelta, -3 * MINUTE);
  });

  test("suggest: shorter by >10% → shorten, longer → extend", () => {
    const plan = makePlan();
    const summary = summarize(finishedRun(plan, [8, 25, 30]));
    const suggestions = suggest(plan, summary);
    assert.deepEqual(
      suggestions.map((s) => [s.itemId, s.type, s.to]),
      [
        ["a", "shorten", 8],
        ["b", "extend", 25],
      ],
    );
  });

  test("suggest: within 10% → nothing", () => {
    const plan = makePlan();
    const summary = summarize(finishedRun(plan, [9.5, 21, 30]));
    assert.deepEqual(suggest(plan, summary), []);
  });

  test("suggest: uses median of history once 3 runs exist", () => {
    let plan = makePlan();
    for (const minutes of [15, 15, 6]) {
      plan = recordHistory(plan, summarize(finishedRun(plan, [minutes, 20, 30])));
    }
    const last = summarize(finishedRun(plan, [6, 20, 30]));
    const [suggestion] = suggest(plan, last);
    assert.equal(suggestion.type, "extend");
    assert.equal(suggestion.to, 15);
    assert.equal(suggestion.basis, "median");
  });

  test("recordHistory: keeps at most 10 samples", () => {
    let plan = makePlan();
    for (let i = 0; i < 12; i += 1) {
      plan = recordHistory(plan, summarize(finishedRun(plan, [10, 20, 30])));
    }
    assert.equal(plan.history.a.length, 10);
  });

  test("skipped items are excluded from suggestions", () => {
    let run = start(makePlan(), at("09:00"));
    run = skipItem(run, at("09:01"));
    const summary = summarize(run);
    assert.equal(summary.rows[0].actual, null);
    assert.equal(suggest(makePlan(), summary).some((s) => s.itemId === "a"), false);
  });

  test("setItemMinutes and splitItem", () => {
    let plan = setItemMinutes(makePlan(), "a", 7.4);
    assert.equal(plan.items[0].minutes, 7);
    let counter = 0;
    plan = splitItem(
      plan,
      "b",
      [
        { title: "Готовка", minutes: 15 },
        { title: "Еда", minutes: 10 },
        { title: " ", minutes: 5 },
      ],
      () => `n${(counter += 1)}`,
    );
    assert.deepEqual(
      plan.items.map((item) => [item.id, item.minutes]),
      [
        ["a", 7],
        ["n1", 15],
        ["n2", 10],
        ["c", 30],
      ],
    );
  });
});
