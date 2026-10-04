import { formatMetric } from "./metrics";

// Display only; values and aggregation remain the existing Reader's minutes.
export function displayMetric(definition, value) {
  if (definition.id === "sleep.duration" && Number.isFinite(value)) {
    const minutes = Math.round(value);
    return `${Math.floor(minutes / 60)}小时${minutes % 60}分`;
  }
  return formatMetric(definition, value);
}
