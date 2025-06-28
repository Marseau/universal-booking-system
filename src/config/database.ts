import { createClient } from '@supabase/supabase-js'
import { Database } from '../types/database.types'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false
  },
  db: {
    schema: 'public'
  }
})

// Helper function to set tenant context for RLS
export const setTenantContext = async (tenantId: string) => {
  const { error } = await supabase.rpc('set_config', {
    setting_name: 'app.current_tenant_id',
    setting_value: tenantId,
    is_local: true
  })
  
  if (error) {
    console.error('Error setting tenant context:', error)
    throw error
  }
}

// Helper function to bypass RLS for admin operations
export const bypassRLS = async () => {
  const { error } = await supabase.rpc('set_config', {
    setting_name: 'app.bypass_rls',
    setting_value: 'true',
    is_local: true
  })
  
  if (error) {
    console.error('Error bypassing RLS:', error)
    throw error
  }
}

export default supabase
