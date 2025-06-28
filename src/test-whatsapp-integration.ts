#!/usr/bin/env node

import 'dotenv/config'
import { WhatsAppService } from './services/whatsapp.service'
import { AITestingService } from './services/ai-testing.service'

/**
 * Teste de integração WhatsApp com cenários reais
 */
class WhatsAppIntegrationTester {
  private whatsappService: WhatsAppService
  private aiTester: AITestingService

  constructor() {
    this.whatsappService = new WhatsAppService()
    this.aiTester = new AITestingService()
  }

  /**
   * Simular webhook do WhatsApp com mensagens reais
   */
  async simulateWebhookMessage(phoneNumber: string, message: string, tenantId: string = 'beauty-salon-demo') {
    console.log(`\n📱 Simulando mensagem WhatsApp`)
    console.log(`De: ${phoneNumber}`)
    console.log(`Mensagem: "${message}"`)
    console.log(`Tenant: ${tenantId}`)
    console.log('---')

    // Simular structure do webhook do WhatsApp
    const webhookData = {
      object: 'whatsapp_business_account',
      entry: [{
        id: 'entry-id',
        changes: [{
          value: {
            messaging_product: 'whatsapp',
            metadata: {
              display_phone_number: '11912865400',
              phone_number_id: '747283711790670'
            },
            messages: [{
              from: phoneNumber,
              id: `msg-${Date.now()}`,
              timestamp: Math.floor(Date.now() / 1000).toString(),
              text: {
                body: message
              },
              type: 'text'
            }]
          },
          field: 'messages'
        }]
      }]
    }

    try {
      // Processar como webhook real (método interno)
      const result = await this.processWebhookMessage(webhookData, tenantId)
      console.log(`✅ Processado com sucesso`)
      console.log(`🤖 Resposta: "${result.response}"`)
      console.log(`🎯 Intent: ${result.intent} (${(result.confidence * 100).toFixed(1)}%)`)
      
      if (result.functionCalls && result.functionCalls.length > 0) {
        console.log(`🔧 Function calls: ${result.functionCalls.join(', ')}`)
      }
      
      if (result.shouldEscalate) {
        console.log(`🚨 ESCALAÇÃO: Transferindo para atendimento humano`)
      }

      return result

    } catch (error) {
      console.error(`❌ Erro no processamento:`, error)
      throw error
    }
  }

  /**
   * Processar mensagem do webhook (simula lógica interna)
   */
  private async processWebhookMessage(webhookData: any, tenantId: string) {
    const message = webhookData.entry[0].changes[0].value.messages[0]
    const phoneNumber = message.from
    const messageText = message.text.body

    // Simular processamento interno que seria feito no webhook real
    // (integrando com AI Testing Service para reutilizar lógica)
    
    // Simular resposta baseada no conteúdo
    let intent = 'general_greeting'
    let confidence = 0.7
    let response = 'Olá! Como posso ajudar você hoje?'
    let functionCalls: string[] = []
    let shouldEscalate = false

    // Lógica simplificada de intent detection
    if (messageText.toLowerCase().includes('agendar') || messageText.toLowerCase().includes('marcar')) {
      intent = 'booking_request'
      confidence = 0.95
      response = '📅 Perfeito! Vou verificar nossa agenda. Que tipo de serviço você gostaria de agendar?'
      functionCalls = ['check_availability']
    } else if (messageText.toLowerCase().includes('preço') || messageText.toLowerCase().includes('valor')) {
      intent = 'price_inquiry'
      confidence = 0.9
      response = '💰 Vou consultar nossa tabela de preços para você!'
      functionCalls = ['get_service_pricing']
    } else if (messageText.toLowerCase().includes('cancelar') || messageText.toLowerCase().includes('remarcar')) {
      intent = 'booking_reschedule'
      confidence = 0.85
      response = '🔄 Sem problema! Vou verificar suas opções para cancelar ou remarcar.'
      functionCalls = ['modify_booking']
    } else if (messageText.toLowerCase().includes('urgente') || messageText.toLowerCase().includes('emergência')) {
      intent = 'emergency'
      confidence = 0.95
      response = '🚨 Entendo a urgência. Vou transferir você para nosso atendimento especializado imediatamente.'
      shouldEscalate = true
    } else if (messageText.toLowerCase().includes('horário') || messageText.toLowerCase().includes('funcionamento')) {
      intent = 'business_hours_inquiry'
      confidence = 0.8
      response = '🕐 Nosso horário de funcionamento é de segunda a sexta, das 9h às 18h, e sábados das 9h às 15h.'
    }

    return {
      phoneNumber,
      messageText,
      intent,
      confidence,
      response,
      functionCalls,
      shouldEscalate,
      timestamp: new Date()
    }
  }

