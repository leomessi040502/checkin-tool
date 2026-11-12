# 待办功能实施计划（2026-11-12）

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在 check-in-tool 中新增待办功能，以「事项」页承载（待办/倒计时双子 tab），每条待办可公开/私密、勾选完成、优先级、截止日期、备注。

**Architecture:** 页面壳 TasksPage 内两个子 tab（TodoSection / CountdownSection），数据层新增 `todos` 表与 countdowns 完全独立；`/countdown` 旧路由重定向到 `/tasks`；倒计时代码零行为改动搬家。RLS 用 `is_public OR user_id = auth.uid()` 实现公开/私密。

**Tech Stack:** React 19 + Vite 8 + Supabase PostgREST + Tailwind 3（primary/gold/ink token）+ lucide-react。无测试框架——纯逻辑抽成 `src/utils/todoSort.js` 用 node 脚本验证，UI 用 build + lint 验证。

---

## ⚠️ 本项目的固定约束（每个任务都适用）

1. **只改真实仓库** `D:\桌面\AI工具\check-in tool-v1\checkin-tool`（路径含空格+中文）
2. **构建在 Trae 副本**（新路径）：先 `cp` 同步改动的文件到 `D:\trae-cn\builder文件夹\12_打卡工具项目\checkin-tool`，再执行：
   ```
   "C:/Program Files/nodejs/npm.cmd" --prefix "D:/trae-cn/builder文件夹/12_打卡工具项目/checkin-tool" run build
   "C:/Program Files/nodejs/npm.cmd" --prefix "D:/trae-cn/builder文件夹/12_打卡工具项目/checkin-tool" run lint
   ```
3. git 提交在真实仓库内用命令行（已验证可用）；推送由用户在 GitHub Desktop 完成
4. Supabase 无凭据，SQL 全文贴给用户在 SQL Editor 执行
5. UI 一律用现有 token（primary/gold/ink/surface），弹窗结构照抄 `CountdownFormModal`（`z-[60]`、`max-w-mobile`、`rounded-t-2xl`、`bg-black/40` 遮罩）
6. DatePickerModal 是共享组件（打卡页/补卡在用），改动必须向后兼容：新 prop 不传时行为与现在完全一致

---

### Task 1: 纯逻辑——待办排序与状态判定（utils/todoSort.js）

**Files:**
- Create: `src/utils/todoSort.js`
- Test: 工作区 `C:\Users\LeoMessi\WorkBuddy\2026-09-20-14-03-06\_todotest.mjs`

**Step 1: 写测试脚本**（照 `_streaktest.mjs` 的模式，把 src 文件复制到临时目录再 import，规避 ERR_MODULE_NOT_FOUND）

```js
// _todotest.mjs 骨架：复制 src/utils/todoSort.js 到 _tmputils 后 import 断言
import { cpSync, mkdirSync, rmSync } from 'node:fs'
mkdirSync('_tmputils', { recursive: true })
cpSync('D:/桌面/AI工具/check-in tool-v1/checkin-tool/src/utils/todoSort.js', '_tmputils/todoSort.js')
const { splitAndSortTodos, isOverdue } = await import('./_tmputils/todoSort.js')
// 用例覆盖：
// 1) 过期置顶（due_date 昨天 > 今天 > 明天 > 无日期）
// 2) 同日期按 priority 降序（3>2>1）
// 3) 同优先级按 created_at 升序
// 4) 已完成区按 completed_at 倒序，与未完成分开
// 5) isOverdue：未完成+昨天=overdue；未完成+今天=非 overdue（今天走金色提示）；已完成+昨天=非 overdue
```

**Step 2: 跑测试确认失败**（文件不存在）
Run: `node _todotest.mjs` → Expected: import 报错 MODULE_NOT_FOUND

**Step 3: 实现 `src/utils/todoSort.js`**

```js
import { getTodayStr } from './date'

/** 未完成：过期置顶 → 截止日升序（空排最后）→ 优先级降序 → 创建时间 */
function comparePending(a, b) {
  const today = getTodayStr()
  const ao = a.completed_at == null && a.due_date && a.due_date < today
  const bo = b.completed_at == null && b.due_date && b.due_date < today
  if (ao !== bo) return ao ? -1 : 1
  const ad = a.due_date || '9999-12-31'
  const bd = b.due_date || '9999-12-31'
  if (ad !== bd) return ad < bd ? -1 : 1
  if (a.priority !== b.priority) return b.priority - a.priority
  return a.created_at < b.created_at ? -1 : 1
}

/** 导出：拆分未完成/已完成并各自排序 */
export function splitAndSortTodos(todos) {
  const pending = todos.filter((t) => t.completed_at == null).sort(comparePending)
  const done = todos
    .filter((t) => t.completed_at != null)
    .sort((a, b) => (a.completed_at > b.completed_at ? -1 : 1))
  return { pending, done }
}

/** 未完成且截止日早于今天（今天到期不算，走「今天到期」金色提示） */
export function isOverdue(todo) {
  if (todo.completed_at != null) return false
  if (!todo.due_date) return false
  return todo.due_date < getTodayStr()
}
```

