#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function createTables() {
  console.log('🔧 Criando tabelas admin no Supabase...')
  
  const queries = [
    // Admin Users Table
    `CREATE TABLE IF NOT EXISTS admin_users (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'tenant_admin',
      tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
      is_active BOOLEAN DEFAULT true,
      last_login_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );`,
    
    // Admin Permissions Table
    `CREATE TABLE IF NOT EXISTS admin_permissions (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      admin_user_id UUID REFERENCES admin_users(id) ON DELETE CASCADE,
      permission VARCHAR(100) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );`,
    
    // Email Logs Table
    `CREATE TABLE IF NOT EXISTS email_logs (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
      recipient_email VARCHAR(255) NOT NULL,
      subject VARCHAR(500),
      template_name VARCHAR(100),
      status VARCHAR(50) DEFAULT 'pending',
      error_message TEXT,
      sent_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );`,
    
    // Function Executions Table
    `CREATE TABLE IF NOT EXISTS function_executions (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
      function_name VARCHAR(255) NOT NULL,
      execution_time_ms INTEGER,
      success BOOLEAN DEFAULT false,
      error_message TEXT,
      input_data JSONB,
      output_data JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );`,
    
    // Insert default super admin
    `INSERT INTO admin_users (email, password_hash, name, role, is_active) 
     VALUES (
       'admin@universalbooking.com',
       '$2b$10$8K0QxGfJ0YJM6rVN3H9uce1kGJqFVLdBxF6qKPXJ8n7FQWm0Qv1S6', 
       'System Administrator',
       'super_admin',
       true
     ) ON CONFLICT (email) DO NOTHING;`
  ]
  
  for (let i = 0; i < queries.length; i++) {
    try {
      console.log(`Executando query ${i + 1}/${queries.length}...`)
      const { error } = await supabase.rpc('exec_sql', { sql: queries[i] })
      if (error) {
        console.error(`Erro na query ${i + 1}:`, error)
      } else {
        console.log(`✅ Query ${i + 1} executada com sucesso`)
      }
    } catch (err) {
      console.error(`Erro na query ${i + 1}:`, err.message)
    }
  }
  
  console.log('✅ Tabelas admin criadas!')
}

createTables().catch(console.error)