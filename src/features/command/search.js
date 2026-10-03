import { isOpenTask } from "../today/selectors.js";
const normalized = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();
const byTitle = (a, b) =>
  normalized(a.title).localeCompare(normalized(b.title), "zh-CN") ||
  String(a.id).localeCompare(String(b.id), "en");
export function searchCommands(query, commands, projects, tasks) {
  const term = normalized(query);
  if (!term) return commands;
  const matchingCommands = commands.filter((c) =>
    [c.label, ...(c.aliases || [])].some((label) =>
      normalized(label).includes(term),
    ),
  );
  const matchingProjects = projects
    .filter(
      (p) =>
        !p.deleted &&
        !["completed", "archived"].includes(p.status) &&
        normalized(p.title).includes(term),
    )
    .sort(byTitle)
    .map((project) => ({
      type: "project",
      key: "project:" + project.id,
      label: project.title,
      project,
      detail: project.status === "paused" ? "已暂停" : "进行中",
    }));
  const matchingTasks = tasks
    .filter((t) => isOpenTask(t) && normalized(t.title).includes(term))
    .sort(byTitle)
    .map((task) => ({
      type: "task",
      key: "task:" + task.id,
      label: task.title,
      task,
      detail:
        projects.find((p) => !p.deleted && p.id === task.projectId)?.title ||
        "独立任务",
    }));
  return [...matchingCommands, ...matchingProjects, ...matchingTasks];
}
export function isMacPlatform(platform = "") {
  return /Mac|iPhone|iPad/i.test(platform);
}
export function isCommandShortcut(event, platform) {
  return (
    !event.defaultPrevented &&
    !event.repeat &&
    !event.isComposing &&
    !event.altKey &&
    !event.shiftKey &&
    event.key?.toLowerCase() === "k" &&
    (isMacPlatform(platform)
      ? event.metaKey && !event.ctrlKey
      : event.ctrlKey && !event.metaKey)
  );
}
export function nextIndex(index, direction, length) {
  return length ? (index + direction + length) % length : 0;
}
