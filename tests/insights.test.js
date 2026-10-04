import test from "node:test";
import assert from "node:assert/strict";
import { addDays, KINDS } from "../src/domain.js";
import {
  insightReport,
  selectInsights,
} from "../src/features/insights/selectors.js";
import { projectActivityDates } from "../src/features/review/weekly/selectors.js";
import { parseRoute, navigationGroup, PRIMARY_NAV } from "../src/navigation.js";

const date = "2026-10-04";
const row = (kind, id, data = {}) => ({ kind, id, ...data });
const sleeps = (base, minutes, count = 3) =>
  Array.from({ length: count }, (_, i) =>
    row("sleep", `${base}-${i}`, { date: addDays(base, i), minutes }),
  );
const baseline = () => [
  row("weeklyReview", "previous-review", { weekStart: "2026-09-21" }),
  row("workout", "workout", { date, minutes: 10 }),
  ...sleeps("2026-09-28", 420),
  ...sleeps("2026-09-21", 420),
];
const project = (id = "p", data = {}) =>
  row("project", id, {
    title: "MedicalBench",
    createdAt: "2026-09-01",
    status: "active",
    ...data,
  });
const report = (rows = [], options = {}) =>
  insightReport([...baseline(), ...rows], { asOf: date, ...options });
const find = (rows, type, options) =>
  report(rows, options).items.find((i) => i.type === type);
const daily = (kind, base, field, value, count = 3) =>
  Array.from({ length: count }, (_, i) =>
    row(kind, `${kind}-${base}-${i}`, {
      date: addDays(base, i),
      [field]: value,
    }),
  );
const tasks = (count, done, top = false) =>
  Array.from({ length: count }, (_, i) =>
    row("task", `t${i}`, {
      date,
      status: i < done ? "done" : "open",
      completedAt: i < done ? date + "T12:00:00+08:00" : null,
      top,
    }),
  );

test("Overflowed aggregates never produce pseudo-precise trend or monetary prompts", () => {
  const rows = [
    ...sleeps("2026-09-28", 1e308),
    ...sleeps("2026-09-21", 420),
    ...daily("study", "2026-09-28", "minutes", 1e308),
    ...daily("study", "2026-09-21", "minutes", 100),
    ...daily("income", "2026-09-28", "cents", Number.MAX_SAFE_INTEGER),
    ...daily("income", "2026-09-21", "cents", 10000),
  ];
  assert.equal(
    insightReport(rows, { asOf: date }).items.some((i) =>
      [
        "sleep-change",
        "learning-change",
        "income-change",
        "income-concentration",
      ].includes(i.type),
    ),
    false,
  );
});

