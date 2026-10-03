import { taskEditor } from "../tasks/TaskComponents";
import { projectEditor } from "../projects/editor";
import { eventEditor } from "../../pages/CorePages";
import { projectPath } from "../projects/model.js";
import { openTaskFocus } from "../tasks/focus.js";
export function executeCommand(item, app) {
  if (item.type === "project") {
    location.hash = projectPath(item.project.id);
    return;
  }
  if (item.type === "task") return taskEditor(app, item.task);
  switch (item.operation) {
    case "task":
      return taskEditor(app);
    case "project":
      return projectEditor(app);
    case "capture":
      return app.capture({ focusFirst: true });
    case "event":
      return eventEditor(app);
    case "focus":
      return item.task
        ? openTaskFocus(app, item.task)
        : (location.hash = "focus");
    case "review":
      // Reuse the existing daily form, including when Review is already open.
      location.hash = "review?write=" + Date.now();
      return;
    case "navigate":
      location.hash = item.route;
      return;
  }
}
