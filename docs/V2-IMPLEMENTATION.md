# V2 架构分析与实施记录

对应需求：根目录 `V2_REDESIGN.md`（用户提供的完整原文）。Phase 1、Phase 2、Phase 3 已完成并合并；本次后续工作仅实施 Phase 4（Command Center），停止于 Phase 4。

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
3. **Phase 3（独立后续实施）**：Today 决策入口；详细规则与验证见下方。Phase 4 在独立后续请求中实施，见下方；Tracker、周复盘、Insight 和全局 UI 精修仍不实施。旧功能保持可用，不以空壳替换。

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
- Android 完整 Gradle 编译已在 [Actions 37120998169](https://github.com/Harrison959/action-workbench/actions/runs/37120998169) 通过（实现提交 `d2be3ff`），产出 debug APK。真机通知和与旧安装包签名兼容尚未验证。
- 网页 CI 首轮发现收件箱二次转项目测试过早跳转列表页，已补充保存完成与详情显示等待；本机相关桌面/移动测试通过，CI 随最终提交重跑。
- 最终检查补充保留原有独立任务草稿 key 与桌面封面/专注全屏容器，快速添加与生产封面资源测试通过。
- 代码在 `codex/v2-navigation-projects` 分支，按两阶段独立提交，审阅入口 [PR #1](https://github.com/Harrison959/action-workbench/pull/1)。真实 Supabase 管理权限、手机真机通知和覆盖安装未验证；PR #1 已合并到 main（24b954d），Phase 1 / 2 已发布到 Pages；上述真实云端与真机验证边界仍保留。


## Phase 3：Today 决策入口（2026-10-03）

### 范围与复用

仅重构 Today，以及其复用任务行的紧凑显示。页面按「现在做什么 → 今日重点 → 今日时间线 → 快速记录 → 今日完成数」排列。统计卡片、首页英文口号和装饰性文案已移除；完整任务仍在 Tasks，项目与日历页面保持原有职责。没有实现后续阶段。

Today 从 CorePages 拆出为 `src/features/today/Today.jsx`，分离 selector、时间线 helper、分区组件、快速记录和局部样式。复用 TaskRow / taskEditor、openTaskFocus、eventEditor、现有 Inbox 和 app.save；没有第二套专注系统。Focus 读取也与入口一致优先 current-focus，避免旧记录与当前会话并存时打开错误任务。

### Next Action 的最终规则

1. 当前 Focus 对应未完成任务，且正在运行或确实处于暂停状态（elapsed > 0 或保留 started），优先显示。允许继续其他日期的在做任务。结束后仅保留 taskId、计时已清零的记录不作为暂停中的 Focus；失效或已完成任务跳过。
2. 进行中 Project 明确指定的 nextAction：任务必须属于该项目、未完成，项目开始日期不能在未来。任务安排今天才可参与；无日期任务仅在没有未完成今日计划时参与。未来或过期计划不会被静默改期。只使用显式指针，不使用 Projects 自动建议。
3. **保护明确当天重点**：存在未完成的可见 Top 3 时，项目下一步只有同为这些重点之一才可优先；否则选 Top 3 里最高优先级任务。完成的重点保留其展示位置，不以其他任务自动补位。
4. 没有上述候选时，选今日未完成任务中的最高优先级。
5. 没有合适候选时显示创建/选择任务入口，不替用户产生待办。

同层任务按 P1 → P2 → P3 → P4，缺失或未知优先级默认 P2；相同优先级按任务 ID 排序，避免同步拉取顺序变化导致推荐跳动。每项行动显示选择理由、项目、预计时间及可用优先级/截止信息。

项目暂停、归档、完成只影响「项目推荐」资格，不抹去用户已安排今天的任务；项目记录和任务记录原有独立生命周期不变。

### Top 3、日程与快速记录

- 读取当天 top 标记、排除取消和删除，最多显示三个；完成状态、独立序号、项目、预计时间、详情与专注入口复用现有操作。
- 历史或导入记录若超过三个重点，不批量修改记录，显示调整提示。允许编辑既有重点的内容，新增/移入第四项仍被拒绝。
- 时间线仅读取有明确开始时间的现有 Event，显示当天所有固定和可调整日程，按时间升序；任务 date 是计划日期，不推断为时刻。按 Asia/Shanghai 处理本地 datetime 与带时区数据；无时刻/无效/取消/删除记录跳过。
- Quick Capture 去首尾空白后保存 inbox 的 text/date/status=open，不要求分类。避免重复提交，失败保留输入。写入走原 IndexedDB / Supabase 同步通道。
- 进度为今日非取消任务的 done / total，不存冗余字段。完成与同步更新触发原 db.subscribe 后自动重算；跨午夜及页面恢复前台刷新今天日期。

### 兼容边界

不新增 kind / 数据字段 / 数据库版本 / SQL migration，不修改 db.js、cloud.js、通知、原生身份或项目模型。任务完成仍 spread 原记录，保留未知字段。补充 Tasks 对旧任务缺失 title/date/priority 的安全读取，避免从首页进入全任务时抛错。

只备份代码不能恢复已被用户后续修改的数据。本阶段没有破坏性迁移；代码回退仍可读取相同记录。现有项目类型的真实 Supabase 约束升级、离线 Web 首次冷启动、附件二进制同步和 APK 签名边界见前文，未新增承诺。

### 本地验证

- `npm test`：33 项通过（新增 8 项 Today selector / timeline 测试），原存储、同步冲突、导入导出、RLS 与旧记录测试继续通过。
- `npm run test:e2e`：桌面 / Pixel 7 共 20 项；含原 10 项和新增 Today 10 项。覆盖空状态、Top 3、推荐优先级、项目资格、运行/暂停/结束 Focus、日程排序、离线 Inbox 写入、完成即更新、详情编辑、未知字段保留、刷新持久化、窄屏长标题无横向溢出。
- 首屏检查：普通长度任务时第三个重点仍在手机视口内；正常与长标题桌面/手机截图保存在忽略提交的 `.qa/today-*.png`。
- `npm run build`：通过，现有主包 > 500 kB 提示仍存在；不在本阶段做全应用拆包。
- `npm run test:production`：生产子路径测试覆盖原项目/旧路由/封面资源，以及 Today 创建重点、专注入口、完成、收件箱和刷新持久化。
- `npm run android:sync`：通过，四个现有插件保留。本机无 JDK / Android SDK，完整 APK 编译需仓库 Actions 验证；真机通知、覆盖安装和真实云端双端同步仍需设备/管理权限验证。

### Git 与发布

基于 main 的 24b954d 开发，Phase 1 / 2 稳定代码以标签 `backup/before-phase3-today-20261003` 保留。本阶段独立分支 `codex/v2-today`，通过 CI 后合并 main；Pages 与 Android 沿用现有发布工作流。部署结果以实际 Actions 结果为准，不将本地通过等同于线上已发布。


## Phase 4：Command Center（2026-10-03）

### 实现范围

基于 Phase 3 已合并的 main（682ab25）开发。命令中心只负责选择与调用操作：没有 AI 解析、新的一级导航、数据库字段、kind、IndexedDB 升级或 Supabase migration；Today、Projects 页面与模型不变。

独立模块 `src/features/command/`：

- `CommandCenter.jsx`：全局快捷键、原生 dialog、组合框/结果选择、关闭与焦点交接。
- `commands.js`：固定命令清单、复用 Today selector 计算 Focus 命令候选。
- `search.js`：纯 substring 搜索、分组排序、平台快捷键判断与箭头索引。
- `actions.js`：复用 taskEditor、projectEditor、app.capture、eventEditor、openTaskFocus 和现有 hash 路由。
- `command.css`：局部样式与桌面触发按钮；无渐变或复杂动画。

### 命令清单（13 项）

默认优先顺序：新建任务、快速记录到收件箱、新建项目、开始/继续专注、添加日程，其后为写每日小结，以及打开今天、项目、日历、复盘、收件箱、数据、更多。

写每日小结使用现有 Review 表单。`review?write=<请求时间>` 仅是界面打开请求，每次跳转都回到今天并聚焦首个小结输入；后续手动查看历史日期仍可用，不新增小结记录格式或重复复盘系统。

Focus：有效运行/暂停会话显示「继续专注：任务名」，计时与状态保持；其他情况使用 Today 的完整 Next Action 规则选任务。无候选进入既有 Focus 选择入口。补充现有 openTaskFocus 对失效运行记录的校验：已完成、取消、删除或找不到的任务不会阻挡用户明确开始下一项；有效运行任务的切换保护继续保留。

### 搜索规则

- 无输入（含纯空白）仅显示固定命令，不倾倒全部项目和任务。
- 输入去首尾空白后，不区分大小写 substring 匹配；顺序为命令 → 项目 → 未完成任务。
- 命令匹配中文名称及少量直接别名（Today / Projects / Calendar / Review / Inbox / Data / More，开始/继续专注）。不做语义匹配。
- 项目仅搜索未删除、未完成、未归档的标题，包含进行中和暂停项目；任务仅搜索未删除、非 done / cancelled 的标题，旧记录缺少 status 仍可搜索。
- 同组按标题、ID 稳定排序；点击项目进入 Project Detail，点击任务打开现有详情编辑器。全部数据取自当前账号的现有 app.list，随存储订阅更新，不建搜索索引记录或请求额外云端查询。

### 键盘、焦点与移动端

- 桌面宽度 > 800px：Windows/Linux Ctrl+K，macOS Cmd+K；再次按下或 Esc 关闭。
- 不拦截 Shift/Alt 组合、另一平台修饰键、按住重复事件、输入法组字、已处理事件；编辑输入框/富文本、其他原生弹窗及数据未加载时不拦截。
- 打开后搜索框聚焦；↑/↓ 循环选择，Enter 执行，鼠标可点击；无匹配时 Enter 不执行。Tab 仍能访问关闭按钮，不将其 Enter 误当成结果执行。
- 原生 dialog 限制背景交互。关闭先释放 modal 再恢复原焦点；跳转完成后聚焦目标页标题；命令打开表单时，通过可选 `focusFirst` 聚焦首个字段。该参数只用于 UI spec，不写入业务记录，原入口默认行为不变。
- 桌面顶栏增加「搜索与命令」低调入口，主导航仍七项。手机不显示该按钮、不拦截快捷键，底栏五项和原 Add Menu 完整保留。

### 修改文件

上述五个 command 文件；接入：`src/main.jsx`、`src/components/AppNavigation.jsx`；复用支持：`src/ui.jsx`、`src/pages/CorePages.jsx`、`src/features/tasks/focus.js`；测试：`tests/command.test.js`、`tests/e2e/command.spec.js`、`tests/projects.test.js`、`tests/production/pages.spec.js`；本实施记录。共 15 个文件。

### 本地验收

- `npm test`：39 项通过，新增六项命令/搜索/快捷键/Focus 测试，原有统计、存储、同步、备份、RLS 与 Today 测试保留。
- `npm run test:e2e`：28 项通过，8 项按设备范围跳过（手机不运行七个桌面快捷键用例，桌面不运行一个手机专用用例），没有测试失败。覆盖 Ctrl/Cmd 切换、Esc、输入框聚焦、箭头循环、Enter、无结果、关闭按钮 Enter、关闭焦点恢复、七个页面导航、全屏 Focus、真实项目/任务搜索、任务/项目/日程/Inbox 创建、刷新持久化、未知字段保留、当天小结与历史切换、运行/暂停/失效 Focus；原 20 项 E2E 继续通过，未捕获 pageerror。
- `npm run build`：通过；保留原主包体积提示，不在本阶段全局拆包。
- `npm run test:production`：3 项通过，新增生产命令测试；原 Pages 子路径、资源、封面、旧路由、项目与 Today 持久化继续通过。首次用例在 reload 后过早发送快捷键，补充页面加载等待后通过。
- `npm run android:sync`：通过，原四个 Capacitor 插件保留；本机无 JDK/Android SDK，完整 APK 仍由 Actions 验证。
- `.qa/command-search.png` 已人工查看；测试使用独立浏览器、本地测试记录并关闭真实云端配置，没有访问或写入用户实际账号。

### 未验证边界与发布

真实 Supabase 多设备往返、macOS 实机、Android 真机与覆盖签名、通知仍需实际环境验证；本次 Cmd 逻辑通过模拟 Mac 平台的 Chromium 和纯函数测试，不冒称实机测试。原离线壳缓存和附件同步边界不变。

代码基于 `codex/v2-command-center`，Phase 3 旧版以标签 `backup/before-phase4-command-20261003` 保留。CI 验证后合并 main，沿用现有 Pages / Android 工作流；实际发布结论以对应 Actions 状态为准。
