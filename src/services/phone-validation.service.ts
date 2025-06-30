import axios from 'axios'
import { supabaseAdmin } from '@/config/database'
import { logger } from '@/utils/logger'

export interface PhoneValidationResult {
  isValid: boolean
  hasWhatsApp: boolean
  formattedPhone: string
  country?: string
  carrier?: string
  errors?: string[]
}

export interface UserRegistrationResult {
  success: boolean
  userId?: string
  isNewUser: boolean
  needsOnboarding: boolean
  message: string
}

export class PhoneValidationService {
  
  /**
   * Validate phone number format and check if it has WhatsApp
   */
  async validatePhoneNumber(phone: string): Promise<PhoneValidationResult> {
    const result: PhoneValidationResult = {
      isValid: false,
      hasWhatsApp: false,
      formattedPhone: phone,
      errors: []
    }

    try {
      // Basic format validation
      const formatValidation = this.validatePhoneFormat(phone)
      if (!formatValidation.isValid) {
        result.errors = formatValidation.errors
        return result
      }

      result.formattedPhone = formatValidation.formattedPhone
      result.isValid = true

      // Check if number has WhatsApp (simplified check)
      result.hasWhatsApp = await this.checkWhatsAppAvailability(result.formattedPhone)
      
      logger.info('Phone validation completed', { 
        phone: result.formattedPhone, 
        hasWhatsApp: result.hasWhatsApp 
      })

      return result

    } catch (error) {
      logger.error('Error validating phone number', { error, phone })
      result.errors?.push('Erro interno na validação')
      return result
    }
  }

  /**
   * Validate phone format using regex patterns
   */
  private validatePhoneFormat(phone: string): { isValid: boolean, formattedPhone: string, errors: string[] } {
    const errors: string[] = []
    let formattedPhone = phone

    // Clean phone number (remove spaces, dashes, parentheses)
    formattedPhone = phone.replace(/[\s\-\(\)\.]/g, '')

    // Add + if missing and has country code
    if (!formattedPhone.startsWith('+') && formattedPhone.length > 10) {
      formattedPhone = '+' + formattedPhone
    }

    // Brazilian phone patterns
    const brazilPatterns = [
      /^\+55[1-9]{2}9[0-9]{8}$/, // +55 + area code + 9 + 8 digits (mobile)
      /^\+55[1-9]{2}[2-9][0-9]{7}$/, // +55 + area code + 7-8 digits (landline)
    ]

    // International pattern (basic)
    const internationalPattern = /^\+[1-9]\d{1,14}$/

    const isBrazilian = brazilPatterns.some(pattern => pattern.test(formattedPhone))
    const isInternational = internationalPattern.test(formattedPhone)

    if (!isBrazilian && !isInternational) {
      errors.push('Formato de telefone inválido')
      errors.push('Use o formato: +55 11 99999-9999 (Brasil) ou +código país número')
    }

    // Length validation
    if (formattedPhone.length < 8) {
      errors.push('Número muito curto')
    }

    if (formattedPhone.length > 17) {
      errors.push('Número muito longo')
    }

    return {
      isValid: errors.length === 0,
      formattedPhone,
      errors
    }
  }

  /**
   * Check if phone number has WhatsApp (simplified method)
   * In production, you might want to use WhatsApp Business API or third-party services
   */
  private async checkWhatsAppAvailability(phone: string): Promise<boolean> {
    try {
      // For development/testing, we'll assume most mobile numbers have WhatsApp
      // In production, implement actual WhatsApp number validation
      
      // Brazilian mobile numbers (9 in 3rd position) usually have WhatsApp
      if (phone.match(/^\+55[1-9]{2}9[0-9]{8}$/)) {
        return true
      }

      // For other patterns, assume 80% have WhatsApp (configurable)
      const whatsappProbability = parseFloat(process.env.WHATSAPP_AVAILABILITY_RATE || '0.8')
      return Math.random() < whatsappProbability

    } catch (error) {
      logger.error('Error checking WhatsApp availability', { error, phone })
      return false
    }
  }

