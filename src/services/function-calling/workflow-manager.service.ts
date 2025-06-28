import { 
  ConversationContext, 
  FunctionCall, 
  FunctionResult, 
  Action,
  ActionType,
  AIResponse
} from '../../types/ai.types'
import { ActionDispatcherService, ExecutionResult } from './action-dispatcher.service'
import { FunctionRegistryService } from './function-registry.service'

export interface WorkflowDefinition {
  id: string
  name: string
  description: string
  trigger: WorkflowTrigger
  steps: WorkflowStep[]
  conditions: WorkflowCondition[]
  metadata: WorkflowMetadata
}

export interface WorkflowTrigger {
  type: 'intent' | 'function_result' | 'time' | 'event' | 'manual'
  pattern: string | RegExp
  conditions?: Record<string, any>
}

export interface WorkflowStep {
  id: string
  name: string
  type: 'function_call' | 'condition' | 'parallel' | 'sequential' | 'webhook' | 'notification'
  config: StepConfig
  dependencies: string[]
  onSuccess?: string // next step ID
  onFailure?: string // next step ID
  retryPolicy?: {
    maxRetries: number
    delayMs: number
  }
}

export interface StepConfig {
  functionName?: string
  arguments?: Record<string, any>
  condition?: string
  webhook?: {
    url: string
    method: string
    headers?: Record<string, string>
  }
  notification?: {
    type: 'whatsapp' | 'email' | 'sms'
    template: string
    recipients: string[]
  }
}

export interface WorkflowCondition {
  id: string
  expression: string
  description: string
}

export interface WorkflowMetadata {
  version: string
  author: string
  tags: string[]
  createdAt: Date
  updatedAt: Date
  isActive: boolean
}

export interface WorkflowExecution {
  id: string
  workflowId: string
  context: ConversationContext
  status: 'running' | 'completed' | 'failed' | 'paused' | 'cancelled'
  currentStep: string
  startTime: Date
  endTime?: Date
  steps: WorkflowStepExecution[]
  variables: Record<string, any>
  error?: string
}

export interface WorkflowStepExecution {
  stepId: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  startTime?: Date
  endTime?: Date
  result?: any
  error?: string
  retryCount: number
}

/**
 * Workflow Manager for coordinating complex business processes
 */
export class WorkflowManagerService {
  private dispatcher: ActionDispatcherService
  private registry: FunctionRegistryService
  private workflows: Map<string, WorkflowDefinition> = new Map()
  private executions: Map<string, WorkflowExecution> = new Map()

  constructor() {
    this.dispatcher = new ActionDispatcherService()
    this.registry = this.dispatcher.getRegistry()
    this.initializeDefaultWorkflows()
  }

  /**
   * Register a workflow
   */
  registerWorkflow(workflow: WorkflowDefinition): boolean {
    if (this.workflows.has(workflow.id)) {
      console.warn(`⚠️  Workflow ${workflow.id} already exists`)
      return false
    }

    // Validate workflow
    const validation = this.validateWorkflow(workflow)
    if (!validation.isValid) {
      console.error(`❌ Invalid workflow ${workflow.id}:`, validation.errors)
      return false
    }

    this.workflows.set(workflow.id, workflow)
    console.log(`✅ Registered workflow: ${workflow.id}`)
    return true
  }

