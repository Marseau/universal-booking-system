import { Intent, IntentType, Entity, ConversationContext } from '../types/ai.types'
import { BusinessDomain } from '../types/database.types'
import { IntentRouterService } from './intent-router.service'
import OpenAI from 'openai'

export class AdvancedIntentRecognitionService {
  private intentRouter: IntentRouterService
  private openai?: OpenAI
  private cache: Map<string, CachedIntentResult> = new Map()
  private learningData: Map<string, LearningEntry[]> = new Map()
  private metrics: IntentMetrics = this.createEmptyMetrics()
  private engines: IntentEngine[] = []

  constructor() {
    this.intentRouter = new IntentRouterService()
    this.initializeOpenAI()
    this.initializeEngines()
    this.initializeMetrics()
  }

  private createEmptyMetrics(): IntentMetrics {
    return {
      totalRecognitions: 0,
      successfulRecognitions: 0,
      cacheHits: 0,
      averageProcessingTime: 0,
      intentAccuracy: new Map(),
      enginePerformance: new Map(),
      lastReset: Date.now()
    }
  }

  /**
   * Advanced intent recognition with multiple engines and learning
   */
  async recognizeIntent(
    message: string,
    context: ConversationContext,
    options: RecognitionOptions = {}
  ): Promise<EnhancedIntent> {
    const startTime = Date.now()
    const messageId = this.generateMessageId(message, context)

    try {
      // Check cache first
      if (!options.forceRefresh) {
        const cached = this.getCachedResult(messageId)
        if (cached) {
          this.updateMetrics('cache_hit', Date.now() - startTime)
          return cached.result
        }
      }

      // Run multiple engines in parallel
      const engineResults = await this.runMultipleEngines(message, context, options)
      
      // Apply ensemble learning
      const ensembleResult = await this.applyEnsembleMethod(engineResults, context)
      
      // Apply domain-specific post-processing
      const finalResult = await this.postProcessResult(ensembleResult, context)
      
      // Store learning data
      await this.storeLearningData(message, context, finalResult)
      
      // Cache result
      this.cacheResult(messageId, finalResult, options.cacheTtl || 300000) // 5 min default
      
      // Update metrics
      this.updateMetrics('success', Date.now() - startTime)
      
      return finalResult

    } catch (error) {
      console.error('Advanced intent recognition error:', error)
      this.updateMetrics('error', Date.now() - startTime)
      
      // Fallback to basic router
      const fallbackIntent = await this.intentRouter.analyzeIntent(message, context)
      return this.enhanceBasicIntent(fallbackIntent, context)
    }
  }

  /**
   * Route intent with advanced business logic
   */
  async routeWithAdvancedLogic(
    intent: EnhancedIntent,
    context: ConversationContext
  ): Promise<RoutingDecision> {
    const startTime = Date.now()

    try {
      // Determine primary routing
      const primaryRoute = this.intentRouter.routeToDomain(intent, context)
      
      // Apply advanced routing rules
      const advancedRules = await this.applyAdvancedRoutingRules(intent, context)
      
      // Determine escalation needs
      const escalationDecision = await this.evaluateEscalationNeeds(intent, context)
      
      // Generate action recommendations
      const actionRecommendations = await this.generateActionRecommendations(intent, context)
      
      const decision: RoutingDecision = {
        primaryDomain: primaryRoute,
        alternativeDomains: advancedRules.alternatives,
        escalationRequired: escalationDecision.required,
        escalationType: escalationDecision.type as 'none' | 'human_agent' | 'supervisor' | 'immediate' | 'human_review' | 'medical_review',
        confidence: intent.confidence,
        priority: this.calculatePriority(intent, context),
        suggestedActions: actionRecommendations,
        metadata: {
          processingTime: Date.now() - startTime,
          rulesApplied: advancedRules.rulesApplied,
          confidenceFactors: this.getConfidenceFactors(intent)
        }
      }

      // Update routing metrics
      this.updateRoutingMetrics(decision)
      
      return decision

    } catch (error) {
      console.error('Advanced routing error:', error)
      
      // Fallback routing
      return {
        primaryDomain: context.tenantConfig?.domain || 'other',
        alternativeDomains: [],
        escalationRequired: false,
        escalationType: 'none' as const,
        confidence: 0.5,
        priority: 'medium',
        suggestedActions: [],
        metadata: {
          processingTime: Date.now() - startTime,
          rulesApplied: [],
          confidenceFactors: {}
        }
      }
    }
  }

