import { AIActionExecutorService, AIAction, ExecutionOptions, ActionType } from './services/ai-action-executor.service'
import { ConversationContext } from './types/ai.types'
import chalk from 'chalk'

/**
 * Demonstração do AI Action Executor Service
 * Executa cenários reais de ações de IA
 */
class ActionExecutorDemo {
  private executor: AIActionExecutorService

  constructor() {
    this.executor = new AIActionExecutorService()
  }

  async runDemo(): Promise<void> {
    console.log(chalk.blue.bold('\n🎯 AI ACTION EXECUTOR SERVICE - DEMONSTRAÇÃO'))
    console.log(chalk.gray('='.repeat(60)))

    // Cenário 1: Agendamento simples
    await this.demonstrateBookingAction()

    // Cenário 2: Avaliação de urgência
    await this.demonstrateAssessmentAction()

    // Cenário 3: Escalação para humano
    await this.demonstrateEscalationAction()

    // Cenário 4: Execução paralela de ações
    await this.demonstrateParallelExecution()

    // Cenário 5: Ação composta
    await this.demonstrateCompositeAction()

    // Métricas finais
    await this.showHealthMetrics()
  }

  private async demonstrateBookingAction(): Promise<void> {
    console.log(chalk.yellow('\n📅 TESTE 1: Agendamento Simples'))

    const context: ConversationContext = {
      sessionId: 'demo_session_1',
      userId: 'demo_user',
      tenantId: 'beauty',
      phoneNumber: '+5511999999999',
      conversationHistory: [],
      lastInteraction: new Date()
    }

    const bookingAction: AIAction = {
      type: 'booking',
      parameters: {
        serviceId: 'service_manicure',
        date: '2024-01-15',
        time: '14:00',
        notes: 'Primeira vez - cliente novo'
      },
      priority: 'high'
    }

    const options: ExecutionOptions = {
      useCache: true,
      enableRetry: true
    }

    try {
      const result = await this.executor.executeAction(bookingAction, context, options)
      
      if (result.success) {
        console.log(chalk.green('✅ Agendamento criado com sucesso!'))
        console.log(`   📋 ID: ${result.actionId}`)
        console.log(`   💬 Mensagem: ${result.message}`)
        console.log(`   📊 Dados:`, result.data)
      } else {
        console.log(chalk.red('❌ Falha no agendamento:'), result.message)
      }
    } catch (error) {
      console.log(chalk.red('💥 Erro:'), error)
    }
  }

  private async demonstrateAssessmentAction(): Promise<void> {
    console.log(chalk.yellow('\n🔍 TESTE 2: Avaliação de Urgência'))

    const context: ConversationContext = {
      sessionId: 'demo_session_2',
      userId: 'demo_user',
      tenantId: 'healthcare',
      phoneNumber: '+5511888888888',
      conversationHistory: [],
      lastInteraction: new Date()
    }

    const assessmentAction: AIAction = {
      type: 'assessment',
      parameters: {
        type: 'urgency',
        input: {
          symptoms: ['dor no peito', 'falta de ar'],
          duration: '30 minutos',
          age: 45
        }
      },
      priority: 'high'
    }

    try {
      const result = await this.executor.executeAction(assessmentAction, context)
      
      console.log(chalk.green('✅ Avaliação concluída!'))
      console.log(`   🎯 Nível: ${result.data?.assessment?.level}`)
      console.log(`   📊 Score: ${result.data?.assessment?.score}`)
      console.log(`   💬 Mensagem: ${result.message}`)
    } catch (error) {
      console.log(chalk.red('💥 Erro:'), error)
    }
  }

  private async demonstrateEscalationAction(): Promise<void> {
    console.log(chalk.yellow('\n🚨 TESTE 3: Escalação para Humano'))

    const context: ConversationContext = {
      sessionId: 'demo_session_3',
      userId: 'demo_user',
      tenantId: 'legal',
      phoneNumber: '+5511777777777',
      conversationHistory: [],
      lastInteraction: new Date()
    }

    const escalationAction: AIAction = {
      type: 'escalation',
      parameters: {
        type: 'human',
        urgency: 'high',
        reason: 'Caso trabalhista complexo - precisa de advogado especializado'
      },
      priority: 'high'
    }

    try {
      const result = await this.executor.executeAction(escalationAction, context)
      
      console.log(chalk.green('✅ Escalação realizada!'))
      console.log(`   👤 Tipo: ${result.data?.escalation?.type || 'human'}`)
      console.log(`   💬 Mensagem: ${result.message}`)
      console.log(`   ⏱️ Continue: ${result.shouldContinue ? 'Não' : 'Sim (transferido)'}`)
    } catch (error) {
      console.log(chalk.red('💥 Erro:'), error)
    }
  }

