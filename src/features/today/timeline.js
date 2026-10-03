import { day } from "../../domain.js";
const timeFormat = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
export function todayTimeline(events, date) {
  return events
    .flatMap((event) => {
      if (
        event.deleted ||
        event.status === "cancelled" ||
        typeof event.start !== "string" ||
        !/T\d{2}:\d{2}/.test(event.start)
      )
        return [];
      const value = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(event.start)
        ? event.start
        : event.start + "+08:00";
      const start = new Date(value);
      if (!Number.isFinite(start.getTime()) || day(start) !== date) return [];
      return [
        { event, timestamp: start.getTime(), time: timeFormat.format(start) },
      ];
    })
    .sort(
      (a, b) =>
        a.timestamp - b.timestamp ||
        String(a.event.id).localeCompare(String(b.event.id), "en"),
    );
}
