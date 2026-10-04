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

## Phase 5A + 5B：只读 Tracker（2026-10-04）

本阶段仅建立代码内置定义、旧记录 Adapter、统一读取接口和 Data 指标列表。没有 tracker/trackerEntry 持久化记录，没有历史重写、双写、SQL migration 或 IndexedDB 升级；原业务录入、Review、Today、Sales、通知和导入导出保持原实现。停止于 5B。

### 来源和口径

- sleep.duration：sleep.minutes，latest；按醒来日期，使用已有扣除夜醒后的分钟。
- body.weight / height / waist / arm / shoulder：body 对应字段，latest；体重默认显示，其余在其他身体测量中。真实代码没有体脂、臀围。
- workout.minutes：workout.minutes，sum；不含 routine 计划。
- study.minutes：study.minutes，sum；仅专业课，不叠加 Focus。
- english.minutes：episode.minutes + reading.minutes，sum；word 没有明确分钟，不推算。
- guitar.minutes：guitar.minutes，sum；曲目、BPM、录音留在原页。
- emotion.intensity：emotion.intensity，latest；保留 mood 标签，范围为 1–5，不是示例的 1–10 心情分；页面不跨情绪状态展示平均强度。
- income.amount：income.cents，sum，整数分；显示已录公众号收入，不含 deal、不假设账号已全部填齐。

所有定义包含 id/name/type/unit/category/aggregation/target/sourceKey/active。target 为 null，不创建目标。类型只有 number/duration/score/money；聚合支持 sum/mean/latest。定义为只读代码，不是用户可编辑表达式。

### 稳定读取接口

createTrackerReader(rows) 基于当前账号 app.rows 构造内存快照，提供 getDailyValue、getRangeValues、getWeeklyTotal、getAverage、getRecordedDayCount。范围两端包含；周总量从传入起始日期起连续七天，仅接受 duration/money，返回范围和记录天数。平均为有效每日值的平均，不按原始记录数量加权。缺失 value=null，显式 0 仍有效；无记录周总量为 null。

Adapter 不导入存储或同步模块。输出带 trackerId/date/value/observedAt/note/label/sourceKind/sourceId；不修改来源。非法日期、空值、非有限数字、非法评分不进入统计，不回写修复。记录变更通过原 db.subscribe 更新 app.rows 后重算。

latest 使用睡眠 wake 或情绪 date+time；同一日存在缺时间的候选时，对整组以 kind/id 稳定排序选择，返回 uncertainOrder 并明确显示无法确认先后。body 当前没有可靠测量时间，不能用同步顺序、updatedAt 或随机 ID 假称真实时间；ID 仅作确定性回退。时间相同时也以 kind/id 打破平局。

### Data 界面

保留数据页面标题与旧模块路由，使用紧凑列表。点击指标或记录链接打开原业务页面；不改变录入方式。7/30 天仅折叠显示每日汇总、记录天数和适用指标的日均，不增加复杂图表、趋势一级页或自定义创建。跨午夜和返回前台更新当天。

### 验证

- npm test：44 项通过，含新增 5 项 Tracker 测试；既有备份、IndexedDB、模拟双端 CAS、SQL/RLS 测试继续通过。
- npm run test:e2e：30 项通过，8 项按设备范围跳过，无失败。新增桌面/手机测试核对全部主要指标、原路由、30 天汇总、刷新、备份行完全不变、删除恢复、无 pageerror 和无横向溢出。
- npm run build：通过，保留现有主包大于 500 kB 警告。
- npm run test:production：4 项通过，新增在 /action-workbench/ 下从原吉他表单录入、Data 读取、刷新及返回原记录的测试。

未验证真实 Supabase 往返和 Android 真机。此阶段没有新 kind 或同步协议变化，现有离线应用壳、附件二进制不同步和 APK 签名边界不变。缺时间旧身体记录无法还原实际先后；缺失或非法值不等于零。未进入 5C、自定义 Tracker、Weekly Review 或 Insight。

## Phase 6：Weekly Review（2026-10-04）

基于 main 的 dac4773 实施。本阶段为事实汇总、人工复盘与下周重点确认，停止于 Phase 6。复盘入口增加每日/每周，旧 Summary 表单、summary record、通知别名和 Command Center 写每日小结仍复用原实现。每周路由为 #review?view=weekly&week=YYYY-MM-DD，任一日期归一化为周一；默认本周，支持上周与历史周。

### 统一周期与事实口径

