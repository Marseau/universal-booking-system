import OpenAI from 'openai'
import { 
  AIMessage, 
  ConversationContext, 
  AIResponse, 
  ProcessingResult,
  Intent,
  IntentType,
  Entity,
  AIAgent,
  AIFunction,
  FunctionCall,
  FunctionResult,
  AIError,
  FunctionCallError,
  MemoryManager,
  MediaContent,
  AIConfig
} from '../types/ai.types'
import { BusinessDomain } from '../types/database.types'
import { AgentFactory } from './agents/agent-factory'
import { MemoryService } from './memory.service'
import { MediaProcessorService } from './media-processor.service'

export class AIService {
  private openai: OpenAI
  private agentFactory: AgentFactory
  private memoryService: MemoryService
  private mediaProcessor: MediaProcessorService
  private config: AIConfig

  constructor() {
    this.config = {
      openaiApiKey: process.env.OPENAI_API_KEY || '',
      model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
      temperature: parseFloat(process.env.AI_TEMPERATURE || '0.7'),
      maxTokens: parseInt(process.env.AI_MAX_TOKENS || '2048'),
      timeout: parseInt(process.env.AI_TIMEOUT || '30000'),
      retryAttempts: parseInt(process.env.AI_RETRY_ATTEMPTS || '3'),
      memoryTtl: parseInt(process.env.AI_MEMORY_TTL || '3600'),
      enableFunctionCalling: process.env.AI_ENABLE_FUNCTIONS !== 'false',
      enableMultiModal: process.env.AI_ENABLE_MULTIMODAL !== 'false',
      logLevel: (process.env.AI_LOG_LEVEL as any) || 'info'
    }

    if (!this.config.openaiApiKey) {
      console.warn('⚠️  OpenAI API key not configured. AI features will be disabled.')
      return
    }

    this.openai = new OpenAI({
      apiKey: this.config.openaiApiKey,
      timeout: this.config.timeout
    })

    this.agentFactory = new AgentFactory()
    this.memoryService = new MemoryService(this.config.memoryTtl)
    this.mediaProcessor = new MediaProcessorService(this.openai)

    console.log('🤖 AI Service initialized with model:', this.config.model)
  }

  /**
   * Process incoming message with AI
   */
  async processMessage(
    message: string,
    context: ConversationContext,
    media?: MediaContent[]
  ): Promise<ProcessingResult> {
    try {
      if (!this.openai) {
        throw new AIError('OpenAI not configured', 'NO_OPENAI_CONFIG')
      }

      // Get memory manager for this conversation
      const memory = await this.memoryService.getMemoryManager(context.sessionId)
      await memory.updateContext(context)

      // Process media content if present
      let enrichedMessage = message
      if (media && media.length > 0 && this.config.enableMultiModal) {
        enrichedMessage = await this.processMediaContent(message, media)
      }

      // Recognize intent first
      const intent = await this.recognizeIntent(enrichedMessage, context)
      
      // Get appropriate agent for the tenant's domain
      const agent = this.agentFactory.getAgent(context.tenantConfig?.domain || 'other')
      
      // Build conversation messages
      const messages = await this.buildConversationMessages(enrichedMessage, context, agent)
      
      // Get AI response
      const aiResponse = await this.getAIResponse(messages, agent, context)
      
      // Process function calls if any
      const functionResults = await this.processFunctionCalls(aiResponse, context)
      
      // Build final response
      const response: AIResponse = {
        message: aiResponse.message || '',
        intent,
        functionCalls: aiResponse.function_call ? [aiResponse.function_call] : [],
        confidence: this.calculateConfidence(aiResponse, intent),
        shouldEscalate: this.shouldEscalate(enrichedMessage, intent, context),
        suggestedActions: this.generateSuggestedActions(intent, context),
        context: this.extractResponseContext(functionResults)
      }

      // Update conversation history
      const updatedContext = await this.updateConversationHistory(
        context, 
        enrichedMessage, 
        response, 
        memory
      )

      // Generate actions
      const actions = await this.generateActions(response, updatedContext)

      return {
        response,
        updatedContext,
        actions
      }

    } catch (error) {
      console.error('❌ Error processing AI message:', error)
      
      // Fallback response
      const fallbackResponse: AIResponse = {
        message: 'Desculpe, estou com dificuldades técnicas no momento. Por favor, tente novamente em alguns instantes ou entre em contato diretamente conosco.',
        confidence: 0,
        shouldEscalate: true,
        context: { error: error instanceof Error ? error.message : 'Unknown error' }
      }

      return {
        response: fallbackResponse,
        updatedContext: context,
        actions: [{
          type: 'escalate_to_human',
          payload: { reason: 'ai_error', error: error instanceof Error ? error.message : 'Unknown error' },
          priority: 'high'
        }]
      }
    }
  }

