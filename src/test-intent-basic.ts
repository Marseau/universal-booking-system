import { IntentRouterService } from './services/intent-router.service'
import { ConversationContext } from './types/ai.types'

/**
 * Teste básico do sistema de reconhecimento de intenções existente
 */

async function testBasicIntentRecognition(): Promise<void> {
  console.log('\n🎯 DEMONSTRAÇÃO - Sistema de Reconhecimento de Intenções\n')
  
  const intentService = new IntentRouterService()
  
  // Contexto básico
  const context: ConversationContext = {
    sessionId: 'test_session',
    userId: 'test_user',
    tenantId: 'test_tenant',
    phoneNumber: '+5511999999999',
    conversationHistory: [],
    lastInteraction: new Date()
  }

  // Mensagens de teste
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

  console.log('🔍 Testando reconhecimento de intenções...\n')

  for (let i = 0; i < testMessages.length; i++) {
    const message = testMessages[i]
    console.log(`${i + 1}. 📝 "${message}"`)
    
    try {
      const startTime = Date.now()
      const result = await intentService.analyzeIntent(message, context)
      const processingTime = Date.now() - startTime
      
      console.log(`   🎯 Intent: ${result.type}`)
      console.log(`   📊 Confiança: ${(result.confidence * 100).toFixed(1)}%`)
      console.log(`   📋 Entidades: ${result.entities.length}`)
      
      if (result.entities.length > 0) {
        result.entities.forEach(entity => {
          console.log(`      • ${entity.type}: "${entity.value}" (${(entity.confidence * 100).toFixed(1)}%)`)
        })
      }
      
      // Roteamento de domínio
      const domain = intentService.routeToDomain(result, context)
      console.log(`   🏢 Domínio: ${domain}`)
      console.log(`   ⚡ Tempo: ${processingTime}ms`)
      
      // Análise adicional
      if (result.context?.urgencyLevel) {
        console.log(`   🚨 Urgência: ${result.context.urgencyLevel}`)
      }
      
      if (result.context?.sentiment) {
        console.log(`   😊 Sentimento: ${result.context.sentiment}`)
      }
      
    } catch (error) {
      console.error(`   ❌ Erro: ${error}`)
    }
    
    console.log('')
  }
  
  console.log('✅ Teste de reconhecimento de intenções concluído!')
}

// Teste de funcionalidades específicas
async function testSpecificFeatures(): Promise<void> {
  console.log('\n🔬 TESTANDO FUNCIONALIDADES ESPECÍFICAS\n')
  
  const intentService = new IntentRouterService()
  const context: ConversationContext = {
    sessionId: 'feature_test',
    userId: 'feature_user',
    tenantId: 'feature_tenant',
    conversationHistory: [],
    lastInteraction: new Date()
  }

  // Teste 1: Extração de entidades complexas
  console.log('1. 📋 Teste de Extração de Entidades')
  const complexMessage = 'Quero agendar uma manicure para Maria Silva no dia 15/12 às 14:30, telefone (11) 99999-9999'
  console.log(`   Mensagem: "${complexMessage}"`)
  
  const complexResult = await intentService.analyzeIntent(complexMessage, context)
  console.log(`   Intent: ${complexResult.type} (${(complexResult.confidence * 100).toFixed(1)}%)`)
  console.log(`   Entidades encontradas: ${complexResult.entities.length}`)
  
  complexResult.entities.forEach(entity => {
    console.log(`      • ${entity.type}: "${entity.value}" (${(entity.confidence * 100).toFixed(1)}%)`)
  })

  // Teste 2: Contexto de conversa
  console.log('\n2. 🔄 Teste de Contexto de Conversa')
  const contextualMessages = [
    'Olá, boa tarde',
    'Quero agendar um horário',
    'Prefiro na terça-feira',
    'Às 15h está bom',
    'Perfeito, obrigada!'
  ]
  
  const conversationHistory: string[] = []
  
  for (let i = 0; i < contextualMessages.length; i++) {
    const msg = contextualMessages[i]
    console.log(`   ${i + 1}. "${msg}"`)
    
    const contextWithHistory: ConversationContext = {
      ...context,
      conversationHistory
    }
    
    const result = await intentService.analyzeIntent(msg, contextWithHistory, conversationHistory)
    console.log(`      → Intent: ${result.type} (${(result.confidence * 100).toFixed(1)}%)`)
    
    // Adicionar ao histórico
    conversationHistory.push(msg)
  }

  // Teste 3: Diferentes domínios de negócio
  console.log('\n3. 🏢 Teste de Roteamento por Domínio')
  const domainMessages = [
    { msg: 'Estou com dor de cabeça forte', expectedDomain: 'healthcare' },
    { msg: 'Quero fazer minhas unhas', expectedDomain: 'beauty' },
    { msg: 'Preciso de um advogado', expectedDomain: 'legal' },
    { msg: 'Quero aprender inglês', expectedDomain: 'education' },
    { msg: 'Quero treinar na academia', expectedDomain: 'sports' }
  ]
  
  for (const test of domainMessages) {
    console.log(`   "${test.msg}"`)
    const result = await intentService.analyzeIntent(test.msg, context)
    const domain = intentService.routeToDomain(result, context)
    console.log(`      → Domínio: ${domain} (esperado: ${test.expectedDomain})`)
  }
}

// Função principal
async function runAllTests(): Promise<void> {
  try {
    await testBasicIntentRecognition()
    await testSpecificFeatures()
    
    console.log('\n🎉 Todos os testes concluídos com sucesso!')
    
  } catch (error) {
    console.error('❌ Erro durante os testes:', error)
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  runAllTests().catch(console.error)
}

export { testBasicIntentRecognition, testSpecificFeatures, runAllTests } 