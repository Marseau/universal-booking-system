import AdvancedIntentRecognitionService from './services/advanced-intent-recognition.service'
import { ConversationContext } from './types/ai.types'
import { BusinessDomain } from './types/database.types'

/**
 * Demonstração do Sistema Avançado de Reconhecimento de Intenções
 * 
 * Este demo mostra as funcionalidades enterprise:
 * - Múltiplos engines de reconhecimento (Pattern, OpenAI, Statistical)
 * - Ensemble learning com votação ponderada
 * - Cache inteligente com TTL configurável
 * - Métricas em tempo real
 * - Roteamento avançado com regras de negócio
 * - Sistema de escalação automática
 * - Aprendizado adaptativo
 */

class AdvancedIntentDemo {
  private intentService: AdvancedIntentRecognitionService

  constructor() {
    this.intentService = new AdvancedIntentRecognitionService()
  }

  async runDemonstration(): Promise<void> {
    console.log('\n🚀 DEMONSTRAÇÃO - Sistema Avançado de Reconhecimento de Intenções\n')
    
    // Preparar contextos para diferentes domínios
    const contexts = this.createTestContexts()
    
    // Executar cenários de teste
    await this.runTestScenarios(contexts)
    
    // Mostrar métricas do sistema
    this.showMetrics()
    
    console.log('\n✅ Demonstração concluída com sucesso!')
  }

  private createTestContexts(): Record<BusinessDomain, ConversationContext> {
    const baseContext = {
      sessionId: 'demo_session_' + Date.now(),
      userId: 'demo_user',
      tenantId: 'demo_tenant',
      conversationHistory: [],
      lastInteraction: new Date(),
      metadata: {}
    }

    return {
      'beauty': {
        ...baseContext,
        sessionId: 'beauty_session',
        tenantConfig: {
          id: 'beauty_tenant',
          name: 'Salão de Beleza Demo',
          domain: 'beauty' as BusinessDomain,
          settings: {},
          aiSettings: {
            greetingMessage: 'Olá! Como posso ajudá-lo hoje?',
            domainKeywords: ['beleza', 'estética', 'manicure'],
            sensitiveTopics: [],
            personality: { tone: 'friendly', energy: 'medium', empathy: 'high' },
            contextWindows: 10,
            escalationTriggers: ['emergência', 'problema grave'],
            maxConversationLength: 50
          }
        }
      },
      'healthcare': {
        ...baseContext,
        sessionId: 'healthcare_session',
        tenantConfig: {
          id: 'healthcare_tenant',
          name: 'Clínica Médica Demo',
          domain: 'healthcare' as BusinessDomain,
          settings: {},
          aiSettings: {
            greetingMessage: 'Olá! Como posso ajudá-lo com sua saúde?',
            domainKeywords: ['saúde', 'medicina', 'consulta'],
            sensitiveTopics: ['morte', 'suicídio'],
            personality: 'professional',
            contextWindows: 10,
            escalationTriggers: ['dor forte', 'sangramento', 'desmaio'],
            maxConversationLength: 50
          }
        }
      },
      'legal': {
        ...baseContext,
        sessionId: 'legal_session',
        tenantConfig: {
          id: 'legal_tenant',
          name: 'Escritório de Advocacia Demo',
          domain: 'legal' as BusinessDomain,
          settings: {},
          aiSettings: {
            greetingMessage: 'Olá! Como posso ajudá-lo com questões jurídicas?',
            domainKeywords: ['direito', 'advocacia', 'processo'],
            sensitiveTopics: ['crime', 'violência'],
            personality: 'formal',
            contextWindows: 10,
            escalationTriggers: ['urgente', 'processo judicial'],
            maxConversationLength: 50
          }
        }
      },
      'education': {
        ...baseContext,
        sessionId: 'education_session',
        tenantConfig: {
          id: 'education_tenant',
          name: 'Escola de Idiomas Demo',
          domain: 'education' as BusinessDomain,
          settings: {},
          aiSettings: {
            greetingMessage: 'Olá! Como posso ajudá-lo com seus estudos?',
            domainKeywords: ['educação', 'ensino', 'curso'],
            sensitiveTopics: ['bullying'],
            personality: 'encouraging',
            contextWindows: 10,
            escalationTriggers: ['bullying', 'problema familiar'],
            maxConversationLength: 50
          }
        }
      },
      'sports': {
        ...baseContext,
        sessionId: 'sports_session',
        tenantConfig: {
          id: 'sports_tenant',
          name: 'Academia Fitness Demo',
          domain: 'sports' as BusinessDomain,
          settings: {},
          aiSettings: {
            greetingMessage: 'Olá! Como posso ajudá-lo com seus treinos?',
            domainKeywords: ['fitness', 'esporte', 'treino'],
            sensitiveTopics: ['lesão grave'],
            personality: 'motivational',
            contextWindows: 10,
            escalationTriggers: ['lesão', 'dor intensa'],
            maxConversationLength: 50
          }
        }
      },
      'consulting': {
        ...baseContext,
        sessionId: 'consulting_session',
        tenantConfig: {
          id: 'consulting_tenant',
          name: 'Consultoria Empresarial Demo',
          domain: 'consulting' as BusinessDomain,
          settings: {},
          aiSettings: {
            greetingMessage: 'Olá! Como posso ajudá-lo com sua empresa?',
            domainKeywords: ['negócios', 'consultoria', 'estratégia'],
            sensitiveTopics: ['falência'],
            personality: 'professional',
            contextWindows: 10,
            escalationTriggers: ['crise', 'falência'],
            maxConversationLength: 50
          }
        }
      }
    }
  }

