import { FunctionCall, FunctionResult, ConversationContext, AIFunction } from '../types/ai.types'
import { supabase } from '../config/database'

export class FunctionExecutorService {
  private executionHistory: Map<string, FunctionExecution[]> = new Map()
  private rateLimits: Map<string, RateLimit> = new Map()

  /**
   * Execute a function call with proper validation and error handling
   */
  async executeFunction(
    functionCall: FunctionCall,
    functionDef: AIFunction,
    context: ConversationContext
  ): Promise<FunctionResult> {
    const executionId = this.generateExecutionId()
    
    try {
      // Validate rate limits
      const rateLimitCheck = await this.checkRateLimit(functionDef.name, context.userId)
      if (!rateLimitCheck.allowed) {
        return {
          success: false,
          message: `Rate limit exceeded. Try again in ${rateLimitCheck.resetIn} seconds.`,
          shouldContinue: true
        }
      }

      // Validate function parameters
      const validationResult = await this.validateParameters(functionCall, functionDef)
      if (!validationResult.isValid) {
        return {
          success: false,
          message: `Invalid parameters: ${validationResult.errors.join(', ')}`,
          shouldContinue: true
        }
      }

      // Parse function arguments
      const args = JSON.parse(functionCall.arguments)
      
      // Log execution start
      const execution: FunctionExecution = {
        id: executionId,
        functionName: functionDef.name,
        arguments: args,
        context: context,
        startTime: Date.now(),
        status: 'executing'
      }
      
      this.addToExecutionHistory(context.sessionId, execution)

      // Execute the function
      const result = await functionDef.handler(args, context)
      
      // Log execution completion
      execution.endTime = Date.now()
      execution.status = result.success ? 'completed' : 'failed'
      execution.result = result
      execution.duration = execution.endTime - execution.startTime

      // Update rate limit
      await this.updateRateLimit(functionDef.name, context.userId)

      // Log to database for analytics
      await this.logFunctionExecution(execution)

      return result

    } catch (error) {
      console.error(`Function execution error for ${functionDef.name}:`, error)
      
      // Log execution error
      const execution = this.getExecutionById(context.sessionId, executionId)
      if (execution) {
        execution.endTime = Date.now()
        execution.status = 'error'
        execution.error = error instanceof Error ? error.message : 'Unknown error'
        execution.duration = execution.endTime! - execution.startTime
      }

      return {
        success: false,
        message: this.getErrorMessage(functionDef.name, error),
        shouldContinue: true
      }
    }
  }

  /**
   * Execute multiple functions in sequence
   */
  async executeFunctionChain(
    functionCalls: FunctionCall[],
    functions: AIFunction[],
    context: ConversationContext
  ): Promise<FunctionResult[]> {
    const results: FunctionResult[] = []

    for (const call of functionCalls) {
      const functionDef = functions.find(f => f.name === call.name)
      
      if (!functionDef) {
        results.push({
          success: false,
          message: `Function ${call.name} not found`,
          shouldContinue: true
        })
        continue
      }

      const result = await this.executeFunction(call, functionDef, context)
      results.push(result)

      // Stop execution if function failed and shouldn't continue
      if (!result.success && !result.shouldContinue) {
        break
      }
    }

    return results
  }

  /**
   * Validate function parameters against definition
   */
  private async validateParameters(
    functionCall: FunctionCall,
    functionDef: AIFunction
  ): Promise<ValidationResult> {
    const errors: string[] = []
    
    try {
      const args = JSON.parse(functionCall.arguments)
      
      // Check required parameters
      for (const param of functionDef.parameters) {
        if (param.required && !(param.name in args)) {
          errors.push(`Missing required parameter: ${param.name}`)
        }
        
        // Type validation
        if (param.name in args) {
          const value = args[param.name]
          const typeError = this.validateParameterType(value, param)
          if (typeError) {
            errors.push(typeError)
          }
        }
      }

      return {
        isValid: errors.length === 0,
        errors
      }

    } catch (error) {
      return {
        isValid: false,
        errors: ['Invalid JSON in function arguments']
      }
    }
  }

