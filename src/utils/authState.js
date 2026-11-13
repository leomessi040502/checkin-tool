/**
 * 登录态合并规则（纯函数，便于单测）。
 *
 * 一次 auth 解析结果有三种，必须区分：
 *   - object    已登录
 *   - null      明确未登录（无 session / SIGNED_OUT）
 *   - undefined 状态未知：网络失败、RLS 拒绝、超时、profile 查询报错
 *
 * 历史 bug：旧代码把「未知」和「未登录」都压成 null，于是
 * onAuthStateChange 里一次 profile 查询抖动就会把刚登录的用户踢回登录页。
 */
export const AUTH_UNKNOWN = undefined

/**
 * 合并一次 auth 结果到当前登录态。
 * 未知结果绝不覆盖已有状态；只有明确的结果（用户对象 / null）才写入。
 */
export function mergeAuthUser(current, result) {
  return result === AUTH_UNKNOWN ? current : result
}

/**
 * 判断一次异步 auth 结果是否已过期。
 * 每次开始解析都领一个递增的 generation，只有最新一次允许写状态，
 * 避免慢回调回来覆盖更新的状态。
 */
export function isStale(token, generation) {
  return token !== generation
}

/**
 * 只有「最新一代且非过期」的结果才允许落地，否则原样保留当前状态。
 * settle() 的纯逻辑版本，集中在一处便于验证竞态场景。
 */
export function applyFreshResult(token, generation, current, result) {
  if (isStale(token, generation)) return current
  return mergeAuthUser(current, result)
}

/**
 * 只有明确的登录 / 登出结果才允许结束 loading。
 * 状态未知时保持「加载中…」，给后续 auth 事件或兜底计时器留出恢复窗口，
 * 否则首次加载时一次网络抖动就会把用户踢回登录页。
 */
export function shouldFinishLoading(result) {
  return result !== AUTH_UNKNOWN
}

/**
 * 「本地根本没有 session」是明确的未登录，不是网络故障。
 * getUser() 无 session 时返回 AuthSessionMissingError（不发网络请求），
 * 必须与超时 / 连接重置区分，否则刷新页面会白白多等一轮兜底。
 */
export function isMissingSessionError(err) {
  const name = String(err?.name || '')
  const code = String(err?.code || '')
  const message = String(err?.message || '')
  return (
    name === 'AuthSessionMissingError' ||
    code === 'session_not_found' ||
    /auth session.*missing|session.*not found/i.test(message)
  )
}

/**
 * .single() 查不到行返回 PGRST116，这是「确定没有 profile」而非查询故障。
 * 此时仍算已登录（username 置空），不能当成状态未知。
 */
export function isNoRowsError(err) {
  const code = String(err?.code || '')
  const message = String(err?.message || '')
  return code === 'PGRST116' || /contains 0 rows|no rows/i.test(message)
}
