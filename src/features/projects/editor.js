import { textField as f, dateField as d, noteField as note } from "../../ui";
import { today } from "../../domain.js";
import { AREAS, projectPayload, projectPath } from "./model.js";

export function projectEditor(app, row = {}, options = {}) {
  app.edit({
    key: "project:" + (row.id || options.id || "new"),
    title: row.id ? "编辑项目" : "新建项目",
    initial: {
      title: "",
      description: "",
      outcome: "",
      status: "active",
      area: "",
      startDate: today(),
      dueDate: "",
      nextAction: "",
      ...row,
    },
    fields: [
      f("title", "项目名称", {
        required: true,
        wide: true,
        placeholder: "例如：组织胚胎期末复习",
      }),
      note("outcome", "完成结果", {
        required: true,
        placeholder: "完成时，具体要达到什么结果？",
      }),
      f("area", "所属领域", {
        type: "select",
        options: [{ value: "", label: "未分类" }, ...AREAS],
      }),
      d("startDate", "开始日期", { required: false }),
      d("dueDate", "截止日期", { required: false }),
      note("description", "项目说明"),
    ],
    submit: row.id ? "保存项目" : "创建项目",
    save: async (values) => {
      const id = await app.save(
        "project",
        projectPayload(values, row),
        row.id || options.id,
      );
      if (options.onSaved) await options.onSaved(id);
      app.notify(row.id ? "项目已保存" : "项目已创建");
      location.hash = projectPath(id);
    },
  });
}

export function projectNoteEditor(app, projectId, row = {}) {
  app.edit({
    key: "project-note:" + projectId + ":" + (row.id || "new"),
    title: row.id ? "编辑项目笔记" : "添加项目笔记",
    initial: { text: "", ...row },
    fields: [note("text", "笔记内容", { required: true })],
    save: async (v) => {
      const text = String(v.text || "").trim();
      if (!text || text.length > 10000)
        throw new Error("笔记请填写 1–10000 个字");
      const now = new Date().toISOString();
      await app.save(
        "projectNote",
        {
          ...row,
          ...v,
          projectId,
          text,
          createdAt: row.createdAt || now,
          updatedAt: now,
        },
        row.id,
      );
      app.notify("笔记已保存");
    },
  });
}
