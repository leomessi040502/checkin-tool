export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const path = url.pathname

    // 静态资源直接由 assets 绑定处理
    if (path.includes('.') || path === '/assets' || path.startsWith('/assets/')) {
      return env.ASSETS.fetch(request)
    }

    // SPA 路由回退到 index.html
    return env.ASSETS.fetch(new Request(new URL('/index.html', url), request))
  },
}
