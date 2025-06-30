import { supabaseAdmin } from '@/config/database'
import { logger } from '@/utils/logger'
import { WhatsAppService } from './whatsapp.service'
import { EmailService } from './email.service'
import { phoneValidationService } from './phone-validation.service'

export interface OnboardingStep {
  id: string
  name: string
  order: number
  message: string
  messageType: 'text' | 'interactive' | 'template'
  buttons?: Array<{ id: string, title: string }>
  expectedResponse?: 'text' | 'button' | 'list'
  validationRules?: string[]
  nextStep?: string
  skipCondition?: string
}

export interface OnboardingFlow {
  tenantId: string
  domain: string
  steps: OnboardingStep[]
  welcomeMessage: string
  completionMessage: string
}

export interface UserOnboardingState {
  userId: string
  tenantId: string
  currentStep: string
  stepData: Record<string, any>
  isCompleted: boolean
  startedAt: Date
  completedAt?: Date
}

export class OnboardingFlowService {
  private whatsappService: WhatsAppService
  private emailService: EmailService

  constructor() {
    this.whatsappService = new WhatsAppService()
    this.emailService = new EmailService()
  }

  /**
   * Start onboarding flow for a new user
   */
  async startOnboarding(
    phone: string, 
    tenantId: string, 
    userName?: string
  ): Promise<{ success: boolean, message: string }> {
    try {
      // Register user and check if needs onboarding
      const registration = await phoneValidationService.registerUserByPhone(
        phone, 
        tenantId, 
        userName
      )

      if (!registration.success) {
        return {
          success: false,
          message: registration.message
        }
      }

      if (!registration.needsOnboarding) {
        return {
          success: true,
          message: 'Usuário já passou pelo onboarding'
        }
      }

      // Get tenant and onboarding flow
      const { data: tenant, error: tenantError } = await supabaseAdmin
        .from('tenants')
        .select('business_name, business_domain, business_phone, business_address')
        .eq('id', tenantId)
        .single()

      if (tenantError) {
        logger.error('Error getting tenant for onboarding', { error: tenantError })
        throw tenantError
      }

      // Get or create onboarding flow for this domain
      const onboardingFlow = await this.getOnboardingFlow(tenantId, tenant.business_domain)
      
      // Create onboarding state
      await this.createOnboardingState(registration.userId!, tenantId)

      // Send welcome message
      const welcomeMessage = this.personalizeMessage(
        onboardingFlow.welcomeMessage,
        { businessName: tenant.business_name, userName: userName || 'Cliente' }
      )

      await this.whatsappService.sendTextMessage(phone, welcomeMessage)

      // Start first step
      await this.executeOnboardingStep(registration.userId!, tenantId, onboardingFlow.steps[0])

      logger.info('Onboarding started', { userId: registration.userId, tenantId, phone })

      return {
        success: true,
        message: 'Onboarding iniciado com sucesso'
      }

    } catch (error) {
      logger.error('Error starting onboarding', { error, phone, tenantId })
      return {
        success: false,
        message: 'Erro ao iniciar onboarding'
      }
    }
  }

  /**
   * Continue onboarding flow based on user response
   */
  async continueOnboarding(
    phone: string,
    tenantId: string,
    userResponse: string,
    responseType: 'text' | 'button' | 'list'
  ): Promise<{ success: boolean, isCompleted: boolean, message: string }> {
    try {
      // Get user and onboarding state
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('phone', phone)
        .single()

      if (!user) {
        return {
          success: false,
          isCompleted: false,
          message: 'Usuário não encontrado'
        }
      }

      const onboardingState = await this.getOnboardingState(user.id, tenantId)
      if (!onboardingState || onboardingState.isCompleted) {
        return {
          success: true,
          isCompleted: true,
          message: 'Onboarding já concluído'
        }
      }

      // Get onboarding flow
      const { data: tenant } = await supabaseAdmin
        .from('tenants')
        .select('business_domain')
        .eq('id', tenantId)
        .single()

      const onboardingFlow = await this.getOnboardingFlow(tenantId, tenant.business_domain)
      const currentStep = onboardingFlow.steps.find(s => s.id === onboardingState.currentStep)

      if (!currentStep) {
        logger.error('Current step not found', { currentStep: onboardingState.currentStep })
        return {
          success: false,
          isCompleted: false,
          message: 'Erro no fluxo de onboarding'
        }
      }

      // Validate response
      const isValidResponse = this.validateResponse(currentStep, userResponse, responseType)
      if (!isValidResponse) {
        await this.sendValidationError(phone, currentStep)
        return {
          success: false,
          isCompleted: false,
          message: 'Resposta inválida'
        }
      }

      // Store response
      await this.storeStepResponse(user.id, tenantId, currentStep.id, userResponse)

      // Get next step
      const nextStepId = currentStep.nextStep
      const nextStep = onboardingFlow.steps.find(s => s.id === nextStepId)

      if (!nextStep) {
        // Onboarding completed
        await this.completeOnboarding(user.id, tenantId, onboardingFlow)
        return {
          success: true,
          isCompleted: true,
          message: 'Onboarding concluído com sucesso'
        }
      }

      // Execute next step
      await this.updateOnboardingStep(user.id, tenantId, nextStep.id)
      await this.executeOnboardingStep(user.id, tenantId, nextStep)

      return {
        success: true,
        isCompleted: false,
        message: 'Próximo passo enviado'
      }

    } catch (error) {
      logger.error('Error continuing onboarding', { error, phone, tenantId })
      return {
        success: false,
        isCompleted: false,
        message: 'Erro ao continuar onboarding'
      }
    }
  }

