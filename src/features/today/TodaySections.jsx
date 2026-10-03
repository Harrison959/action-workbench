import React, { useState } from "react";
import { Button, Link, useApp } from "../../ui";
import { TaskRow, taskEditor } from "../tasks/TaskComponents";
import { openTaskFocus } from "../tasks/focus";
import { projectPath } from "../projects/model";
import { eventEditor } from "../../pages/CorePages";

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
    <section className="today-next" aria-labelledby="next-heading">
      <h2 id="next-heading">现在做什么</h2>
      {action ? (
        <>
          <p className="today-reason">{action.reason}</p>
          <button
            className="today-action-title"
            onClick={() => taskEditor(app, action.task)}
          >
            {action.task.title}
          </button>
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
            <span>预计 {action.task.minutes || 25} 分钟</span>
            {action.task.priority && <span>优先级 {action.task.priority}</span>}
            {action.task.dueDate && <span>截止 {action.task.dueDate}</span>}
          </div>
          <Button icon="Play" disabled={busy} onClick={start}>
            开始专注
          </Button>
        </>
      ) : (
        <>
          <p className="today-empty">
            暂无适合现在执行的任务。选定一个具体行动，再开始。
          </p>
          <div className="today-empty-actions">
            <Button small onClick={() => taskEditor(app)}>
              创建任务
            </Button>
            <Link to="tasks">选择已有任务 →</Link>
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
        <h2 id="top-heading">今日重点 · 最多三件</h2>
        <Link to="plan">安排重点</Link>
      </div>
      {tasks.length ? (
        tasks.map((task, index) => (
          <TaskRow
            key={task.id}
            task={task}
            number={index + 1}
            variant="today"
          />
        ))
      ) : (
        <p className="today-empty">
          还没有今日重点。到晚间计划选定最多三件事。
        </p>
      )}
      {overflow && (
        <p className="today-empty">
          已有超过三个重点，这里仅展示前三个；可在晚间计划调整。
        </p>
      )}
      <Link className="today-all-tasks" to="tasks">
        查看全部任务 →
      </Link>
    </section>
  );
}
export function TodayTimeline({ items }) {
  const app = useApp();
  return (
    <section className="today-section" aria-labelledby="timeline-heading">
      <div className="today-section-head">
        <h2 id="timeline-heading">今日时间线</h2>
        <Link to="calendar">查看日程</Link>
      </div>
      {items.length ? (
        <ol className="today-timeline">
          {items.map(({ event, time }) => (
            <li key={event.id}>
              <time dateTime={event.start}>{time}</time>
              <button onClick={() => eventEditor(app, event)}>
                {event.title}
              </button>
              <span>{event.fixed ? "固定" : "可调整"}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="today-empty">今天没有有明确时间的日程。</p>
      )}
    </section>
  );
}
export function TodayProgress({ tasks }) {
  const done = tasks.filter((task) => task.status === "done").length;
  return (
    <footer className="today-progress">
      <span>
        今日完成{" "}
        <strong>
          {done} / {tasks.length}
        </strong>
      </span>
      <Link to="review">写每日小结 →</Link>
    </footer>
  );
}
