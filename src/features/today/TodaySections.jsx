import React, { useState } from "react";
import { Button, Icon, Link, useApp } from "../../ui";
import { TaskRow, taskEditor } from "../tasks/TaskComponents";
import { openTaskFocus } from "../tasks/focus";
import { projectPath } from "../projects/model";
import { eventEditor } from "../calendar/editor";

export function NextAction({ action }) {
  const app = useApp(),
    [busy, setBusy] = useState(false);
  async function start() {
    if (busy) return;
    setBusy(true);
    try {
      await openTaskFocus(app, action.task);
    } catch (e) {
      app.notify(e.message || "无法打开专注，请重试");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className={
        "today-next action-surface" + (!action ? " action-surface-empty" : "")
      }
      aria-labelledby="next-heading"
    >
      <div className="action-surface-head">
        <h2 id="next-heading">现在做什么</h2>
        {action && (
          <span className="action-estimate">
            {action.task.minutes || 25} 分钟
          </span>
        )}
      </div>
      {action ? (
        <>
          <button
            className="today-action-title"
            onClick={() => taskEditor(app, action.task)}
          >
            {action.task.title}
          </button>
          <div className="action-surface-footer">
            <div className="action-context">
              <div className="today-action-meta">
                {action.project ? (
                  <Link to={projectPath(action.project.id)}>
                    {action.project.title}
                  </Link>
                ) : action.task.projectId ? (
                  <span>原项目待同步或在回收站</span>
                ) : (
                  <span>独立任务</span>
                )}
                {action.task.priority && (
                  <span>优先级 {action.task.priority}</span>
                )}
                {action.task.dueDate && <span>截止 {action.task.dueDate}</span>}
              </div>
              <p className="today-reason">{action.reason}</p>
            </div>
            <Button
              className="button action-start"
              icon="Play"
              disabled={busy}
              onClick={start}
            >
              开始专注
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="action-empty-body">
            <p className="today-empty">暂无适合现在执行的任务</p>
            <div className="today-empty-actions">
              <Button small onClick={() => taskEditor(app)}>
                创建任务
              </Button>
              <Link to="tasks">选择已有任务 →</Link>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
export function TopThree({ tasks, overflow }) {
  return (
    <section className="today-section today-top" aria-labelledby="top-heading">
      <div className="today-section-head">
        <h2 id="top-heading">今日重点</h2>
        <Link to="tasks" className="today-all-tasks">
          查看全部任务 →
        </Link>
      </div>
      <ol className="today-slots">
        {Array.from({ length: 3 }, (_, index) =>
          tasks[index] ? (
            <li className="today-slot" key={tasks[index].id}>
              <TaskRow task={tasks[index]} number={index + 1} variant="today" />
            </li>
          ) : (
            <li className="today-slot today-slot-empty" key={"empty-" + index}>
              <Link
                to="plan"
                aria-label={"安排第" + (index + 1) + "个今日重点"}
              >
                <span className="today-slot-number">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span>选择一件重要的事</span>
                <Icon name="Plus" size={16} />
              </Link>
            </li>
          ),
        )}
      </ol>
      {overflow && (
        <p className="today-empty">
          已有超过三个重点，这里仅展示前三个；可在晚间计划调整。
        </p>
      )}
    </section>
  );
}
export function TodayTimeline({ items }) {
  const app = useApp();
  return (
    <section
      className="today-section today-schedule"
      aria-labelledby="timeline-heading"
    >
      <div className="today-section-head">
        <h2 id="timeline-heading">今日时间线</h2>
        <Link to="calendar">查看日程</Link>
      </div>
      {items.length ? (
        <ol className="today-timeline">
          {items.map(({ event, time }) => (
            <li key={event.id}>
              <time dateTime={event.start}>{time}</time>
              <i className="timeline-marker" aria-hidden="true" />
              <button onClick={() => eventEditor(app, event)}>
                {event.title}
              </button>
              <span>{event.fixed ? "固定" : "可调整"}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="today-empty timeline-empty">今天没有固定安排</p>
      )}
    </section>
  );
}
export function TodayProgress({ tasks }) {
  const done = tasks.filter((task) => task.status === "done").length;
  return (
    <div className="today-progress">
      <span>
        {tasks.length ? (
          <>
            今日完成{" "}
            <strong>
              {done} / {tasks.length}
            </strong>
          </>
        ) : (
          "今天尚未安排任务"
        )}
      </span>
      <Link to="review" aria-label="写每日小结">
        <Icon name="NotebookPen" size={17} />
        <span className="progress-review-label">写每日小结 →</span>
      </Link>
    </div>
  );
}