  /**
   * Process media content (images, audio, etc.)
   */
  private async processMediaContent(message: string, media: MediaContent[]): Promise<string> {
    const mediaAnalysis: string[] = []

    for (const item of media) {
      try {
        let analysis = ''
        
        switch (item.type) {
          case 'image':
            analysis = await this.mediaProcessor.processImage(
              item.content as Buffer, 
              item.mimeType
            )
            mediaAnalysis.push(`[Imagem analisada: ${analysis}]`)
            break
            
          case 'audio':
            analysis = await this.mediaProcessor.processAudio(
              item.content as Buffer, 
              item.mimeType
            )
            mediaAnalysis.push(`[Áudio transcrito: ${analysis}]`)
            break
            
          case 'document':
            analysis = await this.mediaProcessor.extractText(
              item.content as Buffer, 
              item.mimeType
            )
            mediaAnalysis.push(`[Documento analisado: ${analysis}]`)
            break
        }
      } catch (error) {
        console.error(`Error processing ${item.type}:`, error)
        mediaAnalysis.push(`[Erro ao processar ${item.type}]`)
      }
    }

    return mediaAnalysis.length > 0 
      ? `${message}\n\n${mediaAnalysis.join('\n')}`
      : message
  }

  /**
   * Recognize user intent from message
   */
  private async recognizeIntent(message: string, context: ConversationContext): Promise<Intent> {
    try {
      const intentPrompt = this.buildIntentRecognitionPrompt(message, context)
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo', // Use faster model for intent recognition
        messages: [{ role: 'user', content: intentPrompt }],
        temperature: 0.3,
        max_tokens: 200
      })

      const result = response.choices[0]?.message?.content
      if (!result) {
        throw new AIError('No intent recognition result', 'NO_INTENT_RESULT')
      }

