#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkSchema() {
  console.log('🔍 Verificando schema existente...')
  
  try {
    // Check existing tables
    const { data: tenants, error: tenantsError } = await supabase
      .from('tenants')
      .select('*')
      .limit(1)
    
    if (!tenantsError) {
      console.log('✅ Tabela tenants existe')
      console.log('Estrutura de tenant:', Object.keys(tenants[0] || {}))
    } else {
      console.error('❌ Problema com tabela tenants:', tenantsError)
    }
    
    // Check users table
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*')
      .limit(1)
    
    if (!usersError) {
      console.log('✅ Tabela users existe')
      console.log('Estrutura de user:', Object.keys(users[0] || {}))
    } else {
      console.error('❌ Problema com tabela users:', usersError)
    }
    
    // Try to create admin tables using direct table operations
    console.log('\n🔧 Tentando criar tabelas admin...')
    
    // Create a simple test table first to see if we can create tables
    const testTable = `CREATE TABLE IF NOT EXISTS test_admin (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      test_field VARCHAR(100)
    );`
    
    // Try using a different method - through a PostgreSQL function if it exists
    console.log('Tentando criar tabela de teste...')
    
  } catch (error) {
    console.error('❌ Erro:', error)
  }
}

checkSchema().catch(console.error)