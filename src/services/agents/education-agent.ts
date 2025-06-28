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

export class EducationAgent {
  private agent: AIAgent

  constructor() {
    this.agent = {
      id: 'education_agent',
      name: 'Agente Educacional',
      domain: 'education',
      systemPrompt: this.buildSystemPrompt(),
      functions: this.buildFunctions(),
      capabilities: [
        'tutoring_booking',
        'subject_assessment',
        'learning_plan_creation',
        'progress_tracking',
        'study_scheduling',
        'resource_recommendation',
        'parent_communication',
        'group_class_management'
      ],
      maxTokens: 2048,
      temperature: 0.7,
      model: 'gpt-4-turbo-preview'
    }
  }

  getAgent(): AIAgent {
    return this.agent
  }

  private buildSystemPrompt(): string {
    return `Você é um assistente especializado em educação e tutoring, trabalhando para professores particulares, escolas de idiomas, centros de reforço escolar e tutores.

FILOSOFIA EDUCACIONAL:
- Cada aluno é único e tem seu próprio ritmo de aprendizagem
- Aprendizagem deve ser envolvente e personalizada
- Feedback positivo e construtivo é essencial
- Pais/responsáveis devem estar envolvidos no processo
- Tecnologia é uma ferramenta, não substitui o professor

SUAS RESPONSABILIDADES:
1. 📚 Agendar aulas particulares e sessões de tutoring
2. 📊 Avaliar nível de conhecimento do aluno
3. 📋 Criar planos de estudo personalizados
4. 📅 Organizar cronogramas de aulas
5. 📈 Acompanhar progresso e resultados
6. 💡 Recomendar recursos e materiais
7. 👨‍👩‍👧‍👦 Comunicar com pais/responsáveis
8. 👥 Gerenciar aulas em grupo

NÍVEIS EDUCACIONAIS:
🎯 **Educação Infantil (4-6 anos):** Alfabetização, coordenação motora, socialização
📖 **Fundamental I (7-10 anos):** Leitura, escrita, matemática básica
📚 **Fundamental II (11-14 anos):** Disciplinas específicas, método de estudo
🎓 **Ensino Médio (15-17 anos):** Preparação vestibular, ENEM, matérias avançadas
🏛️ **Ensino Superior:** Disciplinas universitárias, TCC, pesquisa
💼 **Profissional:** Cursos técnicos, certificações, desenvolvimento profissional

MATÉRIAS PRINCIPAIS:
🔤 **Línguas:** Português, Inglês, Espanhol, Francês, outros idiomas
🔢 **Exatas:** Matemática, Física, Química, Estatística
🌍 **Humanas:** História, Geografia, Filosofia, Sociologia
🔬 **Biológicas:** Biologia, Ciências Naturais
💻 **Tecnologia:** Programação, Informática, Design
🎨 **Arte e Cultura:** Música, Artes Visuais, Literatura

TIPOS DE AULA:
- **Aula individual** (60 min): Atenção personalizada
- **Aula em dupla** (90 min): Interação entre alunos
- **Aula em grupo** (120 min): Dinâmicas colaborativas
- **Aula online** (45-60 min): Flexibilidade de horário
- **Intensivo** (180 min): Revisão antes de provas
- **Conversação** (45 min): Prática de idiomas

METODOLOGIAS:
- **Tradicional:** Explicação + exercícios
- **Ativa:** Aluno protagonista do aprendizado
- **Lúdica:** Jogos e brincadeiras educativas
- **Montessori:** Aprendizagem pela descoberta
- **Construtivista:** Construção do conhecimento
- **Personalizada:** Adaptada ao perfil do aluno

AVALIAÇÃO DO ALUNO:
📊 **Inicial:** Teste de conhecimentos prévios
📈 **Formativa:** Acompanhamento contínuo
📋 **Diagnóstica:** Identificação de dificuldades
🎯 **Somativa:** Avaliação final de período
📝 **Autoavaliação:** Reflexão do próprio aprendizado

COMUNICAÇÃO COM PAIS:
- Relatórios quinzenais de progresso
- Comunicação imediata sobre dificuldades
- Sugestões de atividades para casa
- Orientações sobre ambiente de estudo
- Celebração de conquistas e melhorias

ESTRATÉGIAS DE MOTIVAÇÃO:
🏆 **Gamificação:** Pontos, níveis, conquistas
🎁 **Recompensas:** Reconhecimento por esforço
📈 **Progresso visual:** Gráficos de evolução
🎯 **Metas alcançáveis:** Objetivos graduais
👥 **Peer learning:** Colaboração entre alunos

PERGUNTAS ESSENCIAIS:
1. "Qual é o nível escolar atual do aluno?"
2. "Em quais matérias precisa de ajuda?"
3. "Tem alguma dificuldade específica de aprendizagem?"
4. "Qual é o objetivo principal? (reforço, vestibular, idioma)"
5. "Prefere aulas presenciais ou online?"
6. "Tem disponibilidade de horário específica?"

LINGUAGEM E TOM:
- Seja encorajador e positivo
- Use linguagem adequada à idade
- Celebre pequenos progressos
- Seja paciente com dificuldades
- Mantenha expectativas realistas

EXEMPLO DE ABORDAGEM:
"Olá! 📚✨ Que bom que você quer investir em educação! Sou especialista em conectar alunos com os melhores professores. Me conta: qual matéria você gostaria de estudar e qual é seu objetivo principal? Vamos encontrar a melhor forma de você alcançar o sucesso nos estudos!"

Sempre priorize o desenvolvimento integral do aluno e sua autoestima acadêmica!`
  }

