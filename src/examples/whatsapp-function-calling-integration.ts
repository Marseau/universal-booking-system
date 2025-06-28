import { FunctionCallingService } from '../services/function-calling'
import { WhatsAppService } from '../services/whatsapp.service'
import AIComplexService from '../services/ai-complex.service'
import { ConversationContext, AIResponse } from '../types/ai.types'

/**
 * Integration example showing how to use Function Calling with WhatsApp
 */
export class WhatsAppFunctionCallingIntegration {
  private functionCalling: FunctionCallingService
  private whatsappService: WhatsAppService
  private aiService: AIComplexService

  constructor() {
    // Initialize services
    this.functionCalling = new FunctionCallingService({
      enableWorkflows: true,
      enableParallelExecution: true,
      enableCaching: true,
      maxConcurrentExecutions: 10
    })
    
    this.whatsappService = new WhatsAppService()
    this.aiService = new AIComplexService()
    
    this.setupIntegration()
  }

  /**
   * Setup the integration between services
   */
  private setupIntegration(): void {
    console.log('🔗 Setting up WhatsApp + Function Calling integration...')
    
    // Register WhatsApp-specific functions
    this.registerWhatsAppFunctions()
    
    // Register business workflows
    this.registerBusinessWorkflows()
    
    console.log('✅ Integration setup complete!')
  }

  /**
   * Register WhatsApp-specific functions
   */
  private registerWhatsAppFunctions(): void {
    // Function to send WhatsApp message
    this.functionCalling.registerFunction({
      id: 'whatsapp_send_message',
      name: 'send_whatsapp_message',
      description: 'Send a WhatsApp message to a phone number',
      parameters: {
        type: 'object',
        properties: {
          phone: { type: 'string', description: 'Phone number with country code' },
          message: { type: 'string', description: 'Message content' },
          media_url: { type: 'string', description: 'Optional media URL' }
        },
        required: ['phone', 'message']
      },
      execute: async (args) => {
        try {
          await this.whatsappService.sendMessage(args.phone, args.message, args.media_url)
          return {
            success: true,
            message: `WhatsApp message sent to ${args.phone}`,
            data: { phone: args.phone, sent_at: new Date().toISOString() },
            shouldContinue: false
          }
        } catch (error) {
          return {
            success: false,
            message: `Failed to send WhatsApp message: ${error}`,
            shouldContinue: false
          }
        }
      },
      domain: 'other',
      category: 'utility',
      metadata: {
        version: '1.0.0',
        author: 'integration',
        tags: ['whatsapp', 'communication']
      }
    })

    // Function to get conversation history
    this.functionCalling.registerFunction({
      id: 'get_conversation_history',
      name: 'get_conversation_history',
      description: 'Get conversation history for a phone number',
      parameters: {
        type: 'object',
        properties: {
          phone: { type: 'string', description: 'Phone number' },
          limit: { type: 'number', description: 'Number of messages to retrieve', default: 10 }
        },
        required: ['phone']
      },
      execute: async (args) => {
        try {
          const history = await this.whatsappService.getConversationHistory(args.phone, args.limit || 10)
          return {
            success: true,
            message: `Retrieved ${history.length} messages`,
            data: { history },
            shouldContinue: true
          }
        } catch (error) {
          return {
            success: false,
            message: `Failed to get conversation history: ${error}`,
            shouldContinue: false
          }
        }
      },
      domain: 'other',
      category: 'information',
      metadata: {
        version: '1.0.0',
        author: 'integration',
        tags: ['whatsapp', 'history', 'conversation']
      }
    })
  }

