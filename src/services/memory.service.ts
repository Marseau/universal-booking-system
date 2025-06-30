import { MemoryManager, MemoryStorage, ConversationContext } from '../types/ai.types'

export class MemoryService {
  private sessions: Map<string, MemoryManager> = new Map()
  private memoryTtl: number

  constructor(memoryTtl: number = 3600) {
    this.memoryTtl = memoryTtl * 1000 // Convert to milliseconds
  }

  /**
   * Get or create memory manager for a session
   */
  async getMemoryManager(sessionId: string): Promise<MemoryManager> {
    let manager = this.sessions.get(sessionId)
    
    if (!manager) {
      manager = new SessionMemoryManager(sessionId, this.memoryTtl)
      this.sessions.set(sessionId, manager)
    }

    return manager
  }

  /**
   * Clear expired sessions
   */
  clearExpiredSessions(): void {
    const now = Date.now()
    
    for (const [sessionId, manager] of this.sessions.entries()) {
      if (manager instanceof SessionMemoryManager && manager.isExpired(now)) {
        this.sessions.delete(sessionId)
      }
    }
  }

  /**
   * Get active session count
   */
  getActiveSessionCount(): number {
    return this.sessions.size
  }

  /**
   * Force clear all sessions
   */
  clearAllSessions(): void {
    this.sessions.clear()
  }

  /**
   * Legacy stats method for compatibility
   */
  getStats(): { totalSessions: number; activeSessions: number } {
    const now = Date.now()
    let activeSessions = 0
    
    for (const manager of this.sessions.values()) {
      if (manager instanceof SessionMemoryManager && !manager.isExpired(now)) {
        activeSessions++
      }
    }

    return {
      totalSessions: this.sessions.size,
      activeSessions
    }
  }
}

class SessionMemoryManager implements MemoryManager {
  private storage: MemoryStorage
  public sessionId: string
  public context: ConversationContext
  public shortTermMemory: Array<{ key: string, value: any, timestamp: Date }>
  public longTermMemory: Array<{ key: string, value: any, timestamp: Date }>
  public lastAccessed: Date
  private lastAccess: number
  private ttl: number

  constructor(sessionId: string, ttl: number) {
    this.sessionId = sessionId
    this.ttl = ttl
    this.lastAccess = Date.now()
    this.lastAccessed = new Date()
    this.shortTermMemory = []
    this.longTermMemory = []
    this.context = {} as ConversationContext
    this.storage = {
      shortTerm: new Map(),
      longTerm: new Map(),
      context: this.context
    }
  }

  /**
   * Store value in memory
   */
  async store(key: string, value: any, type: 'short' | 'long'): Promise<void> {
    this.updateLastAccess()
    
    const targetMap = type === 'short' ? this.storage.shortTerm : this.storage.longTerm
    const targetArray = type === 'short' ? this.shortTermMemory : this.longTermMemory
    const timestamp = new Date()
    
    // Add to storage map
    if (type === 'short') {
      targetMap.set(key, {
        value,
        timestamp: Date.now(),
        ttl: 1800000 // 30 minutes for short-term memory
      })
    } else {
      targetMap.set(key, { value, timestamp: Date.now() })
    }
    
    // Add to interface array
    const existingIndex = targetArray.findIndex(item => item.key === key)
    if (existingIndex >= 0) {
      targetArray[existingIndex] = { key, value, timestamp }
    } else {
      targetArray.push({ key, value, timestamp })
    }
  }

  /**
   * Retrieve value from memory
   */
  async retrieve(key: string, type: 'short' | 'long'): Promise<any> {
    this.updateLastAccess()
    
    const targetMap = type === 'short' ? this.storage.shortTerm : this.storage.longTerm
    const entry = targetMap.get(key)
    
    if (!entry) return null

    // Check if short-term memory has expired
    if (type === 'short' && entry.ttl) {
      const now = Date.now()
      if (now - entry.timestamp > entry.ttl) {
        targetMap.delete(key)
        return null
      }
    }

    return entry.value
  }

  /**
   * Clear memory by type
   */
  async clear(type: 'short' | 'long' | 'all'): Promise<void> {
    this.updateLastAccess()
    
    switch (type) {
      case 'short':
        this.storage.shortTerm.clear()
        break
      case 'long':
        this.storage.longTerm.clear()
        break
      case 'all':
        this.storage.shortTerm.clear()
        this.storage.longTerm.clear()
        this.storage.context = {} as ConversationContext
        break
    }
  }

  /**
   * Get current conversation context
   */
  getContext(): ConversationContext {
    this.updateLastAccess()
    return this.storage.context
  }

  /**
   * Update conversation context
   */
  async updateContext(updates: Partial<ConversationContext>): Promise<void> {
    this.updateLastAccess()
    this.storage.context = { ...this.storage.context, ...updates }
    
    // Store important context in long-term memory
    await this.store('last_context_update', {
      timestamp: Date.now(),
      updates: Object.keys(updates)
    }, 'long')
  }

  /**
   * Check if session has expired
   */
  isExpired(currentTime: number): boolean {
    return currentTime - this.lastAccess > this.ttl
  }

  /**
   * Update last access timestamp
   */
  private updateLastAccess(): void {
    this.lastAccess = Date.now()
    this.lastAccessed = new Date()
    // Clean expired entries periodically
    if (Math.random() < 0.1) { // 10% chance
      this.cleanExpiredShortTerm()
    }
  }

  /**
   * Clean expired short-term memory
   */
  private cleanExpiredShortTerm(): void {
    const now = Date.now()
    
    for (const [key, entry] of this.storage.shortTerm.entries()) {
      if (entry.ttl && now - entry.timestamp > entry.ttl) {
        this.storage.shortTerm.delete(key)
      }
    }
  }
} 