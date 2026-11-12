import { createClient } from '@supabase/supabase-js'

// 优先读环境变量（本地 .env.local / CI 注入）。
// 兜底值是 Supabase 的 publishable(anon) key：设计上可公开、受 RLS 保护，并非机密；
// 保留它是为了让未配置环境变量的全新 clone 也能直接运行。
// 彻底移除兜底前，需先在 GitHub Actions 配置同名 Variables/Secrets 并注入 deploy.yml。
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://oifwgcxnwzhdvogfixib.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_oj8FXXrk_tYu6l6HwfMcVw_LliY9mzi'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
