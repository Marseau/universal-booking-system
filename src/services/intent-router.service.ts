import { Intent, IntentType, Entity, ConversationContext } from '../types/ai.types'
import { BusinessDomain } from '../types/database.types'

export class IntentRouterService {
  private intentPatterns: Map<IntentType, IntentPattern[]> = new Map()
  private entityExtractors: Map<string, EntityExtractor> = new Map()
  private domainKeywords: Map<BusinessDomain, string[]> = new Map()

  constructor() {
    this.initializeIntentPatterns()
    this.initializeEntityExtractors()
    this.initializeDomainKeywords()
  }

  /**
   * Analyze message and determine intent with confidence
   */
  async analyzeIntent(
    message: string,
    context: ConversationContext,
    conversationHistory: string[] = []
  ): Promise<Intent> {
    const normalizedMessage = this.normalizeMessage(message)
    
    // Extract entities first
    const entities = await this.extractEntities(normalizedMessage)
    
    // Determine intent based on patterns and context
    const intentResults = await this.matchIntentPatterns(normalizedMessage, entities, context)
    
    // Apply contextual boosting
    const contextBoostedResults = this.applyContextualBoosting(
      intentResults, 
      context, 
      conversationHistory
    )
    
    // Select best intent
    const bestIntent = this.selectBestIntent(contextBoostedResults)
    
    return {
      type: bestIntent.type,
      confidence: bestIntent.confidence,
      entities,
      context: {
        businessDomain: context.tenantConfig?.domain,
        conversationTurn: conversationHistory.length,
        previousIntent: context.currentIntent?.type,
        urgencyLevel: this.determineUrgency(normalizedMessage, entities),
        sentiment: this.analyzeSentiment(normalizedMessage)
      }
    }
  }

  /**
   * Route intent to appropriate business domain
   */
  routeToDomain(intent: Intent, context: ConversationContext): BusinessDomain | 'other' {
    // Use configured business domain if available
    if (context.tenantConfig?.domain) {
      return context.tenantConfig.domain
    }

    // Infer domain from intent and entities
    return this.inferDomainFromIntent(intent)
  }

  /**
   * Initialize intent recognition patterns
   */
  private initializeIntentPatterns(): void {
    const patterns: Record<IntentType, IntentPattern[]> = {
      'booking_request': [
        { 
          keywords: ['agendar', 'marcar', 'reservar', 'consulta', 'horário', 'vaga'],
          phrases: ['gostaria de agendar', 'quero marcar', 'preciso de um horário'],
          weight: 1.0
        },
        {
          keywords: ['quando', 'disponível', 'livre', 'posso'],
          phrases: ['quando posso', 'tem vaga', 'está disponível'],
          weight: 0.8
        }
      ],
      'booking_cancel': [
        {
          keywords: ['cancelar', 'desmarcar', 'não posso', 'impedir'],
          phrases: ['quero cancelar', 'preciso cancelar', 'não vou poder'],
          weight: 1.0
        }
      ],
      'booking_reschedule': [
        {
          keywords: ['remarcar', 'mudar', 'trocar', 'alterar', 'reagendar'],
          phrases: ['quero remarcar', 'posso mudar', 'trocar horário'],
          weight: 1.0
        }
      ],
      'booking_inquiry': [
        {
          keywords: ['agendamento', 'marcado', 'reservado', 'confirmado'],
          phrases: ['meu agendamento', 'está marcado', 'foi confirmado'],
          weight: 1.0
        }
      ],
      'service_inquiry': [
        {
          keywords: ['serviço', 'oferecer', 'fazer', 'tipos', 'trabalho'],
          phrases: ['que serviços', 'fazem o que', 'tipos de'],
          weight: 1.0
        }
      ],
      'availability_check': [
        {
          keywords: ['disponível', 'livre', 'vago', 'horário', 'quando'],
          phrases: ['tem horário', 'está livre', 'quando disponível'],
          weight: 1.0
        }
      ],
      'price_inquiry': [
        {
          keywords: ['preço', 'valor', 'custo', 'quanto', 'custa', 'orçamento'],
          phrases: ['quanto custa', 'qual o preço', 'valor do'],
          weight: 1.0
        }
      ],
      'business_hours': [
        {
          keywords: ['horário', 'funcionamento', 'aberto', 'fechado', 'quando'],
          phrases: ['horário de funcionamento', 'que horas', 'está aberto'],
          weight: 1.0
        }
      ],
      'location_inquiry': [
        {
          keywords: ['onde', 'endereço', 'localização', 'fica', 'local'],
          phrases: ['onde fica', 'qual endereço', 'como chegar'],
          weight: 1.0
        }
      ],
      'general_greeting': [
        {
          keywords: ['oi', 'olá', 'bom dia', 'boa tarde', 'boa noite', 'hey'],
          phrases: ['oi tudo bem', 'olá como vai', 'bom dia'],
          weight: 1.0
        }
      ],
      'complaint': [
        {
          keywords: ['reclamação', 'problema', 'ruim', 'péssimo', 'insatisfeito', 'reclamar'],
          phrases: ['estou insatisfeito', 'foi péssimo', 'quero reclamar'],
          weight: 1.0
        }
      ],
      'compliment': [
        {
          keywords: ['ótimo', 'excelente', 'parabéns', 'obrigado', 'adorei', 'perfeito'],
          phrases: ['foi ótimo', 'adorei o serviço', 'muito obrigado'],
          weight: 1.0
        }
      ],
      'escalation_request': [
        {
          keywords: ['gerente', 'responsável', 'supervisor', 'falar com', 'atendente'],
          phrases: ['quero falar com', 'cadê o gerente', 'preciso de ajuda'],
          weight: 1.0
        }
      ],
      'emergency': [
        {
          keywords: ['urgente', 'emergência', 'socorro', 'ajuda', 'grave', 'crítico'],
          phrases: ['é urgente', 'preciso de ajuda', 'emergência'],
          weight: 1.0
        }
      ],
      'other': [
        {
          keywords: [],
          phrases: [],
          weight: 0.1
        }
      ]
    }

    Object.entries(patterns).forEach(([intent, patternList]) => {
      this.intentPatterns.set(intent as IntentType, patternList)
    })
  }

