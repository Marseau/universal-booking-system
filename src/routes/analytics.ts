import express from 'express'
import { AnalyticsService } from '../services/analytics.service'
import AdminAuthMiddleware from '../middleware/admin-auth'
import { logger } from '../utils/logger'

const router = express.Router()
const analyticsService = new AnalyticsService()

// Apply admin authentication to all routes
const adminAuth = new AdminAuthMiddleware()
router.use(adminAuth.verifyToken)

/**
 * GET /api/analytics
 * Get comprehensive analytics for a tenant
 */
router.get('/', async (req, res): Promise<any> => {
  try {
    const { period = '30d', tenant_id } = req.query
    
    // Use tenant from auth or query parameter
    const tenantId = tenant_id as string || req.admin?.tenantId
    
    if (!tenantId) {
      return res.status(400).json({
        error: 'Tenant ID is required'
      })
    }

    const analytics = await analyticsService.getTenantAnalytics(tenantId, period as string)
    
    res.json({
      success: true,
      data: analytics,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    logger.error('Error getting analytics:', error)
    res.status(500).json({
      error: 'Failed to get analytics',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

/**
 * GET /api/analytics/dashboard
 * Get dashboard-specific analytics (simplified)
 */
router.get('/dashboard', async (req, res): Promise<any> => {
  try {
    const { period = '30d' } = req.query
    const tenantId = req.admin?.tenantId
    
    if (!tenantId) {
      return res.status(400).json({
        error: 'Tenant ID is required'
      })
    }

    const analytics = await analyticsService.getTenantAnalytics(tenantId, period as string)
    
    // Simplified dashboard data
    const dashboardData = {
      metrics: {
        totalRevenue: analytics.revenue.total,
        totalAppointments: analytics.appointments.total,
        newCustomers: analytics.customers.new,
        conversionRate: analytics.conversion.rate,
        revenueGrowth: analytics.revenue.growthRate,
        appointmentsGrowth: analytics.appointments.growthRate,
        customersGrowth: analytics.customers.growthRate,
        conversionGrowth: analytics.conversion.growthRate
      },
      charts: {
        revenueDaily: analytics.revenue.dailyStats,
        appointmentsDaily: analytics.appointments.dailyStats,
        statusDistribution: analytics.appointments.statusDistribution,
        topServices: analytics.services.popular.slice(0, 5)
      },
      healthScore: analytics.summary.healthScore
    }
    
    res.json({
      success: true,
      data: dashboardData,
      period: analytics.period,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    logger.error('Error getting dashboard analytics:', error)
    res.status(500).json({
      error: 'Failed to get dashboard analytics',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

/**
 * GET /api/analytics/summary
 * Get analytics summary for overview cards
 */
router.get('/summary', async (req, res): Promise<any> => {
  try {
    const tenantId = req.admin?.tenantId
    
    if (!tenantId) {
      return res.status(400).json({
        error: 'Tenant ID is required'
      })
    }

    // Get different periods for comparison
    const [current, previous] = await Promise.all([
      analyticsService.getTenantAnalytics(tenantId, '30d'),
      analyticsService.getTenantAnalytics(tenantId, '30d-previous')
    ])

    const summary = {
      revenue: {
        current: current.revenue.total,
        previous: previous.revenue.total,
        growth: current.revenue.growthRate
      },
      appointments: {
        current: current.appointments.total,
        previous: previous.appointments.total,
        growth: current.appointments.growthRate
      },
      customers: {
        current: current.customers.new,
        previous: previous.customers.new,
        growth: current.customers.growthRate
      },
      conversion: {
        current: current.conversion.rate,
        previous: previous.conversion.rate,
        growth: current.conversion.growthRate
      },
      health: current.summary.healthScore
    }
    
    res.json({
      success: true,
      data: summary,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    logger.error('Error getting analytics summary:', error)
    res.status(500).json({
      error: 'Failed to get analytics summary',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

/**
 * GET /api/analytics/export
 * Export analytics data in different formats
 */
router.get('/export', async (req, res): Promise<any> => {
  try {
    const { format = 'json', period = '30d' } = req.query
    const tenantId = req.admin?.tenantId
    
    if (!tenantId) {
      return res.status(400).json({
        error: 'Tenant ID is required'
      })
    }

    const analytics = await analyticsService.getTenantAnalytics(tenantId, period as string)
    
    switch (format) {
      case 'csv':
        const csvData = generateCSV(analytics)
        res.setHeader('Content-Type', 'text/csv')
        res.setHeader('Content-Disposition', `attachment; filename="analytics-${period}.csv"`)
        res.send(csvData)
        break
        
      case 'pdf':
        // For now, return JSON with PDF structure
        res.json({
          success: true,
          message: 'PDF export functionality coming soon',
          data: analytics
        })
        break
        
      case 'excel':
        // For now, return JSON with Excel structure
        res.json({
          success: true,
          message: 'Excel export functionality coming soon',
          data: analytics
        })
        break
        
      default:
        res.json({
          success: true,
          data: analytics,
          format: 'json'
        })
    }

  } catch (error) {
    logger.error('Error exporting analytics:', error)
    res.status(500).json({
      error: 'Failed to export analytics',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

/**
 * GET /api/analytics/realtime
 * Get real-time analytics (last 24h)
 */
router.get('/realtime', async (req, res): Promise<any> => {
  try {
    const tenantId = req.admin?.tenantId
    
    if (!tenantId) {
      return res.status(400).json({
        error: 'Tenant ID is required'
      })
    }

    const analytics = await analyticsService.getTenantAnalytics(tenantId, '1d')
    
    const realtimeData = {
      appointments: {
        today: analytics.appointments.total,
        thisHour: 0, // Would need hour-based analytics
        status: analytics.appointments.statusDistribution
      },
      revenue: {
        today: analytics.revenue.total,
        thisHour: 0 // Would need hour-based revenue
      },
      ai: {
        accuracy: analytics.ai.accuracy,
        responsesProcessed: analytics.ai.totalInteractions
      },
      activeUsers: analytics.customers.active || 0
    }
    
    res.json({
      success: true,
      data: realtimeData,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    logger.error('Error getting realtime analytics:', error)
    res.status(500).json({
      error: 'Failed to get realtime analytics',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

/**
 * GET /api/analytics/benchmark
 * Get benchmark comparison with industry averages
 */
router.get('/benchmark', async (req, res): Promise<any> => {
  try {
    const tenantId = req.admin?.tenantId
    
    if (!tenantId) {
      return res.status(400).json({
        error: 'Tenant ID is required'
      })
    }

    const [analytics, benchmarks] = await Promise.all([
      analyticsService.getTenantAnalytics(tenantId, '30d'),
      analyticsService.getDomainBenchmarks()
    ])

    // Get tenant's domain for relevant benchmarks
    const tenantDomain = 'general' // TODO: Get from tenant data
    const domainBenchmarks = benchmarks[tenantDomain] || benchmarks.general || { benchmarks: { averageConversionRate: 0, averageCompletionRate: 0, averageRevenuePerCustomer: 0, averageAiAccuracy: 0 } }

    const comparison = {
      conversionRate: {
        tenant: analytics.conversion.rate,
        benchmark: domainBenchmarks.benchmarks?.averageConversionRate || 0,
        performance: analytics.conversion.rate >= (domainBenchmarks.benchmarks?.averageConversionRate || 0) ? 'above' : 'below'
      },
      completionRate: {
        tenant: analytics.appointments.completionRate,
        benchmark: domainBenchmarks.benchmarks?.averageCompletionRate || 0,
        performance: analytics.appointments.completionRate >= (domainBenchmarks.benchmarks?.averageCompletionRate || 0) ? 'above' : 'below'
      },
      revenuePerCustomer: {
        tenant: analytics.revenue.total / Math.max(analytics.customers.total, 1),
        benchmark: domainBenchmarks.benchmarks?.averageRevenuePerCustomer || 0,
        performance: 'calculating'
      },
      aiAccuracy: {
        tenant: analytics.ai.accuracy,
        benchmark: (domainBenchmarks.benchmarks as any)?.averageAIAccuracy || 0,
        performance: analytics.ai.accuracy >= ((domainBenchmarks.benchmarks as any)?.averageAIAccuracy || 0) ? 'above' : 'below'
      }
    }

    res.json({
      success: true,
      data: {
        domain: tenantDomain,
        comparison,
        benchmarks: domainBenchmarks
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    logger.error('Error getting benchmark analytics:', error)
    res.status(500).json({
      error: 'Failed to get benchmark analytics',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// Helper function to generate CSV
function generateCSV(analytics: any): string {
  const headers = [
    'Metric',
    'Value',
    'Growth Rate',
    'Period'
  ]

  const rows = [
    ['Total Revenue', analytics.revenue.total.toString(), analytics.revenue.growthRate.toString(), analytics.period],
    ['Total Appointments', analytics.appointments.total.toString(), analytics.appointments.growthRate.toString(), analytics.period],
    ['New Customers', analytics.customers.new.toString(), analytics.customers.growthRate.toString(), analytics.period],
    ['Conversion Rate', analytics.conversion.rate.toString(), analytics.conversion.growthRate.toString(), analytics.period],
    ['Completion Rate', analytics.appointments.completionRate.toString(), '0', analytics.period],
    ['Cancellation Rate', analytics.appointments.cancellationRate.toString(), '0', analytics.period],
    ['Health Score', analytics.summary.healthScore.toString(), '0', analytics.period]
  ]

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n')

  return csvContent
}

export default router