#!/usr/bin/env node

/**
 * 🌱 COMPREHENSIVE SEED DATA SCRIPT
 * 
 * Este script popula TODAS as tabelas com dados mock realistas
 * para permitir testes rigorosos do sistema multi-tenant
 * 
 * Domínios: beauty, healthcare, legal, education, sports, consulting
 * 
 * Uso: node scripts/seed-comprehensive-data.js
 */

const { createClient } = require('@supabase/supabase-js')
const { v4: uuidv4 } = require('uuid')
require('dotenv').config()

// Configuração Supabase
const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

// Utilitários
const randomDate = (start, end) => {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()))
}

const randomFromArray = (array) => {
  return array[Math.floor(Math.random() * array.length)]
}

const randomInt = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

const randomPrice = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// Dados base para cada domínio
const domainData = {
  beauty: {
    businessNames: [
      'Salon Bella Vista',
      'Estética Glamour',
      'Barbearia Moderna',
      'Spa Relaxante',
      'Studio de Beleza Ana'
    ],
    categories: [
      { name: 'Cabelo', description: 'Serviços de corte, coloração e tratamentos capilares' },
      { name: 'Unhas', description: 'Manicure, pedicure e nail art' },
      { name: 'Estética', description: 'Tratamentos faciais e corporais' },
      { name: 'Massagem', description: 'Massagens relaxantes e terapêuticas' }
    ],
    services: [
      { name: 'Corte Feminino', price: 80, duration: 60, category: 'Cabelo' },
      { name: 'Corte Masculino', price: 45, duration: 30, category: 'Cabelo' },
      { name: 'Coloração Completa', price: 150, duration: 120, category: 'Cabelo' },
      { name: 'Manicure', price: 35, duration: 45, category: 'Unhas' },
      { name: 'Pedicure', price: 40, duration: 60, category: 'Unhas' },
      { name: 'Limpeza de Pele', price: 120, duration: 90, category: 'Estética' },
      { name: 'Massagem Relaxante', price: 100, duration: 60, category: 'Massagem' }
    ]
  },
  healthcare: {
    businessNames: [
      'Clínica Bem Estar',
      'Consultório Dra. Silva',
      'Centro Terapêutico',
      'Psicologia Integral',
      'Fisioterapia Avançada'
    ],
    categories: [
      { name: 'Psicologia', description: 'Consultas psicológicas e terapia' },
      { name: 'Fisioterapia', description: 'Tratamentos fisioterapêuticos' },
      { name: 'Nutrição', description: 'Consultas nutricionais' },
      { name: 'Medicina Geral', description: 'Consultas médicas gerais' }
    ],
    services: [
      { name: 'Consulta Psicológica', price: 180, duration: 50, category: 'Psicologia' },
      { name: 'Terapia de Casal', price: 220, duration: 60, category: 'Psicologia' },
      { name: 'Sessão de Fisioterapia', price: 120, duration: 60, category: 'Fisioterapia' },
      { name: 'Consulta Nutricional', price: 150, duration: 60, category: 'Nutrição' },
      { name: 'Consulta Médica', price: 200, duration: 30, category: 'Medicina Geral' },
      { name: 'Avaliação Física', price: 100, duration: 45, category: 'Fisioterapia' }
    ]
  },
  legal: {
    businessNames: [
      'Escritório Advocacia Silva',
      'Consultoria Jurídica Ltda',
      'Advogados Associados',
      'Jurídico Empresarial',
      'Direito & Consultoria'
    ],
    categories: [
      { name: 'Direito Trabalhista', description: 'Questões relacionadas ao trabalho' },
      { name: 'Direito Civil', description: 'Questões civis e contratuais' },
      { name: 'Direito Empresarial', description: 'Consultoria para empresas' },
      { name: 'Direito Familiar', description: 'Questões familiares e divórcio' }
    ],
    services: [
      { name: 'Consulta Trabalhista', price: 250, duration: 60, category: 'Direito Trabalhista' },
      { name: 'Consultoria Empresarial', price: 400, duration: 90, category: 'Direito Empresarial' },
      { name: 'Consulta Familiar', price: 200, duration: 60, category: 'Direito Familiar' },
      { name: 'Análise de Contrato', price: 300, duration: 45, category: 'Direito Civil' },
      { name: 'Audiência Trabalhista', price: 500, duration: 120, category: 'Direito Trabalhista' }
    ]
  },
  education: {
    businessNames: [
      'Aulas Particulares Pro',
      'Reforço Escolar Plus',
      'Curso ENEM Excellence',
      'Tutoria Acadêmica',
      'Ensino Personalizado'
    ],
    categories: [
      { name: 'Matemática', description: 'Aulas de matemática todos os níveis' },
      { name: 'Português', description: 'Aulas de português e redação' },
      { name: 'Inglês', description: 'Aulas de inglês conversação e gramática' },
      { name: 'Preparatório ENEM', description: 'Preparação para vestibulares' }
    ],
    services: [
      { name: 'Aula Matemática', price: 80, duration: 60, category: 'Matemática' },
      { name: 'Aula Português', price: 75, duration: 60, category: 'Português' },
      { name: 'Aula Inglês', price: 90, duration: 60, category: 'Inglês' },
      { name: 'Preparatório ENEM', price: 120, duration: 90, category: 'Preparatório ENEM' },
      { name: 'Reforço Escolar', price: 60, duration: 45, category: 'Matemática' }
    ]
  },
  sports: {
    businessNames: [
      'Personal Trainer Pro',
      'Academia Fitness',
      'Treinamento Funcional',
      'Crossfit Elite',
      'Pilates Studio'
    ],
    categories: [
      { name: 'Personal Training', description: 'Treinamento personalizado' },
      { name: 'Pilates', description: 'Aulas de pilates' },
      { name: 'Crossfit', description: 'Treino funcional intenso' },
      { name: 'Musculação', description: 'Treinamento com pesos' }
    ],
    services: [
      { name: 'Personal Training', price: 120, duration: 60, category: 'Personal Training' },
      { name: 'Aula Pilates', price: 80, duration: 60, category: 'Pilates' },
      { name: 'Crossfit', price: 60, duration: 45, category: 'Crossfit' },
      { name: 'Avaliação Física', price: 100, duration: 45, category: 'Personal Training' },
      { name: 'Treino Funcional', price: 70, duration: 45, category: 'Personal Training' }
    ]
  },
  consulting: {
    businessNames: [
      'Consultoria Estratégica',
      'Business Consulting',
      'Coaching Empresarial',
      'Consultoria Digital',
      'Gestão & Resultados'
    ],
    categories: [
      { name: 'Estratégia', description: 'Consultoria estratégica empresarial' },
      { name: 'Marketing', description: 'Consultoria em marketing digital' },
      { name: 'Coaching', description: 'Coaching pessoal e profissional' },
      { name: 'Gestão', description: 'Consultoria em gestão e processos' }
    ],
    services: [
      { name: 'Consultoria Estratégica', price: 500, duration: 120, category: 'Estratégia' },
      { name: 'Coaching Executivo', price: 350, duration: 90, category: 'Coaching' },
      { name: 'Consultoria Marketing', price: 400, duration: 90, category: 'Marketing' },
      { name: 'Análise de Negócio', price: 300, duration: 60, category: 'Gestão' },
      { name: 'Mentoria', price: 250, duration: 60, category: 'Coaching' }
    ]
  }
}

