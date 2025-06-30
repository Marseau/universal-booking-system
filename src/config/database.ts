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

// Helper function to create tenant-specific client
export const getTenantClient = (tenantId: string) => {
  return createClient<Database>(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false
    },
    db: {
      schema: 'public'
    },
    global: {
      headers: {
        'X-Tenant-ID': tenantId
      }
    }
  })
}

// Helper function to bypass RLS for admin operations
export const getAdminClient = () => {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!serviceKey) {
    console.warn('SUPABASE_SERVICE_ROLE_KEY not provided, using anon key')
    return supabase
  }
  
  return createClient<Database>(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false
    },
    db: {
      schema: 'public'
    }
  })
}

// Legacy alias for admin client
export const supabaseAdmin = getAdminClient()

export default supabase
