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

    return this.sendMessage(message)
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

      // Route to AI agent for processing
      // This will be implemented in the AI service
      const aiService = new (await import('./ai.service')).AIService()
      await aiService.processIncomingMessage(message, contacts)

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
    userName: string
  ): Promise<void> {
    try {
      let messageContent = ''

      switch (message.type) {
        case 'text':
          messageContent = message.text?.body || ''
          break
        case 'button':
          messageContent = message.button?.text || ''
          break
        case 'interactive':
          if (message.interactive?.button_reply) {
            messageContent = message.interactive.button_reply.title
          } else if (message.interactive?.list_reply) {
            messageContent = message.interactive.list_reply.title
          }
          break
        default:
          messageContent = `[${message.type.toUpperCase()}]`
      }

      // TODO: Fix database schema compatibility
      console.log('Storing conversation message:', {
        phone: message.from,
        user: userName,
        content: messageContent,
        type: message.type
      })

    } catch (error) {
      console.error('Error storing conversation message:', error)
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
}

export default WhatsAppService