// Nomes e telefones brasileiros realistas
const userNames = [
  'Ana Silva Santos', 'João Oliveira Costa', 'Maria Fernanda Lima', 'Carlos Eduardo Souza',
  'Juliana Rodrigues', 'Pedro Henrique Alves', 'Camila Pereira', 'Rafael Santos Silva',
  'Larissa Mendes', 'Gabriel Ferreira', 'Beatriz Almeida', 'Lucas Barbosa',
  'Amanda Carvalho', 'Felipe Martins', 'Isabela Dias', 'Thiago Ribeiro',
  'Natália Gomes', 'Vinícius Araujo', 'Letícia Moreira', 'Gustavo Cardoso',
  'Priscila Nascimento', 'Rodrigo Teixeira', 'Vanessa Monteiro', 'Daniel Pinto',
  'Adriana Lopes', 'Marcelo Correia', 'Fernanda Ramos', 'Bruno Cavalcanti',
  'Tatiane Freitas', 'Anderson Melo', 'Cristiane Rocha', 'Fábio Macedo'
]

const generatePhoneNumber = () => {
  const ddd = randomFromArray(['11', '21', '31', '41', '51', '61', '71', '81', '85', '11'])
  const number = `9${randomInt(1000, 9999)}${randomInt(1000, 9999)}`
  return `+55${ddd}${number}`
}