  private buildFunctions(): AIFunction[] {
    return [
      {
        name: 'assess_student_level',
        description: 'Avaliar nível de conhecimento e necessidades do aluno',
        parameters: [
          {
            name: 'subject',
            type: 'string',
            description: 'Matéria que o aluno precisa estudar',
            required: true
          },
          {
            name: 'current_grade',
            type: 'string',
            description: 'Série/ano escolar atual',
            required: true
          },
          {
            name: 'student_age',
            type: 'number',
            description: 'Idade do aluno',
            required: true
          },
          {
            name: 'learning_goals',
            type: 'array',
            description: 'Objetivos de aprendizagem',
            required: true
          },
          {
            name: 'current_difficulties',
            type: 'array',
            description: 'Dificuldades atuais identificadas',
            required: false
          },
          {
            name: 'learning_style',
            type: 'string',
            description: 'Estilo de aprendizagem preferido',
            required: false,
            enum: ['visual', 'auditivo', 'cinestesico', 'leitor_escritor', 'multimodal']
          }
        ],
        handler: this.assessStudentLevel.bind(this)
      },
      {
        name: 'check_tutoring_availability',
        description: 'Verificar disponibilidade de professores e horários',
        parameters: [
          {
            name: 'subject',
            type: 'string',
            description: 'Matéria solicitada',
            required: true
          },
          {
            name: 'lesson_type',
            type: 'string',
            description: 'Tipo de aula desejada',
            required: true,
            enum: ['individual', 'dupla', 'grupo', 'online', 'intensivo', 'conversacao']
          },
          {
            name: 'student_level',
            type: 'string',
            description: 'Nível do aluno',
            required: true,
            enum: ['infantil', 'fundamental1', 'fundamental2', 'medio', 'superior', 'profissional']
          },
          {
            name: 'preferred_schedule',
            type: 'string',
            description: 'Horário preferido',
            required: false,
            enum: ['manha', 'tarde', 'noite', 'fins_semana', 'flexivel']
          },
          {
            name: 'preferred_teacher',
            type: 'string',
            description: 'Professor de preferência, se houver',
            required: false
          }
        ],
        handler: this.checkTutoringAvailability.bind(this)
      },
      {
        name: 'book_tutoring_session',
        description: 'Agendar sessão de tutoria ou aula particular',
        parameters: [
          {
            name: 'subject',
            type: 'string',
            description: 'Matéria da aula',
            required: true
          },
          {
            name: 'lesson_type',
            type: 'string',
            description: 'Tipo de aula',
            required: true,
            enum: ['individual', 'dupla', 'grupo', 'online', 'intensivo', 'conversacao']
          },
          {
            name: 'date',
            type: 'string',
            description: 'Data da aula (YYYY-MM-DD)',
            required: true
          },
          {
            name: 'time',
            type: 'string',
            description: 'Horário da aula (HH:mm)',
            required: true
          },
          {
            name: 'student_name',
            type: 'string',
            description: 'Nome do aluno',
            required: true
          },
          {
            name: 'student_age',
            type: 'number',
            description: 'Idade do aluno',
            required: true
          },
          {
            name: 'parent_contact',
            type: 'string',
            description: 'Contato do responsável (se menor de idade)',
            required: false
          },
          {
            name: 'learning_goals',
            type: 'string',
            description: 'Objetivos da aula/período',
            required: true
          },
          {
            name: 'special_needs',
            type: 'string',
            description: 'Necessidades especiais ou adaptações',
            required: false
          }
        ],
        handler: this.bookTutoringSession.bind(this)
      },
      {
        name: 'create_study_plan',
        description: 'Criar plano de estudos personalizado',
        parameters: [
          {
            name: 'subject',
            type: 'string',
            description: 'Matéria principal',
            required: true
          },
          {
            name: 'student_level',
            type: 'string',
            description: 'Nível do aluno',
            required: true
          },
          {
            name: 'study_duration',
            type: 'string',
            description: 'Duração do plano de estudos',
            required: true,
            enum: ['1_mes', '3_meses', '6_meses', '1_ano', 'personalizado']
          },
          {
            name: 'weekly_frequency',
            type: 'number',
            description: 'Frequência semanal de aulas',
            required: true
          },
          {
            name: 'specific_goals',
            type: 'array',
            description: 'Objetivos específicos a alcançar',
            required: true
          },
          {
            name: 'assessment_results',
            type: 'object',
            description: 'Resultados da avaliação inicial',
            required: false
          }
        ],
        handler: this.createStudyPlan.bind(this)
      },
      {
        name: 'recommend_study_resources',
        description: 'Recomendar materiais e recursos de estudo',
        parameters: [
          {
            name: 'subject',
            type: 'string',
            description: 'Matéria para recomendar recursos',
            required: true
          },
          {
            name: 'student_level',
            type: 'string',
            description: 'Nível do aluno',
            required: true
          },
          {
            name: 'resource_type',
            type: 'string',
            description: 'Tipo de recurso solicitado',
            required: false,
            enum: ['livros', 'apps', 'videos', 'exercicios', 'jogos', 'sites', 'todos']
          },
          {
            name: 'learning_style',
            type: 'string',
            description: 'Estilo de aprendizagem',
            required: false,
            enum: ['visual', 'auditivo', 'cinestesico', 'leitor_escritor']
          }
        ],
        handler: this.recommendStudyResources.bind(this)
      },
      {
        name: 'track_student_progress',
        description: 'Acompanhar e registrar progresso do aluno',
        parameters: [
          {
            name: 'student_id',
            type: 'string',
            description: 'ID do aluno',
            required: true
          },
          {
            name: 'subject',
            type: 'string',
            description: 'Matéria avaliada',
            required: true
          },
          {
            name: 'assessment_scores',
            type: 'object',
            description: 'Notas e avaliações recentes',
            required: true
          },
          {
            name: 'strengths',
            type: 'array',
            description: 'Pontos fortes identificados',
            required: false
          },
          {
            name: 'improvement_areas',
            type: 'array',
            description: 'Áreas que precisam melhorar',
            required: false
          },
          {
            name: 'parent_feedback',
            type: 'string',
            description: 'Feedback dos pais/responsáveis',
            required: false
          }
        ],
        handler: this.trackStudentProgress.bind(this)
      }
    ]
  }

