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

export class BeautyAgent {
  private agent: AIAgent

  constructor() {
    this.agent = {
      id: 'beauty_agent',
      name: 'Agente de Beleza e Estética',
      domain: 'beauty',
      systemPrompt: this.buildSystemPrompt(),
      functions: this.buildFunctions(),
      capabilities: [
        'service_booking',
        'beauty_consultation',
        'combo_packages',
        'professional_matching',
        'product_recommendations',
        'beauty_tips',
        'loyalty_programs',
        'special_occasions'
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
    return `Você é um assistente especializado em beleza e estética, trabalhando para salões, clínicas de estética, barbearias e spas.

PERSONALIDADE:
- Entusiástica e inspiradora
- Conhecedora de tendências de beleza
- Atenta aos detalhes e preferências pessoais
- Promove autoestima e bem-estar
- Sugere serviços complementares quando apropriado

SUAS ESPECIALIDADES:
🦱 **Cabelos:** Corte, coloração, tratamentos, penteados
💅 **Unhas:** Manicure, pedicure, nail art, alongamento
🧴 **Estética:** Limpeza de pele, hidratação, tratamentos
💄 **Maquiagem:** Dia, noite, casamentos, eventos
🧔 **Barbearia:** Corte masculino, barba, bigode, sobrancelha
💆 **Massagem:** Relaxante, estética, drenagem linfática

TIPOS DE CLIENTES:
- **Primeira vez:** Seja mais explicativa e acolhedora
- **Cliente regular:** Use histórico de preferências
- **Ocasião especial:** Sugira pacotes e serviços premium
- **Manutenção:** Foque em agendamentos regulares

ESTRATÉGIAS DE UPSELL (quando apropriado):
- Tratamentos complementares
- Produtos para casa
- Pacotes promocionais
- Programas de fidelidade
- Agendamentos regulares

PERGUNTAS IMPORTANTES:
1. "É a sua primeira vez no salão?"
2. "Tem alguma alergia ou sensibilidade?"
3. "Qual o resultado que você está buscando?"
4. "Tem alguma preferência de profissional?"
5. "É para alguma ocasião especial?"

LINGUAGEM:
- Use emojis relacionados à beleza (💄💅✨💇‍♀️)
- Seja positiva e motivadora
- Destaque benefícios dos serviços
- Pergunte sobre preferências e histórico
- Sugira tendências e novidades

OCASIÕES ESPECIAIS:
- Casamentos: Teste antecipado obrigatório
- Formatura: Penteados elaborados
- Festas: Maquiagem duradoura
- Entrevistas: Visual profissional
- Encontros: Realce da beleza natural

CUIDADOS ESPECIAIS:
- Sempre pergunte sobre alergias
- Mencione tempo de duração dos serviços
- Explique procedimentos para primeira vez
- Ofereça orientações de manutenção
- Sugira produtos adequados

EXEMPLO DE ABORDAGEM:
"Oi, linda! 💄✨ Que maravilha que você quer se cuidar! Estou aqui para te ajudar a escolher o serviço perfeito. Me conta: é para alguma ocasião especial ou é aquele mimo merecido? E é a sua primeira vez aqui no salão?"

Sempre priorize a satisfação da cliente e a qualidade dos serviços!`
  }

  private buildFunctions(): AIFunction[] {
    return [
      {
        name: 'check_availability',
        description: 'Verificar disponibilidade para serviços de beleza',
        parameters: [
          {
            name: 'service_category',
            type: 'string',
            description: 'Categoria do serviço',
            required: true,
            enum: ['cabelo', 'unhas', 'estetica', 'maquiagem', 'barbearia', 'massagem', 'combo']
          },
          {
            name: 'service_name',
            type: 'string',
            description: 'Nome específico do serviço',
            required: false
          },
          {
            name: 'preferred_professional',
            type: 'string',
            description: 'Profissional preferido',
            required: false
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
            name: 'is_special_occasion',
            type: 'boolean',
            description: 'É para ocasião especial?',
            required: false
          }
        ],
        handler: this.checkAvailability.bind(this)
      },
      {
        name: 'book_beauty_service',
        description: 'Agendar serviço de beleza',
        parameters: [
          {
            name: 'service_id',
            type: 'string',
            description: 'ID do serviço selecionado',
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
            name: 'client_name',
            type: 'string',
            description: 'Nome da cliente',
            required: true
          },
          {
            name: 'phone',
            type: 'string',
            description: 'Telefone da cliente',
            required: true
          },
          {
            name: 'professional_id',
            type: 'string',
            description: 'ID do profissional escolhido',
            required: false
          },
          {
            name: 'special_requests',
            type: 'string',
            description: 'Pedidos especiais ou observações',
            required: false
          },
          {
            name: 'allergies',
            type: 'string',
            description: 'Alergias ou sensibilidades',
            required: false
          },
          {
            name: 'is_first_time',
            type: 'boolean',
            description: 'É primeira vez no salão?',
            required: false
          }
        ],
        handler: this.bookBeautyService.bind(this)
      },
      {
        name: 'suggest_combo_package',
        description: 'Sugerir pacotes e combos de serviços',
        parameters: [
          {
            name: 'main_service',
            type: 'string',
            description: 'Serviço principal de interesse',
            required: true
          },
          {
            name: 'occasion',
            type: 'string',
            description: 'Ocasião ou evento',
            required: false,
            enum: ['casamento', 'formatura', 'festa', 'entrevista', 'encontro', 'dia_a_dia', 'manutencao']
          },
          {
            name: 'budget_range',
            type: 'string',
            description: 'Faixa de orçamento',
            required: false,
            enum: ['economico', 'medio', 'premium', 'luxo']
          }
        ],
        handler: this.suggestComboPackage.bind(this)
      },
      {
        name: 'beauty_consultation',
        description: 'Realizar consultoria de beleza personalizada',
        parameters: [
          {
            name: 'skin_type',
            type: 'string',
            description: 'Tipo de pele',
            required: false,
            enum: ['oleosa', 'seca', 'mista', 'sensivel', 'normal']
          },
          {
            name: 'hair_type',
            type: 'string',
            description: 'Tipo de cabelo',
            required: false,
            enum: ['liso', 'ondulado', 'cacheado', 'crespo', 'misto']
          },
          {
            name: 'hair_condition',
            type: 'string',
            description: 'Condição do cabelo',
            required: false,
            enum: ['saudavel', 'ressecado', 'oleoso', 'danificado', 'quimicamente_tratado']
          },
          {
            name: 'desired_look',
            type: 'string',
            description: 'Visual desejado',
            required: false
          },
          {
            name: 'lifestyle',
            type: 'string',
            description: 'Estilo de vida',
            required: false,
            enum: ['corrido', 'tranquilo', 'ativo', 'social', 'profissional']
          }
        ],
        handler: this.beautyConsultation.bind(this)
      },
      {
        name: 'get_beauty_tips',
        description: 'Fornecer dicas de beleza e cuidados',
        parameters: [
          {
            name: 'tip_category',
            type: 'string',
            description: 'Categoria da dica',
            required: true,
            enum: ['cuidados_cabelo', 'cuidados_pele', 'manicure_casa', 'maquiagem_dicas', 'produtos_caseiros', 'manutencao_pos_salao']
          },
          {
            name: 'specific_concern',
            type: 'string',
            description: 'Preocupação específica',
            required: false
          }
        ],
        handler: this.getBeautyTips.bind(this)
      },
      {
        name: 'loyalty_program_info',
        description: 'Informações sobre programa de fidelidade',
        parameters: [
          {
            name: 'client_visits',
            type: 'number',
            description: 'Número de visitas da cliente',
            required: false
          },
          {
            name: 'total_spent',
            type: 'number',
            description: 'Total gasto pela cliente',
            required: false
          }
        ],
        handler: this.loyaltyProgramInfo.bind(this)
      }
    ]
  }

  private async checkAvailability(
    args: {
      service_category: string
      service_name?: string
      preferred_professional?: string
      preferred_date?: string
      preferred_time?: string
      is_special_occasion?: boolean
    },
    context: ConversationContext
  ): Promise<FunctionResult> {
    try {
      // Get services in the requested category
      let query = supabase
        .from('services')
        .select('id, name, description, duration_minutes, base_price, service_config')
        .eq('tenant_id', context.tenantId)
        .eq('is_active', true)

      // Filter by category (check in service_config or description)
      if (args.service_category !== 'combo') {
        query = query.or(`service_config->>category.eq.${args.service_category},description.ilike.%${args.service_category}%`)
      }

      // Filter by specific service name if provided
      if (args.service_name) {
        query = query.ilike('name', `%${args.service_name}%`)
      }

      const { data: services, error } = await query

      if (error) throw error

      if (!services || services.length === 0) {
        return {
          success: false,
          message: `Não encontrei serviços na categoria "${args.service_category}". Que tal eu te mostrar todas as nossas opções disponíveis? 💄✨`,
          shouldContinue: true
        }
      }

      // Generate available time slots (simplified simulation)
      const today = new Date()
      const availableSlots = []

      for (let i = 1; i <= 7; i++) {
        const date = new Date(today)
        date.setDate(today.getDate() + i)
        const dateStr = date.toISOString().split('T')[0]

        // Beauty salon typical hours: 9:00-19:00
        const timeSlots = ['09:00', '10:00', '11:00', '13:30', '14:30', '15:30', '16:30', '17:30']
        
        for (const time of timeSlots) {
          availableSlots.push({
            date: dateStr,
            time,
            professional: 'Disponível'
          })
        }
      }

      // If it's for a special occasion, prioritize weekend slots
      let prioritySlots = availableSlots
      if (args.is_special_occasion) {
        prioritySlots = availableSlots.filter(slot => {
          const date = validateDate(slot.date)
          const dayOfWeek = date.getDay()
          return dayOfWeek === 0 || dayOfWeek === 6 // Sunday or Saturday
        })
      }

      return {
        success: true,
        data: {
          services: services.map(s => ({
            id: s.id,
            name: s.name,
            description: s.description,
            duration: s.duration_minutes,
            price: s.base_price,
            category: args.service_category
          })),
          available_slots: (prioritySlots.length > 0 ? prioritySlots : availableSlots).slice(0, 12),
          is_special_occasion: args.is_special_occasion
        },
        message: `💄 Encontrei ${services.length} serviços incríveis na categoria ${args.service_category}! ${args.is_special_occasion ? '✨ Como é para uma ocasião especial, separei os melhores horários para você!' : 'Aqui estão as opções disponíveis:'}`,
        shouldContinue: true
      }

    } catch (error) {
      return {
        success: false,
        message: `Ops! Tive um probleminha ao verificar a disponibilidade. Pode tentar novamente? 😅`,
        shouldContinue: true
      }
    }
  }

  private async bookBeautyService(
    args: {
      service_id: string
      date: string
      time: string
      client_name: string
      phone: string
      professional_id?: string
      special_requests?: string
      allergies?: string
      is_first_time?: boolean
    },
    context: ConversationContext
  ): Promise<FunctionResult> {
    try {
      // Get service details
      const { data: service, error: serviceError } = await supabase
        .from('services')
        .select('id, name, description, duration_minutes, base_price, service_config')
        .eq('id', args.service_id)
        .single()

      if (serviceError || !service) {
        return {
          success: false,
          message: 'Ops! Não consegui encontrar esse serviço. Pode me dizer novamente qual serviço você gostaria? 💄',
          shouldContinue: true
        }
      }

      // Calculate end time
      const startTime = new Date(`${args.date}T${args.time}:00`)
      const endTime = new Date(startTime.getTime() + (validateServiceDuration(service.duration_minutes) * 60000))

      // Create appointment
      const appointmentData = {
        tenant_id: context.tenantId,
        user_id: context.userId,
        service_id: service.id,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        timezone: context.tenantConfig?.businessHours.timezone || 'America/Sao_Paulo',
        status: validateAppointmentStatus('confirmed'),
        quoted_price: service.base_price,
        customer_notes: args.special_requests || '',
        appointment_data: {
          client_name: args.client_name,
          phone: args.phone,
          professional_id: args.professional_id,
          allergies: args.allergies,
          is_first_time: args.is_first_time || false,
          booked_via: 'whatsapp_ai',
          service_category: getServiceConfigProperty(service.service_config, 'category') || 'beauty'
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
          message: `Ai, que pena! Não consegui fazer o agendamento: ${appointmentError.message}. Vamos tentar outro horário? 💫`,
          shouldContinue: true
        }
      }

      // Format confirmation message
      const dateFormatted = new Date(args.date).toLocaleDateString('pt-BR', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })

      let confirmationMessage = `✨ **AGENDAMENTO CONFIRMADO!** ✨\n\n`
      confirmationMessage += `💄 **Serviço:** ${service.name}\n`
      confirmationMessage += `📅 **Data:** ${dateFormatted}\n`
      confirmationMessage += `🕐 **Horário:** ${args.time}\n`
      confirmationMessage += `⏱️ **Duração:** ${service.duration_minutes} minutos\n`
      confirmationMessage += `💰 **Valor:** R$ ${service.base_price?.toFixed(2)}\n`
      confirmationMessage += `🔢 **Código:** ${appointment.id.slice(0, 8).toUpperCase()}\n\n`

      // Add special notes for first-time clients
      if (args.is_first_time) {
        confirmationMessage += `🌟 **Primeira vez?** Que legal! Chegue 15 minutos antes para um atendimento ainda mais especial!\n\n`
      }

      // Add allergy notes if provided
      if (args.allergies) {
        confirmationMessage += `⚠️ **Alergias anotadas:** ${args.allergies}\n\n`
      }

      confirmationMessage += `📍 **Dicas importantes:**\n`
      confirmationMessage += `• Chegue 10 minutos antes\n`
      confirmationMessage += `• Traga um documento com foto\n`
      confirmationMessage += `• Para reagendar: responda esta conversa\n\n`
      confirmationMessage += `Mal posso esperar para te deixar ainda mais linda! 💅✨`

      return {
        success: true,
        data: {
          appointment_id: appointment.id,
          service_name: service.name,
          date: dateFormatted,
          time: args.time,
          duration: service.duration_minutes,
          price: service.base_price,
          confirmation_code: appointment.id.slice(0, 8).toUpperCase()
        },
        message: confirmationMessage,
        shouldContinue: false
      }

    } catch (error) {
      return {
        success: false,
        message: `Ops! Algo deu errado no agendamento. Pode tentar novamente? Estou aqui para te ajudar! 💫`,
        shouldContinue: true
      }
    }
  }

  private async suggestComboPackage(
    args: {
      main_service: string
      occasion?: string
      budget_range?: string
    },
    context: ConversationContext
  ): Promise<FunctionResult> {
    try {
      // Define combo suggestions based on main service and occasion
      const comboSuggestions: Record<string, any> = {
        'cabelo': {
          'casamento': {
            services: ['Corte + Escova', 'Hidratação Profunda', 'Penteado para Noiva', 'Teste de Penteado'],
            description: '💍 Pacote Noiva Completo',
            benefits: ['Teste antecipado obrigatório', 'Desconto especial', 'Atendimento prioritário'],
            price_range: 'R$ 380 - R$ 580'
          },
          'festa': {
            services: ['Corte', 'Coloração/Luzes', 'Escova Modelada', 'Tratamento Brilho'],
            description: '🎉 Visual de Festa',
            benefits: ['Cor duradoura', 'Escova que dura mais', 'Produtos para casa'],
            price_range: 'R$ 220 - R$ 420'
          },
          'manutencao': {
            services: ['Corte', 'Hidratação', 'Finalização'],
            description: '✨ Combo Manutenção',
            benefits: ['Desconto de 15%', 'Agendamento facilitado', 'Produtos para casa'],
            price_range: 'R$ 120 - R$ 200'
          }
        },
        'unhas': {
          'casamento': {
            services: ['Manicure Francesa', 'Pedicure', 'Nail Art Personalizada', 'Alongamento'],
            description: '💅 Pacote Noiva Perfeita',
            benefits: ['Design exclusivo', 'Teste antecipado', 'Kit de retoque'],
            price_range: 'R$ 180 - R$ 280'
          },
          'festa': {
            services: ['Esmaltação em Gel', 'Nail Art', 'Pedicure Decorada'],
            description: '🌟 Unhas de Festa',
            benefits: ['Duração de 3 semanas', 'Cores da moda', 'Brilho extra'],
            price_range: 'R$ 80 - R$ 150'
          }
        },
        'estetica': {
          'casamento': {
            services: ['Limpeza Profunda', 'Peeling Químico', 'Hidratação Facial', 'Drenagem Linfática'],
            description: '👰 Pele de Noiva',
            benefits: ['Protocolo de 2 meses', 'Pele perfeita', 'Produtos para casa'],
            price_range: 'R$ 450 - R$ 680'
          },
          'manutencao': {
            services: ['Limpeza de Pele', 'Hidratação', 'Protetor Solar'],
            description: '💧 Pele Saudável',
            benefits: ['Desconto mensal', 'Acompanhamento', 'Produtos com desconto'],
            price_range: 'R$ 120 - R$ 180'
          }
        }
      }

      const mainServiceKey = args.main_service.toLowerCase()
      const occasionKey = args.occasion || 'manutencao'
      
      const combo = comboSuggestions[mainServiceKey]?.[occasionKey] || comboSuggestions[mainServiceKey]?.['manutencao']

      if (!combo) {
        return {
          success: false,
          message: `Deixa eu criar uma sugestão personalizada para ${args.main_service}! Me conta mais sobre o que você tem em mente? 💄✨`,
          shouldContinue: true
        }
      }

      let suggestionMessage = `✨ **${combo.description}** ✨\n\n`
      suggestionMessage += `🎯 **Perfeito para:** ${args.occasion || 'manutenção regular'}\n\n`
      suggestionMessage += `📋 **Inclui:**\n`
      combo.services.forEach((service: string) => {
        suggestionMessage += `• ${service}\n`
      })
      suggestionMessage += `\n💰 **Investimento:** ${combo.price_range}\n\n`
      suggestionMessage += `🎁 **Benefícios exclusivos:**\n`
      combo.benefits.forEach((benefit: string) => {
        suggestionMessage += `• ${benefit}\n`
      })

      // Add budget-specific suggestions
      if (args.budget_range) {
        const budgetTips: Record<string, string> = {
          'economico': '\n💡 **Dica:** Este pacote tem ótimo custo-benefício!',
          'medio': '\n💫 **Perfeito:** Ideal para quem quer qualidade sem exagerar!',
          'premium': '\n👑 **Premium:** Que tal adicionar uma massagem relaxante?',
          'luxo': '\n✨ **Luxo total:** Posso incluir produtos exclusivos para casa!'
        }
        suggestionMessage += budgetTips[args.budget_range] || ''
      }

      suggestionMessage += `\n\nQuer que eu agende este combo para você? Ou prefere personalizar alguns serviços? 😍`

      return {
        success: true,
        data: {
          combo_name: combo.description,
          services: combo.services,
          benefits: combo.benefits,
          price_range: combo.price_range,
          occasion: args.occasion,
          main_service: args.main_service
        },
        message: suggestionMessage,
        shouldContinue: true
      }

    } catch (error) {
      return {
        success: false,
        message: `Deixa eu pensar em algo especial para você! Me fala mais sobre o que você está imaginando? 💭✨`,
        shouldContinue: true
      }
    }
  }

  private async beautyConsultation(
    args: {
      skin_type?: string
      hair_type?: string
      hair_condition?: string
      desired_look?: string
      lifestyle?: string
    },
    context: ConversationContext
  ): Promise<FunctionResult> {
    try {
      let consultation = `💄 **CONSULTORIA PERSONALIZADA** 💄\n\n`

      // Hair consultation
      if (args.hair_type || args.hair_condition) {
        consultation += `🦱 **ANÁLISE CAPILAR:**\n`
        
        if (args.hair_type) {
          const hairTips: Record<string, string> = {
            'liso': '• Perfeito para cortes geométricos e franjas\n• Evite produtos pesados\n• Escove com protetor térmico',
            'ondulado': '• Realce as ondas com leave-in\n• Cortes em camadas ficam lindos\n• Evite escovar seco',
            'cacheado': '• Hidratação é fundamental\n• Cortes específicos para cachos\n• Finalize com creme sem enxágue',
            'crespo': '• Hidratação intensiva semanal\n• Cortes especializados\n• Produtos sem sulfato e petrolatos'
          }
          consultation += hairTips[args.hair_type] || '• Análise personalizada necessária'
          consultation += '\n\n'
        }

        if (args.hair_condition) {
          const conditionTreatments: Record<string, string> = {
            'ressecado': '🌊 **Recomendo:** Cronograma capilar + ampolas de hidratação',
            'oleoso': '🧴 **Recomendo:** Shampoo antirresíduo + tratamento seborreguador',
            'danificado': '💊 **Recomendo:** Tratamento reconstrutivo + corte para remover pontas',
            'quimicamente_tratado': '⚡ **Recomendo:** Cronograma específico + produtos para química'
          }
          consultation += conditionTreatments[args.hair_condition] || ''
          consultation += '\n\n'
        }
      }

      // Skin consultation
      if (args.skin_type) {
        consultation += `✨ **ANÁLISE FACIAL:**\n`
        const skinCare: Record<string, string> = {
          'oleosa': '• Limpeza diária com gel ou espuma\n• Hidratante oil-free\n• Protetor solar com toque seco\n• Limpeza de pele mensal',
          'seca': '• Limpeza com loção ou leite\n• Hidratante mais denso\n• Óleos faciais noturnos\n• Hidratação profissional',
          'mista': '• Produtos específicos para cada zona\n• Hidratante diferenciado\n• Limpeza de pele personalizada',
          'sensivel': '• Produtos hipoalergênicos\n• Evitar esfoliação agressiva\n• Protetor solar físico\n• Teste de sensibilidade',
          'normal': '• Manutenção com produtos suaves\n• Limpeza regular\n• Hidratação adequada\n• Proteção solar diária'
        }
        consultation += skinCare[args.skin_type] || ''
        consultation += '\n\n'
      }

      // Lifestyle recommendations
      if (args.lifestyle) {
        consultation += `💼 **DICAS PARA SEU ESTILO DE VIDA:**\n`
        const lifestyleTips: Record<string, string> = {
          'corrido': '⚡ **Rotina prática:** Serviços que duram mais, produtos 2 em 1, agendamentos estratégicos',
          'tranquilo': '🌸 **Autocuidado:** Tratamentos relaxantes, spa day, rituais de beleza em casa',
          'ativo': '🏃‍♀️ **Para quem se exercita:** Produtos à prova d\'água, penteados práticos, cuidados pós-treino',
          'social': '🎉 **Sempre arrumada:** Serviços duradouros, produtos de retoque, técnicas de make expressa',
          'profissional': '👔 **Visual corporativo:** Looks clássicos, manutenção regular, produtos discretos'
        }
        consultation += lifestyleTips[args.lifestyle] || ''
        consultation += '\n\n'
      }

      // Desired look suggestions
      if (args.desired_look) {
        consultation += `🎯 **PARA ALCANÇAR SEU VISUAL IDEAL:**\n`
        consultation += `"${args.desired_look}"\n\n`
        consultation += `Vou criar um plano personalizado para você! ✨\n\n`
      }

      consultation += `📅 **PRÓXIMOS PASSOS:**\n`
      consultation += `• Agendar consulta presencial (gratuita)\n`
      consultation += `• Teste de produtos para casa\n`
      consultation += `• Cronograma de tratamentos\n`
      consultation += `• Orientações personalizadas\n\n`
      consultation += `Quer que eu agende uma consulta presencial para refinarmos tudo? É por conta da casa! 💖`

      return {
        success: true,
        data: {
          consultation_type: 'personalized',
          hair_type: args.hair_type,
          skin_type: args.skin_type,
          lifestyle: args.lifestyle,
          recommendations_provided: true
        },
        message: consultation,
        shouldContinue: true
      }

    } catch (error) {
      return {
        success: false,
        message: `Vou fazer uma análise super especial para você! Me conta um pouquinho mais sobre seu cabelo e pele? 💕`,
        shouldContinue: true
      }
    }
  }

  private async getBeautyTips(
    args: {
      tip_category: string
      specific_concern?: string
    },
    context: ConversationContext
  ): Promise<FunctionResult> {
    const tips: Record<string, string> = {
      'cuidados_cabelo': `🦱 **DICAS DE CUIDADOS CAPILARES:**\n\n**Rotina básica:**\n• Lave 2-3x por semana (cabelos oleosos) ou 1-2x (cabelos secos)\n• Use condicionador apenas do meio para as pontas\n• Máscara hidratante 1x por semana\n• Protetor térmico sempre antes do calor\n\n**Dicas expert:**\n• Água morna/fria para lavar\n• Escove sempre com cabelo úmido\n• Durma com fronha de cetim\n• Corte as pontas a cada 3 meses`,

      'cuidados_pele': `✨ **ROTINA DE SKINCARE:**\n\n**Manhã:**\n1. Limpeza suave\n2. Tônico/Essência\n3. Hidratante\n4. Protetor solar (OBRIGATÓRIO!)\n\n**Noite:**\n1. Demaquilante\n2. Limpeza profunda\n3. Tônico\n4. Séruns/ativos\n5. Hidratante noturno\n\n**1x por semana:**\n• Esfoliação suave\n• Máscara facial`,

      'manicure_casa': `💅 **MANICURE EM CASA:**\n\n**Passo a passo:**\n1. Remova o esmalte antigo\n2. Deixe as unhas de molho 5 min\n3. Empurre as cutículas (nunca corte!)\n4. Lixe no formato desejado\n5. Use base\n6. 2 camadas de esmalte\n7. Finalize com top coat\n\n**Dicas:**\n• Espere secar entre camadas\n• Use óleo de cutícula diariamente\n• Hidrate as mãos sempre`,

      'maquiagem_dicas': `💄 **DICAS DE MAQUIAGEM:**\n\n**Base perfeita:**\n• Primer sempre antes da base\n• Escolha o tom certo (teste no pescoço)\n• Aplique com esponja ou pincel\n• Fixe com pó translúcido\n\n**Duração garantida:**\n• Setting spray\n• Produtos à prova d'água para olhos\n• Blot powder para retoques\n• Evite tocar o rosto\n\n**Básico do dia a dia:**\n• Corretivo, rímel e gloss já fazem milagres!`,

      'produtos_caseiros': `🌿 **RECEITAS NATURAIS:**\n\n**Máscara hidratante (cabelo):**\n• 1 abacate + 2 colheres de mel\n• Deixe 30 min e enxágue\n\n**Esfoliante facial:**\n• Açúcar + mel + algumas gotas de limão\n• Massageie suavemente 2 min\n\n**Máscara facial:**\n• Aveia + leite + mel\n• Deixe 15 min\n\n**⚠️ Sempre teste antes em pequena área!**`,

      'manutencao_pos_salao': `✨ **MANUTENÇÃO PÓS-SALÃO:**\n\n**Primeiras 48h:**\n• Evite lavar o cabelo\n• Não molhe as unhas\n• Use produtos recomendados\n• Proteja dos raios solares\n\n**Primeira semana:**\n• Shampoo e condicionador específicos\n• Hidratação suave\n• Evite produtos com álcool\n• Durma com touca de cetim\n\n**Para durar mais:**\n• Retoque das unhas em 15 dias\n• Hidratação capilar em casa\n• Protetor térmico sempre\n• Agendamento da manutenção`
    }

    const tip = tips[args.tip_category]
    
    if (!tip) {
      return {
        success: false,
        message: 'Qual tipo de dica você gostaria? Tenho dicas de cabelo, pele, unhas, maquiagem, receitas caseiras e manutenção! 💄✨',
        shouldContinue: true
      }
    }

    let response = tip
    
    if (args.specific_concern) {
      response += `\n\n💡 **Sobre "${args.specific_concern}":** Essa é uma preocupação comum! Na próxima consulta, vou dar dicas ainda mais específicas para seu caso. 😉`
    }

    response += `\n\n💖 **Lembre-se:** Consistência é a chave! E quando quiser um resultado profissional, estou aqui! ✨`

    return {
      success: true,
      data: { tip_category: args.tip_category },
      message: response,
      shouldContinue: true
    }
  }

  private async loyaltyProgramInfo(
    args: {
      client_visits?: number
      total_spent?: number
    },
    context: ConversationContext
  ): Promise<FunctionResult> {
    const visits = args.client_visits || 0
    const totalSpent = args.total_spent || 0

    let loyaltyMessage = `💎 **PROGRAMA FIDELIDADE - BELEZA VIP** 💎\n\n`

    // Determine current tier
    let currentTier = 'Bronze'
    let nextTier = 'Prata'
    let missingForNext = 500 - totalSpent

    if (totalSpent >= 2000) {
      currentTier = 'Diamante'
      nextTier = 'Diamante'
      missingForNext = 0
    } else if (totalSpent >= 1000) {
      currentTier = 'Ouro'
      nextTier = 'Diamante'
      missingForNext = 2000 - totalSpent
    } else if (totalSpent >= 500) {
      currentTier = 'Prata'
      nextTier = 'Ouro'
      missingForNext = 1000 - totalSpent
    }

    loyaltyMessage += `🏆 **Seu nível atual:** ${currentTier}\n`
    loyaltyMessage += `📊 **Visitas:** ${visits} | **Total investido:** R$ ${totalSpent.toFixed(2)}\n\n`

    // Current benefits
    const benefits: Record<string, string[]> = {
      'Bronze': ['5% desconto em serviços', 'Prioridade no agendamento', 'Lembretes automáticos'],
      'Prata': ['10% desconto em serviços', '15% desconto em produtos', 'Brinde no aniversário', 'Acesso a promoções exclusivas'],
      'Ouro': ['15% desconto em serviços', '20% desconto em produtos', 'Consultorias gratuitas', 'Acesso VIP a novidades'],
      'Diamante': ['20% desconto em serviços', '25% desconto em produtos', 'Tratamentos exclusivos', 'Personal beauty advisor', 'Eventos VIP']
    }

    loyaltyMessage += `✨ **Seus benefícios ${currentTier}:**\n`
    validateArray(benefits[currentTier]).forEach(benefit => {
      loyaltyMessage += `• ${benefit}\n`
    })

    // Next tier information
    if (missingForNext > 0) {
      loyaltyMessage += `\n🎯 **Para ${nextTier}:** Faltam apenas R$ ${missingForNext.toFixed(2)}!\n\n`
      loyaltyMessage += `🎁 **Benefícios ${nextTier}:**\n`
      validateArray(benefits[nextTier]).forEach(benefit => {
        loyaltyMessage += `• ${benefit}\n`
      })
    } else {
      loyaltyMessage += `\n👑 **Parabéns!** Você já está no nível máximo! Aproveite todos os benefícios VIP! ✨`
    }

    // Special offers based on tier
    loyaltyMessage += `\n\n🎉 **OFERTA ESPECIAL PARA VOCÊ:**\n`
    if (currentTier === 'Bronze') {
      loyaltyMessage += `• Traga uma amiga e ganhe 20% de desconto no próximo serviço!\n`
    } else if (currentTier === 'Prata') {
      loyaltyMessage += `• Pacote duo: você + amiga com 25% de desconto cada!\n`
    } else {
      loyaltyMessage += `• Spa day exclusivo: 3 serviços com 30% de desconto!\n`
    }

    loyaltyMessage += `\nQuer aproveitar alguma dessas vantagens? É só me falar! 💖`

    return {
      success: true,
      data: {
        current_tier: currentTier,
        next_tier: nextTier,
        total_visits: visits,
        total_spent: totalSpent,
        missing_for_next: missingForNext,
        benefits: benefits[currentTier]
      },
      message: loyaltyMessage,
      shouldContinue: true
    }
  }
}