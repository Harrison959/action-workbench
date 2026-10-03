import test from "node:test";
import assert from "node:assert/strict";
import { buildCommands } from "../src/features/command/commands.js";
import {
  searchCommands,
  isCommandShortcut,
  nextIndex,
} from "../src/features/command/search.js";
import { openTaskFocus } from "../src/features/tasks/focus.js";
const date = "2026-10-03";
const app = (rows) => ({ list: (kind) => rows.filter((r) => r.kind === kind) });
test("Command defaults start with the five frequent actions and seven existing routes", () => {
  const commands = buildCommands(app([]), date);
  assert.deepEqual(
    commands.slice(0, 5).map((c) => c.id),
    ["new-task", "capture", "new-project", "focus", "new-event"],
  );
  assert.equal(commands.length, 13);
  assert.deepEqual(
    commands.filter((c) => c.operation === "navigate").map((c) => c.route),
    ["today", "projects", "calendar", "review", "inbox", "data", "more"],
  );
  assert.deepEqual(searchCommands(" ", commands, [], []), commands);
});
test("Search groups commands before current projects and unfinished tasks; substring ignores case", () => {
  const projects = [
    { id: "p", title: "MedicalBench MVP", status: "active" },
    { id: "archived", title: "Medical archive", status: "archived" },
    { id: "done", title: "Medical done", status: "completed" },
    { id: "paused", title: "Medical paused", status: "paused" },
    { id: "deleted", title: "Medical deleted", deleted: true },
  ];
  const tasks = [
    { id: "t", title: "完成 MedicalBench 评分 API", projectId: "p" },
    { id: "done", title: "Medical done", status: "done" },
    { id: "cancel", title: "Medical cancelled", status: "cancelled" },
    { id: "gone", title: "Medical gone", deleted: true },
  ];
  const results = searchCommands(
    "  MEDICAL ",
    [{ key: "c", label: "Medical 命令", type: "command" }],
    projects,
    tasks,
  );
  assert.deepEqual(
    results.map((r) => r.type),
    ["command", "project", "project", "task"],
  );
  assert.equal(results.at(-1).detail, "MedicalBench MVP");
  assert.deepEqual(
    searchCommands("评分", [], projects, tasks).map((r) => r.task.id),
    ["t"],
  );
  assert.deepEqual(
    searchCommands("评分 API 语义变体", [], projects, tasks),
    [],
  );
});
test("Focus command reuses Today recommendation and labels only valid running/paused sessions as continue", () => {
  const task = { kind: "task", id: "t", title: "复习", date, top: true };
  const focus = {
    kind: "focus",
    id: "current-focus",
    taskId: "t",
    elapsed: 60000,
    running: false,
  };
  assert.equal(
    buildCommands(app([task, focus]), date)[3].label,
    "继续专注：复习",
  );
  assert.equal(buildCommands(app([task]), date)[3].task.id, "t");
  assert.equal(
    buildCommands(app([{ ...task, status: "done" }, focus]), date)[3].task,
    undefined,
  );
  assert.equal(
    buildCommands(app([task, { ...focus, elapsed: 0, started: null }]), date)[3]
      .label,
    "开始专注",
  );
});
test("Ctrl on Windows/Linux and Cmd on Mac accept only an unmodified, non-repeated shortcut", () => {
  const ctrl = { key: "k", ctrlKey: true },
    cmd = { key: "K", metaKey: true };
  assert.ok(isCommandShortcut(ctrl, "Win32"));
  assert.ok(isCommandShortcut(ctrl, "Linux"));
  assert.ok(isCommandShortcut(cmd, "MacIntel"));
  assert.ok(!isCommandShortcut(cmd, "Win32"));
  assert.ok(!isCommandShortcut(ctrl, "MacIntel"));
  for (const extra of [
    { shiftKey: true },
    { altKey: true },
    { repeat: true },
    { isComposing: true },
    { defaultPrevented: true },
    { metaKey: true },
  ])
    assert.ok(!isCommandShortcut({ ...ctrl, ...extra }, "Win32"));
});
test("Arrow navigation wraps and safely handles zero matches", () => {
  assert.equal(nextIndex(0, -1, 3), 2);
  assert.equal(nextIndex(2, 1, 3), 0);
  assert.equal(nextIndex(0, 1, 0), 0);
});
test("An invalid running Focus cannot block explicitly starting the next eligible task", async () => {
  globalThis.location = { hash: "" };
  const saved = [];
  const a = app([
    { kind: "focus", id: "current-focus", taskId: "removed", running: true },
  ]);
  a.save = async (...args) => saved.push(args);
  a.notify = () => assert.fail("Invalid session must not block execution");
  await openTaskFocus(a, { id: "next", minutes: 30 });
  assert.equal(saved.length, 1);
  assert.equal(saved[0][1].taskId, "next");
  assert.equal(location.hash, "focus");
});
