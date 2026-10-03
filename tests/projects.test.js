import test from "node:test";
import assert from "node:assert/strict";
import {
  projectPayload,
  projectStatusChange,
  projectProgress,
  nextProjectAction,
  projectHistory,
} from "../src/features/projects/model.js";
import { openTaskFocus } from "../src/features/tasks/focus.js";

test("project validation, lifecycle timestamps and unknown fields remain compatible", () => {
  const row = projectPayload(
    { title: "  复习  ", outcome: "通过考试", status: "active", area: "study" },
    { legacy: "kept" },
    "2026-10-01T12:00:00Z",
  );
  assert.equal(row.title, "复习");
  assert.equal(row.legacy, "kept");
  assert.equal(row.createdAt, "2026-10-01T12:00:00Z");
  assert.throws(() => projectPayload({ ...row, outcome: "  " }), /完成结果/);
  assert.throws(
    () =>
      projectPayload({
        ...row,
        startDate: "2026-10-10",
        dueDate: "2026-10-09",
      }),
    /截止日期/,
  );
  const done = projectStatusChange(row, "completed", "2026-10-03T10:00:00Z");
  assert.equal(
    projectStatusChange(done, "archived").completedAt,
    done.completedAt,
  );
  assert.equal(projectStatusChange(done, "active").completedAt, null);
  assert.equal(
    projectPayload({ ...done, title: "新名称" }, done).completedAt,
    done.completedAt,
  );
});
test("progress excludes cancelled, removed and other-project tasks", () => {
  const rows = [
    { id: "1", projectId: "p", status: "done" },
    { id: "2", projectId: "p", status: "open" },
    { id: "3", projectId: "p", status: "cancelled" },
    { id: "4", projectId: "q", status: "done" },
    { id: "5", projectId: "p", status: "done", deleted: true },
  ];
  assert.deepEqual(projectProgress("p", rows), {
    done: 1,
    total: 2,
    percent: 50,
  });
  assert.deepEqual(projectProgress("empty", rows), {
    done: 0,
    total: 0,
    percent: 0,
  });
  rows[1].status = "done";
  assert.equal(projectProgress("p", rows).percent, 100);
  rows[0].status = "open";
  assert.equal(projectProgress("p", rows).percent, 50);
});
test("a stale next action becomes a labelled suggestion without writes", () => {
  const project = { id: "p", nextAction: "done" };
  const tasks = [
    { id: "done", projectId: "p", status: "done" },
    { id: "open", projectId: "p", status: "open" },
    { id: "foreign", projectId: "q", status: "open" },
  ];
  assert.deepEqual(nextProjectAction(project, tasks), {
    task: tasks[1],
    selected: false,
  });
  assert.equal(project.nextAction, "done");
  assert.equal(
    nextProjectAction({ ...project, nextAction: "foreign" }, tasks).selected,
    false,
  );
  assert.equal(
    nextProjectAction({ ...project, nextAction: "open" }, tasks).selected,
    true,
  );
  tasks[1].deleted = true;
  assert.equal(nextProjectAction(project, tasks).task, null);
});
test("history uses actual current events and removes reopened completion", () => {
  const project = { id: "p", createdAt: "2026-10-01T00:00:00Z" };
  const task = {
    id: "t",
    projectId: "p",
    status: "done",
    completedAt: "2026-10-02T00:00:00Z",
    title: "阅读",
  };
  assert.equal(projectHistory(project, [task], [])[0].text, "完成任务：阅读");
  assert.equal(
    projectHistory(project, [{ ...task, status: "open" }], []).length,
    1,
  );
});
test("project/task entry preserves paused and running focus sessions", async () => {
  globalThis.location = { hash: "" };
  const focus = {
    id: "current-focus",
    taskId: "t",
    elapsed: 240000,
    running: false,
  };
  let writes = 0,
    notified = "";
  const app = {
    list: () => [focus],
    save: async () => writes++,
    notify: (message) => (notified = message),
  };
  await openTaskFocus(app, { id: "t" });
  assert.equal(writes, 0);
  assert.equal(location.hash, "focus");
  focus.running = true;
  await openTaskFocus(app, { id: "other" });
  assert.equal(writes, 0);
  assert.match(notified, /暂停/);
  focus.running = false;
  await openTaskFocus(app, { id: "other" });
  assert.equal(writes, 1);
});
