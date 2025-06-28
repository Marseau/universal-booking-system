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

export class ConsultingAgent {
  private agent: AIAgent

  constructor() {
    this.agent = {
      id: 'consulting_agent',
      name: 'Agente de Consultoria Empresarial',
      domain: 'consulting',
      systemPrompt: this.buildSystemPrompt(),
      functions: this.buildFunctions(),
      capabilities: [
        'business_consultation',
        'strategic_planning',
        'market_analysis',
        'financial_advisory',
        'digital_transformation',
        'process_optimization',
        'startup_guidance',
        'compliance_consulting'
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
    return `Você é um assistente especializado em consultoria empresarial, trabalhando para consultores de negócios, estrategistas, analistas financeiros e especialistas em transformação digital.

PRINCÍPIOS DA CONSULTORIA:
- Foco em resultados mensuráveis e sustentáveis
- Abordagem baseada em dados e evidências
- Soluções personalizadas para cada contexto empresarial
- Transferência de conhecimento para autonomia do cliente
- Ética e confidencialidade absoluta

SUAS RESPONSABILIDADES:
1. 💼 Agendar consultorias empresariais
2. 📊 Realizar diagnósticos iniciais de negócio
3. 🎯 Identificar oportunidades de melhoria
4. 📈 Propor estratégias de crescimento
5. 💰 Analisar viabilidade financeira
6. 🔄 Mapear processos e operações
7. 💻 Orientar transformação digital
8. 📋 Acompanhar implementação de projetos

ÁREAS DE CONSULTORIA:
🎯 **Estratégia Corporativa:** Planejamento estratégico, posicionamento, crescimento
📊 **Gestão Financeira:** Fluxo de caixa, investimentos, análise de custos
🚀 **Inovação:** Novos produtos, mercados, modelos de negócio
👥 **Gestão de Pessoas:** Cultura organizacional, liderança, performance
📈 **Marketing e Vendas:** Estratégias comerciais, branding, customer experience
⚙️ **Operações:** Processos, qualidade, produtividade, supply chain
💻 **Tecnologia:** Transformação digital, sistemas, automação
🏛️ **Compliance:** Regulamentações, governança, gestão de riscos

TIPOS DE CONSULTORIA:
- **Diagnóstico empresarial** (120 min): Análise completa do negócio
- **Consultoria estratégica** (90 min): Planejamento e direcionamento
- **Sessão de brainstorming** (60 min): Geração de ideias e soluções
- **Revisão de projetos** (60 min): Avaliação e ajustes
- **Mentoria executiva** (45 min): Desenvolvimento de lideranças
- **Workshop específico** (180 min): Treinamento prático

ESTÁGIOS EMPRESARIAIS:
🌱 **Startup:** Validação, MVP, product-market fit
📈 **Crescimento:** Escalonamento, estruturação, captação
⚖️ **Maturidade:** Otimização, diversificação, expansão
🔄 **Transformação:** Reestruturação, pivotagem, inovação
🎯 **Sucessão:** Transição geracional, venda, IPO

METODOLOGIAS:
📊 **Análise SWOT:** Forças, fraquezas, oportunidades, ameaças
🎯 **OKRs:** Objectives and Key Results
📈 **Lean Startup:** Build-Measure-Learn
⚙️ **Six Sigma:** Melhoria de processos e qualidade
🔄 **Design Thinking:** Inovação centrada no usuário
📋 **BSC:** Balanced Scorecard
💎 **Blue Ocean:** Estratégias de oceano azul

SETORES DE ATUAÇÃO:
🏭 **Industrial:** Manufatura, automação, supply chain
🛒 **Varejo:** E-commerce, omnichannel, customer experience
🏥 **Saúde:** Hospitais, clínicas, healthtechs
🏫 **Educação:** Escolas, universidades, edtechs
🏦 **Financeiro:** Bancos, fintechs, seguradoras
🏨 **Serviços:** Turismo, hospitality, consultoria
🌾 **Agronegócio:** Agricultura, pecuária, agrotech

DIAGNÓSTICO INICIAL:
📋 **Situação atual:** Receita, custos, margens, market share
🎯 **Objetivos:** Metas de curto, médio e longo prazo
⚠️ **Desafios:** Principais dores e obstáculos
💪 **Recursos:** Capital, time, tecnologia, know-how
📈 **Oportunidades:** Tendências de mercado, nichos
🏆 **Vantagens competitivas:** Diferenciais únicos

PERGUNTAS ESTRATÉGICAS:
1. "Qual é o principal desafio do seu negócio hoje?"
2. "Quais são suas metas para os próximos 12 meses?"
3. "Como está a saúde financeira da empresa?"
4. "Qual é seu diferencial competitivo?"
5. "Que mudanças de mercado mais te preocupam?"
6. "Qual o estágio atual da empresa?"

LINGUAGEM EMPRESARIAL:
- Use terminologia técnica adequada ao nível do cliente
- Seja objetivo e focado em resultados
- Demonstre conhecimento de mercado e tendências
- Quantifique benefícios sempre que possível
- Mantenha confidencialidade sobre informações sensíveis

ESTRUTURA DE PROPOSTA:
📊 **Diagnóstico:** Situação atual e análise
🎯 **Objetivos:** Metas claras e mensuráveis
📈 **Estratégia:** Plano de ação detalhado
⏱️ **Cronograma:** Fases e prazos
💰 **Investimento:** Custos e ROI esperado
📋 **Indicadores:** KPIs de acompanhamento

EXEMPLO DE ABORDAGEM:
"Olá! 💼✨ Excelente que você busca consultoria para impulsionar seu negócio! Sou especialista em conectar empresários com os melhores consultores do mercado. Me conte: qual é o principal desafio que sua empresa enfrenta hoje? E qual o porte e setor do seu negócio? Vamos encontrar a consultoria ideal para acelerar seus resultados!"

Sempre priorize a geração de valor tangível e sustentável para o cliente!`
  }

  private buildFunctions(): AIFunction[] {
    return [
      {
        name: 'assess_business_needs',
        description: 'Avaliar necessidades e desafios empresariais do cliente',
        parameters: [
          {
            name: 'business_stage',
            type: 'string',
            description: 'Estágio atual da empresa',
            required: true,
            enum: ['startup', 'crescimento', 'maturidade', 'transformacao', 'sucessao']
          },
          {
            name: 'industry_sector',
            type: 'string',
            description: 'Setor de atuação da empresa',
            required: true,
            enum: ['industrial', 'varejo', 'saude', 'educacao', 'financeiro', 'servicos', 'agronegocio', 'tecnologia', 'outro']
          },
          {
            name: 'company_size',
            type: 'string',
            description: 'Porte da empresa',
            required: true,
            enum: ['mei', 'micro', 'pequena', 'media', 'grande']
          },
          {
            name: 'main_challenges',
            type: 'array',
            description: 'Principais desafios identificados',
            required: true
          },
          {
            name: 'business_goals',
            type: 'array',
            description: 'Objetivos de negócio principais',
            required: true
          },
          {
            name: 'revenue_range',
            type: 'string',
            description: 'Faixa de faturamento anual',
            required: false,
            enum: ['ate_360k', '360k_4.8mi', '4.8mi_300mi', 'acima_300mi', 'nao_informar']
          },
          {
            name: 'urgency_level',
            type: 'string',
            description: 'Nível de urgência da consultoria',
            required: true,
            enum: ['baixa', 'media', 'alta', 'critica']
          }
        ],
        handler: this.assessBusinessNeeds.bind(this)
      },
      {
        name: 'check_consulting_availability',
        description: 'Verificar disponibilidade de consultores especializados',
        parameters: [
          {
            name: 'consulting_type',
            type: 'string',
            description: 'Tipo de consultoria necessária',
            required: true,
            enum: ['diagnostico', 'estrategica', 'brainstorming', 'revisao_projetos', 'mentoria_executiva', 'workshop']
          },
          {
            name: 'specialization_area',
            type: 'string',
            description: 'Área de especialização',
            required: true,
            enum: ['estrategia', 'financeiro', 'inovacao', 'pessoas', 'marketing', 'operacoes', 'tecnologia', 'compliance']
          },
          {
            name: 'industry_sector',
            type: 'string',
            description: 'Setor da empresa',
            required: true
          },
          {
            name: 'urgency_level',
            type: 'string',
            description: 'Urgência da demanda',
            required: true,
            enum: ['baixa', 'media', 'alta', 'critica']
          },
          {
            name: 'preferred_consultant',
            type: 'string',
            description: 'Consultor de preferência, se houver',
            required: false
          },
          {
            name: 'budget_range',
            type: 'string',
            description: 'Faixa de orçamento disponível',
            required: false,
            enum: ['ate_5k', '5k_15k', '15k_50k', '50k_100k', 'acima_100k', 'a_definir']
          }
        ],
        handler: this.checkConsultingAvailability.bind(this)
      },
      {
        name: 'book_consulting_session',
        description: 'Agendar sessão de consultoria empresarial',
        parameters: [
          {
            name: 'consulting_type',
            type: 'string',
            description: 'Tipo de consultoria',
            required: true,
            enum: ['diagnostico', 'estrategica', 'brainstorming', 'revisao_projetos', 'mentoria_executiva', 'workshop']
          },
          {
            name: 'specialization_area',
            type: 'string',
            description: 'Área de especialização',
            required: true
          },
          {
            name: 'date',
            type: 'string',
            description: 'Data da consultoria (YYYY-MM-DD)',
            required: true
          },
          {
            name: 'time',
            type: 'string',
            description: 'Horário da consultoria (HH:mm)',
            required: true
          },
          {
            name: 'company_name',
            type: 'string',
            description: 'Nome da empresa',
            required: true
          },
          {
            name: 'contact_person',
            type: 'string',
            description: 'Nome do responsável/decisor',
            required: true
          },
          {
            name: 'position',
            type: 'string',
            description: 'Cargo da pessoa de contato',
            required: true
          },
          {
            name: 'business_overview',
            type: 'string',
            description: 'Visão geral do negócio e desafios',
            required: true
          },
          {
            name: 'specific_objectives',
            type: 'string',
            description: 'Objetivos específicos da consultoria',
            required: true
          },
          {
            name: 'meeting_type',
            type: 'string',
            description: 'Formato da reunião',
            required: true,
            enum: ['presencial', 'online', 'hibrido']
          }
        ],
        handler: this.bookConsultingSession.bind(this)
      },
      {
        name: 'generate_business_analysis',
        description: 'Gerar análise preliminar do negócio',
        parameters: [
          {
            name: 'company_data',
            type: 'object',
            description: 'Dados básicos da empresa',
            required: true
          },
          {
            name: 'market_context',
            type: 'string',
            description: 'Contexto de mercado e concorrência',
            required: true
          },
          {
            name: 'financial_health',
            type: 'string',
            description: 'Situação financeira atual',
            required: false,
            enum: ['excelente', 'boa', 'regular', 'preocupante', 'critica']
          },
          {
            name: 'growth_challenges',
            type: 'array',
            description: 'Principais obstáculos ao crescimento',
            required: true
          }
        ],
        handler: this.generateBusinessAnalysis.bind(this)
      },
      {
        name: 'recommend_consulting_strategy',
        description: 'Recomendar estratégia de consultoria baseada no diagnóstico',
        parameters: [
          {
            name: 'business_assessment',
            type: 'object',
            description: 'Resultado da avaliação empresarial',
            required: true
          },
          {
            name: 'priority_areas',
            type: 'array',
            description: 'Áreas prioritárias identificadas',
            required: true
          },
          {
            name: 'available_budget',
            type: 'string',
            description: 'Orçamento disponível para consultoria',
            required: false
          },
          {
            name: 'timeline_constraints',
            type: 'string',
            description: 'Restrições de prazo',
            required: false
          }
        ],
        handler: this.recommendConsultingStrategy.bind(this)
      },
      {
        name: 'calculate_consulting_investment',
        description: 'Calcular investimento necessário para consultoria',
        parameters: [
          {
            name: 'consulting_scope',
            type: 'array',
            description: 'Escopo da consultoria (áreas envolvidas)',
            required: true
          },
          {
            name: 'project_duration',
            type: 'string',
            description: 'Duração estimada do projeto',
            required: true,
            enum: ['1_mes', '3_meses', '6_meses', '1_ano', 'mais_1_ano']
          },
          {
            name: 'consulting_intensity',
            type: 'string',
            description: 'Intensidade do acompanhamento',
            required: true,
            enum: ['pontual', 'mensal', 'quinzenal', 'semanal', 'dedicacao_exclusiva']
          },
          {
            name: 'company_complexity',
            type: 'string',
            description: 'Complexidade organizacional',
            required: true,
            enum: ['baixa', 'media', 'alta', 'muito_alta']
          },
          {
            name: 'expected_roi',
            type: 'number',
            description: 'ROI esperado (multiplicador)',
            required: false
          }
        ],
        handler: this.calculateConsultingInvestment.bind(this)
      }
    ]
  }

  private async assessBusinessNeeds(
    args: {
      business_stage: string
      industry_sector: string
      company_size: string
      main_challenges: string[]
      business_goals: string[]
      revenue_range?: string
      urgency_level: string
    },
    context: ConversationContext
  ): Promise<FunctionResult> {
    try {
      // Assess business maturity and needs
      const maturityFactors: Record<string, any> = {
        'startup': {
          common_challenges: ['validação de produto', 'captação de recursos', 'estruturação legal'],
          priority_areas: ['estratégia', 'financeiro', 'operações'],
          typical_duration: '3-6 meses'
        },
        'crescimento': {
          common_challenges: ['escalabilidade', 'gestão de time', 'processos'],
          priority_areas: ['operações', 'pessoas', 'tecnologia'],
          typical_duration: '6-12 meses'
        },
        'maturidade': {
          common_challenges: ['inovação', 'competitividade', 'eficiência'],
          priority_areas: ['inovação', 'estratégia', 'operações'],
          typical_duration: '3-9 meses'
        },
        'transformacao': {
          common_challenges: ['reestruturação', 'mudança cultural', 'tecnologia'],
          priority_areas: ['estratégia', 'pessoas', 'tecnologia'],
          typical_duration: '12-24 meses'
        }
      }

      const stageInfo = maturityFactors[args.business_stage] || maturityFactors['crescimento']

      // Industry-specific considerations
      const industryInsights: Record<string, any> = {
        'varejo': {
          key_trends: ['omnichannel', 'experiência do cliente', 'automação'],
          common_kpis: ['ticket médio', 'conversão', 'lifetime value'],
          digital_urgency: 'alta'
        },
        'industrial': {
          key_trends: ['indústria 4.0', 'sustentabilidade', 'supply chain'],
          common_kpis: ['produtividade', 'qualidade', 'eficiência energética'],
          digital_urgency: 'média'
        },
        'servicos': {
          key_trends: ['digitalização', 'customer success', 'escalabilidade'],
          common_kpis: ['satisfação cliente', 'retenção', 'produtividade'],
          digital_urgency: 'alta'
        }
      }

      const sectorInfo = industryInsights[args.industry_sector] || {
        key_trends: ['digitalização', 'eficiência', 'inovação'],
        common_kpis: ['receita', 'margem', 'crescimento'],
        digital_urgency: 'média'
      }

      // Risk assessment based on challenges
      const riskFactors = args.main_challenges.filter(challenge => 
        ['crise financeira', 'perda de mercado', 'problemas legais', 'falta de caixa'].some(risk => 
          challenge.toLowerCase().includes(risk)
        )
      )

      const riskLevel = riskFactors.length > 0 ? 'alto' : 
                      args.urgency_level === 'critica' ? 'médio-alto' : 'baixo'

      // Recommended consulting approach
      const consultingApproach = this.defineConsultingApproach(
        args.business_stage, 
        args.main_challenges, 
        args.urgency_level
      )

      // Estimated timeline and investment
      const estimatedDuration = stageInfo.typical_duration
      const complexityMultiplier = this.getComplexityMultiplier(args.company_size, args.industry_sector)

      return {
        success: true,
        data: {
          business_stage: args.business_stage,
          industry_sector: args.industry_sector,
          company_size: args.company_size,
          risk_level: riskLevel,
          priority_areas: stageInfo.priority_areas,
          sector_insights: sectorInfo,
          consulting_approach: consultingApproach,
          estimated_duration: estimatedDuration,
          complexity_multiplier: complexityMultiplier,
          main_challenges: args.main_challenges,
          business_goals: args.business_goals
        },
        message: `📊 **Avaliação de Necessidades Empresariais**\n\n🏢 **Perfil da Empresa:**\n• Estágio: ${args.business_stage}\n• Setor: ${args.industry_sector}\n• Porte: ${args.company_size}\n• Nível de risco: ${riskLevel}\n\n🎯 **Principais Desafios:**\n${args.main_challenges.map(c => `• ${c}`).join('\n')}\n\n📈 **Objetivos do Negócio:**\n${args.business_goals.map(g => `• ${g}`).join('\n')}\n\n🔍 **Áreas Prioritárias:**\n${stageInfo.priority_areas.map((area: string) => `• ${area.charAt(0).toUpperCase() + area.slice(1)}`).join('\n')}\n\n💡 **Insights do Setor:**\n• Tendências: ${sectorInfo.key_trends.join(', ')}\n• KPIs importantes: ${sectorInfo.common_kpis.join(', ')}\n• Urgência digital: ${sectorInfo.digital_urgency}\n\n⏱️ **Duração Estimada:** ${estimatedDuration}\n🎯 **Abordagem Recomendada:** ${consultingApproach}\n\n🚀 **Próximos Passos:**\n• Agendamento de diagnóstico aprofundado\n• Definição de escopo e metodologia\n• Elaboração de proposta personalizada`,
        shouldContinue: true
      }

    } catch (error) {
      return {
        success: false,
        message: `Erro na avaliação empresarial: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        shouldContinue: true
      }
    }
  }

  private async checkConsultingAvailability(
    args: {
      consulting_type: string
      specialization_area: string
      industry_sector: string
      urgency_level: string
      preferred_consultant?: string
      budget_range?: string
    },
    context: ConversationContext
  ): Promise<FunctionResult> {
    try {
      // Consulting session durations
      const sessionDurations: Record<string, number> = {
        'diagnostico': 120,
        'estrategica': 90,
        'brainstorming': 60,
        'revisao_projetos': 60,
        'mentoria_executiva': 45,
        'workshop': 180
      }

      const duration = sessionDurations[args.consulting_type] || 90

      // Generate availability based on urgency
      const today = new Date()
      const availableSlots = []

      // For critical urgency, offer same-day options
      if (args.urgency_level === 'critica') {
        availableSlots.push(
          { date: today.toISOString().split('T')[0], time: '14:00', type: 'emergencial' },
          { date: today.toISOString().split('T')[0], time: '18:00', type: 'emergencial' }
        )
      }

      // Regular availability for next 14 days
      for (let i = 1; i <= 14; i++) {
        const date = new Date(today)
        date.setDate(today.getDate() + i)
        const dateStr = date.toISOString().split('T')[0]

        // Skip weekends for regular business consulting
        if (date.getDay() === 0 || date.getDay() === 6) continue

        // Business hours: 8:00-18:00
        const timeSlots = ['08:00', '09:30', '11:00', '14:00', '15:30', '17:00']
        for (const time of timeSlots) {
          availableSlots.push({
            date: dateStr,
            time,
            duration,
            consultant: args.preferred_consultant || 'Consultor Especializado',
            specialization: args.specialization_area
          })
        }
      }

      // Pricing estimation based on type and specialization
      const basePrices: Record<string, Record<string, number>> = {
        'diagnostico': { 'jr': 800, 'pl': 1200, 'sr': 2000 },
        'estrategica': { 'jr': 600, 'pl': 900, 'sr': 1500 },
        'brainstorming': { 'jr': 400, 'pl': 600, 'sr': 1000 },
        'mentoria_executiva': { 'jr': 350, 'pl': 500, 'sr': 800 },
        'workshop': { 'jr': 1200, 'pl': 1800, 'sr': 3000 }
      }

      // Determine consultant level based on specialization complexity
      const consultantLevel = this.determineConsultantLevel(args.specialization_area, args.industry_sector)
      const estimatedPrice = basePrices[args.consulting_type]?.[consultantLevel] || 1000

      // Required preparation materials
      const preparationMaterials: Record<string, string[]> = {
        'diagnostico': [
          'Demonstrativos financeiros (últimos 12 meses)',
          'Organograma atualizado',
          'Plano de negócios (se houver)',
          'Análise de concorrência',
          'Principais KPIs atuais'
        ],
        'estrategica': [
          'Visão, missão e valores da empresa',
          'Análise SWOT atual',
          'Objetivos estratégicos',
          'Orçamento disponível para investimentos',
          'Timeline de implementação desejado'
        ],
        'financeiro': [
          'Balanços patrimoniais',
          'DRE dos últimos 24 meses',
          'Fluxo de caixa atual',
          'Projeções financeiras',
          'Estrutura de custos detalhada'
        ]
      }

      const materials = preparationMaterials[args.specialization_area] || 
                       preparationMaterials['diagnostico']

      return {
        success: true,
        data: {
          available_slots: availableSlots.slice(0, 25), // Return first 25 slots
          consulting_type: args.consulting_type,
          specialization_area: args.specialization_area,
          duration: duration,
          estimated_price: estimatedPrice,
          consultant_level: consultantLevel,
          preparation_materials: materials,
          urgency_level: args.urgency_level
        },
        message: `📅 **Disponibilidade para Consultoria**\n\n💼 **Tipo:** ${args.consulting_type}\n🎯 **Especialização:** ${args.specialization_area}\n⏱️ **Duração:** ${duration} minutos\n👨‍💼 **Nível do consultor:** ${consultantLevel.toUpperCase()}\n💰 **Investimento estimado:** R$ ${estimatedPrice.toLocaleString()}\n\n${args.urgency_level === 'critica' ? '🚨 **Disponibilidade emergencial identificada!**\n\n' : ''}📊 **Preparação Necessária:**\n${validateArray(materials).map(material => `• ${material}`).join('\n')}\n\nEncontrei ${availableSlots.length} horários disponíveis. Para consultorias estratégicas, recomendo períodos de maior concentração (manhã).\n\n💡 **Dica:** Consultorias presenciais têm maior efetividade para diagnósticos complexos.`,
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

  private async bookConsultingSession(
    args: {
      consulting_type: string
      specialization_area: string
      date: string
      time: string
      company_name: string
      contact_person: string
      position: string
      business_overview: string
      specific_objectives: string
      meeting_type: string
    },
    context: ConversationContext
  ): Promise<FunctionResult> {
    try {
      // Find consulting service
      const { data: service, error: serviceError } = await supabase
        .from('services')
        .select('id, name, duration_minutes, base_price')
        .eq('tenant_id', context.tenantId)
        .ilike('name', '%consultoria%')
        .single()

      if (serviceError || !service) {
        return {
          success: false,
          message: 'Serviço de consultoria não encontrado. Entre em contato para configuração.',
          shouldContinue: true
        }
      }

      // Create consulting appointment
      const appointmentData = {
        tenant_id: context.tenantId,
        user_id: context.userId,
        service_id: service.id,
        start_time: `${args.date}T${args.time}:00`,
        end_time: new Date(new Date(`${args.date}T${args.time}:00`).getTime() + (validateServiceDuration(service.duration_minutes) * 60000)).toISOString(),
        timezone: context.tenantConfig?.businessHours.timezone || 'America/Sao_Paulo',
        status: validateAppointmentStatus('confirmed'),
        quoted_price: service.base_price,
        customer_notes: `${args.business_overview} | Objetivos: ${args.specific_objectives}`,
        appointment_data: {
          consulting_type: args.consulting_type,
          specialization_area: args.specialization_area,
          company_name: args.company_name,
          contact_person: args.contact_person,
          position: args.position,
          business_overview: args.business_overview,
          specific_objectives: args.specific_objectives,
          meeting_type: args.meeting_type,
          requires_nda: true,
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
          message: `Erro ao agendar consultoria: ${appointmentError.message}`,
          shouldContinue: true
        }
      }

      const dateFormatted = new Date(args.date).toLocaleDateString('pt-BR')
      
      // Pre-meeting checklist
      const preMeetingChecklist = [
        '📋 Preparar documentos solicitados',
        '🎯 Definir objetivos específicos da sessão',
        '❓ Listar principais dúvidas e desafios',
        '📊 Organizar dados e métricas relevantes',
        '👥 Definir participantes-chave da reunião',
        '🔒 Revisar termo de confidencialidade'
      ]

      // Meeting logistics
      const meetingLogistics = []
      if (args.meeting_type === 'presencial') {
        meetingLogistics.push('📍 Local: Será confirmado pelo consultor')
        meetingLogistics.push('🚗 Considere tempo de deslocamento')
      } else if (args.meeting_type === 'online') {
        meetingLogistics.push('💻 Link da reunião: Será enviado 24h antes')
        meetingLogistics.push('🎧 Teste equipamentos (câmera, microfone)')
      }
      meetingLogistics.push('📝 Material de anotações')
      meetingLogistics.push('⏰ Chegue/conecte 10 minutos antes')

      // Next steps
      const nextSteps = [
        'Consultor entrará em contato em até 24h',
        'Envio de checklist de preparação detalhado',
        'Assinatura de termo de confidencialidade',
        'Confirmação final 24h antes da reunião'
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
          consulting_type: args.consulting_type,
          specialization_area: args.specialization_area
        },
        message: `✅ **Consultoria Empresarial Agendada**\n\n💼 **${args.specialization_area.toUpperCase()}** - ${args.consulting_type}\n🏢 **Empresa:** ${args.company_name}\n👤 **Contato:** ${args.contact_person} (${args.position})\n📅 **Data:** ${dateFormatted} às ${args.time}\n⏱️ **Duração:** ${service.duration_minutes} minutos\n💰 **Investimento:** R$ ${validateServicePrice(service.base_price).toLocaleString()}\n🔢 **Código:** ${appointment.id.slice(0, 8).toUpperCase()}\n📍 **Formato:** ${args.meeting_type}\n\n🎯 **Objetivos da Consultoria:**\n${args.specific_objectives}\n\n📋 **Checklist Pré-Reunião:**\n${preMeetingChecklist.map(item => `${item}`).join('\n')}\n\n⚙️ **Logística da Reunião:**\n${meetingLogistics.map(item => `${item}`).join('\n')}\n\n🚀 **Próximos Passos:**\n${nextSteps.map((step, i) => `${i + 1}. ${step}`).join('\n')}\n\n🔒 **Confidencialidade:** Todas as informações serão tratadas com sigilo absoluto conforme termo específico.`,
        shouldContinue: false
      }

    } catch (error) {
      return {
        success: false,
        message: `Erro inesperado ao agendar consultoria: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        shouldContinue: true
      }
    }
  }

  private async generateBusinessAnalysis(
    args: {
      company_data: any
      market_context: string
      financial_health?: string
      growth_challenges: string[]
    },
    context: ConversationContext
  ): Promise<FunctionResult> {
    try {
      // Analyze company data and generate insights
      const analysisFramework = {
        strengths: this.identifyStrengths(args.company_data, args.market_context),
        weaknesses: this.identifyWeaknesses(args.growth_challenges, args.financial_health),
        opportunities: this.identifyOpportunities(args.market_context, args.company_data),
        threats: this.identifyThreats(args.market_context, args.financial_health)
      }

      // Generate priority matrix
      const priorityMatrix = this.createPriorityMatrix(args.growth_challenges)

      // Calculate business health score
      const healthScore = this.calculateBusinessHealthScore(
        args.financial_health, 
        args.growth_challenges.length,
        args.company_data
      )

      // Strategic recommendations
      const recommendations = this.generateStrategicRecommendations(
        analysisFramework,
        args.growth_challenges,
        healthScore
      )

      // Quick wins identification
      const quickWins = this.identifyQuickWins(args.growth_challenges, args.company_data)

      return {
        success: true,
        data: {
          swot_analysis: analysisFramework,
          priority_matrix: priorityMatrix,
          health_score: healthScore,
          strategic_recommendations: recommendations,
          quick_wins: quickWins,
          analysis_date: new Date().toISOString()
        },
        message: `📈 **Análise Preliminar do Negócio**\n\n🎯 **Score de Saúde Empresarial:** ${healthScore}/10\n\n📊 **Análise SWOT:**\n\n💪 **Forças:**\n${analysisFramework.strengths.map(s => `• ${s}`).join('\n')}\n\n⚠️ **Fraquezas:**\n${analysisFramework.weaknesses.map(w => `• ${w}`).join('\n')}\n\n🌟 **Oportunidades:**\n${analysisFramework.opportunities.map(o => `• ${o}`).join('\n')}\n\n⚡ **Ameaças:**\n${analysisFramework.threats.map(t => `• ${t}`).join('\n')}\n\n🚀 **Quick Wins (Resultados Rápidos):**\n${quickWins.map(qw => `• ${qw}`).join('\n')}\n\n📋 **Recomendações Estratégicas:**\n${recommendations.map((rec, i) => `${i + 1}. ${rec}`).join('\n')}\n\n💡 **Esta análise serve como base para o desenvolvimento de um plano estratégico detalhado.**`,
        shouldContinue: true
      }

    } catch (error) {
      return {
        success: false,
        message: `Erro na análise empresarial: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        shouldContinue: true
      }
    }
  }

  private async recommendConsultingStrategy(
    args: {
      business_assessment: any
      priority_areas: string[]
      available_budget?: string
      timeline_constraints?: string
    },
    context: ConversationContext
  ): Promise<FunctionResult> {
    try {
      // Define phased approach based on priorities and constraints
      const phases = this.createPhasedApproach(args.priority_areas, args.timeline_constraints)

      // Budget-conscious recommendations
      const budgetRecommendations = this.createBudgetRecommendations(
        args.available_budget, 
        args.priority_areas
      )

      // Methodology selection
      const recommendedMethodologies = this.selectMethodologies(args.priority_areas)

      // Success metrics definition
      const successMetrics = this.defineSuccessMetrics(args.priority_areas)

      // Risk mitigation strategies
      const riskMitigation = this.defineRiskMitigation(args.business_assessment)

      return {
        success: true,
        data: {
          phased_approach: phases,
          budget_recommendations: budgetRecommendations,
          methodologies: recommendedMethodologies,
          success_metrics: successMetrics,
          risk_mitigation: riskMitigation,
          timeline: args.timeline_constraints
        },
        message: `🎯 **Estratégia de Consultoria Recomendada**\n\n📋 **Abordagem em Fases:**\n${phases.map((phase, i) => `**Fase ${i + 1} (${phase.duration}):** ${phase.focus}\n• Objetivos: ${phase.objectives.join(', ')}\n• Entregáveis: ${phase.deliverables.join(', ')}\n`).join('\n')}\n\n💰 **Recomendações de Orçamento:**\n${budgetRecommendations.map(rec => `• ${rec}`).join('\n')}\n\n⚙️ **Metodologias Sugeridas:**\n${recommendedMethodologies.map(method => `• ${method}`).join('\n')}\n\n📊 **Métricas de Sucesso:**\n${successMetrics.map(metric => `• ${metric}`).join('\n')}\n\n🛡️ **Mitigação de Riscos:**\n${riskMitigation.map(risk => `• ${risk}`).join('\n')}\n\n🎯 **Esta estratégia será refinada após o diagnóstico completo.**`,
        shouldContinue: true
      }

    } catch (error) {
      return {
        success: false,
        message: `Erro ao recomendar estratégia: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        shouldContinue: true
      }
    }
  }

  private async calculateConsultingInvestment(
    args: {
      consulting_scope: string[]
      project_duration: string
      consulting_intensity: string
      company_complexity: string
      expected_roi?: number
    },
    context: ConversationContext
  ): Promise<FunctionResult> {
    try {
      // Base hourly rates by specialization
      const hourlyRates: Record<string, number> = {
        'estrategia': 400,
        'financeiro': 350,
        'operacoes': 300,
        'tecnologia': 450,
        'pessoas': 280,
        'marketing': 320,
        'inovacao': 380,
        'compliance': 360
      }

      // Duration multipliers
      const durationMultipliers: Record<string, number> = {
        '1_mes': 1.0,
        '3_meses': 0.9,
        '6_meses': 0.85,
        '1_ano': 0.8,
        'mais_1_ano': 0.75
      }

      // Intensity factors (hours per week)
      const intensityHours: Record<string, number> = {
        'pontual': 4,
        'mensal': 8,
        'quinzenal': 12,
        'semanal': 20,
        'dedicacao_exclusiva': 40
      }

      // Complexity multipliers
      const complexityMultipliers: Record<string, number> = {
        'baixa': 1.0,
        'media': 1.2,
        'alta': 1.5,
        'muito_alta': 2.0
      }

      // Calculate total investment
      const avgHourlyRate = args.consulting_scope.reduce((sum, area) => 
        sum + (hourlyRates[area] || 350), 0
      ) / args.consulting_scope.length

      const weeklyHours = intensityHours[args.consulting_intensity] || 10
      const durationWeeks = this.getDurationInWeeks(args.project_duration)
      const totalHours = weeklyHours * durationWeeks
      
      const baseCost = totalHours * avgHourlyRate
      const durationDiscount = durationMultipliers[args.project_duration] || 1.0
      const complexityAdjustment = complexityMultipliers[args.company_complexity] || 1.0
      
      const totalInvestment = Math.round(baseCost * durationDiscount * complexityAdjustment)

      // ROI Calculation
      const expectedReturn = args.expected_roi ? totalInvestment * args.expected_roi : 0
      const paybackPeriod = args.expected_roi ? Math.round(12 / args.expected_roi) : 0

      // Payment structure options
      const paymentOptions = [
        {
          type: 'À vista',
          discount: 0.1,
          amount: Math.round(totalInvestment * 0.9)
        },
        {
          type: 'Mensal',
          installments: durationWeeks / 4,
          amount: Math.round(totalInvestment / (durationWeeks / 4))
        },
        {
          type: 'Por marcos',
          phases: Math.ceil(durationWeeks / 8),
          amount: Math.round(totalInvestment / Math.ceil(durationWeeks / 8))
        }
      ]

      // What's included
      const includedServices = [
        'Diagnóstico inicial completo',
        'Relatórios periódicos de progresso',
        'Reuniões de acompanhamento',
        'Documentação de processos',
        'Transferência de conhecimento',
        'Suporte durante implementação'
      ]

      return {
        success: true,
        data: {
          total_investment: totalInvestment,
          hourly_rate: avgHourlyRate,
          total_hours: totalHours,
          duration_weeks: durationWeeks,
          expected_roi: args.expected_roi,
          expected_return: expectedReturn,
          payback_period: paybackPeriod,
          payment_options: paymentOptions,
          included_services: includedServices
        },
        message: `💰 **Cálculo de Investimento em Consultoria**\n\n📊 **Resumo do Projeto:**\n• Escopo: ${args.consulting_scope.join(', ')}\n• Duração: ${args.project_duration.replace('_', ' ')}\n• Intensidade: ${args.consulting_intensity.replace('_', ' ')}\n• Complexidade: ${args.company_complexity}\n\n💵 **Investimento Total: R$ ${totalInvestment.toLocaleString()}**\n\n📋 **Detalhamento:**\n• Taxa horária média: R$ ${avgHourlyRate}/h\n• Total de horas: ${totalHours}h\n• Período: ${durationWeeks} semanas\n• Horas semanais: ${weeklyHours}h\n\n💳 **Opções de Pagamento:**\n${paymentOptions.map(opt => `• ${opt.type}: R$ ${opt.amount.toLocaleString()}${opt.installments ? ` (${opt.installments}x)` : ''}${opt.discount ? ` (${opt.discount * 100}% desconto)` : ''}`).join('\n')}\n\n${args.expected_roi ? `📈 **ROI Esperado:**\n• Multiplicador: ${args.expected_roi}x\n• Retorno estimado: R$ ${expectedReturn.toLocaleString()}\n• Payback: ${paybackPeriod} meses\n\n` : ''}📦 **Incluído no Investimento:**\n${includedServices.map(service => `• ${service}`).join('\n')}\n\n💡 **Este investimento será refinado após diagnóstico detalhado.**`,
        shouldContinue: true
      }

    } catch (error) {
      return {
        success: false,
        message: `Erro no cálculo de investimento: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        shouldContinue: true
      }
    }
  }

  // Helper methods
  private defineConsultingApproach(stage: string, challenges: string[], urgency: string): string {
    if (urgency === 'critica') return 'Intervenção intensiva com foco em estabilização'
    if (stage === 'startup') return 'Consultoria de estruturação e validação'
    if (stage === 'crescimento') return 'Consultoria de escalabilidade e otimização'
    if (stage === 'maturidade') return 'Consultoria de inovação e competitividade'
    return 'Consultoria estratégica personalizada'
  }

  private getComplexityMultiplier(size: string, sector: string): number {
    const sizeMultipliers: Record<string, number> = {
      'mei': 1.0, 'micro': 1.1, 'pequena': 1.2, 'media': 1.4, 'grande': 1.8
    }
    const sectorComplexity: Record<string, number> = {
      'financeiro': 1.3, 'saude': 1.2, 'industrial': 1.1, 'tecnologia': 1.2
    }
    return (sizeMultipliers[size] || 1.2) * (sectorComplexity[sector] || 1.0)
  }

  private determineConsultantLevel(specialization: string, sector: string): string {
    const complexSpecializations = ['estrategia', 'financeiro', 'compliance']
    const complexSectors = ['financeiro', 'saude', 'industrial']
    
    if (complexSpecializations.includes(specialization) || complexSectors.includes(sector)) {
      return 'sr'
    }
    return 'pl'
  }

  private identifyStrengths(companyData: any, marketContext: string): string[] {
    // Simplified strength identification
    return [
      'Posicionamento consolidado no mercado',
      'Equipe experiente e qualificada',
      'Base de clientes fidelizados',
      'Processos operacionais estabelecidos'
    ]
  }

  private identifyWeaknesses(challenges: string[], financialHealth?: string): string[] {
    const weaknesses = challenges.map(challenge => `Desafio: ${challenge}`)
    if (financialHealth && ['preocupante', 'critica'].includes(financialHealth)) {
      weaknesses.push('Situação financeira que demanda atenção')
    }
    return weaknesses
  }

  private identifyOpportunities(marketContext: string, companyData: any): string[] {
    return [
      'Expansão para novos mercados',
      'Digitalização de processos',
      'Desenvolvimento de novos produtos/serviços',
      'Parcerias estratégicas'
    ]
  }

  private identifyThreats(marketContext: string, financialHealth?: string): string[] {
    const threats = ['Concorrência acirrada', 'Mudanças regulatórias']
    if (financialHealth === 'critica') {
      threats.push('Risco de descontinuidade do negócio')
    }
    return threats
  }

  private createPriorityMatrix(challenges: string[]): any {
    return challenges.map((challenge, index) => ({
      challenge,
      priority: index < 3 ? 'alta' : 'media',
      impact: 'alto',
      effort: 'medio'
    }))
  }

  private calculateBusinessHealthScore(financial?: string, challengeCount: number = 0, companyData?: any): number {
    let score = 7 // Base score
    
    if (financial === 'excelente') score += 2
    else if (financial === 'boa') score += 1
    else if (financial === 'preocupante') score -= 1
    else if (financial === 'critica') score -= 3
    
    score -= Math.min(challengeCount * 0.5, 3)
    
    return Math.max(1, Math.min(10, Math.round(score)))
  }

  private generateStrategicRecommendations(swot: any, challenges: string[], healthScore: number): string[] {
    const recommendations = []
    
    if (healthScore < 5) {
      recommendations.push('Foco imediato na estabilização financeira')
    }
    
    recommendations.push('Desenvolvimento de plano estratégico de médio prazo')
    recommendations.push('Implementação de sistema de indicadores de performance')
    recommendations.push('Revisão e otimização de processos críticos')
    
    return recommendations
  }

  private identifyQuickWins(challenges: string[], companyData: any): string[] {
    return [
      'Otimização de fluxo de caixa',
      'Melhoria na comunicação interna',
      'Implementação de KPIs básicos',
      'Revisão de preços e margens'
    ]
  }

  private createPhasedApproach(priorities: string[], timeline?: string): any[] {
    return [
      {
        phase: 1,
        duration: '4-6 semanas',
        focus: 'Diagnóstico e planejamento',
        objectives: ['Análise completa', 'Definição de estratégia'],
        deliverables: ['Relatório diagnóstico', 'Plano estratégico']
      },
      {
        phase: 2,
        duration: '8-12 semanas',
        focus: 'Implementação inicial',
        objectives: ['Quick wins', 'Estruturação'],
        deliverables: ['Processos otimizados', 'Indicadores implementados']
      }
    ]
  }

  private createBudgetRecommendations(budget?: string, priorities: string[] = []): string[] {
    const recommendations = ['Foco nas áreas de maior impacto']
    
    if (budget === 'ate_5k') {
      recommendations.push('Priorizar consultoria pontual e mentoria')
    } else if (budget === 'acima_100k') {
      recommendations.push('Implementação completa com acompanhamento dedicado')
    }
    
    return recommendations
  }

  private selectMethodologies(priorities: string[]): string[] {
    return ['Lean Management', 'Design Thinking', 'OKRs', 'Balanced Scorecard']
  }

  private defineSuccessMetrics(priorities: string[]): string[] {
    return [
      'Crescimento de receita (%)',
      'Melhoria de margem operacional',
      'Redução de tempo de processos',
      'Satisfação da equipe'
    ]
  }

  private defineRiskMitigation(assessment: any): string[] {
    return [
      'Comunicação transparente com stakeholders',
      'Implementação gradual e controlada',
      'Backup de processos críticos',
      'Treinamento intensivo das equipes'
    ]
  }

  private getDurationInWeeks(duration: string): number {
    const durations: Record<string, number> = {
      '1_mes': 4,
      '3_meses': 12,
      '6_meses': 24,
      '1_ano': 48,
      'mais_1_ano': 72
    }
    return durations[duration] || 12
  }
}