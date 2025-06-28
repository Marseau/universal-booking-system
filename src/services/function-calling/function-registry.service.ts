import { AIFunction, ConversationContext, FunctionResult } from '../../types/ai.types'
import { BusinessDomain } from '../../types/database.types'
import { AgentFactory } from '../agents/agent-factory'

export interface RegisteredFunction extends AIFunction {
  id: string
  domain: BusinessDomain | 'other'
  category: FunctionCategory
  metadata: FunctionMetadata
  middleware?: FunctionMiddleware[]
}

export interface FunctionMetadata {
  version: string
  author: string
  tags: string[]
  rateLimit?: {
    requests: number
    windowMs: number
  }
  permissions?: string[]
  deprecated?: boolean
  replacedBy?: string
}

export type FunctionCategory = 
  | 'booking' 
  | 'inquiry' 
  | 'consultation' 
  | 'recommendation' 
  | 'information' 
  | 'management'
  | 'utility'

export interface FunctionMiddleware {
  name: string
  priority: number
  execute: (args: any, context: ConversationContext, next: Function) => Promise<any>
}

/**
 * Central registry for all AI functions across all agents
 */
export class FunctionRegistryService {
  private functions: Map<string, RegisteredFunction> = new Map()
  private categories: Map<FunctionCategory, string[]> = new Map()
  private domains: Map<BusinessDomain | 'other', string[]> = new Map()
  private agentFactory: AgentFactory

  constructor() {
    this.agentFactory = new AgentFactory()
    this.initializeRegistry()
  }

  /**
   * Initialize function registry with all agent functions
   */
  private initializeRegistry(): void {
    console.log('🔧 Initializing Function Registry...')

    const allAgents = this.agentFactory.getAllAgents()
    
    allAgents.forEach((agent, domain) => {
      const domainFunctions: string[] = []
      
      agent.functions.forEach((func, index) => {
        const registeredFunction: RegisteredFunction = {
          ...func,
          id: `${domain}_${func.name}_${index}`,
          domain,
          category: this.categorizeFunction(func.name),
          metadata: this.generateMetadata(func, domain),
          middleware: this.getDefaultMiddleware(func.name)
        }

        this.functions.set(registeredFunction.id, registeredFunction)
        domainFunctions.push(registeredFunction.id)
        
        // Update category mapping
        const category = registeredFunction.category
        if (!this.categories.has(category)) {
          this.categories.set(category, [])
        }
        this.categories.get(category)!.push(registeredFunction.id)
      })

      this.domains.set(domain, domainFunctions)
    })

    console.log(`✅ Function Registry initialized with ${this.functions.size} functions`)
    this.logRegistryStats()
  }

  /**
   * Get function by ID
   */
  getFunction(functionId: string): RegisteredFunction | undefined {
    return this.functions.get(functionId)
  }

  /**
   * Get function by name and domain
   */
  getFunctionByName(name: string, domain?: BusinessDomain | 'other'): RegisteredFunction | undefined {
    if (domain) {
      const domainFunctions = this.domains.get(domain) || []
      for (const functionId of domainFunctions) {
        const func = this.functions.get(functionId)
        if (func && func.name === name) {
          return func
        }
      }
    } else {
      // Search across all domains
      for (const func of this.functions.values()) {
        if (func.name === name) {
          return func
        }
      }
    }
    return undefined
  }

  /**
   * Get all functions for a domain
   */
  getFunctionsByDomain(domain: BusinessDomain | 'other'): RegisteredFunction[] {
    const functionIds = this.domains.get(domain) || []
    return functionIds.map(id => this.functions.get(id)!).filter(Boolean)
  }

  /**
   * Get functions by category
   */
  getFunctionsByCategory(category: FunctionCategory): RegisteredFunction[] {
    const functionIds = this.categories.get(category) || []
    return functionIds.map(id => this.functions.get(id)!).filter(Boolean)
  }

  /**
   * Search functions by keyword
   */
  searchFunctions(query: string): RegisteredFunction[] {
    const results: RegisteredFunction[] = []
    const searchTerm = query.toLowerCase()

    for (const func of this.functions.values()) {
      if (
        func.name.toLowerCase().includes(searchTerm) ||
        func.description.toLowerCase().includes(searchTerm) ||
        func.metadata.tags.some(tag => tag.toLowerCase().includes(searchTerm))
      ) {
        results.push(func)
      }
    }

    return results.sort((a, b) => {
      // Prioritize exact matches
      const aExact = a.name.toLowerCase() === searchTerm
      const bExact = b.name.toLowerCase() === searchTerm
      if (aExact && !bExact) return -1
      if (!aExact && bExact) return 1
      return 0
    })
  }

  /**
   * Get available functions for context
   */
  getAvailableFunctions(context: ConversationContext): RegisteredFunction[] {
    const domain = context.tenantConfig?.domain || 'other'
    const functions = this.getFunctionsByDomain(domain)
    
    // Filter by permissions and status
    return functions.filter(func => {
      // Check if function is deprecated
      if (func.metadata.deprecated) return false
      
      // Check permissions if any
      if (func.metadata.permissions && func.metadata.permissions.length > 0) {
        // In a real implementation, check user permissions here
        return true // For now, allow all
      }
      
      return true
    })
  }

