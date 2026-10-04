import React, { useMemo } from "react";
import { Icon, Link, useApp } from "../../ui";
import { createTrackerReader } from "../trackers/selectors";
import { TRACKERS } from "../trackers/definitions";
import { displayMetric } from "../trackers/display";

export function TodaySignals({ date }) {
  const app = useApp();
  const reader = useMemo(() => createTrackerReader(app.rows), [app.rows]);
  return (
    <div className="today-signals" aria-label="今日记录摘要">
      {[
        ["income.amount", "公众号收入", "Newspaper", "income"],
        ["sleep.duration", "睡眠记录", "Moon", "sleep"],
      ].map(([id, name, icon, route]) => {
        const metric = reader.getDailyValue(id, date);
        return (
          <Link key={id} to={route} className="today-signal">
            <span className="signal-label">
              <Icon name={icon} size={18} />
              {name}
            </span>
            <strong>
              {metric.missing
                ? "未记录"
                : displayMetric(
                    TRACKERS.find((d) => d.id === id),
                    metric.value,
                  )}
            </strong>
            <span className="signal-action">
              {metric.missing ? "去记录" : "查看记录"}
              <Icon name="ChevronRight" size={15} />
            </span>
          </Link>
        );
      })}
    </div>
  );
}
