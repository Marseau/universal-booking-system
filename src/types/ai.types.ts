import { BusinessDomain } from './database.types'

// Core AI Types
export interface AIMessage {
  id: string
  role: 'system' | 'user' | 'assistant' | 'function'
  content: string
  name?: string // for function calls
  function_call?: FunctionCall
  timestamp: Date
}

export interface FunctionCall {
  name: string
  arguments: string // JSON string
}

export interface ConversationContext {
  sessionId: string
  userId: string
  tenantId: string
  phoneNumber: string
  conversationHistory: AIMessage[]
  userProfile?: UserProfile
  tenantConfig?: TenantConfig
  currentIntent?: Intent
  lastInteraction: Date
}

export interface UserProfile {
  id: string
  name?: string
  preferredName?: string
  language: string
  timezone: string
  previousAppointments: AppointmentSummary[]
  preferences: Record<string, any>
  customerNotes?: string
}

export interface TenantConfig {
  id: string
  slug: string
  businessName: string
  domain: BusinessDomain
  aiSettings: AISettings
  services: ServiceSummary[]
  businessHours: BusinessHours
  customFields: Record<string, any>
  whatsapp?: {
    phoneNumberId: string
    accessToken: string
    webhookToken: string
  }
}

export interface AISettings {
  greetingMessage: string
  domainKeywords: string[]
  escalationTriggers: string[]
  sensitiveTopics: string[]
  personality: {
    tone: 'professional' | 'friendly' | 'casual' | 'formal'
    energy: 'low' | 'medium' | 'high'
    empathy: 'low' | 'medium' | 'high'
  }
  upsellEnabled: boolean
  maxResponseLength: number
  responseStyle: 'concise' | 'detailed' | 'conversational'
  contextWindows?: number
  maxConversationLength?: number
}

export interface BusinessHours {
  timezone: string
  schedule: DaySchedule[]
  holidays: string[] // ISO dates
  bufferTime: number // minutes between appointments
}

export interface DaySchedule {
  dayOfWeek: number // 0 = Sunday, 1 = Monday, etc.
  isOpen: boolean
  openTime?: string // HH:mm format
  closeTime?: string // HH:mm format
  breaks?: TimeSlot[]
}

export interface TimeSlot {
  startTime: string
  endTime: string
}

export interface ServiceSummary {
  id: string
  name: string
  description: string
  duration: number // minutes
  price: number
  category: string
  available: boolean
}

export interface AppointmentSummary {
  id: string
  serviceId: string
  serviceName: string
  date: string
  time: string
  status: string
  price: number
  notes?: string
}

// Intent Recognition
export interface Intent {
  type: IntentType
  confidence: number
  entities: Entity[]
  context: Record<string, any>
}

export type IntentType = 
  | 'booking_request'
  | 'booking_cancel'
  | 'booking_reschedule'
  | 'booking_inquiry'
  | 'service_inquiry'
  | 'availability_check'
  | 'price_inquiry'
  | 'business_hours'
  | 'location_inquiry'
  | 'general_greeting'
  | 'complaint'
  | 'compliment'
  | 'escalation_request'
  | 'emergency'
  | 'other'

export interface Entity {
  type: EntityType
  value: string
  confidence: number
  start?: number
  end?: number
}

export type EntityType =
  | 'service_name'
  | 'date'
  | 'time'
  | 'duration'
  | 'person_name'
  | 'phone_number'
  | 'email'
  | 'location'
  | 'price'
  | 'appointment_id'
  | 'urgency_level'

// AI Agent System
export interface AIAgent {
  id: string
  name: string
  domain: BusinessDomain
  systemPrompt: string
  functions: AIFunction[]
  capabilities: string[]
  maxTokens: number
  temperature: number
  model: string
}

export interface AIFunction {
  name: string
  description: string
  parameters: FunctionParameter[]
  handler: (args: any, context: ConversationContext) => Promise<FunctionResult>
}

export interface FunctionParameter {
  name: string
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  description: string
  required: boolean
  enum?: string[]
}

export interface FunctionResult {
  success: boolean
  data?: any
  message: string
  shouldContinue: boolean
}

// Response Types
export interface AIResponse {
  message: string
  intent?: Intent
  functionCalls?: FunctionCall[]
  confidence: number
  shouldEscalate: boolean
  suggestedActions?: string[]
  context: Record<string, any>
}

