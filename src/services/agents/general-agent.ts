import { AIAgent, AIFunction, ConversationContext, FunctionResult } from '../../types/ai.types'
import { supabase } from '../../config/database'
import { 
  validateServiceDuration, 
  validateServicePrice, 
  validateAppointmentStatus, 
  getServiceConfigProperty,
  validateString,
  validateArray,
  validateDate,
  calculateEndTime 
} from '../../utils/validation-helpers'

export class GeneralAgent {
  private agent: AIAgent

  constructor() {
    this.agent = {
      id: 'general_agent',
      name: 'Agente Geral de Atendimento',
      domain: 'other',
      systemPrompt: this.buildSystemPrompt(),
      functions: this.buildFunctions(),
      capabilities: [
        'general_booking',
        'service_inquiry',
        'business_information',
        'appointment_management',
        'customer_support',
        'scheduling_assistance',
        'basic_consultation',
        'information_gathering'
      ],
      maxTokens: 2048,
      temperature: 0.8,
      model: 'gpt-4-turbo-preview'
    }
  }

  getAgent(): AIAgent {
    return this.agent
  }

  private buildSystemPrompt(): string {
    return `Você é um assistente virtual especializado em atendimento geral, trabalhando para diversos tipos de negócios e prestadores de serviços. Você é versátil e se adapta ao contexto de qualquer negócio.

FILOSOFIA DO ATENDIMENTO:
- Cada cliente é único e merece atenção personalizada
- Excelência no atendimento é a base de qualquer negócio bem-sucedido
- Seja sempre útil, cortês e eficiente
- Adapte-se ao tom e contexto do negócio
- Foque na satisfação e resolução das necessidades do cliente

SUAS RESPONSABILIDADES:
1. 📅 Agendar serviços e consultas diversas
2. ℹ️ Fornecer informações sobre o negócio
3. 🔍 Esclarecer dúvidas sobre serviços oferecidos
4. 📋 Coletar informações relevantes dos clientes
5. 🕐 Gerenciar disponibilidade e horários
6. 💰 Informar sobre preços e condições
7. 📞 Oferecer suporte e atendimento ao cliente
8. 🎯 Identificar necessidades específicas

TIPOS DE NEGÓCIOS QUE ATENDO:
🏪 **Comércio Local:** Lojas, boutiques, farmácias, mercados
🔧 **Serviços Técnicos:** Assistência técnica, manutenção, reparos
🏠 **Serviços Domésticos:** Limpeza, jardinagem, pintura, elétrica
🎨 **Serviços Criativos:** Design, fotografia, eventos, marketing
🚗 **Automotivo:** Oficinas, lava-jatos, estética automotiva
🏥 **Saúde e Bem-estar:** Clínicas, laboratórios, terapias alternativas
🎓 **Educação e Cursos:** Escolas técnicas, cursos livres, workshops
🍽️ **Alimentação:** Restaurantes, delivery, catering, confeitaria

TIPOS DE AGENDAMENTO:
- **Consulta inicial** (30-60 min): Primeiro contato e avaliação
- **Serviço padrão** (variável): Conforme especificidade do negócio
- **Manutenção** (variável): Serviços recorrentes
- **Emergência** (imediato): Situações urgentes
- **Orçamento** (30 min): Avaliação para cotação
- **Follow-up** (15-30 min): Acompanhamento pós-serviço

INFORMAÇÕES ESSENCIAIS:
📍 **Localização:** Endereço, pontos de referência, estacionamento
🕐 **Horários:** Funcionamento, disponibilidade, feriados
💰 **Preços:** Valores, formas de pagamento, descontos
📋 **Serviços:** Detalhes, duração, requisitos
👥 **Equipe:** Especialistas disponíveis, preferências
📞 **Contato:** Telefones, emails, redes sociais

ABORDAGEM PERSONALIZADA:
🎯 **Identifique o tipo de negócio:** Adapte linguagem e abordagem
🎨 **Mantenha o tom apropriado:** Formal para negócios corporativos, casual para serviços locais
📋 **Colete informações relevantes:** Contexto específico da necessidade
💡 **Ofereça soluções:** Sugestões úteis baseadas na situação
🤝 **Construa relacionamento:** Seja genuinamente interessado em ajudar

PERGUNTAS ESTRATÉGICAS:
1. "Como posso ajudá-lo(a) hoje?"
2. "É a primeira vez que nos procura?"
3. "Qual seria o prazo ideal para você?"
4. "Tem alguma preferência específica?"
5. "Gostaria de mais informações sobre nossos serviços?"
6. "Alguma dúvida sobre preços ou condições?"

SITUAÇÕES ESPECIAIS:
⚡ **Emergências:** Identifique urgência real e priorize atendimento
❓ **Dúvidas complexas:** Colete informações e encaminhe para especialista
💭 **Indecisos:** Forneça informações claras para tomada de decisão
😤 **Reclamações:** Ouça atentamente e busque soluções
🎁 **Oportunidades:** Identifique necessidades adicionais

LINGUAGEM E TOM:
- Seja sempre educado e profissional
- Use linguagem clara e acessível
- Adapte o nível de formalidade ao contexto
- Seja proativo em oferecer ajuda
- Mantenha energia positiva e prestativa
- Use emojis moderadamente para humanizar

INFORMAÇÕES DE NEGÓCIO:
- Sempre consulte as informações específicas do tenant
- Personalize respostas com dados do negócio
- Mantenha consistência com a marca e valores
- Respeite políticas e procedimentos específicos

ESCALONAMENTO:
👨‍💼 **Para especialista:** Quando questão requer conhecimento técnico específico
📞 **Para gerente:** Reclamações ou solicitações especiais
🏥 **Para emergência:** Situações de risco ou urgência real
💼 **Para vendas:** Oportunidades comerciais complexas

EXEMPLO DE ABORDAGEM:
"Olá! 😊 Muito prazer em atendê-lo(a)! Sou assistente virtual da [Nome do Negócio] e estou aqui para ajudar com tudo que precisar. Seja para agendar um serviço, esclarecer dúvidas ou qualquer outra necessidade. Como posso ser útil hoje?"

ADAPTAÇÃO CONTEXTUAL:
- Para negócios formais: "Bom dia! Como posso auxiliá-lo(a)?"
- Para negócios casuais: "Oi! Em que posso te ajudar?"
- Para emergências: "Entendi a urgência. Vamos resolver isso rapidamente."
- Para dúvidas: "Claro! Vou esclarecer tudo para você."

Sempre priorize a satisfação do cliente e a eficiência do atendimento!`
  }