  /**
   * Initialize multiple recognition engines
   */
  private initializeEngines(): void {
    // Engine 1: Pattern-based (existing IntentRouter)
    this.engines.push({
      name: 'pattern_based',
      weight: 0.3,
      execute: async (message: string, context: ConversationContext) => {
        const result = await this.intentRouter.analyzeIntent(message, context)
        return this.enhanceBasicIntent(result, context)
      }
    })

    // Engine 2: OpenAI-based
    this.engines.push({
      name: 'openai_gpt',
      weight: 0.4,
      execute: async (message: string, context: ConversationContext) => {
        return await this.recognizeWithOpenAI(message, context)
      }
    })

    // Engine 3: Statistical model
    this.engines.push({
      name: 'statistical',
      weight: 0.3,
      execute: async (message: string, context: ConversationContext) => {
        return await this.recognizeWithStatisticalModel(message, context)
      }
    })
  }

  /**
   * Run multiple engines in parallel
   */
  private async runMultipleEngines(
    message: string,
    context: ConversationContext,
    options: RecognitionOptions
  ): Promise<EngineResult[]> {
    const selectedEngines = options.engines || this.engines

    const promises = selectedEngines.map(async (engine) => {
      try {
        const startTime = Date.now()
        const result = await engine.execute(message, context)
        const processingTime = Date.now() - startTime

        return {
          engineName: engine.name,
          weight: engine.weight,
          result,
          processingTime,
          success: true
        }
      } catch (error) {
        console.error(`Engine ${engine.name} failed:`, error)
        return {
          engineName: engine.name,
          weight: engine.weight,
          result: this.getDefaultIntent(context),
          processingTime: 0,
          success: false
        }
      }
    })

    return await Promise.all(promises)
  }

  /**
   * Apply ensemble method to combine engine results
   */
  private async applyEnsembleMethod(
    engineResults: EngineResult[],
    context: ConversationContext
  ): Promise<EnhancedIntent> {
    // Weighted voting with confidence adjustment
    const intentVotes: Map<IntentType, VoteScore> = new Map()
    
    engineResults.forEach(result => {
      if (!result.success) return

      const intent = result.result
      const weight = result.weight * (intent.confidence || 0.5)
      
      const existing = intentVotes.get(intent.type) || { score: 0, confidence: 0, count: 0 }
      intentVotes.set(intent.type, {
        score: existing.score + weight,
        confidence: existing.confidence + (intent.confidence || 0.5),
        count: existing.count + 1
      })
    })

    // Find best intent
    let bestIntent: IntentType = 'other'
    let bestScore = 0
    let totalConfidence = 0
    let totalCount = 0

    for (const [intentType, vote] of intentVotes.entries()) {
      const avgConfidence = vote.confidence / vote.count
      const adjustedScore = vote.score * avgConfidence

      if (adjustedScore > bestScore) {
        bestScore = adjustedScore
        bestIntent = intentType
        totalConfidence = avgConfidence
        totalCount = vote.count
      }
    }

    // Combine entities from all successful engines
    const allEntities: Entity[] = []
    engineResults.forEach(result => {
      if (result.success && result.result.entities) {
        allEntities.push(...result.result.entities)
      }
    })

    // Deduplicate and score entities
    const uniqueEntities = this.deduplicateEntities(allEntities)

    return {
      type: bestIntent,
      confidence: totalConfidence,
      entities: uniqueEntities,
      context: {
        businessDomain: context.tenantConfig?.domain,
        conversationTurn: context.conversationHistory.length,
        engineConsensus: totalCount,
        alternativeIntents: this.getAlternativeIntents(intentVotes, bestIntent)
      },
      metadata: {
        engines: engineResults.map(r => ({
          name: r.engineName,
          success: r.success,
          processingTime: r.processingTime
        })),
        ensembleMethod: 'weighted_voting',
        totalProcessingTime: engineResults.reduce((sum, r) => sum + r.processingTime, 0)
      }
    }
  }

