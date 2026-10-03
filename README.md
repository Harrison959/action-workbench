# 小松工作台 · Personal Workbench

一个给自己使用的行动与成长工作台。桌面网页和 Android 应用共用这一套 React 界面、数据模型和 Supabase 同步层。

## 本机运行

```bash
npm install
npm run dev
```

打开终端显示的本地地址。默认进入“今天”；封面可以从“更多”打开。所有没有登录云端的记录都保存到当前浏览器的 IndexedDB 中，刷新不会丢失。

## 连接云端

1. 在 Supabase 创建项目和一个邮箱密码登录用户。
2. 新项目依次执行 `supabase/migrations/202609150001_action.sql` 和 `supabase/migrations/202610030001_projects.sql`。已有项目只需执行第二份升级脚本，不要重建表或清空记录。
3. 在设置与同步中填写项目 URL 和 Publishable key（旧项目也可使用 anon 公钥），再登录。

客户端不会接受 `service_role` / `sb_secret_` 密钥。数据库写入只走带版本比较的 RPC，同一条记录在电脑与手机同时修改时会显示冲突供选择。没有云端配置时，手动记录和导出仍可用。

## 安卓应用

```bash
npm run android:sync
npx cap open android
```

本项目使用 Capacitor 8。安卓 13+ 的通知权限由应用内设置申请；晚间 22:00 提醒使用本地通知，不需要推送服务器。小米设备仍需在真机上允许通知、自启动和电池后台运行，并验证锁屏、重启后的表现。

当前开发机未安装 Android SDK/Java；本机可运行 `android:sync`，完整 APK 编译由 GitHub Actions 验证。流水线当前使用 debug 签名，不保证与已安装版本的签名一致；覆盖更新前需核对签名，不能通过卸载来解决兼容问题而丢失本地记录。

## V2：导航与项目

桌面入口为今天、项目、日历、复盘、收件箱、数据、更多；手机底栏为今天、项目、添加、复盘、更多。所有旧页面仍可访问，`#schedule` / `#summary` 仍兼容。

项目支持完成结果、领域、日期、任务关联、下一步、按任务计算的进度、笔记、最近推进记录，以及暂停/完成/归档。删除项目仅进入回收站，任务和笔记保留。没有关联项目的旧任务继续使用。

云端升级前，项目与笔记会保存在本机待同步，原有类型继续上传；界面会提示升级，设置中可复制脚本。升级后点击“立即同步”。此期间新项目尚不能跨设备显示。各设备都应升级到支持项目的版本再使用新备份；旧版不能导入含新类型的备份。

完整架构、风险与阶段验收见 [V2 实施记录](docs/V2-IMPLEMENTATION.md)，需求原文见 [V2_REDESIGN.md](V2_REDESIGN.md)。本轮没有实施后续 Today 深度重构、Command Center、Tracker、周复盘或 Insight。

## 验证

```bash
npm ci
npm test
npx playwright install chromium
npm run test:e2e
npm run build
npm run test:production
npm run android:sync
```

测试使用隔离的 IndexedDB/浏览器上下文与内嵌 PostgreSQL，不使用真实用户账号或个人数据。PostgreSQL 测试覆盖新增迁移、RPC 版本冲突及 RLS；这不代表已在真实 Supabase 项目执行升级。移动浏览器验证不替代小米真机的锁屏通知和覆盖安装验证。

## GitHub Actions

- `build.yml`：运行单元/数据/SQL 测试、桌面/手机浏览器测试，构建网页并保存 `dist`。
- `android.yml`：使用 Java 21、Android SDK 和 Gradle 构建 debug APK。

## 数据与隐私

- `public/logo.jpg` 是用户提供的松鹤 Logo；设计稿和原始媒体不参与应用构建。
- `.env`、签名密钥和个人记录不会提交。
- 导出功能生成 `action-backup-日期.json`，导入采取只合并新记录策略。
- AI 复盘需要自己部署 Supabase Edge Function 并配置 AI 服务密钥；没有配置时手动复盘不受影响。
