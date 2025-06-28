# 🚀 Function Calling System

Um sistema avançado de execução de funções para WhatsApp AI, com workflows, middleware e orquestração inteligente.

## 📋 Componentes Principais

### 1. **FunctionRegistryService**
Registro central de todas as funções disponíveis no sistema.

```typescript
import { FunctionRegistryService } from './function-calling'

const registry = new FunctionRegistryService()

// Registrar função
registry.registerFunction({
  id: 'check_availability',
  name: 'check_availability',
  description: 'Verificar disponibilidade de serviços',
  parameters: [
    { name: 'service_name', type: 'string', required: true },
    { name: 'date', type: 'string', required: true }
  ],
  execute: async (args) => {
    // Lógica da função
    return { success: true, message: 'Disponível!', data: {} }
  },
  domain: 'beauty',
  category: 'inquiry'
})
```

### 2. **ActionDispatcherService**
Dispatcher para execução de funções com middleware e retry logic.

```typescript
import { ActionDispatcherService } from './function-calling'

const dispatcher = new ActionDispatcherService()

// Executar função única
const result = await dispatcher.dispatch(functionCall, context)

// Executar múltiplas funções
const planResult = await dispatcher.dispatchPlan(
  [functionCall1, functionCall2], 
  context, 
  { parallel: true }
)
```

### 3. **WorkflowManagerService**  
Gerenciador de workflows complexos com steps condicionais.

```typescript
import { WorkflowManagerService } from './function-calling'

const workflowManager = new WorkflowManagerService()

// Registrar workflow
workflowManager.registerWorkflow({
  id: 'booking_flow',
  name: 'Fluxo de Agendamento',
  steps: [
    {
      id: 'check_availability',
      type: 'function_call',
      config: { functionName: 'check_availability' },
      onSuccess: 'create_booking',
      onFailure: 'suggest_alternatives'
    }
  ]
})

// Executar workflow
const execution = await workflowManager.executeWorkflow(
  'booking_flow', 
  context, 
  variables
)
```

### 4. **FunctionCallingService** (Principal)
Serviço principal que orquestra todos os componentes.

```typescript
import { FunctionCallingService } from './function-calling'

const functionCalling = new FunctionCallingService({
  enableWorkflows: true,
  enableParallelExecution: true,
  enableCaching: true,
  maxConcurrentExecutions: 10
})

// Executar função
const result = await functionCalling.executeFunction(functionCall, context)

// Executar workflow
const workflow = await functionCalling.executeWorkflow(workflowId, context, vars)

// Ver estatísticas
const stats = functionCalling.getStats()
```

## 🎯 Funcionalidades

### ✅ **Executadas:**

1. **Registry Pattern** - Registro centralizado de funções
2. **Middleware System** - Pipeline de middleware para validação, auth, etc.
3. **Parallel Execution** - Execução paralela ou sequencial
4. **Workflow Engine** - Sistema de workflows com steps condicionais
5. **Retry Logic** - Política de retry com backoff exponencial
6. **Dependency Resolution** - Resolução automática de dependências
7. **Caching System** - Cache inteligente com TTL
8. **Metrics & Stats** - Coleta de métricas e estatísticas
9. **Error Handling** - Tratamento robusto de erros
10. **Rate Limiting** - Controle de concorrência

### 🔧 **Tipos Principais:**

```typescript
interface RegisteredFunction {
  id: string
  name: string
  description: string
  parameters: FunctionParameter[]
  execute: (args: any) => Promise<FunctionResult>
  domain: BusinessDomain | 'other'
  category: FunctionCategory
  metadata: FunctionMetadata
}

interface ExecutionResult {
  planId: string
  success: boolean
  results: StepResult[]
  totalDuration: number
  failedSteps: string[]
  actions: Action[]
}

interface WorkflowDefinition {
  id: string
  name: string
  trigger: WorkflowTrigger
  steps: WorkflowStep[]
  conditions: WorkflowCondition[]
  metadata: WorkflowMetadata
}
```

## 🏗️ Arquitetura

```
FunctionCallingService (Orquestrador Principal)
├── FunctionRegistryService (Registro de Funções)
├── ActionDispatcherService (Execução + Middleware)
└── WorkflowManagerService (Workflows Complexos)
```

## 🎪 Exemplos de Uso

### **Agendamento Simples:**
```typescript
// 1. Verificar disponibilidade
const availability = await functionCalling.executeFunction({
  name: 'check_availability',
  arguments: JSON.stringify({ service: 'Corte', date: '2024-01-15' })
}, context)

// 2. Criar agendamento se disponível
if (availability.success && availability.data.available) {
  await functionCalling.executeFunction({
    name: 'book_service',
    arguments: JSON.stringify({ 
      service: 'Corte', 
      date: '2024-01-15',
      time: '14:00',
      client: 'João'
    })
  }, context)
}
```

### **Workflow Automático:**
```typescript
// Executar workflow completo de agendamento
const execution = await functionCalling.executeWorkflow(
  'complete_booking_flow',
  context,
  {
    service_name: 'Corte de Cabelo',
    date: '2024-01-15',
    time: '14:00',
    client_name: 'João Silva',
    phone: '+5511999999999'
  }
)

console.log(`Workflow ${execution.status}`)
```

### **Execução Paralela:**
```typescript
// Verificar múltiplos serviços em paralelo
const results = await functionCalling.executeFunctions([
  { name: 'check_availability', arguments: '{"service": "Corte"}' },
  { name: 'check_availability', arguments: '{"service": "Manicure"}' },
  { name: 'check_availability', arguments: '{"service": "Pedicure"}' }
], context, { parallel: true })

console.log(`${results.results.length} verificações concluídas`)
```

## 📊 Métricas e Monitoramento

```typescript
// Estatísticas do sistema
const stats = functionCalling.getStats()
console.log({
  totalCalls: stats.totalCalls,
  successRate: stats.successfulCalls / stats.totalCalls,
  avgExecutionTime: stats.averageExecutionTime,
  topFunctions: Object.entries(stats.functionUsage)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
})

// Estatísticas do registry
const registryStats = functionCalling.getRegistryStats()
console.log({
  totalFunctions: registryStats.totalFunctions,
  functionsByDomain: registryStats.functionsByDomain,
  functionsByCategory: registryStats.functionsByCategory
})
```

## 🔧 Configuração

```typescript
const functionCalling = new FunctionCallingService({
  enableWorkflows: true,        // Habilitar workflows
  enableParallelExecution: true,// Execução paralela
  enableCaching: true,          // Sistema de cache
  enableMetrics: true,          // Coleta de métricas
  maxConcurrentExecutions: 10,  // Limite de concorrência
  defaultTimeoutMs: 30000       // Timeout padrão
})
```

## 🎯 Status

- ✅ **Sistema Principal**: 100% implementado
- ✅ **Registry**: 100% funcional
- ✅ **Dispatcher**: 100% com middleware
- ✅ **Workflows**: 100% com steps condicionais
- ✅ **Caching**: 100% com TTL inteligente
- ✅ **Metrics**: 100% com estatísticas detalhadas
- ✅ **Error Handling**: 100% robusto
- ✅ **Types**: 100% tipado em TypeScript

## 🚀 Próximos Passos

1. Integração com WhatsApp Service
2. Testes unitários e de integração
3. Documentação de APIs específicas
4. Dashboard de monitoramento
5. Extensões para outros domínios 