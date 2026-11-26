# 目标 ↔ 待办关联同步设计（2026-11-26）

## 背景

目标（goals）与待办（todos）原本完全独立，无任何数据关联。需求：目标完成后，关联的待办自动同步完成。

## 已确认的决策

1. **双向支持**：新建目标时可勾选「同步生成待办」；已有待办也可手动关联目标
2. **对应关系**：`todos.goal_id` 指向 `goals.id`
3. **同步机制**：数据库触发器（goals.status 变更时 DB 自动同步待办），前端改 status 的入口零改动
4. **提前结束** → 待办同步完成；**删除目标** → 待办解除关联保留（`ON DELETE SET NULL`）
5. **目标重新开始** → 关联待办恢复未完成（含用户后来手动完成的，接受此代价，简单一致）
6. **待办完成/取消不影响目标**（目标进度只由打卡驱动）

## 数据模型（迁移 012_goal_todo_link.sql）

```sql
ALTER TABLE todos ADD COLUMN goal_id UUID REFERENCES goals(id) ON DELETE SET NULL;
CREATE INDEX todos_goal_id_idx ON todos(goal_id) WHERE goal_id IS NOT NULL;

-- 触发器：status 变化时同步关联待办（SECURITY DEFINER，绕过 todos 的 RLS）
CREATE FUNCTION sync_goal_todos() RETURNS TRIGGER ... AS $$
BEGIN
  IF NEW.status IN ('completed', 'expired') THEN
    UPDATE todos SET completed_at = now(), updated_at = now()
    WHERE goal_id = NEW.id AND completed_at IS NULL;
  ELSIF NEW.status = 'active' THEN
    UPDATE todos SET completed_at = NULL, updated_at = now()
    WHERE goal_id = NEW.id;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_sync_goal_todos AFTER UPDATE OF status ON goals
FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION sync_goal_todos();
```

说明：
- 删除目标由 FK `ON DELETE SET NULL` 自动解除关联，无需触发器
- 自动达标、手动完成、提前结束、重新开始，全部走 `UPDATE goals SET status`，触发器统一处理
- 重新开始恢复时清空所有关联待办的 completed_at（含已手动完成的，决策 5）

## 交互设计

1. **GoalFormModal（仅新增模式）**：勾选框「同步生成待办」，默认勾选。生成待办：标题=目标标题、优先级中(2)、私密、截止日期=目标 end_date（长期目标留空）。提交目标成功拿到 id 后再插入待办（顺序保证：目标失败不插待办）
2. **TodoFormModal**：「关联目标」下拉（可不选），只列自己创建的、status=active 的目标；编辑待办时可改可清除
3. **待办卡片（TodoCard/详情）**：显示 🎯 关联目标名小标签
4. 目标卡片不显示待办数（YAGNI）

## 行为规则总表

| 目标动作 | 关联待办 |
|---|---|
| 完成（自动达标 / 手动标记） | 同步完成 |
| 手动提前结束 | 同步完成 |
| 重新开始 | 恢复未完成 |
| 删除目标 | 解除关联，待办保留为普通待办 |
| 待办勾完成/取消 | 不影响目标 |

## 边界与错误处理

- 勾选生成待办但目标创建失败 → 不插待办
- 目标成功但待办插入失败 → toast 提示「目标已创建，待办生成失败」，不回滚目标
- 关联待办的 owner = 目标创建者（下拉只列自己的目标），触发器 definer 更新无 RLS 问题
- 对方公开待办的关联目标标签：goals 全员可见，无隐私问题

## 验收

1. 用户在 Supabase 执行 012 SQL（全文见迁移文件）
2. 推送上线后完整链路测试：建目标生成待办 → 待办手动关联 → 手动完成/提前结束 → 重新开始 → 删除目标
