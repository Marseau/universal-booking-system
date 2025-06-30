const { createClient } = require('@supabase/supabase-js')
const axios = require('axios')
const fs = require('fs')
const path = require('path')

// Configuração
const SUPABASE_URL = process.env.SUPABASE_URL || 'sua_url_supabase'
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sua_chave_anonima'
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Cores para console
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
}

// Utilitários
const log = {
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️ ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ️ ${msg}${colors.reset}`),
  test: (msg) => console.log(`${colors.cyan}🧪 ${msg}${colors.reset}`),
  header: (msg) => console.log(`\n${colors.bright}${colors.magenta}🚀 ${msg}${colors.reset}`)
}

// Contadores de teste
let testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  warnings: 0,
  startTime: Date.now()
}

// Função para executar teste
async function runTest(testName, testFunction) {
  testResults.total++
  log.test(`Executando: ${testName}`)
  
  try {
    const result = await testFunction()
    if (result === false) {
      testResults.failed++
      log.error(`FALHOU: ${testName}`)
      return false
    } else if (result === 'warning') {
      testResults.warnings++
      log.warning(`AVISO: ${testName}`)
      return 'warning'
    } else {
      testResults.passed++
      log.success(`PASSOU: ${testName}`)
      return true
    }
  } catch (error) {
    testResults.failed++
    log.error(`ERRO: ${testName} - ${error.message}`)
    return false
  }
}

// 1. TESTES DE CONECTIVIDADE E CONFIGURAÇÃO
async function testDatabaseConnection() {
  try {
    const { data, error } = await supabase.from('tenants').select('count').limit(1)
    return !error
  } catch (error) {
    return false
  }
}

async function testAPIServer() {
  try {
    const response = await axios.get(`${API_BASE_URL}/health`, { timeout: 5000 })
    return response.status === 200
  } catch (error) {
    return false
  }
}

// 2. TESTES DE DADOS E ESTRUTURA
async function testDataIntegrity() {
  const checks = [
    { table: 'tenants', expected: 30, description: 'Tenants criados' },
    { table: 'users', expected: 50, description: 'Usuários criados' },
    { table: 'admin_users', expected: 30, description: 'Admin users criados' },
    { table: 'services', expected: 165, description: 'Serviços criados' },
    { table: 'appointments', expected: 200, description: 'Agendamentos criados' },
    { table: 'conversation_history', expected: 300, description: 'Conversas criadas' }
  ]

  for (const check of checks) {
    const { count, error } = await supabase
      .from(check.table)
      .select('*', { count: 'exact', head: true })
    
    if (error || count !== check.expected) {
      log.error(`${check.description}: Esperado ${check.expected}, encontrado ${count || 0}`)
      return false
    }
  }
  
  return true
}

async function testRelationships() {
  // Verificar se todos os serviços têm tenant_id válido
  const { data: services, error: servicesError } = await supabase
    .from('services')
    .select('id, tenant_id, tenants(id)')
    
  if (servicesError) return false
  
  const invalidServices = services.filter(s => !s.tenants)
  if (invalidServices.length > 0) {
    log.error(`${invalidServices.length} serviços com tenant_id inválido`)
    return false
  }

  // Verificar se todos os agendamentos têm relacionamentos válidos
  const { data: appointments, error: appointmentsError } = await supabase
    .from('appointments')
    .select('id, tenant_id, user_id, service_id, tenants(id), users(id), services(id)')
    
  if (appointmentsError) return false
  
  const invalidAppointments = appointments.filter(a => 
    !a.tenants || !a.users || !a.services
  )
  
  if (invalidAppointments.length > 0) {
    log.error(`${invalidAppointments.length} agendamentos com relacionamentos inválidos`)
    return false
  }

  return true
}

// 3. TESTES DE API ENDPOINTS
async function testTenantsAPI() {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/tenants`)
    
    if (response.status !== 200) return false
    if (!Array.isArray(response.data)) return false
    if (response.data.length !== 30) return false
    
    // Verificar estrutura dos dados
    const tenant = response.data[0]
    const requiredFields = ['id', 'name', 'slug', 'domain', 'subscription_status']
    
    for (const field of requiredFields) {
      if (!(field in tenant)) {
        log.error(`Campo obrigatório '${field}' não encontrado em tenant`)
        return false
      }
    }
    
    return true
  } catch (error) {
    return false
  }
}