// Função principal
async function seedDatabase() {
  console.log('🌱 Iniciando seed completo do banco de dados...\n')

  try {
    // 1. Limpar dados existentes (opcional)
    console.log('🧹 Limpando dados existentes...')
    await clearExistingData()

    // 2. Criar tenants (negócios) para cada domínio
    console.log('🏢 Criando tenants...')
    const tenants = await createTenants()

    // 3. Criar usuários (clientes)
    console.log('👥 Criando usuários...')
    const users = await createUsers()

    // 4. Criar admin users
    console.log('👨‍💼 Criando admin users...')
    const adminUsers = await createAdminUsers(tenants)

    // 5. Criar categorias de serviços
    console.log('📋 Criando categorias de serviços...')
    const categories = await createServiceCategories(tenants)

    // 6. Criar serviços
    console.log('⚙️ Criando serviços...')
    const services = await createServices(tenants, categories)

    // 7. Criar templates de disponibilidade
    console.log('📅 Criando templates de disponibilidade...')
    const availabilityTemplates = await createAvailabilityTemplates(tenants)

    // 8. Criar agendamentos
    console.log('📆 Criando agendamentos...')
    const appointments = await createAppointments(tenants, users, services)

    // 9. Conectar usuários aos tenants
    console.log('🔗 Conectando usuários aos tenants...')
    await createUserTenantRelations(users, tenants)

    // 10. Criar histórico de conversas
    console.log('💬 Criando histórico de conversas...')
    await createConversationHistory(tenants, users)

    // 11. Criar states de conversação
    console.log('🗣️ Criando states de conversação...')
    await createConversationStates(tenants, users)

    // 12. Criar templates WhatsApp
    console.log('📱 Criando templates WhatsApp...')
    await createWhatsAppTemplates(tenants)

    // 13. Criar logs de sistema
    console.log('📊 Criando logs de sistema...')
    await createSystemLogs(tenants)

    // 14. Estatísticas finais
    console.log('\n✅ SEED COMPLETO!')
    console.log('==========================================')
    console.log(`🏢 Tenants criados: ${tenants.length}`)
    console.log(`👥 Usuários criados: ${users.length}`)
    console.log(`📋 Categorias criadas: ${categories.length}`)
    console.log(`⚙️ Serviços criados: ${services.length}`)
    console.log(`📆 Agendamentos criados: ${appointments.length}`)
    console.log('==========================================')
    console.log('🎉 Banco de dados populado com sucesso!')
    console.log('Agora você pode executar testes rigorosos!\n')

  } catch (error) {
    console.error('❌ Erro durante o seed:', error)
    process.exit(1)
  }
}

// Funções auxiliares
async function clearExistingData() {
  const tables = [
    'conversation_history',
    'conversation_states',
    'appointments',
    'services',
    'service_categories',
    'availability_templates',
    'user_tenants',
    'whatsapp_templates',
    'whatsapp_media',
    'admin_permissions',
    'admin_users',
    'email_logs',
    'function_executions',
    'system_health_logs',
    'calendar_sync_tokens',
    'users',
    'tenants'
  ]

  for (const table of tables) {
    try {
      // Primeiro tentar buscar IDs existentes
      const { data, error: selectError } = await supabase.from(table).select('id')
      
      if (!selectError && data && data.length > 0) {
        // Se existem dados, deletar todos
        const { error: deleteError } = await supabase.from(table).delete().in('id', data.map(row => row.id))
        if (deleteError) {
          console.warn(`Aviso ao limpar ${table}:`, deleteError.message)
        } else {
          console.log(`✅ ${table}: ${data.length} registros removidos`)
        }
      }
    } catch (err) {
      console.warn(`Tabela ${table} pode não existir ainda`)
    }
  }
}

