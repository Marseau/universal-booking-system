import { 
  FunctionCall, 
  FunctionResult, 
  ConversationContext,
  AIResponse,
  Action
} from '../../types/ai.types'
import { BusinessDomain } from '../../types/database.types'
import { 
  FunctionRegistryService, 
  RegisteredFunction, 
  FunctionCategory 
} from './function-registry.service'
import { 
  ActionDispatcherService, 
  ExecutionResult 
} from './action-dispatcher.service'
import { 
  WorkflowManagerService,
  WorkflowDefinition,
  WorkflowExecution
} from './workflow-manager.service'

export interface FunctionCallingConfig {
  enableWorkflows: boolean
  enableParallelExecution: boolean
  maxConcurrentExecutions: number
  defaultTimeoutMs: number
  enableMetrics: boolean
  enableCaching: boolean
}

export interface FunctionCallingStat {
  totalCalls: number
  successfulCalls: number
  failedCalls: number
  averageExecutionTime: number
  functionUsage: Record<string, number>
  workflowsExecuted: number
  activeExecutions: number
}

export interface CachedResult {
  key: string
  result: FunctionResult
  timestamp: Date
  ttlMs: number
}

/**
 * Main Function Calling Service that orchestrates all function calling operations
 */
export class FunctionCallingService {
  private registry: FunctionRegistryService
  private dispatcher: ActionDispatcherService
  private workflowManager: WorkflowManagerService
  private config: FunctionCallingConfig
  private cache: Map<string, CachedResult> = new Map()
  private stats: FunctionCallingStat
  private activeExecutions: Set<string> = new Set()

  constructor(config: Partial<FunctionCallingConfig> = {}) {
    this.config = {
      enableWorkflows: true,
      enableParallelExecution: true,
      maxConcurrentExecutions: 10,
      defaultTimeoutMs: 30000,
      enableMetrics: true,
      enableCaching: false,
      ...config
    }

    this.registry = new FunctionRegistryService()
    this.dispatcher = new ActionDispatcherService()
    this.workflowManager = new WorkflowManagerService()

    this.stats = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      averageExecutionTime: 0,
      functionUsage: {},
      workflowsExecuted: 0,
      activeExecutions: 0
    }

