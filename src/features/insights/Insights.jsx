import React, { useEffect, useMemo, useState } from "react";
import { useApp, PageHead, Link } from "../../ui";
import { today } from "../../domain.js";
import { insightReport } from "./selectors.js";
import { InsightList } from "./InsightList.jsx";

export function Insights() {
  const app = useApp(),
    [date, setDate] = useState(today);
  useEffect(() => {
    const update = () => setDate(today()),
      timer = setInterval(update, 30000);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  const report = useMemo(
    () => insightReport(app.rows, { asOf: date }),
    [app.rows, app.owner, date],
  );
  return (
    <div className="insights-page">
      <PageHead
        title="值得注意"
        description="根据已有记录计算，最多展示五条。每条都可查看触发规则与依据。"
      />
      <p className="insight-reference">
        截至 {report.reference} · 北京时间业务日期 · 缺失不按零计算
      </p>
      <InsightList items={report.items} />
      <Link to="more" className="text-link">
        返回更多 →
      </Link>
    </div>
  );
}
