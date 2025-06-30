import OpenAI from 'openai'
import { 
  MultiModalContent, 
  MultiModalAnalysis, 
  BusinessContextAnalysis,
  EmotionalAnalysis,
  ExtractedEntity,
  MultiModalProcessor,
  MultiModalIntentResult,
  MultiModalCapabilities,
  ProcessingMetrics
} from '../types/multimodal.types'
import { Intent, ConversationContext } from '../types/ai.types'
import { AdvancedIntentRecognitionService } from './advanced-intent-recognition.service'
import { MultiModalHelpers } from './multimodal-helpers.service'

export class MultiModalCoreService implements MultiModalProcessor {
  private openai: OpenAI | null = null
  private intentService: AdvancedIntentRecognitionService
  private helpers: MultiModalHelpers
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
    this.helpers = new MultiModalHelpers()
    this.metrics = this.helpers.initializeMetrics()
  }

  /**
   * Process multi-modal content and extract comprehensive analysis
   */
  async processContent(content: MultiModalContent): Promise<MultiModalAnalysis> {
    const startTime = Date.now()
    
    try {
      // Check cache first
      const cacheKey = this.helpers.generateCacheKey(content)
      const cached = this.getCachedResult(cacheKey)
      if (cached) {
        console.log(`📋 Cache hit para conteúdo ${content.type}: ${content.id}`)
        return cached
      }

      let analysis: MultiModalAnalysis

      console.log(`🔄 Processando conteúdo ${content.type}: ${content.id}`)

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
          throw new Error(`Tipo de conteúdo não suportado: ${content.type}`)
      }

      // Add processing time
      analysis.processingTime = Date.now() - startTime

      // Cache result
      this.setCachedResult(cacheKey, analysis)

      // Update metrics
      this.helpers.updateMetrics(this.metrics, content.type, analysis.processingTime, true)

      console.log(`✅ Processamento concluído em ${analysis.processingTime}ms`)
      return analysis

    } catch (error) {
      this.helpers.updateMetrics(this.metrics, content.type, Date.now() - startTime, false)
      console.error(`❌ Erro no processamento: ${error}`)
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
      this.helpers.extractEntitiesFromText(text),
      this.helpers.analyzeTextForBusiness(text),
      this.helpers.analyzeTextEmotion(text)
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
  private async processAudio(content: MultiModalContent): Promise<MultiModalAnalysis> {
    const buffer = content.content instanceof Buffer ? content.content : Buffer.from(content.content)
    
    // Transcribe audio
    const transcription = await this.helpers.transcribeAudio(buffer, content.mimeType)
    
    if (!transcription || transcription.includes('[Áudio recebido')) {
      return {
        contentId: content.id,
        contentType: 'audio',
        primaryAnalysis: transcription || 'Áudio não pôde ser processado',
        transcription,
        businessContext: {
          relevantServices: [],
          suggestedActions: ['human_review'],
          urgencyLevel: 'medium',
          requiresHumanReview: true,
          contextualInsights: ['Áudio requer análise manual']
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

    // Analyze transcribed text
    const [
      entities,
      businessContext,
      emotionalAnalysis
    ] = await Promise.all([
      this.helpers.extractEntitiesFromText(transcription),
      this.helpers.analyzeTextForBusiness(transcription),
      this.helpers.analyzeTextEmotion(transcription)
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
  private async processImage(content: MultiModalContent): Promise<MultiModalAnalysis> {
    const buffer = content.content instanceof Buffer ? content.content : Buffer.from(content.content)
    
    const [
      visualDescription,
      ocrText
    ] = await Promise.all([
      this.helpers.analyzeImageVisually(buffer, content.mimeType),
      this.helpers.extractTextFromImage(buffer, content.mimeType)
    ])

    const combinedText = `${visualDescription}\n${ocrText}`.trim()
    
    const [
      entities,
      businessContext,
      emotionalAnalysis
    ] = await Promise.all([
      this.helpers.extractEntitiesFromText(combinedText),
      this.helpers.analyzeTextForBusiness(combinedText),
      this.helpers.analyzeTextEmotion(combinedText)
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
  private async processVideo(content: MultiModalContent): Promise<MultiModalAnalysis> {
    const basicAnalysis = `Vídeo recebido (${content.mimeType}). Processamento completo de vídeo requer recursos adicionais.`
    
    return {
      contentId: content.id,
      contentType: 'video',
      primaryAnalysis: basicAnalysis,
      businessContext: {
        relevantServices: [],
        suggestedActions: ['human_review'],
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
  private async processDocument(content: MultiModalContent): Promise<MultiModalAnalysis> {
    const buffer = content.content instanceof Buffer ? content.content : Buffer.from(content.content)
    
    const extractedText = await this.helpers.extractTextFromDocument(buffer, content.mimeType)
    
    const [
      entities,
      businessContext,
      emotionalAnalysis
    ] = await Promise.all([
      this.helpers.extractEntitiesFromText(extractedText),
      this.helpers.analyzeDocumentForBusiness(extractedText, content.mimeType),
      this.helpers.analyzeTextEmotion(extractedText)
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
    
    console.log(`🔄 Aprimorando intent com ${multiModalContent.length} conteúdos multi-modal`)

    // Process all multi-modal content
    const analyses = await Promise.all(
      multiModalContent.map(content => this.processContent(content))
    )

    // Combine entities from all sources
    const enhancedEntities = this.helpers.combineEntities([
      ...textIntent.entities,
      ...analyses.flatMap(a => a.entities)
    ])

    // Analyze business context from all content
    const combinedBusinessContext = this.helpers.combineBusinessContext(
      analyses.map(a => a.businessContext).filter(Boolean) as BusinessContextAnalysis[]
    )

    // Determine if human review is needed
    const requiresHumanReview = analyses.some(a => 
      a.businessContext?.requiresHumanReview || 
      a.confidence < 0.7 ||
      a.warnings && a.warnings.length > 0
    )

    // Calculate enhanced confidence
    const multiModalConfidence = analyses.length > 0 ? 
      analyses.reduce((sum, a) => sum + a.confidence, 0) / analyses.length : 0
    const enhancedConfidence = multiModalConfidence > 0 ? 
      (textIntent.confidence + multiModalConfidence) / 2 : textIntent.confidence

    // Determine recommended action
    const recommendedAction = this.helpers.determineRecommendedAction(
      textIntent,
      combinedBusinessContext,
      enhancedEntities
    )

    console.log(`✅ Intent aprimorado: confiança ${enhancedConfidence.toFixed(2)}, ação: ${recommendedAction}`)

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
   * Extract entities from analysis
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
    return this.helpers.analyzeTextForBusiness(analysis.primaryAnalysis, domain)
  }

  /**
   * Analyze emotion from content
   */
  async analyzeEmotion(content: MultiModalContent): Promise<EmotionalAnalysis> {
    const analysis = await this.processContent(content)
    return analysis.emotionalAnalysis || {
      tone: 'neutral',
      confidence: 0.5,
      emotionalKeywords: [],
      sentimentScore: 0
    }
  }

  /**
   * Detect language in text
   */
  async detectLanguage(text: string): Promise<string> {
    return this.helpers.detectLanguageFallback(text)
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
        faceDetection: false
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
    this.metrics = this.helpers.initializeMetrics()
  }

  // Private helper methods for cache management
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
} 