    this.initializeService()
  }

  /**
   * Initialize the service
   */
  private initializeService(): void {
    console.log('🔧 Initializing Function Calling Service...')
    
    if (this.config.enableCaching) {
      this.startCacheCleanup()
    }

    if (this.config.enableMetrics) {
      this.startMetricsCollection()
    }

    console.log('✅ Function Calling Service initialized')
    this.logConfiguration()
  }

  /**
   * Execute a single function call
   */
  async executeFunction(
    functionCall: FunctionCall,
    context: ConversationContext,
    options: {
      useCache?: boolean
      timeoutMs?: number
      priority?: 'low' | 'medium' | 'high'
    } = {}
  ): Promise<FunctionResult> {
    const executionId = this.generateExecutionId()
    const startTime = Date.now()

    try {
      // Check concurrency limits
      if (this.activeExecutions.size >= this.config.maxConcurrentExecutions) {
        return {
          success: false,
          message: 'Maximum concurrent executions reached. Please try again later.',
          shouldContinue: true
        }
      }

      this.activeExecutions.add(executionId)
      this.stats.totalCalls++
      this.stats.activeExecutions = this.activeExecutions.size

      // Check cache
      if (options.useCache && this.config.enableCaching) {
        const cachedResult = this.getCachedResult(functionCall, context)
        if (cachedResult) {
          console.log(`📋 Using cached result for ${functionCall.name}`)
          this.updateStats(true, Date.now() - startTime, functionCall.name)
          return cachedResult
        }
      }

      // Execute function
      console.log(`🚀 Executing function: ${functionCall.name}`)
      const result = await this.dispatcher.dispatch(functionCall, context)

      // Cache result if enabled
      if (this.config.enableCaching && result.success && options.useCache) {
        this.cacheResult(functionCall, context, result)
      }

      this.updateStats(result.success, Date.now() - startTime, functionCall.name)
      
      console.log(`${result.success ? '✅' : '❌'} Function ${functionCall.name} ${result.success ? 'completed' : 'failed'}`)
      return result

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error(`❌ Function execution error for ${functionCall.name}:`, error)
      
      this.updateStats(false, Date.now() - startTime, functionCall.name)
      
      return {
        success: false,
        message: `Execution error: ${errorMessage}`,
        shouldContinue: false
      }
    } finally {
      this.activeExecutions.delete(executionId)
      this.stats.activeExecutions = this.activeExecutions.size
    }
  }

  /**
   * Execute multiple function calls
   */
  async executeFunctions(
    functionCalls: FunctionCall[],
    context: ConversationContext,
    options: {
      parallel?: boolean
      continueOnError?: boolean
      timeoutMs?: number
    } = {}
  ): Promise<ExecutionResult> {
    console.log(`🚀 Executing ${functionCalls.length} functions ${options.parallel ? 'in parallel' : 'sequentially'}`)

    const result = await this.dispatcher.dispatchPlan(functionCalls, context, {
      parallel: options.parallel || this.config.enableParallelExecution,
      timeoutMs: options.timeoutMs || this.config.defaultTimeoutMs
    })

    // Update stats
    result.results.forEach(stepResult => {
      this.updateStats(stepResult.success, stepResult.duration, stepResult.functionName)
    })

    return result
  }

  /**
   * Execute a workflow
   */
  async executeWorkflow(
    workflowId: string,
    context: ConversationContext,
    variables: Record<string, any> = {}
  ): Promise<WorkflowExecution> {
    if (!this.config.enableWorkflows) {
      throw new Error('Workflows are disabled in configuration')
    }

    console.log(`🌊 Executing workflow: ${workflowId}`)
    const execution = await this.workflowManager.executeWorkflow(workflowId, context, variables)
    
    this.stats.workflowsExecuted++
    console.log(`${execution.status === 'completed' ? '✅' : '❌'} Workflow ${workflowId} ${execution.status}`)
    
    return execution
  }

  /**
   * Get available functions for context
   */
  getAvailableFunctions(context: ConversationContext): RegisteredFunction[] {
    return this.registry.getAvailableFunctions(context)
  }

  /**
   * Search functions
   */
  searchFunctions(query: string, domain?: BusinessDomain | 'other'): RegisteredFunction[] {
    const allResults = this.registry.searchFunctions(query)
    
    if (domain) {
      return allResults.filter(func => func.domain === domain)
    }
    
    return allResults
  }

  /**
   * Get functions by category
   */
  getFunctionsByCategory(category: FunctionCategory): RegisteredFunction[] {
    return this.registry.getFunctionsByCategory(category)
  }

  /**
   * Register a new function
   */
  registerFunction(func: RegisteredFunction): boolean {
    return this.registry.registerFunction(func)
  }

  /**
   * Register a workflow
   */
  registerWorkflow(workflow: WorkflowDefinition): boolean {
    return this.workflowManager.registerWorkflow(workflow)
  }

  /**
   * Get function calling statistics
   */
  getStats(): FunctionCallingStat {
    return { ...this.stats }
  }

  /**
   * Get registry statistics
   */
  getRegistryStats() {
    return this.registry.getStats()
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      averageExecutionTime: 0,
      functionUsage: {},
      workflowsExecuted: 0,
      activeExecutions: this.activeExecutions.size
    }
    console.log('📊 Statistics reset')
  }

  /**
   * Update statistics
   */
  private updateStats(success: boolean, duration: number, functionName: string): void {
    if (success) {
      this.stats.successfulCalls++
    } else {
      this.stats.failedCalls++
    }

    // Update average execution time
    const totalCalls = this.stats.successfulCalls + this.stats.failedCalls
    this.stats.averageExecutionTime = 
      (this.stats.averageExecutionTime * (totalCalls - 1) + duration) / totalCalls

    // Update function usage
    this.stats.functionUsage[functionName] = (this.stats.functionUsage[functionName] || 0) + 1
  }

  /**
   * Generate cache key
   */
  private generateCacheKey(functionCall: FunctionCall, context: ConversationContext): string {
    const hashData = {
      functionName: functionCall.name,
      arguments: functionCall.arguments,
      tenantId: context.tenantId,
      domain: context.tenantConfig?.domain
    }
    
    // Simple hash - in production, use a proper hashing library
    return btoa(JSON.stringify(hashData)).replace(/[^a-zA-Z0-9]/g, '')
  }

  /**
   * Get cached result
   */
  private getCachedResult(functionCall: FunctionCall, context: ConversationContext): FunctionResult | null {
    const key = this.generateCacheKey(functionCall, context)
    const cached = this.cache.get(key)
    
    if (!cached) return null
    
    // Check TTL
    if (Date.now() - cached.timestamp.getTime() > cached.ttlMs) {
      this.cache.delete(key)
      return null
    }
    
    return cached.result
  }

  /**
   * Cache result
   */
  private cacheResult(
    functionCall: FunctionCall, 
    context: ConversationContext, 
    result: FunctionResult
  ): void {
    const key = this.generateCacheKey(functionCall, context)
    
    // Determine TTL based on function type
    let ttlMs = 60000 // Default 1 minute
    if (functionCall.name.includes('availability')) {
      ttlMs = 30000 // 30 seconds for availability checks
    } else if (functionCall.name.includes('info') || functionCall.name.includes('get')) {
      ttlMs = 300000 // 5 minutes for info functions
    }
    
    this.cache.set(key, {
      key,
      result,
      timestamp: new Date(),
      ttlMs
    })
  }

  /**
   * Start cache cleanup
   */
  private startCacheCleanup(): void {
    setInterval(() => {
      const now = Date.now()
      let removedCount = 0
      
      for (const [key, cached] of this.cache.entries()) {
        if (now - cached.timestamp.getTime() > cached.ttlMs) {
          this.cache.delete(key)
          removedCount++
        }
      }
      
      if (removedCount > 0) {
        console.log(`🧹 Cleaned up ${removedCount} expired cache entries`)
      }
    }, 60000) // Clean every minute
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    setInterval(() => {
      if (this.config.enableMetrics) {
        console.log('📊 Function Calling Metrics:', {
          totalCalls: this.stats.totalCalls,
          successRate: this.stats.totalCalls > 0 
            ? ((this.stats.successfulCalls / this.stats.totalCalls) * 100).toFixed(2) + '%'
            : '0%',
          avgExecutionTime: Math.round(this.stats.averageExecutionTime) + 'ms',
          activeExecutions: this.stats.activeExecutions,
          topFunctions: Object.entries(this.stats.functionUsage)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([name, count]) => `${name}: ${count}`)
        })
      }
    }, 300000) // Log every 5 minutes
  }

  /**
   * Generate execution ID
   */
  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Log configuration
   */
  private logConfiguration(): void {
    console.log('⚙️  Function Calling Configuration:', {
      enableWorkflows: this.config.enableWorkflows,
      enableParallelExecution: this.config.enableParallelExecution,
      maxConcurrentExecutions: this.config.maxConcurrentExecutions,
      defaultTimeoutMs: this.config.defaultTimeoutMs,
      enableMetrics: this.config.enableMetrics,
      enableCaching: this.config.enableCaching
    })
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.cache.clear()
    this.activeExecutions.clear()
    console.log('🧹 Function Calling Service cleaned up')
  }
} 