  /**
   * Register business workflows
   */
  private registerBusinessWorkflows(): void {
    // Customer service workflow
    this.functionCalling.registerWorkflow({
      id: 'customer_service_flow',
      name: 'Customer Service Flow',
      description: 'Handle customer service requests via WhatsApp',
      trigger: {
        type: 'intent',
        pattern: 'customer_service'
      },
      steps: [
        {
          id: 'get_history',
          name: 'Get Customer History',
          type: 'function_call',
          config: {
            functionName: 'get_conversation_history',
            arguments: {
              phone: '{{phone}}',
              limit: 5
            }
          },
          dependencies: [],
          onSuccess: 'analyze_intent',
          onFailure: 'send_error_message'
        },
        {
          id: 'analyze_intent',
          name: 'Analyze Customer Intent',
          type: 'function_call',
          config: {
            functionName: 'analyze_customer_intent',
            arguments: {
              message: '{{message}}',
              history: '{{history}}'
            }
          },
          dependencies: ['get_history'],
          onSuccess: 'process_request',
          onFailure: 'escalate_to_human'
        },
        {
          id: 'process_request',
          name: 'Process Customer Request',
          type: 'function_call',
          config: {
            functionName: 'process_customer_request',
            arguments: {
              intent: '{{intent}}',
              phone: '{{phone}}',
              context: '{{context}}'
            }
          },
          dependencies: ['analyze_intent'],
          onSuccess: 'send_response',
          onFailure: 'escalate_to_human'
        },
        {
          id: 'send_response',
          name: 'Send Response',
          type: 'function_call',
          config: {
            functionName: 'send_whatsapp_message',
            arguments: {
              phone: '{{phone}}',
              message: '{{response_message}}'
            }
          },
          dependencies: ['process_request'],
          onSuccess: undefined,
          onFailure: 'escalate_to_human'
        },
        {
          id: 'escalate_to_human',
          name: 'Escalate to Human',
          type: 'function_call',
          config: {
            functionName: 'send_whatsapp_message',
            arguments: {
              phone: '{{phone}}',
              message: 'Vou transferir você para um de nossos atendentes. Um momento, por favor! 👨‍💼'
            }
          },
          dependencies: [],
          onSuccess: undefined,
          onFailure: undefined
        },
        {
          id: 'send_error_message',
          name: 'Send Error Message',
          type: 'function_call',
          config: {
            functionName: 'send_whatsapp_message',
            arguments: {
              phone: '{{phone}}',
              message: 'Ops! Tivemos um problema técnico. Nosso suporte será notificado. Tente novamente em alguns minutos! 🔧'
            }
          },
          dependencies: [],
          onSuccess: undefined,
          onFailure: undefined
        }
      ],
      conditions: [],
      metadata: {
        version: '1.0.0',
        author: 'integration',
        tags: ['customer-service', 'whatsapp', 'workflow'],
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true
      }
    })
  }

  /**
   * Process incoming WhatsApp message using Function Calling
   */
  async processWhatsAppMessage(
    phone: string,
    message: string,
    context: ConversationContext
  ): Promise<AIResponse> {
    console.log(`📱 Processing WhatsApp message from ${phone}: ${message}`)

    try {
      // Step 1: Analyze message intent using AI
      const aiResponse = await this.aiService.processMessage(message, context)
      
      // Step 2: If AI suggests function calls, execute them
      if (aiResponse.functionCalls && aiResponse.functionCalls.length > 0) {
        console.log(`🔧 Executing ${aiResponse.functionCalls.length} function calls...`)
        
        const executionResult = await this.functionCalling.executeFunctions(
          aiResponse.functionCalls,
          context,
          { 
            parallel: false, // Sequential for WhatsApp to maintain conversation flow
            continueOnError: true 
          }
        )

        // Step 3: Update AI response with function results
        if (executionResult.success) {
          const actions = executionResult.actions
          const lastResult = executionResult.results[executionResult.results.length - 1]
          
          if (lastResult?.result?.data) {
            aiResponse.data = { ...aiResponse.data, ...lastResult.result.data }
          }
          
          if (actions && actions.length > 0) {
            aiResponse.actions = actions
          }
        } else {
          // Handle function execution failure
          console.warn('⚠️ Function execution failed:', executionResult.failedSteps)
          
          aiResponse.message += '\n\n⚠️ Algumas operações não puderam ser concluídas. Nossa equipe foi notificada.'
        }
      }

      // Step 3: Check if we should trigger a workflow
      if (this.shouldTriggerWorkflow(aiResponse)) {
        console.log('🌊 Triggering customer service workflow...')
        
        const workflowExecution = await this.functionCalling.executeWorkflow(
          'customer_service_flow',
          context,
          {
            phone,
            message,
            intent: aiResponse.intent,
            context: aiResponse.data
          }
        )
        
        if (workflowExecution.status === 'completed') {
          aiResponse.message = '✅ Sua solicitação foi processada com sucesso!'
        } else {
          aiResponse.message = '⚠️ Houve um problema ao processar sua solicitação. Nossa equipe foi notificada.'
        }
      }

      // Step 4: Send response via WhatsApp
      if (aiResponse.message) {
        await this.whatsappService.sendMessage(phone, aiResponse.message)
      }

      return aiResponse

    } catch (error) {
      console.error('❌ Error processing WhatsApp message:', error)
      
      // Send error message to user
      await this.whatsappService.sendMessage(
        phone,
        '🔧 Ops! Tivemos um problema técnico. Nossa equipe foi notificada e retornará em breve!'
      )

      return {
        success: false,
        message: 'Error processing message',
        intent: 'error',
        confidence: 0,
        shouldContinue: false,
        actions: []
      }
    }
  }

