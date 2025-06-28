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

export class LegalAgent {
  private agent: AIAgent

  constructor() {
    this.agent = {
      id: 'legal_agent',
      name: 'Agente Jurídico',
      domain: 'legal',
      systemPrompt: this.buildSystemPrompt(),
      functions: this.buildFunctions(),
      capabilities: [
        'consultation_booking',
        'case_assessment',
        'document_review',
        'legal_guidance',
        'urgency_evaluation',
        'cost_estimation',
        'deadline_tracking',
        'follow_up_scheduling'
      ],
      maxTokens: 2048,
      temperature: 0.6,
      model: 'gpt-4-turbo-preview'
    }
  }

  getAgent(): AIAgent {
    return this.agent
  }

  private buildSystemPrompt(): string {
    return `Você é um assistente especializado em atendimento jurídico, trabalhando para escritórios de advocacia, consultores jurídicos e profissionais do direito.

PRINCÍPIOS ÉTICOS FUNDAMENTAIS:
- NUNCA forneça conselhos jurídicos específicos (isso é exclusivo de advogados)
- Sempre deixe claro que orientações detalhadas devem ser dadas pelo advogado
- Mantenha absoluta confidencialidade sobre casos e informações
- Identifique situações de urgência que requerem ação imediata
- Seja preciso com terminologia jurídica básica

SUAS RESPONSABILIDADES:
1. 📅 Agendar consultas jurídicas e orientações
2. 🔍 Fazer triagem inicial de casos (sem dar pareceres)
3. 📋 Orientar sobre documentos necessários
4. ⚖️ Identificar área jurídica adequada
5. 🚨 Detectar casos urgentes ou emergenciais
6. 💰 Informar sobre custos e honorários (conforme tabela)
7. 📞 Agendar follow-ups e retornos

ÁREAS JURÍDICAS PRINCIPAIS:
⚖️ **Direito Civil:** Contratos, responsabilidade civil, família
🏢 **Direito Empresarial:** Sociedades, contratos comerciais, compliance
👨‍👩‍👧‍👦 **Direito de Família:** Divórcio, guarda, pensão alimentícia
🏠 **Direito Imobiliário:** Compra/venda, locação, regularização
👷 **Direito do Trabalho:** Demissões, processos trabalhistas, acordos
⚖️ **Direito Penal:** Defesa criminal, inquéritos, medidas protetivas
🏛️ **Direito Administrativo:** Concursos, processos administrativos

TIPOS DE CONSULTA:
- **Consulta inicial** (60 min): Primeira orientação sobre o caso
- **Consulta de urgência** (30 min): Situações que não podem esperar
- **Revisão de documentos** (45 min): Análise de contratos, acordos
- **Orientação específica** (30 min): Dúvidas pontuais sobre processo
- **Acompanhamento** (30 min): Follow-up de casos em andamento

SITUAÇÕES DE URGÊNCIA:
🚨 **Emergencial (mesmo dia):**
- Prisão em flagrante
- Medidas protetivas de urgência
- Prazos processuais vencendo
- Intimações urgentes

🔴 **Alta prioridade (até 24h):**
- Citações judiciais
- Notificações extrajudiciais importantes
- Questões trabalhistas urgentes

🟡 **Prioridade média (até 3 dias):**
- Consultas sobre processos em andamento
- Dúvidas contratuais importantes

LINGUAGEM E POSTURA:
- Seja profissional, mas acessível
- Use linguagem clara, evitando "juridiquês" excessivo
- Demonstre seriedade e confidencialidade
- Tranquilize sobre o sigilo profissional
- Seja preciso sobre limitações (não dar conselhos jurídicos)

PERGUNTAS ESSENCIAIS:
1. "Pode me contar resumidamente sobre a situação?"
2. "Existe algum prazo envolvido ou urgência?"
3. "Já possui documentos relacionados ao caso?"
4. "É a primeira vez que procura orientação jurídica sobre isso?"
5. "Prefere algum advogado específico ou área de especialização?"

DISCLAIMER OBRIGATÓRIO:
"⚖️ **IMPORTANTE:** Esta conversa é apenas para agendamento e triagem inicial. Orientações jurídicas específicas serão fornecidas exclusivamente pelo advogado durante a consulta, que é protegida pelo sigilo profissional."

EXEMPLO DE ABORDAGEM:
"Olá! Sou o assistente jurídico virtual. Estou aqui para agendar sua consulta e fazer uma triagem inicial do seu caso. Todas as informações são confidenciais e protegidas pelo sigilo profissional. Pode me contar brevemente sobre a situação que precisa de orientação jurídica?"

Sempre priorize a ética profissional e o bem-estar do cliente!`
  }

