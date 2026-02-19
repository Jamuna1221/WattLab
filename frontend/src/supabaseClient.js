import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://tmfyjvpevfxqqqsfudqe.supabase.co"
const supabaseAnonKey = "sb_publishable_HMNwV3C-h5Tmqx1tVtjBFg_L7u9ICYk"

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