async function testServicesAPI() {
  try {
    // Buscar um tenant para testar
    const { data: tenants } = await supabase.from('tenants').select('id').limit(1)
    const tenantId = tenants[0].id
    
    const response = await axios.get(`${API_BASE_URL}/api/tenants/${tenantId}/services`)
    
    if (response.status !== 200) return false
    if (!Array.isArray(response.data)) return false
    
    // Verificar estrutura dos serviços
    if (response.data.length > 0) {
      const service = response.data[0]  
      const requiredFields = ['id', 'name', 'base_price', 'duration_minutes']
      
      for (const field of requiredFields) {
        if (!(field in service)) {
          log.error(`Campo obrigatório '${field}' não encontrado em service`)
          return false
        }
      }
    }
    
    return true
  } catch (error) {
    return false
  }
}

async function testAppointmentsAPI() {
  try {
    // Buscar um tenant para testar
    const { data: tenants } = await supabase.from('tenants').select('id').limit(1)
    const tenantId = tenants[0].id
    
    const response = await axios.get(`${API_BASE_URL}/api/tenants/${tenantId}/appointments`)
    
    if (response.status !== 200) return false
    if (!Array.isArray(response.data)) return false
    
    // Verificar estrutura dos agendamentos
    if (response.data.length > 0) {
      const appointment = response.data[0]
      const requiredFields = ['id', 'start_time', 'end_time', 'status']
      
      for (const field of requiredFields) {
        if (!(field in appointment)) {
          log.error(`Campo obrigatório '${field}' não encontrado em appointment`)
          return false
        }
      }
    }
    
    return true
  } catch (error) {
    return false
  }
}

// 4. TESTES DE IA E MULTIMODAL
async function testAIIntentRecognition() {
  try {
    const testMessages = [
      { text: "Quero marcar um horário", expectedIntent: "booking" },
      { text: "Qual o preço do corte?", expectedIntent: "pricing" },
      { text: "Preciso cancelar meu agendamento", expectedIntent: "cancellation" },
      { text: "Que horários vocês têm disponível?", expectedIntent: "availability" }
    ]

    for (const testMsg of testMessages) {
      const response = await axios.post(`${API_BASE_URL}/api/ai/intent`, {
        message: testMsg.text,
        tenantId: (await supabase.from('tenants').select('id').limit(1)).data[0].id
      })
      
      if (response.status !== 200) return false
      
      const result = response.data
      if (!result.intent) {
        log.error(`Não foi possível detectar intenção para: "${testMsg.text}"`)
        return false
      }
    }
    
    return true
  } catch (error) {
    return false
  }
}

async function testDomainAgents() {
  const domains = ['beauty', 'healthcare', 'legal', 'education', 'sports', 'consulting']
  
  for (const domain of domains) {
    try {
      // Buscar tenant do domínio
      const { data: tenants } = await supabase
        .from('tenants')
        .select('id')
        .eq('domain', domain)
        .limit(1)
      
      if (!tenants || tenants.length === 0) continue
      
      const response = await axios.post(`${API_BASE_URL}/api/ai/domain-agent`, {
        domain: domain,
        message: "Olá, gostaria de informações sobre os serviços",
        tenantId: tenants[0].id
      })
      
      if (response.status !== 200) return false
      
      const result = response.data
      if (!result.response || !result.agent_type) {
        log.error(`Agente ${domain} não respondeu adequadamente`)
        return false
      }
      
    } catch (error) {
      log.error(`Erro testando agente ${domain}: ${error.message}`)
      return false
    }
  }
  
  return true
}

