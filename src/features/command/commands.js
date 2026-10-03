import { today } from "../../domain.js";
import { selectNextAction } from "../today/selectors.js";
export function buildCommands(app, date = today()) {
  const next = selectNextAction({
    tasks: app.list("task"),
    projects: app.list("project"),
    focus: app.list("focus"),
    date,
  });
  const commands = [
    { id: "new-task", label: "新建任务", operation: "task" },
    {
      id: "capture",
      label: "快速记录到收件箱",
      operation: "capture",
      aliases: ["Inbox"],
    },
    { id: "new-project", label: "新建项目", operation: "project" },
    {
      id: "focus",
      label:
        next?.source === "focus" ? `继续专注：${next.task.title}` : "开始专注",
      operation: "focus",
      task: next?.task,
      aliases: ["开始专注", "继续专注"],
    },
    { id: "new-event", label: "添加日程", operation: "event" },
    { id: "write-review", label: "写每日小结", operation: "review" },
    ...[
      ["today", "今天", "Today"],
      ["projects", "项目", "Projects"],
      ["calendar", "日历", "Calendar"],
      ["review", "复盘", "Review"],
      ["inbox", "收件箱", "Inbox"],
      ["data", "数据", "Data"],
      ["more", "更多", "More"],
    ].map(([route, title, alias]) => ({
      id: "open-" + route,
      label: "打开" + title,
      route,
      operation: "navigate",
      aliases: [alias],
    })),
  ];
  return commands.map((command) => ({
    ...command,
    type: "command",
    key: "command:" + command.id,
  }));
}