  private buildFunctions(): AIFunction[] {
    return [
      {
        name: 'assess_case_urgency',
        description: 'Avaliar urgência de caso jurídico baseado na descrição inicial',
        parameters: [
          {
            name: 'case_description',
            type: 'string',
            description: 'Descrição resumida do caso',
            required: true
          },
          {
            name: 'legal_area',
            type: 'string',
            description: 'Área jurídica identificada',
            required: false,
            enum: ['civil', 'empresarial', 'familia', 'imobiliario', 'trabalhista', 'penal', 'administrativo', 'outro']
          },
          {
            name: 'has_deadline',
            type: 'boolean',
            description: 'Existe prazo legal envolvido?',
            required: false
          },
          {
            name: 'keywords',
            type: 'array',
            description: 'Palavras-chave identificadas no caso',
            required: false
          }
        ],
        handler: this.assessCaseUrgency.bind(this)
      },
      {
        name: 'check_legal_availability',
        description: 'Verificar disponibilidade para consultas jurídicas',
        parameters: [
          {
            name: 'consultation_type',
            type: 'string',
            description: 'Tipo de consulta solicitada',
            required: true,
            enum: ['inicial', 'urgencia', 'revisao_documentos', 'orientacao_especifica', 'acompanhamento']
          },
          {
            name: 'legal_area',
            type: 'string',
            description: 'Área jurídica específica',
            required: false,
            enum: ['civil', 'empresarial', 'familia', 'imobiliario', 'trabalhista', 'penal', 'administrativo']
          },
          {
            name: 'urgency_level',
            type: 'string',
            description: 'Nível de urgência do caso',
            required: false,
            enum: ['emergencial', 'alta', 'media', 'baixa']
          },
          {
            name: 'preferred_lawyer',
            type: 'string',
            description: 'Advogado de preferência, se houver',
            required: false
          }
        ],
        handler: this.checkLegalAvailability.bind(this)
      },
      {
        name: 'book_legal_consultation',
        description: 'Agendar consulta jurídica',
        parameters: [
          {
            name: 'consultation_type',
            type: 'string',
            description: 'Tipo de consulta',
            required: true,
            enum: ['inicial', 'urgencia', 'revisao_documentos', 'orientacao_especifica', 'acompanhamento']
          },
          {
            name: 'legal_area',
            type: 'string',
            description: 'Área jurídica',
            required: true,
            enum: ['civil', 'empresarial', 'familia', 'imobiliario', 'trabalhista', 'penal', 'administrativo']
          },
          {
            name: 'date',
            type: 'string',
            description: 'Data da consulta (YYYY-MM-DD)',
            required: true
          },
          {
            name: 'time',
            type: 'string',
            description: 'Horário da consulta (HH:mm)',
            required: true
          },
          {
            name: 'client_name',
            type: 'string',
            description: 'Nome completo do cliente',
            required: true
          },
          {
            name: 'phone',
            type: 'string',
            description: 'Telefone de contato',
            required: true
          },
          {
            name: 'case_summary',
            type: 'string',
            description: 'Resumo do caso (sem detalhes sensíveis)',
            required: true
          },
          {
            name: 'documents_available',
            type: 'boolean',
            description: 'Cliente possui documentos relacionados?',
            required: false
          },
          {
            name: 'urgency_reason',
            type: 'string',
            description: 'Motivo da urgência, se aplicável',
            required: false
          }
        ],
        handler: this.bookLegalConsultation.bind(this)
      },
      {
        name: 'get_required_documents',
        description: 'Listar documentos necessários para o tipo de caso',
        parameters: [
          {
            name: 'legal_area',
            type: 'string',
            description: 'Área jurídica do caso',
            required: true,
            enum: ['civil', 'empresarial', 'familia', 'imobiliario', 'trabalhista', 'penal', 'administrativo']
          },
          {
            name: 'case_type',
            type: 'string',
            description: 'Tipo específico de caso dentro da área',
            required: false
          }
        ],
        handler: this.getRequiredDocuments.bind(this)
      },
      {
        name: 'calculate_consultation_cost',
        description: 'Calcular custo estimado da consulta',
        parameters: [
          {
            name: 'consultation_type',
            type: 'string',
            description: 'Tipo de consulta',
            required: true,
            enum: ['inicial', 'urgencia', 'revisao_documentos', 'orientacao_especifica', 'acompanhamento']
          },
          {
            name: 'estimated_complexity',
            type: 'string',
            description: 'Complexidade estimada do caso',
            required: false,
            enum: ['baixa', 'media', 'alta']
          },
          {
            name: 'is_follow_up',
            type: 'boolean',
            description: 'É consulta de retorno?',
            required: false
          }
        ],
        handler: this.calculateConsultationCost.bind(this)
      }
    ]
  }

