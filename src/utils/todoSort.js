/**
 * 待办排序与过期判定（纯逻辑，供 TodoSection 使用）
 */
import { getTodayStr } from './date'

/**
 * 未完成待办的排序规则（优先级从高到低）：
 * 1. 过期置顶（due_date 早于今天）
 * 2. 截止日期升序（无日期排最后）
 * 3. 优先级降序（3=高 2=中 1=低）
 * 4. 创建时间升序
 */
function comparePending(a, b) {
  const today = getTodayStr()
  const aOverdue = a.due_date && a.due_date < today
  const bOverdue = b.due_date && b.due_date < today
  if (aOverdue !== bOverdue) return aOverdue ? -1 : 1
  const ad = a.due_date || '9999-12-31'
  const bd = b.due_date || '9999-12-31'
  if (ad !== bd) return ad < bd ? -1 : 1
  if (a.priority !== b.priority) return b.priority - a.priority
  return a.created_at < b.created_at ? -1 : 1
}

/**
 * 拆分并排序：completed_at 为空 = 未完成
 * @param {Array} todos 后端返回的待办数组
 * @returns {{ pending: Array, done: Array }} 未完成（comparePending 排序）/ 已完成（完成时间倒序）
 */
export function splitAndSortTodos(todos) {
  const pending = todos.filter((t) => t.completed_at == null).sort(comparePending)
  const done = todos
    .filter((t) => t.completed_at != null)
    .sort((a, b) => (a.completed_at > b.completed_at ? -1 : 1))
  return { pending, done }
}

/**
 * 是否过期：未完成且截止日早于今天。
 * 今天到期不算过期（走「今天到期」金色提示，与倒计时页口径一致）。
 */
export function isOverdue(todo) {
  if (todo.completed_at != null) return false
  if (!todo.due_date) return false
  return todo.due_date < getTodayStr()
}