async function createTenants() {
  const tenants = []
  const domains = Object.keys(domainData)

  for (let i = 0; i < domains.length; i++) {
    const domain = domains[i]
    const businessNames = domainData[domain].businessNames

    for (let j = 0; j < businessNames.length; j++) {
      const businessName = businessNames[j]
      const slug = businessName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')

      const tenant = {
        id: uuidv4(),
        name: businessName,
        slug: slug,
        business_name: businessName,
        domain: domain,
        email: `contato@${slug}.com.br`,
        phone: generatePhoneNumber(),
        whatsapp_phone: generatePhoneNumber(),
        status: 'active',
        subscription_plan: randomFromArray(['starter', 'professional', 'enterprise']),
        business_description: `${businessName} - Referência em ${domain} com atendimento personalizado`,
        business_address: {
          street: `Rua ${randomFromArray(['das Flores', 'Principal', 'do Comércio', 'Central'])} ${randomInt(100, 999)}`,
          city: randomFromArray(['São Paulo', 'Rio de Janeiro', 'Belo Horizonte', 'Porto Alegre', 'Curitiba']),
          state: randomFromArray(['SP', 'RJ', 'MG', 'RS', 'PR']),
          zipcode: `${randomInt(10000, 99999)}-${randomInt(100, 999)}`,
          country: 'Brasil'
        },
        ai_settings: {
          model: 'gpt-4',
          temperature: 0.7,
          max_tokens: 1000,
          enable_function_calling: true,
          enable_multimodal: true
        },
        business_rules: {
          working_hours: {
            monday: { start: '09:00', end: '18:00' },
            tuesday: { start: '09:00', end: '18:00' },
            wednesday: { start: '09:00', end: '18:00' },
            thursday: { start: '09:00', end: '18:00' },
            friday: { start: '09:00', end: '18:00' },
            saturday: { start: '09:00', end: '14:00' },
            sunday: { start: null, end: null }
          },
          booking_rules: {
            advance_booking_hours: randomInt(2, 48),
            max_booking_days: randomInt(30, 90),
            same_day_booking: true
          },
          cancellation_policy: {
            free_cancellation_hours: randomInt(2, 24),
            penalty_percentage: randomInt(0, 50)
          }
        },
        domain_config: {
          domain_specific_settings: domainData[domain],
          custom_prompts: {
            greeting: `Olá! Bem-vindo ao ${businessName}. Como posso ajudá-lo hoje?`,
            booking_confirmation: `Perfeito! Seu agendamento foi confirmado.`,
            emergency_escalation: domain === 'healthcare' ? 'Detectei que pode ser uma emergência. Transferindo para atendimento humano.' : null
          }
        },
        whatsapp_settings: {
          phone_number_id: `phone_${randomInt(100000, 999999)}`,
          webhook_url: `https://api.${slug}.com.br/whatsapp/webhook`,
          verify_token: `verify_${uuidv4().substring(0, 8)}`
        }
      }

      tenants.push(tenant)
    }
  }

  const { data, error } = await supabase.from('tenants').insert(tenants).select()
  if (error) throw error
  
  console.log(`✅ ${tenants.length} tenants criados`)
  return data
}

async function createUsers() {
  const users = []

  for (let i = 0; i < 50; i++) {
    const user = {
      id: uuidv4(),
      name: randomFromArray(userNames),
      phone: generatePhoneNumber(),
      email: `user${i + 1}@email.com`,
      preferences: {
        preferred_language: 'pt-BR',
        notification_preferences: {
          whatsapp: true,
          email: randomFromArray([true, false]),
          sms: false
        },
        timezone: 'America/Sao_Paulo'
      }
    }
    users.push(user)
  }

  const { data, error } = await supabase.from('users').insert(users).select()
  if (error) throw error

  console.log(`✅ ${users.length} usuários criados`)
  return data
}

async function createAdminUsers(tenants) {
  const adminUsers = []

  for (const tenant of tenants) {
    const admin = {
      id: uuidv4(),
      email: `admin@${tenant.slug}.com.br`,
      password_hash: '$2b$10$example.hash.for.demo.purposes.only',
      name: `Admin ${tenant.name}`,
      role: 'tenant_admin',
      tenant_id: tenant.id,
      is_active: true
    }
    adminUsers.push(admin)
  }

  const { data, error } = await supabase.from('admin_users').insert(adminUsers).select()
  if (error) throw error

  console.log(`✅ ${adminUsers.length} admin users criados`)
  return data
}