  /**
   * Execute a workflow
   */
  async executeWorkflow(
    workflowId: string,
    context: ConversationContext,
    initialVariables: Record<string, any> = {}
  ): Promise<WorkflowExecution> {
    const workflow = this.workflows.get(workflowId)
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`)
    }

    if (!workflow.metadata.isActive) {
      throw new Error(`Workflow ${workflowId} is not active`)
    }

    const execution: WorkflowExecution = {
      id: this.generateExecutionId(),
      workflowId,
      context,
      status: 'running',
      currentStep: workflow.steps[0]?.id || '',
      startTime: new Date(),
      steps: workflow.steps.map(step => ({
        stepId: step.id,
        status: 'pending',
        retryCount: 0
      })),
      variables: { ...initialVariables }
    }

    this.executions.set(execution.id, execution)
    console.log(`🚀 Starting workflow execution: ${execution.id}`)

    try {
      await this.executeWorkflowSteps(execution, workflow)
      execution.status = 'completed'
      execution.endTime = new Date()
      console.log(`✅ Workflow execution completed: ${execution.id}`)
    } catch (error) {
      execution.status = 'failed'
      execution.endTime = new Date()
      execution.error = error instanceof Error ? error.message : 'Unknown error'
      console.error(`❌ Workflow execution failed: ${execution.id}`, error)
    }

    return execution
  }

  /**
   * Execute workflow steps
   */
  private async executeWorkflowSteps(
    execution: WorkflowExecution,
    workflow: WorkflowDefinition
  ): Promise<void> {
    const visited = new Set<string>()
    let currentStepId = workflow.steps[0]?.id

    while (currentStepId && !visited.has(currentStepId)) {
      visited.add(currentStepId)
      execution.currentStep = currentStepId

      const step = workflow.steps.find(s => s.id === currentStepId)
      if (!step) {
        throw new Error(`Step ${currentStepId} not found in workflow`)
      }

      const stepExecution = execution.steps.find(s => s.stepId === currentStepId)
      if (!stepExecution) {
        throw new Error(`Step execution ${currentStepId} not found`)
      }

      console.log(`🔧 Executing step: ${step.name} (${currentStepId})`)
      
      try {
        stepExecution.status = 'running'
        stepExecution.startTime = new Date()

        const result = await this.executeStep(step, execution)
        
        stepExecution.status = 'completed'
        stepExecution.endTime = new Date()
        stepExecution.result = result

        // Determine next step
        currentStepId = result.success ? step.onSuccess : step.onFailure
        
        // Update variables with step result
        if (result.data) {
          execution.variables = { ...execution.variables, ...result.data }
        }

      } catch (error) {
        stepExecution.status = 'failed'
        stepExecution.endTime = new Date()
        stepExecution.error = error instanceof Error ? error.message : 'Unknown error'

        // Check retry policy
        if (step.retryPolicy && stepExecution.retryCount < step.retryPolicy.maxRetries) {
          stepExecution.retryCount++
          stepExecution.status = 'pending'
          
          if (step.retryPolicy.delayMs > 0) {
            await this.sleep(step.retryPolicy.delayMs)
          }
          
          // Retry the same step
          visited.delete(currentStepId)
          continue
        }

        // No retry or max retries reached
        currentStepId = step.onFailure
        if (!currentStepId) {
          throw error // Re-throw if no failure path
        }
      }
    }
  }

  /**
   * Execute a single workflow step
   */
  private async executeStep(
    step: WorkflowStep,
    execution: WorkflowExecution
  ): Promise<{ success: boolean; data?: any; message?: string }> {
    switch (step.type) {
      case 'function_call':
        return this.executeFunctionCallStep(step, execution)
      
      case 'condition':
        return this.executeConditionStep(step, execution)
      
      case 'webhook':
        return this.executeWebhookStep(step, execution)
      
      case 'notification':
        return this.executeNotificationStep(step, execution)
      
      case 'parallel':
        return this.executeParallelStep(step, execution)
      
      case 'sequential':
        return this.executeSequentialStep(step, execution)
      
      default:
        throw new Error(`Unknown step type: ${step.type}`)
    }
  }

  /**
   * Execute function call step
   */
  private async executeFunctionCallStep(
    step: WorkflowStep,
    execution: WorkflowExecution
  ): Promise<{ success: boolean; data?: any; message?: string }> {
    if (!step.config.functionName) {
      throw new Error('Function name is required for function_call step')
    }

    const functionCall: FunctionCall = {
      name: step.config.functionName,
      arguments: JSON.stringify(this.resolveVariables(step.config.arguments || {}, execution.variables))
    }

    const result = await this.dispatcher.dispatch(functionCall, execution.context)
    
    return {
      success: result.success,
      data: result.data,
      message: result.message
    }
  }

  /**
   * Execute condition step
   */
  private async executeConditionStep(
    step: WorkflowStep,
    execution: WorkflowExecution
  ): Promise<{ success: boolean; data?: any; message?: string }> {
    if (!step.config.condition) {
      throw new Error('Condition is required for condition step')
    }

    // Simple condition evaluation (in production, use a proper expression engine)
    const conditionResult = this.evaluateCondition(step.config.condition, execution.variables)
    
    return {
      success: conditionResult,
      message: `Condition ${conditionResult ? 'passed' : 'failed'}: ${step.config.condition}`
    }
  }

  /**
   * Execute webhook step
   */
  private async executeWebhookStep(
    step: WorkflowStep,
    execution: WorkflowExecution
  ): Promise<{ success: boolean; data?: any; message?: string }> {
    if (!step.config.webhook) {
      throw new Error('Webhook config is required for webhook step')
    }

    try {
      const response = await fetch(step.config.webhook.url, {
        method: step.config.webhook.method || 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...step.config.webhook.headers
        },
        body: JSON.stringify(execution.variables)
      })

      const data = await response.json()
      
      return {
        success: response.ok,
        data,
        message: `Webhook ${response.ok ? 'succeeded' : 'failed'}: ${response.status}`
      }
    } catch (error) {
      return {
        success: false,
        message: `Webhook error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  /**
   * Execute notification step
   */
  private async executeNotificationStep(
    step: WorkflowStep,
    execution: WorkflowExecution
  ): Promise<{ success: boolean; data?: any; message?: string }> {
    if (!step.config.notification) {
      throw new Error('Notification config is required for notification step')
    }

    // This would integrate with actual notification services
    console.log(`📢 Sending ${step.config.notification.type} notification:`, {
      template: step.config.notification.template,
      recipients: step.config.notification.recipients,
      variables: execution.variables
    })

    return {
      success: true,
      message: 'Notification sent successfully'
    }
  }

  /**
   * Execute parallel step (placeholder)
   */
  private async executeParallelStep(
    step: WorkflowStep,
    execution: WorkflowExecution
  ): Promise<{ success: boolean; data?: any; message?: string }> {
    // Parallel execution logic would go here
    return {
      success: true,
      message: 'Parallel execution completed'
    }
  }

  /**
   * Execute sequential step (placeholder)
   */
  private async executeSequentialStep(
    step: WorkflowStep,
    execution: WorkflowExecution
  ): Promise<{ success: boolean; data?: any; message?: string }> {
    // Sequential execution logic would go here
    return {
      success: true,
      message: 'Sequential execution completed'
    }
  }

  /**
   * Resolve variables in step arguments
   */
  private resolveVariables(args: Record<string, any>, variables: Record<string, any>): Record<string, any> {
    const resolved: Record<string, any> = {}
    
    for (const [key, value] of Object.entries(args)) {
      if (typeof value === 'string' && value.startsWith('{{') && value.endsWith('}}')) {
        const varName = value.slice(2, -2).trim()
        resolved[key] = variables[varName] || value
      } else {
        resolved[key] = value
      }
    }
    
    return resolved
  }

  /**
   * Evaluate simple conditions
   */
  private evaluateCondition(condition: string, variables: Record<string, any>): boolean {
    // Simple condition evaluation - in production, use a proper expression engine
    try {
      // Replace variables in condition
      let evaluatedCondition = condition
      for (const [key, value] of Object.entries(variables)) {
        evaluatedCondition = evaluatedCondition.replace(
          new RegExp(`\\{\\{${key}\\}\\}`, 'g'), 
          JSON.stringify(value)
        )
      }
      
      // Basic evaluation (very limited, extend as needed)
      return eval(evaluatedCondition)
    } catch (error) {
      console.warn(`⚠️  Condition evaluation failed: ${condition}`, error)
      return false
    }
  }

  /**
   * Validate workflow definition
   */
  private validateWorkflow(workflow: WorkflowDefinition): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!workflow.id) errors.push('Workflow ID is required')
    if (!workflow.name) errors.push('Workflow name is required')
    if (!workflow.steps || workflow.steps.length === 0) errors.push('At least one step is required')

