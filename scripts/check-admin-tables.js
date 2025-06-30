#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkTables() {
  console.log('🔍 Verificando tabelas admin no Supabase...')
  
  const tablesToCheck = [
    'admin_users',
    'admin_permissions', 
    'email_logs',
    'function_executions'
  ]
  
  for (const table of tablesToCheck) {
    try {
      console.log(`\n📋 Verificando tabela: ${table}`)
      
      // Try to query the table structure
      const { data, error, count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })
        .limit(1)
      
      if (error) {
        console.error(`❌ Erro ao acessar ${table}:`, error.message)
      } else {
        console.log(`✅ Tabela ${table} existe e é acessível`)
        console.log(`📊 Total de registros: ${count || 0}`)
        
        // Get a sample record if exists
        if (count > 0) {
          const { data: sample } = await supabase
            .from(table)
            .select('*')
            .limit(1)
          console.log(`📄 Exemplo de registro:`, JSON.stringify(sample?.[0], null, 2))
        }
      }
    } catch (err) {
      console.error(`❌ Erro ao verificar ${table}:`, err.message)
    }
  }
  
  // Check if default admin user exists
  console.log('\n👤 Verificando usuário admin padrão...')
  try {
    const { data: admin, error } = await supabase
      .from('admin_users')
      .select('id, email, name, role, is_active, created_at')
      .eq('email', 'admin@universalbooking.com')
      .single()
    
    if (error) {
      console.error('❌ Usuário admin padrão não encontrado:', error.message)
    } else {
      console.log('✅ Usuário admin padrão encontrado:')
      console.log(JSON.stringify(admin, null, 2))
    }
  } catch (err) {
    console.error('❌ Erro ao verificar admin user:', err.message)
  }
  
  // Check existing tenants
  console.log('\n🏢 Verificando tenants existentes...')
  try {
    const { data: tenants, error } = await supabase
      .from('tenants')
      .select('id, business_name, slug, business_domain, subscription_status')
      .limit(5)
    
    if (error) {
      console.error('❌ Erro ao verificar tenants:', error.message)
    } else {
      console.log(`✅ ${tenants?.length || 0} tenants encontrados:`)
      tenants?.forEach(tenant => {
        console.log(`  - ${tenant.business_name} (${tenant.slug}) - Domain: ${tenant.business_domain}`)
      })
    }
  } catch (err) {
    console.error('❌ Erro ao verificar tenants:', err.message)
  }
  
  console.log('\n✅ Verificação concluída!')
}

checkTables().catch(console.error)