import React, { useEffect, useMemo, useState } from "react";
import { useApp, PageHead, Link } from "../../ui";
import { today, addDays } from "../../domain";
import { TRACKERS } from "./definitions";
import { createTrackerReader } from "./selectors";
import { formatMetric } from "./metrics";
import { recordMetric } from "./recording";
import "./trackers.css";

function MetricRow({ definition: def, reader, date, days, onRecord }) {
  const value = reader.getDailyValue(def.id, date);
  const start = addDays(date, 1 - days);
  const average = reader.getAverage(def.id, start, date);
  return (
    <li className="tracker-row" data-tracker={def.id}>
      <div className="tracker-line">
        <Link
          to={def.route}
          className="tracker-name"
          aria-label={"打开" + def.name + "原始记录"}
        >
          {def.name}
        </Link>
        <strong className="tracker-value">
          {def.type === "money" && !value.missing ? "已录 " : ""}
          {formatMetric(def, value.value)}
        </strong>
        <button
          type="button"
          className="text-link"
          aria-label={"记录" + def.name}
          onClick={() => onRecord(def)}
        >
          + 记录
        </button>
      </div>
      {value.selected?.label && (
        <p className="tracker-context">
          状态：{value.selected.label}；强度不表示好坏
        </p>
      )}
      {value.uncertainOrder && (
        <p className="tracker-context">
          同日多条记录缺少时间，按记录 ID 稳定选取，无法确认实际先后。
        </p>
      )}
      <details className="tracker-details">
        <summary>
          近 {days} 天 · 已记录 {average.recordedDays}/{days} 天
        </summary>
        <p>{def.description}</p>
        <p>
          每日口径：
          {
            {
              sum: "合计",
              mean: "平均",
              latest: "最新记录（缺少时间时按 ID 稳定选取）",
            }[def.aggregation]
          }
        </p>
        {def.type !== "score" && (
          <p>已记录日均：{formatMetric(def, average.value)}</p>
        )}
        <ol className="tracker-history" aria-label={def.name + "每日汇总"}>
          {reader
            .getRangeValues(def.id, start, date)
            .reverse()
            .map((day) => (
              <li key={day.date}>
                <time>{day.date}</time>
                <span>
                  {formatMetric(def, day.value)}
                  {day.selected?.label ? " · " + day.selected.label : ""}
                  {day.uncertainOrder ? "（先后未知）" : ""}
                </span>
              </li>
            ))}
        </ol>
      </details>
    </li>
  );
}
export function Data() {
  const app = useApp(),
    [date, setDate] = useState(today),
    [days, setDays] = useState(7);
  const reader = useMemo(
    () => createTrackerReader(app.rows),
    [app.rows, app.owner],
  );
  useEffect(() => {
    const update = () => setDate(today());
    const timer = setInterval(update, 30000);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  const render = (def) => (
    <MetricRow
      key={def.id}
      definition={def}
      reader={reader}
      date={date}
      days={days}
      onRecord={(definition) => recordMetric(app, definition)}
    />
  );
  return (
    <div className="tracker-data">
      <PageHead
        title="数据"
        description="点击记录补记，点击指标名查看原始详情。未记录不按零计算。"
      />
      <div className="tracker-toolbar">
        <h2>
          今日数据 <small>{date}</small>
        </h2>
        <label>
          汇总范围{" "}
          <select
            aria-label="指标汇总范围"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={7}>7 天</option>
            <option value={30}>30 天</option>
          </select>
        </label>
      </div>
      <ul className="tracker-list">
        {TRACKERS.filter((d) => d.active && d.primary).map(render)}
      </ul>
      <details className="tracker-body">
        <summary>其他身体测量</summary>
        <ul className="tracker-list">
          {TRACKERS.filter((d) => d.active && !d.primary).map(render)}
        </ul>
      </details>
    </div>
  );
}