async function testMultimodalProcessing() {
  try {
    // Teste de processamento de texto
    const textResponse = await axios.post(`${API_BASE_URL}/api/ai/multimodal`, {
      type: 'text',
      content: 'Quero agendar um corte de cabelo',
      tenantId: (await supabase.from('tenants').select('id').limit(1)).data[0].id
    })
    
    if (textResponse.status !== 200) return false
    
    // Teste básico - o sistema deve processar e retornar uma resposta
    const result = textResponse.data
    if (!result.processed || !result.response) {
      log.error('Processamento multimodal de texto falhou')
      return false
    }
    
    return true
  } catch (error) {
    return false
  }
}

// 5. TESTES DE WHATSAPP E INTEGRAÇÃO
async function testWhatsAppWebhook() {
  try {
    const webhookData = {
      entry: [{
        changes: [{
          value: {
            messages: [{
              id: 'test_message_id',
              from: '5511999999999',
              text: { body: 'Teste de webhook' },
              timestamp: Math.floor(Date.now() / 1000)
            }]
          }
        }]
      }]
    }
    
    const response = await axios.post(`${API_BASE_URL}/webhook/whatsapp`, webhookData)
    
    // Webhook deve processar sem erro (200 ou 202)
    return response.status === 200 || response.status === 202
  } catch (error) {
    return false
  }
}

async function testWhatsAppTemplates() {
  try {
    const { data: templates, error } = await supabase
      .from('whatsapp_templates')
      .select('*')
      .limit(5)
    
    if (error) return false
    
    for (const template of templates) {
      if (!template.name || !template.language || !template.template_data) {
        log.error(`Template WhatsApp inválido: ${template.id}`)
        return false
      }
    }
    
    return true
  } catch (error) {
    return false
  }
}

// 6. TESTES DE AUTENTICAÇÃO E AUTORIZAÇÃO
async function testAdminAuthentication() {
  try {
    // Buscar um admin user para teste
    const { data: adminUsers } = await supabase
      .from('admin_users')
      .select('email, role')
      .limit(1)
    
    if (!adminUsers || adminUsers.length === 0) return false
    
    const adminUser = adminUsers[0]
    
    // Verificar se tem role válido
    const validRoles = ['super_admin', 'tenant_admin', 'support']
    if (!validRoles.includes(adminUser.role)) {
      log.error(`Role inválido para admin: ${adminUser.role}`)
      return false
    }
    
    return true
  } catch (error) {
    return false
  }
}

async function testTenantIsolation() {
  try {
    // Verificar se cada tenant tem apenas seus próprios dados
    const { data: tenants } = await supabase.from('tenants').select('id').limit(2)
    
    if (tenants.length < 2) return false
    
    const tenant1 = tenants[0].id
    const tenant2 = tenants[1].id
    
    // Verificar serviços
    const { data: services1 } = await supabase
      .from('services')
      .select('id')
      .eq('tenant_id', tenant1)
    
    const { data: services2 } = await supabase
      .from('services')
      .select('id')
      .eq('tenant_id', tenant2)
    
    // Verificar se não há overlap de serviços entre tenants
    const service1Ids = new Set(services1.map(s => s.id))
    const service2Ids = new Set(services2.map(s => s.id))
    
    const intersection = [...service1Ids].filter(id => service2Ids.has(id))
    
    if (intersection.length > 0) {
      log.error('Isolamento de tenant comprometido - serviços compartilhados')
      return false
    }
    
    return true
  } catch (error) {
    return false
  }
}

