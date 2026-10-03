import { TRACKERS } from "../definitions.js";
import { validDate, numeric } from "../metrics.js";

const sources = {
  "sleep.duration": [["sleep", "minutes"]],
  "workout.minutes": [["workout", "minutes"]],
  "study.minutes": [["study", "minutes"]],
  "english.minutes": [
    ["episode", "minutes"],
    ["reading", "minutes"],
  ],
  "guitar.minutes": [["guitar", "minutes"]],
  "emotion.intensity": [["emotion", "intensity"]],
  "income.amount": [["income", "cents"]],
  ...Object.fromEntries(
    ["weight", "height", "waist", "arm", "shoulder"].map((key) => [
      "body." + key,
      [["body", key]],
    ]),
  ),
};
function observedTime(row) {
  const value =
    row.kind === "sleep"
      ? row.wake
      : row.kind === "emotion" && /^\d{2}:\d{2}(:\d{2})?$/.test(row.time || "")
        ? row.date + "T" + row.time
        : null;
  if (!value || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value))
    return null;
  const [date, time] = value.split("T");
  if (
    !validDate(date) ||
    Number(time.slice(0, 2)) > 23 ||
    Number(time.slice(3, 5)) > 59 ||
    Number(time.slice(6, 8) || 0) > 59
  )
    return null;
  return value + "+08:00";
}
// Accept app.records() values, already isolated to the current scope. No persistence imports.
export function adaptRecords(rows) {
  const entries = [];
  for (const definition of TRACKERS) {
    for (const row of rows) {
      if (
        !row ||
        row.deleted ||
        typeof row.id !== "string" ||
        !validDate(row.date)
      )
        continue;
      const source = sources[definition.sourceKey].find(
        ([kind]) => row.kind === kind,
      );
      if (!source) continue;
      const value = numeric(row[source[1]]);
      if (
        value === null ||
        value < 0 ||
        (definition.type === "money" && !Number.isSafeInteger(value)) ||
        (definition.type === "score" &&
          (!Number.isInteger(value) ||
            value < definition.min ||
            value > definition.max))
      )
        continue;
      entries.push({
        trackerId: definition.id,
        date: row.date,
        value,
        observedAt: observedTime(row),
        note: typeof row.note === "string" ? row.note : "",
        label:
          row.kind === "emotion" && typeof row.mood === "string"
            ? row.mood
            : "",
        sourceKind: row.kind,
        sourceId: row.id,
      });
    }
  }
  return entries;
}
