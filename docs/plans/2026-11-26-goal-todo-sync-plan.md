# 目标-待办关联同步 实现计划

> **For Claude:** 按任务逐项执行，每任务完成后 lint/build 验证并提交。

**Goal:** 目标完成/提前结束/重新开始/删除时，关联待办自动同步状态；支持建目标生成待办、待办手动关联目标。

**Architecture:** `todos.goal_id` FK（ON DELETE SET NULL）+ goals 状态变更触发器（DB 侧自动同步），前端只负责建关联，不改任何同步代码。

**Tech Stack:** React 19 + Supabase PostgREST + PostgreSQL 触发器；无单测框架，验证 = oxlint + vite build + 用户执行 SQL + 线上验收。

**设计文档:** `docs/plans/2026-11-26-goal-todo-sync-design.md`

**⚠️ 上线顺序硬约束：** 用户必须**先执行 012 SQL 再推送前端**——前端待办列表将使用 `goal:goals(id,title)` 嵌套查询，迁移未执行时该查询报 PGRST200，待办页会挂。

---

### Task 1: 数据库迁移 012

**Files:** Create `supabase/migrations/012_goal_todo_link.sql`

完整 SQL（幂等，可直接重复执行）：

```sql
-- 012: 目标-待办关联与状态同步触发器
ALTER TABLE public.todos
  ADD COLUMN IF NOT EXISTS goal_id UUID REFERENCES public.goals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS todos_goal_id_idx ON public.todos(goal_id) WHERE goal_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_goal_todos()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('completed', 'expired') THEN
    UPDATE public.todos
    SET completed_at = now(), updated_at = now()
    WHERE goal_id = NEW.id AND completed_at IS NULL;
  ELSIF NEW.status = 'active' THEN
    UPDATE public.todos
    SET completed_at = NULL, updated_at = now()
    WHERE goal_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_goal_todos ON public.goals;
CREATE TRIGGER trg_sync_goal_todos
AFTER UPDATE OF status ON public.goals
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.sync_goal_todos();
```

**Step 1:** 写入迁移文件
**Step 2:** 提交 `git commit -m "feat: 012 迁移——todos.goal_id 关联与状态同步触发器"`
**Step 3:** SQL 全文交用户在 Supabase SQL Editor 执行，等回执

### Task 2: GoalFormModal「同步生成待办」

**Files:** Modify `src/components/GoalFormModal.jsx`

1. 顶部 `import { showToast } from './Toast'`
2. 新增 state：`const [createTodo, setCreateTodo] = useState(true)`；新增模式重置为 true，编辑模式不显示勾选框
3. 表单 UI（仅 `!isEdit` 时，插在错误提示之前）：

```jsx
{!isEdit && (
  <label className="flex items-center justify-between rounded-lg border border-primary-200 px-3 py-3">
    <span>
      <span className="text-sm font-medium text-ink-900">同步生成一条待办</span>
      <span className="mt-0.5 block text-xs text-ink-400">目标完成/结束时待办自动同步</span>
    </span>
    <input
      type="checkbox"
      checked={createTodo}
      onChange={(e) => setCreateTodo(e.target.checked)}
      className="h-4 w-4 accent-primary-600"
    />
  </label>
)}
```

4. 提交逻辑：目标 + 分类关联全部成功后（`onSuccess()` 调用前后）插入待办：

```js
// 在 onSuccess() 之前：
if (!isEdit && createTodo) {
  const { error: todoErr } = await withTimeoutToast(supabase
    .from('todos')
    .insert({
      user_id: currentUserId,
      title: payload.title,
      priority: 2,
      is_public: false,
      due_date: payload.end_date,
      goal_id: goalId,
    }))
  if (todoErr) {
    showToast('目标已创建，但待办生成失败，可稍后手动关联', 'error')
  }
}
```

**Step:** 实现后跑 lint；提交 `feat: 新建目标可选同步生成待办`

### Task 3: TodoFormModal「关联目标」下拉

**Files:** Modify `src/components/TodoFormModal.jsx`

1. state：`const [goalId, setGoalId] = useState('')`、`const [myGoals, setMyGoals] = useState([])`
2. 打开时（新增/编辑）加载自己 active 的目标：

```js
const { data: goalsData } = await withTimeoutToast(supabase
  .from('goals')
  .select('id, title')
  .eq('user_id', currentUserId)
  .eq('status', 'active')
  .order('created_at', { ascending: false }))
setMyGoals(goalsData || [])
```

3. 编辑模式预填 `setGoalId(initialData?.goal_id || '')`
4. payload 增加 `goal_id: goalId || null`
5. UI（公开/私密开关之前）：select 下拉，选项「不关联」+ 各目标标题（truncate），编辑时若原关联目标已非 active，仍显示该目标（从 initialData 兜底，避免关联信息被静默清掉——用 `myGoals` 或 initialData 合并去重）

**Step:** 实现后跑 lint；提交 `feat: 待办可关联目标`

### Task 4: 待办卡片显示关联目标标签

**Files:**
- Modify `src/components/TodoSection.jsx`（todos 查询加嵌套）
- Modify `src/components/TodoCard.jsx`（显示标签）
- Modify `src/components/TodoDetailModal.jsx`（详情显示，如结构允许）

1. todos 查询改为 `.select('*, goal:goals(id, title)')`（PostgREST 一对一嵌入，RLS goals 全员可读）
2. TodoCard 标题行加：

```jsx
{item.goal && (
  <span className="shrink-0 rounded-full bg-primary-50 px-2 py-0.5 text-xs text-primary-600" title={`关联目标：${item.goal.title}`}>
    🎯 {item.goal.title}
  </span>
)}
```

**Step:** 实现后 lint + build；提交 `feat: 待办显示关联目标标签`

### Task 5: 整体验证与上线

1. 同步全部改动到 Trae 副本，`npm run lint` + `npm run build`（用 `ROLLDOWN_WORKER_THREADS=2`）
2. 确认用户已执行 012（回执验证：`SELECT tgname FROM pg_trigger WHERE tgname = 'trg_sync_goal_todos';` 应返回 1 行）
3. 推送 → 等 Actions → 抓线上 bundle 核验（关键词：`同步生成一条待办`、`goal:goals`、`关联目标`）
4. 线上功能验收清单（交给用户）：
   - 新建目标（勾选生成待办）→ 待办页出现同名待办且带 🎯 标签
   - 待办编辑 → 可关联/取消关联自己的进行中目标
   - 目标手动「完成/结束」→ 待办变已完成；「重新开始」→ 待办恢复
   - 删除目标 → 待办保留、标签消失
   - 待办勾选完成 → 目标不受影响