  private buildFunctions(): AIFunction[] {
    return [
      {
        name: 'gather_client_information',
        description: 'Coletar informações básicas do cliente e suas necessidades',
        parameters: [
          {
            name: 'client_name',
            type: 'string',
            description: 'Nome do cliente',
            required: true
          },
          {
            name: 'contact_info',
            type: 'string',
            description: 'Informação de contato (telefone/email)',
            required: true
          },
          {
            name: 'service_interest',
            type: 'string',
            description: 'Serviço de interesse do cliente',
            required: true
          },
          {
            name: 'urgency_level',
            type: 'string',
            description: 'Nível de urgência da necessidade',
            required: true,
            enum: ['baixa', 'media', 'alta', 'emergencia']
          },
          {
            name: 'specific_requirements',
            type: 'string',
            description: 'Requisitos específicos do cliente',
            required: false
          },
          {
            name: 'budget_range',
            type: 'string',
            description: 'Faixa de orçamento, se mencionada',
            required: false
          },
          {
            name: 'preferred_timing',
            type: 'string',
            description: 'Horário de preferência',
            required: false
          },
          {
            name: 'is_returning_client',
            type: 'boolean',
            description: 'É cliente que já utilizou os serviços antes?',
            required: false
          }
        ],
        handler: this.gatherClientInformation.bind(this)
      },
      {
        name: 'check_service_availability',
        description: 'Verificar disponibilidade de serviços e horários',
        parameters: [
          {
            name: 'service_type',
            type: 'string',
            description: 'Tipo de serviço solicitado',
            required: true
          },
          {
            name: 'preferred_date',
            type: 'string',
            description: 'Data preferida (YYYY-MM-DD)',
            required: false
          },
          {
            name: 'preferred_time',
            type: 'string',
            description: 'Horário preferido (HH:mm)',
            required: false
          },
          {
            name: 'flexibility',
            type: 'string',
            description: 'Flexibilidade de horário',
            required: false,
            enum: ['muito_flexivel', 'moderadamente_flexivel', 'pouco_flexivel', 'horario_fixo']
          },
          {
            name: 'service_duration',
            type: 'number',
            description: 'Duração estimada do serviço em minutos',
            required: false
          }
        ],
        handler: this.checkServiceAvailability.bind(this)
      },
      {
        name: 'book_general_appointment',
        description: 'Agendar appointment geral para qualquer tipo de serviço',
        parameters: [
          {
            name: 'service_type',
            type: 'string',
            description: 'Tipo de serviço a ser agendado',
            required: true
          },
          {
            name: 'client_name',
            type: 'string',
            description: 'Nome do cliente',
            required: true
          },
          {
            name: 'contact_info',
            type: 'string',
            description: 'Contato do cliente',
            required: true
          },
          {
            name: 'date',
            type: 'string',
            description: 'Data do agendamento (YYYY-MM-DD)',
            required: true
          },
          {
            name: 'time',
            type: 'string',
            description: 'Horário do agendamento (HH:mm)',
            required: true
          },
          {
            name: 'service_details',
            type: 'string',
            description: 'Detalhes específicos do serviço',
            required: true
          },
          {
            name: 'special_requests',
            type: 'string',
            description: 'Solicitações especiais ou observações',
            required: false
          },
          {
            name: 'is_first_time',
            type: 'boolean',
            description: 'É a primeira vez do cliente?',
            required: false
          }
        ],
        handler: this.bookGeneralAppointment.bind(this)
      },
      {
        name: 'provide_business_information',
        description: 'Fornecer informações sobre o negócio e serviços',
        parameters: [
          {
            name: 'information_type',
            type: 'string',
            description: 'Tipo de informação solicitada',
            required: true,
            enum: ['services', 'pricing', 'location', 'hours', 'contact', 'policies', 'team', 'general']
          },
          {
            name: 'specific_service',
            type: 'string',
            description: 'Serviço específico sobre o qual quer informação',
            required: false
          }
        ],
        handler: this.provideBusinessInformation.bind(this)
      },
      {
        name: 'calculate_service_pricing',
        description: 'Calcular preços de serviços baseado em parâmetros',
        parameters: [
          {
            name: 'service_type',
            type: 'string',
            description: 'Tipo de serviço para cotação',
            required: true
          },
          {
            name: 'service_complexity',
            type: 'string',
            description: 'Complexidade do serviço',
            required: false,
            enum: ['simples', 'medio', 'complexo', 'personalizado']
          },
          {
            name: 'duration_estimate',
            type: 'number',
            description: 'Duração estimada em horas',
            required: false
          },
          {
            name: 'additional_services',
            type: 'array',
            description: 'Serviços adicionais solicitados',
            required: false
          },
          {
            name: 'client_type',
            type: 'string',
            description: 'Tipo de cliente',
            required: false,
            enum: ['novo', 'recorrente', 'vip', 'corporativo']
          }
        ],
        handler: this.calculateServicePricing.bind(this)
      },
      {
        name: 'handle_customer_inquiry',
        description: 'Lidar com dúvidas e solicitações gerais de clientes',
        parameters: [
          {
            name: 'inquiry_type',
            type: 'string',
            description: 'Tipo de dúvida ou solicitação',
            required: true,
            enum: ['service_question', 'pricing_question', 'scheduling_issue', 'complaint', 'compliment', 'suggestion', 'technical_support', 'other']
          },
          {
            name: 'inquiry_details',
            type: 'string',
            description: 'Detalhes da dúvida ou solicitação',
            required: true
          },
          {
            name: 'client_context',
            type: 'string',
            description: 'Contexto do cliente (novo, existente, etc.)',
            required: false
          },
          {
            name: 'urgency',
            type: 'string',
            description: 'Urgência da solicitação',
            required: false,
            enum: ['baixa', 'media', 'alta']
          }
        ],
        handler: this.handleCustomerInquiry.bind(this)
      }
    ]
  }

