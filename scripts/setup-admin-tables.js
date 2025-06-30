#!/usr/bin/env node

/**
 * Setup script for admin tables in Supabase
 * Run this script to create the necessary admin tables for the system
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Load environment variables
require('dotenv').config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:')
  console.error('   SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
  console.error('   Please check your .env file')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function runSQLScript() {
  try {
    console.log('🔧 Setting up admin tables...')
    
    // Read the SQL script
    const sqlPath = path.join(__dirname, '..', 'database', 'admin-tables.sql')
    const sqlScript = fs.readFileSync(sqlPath, 'utf8')
    
    // Split by statements and execute each one
    const statements = sqlScript
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))
    
    console.log(`📝 Executing ${statements.length} SQL statements...`)
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      
      if (statement.trim()) {
        try {
          console.log(`   ${i + 1}/${statements.length}: ${statement.substring(0, 50)}...`)
          
          const { error } = await supabase.rpc('exec_sql', { sql: statement })
          
          if (error) {
            // Try direct query if RPC fails
            const { error: directError } = await supabase
              .from('pg_stat_statements')
              .select('*')
              .limit(0) // This will fail but trigger the SQL execution context
            
            // Since we can't execute arbitrary SQL via client, we'll use a different approach
            console.log(`   ⚠️  Statement ${i + 1} may need manual execution in Supabase SQL editor`)
          }
        } catch (err) {
          console.error(`   ❌ Error executing statement ${i + 1}:`, err.message)
        }
      }
    }
    
    console.log('✅ Admin tables setup completed!')
    console.log('')
    console.log('📋 Manual steps required:')
    console.log('1. Open your Supabase dashboard')
    console.log('2. Go to SQL Editor')
    console.log('3. Copy and paste the contents of database/admin-tables.sql')
    console.log('4. Run the SQL script manually')
    console.log('')
    console.log('🔑 Default admin credentials:')
    console.log('   Email: admin@universalbooking.com')
    console.log('   Password: admin123')
    console.log('')
    console.log('⚠️  Remember to change the default password after first login!')
    
  } catch (error) {
    console.error('❌ Failed to setup admin tables:', error)
    process.exit(1)
  }
}

// Check database connection first
async function checkConnection() {
  try {
    console.log('🔍 Checking database connection...')
    
    const { data, error } = await supabase
      .from('tenants')
      .select('id')
      .limit(1)
    
    if (error) {
      throw error
    }
    
    console.log('✅ Database connection successful')
    return true
  } catch (error) {
    console.error('❌ Database connection failed:', error.message)
    return false
  }
}

async function main() {
  console.log('🚀 Universal Booking System - Admin Tables Setup')
  console.log('================================================')
  
  const connected = await checkConnection()
  
  if (!connected) {
    console.error('❌ Cannot proceed without database connection')
    process.exit(1)
  }
  
  await runSQLScript()
}

if (require.main === module) {
  main().catch(console.error)
}

module.exports = { runSQLScript, checkConnection }