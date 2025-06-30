import OpenAI from 'openai'
import { 
  BusinessContextAnalysis,
  EmotionalAnalysis,
  ExtractedEntity,
  ProcessingMetrics
} from '../types/multimodal.types'
import { Intent, ConversationContext } from '../types/ai.types'
import { AdvancedIntentRecognitionService } from './advanced-intent-recognition.service'

/**
 * Helper methods for multi-modal processing
 */
export class MultiModalHelpers {
  private intentService: AdvancedIntentRecognitionService
  private openai: OpenAI | null = null

  constructor() {
    this.intentService = new AdvancedIntentRecognitionService()
    
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      })
    }
  }

  /**
   * Transcribe audio using OpenAI Whisper
   */
  async transcribeAudio(buffer: Buffer, mimeType: string): Promise<string> {
    if (!this.openai) {
      return '[Áudio recebido - Transcrição não disponível: OpenAI não configurado]'
    }

    try {
      const audioFile = new File([buffer], 'audio.wav', { type: mimeType })
      
      const transcription = await this.openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        language: 'pt',
        response_format: 'text',
        temperature: 0.0
      })

      return transcription || '[Não foi possível transcrever o áudio]'
    } catch (error) {
      console.error('Audio transcription error:', error)
      return `[Erro na transcrição do áudio: ${error}]`
    }
  }

  /**
   * Analyze image visually using GPT-4 Vision
   */
  async analyzeImageVisually(buffer: Buffer, mimeType: string): Promise<string> {
    if (!this.openai) {
      return '[Imagem recebida - Análise visual não disponível: OpenAI não configurado]'
    }

    try {
      const base64Image = buffer.toString('base64')
      const dataUrl = `data:${mimeType};base64,${base64Image}`

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-vision-preview',
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Analise esta imagem detalhadamente. Descreva o que você vê, incluindo objetos, pessoas, texto visível, e qualquer contexto relevante para atendimento ao cliente.'
            },
            {
              type: 'image_url',
              image_url: { url: dataUrl, detail: 'high' }
            }
          ]
        }],
        max_tokens: 500,
        temperature: 0.3
      })

      return response.choices[0]?.message?.content || '[Não foi possível analisar a imagem]'
    } catch (error) {
      console.error('Image analysis error:', error)
      return `[Erro na análise da imagem: ${error}]`
    }
  }

  /**
   * Extract text from image using OCR (GPT-4 Vision)
   */
  async extractTextFromImage(buffer: Buffer, mimeType: string): Promise<string> {
    if (!this.openai) {
      return ''
    }

    try {
      const base64Image = buffer.toString('base64')
      const dataUrl = `data:${mimeType};base64,${base64Image}`

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-vision-preview',
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Extraia todo o texto visível nesta imagem. Retorne apenas o texto, preservando a formatação quando possível.'
            },
            {
              type: 'image_url',
              image_url: { url: dataUrl, detail: 'high' }
            }
          ]
        }],
        max_tokens: 1000,
        temperature: 0
      })

      return response.choices[0]?.message?.content || ''
    } catch (error) {
      console.error('OCR error:', error)
      return ''
    }
  }

  /**
   * Extract text from document
   */
  async extractTextFromDocument(buffer: Buffer, mimeType: string): Promise<string> {
    if (mimeType.includes('text/plain')) {
      return buffer.toString('utf-8')
    } else if (mimeType.includes('pdf')) {
      return '[Documento PDF recebido - Extração de texto requer processamento adicional]'
    } else {
      return '[Documento recebido - Tipo não suportado para extração automática]'
    }
  }

  /**
   * Extract entities from text using existing intent service
   */
  async extractEntitiesFromText(text: string): Promise<ExtractedEntity[]> {
    const context = this.createDummyContext()
    const intent = await this.intentService.recognizeIntent(text, context)
    
    return intent.entities.map(entity => ({
      ...entity,
      source: 'text' as const
    }))
  }

  /**
   * Analyze text for business context
   */
  async analyzeTextForBusiness(text: string, domain?: string): Promise<BusinessContextAnalysis> {
    // Analyze text for business context using patterns
    const urgencyKeywords = ['urgente', 'emergência', 'rápido', 'socorro', 'agora', 'imediato']
    const serviceKeywords = ['agendar', 'marcar', 'consulta', 'appointment', 'booking', 'horário']
    const cancelKeywords = ['cancelar', 'desmarcar', 'remover', 'cancel']
    const infoKeywords = ['informação', 'preço', 'valor', 'horário', 'funcionamento', 'info']
    
    const hasUrgency = urgencyKeywords.some(keyword => text.toLowerCase().includes(keyword))
    const hasServiceRequest = serviceKeywords.some(keyword => text.toLowerCase().includes(keyword))
    const hasCancelRequest = cancelKeywords.some(keyword => text.toLowerCase().includes(keyword))
    const hasInfoRequest = infoKeywords.some(keyword => text.toLowerCase().includes(keyword))
    
    let suggestedActions: string[] = []
    let relevantServices: string[] = []
    
    if (hasServiceRequest) {
      suggestedActions.push('create_appointment')
      relevantServices.push('agendamento')
    }
    
    if (hasCancelRequest) {
      suggestedActions.push('cancel_appointment')
      relevantServices.push('cancelamento')
    }
    
    if (hasInfoRequest) {
      suggestedActions.push('send_information')
      relevantServices.push('informações')
    }
    
    if (suggestedActions.length === 0) {
      suggestedActions.push('continue_conversation')
    }
    
    const result: BusinessContextAnalysis = {
      relevantServices,
      suggestedActions,
      urgencyLevel: hasUrgency ? 'high' : 'medium',
      requiresHumanReview: hasUrgency,
      contextualInsights: [
        hasServiceRequest ? 'Cliente solicita agendamento' : 
        hasCancelRequest ? 'Cliente quer cancelar' :
        hasInfoRequest ? 'Cliente pede informações' : 'Conversa geral',
        hasUrgency ? 'Situação urgente detectada' : 'Situação normal'
      ]
    }

    if (domain) {
      result.businessDomain = domain
    }

    return result
  }

  /**
   * Analyze document for business context
   */
  async analyzeDocumentForBusiness(text: string, mimeType: string): Promise<BusinessContextAnalysis> {
    const documentTypes: Record<string, string> = {
      'application/pdf': 'PDF',
      'application/msword': 'Word',
      'text/plain': 'Texto'
    }

    return {
      relevantServices: ['document_review'],
      suggestedActions: ['review_document', 'extract_information'],
      urgencyLevel: 'medium',
      requiresHumanReview: true,
      contextualInsights: [
        `Documento ${documentTypes[mimeType] || 'desconhecido'} recebido`,
        'Requer análise manual detalhada'
      ]
    }
  }

  /**
   * Analyze text emotion
   */
  async analyzeTextEmotion(text: string): Promise<EmotionalAnalysis> {
    const positiveWords = ['obrigado', 'ótimo', 'excelente', 'adorei', 'perfeito', 'satisfeito', 'bom', 'legal']
    const negativeWords = ['ruim', 'péssimo', 'problema', 'reclamação', 'insatisfeito', 'frustrado', 'horrível']
    const urgentWords = ['urgente', 'emergência', 'socorro', 'ajuda', 'rápido', 'agora']
    const concernedWords = ['preocupado', 'ansioso', 'nervoso', 'medo', 'dúvida']
    
    const positive = positiveWords.filter(word => text.toLowerCase().includes(word)).length
    const negative = negativeWords.filter(word => text.toLowerCase().includes(word)).length
    const urgent = urgentWords.filter(word => text.toLowerCase().includes(word)).length
    const concerned = concernedWords.filter(word => text.toLowerCase().includes(word)).length
    
    let tone: EmotionalAnalysis['tone'] = 'neutral'
    let sentimentScore = 0
    
    if (urgent > 0) {
      tone = 'concerned'
      sentimentScore = -0.3
    } else if (concerned > 0) {
      tone = 'concerned'
      sentimentScore = -0.2
    } else if (negative > positive) {
      tone = 'negative'
      sentimentScore = -0.7
    } else if (positive > negative) {
      tone = 'positive'
      sentimentScore = 0.7
    }
    
    const foundWords = [...positiveWords, ...negativeWords, ...urgentWords, ...concernedWords]
      .filter(word => text.toLowerCase().includes(word))
    
    return {
      tone,
      confidence: Math.min(0.9, foundWords.length * 0.15 + 0.5),
      emotionalKeywords: foundWords,
      sentimentScore
    }
  }

  /**
   * Combine entities from multiple sources
   */
  combineEntities(entities: ExtractedEntity[]): ExtractedEntity[] {
    // Remove duplicates and combine similar entities
    const combined = new Map<string, ExtractedEntity>()
    
    entities.forEach(entity => {
      const key = `${entity.type}-${entity.value.toLowerCase()}`
      const existing = combined.get(key)
      
      if (!existing || entity.confidence > existing.confidence) {
        combined.set(key, entity)
      }
    })
    
    return Array.from(combined.values())
  }

  /**
   * Combine business context from multiple analyses
   */
  combineBusinessContext(contexts: BusinessContextAnalysis[]): BusinessContextAnalysis {
    if (contexts.length === 0) {
      return {
        relevantServices: [],
        suggestedActions: [],
        urgencyLevel: 'low',
        requiresHumanReview: false,
        contextualInsights: []
      }
    }

    const combined: BusinessContextAnalysis = {
      relevantServices: [...new Set(contexts.flatMap(c => c.relevantServices))],
      suggestedActions: [...new Set(contexts.flatMap(c => c.suggestedActions))],
      urgencyLevel: contexts.some(c => c.urgencyLevel === 'high') ? 'high' : 
                   contexts.some(c => c.urgencyLevel === 'medium') ? 'medium' : 'low',
      requiresHumanReview: contexts.some(c => c.requiresHumanReview),
      contextualInsights: [...new Set(contexts.flatMap(c => c.contextualInsights))]
    }

    if (contexts.length > 0 && contexts[0]?.businessDomain) {
      combined.businessDomain = contexts[0].businessDomain
    }

    return combined
  }

  /**
   * Determine recommended action based on analysis
   */
  determineRecommendedAction(
    intent: Intent,
    businessContext: BusinessContextAnalysis,
    entities: ExtractedEntity[]
  ): string {
    if (businessContext.urgencyLevel === 'high') {
      return 'escalate_to_human'
    }
    
    if (intent.type === 'booking_request') {
      return 'create_appointment'
    }
    
    if (intent.type === 'emergency') {
      return 'emergency_response'
    }
    
    if (intent.type === 'booking_cancel') {
      return 'cancel_appointment'
    }
    
    if (businessContext.requiresHumanReview) {
      return 'human_review'
    }
    
    return 'continue_conversation'
  }

  /**
   * Generate cache key for content
   */
  generateCacheKey(content: any): string {
    const contentStr = typeof content.content === 'string' ? 
      content.content : content.content.toString().substring(0, 1000)
    const hash = this.simpleHash(contentStr)
    return `${content.type}-${content.mimeType}-${hash}`
  }

  /**
   * Simple hash function
   */
  private simpleHash(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36)
  }

  /**
   * Detect language fallback
   */
  detectLanguageFallback(text: string): string {
    // Simple language detection based on common Portuguese words
    const portugueseWords = ['que', 'com', 'para', 'uma', 'você', 'não', 'por', 'mais', 'como', 'ser', 'ter']
    const foundWords = portugueseWords.filter(word => text.toLowerCase().includes(word)).length
    
    return foundWords > 2 ? 'pt' : 'en'
  }

  /**
   * Create dummy context for entity extraction
   */
  private createDummyContext(): ConversationContext {
    return {
      sessionId: 'multimodal-analysis',
      userId: 'system',
      tenantId: 'system',
      phoneNumber: '+0000000000',
      conversationHistory: [],
      lastInteraction: new Date()
    }
  }

  /**
   * Initialize metrics
   */
  initializeMetrics(): ProcessingMetrics {
    return {
      totalProcessed: 0,
      processingTime: { avg: 0, min: 0, max: 0 },
      successRate: 1,
      byContentType: {},
      errors: []
    }
  }

  /**
   * Update processing metrics
   */
  updateMetrics(
    metrics: ProcessingMetrics,
    contentType: string, 
    processingTime: number, 
    success: boolean
  ): void {
    metrics.totalProcessed++
    
    // Update processing time
    if (metrics.totalProcessed === 1) {
      metrics.processingTime = { avg: processingTime, min: processingTime, max: processingTime }
    } else {
      metrics.processingTime.avg = 
        (metrics.processingTime.avg * (metrics.totalProcessed - 1) + processingTime) / metrics.totalProcessed
      metrics.processingTime.min = Math.min(metrics.processingTime.min, processingTime)
      metrics.processingTime.max = Math.max(metrics.processingTime.max, processingTime)
    }
    
    // Update by content type
    if (!metrics.byContentType[contentType]) {
      metrics.byContentType[contentType] = { count: 0, avgTime: 0, successRate: 1 }
    }
    
    const typeMetrics = metrics.byContentType[contentType]!
    typeMetrics.count++
    typeMetrics.avgTime = (typeMetrics.avgTime * (typeMetrics.count - 1) + processingTime) / typeMetrics.count
    typeMetrics.successRate = success ? 
      (typeMetrics.successRate * (typeMetrics.count - 1) + 1) / typeMetrics.count :
      (typeMetrics.successRate * (typeMetrics.count - 1)) / typeMetrics.count
    
    // Update overall success rate
    const successCount = metrics.totalProcessed * metrics.successRate + (success ? 1 : 0) - 1
    metrics.successRate = successCount / metrics.totalProcessed
  }
} 