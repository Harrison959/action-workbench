import test from "node:test";
import assert from "node:assert/strict";
import {
  selectNextAction,
  todayTopThree,
  todayTasks,
} from "../src/features/today/selectors.js";
import { todayTimeline } from "../src/features/today/timeline.js";
const date = "2026-10-03";
const task = (id, extra = {}) => ({
  id,
  title: id,
  date,
  status: "open",
  priority: "P2",
  ...extra,
});
const project = (extra = {}) => ({
  id: "p",
  status: "active",
  nextAction: "next",
  ...extra,
});
const select = (tasks, extra = {}) =>
  selectNextAction({ tasks, date, ...extra });

test("Today empty state excludes future, cancelled, deleted and completed tasks", () => {
  assert.equal(select([]), null);
  assert.equal(
    select([
      task("done", { status: "done" }),
      task("future", { date: "2026-10-04" }),
      task("cancel", { status: "cancelled" }),
      task("deleted", { deleted: true }),
    ]),
    null,
  );
});
test("Top 3 stays capped, priority ordered and preserves completed slots without mutating legacy data", () => {
  const tasks = [
    task("b", { top: true }),
    task("d", { top: true, priority: "P3" }),
    task("a", { top: true, priority: "P1", status: "done" }),
    task("c", { top: true }),
    task("other"),
    task("cancel", { top: true, status: "cancelled" }),
  ];
  const before = structuredClone(tasks);
  assert.deepEqual(
    todayTopThree(tasks, date).map((t) => t.id),
    ["a", "b", "c"],
  );
  assert.equal(todayTasks(tasks, date).length, 5);
  assert.deepEqual(tasks, before);
});
test("Next Action protects explicit Top 3 ahead of higher priority ordinary tasks or project actions", () => {
  const tasks = [
    task("ordinary", { priority: "P1" }),
    task("top", { top: true, priority: "P3" }),
    task("next", { projectId: "p", priority: "P1" }),
  ];
  assert.equal(select(tasks, { projects: [project()] }).task.id, "top");
  assert.equal(select(tasks, { projects: [project()] }).source, "top");
});
test("Eligible explicit project nextAction participates, including within Top 3", () => {
  const tasks = [
    task("top", { top: true, priority: "P1" }),
    task("next", { top: true, projectId: "p", priority: "P2" }),
  ];
  assert.equal(select(tasks, { projects: [project()] }).task.id, "next");
  assert.equal(
    select(
      tasks.map((t) => ({ ...t, top: false })),
      { projects: [project()] },
    ).source,
    "project",
  );
});
test("Project nomination never replaces a dated plan with undated, future, overdue or inactive actions", () => {
  for (const nextDate of [undefined, "2026-10-04", "2026-10-02"]) {
    assert.equal(
      select(
        [task("planned"), task("next", { date: nextDate, projectId: "p" })],
        { projects: [project()] },
      ).task.id,
      "planned",
    );
  }
  for (const p of [
    project({ status: "paused" }),
    project({ status: "archived" }),
    project({ deleted: true }),
    project({ startDate: "2026-10-04" }),
  ]) {
    assert.equal(
      select([task("next", { date: undefined, projectId: "p" })], {
        projects: [p],
      }),
      null,
    );
  }
  const candidate = task("next", { date: undefined, projectId: "p" });
  assert.equal(
    select([candidate], { projects: [project()] }).source,
    "project",
  );
  assert.equal(
    select([candidate], { projects: [project({ nextAction: "missing" })] }),
    null,
  );
  assert.equal(
    select([candidate], { projects: [project({ id: "wrong" })] }),
    null,
  );
});
test("Running and paused Focus win even outside today; completed/reset/stale Focus does not", () => {
  const tasks = [
    task("planned", { top: true }),
    task("focused", { date: "2026-10-02" }),
  ];
  for (const state of [{ running: true }, { running: false, elapsed: 60000 }]) {
    assert.equal(
      select(tasks, {
        focus: [{ id: "current-focus", taskId: "focused", ...state }],
      }).task.id,
      "focused",
    );
  }
  for (const state of [
    { taskId: "focused", elapsed: 0, running: false, started: null },
    { taskId: "missing", running: true },
  ]) {
    assert.equal(
      select(tasks, { focus: [{ id: "current-focus", ...state }] }).task.id,
      "planned",
    );
  }
  assert.equal(
    select([tasks[0], { ...tasks[1], status: "done" }], {
      focus: [{ taskId: "focused", running: true }],
    }).task.id,
    "planned",
  );
});
test("Legacy missing priority/status and orphan projects remain eligible with stable ties", () => {
  const tasks = [
    task("c", { priority: "P3" }),
    { id: "b", title: "旧任务", date, projectId: "missing" },
    task("a"),
  ];
  assert.equal(select(tasks).task.id, "a");
  assert.equal(select([...tasks].reverse()).task.id, "a");
  assert.equal(select([tasks[1]]).task.title, "旧任务");
  assert.equal(select([tasks[1]]).project, undefined);
});
test("Today timeline shows all timed Events in Shanghai date order, including adjustable appointments", () => {
  const events = [
    { id: "late", title: "晚间", start: date + "T22:00", fixed: true },
    { id: "first", title: "早课", start: date + "T08:00", fixed: true },
    { id: "utc", title: "约谈", start: "2026-10-03T01:00:00Z" },
    { id: "fourth", start: date + "T13:00", fixed: false },
    { id: "bad", start: "wrong" },
    { id: "date-only", start: date },
    { id: "cancel", start: date + "T07:00", status: "cancelled" },
    { id: "deleted", start: date + "T07:00", deleted: true },
    { id: "tomorrow", start: "2026-10-03T23:00:00Z" },
  ];
  const items = todayTimeline(events, date);
  assert.deepEqual(
    items.map((i) => i.event.id),
    ["first", "utc", "fourth", "late"],
  );
  assert.deepEqual(
    items.map((i) => i.time),
    ["08:00", "09:00", "13:00", "22:00"],
  );
  assert.equal(items[2].event.fixed, false);
});
