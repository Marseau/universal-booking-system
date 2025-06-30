import OpenAI from 'openai'
import { 
  MultiModalContent, 
  MultiModalAnalysis, 
  BusinessContextAnalysis,
  EmotionalAnalysis,
  ExtractedEntity,
  MultiModalProcessor,
  MultiModalIntentResult,
  AudioProcessingOptions,
  ImageProcessingOptions,
  VideoProcessingOptions,
  DocumentProcessingOptions,
  MultiModalCapabilities,
  ProcessingMetrics,
  ContentPosition
} from '../types/multimodal.types'
import { Intent, ConversationContext } from '../types/ai.types'
import { BusinessDomain } from '../types/database.types'
import { AdvancedIntentRecognitionService } from './advanced-intent-recognition.service'

export class AdvancedMultiModalService implements MultiModalProcessor {
  private openai: OpenAI | null = null
  private intentService: AdvancedIntentRecognitionService
  private metrics: ProcessingMetrics
  private cache = new Map<string, MultiModalAnalysis>()
  private cacheTTL = 300000 // 5 minutes

  constructor() {
    // Initialize OpenAI if API key is available
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      })
    }

    this.intentService = new AdvancedIntentRecognitionService()
    this.metrics = this.initializeMetrics()
  }

  /**
   * Process multi-modal content and extract comprehensive analysis
   */
  async processContent(content: MultiModalContent): Promise<MultiModalAnalysis> {
    const startTime = Date.now()
    
    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(content)
      const cached = this.getCachedResult(cacheKey)
      if (cached) {
        return cached
      }

      let analysis: MultiModalAnalysis

      switch (content.type) {
        case 'text':
          analysis = await this.processText(content)
          break
        case 'audio':
          analysis = await this.processAudio(content)
          break
        case 'image':
          analysis = await this.processImage(content)
          break
        case 'video':
          analysis = await this.processVideo(content)
          break
        case 'document':
          analysis = await this.processDocument(content)
          break
        default:
          throw new Error(`Unsupported content type: ${content.type}`)
      }

      // Add processing time
      analysis.processingTime = Date.now() - startTime

      // Cache result
      this.setCachedResult(cacheKey, analysis)

      // Update metrics
      this.updateMetrics(content.type, analysis.processingTime, true)

      return analysis

    } catch (error) {
      this.updateMetrics(content.type, Date.now() - startTime, false)
      throw error
    }
  }

  /**
   * Process text content with enhanced analysis
   */
  private async processText(content: MultiModalContent): Promise<MultiModalAnalysis> {
    const text = typeof content.content === 'string' ? content.content : content.content.toString('utf-8')
    
    const [
      entities,
      businessContext,
      emotionalAnalysis
    ] = await Promise.all([
      this.extractEntitiesFromText(text),
      this.analyzeTextForBusiness(text),
      this.analyzeTextEmotion(text)
    ])

    return {
      contentId: content.id,
      contentType: 'text',
      primaryAnalysis: text,
      businessContext,
      emotionalAnalysis,
      entities,
      confidence: 0.95,
      processingTime: 0
    }
  }

  /**
   * Process audio content with transcription and analysis
   */
  private async processAudio(content: MultiModalContent, options?: AudioProcessingOptions): Promise<MultiModalAnalysis> {
    const buffer = content.content instanceof Buffer ? content.content : Buffer.from(content.content)
    
    // Transcribe audio
    const transcription = await this.transcribeAudio(buffer, content.mimeType, options)
    
    // Analyze transcribed text
    const [
      entities,
      businessContext,
      emotionalAnalysis
    ] = await Promise.all([
      this.extractEntitiesFromText(transcription),
      this.analyzeTextForBusiness(transcription),
      this.analyzeAudioEmotion(buffer, transcription, options)
    ])

    return {
      contentId: content.id,
      contentType: 'audio',
      primaryAnalysis: transcription,
      transcription,
      businessContext,
      emotionalAnalysis,
      entities,
      confidence: 0.88,
      processingTime: 0
    }
  }

  /**
   * Process image content with OCR and visual analysis
   */
  private async processImage(content: MultiModalContent, options?: ImageProcessingOptions): Promise<MultiModalAnalysis> {
    const buffer = content.content instanceof Buffer ? content.content : Buffer.from(content.content)
    
    const [
      visualDescription,
      ocrText,
      entities
    ] = await Promise.all([
      this.analyzeImageVisually(buffer, content.mimeType, options),
      this.extractTextFromImage(buffer, content.mimeType, options),
      this.extractEntitiesFromImage(buffer, content.mimeType)
    ])

    const combinedText = `${visualDescription}\n${ocrText}`.trim()
    
    const [
      businessContext,
      emotionalAnalysis
    ] = await Promise.all([
      this.analyzeTextForBusiness(combinedText),
      this.analyzeImageEmotion(combinedText)
    ])

    return {
      contentId: content.id,
      contentType: 'image',
      primaryAnalysis: visualDescription,
      ocrText,
      visualDescription,
      businessContext,
      emotionalAnalysis,
      entities,
      confidence: 0.82,
      processingTime: 0
    }
  }

  /**
   * Process video content
   */
  private async processVideo(content: MultiModalContent, options?: VideoProcessingOptions): Promise<MultiModalAnalysis> {
    // For now, provide basic video analysis
    // In production, this would involve frame extraction, audio transcription, etc.
    
    const basicAnalysis = `Vídeo recebido (${content.mimeType}). Processamento completo de vídeo requer recursos adicionais.`
    
    return {
      contentId: content.id,
      contentType: 'video',
      primaryAnalysis: basicAnalysis,
      businessContext: {
        relevantServices: [],
        suggestedActions: ['Revisar vídeo manualmente'],
        urgencyLevel: 'medium',
        requiresHumanReview: true,
        contextualInsights: ['Conteúdo em vídeo requer análise manual']
      },
      emotionalAnalysis: {
        tone: 'neutral',
        confidence: 0.5,
        emotionalKeywords: [],
        sentimentScore: 0
      },
      entities: [],
      confidence: 0.6,
      processingTime: 0
    }
  }

  /**
   * Process document content
   */
  private async processDocument(content: MultiModalContent, options?: DocumentProcessingOptions): Promise<MultiModalAnalysis> {
    const buffer = content.content instanceof Buffer ? content.content : Buffer.from(content.content)
    
    const extractedText = await this.extractTextFromDocument(buffer, content.mimeType, options)
    
    const [
      entities,
      businessContext,
      emotionalAnalysis
    ] = await Promise.all([
      this.extractEntitiesFromText(extractedText),
      this.analyzeDocumentForBusiness(extractedText, content.mimeType),
      this.analyzeTextEmotion(extractedText)
    ])

    return {
      contentId: content.id,
      contentType: 'document',
      primaryAnalysis: extractedText,
      ocrText: extractedText,
      businessContext,
      emotionalAnalysis,
      entities,
      confidence: 0.90,
      processingTime: 0
    }
  }

  /**
   * Enhanced intent recognition combining text and multi-modal analysis
   */
  async enhanceIntentWithMultiModal(
    textIntent: Intent,
    multiModalContent: MultiModalContent[],
    context: ConversationContext
  ): Promise<MultiModalIntentResult> {
    
    // Process all multi-modal content
    const analyses = await Promise.all(
      multiModalContent.map(content => this.processContent(content))
    )

    // Combine entities from all sources
    const enhancedEntities = this.combineEntities([
      ...textIntent.entities,
      ...analyses.flatMap(a => a.entities)
    ])

    // Analyze business context from all content
    const combinedBusinessContext = this.combineBusinessContext(
      analyses.map(a => a.businessContext).filter(Boolean) as BusinessContextAnalysis[]
    )

    // Determine if human review is needed
    const requiresHumanReview = analyses.some(a => 
      a.businessContext?.requiresHumanReview || 
      a.confidence < 0.7 ||
      a.warnings && a.warnings.length > 0
    )

    // Calculate enhanced confidence
    const multiModalConfidence = analyses.reduce((sum, a) => sum + a.confidence, 0) / analyses.length
    const enhancedConfidence = (textIntent.confidence + multiModalConfidence) / 2

    // Determine recommended action
    const recommendedAction = this.determineRecommendedAction(
      textIntent,
      combinedBusinessContext,
      enhancedEntities
    )

    return {
      originalIntent: textIntent,
      multiModalEnhancement: analyses[0] || {
        contentId: 'combined',
        contentType: 'text',
        primaryAnalysis: 'Multi-modal enhancement',
        entities: enhancedEntities,
        confidence: multiModalConfidence,
        processingTime: 0
      },
      enhancedEntities,
      confidence: enhancedConfidence,
      recommendedAction,
      requiresHumanReview
    }
  }

  /**
   * Extract entities from text using advanced NLP
   */
  async extractEntities(analysis: MultiModalAnalysis): Promise<ExtractedEntity[]> {
    return analysis.entities
  }

  /**
   * Analyze business context
   */
  async analyzeBusinessContext(analysis: MultiModalAnalysis, domain?: string): Promise<BusinessContextAnalysis> {
    if (analysis.businessContext) {
      return analysis.businessContext
    }

    return this.analyzeTextForBusiness(analysis.primaryAnalysis, domain)
  }

  /**
   * Analyze emotion from content
   */
  async analyzeEmotion(content: MultiModalContent): Promise<EmotionalAnalysis> {
    switch (content.type) {
      case 'text':
        return this.analyzeTextEmotion(content.content.toString())
      case 'audio':
        const transcription = await this.transcribeAudio(
          content.content instanceof Buffer ? content.content : Buffer.from(content.content),
          content.mimeType
        )
        return this.analyzeAudioEmotion(
          content.content instanceof Buffer ? content.content : Buffer.from(content.content),
          transcription
        )
      case 'image':
        const description = await this.analyzeImageVisually(
          content.content instanceof Buffer ? content.content : Buffer.from(content.content),
          content.mimeType
        )
        return this.analyzeImageEmotion(description)
      default:
        return {
          tone: 'neutral',
          confidence: 0.5,
          emotionalKeywords: [],
          sentimentScore: 0
        }
    }
  }

  /**
   * Detect language in text
   */
  async detectLanguage(text: string): Promise<string> {
    if (!this.openai) {
      return this.detectLanguageFallback(text)
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{
          role: 'user',
          content: `Detect the language of this text and respond with just the language code (e.g., 'pt', 'en', 'es'): "${text.substring(0, 200)}"`
        }],
        max_tokens: 10,
        temperature: 0
      })

      return response.choices[0]?.message?.content?.trim().toLowerCase() || 'pt'
    } catch (error) {
      return this.detectLanguageFallback(text)
    }
  }

  /**
   * Translate content to target language
   */
  async translateContent(text: string, targetLanguage: string): Promise<string> {
    if (!this.openai) {
      return `[Tradução para ${targetLanguage} não disponível: OpenAI não configurado] ${text}`
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{
          role: 'user',
          content: `Translate the following text to ${targetLanguage}: "${text}"`
        }],
        max_tokens: Math.min(1000, text.length * 2),
        temperature: 0.3
      })

      return response.choices[0]?.message?.content || text
    } catch (error) {
      console.error('Translation error:', error)
      return text
    }
  }

  /**
   * Get system capabilities
   */
  getCapabilities(): MultiModalCapabilities {
    return {
      supportedFormats: {
        audio: ['audio/wav', 'audio/mp3', 'audio/m4a', 'audio/ogg'],
        image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
        video: ['video/mp4', 'video/mov', 'video/avi'],
        document: ['application/pdf', 'text/plain', 'application/msword']
      },
      maxFileSize: {
        audio: 25 * 1024 * 1024, // 25MB
        image: 20 * 1024 * 1024,  // 20MB
        video: 100 * 1024 * 1024, // 100MB
        document: 50 * 1024 * 1024 // 50MB
      },
      features: {
        transcription: !!this.openai,
        translation: !!this.openai,
        ocr: !!this.openai,
        emotionDetection: true,
        objectDetection: !!this.openai,
        faceDetection: false // Would require additional services
      }
    }
  }

  /**
   * Get processing metrics
   */
  getMetrics(): ProcessingMetrics {
    return { ...this.metrics }
  }

  /**
   * Clear cache and reset metrics
   */
  reset(): void {
    this.cache.clear()
    this.metrics = this.initializeMetrics()
  }

  // Private helper methods...

  private async transcribeAudio(buffer: Buffer, mimeType: string, options?: AudioProcessingOptions): Promise<string> {
    if (!this.openai) {
      return `[Áudio recebido - Transcrição não disponível: OpenAI não configurado]`
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

  private async analyzeImageVisually(buffer: Buffer, mimeType: string, options?: ImageProcessingOptions): Promise<string> {
    if (!this.openai) {
      return `[Imagem recebida - Análise visual não disponível: OpenAI não configurado]`
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

  private async extractTextFromImage(buffer: Buffer, mimeType: string, options?: ImageProcessingOptions): Promise<string> {
    if (!options?.performOCR || !this.openai) {
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

  private async extractTextFromDocument(buffer: Buffer, mimeType: string, options?: DocumentProcessingOptions): Promise<string> {
    if (mimeType.includes('text/plain')) {
      return buffer.toString('utf-8')
    } else if (mimeType.includes('pdf')) {
      return '[Documento PDF recebido - Extração de texto requer processamento adicional]'
    } else {
      return '[Documento recebido - Tipo não suportado para extração automática]'
    }
  }

  private async extractEntitiesFromText(text: string): Promise<ExtractedEntity[]> {
    // Use the existing intent service to extract entities
    const context = this.createDummyContext()
    const intent = await this.intentService.recognizeIntent(text, context)
    
    return intent.entities.map(entity => ({
      ...entity,
      source: 'text' as const
    }))
  }

  private async extractEntitiesFromImage(buffer: Buffer, mimeType: string): Promise<ExtractedEntity[]> {
    // For now, return empty array. In production, this would use specialized image analysis
    return []
  }

  private async analyzeTextForBusiness(text: string, domain?: string): Promise<BusinessContextAnalysis> {
    // Analyze text for business context using patterns and AI
    const urgencyKeywords = ['urgente', 'emergência', 'rápido', 'socorro']
    const serviceKeywords = ['agendar', 'marcar', 'consulta', 'appointment', 'booking']
    
    const hasUrgency = urgencyKeywords.some(keyword => text.toLowerCase().includes(keyword))
    const hasServiceRequest = serviceKeywords.some(keyword => text.toLowerCase().includes(keyword))
    
    return {
      relevantServices: hasServiceRequest ? ['agendamento'] : [],
      suggestedActions: hasServiceRequest ? ['create_appointment'] : ['send_information'],
      businessDomain: domain,
      urgencyLevel: hasUrgency ? 'high' : 'medium',
      requiresHumanReview: hasUrgency,
      contextualInsights: [
        hasServiceRequest ? 'Cliente solicita agendamento' : 'Solicitação de informações',
        hasUrgency ? 'Situação urgente detectada' : 'Situação normal'
      ]
    }
  }

  private async analyzeDocumentForBusiness(text: string, mimeType: string): Promise<BusinessContextAnalysis> {
    const documentTypes = {
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

  private async analyzeTextEmotion(text: string): Promise<EmotionalAnalysis> {
    const positiveWords = ['obrigado', 'ótimo', 'excelente', 'adorei', 'perfeito', 'satisfeito']
    const negativeWords = ['ruim', 'péssimo', 'problema', 'reclamação', 'insatisfeito', 'frustrado']
    const urgentWords = ['urgente', 'emergência', 'socorro', 'ajuda']
    
    const positive = positiveWords.filter(word => text.toLowerCase().includes(word)).length
    const negative = negativeWords.filter(word => text.toLowerCase().includes(word)).length
    const urgent = urgentWords.filter(word => text.toLowerCase().includes(word)).length
    
    let tone: EmotionalAnalysis['tone'] = 'neutral'
    let sentimentScore = 0
    
    if (urgent > 0) {
      tone = 'concerned'
      sentimentScore = -0.3
    } else if (negative > positive) {
      tone = 'negative'
      sentimentScore = -0.7
    } else if (positive > negative) {
      tone = 'positive'
      sentimentScore = 0.7
    }
    
    return {
      tone,
      confidence: Math.min(0.9, (positive + negative + urgent) * 0.2 + 0.5),
      emotionalKeywords: [...positiveWords, ...negativeWords, ...urgentWords].filter(word => 
        text.toLowerCase().includes(word)
      ),
      sentimentScore
    }
  }

  private async analyzeAudioEmotion(buffer: Buffer, transcription: string, options?: AudioProcessingOptions): Promise<EmotionalAnalysis> {
    // For now, analyze the transcription. In production, would analyze audio characteristics
    return this.analyzeTextEmotion(transcription)
  }

  private async analyzeImageEmotion(description: string): Promise<EmotionalAnalysis> {
    return this.analyzeTextEmotion(description)
  }

  private combineEntities(entities: ExtractedEntity[]): ExtractedEntity[] {
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

  private combineBusinessContext(contexts: BusinessContextAnalysis[]): BusinessContextAnalysis {
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

    if (contexts.length > 0 && contexts[0].businessDomain) {
      combined.businessDomain = contexts[0].businessDomain
    }

    return combined
  }

  private determineRecommendedAction(
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
    
    if (businessContext.requiresHumanReview) {
      return 'human_review'
    }
    
    return 'continue_conversation'
  }

  private generateCacheKey(content: MultiModalContent): string {
    const hash = this.simpleHash(content.content.toString().substring(0, 1000))
    return `${content.type}-${content.mimeType}-${hash}`
  }

  private simpleHash(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36)
  }

  private getCachedResult(key: string): MultiModalAnalysis | null {
    const entry = this.cache.get(key)
    if (entry) {
      // Check if cache entry is still valid
      if (Date.now() - entry.processingTime < this.cacheTTL) {
        return entry
      } else {
        this.cache.delete(key)
      }
    }
    return null
  }

  private setCachedResult(key: string, analysis: MultiModalAnalysis): void {
    this.cache.set(key, analysis)
    
    // Clean up old cache entries periodically
    if (this.cache.size > 100) {
      const entries = Array.from(this.cache.entries())
      entries.slice(0, 50).forEach(([key]) => this.cache.delete(key))
    }
  }

  private detectLanguageFallback(text: string): string {
    // Simple language detection based on common Portuguese words
    const portugueseWords = ['que', 'com', 'para', 'uma', 'você', 'não', 'por', 'mais', 'como']
    const foundWords = portugueseWords.filter(word => text.toLowerCase().includes(word)).length
    
    return foundWords > 2 ? 'pt' : 'en'
  }

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

  private initializeMetrics(): ProcessingMetrics {
    return {
      totalProcessed: 0,
      processingTime: { avg: 0, min: 0, max: 0 },
      successRate: 1,
      byContentType: {},
      errors: []
    }
  }

  private updateMetrics(contentType: string, processingTime: number, success: boolean): void {
    this.metrics.totalProcessed++
    
    // Update processing time
    if (this.metrics.totalProcessed === 1) {
      this.metrics.processingTime = { avg: processingTime, min: processingTime, max: processingTime }
    } else {
      this.metrics.processingTime.avg = 
        (this.metrics.processingTime.avg * (this.metrics.totalProcessed - 1) + processingTime) / this.metrics.totalProcessed
      this.metrics.processingTime.min = Math.min(this.metrics.processingTime.min, processingTime)
      this.metrics.processingTime.max = Math.max(this.metrics.processingTime.max, processingTime)
    }
    
    // Update by content type
    if (!this.metrics.byContentType[contentType]) {
      this.metrics.byContentType[contentType] = { count: 0, avgTime: 0, successRate: 1 }
    }
    
    const typeMetrics = this.metrics.byContentType[contentType]
    typeMetrics.count++
    typeMetrics.avgTime = (typeMetrics.avgTime * (typeMetrics.count - 1) + processingTime) / typeMetrics.count
    typeMetrics.successRate = success ? 
      (typeMetrics.successRate * (typeMetrics.count - 1) + 1) / typeMetrics.count :
      (typeMetrics.successRate * (typeMetrics.count - 1)) / typeMetrics.count
    
    // Update overall success rate
    const successCount = this.metrics.totalProcessed * this.metrics.successRate + (success ? 1 : 0) - 1
    this.metrics.successRate = successCount / this.metrics.totalProcessed
  }
}

export default AdvancedMultiModalService 