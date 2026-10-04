// Real UI captures using an isolated, synthetic-only browser profile.
// Start `npm run dev -- --host 127.0.0.1 --port 4175` before running this file.
import { chromium, devices } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const base = process.env.V3_CAPTURE_URL || "http://127.0.0.1:4175/";
const output = ".qa/v3-final";
const guideImages = "docs/images/v3";
await mkdir(output, { recursive: true });
await mkdir(guideImages, { recursive: true });
const browser = await chromium.launch({ channel: "chromium" });
const errors = [],
  badResponses = [],
  captures = [];
function monitor(page) {
  page.on("pageerror", (e) =>
    errors.push({ url: page.url(), message: e.message }),
  );
  page.on("response", (r) => {
    if (r.status() >= 400)
      badResponses.push({ url: r.url(), status: r.status() });
  });
}
async function profile(options) {
  const context = await browser.newContext(options);
  await context.addInitScript(() => {
    localStorage.setItem("action-cloud", JSON.stringify({ url: "", key: "" }));
    localStorage.setItem("action-theme", "light");
  });
  const page = await context.newPage();
  monitor(page);
  await page.goto(base + "#today");
  await page.locator("main h1").waitFor();
  return { context, page };
}
async function seed(page) {
  await page.evaluate(async () => {
    const { put } = await import("/src/db.js");
    const { today, addDays, COURSES } = await import("/src/domain.js");
    const date = today();
    const rows = [
      [
        "project",
        "exam",
        {
          title: "专业课期末复习",
          area: "study",
          outcome: "梳理四门专业课重点，完成两套模拟题",
          status: "active",
          nextAction: "study-task",
          dueDate: addDays(date, 30),
          createdAt: addDays(date, -21) + "T12:00:00+08:00",
        },
      ],
      [
        "project",
        "media",
        {
          title: "公众号账号经营",
          area: "business",
          outcome: "完成收入核对，比较两个账号赛道",
          status: "active",
          nextAction: "income-task",
          createdAt: addDays(date, -25) + "T12:00:00+08:00",
        },
      ],
      [
        "project",
        "music",
        {
          title: "稳定弹完一段晴天",
          area: "life",
          outcome: "80 BPM 下完整弹完主歌",
          status: "paused",
          createdAt: addDays(date, -18) + "T12:00:00+08:00",
        },
      ],
      [
        "task",
        "study-task",
        {
          title: "整理组织与胚胎学复习重点",
          projectId: "exam",
          area: "study",
          stream: "courses",
          top: true,
          priority: "P1",
          status: "open",
          minutes: 25,
        },
      ],
      [
        "task",
        "income-task",
        {
          title: "记录各账号今天的收入",
          projectId: "media",
          area: "business",
          stream: "income",
          top: true,
          priority: "P2",
          status: "open",
          minutes: 15,
        },
      ],
      [
        "task",
        "crm-task",
        {
          title: "跟进昨天约好的两位客户",
          stream: "sales",
          top: true,
          priority: "P2",
          status: "open",
          minutes: 30,
        },
      ],
      [
        "task",
        "reading-task",
        {
          title: "阅读英文原著十页",
          stream: "english",
          priority: "P3",
          status: "open",
          minutes: 20,
        },
      ],
      [
        "task",
        "done-task",
        {
          title: "完成生物化学第一章复习",
          status: "done",
          priority: "P2",
          projectId: "exam",
          completedAt: date + "T10:00:00+08:00",
          minutes: 45,
        },
      ],
      [
        "projectNote",
        "exam-note",
        {
          projectId: "exam",
          text: "已整理细胞与组织部分，明天继续上皮组织。",
          createdAt: date + "T10:00:00+08:00",
          updatedAt: date + "T10:00:00+08:00",
        },
      ],
      [
        "body",
        "weight",
        { weight: 57.3, height: 172, waist: 72, arm: 28, shoulder: 43 },
      ],
      [
        "workout",
        "workout",
        {
          minutes: 45,
          part: "肩部基础训练",
          exercises: "哑铃推举 3 组 × 12 次；侧平举 3 组 × 15 次",
          feeling: "合适",
          note: "下次先热身，再开始推举",
        },
      ],
      [
        "routine",
        "routine",
        {
          weekday: 1,
          title: "肩部与核心",
          minutes: 40,
          rest: false,
          note: "先热身，按实际状态调整",
        },
      ],
      [
        "study",
        "class",
        {
          minutes: 45,
          subject: COURSES[0],
          topic: "细胞与上皮组织",
          questions: 25,
          correct: 20,
          wrong: "注意简单上皮的分类",
          next: "整理结缔组织",
        },
      ],
      [
        "course",
        "course:" + COURSES[0],
        {
          subject: COURSES[0],
          exam: addDays(date, 30),
          scope: "细胞、上皮组织、结缔组织与胚胎发育",
          material: "课堂笔记与历年试题",
        },
      ],
      [
        "episode",
        "episode",
        {
          minutes: 20,
          season: 1,
          episode: 2,
          rewatch: false,
          note: "练习日常寒暄表达",
        },
      ],
      [
        "word",
        "word",
        {
          word: "take your time",
          meaning: "慢慢来，不着急",
          sentence: "Take your time with the next exercise.",
          review: addDays(date, 1),
        },
      ],
      [
        "book",
        "book",
        {
          title: "The Little Prince",
          author: "Antoine de Saint-Exupéry",
          pages: 96,
          start: addDays(date, -7),
        },
      ],
      [
        "reading",
        "reading",
        {
          bookId: "book",
          from: 11,
          to: 20,
          minutes: 15,
          note: "整理今天的生词",
        },
      ],
      [
        "guitar",
        "guitar",
        {
          minutes: 20,
          content: "和弦转换",
          song: "晴天",
          bpm: 80,
          difficulty: "F 和弦转换需要更稳",
          next: "同一片段先练 10 分钟",
        },
      ],
      [
        "emotion",
        "emotion",
        {
          time: "11:30",
          mood: "平静",
          intensity: 3,
          trigger: "完成了早上的计划",
          adjustment: "走动十分钟后继续学习",
          result: "状态比早上稳定",
        },
      ],
      [
        "account",
        "account",
        { name: "读书号", track: "阅读", start: addDays(date, -30) },
      ],
      [
        "account",
        "account2",
        { name: "生活号", track: "生活", start: addDays(date, -30) },
      ],
      ["income", "money", { cents: 8345, accountId: "account", track: "阅读" }],
      [
        "income",
        "money2",
        { cents: 4000, accountId: "account2", track: "生活" },
      ],
      [
        "client",
        "client",
        {
          name: "演示客户甲",
          grade: "S",
          school: "示例大学",
          source: "同学介绍",
          added: addDays(date, -10),
          next: date,
          note: "确认报名安排",
        },
      ],
      [
        "client",
        "client2",
        {
          name: "演示客户乙",
          grade: "A",
          school: "示例大学",
          source: "朋友圈",
          added: addDays(date, -5),
          next: addDays(date, 1),
          note: "了解学习时间",
        },
      ],
      [
        "deal",
        "deal",
        {
          clientId: "client",
          cents: 55000,
          amount: 550,
          note: "示例成交，仅用于截图",
        },
      ],
      [
        "salesDaily",
        "sales",
        {
          requested: 12,
          accepted: 8,
          progress: "及时回复客户的问题",
          setback: "跟进时间还需提前安排",
        },
      ],
      [
        "event",
        "lecture",
        {
          title: "生物化学课程",
          start: date + "T14:00:00",
          end: date + "T16:00:00",
          fixed: true,
          note: "教学楼 A301",
        },
      ],
      [
        "event",
        "practice",
        {
          title: "吉他练习",
          start: date + "T18:30:00",
          end: date + "T19:00:00",
          fixed: false,
        },
      ],
      ["inbox", "idea", { text: "查找组织与胚胎学历年试题", status: "open" }],
      [
        "inbox",
        "idea2",
        { text: "整理各公众号账号的赛道表现", status: "open" },
      ],
      [
        "summary",
        "review:" + date,
        {
          progress: "完成了生物化学第一章复习",
          blocker: "背诵需要多花一点时间",
          change: "明天先整理组织学重点，再处理收入记录",
        },
      ],
    ];
    for (const [kind, id, payload] of rows)
      await put(kind, { date, ...payload }, id);
    for (let i = 0; i < 5; i++) {
      const day = addDays(date, -i);
      await put(
        "sleep",
        {
          date: day,
          bed: addDays(day, -1) + "T23:55",
          asleep: day + "T00:10",
          wake: day + "T07:00",
          rise: day + "T07:10",
          wakeCount: 1,
          awakeMinutes: 8,
          minutes: 402,
          energy: "不错",
        },
        "sleep" + i,
      );
      if (i)
        await put(
          "income",
          {
            date: day,
            cents: 5100 + i * 400,
            accountId: "account",
            track: "阅读",
          },
          "income-history" + i,
        );
    }
  });
  await page.reload();
  await page.locator("main h1").waitFor();
}
async function navigate(page, route) {
  await page.goto(base + "#" + route);
  await page.locator("main h1").waitFor();
}
async function capture(page, key, title) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      [...document.images].map((img) => img.decode().catch(() => {})),
    );
  });
  await page.waitForTimeout(250); // Settle the existing sheet transition.
  if (
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  )
    throw Error("Horizontal overflow: " + key);
  const png = await page.screenshot({
    path: output + "/" + key + ".png",
    scale: "css",
  });
  await page.screenshot({
    path: output + "/" + key + "-full.png",
    scale: "css",
    fullPage: true,
  });
  // Lossy encoding only; no hiding controls, compositing or modifying UI content.
  const webp = await page.evaluate(
    async (data) => {
      const img = new Image();
      img.src = data;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext("2d").drawImage(img, 0, 0);
      return canvas.toDataURL("image/webp", 0.87).split(",")[1];
    },
    "data:image/png;base64," + png.toString("base64"),
  );
  await writeFile(
    guideImages + "/" + key + ".webp",
    Buffer.from(webp, "base64"),
  );
  captures.push({ key, title, viewport: page.viewportSize() });
}
async function overview(items, name, columns, imageWidth) {
  const figures = await Promise.all(
    items.map(
      async ({ key, title }, i) =>
        `<figure><figcaption>${i + 1}. ${title}</figcaption><img src="data:image/png;base64,${(await readFile(output + "/" + key + ".png")).toString("base64")}"></figure>`,
    ),
  );
  const page = await browser.newPage({
    viewport: { width: columns * (imageWidth + 24) + 48, height: 900 },
  });
  await page.setContent(
    `<html lang="zh-CN"><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;padding:28px;background:#f4f0ea;color:#1f2230;font-family:'Microsoft YaHei',sans-serif}h1{font-size:28px;margin:0 0 10px}p{font-size:14px;color:#6f7482;margin:0 0 24px}main{display:grid;grid-template-columns:repeat(${columns},1fr);gap:24px}figure{margin:0}figcaption{font-size:16px;font-weight:600;margin-bottom:10px}img{display:block;width:100%;border:1px solid #e7e2da;border-radius:12px}</style><h1>小松工作台 · UI V3 Final · ${name === "mobile" ? "手机端" : "网页端"}</h1><p>真实 Chromium 页面截图 · 独立演示数据 · 图像仅拼排，界面未经重绘</p><main>${figures.join("")}</main></html>`,
  );
  await page.evaluate(() =>
    Promise.all([...document.images].map((img) => img.decode())),
  );
  await page.screenshot({
    path: output + "/" + name + "-overview.png",
    fullPage: true,
  });
  await page.close();
}
try {
  const mobile = await profile({ ...devices["Pixel 7"] });
  await capture(mobile.page, "mobile-today-empty", "今日行动 · 无数据");
  await seed(mobile.page);
  const mobilePages = [
    ["today", "today", "今日行动"],
    ["tasks", "tasks", "任务"],
    ["focus", "focus", "专注"],
    ["projects", "projects", "项目"],
    ["projects/exam", "project-detail", "项目详情"],
    ["calendar", "calendar", "日历"],
    ["inbox", "inbox", "收件箱"],
    ["data", "data", "数据"],
    ["income", "income", "公众号收入"],
    ["sales", "sales", "销售"],
    ["sleep", "sleep", "睡眠"],
    ["courses", "courses", "专业课"],
    ["english", "english", "英语"],
    ["fitness", "fitness", "健身"],
    ["guitar", "guitar", "吉他"],
    ["emotion", "emotion", "情绪"],
    ["review", "daily-review", "每日复盘"],
    ["review?view=weekly", "weekly-review", "每周复盘"],
    ["insights", "insights", "值得注意"],
    ["more", "more", "更多"],
    ["settings", "settings", "设置与同步"],
  ];
  for (const [route, key, title] of mobilePages) {
    if (route === "focus")
      await mobile.page.evaluate(async () =>
        (await import("/src/db.js")).put(
          "focus",
          { taskId: "study-task", minutes: 25, elapsed: 22000, running: false },
          "current-focus",
        ),
      );
    await navigate(mobile.page, route);
    await capture(mobile.page, "mobile-" + key, title);
  }
  await navigate(mobile.page, "today");
  await mobile.page.getByRole("button", { name: "添加", exact: true }).click();
  await mobile.page
    .getByRole("dialog", { name: "添加", exact: true })
    .waitFor();
  await capture(mobile.page, "mobile-add-sheet", "添加面板");
  await mobile.page
    .getByRole("button", { name: "新建任务", exact: true })
    .click();
  await mobile.page
    .getByRole("dialog", { name: "把下一步写清楚", exact: true })
    .waitFor();
  await capture(mobile.page, "mobile-task-editor", "任务录入");
  const desktop = await profile({
    viewport: { width: 1440, height: 960 },
    deviceScaleFactor: 1,
  });
  await seed(desktop.page);
  for (const [route, key, title] of mobilePages.filter(([route]) =>
    [
      "today",
      "projects",
      "calendar",
      "data",
      "review?view=weekly",
      "income",
      "sales",
      "settings",
    ].includes(route),
  )) {
    await navigate(desktop.page, route);
    await capture(desktop.page, "desktop-" + key, title);
  }
  await overview(
    captures.filter((c) => c.key.startsWith("mobile-")),
    "mobile",
    4,
    280,
  );
  await overview(
    captures.filter((c) => c.key.startsWith("desktop-")),
    "desktop",
    2,
    650,
  );
  await writeFile(
    output + "/runtime.json",
    JSON.stringify({ errors, badResponses, captures }, null, 2),
  );
  if (errors.length || badResponses.length)
    throw Error(JSON.stringify({ errors, badResponses }));
  console.log(
    `Captured ${captures.length} real UI screens; no pageerror, HTTP error or overflow. Guides: ${guideImages}`,
  );
} finally {
  await browser.close();
}
