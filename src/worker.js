import { runDailyReminder } from './reminder.js'

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
