import { AIAgent, AIFunction } from '../../types/ai.types'
import { BusinessDomain } from '../../types/database.types'
import { LegalAgent } from './legal-agent'
import { HealthcareAgent } from './healthcare-agent'
import { EducationAgent } from './education-agent'
import { BeautyAgent } from './beauty-agent'
import { SportsAgent } from './sports-agent'
import { ConsultingAgent } from './consulting-agent'
import { GeneralAgent } from './general-agent'

export class AgentFactory {
  private agents: Map<BusinessDomain | 'other', AIAgent> = new Map()

  constructor() {
    this.initializeAgents()
  }

  private initializeAgents(): void {
    // Initialize specialized agents
    this.agents.set('legal', new LegalAgent().getAgent())
    this.agents.set('healthcare', new HealthcareAgent().getAgent())
    this.agents.set('education', new EducationAgent().getAgent())
    this.agents.set('beauty', new BeautyAgent().getAgent())
    this.agents.set('sports', new SportsAgent().getAgent())
    this.agents.set('consulting', new ConsultingAgent().getAgent())
    this.agents.set('other', new GeneralAgent().getAgent())

    console.log('🤖 AI Agents initialized for all business domains')
  }

  /**
   * Get specialized agent for business domain
   */
  getAgent(domain: BusinessDomain | 'other'): AIAgent {
    const agent = this.agents.get(domain)
    if (!agent) {
      console.warn(`⚠️  No agent found for domain: ${domain}, using general agent`)
      return this.agents.get('other')!
    }
    return agent
  }

  /**
   * Get all available agents
   */
  getAllAgents(): Map<BusinessDomain | 'other', AIAgent> {
    return new Map(this.agents)
  }

  /**
   * Get agent capabilities by domain
   */
  getAgentCapabilities(domain: BusinessDomain | 'other'): string[] {
    const agent = this.getAgent(domain)
    return agent.capabilities || []
  }

  /**
   * Get agent functions by domain
   */
  getAgentFunctions(domain: BusinessDomain | 'other'): AIFunction[] {
    const agent = this.getAgent(domain)
    return agent.functions || []
  }

  /**
   * Check if domain has specialized agent
   */
  hasSpecializedAgent(domain: BusinessDomain | 'other'): boolean {
    return this.agents.has(domain) && domain !== 'other'
  }

  /**
   * Get supported domains
   */
  getSupportedDomains(): (BusinessDomain | 'other')[] {
    return Array.from(this.agents.keys())
  }
}