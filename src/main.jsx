import { Today } from "./features/today/Today";
import { Review } from "./features/review/Review";
import { CommandCenter } from "./features/command/CommandCenter";
import { Projects } from "./features/projects/Projects";
import React, { useState, useEffect, useCallback } from "react";
import { createRoot } from "react-dom/client";
import * as db from "./db";
import { sync, watchSync } from "./cloud";
import { initNotifications, scheduleEvents } from "./notifications";
import { today } from "./domain";
import { Context, Icon, FormDialog, textField } from "./ui";
import {
  Tasks,
  Focus,
  Goals,
  Inbox,
  Schedule,
  Plan,
  Cover,
} from "./pages/CorePages";
import {
  Income,
  Sales,
  Sleep,
  Courses,
  English,
  Fitness,
  Guitar,
  Emotion,
} from "./pages/Workstreams";
import { Settings } from "./pages/Settings";
import { parseRoute } from "./navigation";
import {
  AppNavigation,
  MobileNavigation,
  AddMenu,
} from "./components/AppNavigation";
import { Data, More } from "./pages/NavigationPages";
import "./styles.css";
import "./v2.css";
const pageMap = {
  today: Today,
  projects: Projects,
  calendar: Schedule,
  review: Review,
  data: Data,
  tasks: Tasks,
  focus: Focus,
  goals: Goals,
  more: More,
  inbox: Inbox,
  plan: Plan,
  cover: Cover,
  income: Income,
  sales: Sales,
  sleep: Sleep,
  courses: Courses,
  english: English,
  fitness: Fitness,
  guitar: Guitar,
  emotion: Emotion,
  settings: Settings,
};
function App() {
  const [route, setRoute] = useState(() => parseRoute(location.hash)),
    [adding, setAdding] = useState(false),
    [rows, setRows] = useState([]),
    [loaded, setLoaded] = useState(false),
    [dialog, setDialog] = useState(null),
    [toast, setToast] = useState(null),
    [syncText, setSyncText] = useState("仅保存在本机"),
    [theme, setTheme] = useState(
      localStorage.getItem("action-theme") || "light",
    ),
    [owner, setOwner] = useState(db.getScope());
  const refresh = useCallback(async () => {
    try {
      setRows(await db.records());
      setOwner(db.getScope());
      setLoaded(true);
    } catch {
      setToast({ text: "无法读取本机数据库，请检查浏览器存储权限" });
    }
  }, []);
  useEffect(() => {
    refresh();
    const off = db.subscribe(refresh);
    const hash = () => {
      setRoute(parseRoute(location.hash));
      setAdding(false);
      window.scrollTo(0, 0);
      setDialog(null);
    };
    window.addEventListener("hashchange", hash);
    return () => {
      off();
      window.removeEventListener("hashchange", hash);
    };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("action-theme", theme);
  }, [theme]);
  useEffect(() => {
    const off = watchSync(setSyncText);
    initNotifications().catch(() => {});
    sync();
    const int = setInterval(sync, 30000);
    const onVisible = () => {
      if (!document.hidden) {
        refresh();
        sync();
      }
    };
    window.addEventListener("online", sync);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      off();
      clearInterval(int);
      window.removeEventListener("online", sync);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  const eventSignature = JSON.stringify(rows.filter((r) => r.kind === "event"));
  useEffect(() => {
    scheduleEvents(JSON.parse(eventSignature)).catch((e) =>
      notify("日程已保存，提醒未更新：" + e.message),
    );
  }, [eventSignature]);
  const notify = (text, undo) => setToast({ text, undo });
  const save = async (kind, data, id) => {
    const result = await db.put(kind, data, id);
    sync();
    return result;
  };
  const remove = async (id) => {
    await db.remove(id);
    notify("已移入回收站", async () => {
      await db.restore(id);
      sync();
    });
    sync();
  };
  const edit = (spec) => setDialog({ ...spec, key: owner + ":" + spec.key });
  const capture = (options = {}) =>
    edit({
      key: "capture",
      focusFirst: options.focusFirst === true,
      title: "先记下来",
      initial: { text: "" },
      fields: [
        {
          ...textField("text", "想到什么？", { required: true }),
          type: "textarea",
        },
      ],
      save: async (v) => {
        await save("inbox", { ...v, date: today(), status: "open" });
        notify("已放入收件箱");
      },
    });
  const list = (kind) => rows.filter((r) => r.kind === kind);
  const ctx = {
    route,
    rows,
    list,
    save,
    remove,
    edit,
    notify,
    refresh,
    theme,
    setTheme,
    syncText,
    owner,
    capture,
  };
  const Page = pageMap[route.page] || Today;
  const full = route.page === "cover" || route.page === "focus";
  return (
    <Context.Provider value={ctx}>
      <CommandCenter key={owner} disabled={!loaded}>
        <div className={full ? "app v2 full" : "app v2"}>
          {!full && (
            <AppNavigation page={route.page} onAdd={() => setAdding(true)} />
          )}
          <main id="main" className="main">
            {loaded ? (
              <Page key={owner + ":" + route.page + ":" + (route.id || "")} />
            ) : (
              <div className="loading">正在打开你的工作台…</div>
            )}
          </main>
          {!full && (
            <MobileNavigation page={route.page} onAdd={() => setAdding(true)} />
          )}
          {adding && <AddMenu onClose={() => setAdding(false)} />}
          {dialog && (
            <FormDialog
              key={dialog.key}
              spec={dialog}
              onClose={() => setDialog(null)}
            />
          )}
          {toast && (
            <div className="toast" role="status">
              <Icon name="Check" />
              {toast.text}
              {toast.undo && (
                <button
                  onClick={async () => {
                    await toast.undo();
                    setToast(null);
                  }}
                >
                  撤销
                </button>
              )}
            </div>
          )}
        </div>
      </CommandCenter>
    </Context.Provider>
  );
}
class ErrorBoundary extends React.Component {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div className="fatal">
        <h1>页面暂时无法打开</h1>
        <p>记录仍保留在本机。刷新后再试一次。</p>
        <button onClick={() => location.reload()}>重新打开</button>
      </div>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