      return this.parseIntentResult(result)

    } catch (error) {
      console.error('Error recognizing intent:', error)
      return {
        type: 'other',
        confidence: 0.5,
        entities: [],
        context: {}
      }
    }
  }

  /**
   * Build messages for OpenAI conversation
   */
  private async buildConversationMessages(
    message: string, 
    context: ConversationContext, 
    agent: AIAgent
  ): Promise<OpenAI.Chat.Completions.ChatCompletionMessageParam[]> {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = []

    // System prompt with agent instructions
    messages.push({
      role: 'system',
      content: this.buildSystemPrompt(agent, context)
    })

    // Add recent conversation history (last 10 messages)
    const recentHistory = context.conversationHistory.slice(-10)
    for (const historyMessage of recentHistory) {
      if (historyMessage.role !== 'system') {
        messages.push({
          role: historyMessage.role as any,
          content: historyMessage.content
        })
      }
    }

    // Add current user message
    messages.push({
      role: 'user',
      content: message
    })

    return messages
  }

  /**
   * Get response from OpenAI
   */
  private async getAIResponse(
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    agent: AIAgent,
    context: ConversationContext
  ): Promise<{ message?: string; function_call?: FunctionCall }> {
    const functions = this.config.enableFunctionCalling ? 
      agent.functions.map(f => this.convertToOpenAIFunction(f)) : undefined

    const response = await this.openai.chat.completions.create({
      model: agent.model || this.config.model,
      messages,
      temperature: agent.temperature || this.config.temperature,
      max_tokens: agent.maxTokens || this.config.maxTokens,
      functions,
      function_call: functions && functions.length > 0 ? 'auto' : undefined
    })

    const choice = response.choices[0]
    if (!choice) {
      throw new AIError('No response from OpenAI', 'NO_RESPONSE')
    }

    return {
      message: choice.message?.content || undefined,
      function_call: choice.message?.function_call ? {
        name: choice.message.function_call.name,
        arguments: choice.message.function_call.arguments || '{}'
      } : undefined
    }
  }

  /**
   * Process function calls from AI response
   */
  private async processFunctionCalls(
    aiResponse: { message?: string; function_call?: FunctionCall },
    context: ConversationContext
  ): Promise<FunctionResult[]> {
    const results: FunctionResult[] = []

    if (aiResponse.function_call) {
      try {
        const agent = this.agentFactory.getAgent(context.tenantConfig?.domain || 'other')
        const functionDef = agent.functions.find(f => f.name === aiResponse.function_call!.name)
        
        if (!functionDef) {
          throw new FunctionCallError(
            aiResponse.function_call.name, 
            'Function not found'
          )
        }

        const args = JSON.parse(aiResponse.function_call.arguments)
        const result = await functionDef.handler(args, context)
        results.push(result)

      } catch (error) {
        console.error('Error executing function call:', error)
        results.push({
          success: false,
          message: error instanceof Error ? error.message : 'Function execution failed',
          shouldContinue: true
        })
      }
    }

    return results
  }

  /**
   * Build system prompt for agent
   */
  private buildSystemPrompt(agent: AIAgent, context: ConversationContext): string {
    const tenant = context.tenantConfig
    const user = context.userProfile
    
    let prompt = agent.systemPrompt

    // Add business context
    if (tenant) {
      prompt += `\n\nCONTEXTO DO NEGÓCIO:
- Nome: ${tenant.businessName}
- Domínio: ${tenant.domain}
- Serviços disponíveis: ${tenant.services.map(s => s.name).join(', ')}`

      if (tenant.aiSettings.greetingMessage) {
        prompt += `\n- Mensagem de saudação padrão: ${tenant.aiSettings.greetingMessage}`
      }
    }

    // Add user context
    if (user) {
      prompt += `\n\nCONTEXTO DO USUÁRIO:
- Nome: ${user.preferredName || user.name || 'não informado'}
- Agendamentos anteriores: ${user.previousAppointments.length}
- Idioma: ${user.language}
- Timezone: ${user.timezone}`
    }

    // Add current time context
    prompt += `\n\nCONTEXTO TEMPORAL:
- Data/hora atual: ${new Date().toLocaleString('pt-BR', { timeZone: tenant?.businessHours.timezone })}
- Timezone do negócio: ${tenant?.businessHours.timezone || 'America/Sao_Paulo'}`

    return prompt
  }

  /**
   * Build intent recognition prompt
   */
  private buildIntentRecognitionPrompt(message: string, context: ConversationContext): string {
    return `Analise a seguinte mensagem e identifique a intenção do usuário.

Mensagem: "${message}"

Contexto do negócio: ${context.tenantConfig?.domain || 'geral'}

Possíveis intenções:
- booking_request: solicitar agendamento
- booking_cancel: cancelar agendamento  
- booking_reschedule: reagendar agendamento
- booking_inquiry: perguntar sobre agendamento existente
- service_inquiry: perguntar sobre serviços
- availability_check: verificar disponibilidade
- price_inquiry: perguntar sobre preços
- business_hours: perguntar sobre horários de funcionamento
- location_inquiry: perguntar sobre localização
- general_greeting: cumprimento geral
- complaint: reclamação
- compliment: elogio
- escalation_request: solicitar atendimento humano
- emergency: emergência
- other: outras intenções

Retorne APENAS um JSON no formato:
{
  "intent": "tipo_da_intencao",
  "confidence": 0.95,
  "entities": [
    {"type": "service_name", "value": "exemplo", "confidence": 0.9}
  ]
}`
  }

  /**
   * Parse intent recognition result
   */
  private parseIntentResult(result: string): Intent {
    try {
      const parsed = JSON.parse(result)
      return {
        type: parsed.intent || 'other',
        confidence: parsed.confidence || 0.5,
        entities: parsed.entities || [],
        context: {}
      }
    } catch (error) {
      console.error('Error parsing intent result:', error)
      return {
        type: 'other',
        confidence: 0.5,
        entities: [],
        context: {}
      }
    }
  }

  /**
   * Convert AI function to OpenAI function format
   */
  private convertToOpenAIFunction(func: AIFunction): OpenAI.Chat.Completions.ChatCompletionCreateParams.Function {
    const properties: Record<string, any> = {}
    const required: string[] = []

    for (const param of func.parameters) {
      properties[param.name] = {
        type: param.type,
        description: param.description
      }

      if (param.enum) {
        properties[param.name].enum = param.enum
      }

      if (param.required) {
        required.push(param.name)
      }
    }

    return {
      name: func.name,
      description: func.description,
      parameters: {
        type: 'object',
        properties,
        required
      }
    }
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(aiResponse: any, intent: Intent): number {
    // Base confidence from intent recognition
    let confidence = intent.confidence

    // Boost confidence if function was called successfully
    if (aiResponse.function_call) {
      confidence = Math.min(confidence + 0.2, 1.0)
    }

    // Reduce confidence for generic responses
    if (aiResponse.message && aiResponse.message.length < 20) {
      confidence = Math.max(confidence - 0.1, 0.1)
    }

    return Math.round(confidence * 100) / 100
  }

  /**
   * Determine if conversation should be escalated
   */
  private shouldEscalate(message: string, intent: Intent, context: ConversationContext): boolean {
    // Emergency situations
    if (intent.type === 'emergency') return true

    // Explicit escalation requests
    if (intent.type === 'escalation_request') return true

    // Multiple failed attempts
    const recentMessages = context.conversationHistory.slice(-6)
    const aiResponses = recentMessages.filter(m => m.role === 'assistant')
    if (aiResponses.length >= 3 && intent.confidence < 0.6) return true

    // Domain-specific escalation triggers
    const escalationTriggers = context.tenantConfig?.aiSettings.escalationTriggers || []
    const lowerMessage = message.toLowerCase()
    
    return escalationTriggers.some(trigger => 
      lowerMessage.includes(trigger.toLowerCase())
    )
  }

  /**
   * Generate suggested actions based on intent
   */
  private generateSuggestedActions(intent: Intent, context: ConversationContext): string[] {
    const actions: string[] = []

    switch (intent.type) {
      case 'booking_request':
        actions.push('Verificar disponibilidade', 'Confirmar detalhes do serviço')
        break
      case 'service_inquiry':
        actions.push('Mostrar lista de serviços', 'Explicar preços')
        break
      case 'availability_check':
        actions.push('Consultar agenda', 'Sugerir horários')
        break
      default:
        actions.push('Continuar conversa')
    }

    return actions
  }

  /**
   * Extract context from function results
   */
  private extractResponseContext(functionResults: FunctionResult[]): Record<string, any> {
    const context: Record<string, any> = {}

    for (const result of functionResults) {
      if (result.success && result.data) {
        Object.assign(context, result.data)
      }
    }

    return context
  }

  /**
   * Update conversation history
   */
  private async updateConversationHistory(
    context: ConversationContext,
    userMessage: string,
    aiResponse: AIResponse,
    memory: MemoryManager
  ): Promise<ConversationContext> {
    // Add user message
    const userMsg: AIMessage = {
      id: `msg_${Date.now()}_user`,
      role: 'user',
      content: userMessage,
      timestamp: new Date()
    }

    // Add assistant response
    const assistantMsg: AIMessage = {
      id: `msg_${Date.now()}_assistant`,
      role: 'assistant',
      content: aiResponse.message,
      timestamp: new Date()
    }

    const updatedHistory = [
      ...context.conversationHistory,
      userMsg,
      assistantMsg
    ]

    // Keep only last 50 messages to manage memory
    const trimmedHistory = updatedHistory.slice(-50)

    const updatedContext: ConversationContext = {
      ...context,
      conversationHistory: trimmedHistory,
      currentIntent: aiResponse.intent,
      lastInteraction: new Date()
    }

    await memory.updateContext(updatedContext)
    return updatedContext
  }

  /**
   * Generate actions from AI response
   */
  private async generateActions(
    response: AIResponse, 
    context: ConversationContext
  ): Promise<any[]> {
    const actions: any[] = []

    // Always send the response message
    if (response.message) {
      actions.push({
        type: 'send_message',
        payload: { 
          message: response.message,
          phoneNumber: context.phoneNumber
        },
        priority: 'high'
      })
    }

    // Escalation if needed
    if (response.shouldEscalate) {
      actions.push({
        type: 'escalate_to_human',
        payload: {
          reason: response.intent?.type || 'unknown',
          context: response.context
        },
        priority: 'high'
      })
    }

    // Log interaction
    actions.push({
      type: 'log_interaction',
      payload: {
        userId: context.userId,
        tenantId: context.tenantId,
        intent: response.intent?.type,
        confidence: response.confidence,
        message: response.message,
        timestamp: new Date()
      },
      priority: 'low'
    })

    return actions
  }

  /**
   * Health check for AI service
   */
  async healthCheck(): Promise<{ status: string; details: Record<string, any> }> {
    const details: Record<string, any> = {
      openai_configured: !!this.config.openaiApiKey,
      model: this.config.model,
      functions_enabled: this.config.enableFunctionCalling,
      multimodal_enabled: this.config.enableMultiModal
    }

    if (this.openai) {
      try {
        // Test API connectivity with a simple request
        const response = await this.openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Test' }],
          max_tokens: 5
        })

        details.openai_api_status = 'connected'
        details.openai_model_available = !!response.choices[0]
      } catch (error) {
        details.openai_api_status = 'error'
        details.openai_error = error instanceof Error ? error.message : 'Unknown error'
      }
    } else {
      details.openai_api_status = 'not_configured'
    }

    const status = details.openai_configured && details.openai_api_status === 'connected' 
      ? 'healthy' 
      : 'degraded'

    return { status, details }
  }
}

export default AIService