  /**
   * Get onboarding flow for a specific domain
   */
  private async getOnboardingFlow(tenantId: string, domain: string): Promise<OnboardingFlow> {
    // In a real implementation, this would come from database
    // For now, return domain-specific flows

    const baseFlow: OnboardingFlow = {
      tenantId,
      domain,
      steps: [],
      welcomeMessage: '',
      completionMessage: ''
    }

    switch (domain) {
      case 'beauty':
        return {
          ...baseFlow,
          welcomeMessage: `Oi, linda! 💄✨ Seja muito bem-vinda ao {{businessName}}! 

Eu sou sua assistente virtual e vou te ajudar a conhecer nossos serviços e fazer seu primeiro agendamento!

Vamos começar? 😊`,
          steps: [
            {
              id: 'collect_name',
              name: 'Coletar Nome',
              order: 1,
              message: 'Para começar, me diga seu nome completo:',
              messageType: 'text',
              expectedResponse: 'text',
              validationRules: ['min_length:2'],
              nextStep: 'collect_preferences'
            },
            {
              id: 'collect_preferences',
              name: 'Coletar Preferências',
              order: 2,
              message: 'Perfeito, {{userName}}! 😊\n\nQue tipo de serviço você tem mais interesse?',
              messageType: 'interactive',
              buttons: [
                { id: 'cabelo', title: 'Cabelo' },
                { id: 'manicure', title: 'Manicure/Pedicure' },
                { id: 'estetica', title: 'Estética Facial' }
              ],
              expectedResponse: 'button',
              nextStep: 'collect_frequency'
            },
            {
              id: 'collect_frequency',
              name: 'Frequência de Visitas',
              order: 3,
              message: 'Ótima escolha! ✨\n\nCom que frequência você costuma cuidar da beleza?',
              messageType: 'interactive',
              buttons: [
                { id: 'semanal', title: 'Semanalmente' },
                { id: 'quinzenal', title: 'Quinzenalmente' },
                { id: 'mensal', title: 'Mensalmente' },
                { id: 'especial', title: 'Ocasiões especiais' }
              ],
              expectedResponse: 'button',
              nextStep: 'show_services'
            },
            {
              id: 'show_services',
              name: 'Apresentar Serviços',
              order: 4,
              message: `Perfeito! Agora que te conheço melhor, deixa eu te mostrar alguns dos nossos serviços:

💇‍♀️ **Cabelo**: Corte, escova, hidratação, coloração
💅 **Unhas**: Manicure, pedicure, nail art
✨ **Estética**: Limpeza de pele, design de sobrancelha

Quer agendar algo agora ou prefere conhecer mais sobre nossos serviços?`,
              messageType: 'interactive',
              buttons: [
                { id: 'agendar', title: 'Quero agendar!' },
                { id: 'conhecer', title: 'Conhecer mais' },
                { id: 'depois', title: 'Depois' }
              ],
              expectedResponse: 'button'
            }
          ],
          completionMessage: `Pronto, {{userName}}! 🎉

Agora você já conhece nosso salão e pode agendar seus serviços a qualquer momento.

Para agendar, é só mandar uma mensagem como:
"Quero agendar um corte de cabelo para sexta-feira"

Estamos aqui para te deixar ainda mais linda! 💄✨`
        }

      case 'healthcare':
        return {
          ...baseFlow,
          welcomeMessage: `Olá! 🌟 Seja muito bem-vindo(a) ao {{businessName}}.

Estou aqui para te acolher e ajudar no que precisar. 

Vamos começar conhecendo você melhor?`,
          steps: [
            {
              id: 'collect_name',
              name: 'Coletar Nome',
              order: 1,
              message: 'Me diga seu nome, por favor:',
              messageType: 'text',
              expectedResponse: 'text',
              nextStep: 'collect_type'
            },
            {
              id: 'collect_type',
              name: 'Tipo de Atendimento',
              order: 2,
              message: 'Que tipo de atendimento você está buscando?',
              messageType: 'interactive',
              buttons: [
                { id: 'terapia', title: 'Terapia Individual' },
                { id: 'consulta', title: 'Consulta Psicológica' },
                { id: 'orientacao', title: 'Orientação' }
              ],
              expectedResponse: 'button',
              nextStep: 'explain_process'
            },
            {
              id: 'explain_process',
              name: 'Explicar Processo',
              order: 3,
              message: `Entendo, {{userName}}. 

Nosso processo é acolhedor e confidencial. Todas as sessões são realizadas em ambiente seguro e profissional.

Você gostaria de agendar uma primeira conversa ou tem alguma dúvida sobre nossos serviços?`,
              messageType: 'interactive',
              buttons: [
                { id: 'agendar', title: 'Agendar conversa' },
                { id: 'duvidas', title: 'Tenho dúvidas' },
                { id: 'info', title: 'Mais informações' }
              ],
              expectedResponse: 'button'
            }
          ],
          completionMessage: `{{userName}}, foi um prazer te conhecer! 🌟

Estamos aqui para te apoiar em sua jornada de bem-estar e autoconhecimento.

Para agendar uma sessão, é só me mandar uma mensagem. Respondo rapidamente!

Lembre-se: cuidar da mente é um ato de amor próprio. 💙`
        }

      default:
        return {
          ...baseFlow,
          welcomeMessage: `Olá! Seja bem-vindo(a) ao {{businessName}}! 

Estou aqui para te ajudar. Vamos começar?`,
          steps: [
            {
              id: 'collect_name',
              name: 'Coletar Nome',
              order: 1,
              message: 'Para começar, qual seu nome?',
              messageType: 'text',
              expectedResponse: 'text',
              nextStep: 'show_services'
            },
            {
              id: 'show_services',
              name: 'Apresentar Serviços',
              order: 2,
              message: `Olá, {{userName}}! 

Oferecemos serviços de qualidade e estamos prontos para te atender.

Quer conhecer nossos serviços ou fazer um agendamento?`,
              messageType: 'interactive',
              buttons: [
                { id: 'servicos', title: 'Ver serviços' },
                { id: 'agendar', title: 'Agendar' },
                { id: 'info', title: 'Mais informações' }
              ],
              expectedResponse: 'button'
            }
          ],
          completionMessage: `Obrigado, {{userName}}! 

Agora você já conhece nossos serviços. Para agendar ou tirar dúvidas, é só mandar uma mensagem!

Estamos aqui para te atender! 😊`
        }
    }
  }

