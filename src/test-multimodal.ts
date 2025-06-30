// Teste básico do sistema multi-modal
import { MultiModalHelpers } from './services/multimodal-helpers.service'

async function testMultiModal(): Promise<void> {
  console.log('🧪 Testando Sistema Multi-Modal...\n')

  const helpers = new MultiModalHelpers()
  let successCount = 0
  let totalTests = 0

  // Teste 1: Análise de emoção
  totalTests++
  try {
    const emotion = await helpers.analyzeTextEmotion('Estou muito feliz com o atendimento!')
    console.log(`✅ Análise de emoção: ${emotion.tone} (${emotion.confidence.toFixed(2)})`)
    successCount++
  } catch (error) {
    console.log(`❌ Análise de emoção falhou: ${error}`)
  }

  // Teste 2: Contexto de negócio
  totalTests++
  try {
    const context = await helpers.analyzeTextForBusiness('Quero agendar um corte de cabelo', 'beauty')
    console.log(`✅ Contexto de negócio: ${context.suggestedActions.join(', ')}`)
    successCount++
  } catch (error) {
    console.log(`❌ Contexto de negócio falhou: ${error}`)
  }

  // Teste 3: Detecção de idioma
  totalTests++
  try {
    const lang = helpers.detectLanguageFallback('Olá, como você está?')
    console.log(`✅ Detecção de idioma: ${lang}`)
    successCount++
  } catch (error) {
    console.log(`❌ Detecção de idioma falhou: ${error}`)
  }

  // Teste 4: Extração de entidades
  totalTests++
  try {
    const entities = await helpers.extractEntitiesFromText('Quero agendar para amanhã às 14h')
    console.log(`✅ Extração de entidades: ${entities.length} entidades encontradas`)
    successCount++
  } catch (error) {
    console.log(`❌ Extração de entidades falhou: ${error}`)
  }

  // Teste 5: Geração de cache key
  totalTests++
  try {
    const key = helpers.generateCacheKey({ type: 'text', content: 'teste', mimeType: 'text/plain' })
    console.log(`✅ Cache key gerada: ${key.substring(0, 20)}...`)
    successCount++
  } catch (error) {
    console.log(`❌ Cache key falhou: ${error}`)
  }

  console.log(`\n📊 Resultado: ${successCount}/${totalTests} testes passaram`)
  console.log(`🎯 Taxa de sucesso: ${((successCount / totalTests) * 100).toFixed(1)}%`)

  if (successCount === totalTests) {
    console.log('🎉 Todos os testes passaram!')
  } else {
    console.log('⚠️  Alguns testes falharam')
  }
}

// Executar teste
testMultiModal()
  .then(() => console.log('\n✅ Teste concluído'))
  .catch(error => console.error('\n❌ Erro no teste:', error)) 