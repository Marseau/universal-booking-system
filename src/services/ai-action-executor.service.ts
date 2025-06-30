import { ConversationContext, AIFunction, FunctionCall } from '../types/ai.types'
import { supabase } from '../config/database'
import { FunctionExecutorService } from './function-executor.service'

/**
 * Advanced AI Action Executor Service
 * Handles complex AI action orchestration with enterprise features
 */
export class AIActionExecutorService {
  private functionExecutor: FunctionExecutorService
  private actionCache: Map<string, CachedActionResult> = new Map()
  private retryQueue: Map<string, RetryableAction> = new Map()
  private healthMetrics: HealthMetrics
  private workflows: Map<string, ActionWorkflow> = new Map()

  constructor() {
    this.functionExecutor = new FunctionExecutorService()
    this.healthMetrics = this.initializeHealthMetrics()
    this.initializeWorkflows()
  }

  /**
   * Execute a single AI action with advanced features
   */
  async executeAction(
    action: AIAction,
    context: ConversationContext,
    options: ExecutionOptions = {}
  ): Promise<ActionResult> {
    const actionId = this.generateActionId()
    const startTime = Date.now()

    try {
      // Check cache first
      if (options.useCache && !options.forceRefresh) {
        const cached = this.getCachedResult(action, context)
        if (cached) {
          this.updateMetrics('cache_hit', action.type)
          return cached.result
        }
      }

      // Validate action prerequisites
      const validation = await this.validateActionPrerequisites(action, context)
      if (!validation.isValid) {
        return this.createFailureResult(actionId, validation.errors.join(', '), action)
      }

      // Execute action with monitoring
      const result = await this.executeWithMonitoring(action, context, options, actionId)

      // Cache successful results
      if (result.success && options.useCache) {
        this.cacheResult(action, context, result, options.cacheTtl || 300000)
      }

      // Update metrics
      this.updateMetrics(result.success ? 'success' : 'failure', action.type)
      this.updateExecutionTime(action.type, Date.now() - startTime)

      return result

    } catch (error) {
      console.error(`AI Action execution error:`, error)
      this.updateMetrics('error', action.type)
      
      return this.createFailureResult(actionId, error instanceof Error ? error.message : 'Unknown error', action)
    }
  }

