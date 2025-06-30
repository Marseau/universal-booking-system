import { supabase } from '../config/database'
import { BusinessDomain } from '../types/database.types'

export class AnalyticsService {
  constructor() {}

  /**
   * Get comprehensive analytics for a tenant
   */
  async getTenantAnalytics(tenantId: string, period: string = '30d'): Promise<TenantAnalytics> {
    try {
      const dateRange = this.getDateRange(period)
      
      const [
        appointmentStats,
        revenueStats,
        customerStats,
        serviceStats,
        aiStats,
        conversionStats
      ] = await Promise.all([
        this.getAppointmentStats(tenantId, dateRange),
        this.getRevenueStats(tenantId, dateRange),
        this.getCustomerStats(tenantId, dateRange),
        this.getServiceStats(tenantId, dateRange),
        this.getAIStats(tenantId, dateRange),
        this.getConversionStats(tenantId, dateRange)
      ])

      return {
        period,
        dateRange,
        appointments: appointmentStats,
        revenue: revenueStats,
        customers: customerStats,
        services: serviceStats,
        ai: aiStats,
        conversion: conversionStats,
        summary: this.generateSummary(appointmentStats, revenueStats, customerStats)
      }

    } catch (error) {
      console.error('Failed to get tenant analytics:', error)
      throw error
    }
  }

  /**
   * Get appointment statistics
   */
  private async getAppointmentStats(tenantId: string, dateRange: DateRange): Promise<AppointmentStats> {
    const { data: appointments } = await supabase
      .from('appointments')
      .select('id, status, start_time, quoted_price, created_at')
      .eq('tenant_id', tenantId)
      .gte('created_at', dateRange.start)
      .lte('created_at', dateRange.end)

    const total = appointments?.length || 0
    const confirmed = appointments?.filter(a => a.status === 'confirmed').length || 0
    const completed = appointments?.filter(a => a.status === 'completed').length || 0
    const cancelled = appointments?.filter(a => a.status === 'cancelled').length || 0
    const noShow = appointments?.filter(a => a.status === 'no_show').length || 0

    // Daily breakdown
    const dailyStats = this.groupByDay(appointments || [], dateRange, 'created_at')
    
    // Status distribution
    const statusDistribution = {
      confirmed,
      completed,
      cancelled,
      no_show: noShow,
      pending: total - confirmed - completed - cancelled - noShow
    }

    // Growth calculation (compared to previous period)
    const previousPeriod = this.getPreviousDateRange(dateRange)
    const { data: previousAppointments } = await supabase
      .from('appointments')
      .select('id')
      .eq('tenant_id', tenantId)
      .gte('created_at', previousPeriod.start)
      .lte('created_at', previousPeriod.end)

    const growthRate = this.calculateGrowthRate(total, previousAppointments?.length || 0)

    return {
      total,
      confirmed,
      completed,
      cancelled,
      noShow,
      completionRate: total > 0 ? (completed / total) * 100 : 0,
      cancellationRate: total > 0 ? (cancelled / total) * 100 : 0,
      noShowRate: total > 0 ? (noShow / total) * 100 : 0,
      growthRate,
      dailyStats,
      statusDistribution
    }
  }