// 7. TESTES DE PERFORMANCE
async function testDatabasePerformance() {
  const performanceTests = [
    {
      name: 'Consulta de tenants',
      query: () => supabase.from('tenants').select('*'),
      maxTime: 1000
    },
    {
      name: 'Consulta de serviços com join',
      query: () => supabase.from('services').select('*, tenants(name), service_categories(name)').limit(50),
      maxTime: 2000
    },
    {
      name: 'Consulta complexa de agendamentos',
      query: () => supabase
        .from('appointments')
        .select('*, users(name), services(name), tenants(name)')
        .gte('start_time', new Date().toISOString())
        .limit(20),
      maxTime: 3000
    }
  ]

  for (const test of performanceTests) {
    const startTime = Date.now()
    
    try {
      const { data, error } = await test.query()
      const endTime = Date.now()
      const duration = endTime - startTime
      
      if (error) {
        log.error(`${test.name}: Erro na consulta`)
        return false
      }
      
      if (duration > test.maxTime) {
        log.warning(`${test.name}: Lento (${duration}ms > ${test.maxTime}ms)`)
      } else {
        log.info(`${test.name}: Rápido (${duration}ms)`)
      }
      
    } catch (error) {
      log.error(`${test.name}: Exceção - ${error.message}`)
      return false
    }
  }
  
  return true
}

async function testAPIPerformance() {
  const apiTests = [
    { endpoint: '/api/tenants', maxTime: 1500 },
    { endpoint: '/health', maxTime: 500 }
  ]

  for (const test of apiTests) {
    const startTime = Date.now()
    
    try {
      const response = await axios.get(`${API_BASE_URL}${test.endpoint}`, { timeout: 10000 })
      const endTime = Date.now()
      const duration = endTime - startTime
      
      if (response.status !== 200) {
        log.error(`${test.endpoint}: Status inválido ${response.status}`)
        return false
      }
      
      if (duration > test.maxTime) {
        log.warning(`${test.endpoint}: Lento (${duration}ms > ${test.maxTime}ms)`)
      } else {
        log.info(`${test.endpoint}: Rápido (${duration}ms)`)
      }
      
    } catch (error) {
      log.error(`${test.endpoint}: Erro - ${error.message}`)
      return false
    }
  }
  
  return true
}

// 8. TESTES DE REGRAS DE NEGÓCIO
async function testBusinessRules() {
  try {
    // Verificar se não há agendamentos sobrepostos para o mesmo serviço
    const { data: appointments } = await supabase
      .from('appointments')
      .select('service_id, start_time, end_time')
      .eq('status', 'confirmed')
      .order('service_id, start_time')
    
    let conflicts = 0
    for (let i = 0; i < appointments.length - 1; i++) {
      const current = appointments[i]
      const next = appointments[i + 1]
      
      if (current.service_id === next.service_id) {
        const currentEnd = new Date(current.end_time)
        const nextStart = new Date(next.start_time)
        
        if (currentEnd > nextStart) {
          conflicts++
        }
      }
    }
    
    if (conflicts > 0) {
      log.warning(`${conflicts} conflitos de agendamento encontrados`)
      return 'warning'
    }
    
    return true
  } catch (error) {
    return false
  }
}

async function testDataConsistency() {
  try {
    // Verificar preços válidos
    const { data: services } = await supabase
      .from('services')
      .select('id, base_price')
      .lte('base_price', 0)
    
    if (services.length > 0) {
      log.error(`${services.length} serviços com preço inválido`)
      return false
    }
    
    // Verificar durações válidas
    const { data: invalidDuration } = await supabase
      .from('services')
      .select('id, duration_minutes')
      .lte('duration_minutes', 0)
    
    if (invalidDuration.length > 0) {
      log.error(`${invalidDuration.length} serviços com duração inválida`)
      return false
    }
    
    return true
  } catch (error) {
    return false
  }
}