  private async gatherClientInformation(
    args: {
      client_name: string
      contact_info: string
      service_interest: string
      urgency_level: string
      specific_requirements?: string
      budget_range?: string
      preferred_timing?: string
      is_returning_client?: boolean
    },
    context: ConversationContext
  ): Promise<FunctionResult> {
    try {
      // Store client information
      const clientProfile = {
        name: args.client_name,
        contact: args.contact_info,
        service_interest: args.service_interest,
        urgency_level: args.urgency_level,
        specific_requirements: args.specific_requirements,
        budget_range: args.budget_range,
        preferred_timing: args.preferred_timing,
        is_returning_client: args.is_returning_client || false,
        collected_at: new Date().toISOString(),
        tenant_id: context.tenantId
      }

      // Determine next steps based on urgency and service type
      const nextSteps = []
      
      if (args.urgency_level === 'emergencia') {
        nextSteps.push('🚨 Atendimento emergencial - Prioridade máxima')
        nextSteps.push('📞 Contato direto em até 15 minutos')
      } else if (args.urgency_level === 'alta') {
        nextSteps.push('⚡ Alta prioridade - Retorno em até 2 horas')
        nextSteps.push('📅 Agendamento prioritário disponível')
      } else {
        nextSteps.push('📅 Verificar disponibilidade de agenda')
        nextSteps.push('💬 Retorno em até 24 horas')
      }

      // Generate personalized response based on business context
      const businessName = context.tenantConfig?.businessName || 'nossa empresa'
      const recommendations = this.generateRecommendations(args.service_interest, args.budget_range)

      return {
        success: true,
        data: {
          client_profile: clientProfile,
          next_steps: nextSteps,
          recommendations: recommendations,
          follow_up_required: args.urgency_level !== 'baixa'
        },
        message: `📋 **Informações Coletadas com Sucesso!**\n\n👤 **Cliente:** ${args.client_name}\n📞 **Contato:** ${args.contact_info}\n🎯 **Interesse:** ${args.service_interest}\n⚡ **Urgência:** ${args.urgency_level}\n\n${args.specific_requirements ? `📝 **Requisitos:** ${args.specific_requirements}\n` : ''}${args.budget_range ? `💰 **Orçamento:** ${args.budget_range}\n` : ''}${args.preferred_timing ? `🕐 **Horário preferido:** ${args.preferred_timing}\n` : ''}\n🏢 **Status:** ${args.is_returning_client ? 'Cliente retornante' : 'Novo cliente'}\n\n🚀 **Próximos Passos:**\n${nextSteps.map(step => `${step}`).join('\n')}\n\n💡 **Recomendações Personalizadas:**\n${recommendations.map(rec => `• ${rec}`).join('\n')}\n\nObrigado por escolher ${businessName}! Vamos cuidar de tudo para você! 😊`,
        shouldContinue: true
      }

    } catch (error) {
      return {
        success: false,
        message: `Erro ao coletar informações: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        shouldContinue: true
      }
    }
  }

  private async checkServiceAvailability(
    args: {
      service_type: string
      preferred_date?: string
      preferred_time?: string
      flexibility?: string
      service_duration?: number
    },
    context: ConversationContext
  ): Promise<FunctionResult> {
    try {
      // Generate availability slots
      const today = new Date()
      const availableSlots = []

      // Generate next 14 days of availability
      for (let i = 1; i <= 14; i++) {
        const date = new Date(today)
        date.setDate(today.getDate() + i)
        const dateStr = date.toISOString().split('T')[0]

        // Skip Sundays for most businesses
        if (date.getDay() === 0) continue

        // Generate time slots based on business type
        const timeSlots = this.generateTimeSlots(date, context.tenantConfig?.businessHours)
        
        for (const time of timeSlots) {
          availableSlots.push({
            date: dateStr,
            time,
            day_of_week: date.toLocaleDateString('pt-BR', { weekday: 'long' }),
            duration: args.service_duration || 60
          })
        }
      }

      // Filter by preferred date/time if specified
      let filteredSlots = availableSlots
      if (args.preferred_date) {
        filteredSlots = availableSlots.filter(slot => slot.date === args.preferred_date)
      }
      if (args.preferred_time) {
        const preferredHour = parseInt((args.preferred_time || '12:00').split(':')[0])
        filteredSlots = filteredSlots.filter(slot => {
          const slotHour = parseInt((slot.time || '12:00').split(':')[0])
          return Math.abs(slotHour - preferredHour) <= 2
        })
      }

      // Flexibility suggestions
      const flexibilitySuggestions = this.generateFlexibilitySuggestions(
        args.flexibility,
        filteredSlots,
        args.service_type
      )

      // Service-specific information
      const serviceInfo = this.getServiceInfo(args.service_type, context.tenantConfig)

      return {
        success: true,
        data: {
          available_slots: filteredSlots.slice(0, 20), // Return first 20 slots
          service_type: args.service_type,
          total_availability: availableSlots.length,
          filtered_availability: filteredSlots.length,
          service_info: serviceInfo,
          flexibility_suggestions: flexibilitySuggestions
        },
        message: `📅 **Disponibilidade para ${args.service_type}**\n\n✅ **${filteredSlots.length} horários disponíveis**${args.preferred_date ? ` para ${new Date(args.preferred_date || new Date()).toLocaleDateString('pt-BR')}` : ' nos próximos 14 dias'}\n\n⏱️ **Informações do Serviço:**\n• Duração: ${args.service_duration || serviceInfo.default_duration} minutos\n• Tipo: ${serviceInfo.category}\n• Preparação necessária: ${serviceInfo.preparation_time} minutos\n\n📋 **Próximos Horários Disponíveis:**\n${filteredSlots.slice(0, 8).map(slot => `• ${new Date(slot.date).toLocaleDateString('pt-BR')} (${slot.day_of_week}) às ${slot.time}`).join('\n')}\n\n💡 **Sugestões de Flexibilidade:**\n${flexibilitySuggestions.map(suggestion => `• ${suggestion}`).join('\n')}\n\nQual horário funciona melhor para você? 😊`,
        shouldContinue: true
      }

    } catch (error) {
      return {
        success: false,
        message: `Erro ao verificar disponibilidade: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        shouldContinue: true
      }
    }
  }