  /**
   * Execute a specific onboarding step
   */
  private async executeOnboardingStep(
    userId: string, 
    tenantId: string, 
    step: OnboardingStep
  ): Promise<void> {
    try {
      // Get user phone
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('phone, name')
        .eq('id', userId)
        .single()

      if (!user) return

      // Get stored data for personalization
      const stepData = await this.getStepData(userId, tenantId)
      
      // Personalize message
      const personalizedMessage = this.personalizeMessage(step.message, {
        userName: stepData.name || user.name || 'Cliente',
        ...stepData
      })

      // Send message based on type
      switch (step.messageType) {
        case 'text':
          await this.whatsappService.sendTextMessage(user.phone, personalizedMessage)
          break

        case 'interactive':
          if (step.buttons && step.buttons.length > 0) {
            await this.whatsappService.sendButtonMessage(
              user.phone,
              personalizedMessage,
              step.buttons
            )
          }
          break

        default:
          await this.whatsappService.sendTextMessage(user.phone, personalizedMessage)
      }

      logger.info('Onboarding step executed', { userId, tenantId, stepId: step.id })

    } catch (error) {
      logger.error('Error executing onboarding step', { error, userId, tenantId, step: step.id })
    }
  }

  /**
   * Validate user response for a step
   */
  private validateResponse(
    step: OnboardingStep, 
    response: string, 
    responseType: string
  ): boolean {
    // Check response type
    if (step.expectedResponse && step.expectedResponse !== responseType) {
      return false
    }

    // Check button responses
    if (responseType === 'button' && step.buttons) {
      return step.buttons.some(btn => btn.id === response)
    }

    // Check text validation rules
    if (responseType === 'text' && step.validationRules) {
      for (const rule of step.validationRules) {
        if (rule.startsWith('min_length:')) {
          const minLength = parseInt(rule.split(':')[1])
          if (response.length < minLength) {
            return false
          }
        }
      }
    }

    return true
  }

