import { test, expect } from "@playwright/test";

test("mobile hierarchy, replace history and legacy hashes survive Pages subpath refresh", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.addInitScript(() =>
    localStorage.setItem("action-cloud", JSON.stringify({ url: "", key: "" })),
  );
  const errors = [],
    failed = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 400 && r.url().includes("127.0.0.1"))
      failed.push(r.url());
  });
  await page.goto("./#today");
  await expect(page.locator("main h1")).toBeVisible();
  const initial = await page.evaluate(() => history.length);
  const nav = page.getByRole("navigation", { name: "手机导航" });
  for (const name of ["项目", "复盘", "更多"]) {
    await nav.getByRole("link", { name, exact: true }).click();
    await expect(nav.getByRole("link", { name, exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
  }
  expect(await page.evaluate(() => history.length)).toBe(initial);
  await page.getByRole("link", { name: /设置与同步/ }).click();
  await expect(page.locator("main")).toHaveAttribute("data-page", "settings");
  await page.goBack();
  await expect(page).toHaveURL(/#more$/);
  await page.goForward();
  await expect(page).toHaveURL(/#settings$/);
  await page.reload();
  await page.getByRole("button", { name: "返回更多", exact: true }).click();
  await expect(page).toHaveURL(/\/action-workbench\/#more$/);
  for (const [hash, pageName] of [
    ["schedule", "calendar"],
    ["summary", "review"],
    ["sleep", "sleep"],
    ["projects/missing", "projects"],
  ]) {
    await page.goto("./#" + hash);
    await page.reload();
    await expect(page.locator("main")).toHaveAttribute("data-page", pageName);
    await expect(page.locator("main h1")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
  }
  expect(errors).toEqual([]);
  expect(failed).toEqual([]);
});