- Asia/Shanghai 自然周：周一 00:00 至周日 23:59，所有模块共用 start/end。带时区时间转换为北京时间；无时区本地 datetime 按 +08:00；日期范围包含两端。
- 计划任务按当前 task.date 落在周内、未删除且非 cancelled；本周完成按 status=done 且 completedAt 落周内。完成任务可包含跨周/未排期任务，单独标注；计划完成率和 Top 3 完成数只取本周计划与本周实际完成的交集。缺完成日期不猜测，提示数量。改期、重开或更改重点后历史按当前记录重算，不是假定的不可变计划快照。
- 项目活动：本周关联任务完成、新增 projectNote.createdAt、仍保留的 project.completedAt（completed/archived）。不使用 updatedAt 推断状态变化或沟通；笔记编辑不当作新增。只显示有效显式 nextAction，不自动建议。总关联任务进度和状态显示当前值，历史周不还原当时状态。
- 当前 active 项目在所选周无上述活动显示未见记录；项目已知创建/开始时间不晚于参考日才参与，未知时间只支持本周无记录判断，不推断七天停滞。最近七天以所选周末与今天较早者为参考日，明确区间；新项目不足七天不标七天无推进。
- Focus 无会话历史，周总量为 null，界面显示无法精确统计。另列本周完成任务 actualMinutes 的累计值及覆盖任务数，明确可能跨周、不等于本周投入；不读取当前 focus.elapsed 伪造历史。
- 学习/英语/运动/吉他、平均睡眠、体重、情绪、公众号收入复用 createTrackerReader；周总量和记录日数来自统一 Reader，不重写 Adapter。英语仅 episode+reading；专业课不叠加 Focus。所有缺失保持 null，明确 0 可统计；没有运动记录不能称为运动零分钟。
- 睡眠平均只对有效日值计算，并显示 recordedDays/7。体重取周内首末有效日，至少两个不同日期且首末无同日先后歧义才计算变化。情绪显示有效记录条数、天数和最后状态/强度，不平均不同情绪方向。
- 收入继续以 income.cents 为来源，显示已录公众号收入及覆盖天数。Sales 直接读取 client.added 和 deal.date：成交数为唯一 clientId 数、销售金额为有效整数 cents 合计；成交记录数量和缺金额情况另列。跟进仅统计本周完成且带 clientId 的任务，不称为完整客户沟通次数。公众号和销售分项，不相加。
- 自动提示仅陈述记录数、完成数、缺失覆盖情况，没有 AI、建议、因果分析或任务修改。

### 保存和兼容

新增 weeklyReview kind，ID 为 weekly-review:<周一日期>；payload 只保存 weekStart/weekEnd/progress/blocker/stop/nextMain/priorityProjectIds/createdAt/updatedAt，保留未知扩展字段，不复制自动统计。下周最重要结果必填，可另选最多三个现有项目；没有项目也可保存一个重点结果。删除/待同步的已选项目保留引用并可取消，不静默移除。

IndexedDB 数据库名、版本、store、scope、软删除和备份 format/version 不变；KINDS 添加 weeklyReview，使新版可导入旧备份及新备份，旧版不能导入包含新 kind 的备份。保存走原 app.save/db.put/CAS，既有业务记录不改写。同步识别 weeklyReview 对应 kind CHECK 23514，保留 dirty 并继续其他旧类型，不吞掉 payload/网络/权限错误；设置提供对应升级脚本。

supabase/migrations/202610040001_weekly_review.sql 仅在事务中扩展 kind 白名单，保留原所有类型、RLS、RPC，不迁移 payload。需要在原 Supabase 项目执行，实际云端尚未执行/验证；本次仅通过 PGlite 测试。不应在已有新类型记录后执行旧脚本缩回白名单。

### 验证

- npm test：55 项通过，新增周边界、跨周/取消/缺完成时间、Top 3、Tracker 覆盖、体重首末歧义、分项收入/CRM、真实项目活动、部分周与七天窗口、Focus 不伪造和 payload 测试；增加周复盘备份/双端 CAS/删除恢复和旧服务器不阻断上传测试。
- npm run test:e2e：32 项通过，8 项设备范围跳过；周复盘新增桌面/手机用例。验证周切换、历史周、人工填写、项目选择、保存刷新、非 weeklyReview 原始备份行完全未变、移动端无横向溢出和无 pageerror；Daily、命令中心、原记录模块回归通过。
- npm run build：通过，原主包大于 500kB 警告保留。
- npm run test:production：5 项通过，包含 Pages 子路径周复盘保存刷新及每日入口。
- .qa/weekly-desktop.png 与 .qa/weekly-mobile.png 是测试截图，已查看手机截图；截图不提交。