  /**
   * Initialize entity extractors
   */
  private initializeEntityExtractors(): void {
    this.entityExtractors.set('service_name', {
      patterns: [
        /(?:serviço|tratamento|consulta|aula|treino|sessão)\s+de\s+(\w+)/gi,
        /(?:fazer|quero|preciso)\s+(?:um|uma)?\s*(\w+)/gi
      ],
      processor: (matches: string[]) => matches.filter(m => m.length > 2)
    })

    this.entityExtractors.set('date', {
      patterns: [
        /(\d{1,2}\/\d{1,2}\/\d{4})/g,
        /(\d{1,2}\/\d{1,2})/g,
        /(hoje|amanhã|segunda|terça|quarta|quinta|sexta|sábado|domingo)/gi,
        /(próxima?\s+(?:segunda|terça|quarta|quinta|sexta|sábado|domingo))/gi
      ],
      processor: (matches: string[]) => matches.map(m => this.normalizeDate(m))
    })

    this.entityExtractors.set('time', {
      patterns: [
        /(\d{1,2}:\d{2})/g,
        /(\d{1,2}h\d{2})/g,
        /(\d{1,2}h)/g,
        /(manhã|tarde|noite|madrugada)/gi
      ],
      processor: (matches: string[]) => matches.map(m => this.normalizeTime(m))
    })

    this.entityExtractors.set('person_name', {
      patterns: [
        /(?:meu nome é|me chamo|sou o|sou a)\s+([A-ZÁÊÇÕ][a-záêçõ]+(?:\s+[A-ZÁÊÇÕ][a-záêçõ]+)*)/gi
      ],
      processor: (matches: string[]) => matches.filter(m => m.length > 1)
    })

    this.entityExtractors.set('phone_number', {
      patterns: [
        /(\(\d{2}\)\s?\d{4,5}-?\d{4})/g,
        /(\d{2}\s?\d{4,5}-?\d{4})/g,
        /(\d{10,11})/g
      ],
      processor: (matches: string[]) => matches.map(m => this.normalizePhone(m))
    })

    this.entityExtractors.set('urgency_level', {
      patterns: [
        /(urgente|emergência|prioridade|rápido|logo)/gi
      ],
      processor: (matches: string[]) => matches.map(m => this.mapUrgencyLevel(m))
    })
  }

