import { createClient } from '@supabase/supabase-js'
import { environment } from '@/lib/env'

export const supabase = createClient(environment.supabaseUrl, environment.supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})
