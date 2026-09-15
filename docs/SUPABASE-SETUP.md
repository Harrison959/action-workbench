# Supabase 首次配置

这份应用没有内置任何个人数据。按下面顺序配置自己的项目：

1. 在 Supabase Dashboard 新建项目，在 Authentication → Users 创建自己的邮箱密码账号。
2. SQL Editor 执行 `supabase/migrations/202609150001_action.sql`。
3. 在 Project Settings → API 复制 Project URL 与 Publishable key（老项目显示 `anon` 的公开 key 也可以）。仅把这两项填入应用“设置与同步”。
4. 先用电脑登录，再在手机登录同一账号。登录前在两端录入的本机数据不会自动混合；打开设置里的“把本机记录合并到此账号”才会只合并新记录。

## AI（可选）

AI 不影响手动记录。若要启用，在 Supabase CLI 部署 `supabase/functions/review/index.ts`，并设置：

```text
ACTION_OWNER_ID=你的 auth.users.id
AI_API_KEY=你的 AI 服务密钥
AI_MODEL=你选择的模型
AI_BASE_URL=https://你的兼容 OpenAI Chat Completions 地址/v1
```

这些变量只存在 Edge Function 服务端，不能写进 `.env` 或前端。AI 函数会验证登录用户、限制记录数量，并要求模型只基于已提供记录回答。

## 备份

设置 → 导出与备份生成 JSON。导入是合并操作，不覆盖已有相同 ID 的记录；附件目前只保存在录制设备，需单独处理。
