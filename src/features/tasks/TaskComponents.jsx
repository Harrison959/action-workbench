import React, { useState } from "react";
import {
  useApp,
  Icon,
  Link,
  textField as f,
  dateField as d,
  numberField as n,
  noteField as note,
} from "../../ui";
import { STREAMS, today } from "../../domain.js";
import {
  AREAS,
  PROJECT_STATUSES,
  projectPath,
  areaLabel,
} from "../projects/model.js";
import { openTaskFocus } from "./focus.js";
export function taskEditor(app, row = {}) {
  const projects = app.list("project");
  const projectOptions = [
    { value: "", label: "独立任务" },
    ...projects.map((p) => ({
      value: p.id,
      label: p.title + " · " + (PROJECT_STATUSES[p.status] || "进行中"),
    })),
  ];
  if (row.projectId && !projects.some((p) => p.id === row.projectId))
    projectOptions.push({
      value: row.projectId,
      label: "原关联项目（待同步或在回收站）",
    });
  app.edit({
    key: "task:" + (row.id || (row.projectId ? "new:" + row.projectId : "new")),
    title: row.id ? "任务详情" : "把下一步写清楚",
    initial: {
      date: today(),
      priority: "P2",
      stream: "",
      minutes: 25,
      status: "open",
      top: false,
      ...row,
    },
    fields: [
      f("title", "具体做什么", {
        required: true,
        wide: true,
        placeholder: "例如：跟进昨天约好的两位客户",
      }),
      f("projectId", "关联项目", { type: "select", options: projectOptions }),
      f("area", "所属领域", {
        type: "select",
        options: [{ value: "", label: "未分类" }, ...AREAS],
      }),
      d(),
      f("priority", "优先级", {
        type: "select",
        options: [
          { value: "P1", label: "P1 · 必须完成" },
          { value: "P2", label: "P2 · 重要" },
          { value: "P3", label: "P3 · 普通" },
          { value: "P4", label: "P4 · 可选" },
        ],
      }),
      f("stream", "所属主线", {
        type: "select",
        options: [
          { value: "", label: "暂不归类" },
          ...STREAMS.map((s) => ({ value: s.id, label: s.name })),
        ],
      }),
      n("minutes", "预估分钟", { min: 1, max: 600, required: true }),
      f("goalId", "关联目标", {
        type: "select",
        options: [
          { value: "", label: "暂不关联" },
          ...app.list("goal").map((g) => ({ value: g.id, label: g.title })),
        ],
      }),
      f("status", "状态", {
        type: "select",
        options: [
          { value: "open", label: "待完成" },
          { value: "done", label: "已完成" },
          { value: "cancelled", label: "已取消" },
        ],
      }),
      f("top", "放入当天 Top 3", { type: "checkbox" }),
      note("subtasksText", "子任务（每行一项）"),
      note("note", "备注 / 完成结果 / 改期原因"),
    ],
    save: async (v) => {
      if (!v.title?.trim()) throw new Error("请填写任务内容");
      if (
        v.top &&
        !(row.top && row.date === v.date && row.status !== "cancelled") &&
        app
          .list("task")
          .filter(
            (t) =>
              t.date === v.date &&
              t.top &&
              t.id !== row.id &&
              t.status !== "cancelled",
          ).length >= 3
      )
        throw new Error("当天最多选择3项重点，请先调整已有重点");
      await app.save(
        "task",
        {
          ...v,
          title: v.title.trim(),
          minutes: Number(v.minutes),
          completedAt:
            v.status === "done"
              ? row.completedAt || new Date().toISOString()
              : null,
        },
        row.id,
      );
      app.notify("任务已保存");
    },
  });
}
export function TaskRow({
  task,
  number,
  compact = false,
  showProject = true,
  variant,
}) {
  const a = useApp(),
    [busy, setBusy] = useState(false);
  const project = a.list("project").find((p) => p.id === task.projectId);
  const run = async (fn) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      a.notify(e.message || "操作失败，记录仍保留");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div
      className={"task-row " + (task.status === "done" ? "done" : "")}
      data-task-id={task.id}
      data-priority={task.priority || "P2"}
    >
      <button
        className="check"
        disabled={busy || task.status === "cancelled"}
        aria-label={task.status === "done" ? "撤销完成" : "完成任务"}
        aria-pressed={task.status === "done"}
        onClick={() =>
          run(() =>
            a.save(
              "task",
              {
                ...task,
                status: task.status === "done" ? "open" : "done",
                completedAt:
                  task.status === "done" ? null : new Date().toISOString(),
              },
              task.id,
            ),
          )
        }
      >
        {task.status === "done" ? (
          <Icon name="Check" size={16} />
        ) : number && variant !== "today" ? (
          <span>{number}</span>
        ) : null}
      </button>
      <div className="task-row-content">
        <button className="task-text" onClick={() => taskEditor(a, task)}>
          {variant === "today" && (
            <span className="today-task-number">
              {String(number).padStart(2, "0")}
            </span>
          )}
          <strong>{task.title}</strong>
          <span>
            {variant !== "today" && (
              <>
                <i className={"priority " + (task.priority || "P2")}>
                  {task.priority || "P2"}
                </i>
                {task.area
                  ? areaLabel(task.area)
                  : STREAMS.find((s) => s.id === task.stream)?.name || "个人"}
                <b>·</b>
              </>
            )}
            {task.minutes || 25} 分钟
            {variant === "today" && project && (
              <span className="today-inline-project"> · {project.title}</span>
            )}
            {variant === "today" && task.status === "done" && " · 已完成"}
            {task.date && (variant !== "today" || task.date !== today()) && (
              <> · {task.date}</>
            )}
            {variant !== "today" && task.status === "done" && " · 已完成"}
            {task.status === "cancelled" && " · 已取消"}
          </span>
        </button>
        {showProject &&
          task.projectId &&
          (project ? (
            <Link to={projectPath(project.id)} className="task-project">
              {project.title}
            </Link>
          ) : (
            <small className="task-project muted">原项目待同步或在回收站</small>
          ))}
      </div>
      {!compact && (!task.status || task.status === "open") && (
        <button
          className="icon-button"
          disabled={busy}
          aria-label="开始专注"
          onClick={() => run(() => openTaskFocus(a, task))}
        >
          <Icon name="Play" size={17} />
        </button>
      )}
    </div>
  );
}
