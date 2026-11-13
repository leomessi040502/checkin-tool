import { createClient } from '@supabase/supabase-js'

// 生产环境一律走本站 Worker 的反代路径 /api/supabase/*。
// 原因：部分移动网络直连 *.supabase.co 会被连接重置，导致手机无法登录；
// 而 Cloudflare Workers 在境外可正常访问 Supabase，浏览器只连同源域名即可。
// 反代实现见 src/worker.js 的 proxyToSupabase()。
//
// 本地 dev / preview 必须显式配置 VITE_SUPABASE_URL，源码里不再保留任何地址兜底。
// 注意：URL 变了以后 supabase-js 的会话 storage key 也会变，
// 所有设备需要重新登录一次（数据不受影响）。
const PROXY_PATH = '/api/supabase'

const isLocalHost = /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname)
const useProxy = import.meta.env.PROD && !isLocalHost
const supabaseUrl = useProxy
  ? `${window.location.origin}${PROXY_PATH}`
  : import.meta.env.VITE_SUPABASE_URL

// URL 与 key 全部由构建时注入，代码里不留硬编码值：
//   本地 → .env.local（参考 .env.example）
//   线上 → GitHub Actions 的 Variables/Secrets（见 .github/workflows/deploy.yml）
// publishable(anon) key 设计上可公开、受 RLS 保护；CI 的 Verify build env 会先校验，
// 因此生产缺配置时是构建失败，而不是上线后白屏。
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl) {
  throw new Error(
    '缺少 VITE_SUPABASE_URL：本地开发请在 .env.local 配置；生产环境走同源反代，不使用该变量',
  )
}

if (!supabaseAnonKey) {
  throw new Error(
    '缺少 VITE_SUPABASE_ANON_KEY：本地请在 .env.local 配置，线上请检查 GitHub Actions 变量',
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