test("Project inactivity covers exactly 14 business dates, known age and current active status", () => {
  assert.equal(
    find([project()], "project-inactive").evidence.window.start,
    "2026-09-21",
  );
  for (const data of [
    { status: "paused" },
    { status: "completed" },
    { createdAt: "2026-09-22" },
    { startDate: "2026-09-22" },
    { createdAt: null },
    { deleted: true },
  ])
    assert.equal(find([project("p", data)], "project-inactive"), undefined);
  assert.ok(
    find(
      [project("p", { createdAt: null, startDate: "2026-09-01" })],
      "project-inactive",
    ),
  );
  assert.equal(
    find([project()], "project-inactive", { weekDate: "2026-09-20" }),
    undefined,
  );
});
test("Dated completed project tasks and new notes suppress inactivity, generic updates do not", () => {
  const p = project();
  assert.equal(
    find(
      [
        p,
        row("task", "t", {
          projectId: p.id,
          status: "done",
          completedAt: "2026-09-20T16:00:00Z",
        }),
      ],
      "project-inactive",
    ),
    undefined,
  );
  assert.equal(
    find(
      [p, row("projectNote", "n", { projectId: p.id, createdAt: date })],
      "project-inactive",
    ),
    undefined,
  );
  assert.ok(
    find(
      [
        p,
        row("projectNote", "n", {
          projectId: p.id,
          createdAt: "2026-09-20",
          updatedAt: date,
        }),
      ],
      "project-inactive",
    ),
  );
  assert.ok(
    find(
      [
        p,
        row("task", "t", {
          projectId: p.id,
          status: "open",
          completedAt: date,
        }),
      ],
      "project-inactive",
    ),
  );
  assert.ok(
    find(
      [
        p,
        row("projectNote", "n", {
          projectId: p.id,
          createdAt: date,
          deleted: true,
        }),
      ],
      "project-inactive",
    ),
  );
  assert.equal(
    find(
      [p, row("task", "unknown", { projectId: p.id, status: "done" })],
      "project-inactive",
    ),
    undefined,
  );
  assert.equal(
    find(
      [p, row("projectNote", "unknown", { projectId: p.id })],
      "project-inactive",
    ),
    undefined,
  );
  assert.deepEqual(
    projectActivityDates(
      project("p", { status: "completed", completedAt: date }),
      [],
    ),
    [date],
  );
});
test("Missing weekly review uses a finished natural week and routes to the matching week", () => {
  const missing = insightReport([], { asOf: "2026-10-05" }).items.find(
    (i) => i.type === "review-missing",
  );
  assert.equal(missing.actionRoute, "review?view=weekly&week=2026-09-28");
  assert.equal(
    insightReport([row("weeklyReview", "r", { weekStart: "2026-09-28" })], {
      asOf: "2026-10-05",
    }).items.some((i) => i.type === "review-missing"),
    false,
  );
  assert.equal(
    insightReport([row("weeklyReview", "weekly-review:2026-09-28")], {
      asOf: "2026-10-05",
    }).items.some((i) => i.type === "review-missing"),
    false,
  );
  assert.ok(
    insightReport(
      [row("weeklyReview", "r", { weekStart: "2026-09-28", deleted: true })],
      { asOf: "2026-10-05" },
    ).items.some((i) => i.type === "review-missing"),
  );
  assert.equal(
    insightReport([], { asOf: date, weekDate: "2026-09-20" }).items.find(
      (i) => i.type === "review-missing",
    ).actionRoute,
    "review?view=weekly&week=2026-09-14",
  );
});
test("Plan and Top 3 thresholds use weekly scheduled/completed intersection and exclude cancelled tasks", () => {
  assert.ok(find(tasks(5, 1), "plan-completion"));
  assert.equal(find(tasks(5, 2), "plan-completion"), undefined);
  assert.equal(find(tasks(4, 0), "plan-completion"), undefined);
  assert.ok(find(tasks(3, 1, true), "top-completion"));
  assert.equal(find(tasks(3, 2, true), "top-completion"), undefined);
  assert.equal(find(tasks(2, 0, true), "top-completion"), undefined);
  const cancelled = tasks(5, 0);
  cancelled[0].status = "cancelled";
  assert.equal(find(cancelled, "plan-completion"), undefined);
  const outside = tasks(5, 5).map((t) => ({
    ...t,
    completedAt: "2026-09-27T12:00:00+08:00",
  }));
  assert.equal(find(outside, "plan-completion").evidence.plannedDone, 0);
  assert.equal(
    report(tasks(7, 1, true)).items.filter((i) =>
      ["plan-completion", "top-completion"].includes(i.type),
    ).length,
    1,
  );
  assert.match(
    report(tasks(5, 0), { asOf: "2026-09-28" }).items.find(
      (i) => i.type === "plan-completion",
    ).description,
    /尚未结束/,
  );
});
test("Sleep comparison requires three recorded days per period and includes means/coverage/windows", () => {
  const change = insightReport(
    [...sleeps("2026-09-28", 375), ...sleeps("2026-09-21", 420)],
    { asOf: date },
  ).items.find((i) => i.type === "sleep-change");
  assert.equal(change.evidence.differenceMinutes, -45);
  assert.equal(change.evidence.current.recordedDays, 3);
  assert.equal(change.evidence.previous.recordedDays, 3);
  assert.equal(change.evidence.current.value, 375);
  assert.equal(change.evidence.previous.value, 420);
  for (const rows of [
    [...sleeps("2026-09-28", 300, 2), ...sleeps("2026-09-21", 420)],
    [...sleeps("2026-09-28", 376), ...sleeps("2026-09-21", 420)],
  ])
    assert.equal(
      insightReport(rows, { asOf: date }).items.some(
        (i) => i.type === "sleep-change",
      ),
      false,
    );
});
test("Sleep low coverage preserves missing values and explicit zeros without imputed comparisons", () => {
  const missing = insightReport([], { asOf: date }).items.find(
    (i) => i.type === "sleep-coverage",
  );
  assert.equal(missing.evidence.recordedDays, 0);
  const two = insightReport(sleeps("2026-09-28", 0, 2), {
    asOf: date,
  }).items.find((i) => i.type === "sleep-coverage");
  assert.equal(two.evidence.recordedDays, 2);
  assert.equal(
    insightReport(sleeps("2026-09-28", 300), { asOf: date }).items.some(
      (i) => i.type === "sleep-coverage",
    ),
    false,
  );
});
test("Workout absence distinguishes no record, explicit zero and positive duration", () => {
  const get = (rows) =>
    insightReport(rows, { asOf: date }).items.find(
      (i) => i.type === "workout-low-record",
    );
  assert.equal(get([]).evidence.value, null);
  assert.equal(
    get([row("workout", "z", { date, minutes: 0 })]).evidence.value,
    0,
  );
  assert.match(
    get([row("workout", "z", { date, minutes: 0 })]).title,
    /合计 0 分钟/,
  );
  assert.equal(
    get([row("workout", "p", { date: "2026-09-21", minutes: 1 })]),
    undefined,
  );
  assert.ok(get([row("workout", "old", { date: "2026-09-20", minutes: 30 })]));
});
test("Learning comparison has coverage, 50 percent/30 minute boundaries and largest-change deduplication", () => {
  const study = [
    ...daily("study", "2026-09-21", "minutes", 100),
    ...daily("study", "2026-09-28", "minutes", 50),
  ];
  assert.equal(find(study, "learning-change").evidence.relativeChange, -0.5);
  assert.equal(
    find(
      [
        ...daily("study", "2026-09-21", "minutes", 100),
        ...daily("study", "2026-09-28", "minutes", 50, 2),
      ],
      "learning-change",
    ),
    undefined,
  );
  assert.equal(
    find(
      [
        ...daily("study", "2026-09-21", "minutes", 10),
        ...daily("study", "2026-09-28", "minutes", 5),
      ],
      "learning-change",
    ),
    undefined,
  );
  const english = [
    ...daily("episode", "2026-09-21", "minutes", 40),
    ...daily("reading", "2026-09-28", "minutes", 10),
  ];
  assert.equal(
    find([...study, ...english], "learning-change").evidence.trackerId,
    "english.minutes",
  );
  assert.equal(
    report([...study, ...english]).items.filter(
      (i) => i.type === "learning-change",
    ).length,
    1,
  );
  assert.equal(
    find(daily("word", "2026-09-28", "minutes", 1000), "learning-change"),
    undefined,
  );
});
test("Income compares existing cents, at least three days per period, 50 percent and ¥100 absolute change", () => {
  const previous = daily("income", "2026-09-21", "cents", 10000);
  const change = find(
    [...previous, ...daily("income", "2026-09-28", "cents", 5000)],
    "income-change",
  );
  assert.equal(change.evidence.current.value, 15000);
  assert.equal(change.evidence.previous.value, 30000);
  for (const rows of [
    daily("income", "2026-09-28", "cents", 5000),
    [...previous, ...daily("income", "2026-09-28", "cents", 5000, 2)],
    [
      ...daily("income", "2026-09-21", "cents", 0),
      ...daily("income", "2026-09-28", "cents", 5000),
    ],
  ])
    assert.equal(find(rows, "income-change"), undefined);
  assert.equal(
    find(
      [
        ...daily("deal", "2026-09-21", "cents", 10000),
        ...daily("deal", "2026-09-28", "cents", 5000),
      ],
      "income-change",
    ),
    undefined,
  );
});
test("Income concentration requires sufficient coverage, total and named resolvable positive sources", () => {
  const accounts = [
    row("account", "a", { name: "种田号" }),
    row("account", "b", { name: "生活号" }),
  ];
  const entries = Array.from({ length: 7 }, (_, i) => [
    row("income", "a" + i, {
      date: addDays(date, -i),
      accountId: "a",
      cents: 8200,
    }),
    row("income", "b" + i, {
      date: addDays(date, -i),
      accountId: "b",
      cents: 1800,
    }),
  ]).flat();
  const insight = find([...accounts, ...entries], "income-concentration");
  assert.equal(insight.evidence.share, 0.82);
  assert.equal(insight.evidence.recordedDays, 7);
  assert.equal(insight.evidence.accountId, "a");
  assert.equal(
    find([...accounts, ...entries.slice(2)], "income-concentration"),
    undefined,
  );
  assert.equal(
    find(
      [...accounts, ...entries.map((r) => ({ ...r, cents: r.cents / 100 }))],
      "income-concentration",
    ),
    undefined,
  );
  assert.equal(
    find(
      [
        ...accounts,
        ...entries,
        row("income", "unknown", { date, accountId: "missing", cents: 10 }),
      ],
      "income-concentration",
    ),
    undefined,
  );
});
test("Priorities, category caps, duplicate IDs and overall cap are deterministic without input mutation", () => {
  const rows = [project("2"), project("1"), project("3"), ...tasks(5, 0, true)];
  const frozen = JSON.stringify(rows);
  const insights = insightReport(rows, { asOf: date }).items;
  assert.equal(insights.length, 5);
  assert.deepEqual(
    insights.map((i) => i.type),
    [
      "project-inactive",
      "project-inactive",
      "review-missing",
      "plan-completion",
      "sleep-coverage",
    ],
  );
  assert.equal(JSON.stringify(rows), frozen);
  const one = {
    id: "x",
    type: "x",
    priority: 1,
    group: "project",
    severity: "info",
  };
  assert.equal(selectInsights([one, { ...one }]).length, 1);
  assert.equal(selectInsights([one], 0).length, 0);
  assert.ok(
    insights.every(
      (i) =>
        ["info", "attention"].includes(i.severity) &&
        i.evidence.rule &&
        i.evidence.sources.length,
    ),
  );
});
test("Routes keep Insight under More, preserve exact Project ID, and never invent a Focus trend", () => {
  assert.equal(parseRoute("#insights").page, "insights");
  assert.equal(navigationGroup("insights"), "more");
  assert.equal(PRIMARY_NAV.length, 7);
  assert.equal(KINDS.includes("insight"), false);
  const action = find(
    [project("medical/id 空格")],
    "project-inactive",
  ).actionRoute;
  assert.equal(parseRoute("#" + action).id, "medical/id 空格");
  assert.ok(
    report([
      row("focus", "current-focus", { elapsed: 999999, running: true }),
    ]).items.every((i) => !i.type.includes("focus")),
  );
});
test("Historical windows end at selected Sunday and future weeks produce no factual claims", () => {
  const historical = report([], { weekDate: "2026-09-20" });
  assert.equal(historical.reference, "2026-09-20");
  assert.deepEqual(historical.windows.previous, {
    start: "2026-09-07",
    end: "2026-09-13",
  });
  assert.equal(report([], { weekDate: "2026-10-05" }).items.length, 0);
  assert.throws(() => report([], { asOf: "2026-02-30" }));
  assert.equal(report([], { limit: 99 }).items.length, 0);
});
