import React from "react";
import { PageHead, Section, Link, Icon, useApp } from "../ui";
import { today, money, sum } from "../domain";

function Menu({ items }) {
  return (
    <div className="hub-list">
      {items.map(([id, title, detail, icon]) => (
        <Link key={id} to={id} className="menu-row">
          <Icon name={icon || "ChevronRight"} />
          <span>
            {title}
            {detail && <small>{detail}</small>}
          </span>
          <Icon name="ChevronRight" size={16} />
        </Link>
      ))}
    </div>
  );
}
export function Data() {
  const a = useApp(),
    date = today(),
    onDay = (kind) => a.list(kind).filter((r) => r.date === date);
  const sleep = onDay("sleep")[0],
    income = onDay("income"),
    body = onDay("body").find((r) => r.weight !== "" && r.weight != null);
  const duration = (kind) =>
    onDay(kind).length ? `${sum(onDay(kind), "minutes")} 分钟` : "今天未记录";
  return (
    <>
      <PageHead
        title="数据"
        description="查看今日记录，进入对应项目补记或看趋势。"
      />
      <Menu
        items={[
          [
            "income",
            "公众号收入",
            income.length ? money(sum(income, "cents")) : "今天未记录",
            "Newspaper",
          ],
          [
            "sleep",
            "睡眠",
            sleep
              ? `${Math.floor(sleep.minutes / 60)} 小时 ${sleep.minutes % 60} 分钟`
              : "今天未记录",
            "Moon",
          ],
          [
            "fitness",
            "健身与身体",
            `${duration("workout")}${body ? ` · ${body.weight} kg` : ""}`,
            "Dumbbell",
          ],
          ["courses", "专业课", duration("study"), "GraduationCap"],
          [
            "english",
            "英语",
            `${onDay("episode").length} 条观看 · ${onDay("reading").length} 条阅读`,
            "BookOpen",
          ],
          ["guitar", "吉他", duration("guitar"), "Music2"],
          [
            "emotion",
            "情绪",
            onDay("emotion")[0]?.mood || "今天未记录",
            "Heart",
          ],
        ]}
      />
    </>
  );
}
export function More() {
  return (
    <>
      <PageHead title="更多" />
      <Section title="安排与记录">
        <Menu
          items={[
            ["tasks", "全部任务", "查看、修改和整理任务", "ListTodo"],
            ["calendar", "日历", "固定日程与时间安排", "CalendarDays"],
            ["inbox", "收件箱", "处理快速记录", "Inbox"],
            [
              "data",
              "数据",
              "收入、学习、健康与生活记录",
              "ChartNoAxesCombined",
            ],
            ["plan", "提前安排", "选择每天的重点", "ListChecks"],
            ["goals", "目标", "月度、季度与长期目标", "Target"],
            ["sales", "销售", "客户、跟进与成交记录", "Users"],
            ["projects?status=archived", "已归档项目", "", "Archive"],
          ]}
        />
      </Section>
      <Section title="管理">
        <Menu
          items={[
            [
              "settings",
              "设置与同步",
              "云端登录、通知、备份和回收站",
              "Settings2",
            ],
            ["cover", "打开封面", "", "PanelsTopLeft"],
          ]}
        />
      </Section>
    </>
  );
}