  private async runTestScenarios(contexts: Record<BusinessDomain, ConversationContext>): Promise<void> {
    const testScenarios = [
      {
        title: '📅 Agendamento Básico - Salão de Beleza',
        message: 'Oi! Gostaria de agendar uma manicure para amanhã às 14h',
        context: contexts.beauty,
        expectedIntent: 'booking_request'
      },
      {
        title: '🚨 Emergência Médica - Clínica',
        message: 'Socorro! Estou sentindo uma dor muito forte no peito e falta de ar',
        context: contexts.healthcare,
        expectedIntent: 'emergency'
      },
      {
        title: '⚖️ Consulta Jurídica - Advocacia',
        message: 'Preciso falar com um advogado sobre meu processo trabalhista',
        context: contexts.legal,
        expectedIntent: 'booking_request'
      },
      {
        title: '🎓 Informações de Curso - Educação',
        message: 'Quais são os cursos de inglês disponíveis e qual o preço?',
        context: contexts.education,
        expectedIntent: 'service_inquiry'
      },
      {
        title: '💪 Personal Trainer - Academia',
        message: 'Quero cancelar meu treino de hoje, estou com uma lesão no joelho',
        context: contexts.sports,
        expectedIntent: 'booking_cancel'
      },
      {
        title: '💼 Consultoria Empresarial',
        message: 'Nossa empresa está passando por uma crise financeira, precisamos de ajuda urgente',
        context: contexts.consulting,
        expectedIntent: 'escalation_request'
      }
    ]

    for (let i = 0; i < testScenarios.length; i++) {
      const scenario = testScenarios[i]
      await this.runScenario(scenario, i + 1)
      
      // Adicionar delay entre cenários para simular uso real
      await this.delay(100)
    }
  }

