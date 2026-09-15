# 小松工作台 · Personal Workbench

一个给自己使用的行动与成长工作台。桌面网页和 Android 应用共用这一套 React 界面、数据模型和 Supabase 同步层。

## 本机运行

```bash
npm install
npm run dev
```

打开终端显示的本地地址。首次使用从封面进入；所有没有登录云端的记录都保存到当前浏览器的 IndexedDB 中，刷新不会丢失。

## 连接云端

1. 在 Supabase 创建项目和一个邮箱密码登录用户。
2. 把 `supabase/migrations/202609150001_action.sql` 的内容在 SQL Editor 执行。
3. 在设置与同步中填写项目 URL 和 Publishable key（旧项目也可使用 anon 公钥），再登录。

客户端不会接受 `service_role` / `sb_secret_` 密钥。数据库写入只走带版本比较的 RPC，同一条记录在电脑与手机同时修改时会显示冲突供选择。没有云端配置时，手动记录和导出仍可用。

## 安卓应用

```bash
npm run android:sync
npx cap open android
```

本项目使用 Capacitor 8。安卓 13+ 的通知权限由应用内设置申请；晚间 22:00 提醒使用本地通知，不需要推送服务器。小米设备仍需在真机上允许通知、自启动和电池后台运行，并验证锁屏、重启后的表现。

当前开发机未安装 Android SDK/Java，因此仓库提供完整 `android/` 工程但没有在本机产出 APK。GitHub Actions 会在推送后构建 debug APK，产物可从 Actions 下载后安装到自己的手机。

## GitHub Actions

- `build.yml`：运行规则测试、构建网页并保存 `dist`。
- `android.yml`：使用 Java 21、Android SDK 和 Gradle 构建 debug APK。

## 数据与隐私

- `public/logo.jpg` 是用户提供的松鹤 Logo；设计稿和原始媒体不参与应用构建。
- `.env`、签名密钥和个人记录不会提交。
- 导出功能生成 `action-backup-日期.json`，导入采取只合并新记录策略。
- AI 复盘需要自己部署 Supabase Edge Function 并配置 AI 服务密钥；没有配置时手动复盘不受影响。