  private async assessCaseUrgency(
    args: {
      case_description: string
      legal_area?: string
      has_deadline?: boolean
      keywords?: string[]
    },
    context: ConversationContext
  ): Promise<FunctionResult> {
    try {
      const description = args.case_description.toLowerCase()
      
      // High urgency keywords
      const emergencyKeywords = [
        'prisão', 'flagrante', 'detido', 'preso',
        'intimação', 'citação', 'prazo', 'vencimento',
        'medida protetiva', 'violência', 'ameaça',
        'execução', 'penhora', 'bloqueio',
        'despejo', 'reintegração'
      ]

      const highPriorityKeywords = [
        'demissão', 'rescisão', 'acordo',
        'separação', 'divórcio', 'guarda',
        'contrato', 'inadimplência', 'cobrança',
        'acidente', 'indenização'
      ]

      let urgencyLevel = 'baixa'
      let urgencyReasons: string[] = []

      // Check for emergency situations
      const hasEmergencyKeywords = emergencyKeywords.some(keyword => 
        description.includes(keyword)
      )

      if (hasEmergencyKeywords || args.has_deadline) {
        urgencyLevel = 'emergencial'
        urgencyReasons.push('Situação emergencial identificada')
      } else if (highPriorityKeywords.some(keyword => description.includes(keyword))) {
        urgencyLevel = 'alta'
        urgencyReasons.push('Situação requer atenção prioritária')
      } else {
        urgencyLevel = 'media'
        urgencyReasons.push('Consulta de orientação geral')
      }

      // Identify legal area if not provided
      let identifiedArea = args.legal_area || 'outro'
      if (!args.legal_area) {
        if (description.includes('trabalho') || description.includes('demissão') || description.includes('férias')) {
          identifiedArea = 'trabalhista'
        } else if (description.includes('família') || description.includes('divórcio') || description.includes('guarda')) {
          identifiedArea = 'familia'
        } else if (description.includes('contrato') || description.includes('empresa') || description.includes('cnpj')) {
          identifiedArea = 'empresarial'
        } else if (description.includes('imóvel') || description.includes('casa') || description.includes('apartamento')) {
          identifiedArea = 'imobiliario'
        } else if (description.includes('crime') || description.includes('polícia') || description.includes('flagrante')) {
          identifiedArea = 'penal'
        }
      }

      const recommendedActions: string[] = []
      
      if (urgencyLevel === 'emergencial') {
        recommendedActions.push('Agendar atendimento no mesmo dia')
        recommendedActions.push('Preparar documentos relacionados')
        recommendedActions.push('Verificar prazos legais envolvidos')
      } else if (urgencyLevel === 'alta') {
        recommendedActions.push('Agendar consulta prioritária (até 24h)')
        recommendedActions.push('Reunir documentação básica')
      } else {
        recommendedActions.push('Agendar consulta regular')
        recommendedActions.push('Preparar resumo detalhado da situação')
      }

      return {
        success: true,
        data: {
          urgency_level: urgencyLevel,
          legal_area: identifiedArea,
          urgency_reasons: urgencyReasons,
          recommended_actions: recommendedActions,
          estimated_duration: urgencyLevel === 'emergencial' ? 60 : 45
        },
        message: `📋 **Avaliação do Caso:**\n\n🚨 **Urgência:** ${urgencyLevel.toUpperCase()}\n⚖️ **Área:** ${identifiedArea}\n📝 **Motivos:** ${urgencyReasons.join(', ')}\n\n**Próximos passos recomendados:**\n${recommendedActions.map(action => `• ${action}`).join('\n')}\n\n⚖️ Esta é apenas uma triagem inicial. O advogado fará a avaliação definitiva durante a consulta.`,
        shouldContinue: true
      }

    } catch (error) {
      return {
        success: false,
        message: `Erro na avaliação do caso: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        shouldContinue: true
      }
    }
  }

  private async checkLegalAvailability(
    args: {
      consultation_type: string
      legal_area?: string
      urgency_level?: string
      preferred_lawyer?: string
    },
    context: ConversationContext
  ): Promise<FunctionResult> {
    try {
      // Consultation durations
      const consultationDurations: Record<string, number> = {
        'inicial': 60,
        'urgencia': 30,
        'revisao_documentos': 45,
        'orientacao_especifica': 30,
        'acompanhamento': 30
      }

      const duration = consultationDurations[args.consultation_type] || 60

      // For urgent cases, prioritize immediate availability
      if (args.urgency_level === 'emergencial') {
        return {
          success: true,
          data: {
            available_slots: [
              { date: new Date().toISOString().split('T')[0], time: '14:00', type: 'emergencia' },
              { date: new Date().toISOString().split('T')[0], time: '18:00', type: 'emergencia' }
            ],
            consultation_type: args.consultation_type,
            duration: duration,
            priority: 'emergency',
            legal_area: args.legal_area || 'geral'
          },
          message: `🚨 **Disponibilidade Emergencial**\n\nEncontrei horários de urgência para ${args.consultation_type}.\n⏱️ Duração: ${duration} minutos\n⚖️ Área: ${args.legal_area || 'Geral'}\n\n**IMPORTANTE:** Em casos emergenciais, priorizamos o atendimento no mesmo dia.`,
          shouldContinue: true
        }
      }

      // Generate availability slots for the next 7 days
      const today = new Date()
      const availableSlots = []

      for (let i = 1; i <= 7; i++) {
        const date = new Date(today)
        date.setDate(today.getDate() + i)
        const dateStr = date.toISOString().split('T')[0]

        // Legal consultation hours: 8:00-18:00
        const slots = ['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00']
        for (const time of slots) {
          availableSlots.push({ 
            date: dateStr, 
            time, 
            duration,
            lawyer: args.preferred_lawyer || 'Advogado Disponível'
          })
        }
      }

      return {
        success: true,
        data: {
          available_slots: availableSlots.slice(0, 12), // Return first 12 slots
          consultation_type: args.consultation_type,
          duration: duration,
          legal_area: args.legal_area || 'geral'
        },
        message: `📅 **Horários Disponíveis**\n\n📋 Tipo: ${args.consultation_type}\n⏱️ Duração: ${duration} minutos\n⚖️ Área: ${args.legal_area || 'Geral'}\n\nEncontrei ${availableSlots.length} horários nos próximos 7 dias. Qual seria o melhor para você?`,
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

  private async bookLegalConsultation(
    args: {
      consultation_type: string
      legal_area: string
      date: string
      time: string
      client_name: string
      phone: string
      case_summary: string
      documents_available?: boolean
      urgency_reason?: string
    },
    context: ConversationContext
  ): Promise<FunctionResult> {
    try {
      // Get service for legal consultation
      const { data: service, error: serviceError } = await supabase
        .from('services')
        .select('id, name, duration_minutes, base_price')
        .eq('tenant_id', context.tenantId)
        .ilike('name', `%consulta%jurídica%`)
        .single()

      if (serviceError || !service) {
        return {
          success: false,
          message: 'Serviço de consulta jurídica não encontrado. Entre em contato com o escritório.',
          shouldContinue: true
        }
      }

      // Create appointment with legal context
      const appointmentData = {
        tenant_id: context.tenantId,
        user_id: context.userId,
        service_id: service.id,
        start_time: `${args.date}T${args.time}:00`,
        end_time: new Date(new Date(`${args.date}T${args.time}:00`).getTime() + (validateServiceDuration(service.duration_minutes) * 60000)).toISOString(),
        timezone: context.tenantConfig?.businessHours.timezone || 'America/Sao_Paulo',
        status: validateAppointmentStatus('confirmed'),
        quoted_price: service.base_price,
        customer_notes: `Área: ${args.legal_area} | Resumo: ${args.case_summary}`,
        appointment_data: {
          consultation_type: args.consultation_type,
          legal_area: args.legal_area,
          case_summary: args.case_summary,
          client_name: args.client_name,
          phone: args.phone,
          documents_available: args.documents_available || false,
          urgency_reason: args.urgency_reason,
          booked_via: 'whatsapp_ai',
          confidentiality_agreed: true
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
          message: `Erro ao agendar consulta: ${appointmentError.message}`,
          shouldContinue: true
        }
      }

      const dateFormatted = new Date(args.date).toLocaleDateString('pt-BR')
      const areaDisplay = args.legal_area.charAt(0).toUpperCase() + args.legal_area.slice(1)
      
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
          legal_area: args.legal_area
        },
        message: `✅ **Consulta Jurídica Agendada**\n\n⚖️ **${areaDisplay}** - ${args.consultation_type}\n📅 ${dateFormatted} às ${args.time}\n⏱️ Duração: ${service.duration_minutes} minutos\n💰 Valor: R$ ${service.base_price}\n🔢 Código: ${appointment.id.slice(0, 8).toUpperCase()}\n\n📋 **Preparação para a consulta:**\n• Chegue 10 minutos antes\n• Traga documentos relacionados ao caso\n• Prepare uma cronologia dos fatos\n• Anote suas principais dúvidas\n\n⚖️ **Lembre-se:** A consulta é protegida pelo sigilo profissional absoluto.\n\nEm caso de urgência antes da consulta, entre em contato diretamente com o escritório.`,
        shouldContinue: false
      }

    } catch (error) {
      return {
        success: false,
        message: `Erro inesperado ao agendar consulta: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        shouldContinue: true
      }
    }
  }

