import { taskEditor } from "../tasks/TaskComponents";
import { projectEditor } from "../projects/editor";
import { eventEditor } from "../calendar/editor";
import { projectPath } from "../projects/model.js";
import { openTaskFocus } from "../tasks/focus.js";
import { navigate } from "../../navigationHistory";
export function executeCommand(item, app) {
  if (item.type === "project") {
    navigate(projectPath(item.project.id));
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
      return item.task ? openTaskFocus(app, item.task) : navigate("focus");
    case "review":
      // Reuse the existing daily form, including when Review is already open.
      navigate("review?write=" + Date.now());
      return;
    case "navigate":
      navigate(item.route);
      return;
  }
}