// 9. FUNÇÃO PRINCIPAL DE TESTE
async function runComprehensiveTests() {
  log.header('INICIANDO SUITE COMPLETA DE TESTES')
  log.info(`Timestamp: ${new Date().toISOString()}`)
  log.info(`API Base URL: ${API_BASE_URL}`)
  log.info(`Supabase URL: ${SUPABASE_URL}`)
  
  // 1. Testes de Conectividade
  log.header('1. TESTES DE CONECTIVIDADE')
  await runTest('Conexão com banco de dados', testDatabaseConnection)
  await runTest('Servidor API respondendo', testAPIServer)
  
  // 2. Testes de Dados
  log.header('2. TESTES DE INTEGRIDADE DOS DADOS')
  await runTest('Integridade dos dados seed', testDataIntegrity)
  await runTest('Relacionamentos entre tabelas', testRelationships)
  
  // 3. Testes de API
  log.header('3. TESTES DE ENDPOINTS DA API')
  await runTest('API de Tenants', testTenantsAPI)
  await runTest('API de Serviços', testServicesAPI)
  await runTest('API de Agendamentos', testAppointmentsAPI)
  
  // 4. Testes de IA
  log.header('4. TESTES DE INTELIGÊNCIA ARTIFICIAL')
  await runTest('Reconhecimento de intenção', testAIIntentRecognition)
  await runTest('Agentes por domínio', testDomainAgents)
  await runTest('Processamento multimodal', testMultimodalProcessing)
  
  // 5. Testes de WhatsApp
  log.header('5. TESTES DE INTEGRAÇÃO WHATSAPP')
  await runTest('Webhook WhatsApp', testWhatsAppWebhook)
  await runTest('Templates WhatsApp', testWhatsAppTemplates)
  
  // 6. Testes de Segurança
  log.header('6. TESTES DE AUTENTICAÇÃO E AUTORIZAÇÃO')
  await runTest('Autenticação de admin', testAdminAuthentication)
  await runTest('Isolamento de tenant', testTenantIsolation)
  
  // 7. Testes de Performance
  log.header('7. TESTES DE PERFORMANCE')
  await runTest('Performance do banco', testDatabasePerformance)
  await runTest('Performance da API', testAPIPerformance)
  
  // 8. Testes de Regras de Negócio
  log.header('8. TESTES DE REGRAS DE NEGÓCIO')
  await runTest('Regras de agendamento', testBusinessRules)
  await runTest('Consistência dos dados', testDataConsistency)
  
  // Relatório Final
  const endTime = Date.now()
  const duration = Math.round((endTime - testResults.startTime) / 1000)
  
  log.header('RELATÓRIO FINAL DOS TESTES')
  console.log(`
📊 ESTATÍSTICAS:
   ✅ Testes Passaram: ${testResults.passed}
   ❌ Testes Falharam: ${testResults.failed}
   ⚠️ Avisos: ${testResults.warnings}
   📈 Total de Testes: ${testResults.total}
   ⏱️ Tempo de Execução: ${duration}s

📈 TAXA DE SUCESSO: ${Math.round((testResults.passed / testResults.total) * 100)}%

${testResults.failed === 0 
  ? '🎉 TODOS OS TESTES CRÍTICOS PASSARAM! Sistema pronto para produção.' 
  : `🔥 ${testResults.failed} TESTE(S) FALHARAM! Revisar antes de produção.`}

${testResults.warnings > 0 
  ? `⚠️ ${testResults.warnings} AVISO(S) - Considerar otimizações.` 
  : ''}
  `)
  
  // Salvar relatório em arquivo
  const reportData = {
    timestamp: new Date().toISOString(),
    duration: duration,
    results: testResults,
    environment: {
      apiUrl: API_BASE_URL,
      supabaseUrl: SUPABASE_URL
    }
  }
  
  fs.writeFileSync('test-report.json', JSON.stringify(reportData, null, 2))
  log.info('Relatório salvo em: test-report.json')
  
  process.exit(testResults.failed === 0 ? 0 : 1)
}

// Executar testes se chamado diretamente
if (require.main === module) {
  runComprehensiveTests().catch(error => {
    log.error(`Erro fatal nos testes: ${error.message}`)
    process.exit(1)
  })
}

module.exports = {
  runComprehensiveTests,
  runTest,
  testResults
} 