// Shared original business editors: save only their existing record kinds.
import {
  textField as f,
  dateField as d,
  numberField as n,
  noteField as note,
} from "../../ui";
import { today, COURSES, sleepMinutes } from "../../domain";
export const BODY_MEASUREMENTS = [
  ["height", "身高", "cm"],
  ["weight", "体重", "kg"],
  ["waist", "腰围", "cm"],
  ["arm", "臂围", "cm"],
  ["shoulder", "肩宽", "cm"],
];
export function openRecord(
  a,
  kind,
  title,
  fields,
  initial = {},
  row = {},
  transform = (v) => v,
) {
  a.edit({
    key: kind + ":" + (row.id || "new"),
    title,
    initial: { date: today(), ...initial, ...row },
    fields,
    save: async (v) => {
      await a.save(kind, await transform(v), row.id);
      a.notify("记录已保存");
    },
  });
}

export function sleepEditor(a, r = {}) {
  return openRecord(
    a,
    "sleep",
    "记下昨晚的睡眠",
    [
      d("date", "醒来日期"),
      f("bed", "上床时间", { type: "datetime-local" }),
      f("asleep", "估计入睡时间", { type: "datetime-local", required: true }),
      f("wake", "最终醒来时间", { type: "datetime-local", required: true }),
      f("rise", "实际起床时间", { type: "datetime-local" }),
      n("wakeCount", "夜醒次数", { step: 1 }),
      n("awakeMinutes", "夜间清醒估计总分钟"),
      note("awakenings", "夜醒时间明细（可选）"),
      f("energy", "起床后精神", {
        type: "select",
        options: ["偏低", "一般", "不错"],
      }),
      note("note", "影响因素 / 睡前发生了什么"),
    ],
    { asleep: today() + "T02:30", wake: today() + "T11:00", energy: "一般" },
    r,
    (v) => {
      if (v.wake.slice(0, 10) !== v.date)
        throw new Error("醒来日期应与最终醒来时间一致");
      if (a.list("sleep").some((s) => s.date === v.date && s.id !== r.id))
        throw new Error("这一天已经有睡眠记录，请编辑已有记录");
      return { ...v, minutes: sleepMinutes(v) };
    },
  );
}

export function studyEditor(a, r = {}, subject = COURSES[0]) {
  return openRecord(
    a,
    "study",
    "记录一次复习",
    [
      f("subject", "科目", { type: "select", options: COURSES }),
      d(),
      f("topic", "复习章节 / 知识点", { required: true }),
      n("minutes", "复习分钟"),
      n("questions", "练习题数", { step: 1 }),
      n("correct", "正确题数", { step: 1 }),
      note("wrong", "错题与易混点"),
      note("material", "资料 / 链接"),
      note("next", "下一步"),
    ],
    { subject },
    r,
    (v) => {
      if (Number(v.correct) > Number(v.questions))
        throw new Error("正确题数不能大于练习题数");
      return v;
    },
  );
}

export function workoutEditor(a, r = {}) {
  return openRecord(
    a,
    "workout",
    "记录训练",
    [
      d(),
      f("part", "训练部位 / 内容", { required: true }),
      n("minutes", "训练分钟", { required: true }),
      note("exercises", "动作、组数、次数与重量"),
      f("feeling", "训练感受", {
        type: "select",
        options: ["轻松", "合适", "有些吃力", "提前停止"],
      }),
      note("discomfort", "不适（如有）"),
      note("note", "效果 / 下次调整"),
    ],
    { feeling: "合适" },
    r,
  );
}

export function bodyEditor(a, r = {}) {
  return openRecord(
    a,
    "body",
    "身体测量",
    [
      d(),
      ...BODY_MEASUREMENTS.map(([id, l, u]) => n(id, l + "（" + u + "）")),
      note(),
    ],
    {},
    r,
    (v) => {
      if (
        !BODY_MEASUREMENTS.some(([id]) => v[id] !== "" && v[id] !== undefined)
      )
        throw new Error("至少记录一项测量");
      return v;
    },
  );
}

export function guitarEditor(a, r = {}) {
  return openRecord(
    a,
    "guitar",
    "记录一次练琴",
    [
      d(),
      f("content", "练习内容", {
        required: true,
        placeholder: "和弦转换 / 节奏 / 曲目片段",
      }),
      f("song", "曲目 / 对比片段"),
      n("minutes", "练习分钟", { required: true }),
      n("bpm", "节拍速度 BPM"),
      note("difficulty", "卡在哪里"),
      note("next", "下次先练什么"),
      note(),
    ],
    {},
    r,
  );
}

export function emotionEditor(a, r = {}) {
  return openRecord(
    a,
    "emotion",
    "此刻，感觉怎么样？",
    [
      d(),
      f("time", "发生时间", { type: "time" }),
      f("mood", "情绪 / 状态", {
        required: true,
        type: "select",
        options: [
          "平静",
          "开心",
          "有动力",
          "疲惫",
          "焦虑",
          "低落",
          "想逃避",
          "烦躁",
          "说不清",
        ],
      }),
      n("intensity", "强度（1–5）", {
        min: 1,
        max: 5,
        step: 1,
        required: true,
      }),
      note("trigger", "当时发生了什么（可不填）"),
      note("behavior", "我的反应 / 行为"),
      note("adjustment", "尝试了什么调整"),
      note("result", "后来感觉怎样"),
    ],
    {
      time: new Date().toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      mood: "平静",
      intensity: 3,
    },
    r,
  );
}
