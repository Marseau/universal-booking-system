import express from 'express'
import crypto from 'crypto'
import WhatsAppService from '../services/whatsapp.service'
import { WhatsAppWebhookBody } from '../types/whatsapp.types'

const router = express.Router()
const whatsappService = new WhatsAppService()

/**
 * GET /api/whatsapp/webhook
 * Webhook verification for WhatsApp Business API
 */
router.get('/webhook', (req, res) => {
  try {
    const mode = req.query['hub.mode'] as string
    const token = req.query['hub.verify_token'] as string
    const challenge = req.query['hub.challenge'] as string

    console.log('WhatsApp webhook verification request:', { mode, token })

    const verificationResult = whatsappService.verifyWebhook(mode, token, challenge)

    if (verificationResult) {
      console.log('✅ WhatsApp webhook verified successfully')
      res.status(200).send(verificationResult)
    } else {
      console.log('❌ WhatsApp webhook verification failed')
      res.status(403).json({
        error: 'Webhook verification failed',
        message: 'Invalid verify token'
      })
    }
  } catch (error) {
    console.error('Error in webhook verification:', error)
    res.status(500).json({
      error: 'Webhook verification error',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

/**
 * POST /api/whatsapp/webhook  
 * Receive incoming WhatsApp messages
 */
router.post('/webhook', async (req, res) => {
  try {
    const body = req.body as WhatsAppWebhookBody
    const signature = req.headers['x-hub-signature-256'] as string

    console.log('Received WhatsApp webhook:', JSON.stringify(body, null, 2))

    // Verify webhook signature
    if (!verifyWebhookSignature(JSON.stringify(body), signature)) {
      console.log('❌ Invalid webhook signature')
      return res.status(403).json({
        error: 'Invalid signature',
        message: 'Webhook signature verification failed'
      })
    }

    // Process the webhook asynchronously
    // Don't await to respond quickly to WhatsApp
    whatsappService.processWebhook(body).catch(error => {
      console.error('Error processing WhatsApp webhook:', error)
    })

    // Always respond with 200 to acknowledge receipt
    return res.status(200).json({
      status: 'received',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error in webhook handler:', error)
    
    // Still respond with 200 to avoid WhatsApp retries
    return res.status(200).json({
      status: 'error',
      message: 'Webhook processing failed but acknowledged',
      timestamp: new Date().toISOString()
    })
  }
})

/**
 * POST /api/whatsapp/send
 * Send WhatsApp message (for testing/admin use)
 */
router.post('/send', async (req, res) => {
  try {
    const { to, message, type = 'text' } = req.body

    if (!to || !message) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['to', 'message']
      })
    }

    let success = false

    switch (type) {
      case 'text':
        success = await whatsappService.sendTextMessage(to, message)
        break
      case 'button':
        const { buttons, header, footer } = req.body
        success = await whatsappService.sendButtonMessage(
          to, message, buttons, header, footer
        )
        break
      case 'list':
        const { buttonText, sections, headerText, footerText } = req.body
        success = await whatsappService.sendListMessage(
          to, message, buttonText, sections, headerText, footerText
        )
        break
      default:
        return res.status(400).json({
          error: 'Invalid message type',
          supported_types: ['text', 'button', 'list']
        })
    }

    if (success) {
      return res.json({
        status: 'sent',
        to,
        message,
        type,
        timestamp: new Date().toISOString()
      })
    } else {
      return res.status(500).json({
        error: 'Failed to send message',
        to,
        message,
        type
      })
    }

  } catch (error) {
    console.error('Error sending WhatsApp message:', error)
    return res.status(500).json({
      error: 'Failed to send message',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

/**
 * GET /api/whatsapp/conversations/:phone
 * Get conversation history for a phone number
 */
router.get('/conversations/:phone', async (req, res) => {
  try {
    const { phone } = req.params
    const { limit = 50, offset = 0 } = req.query

    // This would typically require authentication/authorization
    // For now, it's open for testing

    const { data: conversations, error } = await require('../config/database').supabase
      .from('conversation_history')
      .select('*')
      .eq('phone_number', phone)
      .order('created_at', { ascending: true })
      .range(Number(offset), Number(offset) + Number(limit) - 1)

    if (error) throw error

    res.json({
      conversations,
      phone,
      pagination: {
        limit: Number(limit),
        offset: Number(offset),
        total: conversations?.length || 0
      }
    })

  } catch (error) {
    console.error('Error fetching conversations:', error)
    res.status(500).json({
      error: 'Failed to fetch conversations',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

/**
 * POST /api/whatsapp/test
 * Test endpoint for development
 */
router.post('/test', async (req, res) => {
  try {
    const { phone, message = '🧪 Esta é uma mensagem de teste do sistema!' } = req.body

    if (!phone) {
      return res.status(400).json({
        error: 'Phone number required',
        example: { phone: '5511999999999', message: 'Optional custom message' }
      })
    }

    const success = await whatsappService.sendTextMessage(phone, message)

    return res.json({
      status: success ? 'sent' : 'failed',
      phone,
      message,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV
    })

  } catch (error) {
    console.error('Error in test endpoint:', error)
    return res.status(500).json({
      error: 'Test failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

/**
 * GET /api/whatsapp/status
 * Check WhatsApp integration status
 */
router.get('/status', (req, res) => {
  const hasToken = !!process.env.WHATSAPP_TOKEN
  const hasPhoneId = !!process.env.WHATSAPP_PHONE_NUMBER_ID
  const hasVerifyToken = !!process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN

  res.json({
    status: 'WhatsApp Business API Integration',
    configuration: {
      access_token: hasToken ? '✅ Configured' : '❌ Missing',
      phone_number_id: hasPhoneId ? '✅ Configured' : '❌ Missing',
      webhook_verify_token: hasVerifyToken ? '✅ Configured' : '❌ Missing'
    },
    ready: hasToken && hasPhoneId && hasVerifyToken,
    webhook_url: `${req.protocol}://${req.get('host')}/api/whatsapp/webhook`,
    timestamp: new Date().toISOString()
  })
})

/**
 * Verify webhook signature
 */
function verifyWebhookSignature(payload: string, signature: string): boolean {
  if (!signature || !process.env.WHATSAPP_WEBHOOK_SECRET) {
    console.warn('Missing signature or webhook secret for verification')
    return true // Skip verification in development
  }

  try {
    const expectedSignature = crypto
      .createHmac('sha256', process.env.WHATSAPP_WEBHOOK_SECRET)
      .update(payload)
      .digest('hex')

    const receivedSignature = signature.replace('sha256=', '')
    
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(receivedSignature, 'hex')
    )
  } catch (error) {
    console.error('Error verifying webhook signature:', error)
    return false
  }
}

export default router
