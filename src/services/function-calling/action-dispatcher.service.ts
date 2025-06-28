import { 
  FunctionCall, 
  FunctionResult, 
  ConversationContext,
  AIResponse,
  Action,
  ActionType 
} from '../../types/ai.types'
import { 
  FunctionRegistryService, 
  RegisteredFunction, 
  FunctionMiddleware 
} from './function-registry.service'
import { FunctionExecutorService } from '../function-executor.service'

export interface ExecutionPlan {
  id: string
  functions: ExecutionStep[]
  context: ConversationContext
  parallelExecution: boolean
  timeoutMs: number
  retryPolicy: RetryPolicy
}

export interface ExecutionStep {
  id: string
  function: RegisteredFunction
  args: any
  dependencies: string[]
  priority: number
}

export interface RetryPolicy {
  maxRetries: number
  backoffMs: number
  backoffMultiplier: number
  retryableErrors: string[]
}

export interface ExecutionResult {
  planId: string
  success: boolean
  results: StepResult[]
  totalDuration: number
  failedSteps: string[]
  actions: Action[]
}

export interface StepResult {
  stepId: string
  functionName: string
  success: boolean
  result?: FunctionResult
  error?: string
  duration: number
  retryCount: number
}

/**
 * Advanced action dispatcher for executing function calls with middleware
 */
export class ActionDispatcherService {
  private registry: FunctionRegistryService
  private executor: FunctionExecutorService
  private activePlans: Map<string, ExecutionPlan> = new Map()
  private middleware: FunctionMiddleware[] = []

  constructor() {
    this.registry = new FunctionRegistryService()
    this.executor = new FunctionExecutorService()
    this.initializeMiddleware()
  }

  /**
   * Dispatch a single function call
   */
  async dispatch(
    functionCall: FunctionCall,
    context: ConversationContext
  ): Promise<FunctionResult> {
    const registeredFunction = this.registry.getFunctionByName(
      functionCall.name,
      context.tenantConfig?.domain
    )

    if (!registeredFunction) {
      return {
        success: false,
        message: `Function '${functionCall.name}' not found for domain '${context.tenantConfig?.domain}'`,
        shouldContinue: false
      }
    }

    return this.executeWithMiddleware(registeredFunction, functionCall, context)
  }

  /**
   * Dispatch multiple function calls as a plan
   */
  async dispatchPlan(
    functionCalls: FunctionCall[],
    context: ConversationContext,
    options: {
      parallel?: boolean
      timeoutMs?: number
      retryPolicy?: Partial<RetryPolicy>
    } = {}
  ): Promise<ExecutionResult> {
    const plan = this.createExecutionPlan(functionCalls, context, options)
    return this.executePlan(plan)
  }

  /**
   * Create execution plan from function calls
   */
  private createExecutionPlan(
    functionCalls: FunctionCall[],
    context: ConversationContext,
    options: any
  ): ExecutionPlan {
    const planId = this.generatePlanId()
    const steps: ExecutionStep[] = []

    functionCalls.forEach((call, index) => {
      const registeredFunction = this.registry.getFunctionByName(
        call.name,
        context.tenantConfig?.domain
      )

      if (registeredFunction) {
        steps.push({
          id: `step_${index}`,
          function: registeredFunction,
          args: JSON.parse(call.arguments),
          dependencies: this.calculateDependencies(call, functionCalls, index),
          priority: this.calculatePriority(registeredFunction)
        })
      }
    })

    const plan: ExecutionPlan = {
      id: planId,
      functions: steps,
      context,
      parallelExecution: options.parallel || false,
      timeoutMs: options.timeoutMs || 30000,
      retryPolicy: {
        maxRetries: 3,
        backoffMs: 1000,
        backoffMultiplier: 2,
        retryableErrors: ['timeout', 'network', 'rate_limit'],
        ...options.retryPolicy
      }
    }

    this.activePlans.set(planId, plan)
    return plan
  }

  /**
   * Execute a plan
   */
  private async executePlan(plan: ExecutionPlan): Promise<ExecutionResult> {
    console.log(`🚀 Executing plan ${plan.id} with ${plan.functions.length} steps`)
    
    const startTime = Date.now()
    const results: StepResult[] = []
    const failedSteps: string[] = []
    const actions: Action[] = []

    try {
      if (plan.parallelExecution) {
        // Execute all steps in parallel
        const promises = plan.functions.map(step => 
          this.executeStep(step, plan.context)
        )
        
                 const stepResults = await Promise.allSettled(promises)
         stepResults.forEach((result, index) => {
           const step = plan.functions[index]
           if (!step) return // Skip if step is undefined
           
           if (result.status === 'fulfilled') {
             results.push(result.value)
             if (!result.value.success) {
               failedSteps.push(step.id)
             }
           } else {
             results.push({
               stepId: step.id,
               functionName: step.function.name,
               success: false,
               error: result.reason?.message || 'Unknown error',
               duration: 0,
               retryCount: 0
             })
             failedSteps.push(step.id)
           }
         })
      } else {
        // Execute steps sequentially with dependency resolution
        const sortedSteps = this.topologicalSort(plan.functions)
        
        for (const step of sortedSteps) {
          const result = await this.executeStep(step, plan.context)
          results.push(result)
          
          if (!result.success) {
            failedSteps.push(step.id)
            if (!result.result?.shouldContinue) {
              break // Stop execution if step failed and shouldn't continue
            }
          }

          // Extract actions from successful step results
          if (result.success && result.result?.data?.actions) {
            actions.push(...result.result.data.actions)
          }
        }
      }

      const totalDuration = Date.now() - startTime
      const success = failedSteps.length === 0

      console.log(`${success ? '✅' : '❌'} Plan ${plan.id} completed in ${totalDuration}ms`)

      return {
        planId: plan.id,
        success,
        results,
        totalDuration,
        failedSteps,
        actions
      }

    } finally {
      this.activePlans.delete(plan.id)
    }
  }