  /**
   * Initialize domain-specific keywords
   */
  private initializeDomainKeywords(): void {
    this.domainKeywords.set('healthcare', [
      'psicólogo', 'terapia', 'consulta', 'sessão', 'depressão', 'ansiedade',
      'psiquiatra', 'medicamento', 'tratamento', 'saúde mental'
    ])

    this.domainKeywords.set('beauty', [
      'cabelo', 'corte', 'coloração', 'manicure', 'pedicure', 'unha',
      'maquiagem', 'sobrancelha', 'salão', 'beleza', 'estética'
    ])

    this.domainKeywords.set('legal', [
      'advogado', 'processo', 'jurídico', 'contrato', 'consulta legal',
      'direito', 'lei', 'tribunal', 'ação', 'defesa'
    ])

    this.domainKeywords.set('education', [
      'aula', 'professor', 'ensino', 'aprender', 'estudar', 'reforço',
      'tutoring', 'matéria', 'disciplina', 'curso', 'educação'
    ])

    this.domainKeywords.set('sports', [
      'treino', 'academia', 'exercício', 'personal', 'fitness', 'musculação',
      'cardio', 'pilates', 'yoga', 'esporte', 'condicionamento'
    ])

    this.domainKeywords.set('consulting', [
      'consultoria', 'negócio', 'empresa', 'estratégia', 'planejamento',
      'gestão', 'financeiro', 'marketing', 'vendas', 'operações'
    ])
  }

  /**
   * Normalize message for better pattern matching
   */
  private normalizeMessage(message: string): string {
    return message
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
  }

  /**
   * Extract entities from message
   */
  private async extractEntities(message: string): Promise<Entity[]> {
    const entities: Entity[] = []

    for (const [entityType, extractor] of this.entityExtractors.entries()) {
      const matches: string[] = []
      
      for (const pattern of extractor.patterns) {
        const patternMatches = message.match(pattern)
        if (patternMatches) {
          matches.push(...patternMatches)
        }
      }

      if (matches.length > 0) {
        const processedMatches = extractor.processor(matches)
        processedMatches.forEach((value, index) => {
          entities.push({
            type: entityType as any,
            value,
            confidence: 0.8 - (index * 0.1), // Decrease confidence for multiple matches
            start: message.indexOf(matches[index]),
            end: message.indexOf(matches[index]) + matches[index].length
          })
        })
      }
    }

    return entities
  }

  /**
   * Match intent patterns against message
   */
  private async matchIntentPatterns(
    message: string,
    entities: Entity[],
    context: ConversationContext
  ): Promise<IntentMatch[]> {
    const matches: IntentMatch[] = []

    for (const [intentType, patterns] of this.intentPatterns.entries()) {
      let maxScore = 0

      for (const pattern of patterns) {
        let score = 0

        // Keyword matching
        const keywordMatches = pattern.keywords.filter(keyword => 
          message.includes(keyword)
        ).length
        score += (keywordMatches / pattern.keywords.length) * 0.6

        // Phrase matching
        const phraseMatches = pattern.phrases.filter(phrase => 
          message.includes(phrase)
        ).length
        score += (phraseMatches / Math.max(pattern.phrases.length, 1)) * 0.4

        // Apply pattern weight
        score *= pattern.weight

        maxScore = Math.max(maxScore, score)
      }

      if (maxScore > 0.1) { // Minimum threshold
        matches.push({
          type: intentType,
          confidence: maxScore,
          score: maxScore
        })
      }
    }

    return matches
  }

  /**
   * Apply contextual boosting to intent matches
   */
  private applyContextualBoosting(
    matches: IntentMatch[],
    context: ConversationContext,
    conversationHistory: string[]
  ): IntentMatch[] {
    return matches.map(match => {
      let boost = 0

      // Previous intent context
      if (context.currentIntent) {
        const intentFlow = this.getIntentFlow(context.currentIntent.type, match.type)
        boost += intentFlow
      }

      // Conversation length boost
      if (conversationHistory.length === 0 && match.type === 'general_greeting') {
        boost += 0.3
      }

      // Business domain alignment
      if (context.tenantConfig?.domain) {
        const domainBoost = this.getDomainBoost(match.type, context.tenantConfig.domain)
        boost += domainBoost
      }

      return {
        ...match,
        confidence: Math.min(1.0, match.confidence + boost)
      }
    })
  }

  /**
   * Select best intent from matches
   */
  private selectBestIntent(matches: IntentMatch[]): IntentMatch {
    if (matches.length === 0) {
      return { type: 'other', confidence: 0.5, score: 0.5 }
    }

    // Sort by confidence and return best match
    matches.sort((a, b) => b.confidence - a.confidence)
    return matches[0]
  }

