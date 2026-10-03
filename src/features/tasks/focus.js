// Re-entering the same task must preserve a paused or running timer.
export async function openTaskFocus(app, task) {
  const active =
    app.list("focus").find((f) => f.id === "current-focus") ||
    app.list("focus")[0];
  if (active?.running && active.taskId !== task.id) {
    app.notify("请先暂停当前专注，再切换任务");
    location.hash = "focus";
    return;
  }
  if (active?.taskId !== task.id)
    await app.save(
      "focus",
      {
        taskId: task.id,
        elapsed: 0,
        minutes: task.minutes || 25,
        running: false,
      },
      "current-focus",
    );
  location.hash = "focus";
}
