import React from "react";

// An alternate date picker over the existing Calendar selection; no event mutation.
export function CalendarMonth({ date, onSelect, events }) {
  const [year, month] = date.split("-").map(Number);
  const first = new Date(Date.UTC(year, month - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const prefix = date.slice(0, 7);
  const eventDates = new Set(
    events
      .filter(
        (e) =>
          !e.deleted &&
          typeof e.start === "string" &&
          Number.isFinite(Date.parse(e.start)),
      )
      .map((e) => e.start.slice(0, 10)),
  );
  return (
    <section className="calendar-month" aria-label="月历日期选择">
      <h2>
        {year} 年 {month} 月
      </h2>
      <div className="calendar-weekdays" aria-hidden="true">
        {"一二三四五六日".split("").map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="calendar-days">
        {Array.from({ length: offset }, (_, i) => (
          <span key={"gap" + i} />
        ))}
        {Array.from({ length: count }, (_, i) => {
          const value = prefix + "-" + String(i + 1).padStart(2, "0");
          return (
            <button
              key={value}
              type="button"
              aria-label={value + (eventDates.has(value) ? " 有日程" : "")}
              aria-pressed={date === value}
              onClick={() => onSelect(value)}
            >
              <span>{i + 1}</span>
              {eventDates.has(value) && <i aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    </section>
  );
}
