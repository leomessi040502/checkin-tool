export default {
  async fetch(request, env) {
    const url = new URL(request.url)

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
}
