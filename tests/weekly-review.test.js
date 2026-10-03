import test from "node:test";
import assert from "node:assert/strict";
import {
  weekRange,
  timestampDate,
  weeklySummary,
} from "../src/features/review/weekly/selectors.js";
import {
  weeklyReviewPayload,
  reviewId,
} from "../src/features/review/weekly/model.js";
const start = "2026-09-28",
  end = "2026-10-04";
const row = (kind, id, data) => ({ kind, id, ...data });
const task = (id, data) =>
  row("task", id, {
    title: id,
    status: "done",
    date: start,
    completedAt: start + "T12:00:00+08:00",
    ...data,
  });
test("natural weeks use Monday/Sunday and Shanghai timestamp boundaries", () => {
  assert.deepEqual(weekRange(start), { start, end });
  assert.deepEqual(weekRange(end), { start, end });
  assert.deepEqual(weekRange("2026-10-05"), {
    start: "2026-10-05",
    end: "2026-10-11",
  });
  assert.deepEqual(weekRange("2026-01-01"), {
    start: "2025-12-29",
    end: "2026-01-04",
  });
  assert.equal(timestampDate("2026-09-27T16:00:00Z"), start);
  assert.equal(timestampDate("2026-10-04T16:00:00Z"), "2026-10-05");
  assert.equal(timestampDate("2026-10-04T23:59:59"), end);
  assert.equal(timestampDate("2026-02-30T00:00:00Z"), null);
});
test("task and Top 3 statistics distinguish scheduled week, actual completion and unknown historical dates", () => {
  const rows = [
    task("a", { top: true }),
    task("b", { top: true, status: "open", completedAt: null }),
    task("c", { date: "2026-09-21" }),
    task("d", { status: "cancelled" }),
    task("e", { completedAt: "2026-10-05T00:00:00+08:00" }),
    task("f", { completedAt: null }),
    task("g", { deleted: true }),
    task("h", { date: end, completedAt: "2026-10-04T15:59:59Z" }),
    task("i", { date: "2026-10-05", completedAt: "2026-10-04T16:00:00Z" }),
  ];
  const result = weeklySummary(rows, start, end);
  assert.deepEqual(result.tasks, {
    planned: 5,
    completed: 3,
    plannedDone: 2,
    completionRate: 2 / 5,
    top: 2,
    topDone: 1,
    undatedDone: 1,
    crossWeekDone: 1,
  });
  assert.equal(
    weeklySummary(rows, "2026-10-05", "2026-10-11").tasks.completed,
    2,
  );
});
test("Tracker metrics share one range and retain coverage and missing values", () => {
  const rows = [
    row("sleep", "s", { date: start, minutes: 360 }),
    row("sleep", "s2", { date: "2026-09-30", minutes: 420 }),
    row("body", "b", { date: start, weight: 57 }),
    row("body", "b2", { date: end, weight: 58 }),
    row("workout", "w", { date: end, minutes: 45 }),
    row("study", "st", { date: start, minutes: 120 }),
    row("episode", "ep", { date: start, minutes: 22 }),
    row("reading", "r", { date: end, minutes: 8 }),
    row("word", "wo", { date: start, minutes: 999 }),
    row("guitar", "g", { date: start, minutes: 0 }),
    row("income", "i", { date: start, cents: 29 }),
    row("income", "i2", { date: start, cents: 71 }),
    row("income", "i3", { date: end, cents: 100 }),
    row("emotion", "em", {
      date: end,
      time: "19:00",
      intensity: 3,
      mood: "平静",
    }),
  ];
  const result = weeklySummary(rows, end, end);
  assert.deepEqual(result.sleep, { value: 390, recordedDays: 2, totalDays: 7 });
  assert.equal(result.weight.change, 1);
  assert.equal(result.weight.latest.date, end);
  assert.equal(result.durations["english.minutes"].value, 30);
  assert.equal(result.durations["workout.minutes"].value, 45);
  assert.equal(result.durations["study.minutes"].value, 120);
  assert.equal(result.durations["guitar.minutes"].value, 0);
  assert.equal(result.income.value, 200);
  assert.equal(result.income.recordedDays, 2);
  assert.equal(result.emotion.latest.selected.label, "平静");
  const empty = weeklySummary([], start, end);
  assert.equal(empty.sleep.value, null);
  assert.equal(empty.weight.change, null);
  assert.equal(empty.income.value, null);
  assert.equal(empty.durations["workout.minutes"].value, null);
  assert.ok(empty.facts.includes("本周没有有效运动时长记录"));
});
test("weight change requires distinct days and unambiguous endpoint measurements", () => {
  const rows = [
    row("body", "a", { date: start, weight: 57 }),
    row("body", "b", { date: start, weight: 58 }),
    row("body", "c", { date: end, weight: 59 }),
  ];
  assert.equal(weeklySummary(rows, start, end).weight.change, null);
  assert.equal(weeklySummary(rows.slice(0, 1), start, end).weight.change, null);
});
test("CRM follows actual deals and completed linked tasks, not grades or due dates", () => {
  const rows = [
    row("client", "c", { added: start, grade: "D", next: start }),
    row("client", "c2", { added: "2026-09-21", grade: "S" }),
    row("deal", "d", { clientId: "c2", date: end, cents: 55000 }),
    row("deal", "d2", { clientId: "c2", date: end, cents: 100 }),
    row("deal", "outside", { clientId: "c", date: "2026-10-05", cents: 999 }),
    task("f", { clientId: "c" }),
    task("future", { clientId: "c", status: "open" }),
    row("income", "i", { date: end, cents: 30 }),
  ];
  const result = weeklySummary(rows, start, end);
  assert.deepEqual(result.sales, {
    newClients: 1,
    followups: 1,
    deals: 1,
    dealRecords: 2,
    income: 55100,
    missingAmountRecords: 0,
  });
  assert.equal(result.income.value, 30);
});
test("Project activities are dated completions/new notes/completion state; no inference from generic updates", () => {
  const rows = [
    row("project", "p", {
      title: "推进",
      status: "active",
      createdAt: "2026-09-01T12:00:00Z",
      nextAction: "next",
    }),
    row("project", "idle", {
      title: "停滞",
      status: "active",
      createdAt: "2026-09-01T12:00:00Z",
      updatedAt: start + "T12:00:00Z",
    }),
    row("project", "finished", {
      title: "完成",
      status: "completed",
      completedAt: end + "T12:00:00+08:00",
    }),
    row("project", "future", {
      title: "未来",
      status: "active",
      createdAt: "2026-10-05T12:00:00Z",
    }),
    task("t", { projectId: "p" }),
    task("next", { projectId: "p", status: "open", completedAt: null }),
    row("projectNote", "n", {
      projectId: "p",
      createdAt: start + "T12:00:00+08:00",
    }),
    row("projectNote", "old", {
      projectId: "idle",
      createdAt: "2026-09-01T12:00:00Z",
      updatedAt: start + "T12:00:00Z",
    }),
  ];
  const before = structuredClone(rows),
    result = weeklySummary(rows, start, end);
  assert.equal(result.activeProjectCount, 2);
  assert.equal(result.projects.find((p) => p.id === "p").completedTasks, 1);
  assert.equal(result.projects.find((p) => p.id === "p").nextAction, "next");
  assert.equal(result.inactiveProjects.length, 1);
  assert.equal(result.inactiveProjects[0].noActivitySevenDays, true);
  assert.equal(
    result.projects.find((p) => p.id === "finished").completedStatus,
    true,
  );
  assert.deepEqual(rows, before);
});
test("Focus singleton never produces a fabricated weekly session total", () => {
  const result = weeklySummary(
    [
      task("t", { actualMinutes: 150 }),
      row("focus", "current-focus", {
        elapsed: 9999999,
        started: Date.now(),
        running: true,
      }),
    ],
    start,
    end,
  );
  assert.equal(result.focus.total, null);
  assert.equal(result.focus.completedTaskMinutes, 150);
});

