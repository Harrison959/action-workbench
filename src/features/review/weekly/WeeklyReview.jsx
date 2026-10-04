import React, { useEffect, useMemo, useState } from "react";
import { useApp, Button, PageHead } from "../../../ui";
import { today, addDays } from "../../../domain.js";
import { validDate } from "../../trackers/metrics.js";
import { weekRange, weeklySummary } from "./selectors.js";
import { reviewId, weeklyReviewPayload } from "./model.js";
import { WeeklySections } from "./sections.jsx";
import { insightReport } from "../../insights/selectors.js";
import { InsightList } from "../../insights/InsightList.jsx";
import "./weekly.css";

function Reflection({ week, record, projects, app }) {
  const [values, setValues] = useState(() => ({
    ...record,
    priorityProjectIds: record?.priorityProjectIds || [],
  }));
  const [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (!dirty)
      setValues({
        ...record,
        priorityProjectIds: record?.priorityProjectIds || [],
      });
  }, [record, dirty]);
  const selected = values.priorityProjectIds || [];
  const missing = selected.filter((id) => !projects.some((p) => p.id === id));
  const eligible = projects.filter(
    (p) => ["active", "paused"].includes(p.status) || selected.includes(p.id),
  );
  const update = (key, value) => {
    setDirty(true);
    setValues((v) => ({ ...v, [key]: value }));
    setError("");
  };
  return (
    <section className="weekly-section">
      <h2>人工复盘与下周重点</h2>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await app.save(
              "weeklyReview",
              weeklyReviewPayload(values, record, week),
              record?.id || reviewId(week),
            );
            setDirty(false);
            app.notify("周复盘与下周重点已保存");
          } catch (err) {
            setError(err.message || "保存失败，内容仍保留");
          } finally {
            setBusy(false);
          }
        }}
      >
        {[
          ["progress", "本周最重要的推进是什么？"],
          ["blocker", "本周最大阻碍是什么？"],
          ["stop", "哪件事应该停止 / 减少？"],
          ["nextMain", "下周最重要的一件事是什么？"],
        ].map(([key, label]) => (
          <label className="field wide" key={key}>
            <span>{label}</span>
            <textarea
              aria-label={label}
              required={key === "nextMain"}
              maxLength={10000}
              value={values[key] || ""}
              rows={2}
              onChange={(e) => update(key, e.target.value)}
            />
          </label>
        ))}
        <fieldset className="weekly-priorities">
          <legend>下周重点项目／结果（最多 3 个项目）</legend>
          <p className="weekly-note">
            上面的“最重要的一件事”作为重点结果保存；也可选择 1–3
            个现有项目。仅保存确认，不创建任务或修改项目。
          </p>
          {eligible.map((p) => (
            <label key={p.id}>
              <input
                type="checkbox"
                checked={selected.includes(p.id)}
                disabled={
                  busy || (!selected.includes(p.id) && selected.length >= 3)
                }
                onChange={(e) =>
                  update(
                    "priorityProjectIds",
                    e.target.checked
                      ? [...selected, p.id]
                      : selected.filter((id) => id !== p.id),
                  )
                }
              />
              <span>
                {p.title}
                {p.outcome && <small>结果：{p.outcome}</small>}
              </span>
            </label>
          ))}
          {missing.map((id) => (
            <label key={id}>
              <input
                type="checkbox"
                checked
                disabled={busy}
                onChange={() =>
                  update(
                    "priorityProjectIds",
                    selected.filter((value) => value !== id),
                  )
                }
              />
              <span>原重点项目待同步或在回收站</span>
            </label>
          ))}
          {!eligible.length && !missing.length && (
            <p>暂无可选择的项目，仍可保存上面的重点结果。</p>
          )}
        </fieldset>
        {error && <p role="alert">{error}</p>}
        <Button type="submit" disabled={busy}>
          {busy ? "保存中…" : "保存周复盘与下周重点"}
        </Button>
        {dirty && <span className="weekly-unsaved">有未保存内容</span>}
      </form>
    </section>
  );
}
export function WeeklyReview() {
  const app = useApp(),
    query = app.route.query.get("week");
  const [currentDate, setCurrentDate] = useState(today);
  useEffect(() => {
    const update = () => setCurrentDate(today()),
      timer = setInterval(update, 30000);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  const selected = validDate(query) ? query : currentDate;
  const summary = useMemo(
    () => weeklySummary(app.rows, selected, currentDate),
    [app.rows, selected, currentDate],
  );
  const { start, end } = summary.range;
  const insights = useMemo(
    () =>
      insightReport(app.rows, {
        asOf: currentDate,
        weekDate: selected,
        limit: 3,
        summary,
      }),
    [app.rows, app.owner, selected, currentDate, summary],
  );
  const record =
    app.list("weeklyReview").find((r) => r.id === reviewId(start)) ||
    app.list("weeklyReview").find((r) => r.weekStart === start);
  const changeWeek = (date) => {
    location.hash = "review?view=weekly&week=" + weekRange(date).start;
  };
  return (
    <div className="weekly-review">
      <PageHead
        title="每周复盘"
        description="事实来自已有记录，下一步由你确认。"
      />
      <div className="weekly-toolbar">
        <Button secondary small onClick={() => changeWeek(currentDate)}>
          本周
        </Button>
        <Button
          secondary
          small
          onClick={() => changeWeek(addDays(currentDate, -7))}
        >
          上周
        </Button>
        <label>
          历史周内任一天{" "}
          <input
            type="date"
            aria-label="历史周内任一天"
            value={start}
            max={currentDate}
            onChange={(e) => {
              if (validDate(e.target.value)) changeWeek(e.target.value);
            }}
          />
        </label>
      </div>
      <p className="weekly-range" data-testid="week-range">
        {start.replaceAll("-", "/")} — {end.replaceAll("-", "/")}
      </p>
      <p className="weekly-note">
        周一 00:00 至周日 23:59，统一使用北京时间。
        {currentDate >= start &&
          currentDate <= end &&
          "本周尚未结束，统计会随记录更新。"}
      </p>
      <WeeklySections summary={summary} />
      <section className="weekly-insights" aria-label="值得注意">
        <h2>值得注意</h2>
        <p className="insight-reference">
          以 {insights.reference}{" "}
          为参考日回看记录，趋势对比包含此前周期；最多展示三条。
        </p>
        <InsightList items={insights.items} />
      </section>
      <Reflection
        key={app.owner + ":" + start}
        week={start}
        record={record}
        projects={app.list("project")}
        app={app}
      />
    </div>
  );
}
