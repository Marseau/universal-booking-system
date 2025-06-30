import AdvancedIntentRecognitionService from './services/advanced-intent-recognition.service'
import { IntentRouterService } from './services/intent-router.service'
import { ConversationContext } from './types/ai.types'

/**
 * Demonstração Simples do Sistema de Reconhecimento de Intenções
 * 
 * Compara o sistema básico com o sistema avançado
 */

async function demonstrateIntentRecognition(): Promise<void> {
  console.log('\n🎯 DEMONSTRAÇÃO - Reconhecimento de Intenções Avançado vs Básico\n')
  
  // Inicializar serviços
  const basicService = new IntentRouterService()
  const advancedService = new AdvancedIntentRecognitionService()
  
  // Contexto de teste simples
  const context: ConversationContext = {
    sessionId: 'demo_session',
    userId: 'demo_user',
    tenantId: 'demo_tenant',
    phoneNumber: '+5511999999999',
    conversationHistory: [],
    lastInteraction: new Date(),
    tenantConfig: {
      id: 'demo_tenant',
      slug: 'demo-beauty',
      businessName: 'Salão Demo',
      domain: 'beauty',
      services: [],
      businessHours: {
        timezone: 'America/Sao_Paulo',
        schedule: [],
        holidays: [],
        bufferTime: 15
      },
      customFields: {},
      aiSettings: {
        greetingMessage: 'Olá!',
        domainKeywords: [],
        sensitiveTopics: [],
        personality: { tone: 'friendly', energy: 'medium', empathy: 'high' },
        escalationTriggers: [],
        upsellEnabled: false,
        maxResponseLength: 500,
        responseStyle: 'conversational'
      }
    }
  }

  // Cenários de teste
  const testMessages = [
    'Oi! Gostaria de agendar uma manicure para amanhã',
    'Socorro! É uma emergência!',
    'Quero cancelar meu agendamento',
    'Quanto custa um corte de cabelo?',
    'Que horas vocês abrem?',
    'Onde fica o salão?',
    'Obrigada, o atendimento foi ótimo!',
    'Estou insatisfeita com o serviço',
    'Quero falar com o gerente',
    'Olá, bom dia!'
  ]

  for (let i = 0; i < testMessages.length; i++) {
    const message = testMessages[i]!
    console.log(`\n${i + 1}. 📝 Mensagem: "${message}"`)
    
    // Teste com serviço básico
    const startBasic = Date.now()
    const basicResult = await basicService.analyzeIntent(message, context)
    const basicTime = Date.now() - startBasic
    
    // Teste com serviço avançado
    const startAdvanced = Date.now()
    const advancedResult = await advancedService.recognizeIntent(message, context)
    const advancedTime = Date.now() - startAdvanced
    
    // Comparar resultados
    console.log(`\n   🔹 BÁSICO:`)
    console.log(`      Intent: ${basicResult.type}`)
    console.log(`      Confiança: ${(basicResult.confidence * 100).toFixed(1)}%`)
    console.log(`      Entidades: ${basicResult.entities.length}`)
    console.log(`      Tempo: ${basicTime}ms`)
    
    console.log(`\n   🔸 AVANÇADO:`)
    console.log(`      Intent: ${advancedResult.type}`)
    console.log(`      Confiança: ${(advancedResult.confidence * 100).toFixed(1)}%`)
    console.log(`      Entidades: ${advancedResult.entities.length}`)
    console.log(`      Tempo: ${advancedTime}ms`)
    
    if (advancedResult.metadata?.engines) {
      const successfulEngines = advancedResult.metadata.engines.filter(e => e.success)
      console.log(`      Engines: ${successfulEngines.length}/${advancedResult.metadata.engines.length} sucesso`)
    }
    
    // Roteamento avançado
    const routing = await advancedService.routeWithAdvancedLogic(advancedResult, context)
    console.log(`      Domínio: ${routing.primaryDomain}`)
    console.log(`      Prioridade: ${routing.priority}`)
    
    if (routing.escalationRequired) {
      console.log(`      🚨 ESCALAÇÃO: ${routing.escalationType}`)
    }
  }
  
  // Métricas finais
  console.log('\n📊 MÉTRICAS DO SISTEMA AVANÇADO')
  console.log('=' .repeat(40))
  
  const metrics = advancedService.getMetrics()
  console.log(`📈 Total de reconhecimentos: ${metrics.totalRecognitions}`)
  console.log(`✅ Taxa de sucesso: ${((metrics.successfulRecognitions / metrics.totalRecognitions) * 100).toFixed(1)}%`)
  console.log(`💾 Cache hits: ${metrics.cacheHits}`)
  console.log(`⚡ Tempo médio: ${metrics.averageProcessingTime.toFixed(2)}ms`)
  
  console.log('\n✅ Demonstração concluída!')
}