**Step 4: 跑测试确认全部通过**
Run: `node _todotest.mjs` → Expected: 每条用例输出 ✅

**Step 5: Commit**（真实仓库）
```
git add src/utils/todoSort.js && git commit -m "feat: 待办排序与过期判定纯逻辑（todoSort）"
```

---

### Task 2: DatePickerModal 支持未来日期（可选 min 参数）

**Files:**
- Modify: `src/components/DatePickerModal.jsx`

**改动点（全部向后兼容，`min` 不传 = 现行为）：**
1. 组件签名加 `min`（`min` 不传时无下限）
2. `disabled = dateStr > max` → `disabled = (min && dateStr < min) || (max && dateStr > max)`；`max` 不传时同样无上限
3. `canGoPrev`：view 在 min 所在月之前时禁用左箭头（对齐现有 canGoNext 写法，用 `<span className="opacity-40">` 占位）
4. 「今天」快捷键：`max` 存在时行为不变；只有 `min` 时改为跳 `min`（待办场景最小可选日）；footer 文案 `已选…（只能选今天及以前）` 改为按 max/min 动态：只有 max → 原文案；只有 min → `（可选 {min} 及以后）`；都无 → 删掉括号说明
5. `useEffect` 打开时锚点：`parseDate(value) || parseDate(min) || parseDate(max) || {year:1970,month:0}`

**Step 1: 修改后同步到 Trae 副本并 build**
**Step 2: 验证**：build + lint 通过；检查 CheckinPage / MakeupCheckinModal 的调用处未传 min（Grep 确认），行为不变
**Step 3: Commit** `feat: DatePickerModal 支持min下限（未来日期），向后兼容`

---

### Task 3: 数据库迁移 010_todos.sql

**Files:**
- Create: `supabase/migrations/010_todos.sql`

内容 = 设计文档第二节 SQL 全文（CREATE TABLE todos + 4 条 RLS 策略）。

**Step 1: 写文件并 Commit** `feat: todos 表迁移（RLS 公开/私密）`
**Step 2: 把 SQL 全文贴给用户**，请他在 Supabase SQL Editor 执行并回贴结果（用户没跑之前，前端对 todos 的查询会报 PGRST202/42P01 类错误——页面要能降级显示空列表 + 错误 toast，不白屏。这已纳入 Task 5 的错误处理）

---

### Task 4: TodoFormModal（新增/编辑表单弹窗）

**Files:**
- Create: `src/components/TodoFormModal.jsx`

**结构照抄 CountdownFormModal**（遮罩/z-index/按钮组/错误提示一致），字段：
- 标题 input（必填，maxLength 100，右侧字数）
- 备注 textarea（可空，maxLength 500）
- 截止日期：只读展示框 + 点开 `DatePickerModal`（传 `min={today}`，不传 max → 可选未来）；展示框旁「清除」小按钮（due_date 置空）
- 优先级：三选一胶囊组（高/中/低，选中态 primary-500 白字）
- 公开开关：一行说明「公开后对方可见（仅查看）」+ toggle（默认私密）

提交逻辑：insert `{ user_id, title, note, due_date, priority, is_public }`；update 时同字段 + `updated_at: new Date().toISOString()`，**不碰 completed_at**（完成状态只在详情弹层里改）。全部走 `withTimeoutToast`。

**Step 1: 实现 → 同步 Trae → build/lint → Commit** `feat: 待办新增/编辑弹窗`

---

### Task 5: TodoCard + TodoDetailModal + TodoSection（待办区完整 UI）

**Files:**
- Create: `src/components/TodoCard.jsx`
- Create: `src/components/TodoDetailModal.jsx`
- Create: `src/components/TodoSection.jsx`

**TodoCard**（结构参考 CountdownCard，点击卡片本身 → onOpen 详情）：
- 左侧勾选圆圈（仅自己的待办；点它直接完成/取消完成，不必进详情）
- 优先级色点：3=红 2=金 1=灰（`h-2 w-2 rounded-full`）
- 标题（完成的加 `line-through text-ink-400`）+ 截止日期
- 过期：`isOverdue` → 卡片左缘 3px 红条 + 日期红字「已过期 N 天」；今天到期 → 金色「今天到期」小徽章
- Eye / EyeOff 小图标标识公开/私密
- **对方的公开待办**：勾选圈、编辑删除入口全部不渲染（`item.user_id !== currentUserId` 时只读），显示「来自 xxx」（复用 profiles 映射，同倒计时 creator_username 做法）

**TodoDetailModal**（底部弹层）：
- 完整信息：标题、状态（未完成/某时刻完成）、优先级、截止日、公开性、备注全文（可滚动区域）、创建时间
- 未完成 → 大按钮「标记完成」（primary-500，点击 UPDATE `completed_at: new Date().toISOString()`）
- 已完成 → 「取消完成」按钮（UPDATE `completed_at: null`）
- 次级按钮：「编辑」（打开 TodoFormModal，由 Section 层协调）、「删除」（复用 CountdownPage 的删除确认弹窗结构）
- 仅自己的待办显示这些操作

