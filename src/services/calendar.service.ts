import { google } from 'googleapis'
import { supabase } from '../config/database'
import { Appointment } from '../types/database.types'

export class CalendarService {
  private calendar: any
  private auth: any

  constructor() {
    this.initializeGoogleAuth()
  }

  /**
   * Initialize Google Calendar API authentication
   */
  private async initializeGoogleAuth() {
    try {
      this.auth = new google.auth.OAuth2(
        process.env.GOOGLE_CALENDAR_CLIENT_ID,
        process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
        process.env.GOOGLE_CALENDAR_REDIRECT_URI
      )

      // Set credentials if available
      if (process.env.GOOGLE_CALENDAR_REFRESH_TOKEN) {
        this.auth.setCredentials({
          refresh_token: process.env.GOOGLE_CALENDAR_REFRESH_TOKEN,
          access_token: process.env.GOOGLE_CALENDAR_ACCESS_TOKEN
        })
      }

      this.calendar = google.calendar({ version: 'v3', auth: this.auth })
    } catch (error) {
      console.error('Failed to initialize Google Calendar:', error)
    }
  }

  /**
   * Create calendar event for appointment
   */
  async createCalendarEvent(appointment: Appointment): Promise<CalendarEventResult> {
    try {
      // Get tenant and service information
      const { data: tenant } = await supabase
        .from('tenants')
        .select('business_name, business_address')
        .eq('id', appointment.tenant_id)
        .single()

      const { data: service } = await supabase
        .from('services')
        .select('name, description')
        .eq('id', appointment.service_id)
        .single()

      const { data: user } = await supabase
        .from('users')
        .select('name, email, phone')
        .eq('id', appointment.user_id)
        .single()

      if (!tenant || !service) {
        throw new Error('Missing tenant or service information')
      }

      // Create event object
      const event = {
        summary: `${service.name} - ${tenant.business_name}`,
        description: this.buildEventDescription(appointment, service, user, tenant),
        start: {
          dateTime: appointment.start_time,
          timeZone: appointment.timezone || 'America/Sao_Paulo'
        },
        end: {
          dateTime: appointment.end_time,
          timeZone: appointment.timezone || 'America/Sao_Paulo'
        },
        location: this.formatLocation(tenant.business_address),
        attendees: this.buildAttendees(user, tenant),
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 }, // 1 day before
            { method: 'popup', minutes: 60 },      // 1 hour before
            { method: 'popup', minutes: 15 }       // 15 minutes before
          ]
        },
        status: 'confirmed',
        transparency: 'opaque',
        colorId: this.getColorForDomain(tenant.domain),
        extendedProperties: {
          private: {
            appointmentId: appointment.id,
            tenantId: appointment.tenant_id,
            serviceId: appointment.service_id,
            userId: appointment.user_id,
            source: 'whatsapp-booking-system'
          }
        }
      }

      // Create the event
      const response = await this.calendar.events.insert({
        calendarId: await this.getCalendarId(appointment.tenant_id),
        resource: event,
        sendUpdates: 'all'
      })

      // Update appointment with calendar event ID
      await supabase
        .from('appointments')
        .update({ external_event_id: response.data.id })
        .eq('id', appointment.id)

      return {
        success: true,
        eventId: response.data.id,
        eventUrl: response.data.htmlLink,
        message: 'Calendar event created successfully'
      }

    } catch (error) {
      console.error('Failed to create calendar event:', error)
      return {
        success: false,
        message: `Failed to create calendar event: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  /**
   * Update existing calendar event
   */
  async updateCalendarEvent(appointment: Appointment): Promise<CalendarEventResult> {
    try {
      if (!appointment.external_event_id) {
        // If no event exists, create one
        return await this.createCalendarEvent(appointment)
      }

      // Get updated information
      const { data: tenant } = await supabase
        .from('tenants')
        .select('business_name, business_address')
        .eq('id', appointment.tenant_id)
        .single()

      const { data: service } = await supabase
        .from('services')
        .select('name, description')
        .eq('id', appointment.service_id)
        .single()

      const { data: user } = await supabase
        .from('users')
        .select('name, email, phone')
        .eq('id', appointment.user_id)
        .single()

      const event = {
        summary: `${service?.name} - ${tenant?.business_name}`,
        description: this.buildEventDescription(appointment, service, user, tenant),
        start: {
          dateTime: appointment.start_time,
          timeZone: appointment.timezone || 'America/Sao_Paulo'
        },
        end: {
          dateTime: appointment.end_time,
          timeZone: appointment.timezone || 'America/Sao_Paulo'
        },
        location: this.formatLocation(tenant?.business_address),
        status: this.mapAppointmentStatus(appointment.status)
      }

      const response = await this.calendar.events.update({
        calendarId: await this.getCalendarId(appointment.tenant_id),
        eventId: appointment.external_event_id,
        resource: event,
        sendUpdates: 'all'
      })

      return {
        success: true,
        eventId: response.data.id,
        eventUrl: response.data.htmlLink,
        message: 'Calendar event updated successfully'
      }

    } catch (error) {
      console.error('Failed to update calendar event:', error)
      return {
        success: false,
        message: `Failed to update calendar event: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  /**
   * Cancel/delete calendar event
   */
  async cancelCalendarEvent(appointment: Appointment): Promise<CalendarEventResult> {
    try {
      if (!appointment.external_event_id) {
        return {
          success: true,
          message: 'No calendar event to cancel'
        }
      }

      await this.calendar.events.delete({
        calendarId: await this.getCalendarId(appointment.tenant_id),
        eventId: appointment.external_event_id,
        sendUpdates: 'all'
      })

      return {
        success: true,
        message: 'Calendar event cancelled successfully'
      }

    } catch (error) {
      console.error('Failed to cancel calendar event:', error)
      return {
        success: false,
        message: `Failed to cancel calendar event: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  /**
   * Check for calendar conflicts
   */
  async checkCalendarConflicts(
    tenantId: string,
    startTime: string,
    endTime: string,
    excludeEventId?: string
  ): Promise<CalendarConflictResult> {
    try {
      const calendarId = await this.getCalendarId(tenantId)
      
      const response = await this.calendar.events.list({
        calendarId,
        timeMin: startTime,
        timeMax: endTime,
        singleEvents: true,
        orderBy: 'startTime'
      })

      const conflicts = response.data.items?.filter((event: any) => 
        event.id !== excludeEventId && 
        event.status !== 'cancelled' &&
        this.hasTimeOverlap(startTime, endTime, event.start?.dateTime, event.end?.dateTime)
      ) || []

      return {
        hasConflicts: conflicts.length > 0,
        conflicts: conflicts.map((event: any) => ({
          id: event.id,
          summary: event.summary,
          start: event.start?.dateTime,
          end: event.end?.dateTime
        })),
        message: conflicts.length > 0 
          ? `Found ${conflicts.length} conflicting event(s)`
          : 'No conflicts found'
      }

    } catch (error) {
      console.error('Failed to check calendar conflicts:', error)
      return {
        hasConflicts: false,
        conflicts: [],
        message: 'Failed to check conflicts'
      }
    }
  }

  /**
   * Get available time slots from calendar
   */
  async getAvailableSlots(
    tenantId: string,
    date: string,
    duration: number,
    businessHours: { start: string; end: string }
  ): Promise<AvailableSlot[]> {
    try {
      const calendarId = await this.getCalendarId(tenantId)
      const startOfDay = `${date}T${businessHours.start}:00`
      const endOfDay = `${date}T${businessHours.end}:00`

      // Get busy times from calendar
      const response = await this.calendar.freebusy.query({
        resource: {
          timeMin: startOfDay,
          timeMax: endOfDay,
          items: [{ id: calendarId }]
        }
      })

      const busyTimes = response.data.calendars[calendarId]?.busy || []
      
      // Generate available slots
      const slots = this.generateAvailableSlots(
        startOfDay,
        endOfDay,
        duration,
        busyTimes
      )

      return slots

    } catch (error) {
      console.error('Failed to get available slots:', error)
      return []
    }
  }

  /**
   * Sync appointments with calendar (bi-directional)
   */
  async syncWithCalendar(tenantId: string): Promise<SyncResult> {
    try {
      const calendarId = await this.getCalendarId(tenantId)
      const syncToken = await this.getSyncToken(tenantId)

      // Get changes from calendar
      const response = await this.calendar.events.list({
        calendarId,
        syncToken,
        singleEvents: true
      })

      const changes = response.data.items || []
      let created = 0, updated = 0, deleted = 0

      for (const event of changes) {
        const appointmentId = event.extendedProperties?.private?.appointmentId

        if (appointmentId) {
          if (event.status === 'cancelled') {
            // Cancel appointment in our system
            await supabase
              .from('appointments')
              .update({ 
                status: 'cancelled',
                cancelled_at: new Date().toISOString(),
                cancellation_reason: 'Cancelled via calendar'
              })
              .eq('id', appointmentId)
            deleted++
          } else {
            // Update appointment in our system
            await supabase
              .from('appointments')
              .update({
                start_time: event.start?.dateTime,
                end_time: event.end?.dateTime
              })
              .eq('id', appointmentId)
            updated++
          }
        }
      }

      // Save new sync token
      await this.saveSyncToken(tenantId, response.data.nextSyncToken)

      return {
        success: true,
        created,
        updated,
        deleted,
        message: `Sync completed: ${created} created, ${updated} updated, ${deleted} deleted`
      }

    } catch (error) {
      console.error('Failed to sync with calendar:', error)
      return {
        success: false,
        created: 0,
        updated: 0,
        deleted: 0,
        message: `Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  // Helper methods
  private buildEventDescription(appointment: any, service: any, user: any, tenant: any): string {
    const lines = [
      `📅 Agendamento: ${service?.name}`,
      `👤 Cliente: ${user?.name || 'N/A'}`,
      `📞 Telefone: ${user?.phone || 'N/A'}`,
      `📧 Email: ${user?.email || 'N/A'}`,
      `🏢 Empresa: ${tenant?.business_name}`,
      '',
      `💰 Valor: R$ ${appointment.quoted_price || 'A definir'}`,
      `🆔 ID: ${appointment.id}`,
      '',
      `📝 Observações: ${appointment.customer_notes || 'Nenhuma'}`,
      '',
      `🤖 Agendado via WhatsApp AI Bot`
    ]
    
    return lines.join('\n')
  }

  private formatLocation(address: any): string {
    if (!address) return ''
    
    if (typeof address === 'string') return address
    
    const parts = [
      address.street,
      address.number,
      address.complement,
      address.neighborhood,
      address.city,
      address.state,
      address.zipCode
    ].filter(Boolean)
    
    return parts.join(', ')
  }

  private buildAttendees(user: any, tenant: any): any[] {
    const attendees = []
    
    if (user?.email) {
      attendees.push({
        email: user.email,
        displayName: user.name,
        responseStatus: 'needsAction'
      })
    }
    
    if (tenant?.email) {
      attendees.push({
        email: tenant.email,
        displayName: tenant.business_name,
        responseStatus: 'accepted',
        organizer: true
      })
    }
    
    return attendees
  }

  private getColorForDomain(domain: string): string {
    const colors: Record<string, string> = {
      'healthcare': '2', // Green
      'beauty': '9',     // Blue
      'legal': '11',     // Red
      'education': '5',  // Yellow
      'sports': '10',    // Green
      'consulting': '3', // Purple
      'other': '8'       // Gray
    }
    
    return colors[domain] || colors.other
  }

  private mapAppointmentStatus(status: string): string {
    const statusMap: Record<string, string> = {
      'confirmed': 'confirmed',
      'pending': 'tentative',
      'cancelled': 'cancelled',
      'completed': 'confirmed',
      'no_show': 'cancelled',
      'rescheduled': 'confirmed'
    }
    
    return statusMap[status] || 'tentative'
  }

  private async getCalendarId(tenantId: string): Promise<string> {
    // For now, use primary calendar
    // In production, you might want tenant-specific calendars
    return 'primary'
  }

  private hasTimeOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
    if (!start2 || !end2) return false
    
    const s1 = new Date(start1).getTime()
    const e1 = new Date(end1).getTime()
    const s2 = new Date(start2).getTime()
    const e2 = new Date(end2).getTime()
    
    return s1 < e2 && e1 > s2
  }

  private generateAvailableSlots(
    startTime: string,
    endTime: string,
    duration: number,
    busyTimes: any[]
  ): AvailableSlot[] {
    const slots: AvailableSlot[] = []
    const start = new Date(startTime).getTime()
    const end = new Date(endTime).getTime()
    const durationMs = duration * 60 * 1000

    let currentTime = start
    
    while (currentTime + durationMs <= end) {
      const slotEnd = currentTime + durationMs
      const slotStart = new Date(currentTime).toISOString()
      const slotEndStr = new Date(slotEnd).toISOString()
      
      // Check if this slot conflicts with any busy time
      const hasConflict = busyTimes.some(busy => 
        this.hasTimeOverlap(slotStart, slotEndStr, busy.start, busy.end)
      )
      
      if (!hasConflict) {
        slots.push({
          start: slotStart,
          end: slotEndStr,
          available: true
        })
      }
      
      currentTime += 30 * 60 * 1000 // 30-minute intervals
    }
    
    return slots
  }

  private async getSyncToken(tenantId: string): Promise<string | undefined> {
    // Implementation to get stored sync token
    // This would typically be stored in database
    return undefined
  }

  private async saveSyncToken(tenantId: string, token: string): Promise<void> {
    // Implementation to save sync token
    // This would typically be stored in database
  }
}

// Types for calendar service
export interface CalendarEventResult {
  success: boolean
  eventId?: string
  eventUrl?: string
  message: string
}

export interface CalendarConflictResult {
  hasConflicts: boolean
  conflicts: Array<{
    id: string
    summary: string
    start: string
    end: string
  }>
  message: string
}

export interface AvailableSlot {
  start: string
  end: string
  available: boolean
}

export interface SyncResult {
  success: boolean
  created: number
  updated: number
  deleted: number
  message: string
}

export default CalendarService