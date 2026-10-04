import { addDays, today } from "../../domain.js";
import { createTrackerReader } from "../trackers/selectors.js";
import { validDate } from "../trackers/metrics.js";
import { weekRange, weeklySummary } from "../review/weekly/selectors.js";
import { evaluateRules } from "./rules.js";

const GROUP_LIMIT = { project: 2 };
export function selectInsights(candidates, limit = 5) {
  const cap = Number.isFinite(limit)
    ? Math.min(5, Math.max(0, Math.floor(limit)))
    : 5;
  const counts = new Map(),
    ids = new Set(),
    result = [];
  for (const item of [...candidates].sort(
    (a, b) =>
      a.priority - b.priority ||
      (b.changeMagnitude || 0) - (a.changeMagnitude || 0) ||
      a.id.localeCompare(b.id, "en"),
  )) {
    if (result.length >= cap) break;
    if (
      ids.has(item.id) ||
      (counts.get(item.group) || 0) >= (GROUP_LIMIT[item.group] || 1)
    )
      continue;
    ids.add(item.id);
    counts.set(item.group, (counts.get(item.group) || 0) + 1);
    const { priority, group, changeMagnitude, ...insight } = item;
    result.push(insight);
  }
  return result;
}

// All results are ephemeral, scope-local reads. No persistence or model calls.
export function insightReport(
  rows,
  { asOf = today(), weekDate = asOf, limit = 5, summary } = {},
) {
  if (!validDate(asOf) || !validDate(weekDate)) throw new Error("无效洞察日期");
  const week = weekRange(weekDate);
  const reference = week.end < asOf ? week.end : asOf;
  const windows = {
    current: { start: addDays(reference, -6), end: reference },
    previous: { start: addDays(reference, -13), end: addDays(reference, -7) },
    fourteen: { start: addDays(reference, -13), end: reference },
    thirty: { start: addDays(reference, -29), end: reference },
  };
  if (week.start > asOf) return { items: [], reference, week, windows };
  const live = rows.filter((r) => !r.deleted);
  const weekly =
    summary?.range?.start === week.start && summary?.range?.end === week.end
      ? summary
      : weeklySummary(live, weekDate, asOf);
  const context = {
    rows: live,
    reader: createTrackerReader(live),
    weekly,
    week,
    asOf,
    reference,
    windows,
  };
  return {
    items: selectInsights(evaluateRules(context), limit),
    reference,
    week,
    windows,
  };
}
