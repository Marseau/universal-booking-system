import { AppointmentStatus } from '../types/database.types'

// Helper para garantir que duration_minutes não seja null
export function validateServiceDuration(durationMinutes: number | null | undefined): number {
  if (!durationMinutes || durationMinutes <= 0) {
    return 60 // padrão de 60 minutos
  }
  return durationMinutes
}

// Helper para garantir que base_price não seja null
export function validateServicePrice(basePrice: number | null | undefined): number {
  if (!basePrice || basePrice <= 0) {
    return 100 // preço padrão
  }
  return basePrice
}

// Helper para validar status de agendamento
export function validateAppointmentStatus(status: string): AppointmentStatus {
  const validStatuses: AppointmentStatus[] = [
    "pending", "confirmed", "in_progress", "completed", 
    "cancelled", "no_show", "rescheduled"
  ]
  
  if (validStatuses.includes(status as AppointmentStatus)) {
    return status as AppointmentStatus
  }
  
  return "pending" // status padrão
}

// Helper para validar propriedades de configuração de serviço
export function getServiceConfigProperty(serviceConfig: any, property: string): any {
  if (!serviceConfig || typeof serviceConfig !== 'object') {
    return undefined
  }
  return serviceConfig[property]
}

// Helper para garantir que strings não sejam undefined
export function validateString(value: string | undefined, defaultValue: string = ''): string {
  return value || defaultValue
}

// Helper para garantir que arrays não sejam undefined
export function validateArray<T>(value: T[] | undefined, defaultValue: T[] = []): T[] {
  return value || defaultValue
}

// Helper para garantir que dates sejam válidas
export function validateDate(dateString: string | undefined): Date {
  if (!dateString) {
    return new Date()
  }
  
  const date = new Date(dateString)
  if (isNaN(date.getTime())) {
    return new Date()
  }
  
  return date
}

// Helper para calcular end_time de forma segura
export function calculateEndTime(startTime: string, durationMinutes: number | null | undefined): string {
  const validDuration = validateServiceDuration(durationMinutes)
  const start = new Date(startTime)
  const end = new Date(start.getTime() + (validDuration * 60000))
  return end.toISOString()
} 