  private async assessStudentLevel(
    args: {
      subject: string
      current_grade: string
      student_age: number
      learning_goals: string[]
      current_difficulties?: string[]
      learning_style?: string
    },
    context: ConversationContext
  ): Promise<FunctionResult> {
    try {
      // Determine educational level based on age and grade
      let educationalLevel = 'fundamental1'
      if (args.student_age <= 6) educationalLevel = 'infantil'
      else if (args.student_age <= 10) educationalLevel = 'fundamental1'
      else if (args.student_age <= 14) educationalLevel = 'fundamental2'
      else if (args.student_age <= 17) educationalLevel = 'medio'
      else educationalLevel = 'superior'

      // Assess complexity based on subject and level
      const subjectComplexity: Record<string, Record<string, string>> = {
        'matematica': {
          'infantil': 'números até 100, formas geométricas',
          'fundamental1': 'operações básicas, frações simples',
          'fundamental2': 'álgebra básica, geometria',
          'medio': 'funções, trigonometria, estatística',
          'superior': 'cálculo, álgebra linear, estatística avançada'
        },
        'portugues': {
          'infantil': 'alfabetização, coordenação motora',
          'fundamental1': 'leitura fluente, escrita básica',
          'fundamental2': 'gramática, interpretação de texto',
          'medio': 'literatura, redação, análise linguística',
          'superior': 'linguística, metodologia científica'
        },
        'ingles': {
          'infantil': 'vocabulário básico, músicas',
          'fundamental1': 'present simple, vocabulário cotidiano',
          'fundamental2': 'tempos verbais, conversação básica',
          'medio': 'fluência intermediária, gramática avançada',
          'superior': 'business english, academic writing'
        }
      }

      const expectedContent = subjectComplexity[args.subject.toLowerCase()]?.[educationalLevel] || 
                            'Conteúdo adequado ao nível educacional'

      // Generate assessment recommendations
      const assessmentMethods = [
        'Teste diagnóstico de conhecimentos prévios',
        'Avaliação oral sobre conceitos básicos',
        'Exercícios práticos graduais',
        'Observação da metodologia de resolução',
        'Autoavaliação de confiança na matéria'
      ]

      // Recommend study approach based on learning style
      const studyApproaches: Record<string, string[]> = {
        'visual': ['Mapas mentais', 'Gráficos e diagramas', 'Vídeos educativos', 'Flashcards coloridos'],
        'auditivo': ['Explicações verbais', 'Discussões', 'Músicas educativas', 'Repetição oral'],
        'cinestesico': ['Atividades práticas', 'Experimentos', 'Jogos educativos', 'Movimento durante estudo'],
        'leitor_escritor': ['Leitura dirigida', 'Resumos escritos', 'Listas', 'Anotações detalhadas']
      }

      const recommendedApproach = studyApproaches[args.learning_style || 'multimodal'] || 
                                ['Combinação de métodos visuais, auditivos e práticos']

      return {
        success: true,
        data: {
          educational_level: educationalLevel,
          subject: args.subject,
          expected_content: expectedContent,
          assessment_methods: assessmentMethods,
          recommended_approach: recommendedApproach,
          learning_goals: args.learning_goals,
          current_difficulties: args.current_difficulties || []
        },
        message: `📊 **Avaliação do Nível do Aluno**\n\n👤 **Perfil:**\n• Idade: ${args.student_age} anos\n• Série: ${args.current_grade}\n• Nível: ${educationalLevel}\n• Matéria: ${args.subject}\n\n🎯 **Conteúdo Esperado:**\n${expectedContent}\n\n📋 **Métodos de Avaliação Recomendados:**\n${assessmentMethods.map(method => `• ${method}`).join('\n')}\n\n💡 **Abordagem de Ensino Sugerida:**\n${recommendedApproach.map(approach => `• ${approach}`).join('\n')}\n\n🎯 **Próximos Passos:**\n• Aplicar avaliação diagnóstica\n• Criar plano de estudos personalizado\n• Definir cronograma de aulas\n• Estabelecer sistema de acompanhamento`,
        shouldContinue: true
      }

    } catch (error) {
      return {
        success: false,
        message: `Erro na avaliação do aluno: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        shouldContinue: true
      }
    }
  }

  private async checkTutoringAvailability(
    args: {
      subject: string
      lesson_type: string
      student_level: string
      preferred_schedule?: string
      preferred_teacher?: string
    },
    context: ConversationContext
  ): Promise<FunctionResult> {
    try {
      // Lesson durations based on type
      const lessonDurations: Record<string, number> = {
        'individual': 60,
        'dupla': 90,
        'grupo': 120,
        'online': 45,
        'intensivo': 180,
        'conversacao': 45
      }

      const duration = lessonDurations[args.lesson_type] || 60

      // Generate time slots based on preferred schedule
      const timeSlots: Record<string, string[]> = {
        'manha': ['08:00', '09:00', '10:00', '11:00'],
        'tarde': ['14:00', '15:00', '16:00', '17:00'],
        'noite': ['18:00', '19:00', '20:00'],
        'fins_semana': ['09:00', '10:00', '14:00', '15:00', '16:00'],
        'flexivel': ['08:00', '09:00', '10:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00']
      }

      const availableTimes = timeSlots[args.preferred_schedule || 'flexivel']

      // Generate availability for next 7 days
      const today = new Date()
      const availableSlots = []

      for (let i = 1; i <= 7; i++) {
        const date = new Date(today)
        date.setDate(today.getDate() + i)
        const dateStr = date.toISOString().split('T')[0]

        // Skip Sunday for regular classes (only weekend slots for fins_semana)
        if (date.getDay() === 0 && args.preferred_schedule !== 'fins_semana') continue

        for (const time of validateArray(availableTimes)) {
          availableSlots.push({
            date: dateStr,
            time,
            duration,
            teacher: args.preferred_teacher || 'Professor(a) Especialista',
            lesson_type: args.lesson_type
          })
        }
      }

      // Pricing based on lesson type and level
      const basePrices: Record<string, Record<string, number>> = {
        'individual': { 'infantil': 60, 'fundamental1': 65, 'fundamental2': 70, 'medio': 80, 'superior': 100 },
        'dupla': { 'infantil': 40, 'fundamental1': 45, 'fundamental2': 50, 'medio': 60, 'superior': 75 },
        'grupo': { 'infantil': 30, 'fundamental1': 35, 'fundamental2': 40, 'medio': 45, 'superior': 55 },
        'online': { 'infantil': 45, 'fundamental1': 50, 'fundamental2': 55, 'medio': 65, 'superior': 80 },
        'intensivo': { 'infantil': 150, 'fundamental1': 170, 'fundamental2': 190, 'medio': 220, 'superior': 280 },
        'conversacao': { 'infantil': 40, 'fundamental1': 45, 'fundamental2': 50, 'medio': 55, 'superior': 65 }
      }

      const estimatedPrice = basePrices[args.lesson_type]?.[args.student_level] || 70

      return {
        success: true,
        data: {
          available_slots: availableSlots.slice(0, 15), // Return first 15 slots
          lesson_type: args.lesson_type,
          duration: duration,
          subject: args.subject,
          estimated_price: estimatedPrice,
          student_level: args.student_level
        },
        message: `📅 **Disponibilidade para ${args.subject}**\n\n📚 **Tipo de Aula:** ${args.lesson_type}\n⏱️ **Duração:** ${duration} minutos\n🎓 **Nível:** ${args.student_level}\n💰 **Valor estimado:** R$ ${estimatedPrice}/aula\n\n📋 **Professores disponíveis com especialização em ${args.subject}**\n\nEncontrei ${availableSlots.length} horários disponíveis nos próximos 7 dias. Qual horário seria melhor para o aluno?\n\n💡 **Dica:** Aulas regulares (2-3x por semana) têm melhor resultado de aprendizagem!`,
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

  private async bookTutoringSession(
    args: {
      subject: string
      lesson_type: string
      date: string
      time: string
      student_name: string
      student_age: number
      parent_contact?: string
      learning_goals: string
      special_needs?: string
    },
    context: ConversationContext
  ): Promise<FunctionResult> {
    try {
      // Find tutoring service
      const { data: service, error: serviceError } = await supabase
        .from('services')
        .select('id, name, duration_minutes, base_price')
        .eq('tenant_id', context.tenantId)
        .ilike('name', `%${args.subject}%`)
        .single()

      if (serviceError || !service) {
        return {
          success: false,
          message: `Serviço de ${args.subject} não encontrado. Verifique as matérias disponíveis.`,
          shouldContinue: true
        }
      }

      // Create appointment for tutoring session
      const appointmentData = {
        tenant_id: context.tenantId,
        user_id: context.userId,
        service_id: service.id,
        start_time: `${args.date}T${args.time}:00`,
        end_time: new Date(new Date(`${args.date}T${args.time}:00`).getTime() + (validateServiceDuration(service.duration_minutes) * 60000)).toISOString(),
        timezone: context.tenantConfig?.businessHours.timezone || 'America/Sao_Paulo',
        status: validateAppointmentStatus('confirmed'),
        quoted_price: service.base_price,
        customer_notes: `Aluno: ${args.student_name} (${args.student_age} anos) | Objetivos: ${args.learning_goals}`,
        appointment_data: {
          lesson_type: args.lesson_type,
          subject: args.subject,
          student_name: args.student_name,
          student_age: args.student_age,
          parent_contact: args.parent_contact,
          learning_goals: args.learning_goals,
          special_needs: args.special_needs,
          is_first_lesson: true,
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
          message: `Erro ao agendar aula: ${appointmentError.message}`,
          shouldContinue: true
        }
      }

      const dateFormatted = new Date(args.date).toLocaleDateString('pt-BR')
      
      // Generate preparation checklist
      const preparationList = [
        'Material escolar básico (caderno, caneta, lápis)',
        'Livro didático da matéria (se houver)',
        'Exercícios ou provas recentes',
        'Lista de dúvidas específicas',
        'Ambiente tranquilo para estudar'
      ]

      if (args.lesson_type === 'online') {
        preparationList.push('Computador/tablet com câmera e microfone')
        preparationList.push('Conexão estável de internet')
        preparationList.push('Link da videochamada (será enviado)')
      }

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
          lesson_type: args.lesson_type
        },
        message: `✅ **Aula Agendada com Sucesso!**\n\n📚 **${args.subject}** - ${args.lesson_type}\n👤 **Aluno:** ${args.student_name} (${args.student_age} anos)\n📅 **Data:** ${dateFormatted} às ${args.time}\n⏱️ **Duração:** ${service.duration_minutes} minutos\n💰 **Valor:** R$ ${service.base_price}\n🔢 **Código:** ${appointment.id.slice(0, 8).toUpperCase()}\n\n📋 **Preparação para a primeira aula:**\n${preparationList.map(item => `• ${item}`).join('\n')}\n\n🎯 **Objetivos da aula:**\n${args.learning_goals}\n\n${args.special_needs ? `🔧 **Adaptações:** ${args.special_needs}\n\n` : ''}👨‍🏫 **O professor(a) entrará em contato 30 minutos antes da aula para confirmar.**\n\n${args.parent_contact ? `👨‍👩‍👧‍👦 **Contato responsável:** ${args.parent_contact}` : ''}`,
        shouldContinue: false
      }

    } catch (error) {
      return {
        success: false,
        message: `Erro inesperado ao agendar aula: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        shouldContinue: true
      }
    }
  }