  /**
   * Get revenue statistics
   */
  private async getRevenueStats(tenantId: string, dateRange: DateRange): Promise<RevenueStats> {
    const { data: appointments } = await supabase
      .from('appointments')
      .select('quoted_price, final_price, status, start_time, created_at')
      .eq('tenant_id', tenantId)
      .gte('created_at', dateRange.start)
      .lte('created_at', dateRange.end)

    const completedAppointments = appointments?.filter(a => a.status === 'completed') || []
    
    const totalRevenue = completedAppointments.reduce((sum, a) => sum + (a.final_price || a.quoted_price || 0), 0)
    const potentialRevenue = appointments?.reduce((sum, a) => sum + (a.quoted_price || 0), 0) || 0
    const averageTicket = completedAppointments.length > 0 ? totalRevenue / completedAppointments.length : 0

    // Daily revenue breakdown
    const dailyRevenue = this.groupRevenueByDay(completedAppointments, dateRange)

    // Growth calculation
    const previousPeriod = this.getPreviousDateRange(dateRange)
    const { data: previousAppointments } = await supabase
      .from('appointments')
      .select('quoted_price, final_price, status')
      .eq('tenant_id', tenantId)
      .eq('status', 'completed')
      .gte('created_at', previousPeriod.start)
      .lte('created_at', previousPeriod.end)

    const previousRevenue = previousAppointments?.reduce((sum, a) => sum + (a.final_price || a.quoted_price || 0), 0) || 0
    const revenueGrowth = this.calculateGrowthRate(totalRevenue, previousRevenue)

    return {
      total: totalRevenue,
      totalRevenue,
      potentialRevenue,
      averageTicket,
      revenueGrowth,
      growthRate: revenueGrowth,
      dailyRevenue,
      dailyStats: dailyRevenue,
      lostRevenue: potentialRevenue - totalRevenue
    }
  }

  /**
   * Get customer statistics
   */
  private async getCustomerStats(tenantId: string, dateRange: DateRange): Promise<CustomerStats> {
    // New customers in period
    const { data: newCustomers } = await supabase
      .from('user_tenants')
      .select('user_id, first_interaction')
      .eq('tenant_id', tenantId)
      .gte('first_interaction', dateRange.start)
      .lte('first_interaction', dateRange.end)

    // Returning customers
    const { data: returningCustomers } = await supabase
      .from('user_tenants')
      .select('user_id, total_bookings')
      .eq('tenant_id', tenantId)
      .gt('total_bookings', 1)

    // Customer retention (customers who had appointments in both periods)
    const previousPeriod = this.getPreviousDateRange(dateRange)
    const { data: currentPeriodCustomers } = await supabase
      .from('appointments')
      .select('user_id')
      .eq('tenant_id', tenantId)
      .gte('created_at', dateRange.start)
      .lte('created_at', dateRange.end)

    const { data: previousPeriodCustomers } = await supabase
      .from('appointments')
      .select('user_id')
      .eq('tenant_id', tenantId)
      .gte('created_at', previousPeriod.start)
      .lte('created_at', previousPeriod.end)

    const currentCustomerIds = new Set(currentPeriodCustomers?.map(a => a.user_id) || [])
    const previousCustomerIds = new Set(previousPeriodCustomers?.map(a => a.user_id) || [])
    
    const retainedCustomers = [...previousCustomerIds].filter(id => currentCustomerIds.has(id)).length
    const retentionRate = previousCustomerIds.size > 0 ? (retainedCustomers / previousCustomerIds.size) * 100 : 0

    const customerGrowth = this.calculateGrowthRate(newCustomers?.length || 0, 0)
    
    return {
      new: newCustomers?.length || 0,
      newCustomers: newCustomers?.length || 0,
      returningCustomers: returningCustomers?.length || 0,
      total: currentCustomerIds.size,
      totalUniqueCustomers: currentCustomerIds.size,
      active: currentCustomerIds.size,
      retentionRate,
      customerGrowth,
      growthRate: customerGrowth,
      dailyStats: [] // Would need actual daily customer stats
    }
  }

