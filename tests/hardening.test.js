import test from "node:test";
import assert from "node:assert/strict";
import {
  money,
  incomeStats,
  salesStats,
  completedBooks,
} from "../src/domain.js";

test("legacy missing dates and invalid money do not crash or invent income", () => {
  const rows = [
    { cents: 999 },
    { date: "2026-10-01", cents: "bad" },
    { date: "2026-10-01", cents: null },
    { date: "2026-10-01", cents: "100", accountId: "a" },
    { date: "2026-10-02", cents: 0, accountId: "a" },
    { date: "2026-10-02", cents: 500, deleted: true },
  ];
  const before = structuredClone(rows);
  const result = incomeStats(
    rows,
    [{ id: "a", track: "测试" }],
    "2026-10",
    "2026-10-03",
  );
  assert.equal(result.total, 100);
  assert.equal(result.tracks[0].total, 100);
  assert.deepEqual(
    result.points.map((p) => p.value),
    [1, 0, null],
  );
  assert.deepEqual(rows, before);
  assert.equal(money(null), "未记录");
  assert.equal(money("bad"), "金额无效");
  assert.equal(money(0), "¥0.00");
  assert.equal(
    salesStats([{ id: "a" }], [{ clientId: "a" }], "2026-10").customers,
    0,
  );
  assert.equal(completedBooks([{ completed: 123 }], "2026"), 0);
});