  private async createStudyPlan(
    args: {
      subject: string
      student_level: string
      study_duration: string
      weekly_frequency: number
      specific_goals: string[]
      assessment_results?: any
    },
    context: ConversationContext
  ): Promise<FunctionResult> {
    try {
      // Define study plan structure based on duration
      const planDurations: Record<string, number> = {
        '1_mes': 4,
        '3_meses': 12,
        '6_meses': 24,
        '1_ano': 48,
        'personalizado': 12
      }

      const totalWeeks = planDurations[args.study_duration] || 12
      const totalLessons = totalWeeks * args.weekly_frequency

      // Generate milestone structure
      const milestones = []
      const weeksPerMilestone = Math.ceil(totalWeeks / 4)

      for (let i = 1; i <= 4; i++) {
        const startWeek = (i - 1) * weeksPerMilestone + 1
        const endWeek = Math.min(i * weeksPerMilestone, totalWeeks)
        
        milestones.push({
          milestone: i,
          weeks: `${startWeek}-${endWeek}`,
          focus: this.getMilestoneFocus(args.subject, args.student_level, i),
          assessment: i === 4 ? 'Avaliação final' : `Avaliação ${i}`
        })
      }

      // Weekly schedule suggestion
      const scheduleOptions = [
        { days: ['Segunda', 'Quarta'], time: 'tarde', ideal_for: 'Revisão e exercícios' },
        { days: ['Terça', 'Quinta'], time: 'manhã', ideal_for: 'Conteúdo novo' },
        { days: ['Sábado'], time: 'manhã', ideal_for: 'Intensivo semanal' }
      ]

      // Study materials recommendation
      const materials = this.getStudyMaterials(args.subject, args.student_level)

      return {
        success: true,
        data: {
          subject: args.subject,
          student_level: args.student_level,
          total_weeks: totalWeeks,
          total_lessons: totalLessons,
          weekly_frequency: args.weekly_frequency,
          milestones: milestones,
          schedule_options: scheduleOptions,
          materials: materials,
          specific_goals: args.specific_goals
        },
        message: `📋 **Plano de Estudos Personalizado**\n\n📚 **Matéria:** ${args.subject}\n🎓 **Nível:** ${args.student_level}\n⏱️ **Duração:** ${args.study_duration.replace('_', ' ')}\n📅 **Frequência:** ${args.weekly_frequency}x por semana\n📊 **Total:** ${totalLessons} aulas em ${totalWeeks} semanas\n\n🎯 **Marcos do Aprendizado:**\n${milestones.map(m => `**${m.milestone}º Marco (semanas ${m.weeks}):** ${m.focus}`).join('\n')}\n\n📅 **Cronograma Sugerido:**\n${scheduleOptions.map(opt => `• ${opt.days.join(' e ')}: ${opt.ideal_for}`).join('\n')}\n\n📚 **Materiais Recomendados:**\n${materials.map(mat => `• ${mat}`).join('\n')}\n\n🎯 **Objetivos Específicos:**\n${args.specific_goals.map(goal => `• ${goal}`).join('\n')}\n\n📈 **Este plano será ajustado conforme o progresso do aluno!**`,
        shouldContinue: true
      }

    } catch (error) {
      return {
        success: false,
        message: `Erro ao criar plano de estudos: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        shouldContinue: true
      }
    }
  }

  private async recommendStudyResources(
    args: {
      subject: string
      student_level: string
      resource_type?: string
      learning_style?: string
    },
    context: ConversationContext
  ): Promise<FunctionResult> {
    const resourceDatabase: Record<string, Record<string, Record<string, string[]>>> = {
      'matematica': {
        'fundamental1': {
          'livros': ['Matemática Divertida - vol. 1', 'Ábaco Dourado', 'Nosso Livro de Matemática'],
          'apps': ['Khan Academy Kids', 'Matemática Básica', 'Tabuada do Dino'],
          'videos': ['Canal do Prof. Gis', 'Matemática Rio', 'Ferretto Matemática'],
          'sites': ['Khan Academy', 'Smartkids', 'Racha Cuca'],
          'jogos': ['Jogo da Tabuada', 'Quebra-cabeças Numéricos', 'Dominó Matemático']
        },
        'medio': {
          'livros': ['Fundamentos de Matemática - Gelson Iezzi', 'Matemática Completa - José Ruy Giovanni'],
          'apps': ['Photomath', 'GeoGebra', 'Microsoft Math Solver'],
          'videos': ['Ferretto Matemática', 'Equaciona', 'Prof. Gui'],
          'sites': ['Brasil Escola', 'Mundo Educação', 'Cola da Web'],
          'exercicios': ['Lista ENEM', 'Exercícios Vestibular', 'Simulados Online']
        }
      },
      'portugues': {
        'fundamental2': {
          'livros': ['Gramática da Língua Portuguesa - Pasquale', 'Para Entender o Texto - Platão & Fiorin'],
          'apps': ['Português Correct', 'Acentuação', 'Conjugue'],
          'videos': ['Professora Pamba', 'Português Play', 'Curso Enem Gratuito'],
          'sites': ['Conjugação.com.br', 'Priberam', 'Portal da Língua Portuguesa']
        }
      },
      'ingles': {
        'todos': {
          'apps': ['Duolingo', 'Babbel', 'HelloTalk', 'Anki'],
          'videos': ['English with Lucy', 'BBC Learning English', 'Rachel\'s English'],
          'sites': ['Cambridge Dictionary', 'Grammar Girl', 'Perfect English Grammar'],
          'livros': ['English Grammar in Use', 'American English File', 'Oxford Learner\'s Dictionary']
        }
      }
    }

    try {
      const subjectResources = resourceDatabase[args.subject.toLowerCase()]
      const levelResources = subjectResources?.[args.student_level] || subjectResources?.['todos']
      
      if (!levelResources) {
        return {
          success: false,
          message: `Recursos para ${args.subject} (${args.student_level}) ainda não catalogados. Entre em contato para orientação personalizada.`,
          shouldContinue: true
        }
      }

      // Filter by resource type if specified
      let recommendedResources: Record<string, string[]> = {}
      
      if (args.resource_type && args.resource_type !== 'todos') {
        if (levelResources[args.resource_type]) {
          recommendedResources[args.resource_type] = validateArray(levelResources[args.resource_type])
        }
      } else {
        recommendedResources = levelResources
      }

      // Add learning style specific recommendations
      const styleRecommendations: Record<string, string> = {
        'visual': '💡 **Para aprendizes visuais:** Priorice mapas mentais, infográficos e vídeos com legendas',
        'auditivo': '🎧 **Para aprendizes auditivos:** Foque em podcasts, audiobooks e explicações orais',
        'cinestesico': '🏃 **Para aprendizes cinestésicos:** Use jogos interativos e atividades práticas',
        'leitor_escritor': '📝 **Para aprendizes leitores/escritores:** Priorize livros, resumos e exercícios escritos'
      }

      const styleAdvice = args.learning_style ? styleRecommendations[args.learning_style] : ''

      let message = `📚 **Recursos de Estudo para ${args.subject}**\n\n🎓 **Nível:** ${args.student_level}\n\n`

      Object.entries(recommendedResources).forEach(([type, resources]) => {
        const typeEmojis: Record<string, string> = {
          'livros': '📖',
          'apps': '📱',
          'videos': '📺',
          'sites': '🌐',
          'jogos': '🎮',
          'exercicios': '📝'
        }
        
        message += `${typeEmojis[type] || '📋'} **${type.charAt(0).toUpperCase() + type.slice(1)}:**\n${validateArray(resources).map(r => `• ${r}`).join('\n')}\n\n`
      })

      if (styleAdvice) {
        message += `${styleAdvice}\n\n`
      }

      message += `💡 **Dicas de uso:**\n• Combine diferentes tipos de recursos\n• Estabeleça horários regulares de estudo\n• Faça pausas a cada 25-30 minutos\n• Revise o conteúdo regularmente\n• Pratique com exercícios variados`

      return {
        success: true,
        data: {
          subject: args.subject,
          student_level: args.student_level,
          resources: recommendedResources,
          learning_style: args.learning_style
        },
        message: message,
        shouldContinue: true
      }

    } catch (error) {
      return {
        success: false,
        message: `Erro ao buscar recursos: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        shouldContinue: true
      }
    }
  }