  /**
   * Execute multiple actions in parallel
   */
  async executeActionsParallel(
    actions: AIAction[],
    context: ConversationContext,
    options: ParallelExecutionOptions = {}
  ): Promise<ParallelActionResult> {
    const actionId = this.generateActionId()
    const startTime = Date.now()

    try {
      const promises = actions.map(action => 
        this.executeAction(action, context, options.individual || {})
      )
      
      const results = await Promise.allSettled(promises)
      const successful: ActionResult[] = []
      const errors: ActionError[] = []

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          successful.push(result.value)
        } else {
          const action = actions[index]
          if (action) {
            errors.push({
              action,
              error: result.reason,
              timestamp: new Date()
            })
          }
        }
      })

      return {
        actionId,
        results: successful,
        errors,
        summary: {
          total: actions.length,
          successful: successful.filter(r => r.success).length,
          failed: successful.filter(r => !r.success).length + errors.length,
          executionTime: Date.now() - startTime
        }
      }

    } catch (error) {
      console.error('Parallel action execution error:', error)
      const firstAction = actions[0]
      const errors = firstAction ? [{ action: firstAction, error: error, timestamp: new Date() }] : []
      
      return {
        actionId,
        results: [],
        errors,
        summary: {
          total: actions.length,
          successful: 0,
          failed: actions.length,
          executionTime: Date.now() - startTime
        }
      }
    }
  }

  /**
   * Execute action with monitoring
   */
  private async executeWithMonitoring(
    action: AIAction,
    context: ConversationContext,
    options: ExecutionOptions,
    actionId: string
  ): Promise<ActionResult> {
    const monitor = this.createActionMonitor(action, context, actionId)
    
    try {
      monitor.start()

      let result: ActionResult

      switch (action.type) {
        case 'booking':
          result = await this.executeBookingAction(action, context)
          break
        case 'assessment':
          result = await this.executeAssessmentAction(action, context)
          break
        case 'escalation':
          result = await this.executeEscalationAction(action, context)
          break
        case 'notification':
          result = await this.executeNotificationAction(action, context)
          break
        case 'query':
          result = await this.executeQueryAction(action, context)
          break
        case 'calculation':
          result = await this.executeCalculationAction(action, context)
          break
        case 'validation':
          result = await this.executeValidationAction(action, context)
          break
        case 'composite':
          result = await this.executeCompositeAction(action, context, options)
          break
        default:
          result = await this.executeGenericAction(action, context)
      }

      monitor.complete(result)
      return result

    } catch (error) {
      monitor.error(error)
      throw error
    }
  }

  /**
   * Execute booking actions
   */
  private async executeBookingAction(
    action: AIAction,
    context: ConversationContext
  ): Promise<ActionResult> {
    const { parameters } = action

    // Check availability
    const availability = await this.checkServiceAvailability(
      parameters.serviceId,
      parameters.date,
      parameters.time,
      context.tenantId
    )

    if (!availability.available) {
      return {
        actionId: this.generateActionId(),
        type: action.type,
        success: false,
        message: `Service not available: ${availability.reason}`,
        shouldContinue: true,
        data: { availability }
      }
    }

    // Create booking
    const booking = await this.createBooking({
      serviceId: parameters.serviceId,
      userId: context.userId,
      tenantId: context.tenantId,
      date: parameters.date,
      time: parameters.time,
      notes: parameters.notes,
      phoneNumber: context.phoneNumber
    })

    return {
      actionId: this.generateActionId(),
      type: action.type,
      success: booking.success,
      message: booking.success ? 'Booking created successfully' : booking.message,
      shouldContinue: true,
      data: { booking: booking.data }
    }
  }

  /**
   * Execute escalation actions
   */
  private async executeEscalationAction(
    action: AIAction,
    context: ConversationContext
  ): Promise<ActionResult> {
    const { parameters } = action

    // Log escalation
    await this.logEscalation({
      sessionId: context.sessionId,
      userId: context.userId,
      tenantId: context.tenantId,
      phoneNumber: context.phoneNumber,
      type: parameters.type || 'human',
      urgency: parameters.urgency || 'normal',
      reason: parameters.reason
    })

    // Execute escalation
    const escalationResult = await this.executeHumanEscalation(parameters, context)

    return {
      actionId: this.generateActionId(),
      type: action.type,
      success: escalationResult.success,
      message: escalationResult.message,
      shouldContinue: false,
      data: { escalation: escalationResult }
    }
  }

  /**
   * Execute assessment actions
   */
  private async executeAssessmentAction(
    action: AIAction,
    context: ConversationContext
  ): Promise<ActionResult> {
    const { parameters } = action
    const assessmentType = parameters.type || 'general'
    
    let assessmentResult: any
    
    switch (assessmentType) {
      case 'urgency':
        assessmentResult = await this.assessUrgency(parameters.input, context)
        break
      case 'risk':
        assessmentResult = await this.assessRisk(parameters.input, context)
        break
      default:
        assessmentResult = await this.performGenericAssessment(parameters.input, context)
    }

    return {
      actionId: this.generateActionId(),
      type: action.type,
      success: true,
      message: `${assessmentType} assessment completed`,
      shouldContinue: true,
      data: { assessment: assessmentResult }
    }
  }

  /**
   * Execute notification actions
   */
  private async executeNotificationAction(
    action: AIAction,
    context: ConversationContext
  ): Promise<ActionResult> {
    const { parameters } = action

    const notification = {
      type: parameters.type || 'info',
      message: parameters.message,
      recipient: parameters.recipient || context.phoneNumber
    }

    const result = await this.sendNotification(notification, context)

    return {
      actionId: this.generateActionId(),
      type: action.type,
      success: result.success,
      message: result.message,
      shouldContinue: true,
      data: { notification: result }
    }
  }

  /**
   * Execute query actions
   */
  private async executeQueryAction(
    action: AIAction,
    context: ConversationContext
  ): Promise<ActionResult> {
    const { parameters } = action

    let queryResult: any

    switch (parameters.type) {
      case 'availability':
        queryResult = await this.queryAvailability(parameters, context)
        break
      case 'booking_history':
        queryResult = await this.queryBookingHistory(parameters, context)
        break
      default:
        queryResult = await this.executeGenericQuery(parameters, context)
    }

    return {
      actionId: this.generateActionId(),
      type: action.type,
      success: true,
      message: 'Query executed successfully',
      shouldContinue: true,
      data: { query: queryResult }
    }
  }

  /**
   * Execute calculation actions
   */
  private async executeCalculationAction(
    action: AIAction,
    context: ConversationContext
  ): Promise<ActionResult> {
    const { parameters } = action

    const calculationResult = await this.performCalculation(parameters, context)

    return {
      actionId: this.generateActionId(),
      type: action.type,
      success: true,
      message: 'Calculation completed',
      shouldContinue: true,
      data: { calculation: calculationResult }
    }
  }

  /**
   * Execute validation actions
   */
  private async executeValidationAction(
    action: AIAction,
    context: ConversationContext
  ): Promise<ActionResult> {
    const { parameters } = action

    const validationResult = await this.performBusinessValidation(parameters, context)

    return {
      actionId: this.generateActionId(),
      type: action.type,
      success: validationResult.isValid,
      message: validationResult.isValid ? 'Validation passed' : validationResult.errors.join(', '),
      shouldContinue: true,
      data: { validation: validationResult }
    }
  }

  /**
   * Execute composite actions
   */
  private async executeCompositeAction(
    action: AIAction,
    context: ConversationContext,
    options: ExecutionOptions
  ): Promise<ActionResult> {
    const { parameters } = action
    const subActions = parameters.actions as AIAction[]

    if (!Array.isArray(subActions) || subActions.length === 0) {
      return {
        actionId: this.generateActionId(),
        type: action.type,
        success: false,
        message: 'No sub-actions defined for composite action',
        shouldContinue: true
      }
    }

    // Execute sub-actions
    const results: ActionResult[] = []
    for (const subAction of subActions) {
      const result = await this.executeAction(subAction, context, options)
      results.push(result)
      
      if (!result.success && parameters.stopOnFirstFailure) {
        break
      }
    }

    const successful = results.filter(r => r.success).length
    const failed = results.length - successful

    return {
      actionId: this.generateActionId(),
      type: action.type,
      success: failed === 0 || !parameters.requireAllSuccess,
      message: `Composite action completed: ${successful} successful, ${failed} failed`,
      shouldContinue: true,
      data: { 
        subResults: results,
        summary: { total: results.length, successful, failed }
      }
    }
  }

  /**
   * Execute generic action
   */
  private async executeGenericAction(
    action: AIAction,
    context: ConversationContext
  ): Promise<ActionResult> {
    const functionCall: FunctionCall = {
      name: action.functionName || action.type,
      arguments: JSON.stringify(action.parameters || {})
    }

    const functionDef = await this.getFunctionDefinition(functionCall.name, context)
    
    if (!functionDef) {
      return {
        actionId: this.generateActionId(),
        type: action.type,
        success: false,
        message: `Function ${functionCall.name} not found`,
        shouldContinue: true
      }
    }

    const result = await this.functionExecutor.executeFunction(functionCall, functionDef, context)

    return {
      actionId: this.generateActionId(),
      type: action.type,
      success: result.success,
      message: result.message || 'Function executed',
      shouldContinue: result.shouldContinue,
      data: result.data
    }
  }

  /**
   * Initialize predefined workflows
   */
  private initializeWorkflows(): void {
    this.workflows.set('booking', {
      name: 'booking',
      description: 'Complete booking process',
      steps: [
        {
          name: 'validate_input',
          action: { type: 'validation', parameters: {} },
          continueOnFailure: false
        },
        {
          name: 'check_availability',
          action: { type: 'query', parameters: { type: 'availability' } },
          continueOnFailure: false
        },
        {
          name: 'create_booking',
          action: { type: 'booking', parameters: {} },
          continueOnFailure: false
        }
      ]
    })
  }

  // Utility methods
  private generateActionId(): string {
    return `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private initializeHealthMetrics(): HealthMetrics {
    return {
      totalActions: 0,
      successfulActions: 0,
      failedActions: 0,
      averageExecutionTime: 0,
      actionsByType: {},
      lastReset: Date.now()
    }
  }

  private updateMetrics(outcome: 'success' | 'failure' | 'error' | 'cache_hit', actionType: string): void {
    this.healthMetrics.totalActions++
    
    if (outcome === 'success' || outcome === 'cache_hit') {
      this.healthMetrics.successfulActions++
    } else {
      this.healthMetrics.failedActions++
    }

    if (!this.healthMetrics.actionsByType[actionType]) {
      this.healthMetrics.actionsByType[actionType] = { total: 0, successful: 0, failed: 0 }
    }
    
    this.healthMetrics.actionsByType[actionType].total++
    
    if (outcome === 'success' || outcome === 'cache_hit') {
      this.healthMetrics.actionsByType[actionType].successful++
    } else {
      this.healthMetrics.actionsByType[actionType].failed++
    }
  }

  private updateExecutionTime(actionType: string, duration: number): void {
    const total = this.healthMetrics.totalActions
    const current = this.healthMetrics.averageExecutionTime
    this.healthMetrics.averageExecutionTime = ((current * (total - 1)) + duration) / total
  }

  private createFailureResult(actionId: string, message: string, action: AIAction): ActionResult {
    return {
      actionId,
      type: action.type,
      success: false,
      message,
      shouldContinue: true
    }
  }

  // Business validation and prerequisite checks
  private async validateActionPrerequisites(action: AIAction, context: ConversationContext): Promise<{ isValid: boolean; errors: string[] }> {
    return { isValid: true, errors: [] }
  }

  // Cache management
  private getCachedResult(action: AIAction, context: ConversationContext): CachedActionResult | null {
    const key = this.generateCacheKey(action, context)
    const cached = this.actionCache.get(key)
    
    if (cached && cached.expiresAt > Date.now()) {
      return cached
    }
    
    return null
  }

  private cacheResult(action: AIAction, context: ConversationContext, result: ActionResult, ttl: number): void {
    const key = this.generateCacheKey(action, context)
    this.actionCache.set(key, {
      result,
      expiresAt: Date.now() + ttl
    })
  }

  private generateCacheKey(action: AIAction, context: ConversationContext): string {
    return `${action.type}_${context.tenantId}_${JSON.stringify(action.parameters)}`
  }

  // Business logic implementations (simplified)
  private async checkServiceAvailability(serviceId: string, date: string, time: string, tenantId: string): Promise<any> {
    return { available: true, reason: null }
  }

  private async createBooking(bookingData: any): Promise<any> {
    return { success: true, data: { id: 'booking_123', ...bookingData }, message: 'Booking created' }
  }

  private async logEscalation(escalationData: any): Promise<void> {
    // Log to database
    console.log('Escalation logged:', escalationData)
  }

  private async executeHumanEscalation(parameters: any, context: ConversationContext): Promise<any> {
    return { success: true, message: 'Transferred to human agent' }
  }

  private async assessUrgency(input: any, context: ConversationContext): Promise<any> {
    return { level: 'medium', score: 0.6 }
  }

  private async assessRisk(input: any, context: ConversationContext): Promise<any> {
    return { level: 'low', score: 0.2 }
  }

  private async performGenericAssessment(input: any, context: ConversationContext): Promise<any> {
    return { type: 'general', result: 'assessment_complete' }
  }

  private async sendNotification(notification: any, context: ConversationContext): Promise<any> {
    return { success: true, message: 'Notification sent' }
  }

  private async queryAvailability(parameters: any, context: ConversationContext): Promise<any> {
    return { available_slots: ['09:00', '10:00', '14:00'], date: parameters.date }
  }

  private async queryBookingHistory(parameters: any, context: ConversationContext): Promise<any> {
    return { bookings: [], total: 0 }
  }

  private async executeGenericQuery(parameters: any, context: ConversationContext): Promise<any> {
    return { result: 'query_executed' }
  }

  private async performCalculation(parameters: any, context: ConversationContext): Promise<any> {
    return { result: 100, type: parameters.type || 'generic' }
  }

  private async performBusinessValidation(parameters: any, context: ConversationContext): Promise<any> {
    return { isValid: true, errors: [] }
  }

  private async getFunctionDefinition(functionName: string, context: ConversationContext): Promise<AIFunction | null> {
    return null
  }

  private createActionMonitor(action: AIAction, context: ConversationContext, actionId: string) {
    return {
      start: () => console.log(`🎬 Action ${actionId} started: ${action.type}`),
      complete: (result: ActionResult) => console.log(`✅ Action ${actionId} completed: ${result.success ? 'SUCCESS' : 'FAILED'}`),
      error: (error: any) => console.error(`❌ Action ${actionId} error:`, error)
    }
  }

  /**
   * Get health metrics
   */
  getHealthMetrics(): HealthMetrics {
    return { ...this.healthMetrics }
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.healthMetrics = this.initializeHealthMetrics()
  }

  /**
   * Clear caches
   */
  clearCaches(): void {
    this.actionCache.clear()
    this.retryQueue.clear()
  }
}

// Type definitions
export interface AIAction {
  type: ActionType
  functionName?: string
  parameters: Record<string, any>
  priority?: 'low' | 'medium' | 'high'
  metadata?: Record<string, any>
}

export type ActionType = 
  | 'booking' 
  | 'assessment' 
  | 'escalation' 
  | 'notification' 
  | 'query' 
  | 'calculation' 
  | 'validation'
  | 'composite'

export interface ExecutionOptions {
  useCache?: boolean
  cacheTtl?: number
  forceRefresh?: boolean
  enableRetry?: boolean
  timeout?: number
  metadata?: Record<string, any>
}

export interface ParallelExecutionOptions {
  maxConcurrency?: number
  stopOnFirstFailure?: boolean
  individual?: ExecutionOptions
}

export interface ActionResult {
  actionId: string
  type: ActionType
  success: boolean
  message: string
  shouldContinue: boolean
  data?: any
  executionTime?: number
}

export interface ParallelActionResult {
  actionId: string
  results: ActionResult[]
  errors: ActionError[]
  summary: {
    total: number
    successful: number
    failed: number
    executionTime: number
  }
}

export interface ActionError {
  action: AIAction
  error: any
  timestamp: Date
}

interface CachedActionResult {
  result: ActionResult
  expiresAt: number
}

interface RetryableAction {
  attempts: number
  maxAttempts: number
  nextRetry: number
  lastError?: any
}

interface HealthMetrics {
  totalActions: number
  successfulActions: number
  failedActions: number
  averageExecutionTime: number
  actionsByType: Record<string, { total: number; successful: number; failed: number }>
  lastReset: number
}

interface ActionWorkflow {
  name: string
  description: string
  steps: WorkflowStepDefinition[]
}

interface WorkflowStepDefinition {
  name: string
  action: AIAction
  continueOnFailure: boolean
}

interface WorkflowInput {
  initialState?: Record<string, any>
  parameters?: Record<string, any>
}

interface WorkflowResult {
  workflowId: string
  workflowName: string
  success: boolean
  finalState: Record<string, any>
  executionLog: WorkflowStep[]
  duration: number
  error?: string
}

interface WorkflowStep {
  stepName: string
  status: 'completed' | 'failed' | 'error' | 'skipped'
  duration: number
  result?: ActionResult
  error?: string
  reason?: string
  state?: Record<string, any>
} 