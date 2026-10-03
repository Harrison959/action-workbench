import React, { useEffect, useState } from "react";
import { useApp } from "../../ui";
import { today } from "../../domain";
import { selectNextAction, todayTasks, todayTopThree } from "./selectors";
import { todayTimeline } from "./timeline";
import {
  NextAction,
  TopThree,
  TodayTimeline,
  TodayProgress,
} from "./TodaySections";
import { QuickCapture } from "./QuickCapture";
import "./today.css";
export function Today() {
  const app = useApp(),
    [date, setDate] = useState(today);
  useEffect(() => {
    const update = () => setDate(today());
    const timer = setInterval(update, 30000);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  const tasks = app.list("task"),
    planned = todayTasks(tasks, date);
  const action = selectNextAction({
    tasks,
    projects: app.list("project"),
    focus: app.list("focus"),
    date,
  });
  return (
    <div className="today-page">
      <header className="today-head">
        <h1>今日行动</h1>
        <time dateTime={date}>{date}</time>
      </header>
      <NextAction action={action} />
      <TopThree
        tasks={todayTopThree(tasks, date)}
        overflow={planned.filter((t) => t.top).length > 3}
      />
      <TodayTimeline items={todayTimeline(app.list("event"), date)} />
      <QuickCapture date={date} />
      <TodayProgress tasks={planned} />
    </div>
  );
}