export interface ProcessingResult {
  response: AIResponse
  updatedContext: ConversationContext
  actions: Action[]
}

export interface Action {
  type: ActionType
  payload: Record<string, any>
  priority: 'low' | 'medium' | 'high'
  executeAt?: Date
}

export type ActionType =
  | 'send_message'
  | 'create_appointment'
  | 'cancel_appointment'
  | 'update_appointment'
  | 'send_confirmation'
  | 'escalate_to_human'
  | 'update_user_profile'
  | 'log_interaction'
  | 'send_reminder'

// Domain-Specific Types
export interface LegalContext {
  caseType?: string
  urgency?: 'low' | 'medium' | 'high' | 'emergency'
  documentsNeeded?: string[]
  consultationType?: 'initial' | 'follow_up' | 'document_review'
  estimatedDuration?: number
}

export interface HealthcareContext {
  sessionType?: string
  isEmergency?: boolean
  symptoms?: string[]
  lastSession?: Date
  treatmentPlan?: string
  crisisKeywords?: string[]
}

export interface BeautyContext {
  serviceCategory?: 'hair' | 'nails' | 'facial' | 'massage' | 'package'
  skinType?: string
  allergies?: string[]
  preferredProfessional?: string
  isFirstTime?: boolean
}

export interface EducationContext {
  subject?: string
  level?: string
  sessionType?: 'individual' | 'group' | 'online' | 'in_person'
  studentAge?: number
  learningGoals?: string[]
}

export interface SportsContext {
  activity?: string
  skillLevel?: 'beginner' | 'intermediate' | 'advanced'
  fitnessGoals?: string[]
  medicalRestrictions?: string[]
  equipmentNeeded?: string[]
}

export interface ConsultingContext {
  consultingType?: string
  businessStage?: string
  industry?: string
  urgency?: string
  budgetRange?: string
}

// Memory Management
export interface MemoryStorage {
  shortTerm: Map<string, any> // session-based
  longTerm: Map<string, any> // persistent across sessions
  context: ConversationContext
}

export interface MemoryManager {
  sessionId: string
  context: ConversationContext
  shortTermMemory: Array<{ key: string, value: any, timestamp: Date }>
  longTermMemory: Array<{ key: string, value: any, timestamp: Date }>
  lastAccessed: Date
  store(key: string, value: any, type: 'short' | 'long'): Promise<void>
  retrieve(key: string, type: 'short' | 'long'): Promise<any>
  clear(type: 'short' | 'long' | 'all'): Promise<void>
  getContext(): ConversationContext
  updateContext(updates: Partial<ConversationContext>): Promise<void>
}

// Multi-modal Processing
export interface MediaContent {
  type: 'image' | 'audio' | 'video' | 'document'
  content: Buffer | string
  mimeType: string
  filename?: string
  transcription?: string // for audio/video
  analysis?: string // for images
}

export interface MultiModalContent {
  id: string
  type: 'image' | 'audio' | 'video' | 'document' | 'text'
  content: Buffer
  mimeType: string
  filename?: string
  metadata?: {
    size: number
    duration?: number
    dimensions?: { width: number; height: number }
  }
  timestamp: Date
}

export interface ExtractedEntity extends Entity {
  source: string
}

export interface MediaProcessor {
  processImage(content: Buffer, mimeType: string): Promise<string>
  processAudio(content: Buffer, mimeType: string): Promise<string>
  extractText(content: Buffer, mimeType: string): Promise<string>
}

// Error Types
export class AIError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: Record<string, any>
  ) {
    super(message)
    this.name = 'AIError'
  }
}

export class FunctionCallError extends AIError {
  constructor(functionName: string, error: string, args?: Record<string, any>) {
    super(`Function ${functionName} failed: ${error}`, 'FUNCTION_CALL_ERROR', { functionName, args })
  }
}

export class ContextError extends AIError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'CONTEXT_ERROR', context)
  }
}

// Configuration
export interface AIConfig {
  openaiApiKey: string
  model: string
  temperature: number
  maxTokens: number
  timeout: number
  retryAttempts: number
  memoryTtl: number // seconds
  enableFunctionCalling: boolean
  enableMultiModal: boolean
  logLevel: 'debug' | 'info' | 'warn' | 'error'
}