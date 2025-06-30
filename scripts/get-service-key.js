#!/usr/bin/env node

/**
 * Helper script to get and configure the Supabase Service Role Key
 */

const fs = require('fs')
const path = require('path')

function showInstructions() {
  console.log('🔑 SUPABASE SERVICE ROLE KEY CONFIGURATION')
  console.log('=========================================')
  console.log('')
  console.log('Para configurar a chave service role do Supabase:')
  console.log('')
  console.log('1. 🌐 Acesse seu dashboard do Supabase:')
  console.log('   https://supabase.com/dashboard/project/qsdfyffuonywmtnlycri')
  console.log('')
  console.log('2. ⚙️  Vá para Settings > API')
  console.log('')
  console.log('3. 🔍 Procure por "service_role" key na seção "Project API keys"')
  console.log('')
  console.log('4. 📋 Copie a chave que começa com "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."')
  console.log('')
  console.log('5. ✏️  Adicione no seu arquivo .env:')
  console.log('   SUPABASE_SERVICE_ROLE_KEY=sua_chave_aqui')
  console.log('')
  console.log('6. 🔄 Execute novamente: npm run db:setup-admin')
  console.log('')
  console.log('📌 IMPORTANTE:')
  console.log('   - A service_role key é diferente da anon key')
  console.log('   - Ela tem permissões administrativas totais')
  console.log('   - NUNCA commite esta chave no git!')
  console.log('')
}

function checkCurrentEnv() {
  const envPath = path.join(__dirname, '..', '.env')
  
  if (!fs.existsSync(envPath)) {
    console.log('❌ Arquivo .env não encontrado')
    return false
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8')
  
  console.log('📋 STATUS ATUAL DO .env:')
  console.log('========================')
  
  // Check SUPABASE_URL
  const hasUrl = envContent.includes('SUPABASE_URL=')
  console.log(`SUPABASE_URL: ${hasUrl ? '✅ Configurado' : '❌ Faltando'}`)
  
  // Check SUPABASE_ANON_KEY
  const hasAnonKey = envContent.includes('SUPABASE_ANON_KEY=')
  console.log(`SUPABASE_ANON_KEY: ${hasAnonKey ? '✅ Configurado' : '❌ Faltando'}`)
  
  // Check SUPABASE_SERVICE_ROLE_KEY
  const hasServiceKey = envContent.includes('SUPABASE_SERVICE_ROLE_KEY=')
  console.log(`SUPABASE_SERVICE_ROLE_KEY: ${hasServiceKey ? '✅ Configurado' : '❌ FALTANDO'}`)
  
  console.log('')
  
  if (!hasServiceKey) {
    console.log('⚠️  A chave SUPABASE_SERVICE_ROLE_KEY está faltando!')
    return false
  }
  
  return true
}

function addServiceKeyToEnv(serviceKey) {
  const envPath = path.join(__dirname, '..', '.env')
  
  if (!fs.existsSync(envPath)) {
    console.log('❌ Arquivo .env não encontrado')
    return false
  }
  
  let envContent = fs.readFileSync(envPath, 'utf8')
  
  // Check if SERVICE_ROLE_KEY already exists
  if (envContent.includes('SUPABASE_SERVICE_ROLE_KEY=')) {
    console.log('⚠️  SUPABASE_SERVICE_ROLE_KEY já existe no .env')
    return false
  }
  
  // Add the service key after SUPABASE_ANON_KEY
  const lines = envContent.split('\n')
  const newLines = []
  
  for (const line of lines) {
    newLines.push(line)
    if (line.startsWith('SUPABASE_ANON_KEY=')) {
      newLines.push(`SUPABASE_SERVICE_ROLE_KEY=${serviceKey}`)
    }
  }
  
  fs.writeFileSync(envPath, newLines.join('\n'))
  console.log('✅ SUPABASE_SERVICE_ROLE_KEY adicionado ao .env')
  return true
}

function main() {
  const args = process.argv.slice(2)
  
  if (args.length === 0) {
    showInstructions()
    console.log('')
    checkCurrentEnv()
    return
  }
  
  if (args[0] === '--add' && args[1]) {
    const success = addServiceKeyToEnv(args[1])
    if (success) {
      console.log('🎉 Configuração concluída! Agora você pode executar:')
      console.log('   npm run db:setup-admin')
    }
    return
  }
  
  if (args[0] === '--check') {
    checkCurrentEnv()
    return
  }
  
  console.log('❓ Uso:')
  console.log('  node scripts/get-service-key.js              # Mostrar instruções')
  console.log('  node scripts/get-service-key.js --check      # Verificar configuração atual')
  console.log('  node scripts/get-service-key.js --add [key]  # Adicionar chave ao .env')
}

if (require.main === module) {
  main()
}