**TodoSection**：
- fetchData：`todos` 全量 select（RLS 自动过滤）+ `profiles` 取用户名映射，Promise.all + withTimeoutToast；**表不存在/查询失败 → 空列表 + 一次 toast，不崩溃**（CountdownPage 范式）
- `splitAndSortTodos` 分区渲染；已完成区标题「已完成（N）」+ ChevronDown 旋转箭头展开/收起（localStorage 记住状态，key `todo_done_collapsed`）
- 右上角「新增」按钮（Plus，样式同倒计时新增按钮）

**Step 1: 三个文件实现 → 同步 Trae → build/lint → Commit** `feat: 待办区UI（卡片/详情弹层/列表分区）`

---

### Task 6: CountdownSection（倒计时搬家，零行为改动）

**Files:**
- Create: `src/components/CountdownSection.jsx`
- Delete: `src/pages/CountdownPage.jsx`（Task 8 完成后再删，本任务先保留）

**Step 1:** 把 `CountdownPage.jsx` 全文复制为 `CountdownSection.jsx`，仅做两处机械改动：函数名 `CountdownPage` → `CountdownSection`；外层 `<h1>倒计时</h1>` 删掉（页壳有标题）+ 顶部 `px-4 py-6 pb-8` 的 py 收窄为 `py-4`（页壳已有 padding）。其余 fetchData/handleAdd/confirmDelete/弹窗/删除确认/Toast 一行不改。
**Step 2: 同步 Trae → build/lint → Commit** `refactor: 倒计时页面逻辑搬入组件（零行为改动）`

---

### Task 7: TasksPage 页面壳（双子 tab）

**Files:**
- Create: `src/pages/TasksPage.jsx`

- 顶部 `<h1>事项</h1>`
- 子 tab 条：`待办 | 倒计时`，样式复用统计页 tab 模式（选中 `text-primary-800 font-semibold` + 底部金色条 `bg-gold-500`，间距/字号对齐 StatsPage）
- activeTab 状态；`?tab=countdown` 初始化为倒计时（供旧路由重定向直达），切换时 `navigate('/tasks?tab=todo'|'/tasks?tab=countdown', { replace: true })` 保持可刷新/可分享
- 条件渲染 `<TodoSection />` / `<CountdownSection />`（不卸载切换则各自 fetchData 两次，简单起见条件渲染即可）

**Step 1: 实现 → 同步 Trae → build/lint → Commit** `feat: 事项页壳（待办/倒计时双子tab）`

---

### Task 8: 路由与导航接线

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/components/BottomNav.jsx`
- Delete: `src/pages/CountdownPage.jsx`

**App.jsx**：
- import 改：`CountdownPage` → `TasksPage`，加 `import { Navigate } from 'react-router-dom'`
- `/countdown` 路由元素改为 `<Navigate to="/tasks?tab=countdown" replace />`
- 新增 `<Route path="/tasks" element={<ProtectedRoute><TasksPage /></ProtectedRoute>} />`

**BottomNav.jsx**：
- import 的 `Clock3` 换 `ClipboardList`
- tabs 第 2 项改 `{ to: '/tasks', label: '事项', icon: ClipboardList }`

**Step 1: 三处改动 → 同步 Trae → build/lint**
**Step 2: 冒烟**：Grep 确认仓库内已无 `CountdownPage` 引用残留
**Step 3: Commit** `feat: 事项页接入路由与导航，/countdown 重定向兼容`

---

### Task 9: 全链路验证 + 交付

**Step 1: 两仓库同步校验**（node walk diff，src + 配置逐文件，本会话已有现成写法）
**Step 2: 最终 build + lint**
**Step 3: 用户操作引导**（点击级，逐条告知）：
   1. Supabase SQL Editor 执行 010 迁移 SQL（如果 Task 3 时还没跑）→ 回贴结果
   2. GitHub Desktop → Commit 剩余改动（若无）→ Push
**Step 4: 上线验证**（hash 比对法 + 抓线上 bundle `includes('todos')` / `includes('TodoSection')`）：
```
node -e "console.log(require('fs').readFileSync('D:/trae-cn/builder文件夹/12_打卡工具项目/checkin-tool/dist/index.html','utf8').match(/index-[A-Za-z0-9_]+\.js/g)[0])"
node -e "fetch('https://check-intool.online/').then(r=>r.text()).then(t=>console.log(t.match(/index-[A-Za-z0-9_]+\.js/g)[0]))"
```
**Step 5: 手机验收清单发给用户**：新增待办 → 勾选完成/取消 → 编辑 → 删除 → 公开条对方可见且只读 → 私密条对方不可见 → 倒计时 tab 功能与改版前一致 → 旧 /countdown 链接跳转正常

---

## 执行顺序与依赖

Task 1（纯逻辑）→ Task 2（日历）→ Task 3（SQL）可与 4 并行 → Task 4 → Task 5（依赖 1/2/4）→ Task 6 → Task 7（依赖 5/6）→ Task 8（依赖 7）→ Task 9
