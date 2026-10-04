export const PRIMARY_NAV = [
  ["today", "今天", "House"],
  ["projects", "项目", "FolderKanban"],
  ["calendar", "日历", "CalendarDays"],
  ["review", "复盘", "NotebookPen"],
  ["inbox", "收件箱", "Inbox"],
  ["data", "数据", "ChartNoAxesCombined"],
  ["more", "更多", "Grid2X2"],
];
const aliases = { schedule: "calendar", summary: "review" };
const dataPages = [
  "income",
  "sleep",
  "courses",
  "english",
  "fitness",
  "guitar",
  "emotion",
];
const otherPages = [
  "tasks",
  "focus",
  "goals",
  "plan",
  "cover",
  "sales",
  "settings",
  "insights",
];

// Keep hashes so Pages subpaths, existing bookmarks and Android notifications work.
export function parseRoute(hash = "") {
  const [path, query = ""] = hash.replace(/^#/, "").split("?");
  const [raw = "", encodedId] = path.split("/");
  const page = aliases[raw] || raw || "today";
  let id = null;
  try {
    if (encodedId) id = decodeURIComponent(encodedId);
  } catch {
    /* Invalid link: show not found. */
  }
  const known =
    PRIMARY_NAV.some(([name]) => name === page) ||
    dataPages.includes(page) ||
    otherPages.includes(page);
  return {
    page: known ? page : "today",
    id,
    query: new URLSearchParams(query),
  };
}
export function navigationGroup(page) {
  if (["tasks", "plan", "focus"].includes(page)) return "today";
  if (dataPages.includes(page)) return "data";
  if (PRIMARY_NAV.some(([name]) => name === page)) return page;
  return "more";
}
export function mobileGroup(page) {
  const group = navigationGroup(page);
  return ["today", "projects", "review"].includes(group) ? group : "more";
}
export function pageTitle(page) {
  return (
    PRIMARY_NAV.find(([name]) => name === page)?.[1] ||
    {
      tasks: "任务",
      plan: "提前安排",
      focus: "专注",
      goals: "目标",
      cover: "封面",
      sales: "销售",
      settings: "设置与同步",
      insights: "值得注意",
      income: "公众号收入",
      sleep: "睡眠",
      courses: "专业课",
      english: "英语",
      fitness: "健身",
      guitar: "吉他",
      emotion: "情绪",
    }[page] ||
    "今天"
  );
}
