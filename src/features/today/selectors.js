const rank = { P1: 1, P2: 2, P3: 3, P4: 4 };
const compareId = (a, b) =>
  String(a.id || "").localeCompare(String(b.id || ""), "en");
export const isOpenTask = (task) =>
  !task.deleted && task.status !== "done" && task.status !== "cancelled";
export const compareTasks = (a, b) =>
  (rank[a.priority] || 2) - (rank[b.priority] || 2) || compareId(a, b);
export function todayTasks(tasks, date) {
  return tasks.filter(
    (t) => !t.deleted && t.date === date && t.status !== "cancelled",
  );
}
export function todayTopThree(tasks, date) {
  return todayTasks(tasks, date)
    .filter((t) => t.top)
    .sort(compareTasks)
    .slice(0, 3);
}
// Only explicitly nominated project actions participate; suggested project actions do not.
export function selectNextAction({ tasks, projects = [], focus = [], date }) {
  const open = tasks.filter(isOpenTask);
  const active =
    focus.find((f) => f.id === "current-focus" && !f.deleted) ||
    focus.find((f) => !f.deleted);
  const focused = active && open.find((t) => t.id === active.taskId);
  const result = (task, source, reason) => ({
    task,
    project: projects.find((p) => !p.deleted && p.id === task.projectId),
    source,
    reason,
  });
  // Finishing Focus resets elapsed/started but retains taskId. That is not a paused session.
  if (
    focused &&
    (active.running || Number(active.elapsed) > 0 || active.started)
  )
    return result(
      focused,
      "focus",
      active.running ? "正在专注的任务" : "继续已暂停的专注",
    );
  const planned = todayTasks(open, date).sort(compareTasks);
  const top = todayTopThree(tasks, date).filter(isOpenTask);
  const nominated = projects
    .filter(
      (p) =>
        !p.deleted &&
        p.status === "active" &&
        (!p.startDate || p.startDate <= date),
    )
    .map((p) => open.find((t) => t.id === p.nextAction && t.projectId === p.id))
    .filter(
      (t) =>
        t &&
        (t.date === date || (!t.date && planned.length === 0)) &&
        (!top.length || top.some((x) => x.id === t.id)),
    )
    .sort(compareTasks);
  if (nominated.length)
    return result(
      nominated[0],
      "project",
      nominated[0].date
        ? "项目指定的下一步，已安排今天"
        : "项目指定的下一步，今天尚无其他安排",
    );
  if (top.length)
    return result(top[0], "top", "未完成的今日重点中，优先级最高");
  if (planned.length)
    return result(planned[0], "today", "未完成的今日任务中，优先级最高");
  return null;
}
