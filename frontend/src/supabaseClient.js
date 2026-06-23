import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://tmfyjvpevfxqqqsfudqe.supabase.co"
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRtZnlqdnBldmZ4cXFxc2Z1ZHFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0ODE0MTUsImV4cCI6MjA4NzA1NzQxNX0.N0J8Gt-t-Kqxcmy8OE9eBioFaPSmeFns9bCqKqSfbWs"

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
