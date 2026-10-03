import "fake-indexeddb/auto";
import { openDB } from "idb";
import test from "node:test";
import assert from "node:assert/strict";
import { syncRecords, needsProjectMigration, needsWeeklyReviewMigration } from "../src/syncRecords.js";

const local = new Map();
globalThis.localStorage = {
  getItem: (k) => local.get(k) ?? null,
  setItem: (k, v) => local.set(k, String(v)),
};
globalThis.BroadcastChannel = undefined;
const db = await import("../src/db.js");
const setScope = () => {
  const scope = crypto.randomUUID();
  db.setScope(scope);
  return scope;
};
const raw = async (id, scope = db.getScope()) =>
  (await db.allRows(scope)).find((r) => r.id === id);
const clone = (v) => structuredClone(v);
function server({
  rejectProjects = false,
  rejectWeekly = false,
  onWrite,
} = {}) {
  const records = new Map();
  return {
    records,
    from: () => ({
      select: () => ({
        order: () => ({
          range: async (start, end) => ({
            data: [...records.values()]
              .sort((a, b) => a.id.localeCompare(b.id))
              .slice(start, end + 1)
              .map(clone),
            error: null,
          }),
        }),
      }),
    }),
    rpc: async (name, v) => {
      assert.equal(name, "save_action_record");
      if (rejectWeekly && v.p_kind === "weeklyReview")
        return {
          error: {
            code: "23514",
            message: 'violates check constraint "action_records_kind_check"',
          },
        };
      if (rejectProjects && ["project", "projectNote"].includes(v.p_kind))
        return {
          error: {
            code: "23514",
            message: 'violates check constraint "action_records_kind_check"',
          },
        };
      const existing = records.get(v.p_id);
      if ((existing?.version || 0) !== v.p_expected)
        return { data: { conflict: true, record: clone(existing) } };
      const record = {
        id: v.p_id,
        kind: v.p_kind,
        payload: clone(v.p_payload),
        deleted: v.p_deleted,
        version: (existing?.version || 0) + 1,
      };
      records.set(record.id, record);
      if (onWrite) await onWrite(v);
      return { data: { conflict: false, record: clone(record) } };
    },
  };
}

test("v1 records survive new types, soft deletion and project restoration", async () => {
  const scope = setScope(),
    old = {
      title: "旧任务",
      date: "2026-09-30",
      stream: "courses",
      goalId: "g",
      subtasksText: "章节一",
      extra: { preserve: true },
    };
  await db.put("task", old, "legacy");
  await db.put(
    "income",
    { date: "2026-09-30", cents: 5067, accountId: "a" },
    "income",
  );
  const before = clone(await db.allRows());
  await db.put("project", { title: "复习", outcome: "及格" }, "p");
  assert.deepEqual(
    (await db.allRows()).filter((r) => r.kind !== "project"),
    before,
  );
  await db.put("task", { ...old, projectId: "p" }, "legacy");
  await db.put("projectNote", { projectId: "p", text: "重点" }, "n");
  await db.remove("p");
  assert.equal(
    (await db.records()).some((r) => r.id === "p"),
    false,
  );
  assert.equal((await raw("legacy")).data.projectId, "p");
  assert.equal((await raw("n")).deleted, false);
  await db.restore("p");
  assert.equal((await raw("p")).deleted, false);
  assert.equal((await raw("legacy")).data.extra.preserve, true);
  const conn = await openDB("action-workbench");
  assert.equal(conn.version, 1);
  conn.close();
  db.setScope("other-" + scope);
  assert.equal((await db.records()).length, 0);
});

