import { supabaseAdmin } from '@/config/database'
import { logger } from '@/utils/logger'
import { WhatsAppMessage } from '@/types/whatsapp.types'

export interface ConversationMessage {
  id: string
  tenant_id: string
  user_id?: string
  phone_number: string
  user_name: string
  is_from_user: boolean
  message_type: string
  message_content: string
  content: string
  raw_message: any
  intent_detected?: string
  confidence_score?: number
  conversation_context?: any
  message_id?: string
  created_at: string
}

export interface ConversationSearchParams {
  phone_number?: string
  tenant_id?: string
  user_id?: string
  start_date?: string
  end_date?: string
  message_type?: string
  intent_detected?: string
  is_from_user?: boolean
  limit?: number
  offset?: number
}

export interface ConversationStats {
  total_messages: number
  total_conversations: number
  messages_by_type: Record<string, number>
  intents_detected: Record<string, number>
  average_messages_per_conversation: number
  most_active_hours: Record<string, number>
  retention_summary: {
    total_stored: number
    messages_last_30_days: number
    messages_last_60_days: number
    eligible_for_cleanup: number
  }
}

export class ConversationHistoryService {
  
  /**
   * Store a WhatsApp message in conversation history
   */
  async storeMessage(
    message: WhatsAppMessage,
    tenantId: string,
    userName: string,
    userId?: string,
    intentDetected?: string,
    confidenceScore?: number,
    conversationContext?: any
  ): Promise<void> {
    try {
      const messageContent = this.extractMessageContent(message)
      const displayContent = this.formatDisplayContent(message, messageContent)

      const conversationRecord = {
        tenant_id: tenantId,
        user_id: userId || null,
        phone_number: message.from,
        user_name: userName,
        is_from_user: true,
        message_type: message.type,
        message_content: messageContent,
        content: displayContent,
        raw_message: JSON.stringify(message) as any,
        intent_detected: intentDetected || null,
        confidence_score: confidenceScore || null,
        conversation_context: conversationContext || null,
        message_id: message.id,
        created_at: new Date().toISOString()
      }

      const { error } = await supabaseAdmin
        .from('conversation_history')
        .insert(conversationRecord)

      if (error) {
        logger.error('Error storing conversation message', { error, messageId: message.id })
        throw error
      }

      logger.info('Conversation message stored', { 
        messageId: message.id, 
        tenantId, 
        phone: message.from,
        type: message.type 
      })

    } catch (error) {
      logger.error('Failed to store conversation message', { error, messageId: message.id })
      throw error
    }
  }

  /**
   * Store system/bot response message
   */
  async storeSystemMessage(
    tenantId: string,
    phoneNumber: string,
    messageContent: string,
    messageType: string = 'text',
    conversationContext?: any,
    relatedMessageId?: string
  ): Promise<void> {
    try {
      const conversationRecord = {
        tenant_id: tenantId,
        user_id: null,
        phone_number: phoneNumber,
        user_name: 'Sistema UBS',
        is_from_user: false,
        message_type: messageType,
        message_content: messageContent,
        content: messageContent,
        raw_message: {
          type: messageType,
          content: messageContent,
          timestamp: Date.now(),
          system_generated: true
        },
        intent_detected: null,
        confidence_score: null,
        conversation_context: conversationContext || null,
        message_id: relatedMessageId || `system_${Date.now()}`,
        created_at: new Date().toISOString()
      }

      const { error } = await supabaseAdmin
        .from('conversation_history')
        .insert(conversationRecord)

      if (error) {
        logger.error('Error storing system message', { error, phoneNumber })
        throw error
      }

      logger.info('System message stored', { tenantId, phoneNumber, type: messageType })

    } catch (error) {
      logger.error('Failed to store system message', { error, phoneNumber })
      throw error
    }
  }

  /**
   * Retrieve conversation history by phone number
   */
  async getConversationByPhone(
    phoneNumber: string,
    tenantId: string,
    limit: number = 50,
    beforeDate?: string
  ): Promise<ConversationMessage[]> {
    try {
      let query = supabaseAdmin
        .from('conversation_history')
        .select('*')
        .eq('phone_number', phoneNumber)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (beforeDate) {
        query = query.lt('created_at', beforeDate)
      }

      const { data, error } = await query

      if (error) {
        logger.error('Error retrieving conversation history', { error, phoneNumber })
        throw error
      }

      return (data || []).reverse() // Return in chronological order

    } catch (error) {
      logger.error('Failed to retrieve conversation history', { error, phoneNumber })
      throw error
    }
  }