  /**
   * Get service performance statistics
   */
  private async getServiceStats(tenantId: string, dateRange: DateRange): Promise<ServiceStats> {
    const { data: appointments } = await supabase
      .from('appointments')
      .select(`
        service_id,
        status,
        quoted_price,
        final_price,
        services!inner (name, base_price)
      `)
      .eq('tenant_id', tenantId)
      .gte('created_at', dateRange.start)
      .lte('created_at', dateRange.end)

    const servicePerformance: Record<string, any> = {}

    appointments?.forEach(apt => {
      const serviceId = apt.service_id
      const serviceName = (apt as any).services?.name || 'Unknown Service'
      
      if (serviceId && !servicePerformance[serviceId]) {
        servicePerformance[serviceId] = {
          id: serviceId,
          name: serviceName,
          totalBookings: 0,
          completedBookings: 0,
          revenue: 0,
          averagePrice: 0
        }
      }

      if (serviceId) servicePerformance[serviceId].totalBookings++
      
      if (apt.status === 'completed') {
        if (serviceId) servicePerformance[serviceId].completedBookings++
        if (serviceId) servicePerformance[serviceId].revenue += ((apt as any).final_price || (apt as any).quoted_price || 0)
      }
    })

    // Calculate averages and sort by popularity
    const topServices = Object.values(servicePerformance)
      .map((service: any) => ({
        ...service,
        averagePrice: service.completedBookings > 0 ? service.revenue / service.completedBookings : 0,
        completionRate: service.totalBookings > 0 ? (service.completedBookings / service.totalBookings) * 100 : 0
      }))
      .sort((a: any, b: any) => b.totalBookings - a.totalBookings)

    const popularServices = topServices.slice(0, 10).map((service: any) => ({
      ...service,
      averageTicket: service.averagePrice,
      appointments: service.totalBookings
    }))

    return {
      popular: popularServices,
      topServices: topServices.slice(0, 10),
      totalServices: topServices.length,
      mostPopular: topServices[0] || null,
      mostProfitable: topServices.sort((a: any, b: any) => b.revenue - a.revenue)[0] || null
    }
  }

  /**
   * Get AI performance statistics
   */
  private async getAIStats(tenantId: string, dateRange: DateRange): Promise<AIStats> {
    const { data: conversations } = await supabase
      .from('conversation_history')
      .select('intent_detected, confidence_score, is_from_user, created_at')
      .eq('tenant_id', tenantId)
      .gte('created_at', dateRange.start)
      .lte('created_at', dateRange.end)

    const totalMessages = conversations?.length || 0
    const userMessages = conversations?.filter(c => c.is_from_user).length || 0
    const aiResponses = totalMessages - userMessages

    // Intent accuracy
    const messagesWithIntent = conversations?.filter(c => c.intent_detected) || []
    const highConfidenceIntents = messagesWithIntent.filter(c => (c.confidence_score || 0) > 0.8).length
    const intentAccuracy = messagesWithIntent.length > 0 ? (highConfidenceIntents / messagesWithIntent.length) * 100 : 0

    // Intent distribution
    const intentDistribution: Record<string, number> = {}
    messagesWithIntent.forEach(msg => {
      const intent = msg.intent_detected
      if (intent) {
        intentDistribution[intent] = (intentDistribution[intent] || 0) + 1
      }
    })

    // Bookings from AI conversations
    const { data: aiBookings } = await supabase
      .from('appointments')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('appointment_data->>booked_via', 'whatsapp_ai')
      .gte('created_at', dateRange.start)
      .lte('created_at', dateRange.end)

    const aiConversionRate = userMessages > 0 ? ((aiBookings?.length || 0) / userMessages) * 100 : 0

    const averageConfidence = messagesWithIntent.length > 0 
      ? messagesWithIntent.reduce((sum, m) => sum + ((m.confidence_score as number) || 0), 0) / messagesWithIntent.length 
      : 0

    return {
      totalMessages,
      userMessages,
      aiResponses,
      intentAccuracy,
      accuracy: intentAccuracy / 100,
      coverage: 0.85, // Mock coverage
      responseTime: 1.2, // Mock response time
      conversionRate: aiConversionRate / 100,
      satisfaction: 0.9, // Mock satisfaction
      totalInteractions: totalMessages,
      intentDistribution,
      aiBookings: aiBookings?.length || 0,
      aiConversionRate,
      averageConfidence
    }
  }