async function createServiceCategories(tenants) {
  const categories = []

  for (const tenant of tenants) {
    const domainCategories = domainData[tenant.domain].categories

    for (let i = 0; i < domainCategories.length; i++) {
      const category = {
        id: uuidv4(),
        tenant_id: tenant.id,
        name: domainCategories[i].name,
        description: domainCategories[i].description,
        display_order: i + 1
      }
      categories.push(category)
    }
  }

  const { data, error } = await supabase.from('service_categories').insert(categories).select()
  if (error) throw error

  console.log(`✅ ${categories.length} categorias criadas`)
  return data
}

async function createServices(tenants, categories) {
  const services = []

  for (const tenant of tenants) {
    const domainServices = domainData[tenant.domain].services
    const tenantCategories = categories.filter(c => c.tenant_id === tenant.id)

    for (let i = 0; i < domainServices.length; i++) {
      const serviceData = domainServices[i]
      const category = tenantCategories.find(c => c.name === serviceData.category)

      const service = {
        id: uuidv4(),
        tenant_id: tenant.id,
        category_id: category?.id || null,
        name: serviceData.name,
        description: `${serviceData.name} - Serviço profissional com qualidade garantida`,
        base_price: serviceData.price,
        currency: 'BRL',
        duration_minutes: serviceData.duration,
        duration_type: 'fixed',
        price_model: 'fixed',
        is_active: true,
        advance_booking_days: randomInt(1, 30),
        max_bookings_per_day: randomInt(5, 20),
        display_order: i + 1,
        service_config: {
          preparation_time: randomInt(5, 15),
          cleanup_time: randomInt(5, 10),
          buffer_time: randomInt(0, 10),
          allow_online_booking: true,
          require_confirmation: randomFromArray([true, false])
        }
      }
      services.push(service)
    }
  }

  const { data, error } = await supabase.from('services').insert(services).select()
  if (error) throw error

  console.log(`✅ ${services.length} serviços criados`)
  return data
}

async function createAvailabilityTemplates(tenants) {
  const templates = []

  for (const tenant of tenants) {
    const template = {
      id: uuidv4(),
      tenant_id: tenant.id,
      name: 'Horário Padrão',
      is_default: true,
      monday_slots: [
        { start: '09:00', end: '12:00' },
        { start: '14:00', end: '18:00' }
      ],
      tuesday_slots: [
        { start: '09:00', end: '12:00' },
        { start: '14:00', end: '18:00' }
      ],
      wednesday_slots: [
        { start: '09:00', end: '12:00' },
        { start: '14:00', end: '18:00' }
      ],
      thursday_slots: [
        { start: '09:00', end: '12:00' },
        { start: '14:00', end: '18:00' }
      ],
      friday_slots: [
        { start: '09:00', end: '12:00' },
        { start: '14:00', end: '18:00' }
      ],
      saturday_slots: [
        { start: '09:00', end: '14:00' }
      ],
      sunday_slots: [],
      special_dates: {
        holidays: [
          { date: '2024-12-25', reason: 'Natal', closed: true },
          { date: '2024-01-01', reason: 'Ano Novo', closed: true }
        ]
      }
    }
    templates.push(template)
  }

  const { data, error } = await supabase.from('availability_templates').insert(templates).select()
  if (error) throw error

  console.log(`✅ ${templates.length} templates de disponibilidade criados`)
  return data
}

