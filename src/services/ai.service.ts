import OpenAI from 'openai'
import { supabase } from '../config/database'
import { WhatsAppService } from './whatsapp.service'
import { ConversationContext, AIResponse, ProcessingResult } from '../types/ai.types'

export class AIService {
  private openai: OpenAI
  private whatsappService: WhatsAppService

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || ''
    })
    this.whatsappService = new WhatsAppService()
  }

  async processIncomingMessage(message: any, contacts: any[]): Promise<void> {
    try {
      console.log('🤖 Processing WhatsApp message with AI')
      
      // Simple response for now
      const response = `Olá! Recebi sua mensagem: "${message.text?.body || 'mensagem recebida'}". Em breve nosso sistema de IA estará totalmente funcional!`
      
      await this.whatsappService.sendTextMessage(message.from, response)
      
    } catch (error) {
      console.error('Error in AI processing:', error)
      // Send fallback message
      await this.whatsappService.sendTextMessage(
        message.from, 
        'Desculpe, estou com dificuldades técnicas. Tente novamente em alguns instantes.'
      )
    }
  }

  async healthCheck(): Promise<{ status: string; details: Record<string, any> }> {
    return {
      status: 'ok',
      details: {
        openai: !!process.env.OPENAI_API_KEY,
        whatsapp: true
      }
    }
  }
} 