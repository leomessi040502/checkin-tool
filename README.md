# check-in-tool（双人打卡工具）

两人共用的打卡网站：各自打卡、补卡、管理分类、设定目标与倒计时、查看统计，以及待办清单。
线上地址：**https://check-intool.online**（唯一有效的验收标准，不要用 localhost 当成果）。

## 技术栈

- React 19 + Vite 8 + React Router 7 + Tailwind CSS 3 + lucide-react
- Supabase（PostgreSQL + PostgREST + RLS 行级安全 + Auth）
- Cloudflare Workers（`wrangler.toml` 的 `[assets]` 静态资源 + `src/worker.js` SPA 回退 + 每日提醒定时任务）

UI 为商务成熟风：藏青 `primary-800 #1B2A4A` + 金色点缀 `gold-500 #C9A24B`，设计 token 在 `tailwind.config.js`，复用类 `.card` / `.section-title` 在 `src/index.css`。金色仅用于区块标题竖条、已完成标识、导航选中指示条与成就徽章。

## 目录速查

| 路径 | 内容 |
|---|---|
| `src/pages/` | 登录、打卡、目标、统计、我的、事项（待办 + 倒计时双子 tab） |
| `src/components/` | 各页面弹窗与卡片；`DatePickerModal.jsx` 是自绘日历（**不要用原生 `<input type="date">`**，手机端 iOS/微信 X5 会以空值触发 onChange） |
| `src/context/AuthContext.jsx` | 登录/注册/改名/改密/注销；注册上限 2 人 |
| `src/utils/` | 日期、连续天数、待办排序、带超时的请求包装 |
| `src/worker.js` / `src/reminder.js` | Worker 入口 + 每日 21:00（UTC 13:00）打卡提醒 |
| `supabase/migrations/` | 数据库迁移，按编号顺序执行 |
| `docs/plans/` | 设计与实施计划文档 |

## 本地开发

```bash
npm ci
cp .env.example .env.local   # 填入 VITE_SUPABASE_URL 与 VITE_SUPABASE_ANON_KEY
npm run dev                  # 仅本地预览，不是交付成果
npm run build
npm run lint
```

> Windows 注意：`npm.cmd --prefix` 对含空格的中文路径会失败。本项目构建在无空格路径的副本中进行（见工作区交接文档）。

## 数据库迁移顺序（重要）

`supabase/migrations/` 中 **`002_categories.sql` 是实际采用的版本**；`002_custom_categories.sql` 是历史遗留的早期脚本（带已废弃的 `sort_order` 列），**不要执行**，否则前端引用不存在的列会报错。

实际顺序：`001_init` → `002_categories` → `003` → `004` → `005` → `006` → `007` → `008` → `009` → `010_todos` → `011_hardening`。
每个文件在 Supabase SQL Editor 里整段粘贴执行；`008` 的 `max_users`、`AuthContext.jsx` 的 `MAX_USERS`、`LoginPage.jsx` 的 `MAX_USERS` 三处需同时修改才能调整人数上限。

## 部署链路

GitHub Desktop push 到 `main` → GitHub Actions（`npm ci` → `lint` → `build` → `cloudflare/wrangler-action@v3`）→ 自动部署，约 2~4 分钟。

上线验证：本地 `dist/index.html` 引用的 bundle hash 与线上 `https://check-intool.online/` 引用的 hash 一致即部署生效（注意 bundle 名可能含连字符，正则用 `[A-Za-z0-9_-]+`）。

## 账号机制

登录邮箱是假邮箱 `<username>@checkin.local`，因此 Supabase 自带找回邮件不可用。用户名同时是昵称和登录凭据，改名必须走 `update_own_username()` RPC 同步 `profiles.username` 与 `auth.users.email`。忘记密码只能由管理员在 SQL Editor 重置。
