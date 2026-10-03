import { addDays, day, today } from "../../../domain.js";
import { createTrackerReader } from "../../trackers/selectors.js";
import { numeric, validDate } from "../../trackers/metrics.js";
import { projectProgress } from "../../projects/model.js";

export function weekRange(date = today()) {
  if (!validDate(date)) throw new Error("无效周日期");
  const weekday = new Date(date + "T12:00:00+08:00").getUTCDay();
  const start = addDays(date, -(weekday + 6) % 7);
  return { start, end: addDays(start, 6) };
}
export function timestampDate(value) {
  if (validDate(value)) return value;
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T/.test(value) ||
    !validDate(value.slice(0, 10))
  )
    return null;
  const withZone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(value)
    ? value
    : value + "+08:00";
  const stamp = Date.parse(withZone);
  return Number.isFinite(stamp) ? day(new Date(stamp)) : null;
}
export function weeklySummary(rows, selectedDate, asOf = today()) {
  const range = weekRange(selectedDate),
    { start, end } = range;
  const live = rows.filter((r) => !r.deleted);
  const inRange = (date) => validDate(date) && date >= start && date <= end;
  const tasks = live.filter(
    (r) => r.kind === "task" && r.status !== "cancelled",
  );
  const planned = tasks.filter((t) => inRange(t.date));
  const completed = tasks.filter(
    (t) => t.status === "done" && inRange(timestampDate(t.completedAt)),
  );
  const completedIds = new Set(completed.map((t) => t.id));
  const plannedDone = planned.filter((t) => completedIds.has(t.id));
  const top = planned.filter((t) => t.top);
  const taskStats = {
    planned: planned.length,
    completed: completed.length,
    plannedDone: plannedDone.length,
    completionRate: planned.length ? plannedDone.length / planned.length : null,
    top: top.length,
    topDone: top.filter((t) => completedIds.has(t.id)).length,
    undatedDone: planned.filter(
      (t) => t.status === "done" && !timestampDate(t.completedAt),
    ).length,
    crossWeekDone: completed.filter((t) => !inRange(t.date)).length,
  };
  const reader = createTrackerReader(live);
  const durations = Object.fromEntries(
    [
      "study.minutes",
      "english.minutes",
      "workout.minutes",
      "guitar.minutes",
    ].map((id) => [id, reader.getWeeklyTotal(id, start)]),
  );
  const sleep = reader.getAverage("sleep.duration", start, end);
  const weights = reader
    .getRangeValues("body.weight", start, end)
    .filter((d) => !d.missing);
  const firstWeight = weights[0] || null,
    latestWeight = weights.at(-1) || null;
  const weight = {
    first: firstWeight,
    latest: latestWeight,
    recordedDays: weights.length,
    change:
      weights.length >= 2 &&
      !firstWeight.uncertainOrder &&
      !latestWeight.uncertainOrder
        ? latestWeight.value - firstWeight.value
        : null,
  };
  const emotions = reader
    .getRangeValues("emotion.intensity", start, end)
    .filter((d) => !d.missing);
  const emotion = {
    recordedDays: emotions.length,
    entries: emotions.reduce((n, d) => n + d.entryCount, 0),
    latest: emotions.at(-1) || null,
  };
  const income = reader.getWeeklyTotal("income.amount", start);
  const deals = live.filter((r) => r.kind === "deal" && inRange(r.date));
  const amounts = deals
    .map((d) => numeric(d.cents))
    .filter((v) => v !== null && Number.isSafeInteger(v) && v >= 0);
  const sales = {
    newClients: live.filter((r) => r.kind === "client" && inRange(r.added))
      .length,
    followups: completed.filter((t) => t.clientId).length,
    deals: new Set(deals.filter((d) => d.clientId).map((d) => d.clientId)).size,
    dealRecords: deals.length,
    income: amounts.length ? amounts.reduce((n, v) => n + v, 0) : null,
    missingAmountRecords: deals.length - amounts.length,
  };
  const actual = completed
    .map((t) => numeric(t.actualMinutes))
    .filter((v) => v !== null && v >= 0);
  const focus = {
    total: null,
    completedTaskMinutes: actual.length
      ? actual.reduce((n, v) => n + v, 0)
      : null,
    recordedTasks: actual.length,
  };
  const reference = end < asOf ? end : asOf;
  const recentStart = addDays(reference, -6);
  const projects = live
    .filter((r) => r.kind === "project")
    .map((p) => {
      const linked = completed.filter((t) => t.projectId === p.id);
      const notes = live.filter(
        (n) =>
          n.kind === "projectNote" &&
          n.projectId === p.id &&
          inRange(timestampDate(n.createdAt)),
      );
      const completionDate = timestampDate(p.completedAt);
      const completedStatus =
        ["completed", "archived"].includes(p.status) && inRange(completionDate);
      const activityDates = [
        ...tasks
          .filter((t) => t.projectId === p.id && t.status === "done")
          .map((t) => timestampDate(t.completedAt)),
        ...live
          .filter((n) => n.kind === "projectNote" && n.projectId === p.id)
          .map((n) => timestampDate(n.createdAt)),
        ...(["completed", "archived"].includes(p.status)
          ? [completionDate]
          : []),
      ].filter(Boolean);
      const since =
        timestampDate(p.createdAt) ||
        (validDate(p.startDate) ? p.startDate : null);
      const eligible =
        p.status === "active" &&
        (!since || since <= reference) &&
        (!validDate(p.startDate) || p.startDate <= reference);
      const hasActivity =
        linked.length > 0 || notes.length > 0 || completedStatus;
      const explicitNext = tasks.find(
        (t) =>
          t.id === p.nextAction &&
          t.projectId === p.id &&
          (!t.status || t.status === "open"),
      );
      return {
        id: p.id,
        title: p.title || "未命名项目",
        outcome: p.outcome || "",
        status: p.status,
        completedTasks: linked.length,
        newNotes: notes.length,
        completedStatus,
        hasActivity,
        progress: projectProgress(p.id, tasks),
      nextAction: explicitNext ? explicitNext.title || '未命名任务' : null,
        noActivityThisWeek: eligible && !hasActivity,
        noActivitySevenDays:
          eligible &&
          !!since &&
          since <= recentStart &&
          !activityDates.some((d) => d >= recentStart && d <= reference),
        recentStart,
        reference,
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
  const activeProjects = projects.filter((p) => p.hasActivity);
  const inactiveProjects = projects.filter((p) => p.noActivityThisWeek);
  const facts = [
    `计划任务 ${taskStats.planned} 项，计划内本周完成 ${taskStats.plannedDone} 项`,
    `Top 3 本周完成 ${taskStats.topDone} / ${taskStats.top} 项`,
    `睡眠已记录 ${sleep.recordedDays}/7 天`,
    `当前进行中的项目有 ${inactiveProjects.length} 个在所选周未见推进记录`,
    durations["workout.minutes"].value === null
      ? "本周没有有效运动时长记录"
      : `本周已记录运动 ${durations["workout.minutes"].value} 分钟`,
  ];
  return {
    range,
    tasks: taskStats,
    completedTasks: completed,
    projects: activeProjects,
    inactiveProjects,
    activeProjectCount: activeProjects.length,
    focus,
    durations,
    sleep,
    weight,
    emotion,
    income,
    sales,
    facts,
  };
}