  private async bookGeneralAppointment(
    args: {
      service_type: string
      client_name: string
      contact_info: string
      date: string
      time: string
      service_details: string
      special_requests?: string
      is_first_time?: boolean
    },
    context: ConversationContext
  ): Promise<FunctionResult> {
    try {
      // Find a general service or create default
      const { data: services, error: servicesError } = await supabase
        .from('services')
        .select('id, name, duration_minutes, base_price')
        .eq('tenant_id', context.tenantId)
        .limit(1)

      let service = services?.[0]
      
      if (!service) {
        // Create a default service if none exists
        const { data: newService, error: createError } = await supabase
          .from('services')
          .insert({
            tenant_id: context.tenantId,
            name: args.service_type,
            description: 'Serviço geral',
            duration_minutes: 60,
            base_price: 100,
            is_active: true
          })
          .select()
          .single()

        if (createError) {
          return {
            success: false,
            message: 'Erro ao configurar serviço. Entre em contato conosco.',
            shouldContinue: true
          }
        }
        service = newService
      }

      // Create the appointment
      const appointmentData = {
        tenant_id: context.tenantId,
        user_id: context.userId,
        service_id: service.id,
        start_time: `${args.date}T${args.time}:00`,
        end_time: new Date(new Date(`${args.date}T${args.time}:00`).getTime() + (validateServiceDuration(service.duration_minutes) * 60000)).toISOString(),
        timezone: context.tenantConfig?.businessHours.timezone || 'America/Sao_Paulo',
        status: validateAppointmentStatus('confirmed'),
        quoted_price: service.base_price,
        customer_notes: args.service_details,
        appointment_data: {
          service_type: args.service_type,
          client_name: args.client_name,
          contact_info: args.contact_info,
          service_details: args.service_details,
          special_requests: args.special_requests,
          is_first_time: args.is_first_time || false,
          booked_via: 'whatsapp_ai'
        }
      }

      const { data: appointment, error: appointmentError } = await supabase
        .from('appointments')
        .insert(appointmentData)
        .select()
        .single()

      if (appointmentError) {
        return {
          success: false,
          message: `Erro ao criar agendamento: ${appointmentError.message}`,
          shouldContinue: true
        }
      }

      const dateFormatted = new Date(args.date).toLocaleDateString('pt-BR')
      const businessName = context.tenantConfig?.businessName || 'nossa empresa'

      // Generate preparation checklist
      const preparationChecklist = [
        '📞 Confirmaremos por telefone 24h antes',
        '📧 Você receberá email de confirmação',
        '🕐 Chegue 10 minutos antes do horário',
        '📋 Traga documentos se necessário',
        '💳 Prepare forma de pagamento preferida'
      ]

      if (args.is_first_time) {
        preparationChecklist.push('📄 Traga documento de identidade')
        preparationChecklist.push('ℹ️ Receberá orientações específicas por WhatsApp')
      }

      // Contact and support information
      const supportInfo = [
        '📱 WhatsApp: Mesmo número desta conversa',
        '📞 Reagendamentos: Até 24h de antecedência',
        '❓ Dúvidas: Sempre disponível para ajudar',
        '🚨 Emergências: Contato direto via telefone'
      ]

      return {
        success: true,
        data: {
          appointment_id: appointment.id,
          service_name: service.name,
          date: dateFormatted,
          time: args.time,
          duration: service.duration_minutes,
          price: service.base_price,
          confirmation_code: appointment.id.slice(0, 8).toUpperCase(),
          client_name: args.client_name
        },
        message: `✅ **Agendamento Confirmado!**\n\n🎉 Tudo certo, ${args.client_name}!\n\n📋 **Detalhes do Agendamento:**\n• Serviço: ${args.service_type}\n• Data: ${dateFormatted} às ${args.time}\n• Duração: ${service.duration_minutes} minutos\n• Valor: R$ ${service.base_price}\n• Código: ${appointment.id.slice(0, 8).toUpperCase()}\n\n📝 **Serviço:** ${args.service_details}\n${args.special_requests ? `🔧 **Observações:** ${args.special_requests}\n` : ''}\n📞 **Contato:** ${args.contact_info}\n\n✅ **Checklist de Preparação:**\n${preparationChecklist.map(item => `${item}`).join('\n')}\n\n📞 **Suporte e Contato:**\n${supportInfo.map(item => `${item}`).join('\n')}\n\n${args.is_first_time ? '🌟 **Seja muito bem-vindo(a)!** É um prazer tê-lo(a) como cliente!\n\n' : ''}Obrigado por escolher ${businessName}! Estamos ansiosos para atendê-lo(a)! 😊`,
        shouldContinue: false
      }

    } catch (error) {
      return {
        success: false,
        message: `Erro inesperado no agendamento: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        shouldContinue: true
      }
    }
  }

  private async provideBusinessInformation(
    args: {
      information_type: string
      specific_service?: string
    },
    context: ConversationContext
  ): Promise<FunctionResult> {
    try {
      const tenant = context.tenantConfig
      const businessName = tenant?.businessName || 'Nossa Empresa'

      let informationContent = ''

      switch (args.information_type) {
        case 'services':
          const servicesInfo = tenant?.services || []
          informationContent = `🎯 **Nossos Serviços:**\n\n${servicesInfo.map(service => 
            `• **${service.name}** - R$ ${service.price}\n  ${service.description}\n  ⏱️ Duração: ${service.duration} minutos`
          ).join('\n\n')}`
          break

        case 'pricing':
          informationContent = `💰 **Tabela de Preços:**\n\n${tenant?.services?.map(service => 
            `• ${service.name}: R$ ${service.price}`
          ).join('\n') || 'Entre em contato para orçamento personalizado'}\n\n💳 **Formas de Pagamento:**\n• Dinheiro (5% desconto)\n• PIX (3% desconto)\n• Cartão de crédito/débito\n• Transferência bancária`
          break

        case 'location':
          informationContent = `📍 **Nossa Localização:**\n\n🏢 ${businessName}\n📍 Endereço: [Será fornecido após confirmação]\n🚗 Estacionamento: Disponível\n🚌 Transporte público: Próximo a paradas\n\n🗺️ **Como Chegar:**\n• De carro: GPS recomendado\n• Transporte público: Rotas disponíveis\n• A pé: Acesso facilitado`
          break

        case 'hours':
          const hours = tenant?.businessHours || {}
          informationContent = `🕐 **Horários de Funcionamento:**\n\n📅 **Segunda a Sexta:** 8h às 18h\n📅 **Sábado:** 8h às 16h\n📅 **Domingo:** Fechado\n\n⚠️ **Observações:**\n• Atendimento por agendamento\n• Emergências: Consultar disponibilidade\n• Feriados: Horário especial`
          break

        case 'contact':
          informationContent = `📞 **Contatos:**\n\n📱 **WhatsApp:** ${context.phoneNumber}\n📧 **Email:** contato@${businessName.toLowerCase().replace(/\s+/g, '')}.com\n📞 **Telefone:** [Será fornecido]\n🌐 **Site:** Em breve\n📱 **Redes Sociais:** @${businessName.toLowerCase().replace(/\s+/g, '')}\n\n⏰ **Horário de Atendimento:**\n• WhatsApp: 24h (resposta em até 2h)\n• Telefone: Horário comercial\n• Email: Resposta em até 24h`
          break

        case 'policies':
          informationContent = `📋 **Nossas Políticas:**\n\n✅ **Agendamento:**\n• Confirmação obrigatória\n• Reagendamento até 24h antes\n• Tolerância de 15 minutos\n\n💰 **Pagamento:**\n• Pagamento no ato do serviço\n• Descontos para pagamento à vista\n• Parcelamento disponível\n\n🔄 **Cancelamento:**\n• Gratuito até 24h antes\n• Reagendamento sem custo\n• Política de reembolso específica\n\n🛡️ **Garantias:**\n• Satisfação garantida\n• Revisão gratuita se necessário\n• Suporte pós-serviço`
          break

        case 'team':
          informationContent = `👥 **Nossa Equipe:**\n\n👨‍💼 **Profissionais Qualificados:**\n• Experiência comprovada\n• Formação especializada\n• Atualização constante\n• Atendimento personalizado\n\n🏆 **Diferenciais:**\n• Foco na satisfação do cliente\n• Qualidade em primeiro lugar\n• Pontualidade e comprometimento\n• Soluções inovadoras\n\n📚 **Especialidades:**\n• Atendimento personalizado\n• Soluções sob medida\n• Acompanhamento completo\n• Suporte contínuo`
          break

        default:
          informationContent = `ℹ️ **Sobre ${businessName}:**\n\n🎯 **Nossa Missão:**\nOferecer serviços de excelência com foco na satisfação do cliente.\n\n💎 **Nossos Valores:**\n• Qualidade acima de tudo\n• Atendimento humanizado\n• Compromisso com resultados\n• Inovação constante\n\n🏆 **Por que nos escolher:**\n• Experiência no mercado\n• Profissionais qualificados\n• Preços justos\n• Garantia de satisfação\n\n📞 **Entre em contato:**\nEstamos sempre prontos para atender você!`
      }

      return {
        success: true,
        data: {
          information_type: args.information_type,
          business_name: businessName,
          content: informationContent
        },
        message: informationContent + `\n\n❓ **Mais alguma dúvida?**\nEstou aqui para ajudar com qualquer informação que precisar! 😊`,
        shouldContinue: true
      }

    } catch (error) {
      return {
        success: false,
        message: `Erro ao buscar informações: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        shouldContinue: true
      }
    }
  }