// Demonstração de cache
async function demonstrateCache(): Promise<void> {
  console.log('\n💾 DEMONSTRAÇÃO - Sistema de Cache\n')
  
  const service = new AdvancedIntentRecognitionService()
  const context: ConversationContext = {
    sessionId: 'cache_test',
    userId: 'cache_user',
    tenantId: 'cache_tenant',
    phoneNumber: '+5511999999998',
    conversationHistory: [],
    lastInteraction: new Date()
  }
  
  const message = 'Quero agendar uma consulta'
  
  console.log('🔄 Primeira execução (sem cache)...')
  const start1 = Date.now()
  await service.recognizeIntent(message, context)
  const time1 = Date.now() - start1
  console.log(`   Tempo: ${time1}ms`)
  
  console.log('\n🔄 Segunda execução (com cache)...')
  const start2 = Date.now()
  await service.recognizeIntent(message, context)
  const time2 = Date.now() - start2
  console.log(`   Tempo: ${time2}ms`)
  
  const improvement = ((time1 - time2) / time1 * 100)
  console.log(`\n📈 Melhoria com cache: ${improvement.toFixed(1)}%`)
  
  const metrics = service.getMetrics()
  console.log(`💾 Cache hits: ${metrics.cacheHits}`)
}

// Demonstração de ensemble learning
async function demonstrateEnsemble(): Promise<void> {
  console.log('\n🧠 DEMONSTRAÇÃO - Ensemble Learning\n')
  
  const service = new AdvancedIntentRecognitionService()
  const context: ConversationContext = {
    sessionId: 'ensemble_test',
    userId: 'ensemble_user',
    tenantId: 'ensemble_tenant',
    phoneNumber: '+5511999999997',
    conversationHistory: [],
    lastInteraction: new Date()
  }
  
  const complexMessage = 'Preciso remarcar minha consulta de amanhã porque estou doente'
  
  console.log(`📝 Mensagem complexa: "${complexMessage}"`)
  
  const result = await service.recognizeIntent(complexMessage, context)
  
  console.log(`\n🎯 Resultado do Ensemble:`)
  console.log(`   Intent: ${result.type}`)
  console.log(`   Confiança: ${(result.confidence * 100).toFixed(1)}%`)
  
  if (result.metadata?.engines) {
    console.log(`\n🔧 Contribuição dos Engines:`)
    result.metadata.engines.forEach(engine => {
      const status = engine.success ? '✅' : '❌'
      console.log(`   ${status} ${engine.name}: ${engine.processingTime}ms`)
    })
    
    if (result.metadata.ensembleMethod) {
      console.log(`\n🎲 Método: ${result.metadata.ensembleMethod}`)
    }
  }
  
  if (result.entities.length > 0) {
    console.log(`\n📋 Entidades extraídas:`)
    result.entities.forEach(entity => {
      console.log(`   • ${entity.type}: "${entity.value}" (${(entity.confidence * 100).toFixed(1)}%)`)
    })
  }
}

// Função principal
async function runAllDemonstrations(): Promise<void> {
  try {
    await demonstrateIntentRecognition()
    await demonstrateCache()
    await demonstrateEnsemble()
    
    console.log('\n🎉 Todas as demonstrações concluídas com sucesso!')
    
  } catch (error) {
    console.error('❌ Erro durante as demonstrações:', error)
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  runAllDemonstrations().catch(console.error)
}

export { demonstrateIntentRecognition, demonstrateCache, demonstrateEnsemble, runAllDemonstrations } 