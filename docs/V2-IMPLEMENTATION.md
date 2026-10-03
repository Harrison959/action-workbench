# V2 架构分析与实施记录

对应需求：根目录 `V2_REDESIGN.md`（用户提供的完整原文）。本次范围为 Phase 1、Phase 2，不实施后续全部阶段。

## 现状与复用

| 层级 | 现有实现 | 本次处理 |
| --- | --- | --- |
| 入口与路由 | Vite + React；`main.jsx`、hash 路由；Today、Tasks、Focus、Goals、Inbox、Schedule、Summary、Plan、Cover、八条主线、Settings | 提取路由和导航；旧 hash 保留别名，GitHub Pages 不依赖服务端 rewrite |
| 核心页面 | `CorePages.jsx`：任务、专注、目标、日程、计划、小结、收件箱；共享 `ui.jsx` 表单/图表/列表 | 沿用功能；提取任务编辑和任务行供项目复用 |
| 业务记录 | `Workstreams.jsx`：公众号分账号收入/赛道、销售/跟进/成交、睡眠、课程、英语、身体/训练、吉他、情绪 | 保留全部记录和页面，收入等入口移到数据；销售移到更多 |
| 本地数据库 | `action-workbench` IndexedDB v1：records、meta、files；scope 区分本机/账号；软删除 | 不升数据库版本、不迁移已有 record；扩展类型白名单 |
| 同步 | `cloud.js`：会话、定时/联网/前台同步、分页拉取、CAS RPC 上传、记录级冲突 | 通用 envelope 复用；新类型在服务器未升级时保持本地待传，避免阻断旧类型 |
| 导入导出 | JSON `action-backup` v1，合并导入，已有 ID 优先、不同 scope 重新标 dirty | 保持格式；接受旧类型与新增类型；新备份不能交给旧版应用导入 |
| 提醒 | Capacitor 本地通知、每天计划提醒、日程提醒、网页前台提醒 | 保留插件、权限、通知 ID 和原有目标路由 |
| Android | Capacitor appId、原生工程与 GitHub Actions 构建 | 保持标识、数据库源；同步 Web 资源；本机缺少 JDK/Android SDK 时不宣称 APK 已验证 |
| 发布 | 相对 base、hash 路由、Pages Actions 注入公开 Supabase 参数 | 不更换部署源/仓库，不暴露账号数据/管理密钥 |

## 记录模型

所有业务共用 envelope：`scope + id` 为本地主键；`kind`、`data`、`version`、`dirty`、`deleted`、`change`、`conflict`。云端主键为 `(user_id,id)`，`payload` 对应本地 `data`。保存替换 payload，调用者必须保留原有未知字段。

旧模型包括 task/goal/inbox/event、账号/收入、销售客户/日报/成交、睡眠、课程/学习、剧集/单词/书籍/阅读、训练/身体/计划、吉他/情绪、小结/每日计划、设置/专注。任务保留 `stream`、`goalId`、`date`、`top`、子任务文本、实际时长和完成时间，不强制转换为项目。

新增：

- `project`：title、description、status(active/paused/completed/archived)、startDate、dueDate、area、outcome、nextAction（关联任务 ID）、createdAt、completedAt。编辑保留未识别字段。
- `task.projectId`、`task.area`：可选；旧任务缺失时视为独立任务，不自动归属。
- `projectNote`：projectId、text、createdAt、updatedAt；独立记录，避免多人/多端编辑整个笔记数组互相覆盖。
- `progress`：读取时按非取消任务中已完成数量计算，不存第二份可冲突进度。无任务为 0；项目状态与任务百分比独立。
- 历史：基于实际创建、任务完成、笔记和项目完成时间展示；不是不可变审计日志，重开任务后完成事件相应消失。

## 兼容与同步风险

