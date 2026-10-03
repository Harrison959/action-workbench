import { weekRange } from "./selectors.js";
export const reviewId = (start) => "weekly-review:" + weekRange(start).start;
export function weeklyReviewPayload(
  values,
  existing,
  date,
  now = new Date().toISOString(),
) {
  const range = weekRange(date);
  const result = {
    ...existing,
    weekStart: range.start,
    weekEnd: range.end,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  for (const key of ["progress", "blocker", "stop", "nextMain"]) {
    const text = String(values[key] || "").trim();
    if (text.length > 10000) throw new Error("每项复盘最多 10000 个字");
    result[key] = text;
  }
  const ids = values.priorityProjectIds || [];
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string" || !id))
    throw new Error("重点项目格式无效");
  result.priorityProjectIds = [...new Set(ids)];
  if (result.priorityProjectIds.length > 3)
    throw new Error("最多选择下周 3 个重点项目");
  if (!result.nextMain) throw new Error("请写下下周最重要的一件事");
  return result;
}
