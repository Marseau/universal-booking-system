import { 
  FunctionCallingService,
  WorkflowDefinition,
  RegisteredFunction
} from '../services/function-calling'
import { ConversationContext, FunctionCall } from '../types/ai.types'

/**
 * Demonstration of the Function Calling System
 */
export class FunctionCallingDemo {
  private functionCalling: FunctionCallingService

  constructor() {
    this.functionCalling = new FunctionCallingService({
      enableWorkflows: true,
      enableParallelExecution: true,
      enableCaching: true,
      enableMetrics: true,
      maxConcurrentExecutions: 5,
      defaultTimeoutMs: 20000
    })
    
    this.initializeDemo()
  }

  /**
   * Initialize demo functions and workflows
   */
  private initializeDemo(): void {
    console.log('🎯 Initializing Function Calling Demo...')
    
    // Register demo functions
    this.registerDemoFunctions()
    
    // Register demo workflows
    this.registerDemoWorkflows()
    
    console.log('✅ Demo initialized successfully!')
    this.showStats()
  }

  /**
   * Register demo functions
   */
  private registerDemoFunctions(): void {
    // Demo availability check function
    const checkAvailabilityFunction: RegisteredFunction = {
      id: 'demo_check_availability',
      name: 'check_availability',
      description: 'Check service availability for demo',
      parameters: {
        type: 'object',
        properties: {
          service_name: { type: 'string', description: 'Name of the service' },
          date: { type: 'string', description: 'Preferred date (YYYY-MM-DD)' },
          time: { type: 'string', description: 'Preferred time (HH:MM)' }
        },
        required: ['service_name', 'date']
      },
      execute: async (args) => {
        console.log('📅 Checking availability for:', args)
        
        // Simulate availability check
        await this.sleep(500)
        
        const isAvailable = Math.random() > 0.3 // 70% chance of availability
        
        return {
          success: true,
          message: isAvailable 
            ? `✅ ${args.service_name} is available on ${args.date} at ${args.time || 'any time'}`
            : `❌ ${args.service_name} is not available on ${args.date}`,
          data: {
            available: isAvailable,
            service_name: args.service_name,
            date: args.date,
            time: args.time,
            alternative_slots: isAvailable ? [] : [
              { date: args.date, time: '14:00' },
              { date: args.date, time: '16:00' }
            ]
          },
          shouldContinue: true
        }
      },
      domain: 'beauty',
      category: 'inquiry',
      metadata: {
        version: '1.0.0',
        author: 'demo',
        tags: ['availability', 'booking', 'demo'],
        rateLimit: {
          requests: 10,
          windowMs: 60000
        }
      }
    }

    // Demo booking function
    const bookServiceFunction: RegisteredFunction = {
      id: 'demo_book_service',
      name: 'book_service',
      description: 'Book a service for demo',
      parameters: {
        type: 'object',
        properties: {
          service_name: { type: 'string', description: 'Name of the service' },
          date: { type: 'string', description: 'Booking date (YYYY-MM-DD)' },
          time: { type: 'string', description: 'Booking time (HH:MM)' },
          client_name: { type: 'string', description: 'Client name' },
          phone: { type: 'string', description: 'Client phone number' }
        },
        required: ['service_name', 'date', 'time', 'client_name', 'phone']
      },
      execute: async (args) => {
        console.log('📝 Creating booking for:', args)
        
        // Simulate booking creation
        await this.sleep(800)
        
        const bookingId = `BOOK_${Date.now()}`
        
        return {
          success: true,
          message: `✅ Booking confirmed for ${args.client_name}`,
          data: {
            booking_id: bookingId,
            service_name: args.service_name,
            date: args.date,
            time: args.time,
            client_name: args.client_name,
            phone: args.phone,
            status: 'confirmed'
          },
          shouldContinue: true
        }
      },
      domain: 'beauty',
      category: 'booking',
      metadata: {
        version: '1.0.0',
        author: 'demo',
        tags: ['booking', 'create', 'demo']
      }
    }

    // Demo notification function
    const sendNotificationFunction: RegisteredFunction = {
      id: 'demo_send_notification',
      name: 'send_notification',
      description: 'Send notification for demo',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['whatsapp', 'sms', 'email'] },
          recipient: { type: 'string', description: 'Recipient contact' },
          message: { type: 'string', description: 'Message content' },
          booking_id: { type: 'string', description: 'Related booking ID' }
        },
        required: ['type', 'recipient', 'message']
      },
      execute: async (args) => {
        console.log('📱 Sending notification:', args)
        
        // Simulate notification sending
        await this.sleep(300)
        
        return {
          success: true,
          message: `✅ ${args.type} notification sent to ${args.recipient}`,
          data: {
            notification_id: `NOTIF_${Date.now()}`,
            type: args.type,
            recipient: args.recipient,
            sent_at: new Date().toISOString()
          },
          shouldContinue: false
        }
      },
      domain: 'other',
      category: 'utility',
      metadata: {
        version: '1.0.0',
        author: 'demo',
        tags: ['notification', 'communication', 'demo']
      }
    }

    // Register all demo functions
    this.functionCalling.registerFunction(checkAvailabilityFunction)
    this.functionCalling.registerFunction(bookServiceFunction)
    this.functionCalling.registerFunction(sendNotificationFunction)
    
    console.log('📋 Registered 3 demo functions')
  }

  /**
   * Register demo workflows
   */
  private registerDemoWorkflows(): void {
    const completeBookingWorkflow: WorkflowDefinition = {
      id: 'demo_complete_booking',
      name: 'Complete Booking Process',
      description: 'Demo workflow for complete booking process',
      trigger: {
        type: 'intent',
        pattern: 'booking_request'
      },
      steps: [
        {
          id: 'check_availability',
          name: 'Check Availability',
          type: 'function_call',
          config: {
            functionName: 'check_availability',
            arguments: {
              service_name: '{{service_name}}',
              date: '{{date}}',
              time: '{{time}}'
            }
          },
          dependencies: [],
          onSuccess: 'create_booking',
          onFailure: 'send_unavailable_notification'
        },
        {
          id: 'create_booking',
          name: 'Create Booking',
          type: 'function_call',
          config: {
            functionName: 'book_service',
            arguments: {
              service_name: '{{service_name}}',
              date: '{{date}}',
              time: '{{time}}',
              client_name: '{{client_name}}',
              phone: '{{phone}}'
            }
          },
          dependencies: ['check_availability'],
          onSuccess: 'send_confirmation',
          onFailure: 'send_error_notification'
        },
        {
          id: 'send_confirmation',
          name: 'Send Confirmation',
          type: 'function_call',
          config: {
            functionName: 'send_notification',
            arguments: {
              type: 'whatsapp',
              recipient: '{{phone}}',
              message: 'Seu agendamento foi confirmado! 🎉',
              booking_id: '{{booking_id}}'
            }
          },
          dependencies: ['create_booking'],
          onSuccess: undefined,
          onFailure: undefined
        },
        {
          id: 'send_unavailable_notification',
          name: 'Send Unavailable Notification',
          type: 'function_call',
          config: {
            functionName: 'send_notification',
            arguments: {
              type: 'whatsapp',
              recipient: '{{phone}}',
              message: 'Infelizmente não temos disponibilidade neste horário. Que tal estes horários alternativos?',
              booking_id: undefined
            }
          },
          dependencies: ['check_availability'],
          onSuccess: undefined,
          onFailure: undefined
        },
        {
          id: 'send_error_notification',
          name: 'Send Error Notification',
          type: 'function_call',
          config: {
            functionName: 'send_notification',
            arguments: {
              type: 'whatsapp',
              recipient: '{{phone}}',
              message: 'Houve um erro ao processar seu agendamento. Por favor, tente novamente.',
              booking_id: undefined
            }
          },
          dependencies: ['create_booking'],
          onSuccess: undefined,
          onFailure: undefined
        }
      ],
      conditions: [],
      metadata: {
        version: '1.0.0',
        author: 'demo',
        tags: ['booking', 'workflow', 'demo'],
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true
      }
    }

    this.functionCalling.registerWorkflow(completeBookingWorkflow)
    console.log('🌊 Registered demo workflow')
  }

  /**
   * Demo: Execute single function
   */
  async demoSingleFunction(): Promise<void> {
    console.log('\n🎯 === DEMO: Single Function Execution ===')
    
    const context: ConversationContext = {
      tenantId: 'demo_tenant',
      userId: 'demo_user',
      messageId: 'demo_msg_1',
      timestamp: new Date(),
      tenantConfig: {
        domain: 'beauty' as any,
        whatsapp: {} as any
      }
    }

    const functionCall: FunctionCall = {
      name: 'check_availability',
      arguments: JSON.stringify({
        service_name: 'Corte de Cabelo',
        date: '2024-01-15',
        time: '14:00'
      })
    }

    try {
      const result = await this.functionCalling.executeFunction(functionCall, context, {
        useCache: true
      })
      
      console.log('📊 Function Result:', result)
    } catch (error) {
      console.error('❌ Error:', error)
    }
  }

  /**
   * Demo: Execute multiple functions in parallel
   */
  async demoParallelFunctions(): Promise<void> {
    console.log('\n🚀 === DEMO: Parallel Function Execution ===')
    
    const context: ConversationContext = {
      tenantId: 'demo_tenant',
      userId: 'demo_user',
      messageId: 'demo_msg_2',
      timestamp: new Date(),
      tenantConfig: {
        domain: 'beauty' as any,
        whatsapp: {} as any
      }
    }

    const functionCalls: FunctionCall[] = [
      {
        name: 'check_availability',
        arguments: JSON.stringify({
          service_name: 'Manicure',
          date: '2024-01-15',
          time: '10:00'
        })
      },
      {
        name: 'check_availability',
        arguments: JSON.stringify({
          service_name: 'Pedicure',
          date: '2024-01-15',
          time: '14:00'
        })
      },
      {
        name: 'check_availability',
        arguments: JSON.stringify({
          service_name: 'Sobrancelha',
          date: '2024-01-16',
          time: '16:00'
        })
      }
    ]

    try {
      const result = await this.functionCalling.executeFunctions(functionCalls, context, {
        parallel: true,
        continueOnError: true
      })
      
      console.log('📊 Execution Result:', {
        success: result.success,
        totalDuration: result.totalDuration,
        successfulSteps: result.results.filter(r => r.success).length,
        failedSteps: result.failedSteps.length
      })
      
      result.results.forEach(stepResult => {
        console.log(`  ${stepResult.success ? '✅' : '❌'} ${stepResult.functionName}: ${stepResult.duration}ms`)
      })
    } catch (error) {
      console.error('❌ Error:', error)
    }
  }

  /**
   * Demo: Execute workflow
   */
  async demoWorkflow(): Promise<void> {
    console.log('\n🌊 === DEMO: Workflow Execution ===')
    
    const context: ConversationContext = {
      tenantId: 'demo_tenant',
      userId: 'demo_user',
      messageId: 'demo_msg_3',
      timestamp: new Date(),
      tenantConfig: {
        domain: 'beauty' as any,
        whatsapp: {} as any
      }
    }

    const variables = {
      service_name: 'Corte + Escova',
      date: '2024-01-20',
      time: '15:00',
      client_name: 'Maria Silva',
      phone: '+5511999999999'
    }

    try {
      const execution = await this.functionCalling.executeWorkflow(
        'demo_complete_booking',
        context,
        variables
      )
      
      console.log('📊 Workflow Execution Result:', {
        status: execution.status,
        currentStep: execution.currentStep,
        duration: execution.endTime 
          ? execution.endTime.getTime() - execution.startTime.getTime() 
          : 'N/A',
        completedSteps: execution.steps.filter(s => s.status === 'completed').length,
        failedSteps: execution.steps.filter(s => s.status === 'failed').length
      })
      
      execution.steps.forEach(step => {
        console.log(`  ${this.getStepStatusIcon(step.status)} ${step.stepId}: ${step.status}`)
      })
    } catch (error) {
      console.error('❌ Error:', error)
    }
  }

  /**
   * Demo: Show function registry
   */
  demoFunctionRegistry(): void {
    console.log('\n📋 === DEMO: Function Registry ===')
    
    const context: ConversationContext = {
      tenantId: 'demo_tenant',
      userId: 'demo_user',
      messageId: 'demo_msg_4',
      timestamp: new Date(),
      tenantConfig: {
        domain: 'beauty' as any,
        whatsapp: {} as any
      }
    }

    const availableFunctions = this.functionCalling.getAvailableFunctions(context)
    console.log(`📦 Available Functions: ${availableFunctions.length}`)
    
    availableFunctions.forEach(func => {
      console.log(`  🔧 ${func.name} (${func.category}) - ${func.description}`)
    })

    // Search functions
    const searchResults = this.functionCalling.searchFunctions('booking')
    console.log(`🔍 Search 'booking': ${searchResults.length} results`)
    
    searchResults.forEach(func => {
      console.log(`  📍 ${func.name} - ${func.description}`)
    })

    // Functions by category
    const bookingFunctions = this.functionCalling.getFunctionsByCategory('booking')
    console.log(`📂 Booking Functions: ${bookingFunctions.length}`)
  }

  /**
   * Run all demos
   */
  async runAllDemos(): Promise<void> {
    console.log('🎪 === STARTING FUNCTION CALLING DEMOS ===\n')
    
    try {
      await this.demoSingleFunction()
      await this.demoParallelFunctions()
      await this.demoWorkflow()
      this.demoFunctionRegistry()
      
      console.log('\n📊 === FINAL STATISTICS ===')
      this.showStats()
      
      console.log('\n🎉 === ALL DEMOS COMPLETED SUCCESSFULLY ===')
    } catch (error) {
      console.error('❌ Demo failed:', error)
    }
  }

  /**
   * Show statistics
   */
  private showStats(): void {
    const stats = this.functionCalling.getStats()
    const registryStats = this.functionCalling.getRegistryStats()
    
    console.log('📊 Function Calling Statistics:')
    console.log(`  Total Calls: ${stats.totalCalls}`)
    console.log(`  Success Rate: ${stats.totalCalls > 0 ? ((stats.successfulCalls / stats.totalCalls) * 100).toFixed(1) : 0}%`)
    console.log(`  Avg Execution Time: ${Math.round(stats.averageExecutionTime)}ms`)
    console.log(`  Active Executions: ${stats.activeExecutions}`)
    console.log(`  Workflows Executed: ${stats.workflowsExecuted}`)
    console.log(`  Registered Functions: ${registryStats.totalFunctions}`)
    console.log(`  Functions by Domain: ${JSON.stringify(registryStats.functionsByDomain)}`)
  }

  /**
   * Get step status icon
   */
  private getStepStatusIcon(status: string): string {
    switch (status) {
      case 'completed': return '✅'
      case 'failed': return '❌'
      case 'running': return '🔄'
      case 'pending': return '⏳'
      case 'skipped': return '⏭️'
      default: return '❓'
    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// Export for easy usage
export async function runFunctionCallingDemo(): Promise<void> {
  const demo = new FunctionCallingDemo()
  await demo.runAllDemos()
}

// Auto-run if this file is executed directly
if (require.main === module) {
  runFunctionCallingDemo().catch(console.error)
} 