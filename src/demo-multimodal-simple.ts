import { MultiModalHelpers } from './services/multimodal-helpers.service'

/**
 * Demonstração simples do sistema multi-modal
 */
async function demoMultiModal() {
  console.log('🎬 ===== DEMO MULTI-MODAL ===== 🎬\n')

  const helpers = new MultiModalHelpers()

  // Teste 1: Análise de texto
  console.log('📝 TESTE 1: Análise de Texto')
  const textos = [
    'Gostaria de agendar um corte para amanhã às 14h',
    'Preciso cancelar urgente meu horário!',
    'Qual o preço de uma escova?'
  ]

  for (let i = 0; i < textos.length; i++) {
    const texto = textos[i]!
    console.log(`\n${i + 1}. "${texto}"`)
    
    try {
      const businessContext = await helpers.analyzeTextForBusiness(texto, 'beauty')
      const emotion = await helpers.analyzeTextEmotion(texto)
      
      console.log(`   😊 Emoção: ${emotion.tone}`)
      console.log(`   📊 Sentimento: ${emotion.sentimentScore.toFixed(2)}`)
      console.log(`   🔧 Ações: ${businessContext.suggestedActions.join(', ')}`)
      console.log(`   ⚠️  Urgência: ${businessContext.urgencyLevel}`)
    } catch (error) {
      console.log(`   ❌ Erro: ${error}`)
    }
  }

  // Teste 2: Simulação de áudio
  console.log('\n\n🎵 TESTE 2: Processamento de Áudio (Simulado)')
  const transcricoes = [
    'Oi meninas! Queria agendar um corte para sexta às três da tarde',
    'Estou muito chateada com o último atendimento!'
  ]

  for (let i = 0; i < transcricoes.length; i++) {
    const transcricao = transcricoes[i]!
    console.log(`\n${i + 1}. Transcrição: "${transcricao}"`)
    
    try {
      const emotion = await helpers.analyzeTextEmotion(transcricao)
      const businessContext = await helpers.analyzeTextForBusiness(transcricao, 'beauty')
      
      console.log(`   😊 Tom: ${emotion.tone}`)
      console.log(`   📊 Score: ${emotion.sentimentScore.toFixed(2)}`)
      console.log(`   🔧 Ação recomendada: ${businessContext.suggestedActions[0] || 'continue_conversation'}`)
    } catch (error) {
      console.log(`   ❌ Erro: ${error}`)
    }
  }

  // Teste 3: Capacidades
  console.log('\n\n⚙️  CAPACIDADES DO SISTEMA')
  console.log('✅ Análise de texto com emoção')
  console.log('✅ Contexto de negócio')
  console.log('✅ Extração de entidades')
  console.log('✅ Suporte multi-modal')
  console.log('✅ Cache inteligente')
  console.log('✅ Detecção de idioma')

  // Teste 4: Detecção de idioma
  console.log('\n\n🌍 DETECÇÃO DE IDIOMA')
  const samples = [
    'Olá, como vai você?',
    'Hello, how are you?',
    'Hola, ¿cómo estás?'
  ]

  for (const sample of samples) {
    const lang = helpers.detectLanguageFallback(sample)
    console.log(`   "${sample}" → ${lang}`)
  }

  console.log('\n✅ Demo concluída com sucesso! 🎉')
}

// Executar se chamado diretamente
if (require.main === module) {
  demoMultiModal()
    .then(() => {
      console.log('\n🏁 Demo finalizada!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('\n❌ Erro:', error)
      process.exit(1)
    })
}

export { demoMultiModal } 