  private async runScenario(scenario: any, scenarioNumber: number): Promise<void> {
    console.log(`\n${scenarioNumber}. ${scenario.title}`)
    console.log(`📝 Mensagem: "${scenario.message}"`)
    console.log(`🏢 Domínio: ${scenario.context.tenantConfig?.domain}`)

    const startTime = Date.now()

    try {
      // Reconhecimento de intenção com engines múltiplos
      const intent = await this.intentService.recognizeIntent(
        scenario.message,
        scenario.context,
        { cacheTtl: 300000 } // 5 minutos de cache
      )

      // Roteamento avançado
      const routing = await this.intentService.routeWithAdvancedLogic(intent, scenario.context)

      const processingTime = Date.now() - startTime

      // Exibir resultados
      console.log(`\n   🎯 Intent Detectado: ${intent.type} (${(intent.confidence * 100).toFixed(1)}%)`)
      
      if (intent.entities && intent.entities.length > 0) {
        console.log(`   📋 Entidades:`)
        intent.entities.forEach(entity => {
          console.log(`      • ${entity.type}: "${entity.value}" (${(entity.confidence * 100).toFixed(1)}%)`)
        })
      }

      if (intent.metadata?.engines) {
        console.log(`   🔧 Engines Utilizados:`)
        intent.metadata.engines.forEach(engine => {
          const status = engine.success ? '✅' : '❌'
          console.log(`      ${status} ${engine.name}: ${engine.processingTime}ms`)
        })
      }

      console.log(`\n   🎯 Roteamento:`)
      console.log(`      📍 Domínio Primário: ${routing.primaryDomain}`)
      console.log(`      ⚠️ Escalação: ${routing.escalationRequired ? 'SIM' : 'NÃO'}`)
      console.log(`      🔥 Prioridade: ${routing.priority.toUpperCase()}`)
      
      if (routing.suggestedActions.length > 0) {
        console.log(`      💡 Ações Sugeridas:`)
        routing.suggestedActions.forEach(action => {
          console.log(`         • ${action.action} (${action.priority}): ${action.description}`)
        })
      }

      if (routing.metadata.rulesApplied.length > 0) {
        console.log(`      📋 Regras Aplicadas: ${routing.metadata.rulesApplied.join(', ')}`)
      }

      console.log(`   ⚡ Tempo de Processamento: ${processingTime}ms`)

      // Verificar se o intent está correto
      const isCorrect = intent.type === scenario.expectedIntent
      const correctIcon = isCorrect ? '✅' : '❌'
      console.log(`   ${correctIcon} Precisão: ${isCorrect ? 'CORRETO' : 'INCORRETO'} (esperado: ${scenario.expectedIntent})`)

    } catch (error) {
      console.error(`   ❌ Erro no cenário ${scenarioNumber}:`, error)
    }
  }