  private async trackStudentProgress(
    args: {
      student_id: string
      subject: string
      assessment_scores: any
      strengths?: string[]
      improvement_areas?: string[]
      parent_feedback?: string
    },
    context: ConversationContext
  ): Promise<FunctionResult> {
    try {
      // Generate progress report
      const progressData = {
        student_id: args.student_id,
        subject: args.subject,
        assessment_date: new Date().toISOString(),
        scores: args.assessment_scores,
        strengths: args.strengths || [],
        improvement_areas: args.improvement_areas || [],
        parent_feedback: args.parent_feedback,
        overall_progress: this.calculateOverallProgress(args.assessment_scores),
        recommendations: this.generateRecommendations(args.improvement_areas || [])
      }

      // In a real implementation, this would save to the database
      console.log('📊 Student progress tracked:', progressData)

      const overallGrade = progressData.overall_progress
      const progressEmoji = overallGrade >= 8 ? '🟢' : overallGrade >= 6 ? '🟡' : '🔴'

      return {
        success: true,
        data: progressData,
        message: `📊 **Relatório de Progresso**\n\n👤 **Aluno:** ${args.student_id}\n📚 **Matéria:** ${args.subject}\n📅 **Data:** ${new Date().toLocaleDateString('pt-BR')}\n\n${progressEmoji} **Nota Geral:** ${overallGrade}/10\n\n💪 **Pontos Fortes:**\n${(args.strengths || []).map(s => `• ${s}`).join('\n') || '• A definir na próxima avaliação'}\n\n📈 **Áreas para Melhorar:**\n${(args.improvement_areas || []).map(a => `• ${a}`).join('\n') || '• Continuar desenvolvendo'}\n\n🎯 **Recomendações:**\n${progressData.recommendations.map(r => `• ${r}`).join('\n')}\n\n${args.parent_feedback ? `👨‍👩‍👧‍👦 **Feedback dos Pais:**\n"${args.parent_feedback}"\n\n` : ''}📋 **Próximo relatório em 15 dias**`,
        shouldContinue: true
      }

    } catch (error) {
      return {
        success: false,
        message: `Erro ao registrar progresso: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        shouldContinue: true
      }
    }
  }

  private getMilestoneFocus(subject: string, level: string, milestone: number): string {
    const focusMap: Record<string, Record<string, string[]>> = {
      'matematica': {
        'fundamental1': [
          'Números e operações básicas',
          'Geometria e medidas',
          'Frações e decimais',
          'Resolução de problemas'
        ],
        'medio': [
          'Álgebra e funções',
          'Geometria analítica',
          'Trigonometria',
          'Estatística e probabilidade'
        ]
      },
      'portugues': {
        'fundamental2': [
          'Gramática básica',
          'Interpretação de texto',
          'Produção textual',
          'Literatura e análise'
        ]
      }
    }

    return focusMap[subject]?.[level]?.[milestone - 1] || `Marco ${milestone} do aprendizado`
  }

  private getStudyMaterials(subject: string, level: string): string[] {
    const materials: Record<string, string[]> = {
      'matematica': ['Caderno quadriculado', 'Calculadora científica', 'Régua e compasso', 'Livro didático'],
      'portugues': ['Dicionário', 'Gramática', 'Livros de literatura', 'Caderno de redação'],
      'ingles': ['Dicionário inglês-português', 'Caderno de vocabulário', 'Fones de ouvido', 'App móvel']
    }

    return materials[subject] || ['Material básico de estudos', 'Caderno', 'Livro didático']
  }

  private calculateOverallProgress(scores: any): number {
    if (typeof scores !== 'object' || !scores) return 5

    const values = Object.values(scores).filter(v => typeof v === 'number')
    if (values.length === 0) return 5

    const average = values.reduce((sum: number, score: any) => sum + score, 0) / values.length
    return Math.round(average * 10) / 10
  }

  private generateRecommendations(improvementAreas: string[]): string[] {
    const recommendations: Record<string, string> = {
      'matematica': 'Fazer exercícios diários de 15-20 minutos',
      'concentracao': 'Usar técnica Pomodoro (25min estudo + 5min pausa)',
      'organizacao': 'Criar cronograma semanal de estudos',
      'memorização': 'Usar técnicas de associação e repetição',
      'leitura': 'Ler 30 minutos por dia de diferentes gêneros',
      'escrita': 'Praticar redação 2x por semana'
    }

    const defaultRecommendations = [
      'Manter regularidade nos estudos',
      'Revisar conteúdo semanalmente',
      'Tirar dúvidas imediatamente',
      'Praticar exercícios variados'
    ]

    const specific = improvementAreas.map(area => 
      recommendations[area.toLowerCase()] || `Focar em ${area}`
    )

    return specific.length > 0 ? specific : defaultRecommendations
  }
}