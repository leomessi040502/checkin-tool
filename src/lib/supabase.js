import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://oifwgcxnwzhdvogfixib.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_oj8FXXrk_tYu6l6HwfMcVw_LliY9mzi'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
