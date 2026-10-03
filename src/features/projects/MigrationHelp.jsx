import React, { useRef } from "react";
import { useApp, Button } from "../../ui";
import migration from "../../../supabase/migrations/202610030001_projects.sql?raw";

export function MigrationHelp() {
  const a = useApp(),
    ref = useRef();
  if (!a.syncText.includes("云端项目功能待升级")) return null;
  return (
    <details className="migration-help">
      <summary>完成项目云端升级</summary>
      <p>
        在你已有的 Supabase 项目中，打开 SQL
        Editor，运行下方升级脚本，然后点击“立即同步”。本机项目和笔记会自动补传，原有记录继续保留。
      </p>
      <textarea
        ref={ref}
        readOnly
        value={migration}
        aria-label="项目云端升级脚本"
        rows={8}
      />
      <Button
        secondary
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(migration);
            a.notify("升级脚本已复制");
          } catch {
            ref.current.focus();
            ref.current.select();
            a.notify("已选中脚本，请复制");
          }
        }}
      >
        复制升级脚本
      </Button>
    </details>
  );
}