尚未验证真实 Supabase 双端往返、Android 真机/通知/覆盖安装。历史 Focus session、项目暂停/重开时间、完整销售沟通和过去任务计划快照无法由当前模型精确还原，页面与统计接口明确相应限制。未实施 Phase 5C 或 Phase 7。

## Phase 5C：统一记录入口（2026-10-04）

基于 main 的 75c03be 实施。Data 每行提供轻量「+ 记录」按钮，指标名称仍链接原业务页面，折叠历史与 7/30 天读取保持原实现。只统一入口，旧业务 record 仍为唯一数据来源。没有新增 kind、trackerEntry、SQL migration、IndexedDB 升级、双写或历史迁移；没有自定义 Tracker、AI、Insight，也没有修改 Today / Projects / Weekly Review 的流程。

### 入口与编辑器复用

| 指标 / sourceKey | 记录动作 | 唯一写入 kind |
| --- | --- | --- |
| sleep.duration | 在 Data 打开原完整睡眠编辑器；当天已有记录则编辑该记录 | sleep |
| body.weight / height / waist / arm / shoulder | 共用原身体测量编辑器，支持一次填写多项 | body |
| workout.minutes | 在 Data 打开原训练编辑器 | workout |
| study.minutes | 在 Data 打开原复习编辑器，科目可选；课程页面仍按当前科目预填 | study |
| english.minutes | 跳转原 English 页，通过老友记 / 英文阅读 / 单词表达入口记录 | episode / reading / word |
| guitar.minutes | 在 Data 打开原练琴编辑器 | guitar |
| emotion.intensity | 在 Data 打开原情绪编辑器，保留状态与完整上下文 | emotion |
| income.amount | 跳转原 Income 的「记收入」页，按账号填写金额 | income |

src/features/records/editors.js 小范围提取原 openRecord 与六类表单；旧页面和 Data 共用同一函数、FormDialog、草稿键、校验、app.save 和保存通知，没有复制表单。src/features/trackers/recording.js 只分发入口，不写存储、不调用 Adapter 反向生成数据。保存完成沿用现有 db.subscribe → app.rows → createTrackerReader 重算，无需刷新。

睡眠继续使用上床、估计入睡、最终醒来、实际起床、夜醒次数与清醒分钟，通过原 sleepMinutes 扣除夜醒并校验醒来日期、同日重复。重复点击当天记录进入编辑，不重复新增。其他允许多条记录的业务仍为新增入口。

### 真实字段与边界

- 身体字段为 height/weight/waist/arm/shoulder，当前没有体脂、臀围或测量时刻字段；未补造字段或改变 latest 口径。
- 训练用 exercises 文本保存动作、组数、次数和重量，并保留 feeling/discomfort/note，没有扁平化为分钟记录。
- 学习保留 subject/topic/minutes/questions/correct/wrong/material/next；课程与考试安排仍在 Courses 页。
- 吉他保留 content/song/minutes/bpm/difficulty/next/note；录音添加、更换与播放继续在原 Guitar 记录行，编辑保留 attachmentId/attachmentName 和未知扩展字段，二进制仍只在本设备。
- 情绪实际为 mood + intensity（1–5），上下文为 trigger/behavior/adjustment/result，不改为文档示例的 1–10 或仅 intensity。
- 英语时长仍只取 episode.minutes + reading.minutes；word 不产生时长。阅读继续关联 book、页码与完整校验，新书管理留原页面。
- 收入金额仍为整数 income.cents，保留 accountId/track/date/enteredAt，按账号与日期的原 ID 保存。没有账号时继续引导添加账号，不写来源不明的金额。

本次未扩展 Command Center 或 Add Menu；Data 已提供全部系统指标的记录入口。Sales、原业务页面的其余功能、通知及同步协议保持现状。

### 验证

- npm test：55 项通过，含既有 IndexedDB、导入导出、模拟双端 CAS、Supabase SQL/RLS 和 Tracker 只读测试。
- npm run test:e2e：38 项通过，8 项按设备范围跳过。新增三组测试各在桌面/手机执行，覆盖全部八类入口、四个次级身体指标共用表单、夜醒计算与同日编辑、学习校验、同日多次吉他汇总、完整旧字段、情绪方向、英语三种来源、收入账号与赛道、刷新、备份跨 scope 导入、旧扩展字段和录音引用保留、无 pageerror 与无横向溢出。已有导航、移动 Add Menu、Command Center、Today、Projects、Weekly Review 回归通过。
- npm run build：通过；保留已有主包超过 500kB 警告。
- npm run test:production：6 项通过，新增 Pages 子路径直接从 Data 录入、即时读取、刷新和返回原吉他详情，检查资源请求与 pageerror。
- 查看 .qa/data-recording-mobile.png，维持列表布局；QA 文件不提交。