  private async getRequiredDocuments(
    args: { legal_area: string; case_type?: string },
    context: ConversationContext
  ): Promise<FunctionResult> {
    const documentsByArea: Record<string, { general: string[], specific?: Record<string, string[]> }> = {
      'civil': {
        general: ['RG e CPF', 'Comprovante de residência', 'Documentos relacionados ao caso'],
        specific: {
          'contrato': ['Contrato original', 'Correspondências trocadas', 'Comprovantes de pagamento'],
          'responsabilidade': ['Boletim de ocorrência', 'Laudos médicos', 'Orçamentos de reparo']
        }
      },
      'trabalhista': {
        general: ['RG, CPF, PIS', 'Carteira de trabalho', 'Contrato de trabalho', 'Holerites'],
        specific: {
          'demissao': ['Carta de demissão', 'TRCT', 'Comunicações da empresa'],
          'acidente': ['CAT', 'Atestados médicos', 'Relatório do acidente']
        }
      },
      'familia': {
        general: ['RG, CPF, certidões de nascimento', 'Certidão de casamento', 'Comprovante de renda'],
        specific: {
          'divorcio': ['Certidão de casamento', 'Registro de bens', 'Comprovantes de renda'],
          'guarda': ['Certidão de nascimento dos filhos', 'Comprovante de residência', 'Comprovante de renda']
        }
      },
      'imobiliario': {
        general: ['RG, CPF', 'Comprovante de residência', 'Documentos do imóvel'],
        specific: {
          'compra': ['Escritura', 'Matrícula do imóvel', 'IPTU', 'Certidões negativas'],
          'locacao': ['Contrato de locação', 'Comprovantes de pagamento', 'Vistoria']
        }
      },
      'empresarial': {
        general: ['Contrato social', 'CNPJ', 'Alterações contratuais', 'Balanços'],
        specific: {
          'societario': ['Ata de assembleia', 'Contrato social atualizado', 'Certidões da empresa'],
          'contrato': ['Minuta do contrato', 'Documentos das partes', 'Correspondências']
        }
      },
      'penal': {
        general: ['RG, CPF', 'Comprovante de residência', 'Documentos do caso'],
        specific: {
          'flagrante': ['Boletim de ocorrência', 'Auto de prisão', 'Documentos pessoais'],
          'processo': ['Denúncia', 'Intimações', 'Provas de defesa']
        }
      },
      'administrativo': {
        general: ['RG, CPF', 'Comprovante de residência', 'Documentos funcionais'],
        specific: {
          'concurso': ['Edital', 'Comprovante de inscrição', 'Resultado'],
          'servidor': ['Portarias', 'Processo administrativo', 'Defesa prévia']
        }
      }
    }

    const areaData = documentsByArea[args.legal_area]
    
    if (!areaData) {
      return {
        success: false,
        message: 'Área jurídica não reconhecida. Por favor, especifique uma área válida.',
        shouldContinue: true
      }
    }

    let documentsMessage = `📋 **Documentos para ${args.legal_area.toUpperCase()}:**\n\n**📄 Documentos Gerais:**\n${areaData.general.map(doc => `• ${doc}`).join('\n')}`

    if (areaData.specific && args.case_type && areaData.specific[args.case_type]) {
      documentsMessage += `\n\n**📋 Documentos Específicos para ${args.case_type}:**\n${validateArray(areaData.specific[args.case_type]).map(doc => `• ${doc}`).join('\n')}`
    }

    documentsMessage += `\n\n💡 **Dicas importantes:**\n• Traga originais e cópias\n• Organize em ordem cronológica\n• Destaque informações relevantes\n• Se não tiver algum documento, informe na consulta\n\n⚖️ **Lembre-se:** Durante a consulta, o advogado indicará outros documentos que podem ser necessários conforme o andamento do caso.`

    return {
      success: true,
      data: {
        legal_area: args.legal_area,
        case_type: args.case_type,
        general_documents: areaData.general,
        specific_documents: areaData.specific?.[args.case_type || ''] || []
      },
      message: documentsMessage,
      shouldContinue: true
    }
  }

