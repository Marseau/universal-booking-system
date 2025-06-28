import OpenAI from 'openai'
import { MediaProcessor } from '../types/ai.types'

export class MediaProcessorService implements MediaProcessor {
  private openai: OpenAI

  constructor(openai: OpenAI) {
    this.openai = openai
  }

  /**
   * Process image content using GPT-4 Vision
   */
  async processImage(content: Buffer, mimeType: string): Promise<string> {
    try {
      // Convert buffer to base64
      const base64Image = content.toString('base64')
      const dataUrl = `data:${mimeType};base64,${base64Image}`

      // Use GPT-4 Vision to analyze the image
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-vision-preview',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analise esta imagem e descreva o que você vê de forma detalhada. Se for relacionado a um negócio ou serviço, identifique o contexto e forneça informações relevantes que possam ajudar no atendimento ao cliente.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: dataUrl,
                  detail: 'high'
                }
              }
            ]
          }
        ],
        max_tokens: 500,
        temperature: 0.3
      })

      return response.choices[0]?.message?.content || 'Não foi possível analisar a imagem'

    } catch (error) {
      console.error('Error processing image:', error)
      
      // Fallback analysis based on image metadata
      return this.fallbackImageAnalysis(mimeType)
    }
  }

  /**
   * Process audio content using Whisper
   */
  async processAudio(content: Buffer, mimeType: string): Promise<string> {
    try {
      // Create a temporary file-like object for the audio
      const audioFile = new File([content], 'audio.wav', { type: mimeType })

      // Use Whisper to transcribe the audio
      const transcription = await this.openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        language: 'pt', // Portuguese
        response_format: 'text',
        temperature: 0.0
      })

      return transcription || 'Não foi possível transcrever o áudio'

    } catch (error) {
      console.error('Error processing audio:', error)
      
      // Fallback analysis
      return this.fallbackAudioAnalysis(mimeType, content.length)
    }
  }

  /**
   * Extract text from documents
   */
  async extractText(content: Buffer, mimeType: string): Promise<string> {
    try {
      // For PDFs and documents, we would typically use a specialized library
      // For now, provide a basic implementation that can be extended
      
      if (mimeType.includes('pdf')) {
        return await this.extractPdfText(content)
      } else if (mimeType.includes('text')) {
        return content.toString('utf-8')
      } else if (mimeType.includes('word') || mimeType.includes('docx')) {
        return await this.extractWordText(content)
      } else {
        throw new Error(`Unsupported document type: ${mimeType}`)
      }

    } catch (error) {
      console.error('Error extracting text from document:', error)
      
      return this.fallbackDocumentAnalysis(mimeType, content.length)
    }
  }

  /**
   * Analyze media for business context
   */
  async analyzeForBusinessContext(analysis: string, businessDomain?: string): Promise<string> {
    try {
      const contextPrompt = `
Analise o seguinte conteúdo de mídia no contexto de um negócio ${businessDomain ? `do setor ${businessDomain}` : 'genérico'}:

${analysis}

Forneça insights relevantes para atendimento ao cliente, como:
- Possíveis necessidades ou interesses identificados
- Serviços que podem ser relevantes
- Informações que podem ajudar no agendamento
- Contexto que pode melhorar o atendimento

Responda de forma concisa e focada no atendimento.`

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: contextPrompt }],
        max_tokens: 300,
        temperature: 0.5
      })

      return response.choices[0]?.message?.content || analysis

    } catch (error) {
      console.error('Error analyzing business context:', error)
      return analysis
    }
  }

  /**
   * Detect if media contains sensitive information
   */
  async detectSensitiveContent(analysis: string): Promise<{ hasSensitive: boolean; concerns: string[] }> {
    const sensitivePatterns = [
      /cpf/i,
      /rg/i,
      /cartão de crédito/i,
      /senha/i,
      /documento\s+pessoal/i,
      /número\s+de\s+telefone/i,
      /endereço/i,
      /dados\s+bancários/i
    ]

    const concerns: string[] = []
    let hasSensitive = false

    for (const pattern of sensitivePatterns) {
      if (pattern.test(analysis)) {
        hasSensitive = true
        concerns.push(`Possível informação sensível detectada: ${pattern.source}`)
      }
    }

    return { hasSensitive, concerns }
  }

  /**
   * Fallback image analysis when vision API fails
   */
  private fallbackImageAnalysis(mimeType: string): string {
    const imageType = mimeType.split('/')[1] || 'unknown'
    return `Imagem recebida (formato: ${imageType}). Para uma análise detalhada, entre em contato diretamente conosco.`
  }

  /**
   * Fallback audio analysis when Whisper fails
   */
  private fallbackAudioAnalysis(mimeType: string, size: number): string {
    const duration = Math.round(size / 16000) // Rough estimate for audio duration
    return `Áudio recebido (${duration}s aproximadamente). Não foi possível transcrever automaticamente. Nossa equipe pode revisar o áudio se necessário.`
  }

  /**
   * Fallback document analysis when text extraction fails
   */
  private fallbackDocumentAnalysis(mimeType: string, size: number): string {
    const sizeKb = Math.round(size / 1024)
    return `Documento recebido (${sizeKb}KB, tipo: ${mimeType}). Para análise detalhada do conteúdo, nossa equipe pode revisar o documento.`
  }

  /**
   * Extract text from PDF (placeholder - would need pdf-parse or similar)
   */
  private async extractPdfText(content: Buffer): Promise<string> {
    // This would require a PDF parsing library like pdf-parse
    // For now, return a placeholder
    return 'Documento PDF recebido. Para análise completa, nossa equipe pode revisar o conteúdo.'
  }

  /**
   * Extract text from Word documents (placeholder - would need mammoth or similar)
   */
  private async extractWordText(content: Buffer): Promise<string> {
    // This would require a Word document parsing library like mammoth
    // For now, return a placeholder
    return 'Documento Word recebido. Para análise completa, nossa equipe pode revisar o conteúdo.'
  }

  /**
   * Validate media file size and type
   */
  validateMedia(content: Buffer, mimeType: string): { isValid: boolean; error?: string } {
    const maxSize = 25 * 1024 * 1024 // 25MB limit
    
    if (content.length > maxSize) {
      return {
        isValid: false,
        error: `Arquivo muito grande (${Math.round(content.length / 1024 / 1024)}MB). Limite: 25MB`
      }
    }

    const supportedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'audio/mpeg',
      'audio/wav',
      'audio/ogg',
      'audio/mp4',
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]

    if (!supportedTypes.includes(mimeType)) {
      return {
        isValid: false,
        error: `Tipo de arquivo não suportado: ${mimeType}`
      }
    }

    return { isValid: true }
  }

  /**
   * Get processing capabilities for different media types
   */
  getCapabilities(): Record<string, string[]> {
    return {
      'image': ['analysis', 'description', 'business_context', 'sensitive_detection'],
      'audio': ['transcription', 'business_context', 'sensitive_detection'],
      'document': ['text_extraction', 'business_context', 'sensitive_detection'],
      'video': ['frame_analysis'] // Future capability
    }
  }

  async processVideo(videoUrl: string): Promise<string> {
    // TODO: Implement video processing
    return `Processed video: ${videoUrl}`;
  }

  async processDocument(docUrl: string): Promise<string> {
    // TODO: Implement document processing
    return `Processed document: ${docUrl}`;
  }
}

export default MediaProcessorService