首次同时运行 E2E 与 production 时，两个既有 Command Center 用例在初始 page.goto 等待 load 阶段超时；随后单独重跑完整 npm run test:e2e，38 项全部通过、8 项设备范围跳过。未修改命令中心或放宽断言；该次加载超时仍作为测试环境稳定性边界记录。

尚未验证真实 Supabase 双端往返、Android 真机录入/通知/覆盖安装。本阶段不改变 schema 或同步协议，不需要执行新的数据库脚本。英语来源选择、书籍管理、按账号收入录入、吉他录音附件和训练计划继续通过原页面完成。停止于 Phase 5C，未进入 Phase 7。

## Phase 7：Rule-based Insight（2026-10-04）

基于 main 的 6774e80 实施。只提供运行时「事实 → 规则 → 简短提示」，没有 insight kind、持久化结果、SQL migration、IndexedDB 升级、LLM 调用、自然语言问答、诊断、医疗建议、因果推断、自动建议或任务／项目修改。Data 统一录入、Today 决策入口、原业务模型与同步协议保持原实现。

### 数据层与日期

src/features/insights/selectors.js 建立 scope 内的只读计算上下文：复用 createTrackerReader(rows)、weeklySummary、weekRange、timestampDate。周复盘传入已有 summary，避免重复算其任务统计。周复盘的项目活动日期被小范围提取为 projectActivityDates，并复用 projectTasks；Weekly Review 与 Insight 共用相同的任务完成、新增笔记和保留的完成状态来源，不使用 updatedAt 推测活动。

所有窗口使用北京时间业务日期、两端包含。当前入口参考日为今天；历史周复盘参考日为所选周日；本周参考日为今天。最近 7 天为 reference-6 至 reference，前 7 天为 reference-13 至 reference-7；另有最近 14、30 天。任务和重点仍按统一自然周计算，不另造滚动计划统计。未来周不产生提示。历史周使用目前仍保留的任务／记录重算，不声称还原过去的任务计划快照。

时长、金额、平均和记录天数均从 Tracker Reader 的有效日汇总读取，不再实现 Adapter；14/30 天总量仅累加 Reader 返回的有效日值，全部缺失时仍为 null。账号集中度复用已有 adaptRecords 的合法 income.cents，再按真实 accountId 分组，分母为 Reader 已录总金额。不推测未知金额或补零，忽略删除、非法日期和非法数值；趋势总量溢出或金额超过安全整数范围时不生成伪精确提示。

### 第一批十条规则

| 规则 | 真实来源 | 阈值／最低样本 |
| --- | --- | --- |
| 项目 14 天未见推进 | project.status/createdAt/startDate；task.projectId/status/completedAt；projectNote.projectId/createdAt；有效 project.completedAt | 当前 active，已知创建／开始覆盖完整 14 个业务日期，区间没有可确认活动；新项目、年龄未知、未来开始、存在未标日期的完成任务／笔记时不提示 |
| 周复盘未保存 | weeklyReview.weekStart 或既有规范 ID | 当前入口检查上一个已结束自然周；历史周入口检查所选已结束自然周；删除记录不当作已完成 |
| 计划完成率 | weeklySummary.tasks | 计划至少 5 项且计划内完成率 <40%；取消排除、跨周完成不作计划内完成；本周未结束时明确包含尚未到期计划 |
| Top 3 完成情况 | weeklySummary.tasks.top/topDone | 至少 3 项且完成率 <40%；与计划完成率同组，只展示其中一条 |
| 睡眠日均变化 | sleep.minutes → sleep.duration | 两期各至少 3 个有效记录日，日均差绝对值 ≥45 分钟；展示两边平均值、记录天数与日期 |
| 睡眠记录覆盖 | sleep.duration 的 recordedDays | 最近 7 天有效记录日数 ≤2；只说明趋势依据不足 |
| 运动低记录 | workout.minutes → workout.minutes | 最近 14 天无有效时长，或有效记录合计明确为 0；分别用「没有记录到有效时长」与「已录合计 0 分钟」，不判断实际行为 |
| 学习记录变化 | study.minutes；episode.minutes + reading.minutes | 两期各至少记录 3 天，前期 >0，总量变化绝对比例 ≥50% 且相差 ≥30 分钟；专业课／英语仅保留比例变化最大的一项，不读取 word 分钟 |
| 已录公众号收入变化 | income.cents → income.amount | 两期各至少记录 3 天，前期 >0，金额变化绝对比例 ≥50% 且相差 ≥¥100；展示两期覆盖，不解释为全部账号的完整收入 |
| 账号收入集中度 | income.accountId/cents/date + account.id/name | 最近 30 天至少记录 7 天、合计 ≥¥100，单一账号份额 ≥80%；所有正收入须能关联命名账号，否则跳过；按账号 ID 分组，不按当前赛道倒推历史来源 |

