import { createClient } from '@supabase/supabase-js'

// 生产环境一律走本站 Worker 的反代路径 /api/supabase/*。
// 原因：部分移动网络直连 *.supabase.co 会被连接重置，导致手机无法登录；
// 而 Cloudflare Workers 在境外可正常访问 Supabase，浏览器只连同源域名即可。
// 反代实现见 src/worker.js 的 proxyToSupabase()。
//
// 本地 dev / preview 仍用 VITE_SUPABASE_URL 或直连地址，方便调试。
// 注意：URL 变了以后 supabase-js 的会话 storage key 也会变，
// 所有设备需要重新登录一次（数据不受影响）。
const DIRECT_URL = 'https://oifwgcxnwzhdvogfixib.supabase.co'
const PROXY_PATH = '/api/supabase'

const isLocalHost = /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname)
const useProxy = import.meta.env.PROD && !isLocalHost
const supabaseUrl = useProxy
  ? `${window.location.origin}${PROXY_PATH}`
  : import.meta.env.VITE_SUPABASE_URL || DIRECT_URL

// publishable(anon) key 设计上可公开、受 RLS 保护，并非机密；
// 保留兜底值让未配置环境变量的全新 clone 也能直接运行。
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable_oj8FXXrk_tYu6l6HwfMcVw_LliY9mzi'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