  /**
   * Send validation error message
   */
  private async sendValidationError(phone: string, step: OnboardingStep): Promise<void> {
    let errorMessage = 'Por favor, tente novamente.'

    if (step.expectedResponse === 'button') {
      errorMessage = 'Por favor, clique em uma das opções disponíveis.'
    } else if (step.validationRules?.includes('min_length:2')) {
      errorMessage = 'Por favor, digite um nome com pelo menos 2 caracteres.'
    }

    await this.whatsappService.sendTextMessage(phone, errorMessage)
  }

  /**
   * Personalize message with user data
   */
  private personalizeMessage(message: string, data: Record<string, any>): string {
    let personalizedMessage = message

    Object.keys(data).forEach(key => {
      const placeholder = `{{${key}}}`
      personalizedMessage = personalizedMessage.replace(
        new RegExp(placeholder, 'g'),
        data[key] || ''
      )
    })

    return personalizedMessage
  }

  // Database helper methods
  private async createOnboardingState(userId: string, tenantId: string): Promise<void> {
    await supabaseAdmin
      .from('user_onboarding_states')
      .upsert({
        user_id: userId,
        tenant_id: tenantId,
        current_step: 'collect_name',
        step_data: {},
        is_completed: false,
        started_at: new Date().toISOString()
      })
  }

  private async getOnboardingState(userId: string, tenantId: string): Promise<UserOnboardingState | null> {
    const { data } = await supabaseAdmin
      .from('user_onboarding_states')
      .select('*')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .single()

    return data as UserOnboardingState | null
  }

  private async updateOnboardingStep(userId: string, tenantId: string, stepId: string): Promise<void> {
    await supabaseAdmin
      .from('user_onboarding_states')
      .update({ current_step: stepId })
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
  }

  private async storeStepResponse(userId: string, tenantId: string, stepId: string, response: string): Promise<void> {
    const { data: currentState } = await supabaseAdmin
      .from('user_onboarding_states')
      .select('step_data')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .single()

    const stepData = currentState?.step_data || {}
    stepData[stepId] = response

    await supabaseAdmin
      .from('user_onboarding_states')
      .update({ step_data: stepData })
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
  }

  private async getStepData(userId: string, tenantId: string): Promise<Record<string, any>> {
    const { data } = await supabaseAdmin
      .from('user_onboarding_states')
      .select('step_data')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .single()

    return data?.step_data || {}
  }

  private async completeOnboarding(userId: string, tenantId: string, flow: OnboardingFlow): Promise<void> {
    // Mark onboarding as completed
    await supabaseAdmin
      .from('user_onboarding_states')
      .update({
        is_completed: true,
        completed_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)

    // Mark user as onboarded in user_tenants
    await phoneValidationService.markUserAsOnboarded(userId, tenantId)

    // Send completion message
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('phone, name')
      .eq('id', userId)
      .single()

    if (user) {
      const stepData = await this.getStepData(userId, tenantId)
      const completionMessage = this.personalizeMessage(flow.completionMessage, {
        userName: stepData.name || user.name || 'Cliente',
        ...stepData
      })

      await this.whatsappService.sendTextMessage(user.phone, completionMessage)

      // Send welcome email if available
      if (this.emailService.isReady()) {
        await this.emailService.sendWelcomeEmail(userId, tenantId)
      }
    }

    logger.info('Onboarding completed', { userId, tenantId })
  }
}

// Export singleton instance
export const onboardingFlowService = new OnboardingFlowService()