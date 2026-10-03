import test from "node:test";
import assert from "node:assert/strict";
import { createTrackerReader } from "../src/features/trackers/selectors.js";
import { adaptRecords } from "../src/features/trackers/adapters/index.js";
import { aggregate } from "../src/features/trackers/metrics.js";
import { TRACKERS } from "../src/features/trackers/definitions.js";
import { KINDS, validateBackup } from "../src/domain.js";
const date = "2026-10-04";
const row = (kind, id, fields) => ({ kind, id, date, ...fields });
test("legacy adapters use real fields, include only English episode/reading, exclude Sales and plans", () => {
  const rows = [
    row("sleep", "s", { minutes: 402, wake: date + "T10:00" }),
    row("workout", "w", { minutes: "25" }),
    row("workout", "w2", { minutes: 20 }),
    row("study", "s1", { minutes: 90 }),
    row("study", "s2", { minutes: 30 }),
    row("guitar", "g", { minutes: 20 }),
    row("guitar", "g2", { minutes: 10 }),
    row("episode", "e", { minutes: 22 }),
    row("reading", "r", { minutes: 8 }),
    row("word", "word", { minutes: 500 }),
    row("routine", "routine", { minutes: 500 }),
    row("deal", "deal", { cents: 50000 }),
    row("income", "i", { cents: 29 }),
    row("income", "i2", { cents: 71 }),
  ];
  const reader = createTrackerReader(rows);
  for (const [id, value] of [
    ["sleep.duration", 402],
    ["workout.minutes", 45],
    ["study.minutes", 120],
    ["guitar.minutes", 30],
    ["english.minutes", 30],
    ["income.amount", 100],
  ])
    assert.equal(reader.getDailyValue(id, date).value, value);
  assert.equal(reader.getDailyValue("workout.minutes", date).entryCount, 2);
  assert.equal(
    adaptRecords(rows).some((e) =>
      ["word", "deal", "routine"].includes(e.sourceKind),
    ),
    false,
  );
});
test("body latest is stable when historical measurement times are absent; emotion retains direction", () => {
  const rows = [
    row("body", "z", { weight: "57.3", waist: 70 }),
    row("body", "a", { weight: 58 }),
    row("emotion", "z", { time: "08:00", mood: "开心", intensity: 5 }),
    row("emotion", "a", { time: "20:00", mood: "焦虑", intensity: 2 }),
  ];
  const read = createTrackerReader(rows),
    reversed = createTrackerReader([...rows].reverse());
  assert.deepEqual(
    read.getDailyValue("body.weight", date),
    reversed.getDailyValue("body.weight", date),
  );
  assert.equal(read.getDailyValue("body.weight", date).value, 57.3);
  assert.equal(read.getDailyValue("body.weight", date).uncertainOrder, true);
  assert.equal(read.getDailyValue("body.waist", date).value, 70);
  const mood = read.getDailyValue("emotion.intensity", date);
  assert.equal(mood.value, 2);
  assert.equal(mood.selected.label, "焦虑");
  assert.equal(mood.uncertainOrder, false);
});
test("missing and invalid values never become zero; explicit zero remains recorded", () => {
  const rows = ["", null, undefined, " ", false, {}, "NaN", Infinity, -1].map(
    (minutes, i) => row("guitar", String(i), { minutes }),
  );
  rows.push(
    row("guitar", "bad-date", { date: "2026-02-30", minutes: 4 }),
    row("guitar", "deleted", { minutes: 4, deleted: true }),
  );
  assert.equal(
    createTrackerReader(rows).getDailyValue("guitar.minutes", date).value,
    null,
  );
  rows.push(row("guitar", "zero", { minutes: 0 }));
  assert.equal(
    createTrackerReader(rows).getDailyValue("guitar.minutes", date).missing,
    false,
  );
  assert.equal(
    createTrackerReader(rows).getDailyValue("body.weight", date).value,
    null,
  );
  assert.equal(
    createTrackerReader([row("emotion", "e", { intensity: 7 })]).getDailyValue(
      "emotion.intensity",
      date,
    ).value,
    null,
  );
});
test("ranges keep missing dates; means use recorded daily aggregates, not record count", () => {
  const reader = createTrackerReader([
    row("workout", "a", { minutes: 10 }),
    row("workout", "b", { minutes: 20 }),
    row("workout", "c", { date: "2026-10-06", minutes: 50 }),
  ]);
  assert.deepEqual(
    reader
      .getRangeValues("workout.minutes", date, "2026-10-06")
      .map((d) => d.value),
    [30, null, 50],
  );
  assert.deepEqual(reader.getAverage("workout.minutes", date, "2026-10-06"), {
    value: 40,
    recordedDays: 2,
    totalDays: 3,
  });
  assert.equal(reader.getWeeklyTotal("workout.minutes", date).value, 80);
  assert.equal(
    reader.getRecordedDayCount("workout.minutes", date, "2026-10-10"),
    2,
  );
  assert.equal(reader.getWeeklyTotal("income.amount", date).value, null);
  assert.throws(() => reader.getWeeklyTotal("body.weight", date));
  assert.throws(() => reader.getRangeValues("body.weight", "2026-02-30", date));
  assert.equal(aggregate([{ value: 2 }, { value: 4 }], "mean").value, 3);
});
test("reading cannot mutate legacy payloads, backups or introduce persisted kinds", () => {
  const payload = {
    format: "action-backup",
    version: 1,
    rows: [
      {
        id: "s",
        kind: "sleep",
        data: { date, minutes: 402, unknown: { keep: true } },
      },
    ],
  };
  const before = structuredClone(payload);
  const rows = validateBackup(payload).map((r) =>
    Object.freeze({ ...r.data, id: r.id, kind: r.kind }),
  );
  Object.freeze(rows);
  createTrackerReader(rows).getRangeValues(
    "sleep.duration",
    date,
    "2026-10-10",
  );
  assert.deepEqual(payload, before);
  assert.equal(KINDS.includes("tracker"), false);
  assert.equal(KINDS.includes("trackerEntry"), false);
  assert.ok(
    TRACKERS.every((t) => t.sourceKey && t.target === null && t.active),
  );
});