  /**
   * Get conversion funnel statistics
   */
  private async getConversionStats(tenantId: string, dateRange: DateRange): Promise<ConversionStats> {
    const { data: conversations } = await supabase
      .from('conversation_history')
      .select('user_id, intent_detected, created_at')
      .eq('tenant_id', tenantId)
      .gte('created_at', dateRange.start)
      .lte('created_at', dateRange.end)

    const { data: appointments } = await supabase
      .from('appointments')
      .select('user_id, status, created_at')
      .eq('tenant_id', tenantId)
      .gte('created_at', dateRange.start)
      .lte('created_at', dateRange.end)

    const uniqueVisitors = new Set(conversations?.map(c => c.user_id) || []).size
    const inquiries = conversations?.filter(c => c.intent_detected === 'service_inquiry').length || 0
    const bookingRequests = conversations?.filter(c => c.intent_detected === 'booking_request').length || 0
    const actualBookings = appointments?.length || 0
    const completedBookings = appointments?.filter(a => a.status === 'completed').length || 0

    const inquiryToBookingRate = uniqueVisitors > 0 ? (bookingRequests / uniqueVisitors) * 100 : 0
    const bookingToCompletionRate = actualBookings > 0 ? (completedBookings / actualBookings) * 100 : 0
    const overallConversionRate = uniqueVisitors > 0 ? (completedBookings / uniqueVisitors) * 100 : 0

    return {
      rate: overallConversionRate,
      uniqueVisitors,
      inquiries,
      bookingRequests,
      actualBookings,
      completedBookings,
      inquiryToBookingRate,
      bookingToCompletionRate,
      overallConversionRate,
      growthRate: 0, // Mock growth rate
      funnel: {
        visitors: uniqueVisitors,
        interested: inquiries,
        appointments: actualBookings,
        completed: completedBookings
      }
    }
  }

  /**
   * Get business performance comparison by domain
   */
  async getDomainBenchmarks(domain?: BusinessDomain): Promise<Record<string, DomainBenchmarks>> {
    try {
      // Return mock benchmarks for all domains
      const domains = ['legal', 'healthcare', 'education', 'beauty', 'sports', 'consulting', 'general']
      const benchmarks: Record<string, DomainBenchmarks> = {}

      for (const domainKey of domains) {
        benchmarks[domainKey] = {
          domain: domainKey as BusinessDomain,
          participatingTenants: 50,
          benchmarks: {
            averageAppointmentsPerMonth: 120,
            averageCompletionRate: 85,
            averageRevenuePerMonth: 15000,
            averageTicketSize: 150,
            averageAIAccuracy: 88,
            averageConversionRate: 25,
            averageRevenuePerCustomer: 500
          }
        }
      }

      return benchmarks

    } catch (error) {
      console.error('Failed to get domain benchmarks:', error)
      throw error
    }
  }

  /**
   * Get real-time dashboard data
   */
  async getRealTimeDashboard(tenantId: string): Promise<RealTimeDashboard> {
    try {
      const today = new Date().toISOString().split('T')[0]
      
      // Today's appointments
      const { data: todayAppointments } = await supabase
        .from('appointments')
        .select(`
          id, status, start_time, end_time,
          services!inner (name),
          users!inner (name, phone)
        `)
        .eq('tenant_id', tenantId)
        .gte('start_time', `${today}T00:00:00`)
        .lt('start_time', `${today}T23:59:59`)
        .order('start_time')

      // Recent conversations (last 24 hours)
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      
      const { data: recentConversations } = await supabase
        .from('conversation_history')
        .select('content, intent_detected, confidence_score, created_at, user_name')
        .eq('tenant_id', tenantId)
        .gte('created_at', yesterday.toISOString())
        .order('created_at', { ascending: false })
        .limit(20)

      // Active conversations (last 2 hours)
      const twoHoursAgo = new Date()
      twoHoursAgo.setHours(twoHoursAgo.getHours() - 2)
      
      const { data: activeConversations } = await supabase
        .from('conversation_states')
        .select('phone_number, current_step, last_message_at')
        .eq('tenant_id', tenantId)
        .gte('last_message_at', twoHoursAgo.toISOString())

      // Quick stats
      const completedToday = todayAppointments?.filter(a => a.status === 'completed').length || 0
      const upcomingToday = todayAppointments?.filter(a => a.status === 'confirmed' && new Date(a.start_time) > new Date()).length || 0
      const revenueToday = todayAppointments?.filter(a => a.status === 'completed')
        .reduce((sum, a) => sum + ((a as any).quoted_price || 0), 0) || 0

      return {
        todayStats: {
          totalAppointments: todayAppointments?.length || 0,
          completed: completedToday,
          upcoming: upcomingToday,
          revenue: revenueToday
        },
        todayAppointments: todayAppointments || [],
        recentConversations: recentConversations || [],
        activeConversations: activeConversations?.length || 0,
        lastUpdated: new Date().toISOString()
      }

    } catch (error) {
      console.error('Failed to get real-time dashboard:', error)
      throw error
    }
  }

