import React, { useEffect, useState } from "react";
import {
  useApp,
  PageHead,
  Section,
  Empty,
  Link,
  Button,
  Icon,
  Tabs,
  RecordList,
  textField,
} from "../../ui";
import { today } from "../../domain.js";
import { navigate } from "../../navigationHistory";
import { TaskRow, taskEditor } from "../tasks/TaskComponents";
import { openTaskFocus } from "../tasks/focus.js";
import {
  AREAS,
  PROJECT_STATUSES,
  areaLabel,
  projectPath,
  projectTasks,
  projectProgress,
  openProjectTasks,
  nextProjectAction,
  projectStatusChange,
  projectHistory,
} from "./model.js";
import { projectEditor, projectNoteEditor } from "./editor";

export function Projects() {
  const a = useApp();
  return (
    <>
      {a.syncText.includes("云端项目功能待升级") && (
        <p className="project-sync" role="status">
          项目和笔记已保存在本机，云端升级后会自动补传。
          <Link to="settings">前往设置处理 →</Link>
        </p>
      )}
      {a.route.id ? <ProjectDetail id={a.route.id} /> : <ProjectList />}
    </>
  );
}

function Progress({ project, tasks }) {
  const { done, total, percent } = projectProgress(project.id, tasks);
  return (
    <div className="project-progress">
      <progress value={percent} max="100" aria-label="任务完成进度" />
      <span>
        {percent}%{" "}
        <small>
          {done} / {total} 项{total === 0 ? " · 尚无任务" : ""}
        </small>
      </span>
    </div>
  );
}

function ProjectList() {
  const a = useApp(),
    urlStatus = a.route.query.get("status");
  const [status, setStatus] = useState(
      PROJECT_STATUSES[urlStatus] || urlStatus === "all" ? urlStatus : "active",
    ),
    [area, setArea] = useState(""),
    [search, setSearch] = useState("");
  useEffect(
    () =>
      setStatus(
        PROJECT_STATUSES[urlStatus] || urlStatus === "all"
          ? urlStatus
          : "active",
      ),
    [urlStatus],
  );
  const projects = a
    .list("project")
    .filter(
      (p) =>
        (status === "all" || p.status === status) &&
        (!area || p.area === area) &&
        [p.title, p.outcome]
          .join(" ")
          .toLowerCase()
          .includes(search.trim().toLowerCase()),
    )
    .sort(
      (a, b) =>
        (a.dueDate || "9999").localeCompare(b.dueDate || "9999") ||
        (b.createdAt || "").localeCompare(a.createdAt || ""),
    );
  const tasks = a.list("task");
  const changeStatus = (value) => {
    setStatus(value);
    navigate(value === "active" ? "projects" : "projects?status=" + value);
  };
  return (
    <>
      <PageHead
        title="项目"
        description="围绕明确的结果，持续推进下一步。"
        action={
          <Button icon="Plus" onClick={() => projectEditor(a)}>
            新建项目
          </Button>
        }
      />
      <Tabs
        appearance="segmented"
        items={[
          ...Object.entries(PROJECT_STATUSES).map(([id, name]) => ({
            id,
            name,
          })),
          { id: "all", name: "全部" },
        ]}
        value={status}
        onChange={changeStatus}
      />
      <div className="filter-row project-filters">
        <input
          type="search"
          aria-label="搜索项目"
          placeholder="搜索项目或完成结果"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="项目领域"
          value={area}
          onChange={(e) => setArea(e.target.value)}
        >
          <option value="">全部领域</option>
          {AREAS.map((a) => (
            <option value={a.value} key={a.value}>
              {a.label}
            </option>
          ))}
        </select>
        <small>{projects.length} 个项目</small>
      </div>
      {projects.length ? (
        <div className="project-list">
          {projects.map((project) => {
            const next = nextProjectAction(project, tasks),
              overdue =
                project.status === "active" &&
                project.dueDate &&
                project.dueDate < today();
            return (
              <Link
                className="project-list-row"
                key={project.id}
                to={projectPath(project.id)}
              >
                <div className="project-list-main">
                  <div className="project-row-title">
                    <h2>{project.title}</h2>
                    <span className={"project-status " + project.status}>
                      {PROJECT_STATUSES[project.status] || "未分类"}
                    </span>
                  </div>
                  <p className="project-outcome">
                    {project.outcome || "尚未填写完成结果"}
                  </p>
                  <p className="project-next-preview">
                    {project.status === "active" || project.status === "paused"
                      ? `${next.selected ? "下一步" : "待选行动"}：${next.task?.title || "添加第一个任务"}`
                      : "可打开查看任务与笔记"}
                  </p>
                </div>
                <div className="project-list-meta">
                  <small>
                    {areaLabel(project.area)}
                    {project.dueDate && (
                      <span className={overdue ? "overdue" : ""}>
                        {" "}
                        · {project.dueDate} 截止{overdue ? " · 已逾期" : ""}
                      </span>
                    )}
                  </small>
                  <Progress project={project} tasks={tasks} />
                </div>
                <Icon name="ChevronRight" size={18} />
              </Link>
            );
          })}
        </div>
      ) : (
        <Empty
          title={
            search || area
              ? "没有匹配的项目"
              : "还没有" + (PROJECT_STATUSES[status] || "") + "项目"
          }
          text="项目要有一个可以完成的结果，例如“组织胚胎期末复习”。"
          action={
            <Button secondary onClick={() => projectEditor(a)}>
              新建项目
            </Button>
          }
        />
      )}
    </>
  );
}

