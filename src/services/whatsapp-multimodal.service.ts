import { MultiModalHelpers } from './multimodal-helpers.service'
import { MultiModalContent, MultiModalAnalysis, MultiModalIntentResult } from '../types/multimodal.types'
import { ConversationContext, Intent } from '../types/ai.types'
import { AdvancedIntentRecognitionService } from './advanced-intent-recognition.service'
import mime from 'mime-types'

/**
 * Extensão do WhatsApp Service para suporte multi-modal
 */
export class WhatsAppMultiModalService {
  private helpers: MultiModalHelpers
  private intentService: AdvancedIntentRecognitionService

  constructor() {
    this.helpers = new MultiModalHelpers()
    this.intentService = new AdvancedIntentRecognitionService()
  }

  /**
   * Processar mensagem multi-modal do WhatsApp
   */
  async processMultiModalMessage(
    textMessage: string,
    mediaFiles: Array<{
      buffer: Buffer
      filename?: string
      mimetype: string
    }>,
    context: ConversationContext
  ): Promise<MultiModalIntentResult> {
    
    console.log(`🔄 Processando mensagem multi-modal: texto + ${mediaFiles.length} arquivos`)

    // 1. Processar intent do texto primeiro
    const textIntent = await this.intentService.recognizeIntent(textMessage, context)
    console.log(`📝 Intent do texto: ${textIntent.type} (${(textIntent.confidence * 100).toFixed(1)}%)`)

    // 2. Processar arquivos de mídia
    const multiModalContent: MultiModalContent[] = []
    
    for (let i = 0; i < mediaFiles.length; i++) {
      const file = mediaFiles[i]!
      
      const content: MultiModalContent = {
        id: `media_${Date.now()}_${i}`,
        type: this.determineContentType(file.mimetype),
        content: file.buffer,
        mimeType: file.mimetype,
        filename: file.filename,
        metadata: {
          size: file.buffer.length
        },
        timestamp: new Date()
      }
      
      multiModalContent.push(content)
      console.log(`📎 Adicionado: ${content.type} (${this.formatFileSize(content.metadata?.size || 0)})`)
    }

    // 3. Processar cada conteúdo multi-modal
    const analyses: MultiModalAnalysis[] = []
    
    for (const content of multiModalContent) {
      try {
        let analysis: MultiModalAnalysis
        
        switch (content.type) {
          case 'audio':
            analysis = await this.processAudio(content)
            break
          case 'image':
            analysis = await this.processImage(content)
            break
          case 'document':
            analysis = await this.processDocument(content)
            break
          case 'video':
            analysis = await this.processVideo(content)
            break
          default:
            analysis = await this.processGeneric(content)
        }
        
        analyses.push(analysis)
        console.log(`✅ ${content.type} processado: confiança ${(analysis.confidence * 100).toFixed(1)}%`)
        
      } catch (error) {
        console.error(`❌ Erro processando ${content.type}:`, error)
        
        // Criar análise de fallback
        const fallbackAnalysis: MultiModalAnalysis = {
          contentId: content.id,
          contentType: content.type,
          primaryAnalysis: `Erro ao processar ${content.type}: ${error}`,
          entities: [],
          confidence: 0.3,
          processingTime: 0,
          warnings: [`Falha no processamento: ${error}`]
        }
        
        analyses.push(fallbackAnalysis)
      }
    }

    // 4. Combinar análises e gerar resultado final
    const result = await this.combineAnalyses(textIntent, analyses, context)
    
    console.log(`🎯 Resultado final: ${result.recommendedAction} (confiança: ${(result.confidence * 100).toFixed(1)}%)`)
    console.log(`👥 Requer humano: ${result.requiresHumanReview ? 'Sim' : 'Não'}`)
    
    return result
  }

  /**
   * Processar mensagem apenas com texto
   */
  async processTextOnlyMessage(
    textMessage: string,
    context: ConversationContext
  ): Promise<Intent> {
    return await this.intentService.recognizeIntent(textMessage, context)
  }

  /**
   * Validar arquivo de mídia
   */
  validateMediaFile(buffer: Buffer, mimetype: string): { isValid: boolean; error?: string } {
    const capabilities = this.getCapabilities()
    const contentType = this.determineContentType(mimetype)
    
    // Verificar se o tipo é suportado
    const supportedFormats = capabilities.supportedFormats[contentType as keyof typeof capabilities.supportedFormats]
    
    if (!supportedFormats || !supportedFormats.includes(mimetype)) {
      return {
        isValid: false,
        error: `Tipo de arquivo não suportado: ${mimetype}`
      }
    }
    
    // Verificar tamanho do arquivo
    const maxSize = capabilities.maxFileSize[contentType as keyof typeof capabilities.maxFileSize]
    
    if (buffer.length > maxSize) {
      return {
        isValid: false,
        error: `Arquivo muito grande: ${this.formatFileSize(buffer.length)} (máximo: ${this.formatFileSize(maxSize)})`
      }
    }
    
    return { isValid: true }
  }