  /**
   * Validate parameter type
   */
  private validateParameterType(value: any, param: any): string | null {
    const actualType = Array.isArray(value) ? 'array' : typeof value
    
    if (actualType !== param.type) {
      return `Parameter ${param.name} expected ${param.type}, got ${actualType}`
    }

    // Enum validation
    if (param.enum && !param.enum.includes(value)) {
      return `Parameter ${param.name} must be one of: ${param.enum.join(', ')}`
    }

    return null
  }

  /**
   * Check rate limits for function execution
   */
  private async checkRateLimit(functionName: string, userId: string): Promise<RateLimitResult> {
    const key = `${functionName}:${userId}`
    const limit = this.rateLimits.get(key)
    const now = Date.now()

    // Define rate limits per function type
    const rateLimits: Record<string, { requests: number; windowMs: number }> = {
      'book_': { requests: 10, windowMs: 60000 }, // 10 bookings per minute
      'check_': { requests: 30, windowMs: 60000 }, // 30 checks per minute
      'calculate_': { requests: 20, windowMs: 60000 }, // 20 calculations per minute
      'default': { requests: 50, windowMs: 60000 } // 50 requests per minute default
    }

    // Determine rate limit for this function
    const limitConfig = Object.entries(rateLimits)
      .find(([prefix]) => functionName.startsWith(prefix))?.[1] || rateLimits.default

    if (!limit) {
      this.rateLimits.set(key, {
        requests: 1,
        windowStart: now,
        windowMs: limitConfig?.windowMs || 60000,
        maxRequests: limitConfig?.requests || 10
      })
      return { allowed: true }
    }

    // Reset window if expired
    if (now - limit.windowStart > limit.windowMs) {
      limit.requests = 1
      limit.windowStart = now
      return { allowed: true }
    }

    // Check if limit exceeded
    if (limit.requests >= limit.maxRequests) {
      const resetIn = Math.ceil((limit.windowStart + limit.windowMs - now) / 1000)
      return {
        allowed: false,
        resetIn
      }
    }

    return { allowed: true }
  }

  /**
   * Update rate limit counter
   */
  private async updateRateLimit(functionName: string, userId: string): Promise<void> {
    const key = `${functionName}:${userId}`
    const limit = this.rateLimits.get(key)
    
    if (limit) {
      limit.requests++
    }
  }

  /**
   * Generate unique execution ID
   */
  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Add execution to history
   */
  private addToExecutionHistory(sessionId: string, execution: FunctionExecution): void {
    const history = this.executionHistory.get(sessionId) || []
    history.push(execution)
    
    // Keep only last 50 executions per session
    if (history.length > 50) {
      history.splice(0, history.length - 50)
    }
    
    this.executionHistory.set(sessionId, history)
  }

  /**
   * Get execution by ID
   */
  private getExecutionById(sessionId: string, executionId: string): FunctionExecution | undefined {
    const history = this.executionHistory.get(sessionId) || []
    return history.find(exec => exec.id === executionId)
  }

  /**
   * Log function execution to database
   * TODO: Add function_executions table to database schema
   */
  private async logFunctionExecution(execution: FunctionExecution): Promise<void> {
    try {
      // TODO: Uncomment when function_executions table is available
      // await supabase
      //   .from('function_executions')
      //   .insert({
      //     execution_id: execution.id,
      //     session_id: execution.context.sessionId,
      //     user_id: execution.context.userId,
      //     tenant_id: execution.context.tenantId,
      //     function_name: execution.functionName,
      //     arguments: execution.arguments,
      //     status: execution.status,
      //     duration_ms: execution.duration,
      //     success: execution.status === 'completed',
      //     error_message: execution.error,
      //     result_data: execution.result?.data,
      //     executed_at: new Date(execution.startTime).toISOString()
      //   })
      
      // Log to console for now
      console.log('Function execution logged:', {
        id: execution.id,
        functionName: execution.functionName,
        status: execution.status,
        duration: execution.duration
      })
    } catch (error) {
      console.error('Failed to log function execution:', error)
    }
  }

