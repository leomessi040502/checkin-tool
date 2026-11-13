/**
 * 登录 / 注册错误 → 用户可读的提示。
 *
 * 背景（2026-11-12 移动端登录排障）：
 * 旧版 LoginPage 把登录模式下的一切异常都显示成「用户名或密码错误」。
 * 而手机到 *.supabase.co 的连接被重置时，用户会误以为是密码问题，
 * 于是反复去改密码，始终无法定位真正的网络故障。
 *
 * 原则：只有 Supabase 明确判定「凭据无效」时才允许说密码错；
 * 网络层 / 超时 / 服务端故障一律如实描述，并给出可操作的下一步。
 */

const NETWORK_NAME_RE =
  /AuthRetryableFetchError|AuthFetchError|FetchError|NetworkError|AbortError/i
const NETWORK_CODE_RE = /ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|EPIPE|UND_ERR_/i
const NETWORK_MESSAGE_RE =
  /failed to fetch|fetch failed|network request failed|networkerror|load failed|socket hang up|connection (reset|closed|refused|lost)|network is offline|internet connection appears to be offline|timed out|aborted/i

/** withTimeout() 自己抛出的 10s 超时标记 */
export function isTimeoutError(err) {
  return String(err?.message || '') === 'REQUEST_TIMEOUT'
}

/**
 * 判断是否为网络层故障。
 * supabase-js v2 在 fetch 失败时抛 AuthRetryableFetchError(name) / status=0；
 * PostgREST 则可能返回 { message: 'TypeError: Failed to fetch' } 这样的普通对象。
 */
export function isNetworkError(err) {
  if (!err) return false
  if (isTimeoutError(err)) return false // 超时单独给更精确的提示
  const name = String(err.name || '')
  const message = String(err.message || '')
  const code = String(err.code || err.cause?.code || '')
  return (
    NETWORK_NAME_RE.test(name) ||
    NETWORK_CODE_RE.test(code) ||
    err.status === 0 ||
    NETWORK_MESSAGE_RE.test(message)
  )
}

/**
 * @param {unknown} err - signIn / signUp 抛出的错误（可能是 Error，也可能是 PostgREST 错误对象）
 * @param {'login'|'register'} mode
 * @returns {{ kind: string, message: string, hint: string }}
 */
export function describeAuthError(err, mode = 'login') {
  const message = String(err?.message || '')
  const code = String(err?.code || '')
  const status = err?.status

  // 1) 业务自定义错误（AuthContext 抛出，优先级最高）
  if (message === 'USERNAME_EXISTS') {
    return { kind: 'username_exists', message: '用户名已被使用，请换一个', hint: '' }
  }
  if (message === 'USER_LIMIT_REACHED') {
    return { kind: 'user_limit_reached', message: '圈子人数已满，联系成员获取账号', hint: '' }
  }
  if (message === 'PROFILE_CREATE_FAILED') {
    return {
      kind: 'profile_create_failed',
      message: '注册未完成，请重试；若一直失败请联系成员清理账号',
      hint: '',
    }
  }
  if (message === 'SIGNIN_NO_USER') {
    return { kind: 'unknown', message: '登录状态异常，请重试', hint: '' }
  }

  // 2) 我们自己包装的 10s 超时（此时 toast 已提示过一次，页面提示必须一致）
  if (isTimeoutError(err)) {
    return {
      kind: 'timeout',
      message: '连接服务器超时',
      hint: '这不是密码问题。请切换 WiFi / 移动数据后重试',
    }
  }

  // 3) 网络层失败：连接被重置、DNS 失败、fetch 抛错等
  if (isNetworkError(err)) {
    return {
      kind: 'network',
      message: '网络连接失败，暂时连不上服务器',
      hint: '这不是密码问题。请切换 WiFi / 移动数据，或稍后重试',
    }
  }

  // 4) 限流 / 服务端故障
  if (status === 429 || /rate limit|too many requests/i.test(message)) {
    return { kind: 'rate_limit', message: '尝试过于频繁，请稍后再试', hint: '' }
  }
  if (typeof status === 'number' && status >= 500) {
    return { kind: 'server', message: '服务暂时不可用，请稍后重试', hint: '' }
  }

  // 5) 只有「明确」的凭据错误才允许说密码错，避免把网络问题误导成密码问题
  const credentialLike =
    code === 'invalid_credentials' ||
    /invalid login credentials|invalid credentials|invalid email or password|wrong password|email not confirmed/i.test(message) ||
    ((status === 400 || status === 401) && /credential|password|login/i.test(message))
  if (mode === 'login' && credentialLike) {
    return { kind: 'credentials', message: '用户名或密码错误', hint: '' }
  }

  // 6) 兜底：绝不臆断为密码错；短原因原样带出，方便截图排障
  return {
    kind: 'unknown',
    message: mode === 'login' ? '登录失败，请稍后重试' : '注册失败，请稍后重试',
    hint: message && message.length <= 80 ? `原因：${message}` : '',
  }
}