  /**
   * Obter capacidades do sistema
   */
  getCapabilities() {
    return {
      supportedFormats: {
        audio: ['audio/wav', 'audio/mp3', 'audio/m4a', 'audio/ogg', 'audio/mpeg'],
        image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/jpg'],
        video: ['video/mp4', 'video/mov', 'video/avi', 'video/quicktime'],
        document: ['application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
      },
      maxFileSize: {
        audio: 25 * 1024 * 1024, // 25MB
        image: 20 * 1024 * 1024,  // 20MB
        video: 100 * 1024 * 1024, // 100MB
        document: 50 * 1024 * 1024 // 50MB
      }
    }
  }

  /**
   * Gerar resposta contextual baseada na análise
   */
  generateContextualResponse(result: MultiModalIntentResult): string {
    const { originalIntent, multiModalEnhancement, recommendedAction, requiresHumanReview } = result
    
    // Mensagens base por tipo de intent
    const baseResponses = {
      booking_request: 'Entendi que você gostaria de agendar um serviço.',
      booking_cancel: 'Vou ajudar você a cancelar seu agendamento.',
      service_inquiry: 'Vou fornecer informações sobre nossos serviços.',
      emergency: 'Entendo que é uma situação urgente.',
      greeting: 'Olá! Como posso ajudar você hoje?',
      complaint: 'Lamento pelo inconveniente. Vamos resolver isso.',
      compliment: 'Muito obrigado pelo feedback positivo!',
      price_inquiry: 'Vou informar os preços dos nossos serviços.',
      availability_check: 'Vou verificar nossa disponibilidade.',
      support_request: 'Estou aqui para ajudar você.',
      goodbye: 'Obrigado pelo contato! Até logo!',
      unknown: 'Vou analisar sua solicitação.'
    }

    let response = baseResponses[originalIntent.type as keyof typeof baseResponses] || baseResponses.unknown

    // Adicionar informações sobre mídia processada
    if (multiModalEnhancement.contentType !== 'text') {
      const mediaTypes = {
        audio: 'áudio',
        image: 'imagem',
        video: 'vídeo',
        document: 'documento'
      }
      
      const mediaType = mediaTypes[multiModalEnhancement.contentType as keyof typeof mediaTypes]
      response += ` Analisei também o ${mediaType} que você enviou.`
    }

    // Adicionar informações sobre emoção detectada
    if (multiModalEnhancement.emotionalAnalysis) {
      const emotion = multiModalEnhancement.emotionalAnalysis
      if (emotion.tone === 'frustrated' || emotion.tone === 'negative') {
        response += ' Percebo que você pode estar preocupado, vou dar atenção especial ao seu caso.'
      } else if (emotion.tone === 'positive' || emotion.tone === 'excited') {
        response += ' Fico feliz em perceber seu entusiasmo!'
      }
    }

    // Adicionar ação recomendada
    switch (recommendedAction) {
      case 'escalate_to_human':
        response += ' Vou conectar você com um de nossos especialistas para melhor atendimento.'
        break
      case 'create_appointment':
        response += ' Vou ajudar você a agendar um horário.'
        break
      case 'emergency_response':
        response += ' Trataremos isso como prioridade máxima.'
        break
      case 'human_review':
        response += ' Nossa equipe revisará sua solicitação pessoalmente.'
        break
    }

    return response
  }

  // Métodos privados de processamento

  private async processAudio(content: MultiModalContent): Promise<MultiModalAnalysis> {
    console.log('🎵 Processando áudio...')
    
    const transcription = await this.helpers.transcribeAudio(
      content.content as Buffer, 
      content.mimeType
    )
    
    if (transcription.includes('[Áudio recebido')) {
      return {
        contentId: content.id,
        contentType: 'audio',
        primaryAnalysis: transcription,
        transcription,
        entities: [],
        confidence: 0.6,
        processingTime: 0,
        businessContext: {
          relevantServices: [],
          suggestedActions: ['human_review'],
          urgencyLevel: 'medium',
          requiresHumanReview: true,
          contextualInsights: ['Áudio requer análise manual']
        }
      }
    }

    // Análise completa do áudio transcrito
    const [entities, businessContext, emotionalAnalysis] = await Promise.all([
      this.helpers.extractEntitiesFromText(transcription),
      this.helpers.analyzeTextForBusiness(transcription),
      this.helpers.analyzeTextEmotion(transcription)
    ])

    return {
      contentId: content.id,
      contentType: 'audio',
      primaryAnalysis: transcription,
      transcription,
      entities,
      businessContext,
      emotionalAnalysis,
      confidence: 0.85,
      processingTime: 0
    }
  }

  private async processImage(content: MultiModalContent): Promise<MultiModalAnalysis> {
    console.log('🖼️ Processando imagem...')
    
    const [visualDescription, ocrText] = await Promise.all([
      this.helpers.analyzeImageVisually(content.content as Buffer, content.mimeType),
      this.helpers.extractTextFromImage(content.content as Buffer, content.mimeType)
    ])

    const combinedText = `${visualDescription} ${ocrText}`.trim()
    
    const [entities, businessContext, emotionalAnalysis] = await Promise.all([
      this.helpers.extractEntitiesFromText(combinedText),
      this.helpers.analyzeTextForBusiness(combinedText),
      this.helpers.analyzeTextEmotion(combinedText)
    ])

    return {
      contentId: content.id,
      contentType: 'image',
      primaryAnalysis: visualDescription,
      visualDescription,
      ocrText,
      entities,
      businessContext,
      emotionalAnalysis,
      confidence: 0.80,
      processingTime: 0
    }
  }

  private async processDocument(content: MultiModalContent): Promise<MultiModalAnalysis> {
    console.log('📄 Processando documento...')
    
    const extractedText = await this.helpers.extractTextFromDocument(
      content.content as Buffer, 
      content.mimeType
    )

    const [entities, businessContext, emotionalAnalysis] = await Promise.all([
      this.helpers.extractEntitiesFromText(extractedText),
      this.helpers.analyzeDocumentForBusiness(extractedText, content.mimeType),
      this.helpers.analyzeTextEmotion(extractedText)
    ])

    return {
      contentId: content.id,
      contentType: 'document',
      primaryAnalysis: extractedText,
      ocrText: extractedText,
      entities,
      businessContext,
      emotionalAnalysis,
      confidence: 0.90,
      processingTime: 0
    }
  }

  private async processVideo(content: MultiModalContent): Promise<MultiModalAnalysis> {
    console.log('🎥 Processando vídeo...')
    
    // Análise básica de vídeo (expandir conforme necessário)
    const basicAnalysis = `Vídeo recebido (${content.mimeType}, ${this.formatFileSize(content.metadata!.size)})`

    return {
      contentId: content.id,
      contentType: 'video',
      primaryAnalysis: basicAnalysis,
      entities: [],
      confidence: 0.70,
      processingTime: 0,
      businessContext: {
        relevantServices: [],
        suggestedActions: ['human_review'],
        urgencyLevel: 'medium',
        requiresHumanReview: true,
        contextualInsights: ['Vídeo requer análise manual']
      }
    }
  }

  private async processGeneric(content: MultiModalContent): Promise<MultiModalAnalysis> {
    console.log('📎 Processando arquivo genérico...')
    
    return {
      contentId: content.id,
      contentType: content.type,
      primaryAnalysis: `Arquivo ${content.type} recebido`,
      entities: [],
      confidence: 0.50,
      processingTime: 0,
      businessContext: {
        relevantServices: [],
        suggestedActions: ['human_review'],
        urgencyLevel: 'low',
        requiresHumanReview: true,
        contextualInsights: ['Arquivo requer análise manual']
      }
    }
  }

  private async combineAnalyses(
    textIntent: Intent,
    analyses: MultiModalAnalysis[],
    context: ConversationContext
  ): Promise<MultiModalIntentResult> {
    
    // Combinar entidades de todas as fontes
    const allEntities = [
      ...textIntent.entities,
      ...analyses.flatMap(a => a.entities)
    ]
    const enhancedEntities = this.helpers.combineEntities(allEntities as any[])

    // Combinar contextos de negócio
    const businessContexts = analyses
      .map(a => a.businessContext)
      .filter(Boolean) as any[]
    const combinedBusinessContext = this.helpers.combineBusinessContext(businessContexts)

    // Calcular confiança combinada
    const analysisConfidences = analyses.map(a => a.confidence)
    const avgAnalysisConfidence = analysisConfidences.length > 0 ? 
      analysisConfidences.reduce((sum, conf) => sum + conf, 0) / analysisConfidences.length : 0
    
    const enhancedConfidence = (textIntent.confidence + avgAnalysisConfidence) / 2

    // Determinar se requer revisão humana
    const requiresHumanReview = 
      combinedBusinessContext.requiresHumanReview ||
      analyses.some(a => a.confidence < 0.7) ||
      analyses.some(a => a.warnings && a.warnings.length > 0) ||
      enhancedConfidence < 0.7

    // Determinar ação recomendada
    const recommendedAction = this.helpers.determineRecommendedAction(
      textIntent,
      combinedBusinessContext,
      enhancedEntities
    )

    return {
      originalIntent: textIntent,
      multiModalEnhancement: analyses[0] || {
        contentId: 'combined',
        contentType: 'text',
        primaryAnalysis: 'Análise multi-modal combinada',
        entities: enhancedEntities,
        confidence: avgAnalysisConfidence,
        processingTime: 0
      },
      enhancedEntities,
      confidence: enhancedConfidence,
      recommendedAction,
      requiresHumanReview
    }
  }

  private determineContentType(mimetype: string): 'text' | 'audio' | 'image' | 'video' | 'document' {
    if (mimetype.startsWith('audio/')) return 'audio'
    if (mimetype.startsWith('image/')) return 'image'
    if (mimetype.startsWith('video/')) return 'video'
    if (mimetype.startsWith('text/') || 
        mimetype.includes('pdf') || 
        mimetype.includes('document') ||
        mimetype.includes('word')) return 'document'
    
    return 'document' // fallback
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes'
    
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }
}

export default WhatsAppMultiModalService 