  /**
   * Get user-friendly error message
   */
  private getErrorMessage(functionName: string, error: any): string {
    const errorMessages: Record<string, string> = {
      'book_': 'Erro ao realizar agendamento. Tente novamente ou entre em contato conosco.',
      'check_': 'Erro ao verificar informações. Tente novamente em alguns instantes.',
      'calculate_': 'Erro no cálculo. Verifique os dados fornecidos.',
      'assess_': 'Erro na avaliação. Tente novamente com informações atualizadas.',
      'get_': 'Erro ao buscar informações. Tente novamente.',
      'create_': 'Erro ao criar. Verifique os dados e tente novamente.',
      'track_': 'Erro no acompanhamento. Tente novamente.',
      'provide_': 'Erro ao fornecer informações. Entre em contato para suporte.',
      'handle_': 'Erro no processamento. Nossa equipe foi notificada.'
    }

    const errorMessage = Object.entries(errorMessages)
      .find(([prefix]) => functionName.startsWith(prefix))?.[1]

    return errorMessage || 'Erro temporário no sistema. Tente novamente ou entre em contato conosco.'
  }

  /**
   * Get execution statistics
   */
  getExecutionStats(sessionId?: string): ExecutionStats {
    if (sessionId) {
      const history = this.executionHistory.get(sessionId) || []
      return this.calculateStats(history)
    }

    // Global stats
    const allExecutions = Array.from(this.executionHistory.values()).flat()
    return this.calculateStats(allExecutions)
  }

  /**
   * Calculate statistics from executions
   */
  private calculateStats(executions: FunctionExecution[]): ExecutionStats {
    const total = executions.length
    const successful = executions.filter(e => e.status === 'completed').length
    const failed = executions.filter(e => e.status === 'failed').length
    const errors = executions.filter(e => e.status === 'error').length
    
    const durations = executions
      .filter(e => e.duration !== undefined)
      .map(e => e.duration!)
    
    const avgDuration = durations.length > 0 
      ? durations.reduce((sum, d) => sum + d, 0) / durations.length 
      : 0

    // Function usage counts
    const functionCounts: Record<string, number> = {}
    executions.forEach(e => {
      functionCounts[e.functionName] = (functionCounts[e.functionName] || 0) + 1
    })

    return {
      total,
      successful,
      failed,
      errors,
      successRate: total > 0 ? (successful / total) * 100 : 0,
      avgDuration: Math.round(avgDuration),
      functionUsage: functionCounts
    }
  }

  /**
   * Clear execution history for session
   */
  clearExecutionHistory(sessionId: string): void {
    this.executionHistory.delete(sessionId)
  }

  /**
   * Clear all rate limits (admin function)
   */
  clearRateLimits(): void {
    this.rateLimits.clear()
  }
}

// Types for function execution
interface FunctionExecution {
  id: string
  functionName: string
  arguments: any
  context: ConversationContext
  startTime: number
  endTime?: number
  duration?: number
  status: 'executing' | 'completed' | 'failed' | 'error'
  result?: FunctionResult
  error?: string
}

interface ValidationResult {
  isValid: boolean
  errors: string[]
}

interface RateLimit {
  requests: number
  windowStart: number
  windowMs: number
  maxRequests: number
}

interface RateLimitResult {
  allowed: boolean
  resetIn?: number
}

interface ExecutionStats {
  total: number
  successful: number
  failed: number
  errors: number
  successRate: number
  avgDuration: number
  functionUsage: Record<string, number>
}

export default FunctionExecutorService