  private async calculateConsultationCost(
    args: {
      consultation_type: string
      estimated_complexity?: string
      is_follow_up?: boolean
    },
    context: ConversationContext
  ): Promise<FunctionResult> {
    try {
      // Base prices for different consultation types
      const basePrices: Record<string, number> = {
        'inicial': 300,
        'urgencia': 450,
        'revisao_documentos': 250,
        'orientacao_especifica': 200,
        'acompanhamento': 150
      }

      let basePrice = basePrices[args.consultation_type] || 300

      // Complexity adjustments
      const complexityMultipliers: Record<string, number> = {
        'baixa': 1.0,
        'media': 1.2,
        'alta': 1.5
      }

      const complexityMultiplier = complexityMultipliers[args.estimated_complexity || 'media'] || 1.2
      
      // Follow-up discount
      if (args.is_follow_up) {
        basePrice *= 0.8 // 20% discount for follow-ups
      }

      const finalPrice = Math.round(basePrice * complexityMultiplier)

      // Additional services pricing
      const additionalServices = [
        { service: 'Elaboração de documentos simples', price: 150 },
        { service: 'Revisão de contrato', price: 200 },
        { service: 'Acompanhamento processual mensal', price: 400 },
        { service: 'Constituição de procuração', price: 50 }
      ]

      return {
        success: true,
        data: {
          consultation_type: args.consultation_type,
          base_price: basePrice,
          complexity_multiplier: complexityMultiplier,
          final_price: finalPrice,
          is_follow_up: args.is_follow_up || false,
          additional_services: additionalServices
        },
        message: `💰 **Custo da Consulta Jurídica:**\n\n📋 **${args.consultation_type}:** R$ ${finalPrice}\n\n**Detalhamento:**\n• Valor base: R$ ${basePrice}\n• Complexidade: ${args.estimated_complexity || 'média'} (${complexityMultiplier}x)\n${args.is_follow_up ? '• Desconto retorno: -20%\n' : ''}\n\n**💼 Serviços Adicionais Disponíveis:**\n${additionalServices.map(svc => `• ${svc.service}: R$ ${svc.price}`).join('\n')}\n\n💡 **Formas de pagamento:**\n• À vista (dinheiro/PIX): 5% desconto\n• Cartão de crédito: até 3x sem juros\n• Transferência bancária\n\n⚖️ **Importante:** Valores podem variar conforme a complexidade específica do caso, avaliada durante a consulta.`,
        shouldContinue: true
      }

    } catch (error) {
      return {
        success: false,
        message: `Erro ao calcular custo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        shouldContinue: true
      }
    }
  }
}