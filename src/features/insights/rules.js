import { addDays, money } from "../../domain.js";
import { adaptRecords } from "../trackers/adapters/index.js";
import { validDate } from "../trackers/metrics.js";
import {
  projectActivityDates,
  timestampDate,
  weekRange,
} from "../review/weekly/selectors.js";
import { projectPath } from "../projects/model.js";
import { reviewId } from "../review/weekly/model.js";

export const THRESHOLDS = Object.freeze({
  planned: 5,
  top: 3,
  completionRate: 0.4,
  sleepDays: 3,
  sleepDifference: 45,
  sleepCoverage: 2,
  trendDays: 3,
  relativeChange: 0.5,
  learningDifference: 30,
  incomeDifference: 10000,
  concentrationDays: 7,
  concentrationTotal: 10000,
  concentrationShare: 0.8,
});
const span = (w) => `${w.start} — ${w.end}`;
const amount = (value) => Number(value.toFixed(1));
function make(
  type,
  group,
  priority,
  title,
  description,
  rule,
  sources,
  window,
  details,
  values,
  actionLabel,
  actionRoute,
  suffix = "",
) {
  return {
    id: `${type}:${window.end}:${suffix}`,
    type,
    group,
    priority,
    severity: [
      "project-inactive",
      "plan-completion",
      "top-completion",
    ].includes(type)
      ? "attention"
      : "info",
    title,
    description,
    evidence: { rule, sources, window, details, ...values },
    actionLabel,
    actionRoute,
  };
}
function sumRange(reader, id, window) {
  const recorded = reader
    .getRangeValues(id, window.start, window.end)
    .filter((d) => !d.missing);
  return {
    value: recorded.length ? recorded.reduce((n, d) => n + d.value, 0) : null,
    recordedDays: recorded.length,
  };
}