  /**
   * Search conversations with advanced filters
   */
  async searchConversations(params: ConversationSearchParams): Promise<{
    messages: ConversationMessage[]
    total: number
    hasMore: boolean
  }> {
    try {
      let query = supabaseAdmin
        .from('conversation_history')
        .select('*', { count: 'exact' })

      // Apply filters
      if (params.phone_number) {
        query = query.eq('phone_number', params.phone_number)
      }
      if (params.tenant_id) {
        query = query.eq('tenant_id', params.tenant_id)
      }
      if (params.user_id) {
        query = query.eq('user_id', params.user_id)
      }
      if (params.start_date) {
        query = query.gte('created_at', params.start_date)
      }
      if (params.end_date) {
        query = query.lte('created_at', params.end_date)
      }
      if (params.message_type) {
        query = query.eq('message_type', params.message_type)
      }
      if (params.intent_detected) {
        query = query.eq('intent_detected', params.intent_detected)
      }
      if (params.is_from_user !== undefined) {
        query = query.eq('is_from_user', params.is_from_user)
      }

      // Apply pagination
      const limit = params.limit || 50
      const offset = params.offset || 0
      
      query = query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      const { data, error, count } = await query

      if (error) {
        logger.error('Error searching conversations', { error, params })
        throw error
      }

      return {
        messages: data || [],
        total: count || 0,
        hasMore: (count || 0) > offset + limit
      }

    } catch (error) {
      logger.error('Failed to search conversations', { error, params })
      throw error
    }
  }

  /**
   * Get conversation summary for a phone number
   */
  async getConversationSummary(phoneNumber: string, tenantId: string): Promise<{
    total_messages: number
    first_interaction: string
    last_interaction: string
    message_types: Record<string, number>
    intents: Record<string, number>
    user_messages: number
    system_messages: number
  }> {
    try {
      const { data, error } = await supabaseAdmin
        .rpc('get_conversation_summary', {
          p_phone_number: phoneNumber,
          p_tenant_id: tenantId
        })

      if (error) {
        logger.error('Error getting conversation summary', { error, phoneNumber })
        throw error
      }

      return data || {
        total_messages: 0,
        first_interaction: '',
        last_interaction: '',
        message_types: {},
        intents: {},
        user_messages: 0,
        system_messages: 0
      }

    } catch (error) {
      logger.error('Failed to get conversation summary', { error, phoneNumber })
      throw error
    }
  }

