#!/usr/bin/env node

/**
 * 🧪 TEST SEED DATA SCRIPT
 * 
 * Script para verificar se os dados mock foram inseridos corretamente
 * e executar consultas de teste no banco populado
 * 
 * Uso: node scripts/test-seed-data.js
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()

// Configuração Supabase
const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

async function testSeedData() {
  console.log('🧪 Testando dados de seed inseridos...\n')

  try {
    // 1. Contar registros em cada tabela
    console.log('📊 CONTAGEM DE REGISTROS POR TABELA')
    console.log('=====================================')
    
    const tables = [
      'tenants',
      'users', 
      'admin_users',
      'service_categories',
      'services',
      'appointments',
      'user_tenants',
      'conversation_history',
      'conversation_states',
      'whatsapp_templates',
      'availability_templates',
      'system_health_logs'
    ]

    const counts = {}
    for (const table of tables) {
      try {
        const { count, error } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true })
        
        if (error) {
          console.log(`❌ ${table}: Erro - ${error.message}`)
        } else {
          counts[table] = count
          console.log(`✅ ${table}: ${count} registros`)
        }
      } catch (err) {
        console.log(`⚠️ ${table}: Tabela pode não existir`)
      }
    }

    // 2. Testar dados por domínio
    console.log('\n🏢 TENANTS POR DOMÍNIO')
    console.log('=====================')
    
    const { data: tenants, error: tenantsError } = await supabase
      .from('tenants')
      .select('domain, name, slug')
      .order('domain')

    if (tenantsError) {
      console.error('Erro ao buscar tenants:', tenantsError)
    } else {
      const domainGroups = tenants.reduce((acc, tenant) => {
        if (!acc[tenant.domain]) acc[tenant.domain] = []
        acc[tenant.domain].push(tenant)
        return acc
      }, {})

      Object.entries(domainGroups).forEach(([domain, domainTenants]) => {
        console.log(`\n📂 ${domain.toUpperCase()}: ${domainTenants.length} tenants`)
        domainTenants.forEach(tenant => {
          console.log(`   - ${tenant.name} (${tenant.slug})`)
        })
      })
    }

    // 3. Verificar relacionamentos
    console.log('\n🔗 VERIFICAÇÃO DE RELACIONAMENTOS')
    console.log('=================================')

    // Serviços por tenant
    const { data: serviceStats, error: serviceError } = await supabase
      .from('services')
      .select(`
        tenant_id,
        tenants!inner(name, domain),
        name
      `)

    if (!serviceError) {
      const servicesByTenant = serviceStats.reduce((acc, service) => {
        const tenantName = service.tenants.name
        if (!acc[tenantName]) acc[tenantName] = []
        acc[tenantName].push(service.name)
        return acc
      }, {})

      console.log('📋 Serviços por tenant (primeiros 3):')
      Object.entries(servicesByTenant).slice(0, 3).forEach(([tenant, services]) => {
        console.log(`   ${tenant}: ${services.length} serviços`)
        console.log(`     - ${services.slice(0, 2).join(', ')}${services.length > 2 ? '...' : ''}`)
      })
    }

    // 4. Testar agendamentos
    console.log('\n📆 ESTATÍSTICAS DE AGENDAMENTOS')
    console.log('==============================')

    const { data: appointmentStats, error: appointmentError } = await supabase
      .from('appointments')
      .select(`
        status,
        start_time,
        services!inner(name),
        tenants!inner(name, domain)
      `)

    if (!appointmentError) {
      const statusCounts = appointmentStats.reduce((acc, apt) => {
        acc[apt.status] = (acc[apt.status] || 0) + 1
        return acc
      }, {})

      console.log('📊 Agendamentos por status:')
      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`   ${status}: ${count}`)
      })

      // Próximos agendamentos
      const now = new Date().toISOString()
      const futureAppointments = appointmentStats
        .filter(apt => apt.start_time > now)
        .slice(0, 5)

      console.log('\n📅 Próximos 5 agendamentos:')
      futureAppointments.forEach((apt, index) => {
        const date = new Date(apt.start_time).toLocaleString('pt-BR')
        console.log(`   ${index + 1}. ${apt.services.name} - ${apt.tenants.name} (${date})`)
      })
    }

    // 5. Testar conversas
    console.log('\n💬 ESTATÍSTICAS DE CONVERSAS')
    console.log('============================')

    const { data: conversations, error: convError } = await supabase
      .from('conversation_history')
      .select('intent_detected, confidence_score, message_type')

    if (!convError) {
      const intentCounts = conversations.reduce((acc, conv) => {
        acc[conv.intent_detected] = (acc[conv.intent_detected] || 0) + 1
        return acc
      }, {})

      console.log('🎯 Intenções detectadas:')
      Object.entries(intentCounts).forEach(([intent, count]) => {
        console.log(`   ${intent}: ${count}`)
      })

      const avgConfidence = conversations.reduce((sum, conv) => sum + conv.confidence_score, 0) / conversations.length
      console.log(`\n🎯 Confiança média: ${(avgConfidence * 100).toFixed(1)}%`)

      const messageTypes = conversations.reduce((acc, conv) => {
        acc[conv.message_type] = (acc[conv.message_type] || 0) + 1
        return acc
      }, {})

      console.log('\n📱 Tipos de mensagem:')
      Object.entries(messageTypes).forEach(([type, count]) => {
        console.log(`   ${type}: ${count}`)
      })
    }

    // 6. Resumo final
    console.log('\n✅ RESUMO DO TESTE')
    console.log('==================')
    const totalRecords = Object.values(counts).reduce((sum, count) => sum + count, 0)
    console.log(`📈 Total de registros inseridos: ${totalRecords}`)
    console.log(`🏢 Tenants ativos: ${counts.tenants || 0}`)
    console.log(`👥 Usuários cadastrados: ${counts.users || 0}`)
    console.log(`⚙️ Serviços disponíveis: ${counts.services || 0}`)
    console.log(`📆 Agendamentos criados: ${counts.appointments || 0}`)
    console.log(`💬 Conversas registradas: ${counts.conversation_history || 0}`)
    
    console.log('\n🎉 Dados de seed testados com sucesso!')
    console.log('🚀 Sistema pronto para testes rigorosos!')

  } catch (error) {
    console.error('❌ Erro durante teste:', error)
    process.exit(1)
  }
}

// Executar o teste
if (require.main === module) {
  testSeedData()
}

module.exports = { testSeedData }