export function evaluateRules(c) {
  const { rows, reader, weekly, windows: w, week, asOf, reference } = c,
    out = [],
    t = THRESHOLDS;
  // Current status has no historical snapshot: do not claim historical active periods.
  if (reference === asOf)
    for (const p of rows.filter(
      (r) => r.kind === "project" && r.status === "active",
    )) {
      const created =
        timestampDate(p.createdAt) ||
        (validDate(p.startDate) ? p.startDate : null);
      if (
        !created ||
        created > w.fourteen.start ||
        (validDate(p.startDate) && p.startDate > w.fourteen.start)
      )
        continue;
      const activity = projectActivityDates(p, rows);
      // Undated activity cannot prove that the entire window lacked progress.
      if (
        rows.some(
          (r) =>
            r.projectId === p.id &&
            ((r.kind === "task" &&
              r.status === "done" &&
              !timestampDate(r.completedAt)) ||
              (r.kind === "projectNote" && !timestampDate(r.createdAt))),
        )
      )
        continue;
      if (
        activity.some((date) => date >= w.fourteen.start && date <= reference)
      )
        continue;
      out.push(
        make(
          "project-inactive",
          "project",
          10,
          `「${p.title || "未命名项目"}」最近 14 天没有记录到推进`,
          "仅检查关联任务完成、新增项目笔记与保留的项目完成记录，不代表没有实际工作。",
          "当前进行中、已创建并开始至少覆盖这 14 个业务日期，期间没有可确认日期的活动记录。",
          [
            "project.createdAt/startDate/status/completedAt",
            "task.projectId/status/completedAt",
            "projectNote.projectId/createdAt",
          ],
          w.fourteen,
          [
            `检查范围：${span(w.fourteen)}`,
            `项目创建／开始日期：${created}；使用当前项目状态`,
          ],
          { projectId: p.id, createdDate: created, activityCount: 0 },
          "查看项目",
          projectPath(p.id),
          p.id,
        ),
      );
    }

  const reviewWeek =
    week.end < asOf ? week : weekRange(addDays(week.start, -7));
  if (
    reviewWeek.end < asOf &&
    !rows.some(
      (r) =>
        r.kind === "weeklyReview" &&
        (r.weekStart === reviewWeek.start ||
          r.id === reviewId(reviewWeek.start)),
    )
  ) {
    const previous = reviewWeek.start === weekRange(addDays(asOf, -7)).start;
    out.push(
      make(
        "review-missing",
        "review",
        20,
        previous
          ? "上周还没有完成周复盘"
          : `${span(reviewWeek)} 尚未保存周复盘`,
        "当前记录中未找到对应自然周的周复盘。",
        "已结束的自然周没有对应的未删除的周复盘记录。",
        ["weeklyReview.weekStart/id"],
        reviewWeek,
        [`自然周：${span(reviewWeek)}`, "只检查已保存的复盘，不检查未保存表单"],
        { saved: false },
        "去复盘",
        `review?view=weekly&week=${reviewWeek.start}`,
      ),
    );
  }

  const tasks = weekly.tasks,
    ongoing = week.end >= asOf;
  const planningDescription = `按周复盘口径计算，取消任务不计入；跨周完成不计为本周计划内完成。${ongoing ? "本周尚未结束，计划包括尚未到期的任务。" : ""}`;
  if (tasks.planned >= t.planned && tasks.completionRate < t.completionRate)
    out.push(
      make(
        "plan-completion",
        "planning",
        30,
        `${ongoing ? "本周" : "所选周"}计划 ${tasks.planned} 项，计划内完成 ${tasks.plannedDone} 项，完成率 ${Math.round(tasks.completionRate * 100)}%`,
        planningDescription,
        "计划至少 5 项，按周复盘定义的计划内完成率低于 40%。",
        ["task.date/status/completedAt"],
        week,
        [
          `自然周：${span(week)}`,
          `计划 ${tasks.planned} 项；计划内完成 ${tasks.plannedDone} 项`,
        ],
        { ...tasks },
        "查看周复盘",
        `review?view=weekly&week=${week.start}`,
      ),
    );
  if (tasks.top >= t.top && tasks.topDone / tasks.top < t.completionRate)
    out.push(
      make(
        "top-completion",
        "planning",
        31,
        `${ongoing ? "本周" : "所选周"}重点任务完成 ${tasks.topDone} / ${tasks.top} 项`,
        planningDescription,
        "计划中的 Top 3 至少 3 项，计划内完成比例低于 40%；与计划完成率提示只展示一条。",
        ["task.date/top/status/completedAt"],
        week,
        [
          `自然周：${span(week)}`,
          `重点 ${tasks.top} 项；计划内完成 ${tasks.topDone} 项`,
        ],
        { top: tasks.top, topDone: tasks.topDone },
        "查看周复盘",
        `review?view=weekly&week=${week.start}`,
      ),
    );

  const sleep = reader.getAverage(
      "sleep.duration",
      w.current.start,
      w.current.end,
    ),
    previousSleep = reader.getAverage(
      "sleep.duration",
      w.previous.start,
      w.previous.end,
    );
  const sleepDiff =
    sleep.value !== null && previousSleep.value !== null
      ? sleep.value - previousSleep.value
      : null;
  if (
    sleep.recordedDays >= t.sleepDays &&
    previousSleep.recordedDays >= t.sleepDays &&
    Number.isFinite(sleep.value) &&
    Number.isFinite(previousSleep.value) &&
    Math.abs(sleepDiff) >= t.sleepDifference
  )
    out.push(
      make(
        "sleep-change",
        "sleep",
        40,
        `最近 7 天平均睡眠比前 7 天${sleepDiff < 0 ? "少" : "多"} ${amount(Math.abs(sleepDiff))} 分钟`,
        `当前日均 ${amount(sleep.value)} 分钟，记录 ${sleep.recordedDays}/7 天；前期日均 ${amount(previousSleep.value)} 分钟，记录 ${previousSleep.recordedDays}/7 天。`,
        "两期各至少有 3 个有效记录日，已记录日均睡眠相差至少 45 分钟。",
        ["sleep.minutes/date"],
        w.current,
        [`本期：${span(w.current)}`, `前期：${span(w.previous)}`],
        {
          current: sleep,
          previous: previousSleep,
          previousWindow: w.previous,
          differenceMinutes: sleepDiff,
        },
        "查看睡眠记录",
        "sleep",
      ),
    );
  if (sleep.recordedDays <= t.sleepCoverage)
    out.push(
      make(
        "sleep-coverage",
        "sleep",
        41,
        `最近 7 天只记录了 ${sleep.recordedDays} 天睡眠，趋势判断依据较少`,
        "未记录日期不按零睡眠计算，也不据此判断作息。",
        "最近 7 天有效睡眠记录日数不超过 2 天。",
        ["sleep.minutes/date"],
        w.current,
        [`范围：${span(w.current)}`, `有效记录 ${sleep.recordedDays}/7 天`],
        { recordedDays: sleep.recordedDays },
        "查看睡眠记录",
        "sleep",
      ),
    );

  const workout = sumRange(reader, "workout.minutes", w.fourteen);
  if (workout.value === null || workout.value === 0)
    out.push(
      make(
        "workout-low-record",
        "workout",
        51,
        workout.value === null
          ? "最近 14 天没有记录到有效运动时长"
          : "最近 14 天已录运动时长合计 0 分钟",
        "这描述的是当前训练记录，不代表实际没有运动。",
        "14 天没有有效时长记录，或已有有效记录的分钟合计明确为零。",
        ["workout.minutes/date"],
        w.fourteen,
        [`范围：${span(w.fourteen)}`, `有效记录 ${workout.recordedDays}/14 天`],
        { ...workout },
        "查看训练记录",
        "fitness",
      ),
    );
  for (const [id, name, route, sources] of [
    ["study.minutes", "专业课学习", "courses", ["study.minutes/date"]],
    [
      "english.minutes",
      "英语学习",
      "english",
      ["episode.minutes/date", "reading.minutes/date"],
    ],
  ]) {
    const current = reader.getWeeklyTotal(id, w.current.start),
      previous = reader.getWeeklyTotal(id, w.previous.start);
    if (
      current.recordedDays < t.trendDays ||
      previous.recordedDays < t.trendDays ||
      !Number.isFinite(current.value) ||
      !Number.isFinite(previous.value) ||
      previous.value <= 0
    )
      continue;
    const difference = current.value - previous.value,
      change = Math.abs(difference) / previous.value;
    if (
      change < t.relativeChange ||
      Math.abs(difference) < t.learningDifference
    )
      continue;
    out.push({
      ...make(
        "learning-change",
        "learning",
        50,
        `最近 7 天${name}记录从 ${amount(previous.value)} 分钟${difference < 0 ? "降到" : "增加到"} ${amount(current.value)} 分钟`,
        `两期记录 ${current.recordedDays}/7、${previous.recordedDays}/7 天；仅比较已录总量，未记录不补零。`,
        "两期各至少记录 3 天，前期总量大于零，变化至少 50% 且相差至少 30 分钟；学习类只展示变化比例最大的一项。",
        sources,
        w.current,
        [`本期：${span(w.current)}`, `前期：${span(w.previous)}`],
        {
          trackerId: id,
          current,
          previous,
          previousWindow: w.previous,
          relativeChange: difference / previous.value,
        },
        "查看学习记录",
        route,
        id,
      ),
      changeMagnitude: change,
    });
  }

  const income = reader.getWeeklyTotal("income.amount", w.current.start),
    previousIncome = reader.getWeeklyTotal("income.amount", w.previous.start);
  if (
    income.recordedDays >= t.trendDays &&
    previousIncome.recordedDays >= t.trendDays &&
    Number.isSafeInteger(income.value) &&
    Number.isSafeInteger(previousIncome.value) &&
    previousIncome.value > 0 &&
    Math.abs(income.value - previousIncome.value) >= t.incomeDifference &&
    Math.abs(income.value - previousIncome.value) / previousIncome.value >=
      t.relativeChange
  )
    out.push(
      make(
        "income-change",
        "income",
        60,
        `最近 7 天已录公众号收入 ${money(income.value)}，比前 7 天的 ${money(previousIncome.value)}${income.value < previousIncome.value ? "减少" : "增加"}`,
        `两期已录 ${income.recordedDays}/7、${previousIncome.recordedDays}/7 天，不代表所有账号和日期均已填齐。`,
        "两期各至少记录 3 天，前期大于零；已录金额变化至少 50%，且相差至少 ¥100。",
        ["income.cents/date"],
        w.current,
        [`本期：${span(w.current)}`, `前期：${span(w.previous)}`],
        {
          current: income,
          previous: previousIncome,
          previousWindow: w.previous,
        },
        "查看收入记录",
        "income",
      ),
    );

  const monthly = sumRange(reader, "income.amount", w.thirty);
  if (
    monthly.recordedDays >= t.concentrationDays &&
    monthly.value >= t.concentrationTotal &&
    Number.isSafeInteger(monthly.value)
  ) {
    const accounts = new Map(
      rows
        .filter((r) => r.kind === "account" && String(r.name || "").trim())
        .map((r) => [r.id, r]),
    );
    const incomeRows = new Map(
      rows.filter((r) => r.kind === "income").map((r) => [r.id, r]),
    );
    const entries = adaptRecords(rows).filter(
      (e) =>
        e.trackerId === "income.amount" &&
        e.date >= w.thirty.start &&
        e.date <= w.thirty.end &&
        e.value > 0,
    );
    // Unknown positive sources prevent a reliable account-level concentration claim.
    if (
      entries.every((e) => accounts.has(incomeRows.get(e.sourceId)?.accountId))
    ) {
      const byAccount = new Map();
      for (const entry of entries) {
        const accountId = incomeRows.get(entry.sourceId).accountId;
        byAccount.set(accountId, (byAccount.get(accountId) || 0) + entry.value);
      }
      const leading = [...byAccount].sort(
        (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "en"),
      )[0];
      if (leading && leading[1] / monthly.value >= t.concentrationShare)
        out.push(
          make(
            "income-concentration",
            "income",
            61,
            `最近 30 天已录收入中，${amount((leading[1] / monthly.value) * 100)}% 来自「${accounts.get(leading[0]).name}」`,
            `已录总额 ${money(monthly.value)}，覆盖 ${monthly.recordedDays}/30 天；按账号区分，不包含销售成交收入。`,
            "30 天至少记录 7 天、已录总额至少 ¥100，所有正收入均能关联命名账号，单一账号份额至少 80%。",
            ["income.accountId/cents/date", "account.id/name"],
            w.thirty,
            [
              `范围：${span(w.thirty)}`,
              `该账号 ${money(leading[1])} / 已录合计 ${money(monthly.value)}`,
            ],
            {
              ...monthly,
              accountId: leading[0],
              sourceAmount: leading[1],
              share: leading[1] / monthly.value,
            },
            "查看账号收入",
            "income",
          ),
        );
    }
  }
  return out;
}
