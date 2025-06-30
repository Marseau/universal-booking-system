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
      
      // Use direct SQL through REST API
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sql: queries[i] })
      })
      
      if (!response.ok) {
        // Try alternative approach using pg_stat_statements or direct table creation
        console.log(`Tentando abordagem alternativa para query ${i + 1}...`)
        
        // For table creation, let's try creating through the admin user table directly
        if (i < 4) { // Table creation queries
          const { data, error } = await supabase
            .schema('public')
            .rpc('sql', { query: queries[i] })
            
          if (error) {
            console.error(`Erro na query ${i + 1}:`, error)
          } else {
            console.log(`✅ Query ${i + 1} executada com sucesso`)
          }
        } else {
          // For the admin user insert, try direct insert
          const { data, error } = await supabase
            .from('admin_users')
            .upsert({
              email: 'admin@universalbooking.com',
              password_hash: '$2b$10$8K0QxGfJ0YJM6rVN3H9uce1kGJqFVLdBxF6qKPXJ8n7FQWm0Qv1S6',
              name: 'System Administrator', 
              role: 'super_admin',
              is_active: true
            }, { onConflict: 'email' })
            
          if (error) {
            console.error(`Erro ao inserir admin user:`, error)
          } else {
            console.log(`✅ Admin user criado com sucesso`)
          }
        }
      } else {
        console.log(`✅ Query ${i + 1} executada com sucesso`)
      }
    } catch (err) {
      console.error(`Erro na query ${i + 1}:`, err.message)
    }
  }
  
  console.log('✅ Processo de criação de tabelas admin concluído!')
}

createTables().catch(console.error)