test('a partial current week without activity is distinct from seven days without activity',()=>{
  const rows=[row('project','p',{title:'继续',status:'active',createdAt:'2026-09-01T12:00:00Z'}),row('projectNote','n',{projectId:'p',createdAt:'2026-09-25T12:00:00+08:00'})];
  const project=weeklySummary(rows,start,start).inactiveProjects[0];
  assert.equal(project.noActivityThisWeek,true);
  assert.equal(project.noActivitySevenDays,false);
  assert.equal(project.reference,start);
});
test("weekly payload saves reflection only with stable week ID, timestamps and unknown-field preservation", () => {
  const payload = weeklyReviewPayload(
    {
      progress: "  推进  ",
      nextMain: "通过考试",
      priorityProjectIds: ["p", "p"],
    },
    { createdAt: "old", extra: "keep" },
    end,
    "now",
  );
  assert.equal(payload.weekStart, start);
  assert.equal(payload.weekEnd, end);
  assert.equal(payload.progress, "推进");
  assert.equal(payload.createdAt, "old");
  assert.equal(payload.updatedAt, "now");
  assert.equal(payload.extra, "keep");
  assert.deepEqual(payload.priorityProjectIds, ["p"]);
  assert.equal(reviewId(end), "weekly-review:" + start);
  assert.equal("stats" in payload, false);
  assert.throws(() =>
    weeklyReviewPayload(
      { nextMain: "结果", priorityProjectIds: ["1", "2", "3", "4"] },
      {},
      start,
    ),
  );
  assert.throws(() => weeklyReviewPayload({ nextMain: "" }, {}, start));
  assert.deepEqual(
    weeklyReviewPayload({ nextMain: "独立结果" }, {}, start).priorityProjectIds,
    [],
  );
});