  private async calculateServicePricing(
    args: {
      service_type: string
      service_complexity?: string
      duration_estimate?: number
      additional_services?: string[]
      client_type?: string
    },
    context: ConversationContext
  ): Promise<FunctionResult> {
    try {
      // Base pricing structure
      const basePricing: Record<string, number> = {
        'simples': 80,
        'medio': 120,
        'complexo': 180,
        'personalizado': 250
      }

      const basePrice = basePricing[args.service_complexity || 'medio']

      // Duration adjustments
      const durationMultiplier = args.duration_estimate ? 
        Math.max(0.5, Math.min(3.0, args.duration_estimate / 2)) : 1.0

      // Client type discounts
      const clientDiscounts: Record<string, number> = {
        'novo': 0.95, // 5% discount for new clients
        'recorrente': 0.90, // 10% discount for recurring clients
        'vip': 0.85, // 15% discount for VIP clients
        'corporativo': 0.80 // 20% discount for corporate clients
      }

      const clientMultiplier = clientDiscounts[args.client_type || 'novo']

      // Calculate additional services
      let additionalCost = 0
      const additionalPricing: Record<string, number> = {
        'urgencia': 50,
        'final_semana': 30,
        'domicilio': 40,
        'extra_tempo': 25,
        'materiais_premium': 60
      }

      if (args.additional_services) {
        additionalCost = args.additional_services.reduce((sum, service) => 
          sum + (additionalPricing[service] || 20), 0
        )
      }

      // Final calculation
      const finalPrice = Math.round(((basePrice || 100) * durationMultiplier * (clientMultiplier || 1)) + additionalCost)

      // Generate pricing breakdown
      const pricingBreakdown = [
        `• Serviço base (${args.service_complexity || 'médio'}): R$ ${basePrice}`,
        ...(args.duration_estimate ? [`• Ajuste por duração (${args.duration_estimate}h): ${durationMultiplier}x`] : []),
        ...(args.client_type && (clientMultiplier || 1) < 1 ? [`• Desconto ${args.client_type}: -${Math.round((1 - (clientMultiplier || 1)) * 100)}%`] : []),
        ...(additionalCost > 0 ? [`• Serviços adicionais: +R$ ${additionalCost}`] : [])
      ]

      // Payment options
      const paymentOptions = [
        { method: 'À vista (Dinheiro/PIX)', price: Math.round(finalPrice * 0.95), discount: '5%' },
        { method: 'Cartão de débito', price: finalPrice, discount: '0%' },
        { method: 'Cartão de crédito', price: finalPrice, discount: '0%' },
        { method: 'Parcelado (2x)', price: Math.round(finalPrice / 2), discount: '0%' }
      ]

      // Service guarantees
      const guarantees = [
        '✅ Garantia de satisfação',
        '🔄 Revisão gratuita se necessário',
        '📞 Suporte pós-serviço',
        '🛡️ Seguro de responsabilidade civil'
      ]

      return {
        success: true,
        data: {
          service_type: args.service_type,
          final_price: finalPrice,
          base_price: basePrice,
          pricing_breakdown: pricingBreakdown,
          payment_options: paymentOptions,
          guarantees: guarantees
        },
        message: `💰 **Orçamento para ${args.service_type}**\n\n🎯 **Valor Total: R$ ${finalPrice}**\n\n📊 **Detalhamento:**\n${pricingBreakdown.join('\n')}\n\n💳 **Opções de Pagamento:**\n${paymentOptions.map(opt => `• ${opt.method}: R$ ${opt.price.toLocaleString()}${opt.discount !== '0%' ? ` (${opt.discount} desconto)` : ''}`).join('\n')}\n\n🛡️ **Garantias Incluídas:**\n${guarantees.join('\n')}\n\n📅 **Validade do Orçamento:** 15 dias\n\n💡 **Este é um orçamento estimado. O valor final pode variar conforme especificações detalhadas do serviço.**\n\nGostaria de agendar ou tem alguma dúvida? 😊`,
        shouldContinue: true
      }

    } catch (error) {
      return {
        success: false,
        message: `Erro no cálculo de preços: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        shouldContinue: true
      }
    }
  }

  private async handleCustomerInquiry(
    args: {
      inquiry_type: string
      inquiry_details: string
      client_context?: string
      urgency?: string
    },
    context: ConversationContext
  ): Promise<FunctionResult> {
    try {
      let response = ''
      let actions = []

      switch (args.inquiry_type) {
        case 'service_question':
          response = `❓ **Sua Dúvida sobre Serviços:**\n\n"${args.inquiry_details}"\n\n💡 **Nossa Resposta:**\nVou esclarecer isso para você! Com base em sua pergunta, posso fornecer informações detalhadas sobre nossos serviços.\n\n📋 **Informações Relevantes:**\n• Oferecemos serviços personalizados\n• Avaliação gratuita disponível\n• Profissionais especializados\n• Garantia de qualidade\n\n📞 **Próximos Passos:**\n• Posso agendar uma consulta gratuita\n• Envio de material informativo\n• Contato direto com especialista`
          actions = ['send_service_information', 'schedule_consultation']
          break

        case 'pricing_question':
          response = `💰 **Sua Pergunta sobre Preços:**\n\n"${args.inquiry_details}"\n\n📊 **Sobre Nossos Preços:**\nNossos valores são competitivos e baseados na qualidade do serviço oferecido.\n\n💎 **O que inclui:**\n• Avaliação inicial gratuita\n• Orçamento detalhado sem compromisso\n• Garantia de preço por 15 dias\n• Opções de pagamento flexíveis\n\n🎯 **Orçamento Personalizado:**\nPara dar um valor exato, preciso conhecer suas necessidades específicas.`
          actions = ['create_personalized_quote', 'schedule_evaluation']
          break

        case 'scheduling_issue':
          response = `📅 **Questão de Agendamento:**\n\n"${args.inquiry_details}"\n\n🔄 **Vamos Resolver:**\nEntendo sua situação e vou ajudar a encontrar a melhor solução.\n\n✅ **Opções Disponíveis:**\n• Reagendamento sem custo\n• Horários alternativos\n• Encaixe de emergência (se necessário)\n• Atendimento flexível\n\n⚡ **Resolução Rápida:**\nVou verificar nossa agenda imediatamente.`
          actions = ['check_alternative_schedules', 'emergency_scheduling']
          break

        case 'complaint':
          response = `😔 **Sua Reclamação é Importante:**\n\n"${args.inquiry_details}"\n\n🙏 **Pedimos Desculpas:**\nLamentamos muito que sua experiência não tenha sido satisfatória.\n\n🔧 **Vamos Corrigir:**\n• Investigação imediata do ocorrido\n• Medidas corretivas apropriadas\n• Acompanhamento pessoal do caso\n• Garantia de que não se repetirá\n\n📞 **Ação Imediata:**\nUm responsável entrará em contato em até 2 horas.`
          actions = ['escalate_to_manager', 'immediate_follow_up', 'corrective_action']
          break

        case 'compliment':
          response = `😊 **Muito Obrigado pelo Elogio!**\n\n"${args.inquiry_details}"\n\n🎉 **Ficamos Felizes:**\nSeu feedback positivo é muito importante para nós!\n\n💝 **Nosso Compromisso:**\n• Manter sempre esse padrão de qualidade\n• Continuar superando expectativas\n• Investir no desenvolvimento da equipe\n• Buscar a excelência constantemente\n\n🌟 **Compartilhe sua Experiência:**\nSe possível, consideraria avaliar nossos serviços online?`
          actions = ['thank_customer', 'request_review', 'loyalty_program']
          break

        default:
          response = `💬 **Sua Solicitação:**\n\n"${args.inquiry_details}"\n\n✅ **Recebemos sua Mensagem:**\nSua solicitação é importante para nós e será tratada com prioridade.\n\n🎯 **Próximos Passos:**\n• Análise detalhada da solicitação\n• Resposta personalizada\n• Acompanhamento se necessário\n\n⏰ **Prazo de Resposta:**\n${args.urgency === 'alta' ? 'Até 2 horas' : 'Até 24 horas'}`
          actions = ['general_follow_up']
      }

      // Add urgency handling
      if (args.urgency === 'alta') {
        response += `\n\n🚨 **Alta Prioridade:** Sua solicitação será tratada com urgência máxima.`
      }

      const businessName = context.tenantConfig?.businessName || 'nossa empresa'
      response += `\n\nObrigado por entrar em contato com ${businessName}! 😊`

      return {
        success: true,
        data: {
          inquiry_type: args.inquiry_type,
          inquiry_details: args.inquiry_details,
          response_actions: actions,
          urgency_level: args.urgency || 'media',
          follow_up_required: ['complaint', 'scheduling_issue'].includes(args.inquiry_type)
        },
        message: response,
        shouldContinue: true
      }

    } catch (error) {
      return {
        success: false,
        message: `Erro ao processar solicitação: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        shouldContinue: true
      }
    }
  }

