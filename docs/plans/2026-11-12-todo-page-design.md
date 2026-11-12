# 待办功能设计文档（2026-11-12）

> 状态：已与用户逐项讨论并通过。本文档是实施的唯一依据。
> 关联：实施计划见 `2026-11-12-todo-page-plan.md`（由 writing-plans 产出）。

## 一、需求结论（讨论确认）

| 决策点 | 结论 |
|---|---|
| 数据归属 | 每条待办可选**公开/私密**，默认私密；公开条对方可见但不可改 |
| 功能形态 | **只有待办**（无备忘 tab）；备注文字写在详情里 |
| 字段 | 标题 + 备注 + 截止日期 + 完成勾选 + 优先级（高/中/低）+ 完成时间记录 + 过期高亮 |
| 入口 | 底部导航第 2 个 tab 改「事项」（原「倒计时」位置），路由 `/tasks` |
| 集成方式 | **页面壳合并、数据独立**：页内「待办 / 倒计时」双子 tab；`/countdown` 重定向兼容；倒计时逻辑零改动搬家 |
| 详情呈现 | 底部弹层（弹窗式，同打卡/补卡交互），非独立路由页 |
| 列表组织 | 未完成在上（过期置顶→截止日升序→优先级降序→创建时间）；已完成折叠灰显区（完成时间倒序，可展开收起） |

## 二、数据库（迁移 `supabase/migrations/010_todos.sql`）

```sql
CREATE TABLE IF NOT EXISTS todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title VARCHAR(100) NOT NULL,
  note TEXT,
  due_date DATE,
  priority SMALLINT NOT NULL DEFAULT 2 CHECK (priority IN (1,2,3)),
  is_public BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,          -- 空=未完成；非空=完成时间（状态与时间同源，避免两字段不同步）
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE todos ENABLE ROW LEVEL SECURITY;

-- 公开条全员可见；私密条仅本人可见（RLS 层直接不下发数据）
CREATE POLICY "todos_select" ON todos FOR SELECT TO authenticated
  USING (is_public = true OR user_id = auth.uid());

-- 增删改仅限本人
CREATE POLICY "todos_insert_own" ON todos FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "todos_update_own" ON todos FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "todos_delete_own" ON todos FOR DELETE TO authenticated
  USING (user_id = auth.uid());
```

- updated_at 更新由前端写入（与现有表做法一致，不引入触发器）
- 执行方式：SQL 全文贴给用户在 Supabase SQL Editor 执行（AI 无库凭据）

## 三、路由与导航

- `App.jsx`：新增 `/tasks` 路由（ProtectedRoute 包裹）；`/countdown` 改为 `<Navigate to="/tasks" replace />`
- `BottomNav.jsx`：第 2 个 tab `{ to: '/tasks', label: '事项', icon: ClipboardList }`（lucide），删除 Clock3 倒计时 tab
- 导航仍 5 个 tab，宽度不变

## 四、组件结构

```
src/pages/TasksPage.jsx          页面壳：标题 + 子 tab（待办|倒计时，金色下划条样式）
src/components/TodoSection.jsx   待办区：列表、折叠已完成、排序、过期高亮
src/components/TodoCard.jsx      待办卡片：优先级色点（高红/中金/低灰）、标题、截止日、公开/私密 Eye(EyeOff) 图标
src/components/TodoFormModal.jsx 新增/编辑表单弹窗
src/components/TodoDetailModal.jsx 底部详情弹层：完整信息 + 标记完成/取消完成 + 进编辑 + 删除入口
src/components/CountdownSection.jsx  原 CountdownPage 逻辑原样搬家，功能零改动
```

删除 `src/pages/CountdownPage.jsx`（内容已搬入 CountdownSection）。

## 五、交互细节

1. **排序**：未完成 = 过期置顶 → due_date 升序（空日期排最后）→ priority 降序 → created_at；已完成 = completed_at 倒序
2. **过期高亮**：未完成且 due_date < 今天 → 左侧红条 + 日期红字；今天到期 → 金色提示「今天到期」
3. **完成**：勾选即 UPDATE completed_at = now()；再次点击（详情弹层内）置 null 取消完成
4. **截止日期选择**：复用 `DatePickerModal` 自绘日历（硬性结论：不碰原生 date 控件），可清空
5. **删除**：入口在详情弹层，二次确认弹窗后执行
6. **公开/私密**：表单里一个开关（默认私密）；公开条在对方视图里只读（无编辑/删除/完成入口，卡片右上角「对方头像或名字」标识创建者——同倒计时显示 creator 的做法）

## 六、不做清单（YAGNI）

- 不做：待办提醒推送、子任务、重复待办、拖拽排序、待办关联打卡分类、备忘便签 tab
- 数据层不与 countdowns 合并、不迁移倒计时数据

## 七、错误处理

- 所有 Supabase 调用走 `withTimeoutToast` 包装
- 网络失败保持列表不崩溃（同 CountdownPage 范式）
- RLS 拦截错误统一 toast 提示

## 八、验证与上线

- 构建/ lint 在 Trae 副本（新路径 `D:\trae-cn\builder文件夹\12_打卡工具项目\checkin-tool`）跑
- 上线验证：本地 dist hash == 线上 index.html hash，再抓线上 bundle `includes('todos')` 验证新代码真的上线
- 数据库迁移：先推代码（页面在表不存在时报错可接受/降级显示空），用户跑完 SQL 后功能完整可用——顺序同 009 的做法
