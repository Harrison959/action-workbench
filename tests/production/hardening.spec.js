import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("action-cloud", JSON.stringify({ url: "", key: "" })),
  );
});
test("Pages lazily loads secondary routes, then refreshes each chunk under the subpath", async ({
  page,
}) => {
  test.setTimeout(60000);
  const errors = [],
    failed = [],
    scripts = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 400 && r.url().includes("127.0.0.1"))
      failed.push(r.url());
  });
  page.on("request", (r) => {
    if (r.resourceType() === "script") scripts.push(r.url());
  });
  await page.goto("./#today");
  await expect(
    page.getByRole("heading", { name: "今日行动", exact: true }),
  ).toBeVisible();
  expect(
    scripts.some((s) =>
      /\/(Projects|Review|Insights|Data|Workstreams|CorePages|Settings)-/.test(
        s,
      ),
    ),
  ).toBe(false);
  for (const route of [
    "projects",
    "tasks",
    "focus",
    "calendar",
    "review",
    "review?view=weekly",
    "data",
    "insights",
    "more",
    "income",
    "sales",
    "sleep",
    "courses",
    "english",
    "fitness",
    "guitar",
    "emotion",
    "inbox",
    "settings",
  ]) {
    await page.evaluate((r) => {
      location.hash = r;
    }, route);
    await expect(page.locator("main h1")).toBeVisible();
    await expect(
      page.getByText("页面暂时无法打开", { exact: true }),
    ).toHaveCount(0);
    await page.reload();
    await expect(page.locator("main h1")).toBeVisible();
  }
  expect(scripts.some((s) => /\/Projects-/.test(s))).toBe(true);
  expect(
    scripts
      .filter((s) => s.includes("/assets/"))
      .every((s) => s.includes("/action-workbench/assets/")),
  ).toBe(true);
  expect(errors).toEqual([]);
  expect(failed).toEqual([]);
});

test("unavailable lazy chunk has a recoverable page error without removing local data", async ({
  page,
}) => {
  await page.goto("./#today");
  await page.getByLabel("快速记录内容").fill("断网前的记录");
  await page.getByRole("button", { name: "记下", exact: true }).click();
  await expect(page.getByLabel("快速记录内容")).toHaveValue("");
  await page.route("**/assets/Projects-*.js", (route) =>
    route.abort("internetdisconnected"),
  );
  await page.evaluate(() => {
    location.hash = "projects";
  });
  await expect(
    page.getByRole("heading", { name: "页面暂时无法打开" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "返回今天", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "今日行动", exact: true }),
  ).toBeVisible();
  await page.unroute("**/assets/Projects-*.js");
  await page.reload();
  await page.evaluate(() => {
    location.hash = "inbox";
  });
  await expect(
    page.getByRole("heading", { name: "断网前的记录", exact: true }),
  ).toBeVisible();
});
