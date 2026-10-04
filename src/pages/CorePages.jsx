import { eventEditor } from "../features/calendar/editor";
export { eventEditor } from "../features/calendar/editor";
import React, { useEffect, useState } from "react";
import {
  useApp,
  Icon,
  Button,
  Link,
  PageHead,
  Section,
  Empty,
  Tabs,
  Stats,
  RecordList,
  textField as f,
  dateField as d,
  numberField as n,
  noteField as note,
} from "../ui";
import { STREAMS, today, addDays, money, sum, elapsedFocus } from "../domain";
import { taskEditor, TaskRow } from "../features/tasks/TaskComponents";
export { taskEditor, TaskRow } from "../features/tasks/TaskComponents";
import { projectEditor } from "../features/projects/editor";
import { projectPath } from "../features/projects/model";
import { HeaderArt } from "../components/HeaderArt";
import { QuickCapture } from "../features/today/QuickCapture";
import { CalendarMonth } from "../features/calendar/CalendarMonth";
export function Tasks() {
  const a = useApp(),
    [tab, setTab] = useState("today"),
    [search, setSearch] = useState(""),
    [stream, setStream] = useState("");
  const filtered = a
    .list("task")
    .filter(
      (t) =>
        (tab === "today"
          ? t.date === today() && t.status !== "cancelled"
          : tab === "upcoming"
            ? t.date > today() && t.status === "open"
            : tab === "done"
              ? t.status === "done"
              : true) &&
        (!stream || t.stream === stream) &&
        (t.title || "").toLowerCase().includes(search.toLowerCase()),
    )
    .sort(
      (x, y) =>
        (x.date || "").localeCompare(y.date || "") ||
        (x.priority || "P2").localeCompare(y.priority || "P2"),
    );
  return (
    <>
      <PageHead
        title="任务"
        description="查看、筛选和安排任务。"
        action={
          <Button icon="Plus" onClick={() => taskEditor(a)}>
            新建任务
          </Button>
        }
      />
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: "today", name: "今天" },
          { id: "upcoming", name: "即将到来" },
          { id: "all", name: "全部" },
          { id: "done", name: "已完成" },
        ]}
      />
      <div className="filter-row">
        <input
          aria-label="搜索任务"
          placeholder="搜索任务…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="筛选主线"
          value={stream}
          onChange={(e) => setStream(e.target.value)}
        >
          <option value="">全部主线</option>
          {STREAMS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <Section title={`${filtered.length} 项任务`}>
        {filtered.length ? (
          filtered.map((t) => (
            <div className="task-with-delete" key={t.id}>
              <TaskRow task={t} />
              <button
                className="icon-button"
                aria-label="移入回收站"
                onClick={() => a.remove(t.id)}
              >
                <Icon name="Archive" size={16} />
              </button>
            </div>
          ))
        ) : (
          <Empty
            title="为下一步留好位置"
            action={
              <Button secondary onClick={() => taskEditor(a)}>
                写下一个任务
              </Button>
            }
          />
        )}
      </Section>
    </>
  );
}
export function Focus() {
  const a = useApp(),
    foc =
      a.list("focus").find((f) => f.id === "current-focus") ||
      a.list("focus")[0],
    task = a.list("task").find((t) => t.id === foc?.taskId),
    [tick, setTick] = useState(Date.now());
  useEffect(() => {
    const i = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);
  const elapsed = elapsedFocus(foc, tick),
    remaining = Math.max(
      0,
      (foc?.minutes || 25) * 60 - Math.floor(elapsed / 1000),
    );
  const update = (v) => a.save("focus", { ...foc, ...v }, "current-focus");
  const toggle = () =>
    update(
      foc?.running
        ? { elapsed, running: false, started: null }
        : { started: Date.now(), running: true },
    );
  return (
    <div className="focus-page">
      <Link to="today" className="focus-back">
        <Icon name="ArrowLeft" />
        返回工作台
      </Link>

      <HeaderArt />
      <div className="focus-heading">
        <span>专注</span>
        <h1>{task?.title || "选择一个任务"}</h1>
      </div>
      {task ? (
        <>
          <p className="muted">{task.note || "按预估时长计时，可随时暂停。"}</p>
          <div className="focus-clock">
            <svg
              className="focus-ring"
              viewBox="0 0 240 240"
              aria-hidden="true"
            >
              <circle cx="120" cy="120" r="108" className="ring-track" />
              <circle
                cx="120"
                cy="120"
                r="108"
                className="ring-value"
                pathLength="100"
                strokeDasharray={`${Math.min(100, Math.max(0, (remaining / ((foc?.minutes || 25) * 60)) * 100))} 100`}
              />
            </svg>
            <div
              className={"timer " + (foc?.running ? "running" : "")}
              aria-live="off"
            >
              {String(Math.floor(remaining / 60)).padStart(2, "0")}
              <span>:</span>
              {String(remaining % 60).padStart(2, "0")}
            </div>
          </div>
          <div className="focus-session-meta">
            <span>
              本段计划 <strong>{foc?.minutes || 25} 分钟</strong>
            </span>
            <span>
              本段已用 <strong>{Math.floor(elapsed / 60000)} 分钟</strong>
            </span>
          </div>
          <p>
            {remaining === 0
              ? "本段计时结束，确认实际结果后再完成任务。"
              : foc?.running
                ? "正在专注"
                : "准备好了，就开始。"}
          </p>
          <div className="focus-actions">
            <Button icon={foc?.running ? "Pause" : "Play"} onClick={toggle}>
              {foc?.running ? "暂停" : "开始 / 继续"}
            </Button>
            <Button
              secondary
              icon="Check"
              onClick={() =>
                a.edit({
                  key: "focus-result:" + task.id,
                  title: "这一段，推进了什么？",
                  initial: { result: "", done: task.status === "done" },
                  fields: [
                    note("result", "完成结果 / 下一步"),
                    {
                      name: "done",
                      label: "这个任务已经完成",
                      type: "checkbox",
                    },
                  ],
                  save: async (v) => {
                    const total = elapsedFocus(foc);
                    await a.save(
                      "task",
                      {
                        ...task,
                        actualMinutes:
                          (Number(task.actualMinutes) || 0) +
                          Math.round(total / 60000),
                        status: v.done ? "done" : "open",
                        note: [task.note, v.result].filter(Boolean).join("\n"),
                        completedAt: v.done ? new Date().toISOString() : null,
                      },
                      task.id,
                    );
                    await update({ running: false, elapsed: 0, started: null });
                    location.hash = "today";
                  },
                })
              }
            >
              结束并记录
            </Button>
          </div>
          {task.subtasksText && (
            <div className="focus-subtasks">
              {task.subtasksText
                .split("\n")
                .filter(Boolean)
                .map((t, i) => (
                  <label key={i}>
                    <input
                      type="checkbox"
                      checked={(task.checkedSteps || []).includes(i)}
                      onChange={(e) =>
                        a.save(
                          "task",
                          {
                            ...task,
                            checkedSteps: e.target.checked
                              ? [...(task.checkedSteps || []), i]
                              : (task.checkedSteps || []).filter(
                                  (n) => n !== i,
                                ),
                          },
                          task.id,
                        )
                      }
                    />
                    {t}
                  </label>
                ))}
            </div>
          )}
        </>
      ) : (
        <div className="focus-select">
          {a
            .list("task")
            .filter((t) => t.status === "open")
            .slice(0, 8)
            .map((t) => (
              <button
                key={t.id}
                onClick={() =>
                  a.save(
                    "focus",
                    {
                      taskId: t.id,
                      minutes: t.minutes || 25,
                      elapsed: 0,
                      running: false,
                    },
                    "current-focus",
                  )
                }
              >
                {t.title}
                <Icon name="ArrowRight" />
              </button>
            ))}
          {!a.list("task").some((t) => t.status === "open") && (
            <Button onClick={() => taskEditor(a)}>添加任务</Button>
          )}
        </div>
      )}
      <span className="focus-footer">
        结束后可记录实际结果，确认是否完成任务。
      </span>
    </div>
  );
}
export function Goals() {
  const a = useApp(),
    [tab, setTab] = useState("月度");
  const edit = (r = {}) =>
    a.edit({
      key: "goal:" + (r.id || "new"),
      title: "明确一个目标",
      initial: { level: tab, status: "active", ...r },
      fields: [
        f("title", "想达到什么", { required: true, wide: true }),
        f("level", "时间范围", {
          type: "select",
          options: ["月度", "季度", "长期"],
        }),
        d("due", "目标日期", { required: false }),
        note("measure", "怎么判断做到了"),
        f("status", "状态", {
          type: "select",
          options: [
            { value: "active", label: "进行中" },
            { value: "done", label: "已达成" },
            { value: "paused", label: "暂缓" },
          ],
        }),
      ],
      save: (v) => a.save("goal", v, r.id),
    });
  return (
    <>
      <PageHead
        title="目标"
        description="目标给方向，任务负责下一步。"
        action={
          <Button icon="Plus" onClick={() => edit()}>
            添加目标
          </Button>
        }
      />
      <Tabs value={tab} onChange={setTab} items={["月度", "季度", "长期"]} />
      <div className="goal-grid">
        {a
          .list("goal")
          .filter((g) => g.level === tab)
          .map((g) => {
            const tasks = a.list("task").filter((t) => t.goalId === g.id),
              completed = tasks.filter((t) => t.status === "done").length;
            return (
              <section className="goal-card" key={g.id}>
                <span className="eyebrow">
                  {g.status === "done" ? "已达成" : g.due || "按自己的节奏"}
                </span>
                <h2>{g.title}</h2>
                <p>{g.measure || "补充一个可观察的达成标准"}</p>
                <div className="progress-track">
                  <i
                    style={{
                      width: `${tasks.length ? (completed / tasks.length) * 100 : 0}%`,
                    }}
                  />
                </div>
                <small>
                  关联任务 {completed} / {tasks.length} · 目标需手动确认达成
                </small>
                <div className="button-row">
                  <Button
                    secondary
                    small
                    onClick={() => taskEditor(a, { goalId: g.id })}
                  >
                    添加下一步
                  </Button>
                  <button
                    className="icon-button"
                    onClick={() => edit(g)}
                    aria-label="编辑目标"
                  >
                    <Icon name="Pencil" />
                  </button>
                  <button
                    className="icon-button"
                    onClick={() => a.remove(g.id)}
                    aria-label="移入回收站"
                  >
                    <Icon name="Archive" />
                  </button>
                </div>
              </section>
            );
          })}
      </div>
      {!a.list("goal").some((g) => g.level === tab) && (
        <Empty
          title="给这个阶段，一个方向"
          action={
            <Button secondary onClick={() => edit()}>
              写下目标
            </Button>
          }
        />
      )}
    </>
  );
}
export function Inbox() {
  const a = useApp(),
    items = a.list("inbox").filter((i) => i.status === "open");
  const convert = (r, kind) => {
    const options = {
      id: "from-inbox:" + r.id + ":" + kind,
      title: kind === "event" ? "转为日程" : "转为任务",
      onSaved: async () => {
        await a.save("inbox", { ...r, status: "converted" }, r.id);
        a.notify("已转为" + (kind === "event" ? "日程" : "任务"));
      },
    };
    if (kind === "event")
      eventEditor(a, { title: r.text, sourceId: r.id }, options);
    else taskEditor(a, { title: r.text, sourceId: r.id }, options);
  };
  const convertProject = (r) => {
    const id = "from-inbox:" + r.id + ":project";
    const existing = a.list("project").find((p) => p.id === id);
    projectEditor(a, existing || { title: r.text, sourceId: r.id }, {
      id,
      onSaved: async (projectId) => {
        await a.save("inbox", { ...r, status: "converted", projectId }, r.id);
      },
    });
  };
  return (
    <div className="inbox-page">
      <PageHead
        title="收件箱"
        description="快速记录后，可转为任务、项目或日程。"
        action={
          <Button onClick={a.capture} icon="Plus">
            快速记录
          </Button>
        }
      />
      <QuickCapture date={today()} />
      <div className="inbox-list-heading">
        <h2>待整理</h2>
        <span>{items.length} 条</span>
      </div>
      <RecordList
        rows={items}
        empty="点击上方「快速记录」留下想法，再整理为任务或项目。"
        onRemove={a.remove}
        render={(r) => (
          <>
            <small>{r.date}</small>
            <h3>{r.text}</h3>
            <div className="button-row">
              <Button small secondary onClick={() => convert(r, "task")}>
                转为任务
              </Button>
              <Button small secondary onClick={() => convertProject(r)}>
                转为项目
              </Button>
              <Button small secondary onClick={() => convert(r, "event")}>
                加入日程
              </Button>
              <button
                className="text-link"
                onClick={() =>
                  a.save("inbox", { ...r, status: "archived" }, r.id)
                }
              >
                归档
              </button>
            </div>
          </>
        )}
      />
      <details className="archive-details">
        <summary>已整理 {a.list("inbox").length - items.length} 条</summary>
        {a
          .list("inbox")
          .filter((r) => r.status !== "open")
          .map((r) => (
            <div className="record" key={r.id}>
              <p>
                {r.text}
                <small className="inbox-status">
                  {r.status === "converted" ? "已转换" : "已归档"}
                </small>
                {r.projectId && (
                  <>
                    <br />
                    <Link className="text-link" to={projectPath(r.projectId)}>
                      查看项目 →
                    </Link>
                  </>
                )}
              </p>
              <button
                className="text-link"
                onClick={() => a.save("inbox", { ...r, status: "open" }, r.id)}
              >
                放回收件箱
              </button>
            </div>
          ))}
      </details>
    </div>
  );
}
export function Schedule() {
  const a = useApp(),
    [date, setDate] = useState(today()),
    [view, setView] = useState("日");
  const end =
    view === "周"
      ? addDays(date, 6)
      : view === "月"
        ? date.slice(0, 7) + "-31"
        : date;
  const entries = a
    .list("event")
    .filter(
      (e) =>
        typeof e.start === "string" && Number.isFinite(Date.parse(e.start)),
    )
    .filter(
      (e) => e.start?.slice(0, 10) >= date && e.start?.slice(0, 10) <= end,
    )
    .sort((x, y) => x.start.localeCompare(y.start));
  return (
    <div className="calendar-page">
      <PageHead
        title="日程"
        description="约定的时间固定，其他任务留有余地。"
        action={
          <Button onClick={() => eventEditor(a)} icon="Plus">
            添加日程
          </Button>
        }
      />
      <div className="filter-row">
        <input
          type="date"
          aria-label="起始日期"
          value={date}
          onChange={(e) => {
            if (e.target.value) setDate(e.target.value);
          }}
        />
        <Tabs items={["日", "周", "月"]} value={view} onChange={setView} />
      </div>
      <CalendarMonth
        date={date}
        onSelect={(value) => {
          setDate(value);
          setView("日");
        }}
        events={a.list("event")}
      />
      <div className="calendar-list-heading">
        <h2>{view === "日" ? "当天安排" : view + "安排"}</h2>
        <span>{entries.length} 项</span>
      </div>
      <RecordList
        rows={entries}
        empty="这段时间没有日程。点击「添加日程」记录固定安排。"
        edit={(r) => eventEditor(a, r)}
        onRemove={a.remove}
        render={(r) => (
          <div className="timeline-row">
            <time>
              {r.start.slice(5, 10)}
              <strong>{r.start.slice(11, 16)}</strong>
            </time>
            <div>
              <h3>{r.title}</h3>
              <p>
                {r.fixed ? "固定约定" : "可调整日程"}
                {r.end ? " · 至 " + r.end.slice(11, 16) : ""}
                {r.end &&
                Number.isFinite(Date.parse(r.end)) &&
                Date.parse(r.end) > Date.parse(r.start)
                  ? " · " +
                    Math.round(
                      (Date.parse(r.end) - Date.parse(r.start)) / 60000,
                    ) +
                    " 分钟"
                  : ""}
              </p>
              {r.note && <small>{r.note}</small>}
            </div>
          </div>
        )}
      />
    </div>
  );
}
export function Summary() {
  const a = useApp(),
    [date, setDate] = useState(today()),
    r = a.list("summary").find((s) => s.date === date),
    [values, setValues] = useState({}),
    [busy, setBusy] = useState(false);
  const writeRequest = a.route.query.get("write");
  useEffect(() => {
    if (!writeRequest) return;
    setDate(today());
    const frame = requestAnimationFrame(() =>
      document.querySelector(".review-write-target")?.focus(),
    );
    return () => cancelAnimationFrame(frame);
  }, [writeRequest]);
  useEffect(() => {
    setValues(r || {});
  }, [date, r?.id]);
  const tasks = a
      .list("task")
      .filter((t) => t.date === date && t.status !== "cancelled"),
    rev = sum(
      a.list("income").filter((i) => i.date === date),
      "cents",
    ),
    deals = a.list("deal").filter((d) => d.date === date);
  return (
    <>
      <PageHead
        title="每日小结"
        description="回顾今天的记录，填写推进、阻碍和调整。"
        action={
          <input
            aria-label="小结日期"
            type="date"
            value={date}
            max={today()}
            onChange={(e) => {
              if (e.target.value) setDate(e.target.value);
            }}
          />
        }
      />
      <Stats
        items={[
          [
            "任务完成",
            tasks.length
              ? `${tasks.filter((t) => t.status === "done").length} / ${tasks.length}`
              : "未安排任务",
          ],
          [
            "公众号收入",
            a.list("income").some((i) => i.date === date)
              ? money(rev)
              : "未记录",
          ],
          ["销售收入", deals.length ? money(sum(deals, "cents")) : "未记录"],
        ]}
      />
      <div className="two-col">
        <Section title="今天留下的足迹">
          {tasks.length ? (
            tasks.map((t) => <TaskRow key={t.id} task={t} compact />)
          ) : (
            <p className="quiet-note">今天还没有任务记录。</p>
          )}
          {STREAMS.slice(2).map((s) => {
            const kinds = {
              sleep: ["sleep"],
              courses: ["study"],
              english: ["episode", "word", "reading"],
              fitness: ["workout", "body"],
              guitar: ["guitar"],
              emotion: ["emotion"],
            };
            const count = a.rows.filter(
              (r) => (kinds[s.id] || []).includes(r.kind) && r.date === date,
            ).length;
            return count ? (
              <p className="summary-count" key={s.id}>
                {s.name}
                <b>{count} 条记录</b>
              </p>
            ) : null;
          })}
        </Section>
        <Section title="留给明天的自己">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await a.save("summary", { ...values, date }, "summary:" + date);
                a.notify("小结已保存，明日计划需单独确认");
              } catch (e) {
                a.notify(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {[
              ["progress", "今天推进了什么"],
              ["blocker", "卡在哪里 / 为什么退步"],
              ["change", "下次准备怎样调整"],
            ].map(([key, label]) => (
              <label className="field wide" key={key}>
                <span>{label}</span>
                <textarea
                  className={
                    key === "progress" ? "review-write-target" : undefined
                  }
                  value={values[key] || ""}
                  rows="3"
                  onChange={(e) =>
                    setValues({ ...values, [key]: e.target.value })
                  }
                />
              </label>
            ))}
            <div className="button-row">
              <Button type="submit" disabled={busy} icon="Check">
                保存小结
              </Button>
              <Link to="plan" className="text-link">
                安排明天 <Icon name="ArrowRight" size={16} />
              </Link>
            </div>
          </form>
        </Section>
      </div>
    </>
  );
}
export function Plan() {
  const a = useApp(),
    [date, setDate] = useState(addDays(today(), 1)),
    [selected, setSelected] = useState([]);
  const confirmed = a.list("plan").find((p) => p.date === date);
  useEffect(
    () =>
      setSelected(
        a
          .list("task")
          .filter((t) => t.date === date && t.top)
          .map((t) => t.id),
      ),
    [date],
  );
  const tasks = a
      .list("task")
      .filter((t) => t.date === date && t.status !== "cancelled"),
    overdue = a
      .list("task")
      .filter((t) => t.date < date && t.status === "open"),
    clients = a
      .list("client")
      .filter((c) => c.next && c.next <= date && c.grade !== "W");
  const weekday = new Date(date + "T12:00:00+08:00").getUTCDay();
  const routines = a
    .list("routine")
    .filter((r) => Number(r.weekday) === weekday && !r.rest);
  const toggle = (id) => {
    if (!selected.includes(id) && selected.length >= 3) {
      a.notify("最多选3项，把精力留给重点");
      return;
    }
    setSelected(
      selected.includes(id)
        ? selected.filter((s) => s !== id)
        : [...selected, id],
    );
  };
  return (
    <>
      <PageHead
        title="提前安排"
        description="先选一到三件重点，再给其他事情留空间。"
        action={
          <input
            aria-label="计划日期"
            type="date"
            value={date}
            onChange={(e) => {
              if (e.target.value) setDate(e.target.value);
            }}
          />
        }
      />
      <div className="plan-banner">
        <div>
          <span className="eyebrow">{confirmed ? "已确认" : "草稿"}</span>
          <h2>
            {date === today()
              ? "今天"
              : date === addDays(today(), 1)
                ? "明天"
                : date}
            ，最重要的事。
          </h2>
          <p>
            {confirmed
              ? "已确认 · 修改重点后需再次确认"
              : "计划草稿 · 确认后才会显示在当天 Top 3"}
          </p>
        </div>
        <strong>
          {selected.length}
          <span>/ 3</span>
        </strong>
      </div>
      <Section
        title="选择重点"
        action={
          <Button secondary small onClick={() => taskEditor(a, { date })}>
            添加任务
          </Button>
        }
      >
        {tasks.length ? (
          tasks.map((t) => (
            <label key={t.id} className="plan-task">
              <input
                type="checkbox"
                checked={selected.includes(t.id)}
                onChange={() => toggle(t.id)}
              />
              <span>
                {t.title}
                <small>
                  {t.priority} · {t.minutes || 25} 分钟
                </small>
              </span>
              {t.status === "done" && <small>已完成</small>}
            </label>
          ))
        ) : (
          <Empty
            title="这一天还是空白"
            text="添加任务，或从下面带入跟进和未完成事项。"
          />
        )}
        <div className="button-row">
          <Button
            icon="Check"
            onClick={async () => {
              if (selected.length < 1) {
                a.notify("先选择至少一项重点");
                return;
              }
              for (const t of tasks)
                await a.save(
                  "task",
                  { ...t, top: selected.includes(t.id) },
                  t.id,
                );
              await a.save(
                "plan",
                {
                  date,
                  topIds: selected,
                  confirmedAt: new Date().toISOString(),
                },
                "plan:" + date,
              );
              a.notify("计划已确认");
            }}
          >
            确认这一天的计划
          </Button>
        </div>
      </Section>
      <div className="two-col">
        <Section title="到期客户跟进">
          {clients.length ? (
            clients.map((c) => (
              <div className="record" key={c.id}>
                <div>
                  <h3>{c.name}</h3>
                  <p>
                    {c.grade} · {c.next}
                  </p>
                </div>
                <Button
                  secondary
                  small
                  onClick={async () => {
                    await a.save(
                      "task",
                      {
                        title: "跟进 " + c.name,
                        date,
                        stream: "sales",
                        minutes: 15,
                        priority: "P1",
                        status: "open",
                        clientId: c.id,
                      },
                      "followup:" + c.id + ":" + c.next,
                    );
                    a.notify("已带入当天任务");
                  }}
                >
                  带入
                </Button>
              </div>
            ))
          ) : (
            <p className="quiet-note">暂无到期客户。</p>
          )}
        </Section>
        <Section title="未完成事项">
          {overdue.length ? (
            overdue.map((t) => (
              <div className="record" key={t.id}>
                <div>
                  <h3>{t.title}</h3>
                  <small>原计划 {t.date}</small>
                </div>
                <Button
                  secondary
                  small
                  onClick={() => taskEditor(a, { ...t, date })}
                >
                  改期
                </Button>
              </div>
            ))
          ) : (
            <p className="quiet-note">没有需要延续的任务。</p>
          )}
        </Section>
      </div>
      {routines.length > 0 && (
        <Section title="本周训练安排">
          {routines.map((r) => (
            <div className="record" key={r.id}>
              <p>
                {r.title} · {r.minutes} 分钟
              </p>
              <Button
                secondary
                small
                onClick={() =>
                  a.save(
                    "task",
                    {
                      title: r.title,
                      date,
                      stream: "fitness",
                      minutes: Number(r.minutes),
                      status: "open",
                      priority: "P3",
                    },
                    "routine:" + r.id + ":" + date,
                  )
                }
              >
                带入训练
              </Button>
            </div>
          ))}
        </Section>
      )}
    </>
  );
}
export function Cover() {
  return (
    <div className="cover cover-login">
      <Link
        to="today"
        className="cover-art-link"
        onClick={() => localStorage.setItem("xiaosong-entered", "1")}
        aria-label="进入小松工作台"
      >
        <img
          src="./cover-login.png"
          alt="拒绝拖延，执行力；进入今日安排"
          className="cover-art"
        />
      </Link>
    </div>
  );
}
