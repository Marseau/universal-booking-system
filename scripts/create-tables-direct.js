#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function createTables() {
  console.log('🔧 Criando tabelas admin no Supabase...')
  
  try {
    // Create admin_users table
    console.log('📋 Criando tabela admin_users...')
    const { error: adminUsersError } = await supabase.rpc('exec_sql', {
      query: `
        CREATE TABLE IF NOT EXISTS public.admin_users (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          name VARCHAR(255) NOT NULL,
          role VARCHAR(50) NOT NULL DEFAULT 'tenant_admin',
          tenant_id UUID,
          is_active BOOLEAN DEFAULT true,
          last_login_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `
    })
    
    if (adminUsersError) {
      console.error('❌ Erro ao criar admin_users:', adminUsersError)
    } else {
      console.log('✅ Tabela admin_users criada')
    }
    
    // Create admin_permissions table
    console.log('📋 Criando tabela admin_permissions...')
    const { error: permissionsError } = await supabase.rpc('exec_sql', {
      query: `
        CREATE TABLE IF NOT EXISTS public.admin_permissions (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          admin_user_id UUID REFERENCES admin_users(id) ON DELETE CASCADE,
          permission VARCHAR(100) NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `
    })
    
    if (permissionsError) {
      console.error('❌ Erro ao criar admin_permissions:', permissionsError)
    } else {
      console.log('✅ Tabela admin_permissions criada')
    }
    
    // Create email_logs table
    console.log('📋 Criando tabela email_logs...')
    const { error: emailLogsError } = await supabase.rpc('exec_sql', {
      query: `
        CREATE TABLE IF NOT EXISTS public.email_logs (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          tenant_id UUID,
          recipient_email VARCHAR(255) NOT NULL,
          subject VARCHAR(500),
          template_name VARCHAR(100),
          status VARCHAR(50) DEFAULT 'pending',
          error_message TEXT,
          sent_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `
    })
    
    if (emailLogsError) {
      console.error('❌ Erro ao criar email_logs:', emailLogsError)
    } else {
      console.log('✅ Tabela email_logs criada')
    }
    
    // Create function_executions table
    console.log('📋 Criando tabela function_executions...')
    const { error: functionsError } = await supabase.rpc('exec_sql', {
      query: `
        CREATE TABLE IF NOT EXISTS public.function_executions (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          tenant_id UUID,
          function_name VARCHAR(255) NOT NULL,
          execution_time_ms INTEGER,
          success BOOLEAN DEFAULT false,
          error_message TEXT,
          input_data JSONB,
          output_data JSONB,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `
    })
    
    if (functionsError) {
      console.error('❌ Erro ao criar function_executions:', functionsError)
    } else {
      console.log('✅ Tabela function_executions criada')
    }
    
    // Insert default admin user
    console.log('👤 Criando usuário admin padrão...')
    const { error: insertError } = await supabase
      .from('admin_users')
      .insert({
        email: 'admin@universalbooking.com',
        password_hash: '$2b$10$8K0QxGfJ0YJM6rVN3H9uce1kGJqFVLdBxF6qKPXJ8n7FQWm0Qv1S6',
        name: 'System Administrator',
        role: 'super_admin',
        is_active: true
      })
    
    if (insertError) {
      console.error('❌ Erro ao criar admin user:', insertError)
    } else {
      console.log('✅ Usuário admin padrão criado: admin@universalbooking.com / admin123')
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error)
  }
  
  console.log('✅ Processo de criação concluído!')
}

createTables().catch(console.error)