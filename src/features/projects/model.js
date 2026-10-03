export const AREAS = [
  { value: "study", label: "学业" },
  { value: "career", label: "AI / 职业" },
  { value: "content", label: "内容" },
  { value: "business", label: "收入 / 商业" },
  { value: "health", label: "健康" },
  { value: "life", label: "生活" },
];
export const PROJECT_STATUSES = {
  active: "进行中",
  paused: "已暂停",
  completed: "已完成",
  archived: "已归档",
};
export const areaLabel = (area) =>
  AREAS.find((a) => a.value === area)?.label || "未分类";
export const projectPath = (id) => "projects/" + encodeURIComponent(id);
export const projectTasks = (id, tasks) =>
  tasks.filter((t) => t.projectId === id && !t.deleted);
export function projectProgress(id, tasks) {
  const counted = projectTasks(id, tasks).filter(
    (t) => t.status !== "cancelled",
  );
  const done = counted.filter((t) => t.status === "done").length;
  return {
    done,
    total: counted.length,
    percent: counted.length ? Math.round((done / counted.length) * 100) : 0,
  };
}
export function openProjectTasks(id, tasks) {
  return projectTasks(id, tasks)
    .filter((t) => !t.status || t.status === "open")
    .sort(
      (a, b) =>
        (a.priority || "P2").localeCompare(b.priority || "P2") ||
        (a.date || "9999").localeCompare(b.date || "9999") ||
        a.id.localeCompare(b.id),
    );
}
export function nextProjectAction(project, tasks) {
  const open = openProjectTasks(project.id, tasks);
  const selected = open.find((t) => t.id === project.nextAction);
  // A suggestion is never persisted or presented as the owner's selection.
  return { task: selected || open[0] || null, selected: !!selected };
}
export function projectStatusChange(
  project,
  status,
  now = new Date().toISOString(),
) {
  if (!PROJECT_STATUSES[status]) throw new Error("不支持的项目状态");
  return {
    ...project,
    status,
    completedAt:
      status === "completed"
        ? project.completedAt || now
        : status === "archived"
          ? project.completedAt || null
          : null,
  };
}
export function projectPayload(
  values,
  existing = {},
  now = new Date().toISOString(),
) {
  const title = String(values.title || "").trim(),
    outcome = String(values.outcome || "").trim();
  if (!title || title.length > 160)
    throw new Error("项目名称请填写 1–160 个字");
  if (!outcome || outcome.length > 5000)
    throw new Error("请填写明确的完成结果，最多 5000 个字");
  if (String(values.description || "").length > 10000)
    throw new Error("项目说明最多 10000 个字");
  if (values.startDate && values.dueDate && values.dueDate < values.startDate)
    throw new Error("截止日期不能早于开始日期");
  const result = projectStatusChange(
    { ...existing, ...values, title, outcome },
    values.status || "active",
    now,
  );
  result.createdAt = existing.createdAt || now;
  return result;
}
export function projectHistory(project, tasks, notes) {
  const events = [];
  if (project.createdAt)
    events.push({ id: "created", date: project.createdAt, text: "创建项目" });
  if (project.completedAt)
    events.push({
      id: "completed",
      date: project.completedAt,
      text: "标记项目完成",
    });
  for (const task of projectTasks(project.id, tasks))
    if (task.status === "done" && task.completedAt) {
      events.push({
        id: "task:" + task.id,
        date: task.completedAt,
        text: "完成任务：" + task.title,
      });
    }
  for (const note of notes.filter(
    (n) => n.projectId === project.id && !n.deleted,
  )) {
    const date = note.updatedAt || note.createdAt;
    if (date)
      events.push({
        id: "note:" + note.id,
        date,
        text:
          (note.updatedAt && note.updatedAt !== note.createdAt
            ? "更新笔记："
            : "添加笔记：") + note.text,
      });
  }
  return events.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30);
}