function ProjectDetail({ id }) {
  const a = useApp(),
    [busy, setBusy] = useState(false),
    project = a.list("project").find((p) => p.id === id);
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
  if (!project)
    return (
      <>
        <PageHead title="项目暂不可用" />
        <p className="muted">
          项目可能尚未同步，或已经移入回收站。关联任务仍保留。
        </p>
        <div className="button-row">
          <Link to="projects" className="text-link">
            返回项目
          </Link>
          <Link to="settings" className="text-link">
            查看同步与回收站
          </Link>
        </div>
      </>
    );
  const allTasks = a.list("task"),
    tasks = projectTasks(id, allTasks),
    open = openProjectTasks(id, allTasks),
    next = nextProjectAction(project, allTasks);
  const done = tasks.filter((t) => t.status === "done"),
    cancelled = tasks.filter((t) => t.status === "cancelled");
  const notes = a
    .list("projectNote")
    .filter((n) => n.projectId === id)
    .sort((a, b) =>
      (b.updatedAt || b.createdAt || "").localeCompare(
        a.updatedAt || a.createdAt || "",
      ),
    );
  const history = projectHistory(project, allTasks, notes);
  const active = project.status === "active";
  const updateStatus = (status) =>
    run(async () => {
      await a.save("project", projectStatusChange(project, status), id);
      a.notify("项目" + PROJECT_STATUSES[status]);
    });
  const chooseNext = () =>
    a.edit({
      key: "project-next:" + id,
      title: "设置下一步行动",
      initial: { taskId: next.selected ? next.task.id : "" },
      fields: [
        textField("taskId", "下一步任务", {
          type: "select",
          options: [
            { value: "", label: "暂不指定" },
            ...open.map((t) => ({ value: t.id, label: t.title })),
          ],
        }),
      ],
      save: async (v) => {
        await a.save("project", { ...project, nextAction: v.taskId }, id);
        a.notify("下一步已更新");
      },
    });
  const attach = () => {
    const available = allTasks.filter(
      (t) => !t.projectId && t.status !== "cancelled",
    );
    if (!available.length) {
      a.notify("暂无独立任务。可新建任务，或在任务详情中更改关联项目。");
      return;
    }
    a.edit({
      key: "attach-task:" + id,
      title: "关联已有任务",
      initial: { taskId: available[0].id },
      fields: [
        textField("taskId", "选择独立任务", {
          type: "select",
          required: true,
          options: available.map((t) => ({
            value: t.id,
            label: t.title + (t.status === "done" ? " · 已完成" : ""),
          })),
        }),
      ],
      save: async (v) => {
        const task = available.find((t) => t.id === v.taskId);
        if (!task) throw new Error("请选择一项任务");
        await a.save(
          "task",
          { ...task, projectId: id, area: task.area || project.area || "" },
          task.id,
        );
        a.notify("任务已关联");
      },
    });
  };
  const deleteProject = () =>
    a.edit({
      key: "remove-project:" + id,
      title: "移入回收站",
      description:
        "仅移除这个项目。关联任务和笔记会保留，恢复项目后可继续查看。",
      initial: {},
      fields: [],
      submit: "移入回收站",
      save: async () => {
        await a.remove(id);
        location.hash = "projects";
      },
    });
  const renderTask = (task) => (
    <div className="project-task" key={task.id}>
      <TaskRow task={task} showProject={false} />
      <div className="project-task-actions">
        {task.id === project.nextAction && task.status === "open" && (
          <small className="next-tag">下一步</small>
        )}
        <button
          className="text-link"
          disabled={busy}
          aria-label={"解除关联：" + task.title}
          onClick={() =>
            run(() => a.save("task", { ...task, projectId: "" }, task.id))
          }
        >
          解除关联
        </button>
        <button
          className="icon-button"
          disabled={busy}
          aria-label={"删除任务：" + task.title}
          onClick={() => run(() => a.remove(task.id))}
        >
          <Icon name="Archive" size={16} />
        </button>
      </div>
    </div>
  );
  return (
    <>
      <Link to="projects" className="project-back">
        <Icon name="ArrowLeft" size={16} /> 项目
      </Link>
      <PageHead
        title={project.title}
        action={
          <Button
            secondary
            icon="Pencil"
            onClick={() => projectEditor(a, project)}
          >
            编辑项目
          </Button>
        }
      />
      <div className="project-info">
        <span className={"project-status " + project.status}>
          {PROJECT_STATUSES[project.status]}
        </span>
        <span>{areaLabel(project.area)}</span>
        {project.startDate && <span>{project.startDate} 开始</span>}
        {project.dueDate && (
          <span
            className={active && project.dueDate < today() ? "overdue" : ""}
          >
            {project.dueDate} 截止
          </span>
        )}
      </div>
      <Section title="完成结果">
        <p className="project-text">{project.outcome || "尚未填写完成结果"}</p>
        {project.description && (
          <p className="muted project-text">{project.description}</p>
        )}
        <Progress project={project} tasks={tasks} />
      </Section>
      <Section
        title="下一步行动"
        action={
          <button className="text-link" onClick={chooseNext}>
            设置下一步
          </button>
        }
      >
        {next.task ? (
          <div className="next-action-row">
            <div>
              {!next.selected && (
                <small className="muted">尚未指定，建议先做</small>
              )}
              <h3>{next.task.title}</h3>
              <small>
                {next.task.minutes || 25} 分钟
                {next.task.date && " · " + next.task.date}
              </small>
            </div>
            <div className="button-row">
              {!next.selected && (
                <Button
                  secondary
                  small
                  disabled={busy}
                  onClick={() =>
                    run(() =>
                      a.save(
                        "project",
                        { ...project, nextAction: next.task.id },
                        id,
                      ),
                    )
                  }
                >
                  设为下一步
                </Button>
              )}
              <Button
                small
                disabled={busy || !active}
                icon="Play"
                onClick={() => run(() => openTaskFocus(a, next.task))}
              >
                开始专注
              </Button>
            </div>
          </div>
        ) : (
          <p className="muted">
            {tasks.length
              ? "暂无待完成任务。可添加任务或标记项目完成。"
              : "先添加一个具体任务，再设为下一步。"}
          </p>
        )}
        {!active && (
          <p className="muted">
            项目{PROJECT_STATUSES[project.status]}；继续推进前可恢复为进行中。
          </p>
        )}
      </Section>
      <Section
        title={"任务 · " + tasks.length}
        action={
          <div className="button-row">
            <button className="text-link" onClick={attach}>
              关联已有任务
            </button>
            <Button
              secondary
              small
              icon="Plus"
              onClick={() =>
                taskEditor(a, { projectId: id, area: project.area || "" })
              }
            >
              添加任务
            </Button>
          </div>
        }
      >
        {open.map(renderTask)}
        {!tasks.length && (
          <p className="muted">可以新建任务，或关联已存在的独立任务。</p>
        )}
        {!!done.length && (
          <details className="project-task-group">
            <summary>已完成 {done.length} 项</summary>
            {done.map(renderTask)}
          </details>
        )}
        {!!cancelled.length && (
          <details className="project-task-group">
            <summary>已取消 {cancelled.length} 项（不计入进度）</summary>
            {cancelled.map(renderTask)}
          </details>
        )}
      </Section>
      <Section
        title="笔记"
        action={
          <button
            className="text-link"
            onClick={() => projectNoteEditor(a, id)}
          >
            添加笔记
          </button>
        }
      >
        {notes.length ? (
          <RecordList
            rows={notes}
            edit={(n) => projectNoteEditor(a, id, n)}
            onRemove={(noteId) => run(() => a.remove(noteId))}
            render={(n) => (
              <>
                <small>{formatDate(n.updatedAt || n.createdAt)}</small>
                <p className="project-text">{n.text}</p>
              </>
            )}
          />
        ) : (
          <p className="muted">记录资料、结论或下次需要注意的事。</p>
        )}
      </Section>
      <Section title="最近推进记录">
        <ol className="project-history">
          {history.map((event) => (
            <li key={event.id}>
              <time>{formatDate(event.date)}</time>
              <span>{event.text}</span>
            </li>
          ))}
        </ol>
        {!history.length && <p className="muted">暂无可显示的推进记录。</p>}
      </Section>
      <div className="project-lifecycle">
        {active ? (
          <>
            <Button
              secondary
              disabled={busy}
              onClick={() => updateStatus("paused")}
            >
              暂停项目
            </Button>
            <Button disabled={busy} onClick={() => updateStatus("completed")}>
              标记完成
            </Button>
          </>
        ) : (
          <Button disabled={busy} onClick={() => updateStatus("active")}>
            恢复进行
          </Button>
        )}
        {project.status !== "archived" && (
          <button
            className="text-link"
            disabled={busy}
            onClick={() => updateStatus("archived")}
          >
            归档项目
          </button>
        )}
        <button className="text-link" disabled={busy} onClick={deleteProject}>
          移入回收站
        </button>
      </div>
    </>
  );
}
function formatDate(date) {
  const time = new Date(date);
  return Number.isNaN(time.valueOf())
    ? "时间未记录"
    : time.toLocaleString("zh-CN", {
        timeZone: "Asia/Shanghai",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
}
