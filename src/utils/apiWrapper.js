import { showToast } from '../components/Toast'

/**
 * 带超时的 Promise 包装函数
 * Supabase 客户端本身不直接支持超时，使用 Promise.race 实现
 *
 * @param {Promise} promise - 需要包装的 Promise（如 supabase 查询）
 * @param {number} ms - 超时时间（毫秒），默认 10000
 * @returns {Promise} - 原始 Promise 的结果或超时错误
 */
export function withTimeout(promise, ms = 10000) {
  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('REQUEST_TIMEOUT')), ms)
  })

  return Promise.race([promise, timeout])
}

/**
 * 判断错误是否为超时错误
 */
export function isTimeoutError(err) {
  return err?.message === 'REQUEST_TIMEOUT'
}

/**
 * 带超时和错误提示的请求包装
 * 超时后自动显示"请求超时，请重试"toast
 *
 * @param {Promise} promise - 需要包装的 Promise
 * @param {number} ms - 超时时间（毫秒），默认 10000
 * @returns {Promise} - 原始 Promise 的结果
 */
export async function withTimeoutToast(promise, ms = 10000) {
  try {
    return await withTimeout(promise, ms)
  } catch (err) {
    if (isTimeoutError(err)) {
      showToast('请求超时，请重试', 'error')
    }
    throw err
  }
}
