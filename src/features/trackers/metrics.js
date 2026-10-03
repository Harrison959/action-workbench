import { money } from "../../domain.js";
export function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const stamp = Date.parse(value + "T12:00:00Z");
  return (
    Number.isFinite(stamp) &&
    new Date(stamp).toISOString().slice(0, 10) === value
  );
}
export function numeric(value) {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !/^\d+(\.\d+)?$/.test(value.trim()))
    return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
export function aggregate(entries, method) {
  if (!["sum", "mean", "latest"].includes(method))
    throw new Error("不支持的聚合方式");
  if (!entries.length)
    return {
      value: null,
      missing: true,
      entryCount: 0,
      selected: null,
      uncertainOrder: false,
    };
  // Mixed/missing observation times cannot establish chronology: use stable IDs for ALL entries.
  const uncertainOrder =
    method === "latest" &&
    entries.length > 1 &&
    entries.some((e) => !e.observedAt);
  const sorted = [...entries].sort(
    (a, b) =>
      (!uncertainOrder ? compare(a.observedAt || "", b.observedAt || "") : 0) ||
      compare(a.sourceKind, b.sourceKind) ||
      compare(a.sourceId, b.sourceId),
  );
  const selected = method === "latest" ? sorted.at(-1) : null;
  const total = sorted.reduce((sum, e) => sum + e.value, 0);
  return {
    value: selected
      ? selected.value
      : method === "mean"
        ? total / entries.length
        : total,
    missing: false,
    entryCount: entries.length,
    selected,
    uncertainOrder,
  };
}
export function formatMetric(definition, value) {
  if (value === null || !Number.isFinite(value)) return "未记录";
  const rounded = Number(value.toFixed(2));
  if (definition.type === "money") return money(value);
  if (definition.type === "duration") return rounded + " 分钟";
  if (definition.type === "score") return rounded + " / " + definition.max;
  return rounded + " " + definition.unit;
}