  private showMetrics(): void {
    console.log('\n📊 MÉTRICAS DO SISTEMA')
    console.log('=' .repeat(50))

    const metrics = this.intentService.getMetrics()

    console.log(`📈 Total de Reconhecimentos: ${metrics.totalRecognitions}`)
    console.log(`✅ Reconhecimentos Bem-sucedidos: ${metrics.successfulRecognitions}`)
    console.log(`🎯 Taxa de Sucesso: ${((metrics.successfulRecognitions / metrics.totalRecognitions) * 100).toFixed(1)}%`)
    console.log(`💾 Cache Hits: ${metrics.cacheHits}`)
    console.log(`⚡ Tempo Médio de Processamento: ${metrics.averageProcessingTime.toFixed(2)}ms`)

    if (metrics.intentAccuracy.size > 0) {
      console.log(`\n🎯 Precisão por Intent:`)
      for (const [intent, accuracy] of metrics.intentAccuracy.entries()) {
        console.log(`   • ${intent}: ${(accuracy * 100).toFixed(1)}%`)
      }
    }

    if (metrics.enginePerformance.size > 0) {
      console.log(`\n🔧 Performance dos Engines:`)
      for (const [engine, performance] of metrics.enginePerformance.entries()) {
        console.log(`   • ${engine}: ${performance.toFixed(2)}ms`)
      }
    }

    const uptime = Date.now() - metrics.lastReset
    console.log(`\n⏱️ Uptime: ${(uptime / 1000).toFixed(1)}s`)
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Demonstração de funcionalidades avançadas
   */
  async demonstrateAdvancedFeatures(): Promise<void> {
    console.log('\n🔬 DEMONSTRAÇÃO - Funcionalidades Avançadas\n')

    // 1. Cache Inteligente
    await this.demonstrateCache()
    
    // 2. Ensemble Learning
    await this.demonstrateEnsembleLearning()
    
    // 3. Roteamento Dinâmico
    await this.demonstrateDynamicRouting()
    
    // 4. Sistema de Escalação
    await this.demonstrateEscalation()
  }

  private async demonstrateCache(): Promise<void> {
    console.log('💾 Testando Cache Inteligente...')
    
    const context = this.createTestContexts().beauty
    const message = 'Quero agendar uma manicure'

    // Primeira execução (sem cache)
    const start1 = Date.now()
    await this.intentService.recognizeIntent(message, context)
    const time1 = Date.now() - start1

    // Segunda execução (com cache)
    const start2 = Date.now()
    await this.intentService.recognizeIntent(message, context)
    const time2 = Date.now() - start2

    console.log(`   ⚡ Primeira execução: ${time1}ms`)
    console.log(`   💾 Segunda execução (cache): ${time2}ms`)
    console.log(`   📈 Melhoria: ${((time1 - time2) / time1 * 100).toFixed(1)}%`)
  }

  private async demonstrateEnsembleLearning(): Promise<void> {
    console.log('\n🧠 Testando Ensemble Learning...')
    
    const context = this.createTestContexts().healthcare
    const message = 'Estou com febre e dor de cabeça há 3 dias'

    const result = await this.intentService.recognizeIntent(message, context)
    
    console.log(`   🎯 Intent Final: ${result.type}`)
    console.log(`   🔢 Confiança: ${(result.confidence * 100).toFixed(1)}%`)
    
    if (result.metadata?.engines) {
      console.log(`   🔧 Engines Consultados:`)
      result.metadata.engines.forEach(engine => {
        console.log(`      • ${engine.name}: ${engine.success ? 'Sucesso' : 'Falhou'}`)
      })
    }
  }

  private async demonstrateDynamicRouting(): Promise<void> {
    console.log('\n🔀 Testando Roteamento Dinâmico...')
    
    const context = this.createTestContexts().legal
    const emergencyMessage = 'Preciso de um advogado urgentemente, é uma emergência'

    const intent = await this.intentService.recognizeIntent(emergencyMessage, context)
    const routing = await this.intentService.routeWithAdvancedLogic(intent, context)

    console.log(`   📍 Domínio: ${routing.primaryDomain}`)
    console.log(`   🚨 Escalação: ${routing.escalationRequired ? 'SIM' : 'NÃO'}`)
    console.log(`   🔥 Prioridade: ${routing.priority}`)
    console.log(`   📋 Regras: ${routing.metadata.rulesApplied.join(', ') || 'Nenhuma'}`)
  }

  private async demonstrateEscalation(): Promise<void> {
    console.log('\n🚨 Testando Sistema de Escalação...')
    
    const scenarios = [
      { 
        message: 'Socorro! É uma emergência!', 
        domain: 'healthcare',
        expected: 'CRÍTICO'
      },
      { 
        message: 'Não estou entendendo nada, quero falar com alguém', 
        domain: 'beauty',
        expected: 'ALTO'
      },
      { 
        message: 'Gostaria de agendar um horário', 
        domain: 'beauty',
        expected: 'BAIXO'
      }
    ]

    for (const scenario of scenarios) {
      const context = this.createTestContexts()[scenario.domain as BusinessDomain]
      const intent = await this.intentService.recognizeIntent(scenario.message, context)
      const routing = await this.intentService.routeWithAdvancedLogic(intent, context)

      console.log(`   📝 "${scenario.message}"`)
      console.log(`      🔥 Prioridade: ${routing.priority.toUpperCase()}`)
      console.log(`      🚨 Escalação: ${routing.escalationRequired ? routing.escalationType : 'Não requerida'}`)
    }
  }
}

// Executar demonstração
async function runDemo(): Promise<void> {
  const demo = new AdvancedIntentDemo()
  
  try {
    await demo.runDemonstration()
    await demo.demonstrateAdvancedFeatures()
  } catch (error) {
    console.error('Erro na demonstração:', error)
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  runDemo().catch(console.error)
}

export { AdvancedIntentDemo, runDemo } 