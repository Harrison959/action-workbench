import React from "react";
import { PageHead, Section, Link, Icon } from "../ui";
export { Data } from "../features/trackers/Data";

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
            ["insights", "值得注意", "查看少量事实变化及规则依据", "ListFilter"],
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