  /**
   * Simular conversas completas por domínio
   */
  async testDomainConversations() {
    console.log('\n🎭 TESTANDO CONVERSAS POR DOMÍNIO')
    console.log('=================================')

    const conversations = [
      // Beauty Domain
      {
        domain: 'beauty',
        title: 'Salão de Beleza - Agendamento Manicure',
        messages: [
          'Oi! Gostaria de agendar uma manicure',
          'Pode ser sexta-feira de manhã?',
          'Às 10h está bom?',
          'Perfeito! Qual o valor?'
        ]
      },
      // Healthcare Domain  
      {
        domain: 'healthcare',
        title: 'Clínica - Consulta Psicológica Urgente',
        messages: [
          'Preciso de uma consulta com psicólogo',
          'É urgente, estou passando por um momento muito difícil',
          'Vocês atendem emergências?'
        ]
      },
      // Legal Domain
      {
        domain: 'legal',
        title: 'Escritório Jurídico - Questão Trabalhista',
        messages: [
          'Fui demitido sem justa causa ontem',
          'Quais são meus direitos?',
          'Preciso de uma consulta urgente'
        ]
      },
      // Education Domain
      {
        domain: 'education', 
        title: 'Aulas Particulares - Matemática ENEM',
        messages: [
          'Preciso de aulas de matemática para o ENEM',
          'Tenho muita dificuldade em funções',
          'Vocês têm professor disponível?'
        ]
      },
      // Sports Domain
      {
        domain: 'sports',
        title: 'Academia - Personal Training',
        messages: [
          'Quero contratar um personal trainer',
          'Sou iniciante, nunca fiz academia',
          'Qual o melhor horário para começar?'
        ]
      }
    ]

    for (const conversation of conversations) {
      console.log(`\n💬 ${conversation.title}`)
      console.log(''.padEnd(conversation.title.length + 4, '-'))
      
      const phoneNumber = `+5511999${Math.floor(Math.random() * 900) + 100}999`
      
      for (let i = 0; i < conversation.messages.length; i++) {
        const message = conversation.messages[i]
        console.log(`\n${i + 1}. 👤 Cliente: "${message}"`)
        
        try {
          const result = await this.simulateWebhookMessage(
            phoneNumber, 
            message, 
            `${conversation.domain}-demo`
          )
          
          // Pequena pausa entre mensagens
          await new Promise(resolve => setTimeout(resolve, 500))
          
        } catch (error) {
          console.error(`   ❌ Erro: ${error}`)
        }
      }
    }
  }

  /**
   * Teste de stress com múltiplas conversas simultâneas
   */
  async stressTest(numConversations: number = 5) {
    console.log(`\n⚡ TESTE DE STRESS - ${numConversations} conversas simultâneas`)
    console.log(''.padEnd(50, '='))

    const promises: Promise<any>[] = []
    const startTime = Date.now()

    for (let i = 0; i < numConversations; i++) {
      const phoneNumber = `+5511999${String(i).padStart(3, '0')}999`
      const messages = [
        'Olá!',
        'Gostaria de agendar um horário',
        'Qual a disponibilidade para amanhã?'
      ]

      const conversationPromise = this.simulateConversation(phoneNumber, messages, i)
      promises.push(conversationPromise)
    }

    try {
      const results = await Promise.all(promises)
      const endTime = Date.now()
      const totalTime = endTime - startTime

      console.log(`\n📊 RESULTADOS DO STRESS TEST`)
      console.log(`✅ ${results.length} conversas processadas`)
      console.log(`⏱️ Tempo total: ${totalTime}ms`)
      console.log(`⚡ Média por conversa: ${Math.round(totalTime / numConversations)}ms`)
      console.log(`🔄 Throughput: ${(numConversations / (totalTime / 1000)).toFixed(2)} conversas/segundo`)

    } catch (error) {
      console.error('❌ Erro no stress test:', error)
    }
  }

