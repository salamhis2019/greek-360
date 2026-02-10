import { describe, expect, it } from 'vitest'
import { supabase } from '@/lib/supabase/client'

describe('Supabase client bootstrap', () => {
  it('creates a configured supabase client instance', () => {
    expect(supabase).toBeDefined()
    expect(supabase.auth).toBeDefined()
  })
})
