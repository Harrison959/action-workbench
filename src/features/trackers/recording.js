import { today } from "../../domain";
import {
  sleepEditor,
  bodyEditor,
  workoutEditor,
  studyEditor,
  guitarEditor,
  emotionEditor,
} from "../records/editors";

// Entry points only. Trackers never own or write business records.
export function recordMetric(app, definition) {
  if (definition.sourceKey.startsWith("body.")) return bodyEditor(app);
  switch (definition.sourceKey) {
    case "sleep.duration":
      return sleepEditor(
        app,
        app.list("sleep").find((r) => r.date === today()),
      );
    case "workout.minutes":
      return workoutEditor(app);
    case "study.minutes":
      return studyEditor(app);
    case "guitar.minutes":
      return guitarEditor(app);
    case "emotion.intensity":
      return emotionEditor(app);
    case "english.minutes":
    case "income.amount":
      window.location.hash = definition.route;
      return;
    default:
      throw new Error("该指标尚未配置记录入口");
  }
}
