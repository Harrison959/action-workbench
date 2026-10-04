import React from "react";
import { Icon, Link } from "../../ui";
import "./insights.css";

const SOURCE_NAMES = {
  project: "项目记录",
  task: "任务记录",
  projectNote: "新增项目笔记",
  weeklyReview: "已保存周复盘",
  sleep: "睡眠记录",
  workout: "训练记录",
  study: "专业课复习记录",
  episode: "剧集观看时长",
  reading: "英文阅读时长",
  income: "公众号收入记录",
  account: "账号资料",
};

export function InsightList({ items }) {
  if (!items.length)
    return (
      <p className="insight-empty">
        当前没有满足规则和样本要求的提示。可在数据页补充日常记录。
      </p>
    );
  return (
    <ul className="insight-list">
      {items.map((item) => (
        <li
          key={item.id}
          data-insight={item.type}
          data-severity={item.severity}
        >
          <span className="insight-symbol" aria-hidden="true">
            <Icon
              name={
                item.actionRoute.startsWith("projects")
                  ? "FolderKanban"
                  : item.actionRoute === "sleep"
                    ? "Moon"
                    : item.actionRoute === "income"
                      ? "Wallet"
                      : item.actionRoute === "fitness"
                        ? "Dumbbell"
                        : item.actionRoute.startsWith("review")
                          ? "NotebookPen"
                          : "ChartNoAxesCombined"
              }
            />
          </span>
          <h3>{item.title}</h3>
          <p>{item.description}</p>
          {item.evidence.window?.start && (
            <p className="insight-sample">
              {item.evidence.window.start} — {item.evidence.window.end}
              {item.evidence.recordedDays !== undefined
                ? " · 有效记录 " + item.evidence.recordedDays + " 天"
                : ""}
            </p>
          )}
          <Link className="text-link" to={item.actionRoute}>
            {item.actionLabel} →
          </Link>
          <details>
            <summary>规则与依据</summary>
            <p>{item.evidence.rule}</p>
            <p>
              数据来源：
              {[
                ...new Set(
                  item.evidence.sources.map((source) => source.split(".")[0]),
                ),
              ]
                .map((kind) => SOURCE_NAMES[kind])
                .join("、")}
            </p>
            {item.evidence.details.map((text, i) => (
              <p key={i}>{text}</p>
            ))}
          </details>
        </li>
      ))}
    </ul>
  );
}
