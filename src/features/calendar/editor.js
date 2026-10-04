import { textField as f, noteField as note } from "../../ui";
import { today } from "../../domain";
export function eventEditor(a, r = {}) {
  a.edit({
    key: "event:" + (r.id || "new"),
    title: "安排一个约定",
    initial: { start: today() + "T14:00", fixed: true, ...r },
    fields: [
      f("title", "约定内容", { required: true, wide: true }),
      f("start", "开始", { type: "datetime-local", required: true }),
      f("end", "结束", { type: "datetime-local" }),
      f("fixed", "固定约定，不随睡眠建议自动移动", { type: "checkbox" }),
      note(),
    ],
    save: async (v) => {
      if (v.end && v.end <= v.start) throw new Error("结束时间应晚于开始时间");
      await a.save("event", v, r.id);
      a.notify("日程已保存");
    },
  });
}