  /**
   * Register a new function
   */
  registerFunction(func: RegisteredFunction): boolean {
    if (this.functions.has(func.id)) {
      console.warn(`⚠️  Function ${func.id} already exists`)
      return false
    }

    this.functions.set(func.id, func)
    
    // Update category mapping
    if (!this.categories.has(func.category)) {
      this.categories.set(func.category, [])
    }
    this.categories.get(func.category)!.push(func.id)
    
    // Update domain mapping
    if (!this.domains.has(func.domain)) {
      this.domains.set(func.domain, [])
    }
    this.domains.get(func.domain)!.push(func.id)

    console.log(`✅ Registered function: ${func.id}`)
    return true
  }

  /**
   * Unregister a function
   */
  unregisterFunction(functionId: string): boolean {
    const func = this.functions.get(functionId)
    if (!func) return false

    this.functions.delete(functionId)
    
    // Remove from category mapping
    const categoryFunctions = this.categories.get(func.category)
    if (categoryFunctions) {
      const index = categoryFunctions.indexOf(functionId)
      if (index > -1) {
        categoryFunctions.splice(index, 1)
      }
    }
    
    // Remove from domain mapping
    const domainFunctions = this.domains.get(func.domain)
    if (domainFunctions) {
      const index = domainFunctions.indexOf(functionId)
      if (index > -1) {
        domainFunctions.splice(index, 1)
      }
    }

    console.log(`🗑️  Unregistered function: ${functionId}`)
    return true
  }

  /**
   * Get registry statistics
   */
  getStats(): RegistryStats {
    const stats: RegistryStats = {
      totalFunctions: this.functions.size,
      functionsByDomain: {},
      functionsByCategory: {},
      deprecatedFunctions: 0,
      activeMiddleware: 0
    }

    // Count by domain
    this.domains.forEach((functions, domain) => {
      stats.functionsByDomain[domain] = functions.length
    })

    // Count by category
    this.categories.forEach((functions, category) => {
      stats.functionsByCategory[category] = functions.length
    })

    // Count deprecated
    for (const func of this.functions.values()) {
      if (func.metadata.deprecated) {
        stats.deprecatedFunctions++
      }
      if (func.middleware && func.middleware.length > 0) {
        stats.activeMiddleware += func.middleware.length
      }
    }

    return stats
  }

  /**
   * Categorize function based on name
   */
  private categorizeFunction(name: string): FunctionCategory {
    if (name.includes('book') || name.includes('schedule') || name.includes('appointment')) {
      return 'booking'
    }
    if (name.includes('check') || name.includes('availability') || name.includes('inquiry')) {
      return 'inquiry'
    }
    if (name.includes('consult') || name.includes('advice') || name.includes('assess')) {
      return 'consultation'
    }
    if (name.includes('suggest') || name.includes('recommend') || name.includes('tips')) {
      return 'recommendation'
    }
    if (name.includes('info') || name.includes('get') || name.includes('provide')) {
      return 'information'
    }
    if (name.includes('cancel') || name.includes('update') || name.includes('manage')) {
      return 'management'
    }
    return 'utility'
  }

  /**
   * Generate metadata for function
   */
  private generateMetadata(func: AIFunction, domain: BusinessDomain | 'other'): FunctionMetadata {
    return {
      version: '1.0.0',
      author: 'system',
      tags: [domain, this.categorizeFunction(func.name)],
      rateLimit: this.getDefaultRateLimit(func.name),
      permissions: [],
      deprecated: false
    }
  }

  /**
   * Get default rate limit for function
   */
  private getDefaultRateLimit(name: string): { requests: number; windowMs: number } {
    if (name.includes('book') || name.includes('schedule')) {
      return { requests: 5, windowMs: 60000 } // 5 bookings per minute
    }
    if (name.includes('check') || name.includes('availability')) {
      return { requests: 20, windowMs: 60000 } // 20 checks per minute
    }
    return { requests: 10, windowMs: 60000 } // Default 10 per minute
  }

  /**
   * Get default middleware for function
   */
  private getDefaultMiddleware(name: string): FunctionMiddleware[] {
    const middleware: FunctionMiddleware[] = []
    
    // Add logging middleware for all functions
    middleware.push({
      name: 'logging',
      priority: 100,
      execute: async (args, context, next) => {
        console.log(`🔧 Executing function: ${name}`)
        const start = Date.now()
        try {
          const result = await next()
          console.log(`✅ Function ${name} completed in ${Date.now() - start}ms`)
          return result
        } catch (error) {
          console.error(`❌ Function ${name} failed after ${Date.now() - start}ms:`, error)
          throw error
        }
      }
    })

    // Add validation middleware for booking functions
    if (name.includes('book') || name.includes('schedule')) {
      middleware.push({
        name: 'booking-validation',
        priority: 90,
        execute: async (args, context, next) => {
          if (!args.date || !args.time) {
            throw new Error('Date and time are required for booking functions')
          }
          return next()
        }
      })
    }

    return middleware
  }

  /**
   * Log registry statistics
   */
  private logRegistryStats(): void {
    const stats = this.getStats()
    console.log('📊 Function Registry Stats:')
    console.log(`  Total Functions: ${stats.totalFunctions}`)
    console.log('  By Domain:', stats.functionsByDomain)
    console.log('  By Category:', stats.functionsByCategory)
    console.log(`  Deprecated: ${stats.deprecatedFunctions}`)
    console.log(`  Active Middleware: ${stats.activeMiddleware}`)
  }
}

export interface RegistryStats {
  totalFunctions: number
  functionsByDomain: Record<string, number>
  functionsByCategory: Record<string, number>
  deprecatedFunctions: number
  activeMiddleware: number
} 