1. **不改旧 ID/kind/数据库名/scope**，不重置存储、不批量转写旧数据。归档/删除项目不级联删除任务或笔记；恢复后关联可重新显示。
2. 编辑旧任务必须保留 `stream`、`goalId`、额外字段；旧客户端若重新保存旧任务可能不理解关联。建议各端升级后再使用项目。旧客户端不能导入包含项目的新备份。
3. Supabase 原 SQL 有 `kind` CHECK 白名单，必须运行新增迁移。仅扩展约束，不改 RLS、登录、CAS 函数或历史 payload。publishable key 无权限执行管理 SQL；无法取得管理连接时需项目所有者在 SQL Editor 执行。
4. 服务器尚未升级时，新类型写入可能返回 23514。只识别新增类型对应的 kind 约束错误并保留 dirty，继续同步其他旧记录；网络/权限/其他约束错误仍报告失败，不伪装同步成功。
5. 保持版本冲突提示，不做静默最后写入覆盖；同步期间本地再修改，ack 只更新版本并保留 dirty。新建项目与任务分记录同步，短暂缺少父项时显示保留的关联，不丢任务。
6. 数据库 scope 隔离继续保留；不同账号不自动合并。截图、测试、演示均使用隔离浏览器/测试记录，不读取或覆盖真实用户数据。
7. IndexedDB 支持离线读写；现有 Web 未配置完整离线应用壳缓存，因此断网首次冷启动并非现有保证。本次不假称新增完整 PWA 离线启动。
8. Android 当前流水线为 debug 包，仓库没有稳定签名配置。保持 appId 不能独自保证覆盖安装；本次不改签名、不指导卸载，避免设备本地数据丢失。
9. files 附件原本单独存储，现有 JSON 导出和通用 record 同步不含附件二进制；本次不改变这一边界。

## 顺序和验收

1. **Phase 1**：七项桌面导航，五项手机导航；今天默认入口；更多/数据聚合旧页；快速添加；旧链接/通知入口兼容。运行单元测试、构建、桌面及移动端浏览器检查。
2. **Phase 2**：项目模型/列表/详情；关联旧任务和新增任务；下一步、计算进度、状态、笔记/真实历史；备份扩展和同步迁移保护。验证项目生命周期、旧记录不变、离线读写、冲突/跨端协议、导入导出和移动端交互。
3. 后续（本次不实施）：Today 行为重构 → Command Center → Tracker → 周复盘 → Insight → 完整 UI 精修。旧功能保持可用，不以空壳替换。

实际测试和部署状态记录在下方，未执行的检查不得标记通过。

### Phase 1 验证（2026-10-03）

- `npm test`：12 项通过。
- `npm run build`：通过；原有大包体积警告保留。
- `npx playwright test tests/e2e/navigation.spec.js`：桌面/Pixel 7 共 4 项通过；检查所有旧业务页面、hash 别名、历史返回、无横向溢出、任务/收件箱/日程添加与任务刷新保留；未捕获 pageerror。
- `.qa/desktop-more.png`、`.qa/mobile-more.png` 已人工查看。浏览器工具首次运行缺少 Chromium，安装后完成验证。

### Phase 2 验证（2026-10-03）

- `npm test`：25 项通过。包括旧类型统计规则、项目模型/下一步/进度/生命周期、IndexedDB v1 兼容、跨 scope 隔离、新旧备份、软删除、双设备 CAS 冲突及选择保留、上传途中再次编辑、新类型失败不阻断旧类型。
- SQL 在 PGlite 内嵌 PostgreSQL 中运行：先执行原始建表脚本，写入旧记录，再重复执行新迁移；旧记录不变，所有支持类型可写，RPC 冲突返回正确，authenticated 无直接写权限，账号互相不可见，anon 无表/RPC 权限。这不等于已执行真实 Supabase 升级。
- `npm run test:e2e`：桌面/Pixel 7 共 10 项通过。覆盖旧页面入口与添加、完整项目生命周期、收件箱转换及防重复、新旧任务关联、专注入口、笔记、离线创建/完成、刷新保留、软删除恢复、实际 UI 导出后在隔离浏览器 UI 导入；未捕获 pageerror。
- `npm run build`：通过。保留现有主包体积警告；移除未使用的 Sculpture lazy 引用，避免打包无入口的 3D 资源。
- `npm run test:production`：1 项通过；生产构建置于 `/action-workbench/` 子路径，项目详情刷新、Logo 和资源加载、旧日历/复盘 hash 正常，没有资源 404 或运行异常。
- `npm run android:sync`：通过，识别并保留 App/Filesystem/LocalNotifications/Share 四个插件。appId、通知权限与通知模块未更换。
- 代码在 `codex/v2-navigation-projects` 分支，按两阶段独立提交。真实 Supabase 管理权限、手机真机通知和覆盖安装未验证。Android 完整编译由分支 CI 进一步验证，结果另行记录。
