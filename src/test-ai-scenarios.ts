#!/usr/bin/env node

import 'dotenv/config'
import { AITestingService } from './services/ai-testing.service'

async function main(): Promise<void> {
  console.log('🚀 Iniciando Testes do Sistema WhatsApp AI')
  console.log('==========================================\n')

  const tester = new AITestingService()

  try {
    // 1. Health Check rápido
    console.log('1️⃣ HEALTH CHECK INICIAL')
    console.log('-----------------------')
    const healthStatus = await tester.quickHealthCheck()
    console.log(`Status: ${healthStatus.status}`)
    console.log('Detalhes:', JSON.stringify(healthStatus.details, null, 2))
    
    if (healthStatus.status === 'unhealthy') {
      console.log('❌ Sistema não está saudável. Abortando testes.')
      process.exit(1)
    }
    console.log('✅ Sistema OK!\n')

    // 2. Teste por domínio - Beauty
    console.log('2️⃣ TESTE DOMÍNIO: BEAUTY')
    console.log('------------------------')
    const beautyResults = await tester.testDomain('beauty')
    beautyResults.forEach(result => {
      console.log(`${result.success ? '✅' : '❌'} ${result.scenario.name}: ${(result.score * 100).toFixed(1)}%`)
      if (!result.success) {
        console.log(`   Erros: ${result.details.errors.join(', ')}`)
      }
    })
    console.log('')

    // 3. Teste específico - Healthcare (caso crítico)
    console.log('3️⃣ TESTE DOMÍNIO: HEALTHCARE')
    console.log('-----------------------------')
    const healthcareResults = await tester.testDomain('healthcare')
    healthcareResults.forEach(result => {
      console.log(`${result.success ? '✅' : '❌'} ${result.scenario.name}: ${(result.score * 100).toFixed(1)}%`)
      result.conversation_flow.forEach(flow => {
        console.log(`   👤 "${flow.message}"`)
        console.log(`   🤖 "${flow.response}"`)
        if (flow.intent) console.log(`   🎯 Intent: ${flow.intent}`)
        console.log()
      })
    })

    // 4. Teste Legal - Casos complexos
    console.log('4️⃣ TESTE DOMÍNIO: LEGAL')
    console.log('-----------------------')
    const legalResults = await tester.testDomain('legal')
    legalResults.forEach(result => {
      console.log(`${result.success ? '✅' : '❌'} ${result.scenario.name}: ${(result.score * 100).toFixed(1)}%`)
      if (result.details.function_calls.length > 0) {
        console.log(`   🔧 Function calls: ${result.details.function_calls.join(', ')}`)
      }
    })
    console.log('')

    // 5. Teste de erro handling
    console.log('5️⃣ TESTE ERROR HANDLING')
    console.log('------------------------')
    const errorResults = await tester.testDomain('other')
    errorResults.forEach(result => {
      console.log(`${result.success ? '✅' : '❌'} ${result.scenario.name}: ${(result.score * 100).toFixed(1)}%`)
      console.log(`   Tempo: ${result.details.execution_time}ms`)
    })
    console.log('')

    // 6. Relatório completo (se quiser testar tudo)
    const runFullTest = process.argv.includes('--full')
    if (runFullTest) {
      console.log('6️⃣ TESTE COMPLETO - TODOS OS CENÁRIOS')
      console.log('=====================================')
      const fullReport = await tester.runAllTests()
      
      console.log('\n📊 RELATÓRIO FINAL RESUMIDO')
      console.log('============================')
      console.log(`✅ Taxa de sucesso: ${(fullReport.passed / fullReport.total_scenarios * 100).toFixed(1)}%`)
      console.log(`⚡ Tempo médio: ${fullReport.performance_metrics.avg_response_time}ms`)
      console.log(`🎯 Precisão de intents: ${(fullReport.performance_metrics.intent_accuracy * 100).toFixed(1)}%`)
      console.log(`📅 Taxa de agendamentos: ${(fullReport.performance_metrics.booking_success_rate * 100).toFixed(1)}%`)
    } else {
      console.log('💡 Execute com --full para relatório completo de todos os cenários')
    }
    
    return Promise.resolve()

  } catch (error) {
    console.error('❌ Erro durante os testes:', error)
    process.exit(1)
  }
}

// Cenário de teste manual específico
async function testSpecificScenario(): Promise<void> {
  console.log('\n🔬 TESTE MANUAL ESPECÍFICO')
  console.log('==========================')
  
  const tester = new AITestingService()
  
  // Simular cenário real específico
  const customScenario = {
    id: 'manual-001',
    name: 'Agendamento Urgente Saúde Mental',
    domain: 'healthcare' as const,
    description: 'Paciente em crise precisa de atendimento imediato',
    messages: [
      {
        id: 'msg-1',
        text: 'Socorro, preciso falar com alguém AGORA',
        type: 'user' as const
      },
      {
        id: 'msg-2',
        text: 'Estou tendo pensamentos ruins, é uma emergência',
        type: 'user' as const
      }
    ],
    expectedOutcomes: [
      {
        type: 'escalation' as const,
        value: true,
        description: 'Deve escalar imediatamente para humano'
      },
      {
        type: 'intent' as const,
        value: 'emergency',
        confidence: 0.95,
        description: 'Deve detectar emergência'
      }
    ]
  }

  try {
    const result = await tester.runTestScenario(customScenario)
    console.log(`Resultado: ${result.success ? '✅ SUCESSO' : '❌ FALHA'}`)
    console.log(`Score: ${(result.score * 100).toFixed(1)}%`)
    console.log('Conversa:')
    result.conversation_flow.forEach(flow => {
      console.log(`👤 "${flow.message}"`)
      console.log(`🤖 "${flow.response}"`)
      console.log()
    })
    return Promise.resolve()
  } catch (error) {
    console.error('Erro no teste específico:', error)
    return Promise.resolve()
  }
}

// Executar testes
if (require.main === module) {
  main().then(() => {
    if (process.argv.includes('--manual')) {
      return testSpecificScenario()
    }
    return Promise.resolve()
  }).catch(console.error)
} 