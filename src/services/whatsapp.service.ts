import axios, { AxiosResponse } from 'axios'
import { 
  WhatsAppOutboundMessage, 
  WhatsAppWebhookBody,
  WhatsAppMessage,
  WhatsAppContact,
  ConversationState
} from '../types/whatsapp.types'
import { supabase } from '../config/database'

export class WhatsAppService {
  private accessToken: string
  private phoneNumberId: string
  private apiVersion: string = 'v18.0'
  private baseUrl: string

  constructor() {
    this.accessToken = process.env.WHATSAPP_TOKEN || ''
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || ''
    this.baseUrl = `https://graph.facebook.com/${this.apiVersion}`

    if (!this.accessToken || !this.phoneNumberId) {
      console.warn('WhatsApp credentials not configured')
    }
  }

  /**
   * Send message to WhatsApp user
   */
  async sendMessage(message: WhatsAppOutboundMessage): Promise<boolean> {
    try {
      const url = `${this.baseUrl}/${this.phoneNumberId}/messages`
      
      const response: AxiosResponse = await axios.post(url, message, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      })

      console.log('WhatsApp message sent:', response.data)
      return true
    } catch (error) {
      console.error('Error sending WhatsApp message:', error)
      return false
    }
  }

  /**
   * Send text message
   */
  async sendTextMessage(to: string, text: string, previewUrl: boolean = false): Promise<boolean> {
    const message: WhatsAppOutboundMessage = {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: {
        body: text,
        preview_url: previewUrl
      }
    }

    const success = await this.sendMessage(message)
    
    // Store system message in conversation history
    if (success) {
      await this.storeSystemMessage(to, text, 'text')
    }
    
    return success
  }

  /**
   * Send interactive button message
   */
  async sendButtonMessage(
    to: string, 
    bodyText: string, 
    buttons: Array<{ id: string, title: string }>,
    headerText?: string,
    footerText?: string
  ): Promise<boolean> {
    const message: WhatsAppOutboundMessage = {
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: {
          text: bodyText
        },
        action: {
          buttons: buttons.map(btn => ({
            type: 'reply',
            reply: {
              id: btn.id,
              title: btn.title
            }
          }))
        }
      }
    }

    if (headerText) {
      message.interactive!.header = {
        type: 'text',
        text: headerText
      }
    }

    if (footerText) {
      message.interactive!.footer = {
        text: footerText
      }
    }

    return this.sendMessage(message)
  }

  /**
   * Send interactive list message
   */
  async sendListMessage(
    to: string,
    bodyText: string,
    buttonText: string,
    sections: Array<{
      title: string
      rows: Array<{ id: string, title: string, description?: string }>
    }>,
    headerText?: string,
    footerText?: string
  ): Promise<boolean> {
    const message: WhatsAppOutboundMessage = {
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'list',
        body: {
          text: bodyText
        },
        action: {
          button: buttonText,
          sections: sections.map(section => ({
            title: section.title,
            rows: section.rows
          }))
        }
      }
    }

    if (headerText) {
      message.interactive!.header = {
        type: 'text',
        text: headerText
      }
    }

    if (footerText) {
      message.interactive!.footer = {
        text: footerText
      }
    }

    return this.sendMessage(message)
  }

  /**
   * Verify webhook token
   */
  verifyWebhook(mode: string, token: string, challenge: string): string | null {
    const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN

    if (mode === 'subscribe' && token === verifyToken) {
      console.log('Webhook verified successfully')
      return challenge
    }

    console.log('Webhook verification failed')
    return null
  }

  /**
   * Process incoming webhook
   */
  async processWebhook(body: WhatsAppWebhookBody): Promise<void> {
    try {
      console.log('Processing WhatsApp webhook:', JSON.stringify(body, null, 2))

      for (const entry of body.entry) {
        for (const change of entry.changes) {
          if (change.field === 'messages') {
            const value = change.value

            // Process incoming messages
            if (value.messages) {
              for (const message of value.messages) {
                await this.handleIncomingMessage(message, value.contacts || [])
              }
            }

            // Process message statuses
            if (value.statuses) {
              for (const status of value.statuses) {
                await this.handleMessageStatus(status)
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error processing WhatsApp webhook:', error)
      throw error
    }
  }

  /**
   * Handle incoming message
   */
  private async handleIncomingMessage(
    message: WhatsAppMessage, 
    contacts: WhatsAppContact[]
  ): Promise<void> {
    try {
      const contact = contacts.find(c => c.wa_id === message.from)
      const userName = contact?.profile?.name || 'Usuário'

      console.log(`New message from ${userName} (${message.from}):`, message)

      // Store conversation history
      await this.storeConversationMessage(message, userName)

      // Check if user needs onboarding (import here to avoid circular dependency)
      const { onboardingFlowService } = await import('./onboarding-flow.service')
      const { phoneValidationService } = await import('./phone-validation.service')
      
      // For now, we'll use a default tenant (in production, implement proper tenant resolution)
      const defaultTenantId = process.env.DEFAULT_TENANT_ID
      
      if (defaultTenantId) {
        // Check onboarding status
        const onboardingStatus = await phoneValidationService.getUserOnboardingStatus(
          message.from, 
          defaultTenantId
        )

        if (onboardingStatus.needsOnboarding) {
          // Start or continue onboarding
          if (!onboardingStatus.exists) {
            await onboardingFlowService.startOnboarding(
              message.from,
              defaultTenantId,
              userName
            )
            return // Don't process with AI during onboarding start
          } else {
            // Continue onboarding flow
            const messageText = this.extractMessageText(message)
            const responseType = this.detectResponseType(message)
            
            const onboardingResult = await onboardingFlowService.continueOnboarding(
              message.from,
              defaultTenantId,
              messageText,
              responseType
            )

            if (onboardingResult.success && !onboardingResult.isCompleted) {
              return // Don't process with AI if still in onboarding
            }
          }
        }
      }

      // Route to AI agent for processing (only after onboarding or for existing users)
      try {
        const aiService = new (await import('./ai.service')).AIService()
        await aiService.processIncomingMessage(message, contacts)
      } catch (aiError) {
        console.log('AI service not available, using basic response')
        await this.sendTextMessage(
          message.from,
          'Olá! Recebi sua mensagem. Em que posso ajudar você?'
        )
      }

    } catch (error) {
      console.error('Error handling incoming message:', error)
      
      // Send error message to user
      await this.sendTextMessage(
        message.from,
        'Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente em alguns instantes.'
      )
    }
  }

  /**
   * Handle message status updates
   */
  private async handleMessageStatus(status: any): Promise<void> {
    console.log('Message status update:', status)
    
    // Store status update in database if needed
    // This can be used for analytics and delivery confirmation
  }

  /**
   * Store conversation message in database
   */
  private async storeConversationMessage(
    message: WhatsAppMessage,
    userName: string,
    tenantId?: string,
    userId?: string,
    intentDetected?: string,
    confidenceScore?: number,
    conversationContext?: any
  ): Promise<void> {
    try {
      // Import here to avoid circular dependency
      const { conversationHistoryService } = await import('./conversation-history.service')
      
      // Use default tenant if not provided (in production, implement proper tenant resolution)
      const effectiveTenantId = tenantId || process.env.DEFAULT_TENANT_ID
      
      if (!effectiveTenantId) {
        console.warn('No tenant ID available for storing conversation')
        return
      }

      await conversationHistoryService.storeMessage(
        message,
        effectiveTenantId,
        userName,
        userId,
        intentDetected,
        confidenceScore,
        conversationContext
      )

    } catch (error) {
      console.error('Error storing conversation message:', error)
      // Don't throw error to avoid breaking message processing
    }
  }

  /**
   * Get or create conversation state
   */
  async getConversationState(phoneNumber: string): Promise<ConversationState | null> {
    try {
      // TODO: Fix database schema compatibility
      console.log('Getting conversation state for:', phoneNumber)
      return null
    } catch (error) {
      console.error('Error getting conversation state:', error)
      return null
    }
  }

  /**
   * Update conversation state
   */
  async updateConversationState(
    phoneNumber: string,
    step: string,
    context: Record<string, any>
  ): Promise<void> {
    try {
      // TODO: Fix database schema compatibility
      console.log('Updating conversation state:', {
        phone: phoneNumber,
        step,
        context
      })
    } catch (error) {
      console.error('Error updating conversation state:', error)
    }
  }

  /**
   * Get media URL from WhatsApp
   */
  async getMediaUrl(mediaId: string): Promise<string | null> {
    try {
      const url = `${this.baseUrl}/${mediaId}`
      
      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      })

      return response.data.url || null
    } catch (error) {
      console.error('Error getting media URL:', error)
      return null
    }
  }

  /**
   * Download media from WhatsApp
   */
  async downloadMedia(mediaUrl: string): Promise<Buffer | null> {
    try {
      const response = await axios.get(mediaUrl, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        },
        responseType: 'arraybuffer'
      })

      return Buffer.from(response.data)
    } catch (error) {
      console.error('Error downloading media:', error)
      return null
    }
  }

  /**
   * Send template message (for billing notifications)
   */
  async sendTemplateMessage(
    to: string,
    templateName: string,
    templateData: Record<string, string>
  ): Promise<boolean> {
    try {
      const message: WhatsAppOutboundMessage = {
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: templateName,
          language: {
            code: 'pt_BR'
          },
          components: [
            {
              type: 'body',
              parameters: Object.values(templateData).map(value => ({
                type: 'text',
                text: value
              }))
            }
          ]
        }
      }

      return this.sendMessage(message)
    } catch (error) {
      console.error('Error sending template message:', error)
      // Fallback to regular text message for billing alerts
      const fallbackMessage = this.buildFallbackBillingMessage(templateName, templateData)
      return this.sendTextMessage(to, fallbackMessage)
    }
  }

  /**
   * Build fallback message for billing alerts when templates are not available
   */
  private buildFallbackBillingMessage(templateName: string, data: Record<string, string>): string {
    const businessName = data.business_name || 'Sua empresa'
    const alertTitle = data.alert_title || 'Alerta de Assinatura'
    const alertMessage = data.alert_message || 'Verifique sua assinatura'
    const actionUrl = data.action_url || 'https://ubs.com/billing'

    const emoji = alertTitle.includes('🚨') ? '🚨' : 
                 alertTitle.includes('⚠️') ? '⚠️' : 'ℹ️'

    return `${emoji} *${alertTitle}*

Olá, ${businessName}!

${alertMessage}

✅ *Ação necessária:* Acesse seu painel de billing para resolver esta questão.

🔗 ${actionUrl}

---
_Mensagem automática do UBS_`
  }

  /**
   * Extract text content from WhatsApp message
   */
  private extractMessageText(message: WhatsAppMessage): string {
    switch (message.type) {
      case 'text':
        return message.text?.body || ''
      case 'button':
        return message.button?.payload || message.button?.text || ''
      case 'interactive':
        if (message.interactive?.button_reply) {
          return message.interactive.button_reply.id
        } else if (message.interactive?.list_reply) {
          return message.interactive.list_reply.id
        }
        return ''
      default:
        return `[${message.type.toUpperCase()}]`
    }
  }

  /**
   * Detect response type from WhatsApp message
   */
  private detectResponseType(message: WhatsAppMessage): 'text' | 'button' | 'list' {
    switch (message.type) {
      case 'text':
        return 'text'
      case 'button':
      case 'interactive':
        if (message.interactive?.button_reply) {
          return 'button'
        } else if (message.interactive?.list_reply) {
          return 'list'
        }
        return 'button'
      default:
        return 'text'
    }
  }

  /**
   * Store system message in conversation history
   */
  private async storeSystemMessage(
    phoneNumber: string,
    messageContent: string,
    messageType: string = 'text',
    conversationContext?: any
  ): Promise<void> {
    try {
      // Import here to avoid circular dependency
      const { conversationHistoryService } = await import('./conversation-history.service')
      
      const tenantId = process.env.DEFAULT_TENANT_ID
      if (!tenantId) {
        console.warn('No tenant ID available for storing system message')
        return
      }

      await conversationHistoryService.storeSystemMessage(
        tenantId,
        phoneNumber,
        messageContent,
        messageType,
        conversationContext
      )

    } catch (error) {
      console.error('Error storing system message:', error)
      // Don't throw error to avoid breaking message flow
    }
  }
}

export default WhatsAppService