async function createAppointments(tenants, users, services) {
  const appointments = []
  const statuses = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled']

  // Criar agendamentos para os próximos 30 dias
  const today = new Date()
  const futureDate = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)

  for (let i = 0; i < 200; i++) {
    const tenant = randomFromArray(tenants)
    const user = randomFromArray(users)
    const tenantServices = services.filter(s => s.tenant_id === tenant.id)
    const service = randomFromArray(tenantServices)

    if (!service) continue

    const startTime = randomDate(today, futureDate)
    const endTime = new Date(startTime.getTime() + service.duration_minutes * 60 * 1000)

    const status = randomFromArray(statuses)
    
    const appointment = {
      id: uuidv4(),
      tenant_id: tenant.id,
      user_id: user.id,
      service_id: service.id,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      status: status,
      quoted_price: service.base_price,
      final_price: service.base_price + randomInt(-10, 20),
      currency: 'BRL',
      timezone: 'America/Sao_Paulo',
      customer_notes: randomFromArray([
        'Primeira vez no estabelecimento',
        'Cliente regular',
        'Tem alergia a produtos químicos',
        'Prefere horários matutinos',
        null
      ]),
      internal_notes: randomFromArray([
        'Cliente pontual',
        'Requer atenção especial',
        'VIP - tratamento premium',
        null
      ]),
      appointment_data: {
        booking_source: randomFromArray(['whatsapp', 'website', 'phone', 'in_person']),
        reminder_sent: randomFromArray([true, false]),
        confirmation_sent: randomFromArray([true, false])
      },
      // Se cancelado, adicionar campos obrigatórios
      cancelled_at: status === 'cancelled' ? randomDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), new Date()).toISOString() : null,
      cancelled_by: status === 'cancelled' ? randomFromArray(['customer', 'admin', 'system']) : null,
      cancellation_reason: status === 'cancelled' ? randomFromArray([
        'Cliente cancelou',
        'Conflito de horário',
        'Motivos pessoais',
        'Emergência',
        'Reagendamento solicitado'
      ]) : null
    }

    appointments.push(appointment)
  }

  const { data, error } = await supabase.from('appointments').insert(appointments).select()
  if (error) throw error

  console.log(`✅ ${appointments.length} agendamentos criados`)
  return data
}

async function createUserTenantRelations(users, tenants) {
  const relations = []

  // Cada usuário pode estar conectado a múltiplos tenants
  for (const user of users) {
    const numTenants = randomInt(1, 3)
    const userTenants = []

    for (let i = 0; i < numTenants; i++) {
      const tenant = randomFromArray(tenants.filter(t => !userTenants.includes(t.id)))
      if (!tenant) continue

      userTenants.push(tenant.id)

      const relation = {
        user_id: user.id,
        tenant_id: tenant.id,
        role: 'customer',
        total_bookings: randomInt(0, 10),
        first_interaction: randomDate(new Date(2024, 0, 1), new Date()).toISOString(),
        last_interaction: randomDate(new Date(2024, 6, 1), new Date()).toISOString(),
        tenant_preferences: {
          preferred_services: [],
          notification_settings: {
            appointment_reminders: true,
            marketing_messages: randomFromArray([true, false])
          }
        }
      }

      relations.push(relation)
    }
  }

  const { data, error } = await supabase.from('user_tenants').insert(relations).select()
  if (error) throw error

  console.log(`✅ ${relations.length} relações user-tenant criadas`)
  return data
}

async function createConversationHistory(tenants, users) {
  const conversations = []
  const intents = ['booking', 'cancellation', 'inquiry', 'emergency', 'pricing', 'availability']
  const messageTypes = ['text', 'audio', 'image']

  for (let i = 0; i < 300; i++) {
    const tenant = randomFromArray(tenants)
    const user = randomFromArray(users)

    const conversation = {
      id: uuidv4(),
      tenant_id: tenant.id,
      user_id: user.id,
      phone_number: user.phone,
      user_name: user.name,
      content: randomFromArray([
        'Olá, gostaria de agendar um horário',
        'Preciso cancelar meu agendamento',
        'Qual o preço do serviço?',
        'Vocês atendem amanhã?',
        'É urgente, preciso de ajuda',
        'Obrigado pelo atendimento'
      ]),
      message_type: randomFromArray(messageTypes),
      is_from_user: randomFromArray([true, false]),
      intent_detected: randomFromArray(intents),
      confidence_score: Math.random() * 0.4 + 0.6, // 0.6 a 1.0
      conversation_context: {
        previous_messages: randomInt(0, 5),
        session_id: uuidv4(),
        current_step: randomFromArray(['greeting', 'service_selection', 'datetime_selection', 'confirmation'])
      },
      raw_message: {
        message_id: `msg_${randomInt(100000, 999999)}`,
        timestamp: randomDate(new Date(2024, 0, 1), new Date()).toISOString(),
        from: user.phone,
        type: randomFromArray(messageTypes)
      }
    }

    conversations.push(conversation)
  }

  const { data, error } = await supabase.from('conversation_history').insert(conversations).select()
  if (error) throw error

  console.log(`✅ ${conversations.length} conversas criadas`)
  return data
}