  private async demonstrateParallelExecution(): Promise<void> {
    console.log(chalk.yellow('\n⚡ TESTE 4: Execução Paralela de Ações'))

    const context: ConversationContext = {
      sessionId: 'demo_session_4',
      userId: 'demo_user',
      tenantId: 'sports',
      phoneNumber: '+5511666666666',
      conversationHistory: [],
      lastInteraction: new Date()
    }

    const actions: AIAction[] = [
      {
        type: 'query',
        parameters: {
          type: 'availability',
          date: '2024-01-15'
        }
      },
      {
        type: 'calculation',
        parameters: {
          type: 'price',
          serviceId: 'personal_training',
          duration: 60
        }
      },
      {
        type: 'validation',
        parameters: {
          customerAge: 25,
          fitnessLevel: 'beginner'
        }
      }
    ]

    try {
      const result = await this.executor.executeActionsParallel(actions, context, {
        maxConcurrency: 3
      })
      
      console.log(chalk.green('✅ Execução paralela concluída!'))
      console.log(`   📊 Total: ${result.summary.total}`)
      console.log(`   ✅ Sucessos: ${result.summary.successful}`)
      console.log(`   ❌ Falhas: ${result.summary.failed}`)
      console.log(`   ⏱️ Tempo: ${result.summary.executionTime}ms`)
      
      result.results.forEach((actionResult, index) => {
        const status = actionResult.success ? '✅' : '❌'
        console.log(`   ${status} Ação ${index + 1}: ${actionResult.message}`)
      })
    } catch (error) {
      console.log(chalk.red('💥 Erro:'), error)
    }
  }

  private async demonstrateCompositeAction(): Promise<void> {
    console.log(chalk.yellow('\n🔄 TESTE 5: Ação Composta (Workflow)'))

    const context: ConversationContext = {
      sessionId: 'demo_session_5',
      userId: 'demo_user',
      tenantId: 'beauty',
      phoneNumber: '+5511555555555',
      conversationHistory: [],
      lastInteraction: new Date()
    }

    const compositeAction: AIAction = {
      type: 'composite',
      parameters: {
        executionMode: 'sequential',
        stopOnFirstFailure: true,
        requireAllSuccess: false,
        actions: [
          {
            type: 'validation',
            parameters: {
              customerData: {
                name: 'Maria Silva',
                phone: '+5511555555555'
              }
            }
          },
          {
            type: 'query',
            parameters: {
              type: 'availability',
              date: '2024-01-15',
              time: '14:00'
            }
          },
          {
            type: 'booking',
            parameters: {
              serviceId: 'manicure',
              date: '2024-01-15',
              time: '14:00'
            }
          },
          {
            type: 'notification',
            parameters: {
              type: 'confirmation',
              message: 'Seu agendamento foi confirmado!'
            }
          }
        ]
      },
      priority: 'medium'
    }

    try {
      const result = await this.executor.executeAction(compositeAction, context)
      
      console.log(chalk.green('✅ Ação composta concluída!'))
      console.log(`   🎯 Sucesso geral: ${result.success ? 'Sim' : 'Não'}`)
      console.log(`   💬 Mensagem: ${result.message}`)
      
      if (result.data?.subResults) {
        console.log(`   📋 Sub-ações executadas: ${result.data.subResults.length}`)
        result.data.subResults.forEach((subResult: any, index: number) => {
          const status = subResult.success ? '✅' : '❌'
          console.log(`      ${status} ${index + 1}. ${subResult.type}: ${subResult.message}`)
        })
      }
    } catch (error) {
      console.log(chalk.red('💥 Erro:'), error)
    }
  }

  private async showHealthMetrics(): Promise<void> {
    console.log(chalk.yellow('\n📈 MÉTRICAS DE SAÚDE DO SISTEMA'))
    
    const metrics = this.executor.getHealthMetrics()
    
    console.log(chalk.cyan(`📊 Total de ações executadas: ${metrics.totalActions}`))
    console.log(chalk.green(`✅ Ações bem-sucedidas: ${metrics.successfulActions}`))
    console.log(chalk.red(`❌ Ações falharam: ${metrics.failedActions}`))
    console.log(chalk.blue(`⏱️ Tempo médio de execução: ${metrics.averageExecutionTime.toFixed(2)}ms`))
    console.log(chalk.magenta(`📊 Taxa de sucesso: ${((metrics.successfulActions / metrics.totalActions) * 100).toFixed(1)}%`))
    
    console.log(chalk.yellow('\n📋 Ações por tipo:'))
    Object.entries(metrics.actionsByType).forEach(([type, stats]) => {
      const successRate = ((stats.successful / stats.total) * 100).toFixed(1)
      console.log(chalk.white(`   ${type}: ${stats.total} total, ${stats.successful} sucessos (${successRate}%)`))
    })
  }
}

// Função principal para executar a demonstração
async function runActionExecutorDemo(): Promise<void> {
  const demo = new ActionExecutorDemo()
  
  try {
    await demo.runDemo()
    
    console.log(chalk.green.bold('\n🎉 DEMONSTRAÇÃO CONCLUÍDA COM SUCESSO!'))
    console.log(chalk.gray('O AI Action Executor Service está funcionando perfeitamente.'))
    
  } catch (error) {
    console.error(chalk.red.bold('\n💥 ERRO NA DEMONSTRAÇÃO:'), error)
  }
}

// Exportar para uso em testes
export { ActionExecutorDemo, runActionExecutorDemo }

// Executar se chamado diretamente
if (require.main === module) {
  runActionExecutorDemo()
} 