  /**
   * Check if we should trigger a workflow
   */
  private shouldTriggerWorkflow(aiResponse: AIResponse): boolean {
    // Trigger workflow for complex requests or when confidence is low
    return (
      aiResponse.confidence < 0.7 ||
      aiResponse.intent === 'complex_inquiry' ||
      aiResponse.intent === 'complaint' ||
      aiResponse.intent === 'escalation'
    )
  }

  /**
   * Example: Handle booking request with function calling
   */
  async handleBookingRequest(
    phone: string,
    serviceName: string,
    preferredDate: string,
    preferredTime: string,
    clientName: string,
    context: ConversationContext
  ): Promise<void> {
    console.log('📅 Handling booking request via function calling...')

    try {
      // Execute the complete booking workflow
      const execution = await this.functionCalling.executeWorkflow(
        'demo_complete_booking', // Using the demo workflow we created
        context,
        {
          service_name: serviceName,
          date: preferredDate,
          time: preferredTime,
          client_name: clientName,
          phone: phone
        }
      )

      console.log(`📊 Booking workflow ${execution.status}:`, {
        workflowId: execution.workflowId,
        duration: execution.endTime 
          ? execution.endTime.getTime() - execution.startTime.getTime() 
          : 'N/A',
        stepsCompleted: execution.steps.filter(s => s.status === 'completed').length
      })

    } catch (error) {
      console.error('❌ Booking workflow failed:', error)
      
      // Send error notification
      await this.whatsappService.sendMessage(
        phone,
        '❌ Não foi possível processar seu agendamento no momento. Nossa equipe irá entrar em contato em breve!'
      )
    }
  }

  /**
   * Get function calling statistics
   */
  getStats() {
    return {
      functionCalling: this.functionCalling.getStats(),
      registry: this.functionCalling.getRegistryStats()
    }
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.functionCalling.cleanup()
    console.log('🧹 WhatsApp Function Calling integration cleaned up')
  }
}

// Example usage
export async function exampleUsage(): Promise<void> {
  const integration = new WhatsAppFunctionCallingIntegration()
  
  // Simulate processing a booking message
  const context: ConversationContext = {
    tenantId: 'beauty_salon_1',
    userId: 'user_12345',
    messageId: 'msg_67890',
    timestamp: new Date(),
    tenantConfig: {
      domain: 'beauty' as any,
      whatsapp: {
        phoneNumberId: '123456789',
        accessToken: 'token',
        webhookVerifyToken: 'verify'
      }
    }
  }

  await integration.processWhatsAppMessage(
    '+5511999999999',
    'Olá! Gostaria de agendar um corte de cabelo para amanhã às 14h. Meu nome é João Silva.',
    context
  )

  // Show statistics
  console.log('📊 Integration Statistics:', integration.getStats())

  // Cleanup
  integration.cleanup()
}

// Auto-run example if executed directly
if (require.main === module) {
  exampleUsage().catch(console.error)
} 