  // Helper methods
  private getDateRange(period: string): DateRange {
    const end = new Date()
    const start = new Date()

    switch (period) {
      case '7d':
        start.setDate(start.getDate() - 7)
        break
      case '30d':
        start.setDate(start.getDate() - 30)
        break
      case '90d':
        start.setDate(start.getDate() - 90)
        break
      case '1y':
        start.setFullYear(start.getFullYear() - 1)
        break
      default:
        start.setDate(start.getDate() - 30)
    }

    return {
      start: start.toISOString(),
      end: end.toISOString()
    }
  }

  private getPreviousDateRange(dateRange: DateRange): DateRange {
    const start = new Date(dateRange.start)
    const end = new Date(dateRange.end)
    const duration = end.getTime() - start.getTime()

    return {
      start: new Date(start.getTime() - duration).toISOString(),
      end: new Date(start.getTime()).toISOString()
    }
  }

  private calculateGrowthRate(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0
    return ((current - previous) / previous) * 100
  }

  private groupByDay(items: any[], dateRange: DateRange, dateField: string): DailyStats[] {
    const dailyStats: DailyStats[] = []
    const start = new Date(dateRange.start)
    const end = new Date(dateRange.end)

    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      const dateStr = date.toISOString().split('T')[0]
      const dayItems = items.filter(item => {
        const itemDate = new Date(item[dateField]).toISOString().split('T')[0]
        return itemDate === dateStr
      })

      dailyStats.push({
        date: dateStr as string,
        count: dayItems.length
      })
    }

    return dailyStats
  }

  private groupRevenueByDay(appointments: any[], dateRange: DateRange): DailyRevenue[] {
    const dailyRevenue: DailyRevenue[] = []
    const start = new Date(dateRange.start)
    const end = new Date(dateRange.end)

    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      const dateStr = date.toISOString().split('T')[0]
      const dayAppointments = appointments.filter(apt => {
        const aptDate = new Date(apt.start_time).toISOString().split('T')[0]
        return aptDate === dateStr
      })

      const revenue = dayAppointments.reduce((sum, apt) => sum + (apt.final_price || apt.quoted_price || 0), 0)

      dailyRevenue.push({
        date: dateStr as string,
        revenue
      })
    }

    return dailyRevenue
  }

  private generateSummary(appointmentStats: AppointmentStats, revenueStats: RevenueStats, customerStats: CustomerStats): AnalyticsSummary {
    const insights: string[] = []

    if (appointmentStats.growthRate > 10) {
      insights.push(`📈 Crescimento de ${appointmentStats.growthRate.toFixed(1)}% nos agendamentos`)
    } else if (appointmentStats.growthRate < -10) {
      insights.push(`📉 Queda de ${Math.abs(appointmentStats.growthRate).toFixed(1)}% nos agendamentos`)
    }

    if (appointmentStats.completionRate > 80) {
      insights.push(`✅ Excelente taxa de conclusão (${appointmentStats.completionRate.toFixed(1)}%)`)
    }

    if (appointmentStats.cancellationRate > 20) {
      insights.push(`⚠️ Taxa de cancelamento alta (${appointmentStats.cancellationRate.toFixed(1)}%)`)
    }

    if (revenueStats.revenueGrowth > 15) {
      insights.push(`💰 Receita cresceu ${revenueStats.revenueGrowth.toFixed(1)}%`)
    }

    if (customerStats.retentionRate > 60) {
      insights.push(`🤝 Boa retenção de clientes (${customerStats.retentionRate.toFixed(1)}%)`)
    }

    return {
      totalAppointments: appointmentStats.total,
      totalRevenue: revenueStats.totalRevenue,
      newCustomers: customerStats.newCustomers,
      insights,
      healthScore: this.calculateHealthScore(appointmentStats, revenueStats, customerStats)
    }
  }

  private calculateHealthScore(appointmentStats: AppointmentStats, revenueStats: RevenueStats, customerStats: CustomerStats): number {
    let score = 0

    // Appointment performance (40% weight)
    score += Math.min(appointmentStats.completionRate / 100, 1) * 20
    score += Math.max(0, 1 - appointmentStats.cancellationRate / 100) * 20

    // Revenue performance (30% weight)
    score += Math.min(Math.max(revenueStats.revenueGrowth / 100, 0), 1) * 30

    // Customer retention (30% weight)
    score += Math.min(customerStats.retentionRate / 100, 1) * 30

    return Math.round(score)
  }
}