  /**
   * OpenAI-based intent recognition
   */
  private async recognizeWithOpenAI(
    message: string,
    context: ConversationContext
  ): Promise<EnhancedIntent> {
    if (!this.openai) {
      throw new Error('OpenAI not configured')
    }

    const prompt = this.buildAdvancedIntentPrompt(message, context)
    
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 500
    })

    const result = response.choices[0]?.message?.content
    if (!result) {
      throw new Error('No result from OpenAI')
    }

    // Parse the response
    const parsed = this.parseOpenAIResponse(result)
    
    return {
      type: parsed.intent as IntentType,
      confidence: parsed.confidence || 0.5,
      entities: parsed.entities || [],
      context: {
        businessDomain: context.tenantConfig?.domain,
        reasoning: parsed.reasoning
      },
      metadata: {
        engine: 'openai_gpt',
        model: 'gpt-4'
      }
    }
  }

  /**
   * Statistical model-based recognition
   */
  private async recognizeWithStatisticalModel(
    message: string,
    context: ConversationContext
  ): Promise<EnhancedIntent> {
    // Simple statistical approach based on learning data
    const intentScores: Map<IntentType, number> = new Map()

    // Calculate scores based on stored learning data
    for (const [learnedMessage, entries] of this.learningData.entries()) {
      const similarity = this.calculateTextSimilarity(message, learnedMessage)
      
      if (similarity > 0.3) {
        entries.forEach(entry => {
          const currentScore = intentScores.get(entry.intent) || 0
          intentScores.set(entry.intent, currentScore + (similarity * entry.confidence))
        })
      }
    }

    // Find best intent
    let bestIntent: IntentType = 'other'
    let bestScore = 0

    for (const [intent, score] of intentScores.entries()) {
      if (score > bestScore) {
        bestScore = score
        bestIntent = intent
      }
    }

    // Extract entities using simple patterns
    const entities = await this.extractEntitiesStatistical(message)

    return {
      type: bestIntent,
      confidence: Math.min(bestScore, 1.0),
      entities,
      context: {
        businessDomain: context.tenantConfig?.domain,
        method: 'statistical'
      },
      metadata: {
        engine: 'statistical',
        learningSamples: this.learningData.size
      }
    }
  }

  /**
   * Apply advanced routing rules
   */
  private async applyAdvancedRoutingRules(
    intent: EnhancedIntent,
    context: ConversationContext
  ): Promise<AdvancedRoutingRules> {
    const rules: string[] = []
    const alternatives: BusinessDomain[] = []

    // Time-based routing
    const hour = new Date().getHours()
    if (hour < 8 || hour > 18) {
      rules.push('after_hours')
      if (intent.type === 'emergency') {
        alternatives.push('healthcare')
      }
    }

    // Load-based routing
    const currentLoad = await this.getCurrentSystemLoad()
    if (currentLoad > 0.8) {
      rules.push('high_load')
      alternatives.push('other')
    }

    // Intent-specific routing
    if (intent.type === 'emergency') {
      rules.push('emergency_priority')
      alternatives.push('healthcare')
    }

    // Domain cross-pollination
    if (intent.entities.some(e => e.value && e.value.toLowerCase().includes('advogado'))) {
      alternatives.push('legal')
      rules.push('legal_entity_detected')
    }

    return {
      alternatives,
      rulesApplied: rules
    }
  }

  /**
   * Evaluate escalation needs
   */
  private async evaluateEscalationNeeds(
    intent: EnhancedIntent,
    context: ConversationContext
  ): Promise<EscalationDecision> {
    // Emergency intents
    if (intent.type === 'emergency') {
      return { required: true, type: 'immediate', reason: 'Emergency detected' }
    }

    // Low confidence with multiple attempts
    if (intent.confidence < 0.6 && context.conversationHistory.length > 6) {
      return { required: true, type: 'human_review', reason: 'Low confidence after multiple turns' }
    }

    // Explicit escalation request
    if (intent.type === 'escalation_request') {
      return { required: true, type: 'human_agent', reason: 'User requested human agent' }
    }

    // Domain-specific escalation
    const domainEscalation = this.checkDomainEscalation(intent, context)
    if (domainEscalation.required) {
      return domainEscalation
    }

    return { required: false, type: 'none', reason: 'No escalation needed' }
  }

  /**
   * Generate action recommendations
   */
  private async generateActionRecommendations(
    intent: EnhancedIntent,
    context: ConversationContext
  ): Promise<ActionRecommendation[]> {
    const recommendations: ActionRecommendation[] = []

    // Intent-specific recommendations
    switch (intent.type) {
      case 'booking_request':
        recommendations.push({
          action: 'check_availability',
          priority: 'high',
          description: 'Verify service availability'
        })
        break
        
      case 'emergency':
        recommendations.push({
          action: 'escalate_immediately',
          priority: 'critical',
          description: 'Immediate human intervention required'
        })
        break
        
      case 'price_inquiry':
        recommendations.push({
          action: 'provide_pricing',
          priority: 'medium',
          description: 'Display service pricing information'
        })
        break
    }

    // Context-based recommendations
    if (context.conversationHistory.length === 0) {
      recommendations.push({
        action: 'send_greeting',
        priority: 'low',
        description: 'Welcome new conversation'
      })
    }

    return recommendations
  }

  /**
   * Helper methods
   */
  private initializeOpenAI(): void {
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      })
    }
  }

  private initializeMetrics(): void {
    this.metrics = {
      totalRecognitions: 0,
      successfulRecognitions: 0,
      cacheHits: 0,
      averageProcessingTime: 0,
      intentAccuracy: new Map(),
      enginePerformance: new Map(),
      lastReset: Date.now()
    }
  }

  private generateMessageId(message: string, context: ConversationContext): string {
    const content = message + context.sessionId + (context.tenantId || '')
    return Buffer.from(content).toString('base64').substring(0, 16)
  }

  private getCachedResult(messageId: string): CachedIntentResult | null {
    const cached = this.cache.get(messageId)
    if (cached && cached.expiresAt > Date.now()) {
      return cached
    }
    
    if (cached) {
      this.cache.delete(messageId)
    }
    
    return null
  }

  private cacheResult(messageId: string, result: EnhancedIntent, ttl: number): void {
    this.cache.set(messageId, {
      result,
      expiresAt: Date.now() + ttl
    })
  }

  private updateMetrics(outcome: 'success' | 'error' | 'cache_hit', processingTime: number): void {
    this.metrics.totalRecognitions++
    
    if (outcome === 'success') {
      this.metrics.successfulRecognitions++
    } else if (outcome === 'cache_hit') {
      this.metrics.cacheHits++
    }

    // Update average processing time
    const total = this.metrics.averageProcessingTime * (this.metrics.totalRecognitions - 1)
    this.metrics.averageProcessingTime = (total + processingTime) / this.metrics.totalRecognitions
  }

  private updateRoutingMetrics(decision: RoutingDecision): void {
    console.log('Routing decision made:', {
      domain: decision.primaryDomain,
      confidence: decision.confidence,
      escalation: decision.escalationRequired
    })
  }

  private buildAdvancedIntentPrompt(message: string, context: ConversationContext): string {
    return `Analise esta mensagem e identifique a intenção do usuário com alta precisão.

Mensagem: "${message}"

Contexto:
- Domínio do negócio: ${context.tenantConfig?.domain || 'geral'}
- Histórico: ${context.conversationHistory.length} mensagens
- Tenant: ${context.tenantId}

Considere:
1. Contexto da conversa anterior
2. Domínio específico do negócio
3. Urgência e sentimento
4. Entidades mencionadas

Intents possíveis: booking_request, booking_cancel, booking_reschedule, booking_inquiry, service_inquiry, availability_check, price_inquiry, business_hours, location_inquiry, general_greeting, complaint, compliment, escalation_request, emergency, other

Retorne um JSON válido com:
{
  "intent": "tipo_da_intencao",
  "confidence": 0.95,
  "entities": [{"type": "service_name", "value": "exemplo", "confidence": 0.9}],
  "reasoning": "explicação da análise"
}`
  }

  private parseOpenAIResponse(response: string): any {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }
      
      // Fallback parsing
      return {
        intent: 'other',
        confidence: 0.5,
        entities: [],
        reasoning: 'Could not parse response'
      }
    } catch (error) {
      console.error('Error parsing OpenAI response:', error)
      return {
        intent: 'other',
        confidence: 0.5,
        entities: [],
        reasoning: 'Parse error'
      }
    }
  }

  private enhanceBasicIntent(intent: Intent, context: ConversationContext): EnhancedIntent {
    return {
      ...intent,
      metadata: {
        engine: 'pattern_based',
        enhanced: true
      }
    }
  }

  private getDefaultIntent(context: ConversationContext): EnhancedIntent {
    return {
      type: 'other',
      confidence: 0.3,
      entities: [],
      context: { businessDomain: context.tenantConfig?.domain },
      metadata: { engine: 'fallback' }
    }
  }

  private deduplicateEntities(entities: Entity[]): Entity[] {
    const seen = new Set<string>()
    return entities.filter(entity => {
      const key = `${entity.type}:${entity.value}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  private getAlternativeIntents(votes: Map<IntentType, VoteScore>, excludeIntent: IntentType): IntentType[] {
    return Array.from(votes.entries())
      .filter(([intent]) => intent !== excludeIntent)
      .sort(([,a], [,b]) => b.score - a.score)
      .slice(0, 3)
      .map(([intent]) => intent)
  }

  private calculateTextSimilarity(text1: string, text2: string): number {
    const words1 = text1.toLowerCase().split(/\s+/)
    const words2 = text2.toLowerCase().split(/\s+/)
    
    const intersection = words1.filter(word => words2.includes(word))
    const union = [...new Set([...words1, ...words2])]
    
    return intersection.length / union.length
  }

  private async extractEntitiesStatistical(message: string): Promise<Entity[]> {
    const entities: Entity[] = []
    
    // Simple regex-based entity extraction
    const patterns = {
      date: /(\d{1,2}\/\d{1,2}\/?\d{0,4}|hoje|amanhã|segunda|terça|quarta|quinta|sexta)/gi,
      time: /(\d{1,2}:\d{2}|\d{1,2}h\d{0,2}|manhã|tarde|noite)/gi,
      phone: /(\d{10,11}|\(\d{2}\)\s?\d{4,5}-?\d{4})/gi
    }

    Object.entries(patterns).forEach(([type, regex]) => {
      const matches = message.match(regex)
      if (matches) {
        matches.forEach(match => {
          entities.push({
            type: type as any,
            value: match,
            confidence: 0.7,
            start: message.indexOf(match),
            end: message.indexOf(match) + match.length
          })
        })
      }
    })

    return entities
  }

  private calculatePriority(intent: EnhancedIntent, context: ConversationContext): 'low' | 'medium' | 'high' | 'critical' {
    if (intent.type === 'emergency') return 'critical'
    if (intent.type === 'escalation_request') return 'high'
    if (intent.confidence > 0.8) return 'high'
    if (intent.confidence > 0.6) return 'medium'
    return 'low'
  }

  private getConfidenceFactors(intent: EnhancedIntent): Record<string, number> {
    return {
      baseConfidence: intent.confidence,
      entityCount: intent.entities.length,
      engineConsensus: intent.context.engineConsensus || 0
    }
  }

  private async getCurrentSystemLoad(): Promise<number> {
    // Simulate system load - in real implementation, check actual metrics
    return Math.random() * 0.5 + 0.3
  }

  private checkDomainEscalation(intent: EnhancedIntent, context: ConversationContext): EscalationDecision {
    // Domain-specific escalation logic
    if (context.tenantConfig?.domain === 'healthcare' && intent.confidence < 0.5) {
      return { required: true, type: 'medical_review', reason: 'Healthcare domain requires high confidence' }
    }
    
    return { required: false, type: 'none', reason: '' }
  }

  private async storeLearningData(message: string, context: ConversationContext, result: EnhancedIntent): Promise<void> {
    const key = message.toLowerCase().trim()
    const entries = this.learningData.get(key) || []
    
    entries.push({
      intent: result.type,
      confidence: result.confidence,
      context: context.tenantConfig?.domain || 'other',
      timestamp: Date.now()
    })
    
    // Keep only last 10 entries per message
    if (entries.length > 10) {
      entries.splice(0, entries.length - 10)
    }
    
    this.learningData.set(key, entries)
  }

  private async postProcessResult(result: EnhancedIntent, context: ConversationContext): Promise<EnhancedIntent> {
    // Apply domain-specific post-processing
    if (context.tenantConfig?.domain === 'healthcare' && result.type === 'booking_request') {
      // Boost confidence for healthcare bookings
      result.confidence = Math.min(result.confidence + 0.1, 1.0)
    }
    
    return result
  }

  /**
   * Public methods for metrics and management
   */
  getMetrics(): IntentMetrics {
    return { ...this.metrics }
  }

  resetMetrics(): void {
    this.initializeMetrics()
  }

  clearCache(): void {
    this.cache.clear()
  }
}

// Enhanced interfaces
interface EnhancedIntent extends Intent {
  metadata?: {
    engines?: Array<{
      name: string
      success: boolean
      processingTime: number
    }>
    ensembleMethod?: string
    totalProcessingTime?: number
    engine?: string
    model?: string
    enhanced?: boolean
    learningSamples?: number
  }
}

interface RecognitionOptions {
  engines?: IntentEngine[]
  forceRefresh?: boolean
  cacheTtl?: number
  confidenceThreshold?: number
}

interface IntentEngine {
  name: string
  weight: number
  execute: (message: string, context: ConversationContext) => Promise<EnhancedIntent>
}

interface EngineResult {
  engineName: string
  weight: number
  result: EnhancedIntent
  processingTime: number
  success: boolean
}

interface VoteScore {
  score: number
  confidence: number
  count: number
}

interface CachedIntentResult {
  result: EnhancedIntent
  expiresAt: number
}

interface LearningEntry {
  intent: IntentType
  confidence: number
  context: string
  timestamp: number
}

interface IntentMetrics {
  totalRecognitions: number
  successfulRecognitions: number
  cacheHits: number
  averageProcessingTime: number
  intentAccuracy: Map<IntentType, number>
  enginePerformance: Map<string, number>
  lastReset: number
}

interface RoutingDecision {
  primaryDomain: BusinessDomain | 'other'
  alternativeDomains: BusinessDomain[]
  escalationRequired: boolean
  escalationType: 'none' | 'human_agent' | 'supervisor' | 'immediate' | 'human_review' | 'medical_review'
  confidence: number
  priority: 'low' | 'medium' | 'high' | 'critical'
  suggestedActions: ActionRecommendation[]
  metadata: {
    processingTime: number
    rulesApplied: string[]
    confidenceFactors: Record<string, number>
  }
}

interface AdvancedRoutingRules {
  alternatives: BusinessDomain[]
  rulesApplied: string[]
}

interface EscalationDecision {
  required: boolean
  type: string
  reason: string
}

interface ActionRecommendation {
  action: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  description: string
}

export default AdvancedIntentRecognitionService 