  /**
   * Register or find user by phone number
   */
  async registerUserByPhone(
    phone: string, 
    tenantId: string, 
    name?: string,
    additionalData?: Record<string, any>
  ): Promise<UserRegistrationResult> {
    try {
      // Validate phone first
      const phoneValidation = await this.validatePhoneNumber(phone)
      if (!phoneValidation.isValid || !phoneValidation.hasWhatsApp) {
        return {
          success: false,
          isNewUser: false,
          needsOnboarding: false,
          message: `Telefone inválido: ${phoneValidation.errors?.join(', ')}`
        }
      }

      const formattedPhone = phoneValidation.formattedPhone

      // Check if user already exists
      const { data: existingUser, error: userError } = await supabaseAdmin
        .from('users')
        .select('id, name, phone')
        .eq('phone', formattedPhone)
        .single()

      if (userError && userError.code !== 'PGRST116') { // PGRST116 = no rows returned
        logger.error('Error checking existing user', { error: userError })
        throw userError
      }

      let userId: string
      let isNewUser = false

      if (existingUser) {
        userId = existingUser.id
        logger.info('Existing user found', { userId, phone: formattedPhone })
      } else {
        // Create new user
        const { data: newUser, error: createError } = await supabaseAdmin
          .from('users')
          .insert({
            phone: formattedPhone,
            name: name || `Usuário ${formattedPhone.slice(-4)}`,
            ...additionalData,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select('id')
          .single()

        if (createError) {
          logger.error('Error creating new user', { error: createError })
          throw createError
        }

        userId = newUser.id
        isNewUser = true
        logger.info('New user created', { userId, phone: formattedPhone })
      }

      // Check if user-tenant relationship exists
      const { data: existingRelation } = await supabaseAdmin
        .from('user_tenants')
        .select('id, is_onboarded')
        .eq('user_id', userId)
        .eq('tenant_id', tenantId)
        .single()

      let needsOnboarding = false

      if (!existingRelation) {
        // Create user-tenant relationship
        await supabaseAdmin
          .from('user_tenants')
          .insert({
            user_id: userId,
            tenant_id: tenantId,
            is_onboarded: false,
            relationship_type: 'customer',
            created_at: new Date().toISOString()
          })

        needsOnboarding = true
        logger.info('User-tenant relationship created', { userId, tenantId })
      } else {
        needsOnboarding = !existingRelation.is_onboarded
      }

      return {
        success: true,
        userId,
        isNewUser,
        needsOnboarding,
        message: isNewUser ? 'Usuário cadastrado com sucesso' : 'Usuário existente encontrado'
      }

    } catch (error) {
      logger.error('Error registering user by phone', { error, phone, tenantId })
      return {
        success: false,
        isNewUser: false,
        needsOnboarding: false,
        message: `Erro ao registrar usuário: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
      }
    }
  }

  /**
   * Mark user as onboarded for a specific tenant
   */
  async markUserAsOnboarded(userId: string, tenantId: string): Promise<boolean> {
    try {
      const { error } = await supabaseAdmin
        .from('user_tenants')
        .update({
          is_onboarded: true,
          onboarded_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('tenant_id', tenantId)

      if (error) {
        logger.error('Error marking user as onboarded', { error, userId, tenantId })
        return false
      }

      logger.info('User marked as onboarded', { userId, tenantId })
      return true

    } catch (error) {
      logger.error('Error in markUserAsOnboarded', { error, userId, tenantId })
      return false
    }
  }

  /**
   * Get user onboarding status for a tenant
   */
  async getUserOnboardingStatus(phone: string, tenantId: string): Promise<{
    exists: boolean
    needsOnboarding: boolean
    userId?: string
  }> {
    try {
      const { data: user, error: userError } = await supabaseAdmin
        .from('users')
        .select(`
          id,
          user_tenants!inner (
            is_onboarded,
            tenant_id
          )
        `)
        .eq('phone', phone)
        .eq('user_tenants.tenant_id', tenantId)
        .single()

      if (userError && userError.code !== 'PGRST116') {
        logger.error('Error getting user onboarding status', { error: userError })
        throw userError
      }

      if (!user) {
        return {
          exists: false,
          needsOnboarding: true
        }
      }

      return {
        exists: true,
        needsOnboarding: !user.user_tenants.is_onboarded,
        userId: user.id
      }

    } catch (error) {
      logger.error('Error in getUserOnboardingStatus', { error, phone, tenantId })
      return {
        exists: false,
        needsOnboarding: true
      }
    }
  }

  /**
   * Send verification code via WhatsApp (placeholder for future implementation)
   */
  async sendVerificationCode(phone: string): Promise<{ success: boolean, code?: string, message: string }> {
    try {
      // Generate random 6-digit code
      const code = Math.floor(100000 + Math.random() * 900000).toString()
      
      // In production, send actual WhatsApp message with code
      // For now, just log it (remove in production!)
      logger.info('Verification code generated', { phone, code })
      
      // Store code in database with expiration (implement table verification_codes)
      // await this.storeVerificationCode(phone, code)
      
      return {
        success: true,
        code: process.env.NODE_ENV === 'development' ? code : undefined,
        message: 'Código de verificação enviado via WhatsApp'
      }

    } catch (error) {
      logger.error('Error sending verification code', { error, phone })
      return {
        success: false,
        message: 'Erro ao enviar código de verificação'
      }
    }
  }

  /**
   * Verify phone number with code (placeholder for future implementation)
   */
  async verifyPhoneWithCode(phone: string, code: string): Promise<boolean> {
    try {
      // In production, verify against stored code
      // const isValid = await this.checkVerificationCode(phone, code)
      
      // For now, accept any 6-digit code in development
      if (process.env.NODE_ENV === 'development') {
        return code.length === 6 && /^\d+$/.test(code)
      }
      
      return false

    } catch (error) {
      logger.error('Error verifying phone code', { error, phone })
      return false
    }
  }
}

// Export singleton instance
export const phoneValidationService = new PhoneValidationService()