// Types for analytics service
interface DateRange {
  start: string
  end: string
}

interface DailyStats {
  date: string
  count: number
}

interface DailyRevenue {
  date: string
  revenue: number
}

export interface TenantAnalytics {
  period: string
  dateRange: DateRange
  appointments: AppointmentStats
  revenue: RevenueStats
  customers: CustomerStats
  services: ServiceStats
  ai: AIStats
  conversion: ConversionStats
  summary: AnalyticsSummary
}

export interface AppointmentStats {
  total: number
  confirmed: number
  completed: number
  cancelled: number
  noShow: number
  completionRate: number
  cancellationRate: number
  noShowRate: number
  growthRate: number
  dailyStats: DailyStats[]
  statusDistribution: Record<string, number>
}

export interface RevenueStats {
  total: number
  totalRevenue: number
  potentialRevenue: number
  averageTicket: number
  revenueGrowth: number
  growthRate: number
  dailyRevenue: DailyRevenue[]
  dailyStats: DailyRevenue[]
  lostRevenue: number
}

export interface CustomerStats {
  new: number
  newCustomers: number
  returningCustomers: number
  total: number
  totalUniqueCustomers: number
  active: number
  retentionRate: number
  customerGrowth: number
  growthRate: number
  dailyStats: DailyStats[]
}

export interface ServiceStats {
  popular: Array<{
    id: string
    name: string
    totalBookings: number
    completedBookings: number
    revenue: number
    averagePrice: number
    averageTicket: number
    completionRate: number
    appointments: number
  }>
  topServices: Array<{
    id: string
    name: string
    totalBookings: number
    completedBookings: number
    revenue: number
    averagePrice: number
    completionRate: number
  }>
  totalServices: number
  mostPopular: any
  mostProfitable: any
}

export interface AIStats {
  totalMessages: number
  userMessages: number
  aiResponses: number
  intentAccuracy: number
  accuracy: number
  coverage: number
  responseTime: number
  conversionRate: number
  satisfaction: number
  totalInteractions: number
  intentDistribution: Record<string, number>
  aiBookings: number
  aiConversionRate: number
  averageConfidence: number
}

export interface ConversionStats {
  rate: number
  uniqueVisitors: number
  inquiries: number
  bookingRequests: number
  actualBookings: number
  completedBookings: number
  inquiryToBookingRate: number
  bookingToCompletionRate: number
  overallConversionRate: number
  growthRate: number
  funnel: {
    visitors: number
    interested: number
    appointments: number
    completed: number
  }
}

export interface DomainBenchmarks {
  domain: BusinessDomain | string
  participatingTenants: number
  benchmarks: {
    averageAppointmentsPerMonth: number
    averageCompletionRate: number
    averageRevenuePerMonth: number
    averageTicketSize: number
    averageAIAccuracy: number
    averageConversionRate: number
    averageRevenuePerCustomer: number
  }
}

export interface RealTimeDashboard {
  todayStats: {
    totalAppointments: number
    completed: number
    upcoming: number
    revenue: number
  }
  todayAppointments: any[]
  recentConversations: any[]
  activeConversations: number
  lastUpdated: string
}

export interface AnalyticsSummary {
  totalAppointments: number
  totalRevenue: number
  newCustomers: number
  insights: string[]
  healthScore: number
}

export default AnalyticsService