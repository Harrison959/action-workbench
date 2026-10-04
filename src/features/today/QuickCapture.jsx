import React, { useRef, useState } from "react";
import { Icon, useApp } from "../../ui";
export function QuickCapture({ date }) {
  const app = useApp();
  const [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const saving = useRef(false);
  async function submit(event) {
    event.preventDefault();
    const value = text.trim();
    if (!value || saving.current) return;
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      await app.save("inbox", { text: value, date, status: "open" });
      setText("");
      app.notify("已存入收件箱");
    } catch (e) {
      setError(e.message || "保存失败，请重试");
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  return (
    <section
      className="today-section today-capture-section"
      aria-labelledby="capture-heading"
    >
      <h2 id="capture-heading">快速记录</h2>
      <form className="today-capture" onSubmit={submit}>
        <span className="capture-prompt" aria-hidden="true">
          <Icon name="Plus" size={18} />
        </span>
        <input
          aria-label="快速记录内容"
          placeholder="先记下来，稍后在收件箱整理"
          value={text}
          disabled={busy}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          className="capture-submit"
          aria-label={busy ? "保存中" : "记下"}
          disabled={busy || !text.trim()}
        >
          <Icon name="ArrowUp" size={19} />
          <span>{busy ? "保存中" : "记下"}</span>
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