  /**
   * Execute a single step with retries
   */
  private async executeStep(
    step: ExecutionStep,
    context: ConversationContext
  ): Promise<StepResult> {
    const startTime = Date.now()
    let retryCount = 0
    let lastError: string | undefined

    const functionCall: FunctionCall = {
      name: step.function.name,
      arguments: JSON.stringify(step.args)
    }

         while (retryCount <= (step.function.metadata.rateLimit?.requests ?? 3)) {
      try {
        const result = await this.executeWithMiddleware(
          step.function,
          functionCall,
          context
        )

        return {
          stepId: step.id,
          functionName: step.function.name,
          success: result.success,
          result,
          duration: Date.now() - startTime,
          retryCount
        }

      } catch (error) {
        retryCount++
        lastError = error instanceof Error ? error.message : 'Unknown error'
        
        if (retryCount <= 3) {
          const backoffMs = Math.pow(2, retryCount - 1) * 1000
          console.warn(`⚠️  Step ${step.id} failed, retrying in ${backoffMs}ms (attempt ${retryCount})`)
          await this.sleep(backoffMs)
        }
      }
    }

         return {
       stepId: step.id,
       functionName: step.function.name,
       success: false,
       error: lastError || 'Unknown error',
       duration: Date.now() - startTime,
       retryCount
     }
  }

  /**
   * Execute function with middleware pipeline
   */
  private async executeWithMiddleware(
    func: RegisteredFunction,
    call: FunctionCall,
    context: ConversationContext
  ): Promise<FunctionResult> {
    const allMiddleware = [
      ...this.middleware,
      ...(func.middleware || [])
    ].sort((a, b) => b.priority - a.priority)

    let index = 0
    
    const next = async (): Promise<FunctionResult> => {
             if (index < allMiddleware.length) {
         const middleware = allMiddleware[index++]
         if (middleware) {
           return middleware.execute(JSON.parse(call.arguments), context, next)
         }
         return next()
      } else {
        // Execute the actual function
        return this.executor.executeFunction(call, func, context)
      }
    }

    return next()
  }

  /**
   * Calculate dependencies between functions
   */
  private calculateDependencies(
    call: FunctionCall,
    allCalls: FunctionCall[],
    index: number
  ): string[] {
    const dependencies: string[] = []
    
    // Simple dependency detection based on function names
    // In a more sophisticated system, this would analyze data flow
    
    if (call.name.includes('book') && index > 0) {
      // Booking functions depend on availability checks
      for (let i = 0; i < index; i++) {
        if (allCalls[i].name.includes('check') || allCalls[i].name.includes('availability')) {
          dependencies.push(`step_${i}`)
        }
      }
    }

    return dependencies
  }

  /**
   * Calculate function priority
   */
  private calculatePriority(func: RegisteredFunction): number {
    // Higher priority for critical functions
    if (func.category === 'booking') return 90
    if (func.category === 'inquiry') return 80
    if (func.category === 'consultation') return 70
    return 50
  }

  /**
   * Topological sort for dependency resolution
   */
  private topologicalSort(steps: ExecutionStep[]): ExecutionStep[] {
    const sorted: ExecutionStep[] = []
    const visited = new Set<string>()
    const visiting = new Set<string>()

    const visit = (step: ExecutionStep) => {
      if (visiting.has(step.id)) {
        throw new Error(`Circular dependency detected involving ${step.id}`)
      }
      if (visited.has(step.id)) return

      visiting.add(step.id)

      // Visit dependencies first
      step.dependencies.forEach(depId => {
        const depStep = steps.find(s => s.id === depId)
        if (depStep) visit(depStep)
      })

      visiting.delete(step.id)
      visited.add(step.id)
      sorted.push(step)
    }

    steps.forEach(step => {
      if (!visited.has(step.id)) {
        visit(step)
      }
    })

    return sorted
  }

  /**
   * Initialize global middleware
   */
  private initializeMiddleware(): void {
    // Rate limiting middleware
    this.middleware.push({
      name: 'rate-limiting',
      priority: 95,
      execute: async (args, context, next) => {
        // Rate limiting logic would go here
        return next()
      }
    })

    // Authentication middleware
    this.middleware.push({
      name: 'authentication',
      priority: 90,
      execute: async (args, context, next) => {
        // Authentication logic would go here
        return next()
      }
    })

    // Metrics middleware
    this.middleware.push({
      name: 'metrics',
      priority: 10,
      execute: async (args, context, next) => {
        const start = Date.now()
        try {
          const result = await next()
          this.recordMetric('function_success', Date.now() - start)
          return result
        } catch (error) {
          this.recordMetric('function_error', Date.now() - start)
          throw error
        }
      }
    })
  }

  /**
   * Record metric (placeholder)
   */
  private recordMetric(metric: string, value: number): void {
    // In a real implementation, this would send metrics to a monitoring system
    console.debug(`📊 Metric: ${metric} = ${value}`)
  }

  /**
   * Generate unique plan ID
   */
  private generatePlanId(): string {
    return `plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Get registry instance
   */
  getRegistry(): FunctionRegistryService {
    return this.registry
  }

  /**
   * Get executor instance
   */
  getExecutor(): FunctionExecutorService {
    return this.executor
  }

  /**
   * Get active plans count
   */
  getActivePlansCount(): number {
    return this.activePlans.size
  }
} 