项目的 active 状态没有历史快照，因此历史周不生成“当时进行中项目停滞”的提示。14 天无推进仅陈述没有可确认记录，不声称项目一直处于 active 或没有实际工作。保留的 project.completedAt 仅在 completed/archived 状态被视为完成记录，与原周复盘口径一致；状态重开清掉的历史不伪造。

学习、收入零基准不计算百分比变化；已录 0 仍是有效数据，不等于缺失。比较不要求两期完全填齐，因此文案始终为“记录／已录总量”，同时明确各期天数。收入不含 deal、销售不进入通用 Tracker；本阶段没有新增 CRM 洞察、身体／情绪判断或 Focus 趋势（现模型无历史 session）。

### 结果与展示规则

每个结果包含稳定 id、type、severity（info/attention）、title、description、evidence、actionLabel/actionRoute。evidence 保存运行时来源字段、明确规则、日期范围、有效样本与相关数值；不复制进数据库。UI 展开「规则与依据」显示中文来源和依据，隐藏实现字段名称。

排序：项目 → 周复盘 → 计划／重点 → 睡眠 → 学习／运动 → 收入。同 ID 去重；项目最多 2 条，其余同组最多 1 条。计划／Top 3 同组，专业课／英语同组按变化比例降序，收入变化／集中度同组且变化优先。相同优先级与幅度按稳定 ID 排序，输入顺序不影响结果。

「更多 → 值得注意」提供 #insights 列表，默认最多 5 条；没有新增一级导航。「每周复盘 → 值得注意」最多 3 条，明确参考日期及此前对比周期。每条有原项目／业务页／对应周复盘行动链接；历史周缺复盘链接进入所选周，不误跳到当前周。Daily 和 Today 不显示 Insight，旧路由、手机 Add Menu、Command Center 保留。

保存原始业务记录、新增项目笔记或保存周复盘后，沿现有 db.subscribe → app.rows 更新自动重算；全页使用每 30 秒与 visibilitychange 更新当天，周复盘复用原日期刷新。没有持久化 Insight、跨账号缓存或第二套历史真相。

### 修改范围与验证

- 新增 src/features/insights/{rules.js,selectors.js,InsightList.jsx,Insights.jsx,insights.css}。
- 小范围修改 WeeklyReview.jsx / weekly/selectors.js、main.jsx、navigation.js、NavigationPages.jsx。
- 新增 tests/insights.test.js 与 tests/e2e/insights.spec.js；补充 tests/production/pages.spec.js。
- npm test：69 项通过（新增 14 组规则测试），覆盖业务日期边界、真实活动／未知时间、任务交集和阈值、Top 3 去重、睡眠均值与样本、缺失／显式零、学习和金额比较、来源集中度、排序／数量上限、原路由及无 Focus 伪统计；既有存储、备份、同步 CAS、SQL/RLS 测试通过。
- npm run test:e2e：42 项通过，8 项按设备范围跳过。新增桌面／手机测试验证 More 入口、五条上限、周复盘三条上限、历史参考周、来源依据、项目与周复盘 action、保存后提示更新、刷新、查看前后备份行完全相等、Today 无提示、无模型请求、无 pageerror 和无横向溢出；已有功能回归通过。
- npm run build：通过，保留原有主包超过 500kB 警告。
- npm run test:production：7 项通过，新增 Pages 子路径 Insight 路由、刷新和对应周复盘 action；检查资源请求及 pageerror。
- 已查看 .qa/insights-mobile.png，保持文本列表，无警报配色或卡片墙。QA 图片不提交。

未验证真实 Supabase 双端、Android 真机与覆盖安装；本阶段不变更云端／本机存储结构。现有历史限制仍包括 Focus session、项目状态完整历史、任务计划快照、完整销售沟通。规则均不补造这些数据，不预测未来，不做因果、心理或医疗判断。止于规则型 Insight，不进入 AI Insight 或后续 UI 大重构。
