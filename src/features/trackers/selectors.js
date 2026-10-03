import { addDays } from "../../domain.js";
import { getTracker } from "./definitions.js";
import { adaptRecords } from "./adapters/index.js";
import { aggregate, validDate } from "./metrics.js";

// A read-only snapshot. Recreate when app.rows changes; never cache across owners.
export function createTrackerReader(rows) {
  const entries = adaptRecords(rows);
  function getDailyValue(trackerId, date) {
    if (!validDate(date)) throw new Error("无效日期");
    const definition = getTracker(trackerId);
    const daily = entries.filter(
      (e) => e.trackerId === trackerId && e.date === date,
    );
    return { trackerId, date, ...aggregate(daily, definition.aggregation) };
  }
  function getRangeValues(id, start, end) {
    getTracker(id);
    if (!validDate(start) || !validDate(end) || start > end)
      throw new Error("无效日期范围");
    const values = [];
    for (let date = start; date <= end; date = addDays(date, 1)) {
      if (values.length >= 36600) throw new Error("日期范围过大");
      values.push(getDailyValue(id, date));
    }
    return values;
  }
  function getAverage(id, start, end) {
    const days = getRangeValues(id, start, end),
      recorded = days.filter((d) => !d.missing);
    return {
      value: recorded.length
        ? recorded.reduce((sum, d) => sum + d.value, 0) / recorded.length
        : null,
      recordedDays: recorded.length,
      totalDays: days.length,
    };
  }
  function getRecordedDayCount(id, start, end) {
    return getAverage(id, start, end).recordedDays;
  }
  function getWeeklyTotal(id, start) {
    const def = getTracker(id);
    if (!["duration", "money"].includes(def.type))
      throw new Error("此指标不适合计算周总量");
    const end = addDays(start, 6),
      average = getAverage(id, start, end);
    return {
      value: average.recordedDays
        ? getRangeValues(id, start, end).reduce(
            (sum, d) => sum + (d.value ?? 0),
            0,
          )
        : null,
      recordedDays: average.recordedDays,
      totalDays: 7,
      start,
      end,
    };
  }
  return {
    getDailyValue,
    getRangeValues,
    getWeeklyTotal,
    getAverage,
    getRecordedDayCount,
  };
}