async function createConversationStates(tenants, users) {
  const states = []

  // Criar states para usuários que têm conversas ativas
  const activeUsers = users.slice(0, 20) // Primeiros 20 usuários

  for (const user of activeUsers) {
    const tenant = randomFromArray(tenants)

    const state = {
      id: uuidv4(),
      tenant_id: tenant.id,
      phone_number: user.phone,
      current_step: randomFromArray(['greeting', 'service_selection', 'datetime_selection', 'confirmation', 'completed']),
      context: {
        user_name: user.name,
        selected_service: null,
        selected_datetime: null,
        booking_data: {},
        conversation_flow: [
          { step: 'greeting', completed: true },
          { step: 'service_selection', completed: randomFromArray([true, false]) }
        ]
      },
      last_message_at: randomDate(new Date(Date.now() - 24 * 60 * 60 * 1000), new Date()).toISOString()
    }

    states.push(state)
  }

  const { data, error } = await supabase.from('conversation_states').insert(states).select()
  if (error) throw error

  console.log(`✅ ${states.length} states de conversação criados`)
  return data
}

async function createWhatsAppTemplates(tenants) {
  const templates = []

  const templateData = [
    {
      name: 'Confirmação de Agendamento',
      template_name: 'appointment_confirmation',
      category: 'UTILITY',
      components: [
        {
          type: 'BODY',
          text: 'Olá {{1}}! Seu agendamento foi confirmado para {{2}} às {{3}}. Nos vemos lá!'
        }
      ]
    },
    {
      name: 'Lembrete de Agendamento',
      template_name: 'appointment_reminder',
      category: 'UTILITY',
      components: [
        {
          type: 'BODY',
          text: 'Lembrete: Você tem um agendamento amanhã às {{1}}. Confirme sua presença!'
        }
      ]
    },
    {
      name: 'Cancelamento de Agendamento',
      template_name: 'appointment_cancellation',
      category: 'UTILITY',
      components: [
        {
          type: 'BODY',
          text: 'Seu agendamento foi cancelado. Entre em contato para reagendar.'
        }
      ]
    }
  ]

  for (const tenant of tenants) {
    for (const template of templateData) {
      const whatsappTemplate = {
        id: uuidv4(),
        tenant_id: tenant.id,
        name: template.name,
        template_name: template.template_name,
        category: template.category,
        language_code: 'pt_BR',
        components: template.components,
        status: 'APPROVED',
        is_active: true
      }

      templates.push(whatsappTemplate)
    }
  }

  const { data, error } = await supabase.from('whatsapp_templates').insert(templates).select()
  if (error) throw error

  console.log(`✅ ${templates.length} templates WhatsApp criados`)
  return data
}

async function createSystemLogs(tenants) {
  const logs = []
  const components = ['api', 'whatsapp', 'ai', 'database', 'email', 'calendar']
  const statuses = ['healthy', 'warning', 'error']

  for (let i = 0; i < 100; i++) {
    const log = {
      id: uuidv4(),
      component: randomFromArray(components),
      status: randomFromArray(statuses),
      details: {
        timestamp: randomDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), new Date()).toISOString(),
        message: randomFromArray([
          'System operating normally',
          'High response time detected',
          'API rate limit reached',
          'Database connection restored',
          'Email sent successfully',
          'WhatsApp webhook timeout'
        ]),
        metrics: {
          response_time: randomInt(100, 2000),
          memory_usage: randomInt(60, 90),
          cpu_usage: randomInt(10, 80)
        }
      }
    }

    logs.push(log)
  }

  const { data, error } = await supabase.from('system_health_logs').insert(logs).select()
  if (error) throw error

  console.log(`✅ ${logs.length} logs de sistema criados`)
  return data
}

// Executar o script
if (require.main === module) {
  seedDatabase()
}

module.exports = { seedDatabase } 