import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("action-cloud", JSON.stringify({ url: "", key: "" })),
  );
});
const metric = (page, id) =>
  page.locator(`[data-tracker="${id}"] .tracker-value`);
async function record(page, id) {
  await page.locator(`[data-tracker="${id}"]`).getByRole("button").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page).toHaveURL(/#data$/);
}
async function save(page) {
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "保存记录", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
async function rows(page) {
  return page.evaluate(async () => (await import("/src/db.js")).records());
}
async function noOverflow(page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}

test("Data shares six complete editors, updates immediately and persists original kinds and fields", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/#data");
  const date = await page.evaluate(async () =>
    (await import("/src/domain.js")).today(),
  );
  await record(page, "sleep.duration");
  await page.getByLabel("上床时间").fill(date + "T00:30");
  await page.getByLabel("估计入睡时间").fill(date + "T01:00");
  await page.getByLabel("最终醒来时间").fill(date + "T08:00");
  await page.getByLabel("实际起床时间").fill(date + "T08:15");
  await page.getByLabel("夜醒次数").fill("2");
  await page.getByLabel("夜间清醒估计总分钟").fill("20");
  await page.getByLabel("夜醒时间明细（可选）").fill("03:00、05:00");
  await page.getByLabel("起床后精神").selectOption("不错");
  await page.getByLabel("影响因素 / 睡前发生了什么").fill("提前关灯");
  await noOverflow(page);
  await save(page);
  await expect(metric(page, "sleep.duration")).toHaveText("6小时40分");
  // A second click edits the existing waking date; it must not create a duplicate.
  await record(page, "sleep.duration");
  await expect(page.getByLabel("夜醒时间明细（可选）")).toHaveValue(
    "03:00、05:00",
  );
  await page.getByLabel("夜间清醒估计总分钟").fill("30");
  await save(page);
  await expect(metric(page, "sleep.duration")).toHaveText("6小时30分");

  await record(page, "body.weight");
  for (const [label, value] of [
    ["身高（cm）", "175"],
    ["体重（kg）", "57.3"],
    ["腰围（cm）", "72"],
    ["臂围（cm）", "29"],
    ["肩宽（cm）", "43"],
  ])
    await page.getByLabel(label).fill(value);
  await page.getByLabel("备注").fill("早晨测量");
  await save(page);
  await expect(metric(page, "body.weight")).toHaveText("57.3 kg");
  await page.getByText("其他身体测量", { exact: true }).click();
  for (const id of ["body.height", "body.waist", "body.arm", "body.shoulder"]) {
    await record(page, id);
    await expect(
      page.getByRole("heading", { name: "身体测量", exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("体重（kg）")).toBeVisible();
    await page.getByRole("button", { name: "关闭", exact: true }).click();
  }

  await record(page, "workout.minutes");
  await page.getByLabel("训练部位 / 内容").fill("背部");
  await page.getByLabel("训练分钟").fill("45");
  await page.getByLabel("动作、组数、次数与重量").fill("划船 3组×12次 10kg");
  await page.getByLabel("训练感受").selectOption("有些吃力");
  await page.getByLabel("不适（如有）").fill("右肩紧绷");
  await page.getByLabel("效果 / 下次调整").fill("下次减重");
  await save(page);
  await expect(metric(page, "workout.minutes")).toHaveText("45 分钟");

  await record(page, "study.minutes");
  await page.getByLabel("科目").selectOption("生物化学");
  await page.getByLabel("复习章节 / 知识点").fill("糖代谢");
  await page.getByLabel("复习分钟").fill("40");
  await page.getByLabel("练习题数").fill("10");
  await page.getByLabel("正确题数").fill("11");
  await page.getByRole("button", { name: "保存记录", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "正确题数不能大于练习题数",
  );
  await page.getByLabel("正确题数").fill("8");
  await page.getByLabel("错题与易混点").fill("限速酶");
  await page.getByLabel("资料 / 链接").fill("教材第三章");
  await page.getByLabel("下一步", { exact: true }).fill("再做一组题");
  await save(page);
  await expect(metric(page, "study.minutes")).toHaveText("40 分钟");

  await record(page, "guitar.minutes");
  await page.getByLabel("练习内容").fill("和弦转换");
  await page.getByLabel("曲目 / 对比片段").fill("晴天");
  await page.getByLabel("练习分钟").fill("20");
  await page.getByLabel("节拍速度 BPM").fill("70");
  await page.getByLabel("卡在哪里").fill("F和弦");
  await page.getByLabel("下次先练什么").fill("慢速转换");
  await page.getByLabel("备注").fill("保持节拍");
  await save(page);
  await expect(metric(page, "guitar.minutes")).toHaveText("20 分钟");
  await record(page, "guitar.minutes");
  await page.getByLabel("练习内容").fill("节奏");
  await page.getByLabel("练习分钟").fill("10");
  await save(page);
  await expect(metric(page, "guitar.minutes")).toHaveText("30 分钟");

  await record(page, "emotion.intensity");
  await page.getByLabel("发生时间").fill("12:30");
  await page.getByLabel("情绪 / 状态").selectOption("焦虑");
  await page.getByLabel("强度（1–5）").fill("4");
  await page.getByLabel("当时发生了什么（可不填）").fill("考试临近");
  await page.getByLabel("我的反应 / 行为").fill("坐立不安");
  await page.getByLabel("尝试了什么调整").fill("散步");
  await page.getByLabel("后来感觉怎样").fill("平缓一些");
  await save(page);
  await expect(metric(page, "emotion.intensity")).toHaveText("4 / 5");
  await expect(
    page.locator('[data-tracker="emotion.intensity"]'),
  ).toContainText("焦虑");
  await noOverflow(page);
  await page.screenshot({
    path: `.qa/data-recording-${test.info().project.name}.png`,
    fullPage: true,
  });

  const saved = await rows(page);
  expect(saved.map((r) => r.kind).sort()).toEqual([
    "body",
    "emotion",
    "guitar",
    "guitar",
    "sleep",
    "study",
    "workout",
  ]);
  const find = (kind) => saved.find((r) => r.kind === kind);
  expect(find("sleep")).toMatchObject({
    date,
    bed: date + "T00:30",
    asleep: date + "T01:00",
    wake: date + "T08:00",
    rise: date + "T08:15",
    wakeCount: "2",
    awakeMinutes: "30",
    awakenings: "03:00、05:00",
    energy: "不错",
    note: "提前关灯",
    minutes: 390,
  });
  expect(find("body")).toMatchObject({
    height: "175",
    weight: "57.3",
    waist: "72",
    arm: "29",
    shoulder: "43",
    note: "早晨测量",
  });
  expect(find("workout")).toMatchObject({
    part: "背部",
    exercises: "划船 3组×12次 10kg",
    feeling: "有些吃力",
    discomfort: "右肩紧绷",
    note: "下次减重",
  });
  expect(find("study")).toMatchObject({
    subject: "生物化学",
    topic: "糖代谢",
    questions: "10",
    correct: "8",
    wrong: "限速酶",
    material: "教材第三章",
    next: "再做一组题",
  });
  expect(saved.find((r) => r.content === "和弦转换")).toMatchObject({
    song: "晴天",
    bpm: "70",
    difficulty: "F和弦",
    next: "慢速转换",
    note: "保持节拍",
  });
  expect(find("emotion")).toMatchObject({
    mood: "焦虑",
    intensity: "4",
    trigger: "考试临近",
    behavior: "坐立不安",
    adjustment: "散步",
    result: "平缓一些",
  });
  await page.reload();
  await expect(metric(page, "guitar.minutes")).toHaveText("30 分钟");
  expect(await rows(page)).toEqual(saved);
  // Backups remain the original format and can be imported by the existing importer.
  const backupResult = await page.evaluate(async () => {
    const db = await import("/src/db.js"),
      backup = await db.exportData();
    db.setScope("recording-import-test");
    const count = await db.importData(backup),
      imported = await db.records();
    db.setScope("local");
    return { count, imported };
  });
  expect(backupResult.count).toBe(saved.length);
  expect(backupResult.imported).toEqual(saved);
  expect(errors).toEqual([]);
});

test("Data opens original English choices and per-account Income, without a unified record", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/#data");
  await page.evaluate(async () => {
    const db = await import("/src/db.js"),
      { today } = await import("/src/domain.js");
    await db.put(
      "account",
      { name: "测试公众号", track: "医学", start: today() },
      "test-account",
    );
    await db.put(
      "book",
      { title: "Test Book", pages: 100, start: today() },
      "test-book",
    );
  });
  await page
    .getByRole("button", { name: "记录英语学习时长", exact: true })
    .click();
  await expect(page).toHaveURL(/#english$/);
  await page.getByRole("button", { name: "记录观看", exact: true }).click();
  await page.getByLabel("第几季").fill("2");
  await page.getByLabel("第几集").fill("3");
  await page.getByLabel("观看分钟").fill("22");
  await page.getByLabel("这是重看").check();
  await save(page);
  await page.getByRole("tab", { name: "英文阅读", exact: true }).click();
  await page.getByRole("button", { name: "记录阅读", exact: true }).click();
  await page.getByLabel("从第几页").fill("1");
  await page.getByLabel("读到第几页").fill("10");
  await page.getByLabel("阅读分钟").fill("8");
  await page.getByLabel("一句收获").fill("阅读收获");
  await save(page);
  await page.getByRole("tab", { name: "单词表达", exact: true }).click();
  await page.getByRole("button", { name: "添加表达", exact: true }).click();
  await page.getByLabel("单词 / 表达").fill("focus");
  await page.getByLabel("中文理解").fill("专注");
  await save(page);
  await page.goto("/#data");
  await expect(metric(page, "english.minutes")).toHaveText("30 分钟");
  await page
    .getByRole("button", { name: "记录公众号收入", exact: true })
    .click();
  await expect(page).toHaveURL(/#income$/);
  await page.getByLabel("测试公众号").fill("32.15");
  await page.getByRole("button", { name: "保存当日收入", exact: true }).click();
  await expect(
    page.getByText("已保存 1 个账号的收入", { exact: true }),
  ).toBeVisible();
  await page.goto("/#data");
  await expect(metric(page, "income.amount")).toHaveText("已录 ¥32.15");
  await page.reload();
  await expect(metric(page, "english.minutes")).toHaveText("30 分钟");
  await expect(metric(page, "income.amount")).toHaveText("已录 ¥32.15");
  const saved = await rows(page);
  expect(saved.map((r) => r.kind).sort()).toEqual([
    "account",
    "book",
    "episode",
    "income",
    "reading",
    "word",
  ]);
  expect(saved.find((r) => r.kind === "episode")).toMatchObject({
    season: "2",
    episode: "3",
    rewatch: true,
    minutes: "22",
  });
  expect(saved.find((r) => r.kind === "reading")).toMatchObject({
    bookId: "test-book",
    from: "1",
    to: "10",
    minutes: "8",
    note: "阅读收获",
  });
  expect(saved.find((r) => r.kind === "word")).not.toHaveProperty("minutes");
  expect(saved.find((r) => r.kind === "income")).toMatchObject({
    accountId: "test-account",
    track: "医学",
    cents: 3215,
  });
  await noOverflow(page);
  expect(errors).toEqual([]);
});

test("Shared editors preserve legacy extension fields and guitar attachment references", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/#data");
  await page.evaluate(async () => {
    const db = await import("/src/db.js"),
      { today } = await import("/src/domain.js");
    await db.put(
      "sleep",
      {
        date: today(),
        asleep: today() + "T01:00",
        wake: today() + "T08:00",
        minutes: 420,
        legacy: { retained: true },
      },
      "legacy-sleep",
    );
    await db.put(
      "guitar",
      {
        date: today(),
        content: "旧练习",
        minutes: 10,
        attachmentId: "old-audio",
        attachmentName: "对比.wav",
        legacy: { retained: true },
      },
      "legacy-guitar",
    );
  });
  await record(page, "sleep.duration");
  await page.getByLabel("夜间清醒估计总分钟").fill("10");
  await save(page);
  await page.getByLabel("打开吉他练习时长原始记录").click();
  await page.getByRole("button", { name: "编辑记录", exact: true }).click();
  await page.getByLabel("节拍速度 BPM").fill("80");
  await save(page);
  expect(
    (await rows(page)).find((r) => r.id === "legacy-guitar"),
  ).toMatchObject({
    attachmentId: "old-audio",
    attachmentName: "对比.wav",
    legacy: { retained: true },
    bpm: "80",
  });
  expect((await rows(page)).find((r) => r.id === "legacy-sleep")).toMatchObject(
    { legacy: { retained: true }, minutes: 410 },
  );
  expect(errors).toEqual([]);
});