  /**
   * Get conversations that need cleanup (older than retention period)
   */
  async getConversationsForCleanup(retentionDays: number = 60): Promise<{
    phone_numbers: string[]
    message_count: number
    oldest_date: string
    newest_date: string
  }> {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

      const { data, error } = await supabaseAdmin
        .rpc('get_conversations_for_cleanup', {
          p_cutoff_date: cutoffDate.toISOString()
        })

      if (error) {
        logger.error('Error getting conversations for cleanup', { error })
        throw error
      }

      return data || {
        phone_numbers: [],
        message_count: 0,
        oldest_date: '',
        newest_date: ''
      }

    } catch (error) {
      logger.error('Failed to get conversations for cleanup', { error })
      throw error
    }
  }

  /**
   * Clean up conversations older than retention period
   */
  async cleanupOldConversations(retentionDays: number = 60): Promise<{
    deleted_count: number
    deleted_conversations: number
    cleanup_date: string
  }> {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

      logger.info('Starting conversation cleanup', { 
        retentionDays, 
        cutoffDate: cutoffDate.toISOString() 
      })

      const { data, error } = await supabaseAdmin
        .rpc('cleanup_old_conversations', {
          p_cutoff_date: cutoffDate.toISOString()
        })

      if (error) {
        logger.error('Error cleaning up conversations', { error })
        throw error
      }

      const result = data || {
        deleted_count: 0,
        deleted_conversations: 0,
        cleanup_date: new Date().toISOString()
      }

      logger.info('Conversation cleanup completed', result)
      return result

    } catch (error) {
      logger.error('Failed to cleanup conversations', { error })
      throw error
    }
  }

  /**
   * Get conversation statistics for dashboard
   */
  async getConversationStats(
    tenantId?: string,
    startDate?: string,
    endDate?: string
  ): Promise<ConversationStats> {
    try {
      const { data, error } = await supabaseAdmin
        .rpc('get_conversation_stats', {
          p_tenant_id: tenantId || null,
          p_start_date: startDate || null,
          p_end_date: endDate || null
        })

      if (error) {
        logger.error('Error getting conversation stats', { error })
        throw error
      }

      return data || {
        total_messages: 0,
        total_conversations: 0,
        messages_by_type: {},
        intents_detected: {},
        average_messages_per_conversation: 0,
        most_active_hours: {},
        retention_summary: {
          total_stored: 0,
          messages_last_30_days: 0,
          messages_last_60_days: 0,
          eligible_for_cleanup: 0
        }
      }

    } catch (error) {
      logger.error('Failed to get conversation stats', { error })
      throw error
    }
  }

  /**
   * Export conversation history for compliance/audit
   */
  async exportConversationHistory(
    params: ConversationSearchParams & { format?: 'json' | 'csv' }
  ): Promise<{ data: any[], format: string, total: number }> {
    try {
      // Remove pagination for export
      const exportParams = { ...params, limit: undefined, offset: undefined }
      const { messages, total } = await this.searchConversations(exportParams)

      if (params.format === 'csv') {
        const csvData = messages.map(msg => ({
          timestamp: msg.created_at,
          phone_number: msg.phone_number,
          user_name: msg.user_name,
          direction: msg.is_from_user ? 'incoming' : 'outgoing',
          message_type: msg.message_type,
          content: msg.content,
          intent: msg.intent_detected || '',
          confidence: msg.confidence_score || ''
        }))

        return { data: csvData, format: 'csv', total }
      }

      return { data: messages, format: 'json', total }

    } catch (error) {
      logger.error('Failed to export conversation history', { error, params })
      throw error
    }
  }

  /**
   * Get recent conversation context for AI
   */
  async getRecentContext(
    phoneNumber: string,
    tenantId: string,
    messageLimit: number = 10
  ): Promise<Array<{ role: 'user' | 'assistant', content: string, timestamp: string }>> {
    try {
      const messages = await this.getConversationByPhone(phoneNumber, tenantId, messageLimit)
      
      return messages.map(msg => ({
        role: msg.is_from_user ? 'user' : 'assistant',
        content: msg.content,
        timestamp: msg.created_at
      }))

    } catch (error) {
      logger.error('Failed to get recent context', { error, phoneNumber })
      return []
    }
  }

  /**
   * Extract content from WhatsApp message
   */
  private extractMessageContent(message: WhatsAppMessage): string {
    switch (message.type) {
      case 'text':
        return message.text?.body || ''
      case 'image':
        return message.image?.caption || '[Imagem]'
      case 'audio':
        return '[Áudio]'
      case 'video':
        return message.video?.caption || '[Vídeo]'
      case 'document':
        return `[Documento: ${message.document?.filename || 'arquivo'}]`
      case 'location':
        return `[Localização: ${(message as any).location?.latitude || 'N/A'}, ${(message as any).location?.longitude || 'N/A'}]`
      case 'button':
        return message.button?.text || message.button?.payload || '[Botão]'
      case 'interactive':
        if (message.interactive?.button_reply) {
          return message.interactive.button_reply.title
        } else if (message.interactive?.list_reply) {
          return message.interactive.list_reply.title
        }
        return '[Interativo]'
      case 'contacts':
        return `[Contato: ${((message as any).contacts)?.[0]?.name?.formatted_name || 'contato'}]`
      default:
        return `[${message.type.toUpperCase()}]`
    }
  }

  /**
   * Format content for display
   */
  private formatDisplayContent(message: WhatsAppMessage, content: string): string {
    const timestamp = new Date().toLocaleString('pt-BR')
    const messageType = message.type.toUpperCase()
    
    if (content.length > 500) {
      content = content.substring(0, 500) + '...'
    }

    return content
  }

  /**
   * Schedule automatic cleanup
   */
  startAutomaticCleanup(retentionDays: number = 60, intervalHours: number = 24): void {
    const intervalMs = intervalHours * 60 * 60 * 1000

    setInterval(async () => {
      try {
        logger.info('Starting scheduled conversation cleanup')
        const result = await this.cleanupOldConversations(retentionDays)
        logger.info('Scheduled cleanup completed', result)
      } catch (error) {
        logger.error('Scheduled cleanup failed', { error })
      }
    }, intervalMs)

    logger.info('Automatic conversation cleanup scheduled', { 
      retentionDays, 
      intervalHours 
    })
  }
}

// Export singleton instance
export const conversationHistoryService = new ConversationHistoryService()