test("weekly reviews preserve old records, round-trip backups, CAS and soft deletion without a database upgrade", async () => {
  const a = setScope(),
    c = server();
  await db.put("summary", { date: "2026-10-04", progress: "旧小结" }, "daily");
  const payload = {
    weekStart: "2026-09-28",
    weekEnd: "2026-10-04",
    nextMain: "通过考试",
    priorityProjectIds: ["p"],
    createdAt: "2026-10-04T12:00:00Z",
  };
  await db.put("weeklyReview", payload, "weekly-review:2026-09-28");
  await syncRecords(c, a, db);
  const backup = await db.exportData();
  const b = setScope();
  await db.importData(backup);
  assert.deepEqual((await raw("weekly-review:2026-09-28")).data, payload);
  const d = setScope();
  await syncRecords(c, d, db);
  assert.deepEqual((await raw("daily")).data, {
    date: "2026-10-04",
    progress: "旧小结",
  });
  await db.put(
    "weeklyReview",
    { ...payload, nextMain: "另一设备" },
    "weekly-review:2026-09-28",
    d,
  );
  await db.put(
    "weeklyReview",
    { ...payload, nextMain: "本机" },
    "weekly-review:2026-09-28",
    a,
  );
  await syncRecords(c, a, db);
  assert.equal((await syncRecords(c, d, db)).conflicts, true);
  await db.resolveConflict("weekly-review:2026-09-28", true);
  await syncRecords(c, d, db);
  await db.remove("weekly-review:2026-09-28");
  await syncRecords(c, d, db);
  await syncRecords(c, a, db);
  assert.equal((await raw("weekly-review:2026-09-28", a)).deleted, true);
  await db.restore("weekly-review:2026-09-28");
  await syncRecords(c, d, db);
  const conn = await openDB("action-workbench");
  assert.equal(conn.version, 1);
  conn.close();
  assert.ok(b);
});
test("old cloud rejects weekly kind without losing dirty data or blocking old uploads", async () => {
  assert.equal(needsWeeklyReviewMigration({kind:'weeklyReview'},{code:'23514',message:'payload_check'}),false);
  assert.equal(needsWeeklyReviewMigration({kind:'income'},{code:'23514',message:'action_records_kind_check'}),false);
  const scope = setScope(),
    c = server({ rejectWeekly: true });
  await db.put("weeklyReview", { nextMain: "待传" }, "a-weekly");
  await db.put("income", { cents: 123 }, "z-income");
  const result = await syncRecords(c, scope, db);
  assert.equal(result.weeklyUpgrade, true);
  assert.equal((await raw("a-weekly")).dirty, true);
  assert.equal((await raw("z-income")).dirty, false);
  const upgraded = server();
  upgraded.records.set("z-income", c.records.get("z-income"));
  await syncRecords(upgraded, scope, db);
  assert.equal((await raw("a-weekly")).dirty, false);
});
test("old/new backups merge safely, preserve tombstones, reject invalid import atomically", async () => {
  setScope();
  await db.put("task", { title: "原有任务" }, "t");
  await db.put("project", { title: "原项目" }, "p");
  await db.remove("p");
  const backup = await db.exportData();
  setScope();
  await db.put("task", { title: "本地更新" }, "t");
  assert.equal(await db.importData(backup), 1);
  assert.equal((await raw("t")).data.title, "本地更新");
  assert.equal((await raw("p")).deleted, true);
  const old = {
    format: "action-backup",
    version: 1,
    rows: [
      { id: "old", kind: "sleep", data: { minutes: 500, date: "2026-09-01" } },
    ],
  };
  assert.equal(await db.importData(old), 1);
  const before = await db.allRows();
  await assert.rejects(
    db.importData({
      ...old,
      rows: [
        { id: "valid", kind: "task", data: {} },
        { id: "bad", kind: "unknown", data: {} },
      ],
    }),
  );
  assert.deepEqual(await db.allRows(), before);
});
test("projects, tasks, notes and old income synchronize across isolated devices", async () => {
  const a = setScope(),
    c = server();
  for (const [kind, data, id] of [
    ["project", { title: "复习", outcome: "通过考试" }, "p"],
    [
      "task",
      { title: "阅读", projectId: "p", stream: "courses", goalId: "old" },
      "t",
    ],
    ["projectNote", { projectId: "p", text: "考点" }, "n"],
    ["income", { cents: 55001, date: "2026-10-01" }, "i"],
  ])
    await db.put(kind, data, id);
  assert.deepEqual(await syncRecords(c, a, db), {
    projectUpgrade: false,
    conflicts: false,
    pending: false,
  });
  const b = setScope();
  await syncRecords(c, b, db);
  assert.deepEqual(await db.records(b), await db.records(a));
  await db.remove("p");
  await syncRecords(c, b, db);
  await syncRecords(c, a, db);
  assert.equal((await raw("p", a)).deleted, true);
  assert.equal((await raw("t", a)).deleted, false);
});
test("old server leaves new kinds dirty and still uploads subsequent legacy records", async () => {
  const scope = setScope(),
    c = server({ rejectProjects: true });
  await db.put("project", { title: "待升级" }, "a-project");
  await db.put(
    "projectNote",
    { text: "笔记", projectId: "a-project" },
    "b-note",
  );
  await db.put("income", { cents: 123 }, "z-income");
  const result = await syncRecords(c, scope, db);
  assert.equal(result.projectUpgrade, true);
  assert.equal(result.pending, true);
  assert.equal((await raw("a-project")).dirty, true);
  assert.equal((await raw("a-project")).version, 0);
  assert.equal((await raw("z-income")).dirty, false);
  assert.equal(c.records.get("z-income").payload.cents, 123);
  assert.equal(
    needsProjectMigration(
      { kind: "project" },
      { code: "23514", message: "payload_check" },
    ),
    false,
  );
  const upgraded = server();
  upgraded.records.set("z-income", c.records.get("z-income"));
  await syncRecords(upgraded, scope, db);
  assert.equal((await raw("a-project")).dirty, false);
});
test("concurrent devices expose conflicts and selected local resolution advances version", async () => {
  const a = setScope(),
    c = server();
  await db.put("project", { title: "初版" }, "p");
  await syncRecords(c, a, db);
  const b = setScope();
  await syncRecords(c, b, db);
  await db.put("project", { title: "设备B" }, "p", b);
  await db.put("project", { title: "设备A" }, "p", a);
  await syncRecords(c, a, db);
  assert.equal((await syncRecords(c, b, db)).conflicts, true);
  assert.equal((await raw("p", b)).data.title, "设备B");
  assert.equal((await raw("p", b)).conflict.payload.title, "设备A");
  await db.resolveConflict("p", true);
  await syncRecords(c, b, db);
  await syncRecords(c, a, db);
  assert.equal((await raw("p", a)).data.title, "设备B");
  assert.equal((await raw("p", a)).version, 3);
});
test("an in-flight local edit remains dirty after acknowledgement", async () => {
  const scope = setScope();
  await db.put("task", { title: "上传中" }, "t");
  let edited = false;
  const c = server({
    onWrite: async () => {
      if (!edited) {
        edited = true;
        await db.put("task", { title: "上传期间修改", projectId: "p" }, "t");
      }
    },
  });
  await syncRecords(c, scope, db);
  assert.equal((await raw("t")).dirty, true);
  assert.equal((await raw("t")).data.title, "上传期间修改");
  await syncRecords(c, scope, db);
  assert.equal((await raw("t")).dirty, false);
  assert.equal(c.records.get("t").payload.projectId, "p");
});
test("transport failures and invalid responses leave offline records intact", async () => {
  const scope = setScope();
  await db.put("project", { title: "离线项目" }, "p");
  const before = clone(await raw("p"));
  const c = server();
  c.rpc = async () => ({ error: { message: "Network unavailable" } });
  await assert.rejects(syncRecords(c, scope, db));
  assert.deepEqual(await raw("p"), before);
  c.rpc = async () => ({ data: null });
  await assert.rejects(syncRecords(c, scope, db), /云端返回/);
  assert.deepEqual(await raw("p"), before);
});
