import { runDailyReminder } from './reminder.js'

// 手机端直连 *.supabase.co 会被连接重置，改由本站 Worker 代发请求。
// 项目只用到 Auth(/auth/v1/*) 与 PostgREST(/rest/v1/*)，其余路径一律不转发。
const PROXY_BASE = '/api/supabase'
const PROXY_PREFIXES = ['/auth/v1/', '/rest/v1/']
const PASS_THROUGH_HEADERS = [
  'apikey',
  'authorization',
  'content-type',
  'accept',
  'prefer',
  'accept-profile',
  'content-profile',
  'range',
  'if-match',
  'if-none-match',
  'x-client-info',
  'x-upsert',
]

async function proxyToSupabase(request, env, url) {
  const rest = url.pathname.slice(PROXY_BASE.length)
  if (!PROXY_PREFIXES.some((prefix) => rest.startsWith(prefix))) {
    return new Response('not found', { status: 404 })
  }

  // env.SUPABASE_URL 配置在 wrangler.toml 的 [vars]，无尾斜杠
  const target = `${env.SUPABASE_URL}${rest}${url.search}`

  // 只透传业务头；Host / cf-* / content-length 交给 fetch 重新生成
  const headers = new Headers()
  for (const name of PASS_THROUGH_HEADERS) {
    const value = request.headers.get(name)
    if (value !== null) headers.set(name, value)
  }

  const init = { method: request.method, headers, redirect: 'manual' }
  if (!['GET', 'HEAD'].includes(request.method)) {
    const buf = await request.arrayBuffer()
    if (buf.byteLength > 0) init.body = buf
  }

  let upstream
  try {
    upstream = await fetch(target, init)
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'supabase_unreachable', detail: String(err?.message || err) }),
      { status: 502, headers: { 'Content-Type': 'application/json; charset=utf-8' } },
    )
  }

  // 重建响应，移除逐跳头部，避免二次编码造成 content-length 不匹配
  const resHeaders = new Headers(upstream.headers)
  for (const name of ['content-encoding', 'content-length', 'transfer-encoding', 'connection']) {
    resHeaders.delete(name)
  }
  resHeaders.set('x-checkin-proxy', 'supabase')
  return new Response(upstream.body, { status: upstream.status, headers: resHeaders })
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    // 手动触发一次提醒，用于调试（不需要等到定时任务的时间点）
    // 用法：https://check-intool.online/api/push/test?key=你的PUSH_TEST_KEY
    if (url.pathname === '/api/push/test') {
      if (!env.PUSH_TEST_KEY || url.searchParams.get('key') !== env.PUSH_TEST_KEY) {
        return new Response('forbidden', { status: 403 })
      }
      const result = await runDailyReminder(env)
      return new Response(JSON.stringify(result, null, 2), {
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      })
    }

    // Supabase 反代：必须放在静态资源 / SPA fallback 之前，否则会被当成页面路由
    if (url.pathname.startsWith(`${PROXY_BASE}/`)) {
      return proxyToSupabase(request, env, url)
    }

    // 带扩展名的请求（js/css/图片等静态资源）直接交给 assets 处理
    if (/\.[a-zA-Z0-9]+$/.test(url.pathname)) {
      return env.ASSETS.fetch(request)
    }

    // SPA 路由：先按原路径取资源，404（非资源路径）时回退到根路径
    // 注意：不能回退到 /index.html —— Cloudflare 的 clean-URL 规则会把
    // /index.html 307 重定向到 /，导致 /goals 等深层路由全部失效
    const res = await env.ASSETS.fetch(request)
    if (res.status === 404) {
      return env.ASSETS.fetch(new Request(new URL('/', url), request))
    }
    return res
  },

  // 定时任务：每天 UTC 13:00（北京时间 21:00）触发
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(runDailyReminder(env).then((r) => console.log('[reminder]', JSON.stringify(r))))
  },
}