    // Validate step dependencies
    const stepIds = new Set(workflow.steps.map(s => s.id))
    for (const step of workflow.steps) {
      for (const depId of step.dependencies) {
        if (!stepIds.has(depId)) {
          errors.push(`Step ${step.id} depends on non-existent step: ${depId}`)
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * Initialize default workflows
   */
  private initializeDefaultWorkflows(): void {
    // Default booking workflow
    const bookingWorkflow: WorkflowDefinition = {
      id: 'booking_flow',
      name: 'Standard Booking Flow',
      description: 'Standard workflow for processing booking requests',
      trigger: {
        type: 'intent',
        pattern: 'booking_request'
      },
      steps: [
        {
          id: 'check_availability',
          name: 'Check Availability',
          type: 'function_call',
          config: {
            functionName: 'check_availability',
            arguments: {
              service_name: '{{service_name}}',
              date: '{{preferred_date}}',
              time: '{{preferred_time}}'
            }
          },
          dependencies: [],
          onSuccess: 'create_booking',
          onFailure: 'suggest_alternatives'
        },
        {
          id: 'create_booking',
          name: 'Create Booking',
          type: 'function_call',
          config: {
            functionName: 'book_service',
            arguments: {
              service_id: '{{service_id}}',
              date: '{{confirmed_date}}',
              time: '{{confirmed_time}}',
              client_name: '{{client_name}}',
              phone: '{{phone}}'
            }
          },
          dependencies: ['check_availability'],
          onSuccess: 'send_confirmation',
          onFailure: 'handle_booking_error'
        },
        {
          id: 'send_confirmation',
          name: 'Send Confirmation',
          type: 'notification',
          config: {
            notification: {
              type: 'whatsapp',
              template: 'booking_confirmation',
              recipients: ['{{phone}}']
            }
          },
          dependencies: ['create_booking'],
          onSuccess: undefined,
          onFailure: undefined
        }
      ],
      conditions: [],
      metadata: {
        version: '1.0.0',
        author: 'system',
        tags: ['booking', 'default'],
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true
      }
    }

    this.registerWorkflow(bookingWorkflow)
  }

  /**
   * Get workflow by ID
   */
  getWorkflow(workflowId: string): WorkflowDefinition | undefined {
    return this.workflows.get(workflowId)
  }

  /**
   * Get execution by ID
   */
  getExecution(executionId: string): WorkflowExecution | undefined {
    return this.executions.get(executionId)
  }

  /**
   * Get all workflows
   */
  getAllWorkflows(): WorkflowDefinition[] {
    return Array.from(this.workflows.values())
  }

  /**
   * Get all executions
   */
  getAllExecutions(): WorkflowExecution[] {
    return Array.from(this.executions.values())
  }

  /**
   * Generate execution ID
   */
  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
} 