  // Helper methods
  private generateRecommendations(serviceInterest: string, budgetRange?: string): string[] {
    const recommendations = [
      `Consulta inicial gratuita para ${serviceInterest}`,
      'Orçamento detalhado sem compromisso',
      'Avaliação personalizada das suas necessidades'
    ]

    if (budgetRange) {
      recommendations.push('Opções dentro de seu orçamento disponíveis')
      recommendations.push('Planos de pagamento flexíveis')
    }

    return recommendations
  }

  private generateTimeSlots(date: Date, businessHours?: any): string[] {
    // Default business hours if not configured
    const dayOfWeek = date.getDay()
    
    if (dayOfWeek === 0) return [] // Sunday closed
    if (dayOfWeek === 6) return ['09:00', '10:00', '11:00', '14:00', '15:00'] // Saturday limited hours
    
    // Regular weekday hours
    return ['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00']
  }

  private generateFlexibilitySuggestions(flexibility?: string, slots: any[] = [], serviceType: string = ''): string[] {
    const suggestions = []

    if (flexibility === 'muito_flexivel') {
      suggestions.push('Horários matutinos têm mais disponibilidade')
      suggestions.push('Meio da semana geralmente menos concorrido')
    } else if (flexibility === 'pouco_flexivel') {
      suggestions.push('Agendamento antecipado recomendado')
      suggestions.push('Lista de espera para horários preferidos')
    }

    suggestions.push('Atendimento de emergência disponível')
    suggestions.push('Reagendamento gratuito até 24h antes')

    return suggestions
  }

  private getServiceInfo(serviceType: string, tenantConfig?: any): any {
    return {
      category: 'Serviço Geral',
      default_duration: 60,
      preparation_time: 10,
      equipment_needed: false,
      location_flexible: true
    }
  }
}