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
import { HeaderArt } from "../../components/HeaderArt";
import { TodaySignals } from "./TodaySignals";
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
      <header className="today-head illustrated-header">
        <HeaderArt />
        <time dateTime={date} className="today-date">
          {new Intl.DateTimeFormat("zh-CN", {
            timeZone: "Asia/Shanghai",
            month: "long",
            day: "numeric",
          }).format(new Date(date + "T12:00:00+08:00"))}
          {" · "}
          {new Intl.DateTimeFormat("zh-CN", {
            timeZone: "Asia/Shanghai",
            weekday: "short",
          }).format(new Date(date + "T12:00:00+08:00"))}
        </time>
        <div className="today-title-line">
          <h1>今日行动</h1>
        </div>
      </header>
      <div className="today-workspace">
        <NextAction action={action} />
        <TopThree
          tasks={todayTopThree(tasks, date)}
          overflow={planned.filter((t) => t.top).length > 3}
        />
        <TodaySignals date={date} />
        <TodayProgress tasks={planned} />
        <TodayTimeline items={todayTimeline(app.list("event"), date)} />
        <QuickCapture date={date} />
      </div>
    </div>
  );
}