  /**
   * Infer business domain from intent and entities
   */
  private inferDomainFromIntent(intent: Intent): BusinessDomain | 'other' {
    // Check entities for domain-specific terms
    for (const [domain, keywords] of this.domainKeywords.entries()) {
      const hasKeyword = intent.entities.some(entity => 
        keywords.some(keyword => 
          entity.value.toLowerCase().includes(keyword.toLowerCase())
        )
      )
      
      if (hasKeyword) {
        return domain
      }
    }

    return 'other'
  }

  /**
   * Determine urgency level from message
   */
  private determineUrgency(message: string, entities: Entity[]): string {
    const urgencyEntity = entities.find(e => e.type === 'urgency_level')
    if (urgencyEntity) {
      return urgencyEntity.value
    }

    if (message.includes('urgente') || message.includes('emergência')) {
      return 'alta'
    }

    if (message.includes('rápido') || message.includes('logo')) {
      return 'media'
    }

    return 'baixa'
  }

  /**
   * Analyze sentiment of message
   */
  private analyzeSentiment(message: string): string {
    const positiveWords = ['bom', 'ótimo', 'excelente', 'obrigado', 'adorei', 'perfeito']
    const negativeWords = ['ruim', 'péssimo', 'problema', 'reclamação', 'insatisfeito']

    const positiveCount = positiveWords.filter(word => message.includes(word)).length
    const negativeCount = negativeWords.filter(word => message.includes(word)).length

    if (positiveCount > negativeCount) return 'positive'
    if (negativeCount > positiveCount) return 'negative'
    return 'neutral'
  }

  /**
   * Get intent flow score for conversation continuity
   */
  private getIntentFlow(previousIntent: IntentType, currentIntent: IntentType): number {
    const flows: Record<string, number> = {
      'general_greeting->service_inquiry': 0.2,
      'service_inquiry->price_inquiry': 0.3,
      'price_inquiry->booking_request': 0.4,
      'availability_check->booking_request': 0.5,
      'booking_request->booking_inquiry': 0.3
    }

    const flowKey = `${previousIntent}->${currentIntent}`
    return flows[flowKey] || 0
  }

  /**
   * Get domain-specific boost for intent
   */
  private getDomainBoost(intentType: IntentType, domain: BusinessDomain): number {
    const domainBoosts: Record<BusinessDomain, Record<IntentType, number>> = {
      'healthcare': {
        'booking_request': 0.2,
        'emergency': 0.3,
        'escalation_request': 0.1
      },
      'beauty': {
        'booking_request': 0.2,
        'service_inquiry': 0.1,
        'price_inquiry': 0.1
      },
      'legal': {
        'booking_request': 0.1,
        'emergency': 0.2,
        'escalation_request': 0.2
      },
      'education': {
        'booking_request': 0.2,
        'service_inquiry': 0.1
      },
      'sports': {
        'booking_request': 0.2,
        'service_inquiry': 0.1
      },
      'consulting': {
        'booking_request': 0.1,
        'service_inquiry': 0.2,
        'price_inquiry': 0.2
      }
    }

    return domainBoosts[domain]?.[intentType] || 0
  }

  // Utility methods for entity processing
  private normalizeDate(dateStr: string): string {
    // Convert various date formats to standard format
    return dateStr.toLowerCase()
  }

  private normalizeTime(timeStr: string): string {
    // Convert various time formats to HH:MM
    return timeStr.replace('h', ':').padEnd(5, '0')
  }

  private normalizePhone(phoneStr: string): string {
    // Normalize phone number format
    return phoneStr.replace(/\D/g, '')
  }

  private mapUrgencyLevel(urgencyStr: string): string {
    const mapping: Record<string, string> = {
      'urgente': 'alta',
      'emergência': 'alta',
      'prioridade': 'media',
      'rápido': 'media',
      'logo': 'media'
    }

    return mapping[urgencyStr.toLowerCase()] || 'baixa'
  }
}

// Supporting interfaces
interface IntentPattern {
  keywords: string[]
  phrases: string[]
  weight: number
}

interface EntityExtractor {
  patterns: RegExp[]
  processor: (matches: string[]) => string[]
}

interface IntentMatch {
  type: IntentType
  confidence: number
  score: number
}

export default IntentRouterService