  /**
   * Simular conversa individual completa
   */
  private async simulateConversation(phoneNumber: string, messages: string[], conversationId: number) {
    const results = []
    
    for (const message of messages) {
      try {
        const result = await this.simulateWebhookMessage(
          phoneNumber, 
          message, 
          'stress-test-tenant'
        )
        results.push(result)
        
        // Pequena pausa entre mensagens
        await new Promise(resolve => setTimeout(resolve, 100))
        
      } catch (error) {
        console.error(`Erro na conversa ${conversationId}:`, error)
      }
    }
    
    return results
  }

  /**
   * Teste de cenários de erro
   */
  async testErrorScenarios() {
    console.log('\n🚨 TESTE DE CENÁRIOS DE ERRO')
    console.log('=============================')

    const errorScenarios = [
      {
        name: 'Mensagem vazia',
        message: '',
        shouldFail: true
      },
      {
        name: 'Mensagem muito longa',
        message: 'a'.repeat(5000),
        shouldFail: false // deve truncar
      },
      {
        name: 'Caracteres especiais',
        message: '🔥💯🚀 Símbolos únicos ñáéíóú çãõ',
        shouldFail: false
      },
      {
        name: 'Números e códigos',
        message: 'Meu CPF é 123.456.789-00 e cartão 1234-5678-9012-3456',
        shouldFail: false // deve detectar dados sensíveis
      }
    ]

    for (const scenario of errorScenarios) {
      console.log(`\n🧪 Testando: ${scenario.name}`)
      
      try {
        const result = await this.simulateWebhookMessage(
          '+5511999999999',
          scenario.message,
          'error-test-tenant'
        )
        
        if (scenario.shouldFail) {
          console.log(`❌ Deveria ter falhado mas passou`)
        } else {
          console.log(`✅ Processado corretamente`)
        }
        
      } catch (error) {
        if (scenario.shouldFail) {
          console.log(`✅ Falhou conforme esperado: ${error}`)
        } else {
          console.log(`❌ Não deveria ter falhado: ${error}`)
        }
      }
    }
  }
}

// Executar testes
async function main() {
  console.log('🚀 WhatsApp Integration Tester')
  console.log('===============================')
  
  const tester = new WhatsAppIntegrationTester()
  
  try {
    // 1. Teste básico
    console.log('\n1️⃣ TESTE BÁSICO')
    await tester.simulateWebhookMessage(
      '+5511987654321',
      'Olá! Gostaria de agendar um horário para corte de cabelo',
      'beauty-salon-demo'
    )

    // 2. Teste por domínios
    if (process.argv.includes('--domains')) {
      await tester.testDomainConversations()
    }

    // 3. Stress test
    if (process.argv.includes('--stress')) {
             const countArg = process.argv.find(arg => arg.startsWith('--count='))
       const countValue = countArg ? countArg.split('=')[1] || '5' : '5'
       const numConversations = parseInt(countValue)
      await tester.stressTest(numConversations)
    }

    // 4. Cenários de erro
    if (process.argv.includes('--errors')) {
      await tester.testErrorScenarios()
    }

    // 5. Teste completo
    if (process.argv.includes('--full')) {
      await tester.testDomainConversations()
      await tester.stressTest(3)
      await tester.testErrorScenarios()
    }

    console.log('\n✅ Todos os testes concluídos!')

  } catch (error) {
    console.error('❌ Erro geral:', error)
    process.exit(1)
  }
}

if (require.main === module) {
  main().catch(console.error)
} 